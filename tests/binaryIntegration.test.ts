import { describe, it, expect } from 'vitest';
import { GeneratorParameters } from '../src/generator/params';
import { EncodingType } from '../src/generator/encoding';
import { generateWriterPdf } from '../src/generator/writer';
import { mm } from '../src/units';
import { PDFDocument } from 'pdf-lib';

describe('Binary encoding end-to-end integration', () => {
  const cases = [
    { seedLength: 10, cardCount: 1 },
    { seedLength: 12, cardCount: 2 },
    { seedLength: 24, cardCount: 3 },
    { seedLength: 39, cardCount: 4 },
    { seedLength: 10, cardCount: 13 },
  ];

  for (const { seedLength, cardCount } of cases) {
    it(`generates a loadable PDF for ${seedLength} words / ${cardCount} cards`, async () => {
      const params = new GeneratorParameters({
        cardSize: { width: mm(85.6), height: mm(54) },
        cardCount,
        seedLength,
        encoding: EncodingType.Binary,
      });

      const bytes = await generateWriterPdf(params);
      const loaded = await PDFDocument.load(bytes);
      expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
    });
  }
});
