import { GeneratorParameters, PassphraseParameters } from './params';
import { EncodingType } from './encoding';
import { toMm } from '../units';

// Formats a millimeter value with the fewest decimals needed (54 not 54.0,
// 85.6 not 85.60) so the summary line reads like a person typed it, not like
// a raw float dump.
function formatMm(points: number): string {
  return Number(toMm(points).toFixed(2)).toString();
}

function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const ENCODING_LABEL: Record<EncodingType, string> = {
  [EncodingType.Number]: 'Number',
  [EncodingType.Alphabet]: 'Alphabet',
  [EncodingType.Binary]: 'Binary',
};

export function buildSeedParamsSummary(params: GeneratorParameters): string {
  return [
    pluralize(params.seedLength, 'word'),
    pluralize(params.effectiveCardCount, 'card'),
    `${formatMm(params.cardSize.width)}×${formatMm(params.cardSize.height)}mm`,
    ENCODING_LABEL[params.seedEncoding],
    pluralize(params.copies, 'copy', 'copies'),
  ].join(', ');
}

export function buildPassphraseParamsSummary(params: PassphraseParameters): string {
  return [
    pluralize(params.cardCount, 'card'),
    `${formatMm(params.cardSize.width)}×${formatMm(params.cardSize.height)}mm`,
    `cell ${formatMm(params.cellSize.width)}mm`,
    pluralize(params.copies, 'copy', 'copies'),
  ].join(', ');
}
