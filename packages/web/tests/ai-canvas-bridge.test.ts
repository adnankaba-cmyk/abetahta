/**
 * ai-canvas-bridge.ts birim testleri (v10 - Pure SVG)
 *
 * extractMermaid() ve processAIResponse() fonksiyonlari test edilir.
 * applyMermaidToCanvas() browser DOM + tldraw Editor gerektirdigi icin mock ile test edilir.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractMermaid, applyMermaidToCanvas, processAIResponse, applyCodeDirect } from '../lib/ai-canvas-bridge';

// ─── extractMermaid ───

describe('extractMermaid — Mermaid blok tespiti', () => {
  it('fenced mermaid blok cikarir', () => {
    const text = 'Aciklama:\n```mermaid\ngraph TD\n  A --> B\n```\nDevam metin';
    const result = extractMermaid(text);
    expect(result).not.toBeNull();
    expect(result!.mermaidCode).toContain('graph TD');
    expect(result!.cleanText).toContain('Devam metin');
    expect(result!.cleanText).not.toContain('```mermaid');
  });

  it('mermaid blok yoksa null dondurur', () => {
    const text = 'Bu sadece normal bir metin. Hic diyagram yok.';
    expect(extractMermaid(text)).toBeNull();
  });

  it('bos metinde null dondurur', () => {
    expect(extractMermaid('')).toBeNull();
  });

  it('forceMermaid=true ile tum metni mermaid olarak alir', () => {
    const text = 'graph TD\n  A --> B';
    const result = extractMermaid(text, true);
    expect(result).not.toBeNull();
    expect(result!.mermaidCode).toBe('graph TD\n  A --> B');
    expect(result!.cleanText).toBe('');
  });

  it('graph ile baslayan satiri auto-detect eder', () => {
    const text = 'graph TD\n  A --> B\n  B --> C';
    const result = extractMermaid(text);
    expect(result).not.toBeNull();
    expect(result!.mermaidCode).toContain('graph TD');
  });

  it('flowchart ile baslayan satiri auto-detect eder', () => {
    const text = 'flowchart LR\n  A --> B';
    const result = extractMermaid(text);
    expect(result).not.toBeNull();
    expect(result!.mermaidCode).toContain('flowchart LR');
  });

  it('fenced blokta mermaid kodu trim edilir', () => {
    const text = '```mermaid\n\n  graph TD\n  A --> B\n\n```';
    const result = extractMermaid(text);
    expect(result).not.toBeNull();
    expect(result!.mermaidCode.startsWith(' ')).toBe(false);
  });

  it('birden fazla fenced blokta ilkini alir', () => {
    const text = '```mermaid\ngraph TD\n  A --> B\n```\nArasi\n```mermaid\ngraph LR\n  C --> D\n```';
    const result = extractMermaid(text);
    expect(result).not.toBeNull();
    expect(result!.mermaidCode).toContain('graph TD');
    expect(result!.mermaidCode).not.toContain('graph LR');
  });
});

// ─── applyMermaidToCanvas — mock ile ───

describe('applyMermaidToCanvas — mock editor', () => {
  function createMockEditor() {
    return {
      getViewportPageBounds: vi.fn().mockReturnValue({ midX: 400, midY: 300 }),
      createAssets: vi.fn(),
      createShape: vi.fn(),
      select: vi.fn(),
      zoomToBounds: vi.fn(),
    };
  }

  it('render hatasi olunca applied=false dondurur', async () => {
    const editor = createMockEditor() as any;
    const result = await applyMermaidToCanvas(editor, 'bu-gecersiz-mermaid');
    expect(result.applied).toBe(false);
    expect(result.shapeCount).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('bos kod icin applied=false dondurur', async () => {
    const editor = createMockEditor() as any;
    const result = await applyMermaidToCanvas(editor, '');
    expect(result.applied).toBe(false);
  });
});

// ─── processAIResponse ───

describe('processAIResponse', () => {
  it('editor null ise displayText aynen dondurulur', async () => {
    const result = await processAIResponse(null, 'Test mesaj');
    expect(result.displayText).toBe('Test mesaj');
    expect(result.bridgeResult).toBeNull();
  });

  it('mermaid blok yoksa bridgeResult null dondurur', async () => {
    const mockEditor = {
      getViewportPageBounds: vi.fn().mockReturnValue({ midX: 400, midY: 300 }),
      createAssets: vi.fn(),
      createShape: vi.fn(),
      select: vi.fn(),
      zoomToBounds: vi.fn(),
    } as any;

    const result = await processAIResponse(mockEditor, 'Normal AI yaniti, diyagram yok.');
    expect(result.bridgeResult).toBeNull();
    expect(result.displayText).toBe('Normal AI yaniti, diyagram yok.');
  });
});

// ─── applyCodeDirect ───

describe('applyCodeDirect', () => {
  it('mermaid language ile BridgeResult donduruluyor', async () => {
    const mockEditor = {
      getViewportPageBounds: vi.fn().mockReturnValue({ midX: 400, midY: 300 }),
      createAssets: vi.fn(),
      createShape: vi.fn(),
      select: vi.fn(),
      zoomToBounds: vi.fn(),
    } as any;

    const result = await applyCodeDirect(mockEditor, 'invalid-code', 'mermaid');
    expect(result).toHaveProperty('applied');
    expect(result).toHaveProperty('shapeCount');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('shapesAdded');
  });

  it('applied ile success eslesmeli', async () => {
    const mockEditor = {
      getViewportPageBounds: vi.fn().mockReturnValue({ midX: 400, midY: 300 }),
      createAssets: vi.fn(),
      createShape: vi.fn(),
      select: vi.fn(),
      zoomToBounds: vi.fn(),
    } as any;

    const result = await applyCodeDirect(mockEditor, 'bad-code', 'mermaid');
    expect(result.success).toBe(result.applied);
    expect(result.shapesAdded).toBe(result.shapeCount);
  });
});
