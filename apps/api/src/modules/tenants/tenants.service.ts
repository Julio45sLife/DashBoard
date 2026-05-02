import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantPlan } from '@prisma/client';

export const PLAN_LIMITS: Record<TenantPlan, {
  maxUsers: number;
  maxInvoicesPerMonth: number;
  maxContacts: number;
  maxEmployees: number;
  features: string[];
}> = {
  FREE: {
    maxUsers: 2,
    maxInvoicesPerMonth: 10,
    maxContacts: 100,
    maxEmployees: 5,
    features: ['crm_basic', 'invoicing_basic', 'hr_basic'],
  },
  PRO: {
    maxUsers: 10,
    maxInvoicesPerMonth: 200,
    maxContacts: 2000,
    maxEmployees: 50,
    features: ['crm_basic', 'crm_advanced', 'invoicing_basic', 'invoicing_advanced', 'hr_basic', 'hr_advanced', 'analytics', 'pdf_export'],
  },
  ENTERPRISE: {
    maxUsers: 999,
    maxInvoicesPerMonth: 999999,
    maxContacts: 999999,
    maxEmployees: 999,
    features: ['crm_basic', 'crm_advanced', 'invoicing_basic', 'invoicing_advanced', 'hr_basic', 'hr_advanced', 'analytics', 'pdf_export', 'api_access', 'custom_branding', 'audit_logs', 'sso'],
  },
};

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException(`Tenant "${slug}" not found`);
    return tenant;
  }

  async getPlanLimits(tenantId: string) {
    const tenant = await this.findById(tenantId);
    return PLAN_LIMITS[tenant.plan];
  }

  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    if (!tenant) return false;
    return PLAN_LIMITS[tenant.plan].features.includes(feature);
  }

  async checkQuota(tenantId: string, metric: 'invoices_monthly' | 'contacts_total' | 'employees_total' | 'users_total'): Promise<{ allowed: boolean; current: number; limit: number }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    if (!tenant) return { allowed: false, current: 0, limit: 0 };

    const limits = PLAN_LIMITS[tenant.plan];
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let current = 0;
    let limit = 0;

    switch (metric) {
      case 'invoices_monthly': {
        const record = await this.prisma.usageRecord.findUnique({
          where: { tenantId_metric_period: { tenantId, metric: 'invoices_created', period } },
        });
        current = record?.value ?? 0;
        limit = limits.maxInvoicesPerMonth;
        break;
      }
      case 'contacts_total': {
        current = await this.prisma.contact.count({ where: { tenantId } });
        limit = limits.maxContacts;
        break;
      }
      case 'employees_total': {
        current = await this.prisma.employee.count({ where: { tenantId } });
        limit = limits.maxEmployees;
        break;
      }
      case 'users_total': {
        current = await this.prisma.user.count({ where: { tenantId, isActive: true } });
        limit = limits.maxUsers;
        break;
      }
    }

    return { allowed: current < limit, current, limit };
  }

  async incrementUsage(tenantId: string, metric: string, amount = 1): Promise<void> {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await this.prisma.usageRecord.upsert({
      where: { tenantId_metric_period: { tenantId, metric, period } },
      update: { value: { increment: amount } },
      create: { tenantId, metric, period, value: amount },
    });
  }

  async getSettings(tenantId: string) {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        siren: true,
        plan: true,
        status: true,
        trialEndsAt: true,
        logoUrl: true,
        primaryColor: true,
        defaultCurrency: true,
        defaultTaxRate: true,
        invoicePrefix: true,
        quotePrefix: true,
        timezone: true,
        locale: true,
        address: true,
        city: true,
        postalCode: true,
        country: true,
        email: true,
        phone: true,
        website: true,
      },
    });
  }

  async updateSettings(tenantId: string, data: Partial<{
    name: string;
    logoUrl: string;
    primaryColor: string;
    defaultCurrency: string;
    defaultTaxRate: number;
    invoicePrefix: string;
    quotePrefix: string;
    address: string;
    city: string;
    postalCode: string;
    email: string;
    phone: string;
    website: string;
  }>) {
    return this.prisma.tenant.update({ where: { id: tenantId }, data });
  }
}
