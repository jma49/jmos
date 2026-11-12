// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// polish shots: node pol.cjs <dist> <w> <h> <dsf> <tag> <looks,..> [phone]
// (RM=1 runs under reduced motion and also pictures each look leaving and gone; PHASE=dawn|day|dusk|night sets the time of day; WEATHER=rain|snow|.. sets the weather; VISITORS=1 adds three visitors' koi, in blue, violet and green)
const { chromium } = require('playwright');
(async () => {
  const [, , dir, w, h, dsf, tag, looks, phone] = process.argv;
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({
    viewport: { width: +w, height: +h },
    deviceScaleFactor: +dsf,
    ...(phone ? { hasTouch: true, isMobile: true } : {}),
    ...(process.env.RM ? { reducedMotion: 'reduce' } : {})
  });
  if (process.env.DATE)
    await ctx.addInitScript((m) => {
      const RD = Date,
        off = RD.UTC(2027, m, 16, 20) - RD.now();
      window.Date = class extends RD {
        constructor(...a) {
          super(...(a.length ? a : [RD.now() + off]));
        }
        static now() {
          return RD.now() + off;
        }
      };
    }, +process.env.DATE);
  await ctx.addInitScript(() =>
    localStorage.setItem('pond-seals', JSON.stringify({ found: { ink: '2026-11-02' }, sealed: [], hinted: '2026-11-01', visits: 3 }))
  );
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 400)));
  await p.goto(srv.url + (process.env.VISITORS ? '?perf' : ''), { waitUntil: 'load' });
  await p.waitForTimeout(10000);
  if (process.env.VISITORS)
    await p.evaluate(() =>
      window.__pond.visitors([
        { id: 'a', username: 'mei', color: '#3aa7c9' },
        { id: 'b', username: '', color: '#8a5cf0' },
        { id: 'c', username: 'tomo', color: '#3fae6a' }
      ])
    );
  if (process.env.WEATHER)
    await p.evaluate((v) => {
      const s = document.querySelector('.preview [data-k=weather]');
      s.value = v;
      s.dispatchEvent(new Event('input', { bubbles: true }));
    }, process.env.WEATHER);
  if (process.env.PHASE)
    await p.evaluate((v) => {
      const s = document.querySelector('.preview [data-k=phase]');
      s.value = v;
      s.dispatchEvent(new Event('input', { bubbles: true }));
    }, process.env.PHASE);
  for (const l of looks.split(',')) {
    await p.evaluate((l) => {
      const s = document.querySelector('.preview [data-k=look]');
      s.value = l;
      s.dispatchEvent(new Event('input', { bubbles: true }));
    }, l);
    for (let i = 0; i < 60; i++) {
      await p.waitForTimeout(500);
      if ((await p.evaluate(() => document.querySelector('#pond').dataset.look || 'water')) === l) break;
    }
    await p.waitForTimeout(+(process.env.WAIT || 9000));
    await p.screenshot({ path: `${__dirname}/pol/${tag}-${l}.png`, timeout: 180000 });
    if (process.env.RM) {
      // under reduced motion: a moment into the cross-fade in, then back to the water and a moment into that
      await p.evaluate(() => {
        const s = document.querySelector('.preview [data-k=look]');
        s.value = 'water';
        s.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await p.waitForTimeout(1500);
      await p.screenshot({ path: `${__dirname}/pol/${tag}-${l}-leaving.png`, timeout: 180000 });
      await p.waitForTimeout(+(process.env.WAIT || 9000));
      await p.screenshot({ path: `${__dirname}/pol/${tag}-${l}-left.png`, timeout: 180000 });
    }
    if (process.env.SHEET) {
      await p.evaluate(() => document.querySelector('[data-sheet=about]').click());
      await p.waitForTimeout(3500);
      await p.screenshot({ path: `${__dirname}/pol/${tag}-${l}-about.png`, timeout: 180000 });
      await p.keyboard.press('Escape');
      await p.waitForTimeout(1000);
    }
  }
  console.log(tag, 'errors', errs);
  await b.close();
  srv.close();
})();
