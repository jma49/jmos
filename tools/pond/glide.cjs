// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// the layout glide between looks, measured: node glide.cjs <dist> <look,look,..> [w] [h]
// For each change of look it prints, for every block that glides, where it stood before, where it is drawn
// the moment the look's styles apply (it should still be where it stood), and where it ends.
const { chromium } = require('playwright');
(async () => {
  const [, , dir, looks, w = 1280, h = 800] = process.argv;
  const { serveDist } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '../../scripts/serve-dist.mjs')).href);
  const srv = await serveDist({ dir });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 300)));
  await p.goto(srv.url + '?gl', { waitUntil: 'load' });
  await p.waitForTimeout(9000);
  for (const l of [...looks.split(','), 'water']) {
    const out = await p.evaluate(
      (l) =>
        new Promise((done) => {
          const Q = ['#lead', '.alm', '.hud .bl', '.hud .br', '.gauge', '.preview'],
            pond = document.querySelector('#pond'),
            at = () =>
              Q.map((q) => {
                const r = document.querySelector(q).getBoundingClientRect();
                return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
              }),
            before = at();
          new MutationObserver((_, ob) => {
            if ((pond.dataset.look || 'water') !== l) return;
            ob.disconnect();
            // after the engine's own handler has run in this same task
            queueMicrotask(() => {
              const start = at(),
                anims = Q.map((q) => document.querySelector(q).getAnimations().length);
              setTimeout(() => done({ before, start, anims, end: at(), hud: getComputedStyle(document.querySelector('.hud')).opacity }), 1600);
            });
          }).observe(pond, { attributes: true });
          const s = document.querySelector('.preview [data-k=look]');
          s.value = l;
          s.dispatchEvent(new Event('input', { bubbles: true }));
        }),
      l
    );
    console.log(`\n-> ${l}  (hud opacity after: ${out.hud})`);
    ['#lead', '.alm', '.hud .bl', '.hud .br', '.gauge', '.preview'].forEach((q, i) =>
      console.log(q.padEnd(10), 'before', out.before[i].join(','), '| at swap', out.start[i].join(','), `(${out.anims[i]} anim)`, '| end', out.end[i].join(','))
    );
    await p.waitForTimeout(6000);
  }
  console.log('errors', errs);
  await b.close();
  srv.close();
})();
