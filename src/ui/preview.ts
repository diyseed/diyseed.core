import { GeneratorParameters } from '../generator/params';
import { EncodingType, encodingLayout, BinaryDirection } from '../generator/encoding';
import * as Config from '../generator/config';
import { toMm } from '../units';
import { physicalCardNumberOf, sideOf } from '../generator/cornerMarks';

export interface PreviewWord {
  wordNumber: number;
  shaded: boolean;
}

export interface PreviewSection {
  sectionNumber: number;
  words: PreviewWord[];
}

export interface PreviewCard {
  cardNumber: number;
  cardCount: number;
  physicalCardNumber: number;
  sideLabel: string;
  cardWidthMm: number;
  cardHeightMm: number;
  sections: PreviewSection[];
}

export interface PreviewWarnings {
  cellTooSmall: boolean;
  cellNotSquare: boolean;
  cellSizeInvalid: boolean;
}

export interface PreviewLayout {
  cards: PreviewCard[];
  cellWidthMm: number;
  cellHeightMm: number;
  cellRowLabels: string[];
  isBinary: boolean;
  binaryColumnLabels: string[];
  binaryDirection: BinaryDirection;
  copies: number;
  warnings: PreviewWarnings;
}

export function computePreviewLayout(parameters: GeneratorParameters): PreviewLayout {
  const cardCount = parameters.effectiveCardCount;
  const cards: PreviewCard[] = [];

  for (let cardNumber = 1; cardNumber <= cardCount; cardNumber++) {
    const card = parameters.getCardParameters(cardNumber);
    const physicalCardNumber = physicalCardNumberOf(cardNumber);
    cards.push({
      cardNumber,
      cardCount,
      physicalCardNumber,
      sideLabel: `Card ${physicalCardNumber}, side ${sideOf(cardNumber)}`,
      cardWidthMm: toMm(parameters.cardSize.width),
      cardHeightMm: toMm(parameters.cardSize.height),
      sections: card.sections.map((section) => ({
        sectionNumber: section.number,
        words: section.wordNumbers.map((wordNumber, i) => ({
          wordNumber,
          shaded: (section.number + i) % 2 === 0,
        })),
      })),
    });
  }

  const cellSize = parameters.cellSize;
  const cellWidthMm = toMm(cellSize.width);
  const cellHeightMm = toMm(cellSize.height);

  const cellSizeInvalid =
    !Number.isFinite(cellSize.width) || !Number.isFinite(cellSize.height) || cellSize.width <= 0 || cellSize.height <= 0;

  const cellTooSmall =
    !cellSizeInvalid && (cellSize.width < Config.MIN_CELL_SIZE_MM || cellSize.height < Config.MIN_CELL_SIZE_MM);
  const longer = Math.max(cellSize.width, cellSize.height);
  const shorter = Math.min(cellSize.width, cellSize.height);
  const cellNotSquare = !cellSizeInvalid && longer / shorter > Config.MAX_CELL_ASPECT_RATIO;

  const isBinary = parameters.seedEncoding === EncodingType.Binary;

  return {
    cards,
    cellWidthMm,
    cellHeightMm,
    cellRowLabels: encodingLayout(parameters.seedEncoding, parameters.binaryDirection).cellLabels ?? [],
    isBinary,
    binaryColumnLabels: isBinary ? Config.BINARY_COLUMN_VALUES.map(String) : [],
    binaryDirection: parameters.binaryDirection,
    copies: parameters.copies,
    warnings: { cellTooSmall, cellNotSquare, cellSizeInvalid },
  };
}
