// Writes the pond's own icons (public/pond/icon.svg, icon-32.png, icon-180.png) from one drawing: the
// visitor's koi, the white one with the red spot, seen from above on the pond's deep water. The pond page
// links them (`icon` in src/layouts/Layout.astro); the old desktop keeps the site's own set. Run it when
// the drawing changes; the files are checked in.
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

/** The koi on its water; `round` gives the tile its own corners (a home-screen icon is cut by the phone). */
const koi = (round) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="w" cx="38%" cy="30%" r="80%">
      <stop offset="0" stop-color="#1d5a55"/>
      <stop offset="1" stop-color="#0a2a2b"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64"${round ? ' rx="14"' : ''} fill="url(#w)"/>
  <g transform="rotate(-28 32 32)">
    <path d="M32 46C29 51 24 55 21 58C26 57 30 55 32 52C34 55 38 57 43 58C40 55 35 51 32 46Z" fill="#e9e4d8" opacity=".85"/>
    <path d="M26.5 24C21 25 18 28 17 31C21 30 24.5 28.5 27 27Z" fill="#e9e4d8" opacity=".8"/>
    <path d="M37.5 24C43 25 46 28 47 31C43 30 39.5 28.5 37 27Z" fill="#e9e4d8" opacity=".8"/>
    <path d="M32 7C37.5 7 39.5 13 39.5 20C39.5 30 36 40 32 48C28 40 24.5 30 24.5 20C24.5 13 26.5 7 32 7Z" fill="#f4f0e6"/>
    <ellipse cx="32" cy="14.5" rx="4.6" ry="4.2" fill="#dd5530"/>
  </g>
</svg>
`;

const png = (size, round) =>
  sharp(Buffer.from(koi(round)), { density: (72 * size) / 64 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

await mkdir('public/pond', { recursive: true });
await writeFile('public/pond/icon.svg', koi(true));
await writeFile('public/pond/icon-32.png', await png(32, true));
await writeFile('public/pond/icon-180.png', await png(180, false));
console.log('public/pond/icon.svg, icon-32.png, icon-180.png');
