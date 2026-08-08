import { describe, it, expect } from 'vitest';
import { validate, toGeneratorParameters, toPassphraseParameters, resolvePassphraseCellSize, DEFAULT_FORM_VALUES } from '../src/ui/form';
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

  it('does not flag an out-of-range cardSplit when encoding is Binary, since the field is hidden and ignored', () => {
    const errors = validate({ ...DEFAULT_FORM_VALUES, encoding: EncodingType.Binary, cardSplit: 99 });
    expect(errors.map((e) => e.field)).not.toContain('cardSplit');
  });

  it('still flags an out-of-range cardSplit for non-Binary encodings', () => {
    const errors = validate({ ...DEFAULT_FORM_VALUES, encoding: EncodingType.Alphabet, cardSplit: 99 });
    expect(errors.map((e) => e.field)).toContain('cardSplit');
  });

  it('skips seed-specific validation entirely when includeSeed is false', () => {
    const errors = validate({
      ...DEFAULT_FORM_VALUES,
      includeSeed: false,
      seedLength: 999, // would normally fail
      cardSplit: 999, // would normally fail
      passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true },
    });
    expect(errors.map((e) => e.field)).not.toContain('seedLength');
    expect(errors.map((e) => e.field)).not.toContain('cardSplit');
  });

  it('rejects when both Seed and Passphrase are disabled', () => {
    const errors = validate({ ...DEFAULT_FORM_VALUES, includeSeed: false, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: false } });
    expect(errors.map((e) => e.field)).toContain('includeSeed');
  });

  it('accepts passphrase-only (Seed off, Passphrase on)', () => {
    const errors = validate({ ...DEFAULT_FORM_VALUES, includeSeed: false, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true } });
    expect(errors).toEqual([]);
  });

  it('flags an out-of-range passphrase card count only when passphrase is enabled', () => {
    const disabledErrors = validate({ ...DEFAULT_FORM_VALUES, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: false, cardCount: 999 } });
    expect(disabledErrors.map((e) => e.field)).not.toContain('passphraseCardCount');

    const enabledErrors = validate({ ...DEFAULT_FORM_VALUES, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true, cardCount: 999 } });
    expect(enabledErrors.map((e) => e.field)).toContain('passphraseCardCount');
  });

  it('flags an out-of-range passphrase override cell size only when it is set', () => {
    const noOverride = validate({ ...DEFAULT_FORM_VALUES, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true, overrideCellSizeMm: null } });
    expect(noOverride.map((e) => e.field)).not.toContain('passphraseOverrideCellSizeMm');

    const badOverride = validate({ ...DEFAULT_FORM_VALUES, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true, overrideCellSizeMm: 50 } });
    expect(badOverride.map((e) => e.field)).toContain('passphraseOverrideCellSizeMm');
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
      binaryDirection: 'horizontal',
      includeSeed: true,
      passphrase: { enabled: false, cardCount: 1, binaryDirection: 'horizontal', overrideCellSizeMm: null },
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
      binaryDirection: 'horizontal',
      includeSeed: true,
      passphrase: { enabled: false, cardCount: 1, binaryDirection: 'horizontal', overrideCellSizeMm: null },
    });
    expect(params.cardPadding).toBeCloseTo(mm(2), 6);
  });

  it('does not forward cardSplit for vertical Binary encoding, leaving GeneratorParameters to auto-derive it', () => {
    const params = toGeneratorParameters({
      seedLength: 12,
      cardCount: 2,
      cardWidthMm: 85.6,
      cardHeightMm: 54,
      cardSplit: 99,
      cardPaddingMm: 1.5,
      copies: 1,
      encoding: EncodingType.Binary,
      binaryDirection: 'vertical',
      includeSeed: true,
      passphrase: { enabled: false, cardCount: 1, binaryDirection: 'horizontal', overrideCellSizeMm: null },
    });
    expect(params.cardSplit).toBe(6);
  });

  it('still forwards cardSplit as-is for non-Binary encodings', () => {
    const params = toGeneratorParameters({
      seedLength: 24,
      cardCount: 2,
      cardWidthMm: 100,
      cardHeightMm: 60,
      cardSplit: 3,
      cardPaddingMm: 1.5,
      copies: 1,
      encoding: EncodingType.Alphabet,
      binaryDirection: 'horizontal',
      includeSeed: true,
      passphrase: { enabled: false, cardCount: 1, binaryDirection: 'horizontal', overrideCellSizeMm: null },
    });
    expect(params.cardSplit).toBe(3);
  });

  it('defaults to horizontal Binary (cardSplit forced to 1, not seed-length-derived)', () => {
    const params = toGeneratorParameters({
      seedLength: 12,
      cardCount: 2,
      cardWidthMm: 85.6,
      cardHeightMm: 54,
      cardSplit: 1,
      cardPaddingMm: 1.5,
      copies: 1,
      encoding: EncodingType.Binary,
      binaryDirection: 'horizontal',
      includeSeed: true,
      passphrase: { enabled: false, cardCount: 1, binaryDirection: 'horizontal', overrideCellSizeMm: null },
    });
    expect(params.cardSplit).toBe(1);
  });
});

describe('resolvePassphraseCellSize', () => {
  it('uses the override when provided, as a square cell', () => {
    const result = resolvePassphraseCellSize({ overrideCellSizeMm: 3, seedCellSize: { width: mm(2.5), height: mm(1.8) } });
    expect(result.width).toBeCloseTo(mm(3), 6);
    expect(result.height).toBeCloseTo(mm(3), 6);
  });

  it('matches the seed cell size (possibly non-square) when no override and seed is present', () => {
    const result = resolvePassphraseCellSize({ overrideCellSizeMm: null, seedCellSize: { width: mm(2.5), height: mm(1.8) } });
    expect(result.width).toBeCloseTo(mm(2.5), 6);
    expect(result.height).toBeCloseTo(mm(1.8), 6);
  });

  it('falls back to the fixed default square cell when no override and no seed', () => {
    const result = resolvePassphraseCellSize({ overrideCellSizeMm: null, seedCellSize: null });
    expect(result.width).toBeCloseTo(mm(2), 6);
    expect(result.height).toBeCloseTo(mm(2), 6);
  });
});

describe('toPassphraseParameters', () => {
  it('builds a PassphraseParameters sharing card size/padding/radius/copies with the seed form values', () => {
    const values = {
      ...DEFAULT_FORM_VALUES,
      cardWidthMm: 85.6,
      cardHeightMm: 54,
      cardPaddingMm: 1.5,
      copies: 2,
      passphrase: { enabled: true, cardCount: 3, binaryDirection: 'vertical' as const, overrideCellSizeMm: null },
    };
    const params = toPassphraseParameters(values, null);
    expect(params.cardSize).toEqual({ width: mm(85.6), height: mm(54) });
    expect(params.cardPadding).toBeCloseTo(mm(1.5), 6);
    expect(params.copies).toBe(2);
    expect(params.cardCount).toBe(3);
    expect(params.binaryDirection).toBe('vertical');
    // no seed provided, no override -> fallback cell size
    expect(params.cellSize.width).toBeCloseTo(mm(2), 6);
  });

  it('matches the seed cellSize when a seed GeneratorParameters is passed and no override is set', () => {
    const values = {
      ...DEFAULT_FORM_VALUES,
      passphrase: { enabled: true, cardCount: 1, binaryDirection: 'horizontal' as const, overrideCellSizeMm: null },
    };
    const seedParams = toGeneratorParameters(values);
    const params = toPassphraseParameters(values, seedParams);
    expect(params.cellSize.width).toBeCloseTo(seedParams.cellSize.width, 6);
    expect(params.cellSize.height).toBeCloseTo(seedParams.cellSize.height, 6);
  });
});
