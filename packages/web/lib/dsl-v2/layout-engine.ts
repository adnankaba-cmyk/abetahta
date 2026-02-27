/**
 * DSL v2 Layout Engine — SATIR/SUTUN/GRID/AKIS hesaplamalari.
 */

import { Editor, createShapeId, TLShapeId } from 'tldraw';

interface ShapeSize {
  id: TLShapeId;
  w: number;
  h: number;
}

/**
 * SATIR: Yatay dizilim, dikey ortalama.
 */
export function layoutRow(
  shapes: ShapeSize[],
  startX: number,
  startY: number,
  gap: number,
): Array<{ x: number; y: number }> {
  if (shapes.length === 0) return [];

  const maxH = Math.max(...shapes.map(s => s.h));
  const positions: Array<{ x: number; y: number }> = [];
  let currentX = startX;

  for (const s of shapes) {
    // Dikey ortalama
    const y = startY + (maxH - s.h) / 2;
    positions.push({ x: currentX, y });
    currentX += s.w + gap;
  }

  return positions;
}

/**
 * SUTUN: Dikey dizilim, yatay ortalama.
 */
export function layoutColumn(
  shapes: ShapeSize[],
  startX: number,
  startY: number,
  gap: number,
): Array<{ x: number; y: number }> {
  if (shapes.length === 0) return [];

  const maxW = Math.max(...shapes.map(s => s.w));
  const positions: Array<{ x: number; y: number }> = [];
  let currentY = startY;

  for (const s of shapes) {
    // Yatay ortalama
    const x = startX + (maxW - s.w) / 2;
    positions.push({ x, y: currentY });
    currentY += s.h + gap;
  }

  return positions;
}

/**
 * GRID: Izgara dizilimi.
 */
export function layoutGrid(
  shapes: ShapeSize[],
  startX: number,
  startY: number,
  columns: number,
  gap: number,
): Array<{ x: number; y: number }> {
  if (shapes.length === 0) return [];

  // Her sutunun en genis elemani + her satirin en yuksek elemani
  const colWidths: number[] = Array(columns).fill(0);
  const rowHeights: number[] = [];

  for (let i = 0; i < shapes.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    colWidths[col] = Math.max(colWidths[col], shapes[i].w);
    if (!rowHeights[row]) rowHeights[row] = 0;
    rowHeights[row] = Math.max(rowHeights[row], shapes[i].h);
  }

  const positions: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < shapes.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);

    // X: onceki sutunlarin toplam genisligi + gap
    let x = startX;
    for (let c = 0; c < col; c++) x += colWidths[c] + gap;
    // Sutun icinde ortalama
    x += (colWidths[col] - shapes[i].w) / 2;

    // Y: onceki satirlarin toplam yuksekligi + gap
    let y = startY;
    for (let r = 0; r < row; r++) y += rowHeights[r] + gap;
    // Satir icinde ortalama
    y += (rowHeights[row] - shapes[i].h) / 2;

    positions.push({ x, y });
  }

  return positions;
}

/**
 * AKIS: Akis dizilimi + otomatik ok olusturma.
 */
export function layoutFlow(
  shapes: ShapeSize[],
  startX: number,
  startY: number,
  direction: 'LR' | 'TB',
  gap: number,
  editor: Editor,
): Array<{ x: number; y: number }> {
  // Once layout hesapla
  const positions = direction === 'LR'
    ? layoutRow(shapes, startX, startY, gap + 40) // Ok icin ekstra bosluk
    : layoutColumn(shapes, startX, startY, gap + 40);

  // Ardindan ardisik shape'ler arasi ok olustur
  for (let i = 0; i < shapes.length - 1; i++) {
    const fromId = shapes[i].id;
    const toId = shapes[i + 1].id;
    const arrowId = createShapeId();

    const from = positions[i];
    const to = positions[i + 1];

    const startPt = direction === 'LR'
      ? { x: from.x + shapes[i].w, y: from.y + shapes[i].h / 2 }
      : { x: from.x + shapes[i].w / 2, y: from.y + shapes[i].h };

    const endPt = direction === 'LR'
      ? { x: to.x, y: to.y + shapes[i + 1].h / 2 }
      : { x: to.x + shapes[i + 1].w / 2, y: to.y };

    editor.createShape({
      id: arrowId,
      type: 'arrow',
      x: startPt.x,
      y: startPt.y,
      props: {
        start: { x: 0, y: 0 },
        end: { x: endPt.x - startPt.x, y: endPt.y - startPt.y },
        color: 'black',
        dash: 'solid',
        size: 's',
      } as any,
      meta: { createdBy: 'ai-dsl-v2-flow' },
    });

    // Binding
    try {
      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: fromId,
        props: { terminal: 'start', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false },
      });
      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: toId,
        props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false },
      });
    } catch {
      // Binding hatasi kritik degil
    }
  }

  return positions;
}
