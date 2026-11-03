// Packs the fetched bird/flower images into src/nature.json (base64, no re-encoding).
// Usage: node tools/nature/pack.mjs tools/nature  src/nature.json
import fs from 'node:fs'; import path from 'node:path';
const [dir, out] = process.argv.slice(2);
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const states = JSON.parse(fs.readFileSync(path.join(dir, 'titles.json'), 'utf8'));
const img = {};
for (const [t, v] of Object.entries(idx)) {
  const f = v.big || v.file; if (!f) continue;
  const p = path.join(dir, path.basename(f));
  if (!fs.existsSync(p)) continue;
  const ext = path.extname(p).slice(1).toLowerCase().replace('jpg', 'jpeg');
  img[t] = { uri: `data:image/${ext};base64,` + fs.readFileSync(p).toString('base64'), file: decodeURIComponent((v.orig || v.src).split('/').pop()) };
}
fs.writeFileSync(out, JSON.stringify({ _source: 'Lead images of the English Wikipedia articles (Wikimedia Commons); original file names in "file"', states, img }));
console.log(Object.keys(img).length, 'images,', Math.round(fs.statSync(out).size / 1024), 'KB');
