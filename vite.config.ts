import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained index.html (JS, CSS and fonts inlined), so the template
// can be dropped into CasparCG's template folder or served from anywhere,
// with no network access needed on the playout box.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2019', assetsInlineLimit: 10_000_000 },
});
