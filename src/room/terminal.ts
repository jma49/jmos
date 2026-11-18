// The terminal on the room's MacBook (editor.js draws it and feeds it keys), apart from three.js
// and the page so it can be tested (terminal.test.ts): what a typed line means, what it prints,
// what Tab completes it to, how a long line folds, and the lines typed before.
//
// Nothing here acts on the room. A command answers with the lines it prints and, when it asks
// for something to happen (a file shown in the editor, the season turned, the camera moved), an
// effect that editor.js and main.js carry out. Everything printed is true of the room: the files
// are the ones bundled, the commits are the repository's, the places are the map's.
import { nextSeason, parseSeason, SEASONS, type Season } from './season';

/** How a printed line is coloured: plain, quiet, a refusal, or a commit (its hash stands out). */
export type Tone = 'text' | 'muted' | 'error' | 'commit';
export interface Line {
  text: string;
  tone: Tone;
}

/** What a command asks of the room. */
export type Effect =
  | { kind: 'open'; file: string }
  | { kind: 'season'; season: Season }
  | { kind: 'focus'; screen: 'samsung' | 'dell' }
  | { kind: 'clear' }
  | { kind: 'exit' };

/** A file the editor can show: the name it is asked for by, where it is in the repository, its length. */
export interface ShellFile {
  name: string;
  path: string;
  lines: number;
}

/** What the commands read: the room as it stands when the line is entered. */
export interface Shell {
  files: readonly ShellFile[];
  /** `git log --oneline` lines, newest first: a short hash, a space, the subject. */
  commits: readonly string[];
  /** The states marked on the map, as "Texas" or "Florida (Tampa)". */
  places: readonly string[];
  season: Season;
  now: Date;
}

export interface Answer {
  lines: Line[];
  effect: Effect | null;
}

export const PROMPT = 'room $ ';
export const COMMANDS = ['help', 'ls', 'cat', 'open', 'season', 'git', 'places', 'map', 'os', 'date', 'clear', 'exit'] as const;
const SEASON_WORDS = [...SEASONS, 'next'];

// no line is wider than 48 characters, so that it does not fold on a phone's larger type
const HELP = [
  'help           this list',
  'ls             the files the editor can show',
  'cat <file>     show one in the editor (or: open)',
  'season         the season outside the window',
  'season <name>  turn it: spring, summer, autumn,',
  '               winter or next',
  'git log        the newest commits on main',
  'places         the states marked on the map',
  'map, os        go to the left or right screen',
  'date           the date and time here',
  'clear, exit    wipe this, back to the seat',
  'tab completes, up and down recall'
];

const text = (line: string): Line => ({ text: line, tone: 'text' });
const muted = (line: string): Line => ({ text: line, tone: 'muted' });
const error = (line: string): Line => ({ text: line, tone: 'error' });
const say = (...lines: Line[]): Answer => ({ lines, effect: null });

/** A typed line as a command and its arguments, split at white space; null for an empty line. */
export function parse(line: string): { name: string; args: string[] } | null {
  const words = line.trim().split(/\s+/).filter(Boolean);
  return words.length ? { name: words[0], args: words.slice(1) } : null;
}

/** The file a word names: by its name or by its path in the repository. */
export function findFile(files: readonly ShellFile[], word: string): ShellFile | null {
  return files.find((file) => file.name === word || file.path === word) ?? null;
}

/** What entering a line does: the lines it prints and what it asks of the room. */
export function run(line: string, shell: Shell): Answer {
  const typed = parse(line);
  if (!typed) return say();
  const { name, args } = typed;
  switch (name) {
    case 'help':
      return say(...HELP.map(text));
    case 'ls':
      return say(...shell.files.map((file) => text(file.name)));
    case 'cat':
    case 'open': {
      if (!args.length) return say(error(`${name}: which file? ls lists them`));
      const file = findFile(shell.files, args[0]);
      if (!file) return say(error(`${name}: no such file: ${args[0]}`));
      return { lines: [muted(`${file.path}, ${file.lines} lines, in the editor`)], effect: { kind: 'open', file: file.name } };
    }
    case 'season': {
      if (!args.length) return say(text(shell.season));
      const word = args[0].toLowerCase();
      const season = word === 'next' ? nextSeason(shell.season) : parseSeason(word);
      if (!season) return say(error(`season: no such season: ${args[0]}`), muted(SEASON_WORDS.join(' ')));
      // the laptop's lid leans back and the camera looks down at it: the window is above the picture
      return { lines: [text(season), muted('at the window: Escape looks up from the screen')], effect: { kind: 'season', season } };
    }
    case 'git':
      if (args[0] !== 'log') return say(error('git: only git log is here'));
      return say(...shell.commits.map((commit): Line => ({ text: commit, tone: 'commit' })));
    case 'places':
      return say(...shell.places.map(text));
    case 'map':
      return { lines: [], effect: { kind: 'focus', screen: 'samsung' } };
    case 'os':
      return { lines: [], effect: { kind: 'focus', screen: 'dell' } };
    case 'date':
      return say(text(shell.now.toString()));
    case 'clear':
      return { lines: [], effect: { kind: 'clear' } };
    case 'exit':
      return { lines: [], effect: { kind: 'exit' } };
    default:
      return say(error(`command not found: ${name}`));
  }
}

/** The longest beginning the words share. */
function sharedStart(words: readonly string[]): string {
  let shared = words[0] ?? '';
  for (const word of words) while (!word.startsWith(shared)) shared = shared.slice(0, -1);
  return shared;
}

/**
 * What Tab makes of a line (the caret at its end). The word being typed is completed: a command
 * when it is the first word, else what that command takes (a file, a season, `log`). One match
 * fills the word and a space after it; several fill what they share and are handed back as
 * `options`, to be printed; none leaves the line as it is.
 */
export function complete(line: string, files: readonly ShellFile[]): { line: string; options: string[] } {
  const lead = line.match(/^\s*/)?.[0] ?? '';
  const words = line.slice(lead.length).split(/\s+/);
  const word = words[words.length - 1];
  let pool: readonly string[];
  if (words.length === 1) pool = COMMANDS;
  else if (words.length > 2) pool = [];
  else if (words[0] === 'cat' || words[0] === 'open') pool = files.map((file) => file.name);
  else if (words[0] === 'season') pool = SEASON_WORDS;
  else if (words[0] === 'git') pool = ['log'];
  else pool = [];
  const matches = pool.filter((option) => option.startsWith(word));
  if (!matches.length) return { line, options: [] };
  const before = line.slice(0, line.length - word.length);
  if (matches.length === 1) return { line: `${before}${matches[0]} `, options: [] };
  return { line: before + sharedStart(matches), options: matches };
}

/**
 * A line folded to rows no wider than `columns` characters: at a space where one is near enough
 * (the last third of the row), else mid-word. An empty line is one empty row.
 */
export function wrap(line: string, columns: number): string[] {
  const width = Math.max(1, Math.floor(columns));
  const rows: string[] = [];
  let rest = line;
  while (rest.length > width) {
    const space = rest.lastIndexOf(' ', width);
    const cut = space >= width * (2 / 3) ? space : width;
    rows.push(rest.slice(0, cut));
    rest = rest.slice(cut === space ? cut + 1 : cut);
  }
  rows.push(rest);
  return rows;
}

/**
 * The lines entered before, for Up and Down. `add` keeps a line (not an empty one, nor the one
 * just before it again); `back` and `forward` walk through them from the line being typed, which
 * `forward` comes home to. Both answer the line to show, or null at either end.
 */
export function createHistory(limit = 100) {
  const lines: string[] = [];
  let at = 0; // lines.length when at the line being typed
  let draft = '';
  return {
    add(line: string) {
      if (line.trim() && lines[lines.length - 1] !== line) lines.push(line);
      if (lines.length > limit) lines.shift();
      at = lines.length;
      draft = '';
    },
    back(current: string): string | null {
      if (at === 0) return null;
      if (at === lines.length) draft = current;
      return lines[--at];
    },
    forward(): string | null {
      if (at >= lines.length) return null;
      at++;
      return at === lines.length ? draft : lines[at];
    }
  };
}
