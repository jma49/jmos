// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// each look arriving and leaving, on a virtual clock: frames at fixed moments
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
  await p.goto(srv.url, { waitUntil: 'load' });
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
  for (const l of looks.split(',')) {
    await set(l);
    let at = 0;
    for (const [i, n] of [5, 11, 18, 28, 70].entries()) {
      await step(n - at);
      at = n;
      await shot(`${l}-in-${i}`);
    }
    await set('water');
    at = 0;
    for (const [i, n] of [5, 12].entries()) {
      await step(n - at);
      at = n;
      await shot(`${l}-out-${i}`);
    }
    await step(50);
  }
  console.log('errors', errs);
  await b.close();
  srv.close();
})();
