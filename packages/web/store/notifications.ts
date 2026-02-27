'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import { log } from '@/lib/logger';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  loadNotifications: () => Promise<void>;
  loadUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (notif: Notification) => void;
  deleteNotification: (id: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  loadNotifications: async () => {
    set({ isLoading: true });
    try {
      const data = await api.get<{ notifications: Notification[] }>('/api/notifications?limit=20');
      set({ notifications: data.notifications, isLoading: false });
    } catch (err) {
      log.error('[notifications] loadNotifications hatasi:', err);
      set({ isLoading: false });
    }
  },

  loadUnreadCount: async () => {
    try {
      const data = await api.get<{ count: number }>('/api/notifications/unread-count');
      set({ unreadCount: data.count });
    } catch (err) {
      log.error('[notifications] loadUnreadCount hatasi:', err);
    }
  },

  markAsRead: async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch (err) {
      log.error('[notifications] markAsRead hatasi:', err);
    }
  },

  markAllRead: async () => {
    try {
      await api.put('/api/notifications/read-all');
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      log.error('[notifications] markAllRead hatasi:', err);
    }
  },

  addNotification: (notif) => {
    set((s) => {
      // Duplike kontrolu — ayni bildirim zaten varsa ekleme
      if (s.notifications.some((n) => n.id === notif.id)) return s;
      return {
        notifications: [notif, ...s.notifications].slice(0, 50),
        unreadCount: s.unreadCount + 1,
      };
    });
  },

  deleteNotification: async (id) => {
    try {
      await api.del(`/api/notifications/${id}`);
      set((s) => {
        const deleted = s.notifications.find((n) => n.id === id);
        // unreadCount'u sunucudan değil local listeden düşür
        // Pagination nedeniyle sunucudaki gerçek sayıdan sapabilir — en az 0 garantisi
        const newUnread = deleted && !deleted.is_read
          ? Math.max(0, s.unreadCount - 1)
          : s.unreadCount;
        return {
          notifications: s.notifications.filter((n) => n.id !== id),
          unreadCount: newUnread,
        };
      });
    } catch (err) {
      log.error('[notifications] deleteNotification hatasi:', err);
    }
  },
}));
