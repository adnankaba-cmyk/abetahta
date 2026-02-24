'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { boardLog } from '@/lib/logger';
import { NotificationBell } from '@/components/ui/NotificationBell';

// tldraw'i client-only olarak yukle
const TldrawCanvas = dynamic(() => import('@/components/canvas/TldrawCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-sm text-gray-500">Canvas yukleniyor...</p>
      </div>
    </div>
  ),
});

export default function BoardPage() {
  const params = useParams();
  const boardId = params.id as string;
  const { user, isChecking } = useRequireAuth();
  const [board, setBoard] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardId || isChecking || !user) return;

    async function loadBoard() {
      try {
        const data = await api.get(`/api/boards/${boardId}`);
        setBoard(data);
      } catch (err) {
        boardLog.warn('Board yuklenemedi, boş board ile devam ediliyor:', err instanceof Error ? err.message : err);
        setBoard({ board: { id: boardId, name: 'Yeni Tahta', tldraw_data: null } });
      }
    }

    loadBoard();
  }, [boardId, isChecking, user]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <a href="/dashboard" className="text-blue-600 text-sm hover:underline">
            Dashboard'a don
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Board Header */}
      <header className="h-12 bg-white border-b border-gray-200 px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-blue-600 font-bold text-sm">abeTahta</a>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-medium text-gray-700">
            {board?.board?.name || 'Yukleniyor...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          {user && (
            <div
              className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium"
              title={user.display_name}
            >
              {user.display_name?.substring(0, 2).toUpperCase() || 'U'}
            </div>
          )}
        </div>
      </header>

      {/* tldraw Canvas — min-h-0 flexbox overflow fix, overflow-hidden icerik tasmasi engeller */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        <TldrawCanvas
          boardId={boardId}
          userId={user?.id || 'anonymous'}
          userName={user?.display_name || 'Anonim'}
          initialData={board}
        />
      </div>
    </div>
  );
}
