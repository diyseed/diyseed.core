import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { GeneratorParameters, PassphraseParameters } from './params';
import { EncodingType } from './encoding';
import * as Config from './config';
import { getCardSafeAreaSize, getOriginForCard } from './geometry';
import { drawTextInBoxTL } from './pdfDraw';
import { buildSeedParamsSummary, buildPassphraseParamsSummary } from './summary';
import { encodeSeedConfigCode, encodePassphraseConfigCode } from './configCode';
import { CardStyle, drawCardLayout } from './drawCardLayout';
import { point, size } from '../units';
import { layoutSeedCard } from '../layout/seedCard';
import { layoutPassphraseCard } from '../layout/passphraseCard';
import { drawPageChrome, HEADER_TEXT_COLOR, FOOTER_TEXT_COLOR } from './pageChrome';
import { generateSeedReaderPdf, generatePassphraseReaderPdf } from './reader';
import { generateAsciiTablePdf } from './asciiTable';
import { generateSeedWordTablePdf } from './seedWordTable';

const BLACK = rgb(0, 0, 0);
const CARD_OUTLINE = BLACK;
const GRID_LINE = BLACK;
const SHADE = rgb(0.92, 0.92, 0.92);
const SHADE_INTERSECTION = rgb(0.85, 0.85, 0.85);
const CELL_TEXT = rgb(0.55, 0.55, 0.55);
const WORD_NR_TEXT = BLACK;
const WORD_NR_OPACITY = 0.6;

const CARD_STYLE: CardStyle = {
  outline: CARD_OUTLINE,
  gridLine: GRID_LINE,
  shade: SHADE,
  shadeIntersection: SHADE_INTERSECTION,
  cellText: CELL_TEXT,
  wordNrText: WORD_NR_TEXT,
  wordNrOpacity: WORD_NR_OPACITY,
  headerText: HEADER_TEXT_COLOR,
};

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
  const cardsBottom: number[] = [];

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

      const layout = layoutSeedCard(parameters.getCardParameters(i), parameters.seedEncoding, cardOrigin);
      drawCardLayout(page, { font, boldFont }, layout, cardOrigin, CARD_STYLE);
      cardsBottom[origin.page - 1] = Math.max(cardsBottom[origin.page - 1] ?? 0, cardOrigin.y + parameters.cardSize.height);
    }
  }

  drawStencilCode(pages, cardsBottom, chromeFont, boldFont, encodeSeedConfigCode(parameters));
  drawPageChrome(pages, chromeFont, chromeBoldFont, Config.DOCUMENT_SEED_HEADER_TEXT, buildSeedParamsSummary(parameters));

  return doc.save();
}

export async function generatePassphrasePdf(parameters: PassphraseParameters): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(Config.DOCUMENT_TITLE);
  // Monospace for everything above/inside the card - see generateWriterPdf.
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

  // Both a place-value header (bit axis, left) and a position-number header
  // (character axis, top) are needed, on opposite sides of the card.
  const headerHeight = Config.BINARY_HEADER_HEIGHT;
  const headerWidth = Config.BINARY_HEADER_HEIGHT;
  const cardsBottom: number[] = [];

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

      const layout = layoutPassphraseCard(parameters, i, nextRowNumber, cardOrigin);
      drawCardLayout(page, { font, boldFont }, layout, cardOrigin, CARD_STYLE);
      cardsBottom[origin.page - 1] = Math.max(cardsBottom[origin.page - 1] ?? 0, cardOrigin.y + parameters.cardSize.height);
      nextRowNumber += parameters.blockCount;
    }
  }

  drawStencilCode(pages, cardsBottom, chromeFont, boldFont, encodePassphraseConfigCode(parameters));
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

// Once per page, under that page's lowest card - every card of a set shares
// the same code, so repeating it per card would only add noise.
function drawStencilCode(pages: PDFPage[], cardsBottom: number[], labelFont: PDFFont, codeFont: PDFFont, code: string): void {
  const labelHeight = labelFont.heightAtSize(Config.STENCIL_CODE_LABEL_FONT_SIZE);
  const codeHeight = codeFont.heightAtSize(Config.STENCIL_CODE_FONT_SIZE);
  const width = Config.EFFECTIVE_PAGE_SIZE.width;

  pages.forEach((page, i) => {
    const labelTop = cardsBottom[i] + Config.STENCIL_CODE_TOP_GAP;
    const codeTop = labelTop + labelHeight + Config.STENCIL_CODE_LABEL_GAP;
    drawTextInBoxTL(
      page,
      Config.STENCIL_CODE_LABEL_TEXT,
      labelFont,
      Config.STENCIL_CODE_LABEL_FONT_SIZE,
      point(Config.DOCUMENT_MARGIN_H, labelTop),
      size(width, labelHeight),
      { horizontal: 'left', vertical: 'top' },
      FOOTER_TEXT_COLOR,
    );
    drawTextInBoxTL(
      page,
      code,
      codeFont,
      Config.STENCIL_CODE_FONT_SIZE,
      point(Config.DOCUMENT_MARGIN_H, codeTop),
      size(width, codeHeight),
      { horizontal: 'left', vertical: 'top' },
      HEADER_TEXT_COLOR,
    );
  });
}
