import { mm } from '../units';
import type { Size } from '../units';
import { EncodingType } from './encoding';

// DOCUMENT STRINGS
export const DOCUMENT_TITLE = 'Protect your crypto-wallet seed backup - HoboHodl.com';
// Printed bottom-right on every page (drawPageChrome, writer.ts) - a single
// override point for anyone building/forking this generator to put their own
// URL here instead.
export const DOCUMENT_FOOTER_TEXT = 'github.com/diyseed/diyseed.core';
export const DOCUMENT_SEED_HEADER_TEXT = 'Seed stencil';
export const DOCUMENT_PASSPHRASE_HEADER_TEXT = 'Passphrase stencil';

// DOCUMENT SIZE (A4)
export const DOCUMENT_SIZE: Size = { width: mm(210), height: mm(297) };
export const DOCUMENT_MARGIN_TOP = mm(20);
export const DOCUMENT_MARGIN_H = mm(15);
export const DOCUMENT_MARGIN_BOTTOM = mm(10);
export const EFFECTIVE_PAGE_SIZE: Size = {
  width: DOCUMENT_SIZE.width - 2 * DOCUMENT_MARGIN_H,
  height: DOCUMENT_SIZE.height - DOCUMENT_MARGIN_TOP - DOCUMENT_MARGIN_BOTTOM,
};

// PENS (line widths, in points)
export const PEN_THIN = 0.1;
export const PEN_NORMAL = 0.3;
export const PEN_THICK = 0.5;
// Used only for the reader's outermost top/bottom (or left/right) guideline -
// the card's true physical edges, bolder than the internal ones so it's
// unmistakable which line to flush-align the card against.
export const PEN_EXTRA_THICK = 0.9;

// HEADER / FOOTER
export const HEADER_FONT_SIZE = 15;
export const FOOTER_FONT_SIZE = 9;
export const PARAMS_SUMMARY_FONT_SIZE = 9;
// Gap between the title's own rendered width and where the (small, gray)
// generator-parameters summary starts, on the same line to its right.
export const PARAMS_SUMMARY_GAP = mm(4);

// WRITER GENERATOR
export const CARD_MARGIN = mm(4);
export const CELL_FONT_SIZE_RANGE: [number, number] = [2.2, 12];
export const WORD_NR_FONT_SIZE_RANGE: [number, number] = [11.5, 48.3];
// Gap between a word block's own top edge and its (bold, gray) word-number
// label, so the label doesn't sit flush on the mesh edge.
export const WORD_NR_TOP_GAP = mm(1);

// INPUT RANGES
export const SEED_LENGTH_RANGE: [number, number] = [10, 39];
export const CARD_COUNT_RANGE: [number, number] = [1, 13];
export const CARD_WIDTH_RANGE: [number, number] = [mm(20), DOCUMENT_SIZE.width - 2 * DOCUMENT_MARGIN_H];
export const CARD_HEIGHT_RANGE: [number, number] = [CARD_WIDTH_RANGE[0], CARD_WIDTH_RANGE[1]];
export const CARD_SPLIT_RANGE: [number, number] = [1, 5];
export const CARDS_RADIUS_RANGE: [number, number] = [0, mm(5)];
export const CARDS_PADDING_RANGE: [number, number] = [mm(1), mm(5)];
export const WRITER_COPIES_RANGE: [number, number] = [1, 10];

// INPUT DEFAULTS
export const SEED_LENGTH_DEFAULT = 12;
export const CARD_COUNT_DEFAULT = 1;
export const CARD_SIZE_DEFAULT: Size = { width: mm(85.6), height: mm(54) }; // credit-card (ISO/IEC 7810 ID-1) size
export const CARD_SPLIT_DEFAULT = 1;
export const CARDS_ENCODING_DEFAULT: EncodingType = EncodingType.Alphabet;
export const CARDS_RADIUS_DEFAULT = mm(1.5);
export const CARDS_PADDING_DEFAULT = mm(1.5);
export const WRITER_COPIES_DEFAULT = 1;

// PREVIEW WARNINGS
export const MIN_CELL_SIZE_MM = mm(1.5);
export const MAX_CELL_ASPECT_RATIO = 2;

// CORNER MARKS
export const CORNER_MARK_RADIUS = mm(0.35);
// Fixed inset from the mesh edge, into the card's border strip.
export const CORNER_MARK_INSET = mm(0.5);

// PAPER-CUTTER GUIDES (printer's crop marks, drawn just outside each card's
// corners so a paper cutter can be aligned without the mark itself ending up
// on the card). Gap + length must fit within CARD_MARGIN, the gutter between
// adjacent cards, so ticks from neighboring cards never touch.
export const CUTTER_GUIDE_GAP = mm(0.5);
export const CUTTER_GUIDE_LENGTH = mm(1.5);

// BINARY ENCODING
export const BINARY_COLUMN_VALUES: number[] = [1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1];
export const BINARY_HEADER_HEIGHT = mm(6);

// PASSPHRASE
export const PASSPHRASE_COLUMN_VALUES: number[] = [64, 32, 16, 8, 4, 2, 1];
export const PASSPHRASE_CELL_SIZE_DEFAULT = mm(2);
export const PASSPHRASE_CELL_SIZE_RANGE: [number, number] = [mm(1), mm(10)];
export const PASSPHRASE_CARD_COUNT_DEFAULT = 1;

// READER (non-transparent slide/overlay tool for decoding an already-punched
// card - see docs/superpowers/specs/2026-08-21-reader-stencil-design.md)
export const SEED_READER_TITLE_TEXT = 'Seed reader';
export const PASSPHRASE_READER_TITLE_TEXT = 'Passphrase reader';
export const READER_CUT_COLOR_RGB: [number, number, number] = [0.8, 0, 0];
export const READER_CUT_DASH_ARRAY = [mm(1), mm(1)];
// How far the cut-line and guidelines extend past the mesh's own extent, so
// there's a visible margin to start/end the scissor cut and to see the
// guideline clearly past the card's own edge.
export const READER_CUTLINE_OVERFLOW = mm(3);
export const READER_GUIDELINE_OVERFLOW = mm(5);
// Space reserved beside the slit for the value-axis labels (letters, digits,
// or bit place-values).
export const READER_LABEL_COLUMN_WIDTH = mm(6);
// Height of the strip above the mesh reserved for word/character position
// numbers.
export const READER_POSITION_NUMBER_HEIGHT = mm(5);
// Fixed clearance between a position number and the line it labels, so the
// number never touches it regardless of how the text itself gets centered.
export const READER_POSITION_NUMBER_GAP = mm(0.4);
// Fill-in box width is the number column plus one cell per character the box
// holds - 4 for a seed word (its 4-letter/4-digit prefix, or a Binary word's
// up-to-4-digit index), 1 for a passphrase character.
export const READER_FILLBOX_NUMBER_WIDTH = mm(4);
export const READER_FILLBOX_CHAR_WIDTH = mm(4);
export const READER_FILLBOX_HEIGHT = mm(8);
// Seed word-boxes are grouped 6 per row (like a real wordlist cheat sheet),
// with a gap between each word's own little table.
export const READER_FILLBOX_WORDS_PER_ROW = 6;
export const READER_FILLBOX_WORD_GAP = mm(3);
export const READER_CARD_HEADING_HEIGHT = mm(6);
export const READER_SECTION_GAP = mm(10);
// Small cut-here scissors mark drawn at the start of each cut line.
export const READER_SCISSORS_SIZE = mm(4);

// Passphrase reader's cross-off worksheet: one compact grid per block, its
// columns matching the card's own character positions and its 7 rows the
// same bit place-values shown in the ruler above. The cell width shrinks
// (down to the minimum) so a whole block fits across in one line; only past
// that minimum does it wrap into a second band.
export const READER_CROSS_CELL_SIZE: Size = { width: mm(5), height: mm(5) };
export const READER_CROSS_MIN_CELL_WIDTH = mm(3);
export const READER_CROSS_HEADER_HEIGHT = mm(5);
export const READER_CROSS_BAND_GAP = mm(4);
export const READER_CROSS_BLOCK_GAP = mm(8);

// ASCII REFERENCE TABLE (standalone page: character -> decimal -> 7-bit
// breakdown, for encoding/decoding a passphrase or a Binary-encoded seed by
// hand). Covers printable ASCII only - space through tilde. Each bit cell
// shows a bold X mark when set, a flat gray rectangle when not (see
// referenceTableCell.ts) - no place-value number spelled out in the body,
// just the header above it.
export const ASCII_TABLE_TITLE_TEXT = 'ASCII reference table';
export const ASCII_TABLE_CHAR_RANGE: [number, number] = [32, 126];
// Rows are split into side-by-side groups so the whole table stays compact
// on a single page instead of running as one very tall list.
export const ASCII_TABLE_GROUP_COUNT = 3;
export const ASCII_TABLE_ROW_HEIGHT = mm(4.8);
export const ASCII_TABLE_HEADER_HEIGHT = mm(6);
export const ASCII_TABLE_CHAR_COL_WIDTH = mm(6);
export const ASCII_TABLE_DEC_COL_WIDTH = mm(8);
export const ASCII_TABLE_BIT_COL_WIDTH = mm(4);
export const ASCII_TABLE_BIT_MARK_SIZE = mm(1.8);
export const ASCII_TABLE_GROUP_GAP = mm(6);
export const ASCII_TABLE_TOP_GAP = mm(3);
export const ASCII_TABLE_FONT_SIZE = 7;

// SEED WORD REFERENCE TABLE (same style/bit-cell rendering as the ASCII
// table above, but for the full 2048-word BIP-39 English wordlist: word ->
// its BIP-39 index (0-2047) -> that index's 11-bit breakdown (1024..1,
// matching BINARY_COLUMN_VALUES). Far too many rows for one page, so -
// unlike the ASCII table - this one paginates: as many groups as fit per
// page, as many pages as it takes. Sized smaller/tighter than the ASCII
// table so the 2048-row table stays as compact as it can while still fitting
// exactly 3 groups (SEED_TABLE_GROUPS_PER_PAGE) across a page.
export const SEED_TABLE_TITLE_TEXT = 'Seed reference table';
export const SEED_TABLE_GROUPS_PER_PAGE = 5;
export const SEED_TABLE_ROW_HEIGHT = mm(2.8);
// Taller than the ASCII table's own header - it has to fit "1024" rotated
// (reading along this height), not just single/double-digit labels.
export const SEED_TABLE_HEADER_HEIGHT = mm(6);
// Sized to fit the wordlist's own longest entries (8 characters) at
// SEED_TABLE_FONT_SIZE, left-aligned with a small left pad (see
// WORD_LEFT_PAD in seedWordTable.ts).
export const SEED_TABLE_WORD_COL_WIDTH = mm(8);
export const SEED_TABLE_DEC_COL_WIDTH = mm(4.2);
export const SEED_TABLE_BIT_COL_WIDTH = mm(1.8);
export const SEED_TABLE_BIT_MARK_SIZE = mm(1);
export const SEED_TABLE_GROUP_GAP = mm(2.5);
export const SEED_TABLE_TOP_GAP = mm(2);
export const SEED_TABLE_FONT_SIZE = 4.5;
