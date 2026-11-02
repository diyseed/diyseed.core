import { Point, Size, point } from '../units';

export interface NumberedBox {
  number: number;
  origin: Point;
}

export interface LayoutOptions {
  // Extra horizontal space between boxes within a row. Defaults to 0 (boxes
  // flush against each other).
  gap?: number;
  // Extra vertical space between rows of boxes. Defaults to 0.
  rowGap?: number;
  // Fixed number of boxes per row, overriding the maxWidth-derived count -
  // used when a layout calls for a specific row width (e.g. 6 words per row)
  // regardless of how many would otherwise fit.
  perRow?: number;
}

// Lays out `count` numbered boxes left-to-right, wrapping to a new row once
// another box would exceed `maxWidth` (or once `perRow` boxes are placed,
// if given) - used for the reader's fill-in boxes, where recovered
// words/characters get written down one per box.
export function layoutNumberedBoxes(count: number, startNumber: number, boxSize: Size, maxWidth: number, options: LayoutOptions = {}): NumberedBox[] {
  const gap = options.gap ?? 0;
  const rowGap = options.rowGap ?? 0;
  const pitchX = boxSize.width + gap;
  const pitchY = boxSize.height + rowGap;
  const perRow = options.perRow ?? Math.max(1, Math.floor((maxWidth + gap) / pitchX));
  const boxes: NumberedBox[] = [];

  for (let i = 0; i < count; i++) {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    boxes.push({ number: startNumber + i, origin: point(col * pitchX, row * pitchY) });
  }

  return boxes;
}
