'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth.store';
import { authService } from '../lib/auth.service';

export function useAuth() {
  const { user, isAuthenticated, logout } = useAuthStore();

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/auth/login';
  };

  return { user, isAuthenticated, logout: handleLogout };
}

export function useRequireAuth() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, router]);

  return { isAuthenticated };
}
