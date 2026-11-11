import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// Every Chinese character the pond shows is brushed in Zhi Mang Xing (src/pond/brush.css), in the
// chunks @fontsource splits it into, so a page downloads only the chunks its characters fall in.
// The chunks also carry Latin, digits and symbols; those code points are taken out of their ranges,
// so Latin text never falls back to the brush. This holds brush.css to the package's own
// stylesheet, scaled up to sit level with the type beside it; after an upgrade, rewrite it with
//   BRUSH_WRITE=1 npx vitest run src/pond/brush.test.ts
const PKG = 'node_modules/@fontsource/zhi-mang-xing';

/** CJK ideographs and radicals, their punctuation, and full-width forms. */
const CJK: [number, number][] = [
  [0x2e80, 0x9fff],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xffef],
  [0x20000, 0x3ffff]
];

/** A unicode-range with everything outside CJK taken out. */
function cjkOnly(range: string) {
  const out: string[] = [];
  for (const part of range.split(',')) {
    const [a, b = a] = part.trim().replace(/^U\+/i, '').split('-');
    const lo = parseInt(a, 16);
    const hi = parseInt(b, 16);
    for (const [x, y] of CJK) {
      const l = Math.max(lo, x);
      const h = Math.min(hi, y);
      if (l <= h) out.push(l === h ? `U+${l.toString(16)}` : `U+${l.toString(16)}-${h.toString(16)}`);
    }
  }
  return out.join(',');
}

function brushCss() {
  const css = readFileSync(`${PKG}/400.css`, 'utf8');
  const blocks = css
    .split(/(?=\/\* zhi-mang-xing-)/)
    .filter((b) => /^\/\* zhi-mang-xing-\[\d+\]-400-normal/.test(b))
    .map((b) => b.replace(/unicode-range: ([^;]+);/, (_, r: string) => `unicode-range: ${cjkOnly(r)};`))
    .filter((b) => !/unicode-range: ;/.test(b))
    .map((b) =>
      b
        .replaceAll('url(./files/', `url(../../${PKG}/files/`)
        .replace(/, url\([^)]*\.woff\) format\('woff'\)/, '')
        // the brush sits small beside the sans and the serif; this sets it level with them
        .replace('font-weight: 400;', 'font-weight: 400;\n  size-adjust: 116%;')
        .trimEnd()
    );
  return `/* Zhi Mang Xing (SIL Open Font License 1.1), only its CJK: written by src/pond/brush.test.ts. */\n${blocks.join('\n')}\n`;
}

it('brush.css is the brush font’s CJK chunks, and nothing else', () => {
  const want = brushCss();
  if (process.env.BRUSH_WRITE) writeFileSync('src/pond/brush.css', want);
  expect(readFileSync('src/pond/brush.css', 'utf8')).toBe(want);
  // nothing below the CJK blocks: Latin, digits and punctuation never fall to the brush
  for (const [, cp] of want.matchAll(/U\+([0-9a-f]+)/g)) expect(parseInt(cp, 16)).toBeGreaterThanOrEqual(0x2e80);
  expect((want.match(/@font-face/g) ?? []).length).toBeGreaterThan(80);
});
