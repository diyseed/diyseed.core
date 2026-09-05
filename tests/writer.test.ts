import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateWriterPdf, generatePassphrasePdf, generateStencilPdf } from '../src/generator/writer';
import { generateSeedReaderPdf, generatePassphraseReaderPdf } from '../src/generator/reader';
import { GeneratorParameters, PassphraseParameters } from '../src/generator/params';
import { EncodingType } from '../src/generator/encoding';
import { mm } from '../src/units';
import * as Config from '../src/generator/config';

describe('generateWriterPdf', () => {
  it('produces a loadable, titled PDF for sample #1 (24 words, 2 cards, 100x60mm) on a single page', async () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    const bytes = await generateWriterPdf(params);

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getTitle()).toBe(Config.DOCUMENT_TITLE);
    expect(loaded.getPageCount()).toBe(1);

    const page = loaded.getPage(0);
    expect(page.getWidth()).toBeCloseTo(Config.DOCUMENT_SIZE.width, 3);
    expect(page.getHeight()).toBeCloseTo(Config.DOCUMENT_SIZE.height, 3);
  });

  it('produces a loadable PDF for sample #3 (12 words, 4 cards, 20x20mm, number encoding)', async () => {
    const params = new GeneratorParameters({
      cardSize: { width: mm(20), height: mm(20) },
      cardCount: 4,
      seedLength: 12,
      encoding: EncodingType.Number,
    });
    const bytes = await generateWriterPdf(params);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('produces one page per copy when a single card already fills a page', async () => {
    // 150x140mm cards: safe area 154x144mm. EFFECTIVE_PAGE_SIZE is 180x267mm, so
    // cardsPerLine = floor((180+4)/154) = 1 and linesPerPage = floor((267+4)/144) = 1 -> 1 card/page.
    // With cardCount=1 (effectiveCardCount=1), each of the 3 copies lands on its own page.
    const params = new GeneratorParameters(
      { cardSize: { width: mm(150), height: mm(140) }, cardCount: 1, seedLength: 10, copies: 3 },
    );
    const bytes = await generateWriterPdf(params);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(3);
  });

  it('still produces a loadable PDF once corner marks are drawn for a 3-card layout', async () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 3, seedLength: 30 });
    const bytes = await generateWriterPdf(params);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('still produces a loadable PDF once per-row corner marks are drawn for a Card-split > 1 layout', async () => {
    const params = new GeneratorParameters({
      cardSize: { width: mm(100), height: mm(120) },
      cardCount: 2,
      seedLength: 24,
      cardSplit: 3,
    });
    const bytes = await generateWriterPdf(params);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('produces a loadable PDF for Binary encoding (12 words, 2 cards, 85.6x54mm)', async () => {
    const params = new GeneratorParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardCount: 2,
      seedLength: 12,
      encoding: EncodingType.Binary,
    });
    const bytes = await generateWriterPdf(params);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  // Regression guard for the word-number-overprints-the-grid bug: drawWordNumber
  // used to fit the number to the WHOLE row (all 11 Binary columns) using the
  // large WORD_NR_FONT_SIZE_RANGE (10-35pt), overflowing into neighboring cells
  // and rows. It now fits to a single cell's footprint using the smaller
  // CELL_FONT_SIZE_RANGE (max 12pt) - this is a smoke-level check that the PDF
  // still generates/loads; the actual size fix is in the fitted-font-size math
  // itself (verified by hand: the label box is one cell wide, and
  // CELL_FONT_SIZE_RANGE tops out well below the old 35pt ceiling).
  it('still produces a loadable Binary PDF with the per-cell word-number font fix', async () => {
    const params = new GeneratorParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardCount: 2,
      seedLength: 12,
      encoding: EncodingType.Binary,
    });
    const bytes = await generateWriterPdf(params);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('produces a loadable PDF for a passphrase stencil (2 cards, 85.6x54mm, 2mm cells)', async () => {
    const params = new PassphraseParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardPadding: mm(1.5),
      cardCornerRadius: mm(1.5),
      cardCount: 2,
      copies: 1,
      cellSize: { width: mm(2), height: mm(2) },
    });
    const bytes = await generatePassphrasePdf(params);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('produces one page per copy for the passphrase stencil', async () => {
    const params = new PassphraseParameters({
      cardSize: { width: mm(150), height: mm(140) },
      cardPadding: mm(1.5),
      cardCornerRadius: mm(1.5),
      cardCount: 1,
      copies: 3,
      cellSize: { width: mm(3), height: mm(3) },
    });
    const bytes = await generatePassphrasePdf(params);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(3);
  });
});

describe('generateStencilPdf', () => {
  it('generateStencilPdf returns just the seed PDF when only seed is provided', async () => {
    const seed = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    const bytes = await generateStencilPdf({ seed, includeSeedStencil: true });
    const direct = await generateWriterPdf(seed);
    const loaded = await PDFDocument.load(bytes);
    const loadedDirect = await PDFDocument.load(direct);
    expect(loaded.getPageCount()).toBe(loadedDirect.getPageCount());
  });

  it('generateStencilPdf returns just the passphrase PDF when only passphrase is provided', async () => {
    const passphrase = new PassphraseParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardPadding: mm(1.5),
      cardCornerRadius: mm(1.5),
      cardCount: 1,
      copies: 1,
      cellSize: { width: mm(2), height: mm(2) },
    });
    const bytes = await generateStencilPdf({ passphrase, includePassphraseStencil: true });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('generateStencilPdf merges seed and passphrase pages into one PDF when both are provided', async () => {
    const seed = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    const passphrase = new PassphraseParameters({
      cardSize: { width: mm(100), height: mm(60) },
      cardPadding: mm(1.5),
      cardCornerRadius: mm(1.5),
      cardCount: 1,
      copies: 1,
      cellSize: { width: mm(2), height: mm(2) },
    });

    const seedOnlyBytes = await generateWriterPdf(seed);
    const passphraseOnlyBytes = await generatePassphrasePdf(passphrase);
    const seedOnlyPageCount = (await PDFDocument.load(seedOnlyBytes)).getPageCount();
    const passphraseOnlyPageCount = (await PDFDocument.load(passphraseOnlyBytes)).getPageCount();

    const mergedBytes = await generateStencilPdf({ seed, includeSeedStencil: true, passphrase, includePassphraseStencil: true });
    const merged = await PDFDocument.load(mergedBytes);
    expect(merged.getPageCount()).toBe(seedOnlyPageCount + passphraseOnlyPageCount);
  });

  it('generateStencilPdf throws when neither seed, passphrase, nor the ASCII table is provided', async () => {
    await expect(generateStencilPdf({})).rejects.toThrow();
  });

  it('generateStencilPdf returns just the ASCII table when only includeAsciiTable is set', async () => {
    const bytes = await generateStencilPdf({ includeAsciiTable: true });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('appends the ASCII table page after the seed pages when includeAsciiTable is set', async () => {
    const seed = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    const withoutTable = await PDFDocument.load(await generateStencilPdf({ seed, includeSeedStencil: true }));
    const withTable = await PDFDocument.load(await generateStencilPdf({ seed, includeSeedStencil: true, includeAsciiTable: true }));
    expect(withTable.getPageCount()).toBe(withoutTable.getPageCount() + 1);
  });

  it('generateStencilPdf returns just the seed word table when only includeSeedWordTable is set', async () => {
    const bytes = await generateStencilPdf({ includeSeedWordTable: true });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThan(1);
  });

  it('appends the seed word table pages after the seed pages when includeSeedWordTable is set', async () => {
    const seed = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    const withoutTable = await PDFDocument.load(await generateStencilPdf({ seed, includeSeedStencil: true }));
    const withTable = await PDFDocument.load(await generateStencilPdf({ seed, includeSeedStencil: true, includeSeedWordTable: true }));
    const tableOnly = await PDFDocument.load(await generateStencilPdf({ includeSeedWordTable: true }));
    expect(withTable.getPageCount()).toBe(withoutTable.getPageCount() + tableOnly.getPageCount());
  });

  it('appends one reader page after the seed pages when includeSeedReader is set', async () => {
    const seed = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    const withoutReader = await PDFDocument.load(await generateStencilPdf({ seed, includeSeedStencil: true }));
    const withReader = await PDFDocument.load(await generateStencilPdf({ seed, includeSeedStencil: true, includeSeedReader: true }));
    expect(withReader.getPageCount()).toBe(withoutReader.getPageCount() + 1);
  });

  it('generates just the reader when the stencil itself is unchecked', async () => {
    const seed = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    const readerOnly = await PDFDocument.load(await generateStencilPdf({ seed, includeSeedReader: true }));
    const directReader = await PDFDocument.load(await generateSeedReaderPdf(seed));
    expect(readerOnly.getPageCount()).toBe(directReader.getPageCount());
  });

  it('appends a reader page for both seed and passphrase when both are included', async () => {
    const seed = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 1, seedLength: 12 });
    // A large cell size keeps each reader's cross-off/fill-in content short
    // enough to fit on a single page, so this stays a simple "+1 page per
    // stencil type" smoke check - see the dedicated pagination test below for
    // the multi-page case.
    const passphrase = new PassphraseParameters({
      cardSize: { width: mm(100), height: mm(60) },
      cardPadding: mm(1.5),
      cardCornerRadius: mm(1.5),
      cardCount: 1,
      copies: 1,
      cellSize: { width: mm(8), height: mm(8) },
    });
    const withoutReader = await PDFDocument.load(
      await generateStencilPdf({ seed, includeSeedStencil: true, passphrase, includePassphraseStencil: true }),
    );
    const withReader = await PDFDocument.load(
      await generateStencilPdf({
        seed,
        includeSeedStencil: true,
        includeSeedReader: true,
        passphrase,
        includePassphraseStencil: true,
        includePassphraseReader: true,
      }),
    );
    expect(withReader.getPageCount()).toBe(withoutReader.getPageCount() + 2);
  });

  it('paginates the passphrase reader instead of dropping content past the page bottom', async () => {
    // Small cells and several cards pack enough cross-off worksheets to
    // overflow a single A4 page, so this must produce more than one reader
    // page rather than silently drawing past the margin.
    const passphrase = new PassphraseParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardPadding: mm(1.5),
      cardCornerRadius: mm(1.5),
      cardCount: 3,
      copies: 1,
      cellSize: { width: mm(2), height: mm(2) },
    });
    const readerOnlyPageCount = (await PDFDocument.load(await generatePassphraseReaderPdf(passphrase))).getPageCount();
    expect(readerOnlyPageCount).toBeGreaterThanOrEqual(2);

    const bytes = await generateStencilPdf({ passphrase, includePassphraseStencil: true, includePassphraseReader: true });
    const loaded = await PDFDocument.load(bytes);
    // 1 writer page + however many reader pages that took.
    expect(loaded.getPageCount()).toBe(1 + readerOnlyPageCount);
  });
});
