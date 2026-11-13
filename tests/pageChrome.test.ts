import { describe, it, expect, vi } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { drawPageChrome } from '../src/generator/pageChrome';
import * as Config from '../src/generator/config';

describe('drawPageChrome', () => {
  it('prints the website bottom-left and the source link bottom-right on every page', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const pages = [0, 1].map(() => doc.addPage([Config.DOCUMENT_SIZE.width, Config.DOCUMENT_SIZE.height]));
    const spies = pages.map((page) => vi.spyOn(page, 'drawText'));

    drawPageChrome(pages, font, bold, 'Title', 'summary');

    for (const spy of spies) {
      const drawn = spy.mock.calls.map(([text, options]) => ({ text, x: options!.x!, y: options!.y! }));
      const url = drawn.find((d) => d.text === Config.DOCUMENT_FOOTER_URL);
      const source = drawn.find((d) => d.text === Config.DOCUMENT_FOOTER_TEXT);
      expect(Config.DOCUMENT_FOOTER_URL).toBe('https://diyseed.net');
      expect(url, 'website footer drawn').toBeDefined();
      expect(source, 'source footer drawn').toBeDefined();
      // same line, left margin vs right edge (pdf-lib y is from the bottom)
      expect(url!.x).toBeCloseTo(Config.DOCUMENT_MARGIN_H, 3);
      expect(url!.y).toBeCloseTo(source!.y, 3);
      expect(url!.y).toBeLessThan(Config.DOCUMENT_MARGIN_BOTTOM);
      expect(source!.x).toBeGreaterThan(url!.x);
    }
  });
});
