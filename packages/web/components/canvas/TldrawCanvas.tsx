'use client';
// HMR trigger v8 - minHeight fix
import { useCallback, useEffect, useRef, useState } from 'react';
import { Tldraw, Editor, TLShape, TLStoreSnapshot, createShapeId } from 'tldraw';
import { toRichText } from '@tldraw/editor';
import 'tldraw/tldraw.css';
import { api } from '@/lib/api';
import { MERMAID_EXAMPLES } from '@/lib/mermaid-renderer';
import { applyCodeDirect } from '@/lib/ai-canvas-bridge';
import { useCollaboration } from '@/hooks/useCollaboration';
import { useTldrawYjsSync } from '@/hooks/useTldrawYjsSync';
import { RemoteCursors } from '@/components/collaboration/RemoteCursors';
import { PresenceAvatars } from '@/components/collaboration/PresenceAvatars';
import { ExportPanel } from './ExportPanel';
import { MiniMap } from './MiniMap';
import { AIPanel } from '@/components/ai/AIPanel';
import { CommentPanel } from './CommentPanel';
import { HistoryPanel } from './HistoryPanel';
import { customShapeUtils } from './shapes';
import { saveSnapshotLocally, queuePendingChange, syncPendingChanges, onOnline, isOnline } from '@/lib/offline-sync';
import { importMermaidToCanvas, importDrawioToCanvas, importExcalidrawToCanvas } from '@/lib/importers';
import { boardLog } from '@/lib/logger';
import { toast } from '@/store/toast';

interface TldrawCanvasProps {
  boardId: string;
  userId?: string;
  userName?: string;
  initialData?: {
    board?: {
      name?: string;
      tldraw_data?: TLStoreSnapshot | null;
    };
  };
}

interface ShapeMeta {
  createdAt?: string;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}

// draw.io tarzı şekil kategorileri
const SHAPE_CATEGORIES = {
  general: {
    name: 'Genel',
    shapes: [
      { id: 'rectangle', icon: '▭', name: 'Dikdortgen', geo: 'rectangle' },
      { id: 'ellipse', icon: '○', name: 'Elips', geo: 'ellipse' },
      { id: 'triangle', icon: '△', name: 'Ucgen', geo: 'triangle' },
      { id: 'diamond', icon: '◇', name: 'Eskenar', geo: 'diamond' },
      { id: 'pentagon', icon: '⬠', name: 'Besgen', geo: 'pentagon' },
      { id: 'hexagon', icon: '⬡', name: 'Altigen', geo: 'hexagon' },
      { id: 'star', icon: '☆', name: 'Yildiz', geo: 'star' },
      { id: 'cloud', icon: '☁', name: 'Bulut', geo: 'cloud' },
    ]
  },
  flowchart: {
    name: 'Akis Diyagrami',
    shapes: [
      { id: 'process', icon: '▭', name: 'Islem', geo: 'rectangle' },
      { id: 'decision', icon: '◇', name: 'Karar', geo: 'diamond' },
      { id: 'terminal', icon: '⬭', name: 'Baslangic/Bitis', geo: 'oval' },
      { id: 'data', icon: '▱', name: 'Veri', geo: 'parallelogram' },
      { id: 'document', icon: '📄', name: 'Belge', geo: 'rectangle' },
    ]
  },
  arrows: {
    name: 'Oklar',
    shapes: [
      { id: 'arrow-right', icon: '→', name: 'Sag Ok', geo: 'arrow-right' },
      { id: 'arrow-left', icon: '←', name: 'Sol Ok', geo: 'arrow-left' },
      { id: 'arrow-up', icon: '↑', name: 'Yukari Ok', geo: 'arrow-up' },
      { id: 'arrow-down', icon: '↓', name: 'Asagi Ok', geo: 'arrow-down' },
    ]
  },
  custom: {
    name: 'Ozel',
    shapes: [
      { id: 'kanban', icon: '▦', name: 'Kanban', geo: '__custom_kanban' },
      { id: 'timeline', icon: '⟶', name: 'Timeline', geo: '__custom_timeline' },
      { id: 'swot', icon: '⊞', name: 'SWOT', geo: '__custom_swot' },
    ]
  }
};

export default function TldrawCanvas({ boardId, userId = 'anonymous', userName = 'Anonim', initialData }: TldrawCanvasProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showMermaidModal, setShowMermaidModal] = useState(false);
  const [selectedShapeCategory, setSelectedShapeCategory] = useState('general');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuBarRef = useRef<HTMLDivElement | null>(null);
  const [mermaidCode, setMermaidCode] = useState('');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showCommentPanel, setShowCommentPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [canvasAnchor, setCanvasAnchor] = useState<{ x: number; y: number } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSnapshotRef = useRef<string>('');
  const knownShapeIds = useRef<Set<string>>(new Set());

  const savedData = initialData?.board?.tldraw_data;
  const [currentZoom, setCurrentZoom] = useState(100);
  const shapeCount = editor ? editor.getCurrentPageShapes().length : 0;

  // Zoom display sync: tldraw kamera degisikliklerini dinle
  // Kamera session scope'unda — 'document' degil 'all' kullanilmali
  useEffect(() => {
    if (!editor) return;
    setCurrentZoom(Math.round(editor.getZoomLevel() * 100));
    const unsub = editor.store.listen(
      () => {
        setCurrentZoom(Math.round(editor.getZoomLevel() * 100));
      },
      { source: 'all', scope: 'all' }
    );
    return unsub;
  }, [editor]);
  const selectedShapes = editor ? editor.getSelectedShapes() : [];

  const { ydoc, isConnected, peers, myColor, updateCursor, hideCursor, updateSelection } = useCollaboration({ boardId, userId, userName, enabled: true });

  // Shape senkronizasyonu: tldraw ↔ Yjs
  useTldrawYjsSync({ editor, ydoc, enabled: isConnected });

  // Save (online → API, offline → IndexedDB queue)
  const saveToDatabase = useCallback(async () => {
    if (!editor) return;
    try {
      const snapshot = editor.getSnapshot();
      const snapshotStr = JSON.stringify(snapshot);
      if (snapshotStr === lastSavedSnapshotRef.current) return;
      setIsSaving(true);

      // Daima lokal kaydet (hızlı erişim için)
      await saveSnapshotLocally(boardId, snapshot).catch(() => {});

      if (isOnline()) {
        await api.put(`/api/boards/${boardId}`, { tldraw_data: snapshot });
      } else {
        // Offline — kuyruğa ekle
        await queuePendingChange({ boardId, type: 'save-snapshot', payload: snapshot });
      }

      lastSavedSnapshotRef.current = snapshotStr;
      setLastSaved(new Date());
    } catch (err) {
      // API hatası — kuyruğa ekle
      try {
        const snapshot = editor.getSnapshot();
        await queuePendingChange({ boardId, type: 'save-snapshot', payload: snapshot });
      } catch { /* IndexedDB hatası */ }
      boardLog.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [editor, boardId]);

  // Add shape (geo or custom)
  const addShape = useCallback((geo: string) => {
    if (!editor) return;
    // Öncelik: 1) Son tıklama noktası (canvasAnchor), 2) Seçili şekillerin merkezi, 3) Viewport merkezi
    let point: { x: number; y: number };
    if (canvasAnchor) {
      point = canvasAnchor;
    } else {
      const selected = editor.getSelectedShapes();
      if (selected.length > 0) {
        const bounds = editor.getSelectionPageBounds();
        point = bounds ? { x: bounds.midX, y: bounds.midY } : editor.screenToPage(editor.getViewportScreenCenter());
      } else {
        point = editor.screenToPage(editor.getViewportScreenCenter());
      }
    }
    const id = createShapeId();
    const meta = { createdAt: new Date().toISOString(), createdBy: userId, createdByName: userName };

    // Custom shapes
    if (geo === '__custom_kanban') {
      editor.createShape({ id, type: 'kanban', x: point.x - 300, y: point.y - 200, meta });
      editor.select(id);
      return;
    }
    if (geo === '__custom_timeline') {
      editor.createShape({ id, type: 'timeline', x: point.x - 350, y: point.y - 90, meta });
      editor.select(id);
      return;
    }
    if (geo === '__custom_swot') {
      editor.createShape({ id, type: 'swot', x: point.x - 250, y: point.y - 200, meta });
      editor.select(id);
      return;
    }

    // Standard geo shapes
    editor.createShape({
      id,
      type: 'geo',
      x: point.x - 50,
      y: point.y - 50,
      props: { geo, w: 100, h: 100, fill: 'solid', color: 'black' } as any,
      meta,
    });
    editor.select(id);
  }, [editor, userId, userName, canvasAnchor]);

  // Mermaid Runner — menü itemlerinden doğrudan çağrılır
  const runMermaid = useCallback((key: string) => {
    if (!editor) return;
    const code = MERMAID_EXAMPLES[key as keyof typeof MERMAID_EXAMPLES];
    if (!code) { toast.error('Mermaid ornegi bulunamadi: ' + key); return; }
    applyCodeDirect(editor, code, 'mermaid', canvasAnchor || undefined).then(r => {
      if (r.success) toast.success(`Mermaid: ${r.shapesAdded} sekil eklendi`);
      else toast.error('Mermaid hatasi: ' + (r.error || ''));
    });
  }, [editor, canvasAnchor]);

  // Dosya Ac - JSON yukle (her cagri icin temiz input — DOM sizintisi yok)
  const openFile = useCallback(() => {
    if (!editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.tldr';
    input.style.display = 'none';
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { input.remove(); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.store) {
            editor.loadSnapshot(data);
          }
        } catch (err) {
          toast.error('Dosya okunamadi: ' + (err as Error).message);
        }
      };
      reader.readAsText(file);
      input.remove(); // DOM'dan temizle
    });
    document.body.appendChild(input);
    input.click();
  }, [editor]);

  // Import — Mermaid, draw.io, Excalidraw dosyası yükle
  const importFile = useCallback(() => {
    if (!editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mmd,.mermaid,.xml,.drawio,.excalidraw,.json';
    input.style.display = 'none';
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const content = ev.target?.result as string;
        if (!content) return;
        let count = 0;
        const name = file.name.toLowerCase();
        if (name.endsWith('.mmd') || name.endsWith('.mermaid')) {
          count = await importMermaidToCanvas(editor, content);
        } else if (name.endsWith('.xml') || name.endsWith('.drawio')) {
          count = importDrawioToCanvas(editor, content);
        } else if (name.endsWith('.excalidraw')) {
          count = importExcalidrawToCanvas(editor, content);
        } else if (name.endsWith('.json')) {
          // Excalidraw JSON veya tldraw JSON dene
          try {
            const data = JSON.parse(content);
            if (data.type === 'excalidraw') {
              count = importExcalidrawToCanvas(editor, content);
            } else if (data.store) {
              editor.loadSnapshot(data);
              count = -1; // Snapshot loaded
            }
          } catch {
            toast.error('JSON dosyasi okunamadi');
          }
        }
        if (count > 0) toast.success(`${count} nesne ice aktarildi`);
        else if (count === 0) toast.error('Icerik bulunamadi veya format desteklenmiyor');
      };
      reader.readAsText(file);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  }, [editor]);

  // Farkli Kaydet - JSON indir
  const saveAsFile = useCallback(() => {
    if (!editor) return;
    const snapshot = editor.getSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${initialData?.board?.name || 'tahta'}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editor, initialData]);

  // Yazdir
  const printCanvas = useCallback(async () => {
    if (!editor) return;
    const result = await editor.getSvgString([...editor.getCurrentPageShapeIds()]);
    if (!result) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>AbeTahta - Yazdir</title>
      <style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh}
      @media print{body{margin:0}}</style></head>
      <body><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}" style="max-width:100%;max-height:100vh"/>
      <script>setTimeout(()=>{window.print();window.close()},300)<\/script>
      </body></html>
    `);
    win.document.close();
  }, [editor]);

  // Kes/Kopyala/Yapistir - keyboard event tetikle
  const simulateKeyboard = useCallback((key: string, ctrl = true) => {
    const canvas = document.querySelector('.tl-container');
    if (!canvas) return;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: ctrl, bubbles: true }));
  }, []);

  // Effects
  useEffect(() => {
    if (!editor) return;
    const allShapes = editor.getCurrentPageShapes();
    allShapes.forEach(shape => knownShapeIds.current.add(shape.id));

    const cleanupCreate = editor.sideEffects.registerAfterCreateHandler('shape', (shape: TLShape) => {
      if (!knownShapeIds.current.has(shape.id)) {
        knownShapeIds.current.add(shape.id);
        const now = new Date().toISOString();
        editor.updateShape({ id: shape.id, type: shape.type, meta: { ...shape.meta, createdAt: now, createdBy: userId, createdByName: userName, updatedAt: now } });
      }
    });

    const cleanupUpdate = editor.sideEffects.registerAfterChangeHandler('shape', (prev: TLShape, next: TLShape) => {
      const prevMeta = prev.meta as ShapeMeta;
      const nextMeta = next.meta as ShapeMeta;
      if (prevMeta?.updatedAt === nextMeta?.updatedAt && knownShapeIds.current.has(next.id)) {
        editor.updateShape({ id: next.id, type: next.type, meta: { ...next.meta, updatedAt: new Date().toISOString(), updatedBy: userId, updatedByName: userName } });
      }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(saveToDatabase, 2000);
    });

    return () => { cleanupCreate(); cleanupUpdate(); if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [editor, saveToDatabase, userId, userName]);

  // Online'a dönünce pending değişiklikleri sync et
  useEffect(() => {
    const cleanup = onOnline(async () => {
      const result = await syncPendingChanges(async (bid, snapshot) => {
        await api.put(`/api/boards/${bid}`, { tldraw_data: snapshot });
      });
      if (result.synced > 0) {
        toast.success(`${result.synced} bekleyen degisiklik senkronize edildi`);
      }
    });
    return cleanup;
  }, []);

  useEffect(() => {
    if (!editor) return;
    const handlePointerMove = (e: PointerEvent) => {
      const point = editor.screenToPage({ x: e.clientX, y: e.clientY });
      updateCursor(point.x, point.y);
    };
    const handlePointerLeave = () => hideCursor();
    const container = document.querySelector('.tl-container');
    if (container) {
      container.addEventListener('pointermove', handlePointerMove as EventListener);
      container.addEventListener('pointerleave', handlePointerLeave);
    }
    return () => {
      if (container) {
        container.removeEventListener('pointermove', handlePointerMove as EventListener);
        container.removeEventListener('pointerleave', handlePointerLeave);
      }
    };
  }, [editor, updateCursor, hideCursor]);

  useEffect(() => {
    if (!editor) return;
    const handleSelectionChange = () => updateSelection(editor.getSelectedShapeIds() as string[]);
    const cleanup = editor.sideEffects.registerAfterChangeHandler('instance_page_state', handleSelectionChange);
    return cleanup;
  }, [editor, updateSelection]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Menü bar içindeki tıklamaları yoksay — React handler yönetir
      if (menuBarRef.current && menuBarRef.current.contains(e.target as Node)) return;
      setActiveMenu(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Canvas'a tıklama → anchor noktası güncelle (AI DSL yerleştirme için)
  useEffect(() => {
    if (!editor) return;
    const container = document.querySelector('.tl-container');
    if (!container) return;
    const handleCanvasClick = (e: Event) => {
      const pe = e as PointerEvent;
      const point = editor.screenToPage({ x: pe.clientX, y: pe.clientY });
      setCanvasAnchor({ x: point.x, y: point.y });
    };
    container.addEventListener('pointerdown', handleCanvasClick);
    return () => container.removeEventListener('pointerdown', handleCanvasClick);
  }, [editor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Inputlarda kısayolları devre dışı bırak
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();

      // Ctrl kısayolları
      if (ctrl) {
        switch (key) {
          case 's':
            e.preventDefault();
            if (shift) saveAsFile();
            else saveToDatabase();
            return;
          case 'o':
            e.preventDefault();
            openFile();
            return;
          case 'p':
            e.preventDefault();
            printCanvas();
            return;
          case 'n':
            e.preventDefault();
            editor?.deleteShapes([...editor.getCurrentPageShapeIds()]);
            return;
          case '/':
            e.preventDefault();
            setShowShortcutsModal(true);
            return;
          case '=': // Ctrl++ (= tuşu + ile aynı)
          case '+':
            e.preventDefault();
            editor?.zoomIn();
            return;
          case '-':
            e.preventDefault();
            editor?.zoomOut();
            return;
          case '0':
            e.preventDefault();
            editor?.resetZoom();
            return;
          case 'h':
            if (shift) {
              e.preventDefault();
              editor?.zoomToFit();
            }
            return;
          case ']':
            e.preventDefault();
            if (shift) editor?.bringToFront(editor.getSelectedShapeIds());
            else editor?.bringForward(editor.getSelectedShapeIds());
            return;
          case '[':
            e.preventDefault();
            if (shift) editor?.sendToBack(editor.getSelectedShapeIds());
            else editor?.sendBackward(editor.getSelectedShapeIds());
            return;
        }
      }

      // Ctrl olmadan tek tuş araç kısayolları
      if (!ctrl && !e.altKey) {
        switch (key) {
          case 'v': editor?.setCurrentTool('select'); return;
          case 'h': editor?.setCurrentTool('hand'); return;
          case 'd': editor?.setCurrentTool('draw'); return;
          case 'e': editor?.setCurrentTool('eraser'); return;
          case 'a': editor?.setCurrentTool('arrow'); return;
          case 't': editor?.setCurrentTool('text'); return;
          case 'n': editor?.setCurrentTool('note'); return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, saveToDatabase, saveAsFile, openFile, printCanvas]);

  // Menu items - draw.io style
  const menus: Record<string, { label: string; items: { label: string; shortcut?: string; action?: () => void; divider?: boolean; header?: boolean }[] }> = {
    dosya: {
      label: 'Dosya',
      items: [
        { label: 'Yeni', shortcut: 'Ctrl+N', action: () => editor?.deleteShapes([...editor.getCurrentPageShapeIds()]) },
        { label: 'Ac...', shortcut: 'Ctrl+O', action: openFile },
        { divider: true, label: '' },
        { label: 'Kaydet', shortcut: 'Ctrl+S', action: saveToDatabase },
        { label: 'Farkli Kaydet...', shortcut: 'Ctrl+Shift+S', action: saveAsFile },
        { divider: true, label: '' },
        { label: 'Ice Aktar...', action: importFile },
        { label: 'Disa Aktar', action: () => setShowExportModal(true) },
        { label: 'Yazdir...', shortcut: 'Ctrl+P', action: printCanvas },
      ]
    },
    duzen: {
      label: 'Duzen',
      items: [
        { label: 'Geri Al', shortcut: 'Ctrl+Z', action: () => editor?.undo() },
        { label: 'Yinele', shortcut: 'Ctrl+Y', action: () => editor?.redo() },
        { divider: true, label: '' },
        { label: 'Kes', shortcut: 'Ctrl+X', action: () => simulateKeyboard('x') },
        { label: 'Kopyala', shortcut: 'Ctrl+C', action: () => simulateKeyboard('c') },
        { label: 'Yapistir', shortcut: 'Ctrl+V', action: () => simulateKeyboard('v') },
        { divider: true, label: '' },
        { label: 'Tumunu Sec', shortcut: 'Ctrl+A', action: () => editor?.selectAll() },
        { label: 'Secimi Kaldir', shortcut: 'Esc', action: () => editor?.selectNone() },
        { divider: true, label: '' },
        { label: 'Sil', shortcut: 'Delete', action: () => editor?.deleteShapes(editor.getSelectedShapeIds()) },
      ]
    },
    gorunum: {
      label: 'Gorunum',
      items: [
        { label: 'Yakinlastir', shortcut: 'Ctrl++', action: () => editor?.zoomIn() },
        { label: 'Uzaklastir', shortcut: 'Ctrl+-', action: () => editor?.zoomOut() },
        { label: '%100', shortcut: 'Ctrl+0', action: () => editor?.resetZoom() },
        { label: 'Tume Sigdir', shortcut: 'Ctrl+Shift+H', action: () => editor?.zoomToFit() },
        { divider: true, label: '' },
        { label: (showLeftPanel ? '✓ ' : '') + 'Sol Panel', action: () => setShowLeftPanel(!showLeftPanel) },
        { label: (showMiniMap ? '✓ ' : '') + 'Mini Harita', action: () => setShowMiniMap(!showMiniMap) },
      ]
    },
    ekle: {
      label: 'Ekle',
      items: [
        { label: 'Dikdortgen', action: () => addShape('rectangle') },
        { label: 'Elips', action: () => addShape('ellipse') },
        { label: 'Ucgen', action: () => addShape('triangle') },
        { label: 'Eskenar Dortgen', action: () => addShape('diamond') },
        { divider: true, label: '' },
        { label: 'Metin', action: () => editor?.setCurrentTool('text') },
        { label: 'Not', action: () => editor?.setCurrentTool('note') },
        { label: 'Ok', action: () => editor?.setCurrentTool('arrow') },
        { divider: true, label: '' },
        { label: 'Resim...', action: () => editor?.setCurrentTool('asset') },
      ]
    },
    otomasyon: {
      label: 'Otomasyon',
      items: [
        { header: true, label: 'AKIS DIYAGRAMLARI' },
        { label: 'Temel Akis', action: () => runMermaid('flowchart') },
        { label: 'Kullanici Girisi', action: () => runMermaid('login') },
        { label: 'Siparis Sureci', action: () => runMermaid('process') },
        { label: 'Hata Yonetimi', action: () => runMermaid('errorHandling') },
        { label: 'Durum Akisi', action: () => runMermaid('stateFlow') },
        { divider: true, label: '' },
        { header: true, label: 'YAPILAR' },
        { label: 'Veritabani Yapisi', action: () => runMermaid('database') },
        { label: 'Mikroservisler', action: () => runMermaid('microservices') },
        { label: 'DevOps Pipeline', action: () => runMermaid('devops') },
        { label: 'Organizasyon', action: () => runMermaid('orgChart') },
        { divider: true, label: '' },
        { label: 'Elle Mermaid Yaz...', action: () => setShowMermaidModal(true) },
      ]
    },
    yardim: {
      label: 'Yardim',
      items: [
        { label: 'Klavye Kisayollari', shortcut: 'Ctrl+/', action: () => setShowShortcutsModal(true) },
        { label: 'Hakkinda', action: () => toast.info('AbeTahta v1.0 - Claude ile yapildi') },
      ]
    },
  };

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F0F0F0', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      <RemoteCursors peers={peers} />

      {/* ===== MENU BAR (draw.io style) ===== */}
      <div ref={menuBarRef} style={{
        height: '30px',
        background: '#F5F5F5',
        borderBottom: '1px solid #CACACA',
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px',
        fontSize: '13px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px 0 8px', borderRight: '1px solid #CACACA', marginRight: '4px' }}>
          <span style={{ fontWeight: '600', color: '#333' }}>abeTahta</span>
        </div>

        {/* Menus */}
        {Object.entries(menus).map(([key, menu]) => (
          <div key={key} style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === key ? null : key); }}
              style={{
                background: activeMenu === key ? '#E8E8E8' : 'transparent',
                border: 'none',
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#333',
              }}
              onMouseEnter={() => activeMenu && setActiveMenu(key)}
            >
              {menu.label}
            </button>
            {activeMenu === key && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  background: 'white',
                  border: '1px solid #CACACA',
                  boxShadow: '2px 2px 8px rgba(0,0,0,0.15)',
                  minWidth: '200px',
                  zIndex: 2000,
                  padding: '4px 0',
                }}
              >
                {menu.items.map((item, idx) => (
                  item.divider ? (
                    <div key={idx} style={{ height: '1px', background: '#E0E0E0', margin: '4px 0' }} />
                  ) : (item as any).header ? (
                    <div key={idx} style={{ padding: '4px 12px 2px', fontSize: '9px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {item.label}
                    </div>
                  ) : (
                    <button
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); item.action?.(); setActiveMenu(null); }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '6px 20px',
                        border: 'none',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: item.label === 'Elle Mermaid Yaz...' ? '#7c3aed' : '#333',
                        fontWeight: item.label === 'Elle Mermaid Yaz...' ? '600' : '400',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#E8F0FE'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span style={{ color: '#888', fontSize: '12px' }}>{item.shortcut}</span>}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Right side - Status */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '8px' }}>
          <span style={{ fontSize: '11px', color: '#666' }}>
            {isSaving ? 'Kaydediliyor...' : lastSaved ? `Kaydedildi ${lastSaved.toLocaleTimeString('tr-TR')}` : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: isConnected ? '#28A745' : '#DC3545' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#28A745' : '#DC3545' }} />
            {isConnected ? 'Cevrimici' : 'Cevrimdisi'}
          </div>
          <PresenceAvatars peers={peers} isConnected={isConnected} myColor={myColor} userName={userName} />
        </div>
      </div>

      {/* ===== TOOLBAR (draw.io style) ===== */}
      <div style={{
        height: '34px',
        background: '#FAFAFA',
        borderBottom: '1px solid #CACACA',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '2px',
      }}>
        {/* Undo/Redo */}
        <button onClick={() => editor?.undo()} style={toolbarBtnStyle} title="Geri Al (Ctrl+Z)">↶</button>
        <button onClick={() => editor?.redo()} style={toolbarBtnStyle} title="Yinele (Ctrl+Y)">↷</button>

        <div style={toolbarDivider} />

        {/* Zoom */}
        <button onClick={() => editor?.zoomOut()} style={toolbarBtnStyle} title="Uzaklastir">−</button>
        <span style={{ fontSize: '11px', minWidth: '40px', textAlign: 'center', color: '#333' }}>{currentZoom}%</span>
        <button onClick={() => editor?.zoomIn()} style={toolbarBtnStyle} title="Yakinlastir">+</button>
        <button onClick={() => editor?.zoomToFit()} style={toolbarBtnStyle} title="Tume Sigdir">⊞</button>
        <button onClick={() => editor?.resetZoom()} style={toolbarBtnStyle} title="%100">1:1</button>

        <div style={toolbarDivider} />

        {/* Tools */}
        <button onClick={() => editor?.setCurrentTool('select')} style={toolbarBtnStyle} title="Sec">⬚</button>
        <button onClick={() => editor?.setCurrentTool('hand')} style={toolbarBtnStyle} title="Tasi">✋</button>
        <button onClick={() => editor?.setCurrentTool('draw')} style={toolbarBtnStyle} title="Ciz">✏</button>
        <button onClick={() => editor?.setCurrentTool('eraser')} style={toolbarBtnStyle} title="Sil">🧹</button>
        <button onClick={() => editor?.setCurrentTool('arrow')} style={toolbarBtnStyle} title="Ok">➔</button>
        <button onClick={() => editor?.setCurrentTool('text')} style={toolbarBtnStyle} title="Metin">T</button>
        <button onClick={() => editor?.setCurrentTool('note')} style={toolbarBtnStyle} title="Not">📝</button>

        <div style={toolbarDivider} />
        <button
          onClick={() => setShowAIPanel(!showAIPanel)}
          style={{
            ...toolbarBtnStyle,
            background: showAIPanel ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : undefined,
            color: showAIPanel ? 'white' : undefined,
          }}
          title="AI Asistan"
        >
          AI
        </button>
        <button
          onClick={() => setShowCommentPanel(!showCommentPanel)}
          style={{
            ...toolbarBtnStyle,
            background: showCommentPanel ? '#F59E0B' : undefined,
            color: showCommentPanel ? 'white' : undefined,
            fontSize: '12px',
          }}
          title="Yorumlar"
        >
          💬
        </button>
        <button
          onClick={() => setShowHistoryPanel(!showHistoryPanel)}
          style={{
            ...toolbarBtnStyle,
            background: showHistoryPanel ? '#6366F1' : undefined,
            color: showHistoryPanel ? 'white' : undefined,
            fontSize: '12px',
          }}
          title="Gecmis"
        >
          🕐
        </button>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* LEFT PANEL - Sadece Sekiller + Bicim */}
        {showLeftPanel && (
          <div style={{
            width: '200px',
            background: 'white',
            borderRight: '1px solid #CACACA',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Section title */}
            <div style={{ padding: '6px 8px 2px', fontSize: '10px', fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sekiller</div>

            {/* Shape category tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E0E0E0' }}>
              {Object.entries(SHAPE_CATEGORIES).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => setSelectedShapeCategory(key)}
                  style={{
                    flex: 1,
                    padding: '5px 2px',
                    border: 'none',
                    borderBottom: selectedShapeCategory === key ? '2px solid #0066CC' : '2px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '9px',
                    color: selectedShapeCategory === key ? '#0066CC' : '#888',
                    fontWeight: selectedShapeCategory === key ? '600' : '400',
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Shape grid */}
            <div style={{ flex: 1, overflow: 'auto', padding: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                {SHAPE_CATEGORIES[selectedShapeCategory as keyof typeof SHAPE_CATEGORIES]?.shapes.map(shape => (
                  <button
                    key={shape.id}
                    onClick={() => addShape(shape.geo)}
                    style={{
                      aspectRatio: '1',
                      border: '1px solid #E8E8E8',
                      borderRadius: '4px',
                      background: '#FAFAFA',
                      cursor: 'pointer',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title={shape.name}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#E8F0FE'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#FAFAFA'}
                  >
                    {shape.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* BICIM section - always at bottom */}
            <div style={{ borderTop: '2px solid #E8E8E8', padding: '8px' }}>
              {selectedShapes.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#999', textAlign: 'center', padding: '4px 0' }}>
                  Sekil secin
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#888', marginBottom: '4px' }}>DOLGU</div>
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                      {['black', 'red', 'orange', 'yellow', 'green', 'blue', 'violet'].map(color => (
                        <button
                          key={color}
                          title={color}
                          onClick={() => {
                            const ids = editor?.getSelectedShapeIds();
                            if (ids && ids.length > 0) {
                              ids.forEach(id => {
                                const shape = editor?.getShape(id);
                                if (shape) {
                                  editor?.updateShape({ id, type: shape.type, props: { ...shape.props, color } } as any);
                                }
                              });
                            }
                          }}
                          style={{
                            width: '20px',
                            height: '20px',
                            border: '1px solid #CCC',
                            borderRadius: '3px',
                            background: color,
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#888', marginBottom: '4px' }}>BOYUT</div>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {([['S', 60], ['M', 120], ['L', 200], ['XL', 320]] as const).map(([label, dim]) => (
                        <button
                          key={label}
                          title={`${dim}x${dim}`}
                          onClick={() => {
                            editor?.getSelectedShapes().forEach(shape => {
                              const props = shape.props as any;
                              if (props.w !== undefined) {
                                const ratio = props.h / props.w;
                                editor?.updateShape({ id: shape.id, type: shape.type, props: { ...props, w: dim, h: Math.round(dim * ratio) } } as any);
                              }
                            });
                          }}
                          style={{
                            flex: 1,
                            padding: '3px',
                            border: '1px solid #E0E0E0',
                            borderRadius: '3px',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '9px',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#888', marginBottom: '4px' }}>YAZI TIPI</div>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {([['El', 'draw'], ['Sans', 'sans'], ['Serif', 'serif'], ['Mono', 'mono']] as const).map(([label, font]) => (
                        <button
                          key={font}
                          title={font}
                          onClick={() => {
                            editor?.getSelectedShapes().forEach(shape => {
                              editor?.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, font } } as any);
                            });
                          }}
                          style={{
                            flex: 1,
                            padding: '3px',
                            border: '1px solid #E0E0E0',
                            borderRadius: '3px',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '9px',
                            fontFamily: font === 'mono' ? 'monospace' : font === 'serif' ? 'serif' : font === 'draw' ? 'cursive' : 'sans-serif',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#888', marginBottom: '4px' }}>DUZENLEME</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px' }}>
                      <button onClick={() => editor?.bringToFront(editor.getSelectedShapeIds())} style={formatBtnStyle}>One Getir</button>
                      <button onClick={() => editor?.sendToBack(editor.getSelectedShapeIds())} style={formatBtnStyle}>Arkaya</button>
                      <button onClick={() => editor?.duplicateShapes(editor.getSelectedShapeIds())} style={formatBtnStyle}>Kopyala</button>
                      <button onClick={() => editor?.deleteShapes(editor.getSelectedShapeIds())} style={formatBtnStyle}>Sil</button>
                    </div>
                  </div>
                </>
              )}
              <div style={{ fontSize: '9px', color: '#999', textAlign: 'center', paddingTop: '4px' }}>
                {selectedShapes.length} secili / {shapeCount} toplam
              </div>
            </div>
          </div>
        )}

        {/* CANVAS */}
        <div style={{ flex: 1, position: 'relative', background: '#FFFFFF', overflow: 'hidden', minHeight: 0 }}>
          <Tldraw
            shapeUtils={customShapeUtils}
            snapshot={savedData ?? undefined}
            components={{
              StylePanel: null,
              Toolbar: null,
              MainMenu: null,
              PageMenu: null,
              NavigationPanel: null,
              HelpMenu: null,
              ActionsMenu: null,
              QuickActions: null,
            }}
            onMount={(editorInstance) => {
              setEditor(editorInstance);
              // Debug: sadece dev ortaminda editor'u window'a expose et
              if (process.env.NODE_ENV !== 'production') {
                (window as any).__TLDRAW_EDITOR__ = editorInstance;
              }
              if (savedData?.store) {
                try {
                  const shapes = Object.values(savedData.store).filter((item) => item.typeName === 'shape') as TLShape[];
                  shapes.forEach((shapeData) => {
                    const existingShape = editorInstance.getShape(shapeData.id);
                    if (existingShape && shapeData.meta) {
                      editorInstance.updateShape({ id: shapeData.id, type: existingShape.type, meta: { ...existingShape.meta, ...shapeData.meta } });
                    }
                  });
                } catch (err) { boardLog.warn('Meta load error:', err); }
              }
            }}
          />
          <MiniMap editor={editor} isVisible={showMiniMap} />

          {/* AI PANEL - Floating, minimap altında */}
          {showAIPanel && (
            <div style={{
              position: 'absolute',
              top: showMiniMap ? '100px' : '8px',
              right: '8px',
              width: '300px',
              height: '400px',
              zIndex: 100,
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              border: '1px solid #CACACA',
            }}>
              <AIPanel
                editor={editor}
                boardId={boardId}
                isVisible={showAIPanel}
                onClose={() => setShowAIPanel(false)}
                canvasAnchor={canvasAnchor}
              />
            </div>
          )}

          {/* COMMENT PANEL - Floating overlay */}
          {showCommentPanel && !showAIPanel && (
            <div style={{
              position: 'absolute',
              top: showMiniMap ? '100px' : '8px',
              right: '8px',
              width: '300px',
              height: '400px',
              zIndex: 100,
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              border: '1px solid #CACACA',
              background: 'white',
            }}>
              <CommentPanel
                editor={editor}
                boardId={boardId}
                isVisible={showCommentPanel}
                onClose={() => setShowCommentPanel(false)}
              />
            </div>
          )}

          {/* HISTORY PANEL - Floating overlay */}
          {showHistoryPanel && !showAIPanel && !showCommentPanel && (
            <div style={{
              position: 'absolute',
              top: showMiniMap ? '100px' : '8px',
              right: '8px',
              width: '300px',
              height: '400px',
              zIndex: 100,
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              border: '1px solid #CACACA',
              background: 'white',
            }}>
              <HistoryPanel
                boardId={boardId}
                isVisible={showHistoryPanel}
                onClose={() => setShowHistoryPanel(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ===== STATUS BAR (draw.io style) ===== */}
      <div style={{
        height: '24px',
        background: '#F5F5F5',
        borderTop: '1px solid #CACACA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: '11px',
        color: '#666',
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span>{shapeCount} sekil</span>
          <span>|</span>
          <span>Zoom: {currentZoom}%</span>
          {peers.length > 0 && (
            <>
              <span>|</span>
              <span>{peers.length} kullanici</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? '#10B981' : '#EF4444' }} />
            <span style={{ fontSize: '10px' }}>{isConnected ? 'Sync' : 'Offline'}</span>
          </span>
          <span style={{ color: '#0066CC', fontWeight: '500' }}>abeTahta</span>
        </div>
      </div>

      {/* Shortcuts Modal */}
      {showShortcutsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowShortcutsModal(false)}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '24px', maxWidth: '480px', width: '90%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Klavye Kisayollari</h3>
              <button onClick={() => setShowShortcutsModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666' }}>✕</button>
            </div>
            {[
              { title: 'Dosya', items: [['Ctrl+N', 'Yeni'], ['Ctrl+O', 'Ac'], ['Ctrl+S', 'Kaydet'], ['Ctrl+Shift+S', 'Farkli Kaydet'], ['Ctrl+P', 'Yazdir']] },
              { title: 'Duzen', items: [['Ctrl+Z', 'Geri Al'], ['Ctrl+Y', 'Yinele'], ['Ctrl+X', 'Kes'], ['Ctrl+C', 'Kopyala'], ['Ctrl+V', 'Yapistir'], ['Ctrl+A', 'Tumunu Sec'], ['Delete', 'Sil']] },
              { title: 'Gorunum', items: [['Ctrl++', 'Yakinlastir'], ['Ctrl+-', 'Uzaklastir'], ['Ctrl+0', '%100'], ['Ctrl+Shift+H', 'Tume Sigdir']] },
              { title: 'Araclar', items: [['V', 'Sec'], ['H', 'Tasi'], ['D', 'Ciz'], ['E', 'Silgi'], ['A', 'Ok'], ['T', 'Metin'], ['N', 'Not']] },
              { title: 'Bicimlendirme', items: [['Ctrl+Shift+]', 'One Getir'], ['Ctrl+Shift+[', 'Arkaya Gonder'], ['Ctrl+]', 'Bir One'], ['Ctrl+[', 'Bir Arkaya']] },
            ].map(section => (
              <div key={section.title} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#0066CC', marginBottom: '6px', borderBottom: '1px solid #E0E0E0', paddingBottom: '4px' }}>{section.title}</div>
                {section.items.map(([key, desc]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                    <span style={{ color: '#333' }}>{desc}</span>
                    <kbd style={{ background: '#F0F0F0', border: '1px solid #CCC', borderRadius: '3px', padding: '1px 6px', fontSize: '11px', fontFamily: 'monospace' }}>{key}</kbd>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <ExportPanel
        editor={editor}
        isVisible={showExportModal}
        onClose={() => setShowExportModal(false)}
        boardName={initialData?.board?.name || 'tahta'}
      />

      {/* Mermaid Modal - Elle Mermaid Yaz */}
      {showMermaidModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowMermaidModal(false)}>
          <div style={{ background: 'white', borderRadius: '8px', padding: '20px', width: '520px', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Elle Mermaid Yaz</h3>
              <button onClick={() => setShowMermaidModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666' }}>✕</button>
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
              Mermaid kodu yazin. Ornek: <code style={{ background: '#F0F0F0', padding: '1px 4px', borderRadius: '2px' }}>graph TD; A--&gt;B</code>
            </div>
            <textarea
              value={mermaidCode}
              onChange={(e) => setMermaidCode(e.target.value)}
              placeholder={'graph TD\n  A[Baslangic] --> B[Islem]\n  B --> C{Karar}\n  C -->|Evet| D[Son]\n  C -->|Hayir| B'}
              style={{
                width: '100%',
                height: '200px',
                border: '1px solid #CCC',
                borderRadius: '4px',
                padding: '10px',
                fontFamily: 'monospace',
                fontSize: '12px',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setShowMermaidModal(false)}
                style={{ padding: '6px 16px', border: '1px solid #CCC', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '12px' }}>
                Iptal
              </button>
              <button
                onClick={() => {
                  if (mermaidCode.trim() && editor) {
                    applyCodeDirect(editor, mermaidCode.trim(), 'mermaid', canvasAnchor || undefined).then(r => {
                      if (r.success) toast.success(`Mermaid: ${r.shapesAdded} sekil eklendi`);
                      else toast.error('Mermaid hatasi: ' + (r.error || ''));
                    });
                    setShowMermaidModal(false);
                  }
                }}
                style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: '#7c3aed', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                Calistir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const toolbarBtnStyle: React.CSSProperties = {
  width: '26px',
  height: '26px',
  border: '1px solid transparent',
  borderRadius: '3px',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#333',
};

const toolbarDivider: React.CSSProperties = {
  width: '1px',
  height: '20px',
  background: '#CACACA',
  margin: '0 6px',
};

const formatBtnStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #E0E0E0',
  borderRadius: '4px',
  background: 'white',
  cursor: 'pointer',
  fontSize: '10px',
  color: '#333',
};
