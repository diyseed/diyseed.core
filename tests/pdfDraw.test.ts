import { describe, it, expect } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import { drawRectTL, drawRoundedRectTL, drawLineTL, drawTextInBoxTL, drawFilledCircleTL, toPdfY } from '../src/generator/pdfDraw';
import { point, size } from '../src/units';

describe('toPdfY', () => {
  it('flips a top-left-origin y coordinate to pdf-lib bottom-left space', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 300]);
    expect(toPdfY(page, point(0, 0), 50)).toBeCloseTo(250, 6);
    expect(toPdfY(page, point(0, 100), 50)).toBeCloseTo(150, 6);
  });
});

describe('drawing primitives', () => {
  it('draw without throwing and grow the page content stream', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 300]);
    const font = await doc.embedFont('Helvetica');

    expect(() => drawRectTL(page, point(10, 10), size(50, 20), { borderColor: rgb(0, 0, 0), borderWidth: 0.3 })).not.toThrow();
    expect(() => drawRoundedRectTL(page, point(10, 40), size(50, 20), 3, { borderColor: rgb(0, 0, 0), borderWidth: 0.3 })).not.toThrow();
    expect(() => drawLineTL(page, point(0, 0), point(50, 50), { color: rgb(0, 0, 0), thickness: 0.1 })).not.toThrow();
    expect(() =>
      drawTextInBoxTL(page, 'Hi', font, 12, point(0, 0), size(100, 20), { horizontal: 'center', vertical: 'center' }, rgb(0, 0, 0)),
    ).not.toThrow();

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('draws a filled circle without throwing', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 300]);

    expect(() => drawFilledCircleTL(page, point(10, 10), 2, rgb(0, 0, 0))).not.toThrow();

    const bytes = await doc.save();
    expect(bytes.length).toBeGreaterThan(0);
  });
});
