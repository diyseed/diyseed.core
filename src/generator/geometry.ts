import { Size, Point, size, point } from '../units';
import * as Config from './config';

export function getCardSafeAreaSize(cardSize: Size): Size {
  return size(cardSize.width + Config.CARD_MARGIN, cardSize.height + Config.CARD_MARGIN);
}

export interface CardOrigin {
  page: number;
  point: Point;
}

export function getOriginForCard(cardNumber: number, safeAreaSize: Size): CardOrigin {
  const cardsPerLine = Math.floor((Config.EFFECTIVE_PAGE_SIZE.width + Config.CARD_MARGIN) / safeAreaSize.width);
  // The bottom strip is kept free for the stencil code drawn below the cards.
  const availableHeight = Config.EFFECTIVE_PAGE_SIZE.height - Config.STENCIL_CODE_RESERVED_HEIGHT;
  const linesPerPage = Math.floor((availableHeight + Config.CARD_MARGIN) / safeAreaSize.height);
  const cardsPerPage = cardsPerLine * linesPerPage;

  const page = Math.floor((cardNumber - 1) / cardsPerPage) + 1;
  const numberOnPage = ((cardNumber - 1) % cardsPerPage) + 1;
  const lineOnPage = Math.floor((numberOnPage - 1) / cardsPerLine) + 1;
  const numberOnLine = ((numberOnPage - 1) % cardsPerLine) + 1;

  const positionX = safeAreaSize.width * (numberOnLine - 1);
  const positionY = safeAreaSize.height * (lineOnPage - 1);

  return { page, point: point(positionX, positionY) };
}
