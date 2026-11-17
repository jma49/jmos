// Makes what the room's two plain screens show (docs/decisions/0030), from a built site being
// served (npm run build, then npm run serve, which listens on 4321):
//   node tools/pond/room/web/shot-screens.cjs [port]
//
// The Dell shows the site's own desktop: public/room/screens/dell.webp is a picture of /os at
// 2560 x 1440, the Dell's own pixels, with two windows open (Projects and Macintosh HD). What the
// page shows is pinned as scripts/capture-previews.mjs pins it (the clock and time zone, reduced
// motion, which also skips the boot screen), and nothing outside the site is fetched, so an
// unchanged site makes the same picture again.
//
// The MacBook's terminal shows the newest commits on main: src/room/terminal.json is the command
// and what it printed, subjects only. Run this again when either should catch up.
const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { chromium } = require('playwright');

const ROOT = resolve(__dirname, '../../../..');
const DELL = join(ROOT, 'public/room/screens/dell.webp');
const TERMINAL = join(ROOT, 'src/room/terminal.json');
const SIZE = { width: 2560, height: 1440 };
const QUALITY = 0.36; // WebP's: the pebbles are fine detail all over and take most of the bytes; the type is still clean at this
const NOW = new Date('2026-09-25T09:41:00-07:00');
const LOG = ['log', '--oneline', '-8', 'origin/main'];

/** Drags a window by its title bar until its top left corner is at (x, y). */
async function moveWindow(page, name, x, y) {
  const box = await page.locator(`.os-window[aria-label="${name}"]`).boundingBox();
  const grip = { x: box.x + box.width / 2, y: box.y + 11 };
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + (x - box.x) / 2, grip.y + (y - box.y) / 2, { steps: 4 });
  await page.mouse.move(grip.x + x - box.x, grip.y + y - box.y, { steps: 4 });
  await page.mouse.up();
}

(async () => {
  const port = process.argv[2] || '4321';

  writeFileSync(
    TERMINAL,
    JSON.stringify({ command: `git ${LOG.join(' ')}`, lines: execFileSync('git', LOG, { cwd: ROOT, encoding: 'utf8' }).trim().split('\n') }, null, 2) + '\n'
  );
  console.log('wrote', TERMINAL);

  // PLAYWRIGHT_CHROMIUM names a browser to use in place of the one Playwright would download
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    timezoneId: 'America/Los_Angeles'
  });
  // the weather, presence and the rest of what the desktop asks of other hosts: none of it is in the picture
  await context.route(/^https:\/\//, (route) => route.abort());
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[page error]', e.message));
  await page.clock.setFixedTime(NOW);
  await page.goto(`http://localhost:${port}/os?open=projects`, { waitUntil: 'load' });
  // The site keeps room for a scroll bar beside the page (global.css), which a Mac's own browser
  // gives none of: here it would be a pale strip down the picture's right edge.
  await page.addStyleTag({ content: 'html { scrollbar-gutter: auto !important; }' });
  await page.locator('.os-window[aria-label="Projects"]').waitFor();
  await page.getByText('Macintosh HD').first().dblclick();
  await page.locator('.os-window[aria-label="Macintosh HD"]').waitFor();
  await moveWindow(page, 'Macintosh HD', 1380, 560);
  await moveWindow(page, 'Projects', 420, 250);
  await page.mouse.move(SIZE.width / 2, SIZE.height - 300); // off the windows and the Dock
  // the windows' own pictures (icons, covers), then a moment for the desktop to come to rest
  await page.evaluate(async () => {
    const shown = [...document.images].filter((img) => img.checkVisibility());
    const ready = Promise.all([document.fonts.ready, ...shown.map((img) => img.decode().catch(() => {}))]);
    await Promise.race([ready, new Promise((done) => setTimeout(done, 10000))]);
  });
  await page.waitForTimeout(2500);
  const png = await page.screenshot({ type: 'png' });
  await context.close();

  // Playwright writes PNG and JPEG only; the browser itself encodes the WebP
  const scratch = await browser.newPage();
  const webp = await scratch.evaluate(
    async ({ data, quality }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/webp', quality })).arrayBuffer());
      let text = '';
      for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(text);
    },
    { data: png.toString('base64'), quality: QUALITY }
  );
  await browser.close();
  mkdirSync(join(ROOT, 'public/room/screens'), { recursive: true });
  writeFileSync(DELL, Buffer.from(webp, 'base64'));
  console.log('wrote', DELL, Math.round(Buffer.from(webp, 'base64').length / 1024), 'KB');
})();
