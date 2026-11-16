// Take the page's picture in headless Chromium: node shot.cjs [port] [out.png] [query] [js to run in the page first]
const { chromium } = require('playwright');

(async () => {
  const port = process.argv[2] || '8765';
  const out = process.argv[3] || 'shot-hero.png';
  const query = process.argv[4] || 'still';
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1
  });
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ReadPixels')) console.log('[page]', m.type(), m.text());
  });
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  page.on('requestfailed', (r) => console.log('[failed]', r.url()));
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/index.html?${query}`);
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, {
    timeout: 300000
  });
  if (process.argv[5]) {
    console.log('eval:', JSON.stringify(await page.evaluate(process.argv[5])));
    await page.evaluate(
      () =>
        new Promise((done) => {
          window.room.redraw();
          requestAnimationFrame(() => requestAnimationFrame(done));
        })
    );
  }
  await page.waitForTimeout(1500); // the note fades out
  await page.screenshot({ path: out });
  console.log('shot', out, 'after', Date.now() - t0, 'ms');
  await browser.close();
})();
