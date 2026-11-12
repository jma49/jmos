// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// the fish layer's CPU time per frame (?perf), drawn koi against painted ones
const { chromium } = require('playwright');
(async () => {
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir: process.argv[2] });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(srv.url + '?perf', { waitUntil: 'load' });
  await p.waitForTimeout(10000);
  const read = async (label) => {
    const v = [];
    for (let i = 0; i < 14; i++) {
      await p.waitForTimeout(700);
      const f = await p.evaluate(() => window.__pondPerf && window.__pondPerf.fish);
      if (f != null) v.push(f);
    }
    v.sort((a, b) => a - b);
    console.log(label.padEnd(18), 'fish ms/frame median', v[v.length >> 1].toFixed(2), 'of', v.length);
  };
  const set = (l) =>
    p.evaluate((l) => {
      const s = document.querySelector('.preview [data-k=look]');
      s.value = l;
      s.dispatchEvent(new Event('input', { bubbles: true }));
    }, l);
  await read('water, drawn');
  await set('ink');
  await p.waitForTimeout(12000);
  await read('ink, drawn');
  await set('monet');
  await p.waitForTimeout(14000);
  await read('monet, painted');
  await set('qinghua');
  await p.waitForTimeout(14000);
  await read('qinghua, painted');
  await b.close();
  srv.close();
})();
