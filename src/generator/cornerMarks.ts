import { Point, point } from '../units';
import * as Config from './config';

export function getTopLeftCornerMarkOffsets(count: number): Point[] {
  const offsets: Point[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push(point(Config.CORNER_MARK_INSET + i * Config.CORNER_MARK_PITCH, Config.CORNER_MARK_INSET));
  }
  return offsets;
}

export function getTopRightCornerMarkOffset(): Point {
  return point(-Config.CORNER_MARK_INSET, Config.CORNER_MARK_INSET);
}

export function getBottomLeftCornerMarkOffset(): Point {
  return point(Config.CORNER_MARK_INSET, -Config.CORNER_MARK_INSET);
}

export function physicalCardNumberOf(cardNumber: number): number {
  return Math.ceil(cardNumber / 2);
}

export function sideOf(cardNumber: number): 'A' | 'B' {
  return cardNumber % 2 === 1 ? 'A' : 'B';
}
