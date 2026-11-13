import { PDFFont, PDFPage, rgb } from 'pdf-lib';
import * as Config from './config';
import { drawTextInBoxTL } from './pdfDraw';
import { point } from '../units';

// Header and footer on every page of every document (stencils, readers, reference tables). Its own module so
// the writer, reader and tables all import it directly - no import cycle, no lazy loading back into the writer.

export const HEADER_TEXT_COLOR = rgb(0, 0, 0);
export const FOOTER_TEXT_COLOR = rgb(0.608, 0.608, 0.608);

export function drawPageChrome(pages: PDFPage[], font: PDFFont, boldFont: PDFFont, headerText: string, paramsSummary: string): void {
  // The params summary sits to the right of the title, on the same line, in
  // small gray text - so it needs the title's own rendered width to know
  // where it can start.
  const titleWidth = boldFont.widthOfTextAtSize(headerText, Config.HEADER_FONT_SIZE);
  const summaryGap = Config.PARAMS_SUMMARY_GAP;
  const summaryX = Config.DOCUMENT_MARGIN_H + titleWidth + summaryGap;
  const summaryWidth = Math.max(0, Config.EFFECTIVE_PAGE_SIZE.width - titleWidth - summaryGap);

  for (const page of pages) {
    drawTextInBoxTL(
      page,
      headerText,
      boldFont,
      Config.HEADER_FONT_SIZE,
      point(Config.DOCUMENT_MARGIN_H, 0),
      { width: Config.EFFECTIVE_PAGE_SIZE.width, height: Config.DOCUMENT_MARGIN_TOP },
      { horizontal: 'left', vertical: 'center' },
      HEADER_TEXT_COLOR,
    );
    drawTextInBoxTL(
      page,
      paramsSummary,
      font,
      Config.PARAMS_SUMMARY_FONT_SIZE,
      point(summaryX, 0),
      { width: summaryWidth, height: Config.DOCUMENT_MARGIN_TOP },
      { horizontal: 'left', vertical: 'center' },
      FOOTER_TEXT_COLOR,
    );
    drawTextInBoxTL(
      page,
      Config.DOCUMENT_FOOTER_TEXT,
      font,
      Config.FOOTER_FONT_SIZE,
      point(Config.DOCUMENT_MARGIN_H, Config.DOCUMENT_SIZE.height - Config.DOCUMENT_MARGIN_BOTTOM),
      { width: Config.EFFECTIVE_PAGE_SIZE.width, height: Config.DOCUMENT_MARGIN_BOTTOM },
      { horizontal: 'right', vertical: 'top' },
      FOOTER_TEXT_COLOR,
    );
    drawTextInBoxTL(
      page,
      Config.DOCUMENT_FOOTER_URL,
      font,
      Config.FOOTER_FONT_SIZE,
      point(Config.DOCUMENT_MARGIN_H, Config.DOCUMENT_SIZE.height - Config.DOCUMENT_MARGIN_BOTTOM),
      { width: Config.EFFECTIVE_PAGE_SIZE.width, height: Config.DOCUMENT_MARGIN_BOTTOM },
      { horizontal: 'left', vertical: 'top' },
      FOOTER_TEXT_COLOR,
    );
  }
}
