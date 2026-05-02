'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft, Send, CreditCard, XCircle, Download,
  CheckCircle, Clock, AlertCircle, FileText,
} from 'lucide-react';
import { invoicingService } from '../../../../lib/invoicing.service';
import { InvoiceDetail } from '../../../../types';
import { toast } from '../../../../components/ui/Toast';
import { Modal } from '../../../../components/ui/Modal';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  DRAFT:     { label: 'Brouillon',  badge: 'badge-gray',    icon: <Clock size={14} /> },
  SENT:      { label: 'Envoyée',    badge: 'badge-info',    icon: <Send size={14} /> },
  PAID:      { label: 'Payée',      badge: 'badge-success', icon: <CheckCircle size={14} /> },
  OVERDUE:   { label: 'En retard',  badge: 'badge-danger',  icon: <AlertCircle size={14} /> },
  CANCELLED: { label: 'Annulée',    badge: 'badge-gray',    icon: <XCircle size={14} /> },
  REFUNDED:  { label: 'Remboursée', badge: 'badge-warning', icon: <CreditCard size={14} /> },
};
const TYPE_LABEL: Record<string, string> = { INVOICE: 'Facture', QUOTE: 'Devis', CREDIT: 'Avoir' };

function formatCents(c: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100);
}

// ── Payment modal schema ──────────────────────────────────────────────────────
const paymentSchema = z.object({
  amountCents: z.coerce.number().min(1, 'Montant requis'),
  method: z.enum(['BANK_TRANSFER', 'CARD', 'CASH', 'CHECK', 'OTHER']),
  reference: z.string().optional(),
});
type PaymentForm = z.infer<typeof paymentSchema>;

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Virement bancaire',
  CARD: 'Carte bancaire',
  CASH: 'Espèces',
  CHECK: 'Chèque',
  OTHER: 'Autre',
};

// ── Components ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, badge: 'badge-gray', icon: null };
  return (
    <span className={`${cfg.badge} flex items-center gap-1`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function LineItemsTable({ items }: { items: InvoiceDetail['lineItems'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500 border-b border-gray-100">
          <tr>
            <th className="py-2 text-left pr-3" style={{ width: '45%' }}>Description</th>
            <th className="py-2 text-right pr-3" style={{ width: '10%' }}>Qté</th>
            <th className="py-2 text-right pr-3" style={{ width: '15%' }}>P.U. HT</th>
            <th className="py-2 text-right pr-3" style={{ width: '10%' }}>TVA %</th>
            <th className="py-2 text-right pr-3" style={{ width: '10%' }}>Remise %</th>
            <th className="py-2 text-right"      style={{ width: '10%' }}>Total HT</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="py-2.5 pr-3 text-gray-800">{item.description}</td>
              <td className="py-2.5 pr-3 text-right text-gray-600">{item.quantity}</td>
              <td className="py-2.5 pr-3 text-right text-gray-600">{formatCents(item.unitPriceCents)}</td>
              <td className="py-2.5 pr-3 text-right text-gray-600">{item.taxRate}%</td>
              <td className="py-2.5 pr-3 text-right text-gray-500">{item.discountPct > 0 ? `${item.discountPct}%` : '—'}</td>
              <td className="py-2.5 text-right font-medium text-gray-800">{formatCents(item.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [showPayment, setShowPayment] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicingService.get(id),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: 'BANK_TRANSFER' },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['invoice', id] });
    void qc.invalidateQueries({ queryKey: ['invoices'] });
  };

  const sendMutation = useMutation({
    mutationFn: () => invoicingService.send(id),
    onSuccess: () => { toast.success('Document marqué comme envoyé'); invalidate(); },
    onError: () => toast.error('Erreur lors de l\'envoi'),
  });

  const paymentMutation = useMutation({
    mutationFn: (data: PaymentForm) =>
      invoicingService.recordPayment(id, {
        amountCents: Math.round(data.amountCents * 100),
        method: data.method,
        reference: data.reference,
      }),
    onSuccess: () => {
      toast.success('Paiement enregistré');
      setShowPayment(false);
      reset();
      invalidate();
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement du paiement'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => invoicingService.cancel(id),
    onSuccess: () => {
      toast.success('Document annulé');
      setShowCancel(false);
      invalidate();
    },
    onError: () => toast.error('Erreur lors de l\'annulation'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center text-gray-400">
        <FileText size={40} className="opacity-20 mx-auto mb-3" />
        <p>Document introuvable.</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4">Retour</button>
      </div>
    );
  }

  const contactName = (invoice.contact?.companyName ??
    `${invoice.contact?.firstName ?? ''} ${invoice.contact?.lastName ?? ''}`.trim()) || null;

  const balance = invoice.totalCents - invoice.paidCents;
  const canSend = invoice.status === 'DRAFT';
  const canPay = invoice.status === 'SENT' || invoice.status === 'OVERDUE';
  const canCancel = invoice.status !== 'CANCELLED' && invoice.status !== 'PAID';

  const remainingForPayment = balance / 100;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{invoice.number}</h1>
            <span className="text-sm text-gray-400">{TYPE_LABEL[invoice.type] ?? invoice.type}</span>
            <StatusBadge status={invoice.status} />
          </div>
          {contactName && (
            <p className="text-sm text-gray-500 mt-0.5">
              Client :{' '}
              {invoice.contact?.id ? (
                <Link href={`/dashboard/crm/${invoice.contact.id}`} className="hover:text-blue-600 underline">
                  {contactName}
                </Link>
              ) : contactName}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {canSend && (
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Send size={14} />
              Marquer envoyé
            </button>
          )}
          {canPay && (
            <button
              onClick={() => setShowPayment(true)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <CreditCard size={14} />
              Enregistrer paiement
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setShowCancel(true)}
              className="btn-secondary flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
            >
              <XCircle size={14} />
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Émise le</p>
            <p className="font-medium text-gray-800">
              {format(parseISO(invoice.issuedAt), 'd MMM yyyy', { locale: fr })}
            </p>
          </div>
          {invoice.dueAt && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Échéance</p>
              <p className={`font-medium ${invoice.status === 'OVERDUE' ? 'text-red-600' : 'text-gray-800'}`}>
                {format(parseISO(invoice.dueAt), 'd MMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
          {invoice.paidAt && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Payée le</p>
              <p className="font-medium text-green-700">
                {format(parseISO(invoice.paidAt), 'd MMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Devise</p>
            <p className="font-medium text-gray-800">{invoice.currency}</p>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Lignes</h2>
        <LineItemsTable items={invoice.lineItems} />

        {/* Totals */}
        <div className="flex justify-end pt-3 border-t border-gray-100">
          <div className="space-y-1.5 text-sm min-w-52">
            <div className="flex justify-between text-gray-600">
              <span>Sous-total HT</span>
              <span>{formatCents(invoice.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>TVA ({invoice.taxRate}%)</span>
              <span>{formatCents(invoice.taxCents)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200">
              <span>Total TTC</span>
              <span>{formatCents(invoice.totalCents)}</span>
            </div>
            {invoice.paidCents > 0 && (
              <>
                <div className="flex justify-between text-green-700">
                  <span>Déjà réglé</span>
                  <span>− {formatCents(invoice.paidCents)}</span>
                </div>
                <div className={`flex justify-between font-semibold pt-1 border-t border-gray-200 ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                  <span>Solde restant</span>
                  <span>{formatCents(balance)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

      {/* Payments */}
      {invoice.payments.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Paiements ({invoice.payments.length})
          </h2>
          <div className="divide-y divide-gray-100">
            {invoice.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">{METHOD_LABELS[p.method] ?? p.method}</p>
                  <p className="text-xs text-gray-400">
                    {format(parseISO(p.paidAt), 'd MMM yyyy', { locale: fr })}
                    {p.reference && <> · Réf. {p.reference}</>}
                  </p>
                </div>
                <span className="text-sm font-semibold text-green-700">+{formatCents(p.amountCents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record payment modal */}
      <Modal open={showPayment} onClose={() => { setShowPayment(false); reset(); }} title="Enregistrer un paiement" size="md">
        <form onSubmit={handleSubmit((data) => paymentMutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant (€) *</label>
              <input
                {...register('amountCents')}
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={remainingForPayment > 0 ? remainingForPayment.toFixed(2) : ''}
                className="input-field"
                placeholder="0.00"
              />
              {errors.amountCents && <p className="text-red-500 text-xs mt-1">{errors.amountCents.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement</label>
              <select {...register('method')} className="input-field">
                {Object.entries(METHOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Référence</label>
            <input {...register('reference')} className="input-field" placeholder="N° virement, chèque..." />
          </div>
          <p className="text-xs text-gray-400">
            Solde restant : <span className="font-semibold">{formatCents(balance)}</span>
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setShowPayment(false); reset(); }} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={paymentMutation.isPending} className="btn-primary flex items-center gap-2">
              <CreditCard size={14} />
              {paymentMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel confirm dialog */}
      <ConfirmDialog
        open={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => cancelMutation.mutate()}
        loading={cancelMutation.isPending}
        title="Annuler ce document ?"
        description="Cette action est irréversible. Le document sera marqué comme annulé et ne pourra plus être modifié."
        confirmLabel="Annuler le document"
        confirmVariant="danger"
      />
    </div>
  );
}
