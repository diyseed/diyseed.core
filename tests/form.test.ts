import { describe, it, expect } from 'vitest';
import { validate, toGeneratorParameters, DEFAULT_FORM_VALUES } from '../src/ui/form';
import { EncodingType } from '../src/generator/encoding';
import { mm } from '../src/units';

describe('validate', () => {
  it('accepts the default form values', () => {
    expect(validate(DEFAULT_FORM_VALUES)).toEqual([]);
  });

  it('flags an out-of-range seed length', () => {
    const errors = validate({ ...DEFAULT_FORM_VALUES, seedLength: 5 });
    expect(errors.map((e) => e.field)).toContain('seedLength');
  });

  it('flags an out-of-range card width', () => {
    const errors = validate({ ...DEFAULT_FORM_VALUES, cardWidthMm: 5 });
    expect(errors.map((e) => e.field)).toContain('cardWidthMm');
  });

  it('flags multiple invalid fields at once', () => {
    const errors = validate({ ...DEFAULT_FORM_VALUES, cardCount: 0, copies: 99 });
    expect(errors.map((e) => e.field).sort()).toEqual(['cardCount', 'copies']);
  });

  it('flags an out-of-range card padding', () => {
    const errors = validate({ ...DEFAULT_FORM_VALUES, cardPaddingMm: 10 });
    expect(errors.map((e) => e.field)).toContain('cardPaddingMm');
  });

  it('flags a card padding below the new 1mm minimum', () => {
    const errors = validate({ ...DEFAULT_FORM_VALUES, cardPaddingMm: 0.5 });
    expect(errors.map((e) => e.field)).toContain('cardPaddingMm');
  });
});

describe('toGeneratorParameters', () => {
  it('builds a GeneratorParameters matching the form values', () => {
    const params = toGeneratorParameters({
      seedLength: 24,
      cardCount: 2,
      cardWidthMm: 100,
      cardHeightMm: 60,
      cardSplit: 1,
      cardPaddingMm: 1.5,
      copies: 1,
      encoding: EncodingType.Alphabet,
    });
    expect(params.seedLength).toBe(24);
    expect(params.cardCount).toBe(2);
    expect(params.effectiveCardCount).toBe(2);
  });

  it('passes card padding through to GeneratorParameters', () => {
    const params = toGeneratorParameters({
      seedLength: 24,
      cardCount: 2,
      cardWidthMm: 100,
      cardHeightMm: 60,
      cardSplit: 1,
      cardPaddingMm: 2,
      copies: 1,
      encoding: EncodingType.Alphabet,
    });
    expect(params.cardPadding).toBeCloseTo(mm(2), 6);
  });
});
