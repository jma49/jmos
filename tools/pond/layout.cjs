// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// where the page's blocks stand in each look: node layout.cjs <dist> [w] [h] [lang]
// Prints, for every look, each block's box (left, top, width, height), and at the end which boxes differ
// from the water's by more than a pixel. The page should keep one layout whatever face a look sets it in.
const { chromium } = require('playwright');
const Q = {
  hero: '#hero',
  say: '.say',
  toc: '#toc',
  row1: '#toc .row:nth-child(1)',
  row4: '#toc .row:nth-child(4)',
  go1: '#toc .row:nth-child(1) .go b',
  alm: '.alm .txt',
  term: '#termV',
  snd: '#snd',
  cmd: '#cmdBtn',
  lang: '#langBtn',
  clear: '#clear',
  talk: '#talk',
  gauge: '#gauge'
};
(async () => {
  const [, , dir, w = 1280, h = 800, lang = 'en'] = process.argv;
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, ...(+w < 600 ? { hasTouch: true, isMobile: true } : {}) });
  await ctx.addInitScript((g) => localStorage.setItem('pond-lang', JSON.stringify(g)), lang);
  const p = await ctx.newPage();
  await p.goto(srv.url, { waitUntil: 'load' });
  await p.waitForTimeout(9000);
  // one greeting for every look, so only the face differs
  const fix = () =>
    p.evaluate(
      () =>
        (document.querySelector('#hero').textContent =
          document.documentElement.lang === 'en' || !/[^\x00-\x7f]/.test(document.querySelector('#hero').textContent)
            ? 'Come in, the water’s fine.'
            : document.querySelector('#hero').textContent)
    );
  const looks = ['water', 'ink', 'ukiyo', 'glow', 'blueprint', 'ascii', 'monet', 'qinghua', 'dunhuang', 'stars', 'relief'],
    seen = {};
  for (const l of looks) {
    if (l !== 'water') {
      await p.evaluate((l) => {
        const s = document.querySelector('.preview [data-k=look]');
        s.value = l;
        s.dispatchEvent(new Event('input', { bubbles: true }));
      }, l);
      for (let i = 0; i < 60; i++) {
        await p.waitForTimeout(500);
        if (
          (await p.evaluate(
            () => document.querySelector('#pond').dataset.look || (document.querySelector('#pond').hasAttribute('data-ink') ? 'ink' : 'water')
          )) === l
        )
          break;
      }
      await p.waitForTimeout(3500);
    }
    await fix();
    await p.waitForTimeout(300);
    seen[l] = await p.evaluate(
      (Q) =>
        Object.fromEntries(
          Object.entries(Q).map(([k, q]) => {
            const e = document.querySelector(q);
            if (!e) return [k, null];
            const r = e.getBoundingClientRect();
            return [k, [r.left, r.top, r.width, r.height].map((v) => Math.round(v))];
          })
        ),
      Q
    );
  }
  for (const k of Object.keys(Q)) {
    const base = seen.water[k],
      off = looks.filter((l) => seen[l][k] && base && seen[l][k].some((v, i) => Math.abs(v - base[i]) > 1));
    console.log(k.padEnd(6), String(base).padEnd(18), off.length ? off.map((l) => `${l}:${seen[l][k]}`).join('  ') : 'same in every look');
  }
  await b.close();
  srv.close();
})();
