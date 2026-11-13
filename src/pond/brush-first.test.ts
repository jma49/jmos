import { existsSync, readFileSync, statSync } from 'node:fs';
import { expect, it } from 'vitest';
import { firstBrush, firstBrushCss } from './brush-first.mjs';

// The first screen's brushed characters come from one small file, not a 60 KB chunk each
// (scripts/pond-first-brush.mjs). If a solar term, the seal or the switch gains a character, the file
// and its stylesheet are cut again with
//   node scripts/pond-first-brush.mjs
const chars = firstBrush(readFileSync('src/pond/engine.js', 'utf8'), readFileSync('src/pages/index.astro', 'utf8'));

it('names every character the first screen can brush, and no Latin', () => {
  // each of the 24 solar terms, the seal, the inscription, the ink button, the switch
  for (const ch of '立春雨水惊蛰清明谷夏小满芒种至暑大秋处白露分寒霜降冬雪锦程画池塘墨中日') expect(chars).toContain(ch);
  for (const ch of chars) expect(ch.codePointAt(0)).toBeGreaterThanOrEqual(0x2e80);
});
it('brush-first.css is for exactly those characters, and its file is there and small', () => {
  expect(readFileSync('src/pond/brush-first.css', 'utf8')).toBe(firstBrushCss(chars));
  expect(existsSync('public/pond/type/brush-first.woff2')).toBe(true);
  expect(statSync('public/pond/type/brush-first.woff2').size).toBeLessThan(20000);
});
