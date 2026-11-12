// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// dist/ -> one self-contained HTML: CSS inlined with only the font chunks the page's characters need,
// the script bundled with its lazy chunks, images as data: URLs.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const DIST = process.argv[2],
  OUT = process.argv[3];
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};
const dataUrl = (p) => `data:${MIME[extname(p)]};base64,${readFileSync(join(DIST, p)).toString('base64')}`;
let html = readFileSync(join(DIST, 'index.html'), 'utf8');
// the script, with every chunk it imports
const entry = html.match(/<script type="module" src="(\/_astro\/[^"]+)"><\/script>/);
const built = await esbuild.build({
  entryPoints: [join(DIST, entry[1])],
  bundle: true,
  format: 'esm',
  write: false,
  minify: true,
  charset: 'utf8',
  logLevel: 'error'
});
let js = built.outputFiles[0].text;
// the characters on the page: in the markup, the data and the script
import { readdirSync } from 'node:fs';
// (not the traditional-to-simplified dictionary, which holds every character)
const chunks = readdirSync(join(DIST, '_astro'))
  .filter((f) => f.endsWith('.js') && !/^(t2cn|Desktop|client)/.test(f))
  .map((f) => readFileSync(join(DIST, '_astro', f), 'utf8'))
  .join('');
const used = new Set([...(html + chunks)].map((c) => c.codePointAt(0)));
const inRange = (ur) =>
  ur.split(',').some((part) => {
    const [a, b] = part.trim().replace(/^U\+/i, '').split('-');
    const lo = parseInt(a.replace(/\?/g, '0'), 16),
      hi = b ? parseInt(b, 16) : parseInt(a.replace(/\?/g, 'f'), 16);
    for (const c of used) if (c >= lo && c <= hi) return true;
    return false;
  });
let css = '',
  kept = 0,
  dropped = 0,
  n = 0;
const TMP = mkdtempSync(join(tmpdir(), 'fonts-')),
  CHARS = join(TMP, 'chars.txt');
writeFileSync(CHARS, String.fromCodePoint(...[...used].filter((c) => c > 0x2e7f)));
for (const [, href] of html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)) css += readFileSync(join(DIST, href), 'utf8') + '\n';
// the looks' type, which the site links at run time: here it goes in with the rest
for (const f of readdirSync(join(DIST, '_astro')).filter((f) => /^looks\..*\.css$/.test(f))) css += readFileSync(join(DIST, '_astro', f), 'utf8') + '\n';
css = css.replace(/@font-face\s*\{[^}]*\}/g, (block) => {
  const ur = block.match(/unicode-range:\s*([^;}]+)/);
  if (ur && !inRange(ur[1])) {
    dropped++;
    return '';
  }
  kept++;
  return block.replace(/src:\s*([^;}]+)/, (_, src) => {
    const w2 = src.match(/url\(([^)]+\.woff2)\)/);
    if (!w2) return `src:${src}`;
    const file = w2[1].replace(/["']/g, '');
    if (ur && /U\+[2-9A-F][0-9A-F]{3}/i.test(ur[1])) {
      const out = join(TMP, `${++n}.woff2`);
      execFileSync('pyftsubset', [join(DIST, file), `--text-file=${CHARS}`, '--flavor=woff2', `--output-file=${out}`, '--layout-features=*', '--no-hinting'], {
        stdio: 'ignore'
      });
      return `src:url(data:font/woff2;base64,${readFileSync(out).toString('base64')}) format("woff2")`;
    }
    return `src:url(${dataUrl(file)}) format("woff2")`;
  });
});
html = html.replace(/<link rel="stylesheet" href="[^"]+">/g, '');
// images the data and the script name: covers, marks, the portrait
const swap = (s) =>
  s.replace(
    /\/(?:_astro|pond\/marks|pond\/dunhuang|pond\/ink|pond\/qinghua|pond\/ukiyo|pond\/stars|pond\/monet|pond\/relief|pond\/water)\/[\w.\-]+\.(?:png|jpg|webp|avif)/g,
    (p) => (existsSync(join(DIST, p)) ? dataUrl(p) : p)
  );
html = swap(html);
js = swap(js);
html = html.replace(/<link rel="(?:icon|apple-touch-icon)"[^>]*>/g, '');
html = html.replace('</head>', `<style>${css}</style></head>`);
html = html.replace(entry[0], () => `<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script>`);
writeFileSync(OUT, html);
console.log(`fonts kept ${kept}, dropped ${dropped}; ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MB`);
