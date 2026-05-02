import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // ── HTTP metrics ──────────────────────────────────────────────────────────
  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;
  readonly httpRequestsInFlight: Gauge;

  // ── Business metrics ──────────────────────────────────────────────────────
  readonly invoicesCreated: Counter;
  readonly invoicesPaid: Counter;
  readonly invoiceRevenueCents: Counter;
  readonly activeTenantsGauge: Gauge;
  readonly contactsCreated: Counter;
  readonly authFailures: Counter;

  constructor() {
    this.registry = new Registry();

    this.httpRequestsTotal = new Counter({
      name: 'vilar_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'vilar_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'vilar_http_requests_in_flight',
      help: 'Current HTTP requests being processed',
      registers: [this.registry],
    });

    this.invoicesCreated = new Counter({
      name: 'vilar_invoices_created_total',
      help: 'Total invoices created',
      labelNames: ['tenant_plan', 'type'],
      registers: [this.registry],
    });

    this.invoicesPaid = new Counter({
      name: 'vilar_invoices_paid_total',
      help: 'Total invoices paid',
      registers: [this.registry],
    });

    this.invoiceRevenueCents = new Counter({
      name: 'vilar_invoice_revenue_cents_total',
      help: 'Total invoice revenue in cents',
      registers: [this.registry],
    });

    this.activeTenantsGauge = new Gauge({
      name: 'vilar_active_tenants',
      help: 'Number of active tenants',
      registers: [this.registry],
    });

    this.contactsCreated = new Counter({
      name: 'vilar_contacts_created_total',
      help: 'Total contacts created',
      registers: [this.registry],
    });

    this.authFailures = new Counter({
      name: 'vilar_auth_failures_total',
      help: 'Total authentication failures',
      labelNames: ['reason'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry, prefix: 'vilar_node_' });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
