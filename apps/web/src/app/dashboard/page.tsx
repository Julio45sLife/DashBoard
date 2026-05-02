'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Users, FileText, AlertCircle, Euro } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import apiClient from '../../lib/api';
import { DashboardData, InvoiceSummary } from '../../types';

function formatCents(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
}

function KpiCard({
  title, value, subtitle, icon, trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
}) {
  const isPositive = (trend?.value ?? 0) >= 0;

  return (
    <div className="card flex items-start gap-4">
      <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">{icon}</div>
      <div className="flex-1">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend.value)}% {trend.label}
          </div>
        )}
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-gray',
  SENT: 'badge-info',
  PAID: 'badge-success',
  OVERDUE: 'badge-danger',
  CANCELLED: 'badge-gray',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon', SENT: 'Envoyée', PAID: 'Payée', OVERDUE: 'En retard', CANCELLED: 'Annulée',
};

function InvoiceRow({ invoice }: { invoice: InvoiceSummary }) {
  const contactName = invoice.contact?.companyName ??
    `${invoice.contact?.firstName ?? ''} ${invoice.contact?.lastName ?? ''}`.trim() ??
    '—';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-blue-600">{invoice.number}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{contactName}</td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {format(parseISO(invoice.issuedAt), 'd MMM yyyy', { locale: fr })}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {formatCents(invoice.totalCents, invoice.currency)}
      </td>
      <td className="px-4 py-3">
        <span className={STATUS_BADGE[invoice.status] ?? 'badge-gray'}>
          {STATUS_LABEL[invoice.status] ?? invoice.status}
        </span>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: DashboardData }>('/dashboard');
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { kpis, recentInvoices, revenueByMonth, topContacts } = data;

  const chartData = revenueByMonth.map((m) => ({
    month: format(parseISO(`${m.month}-01`), 'MMM', { locale: fr }),
    revenue: m.revenueCents / 100,
  }));

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="CA du mois"
          value={formatCents(kpis.revenueCurrentMonthCents)}
          icon={<Euro size={20} />}
          trend={{ value: kpis.revenueGrowthPct, label: 'vs mois dernier' }}
        />
        <KpiCard
          title="En attente de paiement"
          value={formatCents(kpis.pendingAmountCents)}
          subtitle={kpis.overdueInvoicesCount > 0 ? `${kpis.overdueInvoicesCount} en retard` : undefined}
          icon={<FileText size={20} />}
        />
        <KpiCard
          title="Clients"
          value={kpis.totalContacts}
          subtitle={`+${kpis.newContactsThisMonth} ce mois`}
          icon={<Users size={20} />}
        />
        <KpiCard
          title="Employés actifs"
          value={kpis.totalActiveEmployees}
          icon={<Users size={20} />}
        />
      </div>

      {/* Overdue alert */}
      {kpis.overdueInvoicesCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle size={20} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            <strong>{kpis.overdueInvoicesCount} facture{kpis.overdueInvoicesCount > 1 ? 's' : ''}</strong> en retard de paiement.{' '}
            <a href="/dashboard/invoicing?status=OVERDUE" className="underline">Voir les factures</a>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="xl:col-span-2 card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Chiffre d'affaires — 12 mois</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a56db" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1a56db" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k€`} />
              <Tooltip formatter={(value: number) => [`${value.toLocaleString('fr-FR')} €`, 'CA']} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#1a56db"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top clients */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Top clients</h2>
          <div className="space-y-3">
            {topContacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-medium">
                  {(c.companyName ?? c.firstName ?? '?')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {c.companyName ?? `${c.firstName} ${c.lastName}`}
                  </p>
                  <p className="text-xs text-gray-400">{c.totalInvoices} facture{c.totalInvoices > 1 ? 's' : ''}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 shrink-0">
                  {formatCents(c.totalRevenue * 100)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Dernières factures</h2>
          <a href="/dashboard/invoicing" className="text-sm text-blue-600 hover:underline">Voir tout</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">N°</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Montant</th>
                <th className="px-4 py-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentInvoices.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)}
              {recentInvoices.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Aucune facture</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
