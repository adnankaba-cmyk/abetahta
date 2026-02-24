'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { ToastContainer } from '@/components/ui/Toast';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, loadUser, checkMode, autoLogin, singleUserMode, user, modeChecked } = useAuthStore();

  // 1. İlk iş: mode kontrol et
  useEffect(() => {
    checkMode();
  }, [checkMode]);

  // 2. Mode kontrol edildikten sonra auth kararları ver
  useEffect(() => {
    if (!modeChecked) return; // Mode henüz kontrol edilmedi, bekle

    if (singleUserMode && !user && !accessToken) {
      autoLogin();
    } else if (accessToken && !user) {
      loadUser();
    }
  }, [modeChecked, singleUserMode, accessToken, user, loadUser, autoLogin]);

  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
