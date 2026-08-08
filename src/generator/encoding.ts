export enum EncodingType {
  Number = 10, // 10 rows: digits 0-9
  Alphabet = 26, // 26 rows: letters a-z
  Binary = 11, // 11 bit-places: 1024 down to 1 (covers BIP-39 index range 0-2047)
}

// Binary only: 'horizontal' (default) lays words out side-by-side as columns,
// each column stacking the 11 bit-places vertically. 'vertical' lays words out
// stacked as rows, each row spreading the 11 bit-places horizontally.
export type BinaryDirection = 'horizontal' | 'vertical';

export interface EncodingLayout {
  rows: number;
  cols: number;
  cellLabels: string[] | null; // null => cells stay blank (Binary: no printed character, just the punch grid)
}

function charLabels(startChar: string, count: number): string[] {
  const startCode = startChar.charCodeAt(0);
  return Array.from({ length: count }, (_, i) => String.fromCharCode(startCode + i));
}

export function encodingLayout(encoding: EncodingType, binaryDirection: BinaryDirection = 'horizontal'): EncodingLayout {
  switch (encoding) {
    case EncodingType.Alphabet:
      return { rows: 26, cols: 4, cellLabels: charLabels('a', 26) };
    case EncodingType.Number:
      return { rows: 10, cols: 4, cellLabels: charLabels('0', 10) };
    case EncodingType.Binary:
      return binaryDirection === 'vertical' ? { rows: 1, cols: 11, cellLabels: null } : { rows: 11, cols: 1, cellLabels: null };
  }
}
