import axios, { AxiosInstance } from 'axios';
import createAuthRefreshInterceptor from 'axios-auth-refresh';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
  withCredentials: false,
});

// Request interceptor: attach access token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const tenantId = localStorage.getItem('tenant_id');
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId;
    }
  }
  return config;
});

// Refresh token logic
const refreshAuthLogic = async (failedRequest: { response: { config: { headers: { Authorization: string } } } }) => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    window.location.href = '/auth/login';
    return;
  }

  try {
    const { data } = await axios.post<{ data: { accessToken: string; refreshToken: string } }>(
      `${API_URL}/api/v1/auth/refresh`,
      { refreshToken },
    );

    const tokens = data.data;
    localStorage.setItem('access_token', tokens.accessToken);
    localStorage.setItem('refresh_token', tokens.refreshToken);
    failedRequest.response.config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  } catch {
    localStorage.clear();
    window.location.href = '/auth/login';
  }
};

createAuthRefreshInterceptor(apiClient, refreshAuthLogic, {
  statusCodes: [401],
  pauseInstanceWhileRefreshing: true,
});

export default apiClient;
