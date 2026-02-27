/**
 * DSL v2 — Public API
 *
 * Kullanim:
 *   import { executeDslV2, isDslV2 } from './dsl-v2';
 *   const result = executeDslV2(editor, code, anchorPoint);
 */

import { Editor } from 'tldraw';
import { parseDslV2 } from './parser';
import { executeDslV2Ast } from './executor';
import type { DslExecutionResult } from './types';

// Re-exports
export type { DslExecutionResult, DslParseResult, AstNode } from './types';
export { parseDslV2 } from './parser';
export { executeDslV2Ast } from './executor';
export { ShapeRegistry } from './resolver';
export { layoutRow, layoutColumn, layoutGrid, layoutFlow } from './layout-engine';
export { findBestPlacement, avoidOverlaps } from './smart-position';

// ─── V2 Command Detection ──────────────────────────────────

/** DSL v1'de olmayan v2 komutlari */
const V2_COMMANDS = /^\s*(SEKIL|ŞEKİL|RESIM|RESİM|CERCEVE|ÇERÇEVE|BAG|BAĞ|GRUPLA|ALTINA|YANINA|USTUNE|ÜSTÜNE|SATIR|SUTUN|SÜTUN|GRID|IZGARA|AKIS|AKIŞ)\b/im;

/**
 * DSL kodunun v2 komutu icerip icermedigini kontrol eder.
 * v2 komutu varsa v2 parser kullanilmali.
 */
export function isDslV2(code: string): boolean {
  return V2_COMMANDS.test(code);
}

// ─── Main Entry Point ──────────────────────────────────────

/**
 * DSL v2 kodunu parse edip calistirir.
 */
export function executeDslV2(
  editor: Editor,
  code: string,
  anchorPoint?: { x: number; y: number },
): DslExecutionResult {
  // 1. Parse
  const parseResult = parseDslV2(code);

  // Parse hatalari varsa raporla ama devam et (parsial execution)
  const errors: string[] = parseResult.errors.map(e => `Satir ${e.line}: ${e.message}`);

  if (parseResult.nodes.length === 0) {
    return { applied: false, shapeCount: 0, errors, createdShapeIds: [] };
  }

  // 2. Execute (resolver icsel olarak calisir)
  const execResult = executeDslV2Ast(editor, parseResult.nodes, anchorPoint);

  return {
    applied: execResult.applied,
    shapeCount: execResult.shapeCount,
    errors: [...errors, ...execResult.errors],
    createdShapeIds: execResult.createdShapeIds,
  };
}
