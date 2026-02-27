/**
 * Flowchart Layout Motoru — Mermaid Parser + dagre Layout + tldraw Shape Üretici
 *
 * 1. parseMermaidToGraph() — Mermaid kodunu node/edge listesine çevirir
 * 2. layoutGraph()         — dagre ile otomatik hiyerarşik layout hesaplar
 * 3. createTldrawShapes()  — tldraw geo + arrow shape'leri canvas'a ekler
 */

import dagre from 'dagre';
import { Editor, createShapeId } from 'tldraw';
import {
  type NodeCategory,
  type ShapeTheme,
  inferCategory,
  getTheme,
  calcWidth,
} from './shape-themes';

// ─── Tipler ──────────────────────────────────────

export interface FlowNode {
  id: string;
  label: string;
  bracket: string;   // '[]', '{}', '(())', '([])', '[()]', '>]', '@shape:xxx'
}

export interface FlowEdge {
  from: string;
  to: string;
  label: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction: 'TB' | 'LR' | 'BT' | 'RL';
}

interface LayoutNode extends FlowNode {
  x: number;
  y: number;
  w: number;
  h: number;
  category: NodeCategory;
  theme: ShapeTheme;
}

interface LayoutResult {
  nodes: LayoutNode[];
  edges: FlowEdge[];
  direction: 'TB' | 'LR' | 'BT' | 'RL';
}

// ─── 1. Mermaid Parser ──────────────────────────

/**
 * Mermaid kodundan node ve edge tanımlarını çıkarır.
 *
 * Desteklenen formatlar:
 *   Node: A[Metin], B{Karar?}, C((Daire)), D([Yuvarlak]), E[(DB)], F>Flag]
 *   Edge: A --> B, A -->|Label| B, A --- B, A -.-> B, A ==> B
 */
export function parseMermaidToGraph(code: string): FlowGraph | null {
  const lines = code.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return null;

  // Yön: graph TD, flowchart LR, vs.
  let direction: FlowGraph['direction'] = 'TB';
  const headerMatch = lines[0].match(/^(?:graph|flowchart)\s+(TD|TB|LR|BT|RL)/i);
  if (headerMatch) {
    const dir = headerMatch[1].toUpperCase();
    direction = (dir === 'TD' ? 'TB' : dir) as FlowGraph['direction'];
  }

  const nodeMap = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  // Node tanımı regex: ID + bracket ile metin
  // A[Metin], B{Karar?}, C((Daire)), D([Yuvarlak]), E[(DB)], F>Bayrak]
  const nodeDefRegex = /([A-Za-z_]\w*)\s*(\[{2}|[\[{(>])(\[?)(\(?)([^[\]{}()>]*?)(\)?)(\]?)([\]}>}]|\)\)|\]\))/g;

  // Edge tanım regex: A -->|Label| B veya A --> B
  const edgeRegex = /([A-Za-z_]\w*)\s*([-=.]+>|---)\s*(?:\|([^|]*)\|)?\s*([A-Za-z_]\w*)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && headerMatch) continue; // header satırını atla

    // Edge'leri bul — önce bracket içeriklerini strip et
    // Böylece "A[Basla] --> B{Karar?}" → "A --> B" olur ve edge regex çalışır
    const strippedLine = line
      .replace(/(\w)@\{[^}]*\}/g, '$1')       // ID@{shape:...} → ID
      .replace(/(\w)\(\(\([^)]*\)\)\)/g, '$1') // ID(((text))) → ID
      .replace(/(\w)\{\{[^}]*\}\}/g, '$1')    // ID{{text}} → ID
      .replace(/(\w)\(\([^)]*\)\)/g, '$1')    // ID((text)) → ID
      .replace(/(\w)\(\[[^\]]*\]\)/g, '$1')   // ID([text]) → ID
      .replace(/(\w)\[\([^)]*\)\]/g, '$1')    // ID[(text)] → ID
      .replace(/(\w)\[\[[^\]]*\]\]/g, '$1')   // ID[[text]] → ID
      .replace(/(\w)\[\/[^/]*\/\]/g, '$1')    // ID[/text/] → ID
      .replace(/(\w)\[\\[^\\]*\\]/g, '$1')    // ID[\text\] → ID
      .replace(/(\w)\[\/[^\\]*\\]/g, '$1')    // ID[/text\] → ID
      .replace(/(\w)\[\\[^/]*\/\]/g, '$1')    // ID[\text/] → ID
      .replace(/(\w)\{[^}]*\}/g, '$1')        // ID{text} → ID
      .replace(/(\w)\([^)]*\)/g, '$1')        // ID(text) → ID
      .replace(/(\w)>([^\]]*)\]/g, '$1')      // ID>text] → ID
      .replace(/(\w)\[[^\]]*\]/g, '$1');       // ID[text] → ID

    let edgeMatch: RegExpExecArray | null;
    const edgeRe = new RegExp(edgeRegex.source, 'g');
    while ((edgeMatch = edgeRe.exec(strippedLine)) !== null) {
      const fromId = edgeMatch[1];
      const edgeLabel = edgeMatch[3]?.trim() || '';
      const toId = edgeMatch[4];

      edges.push({ from: fromId, to: toId, label: edgeLabel });

      // Edge'den düz node ID'si varsa kaydet (metin olmadan)
      if (!nodeMap.has(fromId)) {
        nodeMap.set(fromId, { id: fromId, label: fromId, bracket: '[]' });
      }
      if (!nodeMap.has(toId)) {
        nodeMap.set(toId, { id: toId, label: toId, bracket: '[]' });
      }
    }

    // Tam node tanımlarını bul: A[Metin], B{Karar?} vs.
    parseNodeDefs(line, nodeMap);
  }

  if (nodeMap.size === 0) return null;

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    direction,
  };
}

/** Satırdaki node tanımlarını parse et */
function parseNodeDefs(line: string, nodeMap: Map<string, FlowNode>) {
  // 1. Yeni @{shape} syntax: A@{ shape: tri, label: "Metin" }
  const shapeRegex = /([A-Za-z_]\w*)\s*@\{\s*shape:\s*([a-z-]+)(?:\s*,\s*label:\s*"([^"]*)")?\s*\}/g;
  let shapeMatch: RegExpExecArray | null;
  while ((shapeMatch = shapeRegex.exec(line)) !== null) {
    const id = shapeMatch[1];
    const shapeName = shapeMatch[2];
    const label = shapeMatch[3]?.trim() || id;
    nodeMap.set(id, { id, label, bracket: `@shape:${shapeName}` });
  }

  // 2. Bracket syntax: en spesifik → en genel sırayla
  const patterns: Array<{ regex: RegExp; bracket: string }> = [
    { regex: /([A-Za-z_]\w*)\s*\(\(\(([^)]*)\)\)\)/g, bracket: '((()))' }, // (((text))) double circle
    { regex: /([A-Za-z_]\w*)\s*\{\{([^}]*)\}\}/g, bracket: '{{}}' },      // {{text}} hexagon
    { regex: /([A-Za-z_]\w*)\s*\(\(([^)]*)\)\)/g, bracket: '(())' },      // ((text)) circle
    { regex: /([A-Za-z_]\w*)\s*\(\[([^\]]*)\]\)/g, bracket: '([])' },     // ([text]) stadium
    { regex: /([A-Za-z_]\w*)\s*\[\(([^)]*)\)\]/g, bracket: '[()]' },      // [(text)] cylinder
    { regex: /([A-Za-z_]\w*)\s*\[\[([^\]]*)\]\]/g, bracket: '[[]]' },     // [[text]] subroutine
    { regex: /([A-Za-z_]\w*)\s*\[\/([^/]*)\/\]/g, bracket: '[//]' },      // [/text/] parallelogram
    { regex: /([A-Za-z_]\w*)\s*\[\\([^\\]*)\\]/g, bracket: '[\\\\]' },    // [\text\] parallelogram alt
    { regex: /([A-Za-z_]\w*)\s*\[\/([^\\]*)\\]/g, bracket: '[/\\]' },     // [/text\] trapezoid
    { regex: /([A-Za-z_]\w*)\s*\[\\([^/]*)\/\]/g, bracket: '[\\/]' },     // [\text/] inv trapezoid
    { regex: /([A-Za-z_]\w*)\s*\{([^}]*)\}/g, bracket: '{}' },            // {text} diamond
    { regex: /([A-Za-z_]\w*)\s*\(([^)]*)\)/g, bracket: '()' },            // (text) rounded
    { regex: /([A-Za-z_]\w*)\s*>([^\]]*)\]/g, bracket: '>]' },            // >text] flag
    { regex: /([A-Za-z_]\w*)\s*\[([^\]]*)\]/g, bracket: '[]' },           // [text] rectangle
  ];

  for (const { regex, bracket } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      const id = match[1];
      const label = match[2].trim();
      const existing = nodeMap.get(id);
      // @shape zaten varsa üzerine yazma, bracket daha spesifikse güncelle
      if (!existing || (existing.bracket === '[]' && !existing.bracket.startsWith('@shape'))) {
        nodeMap.set(id, { id, label, bracket });
      }
    }
  }
}

// ─── 2. dagre Layout ────────────────────────────

/**
 * Graph'ı dagre ile layout'la — her node'a x,y koordinat ata.
 * dagre CENTER koordinat döndürür → tldraw TOP-LEFT'e çevrilir.
 */
export function layoutGraph(graph: FlowGraph): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: graph.direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Node sırasını belirle — ilk ve son node'u bul
  const sourceNodes = new Set(graph.edges.map(e => e.from));
  const targetNodes = new Set(graph.edges.map(e => e.to));
  const firstNodes = graph.nodes.filter(n => !targetNodes.has(n.id));
  const lastNodes = graph.nodes.filter(n => !sourceNodes.has(n.id));

  // Her node'u dagre graph'a ekle
  for (const node of graph.nodes) {
    const isFirst = firstNodes.some(f => f.id === node.id);
    const isLast = lastNodes.some(l => l.id === node.id);
    const category = inferCategory(node.id, node.bracket, isFirst, isLast);
    const theme = getTheme(category);
    const w = calcWidth(node.label, theme.w);
    const h = theme.h;

    g.setNode(node.id, { label: node.label, width: w, height: h });
  }

  // Edge'leri ekle
  for (const edge of graph.edges) {
    g.setEdge(edge.from, edge.to);
  }

  // Layout hesapla
  dagre.layout(g);

  // Sonuçları topla — dagre CENTER verir, TOP-LEFT'e çevir
  const layoutNodes: LayoutNode[] = graph.nodes.map(node => {
    const isFirst = firstNodes.some(f => f.id === node.id);
    const isLast = lastNodes.some(l => l.id === node.id);
    const category = inferCategory(node.id, node.bracket, isFirst, isLast);
    const theme = getTheme(category);
    const w = calcWidth(node.label, theme.w);
    const h = theme.h;
    const dagNode = g.node(node.id);

    return {
      ...node,
      x: dagNode.x - w / 2,   // CENTER → TOP-LEFT
      y: dagNode.y - h / 2,
      w,
      h,
      category,
      theme,
    };
  });

  return { nodes: layoutNodes, edges: graph.edges, direction: graph.direction };
}

// ─── 3. tldraw Shape Üretici ────────────────────

/** TLRichText formatında metin oluştur */
function toRichText(text: string) {
  return {
    type: 'doc' as const,
    content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text }] }],
  };
}

/**
 * Layout sonucunu tldraw canvas'a geo + arrow shape olarak ekler.
 * Her node ayrı seçilebilir, taşınabilir, düzenlenebilir.
 * Arrow'lar binding ile node'lara bağlı — node taşınırsa ok takip eder.
 */
export function createTldrawShapes(
  editor: Editor,
  layout: LayoutResult,
  anchorPoint?: { x: number; y: number },
): { shapeCount: number; shapeIds: string[] } {
  // Offset: diyagramı anchor noktasına veya viewport ortasına konumla
  let offsetX = 0;
  let offsetY = 0;

  if (layout.nodes.length > 0) {
    // Diyagramın bounding box'ını bul
    const minX = Math.min(...layout.nodes.map(n => n.x));
    const minY = Math.min(...layout.nodes.map(n => n.y));
    const maxX = Math.max(...layout.nodes.map(n => n.x + n.w));
    const maxY = Math.max(...layout.nodes.map(n => n.y + n.h));
    const graphW = maxX - minX;
    const graphH = maxY - minY;

    if (anchorPoint) {
      offsetX = anchorPoint.x - graphW / 2 - minX;
      offsetY = anchorPoint.y - graphH / 2 - minY;
    } else {
      const vb = editor.getViewportPageBounds();
      offsetX = vb.midX - graphW / 2 - minX;
      offsetY = vb.midY - graphH / 2 - minY;
    }
  }

  // Node ID → tldraw shape ID map
  const shapeIdMap = new Map<string, ReturnType<typeof createShapeId>>();
  const allShapeIds: string[] = [];

  // ── Shape'leri Oluştur (geo veya note) ──
  for (const node of layout.nodes) {
    const shapeId = createShapeId();
    shapeIdMap.set(node.id, shapeId);
    allShapeIds.push(shapeId as string);

    if (node.theme.shapeType === 'note') {
      // Yapışkan not — ayrı tldraw shape tipi
      editor.createShape({
        id: shapeId,
        type: 'note',
        x: node.x + offsetX,
        y: node.y + offsetY,
        props: {
          color: node.theme.color,
          size: node.theme.size,
          font: node.theme.font,
          richText: toRichText(node.label),
          align: 'middle',
          verticalAlign: 'middle',
        },
        meta: {
          createdBy: 'ai',
          createdByName: 'AI Asistan',
          flowchartNodeId: node.id,
        },
      });
    } else {
      // Geo shape — 20 farklı geometrik tip
      editor.createShape({
        id: shapeId,
        type: 'geo',
        x: node.x + offsetX,
        y: node.y + offsetY,
        props: {
          geo: node.theme.geo,
          w: node.w,
          h: node.h,
          color: node.theme.color,
          fill: node.theme.fill,
          dash: node.theme.dash,
          size: node.theme.size,
          font: node.theme.font,
          richText: toRichText(node.label),
          verticalAlign: 'middle',
          align: 'middle',
        },
        meta: {
          createdBy: 'ai',
          createdByName: 'AI Asistan',
          flowchartNodeId: node.id,
        },
      });
    }
  }

  // ── Arrow Shape'leri + Binding ──
  for (const edge of layout.edges) {
    const fromShapeId = shapeIdMap.get(edge.from);
    const toShapeId = shapeIdMap.get(edge.to);
    if (!fromShapeId || !toShapeId) continue;

    const arrowId = createShapeId();
    allShapeIds.push(arrowId as string);

    // Arrow shape oluştur (pozisyon binding tarafından yönetilecek)
    const arrowProps: Record<string, unknown> = {
      color: 'black',
      size: 'm',
      dash: 'solid',
      fill: 'none',
      arrowheadEnd: 'arrow',
      arrowheadStart: 'none',
    };

    // Edge label varsa richText olarak ekle (tldraw arrow'lar richText kullanır)
    if (edge.label) {
      arrowProps.richText = toRichText(edge.label);
    }

    editor.createShape({
      id: arrowId,
      type: 'arrow',
      x: 0,
      y: 0,
      props: arrowProps,
      meta: {
        createdBy: 'ai',
        createdByName: 'AI Asistan',
      },
    });

    // Binding: arrow'ın start ucunu fromShape'e bağla
    editor.createBinding({
      type: 'arrow',
      fromId: arrowId,
      toId: fromShapeId,
      props: {
        terminal: 'start',
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
      },
    });

    // Binding: arrow'ın end ucunu toShape'e bağla
    editor.createBinding({
      type: 'arrow',
      fromId: arrowId,
      toId: toShapeId,
      props: {
        terminal: 'end',
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
      },
    });
  }

  return { shapeCount: allShapeIds.length, shapeIds: allShapeIds };
}
