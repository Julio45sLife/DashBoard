import { Injectable } from '@nestjs/common';
import { InvoiceStatus, InvoiceType, EmployeeStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(tenantId: string) {
    const now = new Date();
    const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalContacts,
      newContactsThisMonth,
      totalActiveEmployees,
      revenueCurrentMonth,
      revenuePrevMonth,
      pendingInvoicesAmount,
      overdueInvoicesCount,
      recentInvoices,
      revenueByMonth,
      topContacts,
    ] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId } }),

      this.prisma.contact.count({
        where: { tenantId, createdAt: { gte: firstDayCurrentMonth } },
      }),

      this.prisma.employee.count({
        where: { tenantId, status: EmployeeStatus.ACTIVE },
      }),

      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          type: InvoiceType.INVOICE,
          status: InvoiceStatus.PAID,
          paidAt: { gte: firstDayCurrentMonth },
        },
        _sum: { totalCents: true },
      }),

      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          type: InvoiceType.INVOICE,
          status: InvoiceStatus.PAID,
          paidAt: { gte: firstDayPrevMonth, lte: lastDayPrevMonth },
        },
        _sum: { totalCents: true },
      }),

      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          type: InvoiceType.INVOICE,
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] },
        },
        _sum: { totalCents: true, paidCents: true },
      }),

      this.prisma.invoice.count({
        where: {
          tenantId,
          type: InvoiceType.INVOICE,
          status: InvoiceStatus.SENT,
          dueAt: { lt: now },
        },
      }),

      this.prisma.invoice.findMany({
        where: { tenantId, type: InvoiceType.INVOICE },
        take: 5,
        orderBy: { issuedAt: 'desc' },
        select: {
          id: true, number: true, status: true, totalCents: true,
          issuedAt: true, dueAt: true,
          contact: { select: { companyName: true, firstName: true, lastName: true } },
        },
      }),

      this.prisma.$queryRaw<Array<{ month: string; revenue: bigint }>>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "paidAt"), 'YYYY-MM') AS month,
          SUM("totalCents") AS revenue
        FROM "Invoice"
        WHERE "tenantId" = ${tenantId}
          AND "type" = 'INVOICE'
          AND "status" = 'PAID'
          AND "paidAt" >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "paidAt")
        ORDER BY DATE_TRUNC('month', "paidAt")
      `,

      this.prisma.contact.findMany({
        where: { tenantId, totalRevenue: { gt: 0 } },
        take: 5,
        orderBy: { totalRevenue: 'desc' },
        select: {
          id: true, companyName: true, firstName: true, lastName: true,
          totalRevenue: true, totalInvoices: true, status: true,
        },
      }),
    ]);

    const currentRevenue = revenueCurrentMonth._sum.totalCents ?? 0;
    const previousRevenue = revenuePrevMonth._sum.totalCents ?? 0;
    const revenueGrowth = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    const pendingAmount = (pendingInvoicesAmount._sum.totalCents ?? 0) - (pendingInvoicesAmount._sum.paidCents ?? 0);

    return {
      kpis: {
        totalContacts,
        newContactsThisMonth,
        totalActiveEmployees,
        revenueCurrentMonthCents: currentRevenue,
        revenuePrevMonthCents: previousRevenue,
        revenueGrowthPct: Math.round(revenueGrowth * 10) / 10,
        pendingAmountCents: pendingAmount,
        overdueInvoicesCount,
      },
      recentInvoices,
      revenueByMonth: revenueByMonth.map((r) => ({
        month: r.month,
        revenueCents: Number(r.revenue),
      })),
      topContacts,
    };
  }

  async getActivityFeed(tenantId: string, limit = 20) {
    const [recentInvoices, recentContacts] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { tenantId },
        take: limit / 2,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, number: true, status: true, totalCents: true, updatedAt: true, type: true,
          contact: { select: { companyName: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.contact.findMany({
        where: { tenantId },
        take: limit / 2,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, companyName: true, firstName: true, lastName: true,
          status: true, createdAt: true,
        },
      }),
    ]);

    return { recentInvoices, recentContacts };
  }
}
