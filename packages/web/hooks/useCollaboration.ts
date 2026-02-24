import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { wsLog } from '@/lib/logger';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';

// Rastgele renk üret
const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export interface Peer {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selection: string[];
}

interface UseCollaborationOptions {
  boardId: string;
  userId: string;
  userName: string;
  enabled?: boolean;
}

export function useCollaboration({
  boardId,
  userId,
  userName,
  enabled = true
}: UseCollaborationOptions) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [myColor] = useState(() => getRandomColor());

  // Bağlantı kur
  useEffect(() => {
    if (!enabled || !boardId) return;

    try {
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      const provider = new WebsocketProvider(WS_URL, `board-${boardId}`, ydoc);
      providerRef.current = provider;

    // Kendi bilgilerini ayarla
    provider.awareness.setLocalState({
      id: userId,
      name: userName,
      color: myColor,
      cursor: null,
      selection: []
    });

    // Bağlantı durumu
    provider.on('status', ({ status }: { status: string }) => {
      setIsConnected(status === 'connected');
      wsLog.debug('Durum:', status);
    });

    // Peer değişiklikleri
    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().entries());
      const otherPeers: Peer[] = states
        .filter(([clientId]) => clientId !== provider.awareness.clientID)
        .map(([, state]) => state as Peer)
        .filter(state => state && state.id);

      setPeers(otherPeers);
    });

    wsLog.debug('Bağlanıyor:', boardId);

      return () => {
        provider.destroy();
        ydoc.destroy();
        wsLog.debug('Bağlantı kapatıldı');
      };
    } catch (err) {
      wsLog.error('Bağlantı hatası:', err);
      setIsConnected(false);
    }
  }, [boardId, userId, userName, myColor, enabled]);

  // Cursor pozisyonunu güncelle
  const updateCursor = useCallback((x: number, y: number) => {
    if (providerRef.current?.awareness) {
      const currentState = providerRef.current.awareness.getLocalState() || {};
      providerRef.current.awareness.setLocalState({
        ...currentState,
        cursor: { x, y }
      });
    }
  }, []);

  // Cursor'u gizle (mouse leave)
  const hideCursor = useCallback(() => {
    if (providerRef.current?.awareness) {
      const currentState = providerRef.current.awareness.getLocalState() || {};
      providerRef.current.awareness.setLocalState({
        ...currentState,
        cursor: null
      });
    }
  }, []);

  // Seçimi güncelle
  const updateSelection = useCallback((shapeIds: string[]) => {
    if (providerRef.current?.awareness) {
      const currentState = providerRef.current.awareness.getLocalState() || {};
      providerRef.current.awareness.setLocalState({
        ...currentState,
        selection: shapeIds
      });
    }
  }, []);

  // Shapes map'i al (Y.Map)
  const getShapesMap = useCallback(() => {
    if (ydocRef.current) {
      return ydocRef.current.getMap('shapes');
    }
    return null;
  }, []);

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    isConnected,
    peers,
    myColor,
    updateCursor,
    hideCursor,
    updateSelection,
    getShapesMap
  };
}
