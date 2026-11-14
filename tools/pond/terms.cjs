// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// ink in each of the 24 solar terms: one small shot per term
const { chromium } = require('playwright');
const AT = [
  [2, 6],
  [2, 21],
  [3, 8],
  [3, 23],
  [4, 7],
  [4, 22],
  [5, 8],
  [5, 23],
  [6, 8],
  [6, 23],
  [7, 9],
  [7, 25],
  [8, 10],
  [8, 25],
  [9, 10],
  [9, 25],
  [10, 10],
  [10, 25],
  [11, 9],
  [11, 24],
  [12, 9],
  [12, 24],
  [1, 8],
  [1, 22]
];
(async () => {
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir: process.argv[2] });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [i, [m, d]] of AT.entries()) {
    const ctx = await b.newContext({ viewport: { width: 900, height: 560 } });
    await ctx.addInitScript(
      ([m, d]) => {
        const RD = Date,
          off = RD.UTC(2027, m - 1, d, 20) - RD.now();
        window.Date = class extends RD {
          constructor(...a) {
            super(...(a.length ? a : [RD.now() + off]));
          }
          static now() {
            return RD.now() + off;
          }
        };
        localStorage.setItem('pond-seals', JSON.stringify({ found: { ink: '2026-11-02', ukiyo: '2026-11-02' }, sealed: [], hinted: '2026-11-01', visits: 3 }));
      },
      [m, d]
    );
    const p = await ctx.newPage();
    await p.goto(srv.url + '?gl', { waitUntil: 'load' });
    await p.waitForTimeout(8000);
    await p.evaluate(() => {
      const s = document.querySelector('.preview [data-k=look]');
      s.value = 'ink';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await p.waitForTimeout(14000);
    await p.screenshot({ path: `${__dirname}/terms/${String(i).padStart(2, '0')}.png`, timeout: 180000 });
    await ctx.close();
  }
  await b.close();
  srv.close();
  console.log('done');
})();
