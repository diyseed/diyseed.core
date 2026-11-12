import { describe, it, expect } from 'vitest';
import { seedCellWarnings, passphraseWarnings } from '../src/form/warnings';
import { GeneratorParameters, PassphraseParameters } from '../src/generator/params';
import { EncodingType } from '../src/generator/encoding';
import { mm } from '../src/units';

describe('seedCellWarnings', () => {
  it('trips nothing for a comfortably sized card', () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(100), height: mm(60) }, cardCount: 2, seedLength: 24 });
    expect(seedCellWarnings(params)).toEqual({ cellTooSmall: false, cellNotSquare: false, cellSizeInvalid: false });
  });

  it('trips cellTooSmall under 1.5 mm', () => {
    const params = new GeneratorParameters({ cardSize: { width: mm(20), height: mm(20) }, cardCount: 1, seedLength: 24 });
    expect(seedCellWarnings(params).cellTooSmall).toBe(true);
  });

  it('trips cellNotSquare when aspect exceeds 2', () => {
    const params = new GeneratorParameters(
      { cardSize: { width: mm(180), height: mm(20) }, cardCount: 1, seedLength: 10, encoding: EncodingType.Number },
    );
    expect(seedCellWarnings(params).cellNotSquare).toBe(true);
  });

  it('flags cellSizeInvalid and suppresses the other warnings', () => {
    const degenerate = { cellSize: { width: 0, height: -1 } } as unknown as GeneratorParameters;
    expect(seedCellWarnings(degenerate)).toEqual({ cellTooSmall: false, cellNotSquare: false, cellSizeInvalid: true });
  });
});

describe('passphraseWarnings', () => {
  const make = (card: number, padding: number, cell: number) => new PassphraseParameters({
    cardSize: { width: mm(card === 0 ? 85.6 : card), height: mm(card === 0 ? 54 : card) },
    cardPadding: mm(padding),
    cardCornerRadius: mm(1.5),
    cardCount: 1,
    copies: 1,
    cellSize: { width: mm(cell), height: mm(cell) },
  });

  it('trips nothing for a 2 mm cell', () => {
    expect(passphraseWarnings(make(0, 1.5, 2))).toEqual({ cellTooSmall: false, noCapacity: false });
  });

  it('trips cellTooSmall for a 1 mm cell', () => {
    expect(passphraseWarnings(make(0, 1.5, 1)).cellTooSmall).toBe(true);
  });

  it('trips noCapacity when no character fits', () => {
    expect(passphraseWarnings(make(20, 5, 20)).noCapacity).toBe(true);
  });
});
