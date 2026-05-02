// ─────────────────────────────────────────────────────────────────────────────
// Domain Events — typed contracts for the internal event bus (EventEmitter2)
// ─────────────────────────────────────────────────────────────────────────────

export const EVENTS = {
  USER_REGISTERED: 'user.registered',
  USER_VERIFIED: 'user.verified',
  INVOICE_CREATED: 'invoice.created',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_OVERDUE: 'invoice.overdue',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  SUBSCRIPTION_STARTED: 'subscription.started',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  CONTACT_CREATED: 'contact.created',
  EMPLOYEE_CREATED: 'employee.created',
  EMPLOYEE_TERMINATED: 'employee.terminated',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export interface UserRegisteredEvent {
  tenantId: string;
  userId: string;
  email: string;
  firstName: string;
}

export interface InvoiceCreatedEvent {
  tenantId: string;
  invoiceId: string;
  number: string;
  contactId?: string;
  totalCents: number;
  currency: string;
}

export interface InvoiceSentEvent {
  tenantId: string;
  invoiceId: string;
  number: string;
  contactEmail?: string;
}

export interface InvoicePaidEvent {
  tenantId: string;
  invoiceId: string;
  number: string;
  paidCents: number;
  method: string;
}

export interface PaymentSucceededEvent {
  tenantId: string;
  invoiceId?: string;
  stripePaymentIntentId: string;
  amountCents: number;
  currency: string;
}

export interface SubscriptionStartedEvent {
  tenantId: string;
  plan: string;
  stripeSubscriptionId: string;
}
