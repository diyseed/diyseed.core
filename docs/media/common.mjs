import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import gifsicle from 'gifsicle';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

// Repo root (docs/media -> ../..). Needs the library build: run `npm run build:library` there first.
export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const IMAGES = path.join(REPO, 'docs/images');
export const lib = await import(path.join(REPO, 'dist/index.js'));
export const mm = lib.mm;

const src = fs.readFileSync(path.join(REPO, 'src/generator/bip39Wordlist.ts'), 'utf8');
export const WORDLIST = [...src.slice(src.indexOf('[')).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);

export const SEED12 = 'bike acid key satoshi orbit planet garden volume ribbon timber wisdom zebra'.split(' ');

const FONTS = path.join(path.dirname(new URL(import.meta.resolve('pdfjs-dist/package.json')).pathname), 'standard_fonts') + '/';

// Renders page `pageIndex` of a PDF at `scale` px per pt into a canvas.
export async function renderPdfPage(bytes, scale, pageIndex = 0) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: FONTS, disableFontFace: true }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return canvas;
}

export function crop(canvas, x, y, w, h) {
  const out = createCanvas(Math.round(w), Math.round(h));
  out.getContext('2d').drawImage(canvas, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, Math.round(w), Math.round(h));
  return out;
}

// Deterministic pseudo-random for stable textures.
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Brushed-metal card with punched dents, drawn into ctx at (x, y).
export function drawMetalCard(ctx, x, y, w, h, r, dents, dentR) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#d9dde0');
  g.addColorStop(0.5, '#eef0f1');
  g.addColorStop(1, '#cfd4d7');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const rand = rng(7);
  for (let i = 0; i < h * 1.2; i++) {
    const ly = y + rand() * h;
    ctx.strokeStyle = rand() < 0.5 ? `rgba(255,255,255,${0.25 + rand() * 0.3})` : `rgba(120,128,134,${0.08 + rand() * 0.12})`;
    ctx.lineWidth = 0.6;
    const lx = x + rand() * w * 0.6;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + w * (0.2 + rand() * 0.6), ly + (rand() - 0.5));
    ctx.stroke();
  }
  for (const [dx, dy] of dents) {
    const rg = ctx.createRadialGradient(dx - dentR * 0.3, dy - dentR * 0.3, 0, dx, dy, dentR * 1.3);
    rg.addColorStop(0, '#3c4247');
    rg.addColorStop(0.55, '#5d656b');
    rg.addColorStop(0.8, '#9aa2a8');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(dx, dy, dentR * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = '#8f979c';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

export const BLUE = '#1F3FBF';
export const BLUE_SHADE = 'rgba(31,63,191,0.12)';

export function drawDot(ctx, x, y, r, color = BLUE) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawX(ctx, x, y, size, color = '#e8590c', width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();
}

// frames: [{ canvas, delay }] -> GIF bytes. One shared palette from sample frames keeps colors stable.
export function encodeGif(frames, file, sampleIdx = [0, frames.length - 1]) {
  const { width, height } = frames[0].canvas;
  const sample = new Uint8ClampedArray(width * height * 4 * sampleIdx.length);
  sampleIdx.forEach((i, k) => sample.set(frames[i].canvas.getContext('2d').getImageData(0, 0, width, height).data, k * width * height * 4));
  const palette = quantize(sample, 256);
  const gif = GIFEncoder();
  frames.forEach(({ canvas, delay }, i) => {
    const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    gif.writeFrame(applyPalette(data, palette), width, height, { palette: i === 0 ? palette : undefined, delay, repeat: 0 });
  });
  gif.finish();
  fs.writeFileSync(file, gif.bytes());
  execFileSync(gifsicle, ['-O3', '--batch', file]);
  console.log(path.basename(file), `${frames.length} frames`, `${(fs.statSync(file).size / 1e6).toFixed(2)} MB`);
}
