// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// frames actually drawn a second (frame callbacks that sent textures) and CPU ms per drawn frame, by state
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2];
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir });
  const b = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2'] });
  const INIT = () => {
    const S = (window.__S = { drawn: 0, cost: 0, sub: 0 });
    const r = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f) =>
      r((t) => {
        const a = pn(),
          s = S.sub;
        inCb = true;
        try {
          f(t);
        } finally {
          inCb = false;
          if (S.sub > s) {
            S.drawn++;
            S.cost += pn() - a;
          }
        }
      });
    const pn = performance.now.bind(performance);
    let inCb = false;
    performance.now = () => {
      if (inCb) S.sub++;
      return pn();
    };
  };
  const ctx = await b.newContext({ viewport: { width: +(process.env.VW || 400), height: +(process.env.VH || 260) } });
  const p = await ctx.newPage();
  await p.addInitScript(INIT);
  await p.goto(srv.url, { waitUntil: 'load' });
  await p.waitForTimeout(9000);
  const read = async (label, wait = 4000) => {
    const s0 = await p.evaluate(() => ({ ...window.__S }));
    await p.waitForTimeout(wait);
    const s1 = await p.evaluate(() => ({ ...window.__S })),
      n = s1.drawn - s0.drawn;
    console.log(label.padEnd(16), 'drawn/s', (n / (wait / 1000)).toFixed(1).padStart(5), ' cpu ms/frame', n ? ((s1.cost - s0.cost) / n).toFixed(1) : '-');
  };
  const poke = async () => {
    for (let i = 0; i < 6; i++) await p.mouse.move(150 + i * 20, 130);
  };
  await poke();
  await read('active', 3000);
  await p.waitForTimeout(6000);
  await read('idle');
  await p.evaluate(() => document.querySelector('[data-sheet=career]').click());
  await p.waitForTimeout(500);
  await poke();
  await read('chapter, touched', 1200);
  await p.waitForTimeout(2500);
  await read('chapter, still');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1500);
  await poke();
  await p.evaluate(() => dispatchEvent(new Event('blur')));
  await read('window behind');
  await b.close();
  srv.close();
})();
