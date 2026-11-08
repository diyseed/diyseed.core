import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import * as Config from './config';
import { drawRectTL, drawLineTL, drawTextInBoxTL } from './pdfDraw';
import { drawBitCell, BitCellStyle } from './referenceTableCell';
import { Point, point, size } from '../units';

// Standalone reference sheet - not derived from any GeneratorParameters, it's
// a static lookup table a user consults by hand while punching/reading a
// passphrase (or a Binary-encoded seed's own bit pattern): character ->
// decimal -> its 7-bit breakdown (64..1, matching PASSPHRASE_COLUMN_VALUES).

const BLACK = rgb(0, 0, 0);
const SHADE = rgb(0.92, 0.92, 0.92);
const HEADER_TEXT_COLOR = rgb(0, 0, 0);
const CELL_TEXT = rgb(0.15, 0.15, 0.15);
const BIT_CELL_STYLE: BitCellStyle = { markColor: BLACK, markThickness: Config.PEN_THICK, offColor: rgb(0.75, 0.75, 0.75), offBorderThickness: Config.PEN_THIN };

// Same 7 place-values (64..1) the passphrase reader/writer already use.
const BIT_VALUES = Config.PASSPHRASE_COLUMN_VALUES;
const HEADER_LABELS = ['Chr', 'Dec', ...BIT_VALUES.map(String)];

interface AsciiRow {
  char: string;
  dec: string;
  bits: boolean[]; // true where that bit place-value is set in the char code
}

function buildRows(): AsciiRow[] {
  const [start, end] = Config.ASCII_TABLE_CHAR_RANGE;
  const rows: AsciiRow[] = [];
  for (let code = start; code <= end; code++) {
    // Space has no visible glyph - label it so the row stays legible.
    const char = code === 32 ? 'SP' : String.fromCharCode(code);
    rows.push({
      char,
      dec: `${code}`,
      bits: BIT_VALUES.map((v) => (code & v) !== 0),
    });
  }
  return rows;
}

// Splits `rows` into ASCII_TABLE_GROUP_COUNT side-by-side column-groups, as
// evenly sized as possible, so the whole table stays compact on one page
// instead of running as one very tall list.
function splitIntoGroups(rows: AsciiRow[]): AsciiRow[][] {
  const groupCount = Config.ASCII_TABLE_GROUP_COUNT;
  const groups: AsciiRow[][] = [];
  const base = Math.floor(rows.length / groupCount);
  const extra = rows.length % groupCount;
  let cursor = 0;
  for (let g = 0; g < groupCount; g++) {
    const count = base + (g < extra ? 1 : 0);
    groups.push(rows.slice(cursor, cursor + count));
    cursor += count;
  }
  return groups;
}

function groupWidth(): number {
  return (
    Config.ASCII_TABLE_CHAR_COL_WIDTH +
    Config.ASCII_TABLE_DEC_COL_WIDTH +
    BIT_VALUES.length * Config.ASCII_TABLE_BIT_COL_WIDTH
  );
}

function drawGroup(page: PDFPage, font: PDFFont, boldFont: PDFFont, rows: AsciiRow[], origin: Point): void {
  const rowHeight = Config.ASCII_TABLE_ROW_HEIGHT;
  const headerHeight = Config.ASCII_TABLE_HEADER_HEIGHT;
  const charW = Config.ASCII_TABLE_CHAR_COL_WIDTH;
  const decW = Config.ASCII_TABLE_DEC_COL_WIDTH;
  const bitW = Config.ASCII_TABLE_BIT_COL_WIDTH;
  const width = groupWidth();
  const breakdownX = origin.x + charW + decW;
  const bottom = origin.y + headerHeight + rows.length * rowHeight;

  // Header row.
  let colX = origin.x;
  const colWidths = [charW, decW, ...BIT_VALUES.map(() => bitW)];
  HEADER_LABELS.forEach((label, i) => {
    drawTextInBoxTL(
      page,
      label,
      boldFont,
      Config.ASCII_TABLE_FONT_SIZE,
      point(colX, origin.y),
      size(colWidths[i], headerHeight),
      { horizontal: 'center', vertical: 'center' },
      HEADER_TEXT_COLOR,
    );
    colX += colWidths[i];
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

    drawTextInBoxTL(page, row.char, boldFont, Config.ASCII_TABLE_FONT_SIZE, point(origin.x, rowY), size(charW, rowHeight), { horizontal: 'center', vertical: 'center' }, CELL_TEXT);
    drawTextInBoxTL(page, row.dec, font, Config.ASCII_TABLE_FONT_SIZE, point(origin.x + charW, rowY), size(decW, rowHeight), { horizontal: 'center', vertical: 'center' }, CELL_TEXT);

    row.bits.forEach((set, b) => {
      const cellX = breakdownX + b * bitW;
      drawBitCell(page, point(cellX, rowY), size(bitW, rowHeight), set, Config.ASCII_TABLE_BIT_MARK_SIZE, BIT_CELL_STYLE);
    });

    drawLineTL(page, point(origin.x, rowY + rowHeight), point(origin.x + width, rowY + rowHeight), { color: BLACK, thickness: Config.PEN_THIN });
  });

  // Thin divider between Chr and Dec, and a bold divider between Dec and the
  // 7-bit breakdown - the latter sets the two halves of the table (lookup
  // vs. worksheet) apart more strongly than the former, which just separates
  // the lookup column's own two fields.
  drawLineTL(page, point(origin.x + charW, origin.y), point(origin.x + charW, bottom), { color: BLACK, thickness: Config.PEN_THIN });
  drawLineTL(page, point(breakdownX, origin.y), point(breakdownX, bottom), { color: BLACK, thickness: Config.PEN_THICK });

  // Thick outer border around this group's whole table.
  drawRectTL(page, origin, size(width, bottom - origin.y), { borderColor: BLACK, borderWidth: Config.PEN_THICK });
}

export async function generateAsciiTablePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(Config.DOCUMENT_TITLE);
  const font = await doc.embedFont(StandardFonts.Courier);
  const boldFont = await doc.embedFont(StandardFonts.CourierBold);
  const chromeFont = await doc.embedFont(StandardFonts.Helvetica);
  const chromeBoldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([Config.DOCUMENT_SIZE.width, Config.DOCUMENT_SIZE.height]);

  const groups = splitIntoGroups(buildRows());
  const width = groupWidth();
  const top = Config.DOCUMENT_MARGIN_TOP + Config.ASCII_TABLE_TOP_GAP;
  let groupX = Config.DOCUMENT_MARGIN_H;
  for (const group of groups) {
    drawGroup(page, font, boldFont, group, point(groupX, top));
    groupX += width + Config.ASCII_TABLE_GROUP_GAP;
  }

  // Reuse the shared page chrome (title/footer) - lazy import avoids a
  // circular dependency at module-load time, same as generateStencilPdf does
  // for reader.ts.
  const { drawPageChrome } = await import('./writer');
  drawPageChrome([page], chromeFont, chromeBoldFont, Config.ASCII_TABLE_TITLE_TEXT, '7-bit encoding reference, printable characters only (32-126)');

  return doc.save();
}
