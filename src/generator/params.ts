import { Size, size } from '../units';
import { EncodingType, encodingLayout, BinaryDirection } from './encoding';
import * as Config from './config';

export interface GeneratorParametersInput {
  cardSize: Size;
  cardCount: number;
  seedLength: number;
  cardSplit?: number;
  encoding?: EncodingType;
  binaryDirection?: BinaryDirection;
  copies?: number;
  cardCornerRadius?: number;
  cardPadding?: number;
}

function checkRange(value: number, range: [number, number], name: string): void {
  if (value < range[0] || value > range[1]) {
    throw new RangeError(`${name}=${value} out of range [${range[0]}-${range[1]}]`);
  }
}

export class GeneratorParameters {
  readonly seedLength: number;
  readonly cardCount: number;
  readonly cardSize: Size;
  readonly cardCornerRadius: number;
  readonly cardPadding: number;
  readonly cardSplit: number;
  readonly seedEncoding: EncodingType;
  readonly binaryDirection: BinaryDirection;
  readonly copies: number;

  constructor(input: GeneratorParametersInput) {
    checkRange(input.cardCount, Config.CARD_COUNT_RANGE, 'cardCount');
    checkRange(input.seedLength, Config.SEED_LENGTH_RANGE, 'seedLength');
    checkRange(input.cardSize.width, Config.CARD_WIDTH_RANGE, 'cardSize.width');
    checkRange(input.cardSize.height, Config.CARD_HEIGHT_RANGE, 'cardSize.height');

    const encoding = input.encoding ?? Config.CARDS_ENCODING_DEFAULT;
    const binaryDirection = input.binaryDirection ?? Config.BINARY_DIRECTION_DEFAULT;
    const copies = input.copies ?? Config.WRITER_COPIES_DEFAULT;
    checkRange(copies, Config.WRITER_COPIES_RANGE, 'copies');

    let cardSplit: number;
    if (encoding === EncodingType.Binary && binaryDirection === 'vertical') {
      // Vertical lays out exactly one word per row, so the split is however
      // many rows are needed to fit the seed across the requested card count -
      // not a user-configurable value like it is for the other encodings.
      cardSplit = Math.ceil(input.seedLength / input.cardCount);
    } else if (encoding === EncodingType.Binary) {
      // Horizontal lays words out side-by-side as columns spanning the card's
      // full height in one go, so there's always exactly one section per card.
      cardSplit = 1;
    } else {
      cardSplit = input.cardSplit ?? Config.CARD_SPLIT_DEFAULT;
      checkRange(cardSplit, Config.CARD_SPLIT_RANGE, 'cardSplit');
    }

    const cardCornerRadius = input.cardCornerRadius ?? Config.CARDS_RADIUS_DEFAULT;
    const cardPadding = input.cardPadding ?? Config.CARDS_PADDING_DEFAULT;
    checkRange(cardCornerRadius, Config.CARDS_RADIUS_RANGE, 'cardCornerRadius');
    checkRange(cardPadding, Config.CARDS_PADDING_RANGE, 'cardPadding');

    this.seedLength = input.seedLength;
    this.cardCount = input.cardCount;
    this.cardSize = input.cardSize;
    this.cardSplit = cardSplit;
    this.seedEncoding = encoding;
    this.binaryDirection = binaryDirection;
    this.copies = copies;
    this.cardCornerRadius = cardCornerRadius;
    this.cardPadding = cardPadding;
  }

  get gridSize(): Size {
    return size(this.cardSize.width - 2 * this.cardPadding, this.cardSize.height - 2 * this.cardPadding);
  }

  get sectionSize(): Size {
    return size(this.gridSize.width, this.gridSize.height / this.cardSplit);
  }

  get wordSize(): Size {
    return size(this.sectionSize.width / this.maxWordsPerSection, this.sectionSize.height);
  }

  get cellSize(): Size {
    const layout = encodingLayout(this.seedEncoding, this.binaryDirection);
    return size(this.wordSize.width / layout.cols, this.wordSize.height / layout.rows);
  }

  get totalSectionCount(): number {
    return this.cardCount * this.cardSplit;
  }

  get maxWordsPerSection(): number {
    return this.seedLength % this.totalSectionCount === 0
      ? this.seedLength / this.totalSectionCount
      : Math.floor(this.seedLength / this.totalSectionCount) + 1;
  }

  get maxWordsPerCard(): number {
    return this.maxWordsPerSection * this.cardSplit;
  }

  get effectiveCardCount(): number {
    const emptyWordsPositions = this.cardCount * this.maxWordsPerCard - this.seedLength;
    return this.cardCount - Math.floor(emptyWordsPositions / this.maxWordsPerCard);
  }

  getCardParameters(cardNumber: number): CardParameters {
    if (cardNumber < 1 || cardNumber > this.effectiveCardCount) {
      throw new RangeError(`cardNumber ${cardNumber} out of range [1-${this.effectiveCardCount}]`);
    }

    const firstSectionNr = (cardNumber - 1) * this.cardSplit + 1;
    const lastSectionNr = firstSectionNr + this.cardSplit - 1;
    const sections: CardSectionParameters[] = [];
    let wasLastSection = false;

    for (let sectionNr = firstSectionNr; sectionNr <= lastSectionNr && !wasLastSection; sectionNr++) {
      const firstWordNr = (sectionNr - 1) * this.maxWordsPerSection + 1;
      let lastWordNr = firstWordNr + this.maxWordsPerSection - 1;
      if (lastWordNr > this.seedLength) {
        lastWordNr = this.seedLength;
        wasLastSection = true;
      }
      const wordNumbers: number[] = [];
      for (let w = firstWordNr; w <= lastWordNr; w++) wordNumbers.push(w);
      sections.push(new CardSectionParameters(this, sectionNr, wordNumbers));
    }

    return new CardParameters(this, cardNumber, sections);
  }
}

export class CardParameters {
  constructor(
    private readonly parent: GeneratorParameters,
    readonly number: number,
    readonly sections: CardSectionParameters[],
  ) {}

  get size(): Size {
    return this.parent.cardSize;
  }

  get radius(): number {
    return this.parent.cardCornerRadius;
  }

  get padding(): number {
    return this.parent.cardPadding;
  }

  get wordsCount(): number {
    return this.sections.reduce((sum, s) => sum + s.wordNumbers.length, 0);
  }
}

export class CardSectionParameters {
  constructor(
    private readonly parent: GeneratorParameters,
    readonly number: number,
    readonly wordNumbers: number[],
  ) {}

  get encoding(): EncodingType {
    return this.parent.seedEncoding;
  }

  get binaryDirection(): BinaryDirection {
    return this.parent.binaryDirection;
  }

  get cellSize(): Size {
    return this.parent.cellSize;
  }

  get wordSize(): Size {
    return this.parent.wordSize;
  }

  get size(): Size {
    return this.parent.sectionSize;
  }
}

export interface PassphraseParametersInput {
  cardSize: Size;
  cardPadding: number;
  cardCornerRadius: number;
  cardCount: number;
  binaryDirection: BinaryDirection;
  copies: number;
  cellSize: Size;
}

export class PassphraseParameters {
  readonly cardSize: Size;
  readonly cardPadding: number;
  readonly cardCornerRadius: number;
  readonly cardCount: number;
  readonly binaryDirection: BinaryDirection;
  readonly copies: number;
  readonly cellSize: Size;

  constructor(input: PassphraseParametersInput) {
    checkRange(input.cardCount, Config.CARD_COUNT_RANGE, 'cardCount');
    checkRange(input.cardSize.width, Config.CARD_WIDTH_RANGE, 'cardSize.width');
    checkRange(input.cardSize.height, Config.CARD_HEIGHT_RANGE, 'cardSize.height');
    checkRange(input.cardCornerRadius, Config.CARDS_RADIUS_RANGE, 'cardCornerRadius');
    checkRange(input.cardPadding, Config.CARDS_PADDING_RANGE, 'cardPadding');
    checkRange(input.copies, Config.WRITER_COPIES_RANGE, 'copies');
    if (input.cellSize.width <= 0 || input.cellSize.height <= 0) {
      throw new RangeError(`cellSize must be positive, got ${input.cellSize.width}x${input.cellSize.height}`);
    }

    this.cardSize = input.cardSize;
    this.cardPadding = input.cardPadding;
    this.cardCornerRadius = input.cardCornerRadius;
    this.cardCount = input.cardCount;
    this.binaryDirection = input.binaryDirection;
    this.copies = input.copies;
    this.cellSize = input.cellSize;
  }

  get gridSize(): Size {
    return size(this.cardSize.width - 2 * this.cardPadding, this.cardSize.height - 2 * this.cardPadding);
  }

  get charsPerBlock(): number {
    return this.binaryDirection === 'horizontal'
      ? Math.floor(this.gridSize.width / this.cellSize.width)
      : Math.floor(this.gridSize.height / this.cellSize.height);
  }

  get blockThickness(): number {
    const bitCount = Config.PASSPHRASE_COLUMN_VALUES.length;
    return this.binaryDirection === 'horizontal' ? bitCount * this.cellSize.height : bitCount * this.cellSize.width;
  }

  get blockCount(): 1 | 2 {
    const farAxis = this.binaryDirection === 'horizontal' ? this.gridSize.height : this.gridSize.width;
    return farAxis >= 2 * this.blockThickness + this.cardPadding ? 2 : 1;
  }

  get capacityPerCard(): number {
    return this.charsPerBlock * this.blockCount;
  }

  get totalCapacity(): number {
    return this.capacityPerCard * this.cardCount;
  }

  getCardCharacters(cardNumber: number): number[][] {
    if (cardNumber < 1 || cardNumber > this.cardCount) {
      throw new RangeError(`cardNumber ${cardNumber} out of range [1-${this.cardCount}]`);
    }
    const first = (cardNumber - 1) * this.capacityPerCard + 1;
    const blocks: number[][] = [];
    for (let b = 0; b < this.blockCount; b++) {
      const blockStart = first + b * this.charsPerBlock;
      blocks.push(Array.from({ length: this.charsPerBlock }, (_, i) => blockStart + i));
    }
    return blocks;
  }
}
