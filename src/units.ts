export const PT_PER_MM = 2.834645669291339;

export function mm(value: number): number {
  return value * PT_PER_MM;
}

export function toMm(points: number): number {
  return points / PT_PER_MM;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function size(width: number, height: number): Size {
  return { width, height };
}

export function point(x: number, y: number): Point {
  return { x, y };
}
