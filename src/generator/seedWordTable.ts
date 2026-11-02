import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import * as Config from './config';
import { drawRectTL, drawLineTL, drawTextInBoxTL, drawRotatedTextInBoxTL } from './pdfDraw';
import { drawBitCell, BitCellStyle } from './referenceTableCell';
import { Point, Size, point, size, mm } from '../units';
import { BIP39_WORDLIST } from './bip39Wordlist';

// Standalone reference sheet - not derived from any GeneratorParameters, it's
// a static lookup table for the full BIP-39 English wordlist: word -> its
// BIP-39 index (0-2047) -> that index's 11-bit breakdown (1024..1, matching
// BINARY_COLUMN_VALUES), same visual style as the ASCII table (asciiTable.ts).
// 2048 rows is far more than fits on one page, so - unlike the ASCII table -
// this one flows across as many pages as it takes.

const BLACK = rgb(0, 0, 0);
const SHADE = rgb(0.92, 0.92, 0.92);
const HEADER_TEXT_COLOR = rgb(0, 0, 0);
const CELL_TEXT = rgb(0.15, 0.15, 0.15);
// The word's own first 4 letters are what Alphabet encoding actually punches
// (see encodingLayout's 4-column word groups) - kept full-black so that
// prefix stands out, with the rest of the word faded to gray since it's
// there for readability only, not part of what gets punched.
const WORD_PREFIX_LENGTH = 4;
const WORD_PREFIX_TEXT = BLACK;
const WORD_SUFFIX_TEXT = rgb(0.6, 0.6, 0.6);
const WORD_LEFT_PAD = mm(0.3);
const BIT_CELL_STYLE: BitCellStyle = { markColor: BLACK, markThickness: Config.PEN_NORMAL, offColor: rgb(0.75, 0.75, 0.75), offBorderThickness: Config.PEN_THIN };

// Same 11 place-values (1024..1) Binary encoding's own header uses.
const BIT_VALUES = Config.BINARY_COLUMN_VALUES;

interface SeedWordRow {
  word: string;
  dec: string;
  bits: boolean[]; // true where that bit place-value is set in the word's index
}

function buildRows(): SeedWordRow[] {
  return BIP39_WORDLIST.map((word, index) => ({
    word,
    dec: `${index}`,
    bits: BIT_VALUES.map((v) => (index & v) !== 0),
  }));
}

function groupWidth(): number {
  return Config.SEED_TABLE_WORD_COL_WIDTH + Config.SEED_TABLE_DEC_COL_WIDTH + BIT_VALUES.length * Config.SEED_TABLE_BIT_COL_WIDTH;
}

// How many rows a single group can hold before running past the bottom
// margin, given the vertical space available below the group's own header.
function maxRowsPerGroup(): number {
  const top = Config.DOCUMENT_MARGIN_TOP + Config.SEED_TABLE_TOP_GAP;
  const available = Config.DOCUMENT_SIZE.height - Config.DOCUMENT_MARGIN_BOTTOM - top - Config.SEED_TABLE_HEADER_HEIGHT;
  return Math.max(1, Math.floor(available / Config.SEED_TABLE_ROW_HEIGHT));
}

// Splits all rows into fixed-size, page-sized groups (row-major across
// groups, left-to-right then top of the next page) - unlike the ASCII
// table's even 3-way split, groups here are capped at whatever fits
// vertically, and however many that takes spills onto further pages.
function splitIntoGroups(rows: SeedWordRow[]): SeedWordRow[][] {
  const rowsPerGroup = maxRowsPerGroup();
  const groups: SeedWordRow[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerGroup) {
    groups.push(rows.slice(i, i + rowsPerGroup));
  }
  return groups;
}

// Left-aligned word, first WORD_PREFIX_LENGTH letters full-black, the rest
// gray - two adjacent drawTextInBoxTL calls, the second starting exactly
// where the first's own text ends so the two halves read as one flush word.
function drawWordCell(page: PDFPage, boldFont: PDFFont, fontSize: number, word: string, cellOrigin: Point, cellSize: Size): void {
  const prefix = word.slice(0, WORD_PREFIX_LENGTH);
  const suffix = word.slice(WORD_PREFIX_LENGTH);
  const textOrigin = point(cellOrigin.x + WORD_LEFT_PAD, cellOrigin.y);
  const availableWidth = cellSize.width - WORD_LEFT_PAD;

  drawTextInBoxTL(page, prefix, boldFont, fontSize, textOrigin, size(availableWidth, cellSize.height), { horizontal: 'left', vertical: 'center' }, WORD_PREFIX_TEXT);
  if (suffix.length === 0) return;

  const prefixWidth = boldFont.widthOfTextAtSize(prefix, fontSize);
  const suffixOrigin = point(textOrigin.x + prefixWidth, cellOrigin.y);
  drawTextInBoxTL(page, suffix, boldFont, fontSize, suffixOrigin, size(availableWidth - prefixWidth, cellSize.height), { horizontal: 'left', vertical: 'center' }, WORD_SUFFIX_TEXT);
}

function drawGroup(page: PDFPage, font: PDFFont, boldFont: PDFFont, rows: SeedWordRow[], origin: Point): void {
  const rowHeight = Config.SEED_TABLE_ROW_HEIGHT;
  const headerHeight = Config.SEED_TABLE_HEADER_HEIGHT;
  const wordW = Config.SEED_TABLE_WORD_COL_WIDTH;
  const decW = Config.SEED_TABLE_DEC_COL_WIDTH;
  const bitW = Config.SEED_TABLE_BIT_COL_WIDTH;
  const fontSize = Config.SEED_TABLE_FONT_SIZE;
  const width = groupWidth();
  const breakdownX = origin.x + wordW + decW;
  const bottom = origin.y + headerHeight + rows.length * rowHeight;

  // Header row. "Word"/"Dec" fit their own columns horizontally; the bit
  // place-values (up to 4 digits, "1024") are wider than their own narrow
  // column, so - same fix the Binary encoding's own column header uses
  // (drawBinaryColumnHeader in writer.ts) - they're drawn rotated instead,
  // reading bottom-to-top along the header's height rather than overflowing
  // sideways into neighboring columns.
  drawTextInBoxTL(page, 'Word', boldFont, fontSize, point(origin.x + WORD_LEFT_PAD, origin.y), size(wordW - WORD_LEFT_PAD, headerHeight), { horizontal: 'left', vertical: 'center' }, HEADER_TEXT_COLOR);
  drawTextInBoxTL(page, 'Dec', boldFont, fontSize, point(origin.x + wordW, origin.y), size(decW, headerHeight), { horizontal: 'center', vertical: 'center' }, HEADER_TEXT_COLOR);
  BIT_VALUES.forEach((value, b) => {
    const cellX = breakdownX + b * bitW;
    drawRotatedTextInBoxTL(page, `${value}`, boldFont, fontSize, point(cellX, origin.y), size(bitW, headerHeight), HEADER_TEXT_COLOR);
  });
  drawLineTL(page, point(origin.x, origin.y + headerHeight), point(origin.x + width, origin.y + headerHeight), {
    color: BLACK,
    thickness: Config.PEN_THICK,
  });

  // Data rows.
  rows.forEach((row, i) => {
    const rowY = origin.y + headerHeight + i * rowHeight;
    if (i % 2 === 1) {
      drawRectTL(page, point(origin.x, rowY), size(width, rowHeight), { color: SHADE });
    }

    drawWordCell(page, boldFont, fontSize, row.word, point(origin.x, rowY), size(wordW, rowHeight));
    drawTextInBoxTL(page, row.dec, font, fontSize, point(origin.x + wordW, rowY), size(decW, rowHeight), { horizontal: 'center', vertical: 'center' }, CELL_TEXT);

    row.bits.forEach((set, b) => {
      const cellX = breakdownX + b * bitW;
      drawBitCell(page, point(cellX, rowY), size(bitW, rowHeight), set, Config.SEED_TABLE_BIT_MARK_SIZE, BIT_CELL_STYLE);
    });

    drawLineTL(page, point(origin.x, rowY + rowHeight), point(origin.x + width, rowY + rowHeight), { color: BLACK, thickness: Config.PEN_THIN });
  });

  // Thin divider between Word and Dec, and a bold divider between Dec and the
  // 11-bit breakdown - the latter sets the two halves of the table (lookup
  // vs. worksheet) apart more strongly than the former, which just separates
  // the lookup column's own two fields.
  drawLineTL(page, point(origin.x + wordW, origin.y), point(origin.x + wordW, bottom), { color: BLACK, thickness: Config.PEN_THIN });
  drawLineTL(page, point(breakdownX, origin.y), point(breakdownX, bottom), { color: BLACK, thickness: Config.PEN_THICK });

  // Thick outer border around this group's whole table.
  drawRectTL(page, origin, size(width, bottom - origin.y), { borderColor: BLACK, borderWidth: Config.PEN_THICK });
}

export async function generateSeedWordTablePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(Config.DOCUMENT_TITLE);
  const font = await doc.embedFont(StandardFonts.Courier);
  const boldFont = await doc.embedFont(StandardFonts.CourierBold);
  const chromeFont = await doc.embedFont(StandardFonts.Helvetica);
  const chromeBoldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const groups = splitIntoGroups(buildRows());
  const width = groupWidth();
  const top = Config.DOCUMENT_MARGIN_TOP + Config.SEED_TABLE_TOP_GAP;
  const groupsPerPage = Config.SEED_TABLE_GROUPS_PER_PAGE;

  const pages: PDFPage[] = [];
  for (let g = 0; g < groups.length; g += groupsPerPage) {
    const page = doc.addPage([Config.DOCUMENT_SIZE.width, Config.DOCUMENT_SIZE.height]);
    pages.push(page);
    const pageGroups = groups.slice(g, g + groupsPerPage);
    let groupX = Config.DOCUMENT_MARGIN_H;
    for (const group of pageGroups) {
      drawGroup(page, font, boldFont, group, point(groupX, top));
      groupX += width + Config.SEED_TABLE_GROUP_GAP;
    }
  }

  // Reuse the shared page chrome (title/footer) - lazy import avoids a
  // circular dependency at module-load time, same as generateStencilPdf does
  // for reader.ts/asciiTable.ts.
  const { drawPageChrome } = await import('./writer');
  drawPageChrome(pages, chromeFont, chromeBoldFont, Config.SEED_TABLE_TITLE_TEXT, `${BIP39_WORDLIST.length}-word BIP-39 encoding reference`);

  return doc.save();
}
