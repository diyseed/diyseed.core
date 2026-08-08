import { describe, it, expect } from 'vitest';
import {
  getTopLeftCornerMarkOffsets,
  getTopRightCornerMarkOffset,
  physicalCardNumberOf,
  sideOf,
} from '../src/generator/cornerMarks';
import * as Config from '../src/generator/config';
import { mm } from '../src/units';

describe('getTopLeftCornerMarkOffsets', () => {
  it('starts at x = padding (aligned with the grid start) and y = padding/2 (centered in the padding band)', () => {
    const padding = mm(2);
    const offsets = getTopLeftCornerMarkOffsets(3, padding);
    expect(offsets).toHaveLength(3);
    expect(offsets[0]).toEqual({ x: padding, y: padding / 2 });
    expect(offsets[1].x).toBeCloseTo(padding + Config.CORNER_MARK_PITCH, 6);
    expect(offsets[2].x).toBeCloseTo(padding + 2 * Config.CORNER_MARK_PITCH, 6);
    for (const offset of offsets) {
      expect(offset.y).toBeCloseTo(padding / 2, 6);
    }
  });

  it('returns an empty array for count 0', () => {
    expect(getTopLeftCornerMarkOffsets(0, mm(1.5))).toEqual([]);
  });
});

describe('getTopRightCornerMarkOffset', () => {
  it('sits at x = -padding (aligned with the grid end) and y = padding/2 (centered in the padding band)', () => {
    const padding = mm(2);
    expect(getTopRightCornerMarkOffset(padding)).toEqual({ x: -padding, y: padding / 2 });
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
