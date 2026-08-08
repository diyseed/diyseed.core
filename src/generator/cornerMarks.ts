import { Point, point } from '../units';
import * as Config from './config';

export function getTopLeftCornerMarkOffsets(count: number, padding: number): Point[] {
  const y = padding / 2;
  const offsets: Point[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push(point(padding + i * Config.CORNER_MARK_PITCH, y));
  }
  return offsets;
}

export function getTopRightCornerMarkOffset(padding: number): Point {
  return point(-padding, padding / 2);
}

export function physicalCardNumberOf(cardNumber: number): number {
  return Math.ceil(cardNumber / 2);
}

export function sideOf(cardNumber: number): 'A' | 'B' {
  return cardNumber % 2 === 1 ? 'A' : 'B';
}
