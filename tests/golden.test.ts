import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateStencilPdf, type StencilInput } from '../src/generator/writer';
import { GeneratorParameters, PassphraseParameters } from '../src/generator/params';
import { EncodingType } from '../src/generator/encoding';
import { mm, size } from '../src/units';
import { normalizePdf } from './helpers/normalizePdf';

const goldenDir = join(dirname(fileURLToPath(import.meta.url)), 'golden');
const card = size(mm(85.6), mm(54));

const seed = (p: ConstructorParameters<typeof GeneratorParameters>[0]): StencilInput => ({
  seed: new GeneratorParameters(p),
  includeSeedStencil: true,
});

const passphrase = (p: ConstructorParameters<typeof PassphraseParameters>[0]): StencilInput => ({
  passphrase: new PassphraseParameters(p),
  includePassphraseStencil: true,
});

const cases: Record<string, () => StencilInput> = {
  'seed-alphabet-default': () =>
    seed({ cardSize: card, cardPadding: mm(1.5), seedLength: 12, cardCount: 1, cardSplit: 1, encoding: EncodingType.Alphabet }),
  'seed-number-split2': () =>
    seed({ cardSize: card, seedLength: 24, cardCount: 1, cardSplit: 2, encoding: EncodingType.Number }),
  'seed-binary-2cards': () =>
    seed({ cardSize: card, seedLength: 24, cardCount: 2, encoding: EncodingType.Binary }),
  'seed-tiny': () =>
    seed({ cardSize: size(mm(20), mm(20)), seedLength: 12, cardCount: 4, encoding: EncodingType.Number }),
  'seed-copies3': () => seed({ cardSize: card, seedLength: 12, cardCount: 1, copies: 3 }),
  'passphrase-default': () =>
    passphrase({ cardSize: card, cardPadding: mm(1.5), cardCornerRadius: mm(1.5), cardCount: 1, copies: 1, cellSize: size(mm(2), mm(2)) }),
  'passphrase-one-row': () =>
    passphrase({ cardSize: card, cardPadding: mm(1.5), cardCornerRadius: mm(1.5), cardCount: 1, copies: 1, cellSize: size(mm(3.6), mm(3.6)) }),
  'passphrase-2cards': () =>
    passphrase({ cardSize: card, cardPadding: mm(1.5), cardCornerRadius: mm(1.5), cardCount: 2, copies: 1, cellSize: size(mm(2), mm(2)) }),
};

describe('golden stencil PDFs', () => {
  for (const [name, build] of Object.entries(cases)) {
    it(name, async () => {
      const actual = await normalizePdf(await generateStencilPdf(build()));
      const file = join(goldenDir, `${name}.pdf`);
      if (process.env.UPDATE_GOLDEN === '1') {
        mkdirSync(goldenDir, { recursive: true });
        writeFileSync(file, actual);
        return;
      }
      expect(existsSync(file), `missing golden ${name}.pdf (run with UPDATE_GOLDEN=1)`).toBe(true);
      expect(actual).toEqual(new Uint8Array(readFileSync(file)));
    });
  }
});
