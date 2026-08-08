import { describe, it, expect } from 'vitest';
import { EncodingType } from '../src/generator/encoding';
import * as Config from '../src/generator/config';
import { mm } from '../src/units';

describe('encoding', () => {
  it('has the BIP39-alphabet and number row counts', () => {
    expect(EncodingType.Alphabet).toBe(26);
    expect(EncodingType.Number).toBe(10);
  });
});

describe('config ranges (mirrors Configuration.cs)', () => {
  it('matches the documented validation ranges', () => {
    expect(Config.SEED_LENGTH_RANGE).toEqual([10, 39]);
    expect(Config.CARD_COUNT_RANGE).toEqual([1, 13]);
    expect(Config.CARD_SPLIT_RANGE).toEqual([1, 5]);
    expect(Config.WRITER_COPIES_RANGE).toEqual([1, 10]);
    expect(Config.CARD_WIDTH_RANGE[0]).toBeCloseTo(mm(20), 6);
    expect(Config.CARD_WIDTH_RANGE[1]).toBeCloseTo(mm(180), 6);
    expect(Config.CARD_HEIGHT_RANGE).toEqual(Config.CARD_WIDTH_RANGE);
  });

  it('matches the documented defaults', () => {
    expect(Config.SEED_LENGTH_DEFAULT).toBe(12);
    expect(Config.CARD_COUNT_DEFAULT).toBe(2);
    expect(Config.CARD_SIZE_DEFAULT).toEqual({ width: mm(85.6), height: mm(54) });
    expect(Config.CARD_SPLIT_DEFAULT).toBe(1);
    expect(Config.WRITER_COPIES_DEFAULT).toBe(1);
    expect(Config.CARDS_ENCODING_DEFAULT).toBe(EncodingType.Alphabet);
  });

  it('derives EFFECTIVE_PAGE_SIZE from A4 minus margins', () => {
    expect(Config.EFFECTIVE_PAGE_SIZE.width).toBeCloseTo(Config.DOCUMENT_SIZE.width - 2 * Config.DOCUMENT_MARGIN_H, 6);
    expect(Config.EFFECTIVE_PAGE_SIZE.height).toBeCloseTo(
      Config.DOCUMENT_SIZE.height - Config.DOCUMENT_MARGIN_TOP - Config.DOCUMENT_MARGIN_BOTTOM,
      6,
    );
  });
});

describe('preview warning thresholds', () => {
  it('defines a 1.5mm minimum cell size and a 2:1 max aspect ratio', () => {
    expect(Config.MIN_CELL_SIZE_MM).toBeCloseTo(mm(1.5), 6);
    expect(Config.MAX_CELL_ASPECT_RATIO).toBe(2);
  });
});

describe('corner mark geometry', () => {
  it('defines a slightly larger radius and a 1mm pitch, in points', () => {
    expect(Config.CORNER_MARK_RADIUS).toBeCloseTo(mm(0.35), 6);
    expect(Config.CORNER_MARK_PITCH).toBeCloseTo(mm(1), 6);
  });
});

describe('card padding range', () => {
  it('has a 1mm minimum so every card has room for at least one corner-mark dot', () => {
    expect(Config.CARDS_PADDING_RANGE[0]).toBeCloseTo(mm(1), 6);
    expect(Config.CARDS_PADDING_RANGE[1]).toBeCloseTo(mm(5), 6);
  });
});
