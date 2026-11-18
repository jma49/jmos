// Tries the room's three screens in headless Chromium, against a built site being served (npm run
// build, then npm run serve, which listens on 4321), checks what they do and takes their pictures:
//   node tools/pond/room/web/shot-interact.cjs [port] [folder for the pictures]
//
// With a mouse, on a 1600 x 900 page: a press on the Dell goes up to it and the site's desktop
// comes in a frame laid on its glass, where a real click opens a window (i-dell.png); Escape typed
// inside the frame takes the frame away and goes back to the seat. A press on the MacBook goes up
// to it and gives its terminal the keyboard: `help`, `season winter` (the view outside turns:
// i-macbook.png), Tab's completion, a file opened by a command and by its tab, the wheel, the
// lines typed before; `map` goes across to the Samsung, where Texas still opens; and the seat
// again (i-seat.png). Then the arrow keys, reduced motion, a phone held upright (i-dell-phone.png,
// i-macbook-phone.png), and the home page, which must ask for nothing under /room.
//
// It prints what it found and exits with 1 if anything was wrong. A console error, an uncaught
// error and a failed request of the room's own count as wrong. Inside the framed desktop, only
// errors do: what /os asks of services that are not there locally fails, as it does for
// scripts/smoke.mjs, and what it was still fetching when its frame is taken away is cut off.
//
// Software WebGL draws about a frame a second, so nothing here waits for a length of time: every
// wait is for the page to say that something has happened.
const { chromium } = require('playwright');

const NETWORK = /Failed to load resource|net::ERR_/; // a console line that only repeats a request's failure

(async () => {
  const port = process.argv[2] || '4321';
  const out = process.argv[3] || '.';
  const origin = `http://localhost:${port}`;
  const wrong = [];
  const check = (ok, what, got) => {
    console.log(ok ? 'ok   ' : 'WRONG', what, got === undefined ? '' : JSON.stringify(got));
    if (!ok) wrong.push(what);
  };
  // PLAYWRIGHT_CHROMIUM names a browser to use in place of the one Playwright would download
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
  const LONG = { timeout: 600000 };

  async function open(path, options = {}) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, ...options });
    // the weather, presence and the rest of what the desktop asks of other hosts: none of it is being tried here
    await context.route(/^https:\/\//, (route) => route.abort());
    const page = await context.newPage();
    const asked = [];
    const own = (request) => request.frame() === page.mainFrame();
    page.on('console', (m) => {
      if (m.type() === 'error' && !NETWORK.test(m.text())) wrong.push(`console error on ${path}: ${m.text().slice(0, 300)}`);
    });
    page.on('pageerror', (e) => wrong.push(`page error on ${path}: ${e.message}`));
    page.on('requestfailed', (r) => {
      if (own(r)) wrong.push(`failed request on ${path}: ${r.url()}`);
    });
    page.on('response', (r) => {
      if (r.status() >= 400 && own(r.request())) wrong.push(`${r.status()} on ${path}: ${r.url()}`);
    });
    page.on('request', (r) => asked.push(new URL(r.url()).pathname));
    await page.goto(origin + path);
    if (path.startsWith('/room')) await page.waitForFunction(() => document.body.dataset.ready === '1', null, LONG);

    /** The camera has arrived, the panel has stopped and what changed has been drawn. */
    const rest = () =>
      page.waitForFunction(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(!window.room.focus.moving && window.room.map.settled)))),
        null,
        LONG
      );
    const state = () =>
      page.evaluate(() => ({
        focused: window.room.focused,
        cursor: document.getElementById('room').style.cursor,
        typing: document.activeElement === document.getElementById('keys'),
        frames: document.querySelectorAll('iframe').length
      }));
    /** A point of a screen's glass (0..1 across and down it) on the page. */
    const at = (name, u = 0.5, v = 0.5) => page.evaluate(([n, x, y]) => window.room.screenPoint(n, x, y), [name, u, v]);
    /** How many pictures the page draws and how often the laptop's canvas is drawn again over `frames` animation frames. */
    const drawnOver = (frames) =>
      page.evaluate(
        (n) =>
          new Promise((done) => {
            const was = [window.room.renderer.info.render.frame, window.room.editor.draws];
            let left = n;
            const tick = () =>
              left-- ? requestAnimationFrame(tick) : done([window.room.renderer.info.render.frame - was[0], window.room.editor.draws - was[1]]);
            requestAnimationFrame(tick);
          }),
        frames
      );
    /** Type a line at the terminal and enter it. */
    const enter = async (line) => {
      await page.keyboard.type(line);
      await page.keyboard.press('Enter');
    };
    const seasonIs = (name) =>
      page
        .waitForFunction((n) => window.room.season === n && window.room.backdrop.material.uniforms.fade.value === 0, name, LONG)
        .then(
          () => true,
          () => false
        );
    /** The desktop's frame is on the page, loaded and shown. */
    const deskUp = () => page.waitForFunction(() => window.room.desk.live && getComputedStyle(document.getElementById('desk')).opacity === '1', null, LONG);
    /** The picture has stopped changing (the desktop inside its frame has finished what it was doing): two shots alike. */
    const still = async () => {
      let was = await page.screenshot();
      for (let i = 0; i < 80; i++) {
        const now = await page.screenshot();
        if (now.equals(was)) return true;
        was = now;
      }
      return false;
    };
    const deskGone = () => page.waitForFunction(() => !document.querySelector('iframe') && !window.room.desk.frame, null, LONG);
    return { context, page, asked, rest, state, at, drawnOver, enter, seasonIs, deskUp, deskGone, still };
  }

  // ------------------------------------------------------------------------------------------
  // A mouse.
  // ------------------------------------------------------------------------------------------
  {
    const { context, page, asked, rest, state, at, drawnOver, enter, seasonIs, deskUp, deskGone, still } = await open('/room?still&season=autumn');
    await rest();
    let s = await state();
    check(s.focused === null && !s.typing && s.frames === 0, 'seat: nothing focused, no frame on the page', s);
    check(!asked.some((p) => p === '/os' || p.startsWith('/os/')), 'seat: the desktop is not asked for');
    const hands = {};
    for (const name of ['samsung', 'macbook', 'dell']) {
      await page.mouse.move(...(await at(name)));
      await rest();
      hands[name] = (await state()).cursor;
    }
    check(
      Object.values(hands).every((c) => c === 'pointer'),
      'seat: a hand over each of the three screens',
      hands
    );
    const idle = await drawnOver(8);
    check(idle[1] === 0, 'seat: the laptop’s canvas is not drawn again while nothing on it changes', idle);

    // the Dell: the desktop itself
    await page.mouse.click(...(await at('dell')));
    await rest();
    s = await state();
    check(s.focused === 'dell', 'a press on the Dell goes up to it', s);
    await deskUp();
    const frame = await page.evaluate(() => {
      const el = document.getElementById('desk');
      const box = el.getBoundingClientRect();
      const r = window.room.focus.rect;
      return {
        src: new URL(el.src).pathname,
        off: Math.max(Math.abs(box.x - r.x), Math.abs(box.y - r.y), Math.abs(box.width - r.width), Math.abs(box.height - r.height)),
        tilt: window.room.focus.screen.corners.map((c) => c.clone().project(window.room.camera)).reduce((t, p, i, all) => t + Math.abs(p.y - all[i ^ 1].y), 0),
        inner: [el.contentWindow.innerWidth, el.contentWindow.innerHeight],
        fill: r.height / window.innerHeight
      };
    });
    check(frame.src === '/os', 'the desktop comes in a frame of /os', frame.src);
    check(frame.off <= 1 && frame.tilt < 1e-6, 'the frame lies on the glass, which is level, to the pixel', frame);
    check(
      frame.fill > 0.87 && frame.fill < 0.89 && frame.inner[0] >= 1280,
      'the glass fills 88% of the height and the desktop has at least 1280 across',
      frame
    );
    const covered = await drawnOver(8);
    check(covered[0] === 0, 'the room is not drawn while the desktop covers the screen', covered);
    // a real click inside the frame: the Dock's first icon opens a window
    const desktop = page.frameLocator('#desk');
    await desktop.locator('.os-dock-item').first().waitFor(LONG);
    await still(); // the desktop has started up and opened what it opens by itself
    const windows = await desktop.locator('.os-window').count();
    const icon = await desktop.locator('.os-dock-item').first().boundingBox();
    await page.mouse.click(icon.x + icon.width / 2, icon.y + icon.height / 2);
    await page
      .waitForFunction((n) => document.getElementById('desk').contentDocument.querySelectorAll('.os-window').length > n, windows, { timeout: 120000 })
      .catch(() => {});
    const opened = await desktop.locator('.os-window').count();
    check(opened > windows, 'a click on the Dock inside the frame opens a window there', { before: windows, after: opened });
    s = await state();
    check(s.focused === 'dell' && s.frames === 1, 'the click stayed in the desktop: the camera did not move', s);
    await still(); // the window has opened and filled
    await page.screenshot({ path: `${out}/i-dell.png` });
    // the click put the keyboard in the frame; Escape typed there is still the way out
    check(await page.evaluate(() => document.activeElement === document.getElementById('desk')), 'the keyboard is in the frame after the click');
    await page.keyboard.press('Escape');
    await deskGone();
    await rest();
    s = await state();
    check(s.focused === null && s.frames === 0, 'Escape typed in the desktop takes the frame off the page and goes back to the seat', s);

    // the MacBook: the terminal and the editor
    await page.mouse.click(...(await at('macbook', 0.5, 0.4)));
    await rest();
    s = await state();
    check(s.focused === 'macbook' && s.typing, 'a press on the MacBook goes up to it and gives its terminal the keyboard', s);
    await enter('help');
    let printed = await page.evaluate(() => window.room.editor.printed);
    check(printed.includes('room $ help') && printed.some((l) => l.startsWith('season <name>')), 'help lists the commands, season <name> among them');
    await enter('season winter');
    check(await seasonIs('winter'), 'season winter turns the view outside to winter', await page.evaluate(() => window.room.season));
    check(asked.includes('/room/backdrop-winter.webp'), 'winter’s backdrop was fetched for it');
    check(await page.evaluate(() => window.room.weather.visible && window.room.weather.material.uniforms.rain.value === 1), 'rain is falling');
    await rest();
    await page.screenshot({ path: `${out}/i-macbook.png` });
    await enter('season');
    await enter('nonsense here');
    printed = await page.evaluate(() => window.room.editor.printed);
    check(printed.at(-3) === 'winter' && printed.at(-1) === 'command not found: nonsense', 'season tells it; an unknown command is refused', printed.slice(-4));
    await page.keyboard.type('cat op');
    await page.keyboard.press('Tab');
    check((await page.evaluate(() => window.room.editor.line)) === 'cat optics.ts ', 'Tab completes a file’s name');
    await page.keyboard.press('Enter');
    check((await page.evaluate(() => window.room.editor.file)) === 'optics.ts', 'cat shows the file in the editor');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    check((await page.evaluate(() => window.room.editor.line)) === 'nonsense here', 'Up recalls the lines typed before');
    await page.keyboard.press('Control+c');
    check((await page.evaluate(() => window.room.editor.line)) === '', 'Ctrl+C abandons the line');
    // a tab pressed with the mouse, and the wheel over the editor
    const tab = await page.evaluate(() => window.room.editor.where('terminal.ts'));
    await page.mouse.move(...(await at('macbook', tab[0], tab[1])));
    await rest();
    check((await state()).cursor === 'pointer', 'a hand over a file’s tab');
    await page.mouse.down();
    await page.mouse.up();
    s = await state();
    check(
      (await page.evaluate(() => window.room.editor.file)) === 'terminal.ts' && s.typing,
      'a press on a tab opens its file and the terminal keeps the keyboard',
      s
    );
    await page.mouse.move(...(await at('macbook', 0.5, 0.3)));
    await rest();
    await page.mouse.wheel(0, 400);
    await page.waitForFunction(() => window.room.editor.scrolled[0] > 0, null, { timeout: 120000 }).catch(() => {});
    check(
      (await page.evaluate(() => window.room.editor.scrolled[0])) > 0,
      'the wheel over the editor scrolls the file',
      await page.evaluate(() => window.room.editor.scrolled)
    );
    // across to the Samsung by the terminal's own command; the map still answers
    await enter('map');
    await rest();
    s = await state();
    check(s.focused === 'samsung' && !s.typing, 'map goes across to the Samsung and gives the keyboard back', s);
    const texas = await page.evaluate(() => window.room.statePoint('TX'));
    await page.mouse.move(texas[0], texas[1]);
    await rest();
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction(() => window.room.map.opened === 'TX', null, { timeout: 120000 }).catch(() => {});
    check((await page.evaluate(() => window.room.map.opened)) === 'TX', 'pressing Texas on the map opens Texas');
    await page.keyboard.press('Escape');
    await rest();
    check((await state()).focused === 'samsung' && !(await page.evaluate(() => window.room.map.opened)), 'Escape closes the panel and stays at the screen');

    // the arrows go along the desk; a press on another screen's glass goes to it; os and exit
    await page.keyboard.press('ArrowRight');
    await rest();
    check((await state()).focused === 'macbook', 'ArrowRight from the Samsung goes to the MacBook');
    await page.keyboard.type('ls');
    await page.keyboard.press('ArrowLeft');
    check((await state()).focused === 'macbook', 'the arrows are the line’s while one is being typed');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('ArrowRight');
    await rest();
    await deskUp();
    check((await state()).focused === 'dell', 'ArrowRight from the MacBook goes to the Dell, and its desktop comes');
    await page.keyboard.press('ArrowRight');
    check((await state()).focused === 'dell', 'there is nothing right of the Dell');
    await page.keyboard.press('ArrowLeft');
    await deskGone();
    await rest();
    check((await state()).focused === 'macbook', 'ArrowLeft goes back to the MacBook and the frame is taken away');
    await enter('os');
    await rest();
    await deskUp();
    check((await state()).focused === 'dell', 'os goes across to the Dell');
    const other = await page.evaluate(() => {
      // a point of the page where another screen's glass shows beside the Dell
      for (let y = 40; y < 880; y += 20)
        for (let x = 4; x < 1600; x += 12) {
          const hit = window.room.screenAt(x, y);
          if (hit && hit.name !== 'dell') return [x, y, hit.name];
        }
      return null;
    });
    if (other) {
      await page.mouse.click(other[0], other[1]);
      await deskGone();
      await rest();
      check((await state()).focused === other[2], `a press on the ${other[2]}'s glass beside the Dell goes to it`);
    } else console.log('     (no other screen shows beside the Dell at this size)');
    await page.evaluate(() => window.room.focusScreen('macbook'));
    await rest();
    await enter('exit');
    await rest();
    s = await state();
    check(s.focused === null && !s.typing, 'exit goes back to the seat', s);
    await page.mouse.move(1150, 760);
    await rest();
    await page.screenshot({ path: `${out}/i-seat.png` });
    const hooks = await page.evaluate(() => [
      window.room.focusScreen(),
      window.room.focused,
      window.room.focusScreen('dell'),
      window.room.focused,
      window.room.focusScreen('nowhere'),
      window.room.unfocus(),
      window.room.focused
    ]);
    check(JSON.stringify(hooks) === '[true,"samsung",true,"dell",false,true,null]', 'hooks: focusScreen(name), unfocus, focused', hooks);
    await context.close();
  }

  // ------------------------------------------------------------------------------------------
  // Reduced motion: the push-in is a cut, the caret stands, the desktop comes without a fade.
  // ------------------------------------------------------------------------------------------
  {
    const { context, page, rest, state, drawnOver, deskUp, deskGone } = await open('/room?still&season=summer', {
      viewport: { width: 800, height: 450 },
      reducedMotion: 'reduce'
    });
    await page.evaluate(() => window.room.focusScreen('macbook'));
    await rest();
    const quiet = await drawnOver(6);
    check((await state()).typing && quiet[1] === 0, 'reduced motion: the caret does not blink', quiet);
    await page.evaluate(() => window.room.focusScreen('dell'));
    await rest();
    await deskUp();
    await page.keyboard.press('Escape');
    check(await page.evaluate(() => !document.querySelector('iframe')), 'reduced motion: the frame is gone at once');
    await deskGone();
    await context.close();
  }

  // ------------------------------------------------------------------------------------------
  // A phone held upright: a finger, and the screens' width is what has to fit.
  // ------------------------------------------------------------------------------------------
  {
    const { context, page, rest, state, at, enter, seasonIs, deskUp, deskGone, still } = await open('/room?still&season=autumn', {
      viewport: { width: 390, height: 780 },
      hasTouch: true,
      isMobile: true
    });
    await rest();
    const tap = async (p) => {
      await page.touchscreen.tap(p[0], p[1]);
      await rest();
      return state();
    };
    // what of a screen shows on this narrow page, and a place where none does
    const find = (name) =>
      page.evaluate((n) => {
        for (let y = 20; y < 780; y += 10)
          for (let x = 10; x < 390; x += 10) {
            const hit = window.room.screenAt(x, y);
            if (n ? hit && hit.name === n : !hit) return [x, y];
          }
        return null;
      }, name);
    const dell = await find('dell');
    check(dell !== null, 'phone: some of the Dell shows from the seat', dell);
    let s = await tap(dell || (await at('dell')));
    await deskUp();
    const fit = await page.evaluate(() => {
      const box = document.getElementById('desk').getBoundingClientRect();
      return { width: box.width / window.innerWidth, inner: document.getElementById('desk').contentWindow.innerWidth };
    });
    check(
      s.focused === 'dell' && fit.width > 0.87 && fit.width < 0.89 && fit.inner === 1280,
      'phone: a tap on the Dell brings the desktop, 88% of the width, laid out 1280 across',
      {
        ...s,
        ...fit
      }
    );
    await page.frameLocator('#desk').locator('.os-dock-item').first().waitFor(LONG);
    await still();
    await page.screenshot({ path: `${out}/i-dell-phone.png` });
    s = await tap(await find(null));
    await deskGone();
    check(s.focused === null, 'phone: a tap beside the screen goes back to the seat', s);
    s = await tap(await at('macbook', 0.5, 0.4));
    check(s.focused === 'macbook' && s.typing, 'phone: a tap on the MacBook goes up to it and asks for the keyboard', s);
    check(
      (await page.evaluate(() => window.room.editor.zoom)) > 1,
      'phone: the laptop’s type is made larger',
      await page.evaluate(() => window.room.editor.zoom)
    );
    await enter('help');
    await enter('season winter');
    check(await seasonIs('winter'), 'phone: season winter turns the season');
    await rest();
    await page.screenshot({ path: `${out}/i-macbook-phone.png` });
    // a finger dragged on the editor scrolls it and is not a press
    await enter('cat terminal.ts');
    const p = await at('macbook', 0.5, 0.3);
    const touch = await context.newCDPSession(page);
    const finger = (type, y) => touch.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p[0], y }] });
    await finger('touchStart', p[1]);
    await finger('touchMove', p[1] - 30);
    await finger('touchMove', p[1] - 60);
    await finger('touchEnd');
    await rest();
    s = await state();
    const scrolled = await page.evaluate(() => window.room.editor.scrolled[0]);
    check(scrolled > 0 && s.focused === 'macbook', 'phone: a finger dragged over the editor scrolls it and is not a press', { ...s, scrolled });
    await context.close();
  }

  const home = await open('/');
  await home.page.waitForLoadState('networkidle');
  const room = home.asked.filter((p) => p.startsWith('/room'));
  check(room.length === 0, `the home page asks for nothing under /room (${room.join(', ') || 'none'})`);
  await home.context.close();

  await browser.close();
  for (const w of wrong) console.log('WRONG', w);
  console.log(wrong.length ? `${wrong.length} wrong` : 'all as it should be');
  process.exit(wrong.length ? 1 : 0);
})();
