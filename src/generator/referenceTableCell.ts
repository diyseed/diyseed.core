import type { PDFPage, RGB } from 'pdf-lib';
import { drawRectTL, drawLineTL } from './pdfDraw';
import type { Point, Size } from '../units';
import { point } from '../units';

// Shared bit-cell rendering for the ASCII and seed word reference tables
// (asciiTable.ts, seedWordTable.ts): a set bit is a bold X mark, an unset bit
// is a light gray square outline (not filled) - both the same size and
// centered in the cell, on the row's own background, so the two read as the
// same shape in two weights rather than two different kinds of mark.
export interface BitCellStyle {
  markColor: RGB;
  markThickness: number;
  offColor: RGB;
  offBorderThickness: number;
}

export function drawBitCell(page: PDFPage, cellOrigin: Point, cellSize: Size, set: boolean, markSize: number, style: BitCellStyle): void {
  const center = point(cellOrigin.x + cellSize.width / 2, cellOrigin.y + cellSize.height / 2);
  const markOrigin = point(center.x - markSize / 2, center.y - markSize / 2);

  if (!set) {
    drawRectTL(page, markOrigin, { width: markSize, height: markSize }, { borderColor: style.offColor, borderWidth: style.offBorderThickness });
    return;
  }
  drawLineTL(page, markOrigin, point(markOrigin.x + markSize, markOrigin.y + markSize), { color: style.markColor, thickness: style.markThickness });
  drawLineTL(page, point(markOrigin.x + markSize, markOrigin.y), point(markOrigin.x, markOrigin.y + markSize), { color: style.markColor, thickness: style.markThickness });
}
