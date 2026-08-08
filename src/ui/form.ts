import { GeneratorParameters } from '../generator/params';
import { EncodingType, BinaryDirection } from '../generator/encoding';
import * as Config from '../generator/config';
import { mm } from '../units';

export interface FormValues {
  seedLength: number;
  cardCount: number;
  cardWidthMm: number;
  cardHeightMm: number;
  cardSplit: number;
  cardPaddingMm: number;
  copies: number;
  encoding: EncodingType;
  binaryDirection: BinaryDirection;
}

export interface FieldError {
  field: keyof FormValues;
  message: string;
}

const inRange = (value: number, range: [number, number]) => value >= range[0] && value <= range[1];

export function validate(values: FormValues): FieldError[] {
  const errors: FieldError[] = [];

  if (!inRange(values.seedLength, Config.SEED_LENGTH_RANGE)) {
    errors.push({ field: 'seedLength', message: `Seed length must be between ${Config.SEED_LENGTH_RANGE[0]} and ${Config.SEED_LENGTH_RANGE[1]} words.` });
  }
  if (!inRange(values.cardCount, Config.CARD_COUNT_RANGE)) {
    errors.push({ field: 'cardCount', message: `Card count must be between ${Config.CARD_COUNT_RANGE[0]} and ${Config.CARD_COUNT_RANGE[1]}.` });
  }
  if (!inRange(mm(values.cardWidthMm), Config.CARD_WIDTH_RANGE)) {
    errors.push({ field: 'cardWidthMm', message: 'Card width must be between 20 and 180 mm.' });
  }
  if (!inRange(mm(values.cardHeightMm), Config.CARD_HEIGHT_RANGE)) {
    errors.push({ field: 'cardHeightMm', message: 'Card height must be between 20 and 180 mm.' });
  }
  if (values.encoding !== EncodingType.Binary && !inRange(values.cardSplit, Config.CARD_SPLIT_RANGE)) {
    errors.push({ field: 'cardSplit', message: `Card split must be between ${Config.CARD_SPLIT_RANGE[0]} and ${Config.CARD_SPLIT_RANGE[1]}.` });
  }
  if (!inRange(mm(values.cardPaddingMm), Config.CARDS_PADDING_RANGE)) {
    errors.push({ field: 'cardPaddingMm', message: 'Card padding must be between 1 and 5 mm.' });
  }
  if (!inRange(values.copies, Config.WRITER_COPIES_RANGE)) {
    errors.push({ field: 'copies', message: `Copies must be between ${Config.WRITER_COPIES_RANGE[0]} and ${Config.WRITER_COPIES_RANGE[1]}.` });
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

export const DEFAULT_FORM_VALUES: FormValues = {
  seedLength: Config.SEED_LENGTH_DEFAULT,
  cardCount: Config.CARD_COUNT_DEFAULT,
  cardWidthMm: 85.6,
  cardHeightMm: 54,
  cardSplit: Config.CARD_SPLIT_DEFAULT,
  cardPaddingMm: 1.5,
  copies: Config.WRITER_COPIES_DEFAULT,
  encoding: Config.CARDS_ENCODING_DEFAULT,
  binaryDirection: Config.BINARY_DIRECTION_DEFAULT,
};
