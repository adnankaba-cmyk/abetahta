/**
 * Tahta DSL Executor
 *
 * Backend AI ```dsl blokları parse edip tldraw canvas'a uygular.
 * Komutlar: KUTU, DAIRE, OK, YAZI, NOT, BASLANGIC, BITIS, ISLEM, KARAR, YILDIZ
 * English aliases: RECTANGLE/BOX, CIRCLE/ELLIPSE, ARROW, TEXT, NOTE, START, END, PROCESS, DECISION, STAR
 */

import { Editor, createShapeId, TLGeoShape } from 'tldraw';
import { toRichText } from '@tldraw/editor';

// Renk mapping: Türkçe → tldraw
const COLOR_MAP: Record<string, string> = {
  kirmizi: 'red', kırmızı: 'red', red: 'red',
  yesil: 'green', yeşil: 'green', green: 'green',
  mavi: 'blue', blue: 'blue',
  sari: 'yellow', sarı: 'yellow', yellow: 'yellow',
  turuncu: 'orange', orange: 'orange',
  mor: 'violet', violet: 'violet',
  siyah: 'black', black: 'black',
  gri: 'grey', grey: 'grey',
  beyaz: 'white', white: 'white',
};

function toColor(c?: string): string {
  if (!c) return 'black';
  return COLOR_MAP[c.toLowerCase()] || 'black';
}

function rt(text: string) {
  return toRichText(text);
}

interface DslResult {
  applied: boolean;
  shapeCount: number;
  errors: string[];
}

// English → Turkish command normalization
const CMD_ALIASES: Record<string, string> = {
  RECTANGLE: 'KUTU', BOX: 'KUTU', RECT: 'KUTU',
  CIRCLE: 'DAIRE', ELLIPSE: 'DAIRE', OVAL: 'DAIRE',
  ARROW: 'OK',
  LINE: 'CIZGI',
  TEXT: 'YAZI', LABEL: 'YAZI',
  NOTE: 'NOT', STICKY: 'NOT',
  START: 'BASLANGIC', BEGIN: 'BASLANGIC',
  END: 'BITIS', FINISH: 'BITIS', STOP: 'BITIS',
  PROCESS: 'ISLEM', STEP: 'ISLEM', ACTION: 'ISLEM',
  DECISION: 'KARAR', IF: 'KARAR', CONDITION: 'KARAR',
  DIAMOND: 'KARAR',
  STAR: 'YILDIZ',
};

/**
 * AI'nin hallüsinasyon ile ürettiği COMMAND(x,y,w,h,"text") formatını
 * standart "COMMAND x,y w,h "text"" formatına dönüştürür.
 * Örnek: RECTANGLE(50,200,150,60,"Başla") → KUTU 50,200 150,60 "Başla"
 */
function normalizeParenFormat(line: string): string {
  const parenMatch = line.match(/^([A-ZÇĞİÖŞÜa-z_]+)\s*\(([^)]*)\)\s*$/i);
  if (!parenMatch) return line;

  const cmd = parenMatch[1].toUpperCase();
  // Parse CSV args, respecting quoted strings
  const argsRaw = parenMatch[2];
  const args: string[] = [];
  let cur = '';
  let inQuote = false;
  for (const ch of argsRaw) {
    if (ch === '"' || ch === "'") { inQuote = !inQuote; cur += ch; }
    else if (ch === ',' && !inQuote) { args.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) args.push(cur.trim());

  // Strip surrounding quotes from string args
  const arg = (i: number) => args[i]?.replace(/^['"]|['"]$/g, '') ?? '';
  const num = (i: number) => args[i]?.trim() ?? '0';

  switch (cmd) {
    case 'RECTANGLE': case 'BOX': case 'RECT': case 'KUTU':
      // (x, y, w, h, "text", color?)
      return `KUTU ${num(0)},${num(1)} ${num(2)},${num(3)} "${arg(4)}"${args[5] ? ' ' + arg(5) : ''}`;
    case 'CIRCLE': case 'ELLIPSE': case 'OVAL': case 'DAIRE':
      // (x, y, r, "text", color?)
      return `DAIRE ${num(0)},${num(1)} ${num(2)} "${arg(3)}"${args[4] ? ' ' + arg(4) : ''}`;
    case 'ARROW': case 'OK':
      // (x1, y1, x2, y2, color?)
      return `OK ${num(0)},${num(1)} -> ${num(2)},${num(3)}${args[4] ? ' ' + arg(4) : ''}`;
    case 'TEXT': case 'LABEL': case 'YAZI':
      // (x, y, "text", size?)
      return `YAZI ${num(0)},${num(1)} "${arg(2)}"${args[3] ? ' ' + num(3) : ''}`;
    case 'NOTE': case 'STICKY': case 'NOT':
      // (x, y, "text", color?)
      return `NOT ${num(0)},${num(1)} "${arg(2)}"${args[3] ? ' ' + arg(3) : ''}`;
    case 'START': case 'BASLANGIC':
      return `BASLANGIC ${num(0)},${num(1)} "${arg(2)}"`;
    case 'END': case 'BITIS':
      return `BITIS ${num(0)},${num(1)} "${arg(2)}"`;
    case 'PROCESS': case 'ISLEM':
      return `ISLEM ${num(0)},${num(1)} "${arg(2)}"`;
    case 'DECISION': case 'KARAR':
      return `KARAR ${num(0)},${num(1)} "${arg(2)}"`;
    default:
      return line; // Bilinmeyen format — olduğu gibi bırak
  }
}

/**
 * Normalize line: replace English command with Turkish equivalent
 * so that the regex patterns (which use Turkish names) can match.
 */
function normalizeLine(line: string): string {
  // Önce parantez formatını düzelt: COMMAND(args) → COMMAND args
  const deParened = normalizeParenFormat(line);
  if (deParened !== line) return deParened;

  const firstSpace = line.search(/\s/);
  const rawCmd = firstSpace === -1 ? line : line.substring(0, firstSpace);
  const upperCmd = rawCmd.toUpperCase();
  const mapped = CMD_ALIASES[upperCmd];
  if (mapped) {
    return mapped + (firstSpace === -1 ? '' : line.substring(firstSpace));
  }
  return line;
}

/**
 * DSL kodunu parse edip canvas'a uygular.
 */
export function executeDsl(
  editor: Editor,
  dslCode: string,
  anchorPoint?: { x: number; y: number },
): DslResult {
  const lines = dslCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//') && !l.startsWith('#'));
  const errors: string[] = [];
  let shapeCount = 0;
  const ox = anchorPoint?.x || 0;
  const oy = anchorPoint?.y || 0;

  for (const rawLine of lines) {
    try {
      const line = normalizeLine(rawLine);
      const cmd = line.split(/\s+/)[0].toUpperCase();

      switch (cmd) {
        case 'KUTU': {
          // KUTU x,y w,h "metin" [renk]
          const m = line.match(/KUTU\s+([\d.]+)\s*,\s*([\d.]+)\s+([\d.]+)\s*,\s*([\d.]+)\s+"([^"]*)"(?:\s+(\w+))?/i);
          if (!m) { errors.push(`Parse hatasi: ${line}`); break; }
          const [, x, y, w, h, text, color] = m;
          const id = createShapeId();
          editor.createShape<TLGeoShape>({
            id, type: 'geo',
            x: ox + +x - +w / 2, y: oy + +y - +h / 2,
            props: { geo: 'rectangle', w: +w, h: +h, fill: 'solid', color: toColor(color) as any, dash: 'solid', size: 'm', font: 'sans', richText: rt(text), verticalAlign: 'middle', align: 'middle' } as any,
            meta: { createdBy: 'ai-dsl' },
          });
          shapeCount++;
          break;
        }

        case 'DAIRE': {
          // DAIRE x,y r "metin" [renk]
          const m = line.match(/DAIRE\s+([\d.]+)\s*,\s*([\d.]+)\s+([\d.]+)\s+"([^"]*)"(?:\s+(\w+))?/i);
          if (!m) { errors.push(`Parse hatasi: ${line}`); break; }
          const [, x, y, r, text, color] = m;
          const d = +r * 2;
          const id = createShapeId();
          editor.createShape<TLGeoShape>({
            id, type: 'geo',
            x: ox + +x - +r, y: oy + +y - +r,
            props: { geo: 'ellipse', w: d, h: d, fill: 'solid', color: toColor(color) as any, dash: 'solid', size: 'm', font: 'sans', richText: rt(text), verticalAlign: 'middle', align: 'middle' } as any,
            meta: { createdBy: 'ai-dsl' },
          });
          shapeCount++;
          break;
        }

        case 'OK': {
          // OK x1,y1 -> x2,y2 [renk]
          const m = line.match(/OK\s+([\d.]+)\s*,\s*([\d.]+)\s*->\s*([\d.]+)\s*,\s*([\d.]+)(?:\s+(\w+))?/i);
          if (!m) { errors.push(`Parse hatasi: ${line}`); break; }
          const [, x1, y1, x2, y2, color] = m;
          const id = createShapeId();
          editor.createShape({
            id, type: 'arrow',
            x: ox + +x1, y: oy + +y1,
            props: {
              start: { x: 0, y: 0 },
              end: { x: +x2 - +x1, y: +y2 - +y1 },
              color: toColor(color) as any,
              arrowheadEnd: 'arrow',
              arrowheadStart: 'none',
            },
            meta: { createdBy: 'ai-dsl' },
          });
          shapeCount++;
          break;
        }

        case 'CIZGI': {
          // CIZGI x1,y1 -- x2,y2 [renk]
          const m = line.match(/CIZGI\s+([\d.]+)\s*,\s*([\d.]+)\s*--\s*([\d.]+)\s*,\s*([\d.]+)(?:\s+(\w+))?/i);
          if (!m) { errors.push(`Parse hatasi: ${line}`); break; }
          const [, x1, y1, x2, y2, color] = m;
          const id = createShapeId();
          editor.createShape({
            id, type: 'arrow',
            x: ox + +x1, y: oy + +y1,
            props: {
              start: { x: 0, y: 0 },
              end: { x: +x2 - +x1, y: +y2 - +y1 },
              color: toColor(color) as any,
              arrowheadEnd: 'none',
              arrowheadStart: 'none',
            },
            meta: { createdBy: 'ai-dsl' },
          });
          shapeCount++;
          break;
        }

        case 'YAZI': {
          // YAZI x,y "metin" [boyut]
          const m = line.match(/YAZI\s+([\d.]+)\s*,\s*([\d.]+)\s+"([^"]*)"(?:\s+(\d+))?/i);
          if (!m) { errors.push(`Parse hatasi: ${line}`); break; }
          const [, x, y, text, sizeStr] = m;
          const id = createShapeId();
          const size = sizeStr ? (+sizeStr >= 28 ? 'xl' : +sizeStr >= 20 ? 'l' : +sizeStr >= 16 ? 'm' : 's') : 'm';
          editor.createShape({
            id, type: 'text',
            x: ox + +x, y: oy + +y,
            props: { richText: toRichText(text), size, font: 'sans', color: 'black', w: 200, scale: 1, autoSize: true, textAlign: 'start' } as any,
            meta: { createdBy: 'ai-dsl' },
          });
          shapeCount++;
          break;
        }

        case 'NOT': {
          // NOT x,y "metin" [renk]
          const m = line.match(/NOT\s+([\d.]+)\s*,\s*([\d.]+)\s+"([^"]*)"(?:\s+(\w+))?/i);
          if (!m) { errors.push(`Parse hatasi: ${line}`); break; }
          const [, x, y, text, color] = m;
          const id = createShapeId();
          editor.createShape({
            id, type: 'note',
            x: ox + +x - 100, y: oy + +y - 100,
            props: { color: toColor(color) || 'yellow', size: 'm', font: 'sans', richText: rt(text) } as any,
            meta: { createdBy: 'ai-dsl' },
          });
          shapeCount++;
          break;
        }

        case 'BASLANGIC':
        case 'BAŞLANGIC':
        case 'BAŞLANGIÇ': {
          // BASLANGIC x,y "metin"
          const m = line.match(/(?:BASLANGIC|BAŞLANGIC|BAŞLANGIÇ)\s+([\d.]+)\s*,\s*([\d.]+)\s+"([^"]*)"/i);
          if (!m) { errors.push(`Parse hatasi: ${line}`); break; }
          const [, x, y, text] = m;
          const id = createShapeId();
          editor.createShape<TLGeoShape>({
            id, type: 'geo',
            x: ox + +x - 60, y: oy + +y - 30,
            props: { geo: 'ellipse', w: 120, h: 60, fill: 'solid', color: 'green' as any, dash: 'solid', size: 'm', font: 'sans', richText: rt(text), verticalAlign: 'middle', align: 'middle' } as any,
            meta: { createdBy: 'ai-dsl' },
          });
          shapeCount++;
          break;
        }

        case 'BITIS':
        case 'BİTİŞ': {
          // BITIS x,y "metin"
          const m = line.match(/(?:BITIS|BİTİŞ)\s+([\d.]+)\s*,\s*([\d.]+)\s+"([^"]*)"/i);
          if (!m) { errors.push(`Parse hatasi: ${line}`); break; }
          const [, x, y, text] = m;
          const id = createShapeId();
          editor.createShape<TLGeoShape>({
            id, type: 'geo',
            x: ox + +x - 60, y: oy + +y - 30,
            props: { geo: 'ellipse', w: 120, h: 60, fill: 'solid', color: 'red' as any, dash: 'solid', size: 'm', font: 'sans', richText: rt(text), verticalAlign: 'middle', align: 'middle' } as any,
            meta: { createdBy: 'ai-dsl' },
          });
          shapeCount++;
          break;
        }

        case 'ISLEM':
        case 'İŞLEM': {
          // ISLEM x,y "metin"
          const m = line.match(/(?:ISLEM|İŞLEM)\s+([\d.]+)\s*,\s*([\d.]+)\s+"([^"]*)"/i);
          if (!m) { errors.push(`Parse hatasi: ${line}`); break; }
          const [, x, y, text] = m;
          const id = createShapeId();
          editor.createShape<TLGeoShape>({
            id, type: 'geo',
            x: ox + +x - 75, y: oy + +y - 35,
            props: { geo: 'rectangle', w: 150, h: 70, fill: 'solid', color: 'blue' as any, dash: 'solid', size: 'm', font: 'sans', richText: rt(text), verticalAlign: 'middle', align: 'middle' } as any,
            meta: { createdBy: 'ai-dsl' },
          });
          shapeCount++;
          break;
        }

        case 'KARAR': {
          // KARAR x,y "metin"
          const m = line.match(/KARAR\s+([\d.]+)\s*,\s*([\d.]+)\s+"([^"]*)"/i);
          if (!m) { errors.push(`Parse hatasi: ${line}`); break; }
          const [, x, y, text] = m;
          const id = createShapeId();
          editor.createShape<TLGeoShape>({
            id, type: 'geo',
            x: ox + +x - 60, y: oy + +y - 50,
            props: { geo: 'diamond', w: 120, h: 100, fill: 'solid', color: 'yellow' as any, dash: 'solid', size: 'm', font: 'sans', richText: rt(text), verticalAlign: 'middle', align: 'middle' } as any,
            meta: { createdBy: 'ai-dsl' },
          });
          shapeCount++;
          break;
        }

        case 'YILDIZ': {
          // YILDIZ x,y r "metin" [renk] — star shape
          const m = line.match(/YILDIZ\s+([\d.]+)\s*,\s*([\d.]+)\s+([\d.]+)\s+"([^"]*)"(?:\s+(\w+))?/i);
          if (!m) { errors.push(`Parse hatasi: ${line}`); break; }
          const [, x, y, r, text, color] = m;
          const d = +r * 2;
          const id = createShapeId();
          editor.createShape<TLGeoShape>({
            id, type: 'geo',
            x: ox + +x - +r, y: oy + +y - +r,
            props: { geo: 'star', w: d, h: d, fill: 'solid', color: toColor(color) as any, dash: 'solid', size: 'm', font: 'sans', richText: rt(text), verticalAlign: 'middle', align: 'middle' } as any,
            meta: { createdBy: 'ai-dsl' },
          });
          shapeCount++;
          break;
        }

        default:
          // Bilinmeyen komut — sessizce atla
          if (cmd.length > 0 && /^[A-ZÇĞİÖŞÜa-zA-Z]/.test(cmd)) {
            errors.push(`Bilinmeyen komut: ${cmd}`);
          }
          break;
      }
    } catch (err) {
      errors.push(`Satir hatasi: ${rawLine} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { applied: shapeCount > 0, shapeCount, errors };
}
