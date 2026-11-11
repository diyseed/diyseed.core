import { describe, it, expect } from 'vitest';
import { PassphraseParameters } from '../src/generator/params';
import * as Config from '../src/generator/config';
import {
  cornerMarkInset,
  getTopLeftCornerMarkOffsets,
  getTopLeftCornerMarkPitch,
  getTopRightCornerMarkOffset,
  getBottomLeftCornerMarkOffset,
} from '../src/generator/cornerMarks';
import { layoutPassphraseCard, PASSPHRASE_HEADER_SIZE } from '../src/layout/passphraseCard';
import { ARROW_FOOTPRINT, ARROW_SIZE, ARROW_TIP_GAP } from '../src/layout/headers';
import { mm, point, size } from '../src/units';

const card = size(mm(85.6), mm(54));

function params(cell: number, cardCount = 1): PassphraseParameters {
  return new PassphraseParameters({
    cardSize: card,
    cardPadding: mm(1.5),
    cardCornerRadius: Config.CARDS_RADIUS_DEFAULT,
    cardCount,
    copies: 1,
    cellSize: size(mm(cell), mm(cell)),
  });
}

describe('layoutPassphraseCard: default (cell 2 mm)', () => {
  const p = params(2, 2);
  const layout = layoutPassphraseCard(p, 2, 4);
  const padding = p.cardPadding;
  const cell = p.cellSize;

  it('mirrors the card geometry', () => {
    expect(layout.kind).toBe('passphrase');
    expect(layout.size).toEqual(p.cardSize);
    expect(layout.radius).toBe(p.cardCornerRadius);
    expect(layout.padding).toBe(padding);
    expect(layout.cellSize).toEqual(cell);
    expect(PASSPHRASE_HEADER_SIZE).toBe(Config.BINARY_HEADER_HEIGHT);
  });

  it('has blockCount blocks stacked with padding gaps, numbered from startRowNumber', () => {
    expect(layout.blocks).toHaveLength(p.blockCount);
    expect(p.blockCount).toBeGreaterThan(1);
    layout.blocks.forEach((b, i) => {
      expect(b.rowNumber).toBe(4 + i);
      expect(b.origin.x).toBe(padding);
      expect(b.origin.y).toBeCloseTo(padding + i * (p.blockThickness + padding), 9);
      expect(b.size).toEqual(size(p.charsPerBlock * cell.width, p.blockThickness));
      expect(b.meshes).toHaveLength(p.charsPerBlock);
    });
  });

  it('lays out one 1 x 7 mesh per character, shaded by position, bit rows striped', () => {
    const b = layout.blocks[1];
    b.meshes.forEach((mesh, i) => {
      expect(mesh.outline.x).toBeCloseTo(b.origin.x + i * cell.width, 9);
      expect(mesh.outline.y).toBe(b.origin.y);
      expect(mesh.outline.width).toBe(cell.width);
      expect(mesh.outline.height).toBe(7 * cell.height);
      expect(mesh.cellLabels).toEqual([]);

      const shaded = (i + 1) % 2 === 0;
      const stripeFill = shaded ? 'shade-intersection' : 'shade';
      const stripes = [1, 3, 5].map((row) => ({
        rect: { x: mesh.outline.x, y: mesh.outline.y + cell.height * row, width: cell.width, height: cell.height },
        fill: stripeFill,
      }));
      expect(mesh.fills).toEqual(shaded ? [{ rect: mesh.outline, fill: 'shade' }, ...stripes] : stripes);

      expect(mesh.gridLines).toEqual(
        [1, 2, 3, 4, 5, 6].map((row) => {
          const y = mesh.outline.y + cell.height * row;
          return [point(mesh.outline.x, y), point(mesh.outline.x + cell.width, y)];
        }),
      );
    });
  });

  it('draws one rotated column header above the card', () => {
    const h = layout.columnHeader;
    expect(h.labels.map((l) => l.text)).toEqual(Array.from({ length: p.charsPerBlock }, (_, i) => String(i + 1)));
    h.labels.forEach((l, i) => {
      expect(l.rotated).toBe(true);
      expect(l.role).toBe('header');
      expect(l.align).toEqual({ horizontal: 'center', vertical: 'bottom' });
      expect(l.box.x).toBeCloseTo(padding + cell.width * i, 9);
      expect(l.box.y).toBe(-PASSPHRASE_HEADER_SIZE);
      expect(l.box.width).toBe(cell.width);
      expect(l.box.height).toBe(PASSPHRASE_HEADER_SIZE - ARROW_FOOTPRINT);
      expect(l.box.y + l.box.height).toBeLessThan(0);
    });
    expect(h.arrows).toHaveLength(p.charsPerBlock);
    h.arrows.forEach((a, i) => {
      const cx = padding + cell.width * i + cell.width / 2;
      const tipY = -ARROW_TIP_GAP;
      const baseY = tipY - ARROW_SIZE;
      expect(a[0].x).toBeCloseTo(cx - ARROW_SIZE / 2, 9);
      expect(a[0].y).toBeCloseTo(baseY, 9);
      expect(a[1].x).toBeCloseTo(cx + ARROW_SIZE / 2, 9);
      expect(a[1].y).toBeCloseTo(baseY, 9);
      expect(a[2].x).toBeCloseTo(cx, 9);
      expect(a[2].y).toBeCloseTo(tipY, 9);
    });
  });

  it('gives each block a 64..1 row header left of the card', () => {
    layout.blocks.forEach((b) => {
      const h = b.rowHeader;
      expect(h.labels.map((l) => l.text)).toEqual(['64', '32', '16', '8', '4', '2', '1']);
      h.labels.forEach((l, i) => {
        expect(l.rotated).toBeUndefined();
        expect(l.role).toBe('header');
        expect(l.align).toEqual({ horizontal: 'right', vertical: 'center' });
        expect(l.box).toEqual({
          x: -PASSPHRASE_HEADER_SIZE,
          y: b.origin.y + cell.height * i,
          width: PASSPHRASE_HEADER_SIZE - ARROW_FOOTPRINT,
          height: cell.height,
        });
        expect(l.box.x + l.box.width).toBeLessThan(0);
      });
      expect(h.arrows).toHaveLength(7);
      h.arrows.forEach((a, i) => {
        const cy = b.origin.y + cell.height * i + cell.height / 2;
        expect(a[2].x).toBeCloseTo(-ARROW_TIP_GAP, 9);
        expect(a[2].y).toBeCloseTo(cy, 9);
      });
    });
  });

  it('puts row-number top marks on each block', () => {
    layout.blocks.forEach((b) => {
      const inset = cornerMarkInset(padding);
      const offsets = getTopLeftCornerMarkOffsets(b.rowNumber, inset, getTopLeftCornerMarkPitch(b.rowNumber, cell.width, b.size.width));
      const topRight = getTopRightCornerMarkOffset(inset);
      expect(b.topMarks).toHaveLength(b.rowNumber + 1);
      expect(b.topMarks).toEqual([
        ...offsets.map((o) => ({ cx: b.origin.x + o.x, cy: b.origin.y + o.y, r: Config.CORNER_MARK_RADIUS })),
        { cx: b.origin.x + b.size.width + topRight.x, cy: b.origin.y + topRight.y, r: Config.CORNER_MARK_RADIUS },
      ]);
    });
  });

  it('puts one bottom-left mark half the padding below the last block', () => {
    const first = layout.blocks[0];
    const last = layout.blocks[layout.blocks.length - 1];
    const bl = getBottomLeftCornerMarkOffset(cornerMarkInset(padding));
    expect(layout.bottomLeftMark).toEqual({
      cx: first.origin.x + bl.x,
      cy: last.origin.y + last.size.height + bl.y,
      r: Config.CORNER_MARK_RADIUS,
    });
    expect(layout.bottomLeftMark.cy).toBeCloseTo(last.origin.y + last.size.height + padding / 2, 9);
  });

  it('bounds start at the header strip and cover the card', () => {
    expect(layout.bounds).toEqual({
      x: -PASSPHRASE_HEADER_SIZE,
      y: -PASSPHRASE_HEADER_SIZE,
      width: p.cardSize.width + PASSPHRASE_HEADER_SIZE,
      height: p.cardSize.height + PASSPHRASE_HEADER_SIZE,
    });
  });
});

describe('layoutPassphraseCard: one row, cell 3.6 mm', () => {
  const p = params(3.6);
  const layout = layoutPassphraseCard(p, 1, 1);

  it('fits a single block of square cells', () => {
    expect(layout.blocks).toHaveLength(1);
    const b = layout.blocks[0];
    b.meshes.forEach((mesh) => {
      expect(mesh.outline.width).toBe(mm(3.6));
      expect(mesh.outline.height).toBeCloseTo(7 * mm(3.6), 9);
      expect(mesh.outline.width).toBeCloseTo(mesh.outline.height / 7, 9);
    });
    expect(b.size.height).toBe(p.blockThickness);
    expect(b.size.height).toBeLessThan(p.cardSize.height - 2 * p.cardPadding);
  });
});

describe('layoutPassphraseCard: origin', () => {
  function expectShifted(actual: unknown, base: unknown, dx: number, dy: number, path = '$'): void {
    if (Array.isArray(base)) {
      expect(Array.isArray(actual), path).toBe(true);
      expect((actual as unknown[]).length, path).toBe(base.length);
      base.forEach((b, i) => expectShifted((actual as unknown[])[i], b, dx, dy, `${path}[${i}]`));
    } else if (typeof base === 'object' && base !== null) {
      expect(Object.keys(actual as object).sort(), path).toEqual(Object.keys(base).sort());
      for (const [k, b] of Object.entries(base)) {
        const a = (actual as Record<string, unknown>)[k];
        if (typeof b === 'number' && (k === 'x' || k === 'cx')) expect(a, `${path}.${k}`).toBeCloseTo(b + dx, 9);
        else if (typeof b === 'number' && (k === 'y' || k === 'cy')) expect(a, `${path}.${k}`).toBeCloseTo(b + dy, 9);
        else expectShifted(a, b, dx, dy, `${path}.${k}`);
      }
    } else {
      expect(actual, path).toEqual(base);
    }
  }

  for (const cell of [2, 3.6]) {
    it(`shifts every coordinate by the origin (cell ${cell} mm)`, () => {
      const p = params(cell);
      const base = layoutPassphraseCard(p, 1, 1);
      const shifted = layoutPassphraseCard(p, 1, 1, point(37.5, 81.25));
      expectShifted(shifted, base, 37.5, 81.25);
    });
  }
});

describe('layoutPassphraseCard: default startRowNumber', () => {
  it('equals the explicit (cardNumber - 1) * blockCount + 1', () => {
    const p = params(2, 2);
    const explicit = layoutPassphraseCard(p, 2, (2 - 1) * p.blockCount + 1);
    expect(layoutPassphraseCard(p, 2)).toEqual(explicit);
  });
});
