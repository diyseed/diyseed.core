import { Point, Size, point } from '../units';
import * as Config from './config';

// Marks sit in the card's padding, directly above/below a mesh corner - never
// diagonally inset. Offsets are relative to that mesh corner: along the edge
// they stay flush with the mesh (x = 0 for the first top-left dot), across it
// they sit `inset` outside the mesh.
//
// The inset is half the card padding (cornerMarkInset), so every mark is
// centred in its padding strip: between the card edge and the first row, in
// the padding-sized gap between rows, and below the last row. Measuring a
// punched card's dot from the edge then gives the padding back directly.
export function cornerMarkInset(padding: number): number {
  return padding / 2;
}

// `pitch` spaces consecutive marks one mesh cell width apart, so the row of
// marks reads at the same scale as the grid they sit above.
export function getTopLeftCornerMarkOffsets(count: number, inset: number, pitch: number): Point[] {
  const offsets: Point[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push(point(i * pitch, -inset));
  }
  return offsets;
}

// One cell width apart, unless that would run past the row: high row numbers
// on rows with few, wide cells would otherwise push dots off the card. The
// row width divided by the count keeps the last dot one pitch short of the
// top-right dot.
export function getTopLeftCornerMarkPitch(count: number, cellWidth: number, rowWidth: number): number {
  return count > 0 ? Math.min(cellWidth, rowWidth / count) : cellWidth;
}

export function getTopRightCornerMarkOffset(inset: number): Point {
  return point(0, -inset);
}

export function getBottomLeftCornerMarkOffset(inset: number): Point {
  return point(0, inset);
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
