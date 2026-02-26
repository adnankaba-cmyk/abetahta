'use client';
// HMR trigger v8 - minHeight fix
import { useCallback, useEffect, useRef, useState } from 'react';
import { Tldraw, Editor, TLShape, TLStoreSnapshot, createShapeId } from 'tldraw';
import { toRichText, TLGeoShape, TLShapePartial } from '@tldraw/editor';
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
import { QuickTextBar } from './QuickTextBar';
import { FloatingActionBar } from './FloatingActionBar';
import { smartAutoConnect, autoLayoutTree } from '@/lib/canvas-utils';

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

// draw.io tarzı şekil kategorileri — tüm tldraw geo tipleri + note
const SHAPE_CATEGORIES = {
  general: {
    name: 'Genel',
    shapes: [
      { id: 'rectangle', icon: '▭', name: 'Dikdortgen', geo: 'rectangle' },
      { id: 'ellipse', icon: '○', name: 'Elips/Daire', geo: 'ellipse' },
      { id: 'oval', icon: '⬭', name: 'Oval', geo: 'oval' },
      { id: 'triangle', icon: '△', name: 'Ucgen', geo: 'triangle' },
      { id: 'diamond', icon: '◇', name: 'Elmas', geo: 'diamond' },
      { id: 'pentagon', icon: '⬠', name: 'Besgen', geo: 'pentagon' },
      { id: 'hexagon', icon: '⬡', name: 'Altigen', geo: 'hexagon' },
      { id: 'octagon', icon: '⯃', name: 'Sekizgen', geo: 'octagon' },
      { id: 'star', icon: '★', name: 'Yildiz', geo: 'star' },
      { id: 'heart', icon: '♥', name: 'Kalp', geo: 'heart' },
      { id: 'cloud', icon: '☁', name: 'Bulut', geo: 'cloud' },
      { id: 'rhombus', icon: '▱', name: 'Paralelkenar', geo: 'rhombus' },
      { id: 'rhombus2', icon: '▰', name: 'Paralelkenar 2', geo: 'rhombus-2' },
      { id: 'trapezoid', icon: '⏢', name: 'Yamuk', geo: 'trapezoid' },
      { id: 'check-box', icon: '☑', name: 'Onay Kutusu', geo: 'check-box' },
      { id: 'x-box', icon: '☒', name: 'Capraz Kutu', geo: 'x-box' },
    ]
  },
  flowchart: {
    name: 'Akis',
    shapes: [
      { id: 'fc-process', icon: '▭', name: 'Islem', geo: 'rectangle' },
      { id: 'fc-decision', icon: '◇', name: 'Karar', geo: 'diamond' },
      { id: 'fc-terminal', icon: '⬭', name: 'Baslangic/Bitis', geo: 'oval' },
      { id: 'fc-data', icon: '▱', name: 'Veri I/O', geo: 'rhombus' },
      { id: 'fc-database', icon: '⊖', name: 'Veritabani', geo: 'ellipse' },
      { id: 'fc-document', icon: '▭', name: 'Belge', geo: 'rectangle' },
      { id: 'fc-preparation', icon: '⬡', name: 'Hazirlik', geo: 'hexagon' },
      { id: 'fc-manual', icon: '⏢', name: 'Manuel Islem', geo: 'trapezoid' },
      { id: 'fc-display', icon: '▰', name: 'Gosterge', geo: 'rhombus-2' },
    ]
  },
  arrows: {
    name: 'Oklar',
    shapes: [
      { id: 'arrow-right', icon: '➡', name: 'Sag Ok', geo: 'arrow-right' },
      { id: 'arrow-left', icon: '⬅', name: 'Sol Ok', geo: 'arrow-left' },
      { id: 'arrow-up', icon: '⬆', name: 'Yukari Ok', geo: 'arrow-up' },
      { id: 'arrow-down', icon: '⬇', name: 'Asagi Ok', geo: 'arrow-down' },
    ]
  },
  notekart: {
    name: 'Not/Kart',
    shapes: [
      { id: 'note-yellow', icon: '📝', name: 'Yapiskan Not', geo: '__note_yellow' },
      { id: 'note-blue', icon: '📘', name: 'Mavi Not', geo: '__note_light-blue' },
      { id: 'note-green', icon: '📗', name: 'Yesil Not', geo: '__note_green' },
      { id: 'note-red', icon: '📕', name: 'Kirmizi Not', geo: '__note_light-red' },
      { id: 'note-violet', icon: '📓', name: 'Mor Not', geo: '__note_violet' },
      { id: 'grid-card', icon: '▦', name: 'Grid Kart', geo: '__grid_card' },
      { id: 'inventory', icon: '📋', name: 'Envanter Karti', geo: '__inventory_card' },
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
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<Array<{ name: string; ok: boolean; shapes: number; error?: string }> | null>(null);
  const [canvasAnchor, setCanvasAnchor] = useState<{ x: number; y: number } | null>(null);
  const [showDrawio, setShowDrawio] = useState(false);
  const [drawioXml, setDrawioXml] = useState<string | undefined>(undefined);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSnapshotRef = useRef<string>('');
  const knownShapeIds = useRef<Set<string>>(new Set());

  const savedData = initialData?.board?.tldraw_data;
  const [currentZoom, setCurrentZoom] = useState(100);
  const shapeCount = editor ? editor.getCurrentPageShapes().length : 0;

  // Zoom display sync: tldraw kamera degisikliklerini dinle
  useEffect(() => {
    if (!editor) return;
    setCurrentZoom(Math.round(editor.getZoomLevel() * 100));
    const unsub = editor.store.listen(
      () => {
        setCurrentZoom(Math.round(editor.getZoomLevel() * 100));
      },
      { source: 'user', scope: 'session' }
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

    // Yapışkan Not (tldraw note shape)
    if (geo.startsWith('__note_')) {
      const noteColor = geo.replace('__note_', '');
      editor.createShape({
        id, type: 'note',
        x: point.x - 100, y: point.y - 100,
        props: { color: noteColor, size: 'm', font: 'sans', richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Not...' }] }] } } as any,
        meta,
      });
      editor.select(id);
      return;
    }

    // Grid Kart — 3x3 grid (baslik + 2 satir veri) → gruplu tek obje
    if (geo === '__grid_card') {
      const gW = 360, cols = 3, rows = 3;
      const cellW = gW / cols;
      const headerH = 44, dataH = 40;
      const gH = headerH + (rows - 1) * dataH;
      const cellIds: ReturnType<typeof createShapeId>[] = [];
      const headers = ['Urun', 'Miktar', 'Fiyat'];
      const data = [
        ['Kalem', '100', '5 TL'],
        ['Defter', '50', '15 TL'],
      ];
      // Header satiri
      for (let c = 0; c < cols; c++) {
        const cellId = createShapeId();
        cellIds.push(cellId);
        editor.createShape<TLGeoShape>({
          id: cellId, type: 'geo',
          x: point.x - gW / 2 + c * cellW, y: point.y - gH / 2,
          props: {
            geo: 'rectangle', w: cellW, h: headerH,
            fill: 'solid', color: 'blue' as any, dash: 'solid',
            size: 'm', font: 'sans',
            richText: toRichText(headers[c]),
            verticalAlign: 'middle', align: 'middle',
          } as any,
          meta,
        });
      }
      // Veri satirlari
      for (let r = 0; r < data.length; r++) {
        for (let c = 0; c < cols; c++) {
          const cellId = createShapeId();
          cellIds.push(cellId);
          editor.createShape<TLGeoShape>({
            id: cellId, type: 'geo',
            x: point.x - gW / 2 + c * cellW,
            y: point.y - gH / 2 + headerH + r * dataH,
            props: {
              geo: 'rectangle', w: cellW, h: dataH,
              fill: 'semi', color: 'light-blue' as any, dash: 'solid',
              size: 's', font: 'sans',
              richText: toRichText(data[r][c]),
              verticalAlign: 'middle', align: 'middle',
            } as any,
            meta,
          });
        }
      }
      editor.groupShapes(cellIds);
      return;
    }

    // Envanter Kartı — başlık + 4 satır detay → gruplu tek obje
    if (geo === '__inventory_card') {
      const cardIds: ReturnType<typeof createShapeId>[] = [];
      const cardW = 240, rowH = 40, headerH = 48;
      const rowData = ['Urun Adi', 'Stok: 0', 'Fiyat: 0 TL', 'Kategori: -', 'Durum: Aktif'];
      const totalH = headerH + (rowData.length - 1) * rowH;
      for (let i = 0; i < rowData.length; i++) {
        const rowId = createShapeId();
        cardIds.push(rowId);
        const isHeader = i === 0;
        editor.createShape<TLGeoShape>({
          id: rowId, type: 'geo',
          x: point.x - cardW / 2,
          y: point.y - totalH / 2 + (isHeader ? 0 : headerH + (i - 1) * rowH),
          props: {
            geo: 'rectangle', w: cardW, h: isHeader ? headerH : rowH,
            fill: isHeader ? 'solid' : 'semi',
            color: isHeader ? 'blue' : 'light-blue',
            dash: 'solid', size: isHeader ? 'l' : 'm', font: 'sans',
            richText: toRichText(rowData[i]),
            verticalAlign: 'middle', align: isHeader ? 'middle' : 'start',
          } as any,
          meta,
        });
      }
      editor.groupShapes(cardIds);
      return;
    }

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
    editor.createShape<TLGeoShape>({
      id,
      type: 'geo',
      x: point.x - 50,
      y: point.y - 50,
      props: {
        geo: geo as TLGeoShape['props']['geo'],
        w: 100, h: 100,
        fill: 'solid', color: 'black',
        richText: toRichText(''),
      } as any,
      meta,
    });
    editor.select(id);
  }, [editor, userId, userName, canvasAnchor]);

  // draw.io'dan SVG geldiğinde canvas'a ekle + metin etiketi sor
  const handleDrawioInsert = useCallback((svgData: string, xml: string) => {
    if (!editor) return;
    // draw.io SVG export: data:image/svg+xml;base64,... veya düz SVG text
    let svgText = svgData;
    if (svgData.startsWith('data:image/svg+xml;base64,')) {
      svgText = atob(svgData.replace('data:image/svg+xml;base64,', ''));
    } else if (svgData.startsWith('data:image/svg+xml,')) {
      svgText = decodeURIComponent(svgData.replace('data:image/svg+xml,', ''));
    }

    // draw.io XML'inden metin içeriklerini çıkar (mxCell value="..." )
    const extractDrawioTexts = (xmlStr: string): string[] => {
      const texts: string[] = [];
      const regex = /value="([^"]+)"/g;
      let match;
      while ((match = regex.exec(xmlStr)) !== null) {
        const val = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/<[^>]*>/g, '').trim();
        if (val && val.length > 0) texts.push(val);
      }
      return texts;
    };

    const drawioTexts = extractDrawioTexts(xml);

    const center = editor.screenToPage(editor.getViewportScreenCenter());
    const beforeIds = new Set(editor.getCurrentPageShapeIds());

    editor.putExternalContent({
      type: 'svg-text',
      text: svgText,
      point: center,
    });

    // Yeni eklenen shape'leri bul
    const afterIds = editor.getCurrentPageShapeIds();
    const newIds = [...afterIds].filter(sid => !beforeIds.has(sid));

    // Yeni shape'lere drawio meta ekle
    for (const sid of newIds) {
      editor.updateShape({
        id: sid,
        type: editor.getShape(sid)!.type,
        meta: {
          createdBy: 'drawio',
          drawioXml: xml.slice(0, 2000),
          drawioTexts: drawioTexts.slice(0, 20),
        },
      });
    }

    // drawio metin icerigi varsa baslik ekle
    const label = drawioTexts.length > 0 ? drawioTexts[0] : null;
    if (label && label.trim()) {
      // Yeni eklenen shapelerin bounding box'unu hesapla
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const sid of newIds) {
        const bounds = editor.getShapePageBounds(sid);
        if (bounds) {
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.w);
          maxY = Math.max(maxY, bounds.y + bounds.h);
        }
      }
      if (minX !== Infinity) {
        const labelId = createShapeId();
        editor.createShape({
          id: labelId, type: 'text',
          x: minX + (maxX - minX) / 2 - 60,
          y: maxY + 12,
          props: {
            text: label.trim(),
            size: 'l',
            font: 'sans',
            color: 'black',
          } as any,
          meta: { createdBy: 'drawio-label' },
        });
      }
    }

    // XML'i sakla (sonra tekrar düzenleyebilsin)
    setDrawioXml(xml);
    setShowDrawio(false);
    toast.success('draw.io cizimi canvas\'a eklendi!');
  }, [editor]);

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

  // ERP Demo Sunum — canvas'a tam ERP sunumu yerleştirir
  const runERPDemo = useCallback(async () => {
    if (!editor) return;
    const { applyMermaidToCanvas } = await import('@/lib/ai-canvas-bridge');
    const rt = (t: string) => ({ type: 'doc' as const, content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: t }] }] });
    const meta = { createdBy: 'demo', createdByName: 'ERP Demo' };
    let y = 0;

    // ── 1. BAŞLIK ──
    const titleId = createShapeId();
    editor.createShape({ id: titleId, type: 'geo', x: 100, y, props: { geo: 'rectangle', w: 800, h: 80, color: 'blue', fill: 'solid', size: 'xl', font: 'sans', dash: 'solid', richText: rt('ERP Sistem Mimarisi — abeTahta Demo'), align: 'middle', verticalAlign: 'middle' } as any, meta });
    y += 100;

    // ── 2. ANA MODÜLLER (Flowchart) ──
    await applyMermaidToCanvas(editor, `graph LR
  A([Kullanici]) --> B[Satis Modulu]
  A --> C[Satin Alma]
  A --> D[Uretim]
  A --> E[Muhasebe]
  B --> F[(Stok DB)]
  C --> F
  D --> F
  E --> G[(Finans DB)]
  F --> H{Raporlama}
  G --> H
  H --> I([Dashboard])`, { x: 500, y: y + 200 });
    y += 480;

    // ── 3. YAPISKAN NOTLAR — Modül Açıklamaları ──
    const notlar = [
      { color: 'yellow', text: 'SATIS\n- Siparis olustur\n- Fatura kes\n- Musteri takibi\n- Teklif yonetimi' },
      { color: 'light-blue', text: 'SATIN ALMA\n- Tedarikci secimi\n- Satin alma talepleri\n- Irsaliye girisi\n- Maliyet analizi' },
      { color: 'light-green', text: 'URETIM\n- Urun agaci (BOM)\n- Is emirleri\n- Kapasite planlama\n- Kalite kontrol' },
      { color: 'violet', text: 'MUHASEBE\n- Cari hesaplar\n- Banka hareketleri\n- KDV beyanname\n- Bilanço/Gelir tablosu' },
    ];
    for (let i = 0; i < notlar.length; i++) {
      const nId = createShapeId();
      editor.createShape({ id: nId, type: 'note', x: 100 + i * 220, y, props: { color: notlar[i].color, size: 'm', font: 'sans', richText: rt(notlar[i].text), align: 'start', verticalAlign: 'start' } as any, meta });
    }
    y += 260;

    // ── 4. SIPARIŞ AKIŞI (Detaylı Flowchart) ──
    const subtitleId = createShapeId();
    editor.createShape({ id: subtitleId, type: 'geo', x: 100, y, props: { geo: 'rectangle', w: 600, h: 50, color: 'orange', fill: 'solid', size: 'l', font: 'sans', dash: 'solid', richText: rt('Siparis-Sevkiyat Sureci'), align: 'middle', verticalAlign: 'middle' } as any, meta });
    y += 70;

    await applyMermaidToCanvas(editor, `graph TD
  A([Siparis Girisi]) --> B{Stok Yeterli?}
  B -->|Evet| C[Sevkiyat Hazirligi]
  B -->|Hayir| D[Satin Alma Talebi]
  D --> E[Tedarikci Onay]
  E --> F[Mal Kabul]
  F --> C
  C --> G[Irsaliye Olustur]
  G --> H[Fatura Kes]
  H --> I[(Muhasebe Kayit)]
  I --> J([Tamamlandi])`, { x: 500, y: y + 250 });
    y += 580;

    // ── 5. ENVANTER KARTLARI ──
    const envTitleId = createShapeId();
    editor.createShape({ id: envTitleId, type: 'geo', x: 100, y, props: { geo: 'rectangle', w: 600, h: 50, color: 'green', fill: 'solid', size: 'l', font: 'sans', dash: 'solid', richText: rt('Ornek Envanter Kartlari'), align: 'middle', verticalAlign: 'middle' } as any, meta });
    y += 70;

    const urunler = [
      { ad: 'Laptop Dell XPS 15', stok: '45 Adet', fiyat: '52.000 TL', kat: 'Bilisim', durum: 'Aktif' },
      { ad: 'Monitor Samsung 27"', stok: '120 Adet', fiyat: '8.500 TL', kat: 'Bilisim', durum: 'Aktif' },
      { ad: 'Masa Lambasi LED', stok: '3 Adet', fiyat: '450 TL', kat: 'Ofis', durum: 'Kritik Stok' },
    ];
    for (let u = 0; u < urunler.length; u++) {
      const urun = urunler[u];
      const satirs = [urun.ad, `Stok: ${urun.stok}`, `Fiyat: ${urun.fiyat}`, `Kategori: ${urun.kat}`, `Durum: ${urun.durum}`];
      const cardW = 220, rowH = 32, headerH = 40;
      for (let i = 0; i < satirs.length; i++) {
        const rId = createShapeId();
        const isH = i === 0;
        editor.createShape<TLGeoShape>({ id: rId, type: 'geo',
          x: 100 + u * 240, y: y + (isH ? 0 : headerH + (i - 1) * rowH),
          props: { geo: 'rectangle', w: cardW, h: isH ? headerH : rowH, fill: isH ? 'solid' : 'semi',
            color: isH ? (u === 2 ? 'red' : 'blue') : (u === 2 ? 'light-red' : 'light-blue'),
            dash: 'solid', size: isH ? 'l' : 'm', font: 'sans', richText: rt(satirs[i]) } as any, meta });
      }
    }
    y += 220;

    // ── 6. KPI GÖSTERGE PANELİ ──
    const kpiTitleId = createShapeId();
    editor.createShape({ id: kpiTitleId, type: 'geo', x: 100, y, props: { geo: 'rectangle', w: 600, h: 50, color: 'violet', fill: 'solid', size: 'l', font: 'sans', dash: 'solid', richText: rt('KPI Dashboard'), align: 'middle', verticalAlign: 'middle' } as any, meta });
    y += 70;

    const kpiler = [
      { icon: 'star', text: 'Aylik Ciro\n2.4M TL', color: 'green' },
      { icon: 'check-box', text: 'Siparis\n%94 Tamamlandi', color: 'blue' },
      { icon: 'heart', text: 'Musteri Memnuniyet\n%87', color: 'red' },
      { icon: 'diamond', text: 'Stok Devir Hizi\n8.2x', color: 'orange' },
    ];
    for (let k = 0; k < kpiler.length; k++) {
      const kId = createShapeId();
      editor.createShape<TLGeoShape>({ id: kId, type: 'geo',
        x: 100 + k * 200, y,
        props: { geo: kpiler[k].icon as any, w: 180, h: 120, fill: 'semi', color: kpiler[k].color as any, dash: 'solid', size: 'l', font: 'sans', richText: rt(kpiler[k].text), verticalAlign: 'middle', align: 'middle' } as any, meta });
    }
    y += 160;

    // ── 7. UYARI ──
    const warningId = createShapeId();
    editor.createShape<TLGeoShape>({ id: warningId, type: 'geo', x: 100, y,
      props: { geo: 'cloud', w: 800, h: 100, fill: 'semi', color: 'yellow', dash: 'dashed', size: 'l', font: 'sans',
        richText: rt('Bu sunum abeTahta grafik motoru ile olusturuldu — Mermaid DSL + tldraw 20 geo tipi + yapiskan notlar + envanter kartlari'), verticalAlign: 'middle', align: 'middle' } as any, meta });

    // Zoom to all
    editor.selectAll();
    editor.zoomToSelection({ animation: { duration: 500 } });
    editor.selectNone();
    toast.success('ERP Demo Sunum yuklendi!');
  }, [editor]);

  // Dosya Ac - JSON yukle (her cagri icin temiz input — DOM sizintisi yok)
  const openFile = useCallback(() => {
    if (!editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.tldr,.mmd,.mermaid,.xml,.drawio,.excalidraw';
    input.style.display = 'none';

    const cleanup = () => {
      if (document.body.contains(input)) input.remove();
    };

    input.addEventListener('cancel', cleanup);
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) { cleanup(); return; }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const content = ev.target?.result as string;
        if (!content) return;
        const name = file.name.toLowerCase();

        // tldraw snapshot (.json, .tldr)
        if (name.endsWith('.json') || name.endsWith('.tldr')) {
          try {
            const data = JSON.parse(content);
            if (data.type === 'excalidraw') {
              const count = importExcalidrawToCanvas(editor, content);
              if (count > 0) toast.success(`${count} nesne ice aktarildi`);
              else toast.error('Icerik bulunamadi');
            } else if (data.store) {
              editor.loadSnapshot(data);
              toast.success('Tahta yuklendi');
            } else {
              toast.error('Desteklenmeyen JSON formati');
            }
          } catch (err) {
            toast.error('Dosya okunamadi: ' + (err as Error).message);
          }
          cleanup();
          return;
        }

        // Mermaid (.mmd, .mermaid)
        if (name.endsWith('.mmd') || name.endsWith('.mermaid')) {
          const count = await importMermaidToCanvas(editor, content);
          if (count > 0) toast.success(`${count} nesne ice aktarildi`);
          else toast.error('Mermaid icerik bulunamadi');
          cleanup();
          return;
        }

        // draw.io (.xml, .drawio)
        if (name.endsWith('.xml') || name.endsWith('.drawio')) {
          const count = importDrawioToCanvas(editor, content);
          if (count > 0) toast.success(`${count} nesne ice aktarildi`);
          else toast.error('Draw.io icerik bulunamadi');
          cleanup();
          return;
        }

        // Excalidraw (.excalidraw)
        if (name.endsWith('.excalidraw')) {
          const count = importExcalidrawToCanvas(editor, content);
          if (count > 0) toast.success(`${count} nesne ice aktarildi`);
          else toast.error('Excalidraw icerik bulunamadi');
          cleanup();
          return;
        }

        toast.error('Desteklenmeyen dosya formati');
        cleanup();
      };
      reader.readAsText(file);
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

    let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSave = () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(saveToDatabase, 2000);
      // maxWait: en gec 30sn icinde kaydet (surekli edit durumunda)
      if (!maxWaitTimer) {
        maxWaitTimer = setTimeout(() => { maxWaitTimer = null; saveToDatabase(); }, 30_000);
      }
    };

    const cleanupUpdate = editor.sideEffects.registerAfterChangeHandler('shape', (prev: TLShape, next: TLShape) => {
      const prevMeta = prev.meta as ShapeMeta;
      const nextMeta = next.meta as ShapeMeta;
      // Create handler zaten meta ayarladi — tekrar tetiklemeyi onle
      if (prevMeta?.updatedAt === nextMeta?.updatedAt && knownShapeIds.current.has(next.id) && prevMeta?.createdAt) {
        editor.updateShape({ id: next.id, type: next.type, meta: { ...next.meta, updatedAt: new Date().toISOString(), updatedBy: userId, updatedByName: userName } });
      }
      scheduleSave();
    });

    return () => { cleanupCreate(); cleanupUpdate(); if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); if (maxWaitTimer) clearTimeout(maxWaitTimer); };
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
      // Inputlarda ve text editing modunda kısayolları devre dışı bırak
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // tldraw text editing: contentEditable div içindeyken tek tuş kısayolları engelle
      if (target?.isContentEditable || target?.closest('[contenteditable="true"]')) {
        // Ctrl kısayollarına izin ver (Ctrl+S kaydet vb.), tek tuşları engelle
        if (!e.ctrlKey && !e.metaKey) return;
      }

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
          case 'n': {
            e.preventDefault();
            const count = editor?.getCurrentPageShapeIds().size || 0;
            if (count === 0) return;
            if (!confirm(`Tahtadaki ${count} şekil silinecek. Emin misiniz?`)) return;
            editor?.deleteShapes([...editor.getCurrentPageShapeIds()]);
            return;
          }
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
          case 'g':
            e.preventDefault();
            if (shift) {
              const uIds = editor?.getSelectedShapeIds();
              if (uIds && uIds.length > 0) editor?.ungroupShapes(uIds);
            } else {
              const gIds = editor?.getSelectedShapeIds();
              if (gIds && gIds.length >= 2) editor?.groupShapes(gIds);
            }
            return;
          case 'l':
            if (shift) {
              e.preventDefault();
              if (editor) autoLayoutTree(editor);
            }
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
          case 'c': e.preventDefault(); if (editor) smartAutoConnect(editor); return;
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
        { label: 'Yeni', shortcut: 'Ctrl+N', action: () => {
          const count = editor?.getCurrentPageShapeIds().size || 0;
          if (count === 0) return;
          if (!confirm(`Tahtadaki ${count} şekil silinecek. Emin misiniz?`)) return;
          editor?.deleteShapes([...editor.getCurrentPageShapeIds()]);
        }},
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
        { divider: true, label: '' },
        { label: 'draw.io Editor...', action: () => { setDrawioXml(undefined); setShowDrawio(true); } },
        { label: 'draw.io Duzenle (son)', action: () => setShowDrawio(true) },
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
        { header: true, label: 'ERP ORNEKLERI' },
        { label: 'ERP Modulleri (Mermaid)', action: () => runMermaid('erpSunum') },
        { label: 'Siparis Akisi (Mermaid)', action: () => runMermaid('erpSiparis') },
        { label: 'Uretim Sureci (Mermaid)', action: () => runMermaid('erpUretim') },
        { label: 'ERP Tam Sunum Demo', action: () => runERPDemo() },
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
                  ) : item.header ? (
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

        {/* Group/Ungroup */}
        <button onClick={() => { const ids = editor?.getSelectedShapeIds(); if (ids && ids.length >= 2) editor?.groupShapes(ids); }} style={toolbarBtnStyle} title="Grupla (Ctrl+G)">⊞G</button>
        <button onClick={() => { const ids = editor?.getSelectedShapeIds(); if (ids && ids.length > 0) editor?.ungroupShapes(ids); }} style={toolbarBtnStyle} title="Grubu Boz (Ctrl+Shift+G)">⊟G</button>

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
        {process.env.NODE_ENV !== 'production' && (
          <button
            onClick={async () => {
              if (!editor || testRunning) return;
              setTestRunning(true);
              setTestResults(null);
              try {
                const { applyMermaidToCanvas } = await import('@/lib/ai-canvas-bridge');
                const tests = [
                  { name: '1. Basit TD', code: 'graph TD\n  A[Baslangic] --> B[Islem]\n  B --> C[Son]' },
                  { name: '2. LR Yon', code: 'graph LR\n  A[Girdi] --> B[Islem] --> C[Cikti]' },
                  { name: '3. Decision', code: 'graph TD\n  A[Basla] --> B{Onay?}\n  B -->|Evet| C[Devam]\n  B -->|Hayir| D[Iptal]' },
                  { name: '4. Database', code: 'graph TD\n  A[Sorgu] --> B[(Veritabani)]\n  B --> C((Sonuc))' },
                  { name: '5. Stadium', code: 'graph TD\n  A([Baslat]) --> B[Islem] --> C([Bitir])' },
                  { name: '6. Flag IO', code: 'graph LR\n  A>Girdi] --> B[Oku] --> C>Cikti]' },
                  { name: '7. Edge Labels', code: 'graph TD\n  A[Kullanici] -->|Istek| B[Sunucu]\n  B -->|Yanit| A\n  B -->|Kaydet| C[(DB)]' },
                  { name: '8. Karmasik', code: 'graph TD\n  A[Kayit] --> B{Email?}\n  B -->|Evet| C[Profil]\n  B -->|Hayir| D[Gonder]\n  D --> E[Bekle]\n  E --> B\n  C --> F[Dashboard]\n  F --> G[Bitti]' },
                  { name: '9. Paralel', code: 'graph TD\n  A[Siparis] --> B{Odeme?}\n  B -->|Kart| C[Banka]\n  B -->|Havale| D[Manuel]\n  B -->|Kapida| E[Kargo]\n  C --> F[Onayla]\n  D --> F\n  E --> F' },
                  { name: '10. DevOps', code: 'graph LR\n  A[Kod] --> B[Build]\n  B --> C{Test?}\n  C -->|OK| D[Deploy]\n  C -->|Fail| E[Fix]\n  E --> A\n  D --> F[(Prod)]' },
                  { name: '11. BT Yon', code: 'graph BT\n  A[Temel] --> B[Orta]\n  B --> C[Ust]\n  C --> D{Karar?}' },
                  { name: '12. RL Yon', code: 'graph RL\n  A[Son] --> B[Islem] --> C[Bas]' },
                  { name: '13. 6 Bracket Tipi', code: 'graph TD\n  A[Dikdortgen] --> B{Elmas}\n  B --> C((Daire))\n  B --> D([Stadyum])\n  B --> E[(DB)]\n  B --> F>Bayrak]' },
                  { name: '14. Hexagon+Trapez', code: 'graph TD\n  A{{Hazirlik}} --> B[/Girdi/]\n  B --> C[\\Cikti\\]\n  C --> D[/Trapez\\]' },
                  { name: '15. Rounded+Subrtn', code: 'graph TD\n  A(Yuvarlak) --> B[[Alt Program]]\n  B --> C(Sonuc)' },
                  { name: '16. Uzun Metin', code: 'graph TD\n  A[Cok uzun baslangic metni] --> B{Karar noktasi uzun metin}\n  B -->|Evet| C[Islem tamamlandi]\n  B -->|Hayir| D[Hata mesaji]' },
                  { name: '17. Tek Node', code: 'graph TD\n  A[Yalniz Node]' },
                  { name: '18. Dongu', code: 'graph TD\n  A[Basla] --> B[Islem]\n  B --> C{Tamam?}\n  C -->|Hayir| B\n  C -->|Evet| D[Bitti]' },
                  { name: '19. Coklu Giris', code: 'graph TD\n  A[Web] --> D[API]\n  B[Mobil] --> D\n  C[IoT] --> D\n  D --> E[(DB)]' },
                  { name: '20. flowchart', code: 'flowchart TD\n  A[Start] --> B{Check}\n  B -->|Yes| C[Process]\n  B -->|No| D[End]' },
                  { name: '21. Derin', code: 'graph TD\n  A[S1] --> B[S2]\n  B --> C[S3]\n  C --> D[S4]\n  D --> E[S5]\n  E --> F{Karar}\n  F -->|Git| G[S6]\n  F -->|Dur| H[Son]' },
                  { name: '22. Buyuk Ag', code: 'graph TD\n  A[Kullanici] --> B[Auth]\n  B --> C{Yetkili?}\n  C -->|Evet| D[Dashboard]\n  C -->|Hayir| E[Login]\n  E --> B\n  D --> F[Proje]\n  D --> G[Ayar]\n  F --> H[Tahta]\n  H --> I[Canvas]\n  I --> J[(Kaydet)]\n  G --> K[Profil]\n  K --> J' },
                  { name: '23. Tum Bracket', code: 'graph LR\n  A[Rectangle] --> B{Diamond}\n  B --> C((Ellipse))\n  C --> D([Oval])\n  D --> E[(Cylinder)]\n  E --> F>Flag]\n  F --> G{{Hexagon}}' },
                  { name: '24. DblCircle', code: 'graph TD\n  A([Basla]) --> B[Islem]\n  B --> C(((Bitis)))' },
                  { name: '25. Parallelgrm', code: 'graph TD\n  A[/Girdi/] --> B[Islem]\n  B --> C[\\Cikti\\]' },
                  { name: '26. Trapezoid', code: 'graph TD\n  A[/Trapezoid\\] --> B[\\Ters Trapez/]' },
                  { name: '27. Rounded+Sub', code: 'graph TD\n  A(Yuvarlak) --> B[[Alt Program]]\n  B --> C(Sonuc)' },
                  { name: '28. @shape tri', code: 'graph TD\n  A@{ shape: tri, label: "Ucgen" } --> B@{ shape: cloud, label: "Bulut" }\n  B --> C@{ shape: bolt, label: "Yildirim" }' },
                  { name: '29. @shape doc', code: 'graph LR\n  A@{ shape: doc, label: "Belge" } --> B@{ shape: cyl, label: "DB" }\n  B --> C@{ shape: diam, label: "Karar" }' },
                  { name: '30. @shape ozel', code: 'graph TD\n  A@{ shape: delay, label: "Bekle" } --> B@{ shape: hex, label: "Hazirlik" }\n  B --> C@{ shape: flag, label: "Bayrak" }\n  C --> D@{ shape: cross-circ, label: "Ozet" }' },
                ];
                const res: typeof testResults = [];
                for (let i = 0; i < tests.length; i++) {
                  const t = tests[i];
                  try {
                    const anchor = { x: 400, y: 300 + i * 600 };
                    const r = await applyMermaidToCanvas(editor, t.code, anchor);
                    res.push({ name: t.name, ok: r.applied && r.shapeCount > 0, shapes: r.shapeCount, error: r.errors[0] });
                  } catch (e: any) {
                    res.push({ name: t.name, ok: false, shapes: 0, error: e.message });
                  }
                }
                setTestResults(res);
                editor.selectAll();
                editor.zoomToSelection({ animation: { duration: 300 } });
                editor.selectNone();
              } catch (e: any) {
                setTestResults([{ name: 'GENEL HATA', ok: false, shapes: 0, error: e.message }]);
              } finally {
                setTestRunning(false);
              }
            }}
            style={{
              ...toolbarBtnStyle,
              background: testRunning ? '#EF4444' : 'linear-gradient(135deg, #10B981, #059669)',
              color: 'white',
              fontSize: '11px',
              fontWeight: 700,
            }}
            title="20 Flowchart Test"
            disabled={testRunning}
          >
            {testRunning ? '...' : 'TEST'}
          </button>
        )}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                {SHAPE_CATEGORIES[selectedShapeCategory as keyof typeof SHAPE_CATEGORIES]?.shapes.map(shape => (
                  <button
                    key={shape.id}
                    onClick={() => addShape(shape.geo)}
                    style={{
                      padding: '6px 2px',
                      border: '1px solid #E8E8E8',
                      borderRadius: '6px',
                      background: '#FAFAFA',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                      transition: 'all 0.15s',
                    }}
                    title={shape.name}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#E8F0FE'; e.currentTarget.style.borderColor = '#90CAF9'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.borderColor = '#E8E8E8'; e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>{shape.icon}</span>
                    <span style={{ fontSize: '8px', color: '#666', lineHeight: 1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shape.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* BICIM section - always at bottom */}
            <div style={{ borderTop: '2px solid #E8E8E8', padding: '8px' }}>
              {selectedShapes.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#888', padding: '4px 0' }}>
                  <div style={{ fontWeight: '600', marginBottom: '4px', textAlign: 'center' }}>Kisayollar</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', fontSize: '9px' }}>
                    <span style={{ color: '#666' }}>V</span><span>Sec</span>
                    <span style={{ color: '#666' }}>C</span><span>Bagla</span>
                    <span style={{ color: '#666' }}>T</span><span>Metin</span>
                    <span style={{ color: '#666' }}>N</span><span>Not</span>
                    <span style={{ color: '#666' }}>A</span><span>Ok</span>
                    <span style={{ color: '#666' }}>Ctrl+Shift+L</span><span>Agac</span>
                  </div>
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
                                  editor?.updateShape({ id, type: shape.type, props: { ...shape.props, color } } as TLShapePartial<TLShape>);
                                }
                              });
                            }
                          }}
                          style={{
                            width: '24px',
                            height: '24px',
                            border: '2px solid white',
                            borderRadius: '50%',
                            background: color,
                            cursor: 'pointer',
                            boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                            transition: 'transform 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
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
                              const props = shape.props as Record<string, unknown>;
                              if (props['w'] !== undefined) {
                                const ratio = (props['h'] as number) / (props['w'] as number);
                                editor?.updateShape({ id: shape.id, type: shape.type, props: { ...props, w: dim, h: Math.round(dim * ratio) } } as TLShapePartial<TLShape>);
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
                              editor?.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, font } } as TLShapePartial<TLShape>);
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
                      <button onClick={() => editor?.bringToFront(editor.getSelectedShapeIds())} style={formatBtnStyle} onMouseEnter={formatBtnHoverIn} onMouseLeave={formatBtnHoverOut}>⬆ One Getir</button>
                      <button onClick={() => editor?.sendToBack(editor.getSelectedShapeIds())} style={formatBtnStyle} onMouseEnter={formatBtnHoverIn} onMouseLeave={formatBtnHoverOut}>⬇ Arkaya</button>
                      <button onClick={() => editor?.duplicateShapes(editor.getSelectedShapeIds())} style={formatBtnStyle} onMouseEnter={formatBtnHoverIn} onMouseLeave={formatBtnHoverOut}>📋 Kopyala</button>
                      <button onClick={() => editor?.deleteShapes(editor.getSelectedShapeIds())} style={{...formatBtnStyle, color: '#DC2626'}} onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.transform = 'scale(1.03)'; }} onMouseLeave={formatBtnHoverOut}>🗑 Sil</button>
                      <button onClick={() => { const ids = editor?.getSelectedShapeIds(); if (ids && ids.length >= 2) editor?.groupShapes(ids); }} style={formatBtnStyle} onMouseEnter={formatBtnHoverIn} onMouseLeave={formatBtnHoverOut}>📦 Grupla</button>
                      <button onClick={() => { const ids = editor?.getSelectedShapeIds(); if (ids && ids.length > 0) editor?.ungroupShapes(ids); }} style={formatBtnStyle} onMouseEnter={formatBtnHoverIn} onMouseLeave={formatBtnHoverOut}>📤 Grubu Boz</button>
                      <button onClick={() => editor && smartAutoConnect(editor)} style={{...formatBtnStyle, color: '#1D4ED8'}} onMouseEnter={(e) => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.transform = 'scale(1.03)'; }} onMouseLeave={formatBtnHoverOut} title="Secili sekilleri okla bagla (C)">🔗 Bagla</button>
                      <button onClick={() => editor && autoLayoutTree(editor)} style={{...formatBtnStyle, color: '#15803D'}} onMouseEnter={(e) => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.borderColor = '#86EFAC'; e.currentTarget.style.transform = 'scale(1.03)'; }} onMouseLeave={formatBtnHoverOut} title="Agac duzenine getir (Ctrl+Shift+L)">🌳 Agac Duz.</button>
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
          <div style={{ position: 'absolute', inset: 0 }}>
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
                // Test: konsolda testFlowchart() veya testAll() yazarak test et
                (window as any).testFlowchart = async (example?: string) => {
                  const { applyMermaidToCanvas } = await import('@/lib/ai-canvas-bridge');
                  const code = example || `graph TD
  A[Basla] --> B{Karar?}
  B -->|Evet| C[Islem Yap]
  B -->|Hayir| D[Kontrol]
  C --> E[Bitir]
  D --> B`;
                  const result = await applyMermaidToCanvas(editorInstance, code);
                  console.log('Flowchart sonuc:', result);
                  return result;
                };

                // KAPSAMLI TEST: Tüm flowchart örneklerini sırayla test eder
                (window as any).testAll = async () => {
                  const { applyMermaidToCanvas } = await import('@/lib/ai-canvas-bridge');

                  const tests = [
                    // 1. Basit TD (Top-Down) - temel node + edge
                    { name: '1. Basit TD', code: `graph TD
  A[Baslangic] --> B[Islem]
  B --> C[Son]` },

                    // 2. LR (Left-Right) yön
                    { name: '2. LR Yon', code: `graph LR
  A[Girdi] --> B[Islem] --> C[Cikti]` },

                    // 3. Decision diamond {karar}
                    { name: '3. Decision Diamond', code: `graph TD
  A[Basla] --> B{Onay?}
  B -->|Evet| C[Devam]
  B -->|Hayir| D[Iptal]` },

                    // 4. Database ellipse (()) ve [()]
                    { name: '4. Database Nodes', code: `graph TD
  A[Sorgu] --> B[(Veritabani)]
  B --> C((Sonuc))` },

                    // 5. Stadium/pill ([]) - start node
                    { name: '5. Stadium Node', code: `graph TD
  A([Baslat]) --> B[Islem] --> C([Bitir])` },

                    // 6. Flag >] - IO node
                    { name: '6. Flag IO Node', code: `graph LR
  A>Girdi Dosyasi] --> B[Oku] --> C>Cikti Dosyasi]` },

                    // 7. Edge label'ları
                    { name: '7. Edge Labels', code: `graph TD
  A[Kullanici] -->|Istek| B[Sunucu]
  B -->|Yanit| A
  B -->|Kaydet| C[(DB)]` },

                    // 8. Karmaşık akış - 7+ node
                    { name: '8. Karmasik Akis', code: `graph TD
  A[Kayit Ol] --> B{Email Dogrulandi?}
  B -->|Evet| C[Profil Olustur]
  B -->|Hayir| D[Email Gonder]
  D --> E[Bekle]
  E --> B
  C --> F[Dashboard]
  F --> G[Bitir]` },

                    // 9. Paralel dallar
                    { name: '9. Paralel Dallar', code: `graph TD
  A[Siparis] --> B{Odeme?}
  B -->|Kredi Karti| C[Banka API]
  B -->|Havale| D[Manuel Kontrol]
  B -->|Kapida| E[Kargo]
  C --> F[Onayla]
  D --> F
  E --> F
  F --> G[Gonder]` },

                    // 10. DevOps Pipeline LR
                    { name: '10. DevOps Pipeline', code: `graph LR
  A[Kod] --> B[Build]
  B --> C{Test?}
  C -->|Basarili| D[Deploy]
  C -->|Basarisiz| E[Fix]
  E --> A
  D --> F[(Production)]` },

                    // 11. BT (Bottom-Top) yön
                    { name: '11. BT Yon', code: `graph BT
  A[Temel] --> B[Orta]
  B --> C[Ust]
  C --> D{Karar?}` },

                    // 12. RL (Right-Left) yön
                    { name: '12. RL Yon', code: `graph RL
  A[Son] --> B[Islem] --> C[Bas]` },

                    // 13. Tüm bracket tipleri bir arada
                    { name: '13. Tum Bracket Tipleri', code: `graph TD
  A[Dikdortgen] --> B{Elmas}
  B --> C((Daire))
  B --> D([Stadyum])
  B --> E[(Veritabani)]
  B --> F>Bayrak]` },

                    // 14. Uzun metin node'ları
                    { name: '14. Uzun Metinler', code: `graph TD
  A[Bu cok uzun bir baslangic metnidir] --> B{Bu bir karar noktasidir ve uzun metin icerir}
  B -->|Evet dogru| C[Islem tamamlandi basariyla]
  B -->|Hayir yanlis| D[Hata mesaji gosteriliyor]` },

                    // 15. Tek node (edge yok)
                    { name: '15. Tek Node', code: `graph TD
  A[Yalniz Node]` },

                    // 16. Döngü (cycle)
                    { name: '16. Dongu', code: `graph TD
  A[Basla] --> B[Islem]
  B --> C{Tamam?}
  C -->|Hayir| B
  C -->|Evet| D[Bitti]` },

                    // 17. Çoklu giriş
                    { name: '17. Coklu Giris', code: `graph TD
  A[Web] --> D[API Gateway]
  B[Mobil] --> D
  C[IoT] --> D
  D --> E[(Database)]` },

                    // 18. flowchart anahtar kelimesi
                    { name: '18. Flowchart Keyword', code: `flowchart TD
  A[Start] --> B{Check}
  B -->|Yes| C[Process]
  B -->|No| D[End]` },

                    // 19. Derin hiyerarşi (5+ seviye)
                    { name: '19. Derin Hiyerarsi', code: `graph TD
  A[Seviye 1] --> B[Seviye 2]
  B --> C[Seviye 3]
  C --> D[Seviye 4]
  D --> E[Seviye 5]
  E --> F{Karar}
  F -->|Devam| G[Seviye 6]
  F -->|Dur| H[Son]` },

                    // 20. Büyük ağ (10+ node, çapraz bağlantılar)
                    { name: '20. Buyuk Ag', code: `graph TD
  A[Kullanici] --> B[Auth]
  B --> C{Yetkili?}
  C -->|Evet| D[Dashboard]
  C -->|Hayir| E[Login]
  E --> B
  D --> F[Projeler]
  D --> G[Ayarlar]
  F --> H[Tahta]
  H --> I[Canvas]
  I --> J[(Kaydet)]
  G --> K[Profil]
  K --> J` },
                  ];

                  console.log('=== KAPSAMLI FLOWCHART TESTİ BAŞLIYOR ===');
                  console.log(`Toplam ${tests.length} test çalıştırılacak\n`);

                  let passed = 0;
                  let failed = 0;
                  const results: Array<{ name: string; ok: boolean; shapes: number; error?: string }> = [];

                  for (const test of tests) {
                    try {
                      // Her test öncesi küçük bir offset ile yerleştir (üst üste binmesin)
                      const offsetY = (passed + failed) * 600;
                      const anchor = { x: 400, y: 300 + offsetY };
                      const result = await applyMermaidToCanvas(editorInstance, test.code, anchor);

                      if (result.applied && result.shapeCount > 0) {
                        passed++;
                        results.push({ name: test.name, ok: true, shapes: result.shapeCount });
                        console.log(`✅ ${test.name} — ${result.shapeCount} shape`);
                      } else {
                        failed++;
                        const err = result.errors.join(', ') || 'Shape oluşturulamadı';
                        results.push({ name: test.name, ok: false, shapes: 0, error: err });
                        console.log(`❌ ${test.name} — HATA: ${err}`);
                      }
                    } catch (e: any) {
                      failed++;
                      results.push({ name: test.name, ok: false, shapes: 0, error: e.message });
                      console.log(`❌ ${test.name} — EXCEPTION: ${e.message}`);
                    }
                  }

                  console.log('\n=== SONUÇ ===');
                  console.log(`✅ Başarılı: ${passed}/${tests.length}`);
                  console.log(`❌ Başarısız: ${failed}/${tests.length}`);
                  console.log('Detay:', results);

                  // Canvas'ı tüm shape'lere zoom yap
                  editorInstance.selectAll();
                  editorInstance.zoomToSelection({ animation: { duration: 300 } });
                  editorInstance.selectNone();

                  return { passed, failed, total: tests.length, results };
                };
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
          </div>
          <MiniMap editor={editor} isVisible={showMiniMap} />

          {/* TEST SONUÇ PANELİ */}
          {testResults && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'white', borderRadius: '12px', padding: '20px', zIndex: 9999,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)', maxHeight: '80vh', overflow: 'auto',
              minWidth: '360px', border: '2px solid #333',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>
                  Test Sonuclari: {testResults.filter(r => r.ok).length}/{testResults.length}
                </h3>
                <button onClick={() => setTestResults(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>X</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <span style={{ background: '#10B981', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>
                  Basarili: {testResults.filter(r => r.ok).length}
                </span>
                <span style={{ background: testResults.some(r => !r.ok) ? '#EF4444' : '#9CA3AF', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>
                  Basarisiz: {testResults.filter(r => !r.ok).length}
                </span>
              </div>
              {testResults.map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0',
                  borderBottom: '1px solid #eee', fontSize: '13px',
                }}>
                  <span style={{ fontSize: '16px' }}>{r.ok ? '\u2705' : '\u274C'}</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{r.name}</span>
                  <span style={{ color: '#666', fontSize: '12px' }}>{r.ok ? `${r.shapes} shape` : r.error}</span>
                </div>
              ))}
            </div>
          )}

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

          {/* Quick Text Bar — canvas alt input */}
          <QuickTextBar editor={editor} />

          {/* Floating Action Bar — secili sekillerin ustunde */}
          <FloatingActionBar editor={editor} />
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
              { title: 'Bicimlendirme', items: [['Ctrl+Shift+]', 'One Getir'], ['Ctrl+Shift+[', 'Arkaya Gonder'], ['Ctrl+]', 'Bir One'], ['Ctrl+[', 'Bir Arkaya'], ['Ctrl+G', 'Grupla'], ['Ctrl+Shift+G', 'Grubu Boz']] },
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
              Mermaid kodu yazin veya orneklerden secin:
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {[
                { key: 'flowchart', label: 'Temel Akis' },
                { key: 'erpSunum', label: 'ERP Modulleri' },
                { key: 'erpSiparis', label: 'ERP Siparis' },
                { key: 'erpUretim', label: 'ERP Uretim' },
                { key: 'database', label: 'Veritabani' },
                { key: 'microservices', label: 'Mikroservis' },
              ].map(ex => (
                <button key={ex.key} onClick={() => setMermaidCode(MERMAID_EXAMPLES[ex.key as keyof typeof MERMAID_EXAMPLES] || '')}
                  style={{ padding: '2px 8px', fontSize: '10px', border: '1px solid #D0D0D0', borderRadius: '3px', background: '#F8F8FF', cursor: 'pointer', color: '#555' }}>
                  {ex.label}
                </button>
              ))}
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

      {/* draw.io Editor */}
      {showDrawio && (
        <DrawioEditorLazy
          onInsert={handleDrawioInsert}
          onClose={() => setShowDrawio(false)}
          initialXml={drawioXml}
        />
      )}
    </div>
  );
}

// Lazy-loaded draw.io editor (büyük iframe)
import dynamic from 'next/dynamic';
const DrawioEditorLazy = dynamic(() => import('./DrawioEditor').then(m => ({ default: m.DrawioEditor })), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'white', fontSize: '18px' }}>draw.io yukleniyor...</div>
    </div>
  ),
});

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
  borderRadius: '6px',
  background: 'white',
  cursor: 'pointer',
  fontSize: '10px',
  color: '#333',
  transition: 'all 0.15s ease',
};

const formatBtnHoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = '#F0F7FF';
  e.currentTarget.style.borderColor = '#93C5FD';
  e.currentTarget.style.transform = 'scale(1.03)';
};
const formatBtnHoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'white';
  e.currentTarget.style.borderColor = '#E0E0E0';
  e.currentTarget.style.transform = 'scale(1)';
};
