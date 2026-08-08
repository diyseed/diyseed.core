import type { PreviewCard, PreviewLayout, PreviewSection, PreviewWord } from './preview';

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
      layout.isBinary ? renderBinaryBigCard(layout.cards[0], layout.binaryColumnLabels) : renderBigCard(layout.cards[0], layout.cellRowLabels),
    );
    container.appendChild(bigSection);
  }

  const cardsEl = document.createElement('div');
  cardsEl.className = 'preview-cards';
  for (let set = 0; set < layout.copies; set++) {
    cardsEl.appendChild(renderCardSet(layout.cards, set, layout.copies, layout.isBinary, layout.binaryColumnLabels.length));
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
  binaryColumnCount: number,
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
    cardsRow.appendChild(isBinary ? renderBinaryCard(card, binaryColumnCount) : renderCard(card));
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

function renderBinaryMesh(rows: PreviewSection[], columnCount: number, showNumbers: boolean): HTMLElement {
  const mesh = document.createElement('div');
  mesh.className = 'preview-binary-mesh';

  const grid = document.createElement('div');
  grid.className = 'preview-binary-mesh__grid';
  grid.style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rows.length}, 1fr)`;
  rows.forEach((section) => {
    const shaded = section.words[0]?.shaded ?? false;
    for (let col = 0; col < columnCount; col++) {
      const cell = document.createElement('div');
      let className = 'preview-cell';
      if (shaded) className += ' preview-cell--shaded';
      if (col % 2 === 1) className += ' preview-cell--col-shaded';
      cell.className = className;
      grid.appendChild(cell);
    }
  });
  mesh.appendChild(grid);

  if (showNumbers) {
    rows.forEach((section, rowIndex) => {
      const numberEl = document.createElement('div');
      numberEl.className = 'preview-binary-row__number';
      numberEl.textContent = String(section.words[0].wordNumber);
      numberEl.style.top = `${(rowIndex / rows.length) * 100}%`;
      numberEl.style.height = `${(1 / rows.length) * 100}%`;
      mesh.appendChild(numberEl);
    });
  }

  return mesh;
}

function renderBinaryCard(card: PreviewCard, columnCount: number): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-card-wrapper';

  const box = document.createElement('div');
  box.className = 'preview-card preview-card--small';
  const widthPx = Math.min(card.cardWidthMm * SMALL_CARD_PX_PER_MM, SMALL_CARD_MAX_WIDTH_PX);
  box.style.width = `${widthPx}px`;
  box.style.aspectRatio = `${card.cardWidthMm} / ${card.cardHeightMm}`;

  const rows = card.sections.filter((section) => section.words.length > 0);
  box.appendChild(renderBinaryMesh(rows, columnCount, false));

  renderCornerMarks(box, card.cardNumber);
  wrapper.appendChild(box);
  wrapper.appendChild(renderCardLabel(card));

  return wrapper;
}

function renderBinaryBigCard(card: PreviewCard, columnLabels: string[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-card-wrapper';

  const header = document.createElement('div');
  header.className = 'preview-binary-header';
  header.style.gridTemplateColumns = `repeat(${columnLabels.length}, 1fr)`;
  for (const label of columnLabels) {
    const cell = document.createElement('div');
    cell.className = 'preview-binary-header__cell';
    cell.textContent = label;
    header.appendChild(cell);
  }
  wrapper.appendChild(header);

  const arrowRow = document.createElement('div');
  arrowRow.className = 'preview-binary-header-arrows';
  arrowRow.style.gridTemplateColumns = `repeat(${columnLabels.length}, 1fr)`;
  for (let i = 0; i < columnLabels.length; i++) {
    const arrow = document.createElement('div');
    arrow.className = 'preview-binary-header-arrow';
    arrowRow.appendChild(arrow);
  }
  wrapper.appendChild(arrowRow);

  const box = document.createElement('div');
  box.className = 'preview-card preview-card--large';
  box.style.aspectRatio = `${card.cardWidthMm} / ${card.cardHeightMm}`;

  const rows = card.sections.filter((section) => section.words.length > 0);
  box.appendChild(renderBinaryMesh(rows, columnLabels.length, true));

  renderCornerMarks(box, card.cardNumber);
  wrapper.appendChild(box);

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
