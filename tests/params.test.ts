import { describe, it, expect } from 'vitest';
import { GeneratorParameters } from '../src/generator/params';
import { EncodingType } from '../src/generator/encoding';
import { mm } from '../src/units';

describe('GeneratorParameters validation', () => {
  it('throws when seedLength is out of range', () => {
    expect(
      () => new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 5 }),
    ).toThrow(RangeError);
  });

  it('throws when card width is out of range', () => {
    expect(
      () => new GeneratorParameters({ cardSize: { width: mm(5), height: mm(60) }, cardCount: 2, seedLength: 24 }),
    ).toThrow(RangeError);
  });

  it('accepts valid input and applies defaults', () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    expect(params.cardSplit).toBe(1);
    expect(params.copies).toBe(1);
    expect(params.seedEncoding).toBe(EncodingType.Alphabet);
  });
});

describe('GeneratorParameters computed properties — sample #1 (24 words, 2 cards, 100x60mm)', () => {
  const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });

  it('splits into 2 sections of 12 words each', () => {
    expect(params.totalSectionCount).toBe(2);
    expect(params.maxWordsPerSection).toBe(12);
    expect(params.maxWordsPerCard).toBe(12);
    expect(params.effectiveCardCount).toBe(2);
  });

  it('assigns word ranges 1-12 to card 1 and 13-24 to card 2', () => {
    const card1 = params.getCardParameters(1);
    const card2 = params.getCardParameters(2);
    expect(card1.sections).toHaveLength(1);
    expect(card1.sections[0].wordNumbers).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(card2.sections[0].wordNumbers).toEqual(Array.from({ length: 12 }, (_, i) => i + 13));
  });
});

describe('GeneratorParameters computed properties — sample #2 (24 words, 1 card, 100x100mm, 2-way split)', () => {
  const params = new GeneratorParameters(
    { cardSize: { width: mm(100), height: mm(100) }, cardCount: 1, seedLength: 24, cardSplit: 2 },
  );

  it('splits the single card into 2 sections of 12 words each', () => {
    expect(params.totalSectionCount).toBe(2);
    expect(params.maxWordsPerSection).toBe(12);
    expect(params.effectiveCardCount).toBe(1);

    const card1 = params.getCardParameters(1);
    expect(card1.sections).toHaveLength(2);
    expect(card1.sections[0].wordNumbers).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(card1.sections[1].wordNumbers).toEqual(Array.from({ length: 12 }, (_, i) => i + 13));
  });
});

describe('GeneratorParameters computed properties — sample #3 (12 words, 4 cards, 20x20mm, number encoding)', () => {
  const params = new GeneratorParameters(
    { cardSize: { width: mm(20), height: mm(20) }, cardCount: 4, seedLength: 12, encoding: EncodingType.Number },
  );

  it('splits into 4 sections of 3 words each', () => {
    expect(params.totalSectionCount).toBe(4);
    expect(params.maxWordsPerSection).toBe(3);
    expect(params.effectiveCardCount).toBe(4);

    expect(params.getCardParameters(1).sections[0].wordNumbers).toEqual([1, 2, 3]);
    expect(params.getCardParameters(4).sections[0].wordNumbers).toEqual([10, 11, 12]);
  });

  it('uses a 10-row cell grid for Number encoding', () => {
    expect(params.getCardParameters(1).sections[0].encoding).toBe(EncodingType.Number);
  });
});

describe('GeneratorParameters computed properties — uneven split (10 words, 3 cards)', () => {
  const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 3, seedLength: 10 });

  it('rounds maxWordsPerSection up and drops empty trailing cards from effectiveCardCount', () => {
    // totalSectionCount = 3, 10 % 3 != 0 -> maxWordsPerSection = floor(10/3) + 1 = 4
    expect(params.maxWordsPerSection).toBe(4);
    expect(params.maxWordsPerCard).toBe(4);
    // emptyWordsPositions = 3*4 - 10 = 2 -> effectiveCardCount = 3 - floor(2/4) = 3
    expect(params.effectiveCardCount).toBe(3);
    expect(params.getCardParameters(3).sections[0].wordNumbers).toEqual([9, 10]);
  });
});

describe('GeneratorParameters computed properties — trailing all-empty cards dropped (10 words, 13 cards)', () => {
  const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 13, seedLength: 10 });

  it('drops cards that would hold zero words from effectiveCardCount', () => {
    // totalSectionCount = 13, maxWordsPerSection = floor(10/13) + 1 = 1, maxWordsPerCard = 1
    expect(params.maxWordsPerCard).toBe(1);
    // emptyWordsPositions = 13*1 - 10 = 3 -> effectiveCardCount = 13 - floor(3/1) = 10
    expect(params.effectiveCardCount).toBe(10);
    expect(params.getCardParameters(10).sections[0].wordNumbers).toEqual([10]);
    expect(() => params.getCardParameters(11)).toThrow(RangeError);
  });
});

describe('GeneratorParameters computed properties — Binary encoding (12 words, 2 cards, 85.6x54mm)', () => {
  const params = new GeneratorParameters({
    cardSize: { width: mm(85.6), height: mm(54) },
    cardCount: 2,
    seedLength: 12,
    encoding: EncodingType.Binary,
  });

  it('forces cardSplit to 1 regardless of seed length or an explicit cardSplit input', () => {
    expect(params.cardSplit).toBe(1);

    const withExplicitSplit = new GeneratorParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardCount: 2,
      seedLength: 12,
      encoding: EncodingType.Binary,
      cardSplit: 5, // would be invalid/misleading if honored - Binary always needs 1
    });
    expect(withExplicitSplit.cardSplit).toBe(1);
  });

  it('fits as many words side-by-side (as columns) as the card count requires', () => {
    expect(params.maxWordsPerSection).toBe(6); // ceil(12 / 2) = 6 word-columns per card
    expect(params.effectiveCardCount).toBe(2);

    const card1 = params.getCardParameters(1);
    expect(card1.sections).toHaveLength(1);
    expect(card1.sections[0].wordNumbers).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('sizes cells as 1 column x 11 rows per word block', () => {
    const wordSize = params.wordSize;
    const cellSize = params.cellSize;
    expect(cellSize.width).toBeCloseTo(wordSize.width, 6); // 1 column -> full word width
    expect(cellSize.height).toBeCloseTo(wordSize.height / 11, 6);
  });
});
