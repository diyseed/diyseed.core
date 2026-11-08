# README media

Sources for the images in `docs/images`: the encoding samples (`samples.mjs`), the writing animation (`writer.mjs`) and the reading animation (`reader.mjs`). Each one renders the real stencil or reader PDF from the library build, draws the example seed on it and writes the PNG or GIF straight into `docs/images`.

```
npm run build:library   # in the repo root: the scripts import dist/index.js
cd docs/media
npm install
npm run build           # or: npm run samples / writer / reader
```

Kept apart from the main package so its dependencies (pdf.js, canvas, GIF encoder) never reach the library.
