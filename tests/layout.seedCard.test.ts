import { describe, it, expect } from 'vitest';
import { GeneratorParameters } from '../src/generator/params';
import { EncodingType, encodingLayout } from '../src/generator/encoding';
import * as Config from '../src/generator/config';
import {
  cornerMarkInset,
  getTopLeftCornerMarkOffsets,
  getTopLeftCornerMarkPitch,
  getTopRightCornerMarkOffset,
  getBottomLeftCornerMarkOffset,
} from '../src/generator/cornerMarks';
import { layoutSeedCard, SEED_BINARY_HEADER_WIDTH } from '../src/layout/seedCard';
import { ARROW_FOOTPRINT, ARROW_SIZE, ARROW_TIP_GAP } from '../src/layout/headers';
import type { Rect } from '../src/layout/types';
import { mm, size } from '../src/units';

const card = size(mm(85.6), mm(54));

function params(p: ConstructorParameters<typeof GeneratorParameters>[0]): GeneratorParameters {
  return new GeneratorParameters(p);
}

function isRect(v: unknown): v is Rect {
  return (
    typeof v === 'object' &&
    v !== null &&
    'x' in v &&
    'y' in v &&
    'width' in v &&
    'height' in v
  );
}

function walk(value: unknown, visit: (v: unknown) => void): void {
  visit(value);
  if (Array.isArray(value)) value.forEach((v) => walk(v, visit));
  else if (typeof value === 'object' && value !== null) Object.values(value).forEach((v) => walk(v, visit));
}

describe('layoutSeedCard: default Alphabet card', () => {
  const p = params({ cardSize: card, cardPadding: mm(1.5), seedLength: 12, cardCount: 1, cardSplit: 1, encoding: EncodingType.Alphabet });
  const c = p.getCardParameters(1);
  const layout = layoutSeedCard(c, EncodingType.Alphabet);
  const padding = c.padding;

  it('mirrors the card geometry', () => {
    expect(layout.kind).toBe('seed');
    expect(layout.size).toEqual(c.size);
    expect(layout.radius).toBe(c.radius);
    expect(layout.padding).toBe(padding);
    expect(layout.cellSize).toEqual(c.cellSize);
    expect(layout.bounds).toEqual({ x: 0, y: 0, width: c.size.width, height: c.size.height });
    expect(layout.rowHeader).toBeNull();
  });

  it('has one section with 12 meshes laid out left to right', () => {
    expect(layout.sections).toHaveLength(1);
    const section = layout.sections[0];
    const s = c.sections[0];
    expect(section.number).toBe(1);
    expect(section.origin).toEqual({ x: padding, y: padding });
    expect(section.size).toEqual(s.size);
    expect(section.meshes).toHaveLength(12);
    section.meshes.forEach((mesh, i) => {
      expect(mesh.outline.x).toBeCloseTo(padding + i * s.wordSize.width, 9);
      expect(mesh.outline.y).toBe(padding);
      expect(mesh.outline.width).toBe(s.wordSize.width);
      expect(mesh.outline.height).toBe(s.wordSize.height);
    });
  });

  it('shades words per (section.number + i) % 2 === 0', () => {
    const section = layout.sections[0];
    section.meshes.forEach((mesh, i) => {
      const shaded = (section.number + i) % 2 === 0;
      if (shaded) {
        expect(mesh.fills).toEqual([{ rect: mesh.outline, fill: 'shade' }]);
      } else {
        expect(mesh.fills).toEqual([]);
      }
    });
  });

  it('places word numbers in the box drawWordNumber uses', () => {
    const section = layout.sections[0];
    expect(section.wordNumbers.map((w) => w.text)).toEqual(Array.from({ length: 12 }, (_, i) => `${i + 1}`));
    section.wordNumbers.forEach((w, i) => {
      const outline = section.meshes[i].outline;
      expect(w.role).toBe('word-number');
      expect(w.align).toEqual({ horizontal: 'center', vertical: 'top' });
      expect(w.box).toEqual({
        x: outline.x,
        y: outline.y + Config.WORD_NR_TOP_GAP,
        width: outline.width,
        height: outline.height - Config.WORD_NR_TOP_GAP,
      });
    });
  });

  it('draws inner grid lines (rows - 1 horizontal, cols - 1 vertical)', () => {
    const enc = encodingLayout(EncodingType.Alphabet);
    const mesh = layout.sections[0].meshes[0];
    expect(mesh.gridLines).toHaveLength(enc.rows - 1 + enc.cols - 1);
    const [from, to] = mesh.gridLines[0];
    expect(from).toEqual({ x: mesh.outline.x, y: mesh.outline.y + c.cellSize.height });
    expect(to).toEqual({ x: mesh.outline.x + mesh.outline.width, y: mesh.outline.y + c.cellSize.height });
    const [vFrom, vTo] = mesh.gridLines[enc.rows - 1];
    expect(vFrom).toEqual({ x: mesh.outline.x + c.cellSize.width, y: mesh.outline.y });
    expect(vTo).toEqual({ x: mesh.outline.x + c.cellSize.width, y: mesh.outline.y + mesh.outline.height });
  });

  it('labels every cell with the encoding character', () => {
    const enc = encodingLayout(EncodingType.Alphabet);
    const mesh = layout.sections[0].meshes[0];
    expect(mesh.cellLabels).toHaveLength(enc.rows * enc.cols);
    mesh.cellLabels.forEach((label, k) => {
      const row = Math.floor(k / enc.cols);
      const col = k % enc.cols;
      expect(label.role).toBe('cell-label');
      expect(label.text).toBe(enc.cellLabels![row]);
      expect(label.align).toEqual({ horizontal: 'center', vertical: 'center' });
      expect(label.box).toEqual({
        x: mesh.outline.x + c.cellSize.width * col,
        y: mesh.outline.y + c.cellSize.height * row,
        width: c.cellSize.width,
        height: c.cellSize.height,
      });
    });
  });

  it('places corner marks like drawRowTopMarks / drawBottomLeftMark', () => {
    const section = layout.sections[0];
    const inset = cornerMarkInset(padding);
    const pitch = getTopLeftCornerMarkPitch(1, c.cellSize.width, section.size.width);
    const [tl] = getTopLeftCornerMarkOffsets(1, inset, pitch);
    const tr = getTopRightCornerMarkOffset(inset);
    const bl = getBottomLeftCornerMarkOffset(inset);
    const r = Config.CORNER_MARK_RADIUS;

    expect(section.topMarks).toEqual([
      { cx: padding + tl.x, cy: padding + tl.y, r },
      { cx: padding + section.size.width + tr.x, cy: padding + tr.y, r },
    ]);
    expect(layout.bottomLeftMark).toEqual({ cx: padding + bl.x, cy: c.size.height - padding + bl.y, r });
  });
});

describe('layoutSeedCard: Number split 2', () => {
  const p = params({ cardSize: card, seedLength: 24, cardCount: 1, cardSplit: 2, encoding: EncodingType.Number });
  const c = p.getCardParameters(1);
  const layout = layoutSeedCard(c, EncodingType.Number);

  it('stacks two sections with a padding gap', () => {
    expect(layout.sections).toHaveLength(2);
    const [a, b] = layout.sections;
    expect(b.origin.x).toBe(a.origin.x);
    expect(b.origin.y).toBeCloseTo(a.origin.y + p.sectionSize.height + c.padding, 9);
  });

  it('gives section 2 two top-left marks plus a top-right mark, and one bottom-left mark per card', () => {
    const [a, b] = layout.sections;
    expect(a.topMarks).toHaveLength(2);
    expect(b.topMarks).toHaveLength(3);
    const inset = cornerMarkInset(c.padding);
    const pitch = getTopLeftCornerMarkPitch(2, c.cellSize.width, b.size.width);
    const offsets = getTopLeftCornerMarkOffsets(2, inset, pitch);
    expect(b.topMarks.slice(0, 2)).toEqual(
      offsets.map((o) => ({ cx: b.origin.x + o.x, cy: b.origin.y + o.y, r: Config.CORNER_MARK_RADIUS })),
    );
    expect(layout.bottomLeftMark.r).toBe(Config.CORNER_MARK_RADIUS);
  });

  it('numbers words continuing across sections', () => {
    expect(layout.sections[1].wordNumbers[0].text).toBe('13');
  });
});

describe('layoutSeedCard: Binary', () => {
  const p = params({ cardSize: card, seedLength: 24, cardCount: 2, encoding: EncodingType.Binary });
  const c = p.getCardParameters(1);
  const layout = layoutSeedCard(c, EncodingType.Binary);
  const padding = c.padding;

  it('exports the header width the writer reserves', () => {
    expect(SEED_BINARY_HEADER_WIDTH).toBe(Config.BINARY_HEADER_HEIGHT);
  });

  it('builds the row header left of the card', () => {
    const header = layout.rowHeader!;
    expect(header).not.toBeNull();
    const rowHeight = (c.size.height - 2 * padding) / Config.BINARY_COLUMN_VALUES.length;
    expect(header.labels.map((l) => l.text)).toEqual(Config.BINARY_COLUMN_VALUES.map((v) => `${v}`));
    expect(header.labels[0].text).toBe('1024');
    expect(header.labels[10].text).toBe('1');
    header.labels.forEach((label, i) => {
      expect(label.role).toBe('header');
      expect(label.align).toEqual({ horizontal: 'right', vertical: 'center' });
      expect(label.box).toEqual({
        x: -SEED_BINARY_HEADER_WIDTH,
        y: padding + rowHeight * i,
        width: SEED_BINARY_HEADER_WIDTH - ARROW_FOOTPRINT,
        height: rowHeight,
      });
    });
    expect(header.arrows).toHaveLength(11);
    header.arrows.forEach((tri, i) => {
      const cy = padding + rowHeight * i + rowHeight / 2;
      const tipX = -ARROW_TIP_GAP;
      const baseX = tipX - ARROW_SIZE;
      expect(tri).toEqual([
        { x: baseX, y: cy - ARROW_SIZE / 2 },
        { x: baseX, y: cy + ARROW_SIZE / 2 },
        { x: tipX, y: cy },
      ]);
    });
  });

  it('extends bounds over the header', () => {
    expect(layout.bounds).toEqual({
      x: -SEED_BINARY_HEADER_WIDTH,
      y: 0,
      width: c.size.width + SEED_BINARY_HEADER_WIDTH,
      height: c.size.height,
    });
  });

  it('adds bit-shading rows after the word shade, like drawBinaryBitShading', () => {
    const rows = encodingLayout(EncodingType.Binary).rows;
    const section = layout.sections[0];
    section.meshes.forEach((mesh, i) => {
      const shaded = (section.number + i) % 2 === 0;
      const bitRows: { rect: Rect; fill: string }[] = [];
      for (let row = 1; row < rows; row += 2) {
        bitRows.push({
          rect: { x: mesh.outline.x, y: mesh.outline.y + c.cellSize.height * row, width: mesh.outline.width, height: c.cellSize.height },
          fill: shaded ? 'shade-intersection' : 'shade',
        });
      }
      const expected = shaded ? [{ rect: mesh.outline, fill: 'shade' }, ...bitRows] : bitRows;
      expect(mesh.fills).toEqual(expected);
    });
  });

  it('has no cell labels', () => {
    layout.sections[0].meshes.forEach((mesh) => expect(mesh.cellLabels).toEqual([]));
  });
});

describe('layoutSeedCard: tiny card', () => {
  it('produces no NaN and no negative sizes', () => {
    const p = params({ cardSize: size(mm(20), mm(20)), seedLength: 12, cardCount: 4, encoding: EncodingType.Number });
    for (let n = 1; n <= p.effectiveCardCount; n++) {
      const layout = layoutSeedCard(p.getCardParameters(n), EncodingType.Number);
      let rects = 0;
      walk(layout, (v) => {
        if (typeof v === 'number') expect(Number.isNaN(v)).toBe(false);
        if (isRect(v)) {
          rects++;
          expect(v.width).toBeGreaterThanOrEqual(0);
          expect(v.height).toBeGreaterThanOrEqual(0);
        }
      });
      expect(rects).toBeGreaterThan(0);
    }
  });
});
