// Tries the left screen with a real pointer in headless Chromium, checks what it does and takes
// its pictures, from a built site being served (npm run build, then npm run serve, which listens
// on 4321): node tools/pond/room/web/shot-map.cjs [port]. Exits 1 if a check fails. The pictures
// go to the folder it is run from.
//
// Software WebGL draws about a frame a second, and the camera's drift after the pointer takes a
// dozen frames to settle. So only the first page has the drift on (the pictures, and the way in
// and out as a visitor goes it); the rest of the checks run on pages with ?still.
//
// The pictures: shot-map.png (the seat), shot-focus.png (after a press on the screen),
// shot-focus-hover.png (the pointer on Texas), shot-focus-open.png (Texas pressed),
// shot-seat-after.png (back at the seat: must be shot-map.png again), shot-focus-phone.png
// (a 390 x 844 page, up at the screen).
const { chromium } = require('playwright');

(async () => {
  const port = process.argv[2] || '4321';
  const url = `http://localhost:${port}/room`;
  const browser = await chromium.launch();
  const VISITED = ['TX', 'FL', 'OH', 'IL', 'IN', 'WI', 'CA', 'WA', 'GA'];
  const OTHERS = ['CO', 'OK', 'MI', 'NY', 'NV', 'AK'];
  let failed = 0;
  const check = (name, ok, got) => {
    if (!ok) failed++;
    console.log(ok ? 'ok  ' : 'FAIL', name, got === undefined ? '' : JSON.stringify(got));
  };

  async function start(options, query = 'still') {
    const page = await browser.newPage({ deviceScaleFactor: 1, ...options });
    page.on('console', (m) => {
      if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ReadPixels')) console.log('[page]', m.type(), m.text());
    });
    page.on('pageerror', (e) => {
      failed++;
      console.log('[page error]', e.message);
    });
    page.on('requestfailed', (r) => console.log('[failed]', r.url()));
    await page.goto(`${url}?${query}`);
    await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 300000 });
    await page.waitForTimeout(1500); // the note fades out
    const state = () =>
      page.evaluate(() => ({
        focused: room.focused,
        hovered: room.map.hovered,
        opened: room.map.opened,
        cursor: document.getElementById('room').style.cursor
      }));
    // the picture has caught up: the drift and the camera have come to rest and the panel has stopped
    const rest = async () => {
      for (let i = 0; i < 2400; i++) {
        const still = await page.evaluate(
          () =>
            new Promise((done) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => done(room.drift.tx === room.drift.x && room.drift.ty === room.drift.y && room.map.settled && !room.focus.moving))
              )
            )
        );
        if (still) return;
        await page.waitForTimeout(50);
      }
      throw new Error('the picture did not come to rest');
    };
    const at = (id) => page.evaluate((s) => room.statePoint(s), id);
    /** How much of the page's width and height the screen's glass takes, and whether it is level. */
    const fill = () =>
      page.evaluate(() => {
        const p = room.focus.screen.corners.map((c) => c.clone().project(room.camera));
        const xs = p.map((v) => v.x),
          ys = p.map((v) => v.y);
        const r = (v) => Math.round(v * 1000) / 1000;
        return {
          width: r((Math.max(...xs) - Math.min(...xs)) / 2),
          height: r((Math.max(...ys) - Math.min(...ys)) / 2),
          tilt: r(Math.abs(p[0].y - p[1].y) + Math.abs(p[2].y - p[3].y) + Math.abs(p[0].x - p[2].x) + Math.abs(p[1].x - p[3].x)),
          near: r(room.camera.position.distanceTo(room.focus.screen.centre))
        };
      });
    return { page, state, rest, at, fill };
  }

  // ------------------------------------------------------------------------------------------
  // A mouse.
  // ------------------------------------------------------------------------------------------
  const DESK = [1150, 760],
    BESIDE = [1585, 450]; // right of the screen once the camera is up at it
  async function mouse(query) {
    const made = await start({ viewport: { width: 1600, height: 900 } }, query);
    const { page, state, rest, at } = made;
    const click = async () => {
      await page.mouse.down();
      await page.mouse.up();
      await rest();
      return state();
    };
    // put the pointer on a state: the camera drifts after the pointer, so aim again until it holds
    const moveTo = async (id) => {
      let p,
        was = [1e9, 1e9];
      for (let i = 0; i < 6; i++) {
        p = await at(id);
        if (Math.hypot(p[0] - was[0], p[1] - was[1]) < 0.5) break;
        was = p;
        await page.mouse.move(p[0], p[1], { steps: 2 });
        await rest();
      }
      return state();
    };
    const toDesk = async () => {
      await page.mouse.move(...DESK);
      await rest();
    };
    return { ...made, click, moveTo, toDesk };
  }

  // in and out as a visitor goes, the camera drifting after the pointer; and the pictures
  {
    const { page, state, rest, fill, click, moveTo, toDesk } = await mouse('');
    await toDesk();
    let s = await state();
    check('seat: nothing focused, hovered or open', !s.focused && !s.hovered && !s.opened && !s.cursor, s);
    const seatBefore = await page.screenshot({ path: 'shot-map.png' });

    // from the seat the screen is one thing to press: a hand, but no state answers
    s = await moveTo('TX');
    check('seat: a hand over the screen, no state lit', s.cursor === 'pointer' && !s.hovered, s);
    s = await click();
    check('first press goes up to the screen and opens nothing', s.focused && !s.opened, s);
    const f = await fill();
    check(
      'the screen fills 85-90% of the height, level, clear of the near plane',
      f.height >= 0.85 && f.height <= 0.9 && f.width < 0.9 && f.tilt < 0.01 && f.near > 0.2,
      f
    );
    await moveTo('NV'); // somewhere that lights nothing
    await page.screenshot({ path: 'shot-focus.png' });

    s = await moveTo('TX');
    check('focused: Texas lights under the pointer', s.hovered === 'TX' && s.cursor === 'pointer', s);
    await page.screenshot({ path: 'shot-focus-hover.png' });
    const drawn = await page.evaluate(() => [room.map.draws, room.map.motionDraws]);
    s = await click();
    check('second press, on Texas, opens Texas', s.focused && s.opened === 'TX', s);
    const slide = await page.evaluate(([d, m]) => [room.map.draws - d, room.map.motionDraws - m], drawn);
    check('the slide is drawn on the small sheet but for its last frame', slide[1] >= 1 && slide[0] - slide[1] <= 1, { frames: slide[0], small: slide[1] });
    await moveTo('NV');
    await page.screenshot({ path: 'shot-focus-open.png' });

    await page.keyboard.press('Escape');
    await rest();
    s = await state();
    check('Escape closes the panel and stays at the screen', s.focused && !s.opened, s);
    await page.keyboard.press('Escape');
    await rest();
    s = await state();
    check('a second Escape goes back to the seat', !s.focused && !s.opened, s);
    await toDesk();
    const seatAfter = await page.screenshot({ path: 'shot-seat-after.png' });
    check('the seat looks as it did before, pixel for pixel', seatBefore.equals(seatAfter));
    await page.close(); // two pages drawing at once in software lose presses
  }

  // everything else a mouse can do
  {
    const { page, state, rest, click, moveTo } = await mouse('still');
    let s = await moveTo('GA');
    check('seat: a hand over the screen, no state lit', s.cursor === 'pointer' && !s.hovered, s);
    s = await click();
    check('first press goes up to the screen and opens nothing', s.focused && !s.opened, s);

    // every visited state answers under the pointer, and the others do not
    const hit = {};
    for (const id of VISITED) {
      s = await moveTo(id);
      hit[id] = s.hovered;
      if (s.cursor !== 'pointer') check(`focused: a hand on ${id}`, false, s);
    }
    check(
      'focused: all nine visited states hit',
      VISITED.every((id) => hit[id] === id),
      hit
    );
    const miss = {};
    for (const id of OTHERS) miss[id] = (await moveTo(id)).hovered;
    check(
      'focused: states not visited do not answer',
      Object.values(miss).every((v) => v === null),
      miss
    );

    await moveTo('CO');
    s = await click();
    check('a press on a state not visited does nothing', s.focused && !s.opened, s);
    const before = await page.evaluate(() => room.map.draws);
    await page.waitForTimeout(800);
    check('nothing is drawn while nothing changes', (await page.evaluate(() => room.map.draws)) === before);
    const pressed = {};
    for (const id of VISITED) {
      await moveTo(id);
      pressed[id] = (await click()).opened;
      await page.keyboard.press('Escape');
      await rest();
    }
    s = await state();
    check('focused: all nine visited states open when pressed', VISITED.every((id) => pressed[id] === id) && s.focused && !s.opened, pressed);

    // out of the panel: the close button, a press beside the panel
    for (const [name, where] of [
      ['close', 'close'],
      ['aside', 'aside']
    ]) {
      await moveTo('GA');
      const was = (await click()).opened;
      const p = await page.evaluate((kind) => {
        for (let y = 60; y < 840; y += 4)
          for (let x = 100; x < 1500; x += 4) {
            const h = room.pick(x, y);
            if (h && h.kind === kind) return [x + 8, y + 8];
          }
        return null;
      }, where);
      await page.mouse.move(p[0], p[1], { steps: 3 });
      await rest();
      const hand = (await state()).cursor;
      s = await click();
      check(`${name}: Georgia opens and closes, the camera stays`, was === 'GA' && !s.opened && s.focused && (where !== 'close' || hand === 'pointer'), {
        was,
        hand,
        ...s
      });
    }

    // out of the screen: a press beside it, the control on the page, the hooks
    await page.mouse.move(...BESIDE);
    await rest();
    check('beside the screen the pointer says "back"', (await state()).cursor === 'zoom-out', await state());
    s = await click();
    check('a press beside the screen goes back to the seat', !s.focused, s);
    await moveTo('WA');
    s = await click();
    check('a press on the screen goes up again', s.focused && !s.opened, s);
    await page.click('#back');
    await rest();
    s = await state();
    check('the back control goes back to the seat', !s.focused, s);
    const hooks = await page.evaluate(() => [room.focusScreen(), room.focused, room.focusScreen(), room.unfocus(), room.focused, room.unfocus()]);
    check('hooks: focusScreen, unfocus, focused', JSON.stringify(hooks) === '[true,true,false,true,false,false]', hooks);
    await rest();
    await page.close();
  }

  // ------------------------------------------------------------------------------------------
  // A finger.
  // ------------------------------------------------------------------------------------------
  {
    const { page, state, rest, at } = await start({ viewport: { width: 1600, height: 900 }, hasTouch: true }, ''); // a finger drags no drift behind it
    const tap = async (p) => {
      await page.touchscreen.tap(p[0], p[1]);
      await page.waitForTimeout(100);
      await rest();
      return state();
    };
    let s = await tap(await at('TX'));
    check('tap: the first goes up to the screen and opens nothing', s.focused && !s.opened, s);
    s = await tap(await at('CO'));
    check('tap: a state not visited does nothing', s.focused && !s.opened, s);
    const taps = {};
    for (const id of VISITED) {
      taps[id] = (await tap(await at(id))).opened;
      await page.evaluate(() => room.closeState());
      await rest();
    }
    check(
      'tap: all nine visited states open',
      VISITED.every((id) => taps[id] === id),
      taps
    );
    s = await tap(await at('TX'));
    check('tap: Texas opens', s.focused && s.opened === 'TX' && !s.hovered, s);
    await page.keyboard.press('Escape');
    await rest();
    s = await tap([1585, 450]);
    check('tap: beside the screen goes back to the seat', !s.focused && !s.opened, s);
    await page.close();
  }

  // ------------------------------------------------------------------------------------------
  // A phone held upright: the screen's width is what has to fit.
  // ------------------------------------------------------------------------------------------
  {
    const { page, state, rest, at, fill } = await start({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await page.touchscreen.tap(...(await at('IL')));
    await page.waitForTimeout(100);
    await rest();
    const s = await state(),
      f = await fill();
    check(
      'phone: a tap goes up to the screen, which fills 85-90% of the width',
      s.focused && !s.opened && f.width >= 0.85 && f.width <= 0.9 && f.height < 0.9 && f.tilt < 0.004,
      { ...s, ...f }
    );
    await page.screenshot({ path: 'shot-focus-phone.png' });
    await page.touchscreen.tap(...(await at('FL')));
    await page.waitForTimeout(100);
    await rest();
    check('phone: a tap on Florida opens Florida', (await state()).opened === 'FL', await state());
    await page.close();
  }

  await browser.close();
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
})();
