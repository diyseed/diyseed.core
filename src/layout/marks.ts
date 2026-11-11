import * as Config from '../generator/config';
import {
  cornerMarkInset,
  getTopLeftCornerMarkOffsets,
  getTopLeftCornerMarkPitch,
  getTopRightCornerMarkOffset,
} from '../generator/cornerMarks';
import { Point, Size, point } from '../units';
import type { Circle } from './types';

export function circle(center: Point): Circle {
  return { cx: center.x, cy: center.y, r: Config.CORNER_MARK_RADIUS };
}

// Same arithmetic as the writer's drawRowTopMarks: top-left cluster first,
// then the single top-right mark.
export function rowTopMarks(rowOrigin: Point, rowSize: Size, rowNumber: number, pitch: number, padding: number): Circle[] {
  const inset = cornerMarkInset(padding);
  const marks = getTopLeftCornerMarkOffsets(rowNumber, inset, getTopLeftCornerMarkPitch(rowNumber, pitch, rowSize.width)).map(
    (offset) => circle(point(rowOrigin.x + offset.x, rowOrigin.y + offset.y)),
  );
  const topRight = getTopRightCornerMarkOffset(inset);
  marks.push(circle(point(rowOrigin.x + rowSize.width + topRight.x, rowOrigin.y + topRight.y)));
  return marks;
}
