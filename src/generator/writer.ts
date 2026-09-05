import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { GeneratorParameters, CardParameters, CardSectionParameters, PassphraseParameters } from './params';
import { EncodingType, encodingLayout } from './encoding';
import * as Config from './config';
import { getFontSizeForBox } from './fontFit';
import { getCardSafeAreaSize, getOriginForCard } from './geometry';
import { drawRectTL, drawRoundedRectTL, drawLineTL, drawTextInBoxTL, drawFilledCircleTL, drawRotatedTextInBoxTL, drawFilledTriangleTL } from './pdfDraw';
import { getTopLeftCornerMarkOffsets, getTopRightCornerMarkOffset, getBottomLeftCornerMarkOffset, getCutterGuideSegments } from './cornerMarks';
import { buildSeedParamsSummary, buildPassphraseParamsSummary } from './summary';
import { Point, Size, point, size, mm } from '../units';

const BLACK = rgb(0, 0, 0);
const CARD_OUTLINE = BLACK;
const GRID_LINE = BLACK;
const SHADE = rgb(0.92, 0.92, 0.92);
const SHADE_INTERSECTION = rgb(0.85, 0.85, 0.85);
const CELL_TEXT = rgb(0.55, 0.55, 0.55);
const WORD_NR_TEXT = BLACK;
const WORD_NR_OPACITY = 0.6;
const HEADER_TEXT_COLOR = rgb(0, 0, 0);
const FOOTER_TEXT_COLOR = rgb(0.608, 0.608, 0.608);

export async function generateWriterPdf(parameters: GeneratorParameters): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(Config.DOCUMENT_TITLE);
  // Monospace for everything above/inside the card itself (headers, cell
  // characters, word numbers) - fixed character widths make columns of
  // digits/letters line up cleanly, which matters for a grid meant to be
  // read/punched precisely. The page title/footer keep the sans-serif chrome font.
  const font = await doc.embedFont(StandardFonts.Courier);
  const boldFont = await doc.embedFont(StandardFonts.CourierBold);
  const chromeFont = await doc.embedFont(StandardFonts.Helvetica);
  const chromeBoldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];
  let currentPageNumber = 0;

  function addPage(): void {
    const page = doc.addPage([Config.DOCUMENT_SIZE.width, Config.DOCUMENT_SIZE.height]);
    pages.push(page);
    currentPageNumber++;
  }

  const isBinary = parameters.seedEncoding === EncodingType.Binary;
  const headerWidth = isBinary ? Config.BINARY_HEADER_HEIGHT : 0;

  for (let set = 1; set <= parameters.copies; set++) {
    for (let i = 1; i <= parameters.effectiveCardCount; i++) {
      const cardIndex = i + (set - 1) * parameters.effectiveCardCount;
      const safeArea = getCardSafeAreaSize(size(parameters.cardSize.width + headerWidth, parameters.cardSize.height));
      const origin = getOriginForCard(cardIndex, safeArea);

      if (origin.page > currentPageNumber) {
        addPage();
      }
      const page = pages[origin.page - 1];

      const cardOrigin = point(Config.DOCUMENT_MARGIN_H + origin.point.x + headerWidth, Config.DOCUMENT_MARGIN_TOP + origin.point.y);

      if (headerWidth > 0) {
        drawBinaryRowHeader(page, font, cardOrigin, parameters.cardSize.height, parameters.cardPadding, headerWidth);
      }

      renderCard(page, font, boldFont, parameters.getCardParameters(i), cardOrigin);
    }
  }

  drawPageChrome(pages, chromeFont, chromeBoldFont, Config.DOCUMENT_SEED_HEADER_TEXT, buildSeedParamsSummary(parameters));

  return doc.save();
}

export function drawPageChrome(pages: PDFPage[], font: PDFFont, boldFont: PDFFont, headerText: string, paramsSummary: string): void {
  // The params summary sits to the right of the title, on the same line, in
  // small gray text - so it needs the title's own rendered width to know
  // where it can start.
  const titleWidth = boldFont.widthOfTextAtSize(headerText, Config.HEADER_FONT_SIZE);
  const summaryGap = Config.PARAMS_SUMMARY_GAP;
  const summaryX = Config.DOCUMENT_MARGIN_H + titleWidth + summaryGap;
  const summaryWidth = Math.max(0, Config.EFFECTIVE_PAGE_SIZE.width - titleWidth - summaryGap);

  for (const page of pages) {
    drawTextInBoxTL(
      page,
      headerText,
      boldFont,
      Config.HEADER_FONT_SIZE,
      point(Config.DOCUMENT_MARGIN_H, 0),
      { width: Config.EFFECTIVE_PAGE_SIZE.width, height: Config.DOCUMENT_MARGIN_TOP },
      { horizontal: 'left', vertical: 'center' },
      HEADER_TEXT_COLOR,
    );
    drawTextInBoxTL(
      page,
      paramsSummary,
      font,
      Config.PARAMS_SUMMARY_FONT_SIZE,
      point(summaryX, 0),
      { width: summaryWidth, height: Config.DOCUMENT_MARGIN_TOP },
      { horizontal: 'left', vertical: 'center' },
      FOOTER_TEXT_COLOR,
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
  // Monospace for everything above/inside the card - see generateWriterPdf.
  const font = await doc.embedFont(StandardFonts.Courier);
  const chromeFont = await doc.embedFont(StandardFonts.Helvetica);
  const chromeBoldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];
  let currentPageNumber = 0;

  function addPage(): void {
    const page = doc.addPage([Config.DOCUMENT_SIZE.width, Config.DOCUMENT_SIZE.height]);
    pages.push(page);
    currentPageNumber++;
  }

  // Both a place-value header (bit axis, left) and a position-number header
  // (character axis, top) are needed, on opposite sides of the card.
  const headerHeight = Config.BINARY_HEADER_HEIGHT;
  const headerWidth = Config.BINARY_HEADER_HEIGHT;

  for (let set = 1; set <= parameters.copies; set++) {
    // Top corner marks count rows, not cards - row 1 gets one dot, row 2 two,
    // and so on, continuing across every card in this copy (resetting only
    // when a new copy starts, same as the card number itself does).
    let nextRowNumber = 1;
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

      renderPassphraseCard(page, font, parameters, i, cardOrigin, headerHeight, headerWidth, nextRowNumber);
      nextRowNumber += parameters.blockCount;
    }
  }

  drawPageChrome(pages, chromeFont, chromeBoldFont, Config.DOCUMENT_PASSPHRASE_HEADER_TEXT, buildPassphraseParamsSummary(parameters));

  return doc.save();
}

export interface StencilInput {
  // Present whenever the seed section is relevant (its own checkbox or its
  // reader's is checked) - what actually gets appended is controlled by
  // includeSeedStencil/includeSeedReader below, independently, since a
  // reader can be generated without its own punching stencil (e.g. the mesh
  // was already punched from a previously generated stencil).
  seed?: GeneratorParameters;
  includeSeedStencil?: boolean;
  includeSeedReader?: boolean;
  passphrase?: PassphraseParameters;
  includePassphraseStencil?: boolean;
  includePassphraseReader?: boolean;
  // Appends the standalone ASCII reference table page (see asciiTable.ts) -
  // independent of seed/passphrase, since it's a static lookup sheet rather
  // than something derived from either's own parameters.
  includeAsciiTable?: boolean;
  // Appends the standalone BIP-39 seed word reference table (see
  // seedWordTable.ts) - same rationale as includeAsciiTable above.
  includeSeedWordTable?: boolean;
}

export async function generateStencilPdf(input: StencilInput): Promise<Uint8Array> {
  const includesSeed = !!input.seed && (input.includeSeedStencil || input.includeSeedReader);
  const includesPassphrase = !!input.passphrase && (input.includePassphraseStencil || input.includePassphraseReader);
  if (!includesSeed && !includesPassphrase && !input.includeAsciiTable && !input.includeSeedWordTable) {
    throw new Error('At least one of seed, passphrase, the ASCII table, or the seed word table must be included.');
  }

  // Lazy imports avoid a circular dependency at module-load time - reader.ts
  // imports drawPageChrome from this module.
  const { generateSeedReaderPdf, generatePassphraseReaderPdf } = await import('./reader');
  const { generateAsciiTablePdf } = await import('./asciiTable');
  const { generateSeedWordTablePdf } = await import('./seedWordTable');

  const parts: Promise<Uint8Array>[] = [];
  if (input.seed) {
    if (input.includeSeedStencil) parts.push(generateWriterPdf(input.seed));
    if (input.includeSeedReader) parts.push(generateSeedReaderPdf(input.seed));
  }
  if (input.passphrase) {
    if (input.includePassphraseStencil) parts.push(generatePassphrasePdf(input.passphrase));
    if (input.includePassphraseReader) parts.push(generatePassphraseReaderPdf(input.passphrase));
  }
  if (input.includeAsciiTable) {
    parts.push(generateAsciiTablePdf());
  }
  if (input.includeSeedWordTable) {
    parts.push(generateSeedWordTablePdf());
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const merged = await PDFDocument.create();
  for (const partBytes of await Promise.all(parts)) {
    const partDoc = await PDFDocument.load(partBytes);
    const pages = await merged.copyPages(partDoc, partDoc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }

  merged.setTitle(Config.DOCUMENT_TITLE);
  return merged.save();
}

// Printer's crop marks in the margin/gutter just outside the card, for
// aligning a paper cutter - independent of the corner-ID dots drawn inside
// the card border, which serve a different purpose (identifying cards after
// they've already been cut apart).
function drawCutterGuides(page: PDFPage, cardOrigin: Point, cardSize: Size): void {
  for (const segment of getCutterGuideSegments(cardSize)) {
    drawLineTL(
      page,
      point(cardOrigin.x + segment.from.x, cardOrigin.y + segment.from.y),
      point(cardOrigin.x + segment.to.x, cardOrigin.y + segment.to.y),
      { color: CARD_OUTLINE, thickness: Config.PEN_THIN },
    );
  }
}

function renderCard(page: PDFPage, font: PDFFont, boldFont: PDFFont, card: CardParameters, cardOrigin: Point): void {
  drawRoundedRectTL(page, cardOrigin, card.size, card.radius, { borderColor: CARD_OUTLINE, borderWidth: Config.PEN_NORMAL });
  drawCutterGuides(page, cardOrigin, card.size);
  drawBottomLeftMark(page, card, cardOrigin);

  let sectionOrigin = point(cardOrigin.x + card.padding, cardOrigin.y + card.padding);
  for (const section of card.sections) {
    // Each row (section) gets its own top-mark cluster, counted by the
    // section's own (globally-continuing) number, not the card's - a card
    // with more than one row (Card split > 1) needs to tell its rows apart
    // by punched dots too, the same way passphrase blocks do (see
    // drawRowTopMarks). When a card has exactly one section, its number
    // equals the card's own number and this lands exactly where the old
    // card-level marks used to.
    drawRowTopMarks(page, sectionOrigin, section.size, section.number, section.cellSize.width);
    drawSection(page, font, boldFont, section, sectionOrigin);
    // Sections leave a cardPadding-sized gap before the next one, matching
    // GeneratorParameters.sectionSize's own reservation for it (and the
    // passphrase card's block spacing).
    sectionOrigin = point(sectionOrigin.x, sectionOrigin.y + section.size.height + card.padding);
  }
}

// Single bottom-left dot for the whole card, 0.5mm below the card's own
// bottom edge - closes off the set of per-row top marks drawn above, the
// same way the passphrase card's trailing bottom-left mark does.
function drawBottomLeftMark(page: PDFPage, card: CardParameters, cardOrigin: Point): void {
  const bottomLeft = getBottomLeftCornerMarkOffset(card.padding);
  drawFilledCircleTL(
    page,
    point(cardOrigin.x + bottomLeft.x, cardOrigin.y + card.size.height + bottomLeft.y),
    Config.CORNER_MARK_RADIUS,
    CARD_OUTLINE,
  );
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
  Config.BINARY_COLUMN_VALUES.forEach((value, i) => {
    const rowOrigin = point(cardOrigin.x - headerWidth, cardOrigin.y + cardPadding + rowHeight * i);
    drawTextInBoxTL(
      page,
      `${value}`,
      font,
      fontSize,
      rowOrigin,
      size(headerWidth - ARROW_FOOTPRINT, rowHeight),
      { horizontal: 'right', vertical: 'center' },
      HEADER_TEXT_COLOR,
    );
  });

  drawHeaderArrowsLeft(page, Config.BINARY_COLUMN_VALUES.length, cardOrigin.x, cardOrigin.y + cardPadding, rowHeight);
}

function drawPassphraseColumnHeader(
  page: PDFPage,
  font: PDFFont,
  values: number[],
  cardOriginY: number,
  blockOriginX: number,
  headerHeight: number,
  cellWidth: number,
  sampleText: string,
): void {
  // The text only gets the header height minus the arrow's own footprint -
  // that's reserved space, not text space (otherwise the text overlaps it).
  const textAreaHeight = headerHeight - ARROW_FOOTPRINT;
  const fontSize = getFontSizeForBox({
    font,
    fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
    increaseStep: 0.2,
    sampleText,
    maxSize: size(textAreaHeight, cellWidth),
  });

  values.forEach((value, i) => {
    const colOrigin = point(blockOriginX + cellWidth * i, cardOriginY - headerHeight);
    drawRotatedTextInBoxTL(page, `${value}`, font, fontSize, colOrigin, size(cellWidth, textAreaHeight), HEADER_TEXT_COLOR, 'end');
  });

  drawHeaderArrowsTop(page, values.length, cardOriginY, blockOriginX, cellWidth);
}

function drawPassphraseRowHeader(
  page: PDFPage,
  font: PDFFont,
  values: number[],
  cardOriginX: number,
  blockOriginY: number,
  headerWidth: number,
  cellHeight: number,
  sampleText: string,
): void {
  const fontSize = getFontSizeForBox({
    font,
    fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
    increaseStep: 0.2,
    sampleText,
    maxSize: size(headerWidth, cellHeight),
  });
  values.forEach((value, i) => {
    const rowOrigin = point(cardOriginX - headerWidth, blockOriginY + cellHeight * i);
    drawTextInBoxTL(
      page,
      `${value}`,
      font,
      fontSize,
      rowOrigin,
      size(headerWidth - ARROW_FOOTPRINT, cellHeight),
      { horizontal: 'right', vertical: 'center' },
      HEADER_TEXT_COLOR,
    );
  });

  drawHeaderArrowsLeft(page, values.length, cardOriginX, blockOriginY, cellHeight);
}

const ARROW_SIZE = mm(1.2);
const ARROW_TIP_GAP = mm(0.3);
// Exactly the arrow's own footprint from the edge - text stops right where
// the arrow starts, no separate breathing-room gap on top of that.
const ARROW_FOOTPRINT = ARROW_SIZE + ARROW_TIP_GAP;

// Small downward-pointing triangles, one per column, sitting just above the
// edge they point into (a card's top edge, or a block's own top edge).
function drawHeaderArrowsTop(page: PDFPage, count: number, edgeY: number, startX: number, cellWidth: number): void {
  const tipY = edgeY - ARROW_TIP_GAP;
  const baseY = tipY - ARROW_SIZE;
  for (let i = 0; i < count; i++) {
    const cx = startX + cellWidth * i + cellWidth / 2;
    drawFilledTriangleTL(
      page,
      point(cx - ARROW_SIZE / 2, baseY),
      point(cx + ARROW_SIZE / 2, baseY),
      point(cx, tipY),
      CARD_OUTLINE,
    );
  }
}

// Small rightward-pointing triangles, one per row, sitting just left of the
// edge they point into (a card's left edge, or a block's own left edge).
function drawHeaderArrowsLeft(page: PDFPage, count: number, edgeX: number, startY: number, cellHeight: number): void {
  const tipX = edgeX - ARROW_TIP_GAP;
  const baseX = tipX - ARROW_SIZE;
  for (let i = 0; i < count; i++) {
    const cy = startY + cellHeight * i + cellHeight / 2;
    drawFilledTriangleTL(
      page,
      point(baseX, cy - ARROW_SIZE / 2),
      point(baseX, cy + ARROW_SIZE / 2),
      point(tipX, cy),
      CARD_OUTLINE,
    );
  }
}

function renderPassphraseCard(
  page: PDFPage,
  font: PDFFont,
  parameters: PassphraseParameters,
  cardNumber: number,
  cardOrigin: Point,
  headerHeight: number,
  headerWidth: number,
  startRowNumber: number,
): void {
  drawRoundedRectTL(page, cardOrigin, parameters.cardSize, parameters.cardCornerRadius, {
    borderColor: CARD_OUTLINE,
    borderWidth: Config.PEN_NORMAL,
  });
  drawCutterGuides(page, cardOrigin, parameters.cardSize);

  const blocks = parameters.getCardCharacters(cardNumber);
  const blockSize = size(parameters.charsPerBlock * parameters.cellSize.width, parameters.blockThickness);

  let blockOrigin = point(cardOrigin.x + parameters.cardPadding, cardOrigin.y + parameters.cardPadding);
  const firstBlockOrigin = blockOrigin;
  let lastBlockOrigin = blockOrigin;

  // Position-number header (one per column, e.g. 1..charsPerBlock): every
  // row/column holds its own separate passphrase, so they all share the same
  // numbering - draw it once, above/left of the whole card, rather than
  // repeating an identical header over every block. Anchored to the card's
  // own border (cardOrigin), not the mesh's edge (firstBlockOrigin) - it
  // lives in the card's external margin, above the border line itself.
  drawPassphraseColumnHeader(page, font, blocks[0], cardOrigin.y, firstBlockOrigin.x, headerHeight, parameters.cellSize.width, '99');

  blocks.forEach((positions, blockIndex) => {
    // Top-left/top-right marks live at *this block's* own top corners (0.5mm
    // above its mesh, flush with its own left/right edges) - one dot cluster
    // per row/column, not one for the whole card - so the count of dots
    // tells you which row you're punching, continuing across cards.
    drawRowTopMarks(page, blockOrigin, blockSize, startRowNumber + blockIndex, parameters.cellSize.width);

    // Bit place-value header (7 values, shared across every block): stays in
    // the single external margin reserved for the whole card, positioned per
    // block along its variable axis only.
    drawPassphraseRowHeader(page, font, Config.PASSPHRASE_COLUMN_VALUES, cardOrigin.x, blockOrigin.y, headerWidth, parameters.cellSize.height, '64');

    drawPassphraseBlock(page, positions, parameters.cellSize, blockOrigin);

    lastBlockOrigin = blockOrigin;
    blockOrigin = point(blockOrigin.x, blockOrigin.y + blockSize.height + parameters.cardPadding);
  });

  // Single bottom-left mark, 0.5mm below the last block's own bottom edge -
  // not the card's bottom edge, which can sit well past the last block when
  // the card is taller/wider than an exact multiple of the block size. Flush
  // with the first block's own left edge, which every row shares already.
  const bottomLeft = getBottomLeftCornerMarkOffset(0);
  drawFilledCircleTL(
    page,
    point(firstBlockOrigin.x + bottomLeft.x, lastBlockOrigin.y + blockSize.height + bottomLeft.y),
    Config.CORNER_MARK_RADIUS,
    CARD_OUTLINE,
  );
}

// Top-left dot cluster (count = rowNumber) and a single top-right dot, both
// sitting 0.5mm above this row's own mesh and flush with its own left/right
// edges - i.e. this row's corners, not the whole card's. `padding: 0` in the
// offset helpers below is deliberate: rowOrigin already *is* the mesh corner,
// so there's no extra border gap to flush against. Shared by passphrase
// blocks and seed sections (Card split > 1) - both are "rows" that need
// telling apart by punched dots once the paper stencil is gone.
function drawRowTopMarks(page: PDFPage, rowOrigin: Point, rowSize: Size, rowNumber: number, pitch: number): void {
  for (const offset of getTopLeftCornerMarkOffsets(rowNumber, 0, pitch)) {
    drawFilledCircleTL(page, point(rowOrigin.x + offset.x, rowOrigin.y + offset.y), Config.CORNER_MARK_RADIUS, CARD_OUTLINE);
  }

  const topRight = getTopRightCornerMarkOffset(0);
  drawFilledCircleTL(
    page,
    point(rowOrigin.x + rowSize.width + topRight.x, rowOrigin.y + topRight.y),
    Config.CORNER_MARK_RADIUS,
    CARD_OUTLINE,
  );
}

function drawPassphraseBlock(page: PDFPage, positions: number[], cellSize: { width: number; height: number }, blockOrigin: Point): void {
  const bitCount = Config.PASSPHRASE_COLUMN_VALUES.length;
  const charSize = size(cellSize.width, bitCount * cellSize.height);

  let charOrigin = blockOrigin;
  positions.forEach((position) => {
    const charShaded = position % 2 === 0;
    if (charShaded) {
      drawRectTL(page, charOrigin, charSize, { color: SHADE });
    }
    drawPassphraseBitShading(page, charOrigin, charSize, cellSize, charShaded);
    drawRectTL(page, charOrigin, charSize, { borderColor: CARD_OUTLINE, borderWidth: Config.PEN_NORMAL });
    drawPassphraseGridLines(page, charOrigin, charSize, cellSize);

    charOrigin = point(charOrigin.x + charSize.width, charOrigin.y);
  });
}

function drawPassphraseBitShading(
  page: PDFPage,
  origin: Point,
  charSize: { width: number; height: number },
  cellSize: { width: number; height: number },
  charShaded: boolean,
): void {
  const bitCount = Config.PASSPHRASE_COLUMN_VALUES.length;
  const color = charShaded ? SHADE_INTERSECTION : SHADE;
  for (let row = 1; row < bitCount; row += 2) {
    const y = origin.y + cellSize.height * row;
    drawRectTL(page, point(origin.x, y), size(charSize.width, cellSize.height), { color });
  }
}

function drawPassphraseGridLines(
  page: PDFPage,
  origin: Point,
  charSize: { width: number; height: number },
  cellSize: { width: number; height: number },
): void {
  const bitCount = Config.PASSPHRASE_COLUMN_VALUES.length;
  for (let row = 1; row < bitCount; row++) {
    const y = origin.y + cellSize.height * row;
    drawLineTL(page, point(origin.x, y), point(origin.x + charSize.width, y), { color: GRID_LINE, thickness: Config.PEN_THIN });
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
      drawBinaryBitShading(page, wordOrigin, section.wordSize, section.cellSize, wordShaded);
    }
    drawRectTL(page, wordOrigin, section.wordSize, { borderColor: CARD_OUTLINE, borderWidth: Config.PEN_NORMAL });
    drawWordGridLines(page, wordOrigin, section.wordSize, section.cellSize, section.encoding);
    drawWordCellCharacters(page, font, wordOrigin, section.cellSize, section.encoding);
    // Drawn last (on top of the alphabet/number characters) so the word
    // number stays legible over them instead of being painted over.
    drawWordNumber(page, boldFont, wordOrigin, section.wordSize, wordNumber);

    wordOrigin = point(wordOrigin.x + section.wordSize.width, wordOrigin.y);
  });
}

function drawBinaryBitShading(
  page: PDFPage,
  origin: Point,
  wordSize: { width: number; height: number },
  cellSize: { width: number; height: number },
  wordShaded: boolean,
): void {
  const layout = encodingLayout(EncodingType.Binary);
  const color = wordShaded ? SHADE_INTERSECTION : SHADE;
  for (let row = 1; row < layout.rows; row += 2) {
    const y = origin.y + cellSize.height * row;
    drawRectTL(page, point(origin.x, y), size(wordSize.width, cellSize.height), { color });
  }
}

function drawWordNumber(page: PDFPage, boldFont: PDFFont, origin: Point, wordSize: { width: number; height: number }, wordNumber: number): void {
  // Binary's word block is a narrow column (like Alphabet/Number's), so the
  // normal centered-above-block number placement already fits it well. A
  // small top gap keeps the number off the mesh's own top edge instead of
  // sitting flush on it.
  const textBox = size(wordSize.width, wordSize.height - Config.WORD_NR_TOP_GAP);
  const fontSize = getFontSizeForBox({
    font: boldFont,
    fontSizeRange: Config.WORD_NR_FONT_SIZE_RANGE,
    increaseStep: 1,
    sampleText: '42.',
    maxSize: textBox,
  });
  drawTextInBoxTL(
    page,
    `${wordNumber}`,
    boldFont,
    fontSize,
    point(origin.x, origin.y + Config.WORD_NR_TOP_GAP),
    textBox,
    { horizontal: 'center', vertical: 'top' },
    WORD_NR_TEXT,
    WORD_NR_OPACITY,
  );
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

function drawWordCellCharacters(page: PDFPage, font: PDFFont, origin: Point, cellSize: { width: number; height: number }, encoding: EncodingType): void {
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
