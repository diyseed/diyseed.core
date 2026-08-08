import type { PreviewCard, PreviewLayout, PreviewWord } from './preview';
import type { BinaryDirection } from '../generator/encoding';

const BINARY_BIT_COUNT = 11;

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
          layout.isBinary
            ? 'Cells are noticeably stretched — consider adjusting card count or card proportions for a more even grid.'
            : 'Cells are noticeably stretched — consider adjusting card split or card proportions for a more even grid.',
        ),
      );
    }
  }
  container.appendChild(warningsEl);

  if (layout.cards.length > 0) {
    const bigSection = document.createElement('div');
    bigSection.className = 'preview-big';
    bigSection.appendChild(
      layout.isBinary
        ? renderBinaryBigCard(layout.cards[0], layout.binaryColumnLabels, layout.binaryDirection)
        : renderBigCard(layout.cards[0], layout.cellRowLabels),
    );
    container.appendChild(bigSection);
  }

  const cardsEl = document.createElement('div');
  cardsEl.className = 'preview-cards';
  for (let set = 0; set < layout.copies; set++) {
    cardsEl.appendChild(
      renderCardSet(layout.cards, set, layout.copies, layout.isBinary, layout.binaryDirection),
    );
  }
  container.appendChild(cardsEl);
}

function warningBanner(kind: 'error' | 'warning', message: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `preview-warning preview-warning--${kind}`;
  el.textContent = message;
  return el;
}

function renderCardSet(
  cards: PreviewCard[],
  setIndex: number,
  copies: number,
  isBinary: boolean,
  binaryDirection: BinaryDirection,
): HTMLElement {
  const setEl = document.createElement('div');
  setEl.className = 'preview-set';

  if (copies > 1) {
    const label = document.createElement('div');
    label.className = 'preview-set__label';
    label.textContent = `Set ${setIndex + 1}`;
    setEl.appendChild(label);
  }

  const cardsRow = document.createElement('div');
  cardsRow.className = 'preview-set__cards';
  for (const card of cards) {
    cardsRow.appendChild(isBinary ? renderBinaryCard(card, binaryDirection) : renderCard(card));
  }
  setEl.appendChild(cardsRow);

  return setEl;
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

function binaryWordsOf(card: PreviewCard): PreviewWord[] {
  return card.sections.flatMap((section) => section.words);
}

function makeBinaryCell(wordShaded: boolean, bitShaded: boolean): HTMLElement {
  const cell = document.createElement('div');
  let className = 'preview-cell';
  if (wordShaded) className += ' preview-cell--shaded';
  if (bitShaded) className += ' preview-cell--col-shaded';
  cell.className = className;
  return cell;
}

function renderBinaryMesh(words: PreviewWord[], direction: BinaryDirection, showNumbers: boolean): HTMLElement {
  const mesh = document.createElement('div');
  mesh.className = 'preview-binary-mesh';

  const grid = document.createElement('div');
  grid.className = 'preview-binary-mesh__grid';

  if (direction === 'vertical') {
    grid.style.gridTemplateColumns = `repeat(${BINARY_BIT_COUNT}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${words.length}, 1fr)`;
    words.forEach((word) => {
      for (let bit = 0; bit < BINARY_BIT_COUNT; bit++) {
        grid.appendChild(makeBinaryCell(word.shaded, bit % 2 === 1));
      }
    });
  } else {
    grid.style.gridTemplateColumns = `repeat(${words.length}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${BINARY_BIT_COUNT}, 1fr)`;
    for (let bit = 0; bit < BINARY_BIT_COUNT; bit++) {
      words.forEach((word) => {
        grid.appendChild(makeBinaryCell(word.shaded, bit % 2 === 1));
      });
    }
  }
  mesh.appendChild(grid);

  if (showNumbers) {
    words.forEach((word, i) => {
      const numberEl = document.createElement('div');
      numberEl.textContent = String(word.wordNumber);
      if (direction === 'vertical') {
        numberEl.className = 'preview-binary-word-number preview-binary-word-number--row';
        numberEl.style.top = `${(i / words.length) * 100}%`;
        numberEl.style.height = `${(1 / words.length) * 100}%`;
      } else {
        numberEl.className = 'preview-binary-word-number preview-binary-word-number--column';
        numberEl.style.left = `${(i / words.length) * 100}%`;
        numberEl.style.width = `${(1 / words.length) * 100}%`;
      }
      mesh.appendChild(numberEl);
    });
  }

  return mesh;
}

function renderBinaryCard(card: PreviewCard, direction: BinaryDirection): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-card-wrapper';

  const box = document.createElement('div');
  box.className = 'preview-card preview-card--small';
  const widthPx = Math.min(card.cardWidthMm * SMALL_CARD_PX_PER_MM, SMALL_CARD_MAX_WIDTH_PX);
  box.style.width = `${widthPx}px`;
  box.style.aspectRatio = `${card.cardWidthMm} / ${card.cardHeightMm}`;

  box.appendChild(renderBinaryMesh(binaryWordsOf(card), direction, false));

  renderCornerMarks(box, card.cardNumber);
  wrapper.appendChild(box);
  wrapper.appendChild(renderCardLabel(card));

  return wrapper;
}

function renderBinaryHeader(labels: string[], side: 'top' | 'left'): { labels: HTMLElement; arrows: HTMLElement } {
  const labelsEl = document.createElement('div');
  labelsEl.className = side === 'top' ? 'preview-binary-header' : 'preview-binary-row-header';
  if (side === 'top') labelsEl.style.gridTemplateColumns = `repeat(${labels.length}, 1fr)`;
  else labelsEl.style.gridTemplateRows = `repeat(${labels.length}, 1fr)`;
  for (const label of labels) {
    const cell = document.createElement('div');
    cell.className = side === 'top' ? 'preview-binary-header__cell' : 'preview-binary-row-header__cell';
    cell.textContent = label;
    labelsEl.appendChild(cell);
  }

  const arrowsEl = document.createElement('div');
  arrowsEl.className = side === 'top' ? 'preview-binary-header-arrows' : 'preview-binary-row-header-arrows';
  if (side === 'top') arrowsEl.style.gridTemplateColumns = `repeat(${labels.length}, 1fr)`;
  else arrowsEl.style.gridTemplateRows = `repeat(${labels.length}, 1fr)`;
  for (let i = 0; i < labels.length; i++) {
    const arrow = document.createElement('div');
    arrow.className = side === 'top' ? 'preview-binary-header-arrow' : 'preview-binary-row-header-arrow';
    arrowsEl.appendChild(arrow);
  }

  return { labels: labelsEl, arrows: arrowsEl };
}

function renderBinaryBigCard(card: PreviewCard, columnLabels: string[], direction: BinaryDirection): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-card-wrapper';

  const box = document.createElement('div');
  box.className = 'preview-card preview-card--large';
  box.style.aspectRatio = `${card.cardWidthMm} / ${card.cardHeightMm}`;
  box.appendChild(renderBinaryMesh(binaryWordsOf(card), direction, true));
  renderCornerMarks(box, card.cardNumber);

  if (direction === 'vertical') {
    const header = renderBinaryHeader(columnLabels, 'top');
    wrapper.appendChild(header.labels);
    wrapper.appendChild(header.arrows);
    wrapper.appendChild(box);
  } else {
    const header = renderBinaryHeader(columnLabels, 'left');
    const row = document.createElement('div');
    row.className = 'preview-binary-horizontal-row';
    row.appendChild(header.labels);
    row.appendChild(header.arrows);
    row.appendChild(box);
    wrapper.appendChild(row);
  }

  const label = document.createElement('div');
  label.className = 'preview-card__label';
  label.textContent = 'Full detail';
  wrapper.appendChild(label);

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
