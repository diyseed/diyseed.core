import { Point, Size, point } from '../units';
import * as Config from './config';

// Marks sit in the card's border strip, directly above/below the mesh corner
// - never diagonally inset. Along the card edge they run parallel to (x for
// top marks), they stay flush with the mesh's own edge (= padding); only the
// perpendicular axis (y for top marks) gets the fixed 0.5mm offset, landing
// the mark just outside the mesh, in the border strip.
//
// `pitch` spaces consecutive marks one mesh cell width apart, so the row of
// marks reads at the same scale as the grid they sit above.
export function getTopLeftCornerMarkOffsets(count: number, padding: number, pitch: number): Point[] {
  const y = padding - Config.CORNER_MARK_INSET;
  const offsets: Point[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push(point(padding + i * pitch, y));
  }
  return offsets;
}

export function getTopRightCornerMarkOffset(padding: number): Point {
  return point(-padding, padding - Config.CORNER_MARK_INSET);
}

export function getBottomLeftCornerMarkOffset(padding: number): Point {
  return point(padding, -(padding - Config.CORNER_MARK_INSET));
}

export interface LineSegment {
  from: Point;
  to: Point;
}

// Printer's crop marks: two short ticks per corner (one flush with each of
// the corner's two edges), starting `gap` outside the card and running
// `length` further away from it. Sits entirely in the margin/gutter between
// cards, never touching the card itself, so a paper cutter can be aligned
// with the marks without cutting through anything drawn on the card.
export function getCutterGuideSegments(
  cardSize: Size,
  gap: number = Config.CUTTER_GUIDE_GAP,
  length: number = Config.CUTTER_GUIDE_LENGTH,
): LineSegment[] {
  const corners: { corner: Point; outX: number; outY: number }[] = [
    { corner: point(0, 0), outX: -1, outY: -1 },
    { corner: point(cardSize.width, 0), outX: 1, outY: -1 },
    { corner: point(0, cardSize.height), outX: -1, outY: 1 },
    { corner: point(cardSize.width, cardSize.height), outX: 1, outY: 1 },
  ];

  return corners.flatMap(({ corner, outX, outY }) => [
    {
      from: point(corner.x + outX * gap, corner.y),
      to: point(corner.x + outX * (gap + length), corner.y),
    },
    {
      from: point(corner.x, corner.y + outY * gap),
      to: point(corner.x, corner.y + outY * (gap + length)),
    },
  ]);
}

export function physicalCardNumberOf(cardNumber: number): number {
  return Math.ceil(cardNumber / 2);
}

export function sideOf(cardNumber: number): 'A' | 'B' {
  return cardNumber % 2 === 1 ? 'A' : 'B';
}
