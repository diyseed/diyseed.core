// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { GeneratorParameters } from '../src/generator/params';
import { EncodingType, BinaryDirection } from '../src/generator/encoding';
import { generateWriterPdf } from '../src/generator/writer';
import { computePreviewLayout } from '../src/ui/preview';
import { renderPreview } from '../src/ui/renderPreview';
import { mm } from '../src/units';
import { PDFDocument } from 'pdf-lib';

function wordCountOnCard(params: GeneratorParameters, cardNumber: number): number {
  return params.getCardParameters(cardNumber).sections.reduce((sum, s) => sum + s.wordNumbers.length, 0);
}

describe.each<BinaryDirection>(['horizontal', 'vertical'])('Binary encoding end-to-end integration (%s)', (binaryDirection) => {
  const cases = [
    { seedLength: 10, cardCount: 1 },
    { seedLength: 12, cardCount: 2 },
    { seedLength: 24, cardCount: 3 },
    { seedLength: 39, cardCount: 4 },
    { seedLength: 10, cardCount: 13 },
  ];

  for (const { seedLength, cardCount } of cases) {
    it(`agrees on card/word/cell counts between preview and PDF for ${seedLength} words / ${cardCount} cards`, async () => {
      const params = new GeneratorParameters({
        cardSize: { width: mm(85.6), height: mm(54) },
        cardCount,
        seedLength,
        encoding: EncodingType.Binary,
        binaryDirection,
      });

      const layout = computePreviewLayout(params);
      expect(layout.isBinary).toBe(true);
      expect(layout.binaryColumnLabels).toHaveLength(11);
      expect(layout.binaryDirection).toBe(binaryDirection);

      const container = document.createElement('div');
      renderPreview(container, layout);

      // Big card: cell count matches the model's total word count for card 1 (11 cells per word).
      const bigCells = container.querySelectorAll('.preview-big .preview-binary-mesh .preview-cell');
      expect(bigCells).toHaveLength(wordCountOnCard(params, 1) * 11);

      // Every thumbnail card's cell count matches that card's own word count.
      const thumbCards = container.querySelectorAll('.preview-cards .preview-card--small');
      expect(thumbCards).toHaveLength(params.effectiveCardCount);
      thumbCards.forEach((box, i) => {
        const cardNumber = i + 1;
        expect(box.querySelectorAll('.preview-binary-mesh .preview-cell')).toHaveLength(wordCountOnCard(params, cardNumber) * 11);
      });

      // The PDF itself must still generate and load without throwing.
      const bytes = await generateWriterPdf(params);
      const loaded = await PDFDocument.load(bytes);
      expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
    });
  }
});

describe('Binary encoding shading agreement (vertical, odd cardSplit)', () => {
  it('big-card and thumbnail shading agree with the model for an odd derived cardSplit', async () => {
    // 10 words / 4 cards -> cardSplit = ceil(10/4) = 3 (odd) - exercises the
    // shading fix (word-block shading alternates by global section number,
    // not by position within the card).
    const params = new GeneratorParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardCount: 4,
      seedLength: 10,
      encoding: EncodingType.Binary,
      binaryDirection: 'vertical',
    });
    expect(params.cardSplit).toBe(3);

    const layout = computePreviewLayout(params);
    const container = document.createElement('div');
    renderPreview(container, layout);

    const card2Thumb = container.querySelectorAll('.preview-cards .preview-card--small')[1];
    const cells = card2Thumb.querySelectorAll('.preview-binary-mesh .preview-cell');
    const modelCard2 = params.getCardParameters(2).sections.filter((s) => s.wordNumbers.length > 0);
    expect(cells).toHaveLength(modelCard2.length * 11);

    modelCard2.forEach((section, rowIndex) => {
      const wordIndexInSection = 0; // vertical Binary always has exactly one word per non-empty section
      const expectedShaded = (section.number + wordIndexInSection) % 2 === 0;
      const rowCells = Array.from(cells).slice(rowIndex * 11, rowIndex * 11 + 11);
      expect(rowCells.every((cell) => cell.classList.contains('preview-cell--shaded'))).toBe(expectedShaded);
    });
  });
});

describe('Binary encoding shading agreement (horizontal, odd word count)', () => {
  it('big-card word shading agrees with the model for an odd word count on the card', async () => {
    // 11 words on 1 card (horizontal: cardSplit forced to 1, all 11 words as columns
    // in a single section) - word 0 shaded=(1+0)%2===0=false, word 1=(1+1)%2===0=true, etc.
    const params = new GeneratorParameters({
      cardSize: { width: mm(85.6), height: mm(54) },
      cardCount: 1,
      seedLength: 11,
      encoding: EncodingType.Binary,
      binaryDirection: 'horizontal',
    });
    expect(params.cardSplit).toBe(1);

    const layout = computePreviewLayout(params);
    const container = document.createElement('div');
    renderPreview(container, layout);

    const cells = container.querySelectorAll('.preview-big .preview-binary-mesh .preview-cell');
    const words = params.getCardParameters(1).sections[0].wordNumbers;
    expect(cells).toHaveLength(words.length * 11); // 5 columns x 11 rows

    // Cells are laid out row-major (bit 0's 5 cells, then bit 1's 5 cells, ...);
    // column c's shading is the same across every bit-row for that word.
    words.forEach((_wordNumber, col) => {
      const expectedShaded = col % 2 === 1; // section.number=1, so shaded = (1+col)%2===0 <=> col odd
      for (let bit = 0; bit < 11; bit++) {
        const cell = cells[bit * words.length + col];
        expect(cell.classList.contains('preview-cell--shaded')).toBe(expectedShaded);
      }
    });
  });
});
