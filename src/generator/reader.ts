import { PDFDocument, PDFFont, PDFPage, StandardFonts, degrees, rgb } from 'pdf-lib';
import { GeneratorParameters, PassphraseParameters } from './params';
import { EncodingType, encodingLayout } from './encoding';
import * as Config from './config';
import { getFontSizeForBox } from './fontFit';
import { drawLineTL, drawRectTL, drawTextInBoxTL, drawRotatedTextInBoxTL, toPdfY } from './pdfDraw';
import { layoutNumberedBoxes } from './readerBoxes';
import { buildSeedParamsSummary, buildPassphraseParamsSummary } from './summary';
import { drawPageChrome } from './writer';
import { Point, Size, point, size } from '../units';

const BLACK = rgb(0, 0, 0);
const LABEL_TEXT = rgb(0.3, 0.3, 0.3);
const NUMBER_TEXT = rgb(0, 0, 0);
const CUT_COLOR = rgb(...Config.READER_CUT_COLOR_RGB);
// Big word numbers overlaid inside the mesh itself use the same
// semi-transparent treatment as the writer's own word numbers, so they read
// as a watermark rather than competing with the character ticks.
const WORD_NR_TEXT = BLACK;
const WORD_NR_OPACITY = 0.6;
// Matches the writer's own alternating word shading - since every character
// tick is now the same weight, this is what tells adjacent words apart. Also
// used to set apart the pre-printed word-number cell on each seed fill-in box,
// and the row where the user writes the decoded character on each passphrase
// cross-off grid, from the plain white cells around them.
const WORD_SHADE = rgb(0.92, 0.92, 0.92);

// Everything below the page chrome is drawn relative to this local origin -
// matches how far down the old .NET reader started (title + some breathing
// room), so the diagram never collides with the header. `origin.x` (or
// `origin.y` for the transposed shapes) is the cut line itself: you cut
// along it, then insert the card from the far side and slide it in, so
// position numbers run from that far side down to 1, right at the cut.
const DIAGRAM_ORIGIN = point(Config.DOCUMENT_MARGIN_H, Config.DOCUMENT_MARGIN_TOP + Config.READER_SECTION_GAP);

// Tracks the current page and vertical write position for content that can
// run longer than one page (fill-in boxes, cross-off tables) - starts a new
// page rather than silently drawing past the bottom margin.
interface PageCursor {
  doc: PDFDocument;
  pages: PDFPage[];
  page: PDFPage;
  y: number;
}

function newReaderPage(doc: PDFDocument): PDFPage {
  return doc.addPage([Config.DOCUMENT_SIZE.width, Config.DOCUMENT_SIZE.height]);
}

function createPageCursor(doc: PDFDocument, firstPage: PDFPage, startY: number): PageCursor {
  return { doc, pages: [firstPage], page: firstPage, y: startY };
}

function ensureSpace(cursor: PageCursor, neededHeight: number): void {
  const maxY = Config.DOCUMENT_SIZE.height - Config.DOCUMENT_MARGIN_BOTTOM;
  if (cursor.y + neededHeight <= maxY) return;
  const page = newReaderPage(cursor.doc);
  cursor.pages.push(page);
  cursor.page = page;
  cursor.y = Config.DOCUMENT_MARGIN_TOP;
}

function labelFontSize(font: PDFFont, boxSize: Size): number {
  return getFontSizeForBox({ font, fontSizeRange: Config.CELL_FONT_SIZE_RANGE, increaseStep: 0.2, sampleText: '1024', maxSize: boxSize });
}

function positionNumberFontSize(font: PDFFont, pitch: number): number {
  // Position ticks are drawn rotated (see drawRowOriented*), one per
  // character/row, so the pitch can be as narrow as a single mesh cell -
  // needs the cell-scale range, not the word-number range, to shrink small
  // enough to fit.
  return getFontSizeForBox({
    font,
    fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
    increaseStep: 0.2,
    sampleText: '999',
    maxSize: size(Config.READER_POSITION_NUMBER_HEIGHT, pitch),
  });
}

// "Scissors" by Anonymous, via Openclipart / freesvg.org (id 7518), released
// to the public domain. Reproduced verbatim as vector path data.
const SCISSORS_VIEWBOX_HEIGHT = 430.69;
const SCISSORS_PATHS = [
  'm223.66 189.87c40.11-55.31 48.78-95.731 62.36-91.863 10.62 3.023 5.52 12.113 33.59 18.523 26.95 6.16 54.48-15.96 60.2-42.656 7.62-26.163-4.73-59.047-32.36-67.165-27.34-9.8952-59.93 6.188-69.66 33.419-14.09 31.13-21.32 72.242-66.88 107.53l-34.96 27.09-121.01 170.84c-13.534 22.08-21.658 51.47-4.115 79.44l172.84-235.16zm129.82-103.12c-23.31 23.251-64.54 9.071-64.47-21.965-1.65-28.553 33.06-54.558 58.85-38.26 21.73 11.428 21.57 44.309 5.62 60.225z',
  'm161.84 191.37c-39.99-55.39-48.57-95.832-62.161-91.994-10.627 3.004-5.543 12.104-33.624 18.454-26.962 6.09-54.445-16.09-60.106-42.796-7.5603-26.18 4.862-59.036 32.508-67.093 27.363-9.8338 59.916 6.322 69.583 33.575 14.03 31.161 21.16 72.294 66.64 107.68l34.91 27.16 120.62 171.11c13.49 22.12 21.54 51.52 3.94 79.45l-172.31-235.55zm-129.59-103.4c23.254 23.302 64.514 9.214 64.512-21.821 1.714-28.55-32.933-54.632-58.766-38.391-21.747 11.379-21.664 44.26-5.746 60.212z',
];

// Draws the scissors icon at the start of a cut line, oriented so the blades
// point along the line itself (rotated 90° for a horizontal cut).
function drawScissorsIcon(page: PDFPage, tip: Point, iconSize: number, orientation: 'vertical' | 'horizontal'): void {
  const scale = iconSize / SCISSORS_VIEWBOX_HEIGHT;
  const rotate = orientation === 'vertical' ? degrees(0) : degrees(90);
  // Icon's own top-left corner sits just past the tip, out in the overflow
  // margin beyond the cut line's end.
  const origin = orientation === 'vertical' ? point(tip.x - iconSize / 2, tip.y - iconSize) : point(tip.x - iconSize, tip.y - iconSize / 2);

  for (const d of SCISSORS_PATHS) {
    page.drawSvgPath(d, {
      x: origin.x,
      y: toPdfY(page, origin, iconSize) + iconSize,
      scale,
      rotate,
      color: CUT_COLOR,
    });
  }
}

// Value axis (letters/digits/place-values) runs vertically, character
// position runs horizontally - Alphabet, Number, and Binary. Ticked every
// character, but only word boundaries (every `cols`-th tick) are bold; the
// number shown per word is a large, semi-transparent overlay inside that
// word's own mesh area, matching the writer's own word-number style.
function drawRowOrientedSeedDiagram(page: PDFPage, font: PDFFont, boldFont: PDFFont, parameters: GeneratorParameters): number {
  const isBinary = parameters.seedEncoding === EncodingType.Binary;
  const layout = encodingLayout(parameters.seedEncoding);
  const valueLabels = isBinary ? Config.BINARY_COLUMN_VALUES.map(String) : layout.cellLabels!;
  const cellSize = parameters.cellSize;
  const cardSplit = parameters.cardSplit;
  const cardWidth = parameters.cardSize.width;
  const cardPadding = parameters.cardPadding;
  const charWidth = cellSize.width;
  const cols = layout.cols; // 4 for alphabet/number word groups, 1 for binary-horizontal
  const wordWidth = parameters.wordSize.width;
  const maxWordsPerSection = parameters.maxWordsPerSection;
  const charsPerSection = maxWordsPerSection * cols;
  const sectionHeight = parameters.sectionSize.height;
  // Matches the writer's own section spacing: sectionSize.height already
  // has a cardPadding-sized gap carved out of it for every section but the
  // last, so consecutive sections are pitched one section plus that gap
  // apart - same logic as the passphrase reader's own block spacing.
  const sectionPitch = sectionHeight + cardPadding;
  // The diagram's own true top/bottom - the card's physical edges, one
  // cardPadding further out than the first/last section's own mesh - so the
  // reader always represents the whole card, not just its punched rows.
  const cardTop = DIAGRAM_ORIGIN.y - cardPadding;
  const cardBottom = DIAGRAM_ORIGIN.y + sectionPitch * (cardSplit - 1) + sectionHeight + cardPadding;

  const origin = DIAGRAM_ORIGIN;
  const labelSize = labelFontSize(font, size(Config.READER_LABEL_COLUMN_WIDTH, cellSize.height));
  const wordNumberFontSize = getFontSizeForBox({
    font: boldFont,
    fontSizeRange: Config.WORD_NR_FONT_SIZE_RANGE,
    increaseStep: 1,
    sampleText: '42.',
    maxSize: size(wordWidth, sectionHeight - Config.WORD_NR_TOP_GAP),
  });

  // Same size/scale as the passphrase reader's position numbers.
  const smallNumberFontSize = positionNumberFontSize(font, charWidth);

  for (let s = 0; s < cardSplit; s++) {
    const sectionY = origin.y + s * sectionPitch;

    // Alternating shading, one word per band - like the writer's own
    // checkerboard shading, so adjacent words are easy to tell apart even
    // though every character tick is now the same weight (see below). Spans
    // the same top/bottom as the guideline below (the full card, for the
    // outermost sections), and is offset by half a character width so a
    // band's edge falls between two ticks rather than right on one. Drawn
    // first, behind everything else, so it never paints over the guideline.
    const shadeTop = s === 0 ? cardTop : sectionY;
    const shadeBottom = s === cardSplit - 1 ? cardBottom : sectionY + sectionHeight;
    for (let w = 0; w < maxWordsPerSection; w++) {
      const wordIndex = s * maxWordsPerSection + w;
      if (wordIndex % 2 === 0) {
        const shadeX = origin.x + cardPadding + w * wordWidth + charWidth / 2;
        drawRectTL(page, point(shadeX, shadeTop), size(wordWidth, shadeBottom - shadeTop), { color: WORD_SHADE });
      }
    }

    // Value-axis labels + row separators - confined to the label column,
    // left of the cut line. Rows divide the section's own mesh height evenly
    // (cardPadding is already excluded from sectionHeight, so it must not be
    // added again here).
    for (let i = 0; i <= valueLabels.length; i++) {
      const rowY = sectionY + i * cellSize.height;
      drawLineTL(page, point(origin.x - Config.READER_LABEL_COLUMN_WIDTH, rowY), point(origin.x, rowY), {
        color: BLACK,
        thickness: Config.PEN_THIN,
      });
      if (i < valueLabels.length) {
        drawTextInBoxTL(
          page,
          valueLabels[i],
          font,
          labelSize,
          point(origin.x - Config.READER_LABEL_COLUMN_WIDTH, rowY),
          size(Config.READER_LABEL_COLUMN_WIDTH - Config.CUTTER_GUIDE_LENGTH, cellSize.height),
          { horizontal: 'right', vertical: 'center' },
          LABEL_TEXT,
        );
      }
    }

    // Guideline pair for this section (top/bottom), extended past the card's
    // own width - what you align flush with the card's mesh top/bottom edges.
    // The diagram's true outer edges - the first section's top, the last
    // section's bottom - are pulled out to the card's own physical edges
    // (one cardPadding further) and drawn bolder, since sliding the reader
    // over the card means the whole card, padding included.
    const sectionEdges: [number, boolean][] = [
      [s === 0 ? cardTop : sectionY, s === 0],
      [s === cardSplit - 1 ? cardBottom : sectionY + sectionHeight, s === cardSplit - 1],
    ];
    for (const [y, isOuterEdge] of sectionEdges) {
      drawLineTL(page, point(origin.x - Config.READER_GUIDELINE_OVERFLOW, y), point(origin.x + cardWidth + Config.READER_GUIDELINE_OVERFLOW, y), {
        color: BLACK,
        thickness: isOuterEdge ? Config.PEN_EXTRA_THICK : Config.PEN_THICK,
      });
    }

    // Big, semi-transparent word numbers, one per word - numbering starts at
    // the section's first word on the right and ends at its last word, right
    // at the cut line, matching how the card is inserted from the right.
    // Shifted the same half-character as the shading, so the number stays
    // horizontally centered in its own gray/white stripe.
    for (let w = 0; w < maxWordsPerSection; w++) {
      const wordX = origin.x + cardPadding + w * wordWidth + charWidth / 2;
      const wordNumber = s * maxWordsPerSection + (maxWordsPerSection - w);
      drawTextInBoxTL(
        page,
        `${wordNumber}`,
        boldFont,
        wordNumberFontSize,
        point(wordX, sectionY + Config.WORD_NR_TOP_GAP),
        size(wordWidth, sectionHeight - Config.WORD_NR_TOP_GAP),
        { horizontal: 'center', vertical: 'top' },
        WORD_NR_TEXT,
        WORD_NR_OPACITY,
      );
    }
  }

  // Character ticks, one per column, extended past the mesh's own height (as
  // long as the cut line itself) so they're easy to follow as you slide the
  // card. Ticks represent words, not individual mesh cells, so there's
  // exactly one per character (skipping the redundant leading tick that
  // would otherwise sit right next to the cut line, which already marks that
  // edge) - the cutline is c=0's own boundary already. Each gets a small
  // number, 1-4 repeating, counting from the right within its own word -
  // matching the same right-to-left direction as everything else. Drawn once
  // for the whole card, spanning every section, rather than repeated per
  // section - same as the passphrase reader's own position ticks - since the
  // tick positions and their repeating 1-4 numbering are identical in every
  // section.
  const tickTop = cardTop - Config.READER_CUTLINE_OVERFLOW;
  const tickBottom = cardBottom + Config.READER_CUTLINE_OVERFLOW;
  const numberStripBottom = tickTop - Config.READER_POSITION_NUMBER_GAP;
  for (let c = 1; c <= charsPerSection; c++) {
    const x = origin.x + cardPadding + c * charWidth;
    drawLineTL(page, point(x, tickTop), point(x, tickBottom), { color: BLACK, thickness: Config.PEN_THIN });

    const localIndex = ((cols - (c % cols)) % cols) + 1;
    drawRotatedTextInBoxTL(
      page,
      `${localIndex}`,
      font,
      smallNumberFontSize,
      point(x - charWidth / 2, numberStripBottom - Config.READER_POSITION_NUMBER_HEIGHT),
      size(charWidth, Config.READER_POSITION_NUMBER_HEIGHT),
      LABEL_TEXT,
      'end',
    );
  }

  drawLineTL(page, point(origin.x, cardTop - Config.READER_CUTLINE_OVERFLOW), point(origin.x, cardBottom + Config.READER_CUTLINE_OVERFLOW), {
    color: CUT_COLOR,
    thickness: Config.PEN_NORMAL,
    dashArray: Config.READER_CUT_DASH_ARRAY,
  });
  drawScissorsIcon(page, point(origin.x, cardTop - Config.READER_CUTLINE_OVERFLOW), Config.READER_SCISSORS_SIZE, 'vertical');

  return cardBottom + Config.READER_GUIDELINE_OVERFLOW;
}

interface FillInGroup {
  heading: string;
  count: number;
  startNumber: number;
  // 4 for a seed word (write its 4-letter/4-digit prefix, or a Binary word's
  // index, one character per cell); 1 for a passphrase character. Seed
  // word-tables (>1) are grouped a fixed number per row with a gap between
  // each word's own table; passphrase boxes keep wrapping to fill the width.
  charsPerBox: number;
}

function drawFillInBoxes(cursor: PageCursor, font: PDFFont, boldFont: PDFFont, gridStartX: number, groups: FillInGroup[]): void {
  const maxWidth = Config.DOCUMENT_MARGIN_H + Config.EFFECTIVE_PAGE_SIZE.width - gridStartX;

  for (const group of groups) {
    const isWordTable = group.charsPerBox > 1;
    const boxWidth = Config.READER_FILLBOX_NUMBER_WIDTH + group.charsPerBox * Config.READER_FILLBOX_CHAR_WIDTH;
    const boxSize = size(boxWidth, Config.READER_FILLBOX_HEIGHT);
    const perRow = isWordTable ? Config.READER_FILLBOX_WORDS_PER_ROW : Math.max(1, Math.floor(maxWidth / boxWidth));
    const rowGap = isWordTable ? Config.READER_FILLBOX_WORD_GAP : 0;
    const layoutOptions = isWordTable ? { perRow, gap: Config.READER_FILLBOX_WORD_GAP, rowGap } : {};

    ensureSpace(cursor, Config.READER_CARD_HEADING_HEIGHT);
    drawTextInBoxTL(
      cursor.page,
      group.heading,
      boldFont,
      Config.FOOTER_FONT_SIZE + 1,
      point(gridStartX, cursor.y),
      size(maxWidth, Config.READER_CARD_HEADING_HEIGHT),
      { horizontal: 'left', vertical: 'center' },
      NUMBER_TEXT,
    );
    cursor.y += Config.READER_CARD_HEADING_HEIGHT;

    const boxes = layoutNumberedBoxes(group.count, group.startNumber, boxSize, maxWidth, layoutOptions);
    const numberFontSize = getFontSizeForBox({
      font,
      fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
      increaseStep: 0.2,
      sampleText: '999',
      maxSize: size(Config.READER_FILLBOX_NUMBER_WIDTH, boxSize.height),
    });

    // Boxes come out of layoutNumberedBoxes in row-major order, `perRow` at a
    // time - process one row per iteration so a page break can only ever
    // land between rows, never through the middle of one.
    for (let i = 0; i < boxes.length; i += perRow) {
      const rowBoxes = boxes.slice(i, i + perRow);
      ensureSpace(cursor, boxSize.height);
      const page = cursor.page;
      const rowY = cursor.y;

      for (const box of rowBoxes) {
        const origin = point(gridStartX + box.origin.x, rowY);
        // Shade the number cell gray before anything else is drawn over it,
        // so it reads as pre-filled and set apart from the blank character
        // cells beside it that the user writes into.
        drawRectTL(page, origin, size(Config.READER_FILLBOX_NUMBER_WIDTH, boxSize.height), { color: WORD_SHADE });
        // Bold outline, and a bold divider setting the number cell apart
        // from the word's own character cells.
        drawRectTL(page, origin, boxSize, { borderColor: BLACK, borderWidth: Config.PEN_THICK });
        const numberDividerX = origin.x + Config.READER_FILLBOX_NUMBER_WIDTH;
        drawLineTL(page, point(numberDividerX, origin.y), point(numberDividerX, origin.y + boxSize.height), {
          color: BLACK,
          thickness: Config.PEN_THICK,
        });
        // One (lighter) divider between each character cell.
        for (let k = 1; k < group.charsPerBox; k++) {
          const dividerX = numberDividerX + k * Config.READER_FILLBOX_CHAR_WIDTH;
          drawLineTL(page, point(dividerX, origin.y), point(dividerX, origin.y + boxSize.height), { color: BLACK, thickness: Config.PEN_NORMAL });
        }
        drawTextInBoxTL(
          page,
          `${box.number}`,
          font,
          numberFontSize,
          origin,
          size(Config.READER_FILLBOX_NUMBER_WIDTH, boxSize.height),
          { horizontal: 'center', vertical: 'center' },
          LABEL_TEXT,
        );
      }

      const isLastRow = i + perRow >= boxes.length;
      cursor.y += boxSize.height + (isLastRow ? 0 : rowGap);
    }

    cursor.y += Config.PEN_THICK;
  }
}

export async function generateSeedReaderPdf(parameters: GeneratorParameters): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(Config.DOCUMENT_TITLE);
  const font = await doc.embedFont(StandardFonts.Courier);
  const boldFont = await doc.embedFont(StandardFonts.CourierBold);
  const chromeFont = await doc.embedFont(StandardFonts.Helvetica);
  const chromeBoldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([Config.DOCUMENT_SIZE.width, Config.DOCUMENT_SIZE.height]);

  const bottom = drawRowOrientedSeedDiagram(page, font, boldFont, parameters);

  const cursor = createPageCursor(doc, page, bottom + Config.READER_SECTION_GAP);
  const gridStartX = DIAGRAM_ORIGIN.x + parameters.cardPadding;
  if (parameters.seedEncoding === EncodingType.Binary) {
    // Binary words don't have a printed character to copy down - what's
    // punched is the bit pattern itself - so the fill-in worksheet is the
    // same cross-off grid the passphrase reader uses: one column per word,
    // one row per bit place-value, and a shaded row to write the decoded
    // word index into.
    drawCrossOffTables(cursor, font, boldFont, gridStartX, Config.BINARY_COLUMN_VALUES, parameters.effectiveCardCount, (cardNumber) => {
      const card = parameters.getCardParameters(cardNumber);
      return [{ count: card.wordsCount, startNumber: card.sections[0].wordNumbers[0] }];
    });
  } else {
    const groups: FillInGroup[] = [];
    for (let i = 1; i <= parameters.effectiveCardCount; i++) {
      const card = parameters.getCardParameters(i);
      groups.push({ heading: `Card ${i}`, count: card.wordsCount, startNumber: card.sections[0].wordNumbers[0], charsPerBox: 4 });
    }
    drawFillInBoxes(cursor, font, boldFont, gridStartX, groups);
  }

  drawPageChrome(cursor.pages, chromeFont, chromeBoldFont, Config.SEED_READER_TITLE_TEXT, buildSeedParamsSummary(parameters));

  return doc.save();
}

export async function generatePassphraseReaderPdf(parameters: PassphraseParameters): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(Config.DOCUMENT_TITLE);
  const font = await doc.embedFont(StandardFonts.Courier);
  const boldFont = await doc.embedFont(StandardFonts.CourierBold);
  const chromeFont = await doc.embedFont(StandardFonts.Helvetica);
  const chromeBoldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([Config.DOCUMENT_SIZE.width, Config.DOCUMENT_SIZE.height]);

  const bottom = drawRowOrientedPassphraseDiagram(page, font, parameters);

  const cursor = createPageCursor(doc, page, bottom + Config.READER_SECTION_GAP);
  const gridStartX = DIAGRAM_ORIGIN.x + parameters.cardPadding;
  drawCrossOffTables(cursor, font, boldFont, gridStartX, Config.PASSPHRASE_COLUMN_VALUES, parameters.cardCount, () =>
    Array.from({ length: parameters.blockCount }, () => ({ count: parameters.charsPerBlock, startNumber: 1 })),
  );

  drawPageChrome(
    cursor.pages,
    chromeFont,
    chromeBoldFont,
    Config.PASSPHRASE_READER_TITLE_TEXT,
    buildPassphraseParamsSummary(parameters),
  );

  return doc.save();
}

// One block of a cross-off worksheet: `count` columns, numbered consecutively
// from `startNumber` - either a passphrase's character positions (1..N,
// resetting every block) or a Binary seed card's word numbers (running
// across the whole card).
interface CrossOffBlock {
  count: number;
  startNumber: number;
}

// A worksheet mirroring the mesh structure itself: one grid per block, its
// columns matching the card's own character/word positions and its rows the
// same bit place-values shown in the ruler above. As you read each cell off
// the card, cross it here; a shaded extra row below lets you write the
// character/word-index each column's crossed bits decode to. Repeated once
// per block, for every card. Shared by the passphrase reader (one block per
// passphrase, columns = characters) and the Binary-encoded seed reader (one
// block per card, columns = words).
function drawCrossOffTables(
  cursor: PageCursor,
  font: PDFFont,
  boldFont: PDFFont,
  gridStartX: number,
  values: number[],
  cardCount: number,
  blocksForCard: (cardNumber: number) => CrossOffBlock[],
): void {
  const rowLabelWidth = Config.READER_LABEL_COLUMN_WIDTH;
  const gridX = gridStartX;
  const maxWidth = Config.DOCUMENT_MARGIN_H + Config.EFFECTIVE_PAGE_SIZE.width - gridX;
  const cellHeight = Config.READER_CROSS_CELL_SIZE.height;
  const labelFontSize2 = labelFontSize(font, size(rowLabelWidth, cellHeight));

  for (let cardNumber = 1; cardNumber <= cardCount; cardNumber++) {
    ensureSpace(cursor, Config.READER_CARD_HEADING_HEIGHT);
    drawTextInBoxTL(
      cursor.page,
      `Card ${cardNumber}`,
      boldFont,
      Config.FOOTER_FONT_SIZE + 1,
      point(gridX, cursor.y),
      size(maxWidth, Config.READER_CARD_HEADING_HEIGHT),
      { horizontal: 'left', vertical: 'center' },
      NUMBER_TEXT,
    );
    cursor.y += Config.READER_CARD_HEADING_HEIGHT;

    for (const block of blocksForCard(cardNumber)) {
      // Compact: shrink the cell width (down to a still-markable minimum) so
      // the whole block fits across in one line: only that many columns wrap
      // into a second band if even the minimum width can't fit them all.
      const cellWidth = Math.max(Config.READER_CROSS_MIN_CELL_WIDTH, Math.min(Config.READER_CROSS_CELL_SIZE.width, maxWidth / block.count));
      const colsPerBand = Math.max(1, Math.floor(maxWidth / cellWidth));
      const bandCount = Math.ceil(block.count / colsPerBand);
      // One atomic unit: header + value-rows grid + the shaded decoded-value
      // row, kept together on one page rather than split mid-grid by a page
      // break.
      const bandHeight = Config.READER_CROSS_HEADER_HEIGHT + (values.length + 1) * cellHeight;
      const headerFontSize = getFontSizeForBox({
        font: boldFont,
        fontSizeRange: Config.CELL_FONT_SIZE_RANGE,
        increaseStep: 0.2,
        sampleText: '999',
        maxSize: size(Config.READER_CROSS_HEADER_HEIGHT, cellWidth),
      });

      for (let band = 0; band < bandCount; band++) {
        ensureSpace(cursor, bandHeight);
        const page = cursor.page;
        let y = cursor.y;
        const startCol = band * colsPerBand;
        const colsInBand = Math.min(colsPerBand, block.count - startCol);

        // Position header, matching the ruler's own numbering.
        for (let c = 0; c < colsInBand; c++) {
          drawTextInBoxTL(
            page,
            `${block.startNumber + startCol + c}`,
            boldFont,
            headerFontSize,
            point(gridX + c * cellWidth, y),
            size(cellWidth, Config.READER_CROSS_HEADER_HEIGHT),
            { horizontal: 'center', vertical: 'center' },
            NUMBER_TEXT,
          );
        }
        y += Config.READER_CROSS_HEADER_HEIGHT;

        // Cross-off grid, one row per bit place-value - the whole worksheet
        // for one passphrase/word, nothing else needed below it.
        const gridTop = y;
        for (let r = 0; r < values.length; r++) {
          const rowY = y + r * cellHeight;
          drawTextInBoxTL(
            page,
            `${values[r]}`,
            font,
            labelFontSize2,
            point(gridX - rowLabelWidth, rowY),
            size(rowLabelWidth - Config.CUTTER_GUIDE_LENGTH, cellHeight),
            { horizontal: 'right', vertical: 'center' },
            LABEL_TEXT,
          );
          for (let c = 0; c < colsInBand; c++) {
            drawRectTL(page, point(gridX + c * cellWidth, rowY), size(cellWidth, cellHeight), { borderColor: BLACK, borderWidth: Config.PEN_THIN });
          }
        }
        y += values.length * cellHeight;

        // Shaded row below the bit-value grid - the decoded character/word
        // index for each column goes here, gray like the seed reader's
        // number cells so it reads as the "write your answer here" spot.
        drawTextInBoxTL(
          page,
          '=',
          font,
          labelFontSize2,
          point(gridX - rowLabelWidth, y),
          size(rowLabelWidth - Config.CUTTER_GUIDE_LENGTH, cellHeight),
          { horizontal: 'right', vertical: 'center' },
          LABEL_TEXT,
        );
        for (let c = 0; c < colsInBand; c++) {
          drawRectTL(page, point(gridX + c * cellWidth, y), size(cellWidth, cellHeight), {
            color: WORD_SHADE,
            borderColor: BLACK,
            borderWidth: Config.PEN_THIN,
          });
        }
        y += cellHeight;

        // Bold frame all the way around this block's own grid - every
        // passphrase/word gets a clear top, bottom, left, and right edge, not
        // just the thin cell borders.
        const gridRight = gridX + colsInBand * cellWidth;
        for (const frameY of [gridTop, y]) {
          drawLineTL(page, point(gridX, frameY), point(gridRight, frameY), { color: BLACK, thickness: Config.PEN_THICK });
        }
        for (const frameX of [gridX, gridRight]) {
          drawLineTL(page, point(frameX, gridTop), point(frameX, y), { color: BLACK, thickness: Config.PEN_THICK });
        }

        cursor.y = y + Config.READER_CROSS_BAND_GAP;
      }
      cursor.y += Config.READER_CROSS_BLOCK_GAP - Config.READER_CROSS_BAND_GAP;
    }
  }
}

// Bit place-values run vertically, character position runs horizontally.
function drawRowOrientedPassphraseDiagram(page: PDFPage, font: PDFFont, parameters: PassphraseParameters): number {
  const valueLabels = Config.PASSPHRASE_COLUMN_VALUES.map(String);
  const cellSize = parameters.cellSize;
  const cardPadding = parameters.cardPadding;
  const cardWidth = parameters.cardSize.width;
  const blockCount = parameters.blockCount;
  const charsPerBlock = parameters.charsPerBlock;
  const blockThickness = parameters.blockThickness;

  const origin = DIAGRAM_ORIGIN;
  // The reader represents the whole physical card - including any leftover
  // space below the last block, if the blocks don't fill the card exactly -
  // not just the space the blocks themselves occupy.
  const cardTop = origin.y - cardPadding;
  const cardBottom = cardTop + parameters.cardSize.height;
  const fontSize = labelFontSize(font, size(Config.READER_LABEL_COLUMN_WIDTH, cellSize.height));

  // Character-position numbers, drawn once (shared across every block).
  // Numbering starts at 1 on the right and ends at the cut line on the left,
  // matching how the card is inserted from the right and slid in.
  const numberFontSize = positionNumberFontSize(font, cellSize.width);
  // Ticks represent characters, not mesh-cell boundaries, so there's exactly
  // one per character - skip the redundant leading tick at c=0, which would
  // otherwise sit right next to the cut line that already marks that edge.
  // One tick and one number per character (charsPerBlock of each, c=1..N) -
  // sharing the same range keeps every number directly above its own tick,
  // instead of one drifting a position off from the other.
  const tickTop = cardTop - Config.READER_CUTLINE_OVERFLOW;
  const tickBottom = cardBottom + Config.READER_CUTLINE_OVERFLOW;
  const numberStripBottom = tickTop - Config.READER_POSITION_NUMBER_GAP;
  for (let c = 1; c <= charsPerBlock; c++) {
    const x = origin.x + cardPadding + c * cellSize.width;
    drawLineTL(page, point(x, tickTop), point(x, tickBottom), { color: BLACK, thickness: Config.PEN_THICK });

    // Centered exactly on the line's own x - not the cell it borders - since
    // it's the line that's numbered here, same as the seed reader.
    const charNumber = charsPerBlock - c + 1;
    drawRotatedTextInBoxTL(
      page,
      `${charNumber}`,
      font,
      numberFontSize,
      point(x - cellSize.width / 2, numberStripBottom - Config.READER_POSITION_NUMBER_HEIGHT),
      size(cellSize.width, Config.READER_POSITION_NUMBER_HEIGHT),
      NUMBER_TEXT,
      'end',
    );
  }

  let blockY = origin.y;
  for (let b = 0; b < blockCount; b++) {
    // Value-axis labels + row separators - confined to the label column,
    // left of the cut line, same as the seed reader.
    for (let i = 0; i <= valueLabels.length; i++) {
      const rowY = blockY + i * cellSize.height;
      drawLineTL(page, point(origin.x - Config.READER_LABEL_COLUMN_WIDTH, rowY), point(origin.x, rowY), {
        color: BLACK,
        thickness: Config.PEN_THIN,
      });
      if (i < valueLabels.length) {
        drawTextInBoxTL(
          page,
          valueLabels[i],
          font,
          fontSize,
          point(origin.x - Config.READER_LABEL_COLUMN_WIDTH, rowY),
          size(Config.READER_LABEL_COLUMN_WIDTH - Config.CUTTER_GUIDE_LENGTH, cellSize.height),
          { horizontal: 'right', vertical: 'center' },
          LABEL_TEXT,
        );
      }
    }
    // Top-of-64/bottom-of-1 boundary for this block, extended out to the
    // card's own width - drawn thin at every block's own top and bottom, so
    // each passphrase is fully framed even for the first/last block, where
    // cardPadding can otherwise leave the card's own mesh edge sitting short
    // of the bold outer border below/above with nothing marking it.
    for (const y of [blockY, blockY + blockThickness]) {
      drawLineTL(page, point(origin.x - Config.READER_GUIDELINE_OVERFLOW, y), point(origin.x + cardWidth + Config.READER_GUIDELINE_OVERFLOW, y), {
        color: BLACK,
        thickness: Config.PEN_THIN,
      });
    }
    blockY += blockThickness + cardPadding;
  }
  // Card's own physical top/bottom border - the outermost edge, bolder than
  // the per-block framing above (and drawn separately from it, since padding
  // can put it at a different y than the first/last block's own mesh edge).
  for (const y of [cardTop, cardBottom]) {
    drawLineTL(page, point(origin.x - Config.READER_GUIDELINE_OVERFLOW, y), point(origin.x + cardWidth + Config.READER_GUIDELINE_OVERFLOW, y), {
      color: BLACK,
      thickness: Config.PEN_EXTRA_THICK,
    });
  }

  drawLineTL(page, point(origin.x, cardTop - Config.READER_CUTLINE_OVERFLOW), point(origin.x, cardBottom + Config.READER_CUTLINE_OVERFLOW), {
    color: CUT_COLOR,
    thickness: Config.PEN_NORMAL,
    dashArray: Config.READER_CUT_DASH_ARRAY,
  });
  drawScissorsIcon(page, point(origin.x, cardTop - Config.READER_CUTLINE_OVERFLOW), Config.READER_SCISSORS_SIZE, 'vertical');

  return cardBottom + Config.READER_GUIDELINE_OVERFLOW;
}

