'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Zap, Building2, CreditCard, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import apiClient from '../../../lib/api';
import { ApiResponse } from '../../../types';
import { toast } from '../../../components/ui/Toast';

interface SubscriptionStatus {
  plan: string;
  status: string;
  currentPeriodEnd?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: string;
}

interface CheckoutResponse { url: string }
interface PortalResponse { url: string }

const PLANS = [
  {
    id: 'FREE',
    name: 'Gratuit',
    price: '0 €',
    period: 'pour toujours',
    icon: <Zap size={20} className="text-gray-500" />,
    features: ['2 utilisateurs', '10 factures / mois', '100 contacts', '5 employés'],
    cta: null,
    color: 'gray',
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: '49 €',
    period: '/ mois HT',
    icon: <Zap size={20} className="text-blue-600" />,
    features: ['10 utilisateurs', '200 factures / mois', '2 000 contacts', '50 employés', 'Export PDF', 'Analytics avancés'],
    cta: 'Passer en Pro',
    color: 'blue',
    popular: true,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 'Sur devis',
    period: '',
    icon: <Building2 size={20} className="text-purple-600" />,
    features: ['Utilisateurs illimités', 'Factures illimitées', 'Contacts illimités', 'Branding personnalisé', 'SSO / SAML', 'Support dédié'],
    cta: 'Contacter les ventes',
    color: 'purple',
  },
];

export default function BillingPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');

  const { data: subStatus, isLoading } = useQuery({
    queryKey: ['billing-status'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SubscriptionStatus>>('/billing/status');
      return res.data.data;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (plan: 'PRO' | 'ENTERPRISE') => {
      const res = await apiClient.post<ApiResponse<CheckoutResponse>>('/billing/checkout', { plan });
      return res.data.data;
    },
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: () => toast.error('Erreur lors de la redirection vers le paiement'),
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<PortalResponse>>('/billing/portal');
      return res.data.data;
    },
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: () => toast.error('Erreur lors de l\'accès au portail'),
  });

  const currentPlan = subStatus?.plan ?? 'FREE';

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abonnement & Facturation</h1>
        <p className="text-gray-500 text-sm mt-1">Gérez votre plan et vos informations de paiement</p>
      </div>

      {/* Success / cancelled alerts */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
          <CheckCircle size={18} className="shrink-0" />
          <p className="text-sm font-medium">Paiement réussi ! Votre plan a été mis à jour.</p>
        </div>
      )}
      {cancelled && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700">
          <Zap size={18} className="shrink-0" />
          <p className="text-sm">Le paiement a été annulé. Aucun changement n'a été effectué.</p>
        </div>
      )}

      {/* Current status */}
      {!isLoading && subStatus && (
        <div className="card">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Plan actuel</p>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-gray-900">{currentPlan}</span>
                <span className={`badge-${currentPlan === 'FREE' ? 'gray' : currentPlan === 'PRO' ? 'info' : 'success'}`}>
                  {subStatus.status}
                </span>
              </div>
              {subStatus.trialEndsAt && currentPlan === 'FREE' && (
                <p className="text-xs text-amber-600 mt-1">
                  Période d'essai jusqu'au {format(parseISO(subStatus.trialEndsAt), 'd MMM yyyy', { locale: fr })}
                </p>
              )}
              {subStatus.currentPeriodEnd && currentPlan !== 'FREE' && (
                <p className="text-xs text-gray-500 mt-1">
                  Renouvellement le {format(parseISO(subStatus.currentPeriodEnd), 'd MMM yyyy', { locale: fr })}
                </p>
              )}
            </div>
            {currentPlan !== 'FREE' && subStatus.stripeSubscriptionId && (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <CreditCard size={14} />
                Gérer l'abonnement
                <ExternalLink size={12} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const borderClass = plan.popular ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200';

          return (
            <div key={plan.id} className={`card border-2 ${borderClass} relative`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="badge-info text-xs px-3 py-1">Recommandé</span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                {plan.icon}
                <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                {plan.period && <span className="text-sm text-gray-500 ml-1">{plan.period}</span>}
              </div>

              <ul className="space-y-2 mb-8">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={14} className="text-green-500 shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full text-center py-2 text-sm font-medium text-gray-500 bg-gray-50 rounded-lg">
                  Plan actuel
                </div>
              ) : plan.cta ? (
                <button
                  onClick={() => {
                    if (plan.id === 'PRO' || plan.id === 'ENTERPRISE') {
                      checkoutMutation.mutate(plan.id as 'PRO' | 'ENTERPRISE');
                    }
                  }}
                  disabled={checkoutMutation.isPending}
                  className={plan.popular ? 'btn-primary w-full' : 'btn-secondary w-full'}
                >
                  {checkoutMutation.isPending ? 'Redirection...' : plan.cta}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="card space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Questions fréquentes</h3>
        <div className="space-y-3 text-sm">
          {[
            { q: 'Puis-je changer de plan à tout moment ?', a: 'Oui. Les changements prennent effet immédiatement. En cas de déclassement, vos données sont conservées.' },
            { q: 'Comment fonctionnent les factures Stripe ?', a: 'Stripe génère et envoie automatiquement une facture à chaque cycle de facturation.' },
            { q: 'Que se passe-t-il si je dépasse mon quota ?', a: 'Les nouvelles créations seront bloquées. Vous recevrez une notification et pourrez upgrader.' },
          ].map((faq) => (
            <div key={faq.q}>
              <p className="font-medium text-gray-800">{faq.q}</p>
              <p className="text-gray-500 mt-0.5">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
