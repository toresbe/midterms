const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const dir = path.resolve(process.argv[2]), out = process.argv[3];
  const b = await chromium.launch(); const p = await b.newPage(); const p2 = await b.newPage();
  const res = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()) {
    await p.goto('file://' + path.join(dir, f));
    const box = await p.evaluate(() => {
      const s = document.documentElement; const vb = s.viewBox.baseVal;
      if (vb && vb.width) return [vb.width, vb.height];
      const w = parseFloat(s.getAttribute('width')), h = parseFloat(s.getAttribute('height'));
      s.setAttribute('viewBox', `0 0 ${w} ${h}`); return [w, h];
    });
    const H = 160, W = Math.round(H * box[0] / box[1]);
    await p.evaluate(([W, H]) => { const s = document.documentElement; s.setAttribute('width', W); s.setAttribute('height', H); s.setAttribute('preserveAspectRatio', 'none'); }, [W, H]);
    await p.setViewportSize({ width: W, height: H });
    const png = await p.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
    res[f.slice(0, 2)] = await p2.evaluate(async ([b64, W, H]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/webp', 0.88);
    }, [png.toString('base64'), W, H]);
  }
  fs.writeFileSync(out, JSON.stringify(res));
  await b.close();
})();
