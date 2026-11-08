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
    // pdf-lib stamps the current time into the metadata, so pin both dates
    // before comparing; anything else that differs is real layout randomness.
    const normalize = async (bytes: Uint8Array) => {
      const doc = await PDFDocument.load(bytes, { updateMetadata: false });
      doc.setCreationDate(new Date(0));
      doc.setModificationDate(new Date(0));
      return doc.save({ useObjectStreams: false });
    };
    const first = await normalize(await generateAsciiTablePdf());
    const second = await normalize(await generateAsciiTablePdf());
    expect(first).toEqual(second);
  });
});
