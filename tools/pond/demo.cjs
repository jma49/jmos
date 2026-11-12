// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// the demo's screenshots: node demo.cjs <dist> <stamps|album|looks|winter>
const { chromium } = require('playwright');
const ALL = ['ink', 'ukiyo', 'glow', 'blueprint', 'ascii', 'monet', 'qinghua', 'dunhuang', 'stars', 'relief'],
  NEW = ALL.slice(5);
const out = __dirname + '/demo/';
(async () => {
  const [, , dir, what] = process.argv;
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  const open = async ({ phone, lang = 'en', seals, winter, hash = '' }) => {
    const ctx = await b.newContext(
      phone
        ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: what === 'titles' ? 1 : 2 }
        : { viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 }
    );
    await ctx.addInitScript(
      ([lang, seals, winter]) => {
        localStorage.setItem('pond-lang', lang);
        if (seals) localStorage.setItem('pond-seals', seals);
        if (winter) {
          const RD = Date,
            off = RD.UTC(2027, 0, 16, 20) - RD.now();
          window.Date = class extends RD {
            constructor(...a) {
              super(...(a.length ? a : [RD.now() + off]));
            }
            static now() {
              return RD.now() + off;
            }
          };
        }
      },
      [lang, seals || '', !!winter]
    );
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
    await p.goto(srv.url + hash, { waitUntil: 'load' });
    await p.waitForTimeout(10000);
    return p;
  };
  const setLook = (p, l) =>
    p.evaluate((l) => {
      const s = document.querySelector('.preview [data-k=look]');
      s.value = l;
      s.dispatchEvent(new Event('input', { bubbles: true }));
    }, l);
  const arrived = async (p, l) => {
    for (let i = 0; i < 50; i++) {
      await p.waitForTimeout(400);
      if ((await p.evaluate(() => document.querySelector('#pond').dataset.look || 'water')) === l) break;
    }
    await p.waitForTimeout(5500);
  };
  const shot = (p, name, clip) => p.screenshot({ path: out + name + '.png', timeout: 120000, ...(clip ? { clip } : {}) });
  const lang = async (p, g) => {
    await p.evaluate((g) => document.querySelector(`[data-lang=${g}]`).click(), g);
    await p.waitForTimeout(1800);
  };
  const found = (ids) =>
    JSON.stringify({
      found: Object.fromEntries(ids.map((k, i) => [k, `2026-11-${String(2 + i).padStart(2, '0')}`])),
      sealed: [],
      hinted: '2026-11-01',
      visits: 3
    });
  if (what === 'stamps') {
    const p = await open({});
    for (const l of ALL) {
      for (let i = 0; i < 30; i++) {
        if (!(await p.evaluate(() => 'on' in document.querySelector('#stamp').dataset))) break;
        await p.waitForTimeout(400);
      }
      await setLook(p, l);
      for (let i = 0; i < 60; i++) {
        await p.waitForTimeout(400);
        if (await p.evaluate(() => 'on' in document.querySelector('#stamp').dataset)) break;
      }
      await p.waitForTimeout(500);
      await p.evaluate(() => {
        const e = document.querySelector('#stamp');
        e.style.animation = 'none';
        e.style.opacity = 1;
      });
      await shot(p, 'stamp-' + l, { x: 660, y: 380, width: 300, height: 220 });
      await p.waitForTimeout(3200);
      await p.evaluate(() => {
        const e = document.querySelector('#stamp');
        e.style.animation = '';
        e.style.opacity = '';
      });
    }
  } else if (what === 'album') {
    const states = { empty: found([]), part: found(['ink', 'glow', 'monet', 'stars', 'ukiyo', 'ascii']), full: found(ALL) };
    for (const [st, seals] of Object.entries(states))
      for (const [g, phone] of [
        ['en', false],
        ['zh', false],
        ['ja', false],
        [{ empty: 'en', part: 'zh', full: 'ja' }[st], true]
      ]) {
        const p = await open({ phone, lang: g, seals, hash: '#seals' });
        await p.waitForTimeout(3500);
        await p.evaluate(() => document.querySelectorAll('.album .seal-m').forEach((e) => e.getAnimations().forEach((a) => a.finish())));
        await shot(p, `album-${st}-${g}${phone ? '-phone' : ''}`);
        await p.context().close();
      }
  } else if (what === 'looks') {
    const p = await open({ seals: found(ALL) });
    for (const l of NEW) {
      await lang(p, 'en');
      await setLook(p, l);
      await arrived(p, l);
      await shot(p, `${l}-title-en`);
      await lang(p, 'zh');
      await p.evaluate(() => document.querySelector('[data-sheet=about]').click());
      await p.waitForTimeout(3000);
      await shot(p, `${l}-chapter-zh`);
      await p.keyboard.press('Escape');
      await p.waitForTimeout(1200);
      await lang(p, 'ja');
      await p.mouse.click(700, 330);
      await p.waitForTimeout(700);
      await p.mouse.click(760, 420);
      await p.waitForTimeout(900);
      await shot(p, `${l}-press-ja`);
    }
  } else if (what === 'titles') {
    const p = await open({ seals: found(ALL) });
    for (const l of NEW) {
      await setLook(p, l);
      await arrived(p, l);
      await shot(p, `${l}-title2-en`);
    }
    await p.context().close();
    const q = await open({ seals: found(ALL), phone: true, lang: 'zh' });
    for (const l of NEW) {
      await lang(q, 'zh');
      await setLook(q, l);
      await arrived(q, l);
      await shot(q, `${l}-phone-zh`);
      await lang(q, 'ja');
      await shot(q, `${l}-phone-ja`);
    }
  } else if (what === 'family') {
    const ctx = await b.newContext({ viewport: { width: 760, height: 1180 }, deviceScaleFactor: 2 });
    await ctx.addInitScript((s) => localStorage.setItem('pond-seals', s), found(ALL));
    const p = await ctx.newPage();
    await p.goto(srv.url + '#seals', { waitUntil: 'load' });
    await p.waitForTimeout(14000);
    await p.evaluate(() => document.querySelectorAll('.album .seal-m').forEach((e) => e.getAnimations().forEach((a) => a.finish())));
    await shot(p, 'seals-family');
  } else if (what === 'winter') {
    const p = await open({ seals: found(ALL), winter: true });
    for (const l of NEW) {
      await setLook(p, l);
      await arrived(p, l);
      await shot(p, `${l}-winter-en`);
    }
  }
  console.log(what, 'errors', errs);
  await b.close();
  srv.close();
})();
