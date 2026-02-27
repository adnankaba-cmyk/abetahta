/**
 * AI → Canvas Köprüsü (v11 - Native tldraw Shapes)
 *
 * Öncelik: Mermaid kodu parse edilir → dagre layout → native tldraw geo + arrow shapes.
 * Fallback: Parse başarısız olursa eski SVG image yöntemine düşer.
 * Sonuç: Her kutu/ok bağımsız seçilebilir, taşınabilir, düzenlenebilir.
 */

import { Editor, createShapeId, AssetRecordType } from 'tldraw';
import { renderMermaidSVG } from './mermaid-renderer';
import { parseMermaidToGraph, layoutGraph, createTldrawShapes } from './flowchart-layout';
import { executeDsl } from './tahta-dsl';
import { isDslV2, executeDslV2 } from './dsl-v2';
import { buildSpatialMap } from './board-spatial';
import { findBestPlacement } from './dsl-v2/smart-position';
import { aiLog } from './logger';

/**
 * Yeni oluşturulan şekillerin üst üste binmesini düzeltir.
 * Her şeklin bounds'unu kontrol eder, çakışma varsa aşağı kaydırır.
 */
function fixOverlappingShapes(
  editor: Editor,
  dslResult: { shapeCount: number; createdShapeIds?: string[] },
): void {
  const allShapes = editor.getCurrentPageShapes();
  const createdSet = new Set((dslResult as { createdShapeIds?: string[] }).createdShapeIds || []);
  const newShapeIds = createdSet.size > 0
    ? allShapes.filter(s => createdSet.has(s.id)).map(s => s.id)
    : allShapes.slice(-dslResult.shapeCount).map(s => s.id);

  if (newShapeIds.length < 2) return;

  const MARGIN = 20;
  const placed: Array<{ id: string; x: number; y: number; w: number; h: number }> = [];

  for (const shapeId of newShapeIds) {
    const bounds = editor.getShapePageBounds(shapeId);
    const shape = editor.getShape(shapeId);
    if (!bounds || !shape) continue;

    const { x } = shape;
    let { y } = shape;
    const { w, h } = bounds;

    // Bu shape önceki placed shape'lerle çakışıyor mu?
    let attempts = 0;
    while (attempts < 10) {
      const overlap = placed.find(p =>
        x < p.x + p.w + MARGIN &&
        x + w > p.x - MARGIN &&
        y < p.y + p.h + MARGIN &&
        y + h > p.y - MARGIN,
      );
      if (!overlap) break;

      // Aşağı kaydır
      y = overlap.y + overlap.h + MARGIN;
      attempts++;
    }

    // Eğer konum değiştiyse güncelle
    if (Math.abs(y - shape.y) > 1 || Math.abs(x - shape.x) > 1) {
      editor.updateShape({ id: shapeId, type: shape.type, x, y });
    }

    placed.push({ id: String(shapeId), x, y, w, h });
  }
}

export interface BridgeResult {
  applied: boolean;
  shapeCount: number;
  errors: string[];
  cleanText: string;
  success?: boolean;
  shapesAdded?: number;
  error?: string;
}

/**
 * AI yanitindan Mermaid kodunu cikarir.
 */
export function extractMermaid(
  text: string,
  forceMermaid?: boolean,
): { mermaidCode: string; cleanText: string } | null {
  aiLog.debug('extractMermaid cagirildi, metin uzunlugu:', text.length);

  // 1. Mermaid fenced block: ```mermaid ... ```
  const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/gi;
  const mermaidMatch = mermaidRegex.exec(text);
  if (mermaidMatch) {
    const mermaidCode = mermaidMatch[1].trim();
    const cleanText = text.replace(mermaidMatch[0], '').trim();
    aiLog.info('Mermaid bloku bulundu (fenced), satir sayisi:', mermaidCode.split('\n').length);
    return { mermaidCode, cleanText };
  }

  // 2. Force mermaid
  if (forceMermaid) {
    aiLog.info('Force mermaid, tum metin mermaid olarak aliniyor');
    return { mermaidCode: text.trim(), cleanText: '' };
  }

  // 3. Auto-detect: "graph" veya "flowchart" ile baslayan satir
  const firstContentLine = text.split('\n').find(l => l.trim().length > 0)?.trim() || '';
  if (/^(?:graph|flowchart)\s/i.test(firstContentLine)) {
    aiLog.info('Mermaid auto-detect: graph/flowchart satiri bulundu');
    return { mermaidCode: text.trim(), cleanText: '' };
  }

  aiLog.debug('Mermaid bulunamadi');
  return null;
}

/**
 * AI yanitindan DSL kodunu cikarir.
 */
export function extractDsl(text: string): { dslCode: string; cleanText: string } | null {
  const dslRegex = /```dsl\s*\n([\s\S]*?)```/gi;
  const dslMatch = dslRegex.exec(text);
  if (dslMatch) {
    const dslCode = dslMatch[1].trim();
    const cleanText = text.replace(dslMatch[0], '').trim();
    aiLog.info('DSL bloku bulundu, satir sayisi:', dslCode.split('\n').length);
    return { dslCode, cleanText };
  }
  return null;
}

/**
 * SVG stringinden boyutlari cikarir.
 */
function parseSvgDimensions(svg: string): { width: number; height: number } {
  // width/height attribute'larini dene
  const wMatch = svg.match(/width="([\d.]+)/);
  const hMatch = svg.match(/height="([\d.]+)/);
  if (wMatch && hMatch) {
    return { width: parseFloat(wMatch[1]), height: parseFloat(hMatch[1]) };
  }

  // viewBox'tan dene
  const vbMatch = svg.match(/viewBox="[\d.\s]+ [\d.\s]+ ([\d.]+) ([\d.]+)"/);
  if (vbMatch) {
    return { width: parseFloat(vbMatch[1]), height: parseFloat(vbMatch[2]) };
  }

  // Fallback
  return { width: 600, height: 400 };
}

/**
 * Mermaid kodunu native tldraw shape'lere çevirir.
 * Başarısız olursa eski SVG fallback yöntemine düşer.
 */
export async function applyMermaidToCanvas(
  editor: Editor,
  mermaidCode: string,
  anchorPoint?: { x: number; y: number },
): Promise<BridgeResult> {
  aiLog.info('applyMermaidToCanvas (v11 native shapes), kod uzunlugu:', mermaidCode.length);

  // ── Yeni Yol: Native tldraw shapes + dagre layout ──
  try {
    const graph = parseMermaidToGraph(mermaidCode);
    if (graph && graph.nodes.length > 0) {
      const layout = layoutGraph(graph);
      const result = createTldrawShapes(editor, layout, anchorPoint);

      aiLog.info('Native shape diyagram eklendi:', {
        nodes: layout.nodes.length,
        edges: layout.edges.length,
        totalShapes: result.shapeCount,
      });

      // Diyagrama zoom — sadece yeni eklenen sekilleri sec
      if (result.shapeIds.length > 0) {
        editor.select(...result.shapeIds as any);
        editor.zoomToSelection({ animation: { duration: 200 } });
        editor.selectNone();
      }

      return {
        applied: true,
        shapeCount: result.shapeCount,
        errors: [],
        cleanText: '',
      };
    }

    aiLog.info('Mermaid parse basarisiz, SVG fallback deneniyor...');
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    aiLog.warn('Native shape olusturma basarisiz, SVG fallback:', msg);
  }

  // ── Fallback: Eski SVG image yöntemi ──
  return applyMermaidSvgFallback(editor, mermaidCode, anchorPoint);
}

/**
 * Fallback: Mermaid kodunu mermaid.js ile SVG'ye render edip,
 * tldraw canvas'a tek bir image shape olarak ekler.
 */
async function applyMermaidSvgFallback(
  editor: Editor,
  mermaidCode: string,
  anchorPoint?: { x: number; y: number },
): Promise<BridgeResult> {
  try {
    const svgResult = await renderMermaidSVG(mermaidCode);

    if (svgResult.error || !svgResult.svg) {
      aiLog.warn('Mermaid SVG render basarisiz:', svgResult.error);
      return {
        applied: false,
        shapeCount: 0,
        errors: [svgResult.error || 'SVG render edilemedi'],
        cleanText: mermaidCode,
      };
    }

    const { width, height } = parseSvgDimensions(svgResult.svg);
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgResult.svg)))}`;

    const assetId = AssetRecordType.createId();
    editor.createAssets([{
      id: assetId,
      type: 'image',
      typeName: 'asset',
      props: {
        name: 'mermaid-diagram.svg',
        src: svgDataUrl,
        w: width,
        h: height,
        mimeType: 'image/svg+xml',
        isAnimated: false,
      },
      meta: {},
    }]);

    let x: number, y: number;
    if (anchorPoint) {
      x = anchorPoint.x - width / 2;
      y = anchorPoint.y - height / 2;
    } else {
      const vb = editor.getViewportPageBounds();
      x = vb.midX - width / 2;
      y = vb.midY - height / 2;
    }

    const shapeId = createShapeId();
    editor.createShape({
      id: shapeId,
      type: 'image',
      x,
      y,
      props: { assetId, w: width, h: height },
      meta: {
        createdBy: 'ai',
        createdByName: 'AI Asistan',
        mermaidCode,
        renderMethod: 'svg-fallback',
      },
    });

    editor.select(shapeId);
    const padding = 40;
    editor.zoomToBounds({
      x: x - padding,
      y: y - padding,
      w: width + padding * 2,
      h: height + padding * 2,
    }, { inset: 0 });

    aiLog.info('Mermaid diyagram eklendi (SVG fallback):', { width, height });

    return {
      applied: true,
      shapeCount: 1,
      errors: [],
      cleanText: '',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    aiLog.error('SVG fallback hatasi:', msg);
    return {
      applied: false,
      shapeCount: 0,
      errors: [msg],
      cleanText: mermaidCode,
    };
  }
}

/**
 * Gercek tahta gibi akilli yerlestirme: en buyuk bos bolgeyi bulur.
 * Saga, sola, alta — nerede yer varsa oraya koyar.
 * AnchorPoint verilmisse onu kullanir (kullanici secimi).
 */
function computeSmartAnchor(
  editor: Editor,
  anchorPoint?: { x: number; y: number },
): { x: number; y: number } | undefined {
  if (anchorPoint) return anchorPoint;

  const allShapes = editor.getCurrentPageShapes();
  if (allShapes.length === 0) return undefined;

  // buildSpatialMap ile mekansal analiz yap
  const spatialMap = buildSpatialMap(editor);

  // En buyuk bos bolgeyi bul
  return findBestPlacement(spatialMap, { w: 400, h: 300 });
}

/**
 * AI yanitini isle: Mermaid varsa canvas'a uygula, temiz metni dondur.
 */
export async function processAIResponse(
  editor: Editor | null,
  responseText: string,
  anchorPoint?: { x: number; y: number },
): Promise<{ displayText: string; bridgeResult: BridgeResult | null }> {
  if (!editor) {
    return { displayText: responseText, bridgeResult: null };
  }

  // Akilli anchor: mevcut icerik varsa altina yerlestir
  const smartAnchor = computeSmartAnchor(editor, anchorPoint);

  // 1. DSL bloku var mı? (öncelikli — DSL v2 daha kapsamlı)
  const dslExtracted = extractDsl(responseText);
  if (dslExtracted) {
    // v2 komutu varsa v2 parser, yoksa v1
    const isV2 = isDslV2(dslExtracted.dslCode);
    aiLog.info('DSL version:', isV2 ? 'v2' : 'v1');

    const dslResult = isV2
      ? executeDslV2(editor, dslExtracted.dslCode, smartAnchor)
      : executeDsl(editor, dslExtracted.dslCode, smartAnchor);

    // Overlap düzeltme: üst üste binen yeni şekilleri kaydır
    if (dslResult.applied && dslResult.shapeCount > 1) {
      try {
        fixOverlappingShapes(editor, dslResult);
      } catch { /* overlap fix kritik degil */ }
    }

    // Oluşturulan şekillere otomatik zoom
    if (dslResult.applied && dslResult.shapeCount > 0) {
      try {
        const allShapes = editor.getCurrentPageShapes();
        const createdSet = new Set((dslResult as { createdShapeIds?: string[] }).createdShapeIds || []);
        const newShapeIds = createdSet.size > 0
          ? allShapes.filter(s => createdSet.has(s.id)).map(s => s.id)
          : allShapes.slice(-dslResult.shapeCount).map(s => s.id);
        if (newShapeIds.length > 0) {
          editor.select(...newShapeIds);
          editor.zoomToSelection({ animation: { duration: 300 } });
          editor.selectNone();
        }
      } catch { /* zoom hatasi kritik degil */ }
    }

    let displayText = dslExtracted.cleanText;
    if (dslResult.applied) {
      const version = isV2 ? 'DSL v2' : 'DSL';
      displayText += `\n\n${version} ile ${dslResult.shapeCount} sekil canvas'a eklendi.`;
    }
    if (dslResult.errors.length > 0) {
      displayText += `\nDSL hatalari: ${dslResult.errors.join(', ')}`;
    }
    const bridgeResult: BridgeResult = {
      applied: dslResult.applied,
      shapeCount: dslResult.shapeCount,
      errors: dslResult.errors,
      cleanText: displayText,
    };
    return { displayText, bridgeResult };
  }

  // 2. Mermaid bloku var mı?
  const mermaidExtracted = extractMermaid(responseText);
  if (mermaidExtracted) {
    const bridgeResult = await applyMermaidToCanvas(editor, mermaidExtracted.mermaidCode, smartAnchor);
    let displayText = mermaidExtracted.cleanText;
    if (bridgeResult.applied) {
      const method = bridgeResult.shapeCount > 1 ? 'native shapes' : 'SVG image';
      displayText += `\n\nDiyagram canvas'a eklendi (${method}, ${bridgeResult.shapeCount} shape).`;
    }
    if (bridgeResult.errors.length > 0) {
      displayText += `\nMermaid hatalari: ${bridgeResult.errors.join(', ')}`;
    }
    return { displayText, bridgeResult };
  }

  return { displayText: responseText, bridgeResult: null };
}

/**
 * Dogrudan Mermaid kodu yapistirip calistirmak icin.
 */
export async function applyCodeDirect(
  editor: Editor,
  code: string,
  language: 'mermaid',
  anchorPoint?: { x: number; y: number },
): Promise<BridgeResult> {
  const result = await applyMermaidToCanvas(editor, code, anchorPoint);
  return {
    ...result,
    success: result.applied,
    shapesAdded: result.shapeCount,
    error: result.errors.length > 0 ? result.errors.join(', ') : undefined,
  };
}
