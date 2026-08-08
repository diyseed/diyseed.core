import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { GeneratorParameters, CardParameters, CardSectionParameters, PassphraseParameters } from './params';
import { EncodingType, encodingLayout, BinaryDirection } from './encoding';
import * as Config from './config';
import { getFontSizeForBox } from './fontFit';
import { getCardSafeAreaSize, getOriginForCard } from './geometry';
import { drawRectTL, drawRoundedRectTL, drawLineTL, drawTextInBoxTL, drawFilledCircleTL, drawRotatedTextInBoxTL } from './pdfDraw';
import { getTopLeftCornerMarkOffsets, getTopRightCornerMarkOffset, getBottomLeftCornerMarkOffset } from './cornerMarks';
import { Point, point, size } from '../units';

const BLACK = rgb(0, 0, 0);
const CARD_OUTLINE = BLACK;
const GRID_LINE = BLACK;
const SHADE = rgb(0.92, 0.92, 0.92);
const SHADE_INTERSECTION = rgb(0.85, 0.85, 0.85);
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

  const isBinary = parameters.seedEncoding === EncodingType.Binary;
  const headerHeight = isBinary && parameters.binaryDirection === 'vertical' ? Config.BINARY_HEADER_HEIGHT : 0;
  const headerWidth = isBinary && parameters.binaryDirection === 'horizontal' ? Config.BINARY_HEADER_HEIGHT : 0;

  for (let set = 1; set <= parameters.copies; set++) {
    for (let i = 1; i <= parameters.effectiveCardCount; i++) {
      const cardIndex = i + (set - 1) * parameters.effectiveCardCount;
      const safeArea = getCardSafeAreaSize(
        size(parameters.cardSize.width + headerWidth, parameters.cardSize.height + headerHeight),
      );
      const origin = getOriginForCard(cardIndex, safeArea);

      if (origin.page > currentPageNumber) {
        addPage();
      }
      const page = pages[origin.page - 1];

      const cardOrigin = point(
        Config.DOCUMENT_MARGIN_H + origin.point.x + headerWidth,
        Config.DOCUMENT_MARGIN_TOP + origin.point.y + headerHeight,
      );

      if (headerHeight > 0) {
        drawBinaryColumnHeader(page, font, cardOrigin, parameters.cardSize.width, parameters.cardPadding, headerHeight);
      }
      if (headerWidth > 0) {
        drawBinaryRowHeader(page, font, cardOrigin, parameters.cardSize.height, parameters.cardPadding, headerWidth);
      }

      renderCard(page, font, boldFont, parameters.getCardParameters(i), cardOrigin);
    }
  }

  drawPageChrome(pages, font, boldFont);

  return doc.save();
}

function drawPageChrome(pages: PDFPage[], font: PDFFont, boldFont: PDFFont): void {
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
}

export async function generatePassphrasePdf(parameters: PassphraseParameters): Promise<Uint8Array> {
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

  const headerHeight = parameters.binaryDirection === 'vertical' ? Config.BINARY_HEADER_HEIGHT : 0;
  const headerWidth = parameters.binaryDirection === 'horizontal' ? Config.BINARY_HEADER_HEIGHT : 0;

  for (let set = 1; set <= parameters.copies; set++) {
    for (let i = 1; i <= parameters.cardCount; i++) {
      const cardIndex = i + (set - 1) * parameters.cardCount;
      const safeArea = getCardSafeAreaSize(
        size(parameters.cardSize.width + headerWidth, parameters.cardSize.height + headerHeight),
      );
      const origin = getOriginForCard(cardIndex, safeArea);

      if (origin.page > currentPageNumber) {
        addPage();
      }
      const page = pages[origin.page - 1];

      const cardOrigin = point(
        Config.DOCUMENT_MARGIN_H + origin.point.x + headerWidth,
        Config.DOCUMENT_MARGIN_TOP + origin.point.y + headerHeight,
      );

      if (headerHeight > 0) {
        drawPassphraseColumnHeader(page, font, cardOrigin, parameters.cardSize.width, parameters.cardPadding, headerHeight);
      }
      if (headerWidth > 0) {
        drawPassphraseRowHeader(page, font, cardOrigin, parameters.cardSize.height, parameters.cardPadding, headerWidth);
      }

      renderPassphraseCard(page, boldFont, parameters, i, cardOrigin);
    }
  }

  drawPageChrome(pages, font, boldFont);

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
  for (const offset of getTopLeftCornerMarkOffsets(card.number)) {
    drawFilledCircleTL(page, point(cardOrigin.x + offset.x, cardOrigin.y + offset.y), Config.CORNER_MARK_RADIUS, CARD_OUTLINE);
  }

  const topRight = getTopRightCornerMarkOffset();
  drawFilledCircleTL(
    page,
    point(cardOrigin.x + card.size.width + topRight.x, cardOrigin.y + topRight.y),
    Config.CORNER_MARK_RADIUS,
    CARD_OUTLINE,
  );

  const bottomLeft = getBottomLeftCornerMarkOffset();
  drawFilledCircleTL(
    page,
    point(cardOrigin.x + bottomLeft.x, cardOrigin.y + card.size.height + bottomLeft.y),
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

function drawBinaryRowHeader(
  page: PDFPage,
  font: PDFFont,
  cardOrigin: Point,
  cardHeight: number,
  cardPadding: number,
  headerWidth: number,
): void {
  const gridHeight = cardHeight - 2 * cardPadding;
  const rowHeight = gridHeight / Config.BINARY_COLUMN_VALUES.length;
  const fontSize = getFontSizeForBox({
    font,
    fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
    increaseStep: 0.2,
    sampleText: '1024',
    maxSize: size(headerWidth, rowHeight),
  });
  const gap = fontSize * 0.5; // half a character's breathing room from the card edge

  Config.BINARY_COLUMN_VALUES.forEach((value, i) => {
    const rowOrigin = point(cardOrigin.x - headerWidth, cardOrigin.y + cardPadding + rowHeight * i);
    drawTextInBoxTL(
      page,
      `${value}`,
      font,
      fontSize,
      rowOrigin,
      size(headerWidth - gap, rowHeight),
      { horizontal: 'right', vertical: 'center' },
      HEADER_TEXT_COLOR,
    );
  });
}

function drawPassphraseColumnHeader(
  page: PDFPage,
  font: PDFFont,
  cardOrigin: Point,
  cardWidth: number,
  cardPadding: number,
  headerHeight: number,
): void {
  const gridWidth = cardWidth - 2 * cardPadding;
  const colWidth = gridWidth / Config.PASSPHRASE_COLUMN_VALUES.length;
  const fontSize = getFontSizeForBox({
    font,
    fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
    increaseStep: 0.2,
    sampleText: '64',
    maxSize: size(headerHeight, colWidth),
  });

  Config.PASSPHRASE_COLUMN_VALUES.forEach((value, i) => {
    const colOrigin = point(cardOrigin.x + cardPadding + colWidth * i, cardOrigin.y - headerHeight);
    drawRotatedTextInBoxTL(page, `${value}`, font, fontSize, colOrigin, size(colWidth, headerHeight), HEADER_TEXT_COLOR, 'end');
  });
}

function drawPassphraseRowHeader(
  page: PDFPage,
  font: PDFFont,
  cardOrigin: Point,
  cardHeight: number,
  cardPadding: number,
  headerWidth: number,
): void {
  const gridHeight = cardHeight - 2 * cardPadding;
  const rowHeight = gridHeight / Config.PASSPHRASE_COLUMN_VALUES.length;
  const fontSize = getFontSizeForBox({
    font,
    fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
    increaseStep: 0.2,
    sampleText: '64',
    maxSize: size(headerWidth, rowHeight),
  });
  const gap = fontSize * 0.5;

  Config.PASSPHRASE_COLUMN_VALUES.forEach((value, i) => {
    const rowOrigin = point(cardOrigin.x - headerWidth, cardOrigin.y + cardPadding + rowHeight * i);
    drawTextInBoxTL(
      page,
      `${value}`,
      font,
      fontSize,
      rowOrigin,
      size(headerWidth - gap, rowHeight),
      { horizontal: 'right', vertical: 'center' },
      HEADER_TEXT_COLOR,
    );
  });
}

function renderPassphraseCard(
  page: PDFPage,
  boldFont: PDFFont,
  parameters: PassphraseParameters,
  cardNumber: number,
  cardOrigin: Point,
): void {
  drawRoundedRectTL(page, cardOrigin, parameters.cardSize, parameters.cardCornerRadius, {
    borderColor: CARD_OUTLINE,
    borderWidth: Config.PEN_NORMAL,
  });
  drawPassphraseCornerMarks(page, parameters, cardNumber, cardOrigin);

  const blocks = parameters.getCardCharacters(cardNumber);
  const blockSize =
    parameters.binaryDirection === 'horizontal'
      ? size(parameters.charsPerBlock * parameters.cellSize.width, parameters.blockThickness)
      : size(parameters.blockThickness, parameters.charsPerBlock * parameters.cellSize.height);

  let blockOrigin = point(cardOrigin.x + parameters.cardPadding, cardOrigin.y + parameters.cardPadding);
  blocks.forEach((positions) => {
    drawPassphraseBlock(page, boldFont, positions, parameters.binaryDirection, parameters.cellSize, blockOrigin);
    blockOrigin =
      parameters.binaryDirection === 'horizontal'
        ? point(blockOrigin.x, blockOrigin.y + blockSize.height + parameters.cardPadding)
        : point(blockOrigin.x + blockSize.width + parameters.cardPadding, blockOrigin.y);
  });
}

function drawPassphraseCornerMarks(
  page: PDFPage,
  parameters: PassphraseParameters,
  cardNumber: number,
  cardOrigin: Point,
): void {
  for (const offset of getTopLeftCornerMarkOffsets(cardNumber)) {
    drawFilledCircleTL(page, point(cardOrigin.x + offset.x, cardOrigin.y + offset.y), Config.CORNER_MARK_RADIUS, CARD_OUTLINE);
  }

  const topRight = getTopRightCornerMarkOffset();
  drawFilledCircleTL(
    page,
    point(cardOrigin.x + parameters.cardSize.width + topRight.x, cardOrigin.y + topRight.y),
    Config.CORNER_MARK_RADIUS,
    CARD_OUTLINE,
  );

  const bottomLeft = getBottomLeftCornerMarkOffset();
  drawFilledCircleTL(
    page,
    point(cardOrigin.x + bottomLeft.x, cardOrigin.y + parameters.cardSize.height + bottomLeft.y),
    Config.CORNER_MARK_RADIUS,
    CARD_OUTLINE,
  );
}

function drawPassphraseBlock(
  page: PDFPage,
  boldFont: PDFFont,
  positions: number[],
  binaryDirection: BinaryDirection,
  cellSize: { width: number; height: number },
  blockOrigin: Point,
): void {
  const bitCount = Config.PASSPHRASE_COLUMN_VALUES.length;
  const charSize =
    binaryDirection === 'horizontal' ? size(cellSize.width, bitCount * cellSize.height) : size(bitCount * cellSize.width, cellSize.height);

  let charOrigin = blockOrigin;
  positions.forEach((position) => {
    const charShaded = position % 2 === 0;
    if (charShaded) {
      drawRectTL(page, charOrigin, charSize, { color: SHADE });
    }
    drawPassphraseBitShading(page, charOrigin, charSize, cellSize, charShaded, binaryDirection);
    drawRectTL(page, charOrigin, charSize, { borderColor: CARD_OUTLINE, borderWidth: Config.PEN_NORMAL });
    drawPassphraseNumber(page, boldFont, charOrigin, charSize, position, binaryDirection);
    drawPassphraseGridLines(page, charOrigin, charSize, cellSize, binaryDirection);

    charOrigin =
      binaryDirection === 'horizontal' ? point(charOrigin.x + charSize.width, charOrigin.y) : point(charOrigin.x, charOrigin.y + charSize.height);
  });
}

function drawPassphraseBitShading(
  page: PDFPage,
  origin: Point,
  charSize: { width: number; height: number },
  cellSize: { width: number; height: number },
  charShaded: boolean,
  binaryDirection: BinaryDirection,
): void {
  const bitCount = Config.PASSPHRASE_COLUMN_VALUES.length;
  const color = charShaded ? SHADE_INTERSECTION : SHADE;
  if (binaryDirection === 'vertical') {
    for (let col = 1; col < bitCount; col += 2) {
      const x = origin.x + cellSize.width * col;
      drawRectTL(page, point(x, origin.y), size(cellSize.width, charSize.height), { color });
    }
  } else {
    for (let row = 1; row < bitCount; row += 2) {
      const y = origin.y + cellSize.height * row;
      drawRectTL(page, point(origin.x, y), size(charSize.width, cellSize.height), { color });
    }
  }
}

function drawPassphraseNumber(
  page: PDFPage,
  boldFont: PDFFont,
  origin: Point,
  charSize: { width: number; height: number },
  position: number,
  binaryDirection: BinaryDirection,
): void {
  if (binaryDirection === 'vertical') {
    const labelBox = size(charSize.width / Config.PASSPHRASE_COLUMN_VALUES.length, charSize.height);
    const fontSize = getFontSizeForBox({
      font: boldFont,
      fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
      increaseStep: 0.2,
      sampleText: '42.',
      maxSize: labelBox,
    });
    drawTextInBoxTL(page, `${position}`, boldFont, fontSize, origin, charSize, { horizontal: 'left', vertical: 'center' }, WORD_NR_TEXT);
    return;
  }
  const fontSize = getFontSizeForBox({
    font: boldFont,
    fontSizeRange: Config.WORD_NR_FONT_SIZE_RANGE,
    increaseStep: 1,
    sampleText: '42.',
    maxSize: charSize,
  });
  drawTextInBoxTL(page, `${position}`, boldFont, fontSize, origin, charSize, { horizontal: 'center', vertical: 'top' }, WORD_NR_TEXT);
}

function drawPassphraseGridLines(
  page: PDFPage,
  origin: Point,
  charSize: { width: number; height: number },
  cellSize: { width: number; height: number },
  binaryDirection: BinaryDirection,
): void {
  const bitCount = Config.PASSPHRASE_COLUMN_VALUES.length;
  const rows = binaryDirection === 'horizontal' ? bitCount : 1;
  const cols = binaryDirection === 'horizontal' ? 1 : bitCount;
  for (let row = 1; row < rows; row++) {
    const y = origin.y + cellSize.height * row;
    drawLineTL(page, point(origin.x, y), point(origin.x + charSize.width, y), { color: GRID_LINE, thickness: Config.PEN_THIN });
  }
  for (let col = 1; col < cols; col++) {
    const x = origin.x + cellSize.width * col;
    drawLineTL(page, point(x, origin.y), point(x, origin.y + charSize.height), { color: GRID_LINE, thickness: Config.PEN_THIN });
  }
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
    const wordShaded = (section.number + i) % 2 === 0;
    if (wordShaded) {
      drawRectTL(page, wordOrigin, section.wordSize, { color: SHADE });
    }
    if (section.encoding === EncodingType.Binary) {
      drawBinaryBitShading(page, wordOrigin, section.wordSize, section.cellSize, wordShaded, section.binaryDirection);
    }
    drawRectTL(page, wordOrigin, section.wordSize, { borderColor: CARD_OUTLINE, borderWidth: Config.PEN_NORMAL });
    drawWordNumber(page, boldFont, wordOrigin, section.wordSize, wordNumber, section.encoding, section.binaryDirection);
    drawWordGridLines(page, wordOrigin, section.wordSize, section.cellSize, section.encoding, section.binaryDirection);
    drawWordCellCharacters(page, font, wordOrigin, section.cellSize, section.encoding, section.binaryDirection);

    wordOrigin = point(wordOrigin.x + section.wordSize.width, wordOrigin.y);
  });
}

function drawBinaryBitShading(
  page: PDFPage,
  origin: Point,
  wordSize: { width: number; height: number },
  cellSize: { width: number; height: number },
  wordShaded: boolean,
  binaryDirection: BinaryDirection,
): void {
  const layout = encodingLayout(EncodingType.Binary, binaryDirection);
  const color = wordShaded ? SHADE_INTERSECTION : SHADE;
  if (binaryDirection === 'vertical') {
    for (let col = 1; col < layout.cols; col += 2) {
      const x = origin.x + cellSize.width * col;
      drawRectTL(page, point(x, origin.y), size(cellSize.width, wordSize.height), { color });
    }
  } else {
    for (let row = 1; row < layout.rows; row += 2) {
      const y = origin.y + cellSize.height * row;
      drawRectTL(page, point(origin.x, y), size(wordSize.width, cellSize.height), { color });
    }
  }
}

function drawWordNumber(
  page: PDFPage,
  boldFont: PDFFont,
  origin: Point,
  wordSize: { width: number; height: number },
  wordNumber: number,
  encoding: EncodingType,
  binaryDirection: BinaryDirection,
): void {
  if (encoding === EncodingType.Binary && binaryDirection === 'vertical') {
    // Vertical's "word block" is the full 11-column row, not a narrow per-word
    // block like Alphabet/Number (or horizontal Binary) - fit the number to one
    // cell's footprint (using the smaller cell-scale font range) so it doesn't
    // overprint neighboring punch columns or rows.
    const cols = encodingLayout(encoding, binaryDirection).cols;
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
  // Horizontal Binary's word block is a narrow column (like Alphabet/Number's),
  // so the normal centered-above-block number placement already fits it well.
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
  binaryDirection: BinaryDirection,
): void {
  const layout = encodingLayout(encoding, binaryDirection);
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
  binaryDirection: BinaryDirection,
): void {
  const layout = encodingLayout(encoding, binaryDirection);
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
