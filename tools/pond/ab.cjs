// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// Deterministic A/B: a seeded random, a virtual clock and frames stepped by hand, so two builds draw the
// same pond; the models are left out (they arrive on real time). Saves full shots at 2x for each look.
const { chromium } = require('playwright');
const INIT = () => {
  let s = 12345;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let vt = 1000;
  const epoch = Date.UTC(2026, 5, 20, 2, 0, 0); // a June evening, local
  performance.now = () => vt;
  const RD = Date;
  window.Date = class extends RD {
    constructor(...a) {
      super(...(a.length ? a : [epoch + vt]));
    }
    static now() {
      return epoch + vt;
    }
  };
  let q = [];
  window.requestAnimationFrame = (f) => (q.push(f), q.length);
  window.cancelAnimationFrame = () => {};
  let tid = 1,
    timers = new Map();
  const later =
    (rep) =>
    (f, ms = 0, ...a) => {
      const id = tid++;
      timers.set(id, { at: vt + Math.max(0, +ms || 0), f, a, rep: rep ? Math.max(1, +ms || 0) : 0, id });
      return id;
    };
  window.setTimeout = later(false);
  window.setInterval = later(true);
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  const fire = () => {
    for (let k = 0; k < 1000; k++) {
      let t = null;
      for (const x of timers.values()) if (x.at <= vt && (!t || x.at < t.at || (x.at === t.at && x.id < t.id))) t = x;
      if (!t) return;
      if (t.rep) t.at += t.rep;
      else timers.delete(t.id);
      try {
        typeof t.f === 'function' ? t.f(...t.a) : 0;
      } catch (e) {
        console.error(e);
      }
    }
  };
  window.__step = (n) => {
    for (let i = 0; i < n; i++) {
      vt += 50;
      fire();
      const c = q;
      q = [];
      for (const f of c) f(vt);
    }
  };
  window.requestIdleCallback = undefined;
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
  Object.defineProperty(navigator, 'getBattery', { value: undefined });
};
(async () => {
  const [, , tag, dir] = process.argv;
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 480, height: 300 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'UTC' });
  await ctx.route(/life|three/i, (r) => r.abort());
  await ctx.route(
    (u) => !u.href.startsWith(srv.url),
    (r) => r.abort()
  );
  const p = await ctx.newPage();
  await p.addInitScript(INIT);
  if (process.env.SEALS)
    await p.addInitScript(() =>
      localStorage.setItem(
        'pond-seals',
        JSON.stringify({ found: Object.fromEntries(['ink', 'ukiyo', 'ascii'].map((k) => [k, '2026-06-01'])), sealed: [], hinted: '2026-06-01', visits: 3 })
      )
    );
  await p.addInitScript(() =>
    addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
      document.head.append(st);
    })
  );
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(new URL('?preview', srv.url).href, { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const step = (n) => p.evaluate((n) => window.__step(n), n);
  await step(60);
  const press = async () => {
    await p.mouse.click(310, 170);
    await step(6);
  };
  const shot = async (name) => {
    await press();
    await p.waitForTimeout(500);
    await p.screenshot({ timeout: 120000, path: `${__dirname}/ab/${tag}-${name}.png` });
  };
  await shot('water');
  // each look from the preview panel's own list (the page is opened with ?preview), then back to the water
  const to = (l) =>
    p.evaluate((l) => {
      const s = document.querySelector('.preview [data-k=look]');
      s.value = l;
      s.dispatchEvent(new Event('input', { bubbles: true }));
    }, l);
  for (const name of ['ink', 'ukiyo', 'ascii']) {
    await to(name);
    await step(100);
    await shot(name);
    await to('water');
    await step(60);
  }
  console.log(tag, 'errors', errs);
  await b.close();
  srv.close();
})();
