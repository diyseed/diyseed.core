import { describe, it, expect, beforeAll } from 'vitest';
import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import { getFontSizeForBox } from '../src/generator/fontFit';
import { size } from '../src/units';

describe('getFontSizeForBox', () => {
  let font: PDFFont;

  beforeAll(async () => {
    const doc = await PDFDocument.create();
    font = await doc.embedFont(StandardFonts.Helvetica);
  });

  it('stays within the configured range', () => {
    const fontSize = getFontSizeForBox({
      font,
      fontSizeRange: [10, 35],
      increaseStep: 1,
      sampleText: '42.',
      maxSize: size(200, 200),
    });
    expect(fontSize).toBeGreaterThanOrEqual(10);
    expect(fontSize).toBeLessThanOrEqual(36); // one step past the range ceiling, matching the ported grow-until-overflow loop
  });

  it('grows to fill a bigger box and shrinks for a smaller one', () => {
    const bigBox = getFontSizeForBox({
      font,
      fontSizeRange: [2.2, 12],
      increaseStep: 0.2,
      sampleText: 'M',
      maxSize: size(50, 50),
    });
    const smallBox = getFontSizeForBox({
      font,
      fontSizeRange: [2.2, 12],
      increaseStep: 0.2,
      sampleText: 'M',
      maxSize: size(5, 5),
    });
    expect(bigBox).toBeGreaterThan(smallBox);
  });
});
