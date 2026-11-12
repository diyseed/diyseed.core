// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { GeneratorParameters, PassphraseParameters } from '../src/generator/params';
import { EncodingType } from '../src/generator/encoding';
import * as Config from '../src/generator/config';
import { layoutSeedCard } from '../src/layout/seedCard';
import { layoutPassphraseCard } from '../src/layout/passphraseCard';
import { cardSvg } from '../src/svg/cardSvg';
import { mm, size, toMm } from '../src/units';

const card = size(mm(85.6), mm(54));

function parse(markup: string): Document {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  return doc;
}

function seedLayout(p: ConstructorParameters<typeof GeneratorParameters>[0], encoding: EncodingType) {
  return layoutSeedCard(new GeneratorParameters(p).getCardParameters(1), encoding);
}

describe('cardSvg: default seed card', () => {
  const layout = seedLayout({ cardSize: card, cardPadding: mm(1.5), seedLength: 12, cardCount: 1, cardSplit: 1, encoding: EncodingType.Alphabet }, EncodingType.Alphabet);
  const result = cardSvg(layout);
  const doc = parse(result.markup);

  it('has the card at the origin and a matching viewBox', () => {
    expect(result.card.x).toBeCloseTo(0, 3);
    expect(result.card.y).toBeCloseTo(0, 3);
    expect(result.card.width).toBeCloseTo(85.6, 3);
    expect(result.card.height).toBeCloseTo(54, 3);
    const vb = doc.documentElement.getAttribute('viewBox')!.split(' ').map(Number);
    expect(vb).toEqual([result.viewBox.x, result.viewBox.y, result.viewBox.width, result.viewBox.height]);
    expect(doc.documentElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
  });

  it('numbers the 12 words', () => {
    const texts = [...doc.querySelectorAll('.ds-word-number')].map((e) => e.textContent);
    expect(texts).toEqual(Array.from({ length: 12 }, (_, i) => `${i + 1}`));
  });

  it('leaves colour and font to the stylesheet', () => {
    for (const el of doc.querySelectorAll('*')) {
      const fill = el.getAttribute('fill');
      expect(fill === null || fill === 'none').toBe(true);
      expect(el.hasAttribute('stroke')).toBe(false);
      expect(el.hasAttribute('font-family')).toBe(false);
    }
  });

  it('draws the padding rect, corner marks and grid', () => {
    expect(doc.querySelector('rect.ds-card')).not.toBeNull();
    expect(doc.querySelector('rect.ds-padding')).not.toBeNull();
    expect(doc.querySelectorAll('circle.ds-corner-mark').length).toBeGreaterThan(0);
    expect(doc.querySelectorAll('.ds-grid').length).toBeGreaterThan(0);
  });

  it('sizes word numbers to fit their column, all alike', () => {
    const widths = [...doc.querySelectorAll('rect.ds-mesh')].map((e) => Number(e.getAttribute('width')));
    const sizes = [...doc.querySelectorAll('.ds-word-number')].map((e) => Number(e.getAttribute('font-size')));
    expect(sizes).toHaveLength(12);
    sizes.forEach((s, i) => {
      expect(s).toBeLessThanOrEqual(0.8 * widths[i] + 1e-6);
      expect(s).toBeLessThanOrEqual(toMm(Config.WORD_NR_FONT_SIZE_RANGE[1]) + 1e-6);
    });
    expect(new Set(sizes).size).toBe(1);
  });

  it('keeps cell labels inside their cells', () => {
    const labelled = parse(cardSvg(layout, { cellLabels: true }).markup);
    const cell = layout.cellSize;
    for (const e of labelled.querySelectorAll('.ds-cell-label')) {
      const s = Number(e.getAttribute('font-size'));
      expect(s).toBeLessThanOrEqual(toMm(cell.width) + 1e-6);
      expect(s).toBeLessThanOrEqual(toMm(cell.height) + 1e-6);
    }
  });

  it('omits word numbers when asked', () => {
    expect(parse(cardSvg(layout, { wordNumbers: false }).markup).querySelectorAll('.ds-word-number')).toHaveLength(0);
  });

  it('adds cell labels only when asked', () => {
    expect(doc.querySelectorAll('.ds-cell-label')).toHaveLength(0);
    expect(parse(cardSvg(layout, { cellLabels: true }).markup).querySelectorAll('.ds-cell-label').length).toBeGreaterThan(0);
  });
});

describe('cardSvg: binary seed card', () => {
  const layout = seedLayout({ cardSize: card, seedLength: 24, cardCount: 2, encoding: EncodingType.Binary }, EncodingType.Binary);

  it('extends the viewBox left for the header and labels the bits', () => {
    const result = cardSvg(layout);
    expect(result.viewBox.x).toBeLessThan(0);
    const doc = parse(result.markup);
    expect(doc.querySelectorAll('.ds-header-label')).toHaveLength(11);
    expect(doc.querySelectorAll('.ds-header-arrow')).toHaveLength(11);
  });

  it('keeps header labels inside their boxes', () => {
    const rh = layout.rowHeader!;
    const doc = parse(cardSvg(layout).markup);
    [...doc.querySelectorAll('.ds-header-label')].forEach((e, i) => {
      const box = rh.labels[i].box;
      const s = Number(e.getAttribute('font-size'));
      expect(s).toBeLessThanOrEqual(toMm(box.height) + 1e-6);
      expect(s).toBeLessThanOrEqual(toMm(box.width) + 1e-6);
    });
  });

  it('crops to the card without headers', () => {
    const result = cardSvg(layout, { headers: false });
    expect(result.viewBox).toEqual(result.card);
    const doc = parse(result.markup);
    expect(doc.querySelectorAll('.ds-header-label')).toHaveLength(0);
    expect(doc.querySelectorAll('.ds-header-arrow')).toHaveLength(0);
  });
});

describe('cardSvg: passphrase card', () => {
  const p = new PassphraseParameters({
    cardSize: card,
    cardPadding: mm(1.5),
    cardCornerRadius: Config.CARDS_RADIUS_DEFAULT,
    cardCount: 1,
    copies: 1,
    cellSize: size(mm(3.6), mm(3.6)),
  });
  const result = cardSvg(layoutPassphraseCard(p, 1, 1));
  const doc = parse(result.markup);

  it('draws square cells', () => {
    const meshes = [...doc.querySelectorAll('rect.ds-mesh')];
    expect(meshes.length).toBeGreaterThan(0);
    for (const m of meshes) {
      expect(Number(m.getAttribute('height'))).toBeCloseTo(7 * 3.6, 3);
      expect(Number(m.getAttribute('width'))).toBeCloseTo(3.6, 3);
    }
  });

  it('extends the viewBox up and left and rotates the column labels', () => {
    expect(result.viewBox.x).toBeLessThan(0);
    expect(result.viewBox.y).toBeLessThan(0);
    expect([...doc.querySelectorAll('.ds-header-label')].some((e) => (e.getAttribute('transform') ?? '').startsWith('rotate(-90'))).toBe(true);
  });
});

describe('cardSvg: tiny seed card', () => {
  it('has no NaN', () => {
    const p = new GeneratorParameters({ cardSize: size(mm(20), mm(20)), seedLength: 12, cardCount: 4, encoding: EncodingType.Number });
    for (let n = 1; n <= p.effectiveCardCount; n++) {
      const result = cardSvg(layoutSeedCard(p.getCardParameters(n), EncodingType.Number), { cellLabels: true });
      parse(result.markup);
      expect(result.markup).not.toContain('NaN');
      expect(result.markup).not.toContain('-0"');
    }
  });
});

describe('cardSvg: mesh paint order', () => {
  it('draws a shaded word\'s fills before its ds-mesh outline', () => {
    const layout = seedLayout({ cardSize: card, cardPadding: mm(1.5), seedLength: 12, cardCount: 1, cardSplit: 1, encoding: EncodingType.Alphabet }, EncodingType.Alphabet);
    const doc = parse(cardSvg(layout).markup);
    const all = [...doc.documentElement.children];
    const cls = all.map((e) => e.getAttribute('class') ?? '');
    const fills = cls.map((c, i) => (c.startsWith('ds-fill--') ? i : -1)).filter((i) => i >= 0);
    expect(fills.length).toBeGreaterThan(0);
    for (const i of fills) {
      let j = i;
      while (cls[j].startsWith('ds-fill--')) j++;
      expect(cls[j]).toBe('ds-mesh');
    }
  });
});
