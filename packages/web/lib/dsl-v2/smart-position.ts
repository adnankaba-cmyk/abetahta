/**
 * DSL v2 Smart Position — Akilli yerlestirme algoritmasi.
 *
 * Mekansal haritayi kullanarak cakismayan en uygun konumu bulur.
 */

import type { BoardSpatialMap, BoundingBox, OccupiedRegion } from '../board-spatial';

/**
 * Verilen boyutta bir shape icin en iyi yerlestirme konumunu bulur.
 */
export function findBestPlacement(
  spatialMap: BoardSpatialMap,
  size: { w: number; h: number },
  hint?: 'above' | 'below' | 'left' | 'right' | 'center',
): { x: number; y: number } {
  // 1. Hint'e uyan bos bolge bul
  const candidates = spatialMap.emptyRegions.filter(
    r => r.w >= size.w && r.h >= size.h,
  );

  if (hint && candidates.length > 0) {
    const hintMatch = candidates.find(r => r.position === hint);
    if (hintMatch) {
      return snapToGrid(hintMatch.x + 20, hintMatch.y + 20);
    }
  }

  // 2. En buyuk bos bolge
  if (candidates.length > 0) {
    const best = candidates[0]; // Zaten area'ya gore sirali
    return snapToGrid(best.x + 20, best.y + 20);
  }

  // 3. Icerik altinda (fallback)
  if (spatialMap.contentBounds) {
    const cb = spatialMap.contentBounds;
    return snapToGrid(cb.x, cb.y + cb.h + (spatialMap.stats.averageGap || 80));
  }

  // 4. Viewport merkezi (son fallback)
  const v = spatialMap.viewport;
  return snapToGrid(v.x + v.w / 4, v.y + v.h / 4);
}

/**
 * Verilen bounds'un mevcut sekillerle cakisip cakismadigini kontrol eder.
 * Cakisiyorsa kaydirir.
 */
export function avoidOverlaps(
  bounds: BoundingBox,
  occupied: OccupiedRegion[],
  margin: number = 20,
): { x: number; y: number } {
  let { x, y } = bounds;
  const { w, h } = bounds;

  // Max 5 deneme
  for (let attempt = 0; attempt < 5; attempt++) {
    const hasOverlap = occupied.some(r =>
      x < r.x + r.w + margin &&
      x + w > r.x - margin &&
      y < r.y + r.h + margin &&
      y + h > r.y - margin,
    );

    if (!hasOverlap) break;

    // Kaydir: saga veya asagi
    if (attempt % 2 === 0) {
      x += w + margin * 2;
    } else {
      x -= w + margin * 2; // Sola denemis, asagi git
      y += h + margin * 2;
    }
  }

  return snapToGrid(x, y);
}

function snapToGrid(x: number, y: number, gridSize: number = 10): { x: number; y: number } {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}
