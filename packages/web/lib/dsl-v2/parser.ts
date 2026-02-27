/**
 * DSL v2 Parser — Metin satirlarini AST'ye cevirir.
 *
 * Satir bazli parsing: her satir bagimsiz parse edilir.
 * Layout bloklari { ... } cok satirli olabilir.
 */

import type {
  AstNode, ShapeNode, NoteNode, TextNode, ImageNode, FrameNode,
  ArrowNode, LineNode, GroupNode, RelativeNode, LayoutNode,
  DslProps, DslParseResult,
} from './types';
import type { GeoType, TldrawColor, TldrawFill, TldrawDash, TldrawSize, TldrawFont } from '../shape-themes';

// ─── Token Helpers ──────────────────────────────────────────

/** "metin icerik" seklindeki quoted string'i cikarir */
function extractQuoted(text: string): { value: string; rest: string } | null {
  const m = text.match(/^"([^"]*)"(.*)$/);
  if (m) return { value: m[1], rest: m[2].trim() };
  return null;
}

/** x,y seklindeki koordinat cifti */
function parseCoord(token: string): { a: number; b: number } | null {
  const m = token.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { a: parseFloat(m[1]), b: parseFloat(m[2]) };
  return null;
}

/** { renk: blue, dolgu: solid, ... } seklindeki props blogu */
function parseProps(text: string): DslProps {
  const props: DslProps = {};
  const m = text.match(/\{([^}]*)\}/);
  if (!m) return props;

  const pairs = m[1].split(',').map(s => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const [key, val] = pair.split(':').map(s => s.trim());
    if (!key || !val) continue;

    switch (key.toLowerCase()) {
      case 'renk': props.renk = val as TldrawColor; break;
      case 'dolgu': props.dolgu = val as TldrawFill; break;
      case 'cizgi': props.cizgi = val as TldrawDash; break;
      case 'boyut': props.boyut = val as TldrawSize; break;
      case 'font': props.font = val as TldrawFont; break;
      case 'donme': props.donme = parseFloat(val) || 0; break;
      case 'saydamlik': props.saydamlik = parseFloat(val) || 1; break;
      case 'ok_bas': props.ok_bas = val as DslProps['ok_bas']; break;
      case 'ok_son': props.ok_son = val as DslProps['ok_son']; break;
    }
  }
  return props;
}

/** Props blogunu metinden cikarir (destructive) */
function stripProps(text: string): { clean: string; props: DslProps } {
  const propsMatch = text.match(/\{[^}]*\}/);
  if (!propsMatch) return { clean: text.trim(), props: {} };
  const props = parseProps(text);
  const clean = text.replace(propsMatch[0], '').trim();
  return { clean, props };
}

// ─── Valid Geo Types ────────────────────────────────────────

const VALID_GEO_TYPES = new Set<string>([
  'rectangle', 'ellipse', 'diamond', 'triangle', 'pentagon', 'hexagon',
  'octagon', 'star', 'rhombus', 'rhombus-2', 'oval', 'trapezoid',
  'cloud', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down',
  'x-box', 'check-box', 'heart',
]);

// ─── Main Parser ────────────────────────────────────────────

export function parseDslV2(code: string): DslParseResult {
  const nodes: AstNode[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  const lines = code.split('\n');

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const lineNum = i + 1;
    i++;

    // Bos satir veya yorum
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    const cmd = trimmed.split(/\s+/)[0].toUpperCase();
    const rest = trimmed.slice(cmd.length).trim();

    try {
      switch (cmd) {
        case 'SEKIL':
        case 'ŞEKİL': {
          const node = parseShape(rest, lineNum, raw);
          if (node) nodes.push(node);
          else errors.push({ line: lineNum, message: `SEKIL parse hatasi: ${raw}` });
          break;
        }

        case 'NOT': {
          const node = parseNote(rest, lineNum, raw);
          if (node) nodes.push(node);
          else errors.push({ line: lineNum, message: `NOT parse hatasi: ${raw}` });
          break;
        }

        case 'YAZI': {
          const node = parseText(rest, lineNum, raw);
          if (node) nodes.push(node);
          else errors.push({ line: lineNum, message: `YAZI parse hatasi: ${raw}` });
          break;
        }

        case 'RESIM':
        case 'RESİM': {
          const node = parseImage(rest, lineNum, raw);
          if (node) nodes.push(node);
          else errors.push({ line: lineNum, message: `RESIM parse hatasi: ${raw}` });
          break;
        }

        case 'CERCEVE':
        case 'ÇERÇEVE': {
          const node = parseFrame(rest, lineNum, raw);
          if (node) nodes.push(node);
          else errors.push({ line: lineNum, message: `CERCEVE parse hatasi: ${raw}` });
          break;
        }

        case 'BAG':
        case 'BAĞ': {
          const node = parseArrow(rest, lineNum, raw);
          if (node) nodes.push(node);
          else errors.push({ line: lineNum, message: `BAG parse hatasi: ${raw}` });
          break;
        }

        case 'CIZGI':
        case 'ÇİZGİ': {
          const node = parseLine(rest, lineNum, raw);
          if (node) nodes.push(node);
          else errors.push({ line: lineNum, message: `CIZGI parse hatasi: ${raw}` });
          break;
        }

        case 'GRUPLA': {
          const names = rest.split(',').map(s => s.trim()).filter(Boolean);
          if (names.length >= 2) {
            nodes.push({ kind: 'GROUP', names, line: lineNum, raw });
          } else {
            errors.push({ line: lineNum, message: 'GRUPLA en az 2 isim gerektirir' });
          }
          break;
        }

        case 'ALTINA': {
          const node = parseRelative(rest, 'below', lineNum, raw);
          if (node) nodes.push(node);
          break;
        }
        case 'YANINA': {
          const node = parseRelative(rest, 'right', lineNum, raw);
          if (node) nodes.push(node);
          break;
        }
        case 'USTUNE':
        case 'ÜSTÜNE': {
          const node = parseRelative(rest, 'above', lineNum, raw);
          if (node) nodes.push(node);
          break;
        }

        case 'SATIR': {
          const { layoutNode, consumed } = parseLayout('ROW', rest, lines, i - 1, lineNum, raw);
          if (layoutNode) { nodes.push(layoutNode); i = consumed; }
          else errors.push({ line: lineNum, message: `SATIR parse hatasi: ${raw}` });
          break;
        }
        case 'SUTUN':
        case 'SÜTUN': {
          const { layoutNode, consumed } = parseLayout('COLUMN', rest, lines, i - 1, lineNum, raw);
          if (layoutNode) { nodes.push(layoutNode); i = consumed; }
          else errors.push({ line: lineNum, message: `SUTUN parse hatasi: ${raw}` });
          break;
        }
        case 'GRID':
        case 'IZGARA': {
          const { layoutNode, consumed } = parseLayout('GRID', rest, lines, i - 1, lineNum, raw);
          if (layoutNode) { nodes.push(layoutNode); i = consumed; }
          else errors.push({ line: lineNum, message: `GRID parse hatasi: ${raw}` });
          break;
        }
        case 'AKIS':
        case 'AKIŞ': {
          const { layoutNode, consumed } = parseLayout('FLOW', rest, lines, i - 1, lineNum, raw);
          if (layoutNode) { nodes.push(layoutNode); i = consumed; }
          else errors.push({ line: lineNum, message: `AKIS parse hatasi: ${raw}` });
          break;
        }

        default:
          errors.push({ line: lineNum, message: `Bilinmeyen komut: ${cmd}` });
      }
    } catch (err) {
      errors.push({ line: lineNum, message: `Parse hatasi: ${(err as Error).message}` });
    }
  }

  return { nodes, errors };
}

// ─── Individual Parsers ─────────────────────────────────────

/** SEKIL ad tip x,y w,h "metin" { props } */
function parseShape(rest: string, line: number, raw: string): ShapeNode | null {
  const { clean, props } = stripProps(rest);
  // ad tip x,y w,h "metin"
  const tokens = clean.split(/\s+/);
  if (tokens.length < 4) return null;

  const name = tokens[0];
  const geo = tokens[1].toLowerCase();
  if (!VALID_GEO_TYPES.has(geo)) return null;

  const pos = parseCoord(tokens[2]);
  if (!pos) return null;

  const size = parseCoord(tokens[3]);
  if (!size) return null;

  // Quoted text
  const afterTokens = clean.slice(clean.indexOf(tokens[3]) + tokens[3].length).trim();
  const quoted = extractQuoted(afterTokens);
  const text = quoted?.value || '';

  return {
    kind: 'SHAPE', name, geo: geo as GeoType,
    x: pos.a, y: pos.b, w: size.a, h: size.b,
    text, props, line, raw,
  };
}

/** NOT ad x,y "metin" { props } */
function parseNote(rest: string, line: number, raw: string): NoteNode | null {
  const { clean, props } = stripProps(rest);
  const tokens = clean.split(/\s+/);
  if (tokens.length < 2) return null;

  const name = tokens[0];
  const pos = parseCoord(tokens[1]);
  if (!pos) return null;

  const afterPos = clean.slice(clean.indexOf(tokens[1]) + tokens[1].length).trim();
  const quoted = extractQuoted(afterPos);
  const text = quoted?.value || '';

  return { kind: 'NOTE', name, x: pos.a, y: pos.b, text, props, line, raw };
}

/** YAZI ad x,y "metin" { props } */
function parseText(rest: string, line: number, raw: string): TextNode | null {
  const { clean, props } = stripProps(rest);
  const tokens = clean.split(/\s+/);
  if (tokens.length < 2) return null;

  const name = tokens[0];
  const pos = parseCoord(tokens[1]);
  if (!pos) return null;

  const afterPos = clean.slice(clean.indexOf(tokens[1]) + tokens[1].length).trim();
  const quoted = extractQuoted(afterPos);
  const text = quoted?.value || '';

  return { kind: 'TEXT', name, x: pos.a, y: pos.b, text, props, line, raw };
}

/** RESIM ad x,y w,h url */
function parseImage(rest: string, line: number, raw: string): ImageNode | null {
  const tokens = rest.split(/\s+/);
  if (tokens.length < 4) return null;

  const name = tokens[0];
  const pos = parseCoord(tokens[1]);
  if (!pos) return null;

  const size = parseCoord(tokens[2]);
  if (!size) return null;

  // URL: quoted or unquoted
  let url = tokens.slice(3).join(' ');
  if (url.startsWith('"') && url.endsWith('"')) url = url.slice(1, -1);

  return { kind: 'IMAGE', name, x: pos.a, y: pos.b, w: size.a, h: size.b, url, line, raw };
}

/** CERCEVE ad x,y w,h "baslik" */
function parseFrame(rest: string, line: number, raw: string): FrameNode | null {
  const tokens = rest.split(/\s+/);
  if (tokens.length < 3) return null;

  const name = tokens[0];
  const pos = parseCoord(tokens[1]);
  if (!pos) return null;

  const size = parseCoord(tokens[2]);
  if (!size) return null;

  const afterSize = rest.slice(rest.indexOf(tokens[2]) + tokens[2].length).trim();
  const quoted = extractQuoted(afterSize);
  const title = quoted?.value || name;

  return { kind: 'FRAME', name, x: pos.a, y: pos.b, w: size.a, h: size.b, title, line, raw };
}

/** BAG ad kaynak -> hedef "etiket" { props } */
function parseArrow(rest: string, line: number, raw: string): ArrowNode | null {
  const { clean, props } = stripProps(rest);
  // ad kaynak -> hedef "etiket"
  const arrowMatch = clean.match(/^(\S+)\s+(\S+)\s*->\s*(\S+)\s*(.*)/);
  if (!arrowMatch) return null;

  const name = arrowMatch[1];
  const fromName = arrowMatch[2];
  const toName = arrowMatch[3];

  const afterNames = arrowMatch[4]?.trim() || '';
  const quoted = extractQuoted(afterNames);
  const label = quoted?.value || '';

  return { kind: 'ARROW', name, fromName, toName, label, props, line, raw };
}

/** CIZGI ad x1,y1 -- x2,y2 { props } */
function parseLine(rest: string, line: number, raw: string): LineNode | null {
  const { clean, props } = stripProps(rest);
  const lineMatch = clean.match(/^(\S+)\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*--\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!lineMatch) return null;

  return {
    kind: 'LINE',
    name: lineMatch[1],
    x1: parseFloat(lineMatch[2]),
    y1: parseFloat(lineMatch[3]),
    x2: parseFloat(lineMatch[4]),
    y2: parseFloat(lineMatch[5]),
    props, line, raw,
  };
}

/** ALTINA/YANINA/USTUNE ref_ad ofset */
function parseRelative(rest: string, direction: RelativeNode['direction'], line: number, raw: string): RelativeNode | null {
  const tokens = rest.split(/\s+/);
  if (tokens.length < 2) return null;
  const refName = tokens[0];
  const offset = parseInt(tokens[1]) || 40;
  return { kind: 'RELATIVE', direction, refName, offset, line, raw };
}

/** SATIR/SUTUN/GRID/AKIS x,y aralik { children... } */
function parseLayout(
  layoutType: LayoutNode['layoutType'],
  rest: string,
  allLines: string[],
  startLineIdx: number,
  lineNum: number,
  raw: string,
): { layoutNode: LayoutNode | null; consumed: number } {
  const tokens = rest.split(/\s+/);
  const pos = tokens[0] ? parseCoord(tokens[0]) : null;
  const x = pos?.a || 0;
  const y = pos?.b || 0;

  let gap = 40;
  let columns: number | undefined;
  let direction: 'LR' | 'TB' | undefined;
  let tokenIdx = 1;

  if (layoutType === 'GRID' && tokens[tokenIdx]) {
    columns = parseInt(tokens[tokenIdx]) || 3;
    tokenIdx++;
  }
  if (layoutType === 'FLOW' && tokens[tokenIdx]) {
    direction = tokens[tokenIdx].toUpperCase() as 'LR' | 'TB';
    if (direction !== 'LR' && direction !== 'TB') direction = 'LR';
    tokenIdx++;
  }
  if (tokens[tokenIdx]) {
    gap = parseInt(tokens[tokenIdx]) || 40;
  }

  // Find { ... } block (multi-line)
  const fullText = allLines.slice(startLineIdx).join('\n');
  const braceStart = fullText.indexOf('{');
  if (braceStart === -1) {
    return { layoutNode: null, consumed: startLineIdx + 1 };
  }

  // Find matching }
  let depth = 0;
  let braceEnd = -1;
  for (let j = braceStart; j < fullText.length; j++) {
    if (fullText[j] === '{') depth++;
    if (fullText[j] === '}') { depth--; if (depth === 0) { braceEnd = j; break; } }
  }
  if (braceEnd === -1) {
    return { layoutNode: null, consumed: startLineIdx + 1 };
  }

  const innerCode = fullText.slice(braceStart + 1, braceEnd).trim();

  // Recursive parse children
  const childResult = parseDslV2(innerCode);
  const children = childResult.nodes;

  // How many lines consumed?
  const consumedText = fullText.slice(0, braceEnd + 1);
  const consumedLineCount = consumedText.split('\n').length;

  const layoutNode: LayoutNode = {
    kind: 'LAYOUT', layoutType, x, y, gap,
    columns, direction, children,
    line: lineNum, raw,
  };

  return { layoutNode, consumed: startLineIdx + consumedLineCount };
}
