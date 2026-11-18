import { describe, expect, it } from 'vitest';
import { COMMANDS, complete, createHistory, findFile, parse, run, wrap, type Shell } from './terminal';

const shell: Shell = {
  files: [
    { name: 'readme.txt', path: 'src/room/readme.txt', lines: 12 },
    { name: 'season.ts', path: 'src/room/season.ts', lines: 26 },
    { name: 'optics.ts', path: 'src/room/optics.ts', lines: 21 }
  ],
  commits: ['b710bca feat(room): the real view outside', '8221763 feat(room): the room at a preview address'],
  places: ['Texas', 'Florida (Tampa)'],
  season: 'autumn',
  now: new Date(2026, 10, 17, 9, 30)
};
const printed = (line: string) => run(line, shell).lines.map((l) => l.text);

describe('the terminal’s parser', () => {
  it('splits a line into a command and its arguments', () => {
    expect(parse('  season   winter ')).toEqual({ name: 'season', args: ['winter'] });
    expect(parse('ls')).toEqual({ name: 'ls', args: [] });
    expect(parse('   ')).toBeNull();
  });

  it('finds a file by its name or its path', () => {
    expect(findFile(shell.files, 'season.ts')?.path).toBe('src/room/season.ts');
    expect(findFile(shell.files, 'src/room/optics.ts')?.name).toBe('optics.ts');
    expect(findFile(shell.files, 'main.js')).toBeNull();
  });
});

describe('the terminal’s commands', () => {
  it('prints nothing for an empty line', () => {
    expect(run('', shell)).toEqual({ lines: [], effect: null });
  });

  it('lists the files and opens one in the editor', () => {
    expect(printed('ls')).toEqual(['readme.txt', 'season.ts', 'optics.ts']);
    for (const verb of ['cat', 'open']) {
      const answer = run(`${verb} season.ts`, shell);
      expect(answer.effect).toEqual({ kind: 'open', file: 'season.ts' });
      expect(answer.lines[0].text).toBe('src/room/season.ts, 26 lines, in the editor');
    }
    expect(run('cat nothing.ts', shell)).toEqual({ lines: [{ text: 'cat: no such file: nothing.ts', tone: 'error' }], effect: null });
    expect(run('cat', shell).effect).toBeNull();
  });

  it('tells the season, and turns it by name or to the next', () => {
    expect(run('season', shell)).toEqual({ lines: [{ text: 'autumn', tone: 'text' }], effect: null });
    expect(run('season winter', shell).effect).toEqual({ kind: 'season', season: 'winter' });
    expect(run('season winter', shell).lines[0]).toEqual({ text: 'winter', tone: 'text' });
    expect(run('season WINTER', shell).effect).toEqual({ kind: 'season', season: 'winter' });
    expect(run('season next', shell).effect).toEqual({ kind: 'season', season: 'winter' });
    expect(run('season next', { ...shell, season: 'winter' }).effect).toEqual({ kind: 'season', season: 'spring' });
    const refused = run('season monsoon', shell);
    expect(refused.effect).toBeNull();
    expect(refused.lines[0]).toEqual({ text: 'season: no such season: monsoon', tone: 'error' });
  });

  it('prints the commits as they were given, and only for git log', () => {
    expect(run('git log', shell).lines).toEqual(shell.commits.map((text) => ({ text, tone: 'commit' })));
    expect(run('git push', shell).lines[0].tone).toBe('error');
  });

  it('lists the places, tells the date, and moves between the screens', () => {
    expect(printed('places')).toEqual(['Texas', 'Florida (Tampa)']);
    expect(printed('date')).toEqual([shell.now.toString()]);
    expect(run('map', shell).effect).toEqual({ kind: 'focus', screen: 'samsung' });
    expect(run('os', shell).effect).toEqual({ kind: 'focus', screen: 'dell' });
    expect(run('clear', shell).effect).toEqual({ kind: 'clear' });
    expect(run('exit', shell).effect).toEqual({ kind: 'exit' });
  });

  it('says so when a command is not one of its own', () => {
    expect(run('sudo rm -rf /', shell)).toEqual({ lines: [{ text: 'command not found: sudo', tone: 'error' }], effect: null });
  });

  it('answers every command it lists, and help names each of them', () => {
    const help = printed('help').join('\n');
    for (const name of COMMANDS) {
      expect(run(name, shell).lines.some((l) => l.text.startsWith('command not found'))).toBe(false);
      expect(help).toContain(name);
    }
    expect(help).toContain('season <name>');
    expect(Math.max(...printed('help').map((l) => l.length))).toBeLessThanOrEqual(48);
  });
});

describe('the terminal’s completion', () => {
  it('completes a command that only one begins with, and adds a space', () => {
    expect(complete('he', shell.files)).toEqual({ line: 'help ', options: [] });
    expect(complete('  pl', shell.files)).toEqual({ line: '  places ', options: [] });
  });

  it('fills what several share and offers them', () => {
    expect(complete('c', shell.files)).toEqual({ line: 'c', options: ['cat', 'clear'] });
    expect(complete('s', shell.files)).toEqual({ line: 'season ', options: [] });
    expect(complete('', shell.files).options).toEqual([...COMMANDS]);
  });

  it('completes a file after cat and open, a season after season, log after git', () => {
    expect(complete('cat se', shell.files)).toEqual({ line: 'cat season.ts ', options: [] });
    expect(complete('open ', shell.files)).toEqual({ line: 'open ', options: ['readme.txt', 'season.ts', 'optics.ts'] });
    expect(complete('season w', shell.files)).toEqual({ line: 'season winter ', options: [] });
    expect(complete('season s', shell.files)).toEqual({ line: 'season s', options: ['spring', 'summer'] });
    expect(complete('git ', shell.files)).toEqual({ line: 'git log ', options: [] });
  });

  it('leaves alone what nothing begins with', () => {
    expect(complete('xyz', shell.files)).toEqual({ line: 'xyz', options: [] });
    expect(complete('ls se', shell.files)).toEqual({ line: 'ls se', options: [] });
    expect(complete('cat season.ts op', shell.files)).toEqual({ line: 'cat season.ts op', options: [] });
  });
});

describe('folding a line', () => {
  it('keeps a line that fits, and an empty one', () => {
    expect(wrap('season winter', 20)).toEqual(['season winter']);
    expect(wrap('', 20)).toEqual(['']);
  });

  it('folds at a space near the row’s end, else mid-word', () => {
    expect(wrap('the newest commits on main', 12)).toEqual(['the newest', 'commits on', 'main']);
    expect(wrap('abcdefghijklmnop', 6)).toEqual(['abcdef', 'ghijkl', 'mnop']);
    expect(wrap('a bcdefghijklmnop', 6)).toEqual(['a bcde', 'fghijk', 'lmnop']);
  });

  it('never makes a row wider than asked', () => {
    for (const columns of [1, 7, 30])
      for (const row of wrap(shell.now.toString() + ' and some more words after it', columns)) expect(row.length).toBeLessThanOrEqual(columns);
  });
});

describe('the lines typed before', () => {
  it('walks back and forward, and comes home to the line being typed', () => {
    const history = createHistory();
    history.add('ls');
    history.add('season winter');
    expect(history.back('he')).toBe('season winter');
    expect(history.back('')).toBe('ls');
    expect(history.back('')).toBeNull();
    expect(history.forward()).toBe('season winter');
    expect(history.forward()).toBe('he');
    expect(history.forward()).toBeNull();
  });

  it('does not keep an empty line or the same line twice running', () => {
    const history = createHistory();
    history.add('ls');
    history.add('  ');
    history.add('ls');
    expect(history.back('')).toBe('ls');
    expect(history.back('')).toBeNull();
  });
});
