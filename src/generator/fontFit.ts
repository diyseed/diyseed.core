import type { PDFFont } from 'pdf-lib';
import type { Size } from '../units';

export interface FontFitOptions {
  font: PDFFont;
  fontSizeRange: [number, number];
  increaseStep: number;
  sampleText: string;
  maxSize: Size;
}

export function getFontSizeForBox(options: FontFitOptions): number {
  const { font, fontSizeRange, increaseStep, sampleText, maxSize } = options;
  let fontSize = fontSizeRange[0] - increaseStep;
  let width: number;
  let height: number;

  do {
    fontSize += increaseStep;
    width = font.widthOfTextAtSize(sampleText, fontSize);
    height = font.heightAtSize(fontSize);
  } while (fontSize <= fontSizeRange[1] && width < maxSize.width && height < maxSize.height);

  return fontSize;
}
