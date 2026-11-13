// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// the finish checklist as contact sheets: node finish.cjs <dist> <look,look,..>
// For each look, finish/<look>.png: the title page, every chapter, the command bar and the album at
// 1280 × 800 (halved), and finish/<look>-phone.png: the title page and three chapters at 390 × 844.
const { chromium } = require('playwright');
const fs = require('node:fs');
const SHEETS = ['seals', 'music', 'notes', 'chat', 'about'];
(async () => {
  const [, , dir, looks] = process.argv;
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  fs.mkdirSync(`${__dirname}/finish`, { recursive: true });
  const errs = [];
  const seals = JSON.stringify({ found: Object.fromEntries(looks.split(',').map((k) => [k, '2026-11-02'])), sealed: [], hinted: '2026-11-01', visits: 3 });
  const run = async (look, phone) => {
    const ctx = await b.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      ...(phone ? { hasTouch: true, isMobile: true } : {})
    });
    await ctx.addInitScript((s) => localStorage.setItem('pond-seals', s), seals);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${look}: ${e.message.slice(0, 200)}`));
    await p.goto(srv.url, { waitUntil: 'load' });
    await p.waitForTimeout(9000);
    if (look !== 'water') {
      await p.evaluate((l) => {
        const s = document.querySelector('.preview [data-k=look]');
        s.value = l;
        s.dispatchEvent(new Event('input', { bubbles: true }));
      }, look);
      for (let i = 0; i < 60; i++) {
        await p.waitForTimeout(500);
        if (
          (await p.evaluate(
            () => document.querySelector('#pond').dataset.look || (document.querySelector('#pond').hasAttribute('data-ink') ? 'ink' : 'water')
          )) === look
        )
          break;
      }
      await p.waitForTimeout(8000);
    }
    const shots = [await p.screenshot({ timeout: 180000 })];
    for (const sh of phone ? ['seals', 'music', 'chat'] : SHEETS) {
      await p.evaluate((sh) => document.querySelector(`[data-sheet=${sh}]`)?.click(), sh);
      await p.waitForTimeout(3200);
      shots.push(await p.screenshot({ timeout: 180000 }));
      await p.keyboard.press('Escape');
      await p.waitForTimeout(900);
    }
    if (!phone) {
      await p.keyboard.press('Control+k');
      await p.waitForTimeout(1500);
      await p.keyboard.type('pho');
      await p.waitForTimeout(1200);
      shots.push(await p.screenshot({ timeout: 180000 }));
    }
    // the sheet of them, on a page of its own
    const cols = phone ? 4 : 3,
      w = phone ? 390 : 640,
      h = phone ? 844 : 400,
      q = await ctx.newPage();
    await q.setViewportSize({ width: cols * w, height: Math.ceil(shots.length / cols) * h });
    await q.setContent(
      `<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},${w}px);background:#444">${shots.map((s) => `<img src="data:image/png;base64,${s.toString('base64')}" width="${w}" height="${h}">`).join('')}</body>`
    );
    await q.screenshot({ path: `${__dirname}/finish/${look}${phone ? '-phone' : ''}.png` });
    await ctx.close();
  };
  for (const look of looks.split(',')) {
    await run(look, false);
    await run(look, true);
    console.log(look, 'done');
  }
  console.log('errors', errs);
  await b.close();
  srv.close();
})();
