import { describe, it, expect } from 'vitest';
import { buildSeedParamsSummary, buildPassphraseParamsSummary } from '../src/generator/summary';
import { GeneratorParameters, PassphraseParameters } from '../src/generator/params';
import { EncodingType } from '../src/generator/encoding';
import { mm } from '../src/units';

describe('buildSeedParamsSummary', () => {
  it('lists word count, card count, card size, encoding, and copies for Alphabet encoding', () => {
    const params = new GeneratorParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardCount: 2,
      seedLength: 12,
      encoding: EncodingType.Alphabet,
      copies: 1,
    });

    expect(buildSeedParamsSummary(params)).toBe('12 words, 2 cards, 85.6×54mm, Alphabet, 1 copy');
  });

  it('pluralizes copies and singularizes a single card', () => {
    const params = new GeneratorParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardCount: 1,
      seedLength: 12,
      encoding: EncodingType.Alphabet,
      copies: 3,
    });

    expect(buildSeedParamsSummary(params)).toBe('12 words, 1 card, 85.6×54mm, Alphabet, 3 copies');
  });

  it('names the encoding plainly for Binary encoding', () => {
    const params = new GeneratorParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardCount: 2,
      seedLength: 24,
      encoding: EncodingType.Binary,
      copies: 1,
    });

    expect(buildSeedParamsSummary(params)).toContain('Binary');
  });
});

describe('buildPassphraseParamsSummary', () => {
  it('lists card count, card size, cell size, and copies', () => {
    const params = new PassphraseParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardPadding: mm(1.5),
      cardCornerRadius: mm(1.5),
      cardCount: 1,
      copies: 1,
      cellSize: { width: mm(2), height: mm(2) },
    });

    expect(buildPassphraseParamsSummary(params)).toBe('1 card, 85.6×54mm, cell 2mm, 1 copy');
  });
});
