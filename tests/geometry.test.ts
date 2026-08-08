import { describe, it, expect } from 'vitest';
import { getCardSafeAreaSize, getOriginForCard } from '../src/generator/geometry';
import { mm } from '../src/units';
import * as Config from '../src/generator/config';

describe('getCardSafeAreaSize', () => {
  it('pads the card size by CARD_MARGIN on each dimension', () => {
    const safeArea = getCardSafeAreaSize({ width: mm(100), height: mm(60) });
    expect(safeArea.width).toBeCloseTo(mm(100) + Config.CARD_MARGIN, 6);
    expect(safeArea.height).toBeCloseTo(mm(60) + Config.CARD_MARGIN, 6);
  });
});

describe('getOriginForCard — 100x60mm cards (sample #1)', () => {
  // EFFECTIVE_PAGE_SIZE is 180x267mm; safe area is 104x64mm.
  // cardsPerLine = floor((180+4)/104) = 1, linesPerPage = floor((267+4)/64) = 4 -> 4 cards/page.
  const safeArea = getCardSafeAreaSize({ width: mm(100), height: mm(60) });

  it('places card 1 at the page origin', () => {
    const origin = getOriginForCard(1, safeArea);
    expect(origin.page).toBe(1);
    expect(origin.point.x).toBeCloseTo(0, 6);
    expect(origin.point.y).toBeCloseTo(0, 6);
  });

  it('places card 2 directly below card 1 on the same page (only 1 fits per line)', () => {
    const origin = getOriginForCard(2, safeArea);
    expect(origin.page).toBe(1);
    expect(origin.point.x).toBeCloseTo(0, 6);
    expect(origin.point.y).toBeCloseTo(safeArea.height, 6);
  });

  it('places card 5 on page 2 (4 cards/page)', () => {
    const origin = getOriginForCard(5, safeArea);
    expect(origin.page).toBe(2);
    expect(origin.point.x).toBeCloseTo(0, 6);
    expect(origin.point.y).toBeCloseTo(0, 6);
  });
});

describe('getOriginForCard — 20x20mm cards (sample #3)', () => {
  // safe area is 24x24mm. cardsPerLine = floor((180+4)/24) = 7, linesPerPage = floor((267+4)/24) = 11 -> 77 cards/page.
  const safeArea = getCardSafeAreaSize({ width: mm(20), height: mm(20) });

  it('places card 8 at the start of the second line', () => {
    const origin = getOriginForCard(8, safeArea);
    expect(origin.page).toBe(1);
    expect(origin.point.x).toBeCloseTo(0, 6);
    expect(origin.point.y).toBeCloseTo(safeArea.height, 6);
  });
});
