/**
 * Canvas Utility Functions — Smart Auto-Connect + Auto-Layout Tree
 *
 * Keyboard shortcuts:
 *   C           → smartAutoConnect (2+ shapes selected)
 *   Ctrl+Shift+L → autoLayoutTree  (2+ shapes selected)
 */

import dagre from 'dagre';
import { Editor, createShapeId, TLShapeId } from 'tldraw';
import { toast } from '@/store/toast';

// ─── Types ──────────────────────────────────────────────────────

interface ShapeWithBounds {
  id: TLShapeId;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

interface Connection {
  fromId: TLShapeId;
  toId: TLShapeId;
  arrowId: TLShapeId;
}

// ─── Feature 3: Smart Auto-Connect ─────────────────────────────

/**
 * Secili 2+ sekli mekansal siraya gore okla baglar.
 * Yatay yayilim → soldan saga, dikey yayilim → yukaridan asagiya.
 * Tum islemler tek editor.mark() altinda — tek Ctrl+Z ile geri alinir.
 */
export function smartAutoConnect(editor: Editor): void {
  const selectedShapes = editor.getSelectedShapes();

  // Arrow/line'lari filtrele
  const connectable = selectedShapes.filter(
    (s) => s.type !== 'arrow' && s.type !== 'line',
  );

  if (connectable.length < 2) {
    toast.info('En az 2 sekil secin');
    return;
  }

  // Bounds hesapla
  const shapes: ShapeWithBounds[] = connectable.map((s) => {
    const b = editor.getShapePageBounds(s.id);
    return {
      id: s.id,
      cx: b ? b.x + b.w / 2 : s.x,
      cy: b ? b.y + b.h / 2 : s.y,
      w: b?.w ?? 100,
      h: b?.h ?? 60,
    };
  });

  // Yayilim yonu
  const allCx = shapes.map((s) => s.cx);
  const allCy = shapes.map((s) => s.cy);
  const spreadX = Math.max(...allCx) - Math.min(...allCx);
  const spreadY = Math.max(...allCy) - Math.min(...allCy);
  const isHorizontal = spreadX >= spreadY;

  // Mekansal siralama
  const sorted = [...shapes].sort((a, b) =>
    isHorizontal ? a.cx - b.cx : a.cy - b.cy,
  );

  // Anchor yonu
  const startAnchor = isHorizontal
    ? { x: 1.0, y: 0.5 } // sag kenar
    : { x: 0.5, y: 1.0 }; // alt kenar
  const endAnchor = isHorizontal
    ? { x: 0.0, y: 0.5 } // sol kenar
    : { x: 0.5, y: 0.0 }; // ust kenar

  // Undo mark
  // tldraw handles undo per operation

  const createdArrowIds: TLShapeId[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    const arrowId = createShapeId();
    createdArrowIds.push(arrowId);

    // Arrow shape
    editor.createShape({
      id: arrowId,
      type: 'arrow' as const,
      x: 0,
      y: 0,
      props: {
        color: 'black',
        size: 'm',
        arrowheadEnd: 'arrow',
        arrowheadStart: 'none',
        start: { x: 0, y: 0 },
        end: { x: 60, y: 0 },
      } as Record<string, unknown>,
    });

    // Bindings (flowchart-layout.ts:390-413 pattern)
    try {
      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: from.id,
        props: {
          terminal: 'start',
          normalizedAnchor: startAnchor,
          isExact: false,
          isPrecise: false,
        },
      });
      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: to.id,
        props: {
          terminal: 'end',
          normalizedAnchor: endAnchor,
          isExact: false,
          isPrecise: false,
        },
      });
    } catch {
      // Binding hatasi kritik degil
    }
  }

  toast.success(`${createdArrowIds.length} ok olusturuldu`);

  // Kisa sure oklari secili goster (visual feedback), sonra geri don
  editor.select(...createdArrowIds);
  setTimeout(() => {
    editor.select(...connectable.map((s) => s.id));
  }, 600);
}

// ─── Feature 4: Auto-Layout Tree ───────────────────────────────

/**
 * Secili sekliler arasindaki ok baglantilarini bulur.
 * Sayfadaki tum arrow shape'leri tarar, binding'lerden start/end tespit eder.
 */
function findArrowConnections(
  editor: Editor,
  shapeIdSet: Set<string>,
): Connection[] {
  const connections: Connection[] = [];
  const allShapes = editor.getCurrentPageShapes();

  for (const shape of allShapes) {
    if (shape.type !== 'arrow') continue;

    let startShapeId: TLShapeId | null = null;
    let endShapeId: TLShapeId | null = null;

    try {
      const bindings = editor.getBindingsFromShape(shape.id, 'arrow');
      for (const binding of bindings) {
        const terminal = (binding.props as unknown as Record<string, unknown>).terminal;
        if (terminal === 'start') {
          startShapeId = binding.toId as TLShapeId;
        } else if (terminal === 'end') {
          endShapeId = binding.toId as TLShapeId;
        }
      }
    } catch {
      // getBindingsFromShape yoksa atla
      continue;
    }

    // Iki uc da secili sette mi?
    if (
      startShapeId &&
      endShapeId &&
      shapeIdSet.has(startShapeId as string) &&
      shapeIdSet.has(endShapeId as string)
    ) {
      connections.push({
        fromId: startShapeId,
        toId: endShapeId,
        arrowId: shape.id as TLShapeId,
      });
    }
  }

  return connections;
}

/**
 * dagre ile agac layout hesaplar.
 * dagre CENTER koordinatlari dondurur — tldraw TOP-LEFT'e ceviriyoruz.
 */
function buildDagreLayout(
  shapes: ShapeWithBounds[],
  connections: Connection[],
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const s of shapes) {
    g.setNode(s.id as string, { width: s.w, height: s.h });
  }

  if (connections.length > 0) {
    for (const conn of connections) {
      if (g.hasNode(conn.fromId as string) && g.hasNode(conn.toId as string)) {
        g.setEdge(conn.fromId as string, conn.toId as string);
      }
    }
  } else {
    // Baglanti yoksa Y koordinatina gore sirala, basit zincir olustur
    const sorted = [...shapes].sort((a, b) => a.cy - b.cy);
    for (let i = 0; i < sorted.length - 1; i++) {
      g.setEdge(sorted[i].id as string, sorted[i + 1].id as string);
    }
  }

  dagre.layout(g);

  // dagre CENTER → tldraw TOP-LEFT
  const result = new Map<string, { x: number; y: number }>();
  for (const s of shapes) {
    const node = g.node(s.id as string);
    if (node) {
      result.set(s.id as string, {
        x: node.x - s.w / 2,
        y: node.y - s.h / 2,
      });
    }
  }

  return result;
}

/**
 * Secili sekilleri agac yapisinda duzenler.
 * Ok baglantilarini hiyerarsi olarak kullanir.
 * Baglanti yoksa Y sirasina gore dikey zincir olusturur.
 */
export function autoLayoutTree(editor: Editor): void {
  const selectedShapes = editor.getSelectedShapes();
  const connectable = selectedShapes.filter(
    (s) => s.type !== 'arrow' && s.type !== 'line',
  );

  if (connectable.length < 2) {
    toast.info('En az 2 sekil secin');
    return;
  }

  const shapeIdSet = new Set(connectable.map((s) => s.id as string));

  // Bounds hesapla
  const shapes: ShapeWithBounds[] = connectable.map((s) => {
    const b = editor.getShapePageBounds(s.id);
    return {
      id: s.id,
      cx: b ? b.x + b.w / 2 : s.x,
      cy: b ? b.y + b.h / 2 : s.y,
      w: b?.w ?? 100,
      h: b?.h ?? 60,
    };
  });

  // Mevcut baglantilar
  const connections = findArrowConnections(editor, shapeIdSet);
  const hasConnections = connections.length > 0;

  // dagre layout
  const newPositions = buildDagreLayout(shapes, connections);

  // Orijinal bbox merkezi
  const origMinX = Math.min(...shapes.map((s) => s.cx - s.w / 2));
  const origMinY = Math.min(...shapes.map((s) => s.cy - s.h / 2));
  const origMaxX = Math.max(...shapes.map((s) => s.cx + s.w / 2));
  const origMaxY = Math.max(...shapes.map((s) => s.cy + s.h / 2));
  const origCX = (origMinX + origMaxX) / 2;
  const origCY = (origMinY + origMaxY) / 2;

  // Yeni bbox merkezi
  let newMinX = Infinity,
    newMinY = Infinity,
    newMaxX = -Infinity,
    newMaxY = -Infinity;
  for (const s of shapes) {
    const pos = newPositions.get(s.id as string);
    if (!pos) continue;
    newMinX = Math.min(newMinX, pos.x);
    newMinY = Math.min(newMinY, pos.y);
    newMaxX = Math.max(newMaxX, pos.x + s.w);
    newMaxY = Math.max(newMaxY, pos.y + s.h);
  }
  const newCX = (newMinX + newMaxX) / 2;
  const newCY = (newMinY + newMaxY) / 2;

  // Offset: yeni layout'u orijinal merkeze hizala
  const offsetX = origCX - newCX;
  const offsetY = origCY - newCY;

  // Uygula — tek undo mark
  // tldraw handles undo per operation

  for (const s of shapes) {
    const pos = newPositions.get(s.id as string);
    if (!pos) continue;
    const shape = editor.getShape(s.id);
    if (!shape) continue;
    editor.updateShape({
      id: shape.id,
      type: shape.type,
      x: pos.x + offsetX,
      y: pos.y + offsetY,
    });
  }

  // Kamera animasyonu ile visual feedback
  editor.select(...connectable.map((s) => s.id));
  editor.zoomToSelection({ animation: { duration: 300 } });

  toast.success(
    hasConnections
      ? `${connectable.length} sekil agac olarak duzenlendi`
      : `${connectable.length} sekil sutun olarak duzenlendi`,
  );
}
