import type { PreviewCard, PreviewLayout, PreviewWord, PassphrasePreviewLayout, PassphraseCard } from './preview';

const BINARY_BIT_COUNT = 11;
const PASSPHRASE_BIT_COUNT = 7;

const SMALL_CARD_PX_PER_MM = 1.5;
const SMALL_CARD_MAX_WIDTH_PX = 160;

export function renderPreview(container: HTMLElement, layout: PreviewLayout | null, passphraseLayout: PassphrasePreviewLayout | null = null): void {
  container.innerHTML = '';

  if (!layout && !passphraseLayout) {
    const placeholder = document.createElement('p');
    placeholder.className = 'preview-placeholder';
    placeholder.textContent = 'Fill in valid values above to see a preview.';
    container.appendChild(placeholder);
    return;
  }

  if (layout) {
    const seedTitle = document.createElement('h2');
    seedTitle.className = 'preview-section-title';
    seedTitle.textContent = 'Seed';
    container.appendChild(seedTitle);

    renderSeedPreviewContent(container, layout);
  }

  if (passphraseLayout) {
    // The title lives inside the bordered section, not before it - .preview-
    // passphrase's border-top is the separator from the seed preview above,
    // and that line belongs above the "Passphrase" heading, not between the
    // heading and its own content.
    const passphraseSection = document.createElement('div');
    passphraseSection.className = 'preview-passphrase';

    const passphraseTitle = document.createElement('h2');
    passphraseTitle.className = 'preview-section-title';
    passphraseTitle.textContent = 'Passphrase';
    passphraseSection.appendChild(passphraseTitle);

    renderPassphrasePreviewContent(passphraseSection, passphraseLayout);
    container.appendChild(passphraseSection);
  }
}

const DEFAULT_PLACEHOLDER_TEXT = 'Fill in valid values above to see a preview.';
// Shown instead once the section's own Stencil checkbox is off - the layout
// is withheld deliberately then (nothing invalid about the values), so the
// generic "fill in valid values" message would be misleading.
export const STENCIL_UNCHECKED_PLACEHOLDER_TEXT = 'Check Stencil above to preview the card.';

// Renders just the Seed half of the preview, for embedding at the bottom of
// the Seed section's own box - no "Seed" heading (the section already has
// one), so this isn't just renderPreview(container, layout, null).
export function renderSeedPreview(container: HTMLElement, layout: PreviewLayout | null, placeholderText = DEFAULT_PLACEHOLDER_TEXT): void {
  container.innerHTML = '';
  if (!layout) {
    renderPreviewPlaceholder(container, placeholderText);
    return;
  }
  renderSeedPreviewContent(container, layout);
}

// Renders just the Passphrase half, for embedding at the bottom of the
// Passphrase section's own box - same rationale as renderSeedPreview.
export function renderPassphrasePreview(
  container: HTMLElement,
  layout: PassphrasePreviewLayout | null,
  placeholderText = DEFAULT_PLACEHOLDER_TEXT,
): void {
  container.innerHTML = '';
  if (!layout) {
    renderPreviewPlaceholder(container, placeholderText);
    return;
  }
  renderPassphrasePreviewContent(container, layout);
}

function renderPreviewPlaceholder(container: HTMLElement, text: string): void {
  const placeholder = document.createElement('p');
  placeholder.className = 'preview-placeholder';
  placeholder.textContent = text;
  container.appendChild(placeholder);
}

function warningBanner(kind: 'error' | 'warning', message: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `preview-warning preview-warning--${kind}`;
  el.textContent = message;
  return el;
}

function renderSeedPreviewContent(container: HTMLElement, layout: PreviewLayout): void {
  const warningsEl = document.createElement('div');
  warningsEl.className = 'preview-warnings';
  warningsEl.setAttribute('aria-live', 'polite');

  if (layout.warnings.cellSizeInvalid) {
    warningsEl.appendChild(warningBanner('error', 'Something went wrong computing the cell size for this configuration.'));
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
    cardsEl.appendChild(renderCardSet(layout.cards, set, layout.copies, layout.isBinary));
  }
  container.appendChild(cardsEl);
}

function renderPassphrasePreviewContent(container: HTMLElement, layout: PassphrasePreviewLayout): void {
  if (layout.warnings.noCapacity) {
    container.appendChild(warningBanner('error', 'No characters fit at this cell size — try a bigger card, smaller cells, or less padding.'));
  } else if (layout.warnings.cellTooSmall) {
    container.appendChild(
      warningBanner('warning', `Cells are ${layout.cellWidthMm.toFixed(1)}×${layout.cellHeightMm.toFixed(1)}mm — smaller than 1.5mm may be hard to punch by hand.`),
    );
  }

  if (layout.cards.length === 0) return;

  const bigSection = document.createElement('div');
  bigSection.className = 'preview-big';
  bigSection.appendChild(renderPassphraseBigCard(layout.cards[0], layout.columnLabels));
  container.appendChild(bigSection);

  const cardsEl = document.createElement('div');
  cardsEl.className = 'preview-cards';
  for (let set = 0; set < layout.copies; set++) {
    const setEl = document.createElement('div');
    setEl.className = 'preview-set';
    if (layout.copies > 1) {
      const label = document.createElement('div');
      label.className = 'preview-set__label';
      label.textContent = `Set ${set + 1}`;
      setEl.appendChild(label);
    }
    const cardsRow = document.createElement('div');
    cardsRow.className = 'preview-set__cards';
    for (const card of layout.cards) {
      cardsRow.appendChild(renderPassphraseThumbnail(card));
    }
    setEl.appendChild(cardsRow);
    cardsEl.appendChild(setEl);
  }
  container.appendChild(cardsEl);
}

function passphraseWordsOf(block: number[]): PreviewWord[] {
  return block.map((position) => ({ wordNumber: position, shaded: position % 2 === 0 }));
}

// Each block gets its own wrapper (not the mesh directly) so its row-mark
// dots can sit just above/below *that block's* own mesh - matching
// drawPassphraseBlockTopMarks in writer.ts, which marks rows, not cards.
function renderPassphraseMeshArea(blocks: number[][], showNumbers: boolean, startRowNumber: number): HTMLElement[] {
  return blocks.map((block, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-passphrase-block';
    wrapper.appendChild(renderBinaryMesh(passphraseWordsOf(block), showNumbers, PASSPHRASE_BIT_COUNT));
    renderRowCornerMarks(wrapper, startRowNumber + i, i === blocks.length - 1);
    return wrapper;
  });
}

function renderPassphraseBigCard(card: PassphraseCard, columnLabels: string[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-card-wrapper';

  const box = document.createElement('div');
  box.className = 'preview-card preview-card--large';
  box.style.aspectRatio = `${card.cardWidthMm} / ${card.cardHeightMm}`;
  // Position numbers now live in their own header (below), not as an overlay
  // on the mesh - with dozens of narrow character columns, the old overlay
  // numbers overlapped into an unreadable smear.
  for (const el of renderPassphraseMeshArea(card.blocks, false, card.startRowNumber)) {
    box.appendChild(el);
  }

  const blockCount = card.blocks.length;
  const leftHeader = renderPassphraseHeaderGroup(columnLabels, blockCount);
  // Every block holds a separate passphrase, so they all share the same
  // column numbering (1..charsPerBlock) - one shared header above/left of
  // the whole card, not one repeated per block.
  const topHeader = renderBinaryHeader(card.blocks[0].map(String), 'top');

  // `figure` is sized by `box` alone - its only normal-flow child. Both
  // header bands are taken out of flow (position: absolute) and stretched
  // against *that* size via 100%, so neither header's own natural content
  // size (e.g. a tall stack of per-block place-value headers wanting more
  // room than actually exists) can inflate box's row/column in turn - the
  // failure mode a shared-row/column CSS Grid had here before: box's row in
  // such a grid sizes to the *tallest* cell sharing it, so once headers
  // wanted more height than box's own aspect-ratio gave it, the row grew to
  // match the headers instead of the other way around, and box (which won't
  // stretch past its own ratio) was left sitting shorter than the header
  // labeling it - drifting the two further apart with every added block.
  const figure = document.createElement('div');
  figure.className = 'preview-passphrase-figure';

  const topBand = document.createElement('div');
  topBand.className = 'preview-passphrase-header-band preview-passphrase-header-band--top';
  topBand.append(topHeader.labels, topHeader.arrows);

  const leftBand = document.createElement('div');
  leftBand.className = 'preview-passphrase-header-band preview-passphrase-header-band--left';
  leftBand.append(leftHeader.labels, leftHeader.arrows);

  figure.append(topBand, leftBand, box);
  wrapper.appendChild(figure);

  const label = document.createElement('div');
  label.className = 'preview-card__label';
  label.textContent = 'Full detail';
  wrapper.appendChild(label);

  return wrapper;
}

// Thumbnails skip both the per-cell mesh and the row-mark dots - at
// thumbnail scale they're illegible anyway, just visual noise - and show
// each block as a plain box instead, the same treatment the non-binary seed
// thumbnail (renderCard) gives its sections.
function renderPassphraseThumbnail(card: PassphraseCard): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-card-wrapper';

  const box = document.createElement('div');
  box.className = 'preview-card preview-card--small';
  const widthPx = Math.min(card.cardWidthMm * SMALL_CARD_PX_PER_MM, SMALL_CARD_MAX_WIDTH_PX);
  box.style.width = `${widthPx}px`;
  box.style.aspectRatio = `${card.cardWidthMm} / ${card.cardHeightMm}`;

  card.blocks.forEach(() => {
    const blockEl = document.createElement('div');
    blockEl.className = 'preview-passphrase-block preview-passphrase-block--plain';
    box.appendChild(blockEl);
  });

  wrapper.appendChild(box);
  const label = document.createElement('div');
  label.className = 'preview-card__label';
  label.textContent = `Card ${card.cardNumber}`;
  wrapper.appendChild(label);

  return wrapper;
}

function renderCardSet(cards: PreviewCard[], setIndex: number, copies: number, isBinary: boolean): HTMLElement {
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
    cardsRow.appendChild(isBinary ? renderBinaryCard(card) : renderCard(card));
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

function renderBinaryMesh(words: PreviewWord[], showNumbers: boolean, bitCount: number = BINARY_BIT_COUNT): HTMLElement {
  const mesh = document.createElement('div');
  mesh.className = 'preview-binary-mesh';

  const grid = document.createElement('div');
  grid.className = 'preview-binary-mesh__grid';

  grid.style.gridTemplateColumns = `repeat(${words.length}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${bitCount}, 1fr)`;
  for (let bit = 0; bit < bitCount; bit++) {
    words.forEach((word) => {
      grid.appendChild(makeBinaryCell(word.shaded, bit % 2 === 1));
    });
  }
  mesh.appendChild(grid);

  if (showNumbers) {
    words.forEach((word, i) => {
      const numberEl = document.createElement('div');
      numberEl.textContent = String(word.wordNumber);
      numberEl.className = 'preview-binary-word-number preview-binary-word-number--column';
      numberEl.style.left = `${(i / words.length) * 100}%`;
      numberEl.style.width = `${(1 / words.length) * 100}%`;
      mesh.appendChild(numberEl);
    });
  }

  return mesh;
}

function renderBinaryCard(card: PreviewCard): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-card-wrapper';

  const box = document.createElement('div');
  box.className = 'preview-card preview-card--small';
  const widthPx = Math.min(card.cardWidthMm * SMALL_CARD_PX_PER_MM, SMALL_CARD_MAX_WIDTH_PX);
  box.style.width = `${widthPx}px`;
  box.style.aspectRatio = `${card.cardWidthMm} / ${card.cardHeightMm}`;

  box.appendChild(renderBinaryMesh(binaryWordsOf(card), false));

  wrapper.appendChild(box);
  wrapper.appendChild(renderCardLabel(card));

  return wrapper;
}

// Fixed 0.85rem reads fine for the handful of place-value columns (<=11), but
// with dozens of narrow per-character position columns it no longer fits -
// shrink it as the column/row count grows so labels compress instead of
// overlapping their neighbors.
function headerCellFontSize(count: number): string {
  if (count <= 11) return '0.85rem';
  if (count <= 24) return '0.75rem';
  if (count <= 36) return '0.65rem';
  return '0.58rem';
}

function renderBinaryHeader(labels: string[], side: 'top' | 'left'): { labels: HTMLElement; arrows: HTMLElement } {
  const labelsEl = document.createElement('div');
  labelsEl.className = side === 'top' ? 'preview-binary-header' : 'preview-binary-row-header';
  labelsEl.style.setProperty('--header-cell-font-size', headerCellFontSize(labels.length));
  // minmax(0, 1fr), not bare 1fr: a bare 1fr track's automatic minimum is
  // its content's min-content size, so a label's text (its font's line
  // height) sets a floor under how far the track can shrink - harmless for
  // one header, but when several of these are stacked into a shared,
  // already-tight height (grouped per-block headers - see
  // renderPassphraseHeaderGroup) that floor is what forces the header out of
  // alignment with the mesh instead of shrinking to match it.
  if (side === 'top') labelsEl.style.gridTemplateColumns = `repeat(${labels.length}, minmax(0, 1fr))`;
  else labelsEl.style.gridTemplateRows = `repeat(${labels.length}, minmax(0, 1fr))`;
  for (const label of labels) {
    const cell = document.createElement('div');
    cell.className = side === 'top' ? 'preview-binary-header__cell' : 'preview-binary-row-header__cell';
    cell.textContent = label;
    labelsEl.appendChild(cell);
  }

  const arrowsEl = document.createElement('div');
  arrowsEl.className = side === 'top' ? 'preview-binary-header-arrows' : 'preview-binary-row-header-arrows';
  if (side === 'top') arrowsEl.style.gridTemplateColumns = `repeat(${labels.length}, minmax(0, 1fr))`;
  else arrowsEl.style.gridTemplateRows = `repeat(${labels.length}, minmax(0, 1fr))`;
  for (let i = 0; i < labels.length; i++) {
    const arrow = document.createElement('div');
    arrow.className = side === 'top' ? 'preview-binary-header-arrow' : 'preview-binary-row-header-arrow';
    arrowsEl.appendChild(arrow);
  }

  return { labels: labelsEl, arrows: arrowsEl };
}

function renderPassphraseHeaderGroup(columnLabels: string[], blockCount: number): { labels: HTMLElement; arrows: HTMLElement } {
  const groupClass = 'preview-passphrase-header-group preview-passphrase-header-group--column';
  const labelsGroup = document.createElement('div');
  labelsGroup.className = groupClass;
  const arrowsGroup = document.createElement('div');
  arrowsGroup.className = groupClass;

  for (let b = 0; b < blockCount; b++) {
    const header = renderBinaryHeader(columnLabels, 'left');
    header.labels.classList.add('preview-passphrase-header-group__item');
    header.arrows.classList.add('preview-passphrase-header-group__item');
    labelsGroup.appendChild(header.labels);
    arrowsGroup.appendChild(header.arrows);
  }

  return { labels: labelsGroup, arrows: arrowsGroup };
}

function renderBinaryBigCard(card: PreviewCard, columnLabels: string[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'preview-card-wrapper';

  const box = document.createElement('div');
  box.className = 'preview-card preview-card--large';
  box.style.aspectRatio = `${card.cardWidthMm} / ${card.cardHeightMm}`;
  box.appendChild(renderBinaryMesh(binaryWordsOf(card), true));
  renderCornerMarks(box, card.cardNumber);

  const header = renderBinaryHeader(columnLabels, 'left');
  const row = document.createElement('div');
  row.className = 'preview-binary-horizontal-row';
  row.appendChild(header.labels);
  row.appendChild(header.arrows);
  row.appendChild(box);
  wrapper.appendChild(row);

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

  card.sections.forEach((section, i) => {
    const row = document.createElement('div');
    row.className = 'preview-section preview-section--mesh';
    row.style.gridTemplateColumns = `repeat(${section.words.length}, 1fr)`;
    for (const word of section.words) {
      row.appendChild(renderWordMesh(word, cellRowLabels));
    }
    // One row-mark cluster per section, counted by the section's own number
    // (equal to the card number when Card split is 1) - mirrors writer.ts's
    // per-section drawRowTopMarks, so a card with more than one row can tell
    // its rows apart by dots too, not just its cards.
    renderRowCornerMarks(row, section.sectionNumber, i === card.sections.length - 1);
    box.appendChild(row);
  });

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

// Row-mark dots for one row (a passphrase block, or a seed card-split
// section): a top-left cluster sized to the row number and a single
// top-right dot, both just above this row's own mesh; the last row also
// gets the single bottom-left dot that closes off the whole card. Mirrors
// drawRowTopMarks/the trailing bottom-left mark in writer.ts - counting rows
// (continuing across cards for passphrase, or across sections for a card's
// own rows), not cards themselves.
function renderRowCornerMarks(wrapper: HTMLElement, rowNumber: number, isLastRow: boolean): void {
  for (let i = 0; i < rowNumber; i++) {
    const dot = document.createElement('span');
    dot.className = 'corner-mark corner-mark--top-left';
    dot.style.left = `${3 + i * 6}px`;
    wrapper.appendChild(dot);
  }

  const rightDot = document.createElement('span');
  rightDot.className = 'corner-mark corner-mark--top-right';
  wrapper.appendChild(rightDot);

  if (isLastRow) {
    const bottomLeftDot = document.createElement('span');
    bottomLeftDot.className = 'corner-mark corner-mark--bottom-left';
    wrapper.appendChild(bottomLeftDot);
  }
}

// Used where a card has no row-level structure to peg dots to (Binary's
// preview keeps a single combined mesh rather than per-row wrapper
// elements) - one dot cluster for the whole card.
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

  const bottomLeftDot = document.createElement('span');
  bottomLeftDot.className = 'corner-mark corner-mark--bottom-left';
  box.appendChild(bottomLeftDot);
}
