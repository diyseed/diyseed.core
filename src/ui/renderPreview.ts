import type { PreviewCard, PreviewLayout, PreviewWord } from './preview';

const SMALL_CARD_PX_PER_MM = 1.5;
const SMALL_CARD_MAX_WIDTH_PX = 160;

export function renderPreview(container: HTMLElement, layout: PreviewLayout | null): void {
  container.innerHTML = '';

  if (!layout) {
    const placeholder = document.createElement('p');
    placeholder.className = 'preview-placeholder';
    placeholder.textContent = 'Fill in valid values above to see a preview.';
    container.appendChild(placeholder);
    return;
  }

  const warningsEl = document.createElement('div');
  warningsEl.className = 'preview-warnings';
  warningsEl.setAttribute('aria-live', 'polite');

  if (layout.warnings.cellSizeInvalid) {
    warningsEl.appendChild(
      warningBanner('error', 'Something went wrong computing the cell size for this configuration.'),
    );
  } else {
    if (layout.warnings.cellTooSmall) {
      warningsEl.appendChild(
        warningBanner(
          'warning',
          `Cells are ${layout.cellWidthMm.toFixed(1)}×${layout.cellHeightMm.toFixed(1)}mm — smaller than 1.5mm may be hard to punch by hand. Try a bigger card, fewer words per card, or more cards.`,
        ),
      );
    }
    if (layout.warnings.cellNotSquare) {
      warningsEl.appendChild(
        warningBanner(
          'warning',
          'Cells are noticeably stretched — consider adjusting card split or card proportions for a more even grid.',
        ),
      );
    }
  }
  container.appendChild(warningsEl);

  if (layout.cards.length > 0) {
    const bigSection = document.createElement('div');
    bigSection.className = 'preview-big';
    bigSection.appendChild(renderBigCard(layout.cards[0], layout.cellRowLabels));
    container.appendChild(bigSection);
  }

  const cardsEl = document.createElement('div');
  cardsEl.className = 'preview-cards';
  for (let set = 0; set < layout.copies; set++) {
    for (const card of layout.cards) {
      cardsEl.appendChild(renderCard(card));
    }
  }
  container.appendChild(cardsEl);
}

function warningBanner(kind: 'error' | 'warning', message: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `preview-warning preview-warning--${kind}`;
  el.textContent = message;
  return el;
}

function renderCard(card: PreviewCard): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-card-wrapper';

  const box = document.createElement('div');
  box.className = 'preview-card preview-card--small';
  const widthPx = Math.min(card.cardWidthMm * SMALL_CARD_PX_PER_MM, SMALL_CARD_MAX_WIDTH_PX);
  box.style.width = `${widthPx}px`;
  box.style.aspectRatio = `${card.cardWidthMm} / ${card.cardHeightMm}`;

  card.sections.forEach((section, index) => {
    const row = document.createElement('div');
    row.className = 'preview-section' + (index % 2 === 1 ? ' preview-section--shaded' : '');
    for (const _word of section.words) {
      const cell = document.createElement('div');
      cell.className = 'preview-word';
      row.appendChild(cell);
    }
    box.appendChild(row);
  });

  renderCornerMarks(box, card.cardNumber);
  wrapper.appendChild(box);
  wrapper.appendChild(renderCardLabel(card));

  return wrapper;
}

function renderBigCard(card: PreviewCard, cellRowLabels: string[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-card-wrapper';

  const box = document.createElement('div');
  box.className = 'preview-card preview-card--large';
  box.style.aspectRatio = `${card.cardWidthMm} / ${card.cardHeightMm}`;

  for (const section of card.sections) {
    const row = document.createElement('div');
    row.className = 'preview-section preview-section--mesh';
    row.style.gridTemplateColumns = `repeat(${section.words.length}, 1fr)`;
    for (const word of section.words) {
      row.appendChild(renderWordMesh(word, cellRowLabels));
    }
    box.appendChild(row);
  }

  renderCornerMarks(box, card.cardNumber);
  wrapper.appendChild(box);

  const label = document.createElement('div');
  label.className = 'preview-card__label';
  label.textContent = 'Full detail';
  wrapper.appendChild(label);

  return wrapper;
}

function renderWordMesh(word: PreviewWord, cellRowLabels: string[]): HTMLElement {
  const wordEl = document.createElement('div');
  wordEl.className = 'preview-word-mesh' + (word.shaded ? ' preview-word-mesh--shaded' : '');

  const grid = document.createElement('div');
  grid.className = 'preview-word-mesh__grid';
  grid.style.gridTemplateRows = `repeat(${cellRowLabels.length}, 1fr)`;
  const cellCount = cellRowLabels.length * 4;
  for (let i = 0; i < cellCount; i++) {
    const cellEl = document.createElement('div');
    cellEl.className = 'preview-cell';
    grid.appendChild(cellEl);
  }
  wordEl.appendChild(grid);

  const numberEl = document.createElement('div');
  numberEl.className = 'preview-word-mesh__number';
  numberEl.textContent = String(word.wordNumber);
  wordEl.appendChild(numberEl);

  return wordEl;
}

function renderCardLabel(card: PreviewCard): HTMLElement {
  const label = document.createElement('div');
  label.className = 'preview-card__label';
  label.textContent = card.sideLabel;
  return label;
}

function renderCornerMarks(box: HTMLElement, cardNumber: number): void {
  for (let i = 0; i < cardNumber; i++) {
    const dot = document.createElement('span');
    dot.className = 'corner-mark corner-mark--top-left';
    dot.style.left = `${3 + i * 6}px`;
    box.appendChild(dot);
  }

  const rightDot = document.createElement('span');
  rightDot.className = 'corner-mark corner-mark--top-right';
  box.appendChild(rightDot);
}
