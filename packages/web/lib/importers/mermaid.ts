/**
 * Mermaid Diagram File Importer (v10 - Pure SVG)
 *
 * .mmd / .mermaid dosyalarini mermaid.js ile SVG'ye render edip
 * tek bir tldraw image shape olarak canvas'a ekler.
 */

import { Editor } from 'tldraw';
import { applyMermaidToCanvas } from '../ai-canvas-bridge';
import { importLog } from '../logger';

/**
 * Mermaid dosyasini canvas'a import eder.
 * Pure SVG: mermaid.js layout yapar, tek image shape olusur.
 * Async — dosya import handler'da await ile kullanilmali.
 */
export async function importMermaidToCanvas(editor: Editor, code: string): Promise<number> {
  importLog.info('Mermaid import basliyor (pure SVG)');

  const trimmed = code.trim();
  if (!trimmed) {
    importLog.warn('Mermaid: bos kod');
    return 0;
  }

  const result = await applyMermaidToCanvas(editor, trimmed);

  if (result.applied) {
    importLog.info('Mermaid import tamamlandi: 1 diyagram eklendi');
    return 1;
  }

  importLog.error('Mermaid import basarisiz:', result.errors.join(', '));
  return 0;
}
