import { mm, point } from '../units';
import type { Triangle } from './types';

export const ARROW_SIZE = mm(1.2);
export const ARROW_TIP_GAP = mm(0.3);
// Exactly the arrow's own footprint from the edge - text stops right where
// the arrow starts, no separate breathing-room gap on top of that.
export const ARROW_FOOTPRINT = ARROW_SIZE + ARROW_TIP_GAP;

// Small rightward-pointing triangles, one per row, sitting just left of the
// edge they point into. Same arithmetic as the writer's drawHeaderArrowsLeft.
export function headerArrowsLeft(count: number, edgeX: number, startY: number, cellHeight: number): Triangle[] {
  const tipX = edgeX - ARROW_TIP_GAP;
  const baseX = tipX - ARROW_SIZE;
  const arrows: Triangle[] = [];
  for (let i = 0; i < count; i++) {
    const cy = startY + cellHeight * i + cellHeight / 2;
    arrows.push([point(baseX, cy - ARROW_SIZE / 2), point(baseX, cy + ARROW_SIZE / 2), point(tipX, cy)]);
  }
  return arrows;
}
