// Card properties preview: the card outline with tick-ended width/height
// dimension lines and the padding as a dashed rectangle, all in mm.
export interface CardSizeSvg {
  viewBox: string;
  label: string;
  markup: string;
}

const MAX_WIDTH = 340;
const MAX_HEIGHT = 190;
const ORIGIN_X = 6;
const ORIGIN_Y = 40;
const VIEW_WIDTH = 450;

const formatMm = (value: number): string => `${Math.round(value * 10) / 10} mm`;

export function cardSizeSvg(widthMm: number, heightMm: number, paddingMm: number): CardSizeSvg {
  const scale = Math.min(MAX_WIDTH / widthMm, MAX_HEIGHT / heightMm);
  const w = widthMm * scale;
  const h = heightMm * scale;
  const x = ORIGIN_X;
  const y = ORIGIN_Y;
  const r = Math.min(1.5 * scale, w / 4, h / 4);
  const p = paddingMm * scale;
  const right = x + w + 18;

  let markup = `<rect class="card-diagram__card" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
  if (p > 0 && 2 * p < w && 2 * p < h) {
    markup += `<rect class="card-diagram__padding" x="${x + p}" y="${y + p}" width="${w - 2 * p}" height="${h - 2 * p}"/>`;
  }
  markup +=
    '<g class="card-diagram__dimension">' +
    `<line x1="${x}" y1="${y - 16}" x2="${x + w}" y2="${y - 16}"/>` +
    `<line x1="${x}" y1="${y - 22}" x2="${x}" y2="${y - 10}"/>` +
    `<line x1="${x + w}" y1="${y - 22}" x2="${x + w}" y2="${y - 10}"/>` +
    `<line x1="${right}" y1="${y}" x2="${right}" y2="${y + h}"/>` +
    `<line x1="${right - 6}" y1="${y}" x2="${right + 6}" y2="${y}"/>` +
    `<line x1="${right - 6}" y1="${y + h}" x2="${right + 6}" y2="${y + h}"/>` +
    '</g>';
  markup += `<text class="card-diagram__text" x="${x + w / 2}" y="${y - 24}" text-anchor="middle">${formatMm(widthMm)}</text>`;
  markup += `<text class="card-diagram__text" x="${right + 12}" y="${y + h / 2 + 4}">${formatMm(heightMm)}</text>`;
  markup += `<text class="card-diagram__text" x="${x + p + 8}" y="${y + p + 18}">${formatMm(paddingMm)} padding</text>`;

  return {
    viewBox: `0 0 ${VIEW_WIDTH} ${y + h + 10}`,
    label: `Card ${formatMm(widthMm)} × ${formatMm(heightMm)}, ${formatMm(paddingMm)} padding`,
    markup,
  };
}
