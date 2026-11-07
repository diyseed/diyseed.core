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

function checkWhole(errors: FieldError[], field: string, label: string, value: number, range: [number, number]): void {
  if (!Number.isInteger(value) || !inRange(value, range)) {
    errors.push({ field, message: `${label} must be a whole number from ${range[0]} to ${range[1]}.` });
  }
}

// Millimeter fields allow one decimal: the card code stores them in tenths,
// so finer values would regenerate a slightly different stencil.
function checkMm(errors: FieldError[], field: string, label: string, valueMm: number, range: [number, number]): void {
  const [min, max] = range.map((points) => Number(toMm(points).toFixed(1)));
  const isTenths = Math.abs(valueMm * 10 - Math.round(valueMm * 10)) < 1e-9;
  if (!isTenths || valueMm < min || valueMm > max) {
    errors.push({ field, message: `${label} must be from ${min} to ${max} mm, in 0.1 mm steps.` });
  }
}

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
  checkMm(errors, 'cardWidthMm', 'Card width', values.cardWidthMm, Config.CARD_WIDTH_RANGE);
  checkMm(errors, 'cardHeightMm', 'Card height', values.cardHeightMm, Config.CARD_HEIGHT_RANGE);
  checkMm(errors, 'cardPaddingMm', 'Card padding', values.cardPaddingMm, Config.CARDS_PADDING_RANGE);

  if (seedActive) {
    checkWhole(errors, 'seedLength', 'Seed length', values.seedLength, Config.SEED_LENGTH_RANGE);
    checkWhole(errors, 'cardCount', 'Split over (card sides)', values.cardCount, Config.CARD_COUNT_RANGE);
    if (values.encoding !== EncodingType.Binary) {
      checkWhole(errors, 'cardSplit', 'Card split', values.cardSplit, Config.CARD_SPLIT_RANGE);
    }
    checkWhole(errors, 'copies', 'Stencil sets', values.copies, Config.WRITER_COPIES_RANGE);
  }

  if (passphraseActive) {
    checkWhole(errors, 'passphraseCardCount', 'Passphrase card count', values.passphrase.cardCount, Config.CARD_COUNT_RANGE);
    checkWhole(errors, 'passphraseCopies', 'Stencil sets', values.passphrase.copies, Config.WRITER_COPIES_RANGE);
    checkMm(errors, 'passphraseCellSizeMm', 'Passphrase cell size', values.passphrase.cellSizeMm, Config.PASSPHRASE_CELL_SIZE_RANGE);
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
