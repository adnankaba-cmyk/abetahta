'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
  avatar_url?: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  singleUserMode: boolean;
  modeChecked: boolean; // checkMode tamamlandı mı?

  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  autoLogin: () => Promise<boolean>;
  checkMode: () => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null, // XSS riski: localStorage'dan okuma kaldırıldı, httpOnly cookie + memory kullanılıyor
  isLoading: false,
  error: null,
  singleUserMode: false,
  modeChecked: false,

  checkMode: async () => {
    try {
      const data = await api.get<{ singleUser: boolean }>('/api/auth/mode');
      set({ singleUserMode: data.singleUser, modeChecked: true });
    } catch {
      set({ singleUserMode: false, modeChecked: true });
    }
  },

  autoLogin: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<AuthResponse>('/api/auth/auto-login');
      // accessToken sadece memory'de — localStorage XSS riski var
      localStorage.setItem('refreshToken', data.refreshToken);
      api.setToken(data.accessToken);
      set({ user: data.user, accessToken: data.accessToken, isLoading: false, singleUserMode: true });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Otomatik giriş başarısız', isLoading: false });
      return false;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<AuthResponse>('/api/auth/login', { email, password });
      localStorage.setItem('refreshToken', data.refreshToken);
      api.setToken(data.accessToken);
      set({ user: data.user, accessToken: data.accessToken, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Giriş başarısız', isLoading: false });
      return false;
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<AuthResponse>('/api/auth/register', {
        email,
        password,
        display_name: name,
      });
      localStorage.setItem('refreshToken', data.refreshToken);
      api.setToken(data.accessToken);
      set({ user: data.user, accessToken: data.accessToken, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Kayıt başarısız', isLoading: false });
      return false;
    }
  },

  logout: () => {
    disconnectSocket();
    localStorage.removeItem('refreshToken');
    api.setToken(null);
    set({ user: null, accessToken: null });
  },

  loadUser: async () => {
    const token = get().accessToken;
    if (!token) return;

    try {
      const data = await api.get<{ user: User }>('/api/auth/me');
      set({ user: data.user });
    } catch {
      // Sadece user'ı temizle, token'ı silme — token süresi dolmuşsa refresh denenecek
      // logout() çağırmak sonsuz döngü yaratır (token silinir → autoLogin → loadUser → fail → logout)
      set({ user: null });
    }
  },
}));
