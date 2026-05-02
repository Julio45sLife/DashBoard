export const QUEUES = {
  MAIL: 'mail',
  PDF: 'pdf-generation',
  INVOICE: 'invoice-processing',
  AUDIT: 'audit-log',
} as const;

export const JOBS = {
  SEND_WELCOME_EMAIL: 'send-welcome-email',
  SEND_INVOICE_EMAIL: 'send-invoice-email',
  SEND_PASSWORD_RESET: 'send-password-reset',
  GENERATE_INVOICE_PDF: 'generate-invoice-pdf',
  MARK_OVERDUE_INVOICES: 'mark-overdue-invoices',
  WRITE_AUDIT_LOG: 'write-audit-log',
} as const;
