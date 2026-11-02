import { describe, it, expect } from 'vitest';
import {
  validate,
  toGeneratorParameters,
  toPassphraseParameters,
  resolvePassphraseCellSize,
  isSeedSectionActive,
  isPassphraseSectionActive,
  hasAnyOutputSelected,
  DEFAULT_FORM_VALUES,
} from '../src/ui/form';
import { EncodingType } from '../src/generator/encoding';
import { mm } from '../src/units';

describe('isSeedSectionActive / isPassphraseSectionActive', () => {
  it('is driven solely by the top-level checkbox - the nested reader no longer activates the section on its own', () => {
    expect(isSeedSectionActive({ includeSeed: false })).toBe(false);
    expect(isSeedSectionActive({ includeSeed: true })).toBe(true);
    expect(isPassphraseSectionActive({ passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: false, includeReader: true } })).toBe(false);
    expect(isPassphraseSectionActive({ passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true } })).toBe(true);
  });
});

describe('hasAnyOutputSelected', () => {
  it('is true for the default form values (Seed stencil + reader + wordlist all checked)', () => {
    expect(hasAnyOutputSelected(DEFAULT_FORM_VALUES)).toBe(true);
  });

  it('is false when a section is open but all three of its nested checkboxes are unchecked', () => {
    expect(
      hasAnyOutputSelected({
        ...DEFAULT_FORM_VALUES,
        includeSeedStencil: false,
        includeSeedReader: false,
        includeSeedWordTable: false,
        passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: false },
      }),
    ).toBe(false);
  });

  it('ignores a closed section\'s nested checkboxes even if their raw state is still true', () => {
    expect(
      hasAnyOutputSelected({
        ...DEFAULT_FORM_VALUES,
        includeSeed: false, // section closed, but leaf flags left at their default (true)
        includeSeedStencil: true,
        includeSeedReader: true,
        includeSeedWordTable: true,
        passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: false },
      }),
    ).toBe(false);
  });

  it('is true once any one of Passphrase\'s nested checkboxes is checked with the section open', () => {
    expect(
      hasAnyOutputSelected({
        ...DEFAULT_FORM_VALUES,
        includeSeedStencil: false,
        includeSeedReader: false,
        includeSeedWordTable: false,
        passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true, includeStencil: false, includeReader: true },
      }),
    ).toBe(true);
  });
});

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

  it('skips seed-specific validation entirely when Seed is unchecked', () => {
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

  it('rejects when both Seed and Passphrase are unchecked - their reader/reference sub-checkboxes are unreachable without them', () => {
    const errors = validate({
      ...DEFAULT_FORM_VALUES,
      includeSeed: false,
      passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: false },
    });
    expect(errors.map((e) => e.field)).toContain('includeSeed');
  });

  it('accepts passphrase-only (Seed off, Passphrase on)', () => {
    const errors = validate({
      ...DEFAULT_FORM_VALUES,
      includeSeed: false,
      passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true },
    });
    expect(errors).toEqual([]);
  });

  it('flags an out-of-range passphrase card count only when passphrase is enabled', () => {
    const disabledErrors = validate({ ...DEFAULT_FORM_VALUES, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: false, cardCount: 999 } });
    expect(disabledErrors.map((e) => e.field)).not.toContain('passphraseCardCount');

    const enabledErrors = validate({ ...DEFAULT_FORM_VALUES, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true, cardCount: 999 } });
    expect(enabledErrors.map((e) => e.field)).toContain('passphraseCardCount');
  });

  it('flags an out-of-range passphrase copies independently of the seed copies', () => {
    const seedOnlyBad = validate({ ...DEFAULT_FORM_VALUES, copies: 99, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true, copies: 1 } });
    expect(seedOnlyBad.map((e) => e.field)).toContain('copies');
    expect(seedOnlyBad.map((e) => e.field)).not.toContain('passphraseCopies');

    const passphraseOnlyBad = validate({ ...DEFAULT_FORM_VALUES, copies: 1, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true, copies: 99 } });
    expect(passphraseOnlyBad.map((e) => e.field)).toContain('passphraseCopies');
    expect(passphraseOnlyBad.map((e) => e.field)).not.toContain('copies');
  });

  it('flags an out-of-range passphrase cell size', () => {
    const inRange = validate({ ...DEFAULT_FORM_VALUES, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true, cellSizeMm: 2 } });
    expect(inRange.map((e) => e.field)).not.toContain('passphraseCellSizeMm');

    const outOfRange = validate({ ...DEFAULT_FORM_VALUES, passphrase: { ...DEFAULT_FORM_VALUES.passphrase, enabled: true, cellSizeMm: 50 } });
    expect(outOfRange.map((e) => e.field)).toContain('passphraseCellSizeMm');
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
      includeSeed: true,
      includeSeedStencil: true,
      includeSeedReader: false,
      includeAsciiTable: false,
      includeSeedWordTable: false,
      passphrase: { enabled: false, includeStencil: true, includeReader: false, cardCount: 1, copies: 1, cellSizeMm: 2 },
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
      includeSeed: true,
      includeSeedStencil: true,
      includeSeedReader: false,
      includeAsciiTable: false,
      includeSeedWordTable: false,
      passphrase: { enabled: false, includeStencil: true, includeReader: false, cardCount: 1, copies: 1, cellSizeMm: 2 },
    });
    expect(params.cardPadding).toBeCloseTo(mm(2), 6);
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
      includeSeed: true,
      includeSeedStencil: true,
      includeSeedReader: false,
      includeAsciiTable: false,
      includeSeedWordTable: false,
      passphrase: { enabled: false, includeStencil: true, includeReader: false, cardCount: 1, copies: 1, cellSizeMm: 2 },
    });
    expect(params.cardSplit).toBe(3);
  });

  it('forces cardSplit to 1 for Binary encoding, ignoring any explicit cardSplit', () => {
    const params = toGeneratorParameters({
      seedLength: 12,
      cardCount: 2,
      cardWidthMm: 85.6,
      cardHeightMm: 54,
      cardSplit: 99,
      cardPaddingMm: 1.5,
      copies: 1,
      encoding: EncodingType.Binary,
      includeSeed: true,
      includeSeedStencil: true,
      includeSeedReader: false,
      includeAsciiTable: false,
      includeSeedWordTable: false,
      passphrase: { enabled: false, includeStencil: true, includeReader: false, cardCount: 1, copies: 1, cellSizeMm: 2 },
    });
    expect(params.cardSplit).toBe(1);
  });
});

describe('resolvePassphraseCellSize', () => {
  it('converts the mm value straight into a square cell', () => {
    const result = resolvePassphraseCellSize({ cellSizeMm: 3 });
    expect(result.width).toBeCloseTo(mm(3), 6);
    expect(result.height).toBeCloseTo(mm(3), 6);
  });

  it('reflects the default 2mm value', () => {
    const result = resolvePassphraseCellSize({ cellSizeMm: DEFAULT_FORM_VALUES.passphrase.cellSizeMm });
    expect(result.width).toBeCloseTo(mm(2), 6);
    expect(result.height).toBeCloseTo(mm(2), 6);
  });
});

describe('toPassphraseParameters', () => {
  it('builds a PassphraseParameters sharing card size/padding/radius with the seed form values, using its own copies and cell size', () => {
    const values = {
      ...DEFAULT_FORM_VALUES,
      cardWidthMm: 85.6,
      cardHeightMm: 54,
      cardPaddingMm: 1.5,
      copies: 5, // seed's own copies - must NOT leak into the passphrase's
      passphrase: { enabled: true, includeStencil: true, includeReader: false, cardCount: 3, copies: 2, cellSizeMm: 4 },
    };
    const params = toPassphraseParameters(values);
    expect(params.cardSize).toEqual({ width: mm(85.6), height: mm(54) });
    expect(params.cardPadding).toBeCloseTo(mm(1.5), 6);
    expect(params.copies).toBe(2);
    expect(params.cardCount).toBe(3);
    expect(params.cellSize.width).toBeCloseTo(mm(4), 6);
    expect(params.cellSize.height).toBeCloseTo(mm(4), 6);
  });

  it('ignores the seed cell size entirely, independent of the seed section', () => {
    const values = {
      ...DEFAULT_FORM_VALUES,
      passphrase: { enabled: true, includeStencil: true, includeReader: false, cardCount: 1, copies: 1, cellSizeMm: 2 },
    };
    const seedParams = toGeneratorParameters(values);
    const params = toPassphraseParameters(values);
    expect(seedParams.cellSize.width).not.toBeCloseTo(mm(2), 3);
    expect(params.cellSize.width).toBeCloseTo(mm(2), 6);
    expect(params.cellSize.height).toBeCloseTo(mm(2), 6);
  });
});
