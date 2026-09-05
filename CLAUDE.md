# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The core PDF-stencil generator library for [DIYseed.net](https://diyseed.net/) plus a console sample app. See `README.md` for the product explanation (what a stencil/backup card is, how punching/reading works, seed-word theory) — read it before touching generator logic, since the geometry code only makes sense in light of the physical punching process it models.

The solution contains two projects:
- **`diyseed.core/Diyseed.Core.csproj`** — the PDF generator class library (netcoreapp3.1).
- **`diyseed/Diyseed.App.csproj`** — a console app (net6.0) demonstrating the library via interactive CLI prompts.

## Known consumer outside this repo

This library's source is **vendored (copy-pasted, not referenced) into the separate `diyseed` repo**, at `src/web/Diyseed.Core/`, where it backs the Piranha CMS site's PDF generation. That vendored copy has already diverged from this one (`Common/Configuration.cs`, `Common/EncodingType.cs`, `Common/Parameters.cs`, and the `.csproj`/resx files all differ). If you change generator behavior here — stencil layout, fonts, encoding, page sizes, valid ranges — and the change should also apply to the live CMS site, you need to manually port it into that other repo; there is no build step or package that syncs them.

## Building & running

```
dotnet build diyseed.sln          # Diyseed.Core (netcoreapp3.1) + Diyseed.App (net6.0)
dotnet run --project diyseed/Diyseed.App.csproj   # interactive console prompts for seed length, card count/size, etc.
```
No test project exists in this repo — there is nothing to `dotnet test`.

## Core generator architecture

The PDF pipeline lives entirely in the `Diyseed.Core` namespace and is PDF-library-agnostic at the API surface (consumers only touch `Generator`, `GeneratorParameters`, and `PdfSectionFlags`):

- **`GeneratorParameters`** (in `Common/Parameters.cs`) — the single input DTO: card size, card count, seed length, row-split, encoding (alphabet vs. number), copies, and which sections to include.
- **`Generator`** (`Generator.cs`) — orchestrator. Instantiates `WriterGenerator`, `ReaderGenerator`, and `ManualGenerator` per the `PdfSectionFlags` on the parameters, draws page headers/footers on each sub-document, then merges all of them into one `PdfDocument` via `JoinDocuments` (re-imports each generated doc's pages using `OpenInMode(PdfDocumentOpenMode.Import)` — necessary because PdfSharpCore documents can't just be concatenated directly).
- **`WriterGenerator.cs`** — draws the punching stencil: the alphabet/number grid table used to physically mark the metal card.
- **`ReaderGenerator.cs`** — draws the overlay/reader stencil (and the physical "slide to read" reader described in the product README) used to decode a punched card without needing a transparent print.
- **`ManualGenerator.cs`** — appends a pre-rendered manual PDF (passed in as raw bytes, e.g. from `manual.pdf` or a downloaded URL) into the final output.
- **`GeneratorShared.cs`** — cross-cutting `PdfSharpCore` extension methods: auto-sizing fonts to fit a box (`GetFontForBox`), and header/footer drawing on `PdfPage`/`PdfDocument`.
- **`Configuration`** (in `Common/`) — static layout constants (margins, fonts, valid ranges for seed length/card size/etc.) consumed throughout.

The console app (`diyseed/Program.cs`) builds `GeneratorParameters` directly from interactive CLI prompts and is the only call site in this repo.
