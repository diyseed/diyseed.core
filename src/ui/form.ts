import { GeneratorParameters, PassphraseParameters } from '../generator/params';
import { EncodingType, BinaryDirection } from '../generator/encoding';
import * as Config from '../generator/config';
import { mm, Size } from '../units';

export interface PassphraseFormValues {
  enabled: boolean;
  cardCount: number;
  binaryDirection: BinaryDirection;
  overrideCellSizeMm: number | null;
}

export interface FormValues {
  includeSeed: boolean;
  seedLength: number;
  cardCount: number;
  cardWidthMm: number;
  cardHeightMm: number;
  cardSplit: number;
  cardPaddingMm: number;
  copies: number;
  encoding: EncodingType;
  binaryDirection: BinaryDirection;
  passphrase: PassphraseFormValues;
}

export interface FieldError {
  field: string;
  message: string;
}

const inRange = (value: number, range: [number, number]) => value >= range[0] && value <= range[1];

export function validate(values: FormValues): FieldError[] {
  const errors: FieldError[] = [];

  if (!values.includeSeed && !values.passphrase.enabled) {
    errors.push({ field: 'includeSeed', message: 'Enable at least one of Seed or Passphrase.' });
  }

  if (values.includeSeed) {
    if (!inRange(values.seedLength, Config.SEED_LENGTH_RANGE)) {
      errors.push({ field: 'seedLength', message: `Seed length must be between ${Config.SEED_LENGTH_RANGE[0]} and ${Config.SEED_LENGTH_RANGE[1]} words.` });
    }
    if (!inRange(values.cardCount, Config.CARD_COUNT_RANGE)) {
      errors.push({ field: 'cardCount', message: `Card count must be between ${Config.CARD_COUNT_RANGE[0]} and ${Config.CARD_COUNT_RANGE[1]}.` });
    }
    if (values.encoding !== EncodingType.Binary && !inRange(values.cardSplit, Config.CARD_SPLIT_RANGE)) {
      errors.push({ field: 'cardSplit', message: `Card split must be between ${Config.CARD_SPLIT_RANGE[0]} and ${Config.CARD_SPLIT_RANGE[1]}.` });
    }
  }

  if (!inRange(mm(values.cardWidthMm), Config.CARD_WIDTH_RANGE)) {
    errors.push({ field: 'cardWidthMm', message: 'Card width must be between 20 and 180 mm.' });
  }
  if (!inRange(mm(values.cardHeightMm), Config.CARD_HEIGHT_RANGE)) {
    errors.push({ field: 'cardHeightMm', message: 'Card height must be between 20 and 180 mm.' });
  }
  if (!inRange(mm(values.cardPaddingMm), Config.CARDS_PADDING_RANGE)) {
    errors.push({ field: 'cardPaddingMm', message: 'Card padding must be between 1 and 5 mm.' });
  }
  if (!inRange(values.copies, Config.WRITER_COPIES_RANGE)) {
    errors.push({ field: 'copies', message: `Copies must be between ${Config.WRITER_COPIES_RANGE[0]} and ${Config.WRITER_COPIES_RANGE[1]}.` });
  }

  if (values.passphrase.enabled) {
    if (!inRange(values.passphrase.cardCount, Config.CARD_COUNT_RANGE)) {
      errors.push({ field: 'passphraseCardCount', message: `Passphrase card count must be between ${Config.CARD_COUNT_RANGE[0]} and ${Config.CARD_COUNT_RANGE[1]}.` });
    }
    if (values.passphrase.overrideCellSizeMm !== null && !inRange(mm(values.passphrase.overrideCellSizeMm), Config.PASSPHRASE_OVERRIDE_CELL_SIZE_RANGE)) {
      errors.push({ field: 'passphraseOverrideCellSizeMm', message: 'Passphrase cell size must be between 1 and 10 mm.' });
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
    binaryDirection: values.binaryDirection,
    copies: values.copies,
    cardPadding: mm(values.cardPaddingMm),
  });
}

export function resolvePassphraseCellSize(input: { overrideCellSizeMm: number | null; seedCellSize: Size | null }): Size {
  if (input.overrideCellSizeMm !== null) {
    const s = mm(input.overrideCellSizeMm);
    return { width: s, height: s };
  }
  if (input.seedCellSize !== null) {
    return input.seedCellSize;
  }
  const fallback = Config.PASSPHRASE_FALLBACK_CELL_SIZE;
  return { width: fallback, height: fallback };
}

export function toPassphraseParameters(values: FormValues, seedParams: GeneratorParameters | null): PassphraseParameters {
  const cellSize = resolvePassphraseCellSize({
    overrideCellSizeMm: values.passphrase.overrideCellSizeMm,
    seedCellSize: seedParams ? seedParams.cellSize : null,
  });
  return new PassphraseParameters({
    cardSize: { width: mm(values.cardWidthMm), height: mm(values.cardHeightMm) },
    cardPadding: mm(values.cardPaddingMm),
    cardCornerRadius: Config.CARDS_RADIUS_DEFAULT,
    cardCount: values.passphrase.cardCount,
    binaryDirection: values.passphrase.binaryDirection,
    copies: values.copies,
    cellSize,
  });
}

export const DEFAULT_FORM_VALUES: FormValues = {
  includeSeed: true,
  seedLength: Config.SEED_LENGTH_DEFAULT,
  cardCount: Config.CARD_COUNT_DEFAULT,
  cardWidthMm: 85.6,
  cardHeightMm: 54,
  cardSplit: Config.CARD_SPLIT_DEFAULT,
  cardPaddingMm: 1.5,
  copies: Config.WRITER_COPIES_DEFAULT,
  encoding: Config.CARDS_ENCODING_DEFAULT,
  binaryDirection: Config.BINARY_DIRECTION_DEFAULT,
  passphrase: {
    enabled: false,
    cardCount: Config.PASSPHRASE_CARD_COUNT_DEFAULT,
    binaryDirection: Config.BINARY_DIRECTION_DEFAULT,
    overrideCellSizeMm: null,
  },
};
