import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { EVENTS } from '../../events/domain-events';
import { CreateInvoiceDto, RecordPaymentDto, UpdateInvoiceDto, LineItemDto } from './dto/invoicing.dto';

@Injectable()
export class InvoicingService {
  private readonly logger = new Logger(InvoicingService.name);

  constructor(
    private prisma: PrismaService,
    private tenantsService: TenantsService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, params: {
    page: number;
    limit: number;
    status?: InvoiceStatus;
    type?: InvoiceType;
    search?: string;
    contactId?: string;
  }) {
    const { page, limit, status, type, search, contactId } = params;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(type && { type }),
      ...(contactId && { contactId }),
      ...(search && {
        OR: [
          { number: { contains: search, mode: 'insensitive' as const } },
          { contact: { companyName: { contains: search, mode: 'insensitive' as const } } },
          { contact: { lastName: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          issuedAt: true,
          dueAt: true,
          paidAt: true,
          totalCents: true,
          paidCents: true,
          currency: true,
          contact: { select: { id: true, companyName: true, firstName: true, lastName: true } },
        },
        orderBy: { issuedAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        contact: true,
        lineItems: { orderBy: { position: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });

    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
    return invoice;
  }

  async create(tenantId: string, userId: string, dto: CreateInvoiceDto) {
    const quota = await this.tenantsService.checkQuota(tenantId, 'invoices_monthly');
    if (!quota.allowed) {
      throw new ForbiddenException(`Monthly invoice limit reached (${quota.current}/${quota.limit}). Upgrade your plan.`);
    }

    if (dto.contactId) {
      const contact = await this.prisma.contact.findFirst({ where: { id: dto.contactId, tenantId } });
      if (!contact) throw new NotFoundException(`Contact ${dto.contactId} not found`);
    }

    const { number, tenant } = await this.generateInvoiceNumber(tenantId, dto.type ?? InvoiceType.INVOICE);
    const { subtotalCents, taxCents, totalCents } = this.calculateTotals(dto.lineItems, dto.taxRate ?? tenant.defaultTaxRate);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          tenantId,
          createdById: userId,
          type: dto.type ?? InvoiceType.INVOICE,
          status: InvoiceStatus.DRAFT,
          number,
          contactId: dto.contactId,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          taxRate: dto.taxRate ?? tenant.defaultTaxRate,
          currency: tenant.defaultCurrency,
          notes: dto.notes,
          footer: dto.footer,
          subtotalCents,
          taxCents,
          totalCents,
          lineItems: {
            create: dto.lineItems.map((item, idx) => ({
              position: idx + 1,
              description: item.description,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              taxRate: item.taxRate ?? dto.taxRate ?? tenant.defaultTaxRate,
              discountPct: item.discountPct ?? 0,
              totalCents: this.lineTotal(item, item.taxRate ?? dto.taxRate ?? tenant.defaultTaxRate),
            })),
          },
        },
        include: { lineItems: true },
      });

      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          [dto.type === InvoiceType.QUOTE ? 'nextQuoteSeq' : 'nextInvoiceSeq']: { increment: 1 },
        },
      });

      return inv;
    });

    await this.tenantsService.incrementUsage(tenantId, 'invoices_created');

    this.eventEmitter.emit(EVENTS.INVOICE_CREATED, {
      tenantId,
      invoiceId: invoice.id,
      number: invoice.number,
      contactId: invoice.contactId ?? undefined,
      totalCents: invoice.totalCents,
      currency: invoice.currency,
    });

    return invoice;
  }

  async update(tenantId: string, invoiceId: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(tenantId, invoiceId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be edited');
    }

    await this.tenantsService.getSettings(tenantId);
    const lineItems = dto.lineItems;

    const data: Record<string, unknown> = {
      ...(dto.contactId !== undefined && { contactId: dto.contactId }),
      ...(dto.dueAt !== undefined && { dueAt: new Date(dto.dueAt) }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.footer !== undefined && { footer: dto.footer }),
    };

    if (lineItems) {
      const { subtotalCents, taxCents, totalCents } = this.calculateTotals(lineItems, invoice.taxRate);
      Object.assign(data, { subtotalCents, taxCents, totalCents });

      await this.prisma.invoiceLineItem.deleteMany({ where: { invoiceId } });

      data.lineItems = {
        create: lineItems.map((item, idx) => ({
          position: idx + 1,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          taxRate: item.taxRate ?? invoice.taxRate,
          discountPct: item.discountPct ?? 0,
          totalCents: this.lineTotal(item, item.taxRate ?? invoice.taxRate),
        })),
      };
    }

    return this.prisma.invoice.update({ where: { id: invoiceId }, data, include: { lineItems: true } });
  }

  async markAsSent(tenantId: string, invoiceId: string) {
    const invoice = await this.findOne(tenantId, invoiceId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Invoice is not in DRAFT status');
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.SENT, sentAt: new Date() },
    });

    this.eventEmitter.emit(EVENTS.INVOICE_SENT, {
      tenantId,
      invoiceId: invoice.id,
      number: invoice.number,
      contactEmail: invoice.contact?.email ?? undefined,
    });

    return updated;
  }

  async recordPayment(tenantId: string, invoiceId: string, dto: RecordPaymentDto) {
    const invoice = await this.findOne(tenantId, invoiceId);

    if (!([InvoiceStatus.SENT, InvoiceStatus.OVERDUE] as InvoiceStatus[]).includes(invoice.status)) {
      throw new BadRequestException('Invoice must be SENT or OVERDUE to record payment');
    }

    const totalPaid = invoice.paidCents + dto.amountCents;
    const isFullyPaid = totalPaid >= invoice.totalCents;

    await this.prisma.$transaction([
      this.prisma.invoicePayment.create({
        data: {
          invoiceId,
          amountCents: dto.amountCents,
          method: dto.method,
          reference: dto.reference,
          notes: dto.notes,
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidCents: totalPaid,
          status: isFullyPaid ? InvoiceStatus.PAID : invoice.status,
          paidAt: isFullyPaid ? new Date() : undefined,
        },
      }),
    ]);

    if (isFullyPaid) {
      await this.prisma.contact.update({
        where: { id: invoice.contactId! },
        data: {
          totalRevenue: { increment: invoice.totalCents / 100 },
          totalInvoices: { increment: 1 },
        },
      });

      this.eventEmitter.emit(EVENTS.INVOICE_PAID, {
        tenantId,
        invoiceId: invoice.id,
        number: invoice.number,
        paidCents: totalPaid,
        method: dto.method,
      });
    }

    return this.findOne(tenantId, invoiceId);
  }

  async cancel(tenantId: string, invoiceId: string) {
    const invoice = await this.findOne(tenantId, invoiceId);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot cancel a paid invoice. Create a credit note instead.');
    }

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.CANCELLED },
    });
  }

  async getStats(tenantId: string) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, byStatus, monthlyRevenue, overdueCount] = await Promise.all([
      this.prisma.invoice.count({ where: { tenantId, type: InvoiceType.INVOICE } }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { tenantId, type: InvoiceType.INVOICE },
        _count: true,
        _sum: { totalCents: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          type: InvoiceType.INVOICE,
          status: InvoiceStatus.PAID,
          paidAt: { gte: firstDayOfMonth },
        },
        _sum: { totalCents: true },
      }),
      this.prisma.invoice.count({
        where: {
          tenantId,
          type: InvoiceType.INVOICE,
          status: InvoiceStatus.SENT,
          dueAt: { lt: now },
        },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
        totalCents: s._sum.totalCents ?? 0,
      })),
      monthlyRevenueCents: monthlyRevenue._sum.totalCents ?? 0,
      overdueCount,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async generateInvoiceNumber(tenantId: string, type: InvoiceType) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const year = new Date().getFullYear();
    const isQuote = type === InvoiceType.QUOTE;
    const seq = isQuote ? tenant.nextQuoteSeq : tenant.nextInvoiceSeq;
    const prefix = isQuote ? tenant.quotePrefix : tenant.invoicePrefix;
    const number = `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
    return { number, tenant };
  }

  private calculateTotals(items: LineItemDto[], defaultTaxRate: number) {
    let subtotalCents = 0;
    let taxCents = 0;

    for (const item of items) {
      const lineSubtotal = Math.round(item.unitPriceCents * item.quantity * (1 - (item.discountPct ?? 0) / 100));
      const lineTax = Math.round(lineSubtotal * ((item.taxRate ?? defaultTaxRate) / 100));
      subtotalCents += lineSubtotal;
      taxCents += lineTax;
    }

    return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
  }

  private lineTotal(item: LineItemDto, taxRate: number): number {
    const subtotal = Math.round(item.unitPriceCents * item.quantity * (1 - (item.discountPct ?? 0) / 100));
    return subtotal + Math.round(subtotal * (taxRate / 100));
  }
}
