import { toMm } from '../units';
import type { Point } from '../units';
import type {
  Circle,
  HeaderLayout,
  MeshLayout,
  PassphraseCardLayout,
  Rect,
  SeedCardLayout,
  TextBox,
} from '../layout/types';

export interface CardSvgOptions {
  wordNumbers?: boolean;
  headers?: boolean;
  cellLabels?: boolean;
}

export interface CardSvg {
  markup: string;
  viewBox: Rect; // mm
  card: Rect; // mm, the card itself inside viewBox
}

// Rounded to 4 decimals; never NaN or "-0".
function n(points: number): string {
  const value = Math.round(toMm(points) * 10000) / 10000;
  return Number.isFinite(value) ? String(value + 0) : '0';
}

function mmRect(r: Rect): Rect {
  return { x: Number(n(r.x)), y: Number(n(r.y)), width: Number(n(r.width)), height: Number(n(r.height)) };
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rectEl(cls: string, r: Rect, extra = ''): string {
  return `<rect class="${cls}" x="${n(r.x)}" y="${n(r.y)}" width="${n(r.width)}" height="${n(r.height)}"${extra}/>`;
}

function circleEl(c: Circle): string {
  return `<circle class="ds-corner-mark" cx="${n(c.cx)}" cy="${n(c.cy)}" r="${n(c.r)}"/>`;
}

function textEl(t: TextBox, cls: string): string {
  const { box, align } = t;
  const anchor = { left: 'start', center: 'middle', right: 'end' } as const;
  const baseline = { top: 'hanging', center: 'central', bottom: 'text-after-edge' } as const;

  if (t.rotated) {
    // Reads bottom-to-top. Run length is the box's long side, font size comes from
    // the short (cross) side; 'bottom' anchors the text start at the box's bottom
    // edge (toward the card), 'top' its end at the top edge.
    const fontSize = Math.min(box.width, box.height) * 0.8;
    const cx = box.x + box.width / 2;
    const [py, textAnchor] =
      align.vertical === 'bottom' ? [box.y + box.height, 'start'] : align.vertical === 'top' ? [box.y, 'end'] : [box.y + box.height / 2, 'middle'];
    return (
      `<text class="${cls}" transform="rotate(-90 ${n(cx)} ${n(py)})" x="${n(cx)}" y="${n(py)}" ` +
      `font-size="${n(fontSize)}" text-anchor="${textAnchor}" dominant-baseline="central">${esc(t.text)}</text>`
    );
  }

  // Font size is 0.8 of the box height.
  const fontSize = box.height * 0.8;
  const x = align.horizontal === 'left' ? box.x : align.horizontal === 'right' ? box.x + box.width : box.x + box.width / 2;
  const y = align.vertical === 'top' ? box.y : align.vertical === 'bottom' ? box.y + box.height : box.y + box.height / 2;
  return (
    `<text class="${cls}" x="${n(x)}" y="${n(y)}" font-size="${n(fontSize)}" ` +
    `text-anchor="${anchor[align.horizontal]}" dominant-baseline="${baseline[align.vertical]}">${esc(t.text)}</text>`
  );
}

function meshEls(mesh: MeshLayout, cellLabels: boolean): string {
  let out = rectEl('ds-mesh', mesh.outline, ' fill="none"');
  for (const f of mesh.fills) out += rectEl(`ds-fill--${f.fill}`, f.rect);
  if (mesh.gridLines.length > 0) {
    const d = mesh.gridLines.map(([a, b]: [Point, Point]) => `M${n(a.x)} ${n(a.y)}L${n(b.x)} ${n(b.y)}`).join('');
    out += `<path class="ds-grid" fill="none" d="${d}"/>`;
  }
  if (cellLabels) for (const t of mesh.cellLabels) out += textEl(t, 'ds-cell-label');
  return out;
}

function headerEls(header: HeaderLayout | null): string {
  if (!header) return '';
  let out = '';
  for (const t of header.labels) out += textEl(t, 'ds-header-label');
  for (const [a, b, c] of header.arrows) {
    out += `<polygon class="ds-header-arrow" points="${n(a.x)},${n(a.y)} ${n(b.x)},${n(b.y)} ${n(c.x)},${n(c.y)}"/>`;
  }
  return out;
}

export function cardSvg(layout: SeedCardLayout | PassphraseCardLayout, options: CardSvgOptions = {}): CardSvg {
  const showWordNumbers = options.wordNumbers ?? true;
  const showHeaders = options.headers ?? true;
  const showCellLabels = options.cellLabels ?? false;

  const cardRect: Rect = { x: 0, y: 0, width: layout.size.width, height: layout.size.height };
  const card = mmRect(cardRect);
  const viewBox = showHeaders ? mmRect(layout.bounds) : card;

  let body = `<rect class="ds-card" x="0" y="0" width="${n(layout.size.width)}" height="${n(layout.size.height)}" ` +
    `rx="${n(layout.radius)}" ry="${n(layout.radius)}" fill="none"/>`;
  body += rectEl('ds-padding', {
    x: layout.padding,
    y: layout.padding,
    width: layout.size.width - 2 * layout.padding,
    height: layout.size.height - 2 * layout.padding,
  }, ' fill="none"');

  if (layout.kind === 'seed') {
    for (const section of layout.sections) {
      for (const mesh of section.meshes) body += meshEls(mesh, showCellLabels);
      for (const m of section.topMarks) body += circleEl(m);
      if (showWordNumbers) for (const t of section.wordNumbers) body += textEl(t, 'ds-word-number');
    }
    body += circleEl(layout.bottomLeftMark);
    if (showHeaders) body += headerEls(layout.rowHeader);
  } else {
    for (const block of layout.blocks) {
      for (const mesh of block.meshes) body += meshEls(mesh, showCellLabels);
      for (const m of block.topMarks) body += circleEl(m);
      if (showHeaders) body += headerEls(block.rowHeader);
    }
    body += circleEl(layout.bottomLeftMark);
    if (showHeaders) body += headerEls(layout.columnHeader);
  }

  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  return { markup: `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`, viewBox, card };
}
