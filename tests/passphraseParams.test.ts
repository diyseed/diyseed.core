import { describe, it, expect } from 'vitest';
import { PassphraseParameters } from '../src/generator/params';
import { mm } from '../src/units';

describe('PassphraseParameters — horizontal direction (85.6x54mm, 1.5mm padding, 2mm cells)', () => {
  const params = new PassphraseParameters({
    cardSize: { width: mm(85.6), height: mm(54) },
    cardPadding: mm(1.5),
    cardCornerRadius: mm(1.5),
    cardCount: 2,
    binaryDirection: 'horizontal',
    copies: 1,
    cellSize: { width: mm(2), height: mm(2) },
  });

  it('computes gridSize as card size minus 2x padding', () => {
    expect(params.gridSize.width).toBeCloseTo(mm(85.6 - 2 * 1.5), 6);
    expect(params.gridSize.height).toBeCloseTo(mm(54 - 2 * 1.5), 6);
  });

  it('fits characters across the width at the given cell width', () => {
    // gridWidth = 82.6mm, cellWidth = 2mm -> floor(82.6/2) = 41
    expect(params.charsPerBlock).toBe(41);
  });

  it('sizes one block as 7 cells deep along the height axis', () => {
    expect(params.blockThickness).toBeCloseTo(mm(2) * 7, 6);
  });

  it('fits only 1 block when the card is not tall enough for a second', () => {
    // gridHeight = 51mm; 2 blocks need 2*14mm + 1.5mm padding = 29.5mm - actually fits;
    // recompute: blockThickness = 14mm, 2*14+1.5=29.5 <= 51 -> should be 2.
    expect(params.blockCount).toBe(2);
  });

  it('computes capacityPerCard and totalCapacity from charsPerBlock and blockCount', () => {
    expect(params.capacityPerCard).toBe(41 * 2);
    expect(params.totalCapacity).toBe(41 * 2 * 2); // cardCount = 2
  });

  it('assigns sequential position numbers per card, split into blocks of charsPerBlock', () => {
    const card1 = params.getCardCharacters(1);
    expect(card1).toHaveLength(2);
    expect(card1[0]).toHaveLength(41);
    expect(card1[0][0]).toBe(1);
    expect(card1[0][40]).toBe(41);
    expect(card1[1][0]).toBe(42);
    expect(card1[1][40]).toBe(82);

    const card2 = params.getCardCharacters(2);
    expect(card2[0][0]).toBe(83);
  });

  it('throws for a card number out of range', () => {
    expect(() => params.getCardCharacters(0)).toThrow(RangeError);
    expect(() => params.getCardCharacters(3)).toThrow(RangeError);
  });
});

describe('PassphraseParameters — forces exactly 1 block when the card is too short for a second', () => {
  const params = new PassphraseParameters({
    cardSize: { width: mm(85.6), height: mm(30) },
    cardPadding: mm(1.5),
    cardCornerRadius: mm(1.5),
    cardCount: 1,
    binaryDirection: 'horizontal',
    copies: 1,
    cellSize: { width: mm(2), height: mm(2) },
  });

  it('computes blockCount as 1', () => {
    // gridHeight = 27mm; blockThickness = 14mm; 2 blocks need 2*14+1.5=29.5mm > 27mm -> 1
    expect(params.blockThickness).toBeCloseTo(mm(14), 6);
    expect(params.blockCount).toBe(1);
    expect(params.capacityPerCard).toBe(params.charsPerBlock);
  });
});

describe('PassphraseParameters — vertical direction transposes the axes', () => {
  const params = new PassphraseParameters({
    cardSize: { width: mm(85.6), height: mm(54) },
    cardPadding: mm(1.5),
    cardCornerRadius: mm(1.5),
    cardCount: 1,
    binaryDirection: 'vertical',
    copies: 1,
    cellSize: { width: mm(2), height: mm(2) },
  });

  it('fits characters down the height, and sizes blocks 7 cells wide', () => {
    // gridHeight = 51mm, cellHeight = 2mm -> floor(51/2) = 25
    expect(params.charsPerBlock).toBe(25);
    expect(params.blockThickness).toBeCloseTo(mm(2) * 7, 6);
  });
});

describe('PassphraseParameters validation', () => {
  it('throws when cardCount is out of range', () => {
    expect(
      () =>
        new PassphraseParameters({
          cardSize: { width: mm(85.6), height: mm(54) },
          cardPadding: mm(1.5),
          cardCornerRadius: mm(1.5),
          cardCount: 0,
          binaryDirection: 'horizontal',
          copies: 1,
          cellSize: { width: mm(2), height: mm(2) },
        }),
    ).toThrow(RangeError);
  });

  it('throws when cellSize is non-positive', () => {
    expect(
      () =>
        new PassphraseParameters({
          cardSize: { width: mm(85.6), height: mm(54) },
          cardPadding: mm(1.5),
          cardCornerRadius: mm(1.5),
          cardCount: 1,
          binaryDirection: 'horizontal',
          copies: 1,
          cellSize: { width: 0, height: mm(2) },
        }),
    ).toThrow(RangeError);
  });
});
