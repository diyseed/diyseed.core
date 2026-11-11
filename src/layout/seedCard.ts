import { CardParameters, CardSectionParameters } from '../generator/params';
import { EncodingType, encodingLayout } from '../generator/encoding';
import * as Config from '../generator/config';
import { cornerMarkInset, getBottomLeftCornerMarkOffset } from '../generator/cornerMarks';
import { Point, Size, point } from '../units';
import { ARROW_FOOTPRINT, headerArrowsLeft } from './headers';
import { circle, rowTopMarks } from './marks';
import type { Fill, HeaderLayout, MeshLayout, Rect, SeedCardLayout, SeedSectionLayout, TextBox } from './types';

// The left header strip the writer reserves for a Binary card's bit labels.
export const SEED_BINARY_HEADER_WIDTH = Config.BINARY_HEADER_HEIGHT;

function rect(origin: Point, s: Size): Rect {
  return { x: origin.x, y: origin.y, width: s.width, height: s.height };
}

// `origin` is where the card's top-left corner sits. The default gives card-local
// coordinates; the writer passes its cardOrigin so every value is computed in the
// same arithmetic order it always used (byte-identical PDFs).
export function layoutSeedCard(card: CardParameters, encoding: EncodingType, origin: Point = point(0, 0)): SeedCardLayout {
  const isBinary = encoding === EncodingType.Binary;
  const headerWidth = isBinary ? SEED_BINARY_HEADER_WIDTH : 0;

  const sections: SeedSectionLayout[] = [];
  let sectionOrigin = point(origin.x + card.padding, origin.y + card.padding);
  for (const section of card.sections) {
    sections.push(layoutSection(section, sectionOrigin, card.padding, encoding));
    sectionOrigin = point(sectionOrigin.x, sectionOrigin.y + section.size.height + card.padding);
  }

  const bottomLeft = getBottomLeftCornerMarkOffset(cornerMarkInset(card.padding));

  return {
    kind: 'seed',
    size: card.size,
    radius: card.radius,
    padding: card.padding,
    cellSize: card.cellSize,
    bounds: { x: origin.x - headerWidth, y: origin.y, width: card.size.width + headerWidth, height: card.size.height },
    sections,
    bottomLeftMark: circle(point(origin.x + card.padding + bottomLeft.x, origin.y + card.size.height - card.padding + bottomLeft.y)),
    rowHeader: isBinary ? layoutBinaryRowHeader(origin, card.size.height, card.padding, headerWidth) : null,
  };
}

function layoutSection(section: CardSectionParameters, origin: Point, padding: number, encoding: EncodingType): SeedSectionLayout {
  const meshes: MeshLayout[] = [];
  const wordNumbers: TextBox[] = [];

  let wordOrigin = origin;
  section.wordNumbers.forEach((wordNumber, i) => {
    const wordShaded = (section.number + i) % 2 === 0;
    meshes.push(layoutWordMesh(wordOrigin, section.wordSize, section.cellSize, encoding, wordShaded));
    wordNumbers.push({
      text: `${wordNumber}`,
      box: {
        x: wordOrigin.x,
        y: wordOrigin.y + Config.WORD_NR_TOP_GAP,
        width: section.wordSize.width,
        height: section.wordSize.height - Config.WORD_NR_TOP_GAP,
      },
      align: { horizontal: 'center', vertical: 'top' },
      role: 'word-number',
    });
    wordOrigin = point(wordOrigin.x + section.wordSize.width, wordOrigin.y);
  });

  return {
    number: section.number,
    origin,
    size: section.size,
    meshes,
    wordNumbers,
    topMarks: rowTopMarks(origin, section.size, section.number, section.cellSize.width, padding),
  };
}

function layoutWordMesh(origin: Point, wordSize: Size, cellSize: Size, encoding: EncodingType, wordShaded: boolean): MeshLayout {
  const layout = encodingLayout(encoding);
  const outline = rect(origin, wordSize);

  const fills: { rect: Rect; fill: Fill }[] = [];
  if (wordShaded) {
    fills.push({ rect: outline, fill: 'shade' });
  }
  if (encoding === EncodingType.Binary) {
    const fill: Fill = wordShaded ? 'shade-intersection' : 'shade';
    for (let row = 1; row < layout.rows; row += 2) {
      const y = origin.y + cellSize.height * row;
      fills.push({ rect: { x: origin.x, y, width: wordSize.width, height: cellSize.height }, fill });
    }
  }

  const gridLines: [Point, Point][] = [];
  for (let row = 1; row < layout.rows; row++) {
    const y = origin.y + cellSize.height * row;
    gridLines.push([point(origin.x, y), point(origin.x + wordSize.width, y)]);
  }
  for (let col = 1; col < layout.cols; col++) {
    const x = origin.x + cellSize.width * col;
    gridLines.push([point(x, origin.y), point(x, origin.y + wordSize.height)]);
  }

  const cellLabels: TextBox[] = [];
  if (layout.cellLabels) {
    for (let row = 0; row < layout.rows; row++) {
      const text = layout.cellLabels[row];
      for (let col = 0; col < layout.cols; col++) {
        cellLabels.push({
          text,
          box: rect(point(origin.x + cellSize.width * col, origin.y + cellSize.height * row), cellSize),
          align: { horizontal: 'center', vertical: 'center' },
          role: 'cell-label',
        });
      }
    }
  }

  return { outline, fills, gridLines, cellLabels };
}

// Same arithmetic as the writer's drawBinaryRowHeader + drawHeaderArrowsLeft,
// with cardOrigin replaced by origin.
function layoutBinaryRowHeader(origin: Point, cardHeight: number, cardPadding: number, headerWidth: number): HeaderLayout {
  const gridHeight = cardHeight - 2 * cardPadding;
  const rowHeight = gridHeight / Config.BINARY_COLUMN_VALUES.length;
  const labels: TextBox[] = Config.BINARY_COLUMN_VALUES.map((value, i) => ({
    text: `${value}`,
    box: { x: origin.x - headerWidth, y: origin.y + cardPadding + rowHeight * i, width: headerWidth - ARROW_FOOTPRINT, height: rowHeight },
    align: { horizontal: 'right', vertical: 'center' },
    role: 'header',
  }));
  return { labels, arrows: headerArrowsLeft(Config.BINARY_COLUMN_VALUES.length, origin.x, origin.y + cardPadding, rowHeight) };
}
