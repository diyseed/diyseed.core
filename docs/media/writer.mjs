import { createCanvas } from '@napi-rs/canvas';
import { IMAGES, lib, mm, WORDLIST, SEED12, renderPdfPage, crop, drawMetalCard, drawDot, BLUE, BLUE_SHADE, encodeGif } from './common.mjs';
import path from 'node:path';

const { GeneratorParameters, generateWriterPdf } = lib;

const p = new GeneratorParameters({ cardSize: { width: mm(85.6), height: mm(54) }, cardCount: 1, seedLength: 12 });
const pdf = await generateWriterPdf(p);

// Geometry in PDF points (top-left origin), card 1 on page 1.
const card = { x: mm(15), y: mm(20), w: p.cardSize.width, h: p.cardSize.height };
const pad = p.cardPadding;
const margin = mm(3);
const W = 800, H = 430, LIST_W = 170;
const cropPt = { x: card.x - margin, y: card.y - margin, w: card.w + 2 * margin, h: card.h + margin + mm(2.1) };
const s = (W - LIST_W - 20) / cropPt.w; // px per pt
const offX = LIST_W + 10, offY = (H - cropPt.h * s) / 2;
const px = (xPt, yPt) => [offX + (xPt - cropPt.x) * s, offY + (yPt - cropPt.y) * s];

const page = await renderPdfPage(pdf, s);
const stencil = crop(page, cropPt.x * s, cropPt.y * s, cropPt.w * s, cropPt.h * s);

const cell = p.cellSize, word = p.wordSize;
const marks = SEED12.map((w, wi) =>
  w.slice(0, 4).split('').map((ch, col) =>
    px(card.x + pad + wi * word.width + (col + 0.5) * cell.width, card.y + pad + (ch.charCodeAt(0) - 97 + 0.5) * cell.height),
  ),
);
// Corner marks: centred in the padding (one row -> one top-left dot).
const corner = [
  px(card.x + pad, card.y + pad / 2),
  px(card.x + card.w - pad, card.y + pad / 2),
  px(card.x + pad, card.y + card.h - pad / 2),
];
const markSize = Math.min(cell.width, cell.height) * s * 0.36;
const dentR = Math.min(cell.width, cell.height) * s * 0.32;

function drawList(ctx, current, done) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, LIST_W, H);
  ctx.font = 'bold 15px Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText('Seed', 18, 46);
  SEED12.forEach((w, i) => {
    const y = 74 + i * 27;
    if (i === current) {
      ctx.fillStyle = BLUE_SHADE;
      ctx.fillRect(10, y - 18, LIST_W - 14, 25);
    }
    ctx.font = '13px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#999';
    ctx.fillText(`${i + 1}.`, 18, y);
    ctx.font = i === current ? 'bold 15px Helvetica, Arial, sans-serif' : '15px Helvetica, Arial, sans-serif';
    ctx.fillStyle = i === current ? BLUE : i < done ? '#333' : '#555';
    const prefix = w.slice(0, 4);
    ctx.fillText(prefix, 42, y);
    const pw = ctx.measureText(prefix).width;
    ctx.fillStyle = i === current ? '#8ea0e6' : '#aaa';
    ctx.font = '15px Helvetica, Arial, sans-serif';
    ctx.fillText(w.slice(4), 42 + pw, y);
    if (i < done) {
      const cx = 42 + ctx.measureText(w).width + 9;
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, y - 5);
      ctx.lineTo(cx + 4, y - 1);
      ctx.lineTo(cx + 11, y - 10);
      ctx.stroke();
    }
  });
}

const CAP = 44;
function frame({ caption, current = -1, done = 0, markCount = 0, corners = 0, ring = -1, wipe = null }) {
  const c = createCanvas(W, H + CAP);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H + CAP);
  ctx.fillStyle = '#222';
  ctx.font = 'bold 17px Helvetica, Arial, sans-serif';
  ctx.fillText(caption, 16, 28);
  ctx.translate(0, CAP);
  drawList(ctx, current, done);
  const flat = marks.flat();
  const [cx, cy] = px(card.x, card.y);
  const metal = () => {
    const m = createCanvas(W, H);
    const mctx = m.getContext('2d');
    drawMetalCard(mctx, cx, cy, card.w * s, card.h * s, p.cardCornerRadius * s, [...flat, ...corner], dentR);
    return m;
  };
  ctx.drawImage(stencil, offX, offY);
  if (current >= 0) {
    const [wx, wy] = px(card.x + pad + current * word.width, card.y + pad);
    ctx.fillStyle = BLUE_SHADE;
    ctx.fillRect(wx, wy, word.width * s, (card.h - 2 * pad) * s);
  }
  flat.slice(0, markCount).forEach(([x, y]) => drawDot(ctx, x, y, markSize));
  corner.slice(0, corners).forEach(([x, y]) => drawDot(ctx, x, y, markSize));
  if (ring >= 0) {
    const [x, y] = corner[ring];
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, markSize * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (wipe !== null) {
    // Wavy boundary moving left to right: metal card on the left, paper stencil on the right.
    const m = metal();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(offX - 5, 0);
    for (let y = 0; y <= H; y += 4) ctx.lineTo(offX - 5 + wipe * (W - offX + 40) + 14 * Math.sin(y / 28), y);
    ctx.lineTo(offX - 5, H);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(m, 0, 0);
    ctx.restore();
    if (wipe < 1) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = 0; y <= H; y += 4) {
        const x = offX - 5 + wipe * (W - offX + 40) + 14 * Math.sin(y / 28);
        y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  return c;
}

const frames = [];
const add = (state, delay) => frames.push({ canvas: frame(state), delay });

const MARK = '1. Mark the first 4 letters of each word';
const CORNERS = '2. Mark the corner marks too: top left, top right, bottom left';
const PUNCH = '3. Punch every mark, then remove the stencil';
add({ caption: MARK }, 1200);
let count = 0;
SEED12.forEach((w, wi) => {
  const n = Math.min(4, w.length);
  for (let k = 0; k < n; k++) {
    count++;
    add({ caption: MARK, current: wi, done: wi, markCount: count }, k === n - 1 ? 350 : 140);
  }
});
for (let k = 1; k <= 3; k++) add({ caption: CORNERS, done: 12, markCount: count, corners: k, ring: k - 1 }, 700);
add({ caption: CORNERS, done: 12, markCount: count, corners: 3 }, 600);
for (let k = 1; k <= 14; k++) add({ caption: PUNCH, done: 12, markCount: count, corners: 3, wipe: k / 14 }, 70);
add({ caption: PUNCH, done: 12, markCount: count, corners: 3, wipe: 1 }, 3500);

encodeGif(frames, path.join(IMAGES, 'writer-animation.gif'), [0, count + 3, frames.length - 1]);
