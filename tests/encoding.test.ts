import { describe, it, expect } from 'vitest';
import { EncodingType, encodingLayout } from '../src/generator/encoding';

describe('encodingLayout', () => {
  it('lays out Alphabet as 26 rows x 4 columns with a-z cell labels', () => {
    const layout = encodingLayout(EncodingType.Alphabet);
    expect(layout.rows).toBe(26);
    expect(layout.cols).toBe(4);
    expect(layout.cellLabels).toHaveLength(26);
    expect(layout.cellLabels?.[0]).toBe('a');
    expect(layout.cellLabels?.[25]).toBe('z');
  });

  it('lays out Number as 10 rows x 4 columns with 0-9 cell labels', () => {
    const layout = encodingLayout(EncodingType.Number);
    expect(layout.rows).toBe(10);
    expect(layout.cols).toBe(4);
    expect(layout.cellLabels).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('lays out Binary as 11 rows (bit-places) x 1 column (word) with no cell labels', () => {
    const layout = encodingLayout(EncodingType.Binary);
    expect(layout.rows).toBe(11);
    expect(layout.cols).toBe(1);
    expect(layout.cellLabels).toBeNull();
  });
});
