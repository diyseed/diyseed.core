import type { PDFFont, PDFPage, RGB } from 'pdf-lib';
import * as Config from './config';
import { getFontSizeForBox } from './fontFit';
import { drawRectTL, drawRoundedRectTL, drawLineTL, drawTextInBoxTL, drawFilledCircleTL, drawRotatedTextInBoxTL, drawFilledTriangleTL } from './pdfDraw';
import { getCutterGuideSegments } from './cornerMarks';
import { Point, Size, point, size } from '../units';
import { SEED_BINARY_HEADER_WIDTH } from '../layout/seedCard';
import { PASSPHRASE_HEADER_SIZE } from '../layout/passphraseCard';
import type { Circle, HeaderLayout, MeshLayout, PassphraseCardLayout, Rect, SeedCardLayout, TextBox, Triangle } from '../layout/types';

export interface CardStyle {
  outline: RGB;
  gridLine: RGB;
  shade: RGB;
  shadeIntersection: RGB;
  cellText: RGB;
  wordNrText: RGB;
  wordNrOpacity: number;
  headerText: RGB;
}

export interface CardFonts {
  font: PDFFont;
  boldFont: PDFFont;
}

// Layouts are built with the writer's cardOrigin, so their shapes are already
// absolute page positions; cardOrigin here only places the outline and the
// cutter guides, which the layout does not model.
export function drawCardLayout(
  page: PDFPage,
  fonts: CardFonts,
  layout: SeedCardLayout | PassphraseCardLayout,
  cardOrigin: Point,
  style: CardStyle,
): void {
  if (layout.kind === 'seed') {
    drawSeedCard(page, fonts, layout, cardOrigin, style);
  } else {
    drawPassphraseCard(page, fonts.font, layout, cardOrigin, style);
  }
}

function drawSeedCard(page: PDFPage, fonts: CardFonts, layout: SeedCardLayout, cardOrigin: Point, style: CardStyle): void {
  if (layout.rowHeader) {
    const label = layout.rowHeader.labels[0];
    const fontSize = headerFontSize(fonts.font, '1024', size(SEED_BINARY_HEADER_WIDTH, label.box.height));
    drawHeader(page, fonts.font, fontSize, layout.rowHeader, style);
  }

  drawCardFrame(page, layout, cardOrigin, style);
  drawCircle(page, layout.bottomLeftMark, style);

  for (const section of layout.sections) {
    section.topMarks.forEach((mark) => drawCircle(page, mark, style));
    section.meshes.forEach((mesh, i) => {
      drawMesh(page, mesh, style);
      drawCellLabels(page, fonts.font, mesh.cellLabels, style);
      drawWordNumber(page, fonts.boldFont, section.wordNumbers[i], style);
    });
  }
}

function drawPassphraseCard(page: PDFPage, font: PDFFont, layout: PassphraseCardLayout, cardOrigin: Point, style: CardStyle): void {
  drawCardFrame(page, layout, cardOrigin, style);

  // Rotated labels: the fit runs on swapped axes (text length along the box height).
  const column = layout.columnHeader.labels[0].box;
  drawHeader(page, font, headerFontSize(font, '99', size(column.height, column.width)), layout.columnHeader, style);

  for (const block of layout.blocks) {
    block.topMarks.forEach((mark) => drawCircle(page, mark, style));
    const row = block.rowHeader.labels[0].box;
    drawHeader(page, font, headerFontSize(font, '64', size(PASSPHRASE_HEADER_SIZE, row.height)), block.rowHeader, style);
    block.meshes.forEach((mesh) => drawMesh(page, mesh, style));
  }

  drawCircle(page, layout.bottomLeftMark, style);
}

function drawCardFrame(page: PDFPage, layout: SeedCardLayout | PassphraseCardLayout, cardOrigin: Point, style: CardStyle): void {
  drawRoundedRectTL(page, cardOrigin, layout.size, layout.radius, { borderColor: style.outline, borderWidth: Config.PEN_NORMAL });
  drawCutterGuides(page, cardOrigin, layout.size, style);
}

// Printer's crop marks in the margin/gutter just outside the card, for
// aligning a paper cutter - independent of the corner-ID dots drawn inside
// the card border, which serve a different purpose (identifying cards after
// they've already been cut apart).
function drawCutterGuides(page: PDFPage, cardOrigin: Point, cardSize: Size, style: CardStyle): void {
  for (const segment of getCutterGuideSegments(cardSize)) {
    drawLineTL(
      page,
      point(cardOrigin.x + segment.from.x, cardOrigin.y + segment.from.y),
      point(cardOrigin.x + segment.to.x, cardOrigin.y + segment.to.y),
      { color: style.outline, thickness: Config.PEN_THIN },
    );
  }
}

function drawMesh(page: PDFPage, mesh: MeshLayout, style: CardStyle): void {
  for (const { rect, fill } of mesh.fills) {
    drawRectTL(page, origin(rect), rectSize(rect), { color: fill === 'shade' ? style.shade : style.shadeIntersection });
  }
  drawRectTL(page, origin(mesh.outline), rectSize(mesh.outline), { borderColor: style.outline, borderWidth: Config.PEN_NORMAL });
  for (const [from, to] of mesh.gridLines) {
    drawLineTL(page, from, to, { color: style.gridLine, thickness: Config.PEN_THIN });
  }
}

function drawCellLabels(page: PDFPage, font: PDFFont, labels: TextBox[], style: CardStyle): void {
  if (labels.length === 0) return; // Binary: cells stay blank

  const fontSize = getFontSizeForBox({
    font,
    fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
    increaseStep: 0.2,
    sampleText: 'M',
    maxSize: rectSize(labels[0].box),
  });
  for (const label of labels) {
    drawText(page, font, fontSize, label, style.cellText);
  }
}

// Drawn last (on top of the cell characters) so the word number stays legible.
function drawWordNumber(page: PDFPage, boldFont: PDFFont, label: TextBox, style: CardStyle): void {
  const fontSize = getFontSizeForBox({
    font: boldFont,
    fontSizeRange: Config.WORD_NR_FONT_SIZE_RANGE,
    increaseStep: 1,
    sampleText: '42.',
    maxSize: rectSize(label.box),
  });
  drawText(page, boldFont, fontSize, label, style.wordNrText, style.wordNrOpacity);
}

function headerFontSize(font: PDFFont, sampleText: string, maxSize: Size): number {
  return getFontSizeForBox({ font, fontSizeRange: Config.CELL_FONT_SIZE_RANGE, increaseStep: 0.2, sampleText, maxSize });
}

function drawHeader(page: PDFPage, font: PDFFont, fontSize: number, header: HeaderLayout, style: CardStyle): void {
  for (const label of header.labels) {
    drawText(page, font, fontSize, label, style.headerText);
  }
  header.arrows.forEach((arrow) => drawArrow(page, arrow, style));
}

function drawText(page: PDFPage, font: PDFFont, fontSize: number, label: TextBox, color: RGB, opacity?: number): void {
  const { box, align } = label;
  if (label.rotated) {
    if (align.vertical === 'top') throw new Error('Rotated text cannot be top-aligned.');
    drawRotatedTextInBoxTL(page, label.text, font, fontSize, origin(box), rectSize(box), color, align.vertical === 'bottom' ? 'end' : 'center');
    return;
  }
  if (align.vertical === 'bottom') throw new Error('Bottom-aligned text is only supported rotated.');
  drawTextInBoxTL(page, label.text, font, fontSize, origin(box), rectSize(box), { horizontal: align.horizontal, vertical: align.vertical }, color, opacity);
}

function drawArrow(page: PDFPage, [p1, p2, p3]: Triangle, style: CardStyle): void {
  drawFilledTriangleTL(page, p1, p2, p3, style.outline);
}

function drawCircle(page: PDFPage, mark: Circle, style: CardStyle): void {
  drawFilledCircleTL(page, point(mark.cx, mark.cy), mark.r, style.outline);
}

function origin(rect: Rect): Point {
  return point(rect.x, rect.y);
}

function rectSize(rect: Rect): Size {
  return size(rect.width, rect.height);
}
