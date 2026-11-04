# Build-time data tools

Run the nature and flag commands from this `tools/` directory. Those images
come from Wikimedia Commons. Candidate portraits also use Congress,
campaigns, government biographies, candidate profiles, and news sources.

- `nature/`: state bird and flower photos (lead images of the species'
  English Wikipedia articles). `titles.json` maps each state to its bird and
  flower articles.

      python3 nature/fetch.py nature/titles.json nature/index.json   # resumable
      python3 nature/big.py                                          # 500 px versions
      node nature/pack.mjs nature ../src/nature.json

- `flags/`: state flag SVGs, rasterised to WebP into `src/flags.json` with
  Playwright: `node flags/rasterize.cjs flags ../src/flags.json`.

- `portraits/`: the app's portrait catalogue and coverage audit. From the
  **repository root**, with Python 3 and Pillow installed:

      node --experimental-strip-types tools/civicapi/roster.mjs /tmp/civicapi-roster.json
      python3 tools/portraits/fetch.py --roster /tmp/civicapi-roster.json
      python3 tools/portraits/fetch.py --roster /tmp/civicapi-roster.json --retry

  The roster exporter needs Node 22.6+ and uses the app's civicAPI parser, so
  the audit follows the same two displayed candidates per race. It rejects
  test data. Credit civicAPI for reused election data (https://civicapi.org/faq).
  `fetch.py --core FILE` remains available for historical audits.

  `--legislators FILE` optionally supplies the public `congress-legislators`
  JSON directory for bioguide IDs absent from the feed. Downloads and
  biography caches are ignored by Git. Set `SSL_CERT_FILE` for a custom CA;
  TLS verification is enabled in the tools. Remove `summaries.json` to refresh
  cached biographies. The generated `src/portrait-catalogue.json` is embedded
  in the single-file build. `coverage.json` lists remaining gaps.

  Additional sources follow a separate **proposal, visual review, import**
  workflow. These tools need BeautifulSoup, Pillow, numpy, and
  `opencv-python-headless<5` in a Python environment:

      python3 tools/portraits/campaigns.py --max-jobs 64
      python3 tools/portraits/profiles.py
      python3 tools/portraits/review.py --unreviewed

  `campaigns.py` discovers official campaign links from election pages;
  `campaign-extra-websites.json` records researched alternatives.
  `profiles.py` requires a matching name, state, and named headshot.
  `campaigns.py --hints FILE` accepts researched source/image URL pairs and
  optionally an explicit crop after viewing the original image. The optional
  `PORTRAIT_FACE_MODEL` environment variable can point to OpenCV's public
  `face_detection_yunet_2023mar.onnx` model; otherwise Haar detection is used.
  Detection proposes crops only: it does not establish identity.

  Review each proposed face and its source, then create a JSON object mapping
  candidate keys to option indices (`null` rejects a proposal). Import with
  `campaigns.py --approve FILE`, then rerun `fetch.py` to pack the catalogue.
  Proposal/review files are working caches; the durable reviewed records are
  in `campaign-sources.json`. Each record contains a source page, image URL,
  attribution, crop, and SHA-256 fingerprint. A changed source image requires
  another review instead of silently replacing a candidate's photo.

  Verification:

      node tools/portraits/test.mjs
      node --experimental-strip-types --test tools/civicapi/test.mjs
      python3 tools/portraits/test_sources.py
      npm run build
