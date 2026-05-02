import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantPlan, TenantStatus } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service';
import { EVENTS } from '../../events/domain-events';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  private readonly PLAN_TO_PRICE: Record<string, string | undefined>;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.stripe = new Stripe(config.getOrThrow<string>('stripe.secretKey'), {
      apiVersion: '2023-10-16',
    });

    this.PLAN_TO_PRICE = {
      PRO: config.get<string>('stripe.prices.pro'),
      ENTERPRISE: config.get<string>('stripe.prices.enterprise'),
    };
  }

  async getOrCreateCustomer(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);

    if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      name: tenant.name,
      email: tenant.email ?? undefined,
      metadata: { tenantId, slug: tenant.slug },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createCheckoutSession(tenantId: string, plan: 'PRO' | 'ENTERPRISE', successUrl: string, cancelUrl: string): Promise<{ url: string }> {
    const priceId = this.PLAN_TO_PRICE[plan];
    if (!priceId) throw new BadRequestException(`No price configured for plan ${plan}`);

    const customerId = await this.getOrCreateCustomer(tenantId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: { tenantId, plan },
      subscription_data: {
        metadata: { tenantId, plan },
        trial_period_days: tenant?.plan === TenantPlan.FREE ? 0 : undefined,
      },
      allow_promotion_codes: true,
    });

    if (!session.url) throw new BadRequestException('Failed to create checkout session');
    return { url: session.url };
  }

  async createPortalSession(tenantId: string, returnUrl: string): Promise<{ url: string }> {
    const customerId = await this.getOrCreateCustomer(tenantId);
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.getOrThrow<string>('stripe.webhookSecret');
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.error(`Stripe webhook signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    const existing = await this.prisma.webhookEvent.findUnique({ where: { id: event.id } });
    if (existing?.processed) {
      this.logger.debug(`Webhook ${event.id} already processed, skipping`);
      return;
    }

    await this.prisma.webhookEvent.upsert({
      where: { id: event.id },
      update: {},
      create: { id: event.id, type: event.type, data: event.data as object },
    });

    try {
      await this.processStripeEvent(event);
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (err) {
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { error: (err as Error).message },
      });
      throw err;
    }
  }

  private async processStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.metadata?.tenantId) {
          await this.activateSubscription(
            session.metadata.tenantId,
            session.subscription as string,
            session.metadata.plan as TenantPlan,
          );
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await this.syncSubscription(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.cancelSubscription(sub);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        this.logger.log(`Payment succeeded for customer ${invoice.customer}`);
        const tenantId = await this.getTenantIdByCustomer(invoice.customer as string);
        if (tenantId) {
          this.eventEmitter.emit(EVENTS.PAYMENT_SUCCEEDED, {
            tenantId,
            stripePaymentIntentId: invoice.payment_intent as string,
            amountCents: invoice.amount_paid,
            currency: invoice.currency,
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        this.logger.warn(`Payment failed for customer ${(event.data.object as Stripe.Invoice).customer}`);
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async activateSubscription(tenantId: string, subscriptionId: string, plan: TenantPlan): Promise<void> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan,
        status: TenantStatus.ACTIVE,
        stripeSubscriptionId: subscriptionId,
        currentPeriodEnd: new Date((sub.current_period_end) * 1000),
      },
    });

    this.eventEmitter.emit(EVENTS.SUBSCRIPTION_STARTED, { tenantId, plan, stripeSubscriptionId: subscriptionId });
    this.logger.log(`Tenant ${tenantId} upgraded to ${plan}`);
  }

  private async syncSubscription(sub: Stripe.Subscription): Promise<void> {
    const tenantId = sub.metadata?.tenantId;
    if (!tenantId) return;

    const planName = (sub.metadata?.plan as TenantPlan) ?? TenantPlan.FREE;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan: planName,
        status: sub.status === 'active' ? TenantStatus.ACTIVE : TenantStatus.SUSPENDED,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    });
  }

  private async cancelSubscription(sub: Stripe.Subscription): Promise<void> {
    const tenantId = sub.metadata?.tenantId;
    if (!tenantId) return;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: TenantPlan.FREE, status: TenantStatus.CANCELLED, stripeSubscriptionId: null, currentPeriodEnd: null },
    });

    this.eventEmitter.emit(EVENTS.SUBSCRIPTION_CANCELLED, { tenantId });
    this.logger.log(`Tenant ${tenantId} subscription cancelled — downgraded to FREE`);
  }

  private async getTenantIdByCustomer(customerId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    return tenant?.id ?? null;
  }

  async getSubscriptionStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, status: true, currentPeriodEnd: true, stripeSubscriptionId: true, trialEndsAt: true },
    });
    return tenant;
  }
}
