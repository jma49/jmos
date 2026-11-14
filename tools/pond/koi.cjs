// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// a look's painted koi swimming, turning and curling, on a virtual clock: node koi.cjs <dist> [look]
// (VISITORS=1 instead adds three visitors' koi, in blue, violet and green, and pictures the whole pond)
const { chromium } = require('playwright');
const { INIT } = require('./virtual.cjs');
(async () => {
  const [, , dir, looks] = process.argv;
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 400 }, locale: 'en-US', timezoneId: 'UTC' });
  const p = await ctx.newPage();
  await p.addInitScript(INIT);
  await p.addInitScript(() =>
    localStorage.setItem(
      'pond-seals',
      JSON.stringify({
        found: Object.fromEntries(['ink', 'ukiyo', 'glow', 'blueprint', 'ascii', 'monet', 'qinghua', 'dunhuang', 'stars'].map((k) => [k, '2026-06-01'])),
        sealed: ['painted', 'drawn'],
        hinted: '2026-06-01',
        visits: 3
      })
    )
  );
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  await p.goto(srv.url + (process.env.VISITORS ? '?perf' : '?gl'), { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const step = (n) => p.evaluate((n) => window.__step(n), n);
  const set = (l) =>
    p.evaluate((l) => {
      const s = document.querySelector('.preview [data-k=look]');
      s.value = l;
      s.dispatchEvent(new Event('input', { bubbles: true }));
    }, l);
  const shot = async (name) => {
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${__dirname}/tr/${name}.png`, timeout: 180000 });
  };
  await step(70);
  await set(looks || 'monet');
  await step(80);
  if (process.env.VISITORS) {
    // three visitors who are not there, given time to swim up into view: one picture of the whole pond
    await p.evaluate(() =>
      window.__pond.visitors([
        { id: 'a', username: 'mei', color: '#3aa7c9' },
        { id: 'b', username: '', color: '#8a5cf0' },
        { id: 'c', username: 'tomo', color: '#3fae6a' }
      ])
    );
    await step(240);
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${__dirname}/tr/visitors-${looks || 'monet'}.png`, timeout: 180000 });
    console.log('errors', errs);
    await b.close();
    srv.close();
    return;
  }
  // the visitor's koi follows the pointer: lead it straight, then round a tight circle, then stop so it curls
  const pts = [
    [200, 260],
    [300, 250],
    [400, 240],
    [470, 230],
    [500, 200],
    [480, 165],
    [440, 160],
    [415, 190],
    [430, 225],
    [465, 230],
    [465, 230],
    [465, 230]
  ];
  for (const [i, [x, y]] of pts.entries()) {
    await p.mouse.move(x, y);
    await step(7);
    await p.waitForTimeout(300);
    await p.screenshot({
      path: `${__dirname}/tr/koi-${looks || 'monet'}-${String(i).padStart(2, '0')}.png`,
      timeout: 180000,
      clip: { x: 140, y: 80, width: 420, height: 260 }
    });
  }
  console.log('errors', errs);
  await b.close();
  srv.close();
})();
