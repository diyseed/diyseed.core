import { describe, it, expect } from 'vitest';
import {
  encodeSeedConfigCode,
  encodePassphraseConfigCode,
  decodeConfigCode,
  ConfigCodeError,
} from '../src/generator/configCode';
import { GeneratorParameters, PassphraseParameters } from '../src/generator/params';
import { EncodingType } from '../src/generator/encoding';
import * as Config from '../src/generator/config';
import { mm } from '../src/units';

const creditCard = { width: mm(85.6), height: mm(54) };

describe('encodeSeedConfigCode', () => {
  it('encodes the default credit-card setup', () => {
    const params = new GeneratorParameters({ cardSize: creditCard, cardCount: 1, seedLength: 12, cardPadding: mm(1.5) });
    expect(encodeSeedConfigCode(params)).toBe('1-0856-0540-15-12-01-1-1');
  });

  it('encodes card count, rows and encoding', () => {
    const params = new GeneratorParameters({
      cardSize: { width: mm(50), height: mm(80) },
      cardCount: 2,
      seedLength: 24,
      cardSplit: 3,
      cardPadding: mm(1),
      encoding: EncodingType.Number,
    });
    expect(encodeSeedConfigCode(params)).toBe('1-0500-0800-10-24-02-3-2');
  });

  it('encodes Binary with its forced single row', () => {
    const params = new GeneratorParameters({
      cardSize: creditCard,
      cardCount: 2,
      seedLength: 24,
      cardSplit: 4,
      cardPadding: mm(2),
      encoding: EncodingType.Binary,
    });
    expect(encodeSeedConfigCode(params)).toBe('1-0856-0540-20-24-02-1-3');
  });
});

describe('encodePassphraseConfigCode', () => {
  it('encodes card size, padding and cell size', () => {
    const params = new PassphraseParameters({
      cardSize: creditCard,
      cardPadding: mm(1.5),
      cardCornerRadius: Config.CARDS_RADIUS_DEFAULT,
      cardCount: 1,
      copies: 1,
      cellSize: { width: mm(2), height: mm(2) },
    });
    expect(encodePassphraseConfigCode(params)).toBe('2-0856-0540-15-020');
  });
});

describe('decodeConfigCode', () => {
  it('round-trips a seed code', () => {
    const decoded = decodeConfigCode('1-0500-0800-10-24-02-3-2');
    expect(decoded.kind).toBe('seed');
    if (decoded.kind !== 'seed') return;
    expect(decoded.parameters.seedLength).toBe(24);
    expect(decoded.parameters.cardCount).toBe(2);
    expect(decoded.parameters.cardSplit).toBe(3);
    expect(decoded.parameters.seedEncoding).toBe(EncodingType.Number);
    expect(decoded.parameters.cardSize.width).toBeCloseTo(mm(50));
    expect(decoded.parameters.cardSize.height).toBeCloseTo(mm(80));
    expect(decoded.parameters.cardPadding).toBeCloseTo(mm(1));
    expect(encodeSeedConfigCode(decoded.parameters)).toBe('1-0500-0800-10-24-02-3-2');
  });

  it('round-trips a passphrase code', () => {
    const decoded = decodeConfigCode('2-0600-0400-20-015');
    expect(decoded.kind).toBe('passphrase');
    if (decoded.kind !== 'passphrase') return;
    expect(decoded.parameters.cellSize.width).toBeCloseTo(mm(1.5));
    expect(encodePassphraseConfigCode(decoded.parameters)).toBe('2-0600-0400-20-015');
  });

  it('tolerates spaces around dashes and surrounding whitespace', () => {
    expect(decodeConfigCode('  2 - 0856 - 0540 - 15 - 020 ').kind).toBe('passphrase');
  });

  it.each([
    ['not digits', '2-08a6-0540-15-020'],
    ['wrong group count', '2-0856-0540-15'],
    ['wrong group length', '2-856-0540-15-020'],
    ['unknown format id', '3-0856-0540-15-020'],
    ['multi-digit format id', '01-0856-0540-15-020'],
    ['passphrase layout under the seed id', '1-0856-0540-15-020'],
    ['seed layout under the passphrase id', '2-0856-0540-15-12-01-1-1'],
    ['unknown encoding', '1-0856-0540-15-12-01-1-4'],
    ['out-of-range card count', '1-0856-0540-15-12-14-1-1'],
    ['out-of-range value', '2-0100-0540-15-020'],
  ])('rejects %s', (_, code) => {
    expect(() => decodeConfigCode(code)).toThrow(ConfigCodeError);
  });
});
