import { describe, it, expect } from 'vitest';
import { pdfFilename } from '../src/ui/pdfFilename';
import { GeneratorParameters, PassphraseParameters } from '../src/generator/params';
import * as Config from '../src/generator/config';
import { mm } from '../src/units';

const cardSize = { width: mm(85.6), height: mm(54) };
const seed = new GeneratorParameters({ cardSize, cardCount: 1, seedLength: 12 });
const passphrase = new PassphraseParameters({
  cardSize,
  cardPadding: mm(1.5),
  cardCornerRadius: Config.CARDS_RADIUS_DEFAULT,
  cardCount: 1,
  copies: 1,
  cellSize: { width: mm(2), height: mm(2) },
});

describe('pdfFilename', () => {
  it('names both card codes when seed and passphrase are generated', () => {
    expect(pdfFilename(seed, passphrase)).toBe('diyseed_seed1-0856-0540-15-12-01-1-1_pass2-0856-0540-15-020.pdf');
  });

  it('names only the part that is generated', () => {
    expect(pdfFilename(seed, null)).toBe('diyseed_seed1-0856-0540-15-12-01-1-1.pdf');
    expect(pdfFilename(null, passphrase)).toBe('diyseed_pass2-0856-0540-15-020.pdf');
  });

  it('falls back to a plain name when neither is generated', () => {
    expect(pdfFilename(null, null)).toBe('diyseed.pdf');
  });
});
