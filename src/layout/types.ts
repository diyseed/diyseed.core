import type { Point, Size } from '../units';

// All coordinates are PDF points, top-left origin, relative to the `origin`
// passed to the layout function (card-local with the default origin: the card's
// own top-left corner is (0, 0)). Headers drawn outside the card get negative
// coordinates with the default origin.

export type Rect = { x: number; y: number; width: number; height: number };

export type Circle = { cx: number; cy: number; r: number };

export type Triangle = [Point, Point, Point];

export type Fill = 'shade' | 'shade-intersection';

// For rotated text (reads bottom-to-top), `vertical` still refers to the box's
// own top/bottom edges: 'bottom' is the writer's 'end' anchor.
export type TextBox = {
  text: string;
  box: Rect;
  align: { horizontal: 'left' | 'center' | 'right'; vertical: 'top' | 'center' | 'bottom' };
  rotated?: boolean;
  role: 'word-number' | 'cell-label' | 'header';
};

export interface HeaderLayout {
  labels: TextBox[];
  arrows: Triangle[];
}

// One per word (seed) or passphrase character column. `fills` are in draw order.
export interface MeshLayout {
  outline: Rect;
  fills: { rect: Rect; fill: Fill }[];
  gridLines: [Point, Point][];
  cellLabels: TextBox[];
}

export interface CardLayoutBase {
  size: Size;
  radius: number;
  padding: number;
  cellSize: Size;
  bounds: Rect; // card plus headers
}

export interface SeedSectionLayout {
  number: number;
  origin: Point;
  size: Size;
  meshes: MeshLayout[];
  wordNumbers: TextBox[];
  // Top-left cluster (count = section number), then the single top-right mark.
  topMarks: Circle[];
}

export interface SeedCardLayout extends CardLayoutBase {
  kind: 'seed';
  sections: SeedSectionLayout[];
  bottomLeftMark: Circle;
  rowHeader: HeaderLayout | null;
}

export interface PassphraseBlockLayout {
  rowNumber: number;
  origin: Point;
  size: Size;
  meshes: MeshLayout[];
  // Top-left cluster (count = row number), then the single top-right mark.
  topMarks: Circle[];
  rowHeader: HeaderLayout;
}

export interface PassphraseCardLayout extends CardLayoutBase {
  kind: 'passphrase';
  blocks: PassphraseBlockLayout[];
  columnHeader: HeaderLayout;
  bottomLeftMark: Circle;
}
