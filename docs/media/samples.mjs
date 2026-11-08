// Regenerates README sample images: real stencil PDF + punch dots for one
// shared example seed, rasterized and cropped to the card.
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(repo, 'docs/images');
const lib = await import(path.join(repo, 'dist/index.js'));
const { PDFDocument, rgb } = await import(path.join(repo, 'node_modules/pdf-lib/cjs/index.js'));
const { GeneratorParameters, PassphraseParameters, EncodingType, generateWriterPdf, generatePassphrasePdf, mm } = lib;

const wordlistSrc = fs.readFileSync(path.join(repo, 'src/generator/bip39Wordlist.ts'), 'utf8');
const WORDLIST = [...wordlistSrc.slice(wordlistSrc.indexOf('[')).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
if (WORDLIST.length !== 2048) throw new Error('wordlist parse failed: ' + WORDLIST.length);

const SEED12 = 'bike acid key satoshi orbit planet garden volume ribbon timber wisdom zebra'.split(' ');
const SEED24 = SEED12.concat('anchor canyon dolphin elbow fossil glimpse harbor island jungle lemon magnet noble'.split(' '));
for (const w of SEED24) if (!WORDLIST.includes(w)) throw new Error('not a BIP-39 word: ' + w);

const MARGIN_H = mm(15), MARGIN_TOP = mm(20), PAGE_H = mm(297);
const BINARY_HEADER = mm(6);
const BIN_VALUES = [1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1];
const PASS_VALUES = [64, 32, 16, 8, 4, 2, 1];
const PUNCH = rgb(0.12, 0.12, 0.12);

function punchSeed(page, p, words, cardOrigin) {
  const enc = p.seedEncoding;
  const cell = p.cellSize, word = p.wordSize, sec = p.sectionSize;
  const r = Math.min(cell.width, cell.height) * 0.36;
  const dot = (x, y) => page.drawCircle({ x, y: PAGE_H - y, size: r, color: PUNCH });
  p.getCardParameters(1).sections.forEach((section, si) => {
    const secY = cardOrigin.y + p.cardPadding + si * (sec.height + p.cardPadding);
    section.wordNumbers.forEach((wn, wi) => {
      const w = words[wn - 1];
      const x0 = cardOrigin.x + p.cardPadding + wi * word.width;
      const idx = WORDLIST.indexOf(w);
      if (enc === EncodingType.Binary) {
        BIN_VALUES.forEach((v, row) => {
          if (idx & v) dot(x0 + cell.width / 2, secY + row * cell.height + cell.height / 2);
        });
        return;
      }
      const chars = enc === EncodingType.Alphabet ? w.slice(0, 4).split('') : String(idx).padStart(4, '0').split('');
      chars.forEach((ch, col) => {
        const row = enc === EncodingType.Alphabet ? ch.charCodeAt(0) - 97 : Number(ch);
        dot(x0 + col * cell.width + cell.width / 2, secY + row * cell.height + cell.height / 2);
      });
    });
  });
}

function punchPassphrase(page, p, phrases, cardOrigin) {
  const cell = p.cellSize;
  const r = Math.min(cell.width, cell.height) * 0.36;
  phrases.forEach((phrase, bi) => {
    const y0 = cardOrigin.y + p.cardPadding + bi * (p.blockThickness + p.cardPadding);
    [...phrase].forEach((ch, ci) => {
      const code = ch.charCodeAt(0);
      PASS_VALUES.forEach((v, row) => {
        if (code & v) page.drawCircle({
          x: cardOrigin.x + p.cardPadding + ci * cell.width + cell.width / 2,
          y: PAGE_H - (y0 + row * cell.height + cell.height / 2), size: r, color: PUNCH,
        });
      });
    });
  });
}

async function rasterize(pdfBytes, crop, file) {
  const scale = 300 / 72;
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    standardFontDataUrl: path.join(path.dirname(new URL(import.meta.resolve('pdfjs-dist/package.json')).pathname), 'standard_fonts') + '/',
    disableFontFace: true,
  }).promise;
  const page = await doc.getPage(1);
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const [x, y, w, h] = crop.map((v) => Math.round(v * scale));
  const out = createCanvas(w, h);
  out.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
  fs.writeFileSync(path.join(outDir, file), await out.encode('png'));
  console.log(file, w + 'x' + h);
}

const m = mm(2.5), below = mm(2.1);

async function seedSample(file, input, words) {
  const p = new GeneratorParameters(input);
  const header = p.seedEncoding === EncodingType.Binary ? BINARY_HEADER : 0;
  const pdf = await PDFDocument.load(await generateWriterPdf(p));
  const cardOrigin = { x: MARGIN_H + header, y: MARGIN_TOP };
  punchSeed(pdf.getPage(0), p, words, cardOrigin);
  await rasterize(await pdf.save(), [cardOrigin.x - header - m, cardOrigin.y - m, p.cardSize.width + header + 2 * m, p.cardSize.height + m + below], file);
}

async function passphraseSample(file, input, phrases) {
  const p = new PassphraseParameters(input);
  const pdf = await PDFDocument.load(await generatePassphrasePdf(p));
  const cardOrigin = { x: MARGIN_H + BINARY_HEADER, y: MARGIN_TOP + BINARY_HEADER };
  punchPassphrase(pdf.getPage(0), p, phrases, cardOrigin);
  await rasterize(await pdf.save(), [MARGIN_H - m, MARGIN_TOP - m, p.cardSize.width + BINARY_HEADER + 2 * m, p.cardSize.height + BINARY_HEADER + m + below], file);
}

const creditCard = { width: mm(85.6), height: mm(54) };
await seedSample('seed-alphabet-single-line.png', { cardSize: creditCard, cardCount: 1, seedLength: 12, encoding: EncodingType.Alphabet }, SEED12);
await seedSample('seed-alphabet-multi-line.png', { cardSize: { width: mm(85.6), height: mm(100) }, cardCount: 1, seedLength: 24, cardSplit: 2, encoding: EncodingType.Alphabet }, SEED24);
await seedSample('seed-number.png', { cardSize: { width: mm(85.6), height: mm(21) }, cardCount: 1, seedLength: 12, encoding: EncodingType.Number }, SEED12);
await seedSample('seed-binary.png', { cardSize: { width: mm(40), height: mm(35) }, cardCount: 1, seedLength: 12, encoding: EncodingType.Binary }, SEED12);
await passphraseSample('passphrase.png', {
  cardSize: creditCard, cardPadding: mm(1.5), cardCornerRadius: mm(1.5), cardCount: 1, copies: 1, cellSize: { width: mm(2), height: mm(2) },
}, ['Satoshi2026!', 'my second phrase']);
