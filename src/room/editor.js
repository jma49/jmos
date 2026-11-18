// What the MacBook's own screen shows, and what it does: an editor with a few of this page's own
// source files, and under it a terminal that works. Nothing on it is made up. The files are as
// they are in the repository (Vite hands over their text when the site is built, so the screen
// follows them), the terminal's commands act on the room itself (terminal.ts says what each
// means; main.js carries out what they ask), and `git log` prints the commits that
// tools/pond/room/web/shot-screens.cjs wrote into terminal.json.
//
// It is one canvas of the panel's shape (3024 x 1964 at three quarters) that main.js puts on the
// screen's glass, as map.js's sheet is put on the Samsung's. It is drawn again only when
// something on it changes (a key, a file opened, a scroll, the caret's blink while the terminal
// has the keyboard); main.js asks update() once a frame and sends the canvas to the graphics
// card when it hands it back. The editor fills the screen, as one in full screen does: no menu
// bar, no Dock.
//
// The keys come from an <input> on the page that nobody sees (bind()): it holds the line being
// typed, so a phone's keyboard, a paste and an input method all work as they do in any field, and
// the canvas only shows what the field holds.
import monoUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url';
import opticsSource from './optics.ts?raw';
import placesSource from './places.json?raw';
import readmeSource from './readme.txt?raw';
import seasonSource from './season.ts?raw';
import terminalSource from './terminal.ts?raw';
import { complete, createHistory, PROMPT, run, wrap } from './terminal';

const W = 2268,
  H = 1473;
const FACE = 'Room Mono'; // JetBrains Mono, under a name of this page's own
const MONO = `'${FACE}', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`;
const EDGE = 28; // from the screen's side to the text
const PAD = 12;
const BLINK = 530; // milliseconds the caret is shown, then hidden
const KEPT = 400; // the lines the terminal remembers
const MAX_ZOOM = 2.5;
const CAMERA = [W / 2 - 30, W / 2 + 30]; // what the lid's camera covers of the top edge, left to right

// what the editor can show, in the order of its tabs
const FILES = [
  ['readme.txt', readmeSource],
  ['season.ts', seasonSource],
  ['optics.ts', opticsSource],
  ['terminal.ts', terminalSource],
  ['places.json', placesSource]
].map(([name, text]) => {
  const source = text.replace(/\n$/, '');
  return { name, path: `src/room/${name}`, source, lines: source.split('\n').length, scroll: 0, rows: null };
});
const FIRST = 'season.ts'; // the file open when the room is entered

// the Samsung's window colours (map.js), so the two dark screens are one desktop
const COLOR = {
  editor: '#10141b',
  bar: '#1b202a',
  tabOver: '#232936',
  shell: '#0c0f14',
  hairline: 'rgba(255, 255, 255, 0.10)',
  thumb: 'rgba(255, 255, 255, 0.16)',
  text: '#d7d3ca',
  muted: '#8f97a6',
  faint: '#5b6474',
  comment: '#6f7a8c',
  keyword: '#d08a5a',
  string: '#9fbf7f',
  number: '#d9b36a',
  type: '#7fb4c9',
  call: '#c9b98a',
  prompt: '#c98443',
  hash: '#d9b36a',
  error: '#e08e7a'
};
const TONE = { text: COLOR.text, muted: COLOR.muted, error: COLOR.error, commit: COLOR.muted };

const KEYWORDS = new Set(
  'as async await break case catch class const continue default else export extends finally for from function if import in instanceof let new null of return switch throw true false try type typeof undefined var void while'.split(
    ' '
  )
);
const TOKEN = /(\/\/.*$)|(\/\*.*?(?:\*\/|$))|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d[\d_.]*\b)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g;

/**
 * A file's lines as runs of [text, colour]: comments, strings, numbers, keywords, capitalised
 * names (types and constants) and names that are called. It reads TypeScript only as far as that.
 */
export function colourLines(text) {
  let inComment = false; // inside a block comment that an earlier line opened
  return text
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => {
      const runs = [];
      let rest = line;
      if (inComment) {
        const end = line.indexOf('*/');
        if (end < 0) return [[line, COLOR.comment]];
        runs.push([line.slice(0, end + 2), COLOR.comment]);
        rest = line.slice(end + 2);
        inComment = false;
      }
      for (const m of rest.matchAll(TOKEN)) {
        const [word, lineComment, blockComment, string, number, name, space] = m;
        if (lineComment) runs.push([word, COLOR.comment]);
        else if (blockComment) {
          runs.push([word, COLOR.comment]);
          inComment = !word.endsWith('*/') || word.length < 4;
        } else if (string) runs.push([word, COLOR.string]);
        else if (number) runs.push([word, COLOR.number]);
        else if (name) {
          const called = rest[m.index + word.length] === '(';
          runs.push([word, KEYWORDS.has(word) ? COLOR.keyword : /^[A-Z]/.test(word) ? COLOR.type : called ? COLOR.call : COLOR.text]);
        } else runs.push([word, space ? COLOR.text : COLOR.muted]);
      }
      return runs;
    });
}

/** A line's runs cut into rows of at most `columns` characters, the colours kept. */
function foldRuns(runs, columns) {
  const rows = [[]];
  let used = 0;
  for (const [text, colour] of runs) {
    let rest = text;
    while (rest.length) {
      if (used === columns) {
        rows.push([]);
        used = 0;
      }
      const part = rest.slice(0, columns - used);
      rows[rows.length - 1].push([part, colour]);
      used += part.length;
      rest = rest.slice(part.length);
    }
  }
  return rows;
}

/** The page's mono face, fetched from the site itself; without it the browser's own mono draws the text. */
async function loadFace() {
  try {
    const face = new FontFace(FACE, `url(${monoUrl}) format('woff2')`);
    document.fonts.add(await face.load());
  } catch (error) {
    console.warn('The room’s mono face did not load; the screen is set in the system’s.', error);
  }
}

/**
 * Makes the MacBook's screen. `commits` are `git log --oneline` lines and `places` the map's
 * places as words, for the commands that print them; `season()` answers the season at the window;
 * `effect(e)` is handed what a command asks of the room (terminal.ts's Effect: the season, the
 * camera). Resolves to the screen: its canvas and what main.js does with it.
 */
export async function createEditorScreen({ commits, places, season, effect }) {
  await loadFace();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { alpha: false });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const history = createHistory();

  const ui = {
    file: FILES.find((f) => f.name === FIRST),
    over: null, // the tab under the pointer
    tabsAt: 0, // how far the strip of tabs is slid left, when they do not all fit
    printed: [], // the terminal's lines: { text, tone }, `echo` for a line that was typed
    back: 0, // how many rows the terminal is scrolled back from its newest
    line: '', // the line being typed, and where its caret is
    caret: 0,
    keys: false, // the terminal has the keyboard
    blinkFrom: 0,
    blinkOn: true,
    stale: true
  };
  let draws = 0;
  let field = null; // the page's <input> (bind)

  // Everything is laid out in canvas pixels from the type's size, which `zoom` scales: 1 on a
  // wide page, more where the screen is small on the page (a phone), so the type can be read.
  const m = { zoom: 0 };
  function setZoom(zoom) {
    const z = Math.min(Math.max(Math.round(zoom * 4) / 4, 1), MAX_ZOOM); // in quarters, so a window being resized does not redraw at every pixel
    if (z === m.zoom) return;
    m.zoom = z;
    m.size = Math.round(24 * z); // the type
    m.line = Math.round(34 * z);
    // the two strips grow less than the type does: where the type is large, rows are what is short
    m.tabs = Math.round(m.size * 1.5 + 20); // the strip of file tabs along the top
    m.head = Math.round(m.size * 1.25 + 14); // the terminal's own strip
    g.font = `${m.size}px ${MONO}`;
    m.cell = g.measureText('M').width;
    m.gutter = Math.round(m.cell * 4 + 34); // the line numbers
    // the terminal takes a third of the screen, and nearer half where the type is large and rows are few
    const share = Math.min(0.36 + 0.08 * (z - 1), 0.5);
    m.shellRows = Math.min(Math.max(Math.floor((H * share - m.head - PAD * 2) / m.line), 4), 13);
    m.shellTop = H - PAD * 2 - m.shellRows * m.line - m.head;
    m.shellColumns = Math.floor((W - EDGE * 2) / m.cell);
    m.rows = Math.floor((m.shellTop - m.tabs - PAD * 2) / m.line); // the editor's
    m.columns = Math.floor((W - m.gutter - EDGE) / m.cell);
    // the tabs, left to right; one that would lie under the lid's camera, which stands a little
    // into the glass at the middle of its top edge, starts beyond it
    let x = 0;
    m.tab = FILES.map((file) => {
      const w = Math.round((file.name.length + 2) * m.cell + 84 * z);
      if (x < CAMERA[1] && x + w > CAMERA[0]) x = CAMERA[1];
      x += w;
      return { file, x: x - w, w };
    });
    m.tabsWidth = x;
    for (const file of FILES) file.rows = null;
    ui.stale = true;
  }

  /** A file as the rows the editor shows: each line folded to the pane's width, numbered on its first row. */
  function rowsOf(file) {
    if (!file.rows) {
      const lines = file.name.endsWith('.txt') ? file.source.split('\n').map((line) => [[line, COLOR.text]]) : colourLines(file.source);
      file.rows = lines.flatMap((runs, i) => foldRuns(runs, m.columns).map((row, part) => ({ number: part ? 0 : i + 1, runs: row })));
    }
    return file.rows;
  }
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  function showFile(name) {
    const file = FILES.find((f) => f.name === name);
    if (!file) return false;
    ui.file = file;
    ui.stale = true;
    return true;
  }

  // ---------------------------------------------------------------------------------------------
  // The terminal.
  // ---------------------------------------------------------------------------------------------

  function print(...lines) {
    ui.printed.push(...lines);
    if (ui.printed.length > KEPT) ui.printed.splice(0, ui.printed.length - KEPT);
    ui.back = 0;
    ui.stale = true;
  }

  /** The line being typed, as the field has it (or as it is set from here: a recalled line, a completion). */
  function setLine(text, caret = text.length) {
    ui.line = text;
    ui.caret = clamp(caret, 0, text.length);
    ui.back = 0;
    ui.blinkFrom = performance.now(); // the caret shows while typing
    ui.blinkOn = true;
    ui.stale = true;
    if (field && field.value !== text) field.value = text;
    if (field && document.activeElement === field && field.selectionStart !== ui.caret) field.setSelectionRange(ui.caret, ui.caret);
  }

  /** Enter: the line is printed as typed, run, and what it asks for is done or passed on. */
  function enter(line = ui.line) {
    print({ text: line, tone: 'echo' });
    history.add(line);
    setLine('');
    const answer = run(line, { files: FILES, commits, places, season: season(), now: new Date() });
    if (answer.lines.length) print(...answer.lines);
    const e = answer.effect;
    if (!e) return;
    if (e.kind === 'open') showFile(e.file);
    else if (e.kind === 'clear') {
      ui.printed.length = 0;
      ui.stale = true;
    } else effect(e);
  }

  /** A key in the field that is not text: Enter, Tab, Up, Down, Ctrl+L, Ctrl+C. True when it was one of the terminal's. */
  function key(e) {
    const k = e.key;
    if (e.isComposing) return false; // an input method is still making the text
    if (k === 'Enter') enter();
    else if (k === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const made = complete(ui.line.slice(0, ui.caret), FILES);
      if (made.options.length) print({ text: ui.line, tone: 'echo' }, { text: made.options.join('  '), tone: 'muted' });
      setLine(made.line + ui.line.slice(ui.caret), made.line.length);
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      const recalled = k === 'ArrowUp' ? history.back(ui.line) : history.forward();
      if (recalled !== null) setLine(recalled);
    } else if (e.ctrlKey && (k === 'l' || k === 'L')) {
      ui.printed.length = 0;
      ui.back = 0;
      ui.stale = true;
    } else if (e.ctrlKey && (k === 'c' || k === 'C') && field.selectionStart === field.selectionEnd) {
      // with nothing selected: abandon the line (with a selection it is the browser's copy)
      print({ text: `${ui.line}^C`, tone: 'echo' });
      history.add('');
      setLine('');
    } else return false;
    return true;
  }

  /**
   * Gives the terminal its keyboard: `input` is a field on the page, out of sight. While it has
   * the page's focus the terminal takes what is typed and its caret blinks.
   */
  function bind(input) {
    field = input;
    const follow = () => {
      if (field.value !== ui.line || field.selectionStart !== ui.caret) setLine(field.value, field.selectionStart ?? field.value.length);
    };
    field.addEventListener('input', follow);
    field.addEventListener('keyup', follow);
    field.addEventListener('select', follow);
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === field) follow();
    });
    field.addEventListener('keydown', (e) => {
      if (key(e)) e.preventDefault();
    });
    const held = (on) => () => {
      ui.keys = on;
      ui.blinkFrom = performance.now();
      ui.blinkOn = true;
      ui.stale = true;
    };
    field.addEventListener('focus', held(true));
    field.addEventListener('blur', held(false));
  }

  /** The terminal's rows as drawn, the prompt's last: { text, tone, start } (`start`: the row begins a line). */
  function shellRows() {
    const rows = [];
    for (const { text, tone } of ui.printed) {
      const parts =
        tone === 'echo'
          ? (PROMPT + text).match(new RegExp(`.{1,${m.shellColumns}}`, 'g')) // cut where the prompt's own line is cut
          : wrap(text, m.shellColumns);
      for (let i = 0; i < parts.length; i++) rows.push({ text: parts[i], tone, start: i === 0 });
    }
    const typing = PROMPT + ui.line;
    // one row more when the line ends at the pane's edge: the caret stands after it
    for (let at = 0; at <= typing.length; at += m.shellColumns) rows.push({ text: typing.slice(at, at + m.shellColumns), tone: 'echo', start: at === 0 });
    return rows;
  }

  // ---------------------------------------------------------------------------------------------
  // Drawing.
  // ---------------------------------------------------------------------------------------------

  function runs(list, x, y) {
    for (const [text, colour] of list) {
      g.fillStyle = colour;
      g.fillText(text, x, y);
      x += text.length * m.cell;
    }
    return x;
  }

  function draw() {
    draws++;
    const z = m.zoom;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.font = `${m.size}px ${MONO}`;

    // the editor
    g.fillStyle = COLOR.editor;
    g.fillRect(0, 0, W, H);
    const file = ui.file;
    const rows = rowsOf(file);
    const most = Math.max(0, rows.length - m.rows);
    file.scroll = clamp(file.scroll, 0, most);
    const first = Math.round(file.scroll);
    for (let i = 0; i < m.rows && first + i < rows.length; i++) {
      const row = rows[first + i];
      const y = m.tabs + PAD + i * m.line + m.line / 2;
      if (row.number) {
        g.textAlign = 'right';
        g.fillStyle = COLOR.faint;
        g.fillText(String(row.number), m.gutter - EDGE, y);
        g.textAlign = 'left';
      }
      runs(row.runs, m.gutter, y);
    }
    if (most > 0) {
      // how far down the file the pane is
      const track = m.shellTop - m.tabs - PAD * 2;
      const thumb = Math.max((track * m.rows) / rows.length, 40);
      g.fillStyle = COLOR.thumb;
      g.fillRect(W - 14, m.tabs + PAD + ((track - thumb) * first) / most, 6, thumb);
    }

    // its tabs, slid so the open one is in sight
    const open = m.tab.find((t) => t.file === file);
    ui.tabsAt = clamp(ui.tabsAt, open.x + open.w - W, open.x);
    ui.tabsAt = clamp(ui.tabsAt, 0, Math.max(0, m.tabsWidth - W));
    g.fillStyle = COLOR.bar;
    g.fillRect(0, 0, W, m.tabs);
    g.fillStyle = COLOR.hairline;
    g.fillRect(0, m.tabs - 1, W, 1);
    for (const tab of m.tab) {
      const x = tab.x - ui.tabsAt;
      const isOpen = tab === open;
      if (isOpen || tab.file === ui.over) {
        g.fillStyle = isOpen ? COLOR.editor : COLOR.tabOver;
        g.fillRect(x, 0, tab.w, isOpen ? m.tabs : m.tabs - 1);
      }
      if (isOpen) {
        g.fillStyle = COLOR.prompt; // the open tab's mark
        g.fillRect(x, 0, tab.w, Math.round(3 * z));
      }
      g.fillStyle = isOpen ? COLOR.type : COLOR.faint;
      g.beginPath();
      g.arc(x + 34 * z, m.tabs / 2 + 1, 7 * z, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = isOpen ? COLOR.text : COLOR.muted;
      g.fillText(tab.file.name, x + 56 * z, m.tabs / 2 + 2);
    }
    const where = `${file.path.replaceAll('/', ' / ')}   ${file.lines} lines`;
    if (m.tabsWidth + (where.length + 4) * m.cell + EDGE < W) {
      g.fillStyle = COLOR.faint;
      g.textAlign = 'right';
      g.fillText(where, W - EDGE, m.tabs / 2 + 2);
      g.textAlign = 'left';
    }

    // the terminal, under it
    g.fillStyle = COLOR.shell;
    g.fillRect(0, m.shellTop, W, H - m.shellTop);
    g.fillStyle = COLOR.hairline;
    g.fillRect(0, m.shellTop, W, 1);
    g.fillStyle = COLOR.muted;
    g.fillText('TERMINAL', EDGE, m.shellTop + m.head / 2 + 2);
    g.fillRect(EDGE, m.shellTop + m.head - 5, 8 * m.cell, 2);

    const lines = shellRows();
    const hidden = Math.max(0, lines.length - m.shellRows);
    ui.back = clamp(ui.back, 0, hidden);
    const from = hidden - Math.round(ui.back);
    for (let i = 0; i < m.shellRows && from + i < lines.length; i++) {
      const row = lines[from + i];
      const y = m.shellTop + m.head + PAD + i * m.line + m.line / 2;
      if (row.tone === 'echo') {
        const lead = row.start ? PROMPT.length : 0;
        runs(
          [
            [row.text.slice(0, lead), COLOR.prompt],
            [row.text.slice(lead), COLOR.text]
          ],
          EDGE,
          y
        );
      } else if (row.tone === 'commit' && row.start) {
        const cut = row.text.indexOf(' ');
        runs(
          [
            [row.text.slice(0, cut), COLOR.hash],
            [row.text.slice(cut), COLOR.muted]
          ],
          EDGE,
          y
        );
      } else runs([[row.text, TONE[row.tone]]], EDGE, y);
    }
    // the caret: a block on the character it stands before
    const at = PROMPT.length + ui.caret;
    const typingFrom = lines.length - 1 - Math.floor((PROMPT.length + ui.line.length) / m.shellColumns);
    const row = typingFrom + Math.floor(at / m.shellColumns) - from,
      column = at % m.shellColumns;
    if (ui.blinkOn && row >= 0 && row < m.shellRows) {
      const x = EDGE + column * m.cell,
        y = m.shellTop + m.head + PAD + row * m.line + m.line / 2;
      g.fillStyle = COLOR.text;
      g.fillRect(x, y - m.size / 2 - 2, m.cell, m.size + 4);
      const under = ui.line[ui.caret];
      if (under) {
        g.fillStyle = COLOR.shell;
        g.fillText(under, x, y);
      }
    }
    return canvas;
  }

  // ---------------------------------------------------------------------------------------------
  // The pointer, in canvas pixels (main.js finds them from where its ray meets the glass).
  // ---------------------------------------------------------------------------------------------

  /** What is at a point of the canvas: a file's tab, the editor's pane or the terminal's. */
  function hit(x, y) {
    if (y < m.tabs) {
      const tab = m.tab.find((t) => x >= t.x - ui.tabsAt && x < t.x - ui.tabsAt + t.w);
      return tab ? { kind: 'tab', file: tab.file.name } : null;
    }
    return { kind: y < m.shellTop ? 'editor' : 'terminal' };
  }

  /** The pointer is on a hit() result, or on nothing (null). True where a press would do something: a tab. */
  function point(h) {
    const over = h && h.kind === 'tab' ? FILES.find((f) => f.name === h.file) : null;
    if (over !== ui.over) {
      ui.over = over;
      ui.stale = true;
    }
    return Boolean(over);
  }

  /** A press at a hit() result. True when it did something. */
  function press(h) {
    return Boolean(h && h.kind === 'tab' && showFile(h.file));
  }

  /** Scroll what is at a hit() result by `rows` (down the file, or toward the terminal's newest line, when positive). */
  function scroll(h, rows) {
    if (!h) return;
    if (h.kind === 'terminal') ui.back -= rows;
    else if (h.kind === 'editor') ui.file.scroll += rows;
    else return;
    ui.stale = true;
  }

  /** Once a frame. Draws if anything changed and hands back the canvas, or null when nothing did. */
  function update(now) {
    // the caret blinks only while the terminal has the keyboard; otherwise it stands, as it does under reduced motion
    const on = !ui.keys || reducedMotion || Math.floor((now - ui.blinkFrom) / BLINK) % 2 === 0;
    if (on !== ui.blinkOn) {
      ui.blinkOn = on;
      ui.stale = true;
    }
    if (!ui.stale) return null;
    ui.stale = false;
    return draw();
  }

  /** Where a file's tab is on the canvas, as 0..1 across and down, for tests that press it. */
  function where(name) {
    const tab = m.tab.find((t) => t.file.name === name);
    return tab ? [(tab.x - ui.tabsAt + tab.w / 2) / W, m.tabs / 2 / H] : null;
  }

  setZoom(1);
  // as the screen is found: the newest commits, asked for and printed by the terminal's own command
  print({ text: 'git log', tone: 'echo' }, ...run('git log', { files: FILES, commits, places, season: season(), now: new Date() }).lines, {
    text: 'help lists what this terminal does',
    tone: 'muted'
  });
  draw();
  ui.stale = false;
  return {
    canvas,
    width: W,
    height: H,
    files: FILES.map((f) => f.name),
    hit,
    point,
    press,
    scroll,
    setZoom,
    bind,
    update,
    where,
    /** Types a line and enters it, as the keyboard would. */
    enter: (line) => enter(String(line)),
    print,
    /** The open file's name. */
    get file() {
      return ui.file.name;
    },
    /** What the terminal has printed, a string a line. */
    get printed() {
      return ui.printed.map((l) => (l.tone === 'echo' ? PROMPT + l.text : l.text));
    },
    get line() {
      return ui.line;
    },
    get zoom() {
      return m.zoom;
    },
    /** How many rows down the open file the editor is, and how many back from its newest the terminal is. */
    get scrolled() {
      return [Math.round(ui.file.scroll), Math.round(ui.back)];
    },
    /** A row's height, in canvas pixels. */
    get rowHeight() {
      return m.line;
    },
    /** How many times the canvas has been drawn. */
    get draws() {
      return draws;
    }
  };
}
