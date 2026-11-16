// Checks the room's seasons in headless Chromium, against a built site being served (npm run
// build, then npm run serve, which listens on 4321), and takes their pictures:
//   node tools/pond/room/web/shot-season.cjs [port] [folder for the pictures]
// It takes season-<name>.png for each season (?season=), then, in one page: presses the view
// outside and waits for the next season (season-pressed.png), presses the left screen and expects
// the camera to go to it and the season to stay, opens Texas on the map there, and last loads the
// home page and expects it to ask for nothing under /room/. It prints what it found and exits
// with 1 if anything was wrong (a console error and a failed request count as wrong).
const { chromium } = require('playwright');

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

(async () => {
  const port = process.argv[2] || '4321';
  const out = process.argv[3] || '.';
  const wrong = [];
  const check = (ok, what) => {
    console.log(ok ? 'ok   ' : 'WRONG', what);
    if (!ok) wrong.push(what);
  };
  const browser = await chromium.launch();
  const open = async (path) => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    const asked = [];
    page.on('console', (m) => {
      if (m.type() === 'error') wrong.push(`console error on ${path}: ${m.text()}`);
    });
    page.on('pageerror', (e) => wrong.push(`page error on ${path}: ${e.message}`));
    page.on('requestfailed', (r) => wrong.push(`failed request on ${path}: ${r.url()}`));
    page.on('response', (r) => {
      if (r.status() >= 400) wrong.push(`${r.status()} on ${path}: ${r.url()}`);
    });
    page.on('request', (r) => asked.push(new URL(r.url()).pathname));
    await page.goto(`http://localhost:${port}${path}`);
    return { page, asked };
  };
  const ready = (page) => page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 600000 });
  /** Let the page draw what it has: software WebGL takes about a second a frame. */
  const settle = (page, ms = 2500) => page.waitForTimeout(ms);

  for (const season of SEASONS) {
    const { page, asked } = await open(`/room?still&season=${season}`);
    await ready(page);
    await settle(page);
    const backdrops = asked.filter((p) => p.includes('backdrop'));
    check(backdrops.length === 1 && backdrops[0] === `/room/backdrop-${season}.webp`, `${season}: fetched only its own backdrop (${backdrops.join(', ')})`);
    check((await page.evaluate(() => window.room.season)) === season, `${season}: room.season says so`);
    await page.screenshot({ path: `${out}/season-${season}.png` });
    await page.close();
  }

  // one page for the presses, starting in autumn
  const { page, asked } = await open('/room?still&season=autumn');
  await ready(page);
  await settle(page);
  // a point of the view outside: above the left screen, left of the window's stile
  const outside = await page.evaluate(() => {
    for (const [x, y] of [
      [200, 150],
      [230, 200],
      [1400, 200],
      [560, 120]
    ])
      if (window.room.onOutside(x, y)) return [x, y];
    return null;
  });
  check(outside !== null, 'a point of the view outside is found from the seat');
  if (outside) {
    await page.mouse.move(outside[0], outside[1]);
    await settle(page, 1500);
    check((await page.evaluate(() => document.getElementById('room').style.cursor)) === 'pointer', 'the cursor over the view outside is a pointer');
    await page.mouse.click(outside[0], outside[1]);
    await page.waitForFunction(() => window.room.season === 'winter' && window.room.backdrop.material.uniforms.fade.value === 0, null, { timeout: 600000 });
    await settle(page);
    check(asked.includes('/room/backdrop-winter.webp'), 'the press fetched the next season’s backdrop then, not before');
    check(!(await page.evaluate(() => window.room.focused)), 'the press on the view outside did not go to the screen');
    check(await page.evaluate(() => window.room.weather.visible && window.room.weather.material.uniforms.rain.value === 1), 'rain is falling in winter');
    await page.screenshot({ path: `${out}/season-pressed.png` });
  }
  // the left screen still takes its own press
  const screen = await page.evaluate(() => window.room.statePoint('TX'));
  await page.mouse.click(screen[0], screen[1]);
  await page.waitForFunction(() => window.room.focused && !window.room.focus.moving, null, { timeout: 600000 });
  check((await page.evaluate(() => window.room.season)) === 'winter', 'a press on the left screen focuses it and leaves the season alone');
  await settle(page);
  const texas = await page.evaluate(() => window.room.statePoint('TX'));
  await page.mouse.move(texas[0], texas[1]);
  await settle(page, 1500);
  await page.mouse.click(texas[0], texas[1]);
  await page.waitForFunction(() => window.room.map.opened === 'TX', null, { timeout: 120000 }).catch(() => {});
  check((await page.evaluate(() => window.room.map.opened)) === 'TX', 'pressing Texas on the map opens Texas');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.room.focused && !window.room.focus.moving, null, { timeout: 600000 });
  // setSeason by name, and a name that is no season
  check(await page.evaluate(() => window.room.setSeason('spring')), 'room.setSeason("spring") begins');
  await page.waitForFunction(() => window.room.season === 'spring' && window.room.backdrop.material.uniforms.fade.value === 0, null, { timeout: 600000 });
  check(!(await page.evaluate(() => window.room.weather.visible)), 'nothing falls in spring');
  check((await page.evaluate(() => window.room.setSeason('monsoon'))) === false, 'room.setSeason refuses a name that is no season');
  await page.close();

  // reduced motion: a cut, and nothing falling
  const still = await browser.newPage({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await still.goto(`http://localhost:${port}/room?still&season=winter`);
  await ready(still);
  check(!(await still.evaluate(() => window.room.weather.visible)), 'under reduced motion no rain falls');
  await still.evaluate(() => window.room.setSeason('spring'));
  check(
    await still.evaluate(() => window.room.season === 'spring' && window.room.backdrop.material.uniforms.fade.value === 0),
    'under reduced motion the season is cut to'
  );
  await still.close();

  const home = await open('/');
  await home.page.waitForLoadState('networkidle');
  const room = home.asked.filter((p) => p.startsWith('/room'));
  check(room.length === 0, `the home page asks for nothing under /room/ (${room.join(', ') || 'none'})`);
  await home.page.close();

  await browser.close();
  for (const w of wrong) console.log('WRONG', w);
  console.log(wrong.length ? `${wrong.length} wrong` : 'all as it should be');
  process.exit(wrong.length ? 1 : 0);
})();
