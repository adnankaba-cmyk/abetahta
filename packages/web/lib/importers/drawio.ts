/**
 * draw.io XML → tldraw shapes importer
 *
 * draw.io (diagrams.net) XML formatındaki diyagramları parse eder.
 * mxCell elementlerinden vertex (şekil) ve edge (ok) çıkarır.
 */

import { Editor, createShapeId } from 'tldraw';
import { importLog } from '../logger';

interface DrawioCell {
  id: string;
  value: string;
  vertex: boolean;
  edge: boolean;
  source?: string;
  target?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
}

export function parseDrawioXML(xmlStr: string): DrawioCell[] {
  importLog.info('draw.io XML parse basliyor, uzunluk:', xmlStr.length);
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlStr, 'text/xml');
  const cells: DrawioCell[] = [];

  const mxCells = doc.querySelectorAll('mxCell');
  for (const cell of mxCells) {
    const id = cell.getAttribute('id') || '';
    if (id === '0' || id === '1') continue; // Root cells

    const vertex = cell.getAttribute('vertex') === '1';
    const edge = cell.getAttribute('edge') === '1';
    const value = cell.getAttribute('value') || '';
    const style = cell.getAttribute('style') || '';
    const source = cell.getAttribute('source') || undefined;
    const target = cell.getAttribute('target') || undefined;

    let x = 0, y = 0, w = 120, h = 60;
    const geometry = cell.querySelector('mxGeometry');
    if (geometry) {
      x = parseFloat(geometry.getAttribute('x') || '0');
      y = parseFloat(geometry.getAttribute('y') || '0');
      w = parseFloat(geometry.getAttribute('width') || '120');
      h = parseFloat(geometry.getAttribute('height') || '60');
    }

    cells.push({ id, value, vertex, edge, source, target, x, y, w, h, style });
  }

  importLog.info('draw.io parse tamamlandi:', cells.length, 'cell bulundu');
  return cells;
}

function getGeoFromStyle(style: string): string {
  if (style.includes('rhombus')) return 'diamond';
  if (style.includes('ellipse')) return 'ellipse';
  if (style.includes('triangle')) return 'triangle';
  if (style.includes('hexagon')) return 'hexagon';
  if (style.includes('cloud')) return 'cloud';
  return 'rectangle';
}

export function importDrawioToCanvas(editor: Editor, xmlStr: string): number {
  importLog.info('draw.io import basliyor');
  const cells = parseDrawioXML(xmlStr);
  if (cells.length === 0) { importLog.warn('draw.io: hic cell bulunamadi'); return 0; }

  // Viewport center offset
  const viewportBounds = editor.getViewportScreenBounds();
  const viewportCenter = editor.screenToPage({
    x: viewportBounds.x + viewportBounds.w / 2,
    y: viewportBounds.y + viewportBounds.h / 2,
  });

  const vertices = cells.filter(c => c.vertex);
  const edges = cells.filter(c => c.edge);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x + v.w);
    maxY = Math.max(maxY, v.y + v.h);
  }

  const groupW = maxX - minX || 400;
  const groupH = maxY - minY || 300;
  const offsetX = viewportCenter.x - groupW / 2 - minX;
  const offsetY = viewportCenter.y - groupH / 2 - minY;

  const now = new Date().toISOString();
  const cellIdMap = new Map<string, { x: number; y: number; w: number; h: number }>();
  let created = 0;

  // Create vertices
  for (const cell of vertices) {
    const id = createShapeId();
    const geo = getGeoFromStyle(cell.style);

    cellIdMap.set(cell.id, { x: cell.x + offsetX, y: cell.y + offsetY, w: cell.w, h: cell.h });

    // Strip HTML tags from value
    const cleanValue = cell.value.replace(/<[^>]*>/g, '');

    editor.createShape({
      id,
      type: 'geo',
      x: cell.x + offsetX,
      y: cell.y + offsetY,
      props: {
        geo,
        w: cell.w,
        h: cell.h,
        fill: 'solid',
        color: 'black',
        text: cleanValue,
      } as any,
      meta: { createdAt: now, createdBy: 'import', createdByName: 'draw.io Import' },
    });
    created++;
  }

  // Create edges
  for (const edge of edges) {
    const sourcePos = edge.source ? cellIdMap.get(edge.source) : null;
    const targetPos = edge.target ? cellIdMap.get(edge.target) : null;
    if (!sourcePos || !targetPos) continue;

    const id = createShapeId();
    const sx = sourcePos.x + sourcePos.w / 2;
    const sy = sourcePos.y + sourcePos.h;
    const tx = targetPos.x + targetPos.w / 2;
    const ty = targetPos.y;

    editor.createShape({
      id,
      type: 'arrow',
      x: sx,
      y: sy,
      props: {
        start: { x: 0, y: 0 },
        end: { x: tx - sx, y: ty - sy },
        color: 'black',
        arrowheadStart: 'none',
        arrowheadEnd: 'arrow',
      } as any,
      meta: { createdAt: now, createdBy: 'import', createdByName: 'draw.io Import' },
    });
    created++;
  }

  importLog.info('draw.io import tamamlandi:', created, 'sekil olustu');
  return created;
}
