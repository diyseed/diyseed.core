import type { PDFFont, PDFPage, RGB } from 'pdf-lib';
import type { Point, Size } from '../units';

export function toPdfY(page: PDFPage, origin: Point, elementHeight: number): number {
  return page.getHeight() - origin.y - elementHeight;
}

export interface StrokeFillOptions {
  borderColor?: RGB;
  borderWidth?: number;
  color?: RGB;
}

export function drawRectTL(page: PDFPage, origin: Point, sz: Size, opts: StrokeFillOptions): void {
  page.drawRectangle({
    x: origin.x,
    y: toPdfY(page, origin, sz.height),
    width: sz.width,
    height: sz.height,
    borderColor: opts.borderColor,
    borderWidth: opts.borderWidth,
    color: opts.color,
  });
}

export function drawRoundedRectTL(
  page: PDFPage,
  origin: Point,
  sz: Size,
  radius: number,
  opts: StrokeFillOptions,
): void {
  const r = Math.max(0, Math.min(radius, sz.width / 2, sz.height / 2));
  if (r === 0) {
    drawRectTL(page, origin, sz, opts);
    return;
  }

  const { width: w, height: h } = sz;
  const path = [
    `M ${r} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ');

  page.drawSvgPath(path, {
    x: origin.x,
    y: toPdfY(page, origin, sz.height) + h,
    borderColor: opts.borderColor,
    borderWidth: opts.borderWidth,
    color: opts.color,
  });
}

export function drawLineTL(
  page: PDFPage,
  from: Point,
  to: Point,
  opts: { color?: RGB; thickness?: number },
): void {
  page.drawLine({
    start: { x: from.x, y: page.getHeight() - from.y },
    end: { x: to.x, y: page.getHeight() - to.y },
    color: opts.color,
    thickness: opts.thickness,
  });
}

export function drawFilledCircleTL(page: PDFPage, center: Point, radius: number, color: RGB): void {
  page.drawEllipse({
    x: center.x,
    y: page.getHeight() - center.y,
    xScale: radius,
    yScale: radius,
    color,
  });
}

export interface TextAlign {
  horizontal: 'left' | 'center' | 'right';
  vertical: 'top' | 'center';
}

export function drawTextInBoxTL(
  page: PDFPage,
  text: string,
  font: PDFFont,
  fontSize: number,
  origin: Point,
  boxSize: Size,
  align: TextAlign,
  color: RGB,
): void {
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const ascent = font.heightAtSize(fontSize, { descender: false });
  const fullHeight = font.heightAtSize(fontSize);

  let x = origin.x;
  if (align.horizontal === 'center') x = origin.x + (boxSize.width - textWidth) / 2;
  else if (align.horizontal === 'right') x = origin.x + boxSize.width - textWidth;

  const topY = align.vertical === 'center' ? origin.y + (boxSize.height - fullHeight) / 2 : origin.y;
  const baselineY = page.getHeight() - topY - ascent;

  page.drawText(text, { x, y: baselineY, size: fontSize, font, color });
}
