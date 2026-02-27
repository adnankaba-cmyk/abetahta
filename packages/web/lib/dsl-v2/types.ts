/**
 * DSL v2 AST tipleri.
 *
 * Her DSL satiri bir AstNode'a donusur.
 * Resolver isimli referanslari cozer, Executor tldraw shape'lere cevirir.
 */

import type { GeoType, TldrawColor, TldrawFill, TldrawDash, TldrawSize, TldrawFont } from '../shape-themes';

// ─── Property Bag ──────────────────────────────────────────

export interface DslProps {
  renk?: TldrawColor;
  dolgu?: TldrawFill;
  cizgi?: TldrawDash;
  boyut?: TldrawSize;
  font?: TldrawFont;
  donme?: number;       // 0-360
  saydamlik?: number;   // 0-1
  ok_bas?: 'arrow' | 'triangle' | 'diamond' | 'none';
  ok_son?: 'arrow' | 'triangle' | 'diamond' | 'none';
}

// ─── AST Nodes ─────────────────────────────────────────────

export interface BaseNode {
  line: number;
  raw: string;
}

/** SEKIL ad tip x,y w,h "metin" { props } */
export interface ShapeNode extends BaseNode {
  kind: 'SHAPE';
  name: string;
  geo: GeoType;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  props: DslProps;
}

/** NOT ad x,y "metin" { props } */
export interface NoteNode extends BaseNode {
  kind: 'NOTE';
  name: string;
  x: number;
  y: number;
  text: string;
  props: DslProps;
}

/** YAZI ad x,y "metin" { props } */
export interface TextNode extends BaseNode {
  kind: 'TEXT';
  name: string;
  x: number;
  y: number;
  text: string;
  props: DslProps;
}

/** RESIM ad x,y w,h url */
export interface ImageNode extends BaseNode {
  kind: 'IMAGE';
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
}

/** CERCEVE ad x,y w,h "baslik" */
export interface FrameNode extends BaseNode {
  kind: 'FRAME';
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
}

/** BAG ad kaynak -> hedef "etiket" { props } */
export interface ArrowNode extends BaseNode {
  kind: 'ARROW';
  name: string;
  fromName: string;
  toName: string;
  label: string;
  props: DslProps;
}

/** CIZGI ad x1,y1 -- x2,y2 { props } */
export interface LineNode extends BaseNode {
  kind: 'LINE';
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  props: DslProps;
}

/** GRUPLA ad1,ad2,ad3 */
export interface GroupNode extends BaseNode {
  kind: 'GROUP';
  names: string[];
}

/** ALTINA ref_ad ofset / YANINA ref_ad ofset / USTUNE ref_ad ofset */
export interface RelativeNode extends BaseNode {
  kind: 'RELATIVE';
  direction: 'below' | 'right' | 'above';
  refName: string;
  offset: number;
}

/** SATIR x,y aralik { ... } / SUTUN / GRID / AKIS */
export interface LayoutNode extends BaseNode {
  kind: 'LAYOUT';
  layoutType: 'ROW' | 'COLUMN' | 'GRID' | 'FLOW';
  x: number;
  y: number;
  gap: number;
  columns?: number;        // GRID icin
  direction?: 'LR' | 'TB'; // FLOW icin
  children: AstNode[];
}

// ─── Union ─────────────────────────────────────────────────

export type AstNode =
  | ShapeNode
  | NoteNode
  | TextNode
  | ImageNode
  | FrameNode
  | ArrowNode
  | LineNode
  | GroupNode
  | RelativeNode
  | LayoutNode;

// ─── Parse Result ──────────────────────────────────────────

export interface DslParseResult {
  nodes: AstNode[];
  errors: Array<{ line: number; message: string }>;
}

// ─── Execution Result ──────────────────────────────────────

export interface DslExecutionResult {
  applied: boolean;
  shapeCount: number;
  errors: string[];
  createdShapeIds: string[];
}
