/**
 * AI Agent — Canvas üzerinde proaktif işlem yapabilen AI modülü.
 *
 * Mevcut bridge (ai-canvas-bridge.ts) sadece yeni şekil oluşturur.
 * Agent ise mevcut şekilleri okur, düzenler, siler, hizalar ve gruplar.
 *
 * Agent Actions (```actions bloğunda döner):
 *   CREATE  — Mermaid ile yeni şekil oluştur (mevcut bridge'e delege eder)
 *   MOVE    id dx,dy — Şekli taşı (göreceli)
 *   MOVETO  id x,y — Şekli mutlak konuma taşı
 *   RESIZE  id w,h — Şekli boyutlandır
 *   RECOLOR id renk — Şekil rengini değiştir
 *   DELETE  id — Şekli sil
 *   SELECT  id1,id2,... — Şekilleri seç
 *   ALIGN   direction — Seçili şekilleri hizala (left|right|top|bottom|center-h|center-v)
 *   DISTRIBUTE direction — Seçili şekilleri dağıt (horizontal|vertical)
 *   GROUP   — Seçili şekilleri grupla
 *   UNGROUP — Seçili grubu çöz
 *   LABEL   id "metin" — Şeklin metnini değiştir
 *   ZINDEX  id front|back|forward|backward — Z-sıralama
 */

import { Editor, TLShape, TLShapeId, createShapeId } from 'tldraw';
import { applyMermaidToCanvas } from './ai-canvas-bridge';
import { agentLog } from './logger';

// ---- Canvas State Serializer ----

export interface CanvasShapeInfo {
  id: string;
  type: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  color?: string;
  geo?: string;
  meta?: Record<string, unknown>;
}

/**
 * Canvas'ın mevcut durumunu AI'a gönderilecek formata çevirir.
 * Tüm şekilleri okur (max 100), konum ve özelliklerini döndürür.
 */
export function serializeCanvasState(editor: Editor): {
  shapeCount: number;
  shapes: CanvasShapeInfo[];
  selectedIds: string[];
  viewport: { x: number; y: number; w: number; h: number };
} {
  agentLog.debug('serializeCanvasState cagirildi');
  const allShapes = editor.getCurrentPageShapes();
  const selectedIds = editor.getSelectedShapeIds() as string[];

  const viewportBounds = editor.getViewportScreenBounds();
  const topLeft = editor.screenToPage({ x: viewportBounds.x, y: viewportBounds.y });
  const bottomRight = editor.screenToPage({
    x: viewportBounds.x + viewportBounds.w,
    y: viewportBounds.y + viewportBounds.h,
  });

  const shapes: CanvasShapeInfo[] = allShapes.slice(0, 100).map((s) => {
    const props = s.props as Record<string, any>;
    return {
      id: s.id,
      type: s.type,
      x: Math.round(s.x),
      y: Math.round(s.y),
      w: props.w ? Math.round(props.w) : undefined,
      h: props.h ? Math.round(props.h) : undefined,
      text: props.text || props.richText?.[0]?.children?.[0]?.text || undefined,
      color: props.color || undefined,
      geo: props.geo || undefined,
    };
  });

  const result = {
    shapeCount: allShapes.length,
    shapes,
    selectedIds,
    viewport: {
      x: Math.round(topLeft.x),
      y: Math.round(topLeft.y),
      w: Math.round(bottomRight.x - topLeft.x),
      h: Math.round(bottomRight.y - topLeft.y),
    },
  };
  agentLog.info('Canvas durumu serileştirildi:', { shapeCount: result.shapeCount, selectedCount: selectedIds.length });
  return result;
}

// ---- Agent Action Parser & Executor ----

interface AgentAction {
  command: string;
  args: string[];
  raw: string;
}

/**
 * AI yanıtından ```actions bloğunu çıkarır.
 */
export function extractActions(text: string): { actions: AgentAction[]; cleanText: string } | null {
  agentLog.debug('extractActions cagirildi, metin uzunlugu:', text.length);
  const fencedRegex = /```actions\s*\n([\s\S]*?)```/gi;
  const match = fencedRegex.exec(text);
  if (!match) {
    agentLog.debug('Actions blogu bulunamadi');
    return null;
  }

  const block = match[1].trim();
  const cleanText = text.replace(match[0], '').trim();

  const actions: AgentAction[] = [];
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    const parts = trimmed.match(/^(\w+)\s*(.*)/);
    if (parts) {
      actions.push({
        command: parts[1].toUpperCase(),
        args: parseArgs(parts[2] || ''),
        raw: trimmed,
      });
    }
  }

  agentLog.info('Actions cikarildi:', actions.length, 'komut -', actions.map(a => a.command).join(', '));
  return actions.length > 0 ? { actions, cleanText } : null;
}

function parseArgs(argsStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === ' ' || ch === ',') && !inQuotes) {
      if (current.trim()) args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());

  return args;
}

export interface AgentResult {
  executed: number;
  errors: string[];
  cleanText: string;
}

/**
 * Agent action'larını canvas üzerinde çalıştırır.
 */
export async function executeAgentActions(editor: Editor, actions: AgentAction[]): Promise<AgentResult> {
  agentLog.info('executeAgentActions basliyor:', actions.length, 'komut');
  let executed = 0;
  const errors: string[] = [];

  for (const action of actions) {
    agentLog.debug('Komut calistiriliyor:', action.command, action.args);
    try {
      switch (action.command) {
        case 'CREATE': {
          // Mermaid kodunu bridge'e delege et
          const mermaidCode = action.args.join(' ');
          const result = await applyMermaidToCanvas(editor, mermaidCode);
          if (result.applied) executed += result.shapeCount;
          else if (result.errors.length > 0) errors.push(...result.errors);
          break;
        }

        case 'MOVE': {
          const [id, dxStr, dyStr] = action.args;
          const shape = editor.getShape(id as TLShapeId);
          if (shape) {
            const dx = parseFloat(dxStr) || 0;
            const dy = parseFloat(dyStr) || 0;
            editor.updateShape({ id: shape.id, type: shape.type, x: shape.x + dx, y: shape.y + dy });
            executed++;
          } else {
            errors.push(`MOVE: Shape ${id} bulunamadi`);
          }
          break;
        }

        case 'MOVETO': {
          const [id, xStr, yStr] = action.args;
          const shape = editor.getShape(id as TLShapeId);
          if (shape) {
            editor.updateShape({ id: shape.id, type: shape.type, x: parseFloat(xStr) || 0, y: parseFloat(yStr) || 0 });
            executed++;
          } else {
            errors.push(`MOVETO: Shape ${id} bulunamadi`);
          }
          break;
        }

        case 'RESIZE': {
          const [id, wStr, hStr] = action.args;
          const shape = editor.getShape(id as TLShapeId);
          if (shape) {
            const props = shape.props as any;
            editor.updateShape({
              id: shape.id,
              type: shape.type,
              props: { ...props, w: parseFloat(wStr) || props.w, h: parseFloat(hStr) || props.h },
            } as any);
            executed++;
          } else {
            errors.push(`RESIZE: Shape ${id} bulunamadi`);
          }
          break;
        }

        case 'RECOLOR': {
          const [id, color] = action.args;
          const shape = editor.getShape(id as TLShapeId);
          if (shape) {
            editor.updateShape({
              id: shape.id,
              type: shape.type,
              props: { ...(shape.props as any), color },
            } as any);
            executed++;
          } else {
            errors.push(`RECOLOR: Shape ${id} bulunamadi`);
          }
          break;
        }

        case 'DELETE': {
          const [id] = action.args;
          const shape = editor.getShape(id as TLShapeId);
          if (shape) {
            editor.deleteShapes([shape.id]);
            executed++;
          } else {
            errors.push(`DELETE: Shape ${id} bulunamadi`);
          }
          break;
        }

        case 'SELECT': {
          const ids = action.args.flatMap(a => a.split(',').map(s => s.trim())).filter(Boolean);
          editor.select(...ids.map(id => id as TLShapeId));
          executed++;
          break;
        }

        case 'LABEL': {
          const id = action.args[0];
          const text = action.args.slice(1).join(' ');
          const shape = editor.getShape(id as TLShapeId);
          if (shape) {
            editor.updateShape({
              id: shape.id,
              type: shape.type,
              props: { ...(shape.props as any), text },
            } as any);
            executed++;
          } else {
            errors.push(`LABEL: Shape ${id} bulunamadi`);
          }
          break;
        }

        case 'ALIGN': {
          const [direction] = action.args;
          const selected = editor.getSelectedShapes();
          if (selected.length < 2) {
            errors.push('ALIGN: En az 2 sekil secili olmali');
            break;
          }
          alignShapes(editor, selected, direction || 'left');
          executed++;
          break;
        }

        case 'DISTRIBUTE': {
          const [direction] = action.args;
          const selected = editor.getSelectedShapes();
          if (selected.length < 3) {
            errors.push('DISTRIBUTE: En az 3 sekil secili olmali');
            break;
          }
          distributeShapes(editor, selected, direction || 'horizontal');
          executed++;
          break;
        }

        case 'GROUP': {
          const ids = editor.getSelectedShapeIds();
          if (ids.length >= 2) {
            editor.groupShapes(ids);
            executed++;
          } else {
            errors.push('GROUP: En az 2 sekil secili olmali');
          }
          break;
        }

        case 'UNGROUP': {
          const ids = editor.getSelectedShapeIds();
          if (ids.length > 0) {
            editor.ungroupShapes(ids);
            executed++;
          }
          break;
        }

        case 'ZINDEX': {
          const [id, order] = action.args;
          const shape = editor.getShape(id as TLShapeId);
          if (shape) {
            switch (order) {
              case 'front': editor.bringToFront([shape.id]); break;
              case 'back': editor.sendToBack([shape.id]); break;
              case 'forward': editor.bringForward([shape.id]); break;
              case 'backward': editor.sendBackward([shape.id]); break;
            }
            executed++;
          }
          break;
        }

        default:
          errors.push(`Bilinmeyen komut: ${action.command}`);
      }
    } catch (err) {
      const msg = `${action.command} hatasi: ${(err as Error).message}`;
      agentLog.error(msg);
      errors.push(msg);
    }
  }

  agentLog.info('executeAgentActions tamamlandi:', { executed, errorCount: errors.length });
  if (errors.length > 0) agentLog.warn('Agent hatalari:', errors);
  return { executed, errors, cleanText: '' };
}

// ---- Alignment Helpers ----

function alignShapes(editor: Editor, shapes: TLShape[], direction: string) {
  const bounds = shapes.map(s => {
    const props = s.props as any;
    return { id: s.id, type: s.type, x: s.x, y: s.y, w: props.w || 100, h: props.h || 100 };
  });

  switch (direction) {
    case 'left': {
      const minX = Math.min(...bounds.map(b => b.x));
      bounds.forEach(b => editor.updateShape({ id: b.id, type: b.type, x: minX }));
      break;
    }
    case 'right': {
      const maxRight = Math.max(...bounds.map(b => b.x + b.w));
      bounds.forEach(b => editor.updateShape({ id: b.id, type: b.type, x: maxRight - b.w }));
      break;
    }
    case 'top': {
      const minY = Math.min(...bounds.map(b => b.y));
      bounds.forEach(b => editor.updateShape({ id: b.id, type: b.type, y: minY }));
      break;
    }
    case 'bottom': {
      const maxBottom = Math.max(...bounds.map(b => b.y + b.h));
      bounds.forEach(b => editor.updateShape({ id: b.id, type: b.type, y: maxBottom - b.h }));
      break;
    }
    case 'center-h': {
      const centerX = bounds.reduce((sum, b) => sum + b.x + b.w / 2, 0) / bounds.length;
      bounds.forEach(b => editor.updateShape({ id: b.id, type: b.type, x: centerX - b.w / 2 }));
      break;
    }
    case 'center-v': {
      const centerY = bounds.reduce((sum, b) => sum + b.y + b.h / 2, 0) / bounds.length;
      bounds.forEach(b => editor.updateShape({ id: b.id, type: b.type, y: centerY - b.h / 2 }));
      break;
    }
  }
}

function distributeShapes(editor: Editor, shapes: TLShape[], direction: string) {
  const bounds = shapes.map(s => {
    const props = s.props as any;
    return { id: s.id, type: s.type, x: s.x, y: s.y, w: props.w || 100, h: props.h || 100 };
  });

  if (direction === 'horizontal') {
    bounds.sort((a, b) => a.x - b.x);
    const totalW = bounds.reduce((sum, b) => sum + b.w, 0);
    const totalSpan = bounds[bounds.length - 1].x + bounds[bounds.length - 1].w - bounds[0].x;
    const gap = (totalSpan - totalW) / (bounds.length - 1);
    let currentX = bounds[0].x;
    for (const b of bounds) {
      editor.updateShape({ id: b.id, type: b.type, x: currentX });
      currentX += b.w + gap;
    }
  } else {
    bounds.sort((a, b) => a.y - b.y);
    const totalH = bounds.reduce((sum, b) => sum + b.h, 0);
    const totalSpan = bounds[bounds.length - 1].y + bounds[bounds.length - 1].h - bounds[0].y;
    const gap = (totalSpan - totalH) / (bounds.length - 1);
    let currentY = bounds[0].y;
    for (const b of bounds) {
      editor.updateShape({ id: b.id, type: b.type, y: currentY });
      currentY += b.h + gap;
    }
  }
}

// ---- Agent System Prompt Extension ----

export const AGENT_CAPABILITIES = `
AGENT YETENEKLERI — Canvas Üzerinde Düzenleme:
Mevcut şekilleri düzenlemek, taşımak, hizalamak için \`\`\`actions bloğu kullan.

AGENT KOMUTLARI:
- MOVE id dx,dy — Şekli göreceli taşı
- MOVETO id x,y — Mutlak konuma taşı
- RESIZE id w,h — Boyutlandır
- RECOLOR id renk — Renk değiştir (black, red, blue, green, yellow, orange, violet)
- DELETE id — Sil
- SELECT id1,id2 — Seç
- ALIGN direction — Hizala (left|right|top|bottom|center-h|center-v)
- DISTRIBUTE direction — Dağıt (horizontal|vertical)
- GROUP — Seçilileri grupla
- UNGROUP — Grubu çöz
- LABEL id "yeni metin" — Metin değiştir
- ZINDEX id front|back|forward|backward — Z-sıralama

ÖNEMLI:
- Yeni şekil oluşturmak için \`\`\`mermaid bloğu kullan (CREATE ile değil).
- Mevcut şekilleri düzenlemek için \`\`\`actions bloğu kullan.
- Shape ID'leri kullanıcının gönderdiği canvas bilgisinden al.
- Bir yanıtta hem \`\`\`mermaid hem \`\`\`actions bloğu olabilir.

ÖRNEK — kullanıcı "şekilleri hizala" derse:
\`\`\`actions
SELECT shape:abc123, shape:def456, shape:ghi789
ALIGN left
DISTRIBUTE vertical
\`\`\`
`;
