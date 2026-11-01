# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The PDF-stencil generator for [DIYseed.net](https://diyseed.net/) (branded HoboHodl in the generated PDFs), written in TypeScript. It ships two things from one codebase:
- a **browser app** (`index.html` + `src/main.ts` + `src/ui/`): a form with live SVG preview that generates the PDF client-side.
- an **npm library** (`src/index.ts`, package `@diyseed/generator`): the same generator, without the UI.

See `README.md` for the product explanation (what a stencil/backup card is, how punching/reading works, seed-word theory). Read it before touching generator logic: the geometry only makes sense in light of the physical punching process it models.

The original C# (.NET) implementation was removed on this branch.

## Building, running, testing

```
npm install            # also runs `prepare` -> build:library
npm run dev            # Vite dev server for the browser app (port 5173)
npm test               # Vitest, all tests in tests/
npx tsc --noEmit       # typecheck src + tests
npm run build          # app build -> dist/index.html + dist/assets
npm run build:library  # library build -> dist/index.js + dist/index.d.ts
```

Both builds write to `dist/`. The library is consumed as a Git install (`git+https://...#js-rewrite`), which is why `prepare` builds it.

## Architecture

All units are PDF points; `src/units.ts` has `mm()`/`toMm()`. Geometry is computed top-left-origin and converted to pdf-lib's bottom-left origin in `pdfDraw.ts` (`toPdfY`, `drawRectTL`, ...).

Generator (`src/generator/`, depends only on `pdf-lib`):
- **`params.ts`**: `GeneratorParameters` (seed stencil) and `PassphraseParameters` (passphrase stencil, auto-fills capacity). Validated input DTOs that also derive layout geometry.
- **`config.ts`**: static constants (page size, margins, pens, fonts, valid ranges, header/footer text).
- **`encoding.ts`**: `EncodingType` (Alphabet, Number, Binary horizontal/vertical) and per-encoding layout.
- **`writer.ts`**: the punching stencil (`generateWriterPdf`, `generatePassphrasePdf`) and the orchestrator `generateStencilPdf(StencilInput)`, which merges seed/passphrase stencils, readers, and reference tables into one PDF. Readers and tables are dynamically imported (separate chunks).
- **`reader.ts`** + **`readerBoxes.ts`**: the reader stencil for decoding a punched card. Works in logical (value axis, position axis) coordinates mapped to physical orientation; see `docs/superpowers/specs/2026-08-21-reader-stencil-design.md`.
- **`seedWordTable.ts`** (BIP39, `bip39Wordlist.ts`) and **`asciiTable.ts`**: reference table pages; `referenceTableCell.ts` is shared.
- **`cornerMarks.ts`, `fontFit.ts`, `geometry.ts`, `summary.ts`, `pdfDraw.ts`**: shared drawing helpers.

UI (`src/ui/`, `src/main.ts`):
- **`form.ts`**: `FormValues`, defaults, validation, and builders to `GeneratorParameters`/`PassphraseParameters`. Pure, DOM-free, tested.
- **`preview.ts`**: computes preview layout; **`renderPreview.ts`**: renders it as SVG. The preview must stay visually consistent with the PDF output.
- **`main.ts`**: reads the DOM into `FormValues`, wires preview updates and PDF download. Seed and Passphrase sections each have nested Stencil/Reader/Reference table checkboxes; hidden fields must not leak into `FormValues`.

Design specs and implementation plans for past features live in `docs/superpowers/specs/` and `docs/superpowers/plans/` (gitignored, local only).

## Known consumer outside this repo

The `diyseed` website repo (`website/`) lists this package as a Git dependency but actually imports its own **copied** `website/src/generator/`. Changes to generator behavior here (layout, fonts, encoding, page sizes, valid ranges) do not reach the live site unless ported to that copy manually.
