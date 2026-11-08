import { createCanvas } from '@napi-rs/canvas';
import { IMAGES, lib, mm, SEED12, renderPdfPage, crop, drawMetalCard, encodeGif, BLUE, BLUE_SHADE } from './common.mjs';
import path from 'node:path';

const p = new lib.GeneratorParameters({ cardSize: { width: mm(85.6), height: mm(54) }, cardCount: 1, seedLength: 12 });
const pdf = await lib.generateStencilPdf({ seed: p, includeSeedReader: true });

const cell = p.cellSize, pad = p.cardPadding;
const cutX = mm(15), meshY = mm(30); // reader.ts DIAGRAM_ORIGIN
const cardTop = meshY - pad;

const W = 800, CAPTION_H = 44;
const cropPt = { x: mm(7), y: mm(17), w: mm(146), h: mm(112.5) };
const s = W / cropPt.w;
const H = Math.round(CAPTION_H + cropPt.h * s);
const px = (xPt, yPt) => [(xPt - cropPt.x) * s, CAPTION_H + (yPt - cropPt.y) * s];

const page = await renderPdfPage(pdf, s);
const reader = crop(page, cropPt.x * s, cropPt.y * s, cropPt.w * s, cropPt.h * s);

// Card columns in reading order: word w, char c -> letter row (or null when the word is shorter).
const columns = [];
SEED12.forEach((w) => {
  for (let c = 0; c < 4; c++) columns.push(c < w.length ? w.charCodeAt(c) - 97 : null);
});
// Dents relative to the card's top-left corner (pt).
const dents = [];
columns.forEach((row, k) => {
  if (row !== null) dents.push([pad + (k + 0.5) * cell.width, pad + (row + 0.5) * cell.height]);
});
dents.push([pad, pad / 2], [p.cardSize.width - pad, pad / 2], [pad, p.cardSize.height - pad / 2]);

// Metal card rendered once at its own origin, then shifted per frame.
const cardW = p.cardSize.width * s, cardH = p.cardSize.height * s;
const dentR = Math.min(cell.width, cell.height) * s * 0.32;
const cardImg = createCanvas(Math.ceil(cardW) + 20, Math.ceil(cardH) + 20);
drawMetalCard(cardImg.getContext('2d'), 10, 10, cardW, cardH, p.cardCornerRadius * s, dents.map(([x, y]) => [10 + x * s, 10 + y * s]), dentR);

// Fill-in boxes (reader.ts drawFillInBoxes): 6 per row, number cell + 4 char cells.
const boxX = (i) => cutX + pad + (i % 6) * mm(23) + mm(4);
// reader.ts: the diagram ends below the word-number row (cut-line overflow 3 mm,
// gap 0.4 mm, one 6 mm row), then a 10 mm section gap and a 6 mm card heading.
const diagramBottom = cardTop + p.cardSize.height + Math.max(mm(5), mm(3) + mm(0.4) + mm(6));
const boxY = (i) => diagramBottom + mm(16) + Math.floor(i / 6) * mm(11);

function frame({ caption, cardLeftPt = null, read = -1, typed = 0 }) {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(reader, 0, CAPTION_H);

  // typed characters so far
  ctx.font = 'bold 15px Courier, monospace';
  ctx.textAlign = 'center';
  for (let k = 0; k < typed; k++) {
    const row = columns[k];
    if (row === null) continue;
    const w = Math.floor(k / 4);
    const [x, y] = px(boxX(w) + (k % 4 + 0.5) * mm(4), boxY(w) + mm(4));
    ctx.fillStyle = k === read ? BLUE : '#222';
    ctx.fillText(String.fromCharCode(97 + row), x, y + 5);
  }

  if (cardLeftPt !== null) {
    const [cx, cy] = px(cardLeftPt, cardTop);
    const [clipX] = px(cutX, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, 0, W - clipX, H);
    ctx.clip();
    ctx.drawImage(cardImg, cx - 10, cy - 10);
    ctx.restore();
  }

  if (read >= 0) {
    // highlight the column right at the cut and the matching label
    const colX = cutX;
    const [bx, by] = px(colX, cardTop);
    ctx.fillStyle = 'rgba(31,63,191,0.16)';
    ctx.fillRect(bx, by, cell.width * s, p.cardSize.height * s);
    const row = columns[read];
    if (row !== null) {
      const [lx, ly] = px(cutX - mm(6), meshY + row * cell.height);
      ctx.fillStyle = BLUE_SHADE;
      ctx.fillRect(lx, ly, mm(6) * s + cell.width * s, cell.height * s);
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 2;
      ctx.strokeRect(lx, ly, mm(6) * s + cell.width * s, cell.height * s);
    }
    const w = Math.floor(read / 4);
    const [gx, gy] = px(boxX(w) - mm(4), boxY(w));
    ctx.fillStyle = BLUE_SHADE;
    ctx.fillRect(gx, gy, mm(20) * s, mm(8) * s);
    const [fx, fy] = px(boxX(w) + (read % 4) * mm(4), boxY(w));
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2;
    ctx.strokeRect(fx, fy, mm(4) * s, mm(8) * s);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#222';
  ctx.font = 'bold 17px Helvetica, Arial, sans-serif';
  ctx.fillText(caption, 16, 28);
  return c;
}

const frames = [];
const add = (state, delay) => frames.push({ canvas: frame(state), delay });

add({ caption: '1. Cut along the red dashed line' }, 1800);
const startLeft = cutX + mm(150);
for (let k = 1; k <= 10; k++) {
  add({ caption: '2. Slide the card in from the right, under the cut edge', cardLeftPt: startLeft + (cutX - pad - startLeft) * (k / 10) }, 80);
}
add({ caption: '2. Slide the card in from the right, under the cut edge', cardLeftPt: cutX - pad }, 1200);

const READ = '3. Read the letter next to the cut, write it down, slide one column';
columns.forEach((_, k) => {
  const left = cutX - pad - k * cell.width;
  const slow = k < 8;
  if (k > 0) add({ caption: READ, cardLeftPt: left, typed: k }, slow ? 350 : 90);
  add({ caption: READ, cardLeftPt: left, read: k, typed: k + 1 }, slow ? 900 : 260);
});
add({ caption: 'Done: a wallet completes each word from its first 4 letters', cardLeftPt: cutX - pad - (columns.length - 1) * cell.width, typed: columns.length }, 4000);

encodeGif(frames, path.join(IMAGES, 'reader-animation.gif'), [0, 20, frames.length - 1]);
