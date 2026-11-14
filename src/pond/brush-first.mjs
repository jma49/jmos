// The brushed characters the pond's first screen can show, and the @font-face for the small file that
// holds them (scripts/pond-first-brush.mjs cuts it; brush-first.test.ts holds the two together).

/** Chinese characters in a string. */
const cjk = (s) => [...s].filter((ch) => ch.codePointAt(0) >= 0x2e80 && ch.codePointAt(0) <= 0x9fff);

/**
 * The characters, sorted: every solar term's name (one shows by the clock), what the page's own markup
 * brushes (the seal, the ink button), the inscription's words and the language switch's.
 */
export function firstBrush(engine, page) {
  const terms = engine.slice(engine.indexOf('const TERMS = ['), engine.indexOf('];', engine.indexOf('const TERMS = [')));
  const marked =
    [...page.matchAll(/lang="zh"[^>]*>(?:<span>)?([^<]*)/g)].map((m) => m[1]).join('') +
    [...page.matchAll(/<span>([^<]{1,2})<\/span>/g)].map((m) => m[1]).join('');
  return [...new Set([...cjk(terms), ...cjk(marked), ...cjk('画池塘中日')])].sort();
}

/** The stylesheet: the same family as the chunks, for exactly these characters. */
export const firstBrushCss = (chars) =>
  `/* The pond's first screen in the brush: written by scripts/pond-first-brush.mjs. */
@font-face {
  font-family: 'Zhi Mang Xing';
  font-style: normal;
  font-display: swap;
  font-weight: 400;
  size-adjust: 116%;
  src: url(/pond/type/brush-first.woff2) format('woff2');
  unicode-range: ${chars.map((ch) => `U+${ch.codePointAt(0).toString(16)}`).join(',')};
}
`;
