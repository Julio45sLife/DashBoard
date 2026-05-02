import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, RawBodyRequest, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/user.decorator';
import { Public } from '../../common/decorators/roles.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private billingService: BillingService,
    private config: ConfigService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current subscription status' })
  getStatus(@CurrentUser() user: JwtPayload) {
    return this.billingService.getSubscriptionStatus(user.tenantId);
  }

  @Post('checkout')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Create Stripe Checkout session to upgrade plan' })
  async createCheckout(
    @CurrentUser() user: JwtPayload,
    @Body() body: { plan: 'PRO' | 'ENTERPRISE' },
  ) {
    const frontendUrl = this.config.get<string>('app.frontendUrl');
    return this.billingService.createCheckoutSession(
      user.tenantId,
      body.plan,
      `${frontendUrl}/dashboard/billing?success=true`,
      `${frontendUrl}/dashboard/billing?cancelled=true`,
    );
  }

  @Post('portal')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Open Stripe Customer Portal to manage billing' })
  async createPortal(@CurrentUser() user: JwtPayload) {
    const frontendUrl = this.config.get<string>('app.frontendUrl');
    return this.billingService.createPortalSession(user.tenantId, `${frontendUrl}/dashboard/billing`);
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver (do not call manually)' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.billingService.handleWebhook(req.rawBody!, signature);
    return { received: true };
  }
}
