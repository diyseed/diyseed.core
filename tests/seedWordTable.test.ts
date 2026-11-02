import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateSeedWordTablePdf } from '../src/generator/seedWordTable';
import { BIP39_WORDLIST } from '../src/generator/bip39Wordlist';

describe('BIP39_WORDLIST', () => {
  it('has exactly 2048 unique words', () => {
    expect(BIP39_WORDLIST.length).toBe(2048);
    expect(new Set(BIP39_WORDLIST).size).toBe(2048);
  });
});

describe('generateSeedWordTablePdf', () => {
  it('generates a non-empty, multi-page PDF (2048 words don\'t fit on one page)', async () => {
    const bytes = await generateSeedWordTablePdf();
    expect(bytes.length).toBeGreaterThan(0);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThan(1);
  });

  it('produces the same page count on repeated calls (no randomness in layout)', async () => {
    const first = await PDFDocument.load(await generateSeedWordTablePdf());
    const second = await PDFDocument.load(await generateSeedWordTablePdf());
    expect(first.getPageCount()).toBe(second.getPageCount());
  });
});
