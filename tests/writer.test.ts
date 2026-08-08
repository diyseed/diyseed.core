import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateWriterPdf } from '../src/generator/writer';
import { GeneratorParameters } from '../src/generator/params';
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
});
