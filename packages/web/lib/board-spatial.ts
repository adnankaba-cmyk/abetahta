/**
 * Board Spatial Analysis — Tahta mekansal farkindalik modulu.
 *
 * AI'a tahtanin bos/dolu bolgelerini, yogunluk haritasini ve
 * istatistiklerini kompakt formatta sunar.
 *
 * Kullanim: AI yeni icerik yerlestirirken cakisma olmayan
 * en uygun bolgeyi secebilir.
 */

import { Editor, TLShape } from 'tldraw';

// ─── Types ──────────────────────────────────────────────────────

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OccupiedRegion extends BoundingBox {
  shapeId: string;
  type: string;
  label?: string;
}

export interface EmptyRegion extends BoundingBox {
  area: number;
  /** Icerik merkezine gore semantik konum */
  position: 'above' | 'below' | 'left' | 'right' | 'center';
}

export interface BoardSpatialMap {
  /** Tum sekilleri kapsayan en kucuk dikdortgen */
  contentBounds: BoundingBox | null;
  /** Gorunen alan */
  viewport: BoundingBox;
  /** En buyuk 5 bos bolge (buyukten kucuge) */
  emptyRegions: EmptyRegion[];
  /** Mevcut sekil sinirlari (max 50) */
  occupiedRegions: OccupiedRegion[];
  /** Istatistikler */
  stats: {
    totalShapes: number;
    coveragePercent: number;
    averageGap: number;
    byType: Record<string, number>;
  };
}

/** ProseMirror richText doc'tan plain text cikarir */
function extractRichTextPlain(richText: unknown): string | undefined {
  if (!richText || typeof richText !== 'object') return undefined;
  const doc = richText as { type?: string; content?: Array<{ content?: Array<{ text?: string }> }> };
  if (doc.type !== 'doc' || !doc.content) return undefined;
  const texts: string[] = [];
  for (const para of doc.content) {
    if (para.content) {
      for (const node of para.content) {
        if (node.text) texts.push(node.text);
      }
    }
  }
  return texts.length > 0 ? texts.join(' ') : undefined;
}

// ─── Spatial Analysis ───────────────────────────────────────────

/**
 * Editor'dan mekansal analiz haritasi olusturur.
 */
export function buildSpatialMap(editor: Editor): BoardSpatialMap {
  const allShapes = editor.getCurrentPageShapes();
  const viewport = getViewportBounds(editor);

  if (allShapes.length === 0) {
    return {
      contentBounds: null,
      viewport,
      emptyRegions: [{
        x: viewport.x,
        y: viewport.y,
        w: viewport.w,
        h: viewport.h,
        area: viewport.w * viewport.h,
        position: 'center',
      }],
      occupiedRegions: [],
      stats: { totalShapes: 0, coveragePercent: 0, averageGap: 0, byType: {} },
    };
  }

  // 1. Occupied regions (max 200 for performance)
  const occupiedRegions = collectOccupiedRegions(editor, allShapes.slice(0, 200));

  // 2. Content bounds
  const contentBounds = computeContentBounds(occupiedRegions);

  // 3. Work area (viewport + content + margin)
  const workArea = computeWorkArea(viewport, contentBounds);

  // 4. Density grid (10x10)
  const GRID_COLS = 10;
  const GRID_ROWS = 10;
  const cellW = workArea.w / GRID_COLS;
  const cellH = workArea.h / GRID_ROWS;
  const grid = buildDensityGrid(occupiedRegions, workArea, GRID_COLS, GRID_ROWS, cellW, cellH);

  // 5. Empty regions from grid
  const emptyRegions = findEmptyRegions(grid, workArea, GRID_COLS, GRID_ROWS, cellW, cellH, contentBounds);

  // 6. Stats
  const stats = computeStats(allShapes, occupiedRegions, viewport, contentBounds);

  return {
    contentBounds,
    viewport,
    emptyRegions: emptyRegions.slice(0, 5),
    occupiedRegions: occupiedRegions.slice(0, 50),
    stats,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function getViewportBounds(editor: Editor): BoundingBox {
  const vb = editor.getViewportScreenBounds();
  const tl = editor.screenToPage({ x: vb.x, y: vb.y });
  const br = editor.screenToPage({ x: vb.x + vb.w, y: vb.y + vb.h });
  return {
    x: Math.round(tl.x),
    y: Math.round(tl.y),
    w: Math.round(br.x - tl.x),
    h: Math.round(br.y - tl.y),
  };
}

function collectOccupiedRegions(editor: Editor, shapes: TLShape[]): OccupiedRegion[] {
  const regions: OccupiedRegion[] = [];
  for (const s of shapes) {
    const bounds = editor.getShapePageBounds(s.id);
    if (!bounds) continue;

    const props = s.props as Record<string, any>;
    const text = typeof props.text === 'string'
      ? props.text
      : extractRichTextPlain(props.richText || props.text);

    regions.push({
      shapeId: s.id,
      type: s.type + (props.geo ? ':' + props.geo : ''),
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      w: Math.round(bounds.w),
      h: Math.round(bounds.h),
      label: text ? String(text).slice(0, 30) : undefined,
    });
  }
  return regions;
}

function computeContentBounds(regions: OccupiedRegion[]): BoundingBox | null {
  if (regions.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of regions) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function computeWorkArea(viewport: BoundingBox, content: BoundingBox | null): BoundingBox {
  const MARGIN = 500;
  if (!content) {
    return {
      x: viewport.x - MARGIN,
      y: viewport.y - MARGIN,
      w: viewport.w + MARGIN * 2,
      h: viewport.h + MARGIN * 2,
    };
  }
  const minX = Math.min(viewport.x, content.x) - MARGIN;
  const minY = Math.min(viewport.y, content.y) - MARGIN;
  const maxX = Math.max(viewport.x + viewport.w, content.x + content.w) + MARGIN;
  const maxY = Math.max(viewport.y + viewport.h, content.y + content.h) + MARGIN;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function buildDensityGrid(
  regions: OccupiedRegion[],
  workArea: BoundingBox,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
): number[][] {
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (const r of regions) {
    const colStart = Math.max(0, Math.floor((r.x - workArea.x) / cellW));
    const colEnd = Math.min(cols - 1, Math.floor((r.x + r.w - workArea.x) / cellW));
    const rowStart = Math.max(0, Math.floor((r.y - workArea.y) / cellH));
    const rowEnd = Math.min(rows - 1, Math.floor((r.y + r.h - workArea.y) / cellH));

    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        grid[row][col]++;
      }
    }
  }

  return grid;
}

function findEmptyRegions(
  grid: number[][],
  workArea: BoundingBox,
  cols: number,
  rows: number,
  cellW: number,
  cellH: number,
  contentBounds: BoundingBox | null,
): EmptyRegion[] {
  // Maximal empty rectangle arama (basitlestirilmis greedy)
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const regions: EmptyRegion[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] > 0 || visited[r][c]) continue;

      // Bu hucre bos — en genis dikdortgeni bul
      let maxC = c;
      while (maxC < cols - 1 && grid[r][maxC + 1] === 0 && !visited[r][maxC + 1]) maxC++;

      let maxR = r;
      outer:
      while (maxR < rows - 1) {
        for (let cc = c; cc <= maxC; cc++) {
          if (grid[maxR + 1][cc] > 0 || visited[maxR + 1][cc]) break outer;
        }
        maxR++;
      }

      // Visited isaretle
      for (let rr = r; rr <= maxR; rr++) {
        for (let cc = c; cc <= maxC; cc++) {
          visited[rr][cc] = true;
        }
      }

      const x = Math.round(workArea.x + c * cellW);
      const y = Math.round(workArea.y + r * cellH);
      const w = Math.round((maxC - c + 1) * cellW);
      const h = Math.round((maxR - r + 1) * cellH);
      const area = w * h;

      // Cok kucuk bolgeleri atla
      if (w < 100 || h < 100) continue;

      const position = getSemanticPosition(x, y, w, h, contentBounds);
      regions.push({ x, y, w, h, area, position });
    }
  }

  // Buyukten kucuge sirala
  regions.sort((a, b) => b.area - a.area);
  return regions;
}

function getSemanticPosition(
  x: number, y: number, w: number, h: number,
  contentBounds: BoundingBox | null,
): EmptyRegion['position'] {
  if (!contentBounds) return 'center';

  const regionCenterX = x + w / 2;
  const regionCenterY = y + h / 2;
  const contentCenterX = contentBounds.x + contentBounds.w / 2;
  const contentCenterY = contentBounds.y + contentBounds.h / 2;

  const dx = regionCenterX - contentCenterX;
  const dy = regionCenterY - contentCenterY;

  // Hangi eksen daha baskin?
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'below' : 'above';
  }
}

function computeStats(
  allShapes: TLShape[],
  regions: OccupiedRegion[],
  viewport: BoundingBox,
  contentBounds: BoundingBox | null,
): BoardSpatialMap['stats'] {
  // Tip dagilimi
  const byType: Record<string, number> = {};
  for (const s of allShapes) {
    const key = s.type;
    byType[key] = (byType[key] || 0) + 1;
  }

  // Kaplama orani
  const totalShapeArea = regions.reduce((sum, r) => sum + r.w * r.h, 0);
  const viewportArea = viewport.w * viewport.h;
  const coveragePercent = viewportArea > 0
    ? Math.round((totalShapeArea / viewportArea) * 100)
    : 0;

  // Ortalama mesafe (nearest neighbor)
  let totalGap = 0;
  let gapCount = 0;
  const sampleSize = Math.min(regions.length, 30);
  for (let i = 0; i < sampleSize; i++) {
    let minDist = Infinity;
    for (let j = 0; j < regions.length; j++) {
      if (i === j) continue;
      const dx = Math.max(0, Math.abs((regions[i].x + regions[i].w / 2) - (regions[j].x + regions[j].w / 2)) - (regions[i].w + regions[j].w) / 2);
      const dy = Math.max(0, Math.abs((regions[i].y + regions[i].h / 2) - (regions[j].y + regions[j].h / 2)) - (regions[i].h + regions[j].h) / 2);
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) minDist = dist;
    }
    if (minDist < Infinity) {
      totalGap += minDist;
      gapCount++;
    }
  }

  return {
    totalShapes: allShapes.length,
    coveragePercent: Math.min(coveragePercent, 100),
    averageGap: gapCount > 0 ? Math.round(totalGap / gapCount) : 80,
    byType,
  };
}

// ─── AI Serialization ───────────────────────────────────────────

/**
 * BoardSpatialMap'i AI'a gonderilebilecek kompakt string'e cevirir (~300 token).
 */
export function serializeSpatialForAI(map: BoardSpatialMap): string {
  const lines: string[] = ['[Tahta Mekansal Analizi]'];

  // Viewport
  const v = map.viewport;
  lines.push(`Viewport: ${v.w}x${v.h} (x=${v.x} y=${v.y})`);

  // Content bounds
  if (map.contentBounds) {
    const c = map.contentBounds;
    lines.push(`Icerik Siniri: x=${c.x} y=${c.y} w=${c.w} h=${c.h}`);
  } else {
    lines.push('Tahta bos — icerik yok.');
  }

  // Stats
  const s = map.stats;
  lines.push(`Kaplanis: %${s.coveragePercent} dolu, Ortalama Aralik: ${s.averageGap}px`);

  // Type summary
  const types = Object.entries(s.byType).map(([t, c]) => `${c} ${t}`).join(', ');
  lines.push(`Mevcut: ${s.totalShapes} sekil (${types})`);

  // Empty regions
  if (map.emptyRegions.length > 0) {
    lines.push('');
    lines.push('Bos Bolgeler (buyukten kucuge):');
    for (let i = 0; i < map.emptyRegions.length; i++) {
      const e = map.emptyRegions[i];
      const posLabel = { above: 'ustte', below: 'altta', left: 'solda', right: 'sagda', center: 'merkezde' }[e.position];
      lines.push(`  ${i + 1}) x=${e.x} y=${e.y} ${e.w}x${e.h} [icerik ${posLabel}]`);
    }
  }

  // Top shapes (compact — sadece konum ve label, max 30)
  if (map.occupiedRegions.length > 0) {
    lines.push('');
    lines.push('Mevcut Nesneler:');
    const sample = map.occupiedRegions.slice(0, 30);
    for (const r of sample) {
      let line = `  ${r.shapeId} [${r.type}] x=${r.x} y=${r.y} ${r.w}x${r.h}`;
      if (r.label) line += ` "${r.label}"`;
      lines.push(line);
    }
    if (map.occupiedRegions.length > 30) {
      lines.push(`  ... ve ${map.occupiedRegions.length - 30} sekil daha`);
    }
  }

  return lines.join('\n');
}
