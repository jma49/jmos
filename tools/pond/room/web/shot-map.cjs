// Tries the map on the left screen with a real pointer in headless Chromium and takes its
// pictures: node shot-map.cjs [port]. Writes shot-map.png, shot-map-hover.png, shot-map-open.png.
const { chromium } = require('playwright');

(async () => {
  const port = process.argv[2] || '8765';
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
  await page.goto(`http://localhost:${port}/index.html`); // with the drift on
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, {
    timeout: 300000
  });
  await page.waitForTimeout(1500); // the note fades out
  const state = () =>
    page.evaluate(() => ({
      hovered: room.map.hovered,
      opened: room.map.opened,
      cursor: document.getElementById('room').style.cursor,
      draws: room.map.draws
    }));
  // the picture has caught up with the pointer: the drift has come to rest and the panel has stopped
  const rest = () =>
    page.waitForFunction(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => done(Math.abs(room.drift.tx - room.drift.x) + Math.abs(room.drift.ty - room.drift.y) < 2e-4 && room.map.settled))
          )
        ),
      null,
      { timeout: 120000, polling: 100 }
    );
  // put the pointer on a state: the camera drifts after the pointer, so aim again until it holds
  const moveTo = async (id, dx = 0, dy = 0) => {
    let at,
      was = [1e9, 1e9];
    for (let i = 0; i < 5; i++) {
      at = await page.evaluate((s) => room.statePoint(s), id);
      if (Math.hypot(at[0] - was[0], at[1] - was[1]) < 0.5) break;
      was = at;
      await page.mouse.move(at[0] + dx, at[1] + dy, { steps: 2 });
      await rest();
    }
    return at.map(Math.round);
  };
  const results = {};
  const step = (name) => console.log('..', name, JSON.stringify(results[name]));

  await page.mouse.move(1150, 760); // on the desk
  await rest();
  results.idle = await state();
  step('idle');
  await page.screenshot({ path: 'shot-map.png' });

  results.texasAt = await moveTo('TX');
  results.hoverTexas = await state();
  step('hoverTexas');
  await page.screenshot({ path: 'shot-map-hover.png' });

  // every visited state answers under the pointer, and its neighbours do not
  results.hover = {};
  for (const id of ['FL', 'OH', 'IL', 'IN', 'WI', 'CA', 'WA', 'GA', 'TX', 'NY', 'CO', 'OK', 'MI']) {
    await moveTo(id);
    const s = await state();
    results.hover[id] = `${s.hovered}/${s.cursor || 'default'}`;
    console.log(id, results.hover[id]);
  }

  // a press on a state that was not visited, and one off the screen
  await moveTo('CO');
  await page.mouse.down();
  await page.mouse.up();
  await rest();
  results.clickColorado = await state();
  step('clickColorado');
  await page.mouse.move(1150, 760);
  await page.mouse.down();
  await page.mouse.up();
  await rest();
  results.clickDesk = await state();
  step('clickDesk');
  const before = results.clickDesk.draws;
  await page.waitForTimeout(800);
  results.idleDraws = (await state()).draws - before; // nothing is drawn while nothing changes

  await moveTo('TX');
  await page.mouse.down();
  await page.mouse.up();
  await rest();
  results.clickTexas = await state();
  step('clickTexas');
  await page.mouse.move(1150, 760);
  await rest();
  await page.screenshot({ path: 'shot-map-open.png' });

  // out again: Escape, the close button, a press beside the panel, the hook
  await page.keyboard.press('Escape');
  await rest();
  results.escape = await state();
  step('escape');
  for (const [name, back] of [
    [
      'closeButton',
      async () => {
        const at = await page.evaluate(() => {
          for (let y = 250; y < 420; y += 2)
            for (let x = 600; x < 820; x += 2) {
              const h = room.pick(x, y);
              if (h && h.kind === 'close') return [x + 6, y + 6];
            }
          return null;
        });
        await page.mouse.move(at[0], at[1], { steps: 3 });
        await rest();
        results.closeHover = await state();
        step('closeHover');
        await page.mouse.down();
        await page.mouse.up();
      }
    ],
    [
      'aside',
      async () => {
        await page.mouse.move(330, 420, { steps: 3 });
        await rest();
        await page.mouse.down();
        await page.mouse.up();
      }
    ],
    [
      'hook',
      async () => {
        await page.evaluate(() => room.closeState());
      }
    ]
  ]) {
    await moveTo('GA');
    await page.mouse.down();
    await page.mouse.up();
    await rest();
    const opened = (await state()).opened;
    await back();
    await rest();
    results[name] = `${opened} -> ${(await state()).opened}`;
  }
  results.hookOpen = await page.evaluate(() => [room.openState('TX'), room.map.opened, room.openState('CO'), room.closeState(), room.map.opened]);
  await rest();

  // a finger (the first page is closed first: two pages drawing at once in software lose taps)
  await page.close();
  const touch = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: true
  });
  await touch.goto(`http://localhost:${port}/index.html`);
  await touch.waitForFunction(() => document.body.dataset.ready === '1', null, {
    timeout: 300000
  });
  const tap = async (id) => {
    const at = await touch.evaluate((s) => room.statePoint(s), id);
    await touch.touchscreen.tap(at[0], at[1]);
    await touch.waitForTimeout(900);
    return touch.evaluate(() => room.map.opened);
  };
  results.tapColorado = await tap('CO');
  results.tapFlorida = await tap('FL');
  console.log(JSON.stringify(results, null, 1));
  await browser.close();
})();
