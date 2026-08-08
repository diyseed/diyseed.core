import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { GeneratorParameters, CardParameters, CardSectionParameters } from './params';
import { EncodingType, encodingLayout } from './encoding';
import * as Config from './config';
import { getFontSizeForBox } from './fontFit';
import { getCardSafeAreaSize, getOriginForCard } from './geometry';
import { drawRectTL, drawRoundedRectTL, drawLineTL, drawTextInBoxTL, drawFilledCircleTL, drawRotatedTextInBoxTL } from './pdfDraw';
import { getTopLeftCornerMarkOffsets, getTopRightCornerMarkOffset } from './cornerMarks';
import { Point, point, size } from '../units';

const BLACK = rgb(0, 0, 0);
const CARD_OUTLINE = BLACK;
const GRID_LINE = BLACK;
const SHADE = rgb(0.92, 0.92, 0.92);
const CELL_TEXT = rgb(0.22, 0.22, 0.22);
const WORD_NR_TEXT = rgb(0.608, 0.608, 0.608);
const HEADER_TEXT_COLOR = rgb(0, 0, 0);
const FOOTER_TEXT_COLOR = rgb(0.608, 0.608, 0.608);

export async function generateWriterPdf(parameters: GeneratorParameters): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(Config.DOCUMENT_TITLE);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];
  let currentPageNumber = 0;

  function addPage(): void {
    const page = doc.addPage([Config.DOCUMENT_SIZE.width, Config.DOCUMENT_SIZE.height]);
    pages.push(page);
    currentPageNumber++;
  }

  const headerHeight = parameters.seedEncoding === EncodingType.Binary ? Config.BINARY_HEADER_HEIGHT : 0;

  for (let set = 1; set <= parameters.copies; set++) {
    for (let i = 1; i <= parameters.effectiveCardCount; i++) {
      const cardIndex = i + (set - 1) * parameters.effectiveCardCount;
      const safeArea = getCardSafeAreaSize(size(parameters.cardSize.width, parameters.cardSize.height + headerHeight));
      const origin = getOriginForCard(cardIndex, safeArea);

      if (origin.page > currentPageNumber) {
        addPage();
      }
      const page = pages[origin.page - 1];

      const cardOrigin = point(
        Config.DOCUMENT_MARGIN_H + origin.point.x,
        Config.DOCUMENT_MARGIN_TOP + origin.point.y + headerHeight,
      );

      if (headerHeight > 0) {
        drawBinaryColumnHeader(page, font, cardOrigin, parameters.cardSize.width, parameters.cardPadding, headerHeight);
      }

      renderCard(page, font, boldFont, parameters.getCardParameters(i), cardOrigin);
    }
  }

  for (const page of pages) {
    drawTextInBoxTL(
      page,
      Config.DOCUMENT_WRITER_HEADER_TEXT,
      boldFont,
      Config.HEADER_FONT_SIZE,
      point(Config.DOCUMENT_MARGIN_H, 0),
      { width: Config.EFFECTIVE_PAGE_SIZE.width, height: Config.DOCUMENT_MARGIN_TOP },
      { horizontal: 'left', vertical: 'center' },
      HEADER_TEXT_COLOR,
    );
    drawTextInBoxTL(
      page,
      Config.DOCUMENT_FOOTER_TEXT,
      font,
      Config.FOOTER_FONT_SIZE,
      point(Config.DOCUMENT_MARGIN_H, Config.DOCUMENT_SIZE.height - Config.DOCUMENT_MARGIN_BOTTOM),
      { width: Config.EFFECTIVE_PAGE_SIZE.width, height: Config.DOCUMENT_MARGIN_BOTTOM },
      { horizontal: 'right', vertical: 'top' },
      FOOTER_TEXT_COLOR,
    );
  }

  return doc.save();
}

function renderCard(page: PDFPage, font: PDFFont, boldFont: PDFFont, card: CardParameters, cardOrigin: Point): void {
  drawRoundedRectTL(page, cardOrigin, card.size, card.radius, { borderColor: CARD_OUTLINE, borderWidth: Config.PEN_NORMAL });
  drawCornerMarks(page, card, cardOrigin);

  let sectionOrigin = point(cardOrigin.x + card.padding, cardOrigin.y + card.padding);
  for (const section of card.sections) {
    drawSection(page, font, boldFont, section, sectionOrigin);
    sectionOrigin = point(sectionOrigin.x, sectionOrigin.y + section.size.height);
  }
}

function drawCornerMarks(page: PDFPage, card: CardParameters, cardOrigin: Point): void {
  for (const offset of getTopLeftCornerMarkOffsets(card.number, card.padding)) {
    drawFilledCircleTL(page, point(cardOrigin.x + offset.x, cardOrigin.y + offset.y), Config.CORNER_MARK_RADIUS, CARD_OUTLINE);
  }

  const topRight = getTopRightCornerMarkOffset(card.padding);
  drawFilledCircleTL(
    page,
    point(cardOrigin.x + card.size.width + topRight.x, cardOrigin.y + topRight.y),
    Config.CORNER_MARK_RADIUS,
    CARD_OUTLINE,
  );
}

function drawBinaryColumnHeader(
  page: PDFPage,
  font: PDFFont,
  cardOrigin: Point,
  cardWidth: number,
  cardPadding: number,
  headerHeight: number,
): void {
  const gridWidth = cardWidth - 2 * cardPadding;
  const colWidth = gridWidth / Config.BINARY_COLUMN_VALUES.length;
  const fontSize = getFontSizeForBox({
    font,
    fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
    increaseStep: 0.2,
    sampleText: '1024',
    maxSize: size(headerHeight, colWidth),
  });

  Config.BINARY_COLUMN_VALUES.forEach((value, i) => {
    const colOrigin = point(cardOrigin.x + cardPadding + colWidth * i, cardOrigin.y - headerHeight);
    drawRotatedTextInBoxTL(page, `${value}`, font, fontSize, colOrigin, size(colWidth, headerHeight), HEADER_TEXT_COLOR, 'end');
  });
}

function drawSection(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  section: CardSectionParameters,
  sectionOrigin: Point,
): void {
  let wordOrigin = sectionOrigin;
  section.wordNumbers.forEach((wordNumber, i) => {
    if ((section.number + i) % 2 === 0) {
      drawRectTL(page, wordOrigin, section.wordSize, { color: SHADE });
    }
    drawRectTL(page, wordOrigin, section.wordSize, { borderColor: CARD_OUTLINE, borderWidth: Config.PEN_NORMAL });
    drawWordNumber(page, boldFont, wordOrigin, section.wordSize, wordNumber, section.encoding);
    drawWordGridLines(page, wordOrigin, section.wordSize, section.cellSize, section.encoding);
    drawWordCellCharacters(page, font, wordOrigin, section.cellSize, section.encoding);

    wordOrigin = point(wordOrigin.x + section.wordSize.width, wordOrigin.y);
  });
}

function drawWordNumber(
  page: PDFPage,
  boldFont: PDFFont,
  origin: Point,
  wordSize: { width: number; height: number },
  wordNumber: number,
  encoding: EncodingType,
): void {
  if (encoding === EncodingType.Binary) {
    // Binary's "word block" is the full 11-column row, not a narrow per-word
    // block like Alphabet/Number - fit the number to one cell's footprint
    // (using the smaller cell-scale font range) so it doesn't overprint
    // neighboring punch columns or rows.
    const cols = encodingLayout(encoding).cols;
    const labelBox = size(wordSize.width / cols, wordSize.height);
    const fontSize = getFontSizeForBox({
      font: boldFont,
      fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
      increaseStep: 0.2,
      sampleText: '42.',
      maxSize: labelBox,
    });
    drawTextInBoxTL(page, `${wordNumber}`, boldFont, fontSize, origin, wordSize, { horizontal: 'left', vertical: 'center' }, WORD_NR_TEXT);
    return;
  }
  const fontSize = getFontSizeForBox({
    font: boldFont,
    fontSizeRange: Config.WORD_NR_FONT_SIZE_RANGE,
    increaseStep: 1,
    sampleText: '42.',
    maxSize: wordSize,
  });
  drawTextInBoxTL(page, `${wordNumber}`, boldFont, fontSize, origin, wordSize, { horizontal: 'center', vertical: 'top' }, WORD_NR_TEXT);
}

function drawWordGridLines(
  page: PDFPage,
  origin: Point,
  wordSize: { width: number; height: number },
  cellSize: { width: number; height: number },
  encoding: EncodingType,
): void {
  const layout = encodingLayout(encoding);
  for (let row = 1; row < layout.rows; row++) {
    const y = origin.y + cellSize.height * row;
    drawLineTL(page, point(origin.x, y), point(origin.x + wordSize.width, y), { color: GRID_LINE, thickness: Config.PEN_THIN });
  }
  for (let col = 1; col < layout.cols; col++) {
    const x = origin.x + cellSize.width * col;
    drawLineTL(page, point(x, origin.y), point(x, origin.y + wordSize.height), { color: GRID_LINE, thickness: Config.PEN_THIN });
  }
}

function drawWordCellCharacters(
  page: PDFPage,
  font: PDFFont,
  origin: Point,
  cellSize: { width: number; height: number },
  encoding: EncodingType,
): void {
  const layout = encodingLayout(encoding);
  if (!layout.cellLabels) return; // Binary: cells stay blank

  const fontSize = getFontSizeForBox({
    font,
    fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
    increaseStep: 0.2,
    sampleText: 'M',
    maxSize: cellSize,
  });

  for (let row = 0; row < layout.rows; row++) {
    const text = layout.cellLabels[row];
    for (let col = 0; col < layout.cols; col++) {
      const cellOrigin = point(origin.x + cellSize.width * col, origin.y + cellSize.height * row);
      drawTextInBoxTL(page, text, font, fontSize, cellOrigin, cellSize, { horizontal: 'center', vertical: 'center' }, CELL_TEXT);
    }
  }
}
