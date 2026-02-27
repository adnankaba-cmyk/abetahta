/**
 * DSL v2 Resolver — Isimli referanslari ve goreceli konumlari cozer.
 *
 * 2. pas: AST uzerinden gecerek her node'un
 * nihai (x, y) koordinatlarini hesaplar.
 */

import type { AstNode, RelativeNode } from './types';
import type { TLShapeId } from 'tldraw';

// ─── Shape Registry ────────────────────────────────────────

export interface ResolvedShape {
  id: TLShapeId;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class ShapeRegistry {
  private map = new Map<string, ResolvedShape>();

  register(name: string, shape: ResolvedShape): void {
    this.map.set(name, shape);
  }

  get(name: string): ResolvedShape | undefined {
    return this.map.get(name);
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  getLast(): ResolvedShape | undefined {
    const values = Array.from(this.map.values());
    return values.length > 0 ? values[values.length - 1] : undefined;
  }

  getAllIds(): TLShapeId[] {
    return Array.from(this.map.values()).map(s => s.id);
  }

  getByNames(names: string[]): ResolvedShape[] {
    return names.map(n => this.map.get(n)).filter((s): s is ResolvedShape => !!s);
  }
}

// ─── Relative Position Context ─────────────────────────────

/**
 * ALTINA/YANINA/USTUNE komutlari bir "konum context" olusturur.
 * Sonraki shape komutlari bu context'e gore konumlanir.
 */
export interface PositionContext {
  direction: RelativeNode['direction'];
  refName: string;
  offset: number;
}

/**
 * Goreceli konum context'ini kullanarak absolute koordinat hesaplar.
 */
export function resolveRelativePosition(
  ctx: PositionContext,
  registry: ShapeRegistry,
  nodeW: number,
  nodeH: number,
): { x: number; y: number } | null {
  const ref = registry.get(ctx.refName);
  if (!ref) return null;

  switch (ctx.direction) {
    case 'below':
      return { x: ref.x, y: ref.y + ref.h + ctx.offset };
    case 'right':
      return { x: ref.x + ref.w + ctx.offset, y: ref.y };
    case 'above':
      return { x: ref.x, y: ref.y - nodeH - ctx.offset };
    default:
      return null;
  }
}
