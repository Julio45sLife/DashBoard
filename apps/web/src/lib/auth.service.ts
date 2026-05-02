import apiClient from './api';
import { useAuthStore } from '../store/auth.store';

interface LoginPayload { email: string; password: string; tenantSlug?: string }
interface RegisterPayload { tenantSlug: string; tenantName: string; email: string; password: string; firstName: string; lastName: string }

interface ApiResponse<T> { success: boolean; data: T }
interface TokenPair { accessToken: string; refreshToken: string }
interface LoginResponse { user: { id: string; email: string; firstName: string; lastName: string; role: string; tenant: { id: string; slug: string; plan: string } }; tokens: TokenPair }

export const authService = {
  async login(payload: LoginPayload): Promise<void> {
    const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', payload);
    const { user, tokens } = data.data;
    useAuthStore.getState().login(user, tokens.accessToken, tokens.refreshToken);
  },

  async register(payload: RegisterPayload): Promise<void> {
    const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/auth/register', payload);
    const { user, tokens } = data.data;
    useAuthStore.getState().login(user, tokens.accessToken, tokens.refreshToken);
  },

  async fetchMe(): Promise<void> {
    const { data } = await apiClient.get<ApiResponse<{ id: string; email: string; firstName: string; lastName: string; role: string; tenant: { id: string; slug: string; plan: string } }>>('/users/me');
    useAuthStore.getState().setUser(data.data as Parameters<typeof useAuthStore.getState>['0']['user']);
  },

  logout(): void {
    useAuthStore.getState().logout();
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password });
  },
};
