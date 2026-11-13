// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// the dove and the spider on a virtual clock, in each look given: node life.cjs <dist> <look,look,..>
// Writes life/<look>-dove.png (the dove called, coming in, landing, sitting, leaving: a strip of crops
// round it) and life/<look>-spider.png (the spider sitting, alert, walking and jumping). The build must
// be a preview one for any look but the water (HOUR sets the hour of the day, TAG a prefix for the files); the page is opened with ?perf, which hands the two creatures' places to window.__pond.
const { chromium } = require('playwright');
const { INIT } = require('./virtual.cjs');
const fs = require('node:fs');
(async () => {
  const [, , dir, looks = 'water'] = process.argv;
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  fs.mkdirSync(`${__dirname}/life`, { recursive: true });
  const errs = [],
    asked = [];
  for (const look of looks.split(',')) {
    const ctx = await b.newContext({ viewport: { width: 640, height: 420 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'UTC' });
    const p = await ctx.newPage();
    await p.addInitScript(INIT, +(process.env.HOUR || 12));
    await p.addInitScript(() =>
      localStorage.setItem('pond-seals', JSON.stringify({ found: { ink: '2026-06-01' }, sealed: [], hinted: '2026-06-01', visits: 3 }))
    );
    p.on('pageerror', (e) => errs.push(`${look}: ${e.message.slice(0, 300)}`));
    p.on('request', (r) => /three|life\.|pond\/water/.test(r.url()) && asked.push(r.url().split('/').pop()));
    await p.goto(srv.url + '?perf', { waitUntil: 'load' });
    await p.waitForTimeout(2500);
    const step = (n) => p.evaluate((n) => window.__step(n), n);
    await step(80);
    if (look !== 'water') {
      await p.evaluate((l) => {
        const s = document.querySelector('.preview [data-k=look]');
        s.value = l;
        s.dispatchEvent(new Event('input', { bubbles: true }));
      }, look);
      await step(120);
    }
    const S = 130,
      strip = async (name, cells) => {
        // the crops side by side, on one page of their own
        const q = await ctx.newPage();
        await q.setViewportSize({ width: Math.min(cells.length, 8) * S, height: Math.ceil(cells.length / 8) * S });
        await q.setContent(
          `<body style="margin:0;display:grid;grid-template-columns:repeat(8,${S}px);background:#222">${cells.map((c) => `<img src="data:image/png;base64,${c}" width="${S}" height="${S}">`).join('')}</body>`
        );
        await q.screenshot({ path: `${__dirname}/life/${process.env.TAG || ''}${look}-${name}.png` });
        await q.close();
      },
      crop = async (who) => {
        const at = await p.evaluate((who) => ({ x: window.__pond[who].x, y: window.__pond[who].y, s: window.__pond[who].state }), who);
        await p.waitForTimeout(120);
        const x = Math.max(0, Math.min(640 - S, at.x - S / 2)),
          y = Math.max(0, Math.min(420 - S, at.y - S / 2));
        return { s: at.s, png: (await p.screenshot({ clip: { x, y, width: S, height: S }, timeout: 180000 })).toString('base64') };
      };
    // the spider first: as it sits, with the pointer close (alert), then left to walk or jump
    const sp = await p.evaluate(() => ({ x: window.__pond.spider.x, y: window.__pond.spider.y }));
    const spider = [(await crop('spider')).png];
    await p.mouse.move(sp.x + 120, sp.y + 60);
    await step(4);
    spider.push((await crop('spider')).png);
    await p.mouse.move(sp.x + 20, sp.y + 10);
    for (let i = 0; i < 14; i++) {
      await step(i < 10 ? 2 : 6);
      spider.push((await crop('spider')).png);
    }
    await p.mouse.move(5, 5);
    const states = new Set();
    for (let i = 0; i < 120 && spider.length < 20; i++) {
      await step(2);
      const s = await p.evaluate(() => window.__pond.spider.state);
      if (s !== 'sit' || !states.has('sit')) spider.push((await crop('spider')).png);
      states.add(s);
    }
    await strip('spider', spider);
    // the dove: due at once (it comes by itself every minute or two), followed until it has gone
    await p.evaluate(() => (window.__pond.dove.next = 0));
    await step(2);
    const dove = [];
    let last = '',
      sat = 0;
    for (let i = 0; i < 520 && dove.length < 32; i++) {
      await step(1);
      const d = await p.evaluate(() => ({ s: window.__pond.dove.state, x: window.__pond.dove.x, y: window.__pond.dove.y, h: window.__pond.dove.h }));
      if (d.s === 'away') {
        if (last && last !== 'away') break;
        continue;
      }
      const seen = d.x > 0 && d.x < 640 && d.y > 0 && d.y < 420;
      if (d.s === 'sit') {
        sat++;
        // sitting is long: its first moments, then now and then, then scare it off
        if (sat > 12 && sat % 25) {
          if (sat === 300) await p.mouse.move(d.x + 10, d.y + 10);
          if (sat === 302) await p.mouse.move(d.x + 14, d.y + 12);
          last = d.s;
          continue;
        }
      } else if (!seen || (d.h >= 1 && i % 3)) {
        last = d.s;
        continue;
      }
      dove.push((await crop('dove')).png);
      last = d.s;
    }
    await strip('dove', dove);
    await ctx.close();
  }
  console.log('errors', errs);
  console.log('fetched', [...new Set(asked)]);
  await b.close();
  srv.close();
})();
