'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, UserCheck, UserX, Briefcase } from 'lucide-react';
import apiClient from '../../../lib/api';
import { Employee, ApiResponse, PaginatedResponse } from '../../../types';
import { toast } from '../../../components/ui/Toast';
import { Modal } from '../../../components/ui/Modal';

const TYPE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Salarié', SUBCONTRACTOR: 'Sous-traitant', INTERN: 'Stagiaire', FREELANCE: 'Freelance',
};
const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'badge-success', ON_LEAVE: 'badge-warning', TERMINATED: 'badge-danger', TRIAL_PERIOD: 'badge-info',
};
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif', ON_LEAVE: 'En congé', TERMINATED: 'Terminé', TRIAL_PERIOD: 'Période d\'essai',
};

const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  type: z.enum(['EMPLOYEE', 'SUBCONTRACTOR', 'INTERN', 'FREELANCE']),
  position: z.string().optional(),
  department: z.string().optional(),
  hiredAt: z.string().optional(),
  grossSalary: z.coerce.number().optional(),
  contractType: z.string().optional(),
});

type CreateEmployeeForm = z.infer<typeof createEmployeeSchema>;

function EmployeeCard({ emp }: { emp: Employee }) {
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
          {emp.firstName[0]}{emp.lastName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{emp.firstName} {emp.lastName}</p>
            <span className={STATUS_STYLES[emp.status] ?? 'badge-gray'}>{STATUS_LABELS[emp.status] ?? emp.status}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{emp.position ?? '—'} · {TYPE_LABELS[emp.type] ?? emp.type}</p>
          {emp.department && <p className="text-xs text-gray-400">{emp.department}</p>}
          <p className="text-xs text-gray-400 mt-1">{emp.email}</p>
        </div>
      </div>
    </div>
  );
}

export default function HrPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['hr-stats'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{
        total: number;
        byType: { type: string; count: number }[];
        byStatus: { status: string; count: number }[];
        byDepartment: { department: string; count: number }[];
      }>>('/hr/employees/stats');
      return res.data.data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search, type, status],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '24' });
      if (search) p.set('search', search);
      if (type) p.set('type', type);
      if (status) p.set('status', status);
      const res = await apiClient.get<ApiResponse<PaginatedResponse<Employee>>>(`/hr/employees?${p}`);
      return res.data.data;
    },
    placeholderData: (prev) => prev,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateEmployeeForm>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: { type: 'EMPLOYEE' },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateEmployeeForm) => apiClient.post('/hr/employees', data),
    onSuccess: () => {
      toast.success('Employé créé avec succès');
      setShowCreate(false);
      reset();
      void qc.invalidateQueries({ queryKey: ['employees'] });
      void qc.invalidateQueries({ queryKey: ['hr-stats'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string[] } } } })?.response?.data?.error?.message?.[0];
      toast.error('Erreur lors de la création', msg);
    },
  });

  const activeCount = stats?.byStatus.find((s) => s.status === 'ACTIVE')?.count ?? 0;
  const subcontractorCount = stats?.byType.find((t) => t.type === 'SUBCONTRACTOR')?.count ?? 0;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">RH — Équipe</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.meta.total ?? 0} personnes</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <UserCheck size={18} className="text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
            <p className="text-xs text-gray-500">Actifs</p>
          </div>
          <div className="card text-center">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Briefcase size={18} className="text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{subcontractorCount}</p>
            <p className="text-xs text-gray-500">Sous-traitants</p>
          </div>
          <div className="card text-center">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <UserX size={18} className="text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.byDepartment.length}</p>
            <p className="text-xs text-gray-500">Départements</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-3 py-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher..." className="input-field pl-8" />
        </div>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="input-field w-40">
          <option value="">Tous types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field w-40">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data?.data.map((emp) => <EmployeeCard key={emp.id} emp={emp} />)}
          {(data?.data.length ?? 0) === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              <UserCheck size={40} className="opacity-20 mx-auto mb-3" />
              <p>Aucun employé trouvé</p>
            </div>
          )}
        </div>
      )}

      {(data?.meta.totalPages ?? 0) > 1 && (
        <div className="flex justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary py-1 px-4 text-sm disabled:opacity-40">Précédent</button>
          <span className="text-sm text-gray-500 self-center">Page {page} / {data?.meta.totalPages}</span>
          <button disabled={page >= (data?.meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="btn-secondary py-1 px-4 text-sm disabled:opacity-40">Suivant</button>
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Ajouter un employé" size="lg">
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
              <input {...register('firstName')} className="input-field" />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input {...register('lastName')} className="input-field" />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input {...register('email')} type="email" className="input-field" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input {...register('phone')} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select {...register('type')} className="input-field">
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Poste</label>
              <input {...register('position')} className="input-field" placeholder="Chef de chantier" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
              <input {...register('department')} className="input-field" placeholder="Travaux" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date d'embauche</label>
              <input {...register('hiredAt')} type="date" className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salaire brut (€)</label>
              <input {...register('grossSalary')} type="number" min="0" step="100" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de contrat</label>
              <select {...register('contractType')} className="input-field">
                <option value="">— Sélectionner —</option>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="freelance">Freelance</option>
                <option value="stage">Stage</option>
                <option value="apprentissage">Apprentissage</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setShowCreate(false); reset(); }} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={isSubmitting || createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
