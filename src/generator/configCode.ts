import { GeneratorParameters, PassphraseParameters } from './params';
import { EncodingType } from './encoding';
import * as Config from './config';
import { mm, toMm } from '../units';

// A short, human-readable code printed on every stencil card, so a punched
// card's settings can be recovered later without remembering the form.
// Every field is plain decimal digits, grouped by dashes:
//   seed:       F-WWWW-HHHH-PP-LL-SS-R-E   (F = 1)
//   passphrase: F-WWWW-HHHH-PP-CCC         (F = 2)
// F = format id (stencil type + layout version), WWWW/HHHH = card size in
// 0.1mm, PP = padding in 0.1mm, LL = seed length, SS = card count, R = rows
// per card, E = encoding digit, CCC = passphrase cell size in 0.1mm. Every
// card of a set carries the same code; the corner marks already tell the
// cards apart.
// The format id alone decides how the rest is read, so never change what an
// existing id means - add a new id instead. Old cards then keep producing the
// stencil they were punched from even if the generator changes later.
export const SEED_CODE_FORMAT = 1;
export const PASSPHRASE_CODE_FORMAT = 2;

const ENCODING_DIGIT: Record<EncodingType, number> = {
  [EncodingType.Alphabet]: 1,
  [EncodingType.Number]: 2,
  [EncodingType.Binary]: 3,
};
const ENCODINGS = [EncodingType.Alphabet, EncodingType.Number, EncodingType.Binary];

export class ConfigCodeError extends Error {}

export type DecodedConfigCode =
  | { kind: 'seed'; parameters: GeneratorParameters }
  | { kind: 'passphrase'; parameters: PassphraseParameters };

interface CodeFormat {
  label: string;
  groupLengths: number[];
  decode(code: string, fields: number[]): DecodedConfigCode;
}

function tenths(points: number): number {
  return Math.round(toMm(points) * 10);
}

function fromTenths(value: number): number {
  return mm(value / 10);
}

function formatGroups(values: number[], lengths: number[]): string {
  return values.map((value, i) => String(value).padStart(lengths[i], '0')).join('-');
}

const SEED_GROUP_LENGTHS = [1, 4, 4, 2, 2, 2, 1, 1];
const PASSPHRASE_GROUP_LENGTHS = [1, 4, 4, 2, 3];

const FORMATS: Record<number, CodeFormat> = {
  [SEED_CODE_FORMAT]: {
    label: 'seed',
    groupLengths: SEED_GROUP_LENGTHS,
    decode(code, [, width, height, padding, seedLength, cardCount, cardSplit, encodingDigit]) {
      const encoding = ENCODINGS.find((candidate) => ENCODING_DIGIT[candidate] === encodingDigit);
      if (encoding === undefined) {
        throw new ConfigCodeError(`"${code}" has an unknown encoding digit ${encodingDigit}.`);
      }
      const parameters = new GeneratorParameters({
        cardSize: { width: fromTenths(width), height: fromTenths(height) },
        cardPadding: fromTenths(padding),
        seedLength,
        cardCount,
        cardSplit,
        encoding,
      });
      return { kind: 'seed', parameters };
    },
  },
  [PASSPHRASE_CODE_FORMAT]: {
    label: 'passphrase',
    groupLengths: PASSPHRASE_GROUP_LENGTHS,
    decode(_, [, width, height, padding, cellSize]) {
      const cell = fromTenths(cellSize);
      const parameters = new PassphraseParameters({
        cardSize: { width: fromTenths(width), height: fromTenths(height) },
        cardPadding: fromTenths(padding),
        cardCornerRadius: Config.CARDS_RADIUS_DEFAULT,
        cardCount: 1,
        copies: 1,
        cellSize: { width: cell, height: cell },
      });
      return { kind: 'passphrase', parameters };
    },
  },
};

export function encodeSeedConfigCode(params: GeneratorParameters): string {
  return formatGroups(
    [
      SEED_CODE_FORMAT,
      tenths(params.cardSize.width),
      tenths(params.cardSize.height),
      tenths(params.cardPadding),
      params.seedLength,
      params.cardCount,
      params.cardSplit,
      ENCODING_DIGIT[params.seedEncoding],
    ],
    SEED_GROUP_LENGTHS,
  );
}

export function encodePassphraseConfigCode(params: PassphraseParameters): string {
  return formatGroups(
    [
      PASSPHRASE_CODE_FORMAT,
      tenths(params.cardSize.width),
      tenths(params.cardSize.height),
      tenths(params.cardPadding),
      tenths(params.cellSize.width),
    ],
    PASSPHRASE_GROUP_LENGTHS,
  );
}

export function decodeConfigCode(code: string): DecodedConfigCode {
  const groups = code.trim().split(/\s*-\s*/);
  if (groups.some((group) => !/^\d+$/.test(group))) {
    throw new ConfigCodeError(`"${code}" is not a card code: use digits separated by dashes.`);
  }

  const formatId = Number(groups[0]);
  const format = groups[0].length === 1 ? FORMATS[formatId] : undefined;
  if (!format) {
    throw new ConfigCodeError(`"${code}" starts with ${groups[0]}, which isn't a card code type this generator knows.`);
  }

  const lengths = format.groupLengths;
  if (groups.length !== lengths.length || groups.some((group, i) => group.length !== lengths[i])) {
    const pattern = formatGroups(lengths.map((_, i) => (i === 0 ? formatId : 0)), lengths);
    throw new ConfigCodeError(`"${code}" doesn't match the ${format.label} code layout ${pattern}.`);
  }

  try {
    return format.decode(code, groups.map(Number));
  } catch (error) {
    if (error instanceof RangeError) {
      throw new ConfigCodeError(`"${code}" has a value out of range (${error.message}).`);
    }
    throw error;
  }
}
