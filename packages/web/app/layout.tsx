import type { Metadata } from 'next';
import '@/styles/globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { PWARegister } from '@/components/providers/PWARegister';

export const metadata: Metadata = {
  title: 'abeTahta - Görsel İşbirliği Platformu',
  description: 'Gerçek zamanlı görsel işbirliği ve proje yönetim platformu',
  icons: { icon: '/icons/favicon.ico' },
  manifest: '/manifest.json',
  themeColor: '#667eea',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <AuthProvider>
          <PWARegister />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
