'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../../../lib/auth.service';

const registerSchema = z.object({
  tenantName: z.string().min(2, 'Nom requis'),
  tenantSlug: z.string().min(3).max(32).regex(/^[a-z0-9-]+$/, 'Minuscules, chiffres et tirets uniquement'),
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 'Doit contenir majuscule, chiffre et caractère spécial'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { tenantSlug: '' },
  });

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    try {
      await authService.register(data);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string[] } } } })?.response?.data?.error?.message?.[0];
      setError(msg ?? 'Une erreur est survenue');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Créer votre espace</h1>
          <p className="text-gray-500 text-sm mt-1">14 jours d'essai gratuit — sans carte bancaire</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input {...register('firstName')} className="input-field" />
              {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input {...register('lastName')} className="input-field" />
              {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
            <input {...register('tenantName')} className="input-field" placeholder="SARL Dupont Construction" />
            {errors.tenantName && <p className="text-red-500 text-xs mt-1">{errors.tenantName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identifiant unique{' '}
              <span className="text-gray-400 font-normal text-xs">(sous-domaine)</span>
            </label>
            <div className="flex items-center">
              <input {...register('tenantSlug')} className="input-field rounded-r-none" placeholder="dupont-construction" />
              <span className="border border-l-0 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 rounded-r-lg">
                .vilar-ds.fr
              </span>
            </div>
            {errors.tenantSlug && <p className="text-red-500 text-xs mt-1">{errors.tenantSlug.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email professionnel</label>
            <input {...register('email')} type="email" className="input-field" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input {...register('password')} type="password" className="input-field" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Création...' : 'Créer mon espace gratuit'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Déjà un compte ?{' '}
          <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
