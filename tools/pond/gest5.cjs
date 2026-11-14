// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// each gesture, made with the pointer on the live page: which look comes in
const { chromium } = require('playwright');
(async () => {
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir: process.argv[2] });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const W = 900,
    H = 560;
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(srv.url + '?gl', { waitUntil: 'load' });
  await p.waitForTimeout(12000);
  const m = p.mouse;
  const path = async (pts) => {
    await m.move(pts[0][0], pts[0][1]);
    await m.down();
    for (const [x, y] of pts.slice(1)) await m.move(x, y);
    await m.up();
  };
  const seg = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  const only = process.argv[3];
  const G0 = {
    dunhuang: () => path(Array.from({ length: 6 }, (_, k) => seg(k % 2 ? [720, 300] : [600, 300], k % 2 ? [600, 302] : [720, 302], 8)).flat()),
    relief: () => path(Array.from({ length: 7 }, (_, k) => seg([420 + k * 50, k % 2 ? 360 : 430], [470 + k * 50, k % 2 ? 430 : 360], 8)).flat()),
    stars: async () => {
      await p.evaluate(() => {
        window.__ev = [];
        for (const t of ['pointerdown', 'pointerup'])
          addEventListener(
            t,
            (e) =>
              window.__ev.push([
                t,
                Math.round(e.timeStamp),
                Math.round(e.clientX),
                Math.round(e.clientY),
                e.target.className || e.target.id || e.target.tagName
              ]),
            true
          );
      });
      for (const [x, y] of [
        [660, 170],
        [760, 300],
        [690, 480]
      ]) {
        await m.click(x, y);
        await p.waitForTimeout(120);
      }
      console.log(JSON.stringify(await p.evaluate(() => window.__ev)));
    },
    monet: async () => {
      for (const [x, y] of [
        [700, 300],
        [708, 296],
        [696, 306],
        [704, 302]
      ]) {
        await m.click(x, y);
        await p.waitForTimeout(120);
      }
    },
    qinghua: () =>
      path([
        ...seg([30, 30], [W - 30, 30], 30),
        ...seg([W - 30, 30], [W - 30, H - 100], 20),
        ...seg([W - 30, H - 100], [30, H - 100], 30),
        ...seg([30, H - 100], [30, 30], 20),
        ...seg([30, 30], [200, 30], 8)
      ]),
    ukiyo: () => path(Array.from({ length: 50 }, (_, i) => [700 + Math.cos(i / 7.5) * 70, 300 + Math.sin(i / 7.5) * 70])),
    blueprint: () => path(seg([520, 420], [880, 330], 40))
  };
  const G = only ? { [only]: G0[only] } : G0;
  for (const [name, f] of Object.entries(G)) {
    await p.goto(srv.url + '?gl', { waitUntil: 'load' });
    await p.waitForTimeout(11000);
    await f();
    let got = '';
    for (let i = 0; i < 30 && !got; i++) {
      await p.waitForTimeout(400);
      got = await p.evaluate(() => document.querySelector('#pond').dataset.look || '');
    }
    console.log(name.padEnd(10), got === name ? 'ok' : 'GOT ' + (got || 'nothing'));
  }
  console.log('errors', errs);
  await b.close();
  srv.close();
})();
