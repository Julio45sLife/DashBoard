'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import apiClient from '../../../../lib/api';
import { ApiResponse } from '../../../../types';
import { toast } from '../../../../components/ui/Toast';

const schema = z.object({
  isCompany: z.boolean(),
  companyName: z.string().max(200).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  website: z.string().url('URL invalide').optional().or(z.literal('')),
  status: z.enum(['LEAD', 'PROSPECT', 'CUSTOMER', 'INACTIVE', 'BLOCKED']),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().length(2).optional(),
  siren: z.string().optional(),
  vatNumber: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});

type ContactForm = z.infer<typeof schema>;

export default function NewContactPage() {
  const router = useRouter();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ContactForm>({
    resolver: zodResolver(schema),
    defaultValues: { isCompany: false, status: 'LEAD', country: 'FR' },
  });

  const isCompany = watch('isCompany');

  const mutation = useMutation({
    mutationFn: (data: ContactForm) =>
      apiClient.post<ApiResponse<{ id: string }>>('/crm/contacts', data),
    onSuccess: ({ data }) => {
      toast.success('Contact créé avec succès');
      router.push(`/dashboard/crm/${data.data.id}`);
    },
    onError: () => toast.error('Erreur lors de la création du contact'),
  });

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau contact</h1>
          <p className="text-gray-500 text-sm">Ajouter un client, prospect ou lead</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        {/* Type + statut */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Type de contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select {...register('isCompany', { setValueAs: (v) => v === 'true' })} className="input-field">
                <option value="false">Particulier</option>
                <option value="true">Société</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select {...register('status')} className="input-field">
                <option value="LEAD">Lead</option>
                <option value="PROSPECT">Prospect</option>
                <option value="CUSTOMER">Client</option>
                <option value="INACTIVE">Inactif</option>
                <option value="BLOCKED">Bloqué</option>
              </select>
            </div>
          </div>
        </div>

        {/* Identité */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Identité</h2>

          {isCompany && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la société *</label>
              <input {...register('companyName')} className="input-field" placeholder="ACME Corp" />
              {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isCompany ? 'Prénom du contact' : 'Prénom'}
              </label>
              <input {...register('firstName')} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isCompany ? 'Nom du contact' : 'Nom'}
              </label>
              <input {...register('lastName')} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input {...register('email')} type="email" className="input-field" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input {...register('phone')} className="input-field" placeholder="02 38 XX XX XX" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
              <input {...register('mobile')} className="input-field" placeholder="06 XX XX XX XX" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site web</label>
              <input {...register('website')} className="input-field" placeholder="https://example.com" />
              {errors.website && <p className="text-red-500 text-xs mt-1">{errors.website.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select {...register('source')} className="input-field">
              <option value="">— Sélectionner —</option>
              <option value="inbound">Inbound</option>
              <option value="referral">Bouche à oreille</option>
              <option value="outbound">Prospection</option>
              <option value="partner">Partenaire</option>
              <option value="other">Autre</option>
            </select>
          </div>
        </div>

        {/* Adresse */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Adresse</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rue</label>
            <input {...register('address')} className="input-field" placeholder="10 rue de la Paix" />
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
        </div>

        {/* Infos légales (sociétés) */}
        {isCompany && (
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Informations légales</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SIREN</label>
                <input {...register('siren')} className="input-field font-mono" placeholder="495 126 344" maxLength={14} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° TVA intracommunautaire</label>
                <input {...register('vatNumber')} className="input-field font-mono" placeholder="FR12345678901" />
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Notes</h2>
          <textarea
            {...register('notes')}
            rows={3}
            className="input-field resize-none"
            placeholder="Informations complémentaires, contexte..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center gap-2">
            {mutation.isPending
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Save size={16} />}
            Créer le contact
          </button>
        </div>
      </form>
    </div>
  );
}
