'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Search, FileText, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { invoicingService } from '../../../lib/invoicing.service';
import { InvoiceSummary } from '../../../types';
import { toast } from '../../../components/ui/Toast';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'badge-gray', SENT: 'badge-info', PAID: 'badge-success',
  OVERDUE: 'badge-danger', CANCELLED: 'badge-gray',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon', SENT: 'Envoyée', PAID: 'Payée',
  OVERDUE: 'En retard', CANCELLED: 'Annulée',
};
const TYPE_LABEL: Record<string, string> = { INVOICE: 'Facture', QUOTE: 'Devis', CREDIT: 'Avoir' };

function formatCents(c: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100);
}

function KpiBox({ label, value, sub, color = 'blue' }: { label: string; value: string; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700', yellow: 'bg-yellow-50 text-yellow-700',
  };
  return (
    <div className="card">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${colors[color] ?? colors.blue} px-2 py-0.5 rounded inline-block`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function InvoiceRow({ inv, onSend }: { inv: InvoiceSummary; onSend: (id: string) => void }) {
  const contactName = (inv.contact?.companyName ??
    `${inv.contact?.firstName ?? ''} ${inv.contact?.lastName ?? ''}`.trim()) || '—';
  const balance = inv.totalCents - inv.paidCents;

  return (
    <tr className="hover:bg-gray-50 transition-colors group">
      <td className="px-4 py-3">
        <div>
          <Link href={`/dashboard/invoicing/${inv.id}`} className="text-sm font-medium text-blue-600 hover:underline">
            {inv.number}
          </Link>
          <p className="text-xs text-gray-400">{TYPE_LABEL[inv.type] ?? inv.type}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{contactName}</td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {format(parseISO(inv.issuedAt), 'd MMM yyyy', { locale: fr })}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {inv.dueAt ? format(parseISO(inv.dueAt), 'd MMM yyyy', { locale: fr }) : '—'}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatCents(inv.totalCents)}</td>
      <td className="px-4 py-3 text-sm text-right">
        {balance > 0 && inv.status !== 'CANCELLED' ? (
          <span className="text-amber-600 font-medium">{formatCents(balance)}</span>
        ) : '—'}
      </td>
      <td className="px-4 py-3">
        <span className={STATUS_STYLE[inv.status] ?? 'badge-gray'}>{STATUS_LABEL[inv.status] ?? inv.status}</span>
      </td>
      <td className="px-4 py-3">
        {inv.status === 'DRAFT' && (
          <button
            onClick={() => onSend(inv.id)}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-blue-600 hover:underline transition-opacity"
          >
            <Send size={12} /> Envoyer
          </button>
        )}
      </td>
    </tr>
  );
}

export default function InvoicingPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [sendId, setSendId] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['invoicing-stats'],
    queryFn: () => invoicingService.getStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search, status, type],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) p.set('search', search);
      if (status) p.set('status', status);
      if (type) p.set('type', type);
      return invoicingService.list(p);
    },
    placeholderData: (prev) => prev,
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => invoicingService.send(id),
    onSuccess: () => {
      toast.success('Facture marquée comme envoyée');
      setSendId(null);
      void qc.invalidateQueries({ queryKey: ['invoices'] });
      void qc.invalidateQueries({ queryKey: ['invoicing-stats'] });
    },
    onError: () => toast.error('Erreur lors de l\'envoi'),
  });

  const totalPendingCents = stats?.byStatus.find((s) => s.status === 'SENT')?.totalCents ?? 0;
  const totalPaidCents = stats?.byStatus.find((s) => s.status === 'PAID')?.totalCents ?? 0;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturation</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.meta.total ?? 0} document{(data?.meta.total ?? 0) > 1 ? 's' : ''}</p>
        </div>
        <Link href="/dashboard/invoicing/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvelle facture
        </Link>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiBox label="CA encaissé (mois)" value={formatCents(stats.monthlyRevenueCents)} color="green" />
          <KpiBox label="En attente" value={formatCents(totalPendingCents)} sub={`${stats.byStatus.find((s) => s.status === 'SENT')?.count ?? 0} factures`} color="blue" />
          <KpiBox label="En retard" value={String(stats.overdueCount)} sub="factures échues non payées" color="red" />
          <KpiBox label="Total factures" value={String(stats.total)} color="blue" />
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-3 py-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="N° facture, client..."
            className="input-field pl-8"
          />
        </div>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="input-field w-36">
          <option value="">Tous types</option>
          <option value="INVOICE">Factures</option>
          <option value="QUOTE">Devis</option>
          <option value="CREDIT">Avoirs</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field w-40">
          <option value="">Tous statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="SENT">Envoyée</option>
          <option value="PAID">Payée</option>
          <option value="OVERDUE">En retard</option>
          <option value="CANCELLED">Annulée</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">N° / Type</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Échéance</th>
                <th className="px-4 py-3 text-right">Montant TTC</th>
                <th className="px-4 py-3 text-right">Reste dû</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-12 text-center">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </td></tr>
              )}
              {!isLoading && data?.data.map((inv) => (
                <InvoiceRow key={inv.id} inv={inv} onSend={setSendId} />
              ))}
              {!isLoading && (data?.data.length ?? 0) === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <FileText size={32} className="opacity-30" />
                    <p className="text-sm">Aucun document trouvé</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {(data?.meta.totalPages ?? 0) > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <p>Page {page} / {data?.meta.totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary py-1 px-3 text-xs disabled:opacity-40">Précédent</button>
              <button disabled={page >= (data?.meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="btn-secondary py-1 px-3 text-xs disabled:opacity-40">Suivant</button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!sendId}
        onClose={() => setSendId(null)}
        onConfirm={() => sendMutation.mutate(sendId!)}
        loading={sendMutation.isPending}
        title="Marquer comme envoyée ?"
        description="La facture passera au statut ENVOYÉE. Cette action est irréversible."
        confirmLabel="Marquer envoyée"
        confirmVariant="primary"
      />
    </div>
  );
}
