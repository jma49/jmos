import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// Japanese is set in Yuji Syuku (a brushed hand, for what is large) and Shippori Mincho
// (for reading), in the chunks @fontsource splits them into, so a page downloads only the chunks its
// characters fall in. Both keep only their CJK, so Latin beside them stays in the look's own type;
// Shippori Mincho's Latin is there as 'Shippori Mincho Latin', for ukiyo-e's English. After an upgrade, rewrite kana.css with
//   KANA_WRITE=1 npx vitest run src/pond/kana.test.ts
const CJK: [number, number][] = [
  [0x2e80, 0x9fff],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xffef],
  [0x20000, 0x3ffff]
];

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

function faces(pkg: string, keep: RegExp) {
  const dir = `node_modules/@fontsource/${pkg}`;
  return readFileSync(`${dir}/400.css`, 'utf8')
    .split(new RegExp(`(?=/\\* ${pkg}-)`))
    .filter((b) => keep.test(b))
    .map((b) => (/-\[\d+\]-/.test(b) ? b.replace(/unicode-range: ([^;]+);/, (_, r: string) => `unicode-range: ${cjkOnly(r)};`) : b))
    .filter((b) => !/unicode-range: ;/.test(b))
    .map((b) =>
      b
        .replaceAll('url(./files/', `url(../../${dir}/files/`)
        .replace(/, url\([^)]*\.woff\) format\('woff'\)/, '')
        // Shippori Mincho's Latin goes by a name of its own, so that Japanese can be asked for apart from it
        .replace(/(\/\* shippori-mincho-latin-400-normal \*\/\n@font-face \{\n  font-family: )'Shippori Mincho'/, "$1'Shippori Mincho Latin'")
        .trimEnd()
    );
}

function kanaCss() {
  const yuji = faces('yuji-syuku', /^\/\* yuji-syuku-\[\d+\]-400-normal/);
  const mincho = faces('shippori-mincho', /^\/\* shippori-mincho-(\[\d+\]|latin)-400-normal/);
  // the Japanese of two looks: M PLUS 1 Code for ASCII, Klee One (a pencil hand) for blueprint
  const dots = faces('m-plus-1-code', /^\/\* m-plus-1-code-\[\d+\]-400-normal/);
  const klee = faces('klee-one', /^\/\* klee-one-\[\d+\]-400-normal/);
  return `/* Yuji Syuku, Shippori Mincho, M PLUS 1 Code and Klee One (SIL Open Font License 1.1): written by src/pond/kana.test.ts. */\n${[...yuji, ...mincho, ...dots, ...klee].join('\n')}\n`;
}

it('kana.css is the Japanese faces’ CJK chunks, and Shippori Mincho’s Latin', () => {
  const want = kanaCss();
  if (process.env.KANA_WRITE) writeFileSync('src/pond/kana.css', want);
  expect(readFileSync('src/pond/kana.css', 'utf8')).toBe(want);
  expect((want.match(/font-family: 'Yuji Syuku'/g) ?? []).length).toBeGreaterThan(80);
  expect(want).toContain('shippori-mincho-latin-400-normal');
  for (const f of ['M PLUS 1 Code', 'Klee One']) expect(want).toContain(`font-family: '${f}'`);
});
