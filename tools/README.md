# Build-time data tools

Run from this `tools/` directory. All images come from Wikimedia Commons.

- `nature/`: state bird and flower photos (lead images of the species'
  English Wikipedia articles). `titles.json` maps each state to its bird and
  flower articles.

      python3 nature/fetch.py nature/titles.json nature/index.json   # resumable
      python3 nature/big.py                                          # 500 px versions
      node nature/pack.mjs nature ../src/nature.json

- `flags/`: state flag SVGs, rasterised to WebP into `src/flags.json` with
  Playwright: `node flags/rasterize.cjs flags ../src/flags.json`.
