import { PassphraseParameters } from '../generator/params';
import * as Config from '../generator/config';
import { cornerMarkInset, getBottomLeftCornerMarkOffset } from '../generator/cornerMarks';
import { Point, Size, point, size } from '../units';
import { ARROW_FOOTPRINT, headerArrowsLeft, headerArrowsTop } from './headers';
import { circle, rowTopMarks } from './marks';
import type { Fill, HeaderLayout, MeshLayout, PassphraseBlockLayout, PassphraseCardLayout, Rect, TextBox } from './types';

// The writer's headerHeight and headerWidth: one strip above the card (column
// numbers) and one left of it (bit values).
export const PASSPHRASE_HEADER_SIZE = Config.BINARY_HEADER_HEIGHT;

// `origin` is where the card's top-left corner sits. The default gives card-local
// coordinates; the writer passes its cardOrigin so every value is computed in the
// same arithmetic order it always used (byte-identical PDFs).
export function layoutPassphraseCard(
  params: PassphraseParameters,
  cardNumber: number,
  startRowNumber: number,
  origin: Point = point(0, 0),
): PassphraseCardLayout {
  const headerSize = PASSPHRASE_HEADER_SIZE;
  const characters = params.getCardCharacters(cardNumber);
  const blockSize = size(params.charsPerBlock * params.cellSize.width, params.blockThickness);

  let blockOrigin = point(origin.x + params.cardPadding, origin.y + params.cardPadding);
  const firstBlockOrigin = blockOrigin;
  let lastBlockOrigin = blockOrigin;

  const columnHeader = layoutColumnHeader(characters[0], origin.y, firstBlockOrigin.x, headerSize, params.cellSize.width);

  const blocks: PassphraseBlockLayout[] = [];
  characters.forEach((positions, blockIndex) => {
    const rowNumber = startRowNumber + blockIndex;
    blocks.push({
      rowNumber,
      origin: blockOrigin,
      size: blockSize,
      meshes: layoutBlockMeshes(positions, params.cellSize, blockOrigin),
      topMarks: rowTopMarks(blockOrigin, blockSize, rowNumber, params.cellSize.width, params.cardPadding),
      rowHeader: layoutRowHeader(Config.PASSPHRASE_COLUMN_VALUES, origin.x, blockOrigin.y, headerSize, params.cellSize.height),
    });
    lastBlockOrigin = blockOrigin;
    blockOrigin = point(blockOrigin.x, blockOrigin.y + blockSize.height + params.cardPadding);
  });

  const bottomLeft = getBottomLeftCornerMarkOffset(cornerMarkInset(params.cardPadding));

  return {
    kind: 'passphrase',
    size: params.cardSize,
    radius: params.cardCornerRadius,
    padding: params.cardPadding,
    cellSize: params.cellSize,
    bounds: {
      x: origin.x - headerSize,
      y: origin.y - headerSize,
      width: params.cardSize.width + headerSize,
      height: params.cardSize.height + headerSize,
    },
    blocks,
    columnHeader,
    bottomLeftMark: circle(point(firstBlockOrigin.x + bottomLeft.x, lastBlockOrigin.y + blockSize.height + bottomLeft.y)),
  };
}

// Same arithmetic as the writer's drawPassphraseBlock + drawPassphraseBitShading
// + drawPassphraseGridLines.
function layoutBlockMeshes(positions: number[], cellSize: Size, blockOrigin: Point): MeshLayout[] {
  const bitCount = Config.PASSPHRASE_COLUMN_VALUES.length;
  const charSize = size(cellSize.width, bitCount * cellSize.height);

  const meshes: MeshLayout[] = [];
  let charOrigin = blockOrigin;
  positions.forEach((position) => {
    const charShaded = position % 2 === 0;
    const outline: Rect = { x: charOrigin.x, y: charOrigin.y, width: charSize.width, height: charSize.height };

    const fills: { rect: Rect; fill: Fill }[] = [];
    if (charShaded) {
      fills.push({ rect: outline, fill: 'shade' });
    }
    const stripe: Fill = charShaded ? 'shade-intersection' : 'shade';
    for (let row = 1; row < bitCount; row += 2) {
      const y = charOrigin.y + cellSize.height * row;
      fills.push({ rect: { x: charOrigin.x, y, width: charSize.width, height: cellSize.height }, fill: stripe });
    }

    const gridLines: [Point, Point][] = [];
    for (let row = 1; row < bitCount; row++) {
      const y = charOrigin.y + cellSize.height * row;
      gridLines.push([point(charOrigin.x, y), point(charOrigin.x + charSize.width, y)]);
    }

    meshes.push({ outline, fills, gridLines, cellLabels: [] });
    charOrigin = point(charOrigin.x + charSize.width, charOrigin.y);
  });
  return meshes;
}

// Same arithmetic as the writer's drawPassphraseColumnHeader: rotated labels,
// then the top arrows.
function layoutColumnHeader(values: number[], cardOriginY: number, blockOriginX: number, headerHeight: number, cellWidth: number): HeaderLayout {
  const textAreaHeight = headerHeight - ARROW_FOOTPRINT;
  const labels: TextBox[] = values.map((value, i) => {
    const colOrigin = point(blockOriginX + cellWidth * i, cardOriginY - headerHeight);
    return {
      text: `${value}`,
      box: { x: colOrigin.x, y: colOrigin.y, width: cellWidth, height: textAreaHeight },
      align: { horizontal: 'center', vertical: 'bottom' },
      rotated: true,
      role: 'header',
    };
  });
  return { labels, arrows: headerArrowsTop(values.length, cardOriginY, blockOriginX, cellWidth) };
}

// Same arithmetic as the writer's drawPassphraseRowHeader: labels, then the
// left arrows.
function layoutRowHeader(values: number[], cardOriginX: number, blockOriginY: number, headerWidth: number, cellHeight: number): HeaderLayout {
  const labels: TextBox[] = values.map((value, i) => ({
    text: `${value}`,
    box: { x: cardOriginX - headerWidth, y: blockOriginY + cellHeight * i, width: headerWidth - ARROW_FOOTPRINT, height: cellHeight },
    align: { horizontal: 'right', vertical: 'center' },
    role: 'header',
  }));
  return { labels, arrows: headerArrowsLeft(values.length, cardOriginX, blockOriginY, cellHeight) };
}
