import { describe, it, expect } from 'vitest';
import { layoutNumberedBoxes } from '../src/generator/readerBoxes';
import { size } from '../src/units';

describe('layoutNumberedBoxes', () => {
  it('places all boxes on one row when they fit within maxWidth', () => {
    const boxes = layoutNumberedBoxes(3, 1, size(10, 8), 100);
    expect(boxes).toEqual([
      { number: 1, origin: { x: 0, y: 0 } },
      { number: 2, origin: { x: 10, y: 0 } },
      { number: 3, origin: { x: 20, y: 0 } },
    ]);
  });

  it('wraps to a new row when a box would exceed maxWidth', () => {
    // maxWidth 25 fits floor(25/10) = 2 boxes per row
    const boxes = layoutNumberedBoxes(5, 1, size(10, 8), 25);
    expect(boxes).toEqual([
      { number: 1, origin: { x: 0, y: 0 } },
      { number: 2, origin: { x: 10, y: 0 } },
      { number: 3, origin: { x: 0, y: 8 } },
      { number: 4, origin: { x: 10, y: 8 } },
      { number: 5, origin: { x: 0, y: 16 } },
    ]);
  });

  it('numbers boxes starting from the given startNumber', () => {
    const boxes = layoutNumberedBoxes(2, 42, size(10, 8), 100);
    expect(boxes.map((b) => b.number)).toEqual([42, 43]);
  });

  it('places at least one box per row even when a single box is wider than maxWidth', () => {
    const boxes = layoutNumberedBoxes(2, 1, size(10, 8), 5);
    expect(boxes).toEqual([
      { number: 1, origin: { x: 0, y: 0 } },
      { number: 2, origin: { x: 0, y: 8 } },
    ]);
  });

  it('returns an empty array for count 0', () => {
    expect(layoutNumberedBoxes(0, 1, size(10, 8), 100)).toEqual([]);
  });

  it('spaces boxes apart by the given gap', () => {
    const boxes = layoutNumberedBoxes(3, 1, size(10, 8), 100, { gap: 5 });
    expect(boxes.map((b) => b.origin.x)).toEqual([0, 15, 30]);
  });

  it('honors a fixed perRow count instead of deriving it from maxWidth', () => {
    const boxes = layoutNumberedBoxes(5, 1, size(10, 8), 1000, { perRow: 2 });
    expect(boxes).toEqual([
      { number: 1, origin: { x: 0, y: 0 } },
      { number: 2, origin: { x: 10, y: 0 } },
      { number: 3, origin: { x: 0, y: 8 } },
      { number: 4, origin: { x: 10, y: 8 } },
      { number: 5, origin: { x: 0, y: 16 } },
    ]);
  });

  it('combines a fixed perRow with a gap between boxes', () => {
    const boxes = layoutNumberedBoxes(3, 1, size(10, 8), 1000, { perRow: 2, gap: 4 });
    expect(boxes.map((b) => b.origin)).toEqual([
      { x: 0, y: 0 },
      { x: 14, y: 0 },
      { x: 0, y: 8 },
    ]);
  });

  it('spaces rows apart by the given rowGap', () => {
    const boxes = layoutNumberedBoxes(4, 1, size(10, 8), 1000, { perRow: 2, rowGap: 3 });
    expect(boxes.map((b) => b.origin.y)).toEqual([0, 0, 11, 11]);
  });
});
