import { describe, expect, it } from 'vitest';
import * as lib from '../src/index';

describe('library exports', () => {
  const functions = [
    'validate', 'toGeneratorParameters', 'toPassphraseParameters', 'resolvePassphraseCellSize',
    'isSeedSectionActive', 'isPassphraseSectionActive', 'hasAnyOutputSelected',
    'pdfFilename', 'codeFromSearch', 'layoutSeedCard', 'layoutPassphraseCard',
    'cardSvg', 'cardSizeSvg', 'physicalCardNumberOf', 'sideOf',
  ] as const;

  it.each(functions)('exports %s as a function', (name) => {
    expect(typeof lib[name]).toBe('function');
  });

  it('exports constants', () => {
    expect(lib.DEFAULT_FORM_VALUES).toBeDefined();
    expect(lib.SEED_BINARY_HEADER_WIDTH).toBeDefined();
    expect(lib.PASSPHRASE_HEADER_SIZE).toBeDefined();
  });
});
