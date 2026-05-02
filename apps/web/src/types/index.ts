// ─── API Response wrapper ────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  path: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Contacts / CRM ──────────────────────────────────────────────────────────
export type ContactStatus = 'LEAD' | 'PROSPECT' | 'CUSTOMER' | 'INACTIVE' | 'BLOCKED';

export interface Contact {
  id: string;
  isCompany: boolean;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status: ContactStatus;
  city?: string;
  totalRevenue: number;
  totalInvoices: number;
  lastInteraction?: string;
  tags: string[];
  createdAt: string;
}

export interface ContactDetail extends Contact {
  address?: string;
  postalCode?: string;
  country: string;
  siren?: string;
  vatNumber?: string;
  website?: string;
  notes?: string;
  interactions: Interaction[];
  invoices: InvoiceSummary[];
}

export interface Interaction {
  id: string;
  type: string;
  subject?: string;
  content: string;
  occurredAt: string;
}

// ─── Invoices ────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
export type InvoiceType = 'QUOTE' | 'INVOICE' | 'CREDIT';

export interface InvoiceSummary {
  id: string;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt?: string;
  paidAt?: string;
  totalCents: number;
  paidCents: number;
  currency: string;
  contact?: { id: string; companyName?: string; firstName?: string; lastName?: string };
}

export interface InvoiceDetail extends InvoiceSummary {
  subtotalCents: number;
  taxCents: number;
  taxRate: number;
  notes?: string;
  footer?: string;
  lineItems: LineItem[];
  payments: Payment[];
}

export interface LineItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRate: number;
  discountPct: number;
  totalCents: number;
}

export interface Payment {
  id: string;
  amountCents: number;
  method: string;
  reference?: string;
  paidAt: string;
}

// ─── HR ──────────────────────────────────────────────────────────────────────
export type EmployeeType = 'EMPLOYEE' | 'SUBCONTRACTOR' | 'INTERN' | 'FREELANCE';
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'TRIAL_PERIOD';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  type: EmployeeType;
  status: EmployeeStatus;
  position?: string;
  department?: string;
  grossSalary?: number;
  hiredAt?: string;
  companyName?: string;
  avatarUrl?: string;
  tags: string[];
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export interface DashboardKpis {
  totalContacts: number;
  newContactsThisMonth: number;
  totalActiveEmployees: number;
  revenueCurrentMonthCents: number;
  revenuePrevMonthCents: number;
  revenueGrowthPct: number;
  pendingAmountCents: number;
  overdueInvoicesCount: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  recentInvoices: InvoiceSummary[];
  revenueByMonth: { month: string; revenueCents: number }[];
  topContacts: Pick<Contact, 'id' | 'companyName' | 'firstName' | 'lastName' | 'totalRevenue' | 'totalInvoices' | 'status'>[];
}
