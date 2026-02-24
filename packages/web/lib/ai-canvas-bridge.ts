/**
 * AI → Canvas Köprüsü (v10 - Pure Mermaid SVG)
 *
 * mermaid.js SVG'yi direkt render eder, tldraw canvas'a tek image shape olarak ekler.
 * Layout tamamen mermaid.js'e birakilir — üst üste binme sorunu yok.
 */

import { Editor, createShapeId, AssetRecordType } from 'tldraw';
import { renderMermaidSVG } from './mermaid-renderer';
import { aiLog } from './logger';

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
 * Mermaid kodunu mermaid.js ile SVG'ye render edip,
 * tldraw canvas'a tek bir image shape olarak ekler.
 */
export async function applyMermaidToCanvas(
  editor: Editor,
  mermaidCode: string,
  anchorPoint?: { x: number; y: number },
): Promise<BridgeResult> {
  aiLog.info('applyMermaidToCanvas (pure SVG), kod uzunlugu:', mermaidCode.length);

  try {
    // 1. Mermaid.js ile SVG render et
    const svgResult = await renderMermaidSVG(mermaidCode);

    if (svgResult.error || !svgResult.svg) {
      aiLog.warn('Mermaid render basarisiz:', svgResult.error);
      return {
        applied: false,
        shapeCount: 0,
        errors: [svgResult.error || 'SVG render edilemedi'],
        cleanText: mermaidCode,
      };
    }

    // 2. SVG boyutlarini cikar
    const { width, height } = parseSvgDimensions(svgResult.svg);
    aiLog.info('SVG boyutlari:', { width, height });

    // 3. SVG → data URL
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgResult.svg)))}`;

    // 4. tldraw asset olustur
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

    // 5. Anchor noktasi — diyagrami merkeze yerles
    let x: number, y: number;
    if (anchorPoint) {
      x = anchorPoint.x - width / 2;
      y = anchorPoint.y - height / 2;
    } else {
      const vb = editor.getViewportPageBounds();
      x = vb.midX - width / 2;
      y = vb.midY - height / 2;
    }

    // 6. tldraw image shape olustur
    const shapeId = createShapeId();
    editor.createShape({
      id: shapeId,
      type: 'image',
      x,
      y,
      props: {
        assetId,
        w: width,
        h: height,
      },
      meta: {
        createdAt: new Date().toISOString(),
        createdBy: 'ai',
        createdByName: 'AI Asistan',
        mermaidCode, // kaynak kodu sakla — sonra duzenlemek icin
      },
    });

    // 7. Shape'i sec + zoom
    editor.select(shapeId);
    const padding = 40;
    editor.zoomToBounds({
      x: x - padding,
      y: y - padding,
      w: width + padding * 2,
      h: height + padding * 2,
    }, { inset: 0 });

    aiLog.info('Mermaid diyagram eklendi (pure SVG image):', { width, height });

    return {
      applied: true,
      shapeCount: 1,
      errors: [],
      cleanText: '',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    aiLog.error('Canvas\'a ekleme hatasi:', msg);
    return {
      applied: false,
      shapeCount: 0,
      errors: [msg],
      cleanText: mermaidCode,
    };
  }
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

  const extracted = extractMermaid(responseText);
  if (!extracted) {
    return { displayText: responseText, bridgeResult: null };
  }

  const bridgeResult = await applyMermaidToCanvas(editor, extracted.mermaidCode, anchorPoint);

  let displayText = extracted.cleanText;
  if (bridgeResult.applied) {
    displayText += '\n\nMermaid diyagrami canvas\'a eklendi.';
  }
  if (bridgeResult.errors.length > 0) {
    displayText += `\nMermaid hatalari: ${bridgeResult.errors.join(', ')}`;
  }

  return { displayText, bridgeResult };
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
