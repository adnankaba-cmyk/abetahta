'use client';

import { useServiceWorker } from '@/hooks/useServiceWorker';

export function PWARegister() {
  useServiceWorker();
  return null;
}
