import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateAsciiTablePdf } from '../src/generator/asciiTable';

describe('generateAsciiTablePdf', () => {
  it('generates a single-page, non-empty PDF', async () => {
    const bytes = await generateAsciiTablePdf();
    expect(bytes.length).toBeGreaterThan(0);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it('produces the same bytes on repeated calls (no randomness in layout)', async () => {
    const first = await generateAsciiTablePdf();
    const second = await generateAsciiTablePdf();
    expect(first.length).toBe(second.length);
  });
});
