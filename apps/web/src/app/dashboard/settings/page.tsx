'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Building2, Percent, FileText } from 'lucide-react';
import apiClient from '../../../lib/api';
import { ApiResponse } from '../../../types';
import { toast } from '../../../components/ui/Toast';

interface TenantSettings {
  id: string;
  slug: string;
  name: string;
  siren?: string;
  plan: string;
  defaultCurrency: string;
  defaultTaxRate: number;
  invoicePrefix: string;
  quotePrefix: string;
  timezone: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country: string;
  email?: string;
  phone?: string;
  website?: string;
}

const settingsSchema = z.object({
  name: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('URL invalide').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().length(2, 'Code pays ISO 2 lettres'),
  defaultCurrency: z.string().length(3),
  defaultTaxRate: z.coerce.number().min(0).max(100),
  invoicePrefix: z.string().min(1).max(10),
  quotePrefix: z.string().min(1).max(10),
  timezone: z.string(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <div className="text-blue-600">{icon}</div>
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<TenantSettings>>('/tenant/settings');
      return res.data.data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name,
        email: settings.email ?? '',
        phone: settings.phone ?? '',
        website: settings.website ?? '',
        address: settings.address ?? '',
        city: settings.city ?? '',
        postalCode: settings.postalCode ?? '',
        country: settings.country,
        defaultCurrency: settings.defaultCurrency,
        defaultTaxRate: settings.defaultTaxRate,
        invoicePrefix: settings.invoicePrefix,
        quotePrefix: settings.quotePrefix,
        timezone: settings.timezone,
      });
    }
  }, [settings, reset]);

  const saveMutation = useMutation({
    mutationFn: (data: SettingsForm) => apiClient.patch('/tenant/settings', data),
    onSuccess: () => {
      toast.success('Paramètres enregistrés');
      void qc.invalidateQueries({ queryKey: ['tenant-settings'] });
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  });

  return (
    <div className="p-8 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-500 text-sm mt-1">
            {settings?.slug && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{settings.slug}.vilar-ds.fr</span>}
          </p>
        </div>
        <button
          form="settings-form"
          type="submit"
          disabled={!isDirty || saveMutation.isPending}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={15} />
          {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      <form id="settings-form" onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">

        <Section title="Entreprise" icon={<Building2 size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise *</label>
              <input {...register('name')} className="input-field" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email de contact</label>
              <input {...register('email')} type="email" className="input-field" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input {...register('phone')} className="input-field" placeholder="02 38 XX XX XX" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site web</label>
              <input {...register('website')} className="input-field" placeholder="https://vilar-ds.fr" />
              {errors.website && <p className="text-red-500 text-xs mt-1">{errors.website.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <input {...register('address')} className="input-field" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input {...register('city')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
              <input {...register('postalCode')} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pays (ISO)</label>
            <input {...register('country')} className="input-field w-24" maxLength={2} placeholder="FR" />
            {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country.message}</p>}
          </div>
        </Section>

        <Section title="Facturation" icon={<FileText size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Préfixe factures</label>
              <input {...register('invoicePrefix')} className="input-field" placeholder="FAC" maxLength={10} />
              <p className="text-xs text-gray-400 mt-1">Ex: FAC → FAC-2024-0001</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Préfixe devis</label>
              <input {...register('quotePrefix')} className="input-field" placeholder="DEV" maxLength={10} />
              <p className="text-xs text-gray-400 mt-1">Ex: DEV → DEV-2024-0001</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Devise par défaut</label>
              <select {...register('defaultCurrency')} className="input-field">
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuseau horaire</label>
              <select {...register('timezone')} className="input-field">
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="Europe/London">Europe/London</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Fiscalité" icon={<Percent size={16} />}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Taux de TVA par défaut (%)</label>
            <div className="flex items-center gap-2">
              <input {...register('defaultTaxRate')} type="number" min="0" max="100" step="0.1" className="input-field w-28" />
              <span className="text-gray-500 text-sm">%</span>
            </div>
            {errors.defaultTaxRate && <p className="text-red-500 text-xs mt-1">{errors.defaultTaxRate.message}</p>}
            <p className="text-xs text-gray-400 mt-1">Appliqué par défaut à toutes les nouvelles factures</p>
          </div>
        </Section>
      </form>
    </div>
  );
}
