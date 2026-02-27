/**
 * DSL v2 Executor — AST node'larini tldraw shape'lere cevirir.
 *
 * 2-pasli calisir:
 *  1. Normal node'lari olustur (SHAPE, NOTE, TEXT, IMAGE, FRAME, LINE)
 *  2. Referans gerektiren node'lari olustur (ARROW, GROUP)
 *
 * RELATIVE node'lar bir position context olusturur,
 * sonraki shape node'u bu context ile konumlanir.
 */

import {
  Editor, createShapeId, TLShapeId, TLGeoShape, AssetRecordType,
} from 'tldraw';
import { toRichText } from '@tldraw/editor';
import type { AstNode, DslProps, DslExecutionResult, LayoutNode } from './types';
import { ShapeRegistry, PositionContext, resolveRelativePosition } from './resolver';
import { layoutRow, layoutColumn, layoutGrid, layoutFlow } from './layout-engine';
import type { TldrawColor, TldrawFill, TldrawDash, TldrawSize, TldrawFont } from '../shape-themes';

/** AI prompt'unda \\n literal olarak yaziliyor — gercek newline'a cevir */
function unescapeText(text: string): string {
  return text.replace(/\\n/g, '\n');
}

/** URL veya data URI'den resim mime type algila */
function detectImageMime(url: string): string {
  if (url.startsWith('data:')) {
    const m = url.match(/^data:(image\/[^;]+)/);
    return m ? m[1] : 'image/png';
  }
  const lower = url.toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

// ─── Color/Prop Defaults ────────────────────────────────────

const DEFAULT_COLOR: TldrawColor = 'black';
const DEFAULT_FILL: TldrawFill = 'solid';
const DEFAULT_DASH: TldrawDash = 'draw';
const DEFAULT_SIZE: TldrawSize = 'm';
const DEFAULT_FONT: TldrawFont = 'sans';

/** tldraw'in kabul ettigi renk degerleri */
const VALID_COLORS = new Set<string>([
  'black', 'grey', 'light-violet', 'violet', 'blue', 'light-blue',
  'yellow', 'orange', 'green', 'light-green', 'light-red', 'red', 'white',
]);

/** Turkce/gecersiz renkleri tldraw rengine cevir, gecersizse fallback don */
function safeColor(raw: string | undefined, fallback: TldrawColor = DEFAULT_COLOR): TldrawColor {
  if (!raw) return fallback;
  const c = raw.toLowerCase().trim();
  if (VALID_COLORS.has(c)) return c as TldrawColor;
  // Turkce alias'lar
  const aliases: Record<string, TldrawColor> = {
    kirmizi: 'red', 'kırmızı': 'red',
    mavi: 'blue', yesil: 'green', 'yeşil': 'green',
    sari: 'yellow', 'sarı': 'yellow',
    turuncu: 'orange', mor: 'violet',
    siyah: 'black', gri: 'grey', beyaz: 'white',
    'acik-mavi': 'light-blue', 'acik-yesil': 'light-green',
    'acik-kirmizi': 'light-red', 'acik-mor': 'light-violet',
    // common invalid → nearest valid
    'light-orange': 'orange', 'light-yellow': 'yellow',
    'dark-blue': 'blue', 'dark-green': 'green', 'dark-red': 'red',
    'pink': 'light-red', 'purple': 'violet', 'cyan': 'light-blue',
    'brown': 'orange', 'teal': 'green',
  };
  return aliases[c] || fallback;
}

// ─── Main Executor ──────────────────────────────────────────

export function executeDslV2Ast(
  editor: Editor,
  nodes: AstNode[],
  anchorPoint?: { x: number; y: number },
): DslExecutionResult {
  const registry = new ShapeRegistry();
  const errors: string[] = [];
  let shapeCount = 0;

  // Offset: anchor point'e gore kaydirma
  const ox = anchorPoint?.x || 0;
  const oy = anchorPoint?.y || 0;

  // Position context (ALTINA/YANINA/USTUNE)
  let posCtx: PositionContext | null = null;

  for (const node of nodes) {
    try {
      switch (node.kind) {
        case 'RELATIVE': {
          posCtx = { direction: node.direction, refName: node.refName, offset: node.offset };
          break;
        }

        case 'SHAPE': {
          let x = node.x + ox;
          let y = node.y + oy;
          if (posCtx) {
            const resolved = resolveRelativePosition(posCtx, registry, node.w, node.h);
            if (resolved) {
              x = resolved.x;
              y = resolved.y;
            } else {
              // Referans bulunamadiysa: son shape'in altina yerlestir
              const lastShape = registry.getLast();
              if (lastShape) {
                x = lastShape.x;
                y = lastShape.y + lastShape.h + (posCtx.offset || 40);
              }
            }
            posCtx = null;
          }

          const id = createShapeId();
          editor.createShape<TLGeoShape>({
            id,
            type: 'geo',
            x, y,
            props: {
              geo: node.geo,
              w: node.w,
              h: node.h,
              color: safeColor(node.props.renk),
              fill: node.props.dolgu || DEFAULT_FILL,
              dash: node.props.cizgi || DEFAULT_DASH,
              size: node.props.boyut || DEFAULT_SIZE,
              font: node.props.font || DEFAULT_FONT,
              richText: toRichText(unescapeText(node.text)),
            } as any,
            meta: { createdBy: 'ai-dsl-v2' },
          });

          if (node.props.donme) {
            editor.updateShape({ id, type: 'geo', rotation: (node.props.donme * Math.PI) / 180 });
          }
          if (node.props.saydamlik !== undefined) {
            editor.updateShape({ id, type: 'geo', opacity: node.props.saydamlik });
          }

          registry.register(node.name, { id, name: node.name, x, y, w: node.w, h: node.h });
          shapeCount++;
          break;
        }

        case 'NOTE': {
          let x = node.x + ox;
          let y = node.y + oy;
          if (posCtx) {
            const resolved = resolveRelativePosition(posCtx, registry, 200, 200);
            if (resolved) {
              x = resolved.x;
              y = resolved.y;
            } else {
              const lastShape = registry.getLast();
              if (lastShape) {
                x = lastShape.x;
                y = lastShape.y + lastShape.h + (posCtx.offset || 40);
              }
            }
            posCtx = null;
          }

          const id = createShapeId();
          editor.createShape({
            id,
            type: 'note',
            x, y,
            props: {
              color: safeColor(node.props.renk, 'yellow'),
              size: node.props.boyut || DEFAULT_SIZE,
              font: node.props.font || DEFAULT_FONT,
              richText: toRichText(unescapeText(node.text)),
            } as any,
            meta: { createdBy: 'ai-dsl-v2' },
          });

          // NOT shape boyutu: tldraw'da note varsayilan ~200x200
          registry.register(node.name, { id, name: node.name, x, y, w: 200, h: 200 });
          shapeCount++;
          break;
        }

        case 'TEXT': {
          let x = node.x + ox;
          let y = node.y + oy;
          if (posCtx) {
            const resolved = resolveRelativePosition(posCtx, registry, 200, 40);
            if (resolved) {
              x = resolved.x;
              y = resolved.y;
            } else {
              const lastShape = registry.getLast();
              if (lastShape) {
                x = lastShape.x;
                y = lastShape.y + lastShape.h + (posCtx.offset || 40);
              }
            }
            posCtx = null;
          }

          const id = createShapeId();
          editor.createShape({
            id,
            type: 'text',
            x, y,
            props: {
              color: safeColor(node.props.renk),
              size: node.props.boyut || 'l',
              font: node.props.font || DEFAULT_FONT,
              richText: toRichText(unescapeText(node.text)),
            } as any,
            meta: { createdBy: 'ai-dsl-v2' },
          });

          // TEXT shape boyutu: tahmini
          registry.register(node.name, { id, name: node.name, x, y, w: 300, h: 40 });
          shapeCount++;
          break;
        }

        case 'IMAGE': {
          let x = node.x + ox;
          let y = node.y + oy;
          if (posCtx) {
            const resolved = resolveRelativePosition(posCtx, registry, node.w, node.h);
            if (resolved) {
              x = resolved.x;
              y = resolved.y;
            } else {
              const lastShape = registry.getLast();
              if (lastShape) {
                x = lastShape.x;
                y = lastShape.y + lastShape.h + (posCtx.offset || 40);
              }
            }
            posCtx = null;
          }

          const id = createShapeId();
          const assetId = AssetRecordType.createId();

          // Asset olustur — URL'den mime type algila
          const mimeType = detectImageMime(node.url);
          editor.createAssets([{
            id: assetId,
            type: 'image',
            typeName: 'asset',
            props: {
              name: node.name + (mimeType === 'image/svg+xml' ? '.svg' : '.png'),
              src: node.url,
              w: node.w,
              h: node.h,
              mimeType,
              isAnimated: mimeType === 'image/gif',
            },
            meta: {},
          }]);

          editor.createShape({
            id,
            type: 'image',
            x, y,
            props: { assetId, w: node.w, h: node.h },
            meta: { createdBy: 'ai-dsl-v2' },
          });

          registry.register(node.name, { id, name: node.name, x, y, w: node.w, h: node.h });
          shapeCount++;
          break;
        }

        case 'FRAME': {
          let x = node.x + ox;
          let y = node.y + oy;
          if (posCtx) {
            const resolved = resolveRelativePosition(posCtx, registry, node.w, node.h);
            if (resolved) {
              x = resolved.x;
              y = resolved.y;
            } else {
              const lastShape = registry.getLast();
              if (lastShape) {
                x = lastShape.x;
                y = lastShape.y + lastShape.h + (posCtx.offset || 40);
              }
            }
            posCtx = null;
          }

          const id = createShapeId();
          editor.createShape({
            id,
            type: 'frame',
            x, y,
            props: { w: node.w, h: node.h, name: node.title },
            meta: { createdBy: 'ai-dsl-v2' },
          });

          registry.register(node.name, { id, name: node.name, x, y, w: node.w, h: node.h });
          shapeCount++;
          break;
        }

        case 'LINE': {
          const id = createShapeId();
          const x1 = node.x1 + ox;
          const y1 = node.y1 + oy;
          const x2 = node.x2 + ox;
          const y2 = node.y2 + oy;

          editor.createShape({
            id,
            type: 'line',
            x: x1, y: y1,
            props: {
              color: safeColor(node.props.renk),
              dash: node.props.cizgi || DEFAULT_DASH,
              size: node.props.boyut || DEFAULT_SIZE,
              points: {
                a1: { id: 'a1', index: 'a1' as any, x: 0, y: 0 },
                a2: { id: 'a2', index: 'a2' as any, x: x2 - x1, y: y2 - y1 },
              },
            } as any,
            meta: { createdBy: 'ai-dsl-v2' },
          });

          registry.register(node.name, { id, name: node.name, x: x1, y: y1, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
          shapeCount++;
          break;
        }

        case 'ARROW': {
          const fromShape = registry.get(node.fromName);
          const toShape = registry.get(node.toName);

          const id = createShapeId();

          if (fromShape && toShape) {
            // Binding ile ok olustur
            const startX = fromShape.x + fromShape.w / 2;
            const startY = fromShape.y + fromShape.h / 2;
            const endX = toShape.x + toShape.w / 2;
            const endY = toShape.y + toShape.h / 2;

            editor.createShape({
              id,
              type: 'arrow',
              x: startX, y: startY,
              props: {
                color: safeColor(node.props.renk),
                dash: node.props.cizgi || DEFAULT_DASH,
                size: node.props.boyut || DEFAULT_SIZE,
                start: { x: 0, y: 0 },
                end: { x: endX - startX, y: endY - startY },
                richText: node.label ? toRichText(unescapeText(node.label)) : toRichText(''),
              } as any,
              meta: { createdBy: 'ai-dsl-v2' },
            });

            // Binding olustur
            try {
              editor.createBinding({
                type: 'arrow',
                fromId: id,
                toId: fromShape.id,
                props: {
                  terminal: 'start',
                  normalizedAnchor: { x: 0.5, y: 0.5 },
                  isExact: false,
                  isPrecise: false,
                },
              });
              editor.createBinding({
                type: 'arrow',
                fromId: id,
                toId: toShape.id,
                props: {
                  terminal: 'end',
                  normalizedAnchor: { x: 0.5, y: 0.5 },
                  isExact: false,
                  isPrecise: false,
                },
              });
            } catch {
              // Binding hatasi kritik degil
            }
          } else {
            // Referans bulunamadiysa basit ok ciz
            editor.createShape({
              id,
              type: 'arrow',
              x: ox, y: oy,
              props: {
                color: safeColor(node.props.renk),
                dash: node.props.cizgi || DEFAULT_DASH,
                start: { x: 0, y: 0 },
                end: { x: 200, y: 0 },
                richText: node.label ? toRichText(unescapeText(node.label)) : toRichText(''),
              } as any,
              meta: { createdBy: 'ai-dsl-v2' },
            });
            if (!fromShape) errors.push(`BAG: kaynak '${node.fromName}' bulunamadi`);
            if (!toShape) errors.push(`BAG: hedef '${node.toName}' bulunamadi`);
          }

          registry.register(node.name, { id, name: node.name, x: 0, y: 0, w: 0, h: 0 });
          shapeCount++;
          break;
        }

        case 'GROUP': {
          const shapes = registry.getByNames(node.names);
          if (shapes.length >= 2) {
            editor.groupShapes(shapes.map(s => s.id));
          } else {
            errors.push(`GRUPLA: en az 2 gecerli isim gerekli, bulunan: ${shapes.length}`);
          }
          break;
        }

        case 'LAYOUT': {
          let layoutX = node.x + ox;
          let layoutY = node.y + oy;
          if (posCtx) {
            const resolved = resolveRelativePosition(posCtx, registry, 500, 200);
            if (resolved) { layoutX = resolved.x; layoutY = resolved.y; }
            posCtx = null;
          }

          // Layout children'i once olustur (gecici konumlarla, anchor ile)
          const childResult = executeDslV2Ast(editor, node.children, { x: layoutX, y: layoutY });
          shapeCount += childResult.shapeCount;
          errors.push(...childResult.errors);

          // Child executor'un olusturdugu shape ID'lerini kullan (daha guvenilir)
          const childIds = (childResult.createdShapeIds || [])
            .map(sid => sid as TLShapeId);

          // Fallback: createdShapeIds yoksa son N shape'i al
          const targetIds = childIds.length > 0
            ? childIds
            : Array.from(editor.getCurrentPageShapeIds()).slice(-childResult.shapeCount);

          const recentShapes = targetIds
            .map(id => {
              const shape = editor.getShape(id);
              if (!shape) return null;
              const bounds = editor.getShapePageBounds(id);
              return bounds ? { id, w: bounds.w, h: bounds.h } : null;
            })
            .filter((s): s is { id: TLShapeId; w: number; h: number } => s !== null);

          if (recentShapes.length > 0) {
            let positions: Array<{ x: number; y: number }>;

            switch (node.layoutType) {
              case 'ROW':
                positions = layoutRow(recentShapes, layoutX, layoutY, node.gap);
                break;
              case 'COLUMN':
                positions = layoutColumn(recentShapes, layoutX, layoutY, node.gap);
                break;
              case 'GRID':
                positions = layoutGrid(recentShapes, layoutX, layoutY, node.columns || 3, node.gap);
                break;
              case 'FLOW':
                positions = layoutFlow(recentShapes, layoutX, layoutY, node.direction || 'LR', node.gap, editor);
                break;
              default:
                positions = layoutRow(recentShapes, layoutX, layoutY, node.gap);
            }

            // Shape'leri yeniden konumla
            for (let j = 0; j < recentShapes.length && j < positions.length; j++) {
              const shape = editor.getShape(recentShapes[j].id);
              if (shape) {
                editor.updateShape({
                  id: shape.id,
                  type: shape.type,
                  x: positions[j].x,
                  y: positions[j].y,
                });
              }
            }

            // Layout children'i registry'ye kaydet
            for (let j = 0; j < node.children.length && j < recentShapes.length; j++) {
              const child = node.children[j];
              if ('name' in child && typeof child.name === 'string') {
                const bounds = editor.getShapePageBounds(recentShapes[j].id);
                registry.register(child.name, {
                  id: recentShapes[j].id,
                  name: child.name,
                  x: positions[j]?.x || 0,
                  y: positions[j]?.y || 0,
                  w: bounds?.w || recentShapes[j].w,
                  h: bounds?.h || recentShapes[j].h,
                });
              }
            }
          }
          break;
        }
      }
    } catch (err) {
      const msg = `Satir ${node.line} hatasi (${node.kind}): ${(err as Error).message}`;
      errors.push(msg);
    }
  }

  return { applied: shapeCount > 0, shapeCount, errors, createdShapeIds: registry.getAllIds().map(String) };
}
