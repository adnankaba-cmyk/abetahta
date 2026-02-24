'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export default function HomePage() {
  const router = useRouter();
  const { singleUserMode, user, autoLogin, modeChecked } = useAuthStore();

  useEffect(() => {
    // Mode henüz kontrol edilmedi — bekle
    if (!modeChecked) return;

    const token = localStorage.getItem('accessToken');

    if (token) {
      router.replace('/dashboard');
    } else if (singleUserMode) {
      // Tek kullanıcı modunda otomatik giriş yap
      autoLogin().then(ok => {
        router.replace(ok ? '/dashboard' : '/login');
      });
    } else {
      router.replace('/login');
    }
  }, [router, singleUserMode, autoLogin, modeChecked]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
    </div>
  );
}
