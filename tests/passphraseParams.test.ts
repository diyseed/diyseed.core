import { describe, it, expect } from 'vitest';
import { PassphraseParameters } from '../src/generator/params';
import { mm } from '../src/units';

describe('PassphraseParameters — horizontal direction (85.6x54mm, 1.5mm padding, 2mm cells)', () => {
  const params = new PassphraseParameters({
    cardSize: { width: mm(85.6), height: mm(54) },
    cardPadding: mm(1.5),
    cardCornerRadius: mm(1.5),
    cardCount: 2,
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

  it('fits 3 blocks in the available height, not a hard-coded max of 2', () => {
    // gridHeight = 51mm; blockThickness = 14mm, padding = 1.5mm.
    // n blocks need n*14 + (n-1)*1.5 <= 51 -> n=3 needs 42+3=45 <= 51 (fits);
    // n=4 needs 56+4.5=60.5 > 51 (doesn't fit) -> blockCount = 3.
    expect(params.blockCount).toBe(3);
  });

  it('computes capacityPerCard and totalCapacity from charsPerBlock and blockCount', () => {
    expect(params.capacityPerCard).toBe(41 * 3);
    expect(params.totalCapacity).toBe(41 * 3 * 2); // cardCount = 2
  });

  it('numbers every block 1..charsPerBlock - each block is a separate passphrase, not a slice of one long one', () => {
    const card1 = params.getCardCharacters(1);
    expect(card1).toHaveLength(3);
    expect(card1[0]).toHaveLength(41);
    expect(card1[0][0]).toBe(1);
    expect(card1[0][40]).toBe(41);
    expect(card1[1][0]).toBe(1);
    expect(card1[1][40]).toBe(41);
    expect(card1[2][0]).toBe(1);
    expect(card1[2][40]).toBe(41);

    const card2 = params.getCardCharacters(2);
    expect(card2[0][0]).toBe(1);
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

describe('PassphraseParameters validation', () => {
  it('throws when cardCount is out of range', () => {
    expect(
      () =>
        new PassphraseParameters({
          cardSize: { width: mm(85.6), height: mm(54) },
          cardPadding: mm(1.5),
          cardCornerRadius: mm(1.5),
          cardCount: 0,
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
          copies: 1,
          cellSize: { width: 0, height: mm(2) },
        }),
    ).toThrow(RangeError);
  });
});
