import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// Render's Blueprint passes the API service's internal name (e.g. "agrilink-api-t5gl");
// browsers need the public address, so add the onrender.com domain when it's missing.
const apiHost = (h: string) => (h.includes('.') ? h : `${h}.onrender.com`);

export const api = axios.create({
  // VITE_API_HOST is injected by the Render Blueprint (hostname of the API service).
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.VITE_API_HOST ? `https://${apiHost(import.meta.env.VITE_API_HOST)}/api/v1` : '/api/v1'),
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }
      if (!refreshing) {
        refreshing = axios
          .post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken })
          .then((res) => {
            setTokens(res.data.accessToken, res.data.refreshToken);
            return res.data.accessToken as string;
          })
          .catch(() => {
            logout();
            return null;
          })
          .finally(() => {
            refreshing = null;
          });
      }
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);
