import { create } from 'zustand';

export interface RoleScope {
  role: string;
  geoAreaId: string | null;
  departmentId: string | null;
}

export interface CurrentUser {
  id: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  status: string;
  roleAssignments: RoleScope[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: CurrentUser | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: CurrentUser) => void;
  logout: () => void;
  roleNames: () => string[];
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: localStorage.getItem('agrilink_access'),
  refreshToken: localStorage.getItem('agrilink_refresh'),
  user: JSON.parse(localStorage.getItem('agrilink_user') || 'null'),

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('agrilink_access', accessToken);
    localStorage.setItem('agrilink_refresh', refreshToken);
    set({ accessToken, refreshToken });
  },
  setUser: (user) => {
    localStorage.setItem('agrilink_user', JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    localStorage.removeItem('agrilink_access');
    localStorage.removeItem('agrilink_refresh');
    localStorage.removeItem('agrilink_user');
    set({ accessToken: null, refreshToken: null, user: null });
  },
  roleNames: () => get().user?.roleAssignments.map((r) => r.role) ?? [],
}));
