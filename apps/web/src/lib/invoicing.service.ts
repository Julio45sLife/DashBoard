import apiClient from './api';
import { InvoiceDetail, InvoiceSummary, PaginatedResponse, ApiResponse } from '../types';

export interface CreateInvoicePayload {
  type?: 'QUOTE' | 'INVOICE';
  contactId?: string;
  dueAt?: string;
  notes?: string;
  taxRate?: number;
  lineItems: { description: string; quantity: number; unitPriceCents: number; taxRate?: number; discountPct?: number }[];
}

export const invoicingService = {
  async list(params: URLSearchParams) {
    const res = await apiClient.get<ApiResponse<PaginatedResponse<InvoiceSummary>>>(`/invoicing?${params}`);
    return res.data.data;
  },

  async get(id: string) {
    const res = await apiClient.get<ApiResponse<InvoiceDetail>>(`/invoicing/${id}`);
    return res.data.data;
  },

  async create(payload: CreateInvoicePayload) {
    const res = await apiClient.post<ApiResponse<InvoiceDetail>>('/invoicing', payload);
    return res.data.data;
  },

  async update(id: string, payload: Partial<CreateInvoicePayload>) {
    const res = await apiClient.patch<ApiResponse<InvoiceDetail>>(`/invoicing/${id}`, payload);
    return res.data.data;
  },

  async send(id: string) {
    const res = await apiClient.post<ApiResponse<InvoiceDetail>>(`/invoicing/${id}/send`);
    return res.data.data;
  },

  async recordPayment(id: string, payload: { amountCents: number; method: string; reference?: string }) {
    const res = await apiClient.post<ApiResponse<InvoiceDetail>>(`/invoicing/${id}/payments`, payload);
    return res.data.data;
  },

  async cancel(id: string) {
    const res = await apiClient.post<ApiResponse<InvoiceDetail>>(`/invoicing/${id}/cancel`);
    return res.data.data;
  },

  async getStats() {
    const res = await apiClient.get<ApiResponse<{
      total: number;
      byStatus: { status: string; count: number; totalCents: number }[];
      monthlyRevenueCents: number;
      overdueCount: number;
    }>>('/invoicing/stats');
    return res.data.data;
  },
};
