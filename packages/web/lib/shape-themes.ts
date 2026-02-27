/**
 * Shape Tema Sistemi — draw.io + Mermaid uyumlu profesyonel stiller
 *
 * tldraw'ın desteklediği 20 geo tipi + note shape kullanılarak
 * draw.io ve Mermaid'deki tüm yaygın şekil tipleri desteklenir.
 *
 * tldraw geo tipleri (20):
 *   rectangle, ellipse, diamond, triangle, pentagon, hexagon, octagon,
 *   star, rhombus, rhombus-2, oval, trapezoid, cloud,
 *   arrow-right, arrow-left, arrow-up, arrow-down,
 *   x-box, check-box, heart
 *
 * Ek shape tipi: note (yapışkan not — ayrı tldraw shape)
 */

// ─── Tldraw Literal Tipleri ───────────────────────

export type GeoType =
  | 'rectangle' | 'ellipse' | 'diamond' | 'triangle'
  | 'pentagon' | 'hexagon' | 'octagon' | 'star'
  | 'rhombus' | 'rhombus-2' | 'oval' | 'trapezoid'
  | 'cloud' | 'arrow-right' | 'arrow-left' | 'arrow-up' | 'arrow-down'
  | 'x-box' | 'check-box' | 'heart';

export type TldrawColor = 'black' | 'grey' | 'light-violet' | 'violet' | 'blue' | 'light-blue' | 'yellow' | 'orange' | 'green' | 'light-green' | 'light-red' | 'red' | 'white';
export type TldrawFill = 'solid' | 'semi' | 'pattern' | 'none';
export type TldrawDash = 'draw' | 'solid' | 'dashed' | 'dotted';
export type TldrawSize = 'xl' | 'l' | 'm' | 's';
export type TldrawFont = 'draw' | 'sans' | 'serif' | 'mono';

// ─── Shape Theme ──────────────────────────────────

export interface ShapeTheme {
  /** 'geo' veya 'note' — tldraw shape type */
  shapeType: 'geo' | 'note';
  /** geo alt tipi (sadece shapeType='geo' için) */
  geo: GeoType;
  color: TldrawColor;
  fill: TldrawFill;
  dash: TldrawDash;
  size: TldrawSize;
  font: TldrawFont;
  w: number;
  h: number;
}

// ─── Node Kategorileri ────────────────────────────

/**
 * Genişletilmiş kategori listesi:
 * Mermaid + draw.io'daki yaygın şekil tipleri
 */
export type NodeCategory =
  // Temel flowchart
  | 'start' | 'end' | 'process' | 'decision' | 'io' | 'database' | 'default'
  // draw.io ek şekiller
  | 'note' | 'cloud' | 'triangle' | 'pentagon' | 'octagon'
  | 'star' | 'heart' | 'trapezoid' | 'rhombus'
  | 'oval' | 'check' | 'cross'
  | 'arrow-right' | 'arrow-left' | 'arrow-up' | 'arrow-down'
  // Özel amaçlı
  | 'warning' | 'manual' | 'preparation' | 'display';

// ─── Tema Tanımları ───────────────────────────────

const THEMES: Record<NodeCategory, ShapeTheme> = {
  // ── Temel Flowchart ──
  start: {
    shapeType: 'geo', geo: 'oval',
    color: 'green', fill: 'solid', dash: 'solid', size: 'l', font: 'sans',
    w: 160, h: 60,
  },
  end: {
    shapeType: 'geo', geo: 'oval',
    color: 'red', fill: 'solid', dash: 'solid', size: 'l', font: 'sans',
    w: 160, h: 60,
  },
  process: {
    shapeType: 'geo', geo: 'rectangle',
    color: 'blue', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 180, h: 60,
  },
  decision: {
    shapeType: 'geo', geo: 'diamond',
    color: 'orange', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 160, h: 120,
  },
  io: {
    shapeType: 'geo', geo: 'rhombus',
    color: 'violet', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 200, h: 60,
  },
  database: {
    shapeType: 'geo', geo: 'ellipse',
    color: 'grey', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 160, h: 80,
  },
  default: {
    shapeType: 'geo', geo: 'rectangle',
    color: 'light-blue', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 180, h: 60,
  },

  // ── Yapışkan Not (ayrı tldraw shape tipi) ──
  note: {
    shapeType: 'note', geo: 'rectangle', // geo kullanılmaz ama tip uyumu için
    color: 'yellow', fill: 'solid', dash: 'solid', size: 'm', font: 'sans',
    w: 200, h: 200,
  },

  // ── Geometrik Şekiller ──
  cloud: {
    shapeType: 'geo', geo: 'cloud',
    color: 'light-blue', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 200, h: 120,
  },
  triangle: {
    shapeType: 'geo', geo: 'triangle',
    color: 'orange', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 140, h: 120,
  },
  pentagon: {
    shapeType: 'geo', geo: 'pentagon',
    color: 'violet', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 140, h: 140,
  },
  octagon: {
    shapeType: 'geo', geo: 'octagon',
    color: 'red', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 140, h: 140,
  },
  star: {
    shapeType: 'geo', geo: 'star',
    color: 'yellow', fill: 'solid', dash: 'solid', size: 'l', font: 'sans',
    w: 140, h: 140,
  },
  heart: {
    shapeType: 'geo', geo: 'heart',
    color: 'red', fill: 'solid', dash: 'solid', size: 'l', font: 'sans',
    w: 120, h: 120,
  },
  trapezoid: {
    shapeType: 'geo', geo: 'trapezoid',
    color: 'blue', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 180, h: 60,
  },
  rhombus: {
    shapeType: 'geo', geo: 'rhombus',
    color: 'violet', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 200, h: 60,
  },
  oval: {
    shapeType: 'geo', geo: 'oval',
    color: 'light-green', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 180, h: 60,
  },
  check: {
    shapeType: 'geo', geo: 'check-box',
    color: 'green', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 80, h: 80,
  },
  cross: {
    shapeType: 'geo', geo: 'x-box',
    color: 'red', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 80, h: 80,
  },

  // ── Ok Şekilleri ──
  'arrow-right': {
    shapeType: 'geo', geo: 'arrow-right',
    color: 'green', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 160, h: 60,
  },
  'arrow-left': {
    shapeType: 'geo', geo: 'arrow-left',
    color: 'orange', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 160, h: 60,
  },
  'arrow-up': {
    shapeType: 'geo', geo: 'arrow-up',
    color: 'blue', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 80, h: 120,
  },
  'arrow-down': {
    shapeType: 'geo', geo: 'arrow-down',
    color: 'red', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 80, h: 120,
  },

  // ── Özel Amaçlı (draw.io karşılıkları) ──
  warning: {
    shapeType: 'geo', geo: 'triangle',
    color: 'yellow', fill: 'solid', dash: 'solid', size: 'l', font: 'sans',
    w: 140, h: 120,
  },
  manual: {
    shapeType: 'geo', geo: 'trapezoid',
    color: 'light-violet', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 180, h: 60,
  },
  preparation: {
    shapeType: 'geo', geo: 'hexagon',
    color: 'light-blue', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 180, h: 60,
  },
  display: {
    shapeType: 'geo', geo: 'rhombus-2',
    color: 'light-green', fill: 'semi', dash: 'solid', size: 'l', font: 'sans',
    w: 200, h: 60,
  },
};

// ─── Bracket → Kategori Mapping ───────────────────

/**
 * Mermaid bracket tipini node kategorisine çevir:
 *
 * Mermaid bracket   → draw.io karşılığı     → tldraw geo
 * ─────────────────────────────────────────────────────────
 * [text]            → Process               → rectangle
 * (text)            → Rounded Rectangle     → oval
 * {text}            → Decision/Diamond      → diamond
 * ((text))          → Circle                → ellipse
 * ([text])          → Stadium/Terminal      → oval (start)
 * [(text)]          → Cylinder/Database     → ellipse
 * >text]            → Asymmetric/Flag       → rhombus (io)
 * {{text}}          → Hexagon               → hexagon
 * [/text/]          → Parallelogram         → rhombus
 * [\text\]          → Parallelogram alt     → rhombus
 * [/text\]          → Trapezoid             → trapezoid
 * [\text/]          → Inv. Trapezoid        → trapezoid
 * [[text]]          → Subroutine            → rectangle (dashed)
 */
export function bracketToCategory(bracket: string): NodeCategory {
  // @{shape: xxx} syntax — Mermaid v11.3+ genişletilmiş şekiller
  if (bracket.startsWith('@shape:')) {
    return mermaidShapeToCategory(bracket.slice(7));
  }

  switch (bracket) {
    case '{}': return 'decision';
    case '{{}}': return 'preparation';  // hexagon
    case '(())': return 'database';     // circle/ellipse
    case '((()))': return 'database';   // double circle → ellipse (büyük)
    case '()': return 'oval';           // rounded
    case '([])': return 'start';        // stadium/terminal
    case '[()]': return 'database';     // cylinder
    case '>]': return 'io';             // flag/asymmetric
    case '[//]': return 'rhombus';      // parallelogram
    case '[\\\\]': return 'rhombus';    // parallelogram alt
    case '[/\\]': return 'trapezoid';   // trapezoid
    case '[\\/]': return 'trapezoid';   // inv. trapezoid
    case '[[]]': return 'process';      // subroutine (dashed border)
    case '[]':
    default: return 'default';
  }
}

/**
 * Mermaid @{shape: xxx} kısa adını NodeCategory'ye maple.
 * 30+ Mermaid şeklinin tümü tldraw'ın 20 geo tipine dağıtılır.
 */
function mermaidShapeToCategory(shape: string): NodeCategory {
  switch (shape) {
    // ── Temel ──
    case 'rect': return 'process';
    case 'rounded': return 'oval';
    case 'stadium': return 'start';
    case 'fr-rect': return 'process';     // subroutine → dashed rect
    case 'cyl': return 'database';
    case 'circle': return 'database';     // circle → ellipse
    case 'dbl-circ': return 'database';   // double circle
    case 'sm-circ': return 'database';    // small circle
    case 'fr-circ': return 'end';         // framed circle → stop
    case 'f-circ': return 'database';     // junction
    case 'odd': return 'io';              // odd → rhombus
    case 'diam': return 'decision';
    case 'hex': return 'preparation';

    // ── Parallelogram / Trapezoid ──
    case 'lean-r': return 'rhombus';      // parallelogram
    case 'lean-l': return 'rhombus';      // parallelogram alt
    case 'trap-b': return 'trapezoid';    // trapezoid
    case 'trap-t': return 'manual';       // manual operation → trapezoid

    // ── Geometrik ──
    case 'tri': return 'triangle';        // extract → triangle
    case 'flip-tri': return 'triangle';   // manual file → triangle
    case 'cloud': return 'cloud';
    case 'bolt': return 'star';           // communication link → star
    case 'bang': return 'star';           // bang → star
    case 'hourglass': return 'decision';   // collate → diamond

    // ── Belge / Kart ──
    case 'doc': return 'default';         // document → rectangle
    case 'docs': return 'default';        // multi-document → rectangle
    case 'lin-doc': return 'default';     // lined document
    case 'tag-doc': return 'default';     // tagged document
    case 'notch-rect': return 'default';  // card → rectangle
    case 'tag-rect': return 'default';    // tagged process
    case 'lin-rect': return 'process';    // lined/shaded process
    case 'div-rect': return 'process';    // divided process
    case 'st-rect': return 'process';     // multi-process

    // ── Özel ──
    case 'flag': return 'io';             // paper tape → flag
    case 'delay': return 'oval';          // delay → oval
    case 'h-cyl': return 'database';      // direct access storage
    case 'lin-cyl': return 'database';    // disk storage
    case 'curv-trap': return 'display';   // display → rhombus-2
    case 'sl-rect': return 'rhombus';     // manual input → rhombus
    case 'bow-rect': return 'oval';       // stored data → oval
    case 'cross-circ': return 'cross';    // summary → x-box
    case 'win-pane': return 'check';      // internal storage → check-box
    case 'fork': return 'default';        // fork/join → thin rectangle
    case 'notch-pent': return 'pentagon'; // loop limit → pentagon
    case 'text': return 'default';        // text block

    // ── Yorum / Brace ──
    case 'brace': return 'default';
    case 'brace-r': return 'default';
    case 'braces': return 'default';

    default: return 'default';
  }
}

/**
 * İlk ve son node'ları algıla — akış diyagramında başlangıç/bitiş renkleri
 */
export function inferCategory(
  nodeId: string,
  bracket: string,
  isFirst: boolean,
  isLast: boolean,
): NodeCategory {
  const base = bracketToCategory(bracket);
  if (base !== 'default') return base;
  if (isFirst) return 'start';
  if (isLast) return 'end';
  return 'process';
}

/** Kategori için tema al */
export function getTheme(category: NodeCategory): ShapeTheme {
  return THEMES[category];
}

/** Metin uzunluğuna göre dinamik genişlik hesapla */
export function calcWidth(text: string, base: number): number {
  const charWidth = 10;
  const minW = base;
  const textW = text.length * charWidth + 40;
  return Math.max(minW, textW);
}

/** Doğrudan geo tipi belirterek tema al (AI komutları için) */
export function getThemeByGeo(geo: GeoType): ShapeTheme {
  // Geo tipine göre en uygun temayı bul
  for (const theme of Object.values(THEMES)) {
    if (theme.geo === geo && theme.shapeType === 'geo') return theme;
  }
  return { ...THEMES.default, geo };
}

/** Tüm kullanılabilir kategori isimlerini döndür */
export function getAllCategories(): NodeCategory[] {
  return Object.keys(THEMES) as NodeCategory[];
}
