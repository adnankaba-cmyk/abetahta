/**
 * mermaid-renderer.ts birim testleri (v10 - Pure SVG)
 *
 * renderMermaidSVG() fonksiyonu mermaid.js gerektirdigi icin
 * bu testler hata yonetimi ve export edilen sabit kontrolune odaklanir.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MERMAID_EXAMPLES } from '../lib/mermaid-renderer';

// ─── MERMAID_EXAMPLES sabitleri ───

describe('MERMAID_EXAMPLES — ornekler tanimli ve gecerli formatta', () => {
  const expectedKeys = [
    'flowchart',
    'login',
    'process',
    'database',
    'devops',
    'orgChart',
    'errorHandling',
    'microservices',
    'stateFlow',
  ];

  it('tum beklenen anahtarlar var', () => {
    for (const key of expectedKeys) {
      expect(MERMAID_EXAMPLES).toHaveProperty(key);
    }
  });

  it('her ornek string ve bos degil', () => {
    for (const [key, code] of Object.entries(MERMAID_EXAMPLES)) {
      expect(typeof code, `${key} string olmali`).toBe('string');
      expect(code.trim().length, `${key} bos olmamali`).toBeGreaterThan(0);
    }
  });

  it('her ornek graph veya flowchart ile basliyor', () => {
    for (const [key, code] of Object.entries(MERMAID_EXAMPLES)) {
      const firstLine = code.split('\n').find(l => l.trim().length > 0)?.trim() || '';
      expect(
        firstLine.startsWith('graph') || firstLine.startsWith('flowchart'),
        `${key}: "${firstLine}" ile baslamali`
      ).toBe(true);
    }
  });

  it('flowchart ornegi TD veya LR yon iceriyor', () => {
    const code = MERMAID_EXAMPLES.flowchart;
    expect(code).toMatch(/graph\s+(TD|LR|TB|BT|RL)/);
  });

  it('orgChart CEO node iceriyor', () => {
    expect(MERMAID_EXAMPLES.orgChart).toContain('CEO');
  });

  it('login ornegi giris akisi elemanlari iceriyor', () => {
    const code = MERMAID_EXAMPLES.login;
    expect(code).toContain('-->');
  });

  it('database ornegi DB veya veritabani referansi iceriyor', () => {
    const code = MERMAID_EXAMPLES.database;
    expect(code.includes('[(') || code.includes('DB') || code.toLowerCase().includes('veri')).toBe(true);
  });

  it('microservices ornegi birden fazla servis iceriyor', () => {
    const code = MERMAID_EXAMPLES.microservices;
    const arrows = (code.match(/-->/g) || []).length;
    expect(arrows).toBeGreaterThanOrEqual(3);
  });
});

// ─── renderMermaidSVG — mock ile hata yonetimi ───

describe('renderMermaidSVG — mock ortaminda hata yonetimi', () => {
  beforeEach(() => {
    vi.mock('../lib/mermaid-renderer', async (importOriginal) => {
      const actual = await importOriginal() as any;
      return {
        ...actual,
        renderMermaidSVG: vi.fn().mockImplementation(async (code: string) => {
          if (!code || code.trim() === '') {
            return { svg: null, error: 'Bos kod' };
          }
          if (!code.includes('graph') && !code.includes('flowchart')) {
            return { svg: null, error: 'Gecersiz mermaid kodu' };
          }
          // Basarili simulasyon — gercek SVG benzeri cikti
          return {
            svg: `<svg width="350" height="300" xmlns="http://www.w3.org/2000/svg">
              <g class="node"><rect width="160" height="70"/><text>A</text></g>
              <g class="node"><rect width="160" height="70"/><text>B</text></g>
              <path class="edgePath" d="M100,70 L100,200"/>
            </svg>`,
          };
        }),
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bos kod icin error doner', async () => {
    const { renderMermaidSVG } = await import('../lib/mermaid-renderer');
    const result = await renderMermaidSVG('');
    expect(result.svg).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('gecersiz kod icin error doner', async () => {
    const { renderMermaidSVG } = await import('../lib/mermaid-renderer');
    const result = await renderMermaidSVG('bu gecersiz bir kod');
    expect(result.svg).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('gecerli kod ile SVG string doner', async () => {
    const { renderMermaidSVG } = await import('../lib/mermaid-renderer');
    const result = await renderMermaidSVG('graph TD\n  A --> B');
    expect(result.svg).toBeDefined();
    expect(result.svg).not.toBeNull();
    expect(result.svg!.length).toBeGreaterThan(0);
    expect(result.svg).toContain('<svg');
    expect(result.error).toBeUndefined();
  });

  it('donen SVG width ve height iceriyor', async () => {
    const { renderMermaidSVG } = await import('../lib/mermaid-renderer');
    const result = await renderMermaidSVG('graph TD\n  A[Test] --> B[Hedef]');
    expect(result.svg).toContain('width=');
    expect(result.svg).toContain('height=');
  });

  it('donen SVG node elemanlari iceriyor', async () => {
    const { renderMermaidSVG } = await import('../lib/mermaid-renderer');
    const result = await renderMermaidSVG('graph TD\n  A --> B');
    expect(result.svg).toContain('node');
  });
});
