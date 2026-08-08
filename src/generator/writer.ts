import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { GeneratorParameters, CardParameters, CardSectionParameters } from './params';
import { EncodingType } from './encoding';
import * as Config from './config';
import { getFontSizeForBox } from './fontFit';
import { getCardSafeAreaSize, getOriginForCard } from './geometry';
import { drawRectTL, drawRoundedRectTL, drawLineTL, drawTextInBoxTL, drawFilledCircleTL } from './pdfDraw';
import { getTopLeftCornerMarkOffsets, getTopRightCornerMarkOffset } from './cornerMarks';
import { Point, point } from '../units';

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

  for (let set = 1; set <= parameters.copies; set++) {
    for (let i = 1; i <= parameters.effectiveCardCount; i++) {
      const cardIndex = i + (set - 1) * parameters.effectiveCardCount;
      const safeArea = getCardSafeAreaSize(parameters.cardSize);
      const origin = getOriginForCard(cardIndex, safeArea);

      if (origin.page > currentPageNumber) {
        addPage();
      }
      const page = pages[origin.page - 1];

      const cardOrigin = point(
        Config.DOCUMENT_MARGIN_H + origin.point.x,
        Config.DOCUMENT_MARGIN_TOP + origin.point.y,
      );

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
    drawWordNumber(page, boldFont, wordOrigin, section.wordSize, wordNumber);
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
): void {
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
  for (let row = 1; row < encoding; row++) {
    const y = origin.y + cellSize.height * row;
    drawLineTL(page, point(origin.x, y), point(origin.x + wordSize.width, y), { color: GRID_LINE, thickness: Config.PEN_THIN });
  }
  for (let col = 1; col < 4; col++) {
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
  const fontSize = getFontSizeForBox({
    font,
    fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
    increaseStep: 0.2,
    sampleText: 'M',
    maxSize: cellSize,
  });

  const startChar = encoding === EncodingType.Alphabet ? 'a'.charCodeAt(0) : '0'.charCodeAt(0);
  for (let row = 0; row < encoding; row++) {
    const text = String.fromCharCode(startChar + row);
    for (let col = 0; col < 4; col++) {
      const cellOrigin = point(origin.x + cellSize.width * col, origin.y + cellSize.height * row);
      drawTextInBoxTL(page, text, font, fontSize, cellOrigin, cellSize, { horizontal: 'center', vertical: 'center' }, CELL_TEXT);
    }
  }
}
