'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export function useRequireAuth() {
  const router = useRouter();
  const { user, accessToken, loadUser, singleUserMode, autoLogin, modeChecked } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Mode henüz kontrol edilmedi — bekle, karar verme
    if (!modeChecked) return;

    async function check() {
      // Tek kullanıcı modunda otomatik giriş
      if (singleUserMode && !accessToken) {
        const ok = await autoLogin();
        if (!ok) {
          router.replace('/login');
          return;
        }
        setIsChecking(false);
        return;
      }

      // Token yok ve tek kullanıcı modu da değil → login
      if (!accessToken) {
        router.replace('/login');
        return;
      }

      // Token var ama user yüklenmemiş → yükle
      if (!user) {
        try {
          await loadUser();
        } catch {
          router.replace('/login');
          return;
        }
      }

      setIsChecking(false);
    }

    check();
  }, [modeChecked, accessToken, user, loadUser, router, singleUserMode, autoLogin]);

  return { user, isChecking };
}
