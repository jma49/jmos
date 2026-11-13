// Writes the small brush font the pond's first screen needs (public/pond/type/brush-first.woff2) and
// the stylesheet that points to it (src/pond/brush-first.css).
//
// Usage: node scripts/pond-first-brush.mjs   (needs fontTools: pyftsubset and pyftmerge, with brotli)
//
// The brush face (Zhi Mang Xing) comes in chunks of some hundred characters each, about 60 KB a
// chunk, and a page downloads every chunk one of its characters falls in. The first screen shows a
// few dozen brushed characters at most (the solar term, the inscription and seal under it in ink,
// the language switch, the ink button), which fall in five chunks: 300 KB for a handful of
// characters. This cuts those characters out of their chunks into one file of a few kilobytes. Its
// @font-face is declared after the chunks' and names exactly those characters, so for them the
// browser takes the small file; anything else in Chinese still brings its chunk when it shows.
// src/pond/brush-first.test.ts holds the stylesheet to the characters the pond's source names.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { firstBrush, firstBrushCss } from '../src/pond/brush-first.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const PKG = join(ROOT, 'node_modules/@fontsource/zhi-mang-xing');
const chars = firstBrush(readFileSync(join(ROOT, 'src/pond/engine.js'), 'utf8'), readFileSync(join(ROOT, 'src/pages/index.astro'), 'utf8'));

// which chunk each character is in, from the package's own stylesheet
const css = readFileSync(join(PKG, '400.css'), 'utf8');
const chunks = new Map();
for (const block of css.split(/(?=\/\* zhi-mang-xing-)/)) {
  const file = block.match(/url\(\.\/files\/(zhi-mang-xing-\d+-400-normal\.woff2)\)/)?.[1];
  const range = block.match(/unicode-range: ([^;]+);/)?.[1];
  if (!file || !range) continue;
  const spans = range.split(',').map((part) => {
    const [a, b = a] = part.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(a, 16), parseInt(b, 16)];
  });
  for (const ch of chars) {
    const cp = ch.codePointAt(0);
    if (spans.some(([lo, hi]) => cp >= lo && cp <= hi)) chunks.set(file, [...(chunks.get(file) ?? []), ch]);
  }
}
const found = [...chunks.values()].flat();
const missing = chars.filter((ch) => !found.includes(ch));
if (missing.length) throw new Error(`The brush face has no ${missing.join(' ')}`);

const tmp = mkdtempSync(join(tmpdir(), 'brush-'));
const parts = [];
for (const [file, list] of chunks) {
  const out = join(tmp, file.replace('.woff2', '.ttf'));
  execFileSync('pyftsubset', [
    join(PKG, 'files', file),
    `--text=${list.join('')}`,
    `--output-file=${out}`,
    '--no-hinting',
    '--desubroutinize',
    '--layout-features='
  ]);
  parts.push(out);
}
const merged = join(tmp, 'merged.ttf');
execFileSync('pyftmerge', [...parts, `--output-file=${merged}`]);
const OUT = join(ROOT, 'public/pond/type/brush-first.woff2');
execFileSync('pyftsubset', [merged, `--text=${chars.join('')}`, `--output-file=${OUT}`, '--flavor=woff2', '--no-hinting', '--layout-features=']);
writeFileSync(join(ROOT, 'src/pond/brush-first.css'), firstBrushCss(chars));
console.log(`${chars.length} characters from ${chunks.size} chunks: ${statSync(OUT).size} bytes`);
