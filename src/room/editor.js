// What the MacBook's own screen shows: an editor with a file of this very page open, and under it
// a terminal. Nothing on it is made up. The file is season.ts as it is in the repository (Vite
// hands over its text when the site is built, so the screen follows the file), and the terminal
// holds a command and what it printed (terminal.json, which tools/pond/room/web/shot-screens.cjs
// writes) and a line count taken from the text itself.
//
// It is drawn once, on a canvas of the panel's shape (3024 x 1964 at three quarters), and main.js
// puts that on the screen's glass as map.js's sheet is put on the Samsung's. The editor fills the
// screen, as an editor in full screen does: no menu bar, no Dock.
import monoUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url';
import source from './season.ts?raw';
import terminal from './terminal.json';

const W = 2268,
  H = 1473;
const FILE = 'src/room/season.ts';
const FACE = 'Room Mono'; // JetBrains Mono, under a name of this page's own
const MONO = `'${FACE}', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`;
const SIZE = 24; // the type, in canvas pixels
const LINE = 34;
const TABS = 56; // the strip of file tabs along the top
const HEAD = 44; // the terminal's own strip
const PAD = 12;
const GUTTER = 92; // the line numbers
const SHELL = 12; // the lines the terminal holds: two commands, what they printed, and a prompt

// the Samsung's window colours (map.js), so the two dark screens are one desktop
const COLOR = {
  editor: '#10141b',
  bar: '#1b202a',
  shell: '#0c0f14',
  hairline: 'rgba(255, 255, 255, 0.10)',
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
  hash: '#d9b36a'
};

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

/** The page's mono face, fetched from the site itself; without it the browser's own mono draws the text. */
async function loadFace() {
  try {
    const face = new FontFace(FACE, `url(${monoUrl}) format('woff2')`);
    document.fonts.add(await face.load());
  } catch (error) {
    console.warn('The room’s mono face did not load; the screen is set in the system’s.', error);
  }
}

/** Draws the MacBook's screen; resolves to its canvas, which does not change afterwards. */
export async function createEditorScreen() {
  await loadFace();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { alpha: false });
  g.textBaseline = 'middle';
  g.font = `${SIZE}px ${MONO}`;
  const cell = g.measureText('M').width;

  const shellTop = H - PAD - SHELL * LINE - PAD - HEAD;
  const lines = colourLines(source);
  const rows = Math.min(lines.length, Math.floor((shellTop - TABS - PAD * 2) / LINE)); // a longer file is cut off at the pane's foot

  // the editor
  g.fillStyle = COLOR.editor;
  g.fillRect(0, 0, W, H);
  g.fillStyle = COLOR.bar;
  g.fillRect(0, 0, W, TABS);
  const name = FILE.split('/').pop();
  const tab = 44 + (name.length + 2) * cell + 40;
  g.fillStyle = COLOR.editor;
  g.fillRect(0, 0, tab, TABS);
  g.fillStyle = COLOR.prompt; // the open tab's mark
  g.fillRect(0, 0, tab, 3);
  g.fillStyle = COLOR.type;
  g.beginPath();
  g.arc(34, TABS / 2 + 1, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = COLOR.text;
  g.fillText(name, 56, TABS / 2 + 2);
  g.fillStyle = COLOR.faint;
  g.textAlign = 'right';
  g.fillText(`${FILE.replaceAll('/', ' / ')}   ${lines.length} lines`, W - 28, TABS / 2 + 2);
  g.fillStyle = COLOR.hairline;
  g.fillRect(tab, TABS - 1, W - tab, 1);

  for (let i = 0; i < rows; i++) {
    const y = TABS + PAD + i * LINE + LINE / 2;
    g.textAlign = 'right';
    g.fillStyle = COLOR.faint;
    g.fillText(String(i + 1), GUTTER - 28, y);
    g.textAlign = 'left';
    let x = GUTTER;
    for (const [text, colour] of lines[i]) {
      g.fillStyle = colour;
      g.fillText(text, x, y);
      x += text.length * cell;
    }
  }

  // the terminal, under it
  g.fillStyle = COLOR.shell;
  g.fillRect(0, shellTop, W, H - shellTop);
  g.fillStyle = COLOR.hairline;
  g.fillRect(0, shellTop, W, 1);
  g.fillStyle = COLOR.muted;
  g.fillText('TERMINAL', 28, shellTop + HEAD / 2 + 2);
  g.fillRect(28, shellTop + HEAD - 5, 8 * cell, 2);

  const typed = (text) => [
    ['$ ', COLOR.prompt],
    [text, COLOR.text]
  ];
  const printed = [
    typed(terminal.command),
    ...terminal.lines.slice(0, SHELL - 4).map((line) => {
      const cut = line.indexOf(' ');
      return [
        [line.slice(0, cut), COLOR.hash],
        [line.slice(cut), COLOR.muted]
      ];
    }),
    typed(`wc -l ${FILE}`),
    [[`${source.split('\n').length - 1} ${FILE}`, COLOR.muted]],
    typed('')
  ];
  printed.forEach((runs, i) => {
    const y = shellTop + HEAD + PAD + i * LINE + LINE / 2;
    let x = 28;
    for (const [text, colour] of runs) {
      g.fillStyle = colour;
      g.fillText(text, x, y);
      x += text.length * cell;
    }
    if (i === printed.length - 1) {
      g.fillStyle = COLOR.text; // the cursor, waiting
      g.fillRect(x, y - SIZE / 2 - 2, cell, SIZE + 4);
    }
  });
  return canvas;
}
