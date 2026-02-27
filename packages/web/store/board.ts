'use client';

import { create } from 'zustand';
import type { Board, Element, Connection } from '@/types';
import { api } from '@/lib/api';
import { boardLog } from '@/lib/logger';

interface BoardState {
  board: Board | null;
  elements: Element[];
  connections: Connection[];
  selectedIds: Set<string>;
  isLoading: boolean;

  loadBoard: (boardId: string) => Promise<void>;
  addElement: (element: Partial<Element>) => Promise<void>;
  updateElement: (id: string, updates: Partial<Element>) => Promise<void>;
  deleteElement: (id: string) => Promise<void>;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  board: null,
  elements: [],
  connections: [],
  selectedIds: new Set(),
  isLoading: false,

  loadBoard: async (boardId) => {
    set({ isLoading: true });
    try {
      const data = await api.get<{ board: Board; elements: Element[]; connections: Connection[] }>(`/api/boards/${boardId}`);
      set({
        board: data.board,
        elements: data.elements,
        connections: data.connections,
        isLoading: false,
      });
    } catch (err) {
      boardLog.error('Tahta yüklenemedi:', err);
      set({ isLoading: false });
    }
  },

  addElement: async (element) => {
    const boardId = get().board?.id;
    if (!boardId) return;

    const data = await api.post<{ element: Element }>('/api/elements', { ...element, board_id: boardId });
    set((state) => ({ elements: [...state.elements, data.element] }));
  },

  updateElement: async (id, updates) => {
    const data = await api.put<{ element: Element }>(`/api/elements/${id}`, updates);
    set((state) => ({
      elements: state.elements.map((el) => (el.id === id ? data.element : el)),
    }));
  },

  deleteElement: async (id) => {
    await api.del(`/api/elements/${id}`);
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
    }));
  },

  setSelection: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),
}));
