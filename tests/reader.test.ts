import { describe, it, expect } from 'vitest';
import { generateSeedReaderPdf, generatePassphraseReaderPdf } from '../src/generator/reader';
import { GeneratorParameters, PassphraseParameters } from '../src/generator/params';
import { EncodingType } from '../src/generator/encoding';
import { mm } from '../src/units';

const cardSize = { width: mm(85.6), height: mm(54) };

describe('generateSeedReaderPdf', () => {
  it('generates a non-empty single-page PDF for Alphabet encoding', async () => {
    const params = new GeneratorParameters({ cardSize, cardCount: 2, seedLength: 12, encoding: EncodingType.Alphabet });
    const bytes = await generateSeedReaderPdf(params);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('generates a non-empty PDF for Number encoding', async () => {
    const params = new GeneratorParameters({ cardSize, cardCount: 1, seedLength: 12, encoding: EncodingType.Number });
    const bytes = await generateSeedReaderPdf(params);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('generates a non-empty PDF for Binary encoding', async () => {
    const params = new GeneratorParameters({
      cardSize,
      cardCount: 2,
      seedLength: 24,
      encoding: EncodingType.Binary,
    });
    const bytes = await generateSeedReaderPdf(params);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('generates a non-empty PDF for a card split greater than 1', async () => {
    const params = new GeneratorParameters({ cardSize, cardCount: 1, seedLength: 24, encoding: EncodingType.Alphabet, cardSplit: 2 });
    const bytes = await generateSeedReaderPdf(params);
    expect(bytes.length).toBeGreaterThan(0);
  });
});

describe('generatePassphraseReaderPdf', () => {
  it('generates a non-empty PDF', async () => {
    const params = new PassphraseParameters({
      cardSize,
      cardPadding: mm(1.5),
      cardCornerRadius: mm(1.5),
      cardCount: 1,
      copies: 1,
      cellSize: { width: mm(2), height: mm(2) },
    });
    const bytes = await generatePassphraseReaderPdf(params);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('generates a non-empty PDF for 2 cards', async () => {
    const params = new PassphraseParameters({
      cardSize,
      cardPadding: mm(1.5),
      cardCornerRadius: mm(1.5),
      cardCount: 2,
      copies: 1,
      cellSize: { width: mm(2), height: mm(2) },
    });
    const bytes = await generatePassphraseReaderPdf(params);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
