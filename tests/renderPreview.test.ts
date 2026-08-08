// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderPreview } from '../src/ui/renderPreview';
import type { PreviewLayout, PreviewCard } from '../src/ui/preview';

function makeCard(overrides: Partial<PreviewCard> = {}): PreviewCard {
  return {
    cardNumber: 1,
    cardCount: 2,
    physicalCardNumber: 1,
    sideLabel: 'Card 1, side A',
    cardWidthMm: 100,
    cardHeightMm: 60,
    sections: [
      {
        sectionNumber: 1,
        words: [
          { wordNumber: 1, shaded: false },
          { wordNumber: 2, shaded: true },
        ],
      },
    ],
    ...overrides,
  };
}

function makeLayout(overrides: Partial<PreviewLayout> = {}): PreviewLayout {
  return {
    cards: [
      makeCard(),
      makeCard({
        cardNumber: 2,
        physicalCardNumber: 1,
        sideLabel: 'Card 1, side B',
        sections: [
          {
            sectionNumber: 2,
            words: [
              { wordNumber: 3, shaded: false },
              { wordNumber: 4, shaded: true },
            ],
          },
        ],
      }),
    ],
    cellWidthMm: 10,
    cellHeightMm: 10,
    cellRowLabels: ['a', 'b', 'c'],
    isBinary: false,
    binaryColumnLabels: [],
    copies: 1,
    warnings: { cellTooSmall: false, cellNotSquare: false, cellSizeInvalid: false },
    ...overrides,
  };
}

describe('renderPreview', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('shows a neutral placeholder when layout is null', () => {
    renderPreview(container, null);
    expect(container.querySelector('.preview-placeholder')).not.toBeNull();
    expect(container.querySelector('.preview-cards')).toBeNull();
  });

  it('renders a big detailed view of the first card plus a thumbnail row of every card', () => {
    renderPreview(container, makeLayout());
    expect(container.querySelectorAll('.preview-big .preview-card--large')).toHaveLength(1);
    expect(container.querySelectorAll('.preview-cards .preview-card--small')).toHaveLength(2);
  });

  it('shows exactly one big card even when copies is greater than 1', () => {
    renderPreview(container, makeLayout({ copies: 3 }));
    expect(container.querySelectorAll('.preview-big .preview-card--large')).toHaveLength(1);
  });

  it('labels each card with its side, as a caption below the card box (not inside it)', () => {
    renderPreview(container, makeLayout());
    const wrappers = container.querySelectorAll('.preview-cards .preview-card-wrapper');
    expect(wrappers).toHaveLength(2);

    const first = wrappers[0];
    const box = first.querySelector('.preview-card') as HTMLElement;
    const label = first.querySelector('.preview-card__label') as HTMLElement;
    expect(label.textContent).toBe('Card 1, side A');
    expect(box.contains(label)).toBe(false);

    const children = Array.from(first.children);
    expect(children.indexOf(box)).toBeLessThan(children.indexOf(label));
  });

  it('leaves .preview-word cells empty (no number text) since it does not fit at thumbnail scale', () => {
    renderPreview(container, makeLayout());
    const firstCardWords = container.querySelectorAll('.preview-cards .preview-card--small')[0].querySelectorAll('.preview-word');
    expect(firstCardWords).toHaveLength(2);
    expect(Array.from(firstCardWords).map((el) => el.textContent)).toEqual(['', '']);
  });

  it('shows no warning banners when nothing is set', () => {
    renderPreview(container, makeLayout());
    expect(container.querySelectorAll('.preview-warning')).toHaveLength(0);
  });

  it('shows a warning-styled (not error-styled) banner for cellTooSmall', () => {
    renderPreview(container, makeLayout({ warnings: { cellTooSmall: true, cellNotSquare: false, cellSizeInvalid: false } }));
    expect(container.querySelectorAll('.preview-warning--warning')).toHaveLength(1);
    expect(container.querySelectorAll('.preview-warning--error')).toHaveLength(0);
  });

  it('shows a warning-styled banner for cellNotSquare', () => {
    renderPreview(container, makeLayout({ warnings: { cellTooSmall: false, cellNotSquare: true, cellSizeInvalid: false } }));
    expect(container.querySelectorAll('.preview-warning--warning')).toHaveLength(1);
    expect(container.querySelectorAll('.preview-warning--error')).toHaveLength(0);
  });

  it('shows an error-styled banner (and suppresses the others) for cellSizeInvalid', () => {
    renderPreview(container, makeLayout({ warnings: { cellTooSmall: true, cellNotSquare: true, cellSizeInvalid: true } }));
    expect(container.querySelectorAll('.preview-warning--error')).toHaveLength(1);
    expect(container.querySelectorAll('.preview-warning--warning')).toHaveLength(0);
  });

  it('clears previous content on re-render', () => {
    renderPreview(container, makeLayout());
    renderPreview(container, null);
    expect(container.querySelectorAll('.preview-card')).toHaveLength(0);
    expect(container.querySelector('.preview-placeholder')).not.toBeNull();
  });

  it('sizes the thumbnail card in real proportion to its mm dimensions, capped at a maximum width', () => {
    const small = makeLayout({ cards: [makeCard({ cardWidthMm: 20, cardHeightMm: 20 })] });
    renderPreview(container, small);
    const smallBox = container.querySelector('.preview-cards .preview-card--small') as HTMLElement;
    expect(smallBox.style.width).toBe('30px'); // 20mm * 1.5px/mm

    const big = makeLayout({ cards: [makeCard({ cardWidthMm: 200, cardHeightMm: 20 })] });
    renderPreview(container, big);
    const bigBox = container.querySelector('.preview-cards .preview-card--small') as HTMLElement;
    expect(bigBox.style.width).toBe('160px'); // 200mm * 1.5px/mm = 300px, capped at 160px
  });

  it('sets an inline aspect-ratio on the thumbnail card box reflecting its real proportions', () => {
    const layout = makeLayout({ cards: [makeCard({ cardWidthMm: 180, cardHeightMm: 20 })] });
    renderPreview(container, layout);
    const box = container.querySelector('.preview-cards .preview-card') as HTMLElement;
    expect(box.style.aspectRatio).toBe('180 / 20');
  });

  it('sets an inline aspect-ratio on the big card (but not a fixed width) so it fills the container at real proportions', () => {
    renderPreview(container, makeLayout());
    const bigBox = container.querySelector('.preview-big .preview-card--large') as HTMLElement;
    expect(bigBox.style.width).toBe('');
    expect(bigBox.style.aspectRatio).toBe('100 / 60');
  });

  it('renders the thumbnail row once per stencil set, duplicating the same cards', () => {
    const layout = makeLayout({ copies: 3 });
    renderPreview(container, layout);
    expect(container.querySelectorAll('.preview-cards .preview-card--small')).toHaveLength(6); // 2 cards x 3 sets
  });

  it('renders the thumbnail row exactly once when copies is 1', () => {
    renderPreview(container, makeLayout({ copies: 1 }));
    expect(container.querySelectorAll('.preview-cards .preview-card--small')).toHaveLength(2);
  });

  it('groups thumbnails into a labeled set per stencil set when there is more than one', () => {
    const layout = makeLayout({ copies: 3 });
    renderPreview(container, layout);
    const sets = container.querySelectorAll('.preview-cards .preview-set');
    expect(sets).toHaveLength(3);
    expect(sets[0].querySelector('.preview-set__label')?.textContent).toBe('Set 1');
    expect(sets[1].querySelector('.preview-set__label')?.textContent).toBe('Set 2');
    expect(sets[2].querySelector('.preview-set__label')?.textContent).toBe('Set 3');
    expect(sets[0].querySelectorAll('.preview-card--small')).toHaveLength(2);
  });

  it('does not label the single set when copies is 1', () => {
    renderPreview(container, makeLayout({ copies: 1 }));
    const sets = container.querySelectorAll('.preview-cards .preview-set');
    expect(sets).toHaveLength(1);
    expect(sets[0].querySelector('.preview-set__label')).toBeNull();
  });

  it('wraps warning banners in an aria-live container, and leaves the cards container without one', () => {
    renderPreview(container, makeLayout({ warnings: { cellTooSmall: true, cellNotSquare: false, cellSizeInvalid: false } }));
    const warningsEl = container.querySelector('.preview-warnings');
    expect(warningsEl?.getAttribute('aria-live')).toBe('polite');
    expect(warningsEl?.querySelectorAll('.preview-warning')).toHaveLength(1);

    const cardsEl = container.querySelector('.preview-cards');
    expect(cardsEl?.hasAttribute('aria-live')).toBe(false);
  });

  it('renders corner marks by the raw card number, not the physical-card pairing', () => {
    const layout = makeLayout({ cards: [makeCard({ cardNumber: 3, physicalCardNumber: 2 })] });
    renderPreview(container, layout);
    const box = container.querySelector('.preview-cards .preview-card') as HTMLElement;
    expect(box.querySelectorAll('.corner-mark--top-left')).toHaveLength(3);
    expect(box.querySelectorAll('.corner-mark--top-right')).toHaveLength(1);
  });

  it('renders the big card mesh as empty frames (no letters), just the word-number overlay', () => {
    renderPreview(container, makeLayout());
    const bigBox = container.querySelector('.preview-big .preview-card--large') as HTMLElement;
    const words = bigBox.querySelectorAll('.preview-word-mesh');
    expect(words).toHaveLength(2);
    expect(words[0].classList.contains('preview-word-mesh--shaded')).toBe(false);
    expect(words[1].classList.contains('preview-word-mesh--shaded')).toBe(true);

    const firstWordCells = words[0].querySelectorAll('.preview-cell');
    expect(firstWordCells).toHaveLength(12); // cellRowLabels has 3 entries in this layout -> 3 rows x 4 cols
    expect(Array.from(firstWordCells).every((el) => el.textContent === '')).toBe(true);
  });

  it('never shows letters in the big-card mesh regardless of how many word-columns a section has', () => {
    const layout = makeLayout({
      cards: [
        makeCard({
          sections: [
            {
              sectionNumber: 1,
              words: Array.from({ length: 18 }, (_, i) => ({ wordNumber: i + 1, shaded: false })),
            },
          ],
        }),
      ],
      cellRowLabels: ['a', 'b'],
    });
    renderPreview(container, layout);
    const wordMeshes = container.querySelectorAll('.preview-big .preview-word-mesh');
    expect(wordMeshes).toHaveLength(18);
    const firstWordCells = wordMeshes[0].querySelectorAll('.preview-cell');
    expect(firstWordCells).toHaveLength(8); // cellRowLabels has 2 entries -> 2 rows x 4 cols
    expect(Array.from(firstWordCells).every((el) => el.textContent === '')).toBe(true);
  });

  it('lays out each section as a CSS grid with one column per word, so the row always fits the card width', () => {
    const layout = makeLayout({
      cards: [
        makeCard({
          sections: [
            {
              sectionNumber: 1,
              words: Array.from({ length: 18 }, (_, i) => ({ wordNumber: i + 1, shaded: false })),
            },
          ],
        }),
      ],
    });
    renderPreview(container, layout);
    const row = container.querySelector('.preview-big .preview-section') as HTMLElement;
    expect(row.style.gridTemplateColumns).toBe('repeat(18, 1fr)');
  });

  it('renders the word number as an overlay element inside the mesh cell, not a separate header', () => {
    renderPreview(container, makeLayout());
    const bigBox = container.querySelector('.preview-big .preview-card--large') as HTMLElement;
    const firstWord = bigBox.querySelectorAll('.preview-word-mesh')[0];
    const numberEl = firstWord.querySelector('.preview-word-mesh__number');
    expect(numberEl?.textContent).toBe('1');
    // the number element is a child of the same mesh cell as the grid, not a sibling wrapper
    expect(firstWord.contains(numberEl)).toBe(true);
    expect(firstWord.querySelector('.preview-word-mesh__grid')).not.toBeNull();
  });

  it('never renders the mesh in the thumbnail row', () => {
    renderPreview(container, makeLayout());
    expect(container.querySelectorAll('.preview-cards .preview-word-mesh')).toHaveLength(0);
  });

  it('captions the big card as a generic detail view, not the card-specific side label', () => {
    renderPreview(container, makeLayout());
    const bigLabel = container.querySelector('.preview-big .preview-card__label');
    expect(bigLabel?.textContent).toBe('Full detail');
  });

  it('renders a rotated column-value header above the big card when the layout is binary', () => {
    const layout = makeLayout({
      isBinary: true,
      binaryColumnLabels: ['1024', '512', '256', '128', '64', '32', '16', '8', '4', '2', '1'],
      cards: [
        makeCard({
          sections: [
            { sectionNumber: 1, words: [{ wordNumber: 1, shaded: false }] },
            { sectionNumber: 2, words: [{ wordNumber: 2, shaded: true }] },
          ],
        }),
      ],
    });
    renderPreview(container, layout);

    const header = container.querySelector('.preview-big .preview-binary-header');
    const headerCells = header?.querySelectorAll('.preview-binary-header__cell');
    expect(headerCells).toHaveLength(11);
    expect(headerCells?.[0].textContent).toBe('1024');
    expect(headerCells?.[10].textContent).toBe('1');

    // the header sits above the card outline, matching the PDF's placement -
    // not nested inside the card box.
    const bigBox = container.querySelector('.preview-big .preview-card--large') as HTMLElement;
    expect(bigBox.contains(header)).toBe(false);
  });

  it('renders one row per word in the big binary card, each with 11 blank cells and a word-number label', () => {
    const layout = makeLayout({
      isBinary: true,
      binaryColumnLabels: ['1024', '512', '256', '128', '64', '32', '16', '8', '4', '2', '1'],
      cards: [
        makeCard({
          sections: [
            { sectionNumber: 1, words: [{ wordNumber: 1, shaded: false }] },
            { sectionNumber: 2, words: [{ wordNumber: 2, shaded: true }] },
          ],
        }),
      ],
    });
    renderPreview(container, layout);

    const mesh = container.querySelector('.preview-big .preview-binary-mesh');
    const cells = mesh?.querySelectorAll('.preview-cell');
    expect(cells).toHaveLength(22); // 2 rows x 11 columns
    expect(Array.from(cells ?? []).every((el) => el.textContent === '')).toBe(true);
    // second row (indices 11-21) is shaded, first row (indices 0-10) is not
    expect(Array.from(cells ?? []).slice(0, 11).every((el) => !el.classList.contains('preview-cell--shaded'))).toBe(true);
    expect(Array.from(cells ?? []).slice(11, 22).every((el) => el.classList.contains('preview-cell--shaded'))).toBe(true);

    const numbers = mesh?.querySelectorAll('.preview-binary-row__number');
    expect(numbers?.[0].textContent).toBe('1');
    expect(numbers?.[1].textContent).toBe('2');
  });

  it('renders binary thumbnails as blank 11-column meshes with no header and no word numbers', () => {
    const layout = makeLayout({
      isBinary: true,
      binaryColumnLabels: ['1024', '512', '256', '128', '64', '32', '16', '8', '4', '2', '1'],
      cards: [
        makeCard({
          sections: [{ sectionNumber: 1, words: [{ wordNumber: 1, shaded: false }] }],
        }),
      ],
    });
    renderPreview(container, layout);

    expect(container.querySelector('.preview-cards .preview-binary-header')).toBeNull();
    const mesh = container.querySelector('.preview-cards .preview-binary-mesh');
    expect(mesh?.querySelectorAll('.preview-cell')).toHaveLength(11);
    expect(mesh?.querySelectorAll('.preview-binary-row__number')).toHaveLength(0);
  });

  it('does not render binary markup for a non-binary layout', () => {
    renderPreview(container, makeLayout());
    expect(container.querySelector('.preview-binary-header')).toBeNull();
    expect(container.querySelector('.preview-binary-mesh')).toBeNull();
  });

  it('shades binary thumbnail cells using each section\'s own model-computed shaded flag, not row index parity', () => {
    // Sections deliberately have shaded flags that do NOT alternate in lockstep
    // with their position (index 1 is shaded even though index%2===1 would also
    // say shaded here by coincidence, so use a genuinely non-alternating pattern:
    // false, true, true).
    const layout = makeLayout({
      isBinary: true,
      binaryColumnLabels: ['1024', '512', '256', '128', '64', '32', '16', '8', '4', '2', '1'],
      cards: [
        makeCard({
          sections: [
            { sectionNumber: 1, words: [{ wordNumber: 1, shaded: false }] },
            { sectionNumber: 2, words: [{ wordNumber: 2, shaded: true }] },
            { sectionNumber: 3, words: [{ wordNumber: 3, shaded: true }] },
          ],
        }),
      ],
    });
    renderPreview(container, layout);

    const cells = container.querySelectorAll('.preview-cards .preview-binary-mesh .preview-cell');
    expect(cells).toHaveLength(33); // 3 rows x 11 columns
    const rowShaded = (row: number) => Array.from(cells).slice(row * 11, row * 11 + 11).every((el) => el.classList.contains('preview-cell--shaded'));
    expect(rowShaded(0)).toBe(false);
    expect(rowShaded(1)).toBe(true);
    expect(rowShaded(2)).toBe(true);
  });

  it('omits a mesh row for a binary section with zero words', () => {
    const layout = makeLayout({
      isBinary: true,
      binaryColumnLabels: ['1024', '512', '256', '128', '64', '32', '16', '8', '4', '2', '1'],
      cards: [
        makeCard({
          sections: [
            { sectionNumber: 1, words: [{ wordNumber: 1, shaded: false }] },
            { sectionNumber: 2, words: [] },
          ],
        }),
      ],
    });
    renderPreview(container, layout);

    const cells = container.querySelectorAll('.preview-cards .preview-binary-mesh .preview-cell');
    expect(cells).toHaveLength(11); // only the one real row, not a blank row for the empty section
  });

  it('shades every second binary column, independent of row shading', () => {
    const layout = makeLayout({
      isBinary: true,
      binaryColumnLabels: ['1024', '512', '256', '128', '64', '32', '16', '8', '4', '2', '1'],
      cards: [
        makeCard({
          sections: [{ sectionNumber: 1, words: [{ wordNumber: 1, shaded: false }] }],
        }),
      ],
    });
    renderPreview(container, layout);

    const cells = container.querySelectorAll('.preview-big .preview-binary-mesh .preview-cell');
    expect(cells).toHaveLength(11);
    Array.from(cells).forEach((cell, col) => {
      expect(cell.classList.contains('preview-cell--col-shaded')).toBe(col % 2 === 1);
    });
  });

  it('renders one down-arrow per column, not a single centered one', () => {
    const layout = makeLayout({
      isBinary: true,
      binaryColumnLabels: ['1024', '512', '256', '128', '64', '32', '16', '8', '4', '2', '1'],
      cards: [
        makeCard({
          sections: [{ sectionNumber: 1, words: [{ wordNumber: 1, shaded: false }] }],
        }),
      ],
    });
    renderPreview(container, layout);

    const arrows = container.querySelectorAll('.preview-big .preview-binary-header-arrow');
    expect(arrows).toHaveLength(11);
  });

  it('marks row/column shading intersections with both classes, so CSS can darken them further', () => {
    const layout = makeLayout({
      isBinary: true,
      binaryColumnLabels: ['1024', '512', '256', '128', '64', '32', '16', '8', '4', '2', '1'],
      cards: [
        makeCard({
          sections: [{ sectionNumber: 1, words: [{ wordNumber: 1, shaded: true }] }],
        }),
      ],
    });
    renderPreview(container, layout);

    const cells = container.querySelectorAll('.preview-big .preview-binary-mesh .preview-cell');
    Array.from(cells).forEach((cell, col) => {
      expect(cell.classList.contains('preview-cell--shaded')).toBe(true);
      expect(cell.classList.contains('preview-cell--col-shaded')).toBe(col % 2 === 1);
    });
  });

  it('uses binary-specific wording ("card count") for the cellNotSquare warning when isBinary is true', () => {
    const layout = makeLayout({
      isBinary: true,
      binaryColumnLabels: ['1024', '512', '256', '128', '64', '32', '16', '8', '4', '2', '1'],
      warnings: { cellTooSmall: false, cellNotSquare: true, cellSizeInvalid: false },
    });
    renderPreview(container, layout);
    const banner = container.querySelector('.preview-warning--warning');
    expect(banner?.textContent).toContain('card count');
    expect(banner?.textContent).not.toContain('card split');
  });

  it('keeps the non-binary wording ("card split") for the cellNotSquare warning when isBinary is false', () => {
    renderPreview(container, makeLayout({ warnings: { cellTooSmall: false, cellNotSquare: true, cellSizeInvalid: false } }));
    const banner = container.querySelector('.preview-warning--warning');
    expect(banner?.textContent).toContain('card split');
  });
});
