import { describe, it, expect } from 'vitest';
import { computePreviewLayout, computePassphrasePreviewLayout } from '../src/ui/preview';
import { GeneratorParameters, PassphraseParameters } from '../src/generator/params';
import { EncodingType } from '../src/generator/encoding';
import { mm } from '../src/units';

describe('computePreviewLayout — sample #1 (24 words, 2 cards, 100x60mm)', () => {
  const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
  const layout = computePreviewLayout(params);

  it('produces one PreviewCard per effective card, each with one section of 12 words', () => {
    expect(layout.cards).toHaveLength(2);
    expect(layout.cards[0]).toMatchObject({ cardNumber: 1, cardCount: 2 });
    expect(layout.cards[0].sideLabel).toBe('Card 1, side A');
    expect(layout.cards[1].sideLabel).toBe('Card 1, side B');
    expect(layout.cards[0].cardWidthMm).toBeCloseTo(100, 6);
    expect(layout.cards[0].cardHeightMm).toBeCloseTo(60, 6);
    expect(layout.cards[0].sections).toHaveLength(1);
    expect(layout.cards[0].sections[0].words.map((w) => w.wordNumber)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    expect(layout.cards[1].sections[0].words.map((w) => w.wordNumber)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 13),
    );
  });

  it('trips neither warning for a comfortably sized card', () => {
    expect(layout.warnings.cellTooSmall).toBe(false);
    expect(layout.warnings.cellNotSquare).toBe(false);
  });
});

describe('computePreviewLayout — multi-section card grouping (30 words, 2 cards, split 2)', () => {
  const params = new GeneratorParameters(
    { cardSize: { width: mm(100), height: mm(100) }, cardCount: 2, seedLength: 30, cardSplit: 2 },
  );
  const layout = computePreviewLayout(params);

  it('groups multiple sections inside each card rather than producing extra cards', () => {
    // totalSectionCount = 4, maxWordsPerSection = ceil(30/4) = 8, maxWordsPerCard = 16,
    // emptyWordsPositions = 2*16-30 = 2, effectiveCardCount = 2 - floor(2/16) = 2.
    expect(layout.cards).toHaveLength(2);
    expect(layout.cards[0].sections).toHaveLength(2);
    expect(layout.cards[1].sections).toHaveLength(2);
    expect(layout.cards[0].cardCount).toBe(2);
  });
});

describe('computePreviewLayout — cell too small (24 words, 1 card, 20x20mm)', () => {
  it('trips the too-small warning', () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(20), height: mm(20) }, cardCount: 1, seedLength: 24 });
    const layout = computePreviewLayout(params);
    expect(layout.warnings.cellTooSmall).toBe(true);
  });
});

describe('computePreviewLayout — cell not square (10 words, 1 card, 180x20mm, split 1)', () => {
  it('trips the not-square warning without necessarily tripping too-small', () => {
    const params = new GeneratorParameters(
      { cardSize: { width: mm(180), height: mm(20) }, cardCount: 1, seedLength: 10, encoding: EncodingType.Number },
    );
    const layout = computePreviewLayout(params);
    expect(layout.warnings.cellNotSquare).toBe(true);
  });
});

describe('computePreviewLayout — cell dimensions in mm', () => {
  it('reports cellWidthMm/cellHeightMm consistent with the parameters', () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    const layout = computePreviewLayout(params);
    // cellSize.width/height are in points; cellWidthMm/cellHeightMm must be the mm equivalent.
    expect(layout.cellWidthMm).toBeCloseTo(params.cellSize.width / 2.834645669291339, 6);
    expect(layout.cellHeightMm).toBeCloseTo(params.cellSize.height / 2.834645669291339, 6);
  });
});

describe('computePreviewLayout — side labels', () => {
  it('pairs consecutive cards as sides of one physical card, with a lone final side when the count is odd', () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 3, seedLength: 30 });
    const layout = computePreviewLayout(params);
    expect(layout.cards.map((c) => c.sideLabel)).toEqual(['Card 1, side A', 'Card 1, side B', 'Card 2, side A']);
    expect(layout.cards.map((c) => c.physicalCardNumber)).toEqual([1, 1, 2]);
  });
});

describe('computePreviewLayout — degenerate cell size guard', () => {
  it('flags cellSizeInvalid instead of producing NaN/Infinity warnings, for a cell size that could never occur through the validated form', () => {
    const degenerate = {
      effectiveCardCount: 1,
      cellSize: { width: 0, height: -1 },
      cardSize: { width: mm(100), height: mm(60) },
      seedEncoding: EncodingType.Alphabet,
      getCardParameters: () => ({
        sections: [{ number: 1, wordNumbers: [1] }],
      }),
    } as unknown as GeneratorParameters;

    const layout = computePreviewLayout(degenerate);
    expect(layout.warnings.cellSizeInvalid).toBe(true);
    expect(layout.warnings.cellTooSmall).toBe(false);
    expect(layout.warnings.cellNotSquare).toBe(false);
    expect(Number.isFinite(layout.cellWidthMm)).toBe(true);
    expect(Number.isFinite(layout.cellHeightMm)).toBe(true);
  });
});

describe('computePreviewLayout — word shading matches the writer', () => {
  it('alternates shading by (section.number + wordIndex) % 2, per word, not per section', () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 1, seedLength: 10 });
    const layout = computePreviewLayout(params);
    const words = layout.cards[0].sections[0].words;
    // section.number === 1, so shaded = (1 + i) % 2 === 0 -> odd indices (1,3,5,7,9) are shaded
    expect(words.map((w) => w.shaded)).toEqual([false, true, false, true, false, true, false, true, false, true]);
  });
});

describe('computePreviewLayout — cell row labels', () => {
  it('lists a..z for alphabet encoding', () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 1, seedLength: 10 });
    const layout = computePreviewLayout(params);
    expect(layout.cellRowLabels).toEqual(Array.from({ length: 26 }, (_, i) => String.fromCharCode('a'.charCodeAt(0) + i)));
  });

  it('lists 0..9 for number encoding', () => {
    const params = new GeneratorParameters({
      cardSize: { width: mm(100), height: mm(60) },
      cardCount: 1,
      seedLength: 10,
      encoding: EncodingType.Number,
    });
    const layout = computePreviewLayout(params);
    expect(layout.cellRowLabels).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });
});

describe('computePreviewLayout — copies', () => {
  it('reports the configured number of stencil sets', () => {
    const params = new GeneratorParameters(
      { cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24, copies: 3 },
    );
    const layout = computePreviewLayout(params);
    expect(layout.copies).toBe(3);
  });

  it('defaults to 1 when copies is not specified', () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    const layout = computePreviewLayout(params);
    expect(layout.copies).toBe(1);
  });
});

describe('computePreviewLayout — Binary encoding', () => {
  it('flags the layout as binary and provides the 11 place-value column labels', () => {
    const params = new GeneratorParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardCount: 2,
      seedLength: 12,
      encoding: EncodingType.Binary,
    });
    const layout = computePreviewLayout(params);
    expect(layout.isBinary).toBe(true);
    expect(layout.binaryColumnLabels).toEqual(['1024', '512', '256', '128', '64', '32', '16', '8', '4', '2', '1']);
    expect(layout.cellRowLabels).toEqual([]);
  });

  it('does not flag non-Binary layouts as binary, and leaves binaryColumnLabels empty', () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    const layout = computePreviewLayout(params);
    expect(layout.isBinary).toBe(false);
    expect(layout.binaryColumnLabels).toEqual([]);
  });

});

describe('computePassphrasePreviewLayout', () => {
  const params = new PassphraseParameters({
    cardSize: { width: mm(85.6), height: mm(54) },
    cardPadding: mm(1.5),
    cardCornerRadius: mm(1.5),
    cardCount: 2,
    copies: 1,
    cellSize: { width: mm(2), height: mm(2) },
  });

  it('reports the 7 ASCII place-value column labels', () => {
    const layout = computePassphrasePreviewLayout(params);
    expect(layout.columnLabels).toEqual(['64', '32', '16', '8', '4', '2', '1']);
  });

  it('builds one card entry per cardCount, each with the geometry-derived blocks', () => {
    const layout = computePassphrasePreviewLayout(params);
    expect(layout.cards).toHaveLength(2);
    expect(layout.cards[0].cardNumber).toBe(1);
    expect(layout.cards[0].blocks).toEqual(params.getCardCharacters(1));
    expect(layout.cards[1].blocks).toEqual(params.getCardCharacters(2));
    expect(layout.cards[0].cardWidthMm).toBeCloseTo(85.6, 6);
    expect(layout.cards[0].cardHeightMm).toBeCloseTo(54, 6);
  });

  it('reports the resolved cell size in mm', () => {
    const layout = computePassphrasePreviewLayout(params);
    expect(layout.cellWidthMm).toBeCloseTo(2, 6);
    expect(layout.cellHeightMm).toBeCloseTo(2, 6);
  });

  it('flags cellTooSmall when the resolved cell size is below the shared minimum', () => {
    const tiny = new PassphraseParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardPadding: mm(1.5),
      cardCornerRadius: mm(1.5),
      cardCount: 1,
      copies: 1,
      cellSize: { width: mm(1), height: mm(1) },
    });
    const layout = computePassphrasePreviewLayout(tiny);
    expect(layout.warnings.cellTooSmall).toBe(true);
  });

  it('flags noCapacity when no characters fit at all', () => {
    const none = new PassphraseParameters({
      cardSize: { width: mm(20), height: mm(20) },
      cardPadding: mm(5),
      cardCornerRadius: mm(1.5),
      cardCount: 1,
      copies: 1,
      cellSize: { width: mm(20), height: mm(20) },
    });
    const layout = computePassphrasePreviewLayout(none);
    expect(layout.warnings.noCapacity).toBe(true);
  });
});
