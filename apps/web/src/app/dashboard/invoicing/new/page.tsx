'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import apiClient from '../../../../lib/api';
import { invoicingService } from '../../../../lib/invoicing.service';
import { toast } from '../../../../components/ui/Toast';
import { Contact, ApiResponse, PaginatedResponse } from '../../../../types';

const lineItemSchema = z.object({
  description: z.string().min(1, 'Description requise'),
  quantity: z.coerce.number().min(0.01, 'Quantité > 0'),
  unitPriceCents: z.coerce.number().min(0, 'Prix ≥ 0'),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
});

const invoiceSchema = z.object({
  type: z.enum(['INVOICE', 'QUOTE']),
  contactId: z.string().optional(),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100),
  lineItems: z.array(lineItemSchema).min(1, 'Au moins une ligne requise'),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

function formatCents(c: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100);
}

export default function NewInvoicePage() {
  const router = useRouter();

  const { data: contactsData } = useQuery({
    queryKey: ['contacts-select'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PaginatedResponse<Contact>>>('/crm/contacts?limit=200');
      return res.data.data.data;
    },
  });

  const { register, control, watch, handleSubmit, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      type: 'INVOICE',
      taxRate: 20,
      lineItems: [{ description: '', quantity: 1, unitPriceCents: 0, taxRate: 20, discountPct: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const watchedItems = watch('lineItems');
  const watchedTaxRate = watch('taxRate');

  const subtotal = watchedItems.reduce((sum, item) => {
    const price = (Number(item.unitPriceCents) || 0) / 100;
    const qty = Number(item.quantity) || 0;
    const disc = Number(item.discountPct) || 0;
    return sum + price * qty * (1 - disc / 100);
  }, 0);
  const taxAmount = subtotal * ((Number(watchedTaxRate) || 20) / 100);
  const total = subtotal + taxAmount;

  const createMutation = useMutation({
    mutationFn: (data: InvoiceForm) =>
      invoicingService.create({
        ...data,
        lineItems: data.lineItems.map((item) => ({
          ...item,
          unitPriceCents: Math.round(Number(item.unitPriceCents) * 100) / 100,
        })),
      }),
    onSuccess: (invoice) => {
      toast.success(`${invoice.type === 'QUOTE' ? 'Devis' : 'Facture'} ${invoice.number} créé(e)`);
      router.push(`/dashboard/invoicing/${invoice.id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string[] } } } })?.response?.data?.error?.message?.[0];
      toast.error('Erreur de création', msg);
    },
  });

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau document</h1>
          <p className="text-gray-500 text-sm">Créer une facture ou un devis</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
        {/* Type + Client + Date */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Informations générales</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select {...register('type')} className="input-field">
                <option value="INVOICE">Facture</option>
                <option value="QUOTE">Devis</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select {...register('contactId')} className="input-field">
                <option value="">— Sélectionner un client —</option>
                {contactsData?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName ?? `${c.firstName} ${c.lastName}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'échéance</label>
              <input {...register('dueAt')} type="date" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TVA par défaut (%)</label>
              <input {...register('taxRate')} type="number" min="0" max="100" step="0.1" className="input-field" />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Lignes de facturation</h2>
            <button
              type="button"
              onClick={() => append({ description: '', quantity: 1, unitPriceCents: 0, taxRate: 20, discountPct: 0 })}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus size={14} /> Ajouter une ligne
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="py-2 text-left pr-3" style={{ width: '40%' }}>Description</th>
                  <th className="py-2 text-right pr-3" style={{ width: '10%' }}>Qté</th>
                  <th className="py-2 text-right pr-3" style={{ width: '18%' }}>P.U. HT (€)</th>
                  <th className="py-2 text-right pr-3" style={{ width: '12%' }}>TVA %</th>
                  <th className="py-2 text-right pr-3" style={{ width: '12%' }}>Remise %</th>
                  <th className="py-2 text-right" style={{ width: '8%' }} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fields.map((field, idx) => (
                  <tr key={field.id}>
                    <td className="py-2 pr-3">
                      <input
                        {...register(`lineItems.${idx}.description`)}
                        className="input-field py-1.5"
                        placeholder="Description du service ou produit"
                      />
                      {errors.lineItems?.[idx]?.description && (
                        <p className="text-red-500 text-xs mt-0.5">{errors.lineItems[idx]?.description?.message}</p>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <input {...register(`lineItems.${idx}.quantity`)} type="number" min="0.01" step="0.01" className="input-field py-1.5 text-right" />
                    </td>
                    <td className="py-2 pr-3">
                      <input {...register(`lineItems.${idx}.unitPriceCents`)} type="number" min="0" step="0.01" className="input-field py-1.5 text-right" placeholder="0.00" />
                    </td>
                    <td className="py-2 pr-3">
                      <input {...register(`lineItems.${idx}.taxRate`)} type="number" min="0" max="100" step="0.1" className="input-field py-1.5 text-right" />
                    </td>
                    <td className="py-2 pr-3">
                      <input {...register(`lineItems.${idx}.discountPct`)} type="number" min="0" max="100" step="0.1" className="input-field py-1.5 text-right" />
                    </td>
                    <td className="py-2 text-right">
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.lineItems?.root && (
            <p className="text-red-500 text-xs">{errors.lineItems.root.message}</p>
          )}

          {/* Totals */}
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <div className="space-y-1 text-sm min-w-48">
              <div className="flex justify-between text-gray-600">
                <span>Sous-total HT</span>
                <span>{formatCents(subtotal * 100)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>TVA</span>
                <span>{formatCents(taxAmount * 100)}</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900 text-base pt-1 border-t border-gray-200">
                <span>Total TTC</span>
                <span>{formatCents(total * 100)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Notes</h2>
          <textarea
            {...register('notes')}
            rows={3}
            className="input-field resize-none"
            placeholder="Conditions de paiement, remarques..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary flex items-center gap-2">
            {createMutation.isPending ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : <Save size={16} />}
            Créer le document
          </button>
        </div>
      </form>
    </div>
  );
}
