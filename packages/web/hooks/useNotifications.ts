'use client';

import { useEffect } from 'react';
import { useNotificationStore, type Notification } from '@/store/notifications';
import { toast } from '@/store/toast';
import { useAuthStore } from '@/store/auth';
import { getSocket, authenticateSocket } from '@/lib/socket';

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { notifications, unreadCount, loadNotifications, loadUnreadCount, addNotification } =
    useNotificationStore();

  useEffect(() => {
    if (!user?.id || !accessToken) return;

    // Baslangicta yukle
    loadNotifications();
    loadUnreadCount();

    // Singleton socket baglantisi
    const socket = getSocket();

    const onConnect = () => {
      // Store'dan GUNCEL token al (stale closure onlemi)
      authenticateSocket();
    };

    const onNotification = (notif: Notification) => {
      addNotification(notif);
      toast.info(notif.title);
    };

    socket.on('connect', onConnect);
    socket.on('notification', onNotification);

    // Baglan (zaten bagli degilse)
    if (!socket.connected) {
      socket.connect();
    } else {
      // Zaten bagliysa hemen authenticate et
      authenticateSocket();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('notification', onNotification);
      // Socket'i KAPATMA — singleton, diger component'lar kullanabilir
    };
  }, [user?.id, accessToken]);

  return { notifications, unreadCount };
}
