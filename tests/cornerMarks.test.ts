import { describe, it, expect } from 'vitest';
import {
  getTopLeftCornerMarkOffsets,
  getTopRightCornerMarkOffset,
  getBottomLeftCornerMarkOffset,
  getCutterGuideSegments,
  physicalCardNumberOf,
  sideOf,
} from '../src/generator/cornerMarks';
import * as Config from '../src/generator/config';
import { mm, size } from '../src/units';

describe('getTopLeftCornerMarkOffsets', () => {
  it('stays flush with the mesh edge in x, and sits 0.5mm above the mesh in y - not diagonal', () => {
    const padding = mm(1.5);
    const pitch = mm(2); // one mesh cell width
    const offsets = getTopLeftCornerMarkOffsets(3, padding, pitch);
    const expectedY = padding - Config.CORNER_MARK_INSET;
    expect(offsets).toHaveLength(3);
    expect(offsets[0]).toEqual({ x: padding, y: expectedY });
    expect(offsets[1].x).toBeCloseTo(padding + pitch, 6);
    expect(offsets[2].x).toBeCloseTo(padding + 2 * pitch, 6);
    for (const offset of offsets) {
      expect(offset.y).toBeCloseTo(expectedY, 6);
    }
  });

  it('returns an empty array for count 0', () => {
    expect(getTopLeftCornerMarkOffsets(0, mm(1.5), mm(2))).toEqual([]);
  });
});

describe('getTopRightCornerMarkOffset', () => {
  it('stays flush with the mesh edge in x, and sits 0.5mm above the mesh in y - not diagonal', () => {
    const padding = mm(1.5);
    const expectedY = padding - Config.CORNER_MARK_INSET;
    expect(getTopRightCornerMarkOffset(padding)).toEqual({ x: -padding, y: expectedY });
  });
});

describe('getBottomLeftCornerMarkOffset', () => {
  it('stays flush with the mesh edge in x, and sits 0.5mm beneath the mesh in y - not diagonal', () => {
    const padding = mm(1.5);
    const expectedY = -(padding - Config.CORNER_MARK_INSET);
    expect(getBottomLeftCornerMarkOffset(padding)).toEqual({ x: padding, y: expectedY });
  });
});

describe('getCutterGuideSegments', () => {
  const cardSize = size(mm(85.6), mm(54));

  it('returns 8 segments: two ticks per corner, for all 4 corners', () => {
    const segments = getCutterGuideSegments(cardSize);
    expect(segments).toHaveLength(8);
  });

  it('draws the top-left ticks starting a gap outside the corner, running away from the card', () => {
    const segments = getCutterGuideSegments(cardSize);
    const gap = Config.CUTTER_GUIDE_GAP;
    const length = Config.CUTTER_GUIDE_LENGTH;

    // Horizontal tick: sits on y=0 (flush with the top edge), running left
    // from (0 - gap) to (0 - gap - length) - outside the card, not touching it.
    expect(segments).toContainEqual({ from: { x: -gap, y: 0 }, to: { x: -gap - length, y: 0 } });

    // Vertical tick: sits on x=0 (flush with the left edge), running up
    // from (0, -gap) to (0, -gap - length).
    expect(segments).toContainEqual({ from: { x: 0, y: -gap }, to: { x: 0, y: -gap - length } });
  });

  it('draws the bottom-right ticks starting a gap outside the corner, running away from the card', () => {
    const segments = getCutterGuideSegments(cardSize);
    const gap = Config.CUTTER_GUIDE_GAP;
    const length = Config.CUTTER_GUIDE_LENGTH;
    const { width, height } = cardSize;

    expect(segments).toContainEqual({
      from: { x: width + gap, y: height },
      to: { x: width + gap + length, y: height },
    });
    expect(segments).toContainEqual({
      from: { x: width, y: height + gap },
      to: { x: width, y: height + gap + length },
    });
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
