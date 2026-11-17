// Checks that no file in public/ is over its size budget. Everything in
// public/ is served as it is (no build step resizes it) and stays in git's
// history for good, so a picture is made small before it's added
// (docs/agents/adding.md), and this keeps it so.
//
// - A desktop picture (public/os/wallpapers/photos/): 1 MB. They're WebP
//   up to 2560px wide, fetched only when chosen, one at a time; at quality
//   about 75 the largest photos come to 900 KB.
// - Anything else (icons, thumbnails, fonts, the portrait, og.jpg): 200 KB.
//   The largest today is public/portrait.jpg at 155 KB.
//
// A file over its budget is made smaller or, when it can't be without a
// visible difference, listed in EXCEPTIONS with its size and the reason.
// `node scripts/check-public-sizes.mjs` prints each file over budget and
// exits 1 if there is any; tests/public-sizes.test.ts runs it with
// `npm test`.
import { globSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const KB = 1024;

/** Budgets, the first whose prefix matches a file's path (from public/). */
export const BUDGETS = [
  { prefix: 'os/wallpapers/photos/', bytes: 1024 * KB, what: 'a desktop picture' },
  { prefix: '', bytes: 200 * KB, what: 'a file in public/' }
];

/** Files allowed over their budget, up to `bytes`, each with the reason. */
export const EXCEPTIONS = new Map([
  [
    'os/wallpapers/photos/nature/zen_garden.webp',
    {
      bytes: 1600 * KB,
      reason:
        'A ryOS desktop picture kept on purpose (docs/decisions/0001). Raked gravel is nearly all fine detail, ' +
        'so at about quality 78 it is 1.53 MB; re-encoding it at quality 75 saves only 5.6% (still over 1 MB) ' +
        'for a measurable loss (36.6 dB PSNR against it, the gravel slightly softer at 1:1). Checked 2026-10-03.'
    }
  ],
  [
    'pond/dunhuang/feitian-pipa-2560.webp',
    {
      bytes: 300 * KB,
      reason:
        'The centrepiece of the pond’s Dunhuang wall, drawn up to half the width of a large window at 2×, where ' +
        'the 1536-pixel one is stretched soft. At 2560 × 1280 and quality 76 it is 258 KB; under 200 KB its lines ' +
        'ring. It is fetched only when that one look is first chosen, never on a first visit.'
    }
  ],
  [
    'pond/monet/bed.webp',
    {
      bytes: 450 * KB,
      reason:
        'The painting under the pond’s Monet look, which fills a large window: 2560 × 1440. At quality 87 it is ' +
        '380 KB; lower, the impasto smears. It is fetched only when that one look is first chosen on a large ' +
        'window (a small one takes bed-1280.webp), never on a first visit.'
    }
  ],
  [
    'room/room.glb',
    {
      bytes: 1500 * KB,
      reason:
        'The room under the pond as one model (docs/decisions/0030): 130,000 triangles with their baked light in ' +
        'vertex colours (27,000 of them the three keepsakes on the desk, which are modelled closely) and the ' +
        'desk’s wood (about 150 KB of WebP inside it); no picture for the screens, which the page draws. ' +
        'Meshopt-compressed it is 1.35 MB. It is a preview: making it smaller (fewer triangles on what the seat ' +
        'never sees closely, coarser quantization) has not been tried yet and should be before the room is ' +
        'linked. Only the page at /room fetches it, which nothing links to; no other page does.'
    }
  ],
  [
    'room/screens/dell.webp',
    {
      bytes: 290 * KB,
      reason:
        'What the room’s right screen shows (docs/decisions/0030): a picture of the site’s own desktop at the ' +
        'screen’s 2560 × 1440, taken by tools/pond/room/web/shot-screens.cjs. The desktop picture in it is pebbles, ' +
        'fine detail all over, so it is 274 KB at WebP quality 36 and 356 KB at 52; lower than 36 the type in the ' +
        'windows starts to ring. Only the page at /room fetches it.'
    }
  ],
  ...['spring', 'summer', 'autumn', 'winter'].map((season) => [
    `room/backdrop-${season}.webp`,
    {
      bytes: 320 * KB,
      reason:
        'What is outside the room’s glass in one season (a balcony, trees, a neighbour’s roof), wider than the ' +
        'window since the camera drifts: 3072 × 1728. It holds the logarithm of the light, not a finished ' +
        'picture, so what WebP loses is stretched again when the page decodes it; at quality 90 ' +
        '(tools/pond/room/export.py) the four are between 218 and 287 KB, and a lower quality has not been tried yet. ' +
        'Only the page at /room fetches them, one for the season shown and another only when the visitor turns ' +
        'the season.'
    }
  ])
]);

/** Every file in public/ over its budget, as { path, size, budget, what }. */
export function oversized(dir = root) {
  const over = [];
  for (const path of globSync('**/*', { cwd: join(dir, 'public') }).sort()) {
    const stat = statSync(join(dir, 'public', path));
    if (!stat.isFile() || path.endsWith('.DS_Store')) continue;
    const exception = EXCEPTIONS.get(path);
    const { bytes, what } = exception ? { bytes: exception.bytes, what: 'its exception' } : BUDGETS.find(({ prefix }) => path.startsWith(prefix));
    if (stat.size > bytes) over.push({ path: `public/${path}`, size: stat.size, budget: bytes, what });
  }
  return over;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const over = oversized();
  const kb = (bytes) => `${Math.round(bytes / KB)} KB`;
  for (const { path, size, budget, what } of over) console.error(`${path}: ${kb(size)}, over the ${kb(budget)} budget for ${what}`);
  if (over.length) {
    console.error('\nMake it smaller (docs/agents/adding.md), or list it in EXCEPTIONS in scripts/check-public-sizes.mjs with the reason.');
    process.exit(1);
  }
  console.log('Every file in public/ is within its size budget.');
}
