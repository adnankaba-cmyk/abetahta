/**
 * Excalidraw JSON → tldraw shapes importer
 *
 * Excalidraw formatındaki .excalidraw veya .json dosyalarını parse eder.
 * Elements: rectangle, ellipse, diamond, text, arrow, line
 */

import { Editor, createShapeId } from 'tldraw';
import { importLog } from '../logger';

interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;       // text elements
  originalText?: string;
  points?: number[][]; // arrow/line elements
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
}

interface ExcalidrawFile {
  type: 'excalidraw';
  version: number;
  elements: ExcalidrawElement[];
}

function mapExcalidrawColor(color: string): string {
  const colorMap: Record<string, string> = {
    '#1e1e1e': 'black',
    '#e03131': 'red',
    '#2f9e44': 'green',
    '#1971c2': 'blue',
    '#f08c00': 'orange',
    '#6741d9': 'violet',
    '#f783ac': 'red',
    '#868e96': 'grey',
  };
  return colorMap[color?.toLowerCase()] || 'black';
}

function mapExcalidrawGeo(type: string): string {
  switch (type) {
    case 'rectangle': return 'rectangle';
    case 'ellipse': return 'ellipse';
    case 'diamond': return 'diamond';
    default: return 'rectangle';
  }
}

export function importExcalidrawToCanvas(editor: Editor, jsonStr: string): number {
  importLog.info('Excalidraw import basliyor, JSON uzunlugu:', jsonStr.length);
  let data: ExcalidrawFile;
  try {
    data = JSON.parse(jsonStr);
  } catch (err) {
    importLog.error('Excalidraw JSON parse hatasi:', (err as Error).message);
    return 0;
  }

  if (!data.elements || data.elements.length === 0) {
    importLog.warn('Excalidraw: hic element bulunamadi');
    return 0;
  }
  importLog.info('Excalidraw elementleri:', data.elements.length);

  // Viewport center offset
  const viewportBounds = editor.getViewportScreenBounds();
  const viewportCenter = editor.screenToPage({
    x: viewportBounds.x + viewportBounds.w / 2,
    y: viewportBounds.y + viewportBounds.h / 2,
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of data.elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + (el.width || 100));
    maxY = Math.max(maxY, el.y + (el.height || 50));
  }

  const groupW = maxX - minX || 400;
  const groupH = maxY - minY || 300;
  const offsetX = viewportCenter.x - groupW / 2 - minX;
  const offsetY = viewportCenter.y - groupH / 2 - minY;

  const now = new Date().toISOString();
  let created = 0;

  for (const el of data.elements) {
    const id = createShapeId();
    const x = el.x + offsetX;
    const y = el.y + offsetY;
    const color = mapExcalidrawColor(el.strokeColor || '#1e1e1e');

    try {
      switch (el.type) {
        case 'rectangle':
        case 'ellipse':
        case 'diamond': {
          editor.createShape({
            id,
            type: 'geo',
            x,
            y,
            props: {
              geo: mapExcalidrawGeo(el.type),
              w: el.width || 100,
              h: el.height || 60,
              fill: el.fillStyle !== 'solid' ? 'none' : 'solid',
              color,
            } as any,
            meta: { createdAt: now, createdBy: 'import', createdByName: 'Excalidraw Import' },
          });
          created++;
          break;
        }

        case 'text': {
          editor.createShape({
            id,
            type: 'text',
            x,
            y,
            props: {
              text: el.text || el.originalText || '',
              color,
              size: 'm',
            } as any,
            meta: { createdAt: now, createdBy: 'import', createdByName: 'Excalidraw Import' },
          });
          created++;
          break;
        }

        case 'arrow': {
          if (el.points && el.points.length >= 2) {
            const start = el.points[0];
            const end = el.points[el.points.length - 1];
            editor.createShape({
              id,
              type: 'arrow',
              x: x + (start[0] || 0),
              y: y + (start[1] || 0),
              props: {
                start: { x: 0, y: 0 },
                end: { x: (end[0] || 0) - (start[0] || 0), y: (end[1] || 0) - (start[1] || 0) },
                color,
                arrowheadStart: 'none',
                arrowheadEnd: 'arrow',
              } as any,
              meta: { createdAt: now, createdBy: 'import', createdByName: 'Excalidraw Import' },
            });
            created++;
          }
          break;
        }

        case 'line': {
          if (el.points && el.points.length >= 2) {
            const points: Record<string, { id: string; index: string; x: number; y: number }> = {};
            el.points.forEach((pt, idx) => {
              const key = `a${idx + 1}`;
              points[key] = { id: key, index: key, x: pt[0] || 0, y: pt[1] || 0 };
            });
            editor.createShape({
              id,
              type: 'line',
              x,
              y,
              props: { points, color } as any,
              meta: { createdAt: now, createdBy: 'import', createdByName: 'Excalidraw Import' },
            });
            created++;
          }
          break;
        }
      }
    } catch (err) {
      importLog.error('Excalidraw element hatasi:', el.type, (err as Error).message);
    }
  }

  importLog.info('Excalidraw import tamamlandi:', created, 'sekil olustu');
  return created;
}
