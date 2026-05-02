'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft, Building2, Mail, Phone, Globe, MapPin,
  FileText, MessageSquare, Plus, Edit2, Save, X,
} from 'lucide-react';
import apiClient from '../../../../lib/api';
import { ContactDetail, ApiResponse, InvoiceSummary } from '../../../../types';
import { toast } from '../../../../components/ui/Toast';
import { Modal } from '../../../../components/ui/Modal';

const STATUS_STYLES: Record<string, string> = {
  LEAD: 'badge-gray', PROSPECT: 'badge-info', CUSTOMER: 'badge-success',
  INACTIVE: 'badge-warning', BLOCKED: 'badge-danger',
};
const STATUS_LABELS: Record<string, string> = {
  LEAD: 'Lead', PROSPECT: 'Prospect', CUSTOMER: 'Client', INACTIVE: 'Inactif', BLOCKED: 'Bloqué',
};
const INTERACTION_LABELS: Record<string, string> = {
  EMAIL: 'Email', PHONE: 'Appel', MEETING: 'Réunion', NOTE: 'Note',
  QUOTE_SENT: 'Devis envoyé', INVOICE_SENT: 'Facture envoyée',
  COMPLAINT: 'Réclamation', FOLLOW_UP: 'Relance',
};
const INVOICE_STATUS: Record<string, string> = {
  DRAFT: 'badge-gray', SENT: 'badge-info', PAID: 'badge-success',
  OVERDUE: 'badge-danger', CANCELLED: 'badge-gray',
};
const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', SENT: 'Envoyée', PAID: 'Payée', OVERDUE: 'En retard', CANCELLED: 'Annulée',
};

function formatCents(c: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100);
}
function formatRevenue(euros: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(euros);
}

const interactionSchema = z.object({
  type: z.enum(['EMAIL', 'PHONE', 'MEETING', 'NOTE', 'QUOTE_SENT', 'INVOICE_SENT', 'COMPLAINT', 'FOLLOW_UP']),
  subject: z.string().optional(),
  content: z.string().min(1, 'Contenu requis'),
});
type InteractionForm = z.infer<typeof interactionSchema>;

const editSchema = z.object({
  status: z.enum(['LEAD', 'PROSPECT', 'CUSTOMER', 'INACTIVE', 'BLOCKED']),
  notes: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('URL invalide').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

function InvoiceRow({ inv }: { inv: Pick<InvoiceSummary, 'id' | 'number' | 'status' | 'totalCents' | 'issuedAt'> & { type?: string } }) {
  return (
    <Link href={`/dashboard/invoicing/${inv.id}`} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group">
      <div>
        <p className="text-sm font-medium text-blue-600 group-hover:underline">{inv.number}</p>
        <p className="text-xs text-gray-400">{format(parseISO(inv.issuedAt), 'd MMM yyyy', { locale: fr })}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`${INVOICE_STATUS[inv.status] ?? 'badge-gray'} text-xs`}>
          {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
        </span>
        <span className="text-sm font-semibold text-gray-700">{formatCents(inv.totalCents)}</span>
      </div>
    </Link>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showInteraction, setShowInteraction] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ContactDetail>>(`/crm/contacts/${id}`);
      return res.data.data;
    },
  });

  const { register: regInt, handleSubmit: hsInt, reset: resetInt, formState: { errors: errInt } } = useForm<InteractionForm>({
    resolver: zodResolver(interactionSchema),
    defaultValues: { type: 'NOTE' },
  });

  const { register: regEdit, handleSubmit: hsEdit, formState: { errors: errEdit } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: contact ? {
      status: contact.status as EditForm['status'],
      notes: contact.notes ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      website: contact.website ?? '',
      address: contact.address ?? '',
      city: contact.city ?? '',
      postalCode: contact.postalCode ?? '',
    } : undefined,
  });

  const addInteractionMutation = useMutation({
    mutationFn: (data: InteractionForm) => apiClient.post(`/crm/contacts/${id}/interactions`, data),
    onSuccess: () => {
      toast.success('Interaction ajoutée');
      setShowInteraction(false);
      resetInt();
      void qc.invalidateQueries({ queryKey: ['contact', id] });
    },
    onError: () => toast.error('Erreur lors de l\'ajout'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: EditForm) => apiClient.patch(`/crm/contacts/${id}`, data),
    onSuccess: () => {
      toast.success('Contact mis à jour');
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ['contact', id] });
      void qc.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>Contact introuvable.</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4">Retour</button>
      </div>
    );
  }

  const displayName = contact.companyName ?? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim();

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">
              {displayName[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={STATUS_STYLES[contact.status] ?? 'badge-gray'}>
                  {STATUS_LABELS[contact.status] ?? contact.status}
                </span>
                {contact.isCompany && <span className="badge-gray">Société</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            {editing ? <X size={14} /> : <Edit2 size={14} />}
            {editing ? 'Annuler' : 'Modifier'}
          </button>
          <button
            onClick={() => setShowInteraction(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={14} />
            Interaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: info + edit */}
        <div className="col-span-1 space-y-4">
          {/* KPIs */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">CA total</span>
              <span className="text-sm font-bold text-gray-900">
                {contact.totalRevenue > 0 ? formatRevenue(contact.totalRevenue) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Factures</span>
              <span className="text-sm font-bold text-gray-900">{contact.totalInvoices}</span>
            </div>
            {contact.lastInteraction && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Dernière interaction</span>
                <span className="text-xs text-gray-600">
                  {format(parseISO(contact.lastInteraction), 'd MMM yyyy', { locale: fr })}
                </span>
              </div>
            )}
          </div>

          {/* Edit form or display */}
          {editing ? (
            <form onSubmit={hsEdit((data) => updateMutation.mutate(data))} className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Modifier</h3>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
                <select {...regEdit('status')} className="input-field text-sm">
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input {...regEdit('email')} type="email" className="input-field text-sm" />
                {errEdit.email && <p className="text-red-500 text-xs mt-0.5">{errEdit.email.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                <input {...regEdit('phone')} className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Site web</label>
                <input {...regEdit('website')} className="input-field text-sm" />
                {errEdit.website && <p className="text-red-500 text-xs mt-0.5">{errEdit.website.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
                <input {...regEdit('address')} className="input-field text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ville</label>
                  <input {...regEdit('city')} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CP</label>
                  <input {...regEdit('postalCode')} className="input-field text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea {...regEdit('notes')} rows={3} className="input-field text-sm resize-none" />
              </div>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
              >
                <Save size={14} />
                {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          ) : (
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Coordonnées</h3>
              {contact.email && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <Mail size={14} className="shrink-0 mt-0.5 text-gray-400" />
                  <a href={`mailto:${contact.email}`} className="hover:text-blue-600 break-all">{contact.email}</a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={14} className="text-gray-400" />
                  <a href={`tel:${contact.phone}`} className="hover:text-blue-600">{contact.phone}</a>
                </div>
              )}
              {contact.website && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Globe size={14} className="text-gray-400" />
                  <a href={contact.website} target="_blank" rel="noreferrer" className="hover:text-blue-600 truncate">{contact.website}</a>
                </div>
              )}
              {(contact.address ?? contact.city) && (
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin size={14} className="shrink-0 mt-0.5 text-gray-400" />
                  <div>
                    {contact.address && <p>{contact.address}</p>}
                    {contact.city && <p>{contact.postalCode} {contact.city}</p>}
                    {contact.country && contact.country !== 'FR' && <p>{contact.country}</p>}
                  </div>
                </div>
              )}
              {(contact.siren ?? contact.vatNumber) && (
                <div className="pt-2 border-t border-gray-100 space-y-1">
                  {contact.siren && <p className="text-xs text-gray-500">SIREN: <span className="font-mono">{contact.siren}</span></p>}
                  {contact.vatNumber && <p className="text-xs text-gray-500">TVA: <span className="font-mono">{contact.vatNumber}</span></p>}
                </div>
              )}
              {contact.notes && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{contact.notes}</p>
                </div>
              )}
              {!contact.email && !contact.phone && !contact.address && !contact.notes && (
                <p className="text-sm text-gray-400 italic">Aucune coordonnée renseignée</p>
              )}
            </div>
          )}
        </div>

        {/* Right: interactions + invoices */}
        <div className="col-span-2 space-y-4">
          {/* Invoices */}
          {contact.invoices && contact.invoices.length > 0 && (
            <div className="card space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <FileText size={15} className="text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Factures</h2>
              </div>
              <div className="space-y-1">
                {contact.invoices.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} />
                ))}
              </div>
              <Link
                href={`/dashboard/invoicing/new?contactId=${contact.id}`}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 pt-1"
              >
                <Plus size={12} />
                Nouvelle facture
              </Link>
            </div>
          )}

          {/* Interactions */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  Historique ({contact.interactions?.length ?? 0})
                </h2>
              </div>
              <button
                onClick={() => setShowInteraction(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <Plus size={12} /> Ajouter
              </button>
            </div>

            {(contact.interactions?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MessageSquare size={28} className="opacity-20 mx-auto mb-2" />
                <p className="text-sm">Aucune interaction enregistrée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {contact.interactions.map((inter) => (
                  <div key={inter.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare size={14} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                          {INTERACTION_LABELS[inter.type] ?? inter.type}
                        </span>
                        {inter.subject && (
                          <span className="text-xs font-medium text-gray-800">{inter.subject}</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {format(parseISO(inter.occurredAt), 'd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{inter.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link to create invoice if no invoices yet */}
          {(!contact.invoices || contact.invoices.length === 0) && (
            <div className="card border-dashed border-2 border-gray-200 text-center py-6">
              <FileText size={24} className="opacity-20 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-400 mb-3">Aucune facture pour ce contact</p>
              <Link
                href={`/dashboard/invoicing/new?contactId=${contact.id}`}
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                <Plus size={14} />
                Créer une facture
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Add interaction modal */}
      <Modal open={showInteraction} onClose={() => setShowInteraction(false)} title="Ajouter une interaction" size="md">
        <form onSubmit={hsInt((data) => addInteractionMutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select {...regInt('type')} className="input-field">
                {Object.entries(INTERACTION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
              <input {...regInt('subject')} className="input-field" placeholder="Objet de l'échange" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenu *</label>
            <textarea
              {...regInt('content')}
              rows={4}
              className="input-field resize-none"
              placeholder="Notes, résumé de l'échange..."
            />
            {errInt.content && <p className="text-red-500 text-xs mt-1">{errInt.content.message}</p>}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setShowInteraction(false); resetInt(); }} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" disabled={addInteractionMutation.isPending} className="btn-primary">
              {addInteractionMutation.isPending ? 'Enregistrement...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="flex items-center gap-2 pt-2">
        <Building2 size={12} className="text-gray-300" />
        <span className="text-xs text-gray-300 font-mono">ID: {contact.id}</span>
      </div>
    </div>
  );
}
