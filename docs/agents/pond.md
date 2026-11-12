# The pond

The pond is the site's home page, at `/`; the desktop it replaced is at
`/os` ([decision 0025](../decisions/0025-the-pond.md)). It's a full-bleed
pond seen from above: a title page set on the water (a greeting, the
contents), and chapters (About, Timeline, Photos, Music, Notes, Chat)
that open as one tall sheet of glass. Everyone who visits is a koi.

## Where things are

| File | What it holds |
| --- | --- |
| `src/pages/index.astro` | The markup, and everything gathered at build time: the timeline (each project's page plus `src/pond/content.ts`), the latest Unsplash photos (`src/lib/photos.ts`), covers resized by `getImage`. It hands them to the script as JSON (`#pond-data`) and keeps a plain-text copy for screen readers and visitors without JavaScript. |
| `src/pond/engine.js` | Everything that moves: the water (a height field stepped on the CPU), the koi, lily pads, the 24 solar terms and the time of day, ice that cracks and breaks, boats, the dove's and spider's behaviour, the WebGL passes (the pond into a texture, then the glass over it), the chapters, the command bar, the sound effects, the opening. Its sections are marked `/* ===== … ===== */`. |
| `src/pond/life.js` | Devot's dove and ocra's jumping spider as three.js models built in code, drawn from straight above into a small picture each frame. It and three.js load once the pond has settled. |
| `src/pond/music.ts` | The music: Ryuichi Sakamoto only, the songs `POND_MUSIC` in `content.ts` chooses first and the rest of his in the library the iPod plays (`/api/songs`, or `src/data/songs.json`), played with YouTube's player in a frame clipped to nothing. |
| `src/pond/people.ts` | Accounts, presence, the guestbook's notes and the chat, through `src/os/social` (the same backend and rules as the desktop). |
| `src/pond/content.ts` | The pond's wording: the timeline's jobs and schools, each project's colour, mark and highlights, This pond's own entry, the About chapter. |
| `src/pond/pond.css` | The styles. |
| `public/pond/marks/` | The 72-pixel marks of the companies, schools and projects on the timeline. |
| `src/assets/pond/cover.jpg` | This pond's picture on the timeline: a capture of the title page. |

`engine.js` and `life.js` are plain JavaScript, ported from the
prototype the design was made on (the decision has why); the parts that
reach the rest of the site are TypeScript. A file's header says what it's
for; keep it true when the file changes.

## Rules

- **The glass is drawn with the water.** A `.glass` element's place and
  opacity are read every frame (`panes()`), and the glass pass draws a
  rounded pane there that blurs and bends what's under it. A new pane is
  a `.glass` element in the markup when the script starts (the list is
  read once); `data-r` is its corner radius.
- **The title page reads because the pond is calmer under it.** On a
  wide window the left of the pond is deeper and out of focus (`uCalm`
  in the water's shader); on a phone, all of it. Type stays on that side.
- **Type:** Cormorant Garamond (self-hosted, `@fontsource/cormorant-garamond`)
  for what's set large, and every Chinese character, wherever it is,
  brushed in Zhi Mang Xing (`src/pond/brush.css`: the font's CJK chunks
  only, so a page loads just the chunks its characters fall in and Latin
  never falls to the brush; `brush.test.ts` writes and checks it). The
  brush has only simplified forms, so song titles and artists are shown
  simplified (`music.ts`; the library is untouched). The system's sans
  for everything else, figures
  in tabular numerals. No monospace labels and no tracked capitals; only
  keys (`kbd`) are set in a monospace.
- **Sound:** one switch (bottom left, M) for the water, the fish and the
  music alike; the music follows it through `setMusicMuted()`. YouTube's
  chrome never shows: the player is never moved (an iframe reloads when
  it is) and stays clipped; the Music chapter shows the cover.
- **People:** presence sends a colour and, for members, a username;
  nobody's pointer or city ([decision 0005](../decisions/0005-concurrency-and-opt-in-sharing.md)).
  Other visitors are koi of their colour. Notes and chat messages render
  as text (`esc()`); the database enforces who may post and how often,
  and the sheet shows its refusals in its own words (`SocialError`).
- **What loads when:** the first visit gets the page's script (about
  35 KB gzipped), its CSS and the serif. The backend loads at once only
  for someone with a stored session, otherwise once the pond has settled
  (`settled` in `engine.js`), as do the songs, three.js and the models.
- **The loop's pace** (`clock.js`, `invalidate()` in `engine.js`):
  - At most 60 frames a second while something happens, and 30 once nothing has for six seconds (no
    input, the water settled, no look coming in, no rain). The koi always swim, so quiet is never
    still: at 10 they stepped visibly.
  - Frames fall on the display's own beats, every nth (`due()`), so they come evenly; a timer that
    waited and then caught the next beat made the koi judder.
  - None while the tab is hidden. Under reduced motion the koi still swim, at the quiet pace.
  - The quiet pace too while the window is in the background, the battery is low and not charging, or
    a chapter or the palette is open (there only what was just touched keeps 60). A look coming in, and
    a finger held down, are always drawn at 60.
  - The ripples step on time, 120 steps a second (scaled by ink's slow time), so they run at the same
    speed at 60 and 120 Hz.
  - A frame touches the page only when what it shows changes: the panes are read only while something
    there moves, and tags, the knob and the gauge are written only on change.
  - Textures are made once for each size and then only refilled. The top layer is drawn ten times a
    second. The glass blurs a quarter-size copy of the scene, and the tree's shade is drawn in the
    glass pass, not by a blurred, blended layer.
  - The water pass is built three ways from one source (`fsPart()`): whole, while a look comes in or
    goes; the water alone, with no look shown; a look alone, once it covers the water. The two smaller
    builds compile in the background and draw exactly what the whole would (the A/B was pixel-identical
    in every look), at about half its cost under a software renderer. The reflected canopy is skipped
    with the focus up close, where none of it shows. A change to the pass goes in the one source and
    must stay right in all three.
  - The dove's model is drawn every frame in flight and at most 30 times a second while it sits; the
    spider's only when its pose changes.
  - At most about two megapixels are drawn. Where the browser can time the GPU
    (`EXT_disjoint_timer_query_webgl2`), fewer only when the two passes take over 70% of a frame for a
    while, a tenth at a time and never below 0.8 of full, and back up as soon as the next step would
    fit in half a frame; elsewhere, fewer if frames run slow.
  - `?perf` (or a build with `PUBLIC_POND_PERF=1`) shows the real numbers in a corner: frames a
    second, each part's CPU time, the GPU's time, which build of the pass, the size drawn.
  - The sound sleeps when muted, hidden or idle for a minute.

  A new animation must be time-based (scale by `dt`), and anything that changes the picture without
  input must call `invalidate()`.
- **Addresses:** a chapter is `#<chapter>`, and an entry on the timeline
  `#career/<id>` (ids from `content.ts` and the project pages' slugs).

## Ink and paper

The 墨 switch (bottom right; I; ⌘K "Ink and paper") turns the pond into
an ink painting. A drop falls from the switch and its front spreads with
a ragged, fibrous edge (`uInk`: radius, origin, state); what it has
passed is drawn as xuan paper, the fish as washes with a dark edge and
cinnabar where their patches are red, pads as pale washes, the ripples
only as faint crests. Time all but stops as the drop lands, then runs at
about a third (`timeScale`, which also paces the ripple simulation), and
back to full going home. A press on paper leaves a blot that spreads
(`uBlot`, ten at most). The page's colours follow from `#pond[data-ink]`
in `pond.css`, which redefines the palette and puts every chapter on
paper; a new pane or control needs its ink colours there too.

## The seal album

Each look has a seal (`seals.ts`: the seals, the volumes, the album's state and its words in the three
languages). The first time a look comes in all the way (`reached()` in `engine.js`, from `stepInk`), by
gesture, key or ⌘K, its seal is stamped in the corner above the controls, in the look's own manner
(`#pond[data-look] .stamp` in `pond.css`), with a soft thud; under reduced motion it only appears.

- The album is a sheet (`#seals`, ⌘K "Seals"), not a numbered chapter: a leaf of paper for each volume
  (册), found seals in vermilion with the day, the rest an outline and a hint that points at the gesture
  without saying it. Its small mark sits under the clock's lines once there is a seal, or on a later
  visit by someone the line on the water didn't reach.
- A full volume carries the large 锦程 seal and a line of thanks. The first volume full, the visitor's
  koi wears a small seal; every volume full, the gold koi does too. ⌘K then offers "Clear my seals".
- Someone who has found no look is shown one line on the water, once: 20 s after the pond settles, or a
  moment after their first press, with the gold koi coming over. Never over a chapter, the command bar
  or the title's type.
- Everything is kept in `localStorage` (`pond-seals`) and nowhere else. Nothing runs in the frame: the
  stamp is a CSS animation, the line a timer.
- A new look adds its seal to a volume in `VOLUMES` (characters the brush face has), its name and hint
  in each language, and its stamp's manner in `pond.css`. Looks marked `preview` exist only in a build
  with `PUBLIC_POND_PREVIEW=1`.

## Looks that are only previews

Five looks exist only in a build with `PUBLIC_POND_PREVIEW=1` (`newlooks.js`, `newlooks.css`): Monet's
water lilies in oil, blue-and-white porcelain (青花), a Dunhuang mural (敦煌), a star chart (星图) and a
school blackboard newspaper (黑板报). A release build leaves out their shader source, gestures and
commands; their seals are marked `preview` in `seals.ts`.

- Each is one function of the water pass, built as a pass of its own the first time it is asked for
  (`fsPart(2, sid)`), as every look now is. None adds a pass or a per-frame cost outside it.
- Each has its press (`uBlot`), its winter, a palette and a pairing of faces the pond already loads, its
  sounds (`lookSound`), a glass tint, how the dove and spider are laid in, and its stamp. Rain is off in
  all five. In the star chart `Koi.drawStars` draws the koi as constellations.
- The gestures are rules apart from the pond (`gestures.ts`), with the table of all ten looks at the
  top; `gestures.test.ts` tries every pair. A new gesture goes in the table and gets its pairs.

### Pictures for the looks

Where a painted picture beats what a shader or canvas paths can draw, a look uses one. Each look's
pictures are in `public/pond/<look>/`, load only when that look is first asked for, and stay within
the size budget of `scripts/check-public-sizes.mjs` or have a stated exception there. A look is built
to work without its pictures and to be better with them, so nothing waits on a delivery. What is
asked for is under "Wanted, by look" at the end of this section; what has come is in a table under
its look.

#### Dunhuang

The flying figures (飞天) can't be drawn well in a shader, so they are pictures, in
`public/pond/dunhuang/`. They are in use: `muralLayout()` in `newlooks.js` places them for the wall's size, `paintMural()` in
`engine.js` lays them into one canvas and sends it to the GPU once (again only on a resize), and
`lookDunhuang()` draws that texture (`uMural`) under its wear.

| File | Size | What is in it (pixels with any paint, as x, y, width, height) |
| --- | --- | --- |
| `feitian-pipa.webp` | 1536 × 768, 135 KB | One figure playing a pipa, pale skin, skirt in green and blue: 114, 116, 1330, 519. The body is the left 45%, the ribbons the rest. |
| `feitian-flowers.webp` | 1536 × 768, 116 KB | One figure scattering lotus flowers from a tray, brown skin, cinnabar skirt, descending: 82, 46, 1367, 658. |
| `sky-flowers.webp` | 1024 × 512, 38 KB | Eight small motifs in a grid of 4 × 2 cells of 256 pixels, each inside the middle 152 pixels of its cell. Top row: a blue cloud, a green cloud, a red cloud, an open lotus. Bottom row: a bud, a half-open lotus, two petals, a flaming pearl. |
| `feitian-pipa-2560.webp` | 2560 × 1280, 258 KB | The pipa player again for the centrepiece, in the same frame, so every position is the 1536 one's × 5/3 (the paint: 190, 194, 2217, 864). It is an enlargement of the original at the size the image model gave (1774 wide), not a redrawing: its lines are sharper than the 1536 one stretched, but it holds no new detail. To use it, point `MURAL.pipa` at it and make its source rectangle 2560 × 1280; `feitian-pipa.webp` can then go, or stay for narrow walls. |
| `feitian-far.webp` | 768 × 384, 84 KB | A small, simpler figure flying to the right, holding a lotus out in both hands, ribbons streaming left, pale skin, green skirt: 35, 95, 701, 201. Her face is at 607, 165, radius 25. Her feet show. |
| `border.webp` | 1024 × 128, 3 KB | A band to tile across the wall's top and bottom: a green vine with a green leaf, a blue leaf and a white bud on cinnabar, between two rows of white pearls on blue. Opaque all over, and seamless left to right: four turns of the vine and 64 pearls a row in one tile. No gold in it. |
| `caisson.webp` | 1024 × 1024, 172 KB | A ceiling medallion (藻井): a lotus of two rings of petals round a white seed-pod, in a blue circle, a corner flower in each corner, then square bands of cinnabar triangles, white petals, blue and green: 42, 43, 939, 938. Opaque inside its square. No gold in it. Drawn by hand, so not exactly the same in its four quarters. |
| `halo.webp` | 512 × 512, 51 KB | A halo (光环): a white disc, a blue ring, a ring of cinnabar and green petals, and a thin rim in the gold ochre: 23, 23, 466, 466, a circle about the middle. |
| `cloud-trail.webp` | 1024 × 256, 36 KB | A long cloud (长云): three curled scrolls in white, blue and green at the left, thinning into one tail that ends in a point at the right: 57, 33, 916, 167. |
| `koi.webp` | 1024 × 1536, 134 KB | The koi sheet to the common spec, as mural fish: an iron-wire line, rows of scale arcs, flat mineral colour. Four rows of 384 pixels, each from x 62 (the barbels) to a tail tip at 962, the spine on its row's middle line (y 192, 576, 960, 1344); one drawing mirrored about the spine. Row 1 in the gold ochre with white fins; row 2 the wall's white with one cinnabar spot on the head; rows 3 and 4 in greys with three and four grey patches. The ochre is on the gold koi only. Its fin rays taper a little, and it is close in drawing to the ukiyo-e sheet: the two differ mostly in line weight and colour. |
| `koi-mask.webp` | 1024 × 1536, 11 KB | White over the patches of rows 3 and 4 (about 13% of each fish), soft by 2 to 3 pixels, black elsewhere. |

- **How they are painted:** flat mineral colour inside a dark line, in the look's own palette (blue
  `#2B6385`, green `#4D856E`, cinnabar `#B34026`, white `#EDE0C2`, line `#2E1C12`, a little ochre
  `#CC8F38`), on a transparent ground with straight (not premultiplied) alpha. They carry no plaster,
  flaking or cracks: the shader has those, so lay each picture in under `keep`, the cracks and the soot
  as the koi and the pads are, and it ages with the wall.
- **Which way they face:** both figures fly to the left with their ribbons streaming right, which is
  the way the shader's two ribbons already drift. Mirror the texture's x to fly the other way.
- **How large:** at 1536 pixels a figure is sharp up to about half the width of a large window at
  2× and softens beyond that, which the wall's grain mostly hides. Ask for a larger one before
  stretching it further.
- **Loading:** fetch them the first time the look is asked for, as its pass is built, never on the
  first load, and only in a build that has the look. They are same-origin, so the Content Security
  Policy needs nothing. Each stays under the 200 KB budget of `scripts/check-public-sizes.mjs` but
  `feitian-pipa-2560.webp`, which has an exception there with its reason.

They come from an image model that only an agent on the owner's machine can reach (Codex's image
tool, asked from there), not from an agent in the cloud. So the work is split:

- An agent that can't make pictures writes what it needs under "Wanted" below (the subject, the
  pose and the way it faces, the pixel size, and where it will sit), pushes, and tells the owner.
- The agent on the owner's machine has them made, looks at each over the wall's colour
  (`#C29963`), rejects what is cropped, modern-looking or wrong, encodes them as WebP with alpha
  (`cwebp -q 82 -alpha_q 90 -m 6`), commits them to the same branch, and moves the line from
  "Wanted" into the table above. The lossless originals stay out of git.
- To match the ones here, a new picture is asked for as a high Tang Mogao mural (caves 320, 321
  and 39), flat pigment inside an iron-wire line, the palette above, no shading, no background, no
  ageing, with a margin of at least 4% on every side.

Wanted for Dunhuang:

- A ceiling medallion (藻井) with the three hares that share three ears (cave 407), square, for the
  quiet middle of the wall. One was made and turned down: the ears came out as three spindles
  joining the hares' noses. Wanted only if the look has a place for it.

About the second lot (the larger pipa player, the far figure, the border, the medallion, the halo and
the long cloud): the image model gives nothing wider than 1774 pixels, so a picture asked for larger
than that is an enlargement. Their colours were snapped to the palette, each area one flat colour, so
their edges are a little harder than the first three's, and the far figure's crown has a few flecks of
cinnabar in its ochre. The ochre is only where gold is meant: crowns, earrings, bracelets and the
halo's rim.

What worked, and what was changed in use (2026-11-12): the three pictures are good, well drawn and in
the wall's own manner, and are used as they came. Both figures are used facing left,
unmirrored. The pipa player sits high in the right half and the flower-scatterer lower right;
her three falling lotus are continued by a lotus, a bud and petals from `sky-flowers` towards the
pond. Three clouds and the pearl are placed by the figures; the half-open lotus and the green cloud's
twin are unused so far. On a narrow wall only the pipa player is drawn, in the open water under the contents (at the top
she lay under the greeting), 1.25 walls wide so her body fills the width and the ribbons run off the
right edge. Faces are kept from flaking by
position (`faces` in `muralLayout()`): if a picture is redrawn with the head elsewhere, say where. The
ochre (`#CC8F38`) is read as gold leaf and made to glint, so anything meant as gold should keep that
colour and anything not meant as gold should avoid it. The loose flowers are fixed on the wall, not
adrift: riding the petals' wind would need them as sprites on the top layer, which is a later step.

#### Monet

In `public/pond/monet/`, and the look is built on them: the painted water is the bed (`paintBed()` in
`engine.js` lays the upright one on a phone, the small one on a small window, the large one where the
pond is drawn large, into the one texture a look's picture lies in, `uMural`), the water over it bends
it a little and catches a sheen (`lookMonet()`), the pads and their flowers are drawn from `lilies`
(`drawPads()`: a bud in spring, half open then open in summer, none in winter), and the koi from
`koi` along their own spines (`Koi.drawSprite()`). Nothing is synthesised a stroke at a time any more.
Not used yet: `strokes` and `canvas` (the press is a soft dab drawn in the shader, and the arrival's
front is the shader's; both could take the stamps later).

The koi to the common spec have come as `koi-v2.webp` and `koi-mask.webp` (the table below).

| File | Size | What is in it |
| --- | --- | --- |
| `strokes.webp` | 1024 × 1024, 162 KB | Sixteen brush strokes in a 4 × 4 grid of 256-pixel cells, each at least 18 pixels clear of its cell's edge, lying left to right with the loaded end at the left. Greyscale is the paint's height (white thickest), alpha its cover, broken at the dragged tail. Rows: long drags (about 220 pixels), curved medium strokes (150), short dabs (90), clusters. The height is how the image model lit thick paint, not a measured surface. In the last row the second and fourth clusters came out as small modelled water lilies, not loose dabs: use the first and third as dabs. |
| `canvas.webp` | 512 × 512, 54 KB | A plain linen weave, greyscale, opaque, even in tone, about 43 threads across. It was cut on whole threads and tiles on all four sides; over a large flat area a very faint line can still be made out where tiles meet. |
| `bed.webp` | 2560 × 1440, 380 KB | The water alone, in oil: blue-violet passages, green-gold willow reflections running down the right two thirds, pale lilac and rose where the sky shows, mostly at the right. No pads or flowers. The left third is darker and plainer (it averages `#446080`; the rest `#6C8592`). Opaque to every edge. Painted at 1664 × 936, the largest the image model gives, and enlarged; the brushwork is finer and more even than late Monet's, and the pale swirls of sky are much alike. |
| `bed-1280.webp` | 1280 × 720, 93 KB | The same picture, for a phone held sideways or a small window. |
| `bed-tall.webp` | 1080 × 1920, 95 KB | The same pond painted again upright, not a crop: the dark, plain passage across the top third (it averages `#3F6383`; the rest `#648699`), willow reflections and pale sky below. Quieter and softer than the wide one. |
| `lilies.webp` | 1024 × 768, 137 KB | Twelve motifs in a 4 × 3 grid of 256-pixel cells, each at least 22 pixels clear of its cell's edge, no outline or shadow, soft bristle edges in the alpha. Row 1: three large pads (olive, grey-green with a notch, one catching the light) and a medium olive pad with a notch. Row 2: a medium grey-green pad, a small olive pad, a small light pad, an open white blossom. Row 3: a half-open white blossom, an open pink, a half-open pink, a bud. The large pads are about 210 pixels across, the medium 170, the small 120. |
| `koi.webp` | 1024 × 768, 166 KB | Three koi from straight above, one to a 256-pixel row, heads to the left: orange (spine at y 128), white with red (384), gold (640). Each runs from a snout at x 62 (barbels to 55) to a tail tip at 958, the spine within 3 pixels of its row's middle. The tails and fins are not quite the same above and below the spine, there is more detail than a few loaded strokes, and the alpha has only 12 levels, so the bristle edges are coarser than the lilies'. If they don't sit well, keep the pond's own koi. |
| `koi-v2.webp` | 1024 × 1536, 173 KB | The koi again, to the common spec: four rows of 384 pixels, heads to the left, each from x 62 (the barbels) to a tail tip at 962, the spine on its row's middle line (y 192, 576, 960, 1344), within 3 pixels (it is not mirrored, so the fins keep a small natural unevenness). The same fish in the same dabs four times: gold; white with one red dab on the head; two in greys with four darker dabs each, laid differently. The body is slimmer than in `koi.webp`. Smooth alpha (256 levels). `KOI_SHEETS.monet` still reads `koi.webp`, whose rows are 256 pixels: to change over, point it at this file with rows of 384, the tail tip at 962 and the mask, then delete `koi.webp`. |
| `koi-mask.webp` | 1024 × 1536, 17 KB | White over the grey dabs of rows 3 and 4 of `koi-v2.webp` (about 30% of each fish), soft by 2 pixels, black elsewhere. |

#### 青花

In `public/pond/qinghua/`, and in use: `paintRim()` in `engine.js` tiles the rim along all four sides with the
corner piece in each corner (mirrored), into the texture a look's picture lies in, and the frame is the
page's margin; the koi swim from `koi.webp` (`Koi.drawSprite()`), the grey ones washed in cobalt, a
visitor's colour laid into their patches through `koi-mask.webp` (`koiPicture()`). Cobalt only, the porcelain left transparent.

| File | Size | What is in it |
| --- | --- | --- |
| `rim.webp` | 1024 × 128, 106 KB | A lotus scroll between two lines, seamless left to right. The lines are 2 pixels, at the very top and bottom. One tile is one turn of the scroll: an open lotus and a lotus in profile with their leaves take about the middle 60% of it, and a plain stem at mid-height joins one tile to the next, so tiled it reads as flowers set apart, not a dense scroll. |
| `corner.webp` | 256 × 256, 13 KB | The top-left corner: the outer lines along the top and left edges, the inner lines meeting at 128, 128, the stem turning at 64, 64 under a small lotus. Its right edge meets `rim.webp` and its bottom edge meets `rim.webp` turned a quarter, to the pixel. The lotus is small and pale beside the rim's flowers. |
| `koi.webp` | 1024 × 1536, 163 KB | Four koi from straight above in rows of 384 pixels, heads to the left, each from x 62 (the barbels; the snout is a little to the right) to a tail tip at 962, the spine on its row's middle line (y 192, 576, 960, 1344). All four are one drawing, its upper half mirrored onto the lower, so the spine is exactly straight and the fish exactly symmetrical; the brush marks repeat across it. Scales and fin rays in cobalt line, the body an opaque porcelain white. Row 1 has four gold patches, row 2 one cobalt spot on the head, rows 3 and 4 are in greys with four and three grey patches. The patches are plain rounded shapes laid under the line, not brushed washes: good enough to prove the method, to be redrawn once it is settled. |
| `koi-mask.webp` | 1024 × 1536, 6 KB | White over the patches of rows 3 and 4 (about 6% of each row), with edges 2 to 3 pixels soft, black elsewhere. Made from the same shapes as the patches, so it lines up with `koi.webp` to the pixel. |

#### Ukiyo-e

In `public/pond/ukiyo/`.

| File | Size | What is in it |
| --- | --- | --- |
| `waves.webp` | 1024 × 512, 68 KB | Eight wave crests in a 4 × 2 grid of 256-pixel cells, all breaking to the left: four large ones with claw foam and spray dots in the top row, four low wavelets in the bottom. Exactly four colours: `#1F4A7A`, `#8FB4C8`, `#F6EDD8` and a keyline `#0C1B27`. The four large crests are much alike in outline. |
| `koi.webp` | 1024 × 1536, 177 KB | The koi sheet to the common spec, as a carp print: a black key line, bold scale arcs, flat colour. Four rows of 384 pixels, each from x 62 (the barbels) to a tail tip at 962, the spine on its row's middle line (y 192, 576, 960, 1344); one drawing, its upper half mirrored onto the lower, so the spine is exact. Row 1 ochre `#E9B44C` with paper-white fins; row 2 paper white with one vermilion spot on the head; row 3 in greys with three grey patches, row 4 with four. The patches are irregular and not the same either side of the spine. The line is cleaner and more even than a cut block's. |
| `koi-mask.webp` | 1024 × 1536, 11 KB | White over the patches of rows 3 and 4 (about 14% of each fish), soft by 2 to 3 pixels, black elsewhere. |

#### Star chart

In `public/pond/stars/`. One colour, `#C9D4F0`, its strength in the alpha.

| File | Size | What is in it |
| --- | --- | --- |
| `plate.webp` | 2048 × 1024, 166 KB | A graticule without stars, figures or lettering: curved parallels and converging meridians, the equator and the ecliptic as arcs with tick marks, a thin frame with ticks (the paint: 85, 69, 1879, 885). It is constructed, not drawn by the image model (which kept adding numerals and stars), so it is more regular than an engraving and has little hatching. |
| `koi-figures.webp` | 1024 × 512, 31 KB | Two koi from above in outline, heads to the left, in two 512-pixel cells: one straight (46, 184, 424, 163), one in a shallow S (in its own cell: 40, 185, 435, 167). A few scale arcs and fin rays, no fill. Plainer than an atlas figure. |

#### Ink

In `public/pond/ink/`, and in use: `paint()` in `painting.js` hangs the season's one at the pond's
right edge (`hang()`), over the hills, and the ink canvas multiplies it into the paper. Each is fetched
the first time its season shows in ink; the brushed motifs remain only as what is drawn if one can't
be had. Each is 1024 × 1024, near-black ink whose darkness is in the alpha (the plum keeps
its red), entering at the right edge and reaching left, the left third empty.

| File | Size | What is in it (the paint, as x, y, width, height) |
| --- | --- | --- |
| `plum.webp` | 70 KB | An old plum branch rising from the lower right, two open blossoms and a few buds in soft red: 360, 148, 664, 727. The wood is heavier and more worked than the others. |
| `willow.webp` | 56 KB | Willow fronds hanging from a branch at the upper right: 359, 73, 665, 820. |
| `lotus.webp` | 77 KB | A lotus leaf in wet wash, a flower in line above it and a bud, on stems from the lower right: 358, 194, 666, 636. |
| `reeds.webp` | 75 KB | Reeds bending from the right, a goose flying in at the top and one standing among them: 364, 90, 660, 840. |


#### Egyptian relief

In `public/pond/relief/`, each picture as a pair that lines up to the pixel: `-c.webp` the paint,
`-h.webp` the height.

| Pair | Size | What is in it (each motif within its cell, as left, top, right, bottom) |
| --- | --- | --- |
| `fish-c.webp`, `fish-h.webp` | 1024 × 512, 83 KB and 35 KB | Two tilapia in profile, heads to the left, in two 512-pixel cells: blue head and back, green flank, a yellow belly line, red ochre fins. The straight one: 36, 136, 476, 376. The other: 36, 138, 476, 373; it is only slightly curved. |
| `frieze-c.webp`, `frieze-h.webp` | 1024 × 128, 34 KB and 3 KB | An open blue lotus and a bud on a red base line, a stem looping from one to the other, four times in a tile, seamless left to right in both files. The flowers reach to 4 pixels from the top; the base line is at the bottom. |
| `lotus-c.webp`, `lotus-h.webp` | 1024 × 512, 98 KB and 33 KB | Eight motifs in a 4 × 2 grid of 256-pixel cells, each at least 18 pixels clear of its cell's edge. Top row: two open lotus flowers, a blue bud, a green bud. Bottom row: two leaves from above, with a notch and veins, a papyrus clump, a duck facing left (18, 70, 238, 185). |

- **The paint** is flat colour in the look's palette inside a dark line, faded a little, with 28% of
  it worn away in patches and speckle, more at the edges; where it is gone the file is transparent.
- **The height** is not drawn by the image model, which can only draw a carving already lit. It is
  worked out from the same drawing, so the pair can't be out of register: the stone's face is exactly
  128; inside a motif's outline the surface rises over a shoulder 6 to 8 pixels wide to a nearly flat
  top about 30 above the face (the highest point is 162), and the drawing's inner lines (scales, fin
  rays, veins) are cut back into it as shallow grooves (the lowest point is 119). Nothing is lit or
  shaded in it. Low relief was the aim: scale it in the shader for more.
- Seen under a raking light, the scales and the narrow petals read a little rounded, and the papyrus
  rays are fine for this size. The drawing is cleaner and more regular than a tomb wall's.


#### Water

In `public/pond/water/`: Devot's dove and ocra's jumping spider as sprite sheets, modelled in Blender
and rendered from straight above. Not used yet: `life.js` still draws them.

| File | Size | Cells | Rows, left-aligned, the rest of each row empty |
| --- | --- | --- | --- |
| `dove.webp` | 2048 × 1024, 132 KB | 256 × 256, 8 × 4 | 1 sitting (4), 2 take-off (6), 3 flight (8), 4 landing (6) |
| `spider.webp` | 1536 × 768, 117 KB | 192 × 192, 8 × 4 | 1 sitting (2), 2 walking (8), 3 crouch (2), 4 jump (4) |

- **Framing is `life.js`'s own**, so a cell drops in where the 3D picture was drawn, at the same
  size: the creature faces the right of its cell (heading 0), its place on the ground is the cell's
  centre (128, 128 for the dove, 96, 96 for the spider), and the cell spans 4 units either side of
  it for the dove (32 pixels a unit) and 2.7 for the spider (35.6). The paint is not centred on that
  point, as it was not before. The dove sitting still is 131 pixels from beak to tail (57, 105 to
  188, 151); the spider is 124 pixels with its legs (22, 46 to 146, 146). Nothing comes within 18
  pixels of a cell's edge.
- **The dove's frames:** sitting 1 still, 2 head turned to its left (up in the cell), 3 to its
  right, 4 preening with the head laid back on the left shoulder. Take-off 1 crouch, 2 wings
  lifting, 3 wings high, 4 first downstroke, 5 its end, 6 upstroke, which leads into flight 1.
  Flight is one wing-beat that loops, 1 at the top, 2 to 4 down, 5 at the bottom, 6 to 8 up; about
  60 ms a frame. Landing 1 braking with the tail fanned, 2 the back-stroke (the widest frame, 220
  pixels of span), 3 wings up and half folded, 4 touching down, 5 folding, 6 settled, close to
  sitting 1.
- **The spider's frames:** sitting 1 still, 2 looking up with the front legs and palps raised.
  Walking is a loop of 8 in an alternating gait, about 70 ms a frame; one loop is a stride of half a
  unit (18 pixels at the cell's scale), so move the sprite that far a loop or its feet slide. Crouch
  1 lowering, 2 gathered. Jump 1 launch, 2 in the air and tucked, 3 front legs reaching, 4 landed
  and splayed; the jump is drawn in place, for the pond to move.
- **Light and colour:** one soft light from the upper left and a little fill, no ground and no
  shadow on one, the dove white to pale grey, the spider in greys, for a look to tint or line. The
  light is baked in at heading 0: turned with the creature, the shading turns too. Straight alpha;
  the transparent pixels round the paint carry its edge colour, so a filtered read shows no dark
  fringe.
- **What is weak:** the sitting dove (the folded wing's front edge is a straight step at the
  shoulder, and the four sitting frames differ little); its half-folded frames (take-off 2, landing
  3 to 5) have stiff wings; its legs never show from above; on pale paper it has little contrast
  without a line. The spider's looking-up frame is close to its still one, and its pale leg bands
  read as knobs at the knees. The loops were judged from still frames laid side by side, not played.
  Both are clearly better than the 3D ones in flight and for the spider; the sitting dove only a
  little.
- **To change them:** they are made by scripts kept on the owner's machine (one command a sheet,
  about two minutes), so a different facing, size, frame count or light is cheap to ask for.
- **`lilies.webp`**, 1024 × 768, 157 KB: eleven motifs in a 4 × 3 grid of 256-pixel cells, from straight
  above, like softened photographs, even light, no shadow. Row 1, summer: a large whole pad (215
  pixels across), a large one with a notch, a medium one with a notch (170), a small young one (120).
  Row 2, autumn, the same four withered: yellowing with a brown curled edge, brown and torn with a
  notch, brown with a notch, small and yellow-brown. Row 3: a white flower and a pink one, open (150
  across), a bud (98 × 120), and an empty cell. The leaves are closer to lotus leaves than to a water
  lily's, their sheen is slight, and the flowers are a little cupped. Not used yet.


#### What is drawn by code, and what should be a picture

Painted pictures are the default wherever drawing in code falls short, in every look, the water
included. This is everything the pond draws by code, judged; the pictures it calls for are in the
list below, in the order they would help most. What must answer to physics (the water, its ripples,
light and refraction, the glass) stays in the shader.

| Element | Drawn in | How it reads now | Verdict | Picture wanted |
| --- | --- | --- | --- | --- |
| Koi | `Koi.draw()` on the fish canvas, restyled by each look's shader | Good in water and ink; a silhouette restyled in the other looks, which is where they look least like the look | Replace per look, keep in water (and in ink unless a painted one is clearly better) | A sheet per look, bent along the live spine: see "Koi for each look" |
| Lily pads, lotus flowers and buds | `padsNow()` on the pads canvas | Flat discs with a notch, flowers a few ellipses; the weakest thing on the water look | Replace | `water/lilies`, then one per painted look |
| Petals, autumn leaves | `drawTop()` paths | Leaves pass; petals are two ellipses | Replace petals and leaves together | `water/afloat` sheet |
| Snowflakes | dots on the air canvas | Fine: they are small and moving | Keep | none |
| Dragonflies | paths on the air canvas | Stiff; wings are plain ellipses | Replace | `water/dragonfly` sprite, 4 wing frames |
| Fireflies (preview) | soft dots | Fine | Keep | none |
| Devot's dove, ocra's spider | three.js models built in code (`life.js`), rendered into a small canvas | Rough close up, and each look can only tint them | Replace with rendered sprites; this also removes the per-frame 3D | Blender job, below |
| Paper boats | three paths in `drawTop()` | Read as boats; a little bare | Replace when convenient | in `water/afloat` |
| Moon, sun glint | shader | Light, not an object | Keep | none |
| The tree's shade | a texture drawn once | Good on water; wrong on the painted looks (switched off there) | Keep | none |
| Pebble bed (water look) | `BED` shader, drawn once | Good; it is what the refraction reads from, and the first thing seen | Keep for now | A Blender-rendered bed with a normal map would be the one thing to try, behind a flag, at no cost to the first visit's budget only if it fits in about 150 KB |
| Ink: seasonal motif | `painting.js`, from pictures | Painted, and in use | Done | none |
| Ink: far hills, mist | canvas washes, CSS | Good | Keep; hills later | `ink/hills` later |
| Seals (ten looks and 锦程) | the brush face in CSS | A family, but running script, not seal script | Replace | `ink/seals` (asked) |
| Ink: inscription | the brush face | Good | Keep | none |
| Festival things (preview) | canvas paths | Lanterns pass; the dragon boat is crude | Replace the boat and the river lanterns | `water/festival` sheet, later |
| Borders and frames | shader (青花 beads, Dunhuang band) | 青花's beads are plain | Replace | delivered (`qinghua/rim`, `corner`; `dunhuang/border`) |
| Solar-term block, chapter headers, the album's paper | type and CSS | In keeping | Keep | per look only where asked below |
| Presses | shader, per look | Good where they are physics (rings, blots); ukiyo-e's claws are stiff | Replace ukiyo-e's | delivered (`ukiyo/waves`) |
| The pond's mark, timeline marks | PNG files already | n/a | Keep | none |

Highest value, in order: Monet's painted bed; a koi sheet per look (one look first, as the proof);
lily pads and flowers for the water look; the dove and the spider as rendered sprites; the seals in
true seal script.

#### The art brief

Every look's main pictures are made by the thread on the owner's machine; this brief is the whole of
what each look needs, in the order to make it, so nothing has to be asked. A look is built to work
without its pictures and to take each one as it comes. What has been delivered is in the tables
above; this list says what each thing is for and what is still wanted.

**For every picture, unless its line says otherwise**

- WebP. Transparent ground with straight (not premultiplied) alpha; a ground the line calls opaque
  is painted to all four edges. `cwebp -q 82 -alpha_q 90 -m 6`.
- At least 4% of clear margin inside the picture, or inside each cell of a sheet. Nothing cropped.
- No text, letters, numerals, signature, watermark or frame. No cast shadow, no background, no water.
- No ageing, paper, canvas or plaster texture baked in: the look adds its own. The exception is a
  bed, which is the texture.
- Sheets are grids of equal cells, one motif in the middle of each, read left to right, top to bottom.
- "In the manner of" always means the period and the hand, never a copy of a particular work.
- Size budget: 200 KB a file (`scripts/check-public-sizes.mjs`). A bed may pass it, with a line
  there giving the reason (it loads only with its look); nothing on the water look may, since the
  water is the first visit.
- Folder: `public/pond/<look>/`, the looks being `water`, `ink`, `ukiyo`, `glow`, `blueprint`,
  `ascii`, `monet`, `qinghua`, `dunhuang`, `stars`, `relief`.
- Priority: **P0** the look is not itself without it; **P1** lifts it; **P2** a nicety.

**What belongs to which season** (paint seasonal sets to this; the pond's own rules follow it, and
`seasons.test.ts` holds them to it). Plum blossom and green lily pads never appear together.

| Season | Solar terms | On the water | In ink's painting |
| --- | --- | --- | --- |
| Spring | 立春 to 谷雨 | Peach and cherry petals; lily pads small and few, just come up; no lotus flowers | Willow |
| Summer | 立夏 to 大暑 | Pads full and green; lotus in bud, then in flower; dragonflies; fireflies at night | Lotus |
| Autumn | 立秋 to 霜降 | Falling leaves; the lotus withered (残荷): pads brown and curled, fewer each term, bare stems; no flowers | Reeds and wild geese |
| Winter | 立冬 to 大寒 | Snow and ice; no pads, no lotus, no dragonflies; at most a few dry lotus stems | Plum blossom |

South of the equator the same table is read half a year on. A look that keeps seasons wants its
pads and flowers as these sets: spring (small young pads), summer (full pads, bud, flower), autumn
(withered pads and stems). Winter has none.

**The koi sheet, the same for every look** (so one loader reads them all)

- `koi.webp`, 1024 × 1536, four rows of 1024 × 384, one koi in each: seen from straight above, head
  to the left, the body straight along the row's middle line, 900 pixels from the barbels (x 62) to
  the tail tip (x 962), fins and tail spread and symmetrical. Rows: (1) the gold koi, which is
  Jincheng; (2) white with ONE red spot on the head and no other mark, which is the visitor; (3)
  and (4) two koi to be tinted, in greys only, each with three or four patches.
- `koi-mask.webp`, the same size: white over the patches of rows 3 and 4, black elsewhere, soft by
  2 to 3 pixels. A visitor's colour is laid into the patches.
- How it is used: cut into 28 slices along its length, each laid along the swimming koi's spine, so
  keep the spine dead straight and paint nothing that only makes sense straight (no long straight
  highlight down the back). 青花's sheet is the model of a correct one.

**The dove and the spider** (Blender; in `public/pond/water/`). **Status: revise.** The first sheets
(`dove.webp`, `spider.webp`, under "Water" above) are clean and correct in outline, but Jincheng's
review is that the dove is not detailed or lifelike enough and the spider needs more detail. They
are used only as placeholders while the pond's sprite path is built; they are not final. Before
rendering whole sheets again, send **one still of each at full size** for approval. Keep: straight
above, the same facing, neutral even light with ambient occlusion only, no cast shadow, transparent
ground, straight alpha; the same file names with `-v2`; and a note of the grid and frame order.

- **The dove: a real dove, from life.** Work from real white doves and rock pigeons seen from above.
  - Proportions: a small head, a full breast, a body that tapers, a fan tail.
  - Plumage modelled so it reads from above: primaries, secondaries, the greater, median and lesser
    coverts, the scapulars, and the tail feathers, overlapping, with soft edges. Soft white, with a
    little warm and grey shading in the overlaps. Not a clay model.
  - At rest: the wings folded properly, their tips crossing over the tail; feet tucked.
  - The head: an eye with a dark iris and an eye-ring, a beak with its cere.
  - Flight: a believable wingbeat (on the upstroke the primaries separate and the wrists flex; on the
    downstroke the wing is fully spread), 12 frames or more; a take-off with a push and steep first
    beats; a landing with the tail fanned and the wings braking.
  - Also: an idle (preening, or a head-bob) and a short walk with the feet showing.
  - Cells of 512 × 512, so it holds at the size it is drawn. Give the grid.
- **The jumping spider: more detail.** It is ocra's jumping spider (Salticidae).
  - From above: the large forward pair of eyes with a wet highlight, and the smaller eyes behind them.
  - Dense short hair on the carapace and the abdomen, in a clear pattern: banding on the abdomen,
    pale markings, and one touch of ocra's orange (`#E7603A`) as the accent, on the pedipalps or as a
    mark on the abdomen.
  - Legs with their segments and banding, bristles, the pedipalps in front; a low, compact stance.
  - Animation: an alert turn towards movement; the walk, with its stop and start; a wind-up crouch;
    a jump with the legs extended; a landing that settles.
  - Larger cells too (384 × 384 or more). Give the grid.

Each look below says how it wants them dressed; where a look only says "tinted", the neutral sheet
is tinted in code and nothing more is needed.

**The seals** are one sheet for all looks, in the ink kit below.

---

**Water** (the first thing anyone sees; everything here must be small). Judge it by: it still looks
like clear water over stones, nothing looks pasted on.
1. Bed: keep the shader's pebbles. P2, to try behind a flag: a Blender-rendered bed, `bed.webp` and
   a normal map `bed-n.webp`, 2048 × 1152, opaque, river pebbles from straight above in soft even
   light, seamless left to right, under 150 KB together.
2. Koi: keep the pond's own. No sheet wanted.
3. Delivered, to wire in: `lilies.webp` (summer pads, autumn pads, two flowers and a bud). P1
   `afloat.webp`, 1024 × 512, 4 × 2: two cherry petals, three autumn leaves (maple, ginkgo, oak), a
   folded paper boat from above in three tones.
4. Ornaments: none.
5. Press: none (it is the water itself).
6. Dove and spider: the neutral sheets as rendered: delivered (`dove.webp`, `spider.webp`), to wire in.
7. P1 `dragonfly.webp`, 1024 × 256, four frames of a dragonfly from above, wings in four positions
   of a beat.

**Ink** (the benchmark; Jincheng's favourite). Judge it by: a Song or Yuan album leaf; empty paper
is most of it.
1. Bed: the shader's paper. P2 `hills.webp`, 2048 × 512, three far hills as pale washes, for the foot.
2. Koi: the pond's own wash koi are liked and stay. P1, **for an A/B only**: `koi.webp` to the
   common spec as ink wash koi (wet body, dry-brush edge, the spot and patches in cinnabar
   `#B8382A`). It replaces the drawn ones only if it is clearly better in motion.
3. Seasons: delivered and in use (`willow`, `lotus`, `reeds`, `plum`). Composited by multiplying
   into the paper, faded at their outer edges.
   P1 `stems.webp`, 1024 × 1024, withered lotus (残荷) in ink: a few dry bent stems, a curled brown
   leaf, a seed-pod, entering from the right edge like the others; it joins the reeds in late autumn
   and stands alone under the plum in winter.
4. Ornaments: none; the inscription and the 锦程 seal are type.
5. Press: the shader's blot. Nothing wanted.
6. Dove and spider: P1, each as three ink-wash poses on one sheet `dove.webp` / `spider.webp`,
   768 × 256 (sitting, moving, wings or legs spread), in the manner of Bada Shanren's birds:
   a few wet strokes, black and grey. Multiplied into the paper.
7. P0 `seals.webp`, 1024 × 768, 4 × 3, true seal script (篆书), vermilion `#B8382A`, the stone's
   uneven edge, white characters out of red (白文) or red characters and border on transparent
   (朱文): 墨 (square, 白), 浮世 (tall, 朱), 莲 (round, 白), 青花 (tall, 白), 敦煌 (tall, 朱), 光
   (round, 朱), 图 (square, 白), 字 (square, 朱), 星 (round, 白), 刻 (square, 白, for the relief),
   锦程 (tall, 白, 锦 over 程), one cell empty. Tall is 3 : 5. Used in the album, the stamp and
   under the solar term.

**Ukiyo-e.** Judge it by: a Hokusai or Hiroshige print at arm's length: flat colour, a key line,
bokashi gradation, paper showing.
1. P1 `paper.webp`, 512 × 512, washi grain with a few long fibres, greyscale, opaque, seamless.
2. Delivered, to wire in: `koi.webp` + mask, as a carp print.
3. P1 `lilies.webp`, 1024 × 512, 4 × 2: lotus leaves and flowers as a print draws them from above;
   maple leaves and cherry petals for the seasons.
4. Ornaments: none (no cartouche: it was tried and taken out).
5. Delivered: `waves.webp`. To be used for the press and the arrival.
6. Dove and spider: tinted flat, with a key line added in code. Nothing wanted.
7. Seal: on the ink sheet.

**Glow.** Light only: the shader draws everything. Nothing wanted. Dove and spider: tinted as light.

**Blueprint.** Judge it by: a draughtsman's sheet, white line on blue.
2. P1 `koi.webp` (no mask needed: visitors are told apart by their dimension labels): white line
   drawings of a koi from above with a centre line, station marks along the spine and the fins'
   construction lines, line only, no fill, the line `#EAF3FF`.
6. Dove and spider: P2, the same as line drawings, one pose each, 512 × 512.
Everything else is ruled in the shader. Nothing more wanted.

**ASCII.** Characters only. Nothing wanted.

**Monet.** Judge it by: at thumbnail size it is a late Nymphéas panel.
1. Delivered and in use: `bed`, `bed-1280`, `bed-tall`.
2. Delivered and in use: `koi` (three). Delivered, to change over to: `koi-v2` + mask, to the common
   spec (the table above says how).
3. Delivered and in use: `lilies`. P1: an autumn row for it (pads gone yellow-brown), 1024 × 256.
4. Ornaments: none.
5. Delivered, not yet used: `strokes`, `canvas`. For the press and the arrival.
6. Dove and spider: P1 `dove.webp`, `spider.webp`, 768 × 256, three poses each as a few loaded
   oil dabs, soft edges, no line.
   P1 `dragonfly.webp`, 512 × 256, two dragonflies as a few thin dabs (the drawn one is only
   dimmed for now).
7. Seal: on the ink sheet.

**青花.** Judge it by: a Yuan or early Ming blue-and-white dish seen from above: cobalt only, on
white, the blue pooling at line ends.
1. Bed: the shader's glaze and crackle. P1 `medallion.webp`, 1024 × 1024: a double ring, and in it
   two koi among lotus and water-weed in line and wash; it lies large and pale in the right half.
2. Delivered: `koi` + mask, to the common spec.
3. P1 `lotus.webp`, 1024 × 512, 4 × 2, in the cobalt: three lotus leaves from above, two flowers,
   a bud, a seed-pod, a spray of water-weed. They replace the shader's pad outlines.
4. Delivered: `rim`, `corner`.
5. Press: the shader's craze line. Nothing wanted.
6. Dove and spider: P1 `dove.webp`, `spider.webp`, 768 × 256, three poses each in cobalt line and
   wash.
7. Seal: on the ink sheet; the stamp is shown in cobalt, as a reign mark is.

**Dunhuang.** Judge it by: a Mogao wall of the high Tang, sooted and flaked, with the weight of a
dark painted game mural.
1. Delivered and in use: the figures, `sky-flowers`, `border`, `cloud-trail`; `halo` and `caisson`
   delivered, to be placed.
2. Delivered, to wire in: `koi.webp` + mask, as mural fish.
3. P1 `lotus.webp`, 1024 × 512, 4 × 2: lotus leaves and flowers as cave ceilings paint them, flat
   mineral green, white and cinnabar in the same line.
4. Delivered: `border`. 5. Press: the shader's flaking. Nothing wanted.
6. Dove and spider: P1 `dove.webp`, `spider.webp`, 768 × 256, three poses each in the wall's
   manner (the dove as the white birds of the murals).
7. Seal: on the ink sheet.

**Star chart.** Judge it by: a plate from an eighteenth-century celestial atlas.
1. Delivered: `plate`. 2. Delivered: `koi-figures`. P1: the same to the common spec (four rows,
   outline and engraved scales only, with a mask of where a visitor's colour tints the line).
3. P1 `nebulae.webp`, 1024 × 512, 4 × 2: engraved discs and wreaths that stand for the lily pads
   (a ringed planet, a nebula as stippling, a cluster, an armillary ring), the pale line `#C9D4F0`.
4. P2 `compass.webp`, 512 × 512, a compass rose in the same engraving.
5. Press: the shader's star. Nothing wanted.
6. Dove and spider: P1 as engraved constellation figures, one pose each, 512 × 512 (Columba the
   dove; a spider in the same hand).
7. Seal: on the ink sheet.

**Egyptian relief** (not built yet). Judge it by: painted limestone relief from a New Kingdom
tomb under a raking light: carved, pale, cool, nothing like the Dunhuang wall's warm paint.
Every picture comes as a pair of the same size: `-h` the height (mid grey the stone's face,
lighter raised, darker cut in; opaque) and `-c` the faded paint over it (Egyptian blue `#3F6FA8`,
green `#5E8F6A`, red ochre `#A8482C`, yellow `#D6A23E`, black line; transparent where bare).
1. P1 `stone-h.webp`, 1024 × 1024, a limestone face with chisel marks and fine pitting, seamless.
2. P0 `koi-h.webp`, `koi-c.webp` + `koi-mask.webp` to the common spec: tilapia as tomb reliefs
   carve them, incised scales; gold in yellow ochre, the spot in red ochre.
3. Delivered: `fish`, `lotus`, `frieze`. P1 `papyrus`, 512 × 1024, a papyrus clump; `duck`, 512 ×
   512, a duck in profile.
4. P1 `cartouche`, 512 × 768, an empty cartouche ring, upright, for the solar term. Nothing in it.
5. Press: a chip and dust, in the shader. Nothing wanted.
6. Dove and spider: P1 as sunk relief, `dove-h/-c`, `spider-h/-c`, one pose each, 512 × 512 (the
   dove in the manner of the birds of the marsh scenes).
7. Seal: 刻, on the ink sheet. No hieroglyphic text anywhere, real or invented.

## Languages

The language is chosen apart from the look: the En / 中 / 日 segments
beside 墨 (L steps through them; ⌘K too) turn the pond's words to plain,
natural Chinese, set in the brush, or plain Japanese, and back: the
greeting, the contents, the clock, every chapter and the timeline's
entries. It's remembered (`pond-lang`); a first visit takes the
browser's language. The words are `ZH` and `JA` in `content.ts`;
`L(en, zh)` in `engine.js` picks them (from `ZH`, which points at the
Japanese when 日 is chosen), `tr()` lays an entry's words over its
English, and `speak()` rewrites the page's own words as the language
changes. A new piece of copy needs its Chinese in `ZH` and its Japanese
in `JA` too.

## Looks, gestures and languages

Six looks ([decision 0026](../decisions/0026-looks-and-gestures.md)):
water, ink, ukiyo-e (a woodblock print), glow (the pond at night, lit by
what moves), blueprint (a drawing on blue paper, the koi measured in the
air) and ASCII (the pond in characters).

- **How they're drawn:** each is a function in the water's shader
  (`look()`, brought in by `reveal()`); ASCII's characters are the glass
  pass's (`uAscii`, a strip of glyphs drawn by `atlas()`). `setLook()`
  runs the front for any of them. Ice and snow are drawn in each look's
  own idiom (`gIce`, `gHit`, `snowOn()`), and cracking the ice works in
  all of them.
- **Finding them** (`gest` in `engine.js`), each with a cue while it
  builds (`drawGesture()`):
  - ink: hold still on the water for 1.2 s (I and 墨 still work);
  - ukiyo-e: stir the water once round;
  - glow: press the light on the water (the moon's, or the sun's glint
    by day);
  - blueprint: draw a long straight line;
  - ASCII: type five letters that aren't shortcuts within 3 s (each
    lands on the water at the pointer), or "ascii" or "text" in ⌘K on a
    phone.

  In a look, a press on the gold koi (mine) brings the water back, from
  the koi, before whatever lies over it. ⌘K finds the looks when
  searched, and never lists them.
- **Weather:** rain falls only where the look can carry it (`RAINY`,
  `drawRain()`):
  - in ink as fine dry strokes;
  - in ukiyo-e as Hiroshige's straight lines;
  - in ASCII as falling `|` and `/`.

  Glow and blueprint hold it off, and the ⌘K rain command is hidden in a
  look. In ukiyo-e the swell's bands and foam follow only large crests,
  so the rain's rings never cut them up.
- **Sound:** each look has its own sounds (`lookSound()`):
  - ink: brush and paper;
  - ukiyo-e: wood and koto;
  - glow: a soft shimmer;
  - blueprint: pencil and a ruler's click;
  - ASCII: keys.

  They play for a press, the ice cracking, a gesture's cue and the look
  coming in. All are about one loudness, behind the one sound switch.
- **Languages:** En / 中 / 日, apart from the look. The words are `ZH` and
  `JA` in `content.ts`, shaped alike. Japanese is set in Yuji Syuku and
  Shippori Mincho, with M PLUS 1 Code in ASCII and Klee One in blueprint
  (`kana.css`, written by `kana.test.ts`).
- **Type:** each look has its own Latin (`--latin-d` and `--latin-b` on
  `#pond[data-look]`), and each language its CJK (`--cjk-d`, `--cjk-b`).
  `--display` and `--body` are built from both.
- **What loads when:** a first visit loads only the water's type
  (Cormorant and the brush). The looks' faces and the Japanese
  (`looks.css`: `kana.css` and the @fontsource faces) are linked the
  first time a look other than ink, or 日, is chosen (`loadType()`). Even
  then, a face's file loads only when its characters show.

## The weather where the visitor is

Once the pond has settled, so it never holds up the title page, `weather.ts` finds the visitor's place
from their IP (`api/geo.ts`, as the desktop does; San Jose when they can't be found) and asks
Open-Meteo for the current weather, the wind, and the day's sunrise and sunset. It does so once a visit,
then every half hour while the tab shows, and keeps the answer in this browser for half an hour, so a
reload doesn't fetch again.

What the conditions do (`effectsOf()`):

| Condition | On the pond |
| --- | --- |
| Drizzle, rain, storm | Rain, drizzle lightest and a storm hardest. A storm also brings, over the water only, now and then a far flash and its thunder. |
| Snow | Snowfall. |
| Fog | A soft haze over the water; in ink, a thicker mist. |
| Cloudy, overcast | Less light, and a dimmer glint and moon. |
| Clear | The sun's glint by day and the moon by night, as before. |

- The looks follow their own rain rules.
- The time of day follows the place's own sun (`phaseAt()`).
- South of the equator the season the pond shows is half a year on (`seasonOf()`). The solar term's
  name stays the calendar's.
- A visitor's own ⌘K rain wins until they reload.
- ⌘K says the weather where they are.
- If anything fails there is no weather, and nothing is said.

**Privacy:** the place goes only to Open-Meteo, to ask for its weather, and is kept only in this
browser's half-hour cache (`pond-weather`). Nothing about it is stored or sent anywhere else.

## Next, with `?preview`

`?preview` in the address (or a build with `PUBLIC_POND_PREVIEW=1`, as the single-file demo is) turns
on details being tried before they ship (`preview.js`). Without it, none of them does anything.

- **The moon:** the moon shows its real phase (`moonAge()`, from a known new moon). It also shows in
  each look at night, drawn in that look's idiom.
- **Wind:** the wind from the same Open-Meteo answer drifts the petals, leaves, snow and the rain's
  slant.
- **Festivals:** dated from a small table for 2026 to 2030 (`festivalOn()`):
  - Spring Festival: a few red lanterns;
  - Qingming: softer light, and drizzle if the sky allows;
  - Dragon Boat: a dragon boat far off now and then;
  - Mid-Autumn: a full, brighter moon and river lanterns.
- **Fireflies:** a few on summer nights. A press sends them off.
- **Stars:** sparse stars on clear nights, shaken by the ripples.
- **Welcome back:** a returning visitor (`pond-visits`) is welcomed back, and my koi comes over to
  theirs once.
- **Ambience:** under the sound switch, very quiet: cicadas on summer days, crickets on summer and
  autumn nights, rain on the water. Each is a short loop made in code.
- **The panel:** a small panel at the top forces each of these, with the time of day, the weather and
  the look.

## Changing it

- **Wording, a job, a school, a project's highlights:** `content.ts`; a
  project's title, description, dates, stack and links come from its page
  in `src/content/projects`. A new mark goes in `public/pond/marks/`
  (72×72 PNG); `content.test.ts` checks every entry has one.
- **Something on the water:** its section in `engine.js`. Check it in a
  browser with motion on and off, on a phone width, and in winter and
  summer (⌘K → Winter, Summer).
- **A chapter:** `SHEETS` and `CHAPTERS` in `engine.js`; add it to
  `scripts/smoke.mjs`'s list of the pond's chapters too.
- `npm run test:smoke` opens the pond and every chapter; `astro dev` has a
  stand-in backend that works across tabs, for trying accounts, notes,
  chat and presence.
