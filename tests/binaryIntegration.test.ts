// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { GeneratorParameters } from '../src/generator/params';
import { EncodingType } from '../src/generator/encoding';
import { generateWriterPdf } from '../src/generator/writer';
import { computePreviewLayout } from '../src/ui/preview';
import { renderPreview } from '../src/ui/renderPreview';
import { mm } from '../src/units';
import { PDFDocument } from 'pdf-lib';

describe('Binary encoding end-to-end integration', () => {
  const cases = [
    { seedLength: 10, cardCount: 1 },
    { seedLength: 12, cardCount: 2 },
    { seedLength: 24, cardCount: 3 },
    { seedLength: 39, cardCount: 4 },
    { seedLength: 10, cardCount: 13 },
  ];

  for (const { seedLength, cardCount } of cases) {
    it(`agrees on card/row/column counts between preview and PDF for ${seedLength} words / ${cardCount} cards`, async () => {
      const params = new GeneratorParameters({
        cardSize: { width: mm(85.6), height: mm(54) },
        cardCount,
        seedLength,
        encoding: EncodingType.Binary,
      });

      const layout = computePreviewLayout(params);
      expect(layout.isBinary).toBe(true);
      expect(layout.binaryColumnLabels).toHaveLength(11);

      const container = document.createElement('div');
      renderPreview(container, layout);

      // Big card: cell count matches the model's non-empty sections for card 1 (11 cols each).
      const nonEmptySectionsCard1 = params.getCardParameters(1).sections.filter((s) => s.wordNumbers.length > 0);
      const bigCells = container.querySelectorAll('.preview-big .preview-binary-mesh .preview-cell');
      expect(bigCells).toHaveLength(nonEmptySectionsCard1.length * 11);

      // Every thumbnail card's cell count matches that card's own non-empty sections.
      const thumbCards = container.querySelectorAll('.preview-cards .preview-card--small');
      expect(thumbCards).toHaveLength(params.effectiveCardCount);
      thumbCards.forEach((box, i) => {
        const cardNumber = i + 1;
        const expectedRows = params.getCardParameters(cardNumber).sections.filter((s) => s.wordNumbers.length > 0).length;
        expect(box.querySelectorAll('.preview-binary-mesh .preview-cell')).toHaveLength(expectedRows * 11);
      });

      // The PDF itself must still generate and load without throwing.
      const bytes = await generateWriterPdf(params);
      const loaded = await PDFDocument.load(bytes);
      expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
    });
  }

  it('big-card and thumbnail shading agree with the model for an odd derived cardSplit', async () => {
    // 10 words / 3 cards -> cardSplit = ceil(10/3) = 4 (even, would mask the bug) - use
    // a combination that yields an odd cardSplit to actually exercise the shading fix.
    const params = new GeneratorParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardCount: 4,
      seedLength: 10,
      encoding: EncodingType.Binary,
    });
    // cardSplit = ceil(10/4) = 3 (odd) - card 2's sections are numbered 4,5,6 globally.
    expect(params.cardSplit).toBe(3);

    const layout = computePreviewLayout(params);
    const container = document.createElement('div');
    renderPreview(container, layout);

    const card2Thumb = container.querySelectorAll('.preview-cards .preview-card--small')[1];
    const cells = card2Thumb.querySelectorAll('.preview-binary-mesh .preview-cell');
    const modelCard2 = params.getCardParameters(2).sections.filter((s) => s.wordNumbers.length > 0);
    expect(cells).toHaveLength(modelCard2.length * 11);

    modelCard2.forEach((section, rowIndex) => {
      const wordIndexInSection = 0; // Binary always has exactly one word per non-empty section
      const expectedShaded = (section.number + wordIndexInSection) % 2 === 0;
      const rowCells = Array.from(cells).slice(rowIndex * 11, rowIndex * 11 + 11);
      expect(rowCells.every((cell) => cell.classList.contains('preview-cell--shaded'))).toBe(expectedShaded);
    });
  });
});
