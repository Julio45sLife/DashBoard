'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Search, Users } from 'lucide-react';
import apiClient from '../../../lib/api';
import { Contact, PaginatedResponse } from '../../../types';

const STATUS_STYLES: Record<string, string> = {
  LEAD: 'badge-gray',
  PROSPECT: 'badge-info',
  CUSTOMER: 'badge-success',
  INACTIVE: 'badge-warning',
  BLOCKED: 'badge-danger',
};

const STATUS_LABELS: Record<string, string> = {
  LEAD: 'Lead', PROSPECT: 'Prospect', CUSTOMER: 'Client', INACTIVE: 'Inactif', BLOCKED: 'Bloqué',
};

function formatRevenue(euros: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(euros);
}

export default function CrmPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', page, search, status],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const res = await apiClient.get<{ data: PaginatedResponse<Contact> }>(`/crm/contacts?${params}`);
      return res.data.data;
    },
    placeholderData: (prev) => prev,
  });

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM — Clients</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.meta.total ?? 0} contacts</p>
        </div>
        <Link href="/dashboard/crm/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Nouveau contact
        </Link>
      </div>

      {/* Filters */}
      <div className="card flex items-center gap-4 py-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher un contact..."
            className="input-field pl-8"
          />
        </div>
        <select
          value={status ?? ''}
          onChange={(e) => { setStatus(e.target.value || undefined); setPage(1); }}
          className="input-field w-40"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Téléphone</th>
                <th className="px-4 py-3 text-left">Ville</th>
                <th className="px-4 py-3 text-right">CA total</th>
                <th className="px-4 py-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-12 text-center">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </td></tr>
              )}
              {!isLoading && data?.data.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
                        {(c.companyName ?? c.firstName ?? '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <Link
                          href={`/dashboard/crm/${c.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600"
                        >
                          {c.companyName ?? `${c.firstName} ${c.lastName}`}
                        </Link>
                        {c.isCompany && (
                          <p className="text-xs text-gray-400">Société</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.city ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    {c.totalRevenue > 0 ? formatRevenue(c.totalRevenue) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={STATUS_STYLES[c.status] ?? 'badge-gray'}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!isLoading && (data?.data.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Users size={32} className="opacity-30" />
                      <p className="text-sm">Aucun contact trouvé</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(data?.meta.totalPages ?? 0) > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <p>
              {(page - 1) * 20 + 1}–{Math.min(page * 20, data!.meta.total)} sur {data!.meta.total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                disabled={page >= (data?.meta.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
