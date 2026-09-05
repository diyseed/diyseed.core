import { GeneratorParameters, PassphraseParameters } from '../generator/params';
import { EncodingType } from '../generator/encoding';
import * as Config from '../generator/config';
import { mm, toMm, Size } from '../units';

export interface PassphraseFormValues {
  enabled: boolean;
  includeStencil: boolean;
  includeReader: boolean;
  cardCount: number;
  copies: number;
  cellSizeMm: number;
}

export interface FormValues {
  includeSeed: boolean;
  includeSeedStencil: boolean;
  includeSeedReader: boolean;
  seedLength: number;
  cardCount: number;
  cardWidthMm: number;
  cardHeightMm: number;
  cardSplit: number;
  cardPaddingMm: number;
  copies: number;
  encoding: EncodingType;
  passphrase: PassphraseFormValues;
  includeAsciiTable: boolean;
  includeSeedWordTable: boolean;
}

export interface FieldError {
  field: string;
  message: string;
}

const inRange = (value: number, range: [number, number]) => value >= range[0] && value <= range[1];

// The Seed/Passphrase sections (their fields, their nested reader/reference
// checkboxes) are only reachable through their own top-level checkbox now -
// unlike before, a reader alone can no longer surface the section on its
// own, since its checkbox lives inside the section it would need to reveal.
export function isSeedSectionActive(values: Pick<FormValues, 'includeSeed'>): boolean {
  return values.includeSeed;
}

export function isPassphraseSectionActive(values: Pick<FormValues, 'passphrase'>): boolean {
  return values.passphrase.enabled;
}

// A section being open doesn't by itself produce anything - each of its
// three nested checkboxes (Stencil, reader, reference table) can be
// unchecked independently, so the section can sit open with nothing
// actually selected inside it. Also guards against a closed section's own
// nested checkboxes counting anyway - their true DOM/object state is
// irrelevant once the section itself is off, since the user has no way to
// see or toggle them there.
export function hasAnyOutputSelected(
  values: Pick<
    FormValues,
    'includeSeed' | 'includeSeedStencil' | 'includeSeedReader' | 'includeSeedWordTable' | 'includeAsciiTable' | 'passphrase'
  >,
): boolean {
  const seedActive = isSeedSectionActive(values);
  const passphraseActive = isPassphraseSectionActive(values);
  return (
    (seedActive && (values.includeSeedStencil || values.includeSeedReader || values.includeSeedWordTable)) ||
    (passphraseActive && (values.passphrase.includeStencil || values.passphrase.includeReader || values.includeAsciiTable))
  );
}

export function validate(values: FormValues): FieldError[] {
  const errors: FieldError[] = [];
  const seedActive = isSeedSectionActive(values);
  const passphraseActive = isPassphraseSectionActive(values);

  if (!hasAnyOutputSelected(values)) {
    errors.push({ field: 'includeSeed', message: 'Enable at least one output: a Seed or Passphrase stencil, reader, or reference table.' });
  }

  // Card properties are always visible/required, regardless of which
  // section(s) are active - Seed and Passphrase both depend on them once
  // enabled, so there's no state where they can be safely skipped.
  if (!inRange(mm(values.cardWidthMm), Config.CARD_WIDTH_RANGE)) {
    errors.push({ field: 'cardWidthMm', message: 'Card width must be between 20 and 180 mm.' });
  }
  if (!inRange(mm(values.cardHeightMm), Config.CARD_HEIGHT_RANGE)) {
    errors.push({ field: 'cardHeightMm', message: 'Card height must be between 20 and 180 mm.' });
  }
  if (!inRange(mm(values.cardPaddingMm), Config.CARDS_PADDING_RANGE)) {
    errors.push({ field: 'cardPaddingMm', message: 'Card padding must be between 1 and 5 mm.' });
  }

  if (seedActive) {
    if (!inRange(values.seedLength, Config.SEED_LENGTH_RANGE)) {
      errors.push({ field: 'seedLength', message: `Seed length must be between ${Config.SEED_LENGTH_RANGE[0]} and ${Config.SEED_LENGTH_RANGE[1]} words.` });
    }
    if (!inRange(values.cardCount, Config.CARD_COUNT_RANGE)) {
      errors.push({ field: 'cardCount', message: `Card count must be between ${Config.CARD_COUNT_RANGE[0]} and ${Config.CARD_COUNT_RANGE[1]}.` });
    }
    if (values.encoding !== EncodingType.Binary && !inRange(values.cardSplit, Config.CARD_SPLIT_RANGE)) {
      errors.push({ field: 'cardSplit', message: `Card split must be between ${Config.CARD_SPLIT_RANGE[0]} and ${Config.CARD_SPLIT_RANGE[1]}.` });
    }
    if (!inRange(values.copies, Config.WRITER_COPIES_RANGE)) {
      errors.push({ field: 'copies', message: `Copies must be between ${Config.WRITER_COPIES_RANGE[0]} and ${Config.WRITER_COPIES_RANGE[1]}.` });
    }
  }

  if (passphraseActive) {
    if (!inRange(values.passphrase.cardCount, Config.CARD_COUNT_RANGE)) {
      errors.push({ field: 'passphraseCardCount', message: `Passphrase card count must be between ${Config.CARD_COUNT_RANGE[0]} and ${Config.CARD_COUNT_RANGE[1]}.` });
    }
    if (!inRange(values.passphrase.copies, Config.WRITER_COPIES_RANGE)) {
      errors.push({ field: 'passphraseCopies', message: `Copies must be between ${Config.WRITER_COPIES_RANGE[0]} and ${Config.WRITER_COPIES_RANGE[1]}.` });
    }
    if (!inRange(mm(values.passphrase.cellSizeMm), Config.PASSPHRASE_CELL_SIZE_RANGE)) {
      errors.push({ field: 'passphraseCellSizeMm', message: 'Passphrase cell size must be between 1 and 10 mm.' });
    }
  }

  return errors;
}

export function toGeneratorParameters(values: FormValues): GeneratorParameters {
  return new GeneratorParameters({
    cardSize: { width: mm(values.cardWidthMm), height: mm(values.cardHeightMm) },
    cardCount: values.cardCount,
    seedLength: values.seedLength,
    cardSplit: values.encoding === EncodingType.Binary ? undefined : values.cardSplit,
    encoding: values.encoding,
    copies: values.copies,
    cardPadding: mm(values.cardPaddingMm),
  });
}

export function resolvePassphraseCellSize(input: { cellSizeMm: number }): Size {
  const s = mm(input.cellSizeMm);
  return { width: s, height: s };
}

export function toPassphraseParameters(values: FormValues): PassphraseParameters {
  const cellSize = resolvePassphraseCellSize({
    cellSizeMm: values.passphrase.cellSizeMm,
  });
  return new PassphraseParameters({
    cardSize: { width: mm(values.cardWidthMm), height: mm(values.cardHeightMm) },
    cardPadding: mm(values.cardPaddingMm),
    cardCornerRadius: Config.CARDS_RADIUS_DEFAULT,
    cardCount: values.passphrase.cardCount,
    copies: values.passphrase.copies,
    cellSize,
  });
}

export const DEFAULT_FORM_VALUES: FormValues = {
  includeSeed: true,
  includeSeedStencil: true,
  includeSeedReader: true,
  seedLength: Config.SEED_LENGTH_DEFAULT,
  cardCount: Config.CARD_COUNT_DEFAULT,
  cardWidthMm: 85.6,
  cardHeightMm: 54,
  cardSplit: Config.CARD_SPLIT_DEFAULT,
  cardPaddingMm: 1.5,
  copies: Config.WRITER_COPIES_DEFAULT,
  encoding: Config.CARDS_ENCODING_DEFAULT,
  passphrase: {
    enabled: true,
    includeStencil: true,
    includeReader: true,
    cardCount: Config.PASSPHRASE_CARD_COUNT_DEFAULT,
    copies: Config.WRITER_COPIES_DEFAULT,
    cellSizeMm: toMm(Config.PASSPHRASE_CELL_SIZE_DEFAULT),
  },
  includeAsciiTable: true,
  includeSeedWordTable: true,
};
