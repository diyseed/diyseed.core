import { describe, it, expect } from 'vitest';
import {
  getTopLeftCornerMarkOffsets,
  getTopRightCornerMarkOffset,
  getBottomLeftCornerMarkOffset,
  physicalCardNumberOf,
  sideOf,
} from '../src/generator/cornerMarks';
import * as Config from '../src/generator/config';

describe('getTopLeftCornerMarkOffsets', () => {
  it('starts at a fixed 0.5mm inset from the corner, independent of card padding', () => {
    const offsets = getTopLeftCornerMarkOffsets(3);
    expect(offsets).toHaveLength(3);
    expect(offsets[0]).toEqual({ x: Config.CORNER_MARK_INSET, y: Config.CORNER_MARK_INSET });
    expect(offsets[1].x).toBeCloseTo(Config.CORNER_MARK_INSET + Config.CORNER_MARK_PITCH, 6);
    expect(offsets[2].x).toBeCloseTo(Config.CORNER_MARK_INSET + 2 * Config.CORNER_MARK_PITCH, 6);
    for (const offset of offsets) {
      expect(offset.y).toBeCloseTo(Config.CORNER_MARK_INSET, 6);
    }
  });

  it('returns an empty array for count 0', () => {
    expect(getTopLeftCornerMarkOffsets(0)).toEqual([]);
  });
});

describe('getTopRightCornerMarkOffset', () => {
  it('sits at a fixed 0.5mm inset from the top-right corner, independent of card padding', () => {
    expect(getTopRightCornerMarkOffset()).toEqual({ x: -Config.CORNER_MARK_INSET, y: Config.CORNER_MARK_INSET });
  });
});

describe('getBottomLeftCornerMarkOffset', () => {
  it('sits at a fixed 0.5mm inset from the bottom-left corner, independent of card padding', () => {
    expect(getBottomLeftCornerMarkOffset()).toEqual({ x: Config.CORNER_MARK_INSET, y: -Config.CORNER_MARK_INSET });
  });
});

describe('physicalCardNumberOf', () => {
  it('pairs consecutive card numbers into one physical card', () => {
    expect(physicalCardNumberOf(1)).toBe(1);
    expect(physicalCardNumberOf(2)).toBe(1);
    expect(physicalCardNumberOf(3)).toBe(2);
    expect(physicalCardNumberOf(4)).toBe(2);
    expect(physicalCardNumberOf(5)).toBe(3);
  });
});

describe('sideOf', () => {
  it('alternates A/B starting with A on odd card numbers', () => {
    expect(sideOf(1)).toBe('A');
    expect(sideOf(2)).toBe('B');
    expect(sideOf(3)).toBe('A');
    expect(sideOf(4)).toBe('B');
  });
});
