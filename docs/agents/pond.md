# The pond

The pond is the site's home page, at `/`; the desktop it replaced is at
`/os` ([decision 0025](../decisions/0025-the-pond.md)). It's a full-bleed
pond seen from above: a title page set on the water (a greeting, the
contents), and chapters (Seals, Music, Notes, Chat)
that open as one tall sheet of glass. Everyone who visits is a koi.

## Where things are

| File | What it holds |
| --- | --- |
| `src/pages/index.astro` | The markup. It hands the pond's words (`src/pond/content.ts`) to the script as JSON (`#pond-data`) and keeps a few plain sentences on what the page is for screen readers and visitors without JavaScript. |
| `src/pond/engine.js` | Everything that moves: the water (a height field stepped on the CPU), the koi, lily pads, the 24 solar terms and the time of day, ice that cracks and breaks, boats, the dove's and spider's behaviour, the WebGL passes (the pond into a texture, then the glass over it), the chapters, the key shortcuts, the sound effects, the opening. Its sections are marked `/* ===== … ===== */`. |
| `src/pond/sprites.js` | The dove and the spider as rendered sprite sheets: which frame a moment calls for (`doveFrame()`, `spiderFrame()`), and how each look dresses the sheets (`dressed()`). `sprites.test.ts` holds the frames to the sheets' grids. |
| `src/pond/music.ts` | The music: Ryuichi Sakamoto only, the songs `POND_MUSIC` in `content.ts` chooses first and the rest of his in the library the iPod plays (`/api/songs`, or `src/data/songs.json`), played with YouTube's player in a frame clipped to nothing. |
| `src/pond/people.ts` | Accounts, presence, the guestbook's notes and the chat, through `src/os/social` (the same backend and rules as the desktop). |
| `src/pond/content.ts` | The pond's wording: the page's and the chapters' words in Chinese and Japanese, and what the pond plays. |
| `src/pond/pond.css` | The styles. |

`engine.js` is plain JavaScript, ported from the
prototype the design was made on (the decision has why); the parts that
reach the rest of the site are TypeScript. A file's header says what it's
for; keep it true when the file changes.

## Rules

- **No water where WebGL is drawn in software.** With no WebGL 2, or one a GPU draws in software
  (SwiftShader, llvmpipe: blocked graphics, a headless browser), the pond is still water with its koi
  and pads drawn straight on the page (`.nogl`, `softGL()` in `engine.js`): software takes seconds over
  each frame of the water and the page stops answering. `?gl` (and `?perf`, `?preview`) keep the water
  regardless: the tools in `tools/pond/` and `scripts/capture-previews.mjs` ask for it.
- **The glass is drawn with the water.** A `.glass` element's place and
  opacity are read every frame (`panes()`), and the glass pass draws a
  rounded pane there that blurs and bends what's under it. A new pane is
  a `.glass` element in the markup when the script starts (the list is
  read once); `data-r` is its corner radius.
- **The title page reads because the pond is calmer under it.** On a
  wide window the left of the pond is deeper and out of focus (`uCalm`
  in the water's shader); on a phone, from the top down to a little past the
  contents' foot, so the water below is clear. Type stays on that side.
- **A title breaks between words.** In Chinese the title is set word by word (`setHero()`,
  `Intl.Segmenter`), its punctuation kept on the word before; in Japanese the browser breaks it between
  phrases (`word-break: auto-phrase`). Never inside a word, as 你找到这 / 儿了 did.
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
  (`settled` in `engine.js`), as do the songs; the dove's and the spider's sprite sheets and the
  water's own pictures are fetched when each is first to be drawn.
- **The loop's pace** (`clock.js`, `invalidate()` in `engine.js`):
  - At most 60 frames a second while something happens, and 30 once nothing has for six seconds (no
    input, the water settled, no look coming in, no rain). The koi always swim, so quiet is never
    still: at 10 they stepped visibly.
  - Frames fall on the display's own beats, every nth (`due()`), so they come evenly; a timer that
    waited and then caught the next beat made the koi judder.
  - None while the tab is hidden. Under reduced motion the koi still swim, at the quiet pace.
  - The quiet pace too while the window is in the background, the battery is low and not charging, or
    a chapter is open (there only what was just touched keeps 60). A look coming in, and
    a finger held down, are always drawn at 60.
  - The ripples step on time, 120 steps a second (scaled by ink's slow time), so they run at the same
    speed at 60 and 120 Hz.
  - A frame touches the page only when what it shows changes: the panes are read only while something
    there moves, and tags, the knob and the gauge are written only on change. Twice a second one
    control's place is looked at, since a phone's browser can move the controls with no event (its
    bars hiding, an in-app browser's safe area): if it isn't where the glass was drawn, the panes are
    read again, and the water refitted if the pond's size changed.
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
- **Addresses:** a chapter is `#<chapter>` (`#seals`, `#music`, `#notes`,
  `#chat`).

## Ink and paper

The 墨 switch (bottom right, there once ink is found; I) turns the pond into
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
gesture, key or command, its seal is stamped in the corner above the controls, in the look's own manner
(`#pond[data-look] .stamp` in `pond.css`), with a soft thud; under reduced motion it only appears.
In the album a seal not yet found is printed faintly in its empty place, as a stamp album prints the
stamp it waits for (`sealBlank()`): its cut once the sheet has come, else its characters.

- **Five volumes.** Two hold the looks, five each. The third, `hours`, holds five seals for an
  occasion and not a look (the rain, snow, the full moon, a festival, the dawn): `occasions()` in
  `engine.js` stamps one when the pond is in that state while someone is there. Nobody can call the
  weather, so this volume is marked `extra` like the idle seals: the album is full without it.
- **The end.** The fourth volume holds one seal, for the pond as a rubbing taken from the carved
  stone. It has no gesture: once the two volumes of looks are full, their seals pressed in the album
  in the order it keeps them (`WAY` and `walked()` in `seals.ts`; the click handler by `let way` in
  `engine.js`) bring in the relief with `data-rub` on `#pond`, which turns every layer of it to ink
  and paper under a dabbed pad's mottle (`#pond[data-rub]` in `newlooks.css`). It is the relief with
  a filter over it, not a look of its own, and it lasts until the look changes.
- **The long scroll.** Once the end is reached the album offers "Unroll the scroll": every seal
  found, in the order found, read from the right as a handscroll is, with the rubbing's seal and a
  word of thanks at its far end (`scrollPicture()` in `engine.js`, `.scroll-view` in `pond.css`).
  "Save as a picture" saves the scroll while it is unrolled.
- **Idle seals and the small games.** A fifth volume, `idle`, is marked `extra`: the album is full
  without it. Its first seal is for skipping stones: a short straight stroke let go fast (70 to 320
  px in under 0.4 s, over 1000 px/s: `flicked()` and `skipStone()` in `engine.js`) throws a stone
  that skips the way it was going, each skip a ring on the water; the faster, the more skips, and
  five earn the seal. A flick is not kept to count with the next stroke, so it is never part of a
  rub.
  Two more: **the leap** (food thrown in one place four times running gathers the koi; once three
  have come the largest leaps, drawn larger as it rises, and falls back with a splash: `gather` and
  `leapNow()` in `engine.js`), and **the catch** (a press on a lily pad while the spider is about
  calls a bug down on to it, and the spider watches, crouches and jumps: `dropBug(pad, true)`; the
  seal is for a bug the visitor called). Pads under a control do not take a press.
  And **the race**, at Dragon Boat only: a press on the water beside the boat crossing far off is a
  stroke of the paddles (`paddle()`), each sending it on a second and a half; ten before it is
  across (`ROW`) and it is drummed in at the far bank, with the seal. With `?perf`,
  `window.__pond` has the koi's places, the pads and the bugs, for a tool to play them.
- **A chain of clues.** A look on show carries a small mark that points to the next look's gesture
  (`NEXT` and `clueFor()` in `seals.ts`, `CLUES` and `clueNow()` in `engine.js`, `.clue` in
  `pond.css`), laid in a few seconds after the look has come, until that next seal is found.
- **No search.** The pond has no search field and no command bar: a look is found on the water, by
  its gesture, and nothing lists or names one. What isn't a gesture has its own control (the sound,
  the languages, the chat's pill, the contents) or a key (1 to 4 for the chapters, I, L, G, F, M,
  Escape).
- **The album as a picture.** "Save as a picture" under the leaves draws the album on a canvas
  (`albumPicture()`) and saves it as a PNG.
- The album is the first chapter in the contents (`#seals`), there from the first visit;
  its row says how many seals are found of how many there are (`#sealsN`, written by `sealsEntry()`).
  Inside, a leaf of paper for each volume (册), found seals in vermilion with the day, the rest an
  outline and a hint that points at the gesture without saying it.
- A full volume carries the large 锦程 seal and a line of thanks. The first volume full, the visitor's
  koi wears a small seal; every volume full, the gold koi does too.
- "Clear my seals" is a small button at the foot of the album, beside "Save as a picture", once a seal
  is found (`#albumClear`). It asks once, in place: its words turn to a question, and only a second
  press within a few seconds clears (`clearSeals()`); left alone it reads as before.
- Someone who has found no look is shown one line on the water, once: 20 s after the pond settles, or a
  moment after their first press, with the gold koi coming over. Never over a chapter or the title's
  type.
- Everything is kept in `localStorage` (`pond-seals`) and nowhere else. Nothing runs in the frame: the
  stamp is a CSS animation, the line a timer.
- A new look adds its seal to a volume in `VOLUMES` (characters the brush face has), its name and hint
  in each language, and its stamp's manner in `pond.css`. Looks marked `preview` exist only in a build
  with `PUBLIC_POND_PREVIEW=1`.

## The five later looks

The state of this work, what is left and what was learnt along the way is in
[pond-handoff.md](pond-handoff.md).

Five looks came after the first six (`newlooks.js`, `newlooks.css`): Monet's water lilies in oil,
blue-and-white porcelain (青花), a Dunhuang mural (敦煌), a star chart (星图) and an Egyptian relief
(carved and painted limestone; it took the place of a school blackboard, which was turned down). They
ship like the others: found by their gestures, each with its seal, each drawn from
its own pictures, which are fetched only when the look is first asked for. The water look has its own
pictures too (its lily pads, drift and dragonfly), fetched once the pond has settled and there is
something of theirs to draw.

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
| `lotus.webp` | 1024 × 512, 68 KB | Eight motifs in a 4 × 2 grid of 256-pixel cells, from above, at one scale, each at least 14 pixels clear of its cell's edge, flat colour in an iron-brown line. Top row: three leaves in malachite green, large (226 pixels across), medium with a notch (189) and small with a notch (141), then a flower of white and cinnabar rings round a yellow heart. Bottom row: a flower with the cinnabar outermost, a white one, a bud as a white disc with three cinnabar tips, a seed-pod in ochre with eight seeds. The fills carry a faint cloudiness, no plaster. |
| `dove.webp`, `spider.webp` | 768 × 256, 17 KB and 32 KB | Three poses each in 256-pixel cells, from above, facing right, at one scale. The dove as a white bird of the murals, green and cinnabar on its wings and tail: sitting (114 × 50), wings half open (113 × 135), flying (115 × 234). The spider in ochre and dark brown, a cloud scroll on its abdomen: sitting (153 × 85), walking (175 × 155), jumping (213 × 234). The spider's front legs are drawn long, and the dove is more ornament than bird. |
| `afloat.webp` | 1024 × 512, 94 KB | What drifts on the water through the year, in a 4 × 2 grid of 256-pixel cells, from above, each fitted to its cell (not at one scale) with 16 pixels clear. Top row: two spring petals, two autumn leaves. Bottom row: a snow crystal, a frost flower, two flying things, heads to the right. Here: two lotus petals in white tipped with cinnabar, a ginkgo leaf in ochre, a green vine leaf as a scroll; the crystal and a frost star in white; a crane flying, and a butterfly in blue, cinnabar and ochre, which is drawn from the side with its wings together. |

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
right edge. On an upright phone the contents reach down to the controls, so she lies under them and is
drawn worn nearly away (`WORN` in `newlooks.js`, as is the relief's fish there), so the words read. Faces are kept from flaking by
position (`faces` in `muralLayout()`): if a picture is redrawn with the head elsewhere, say where. The
ochre (`#CC8F38`) is read as gold leaf and made to glint, so anything meant as gold should keep that
colour and anything not meant as gold should avoid it. The loose flowers are fixed on the wall, not
adrift: riding the petals' wind would need them as sprites on the top layer, which is a later step.

Since then: the halo sits behind the pipa player's head on a wide wall (it reads from about a 1280
window up; its ochre rim glints as gold). Nothing painted lies under the controls: on a wide wall the
lower figure, the cloud under her and the falling lotus end `MURAL_FOOT` above the wall's foot, and on
a narrow one the figure's paint ends `MURAL_FOOT_NARROW` above it (`newlooks.test.ts` holds both). The
koi are the mural fish of `KOI_SHEETS.dunhuang`, laid in under the wall's wear as they are, a koi's own
colour snapped to the wall's cinnabar, blue, green or ochre. The larger pipa player is asked for only
where she is drawn wider than the first one's 1536 pixels; while the picture texture is at most 2048
across and she takes half the wall, that is nowhere, so the file is never fetched today. The caisson
has no place yet.

#### Monet

In `public/pond/monet/`, and the look is built on them: the painted water is the bed (`paintBed()` in
`engine.js` lays the upright one on a phone, the small one on a small window, the large one where the
pond is drawn large, into the one texture a look's picture lies in, `uMural`), the water over it bends
it a little and catches a sheen (`lookMonet()`), the pads and their flowers are drawn from `lilies`
(`drawPads()`: a bud in spring, half open then open in summer, none in winter), and the koi from
`koi` along their own spines (`Koi.drawSprite()`). Nothing is synthesised a stroke at a time any more.
Not used yet: `strokes` and `canvas` (the press is a soft dab drawn in the shader, and the arrival's
front is the shader's; both could take the stamps later).

The koi are the sheet to the common spec, `koi-v2.webp` with `koi-mask.webp` (`KOI_SHEETS.monet`): the
gold one is mine, the white one with the red dab the visitor's, and the two grey ones take a colour in
their dabs through the mask, a visitor's own or the pond's koi's own.

| File | Size | What is in it |
| --- | --- | --- |
| `strokes.webp` | 1024 × 1024, 162 KB | Sixteen brush strokes in a 4 × 4 grid of 256-pixel cells, each at least 18 pixels clear of its cell's edge, lying left to right with the loaded end at the left. Greyscale is the paint's height (white thickest), alpha its cover, broken at the dragged tail. Rows: long drags (about 220 pixels), curved medium strokes (150), short dabs (90), clusters. The height is how the image model lit thick paint, not a measured surface. In the last row the second and fourth clusters came out as small modelled water lilies, not loose dabs: use the first and third as dabs. |
| `canvas.webp` | 512 × 512, 54 KB | A plain linen weave, greyscale, opaque, even in tone, about 43 threads across. It was cut on whole threads and tiles on all four sides; over a large flat area a very faint line can still be made out where tiles meet. |
| `bed.webp` | 2560 × 1440, 380 KB | The water alone, in oil: blue-violet passages, green-gold willow reflections running down the right two thirds, pale lilac and rose where the sky shows, mostly at the right. No pads or flowers. The left third is darker and plainer (it averages `#446080`; the rest `#6C8592`). Opaque to every edge. Painted at 1664 × 936, the largest the image model gives, and enlarged; the brushwork is finer and more even than late Monet's, and the pale swirls of sky are much alike. |
| `bed-1280.webp` | 1280 × 720, 93 KB | The same picture, for a phone held sideways or a small window. |
| `bed-tall.webp` | 1080 × 1920, 95 KB | The same pond painted again upright, not a crop: the dark, plain passage across the top third (it averages `#3F6383`; the rest `#648699`), willow reflections and pale sky below. Quieter and softer than the wide one. |
| `lilies.webp` | 1024 × 768, 137 KB | Twelve motifs in a 4 × 3 grid of 256-pixel cells, each at least 22 pixels clear of its cell's edge, no outline or shadow, soft bristle edges in the alpha. Row 1: three large pads (olive, grey-green with a notch, one catching the light) and a medium olive pad with a notch. Row 2: a medium grey-green pad, a small olive pad, a small light pad, an open white blossom. Row 3: a half-open white blossom, an open pink, a half-open pink, a bud. The large pads are about 210 pixels across, the medium 170, the small 120. |
| `koi-v2.webp` | 1024 × 1536, 173 KB | The koi again, to the common spec: four rows of 384 pixels, heads to the left, each from x 62 (the barbels) to a tail tip at 962, the spine on its row's middle line (y 192, 576, 960, 1344), within 3 pixels (it is not mirrored, so the fins keep a small natural unevenness). The same fish in the same dabs four times: gold; white with one red dab on the head; two in greys with four darker dabs each, laid differently. The body is slimmer than in `koi.webp`. Smooth alpha (256 levels). In use; the three-koi sheet it replaced is gone. |
| `koi-mask.webp` | 1024 × 1536, 17 KB | White over the grey dabs of rows 3 and 4 of `koi-v2.webp` (about 30% of each fish), soft by 2 pixels, black elsewhere. |
| `lilies-autumn.webp` | 1024 × 256, 41 KB | The autumn row for `lilies.webp`: four pads in 256-pixel cells in the same oil dabs and at its large pads' size (about 205 pixels across), gone ochre, rust and a grey violet, with ragged edges: one with a notch to the right, one whole, one with a hole, one with a notch below. No line, no flowers. |
| `dragonfly.webp` | 512 × 256, 21 KB | Two dragonflies in 256-pixel cells, from above, head to the right, each a blue-green body stroke and four pale lilac wing dabs (140 × 228). The two differ little, and the wings are broad for a dragonfly's. |
| `dove.webp`, `spider.webp` | 768 × 256, 16 KB and 46 KB | Three poses each in 256-pixel cells, from above, facing right, at one scale. The dove in white with lilac and cream: sitting (113 × 54), wings half open (113 × 146), flying (116 × 234). The spider in umber with a touch of orange: sitting (185 × 127), walking (215 × 178), jumping (229 × 234). Both are painted more finely than a few dabs: closer to a small oil study than to the panel's own handling. |
| `afloat.webp` | 1024 × 512, 100 KB | What drifts on the water through the year, in a 4 × 2 grid of 256-pixel cells, from above, each fitted to its cell (not at one scale) with 16 pixels clear. Top row: two spring petals, two autumn leaves. Bottom row: a snow crystal, a frost flower, two flying things, heads to the right. Here: a pink petal and a white one, a willow leaf in ochre, a poplar leaf in rust; the crystal and the frost flower in white and lilac; a dragonfly and a white butterfly. Painted more finely than a few dabs. |

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
| `lotus.webp` | 1024 × 512, 96 KB | Eight motifs in a 4 × 2 grid of 256-pixel cells, from above, cobalt only, at one scale, each at least 14 pixels clear of its cell's edge. Top row: a large leaf with a notch (228 pixels across), a small one (134), a large one turned and folded at its notch, an open flower. Bottom row: a second flower, a bud, a seed-pod, a spray of water-weed (faint, and seen from the side). The wash is partly transparent, so the glaze shows through the leaves. |
| `medallion.webp` | 1024 × 1024, 172 KB | A double ring (944 pixels across, at 40, 45) and in it two koi circling head to tail, three lotus flowers, two leaves and sprays of water-weed, in cobalt line and wash on a transparent ground. The koi are drawn with patches and scales in full, so it is busy at full strength: it is meant large and pale. Its alpha is stored coarsely to keep it under the budget. |
| `dove.webp`, `spider.webp` | 768 × 256, 20 KB and 47 KB | Three poses each in 256-pixel cells, from above, facing right, at one scale, in cobalt line and wash. The dove: sitting (101 × 50), wings half open (100 × 129), flying (100 × 234); its feathers are drawn densely. The spider, banded: sitting (141 × 111), walking (171 × 153), jumping (200 × 234); the walking one shows six legs clearly, not eight. |
| `afloat.webp` | 1024 × 512, 130 KB | What drifts on the water through the year, in cobalt only, in a 4 × 2 grid of 256-pixel cells, from above, each fitted to its cell (not at one scale) with 16 pixels clear. Top row: two spring petals, two autumn leaves. Bottom row: a snow crystal, a frost flower, two flying things, heads to the right. Here: a plum petal and a peach petal, a maple leaf, a bamboo leaf; the crystal and a frost flower as fern-like needles (a little haze round them); a dragonfly, and a butterfly drawn from the side with its wings together. |

#### Ukiyo-e

In `public/pond/ukiyo/`, and in use in every build, as every look's own pictures are but the water's
(`pictured()` in `engine.js`); they are fetched when the look is first asked for, or half way round the
stir that brings it, never on the first screen.

- **The arrival is a wave out of the corner.** The front runs from the top left; on it stand the four
  great crests, already a wave as it leaves the corner and at full height (28% of the window, no
  taller than they were cut) by 300 pixels in; behind it foam thins out and a row of the low wavelets
  follows. The line of light a front otherwise has is all but off. A preview build fetches the
  crests' sheet once the pond has settled; a release build half way round the stir. A press is ringed by six wavelets, base
  to the middle, sinking as the splash dies, in place of the shader's claws.
- **The water** is the painted bed (`bed`, or `bed-tall` on a phone) in the top half of the look's
  texture, the crests' sheet in the bottom half (`paintWaves()`); the shader bends the bed a little
  where the water moves and keeps the moving foam. Until the pictures have come the shader's own
  water, front and claws stand.
- **The koi:** `KOI_SHEETS.ukiyo`. The shader lays a painted koi in as it is (`uSprite`), without the
  posterising and the key line it gives the pond's own koi, since the sheet carries its own.

| File | Size | What is in it |
| --- | --- | --- |
| `waves.webp` | 1024 × 512, 68 KB | Eight wave crests in a 4 × 2 grid of 256-pixel cells, all breaking to the left: four large ones with claw foam and spray dots in the top row, four low wavelets in the bottom. Exactly four colours: `#1F4A7A`, `#8FB4C8`, `#F6EDD8` and a keyline `#0C1B27`. The four large crests are much alike in outline. |
| `koi.webp` | 1024 × 1536, 177 KB | The koi sheet to the common spec, as a carp print: a black key line, bold scale arcs, flat colour. Four rows of 384 pixels, each from x 62 (the barbels) to a tail tip at 962, the spine on its row's middle line (y 192, 576, 960, 1344); one drawing, its upper half mirrored onto the lower, so the spine is exact. Row 1 ochre `#E9B44C` with paper-white fins; row 2 paper white with one vermilion spot on the head; row 3 in greys with three grey patches, row 4 with four. The patches are irregular and not the same either side of the spine. The line is cleaner and more even than a cut block's. |
| `koi-mask.webp` | 1024 × 1536, 11 KB | White over the patches of rows 3 and 4 (about 14% of each fish), soft by 2 to 3 pixels, black elsewhere. |
| `bed.webp` | 2048 × 1152, 78 KB | The water alone, opaque to every edge: Prussian blue in flat tones, long swells in a dark key line that curl at their right ends, lighter bands between the lines. The left third is one dark blue with two thin lines across it; the water lightens to the right and most of all at the lower right. No foam, nothing in it. Painted at 1672 × 941 and enlarged, so the line is a little soft at full size; the tones are graded more smoothly than a block prints them. |
| `bed-tall.webp` | 1080 × 1920, 63 KB | The same water painted again upright, not a crop: the top third dark with two thin lines, the swells below it running across, dark at the top to light at the bottom. Painted at 941 × 1672 and enlarged. |
| `paper.webp` | 512 × 512, 12 KB | Washi grain, greyscale, opaque, light (mean 225 of 255, a spread of about 5), with fine pale fibres; it tiles on all four sides (the edges are crossfaded into each other, and the slow drift of tone is taken out). The grain is fine: meant to be multiplied in at its own size or larger. |
| `lilies.webp` | 1024 × 512, 84 KB | Eight motifs in a 4 × 2 grid of 256-pixel cells, from above, at one scale, flat colour in a key line with a little paper grain in the fills. Top row: three lotus leaves with a notch (225, 179 and 140 pixels across), an open pink lotus. Bottom row: an open white lotus, a red maple leaf, an orange one, three cherry petals together in one cell. Each is at least 14 pixels clear of its cell's edge. |
| `afloat.webp` | 1024 × 512, 110 KB | What drifts on the water through the year, as a print draws it, in a 4 × 2 grid of 256-pixel cells, from above, each fitted to its cell (not at one scale) with 16 pixels clear. Top row: two spring petals, two autumn leaves. Bottom row: a snow crystal, a frost flower, two flying things, heads to the right. Here: two cherry petals, a red maple leaf, a yellow ginkgo leaf; the crystal and a frost flower in white with a blue-grey line; a red dragonfly, and a red and yellow butterfly drawn from the side with its wings together. |

#### Star chart

In `public/pond/stars/`, and in use. One colour, `#C9D4F0`, its strength in the alpha.

- **The grid** is the sky's engraved grid: `grid.webp` tiles on all four sides, so it is the look's
  picture texture as it is, repeated (`paintPlate()`, with smaller copies); `lookStars()` lays a tile
  over 520 pixels of the pond and rules it in faintly after the first stars are out, turning with
  them. The framed plate it replaced (meridians drawing together, an equator and an ecliptic) could
  not repeat and is gone.
- **The figures:** the straight koi (`STARS.figure`) is kept as one row to the koi sheets' measure and
  bent along each constellation's spine by `Koi.drawSprite()`, faint, behind its stars. The koi in an S
  is not used: the spine does the bending.

| File | Size | What is in it |
| --- | --- | --- |
| `koi-figures.webp` | 1024 × 512, 31 KB | Two koi from above in outline, heads to the left, in two 512-pixel cells: one straight (46, 184, 424, 163), one in a shallow S (in its own cell: 40, 185, 435, 167). A few scale arcs and fin rays, no fill. Plainer than an atlas figure. |
| `grid.webp` | 1024 × 1024, 51 KB | A grid that tiles on all four sides, made in code: eight meridians and eight parallels to a tile, each gently bowed (so it reads as a chart, not graph paper) and a little uneven in strength, every fourth one heavier and ticked. No frame, equator or ecliptic. Meridians that draw together, as on the plate, can't tile, so these stay evenly spaced: it is a quieter thing than the plate. |
| `nebulae.webp` | 1024 × 512, 151 KB | Eight motifs in a 4 × 2 grid of 256-pixel cells, each fitted to its cell with 14 pixels clear, in the one pale line (`#C9D4F0`, the tone carried by the alpha). Top row: a ringed planet, hatched; a nebula as stippling, dense at its middle; a cluster of dots with three six-pointed stars; an armillary sphere of five rings. Bottom row: a comet, its head at the lower left; a spiral nebula in dotted arms; a wreath of sixteen six-pointed stars round an empty middle (made in code); a crescent moon, hatched, open to the right. They are bolder and plainer than an atlas's engraving, so that they read small. |
| `dove.webp`, `spider.webp` | 512 × 512, 40 KB and 78 KB | One pose each, from above, facing right, in the same pale line: the dove with wings spread (315 × 468 at 98, 22), six stars on it joined by straight lines; the spider with legs spread (457 × 468 at 27, 22), its segments and hair drawn, five small stars on it. The dove's line is thin and its hatching sparse; the spider reads as a specimen plate more than a constellation figure. |

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
| `stems.webp` | 42 KB | Withered lotus (残荷), 1024 × 1024 like the others and stored the same way (near-black, the tone in the alpha): three dry stems entering from the right edge and folding over, a seed-pod hanging at 538, 236 and a curled dead leaf below it; the paint is 538, 236, 486, 587, and the left half is empty. Sparse, as asked; the stems are thin, so it may want more strength than the reeds when multiplied in. |
| `seals.webp` | 94 KB | 1024 × 768, cells of 256, 4 × 3, vermilion `#B8382A` with the tone in the alpha. Row 1: 墨 (square, white characters out of red), 浮世 (tall, red characters and border), 莲 (round, white), 青花 (tall, white). Row 2: 敦煌 (tall, red), 光 (round, red), 图 (square, white), 字 (square, red). Row 3: 星 (round, white), 刻 (square, white), 锦程 (tall, white, 锦 over 程), one cell empty. Square and round seals are 232 across, centred; tall ones 150 × 246. Small seal script from the Shuowen Jiezi face of Taiwan's CNS 11643 character set (an open-data font, not in the repository), cut as a seal carver writes them: 蓮, 圖 and 錦 in their full forms, 花 as 華 (the Shuowen has no 花), and 星 as three suns over 生. The edges, chips and pinholes are made in code, so every stone is worn alike; the characters are a dictionary's even line, not a carver's hand. |
| `dove.webp`, `spider.webp` | 16 KB and 27 KB | 768 × 256 each, three poses in 256-pixel cells, from above, facing right, at one scale, stored as the others are. The dove left as bare paper inside a few dark strokes at wing tips and tail: sitting (115 × 54), wings half open (117 × 134), flying (117 × 234). The spider in wet grey and black: sitting (193 × 94), walking (189 × 144), jumping (234 × 170). The dove's body has no tone of its own, so on the paper only its edges and tips show. |


#### Egyptian relief

In `public/pond/relief/`, each picture as a pair that lines up to the pixel: `-c.webp` the paint,
`-h.webp` the height. All three pairs are in use.

- **How the look is drawn** (`lookRelief()` in `newlooks.js`): one height for the whole wall, in pixels
  above the stone's face, and one light on it. What is in the pond stands proud: the koi and the pads
  from their own canvases, with a soft shoulder; the tomb's carvings from the pictures. The water is the
  sign for water, rows of zigzag cut into the face, sliding a little and shaken where the pond moves;
  there is none under the type nor in the plain band under the frieze, where the clock stands. The
  surface's slope comes from the pass's own derivatives, so the height is read once a pixel.
- **The light** follows the visitor's day (`uDay`, 0 to 1): low from the left in the morning, higher
  and from above at noon, low from the right towards evening; by night a lamp held low at one side,
  warmer and dimmer. What stands proud throws a short shadow away from it.
- **The pictures in the texture** (`paintRelief()` in `engine.js`): the paint of each carving in the top
  half of the look's one texture and its height in the bottom half, at the same places, where nothing
  is carved the stone's face (mid grey). `reliefLayout()` places them: the frieze along the top and the
  foot; on a wide wall a marsh in the right half (papyrus, duck, lotus, bud, leaf) over two tilapia;
  on a narrow one a single tilapia under the contents. Nothing but the frieze lies under the controls
  (`newlooks.test.ts`). A carving is drawn only when both halves of its pair have come.
- **The rest:** a press is a chisel's strike (a chip of bare stone and its dust); the look arrives as
  sand blown off in streaks; winter is frost; the gesture is a zigzag of three peaks or more, read when
  the finger lifts (`zigzag()` in `gestures.ts`: five sharp corners, so a wavy line is not one); the
  seal is 刻; the sounds are a chisel's knock and running sand. No inscription anywhere.
- **The koi** are the carved sheet, in its bolder cut (`KOI_SHEETS.relief`). The fish's canvas holds one picture, so
  `carved()` in `engine.js` makes one of the pair: the koi's whole shape from the height, the paint over
  a colour that stands for bare stone. The shader shows stone where a koi is bare, cuts the sheet's
  dark line into the surface, and raises the whole fish with a soft shoulder; a visitor's colour goes
  into the grey patches through the mask, the pond's own koi take red ochre, blue, green or yellow.
  Until the sheet has come the pond's own koi are raised and painted by the shader.
- **The stone's face** (`stone-h`) is tiled under the carvings in the height's half of the texture, at
  a third of its depth (at full depth a low light turns it to grit), each carving's height laid over it
  in hard light, so the dressed stone runs up to a carving's edge.
- **Still drawn without a picture:** the dove and the spider (the neutral sheets, in stone's tone
  inside a dark line).

| Pair | Size | What is in it (each motif within its cell, as left, top, right, bottom) |
| --- | --- | --- |
| `fish-c.webp`, `fish-h.webp` | 1024 × 512, 83 KB and 35 KB | Two tilapia in profile, heads to the left, in two 512-pixel cells: blue head and back, green flank, a yellow belly line, red ochre fins. The straight one: 36, 136, 476, 376. The other: 36, 138, 476, 373; it is only slightly curved. |
| `frieze-c.webp`, `frieze-h.webp` | 1024 × 128, 34 KB and 3 KB | An open blue lotus and a bud on a red base line, a stem looping from one to the other, four times in a tile, seamless left to right in both files. The flowers reach to 4 pixels from the top; the base line is at the bottom. |
| `lotus-c.webp`, `lotus-h.webp` | 1024 × 512, 98 KB and 33 KB | Eight motifs in a 4 × 2 grid of 256-pixel cells, each at least 18 pixels clear of its cell's edge. Top row: two open lotus flowers, a blue bud, a green bud. Bottom row: two leaves from above, with a notch and veins, a papyrus clump, a duck facing left (18, 70, 238, 185). |
| `stone-h.webp` | 1024 × 1024, 167 KB | The height of a dressed limestone face, made in code, not by the image model: short parallel chisel strokes in drifting directions, fine pores, a few deeper pocks and hairline flaws. It averages 128 and stays low (nearly all within 10 of it; the deepest pock is 108, nothing is above 133), so the carvings stand well clear. It tiles on all four sides; the dressing is even all over, with no large feature to repeat. |
| `koi-c-bold.webp`, `koi-h-bold.webp`, `koi-mask-bold.webp` | 1024 × 1536, 177 KB, 88 KB and 14 KB | The koi sheet cut bolder, for the size a koi is drawn at: the same fish, outline and places; about 16 scales along the body where there were 30, and 3 across where there were 6, their lines 6 pixels where they were 3; fewer, wider fin rays; plain round eyes; an outline of 6 pixels. The patches are where they were and the mask is the same file as `koi-mask.webp`, byte for byte. The height is cut from the new lines (face 128, highest 158, lowest 115). The scales are drawn by rule and look it; a few joins at the fins' roots are angular. |
| `papyrus-c.webp`, `papyrus-h.webp` | 512 × 1024, 67 KB and 27 KB | A papyrus clump in profile: seven stems with fan umbels and two blue buds rising from a tuft of leaves; the paint is 30, 226 to 482, 797 (it is as wide as it is tall, so the top and bottom of the picture are bare). |
| `duck-c.webp`, `duck-h.webp` | 512 × 512, 26 KB and 9 KB | A duck in profile facing right, standing: blue head and wing, green neck and flank, red ochre breast and legs, a yellow bill; 30, 101 to 482, 411. |
| `cartouche-c.webp`, `cartouche-h.webp` | 512 × 768, 36 KB and 14 KB | An empty cartouche, upright: a rope ring in yellow with its tied bar at the bottom, 89, 30 to 423, 738. Nothing inside it: bare stone at the face's height. |
| `dove-c.webp`, `dove-h.webp`, `spider-c.webp`, `spider-h.webp` | 512 × 512, 32, 13, 58 and 22 KB | One pose each, from above, facing right. The dove with wings spread, its body bare stone and its wings and tail in bands of blue, yellow, green and red (105, 26 to 407, 486). The spider with legs spread, banded in all four colours, with large round eyes (26, 34 to 486, 477); it is busier and more of a cartoon than anything else on the wall. These are raised like the rest, not sunk: the height is made the same way for every picture. |
| `afloat-c.webp`, `afloat-h.webp` | 1024 × 512, 94 KB and 33 KB | What drifts on the water through the year, in a 4 × 2 grid of 256-pixel cells, each fitted to its cell with 18 pixels clear. Top row: two blue lotus petals, a sycamore fig leaf in green, a willow leaf in yellow. Bottom row: a snow crystal and a frost flower in blue line, a bee, a swallow flying, heads to the right. The crystals are thin, so little of them is raised. |

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


#### Blueprint

In `public/pond/blueprint/`, delivered and not yet used.

| File | Size | What is in it |
| --- | --- | --- |
| `dove.webp`, `spider.webp` | 512 × 512, 43 KB and 55 KB | One pose each, from above, facing right, as line drawings in `#EAF3FF` with no fill (the tone carried by the alpha): the dove with wings spread (358 × 468 at 77, 22), the spider with legs spread (468 × 465 at 22, 23), each with a dashed centre line and a few station ticks. The dove's line is thin and faint next to the spider's, and the spider's joints are drawn as circles. |

#### Water

In `public/pond/water/`: Devot's dove and ocra's jumping spider as sprite sheets, modelled in Blender
and rendered from straight above. The pond draws the two from them (`sprites.js`, `drawCell()` in `engine.js`), each sheet fetched the
first time its creature is to be drawn; the three.js models they replaced are gone. In the looks
that have their own picture of the two, that picture is drawn instead.

- **How they are played:** the pond's own behaviour is unchanged; only the picture is. The dove beats
  once a turn of the phase its shadow already follows, takes off through its six frames in 0.45 s, comes
  down through the landing's first four below 0.45 of its height and folds up in the last two, sits
  still while it drinks, and turns its head, bobs it and preens once it has. Its walk (the sheet's
  last row) is not played: the pond's dove does not walk. The spider's walk advances a loop
  to each stride it actually covers, so its feet don't slide; it looks up when prey lands or a pointer
  moves close, gathers, jumps through three frames and lands splayed for a moment.
- **How each look dresses them** (`DRESS` in `sprites.js`, made once for a look and kept): ink a flat
  wash, glow and ASCII a flat light, blueprint and the star chart a line with a faint body, ukiyo-e
  three flat tones inside a key line, 青花 a cobalt line and wash, Dunhuang the wall's white inside its
  dark line. The water and Monet keep the rendering, in the light of the time of day, with the soft
  shadow the model's ground gave it.
- **How the files become a sheet:** a creature's three files are fetched together and packed into one
  picture, the frames played in order, six across, without the empty cells (`packed()` and `frameAt()`
  in `sprites.js`); a look's dress is made from that. For a new sheet, change `SHEETS` (the files, the
  cell, the frames a row holds, the units a cell spans) and the order in `doveFrame()` and
  `spiderFrame()`; `sprites.test.ts` has the grid.
- `tools/pond/life.cjs` pictures both through their states in any look.

The sheets are the approved models rendered through every row asked for, in cells of 384 × 384, each
sheet split by rows into three files of one width since neither fits one file under the budget. Stack
a creature's files in order and the rows are the sheet's.

| File | Size | Rows it holds, left-aligned, the rest of each row empty |
| --- | --- | --- |
| `dove-v2-1.webp` | 4608 × 768, 112 KB | 1 at rest (5), 2 take-off (6) |
| `dove-v2-2.webp` | 4608 × 384, 164 KB | 3 flight (12) |
| `dove-v2-3.webp` | 4608 × 768, 123 KB | 4 landing (6), 5 walking (6) |
| `spider-v2-1.webp` | 3072 × 384, 95 KB | 1 at rest (4) |
| `spider-v2-2.webp` | 3072 × 384, 184 KB | 2 walking (8) |
| `spider-v2-3.webp` | 3072 × 768, 134 KB | 3 crouch (2), 4 jump (4) |

- **Framing is the first sheets' at one and a half times the size for the dove and twice for the
  spider:** 12 columns for the dove, 8 for the spider; the creature faces the right of its cell, its
  place on the ground is the cell's centre (192, 192), and a cell spans 4 units either side of it
  for the dove (48 pixels a unit) and 2.7 for the spider (71.1). The paint sits behind that point as
  before: the dove at rest is 206 pixels from beak to tail (80, 152 to 286, 232), the spider 262
  with its legs (42, 86 to 304, 298). The least clear margin is 25 pixels (the dove's landing 2) and
  32 (the spider's crouch 2).
- **The dove's frames:** at rest 1 still, 2 head turned to its left (up in the cell), 3 to its
  right, 4 preening with the head laid back into the shoulder, 5 a head-bob, the head pushed
  forward. Take-off 1 the push, 2 and 3 wings opening, 4 to 6 steep first beats, leading into
  flight. Flight is one beat that loops: 1 to 7 the wing spread and coming down, 8 to 12 the
  upstroke, wrists flexed and primaries parted. Landing 1 and 2 braking with the tail fanned (2 is
  the widest frame), 3 and 4 wings half folded, 5 folding, 6 settled, close to rest 1. Walking is a
  loop of 6, wings folded, the feet showing in turn beside the breast, the head bobbing with the
  step.
- **The spider's frames:** at rest 1 still, 2 looking up (the front body tilted, palps lifted, front
  legs drawn in), 3 turned to its left, 4 to its right. Walking is a loop of 8; one loop is a stride
  of half a unit (36 pixels at the cell's scale), each foot planted for five frames. Crouch 1
  lowering, 2 gathered and drawn back. Jump 1 launch, 2 legs extended in the air, 3 reaching, 4
  landed and splayed; drawn in place, for the pond to move. The orange is on the pedipalps.
- **Light and colour:** even light from the whole sky with occlusion only, no ground or shadow;
  straight alpha with the edge colour under the transparent pixels, as the first sheets have.
- **What is weak:** the dove's half-open wings (take-off 2 and 3, landing 3 and 4) are a folding
  wing less finely feathered than the folded and the spread ones, and the change between the two
  shows from take-off 1 to 2 and landing 4 to 5; on the upstroke the arm's coverts make a zigzag
  that looks mechanical; the walking feet are only two or three pixels thick, so the bob carries the
  walk; the legs never show in the air. The spider's walk is a small shuffle (its stride is short
  against its size), looking up is subtle from above, and jump 3 is close to jump 2. The loops were
  judged from frames side by side, not played.
- **To change them:** they are made by scripts kept on the owner's machine (one command a sheet,
  about two minutes), so a different facing, size, frame count or light is cheap to ask for.
- **`lilies-768.webp`**, 768 × 576, 77 KB: eleven motifs in a 4 × 3 grid of 192-pixel cells, from
  straight above, like softened photographs, even light, no shadow. Row 1, summer: a large whole pad
  (161 pixels across), a large one with a notch, a medium one with a notch (128), a small young one
  (90). Row 2, autumn, the same four withered: yellowing with a brown curled edge, brown and torn
  with a notch, brown with a notch, small and yellow-brown. Row 3: a white flower and a pink one,
  open (112 across), a bud, and an empty cell. The leaves are closer to lotus leaves than to a water
  lily's, their sheen is slight, and the flowers are a little cupped. In use in a preview build:
  `drawPads()` draws the water's pads from it (whole or notched by size, the withered row laid over the
  green as autumn comes) and their flowers (a bud as summer comes, open at its height, none in autumn).
  The sheet is fetched once the pond has settled, never on the first screen, and the drawn pads stand
  until it has come. The first sheet, with cells of 256, is gone.
- **`dragon-boat.webp`**, 1024 × 512, 94 KB: the dragon boat from straight above, bow to the right,
  in two rows of 256, like a softened photograph. The hull is 940 pixels long (x 42 to 982) and 81
  across, its middle line on y 128 of its row; red lacquer inside, a band of gold scales along each
  gunwale, a gold and green dragon's head with horns and whiskers at the bow, a green tail at the
  stern, a drummer in red with a drum behind the head, two files of nine paddlers in white, a
  helmsman in green with a long oar trailing aft. Row 1: the paddles reaching forward. Row 2: the
  same picture with the paddles mirrored to point aft, so everything but the paddles outside the
  hull is the same to the pixel in both. Two things are not as asked: with its paddles the boat is
  191 pixels across (y 34 to 225 of its row), not 110, since paddles drawn shorter stopped reading
  as paddles; and in row 2 the paddlers' arms inside the hull still reach forward, which does not
  show at 240 pixels. The dragon's mouth is closed, seen from above.
- **`lanterns.webp`**, 512 × 256, 22 KB: two cells of 256, from above, each about 228 pixels
  across: a river lantern (two rings of pink paper petals round a candle in a cup) and a red paper
  lantern (a red disc, ribs running out from a gold cap). No glow, no shadow.
- **`afloat.webp`**, 1024 × 512, 60 KB: eight things in a 4 × 2 grid of 256-pixel cells, from above,
  each fitted to its cell (so they are not at one scale), 16 pixels clear at least. Top row: two
  cherry petals, a red maple leaf, a yellow ginkgo leaf. Bottom row: a brown oak leaf, then a folded
  paper boat three times, in white, cream and grey, lying along the row.
- **`dragonfly.webp`**, 1024 × 256, 48 KB: one dragonfly in four cells of 256, from above, head to
  the right, the body on y 128 and the same size in each (about 172 pixels long). The wings: spread
  and upright, swept back a little, half raised and narrow, swept back and wide. The bodies were
  painted four times, so they differ by a pixel or two between frames, and the wings are milky, not
  clear.


#### What is drawn by code, and what should be a picture

Painted pictures are the default wherever drawing in code falls short, in every look, the water
included. This is everything the pond draws by code, judged; the pictures it calls for are in the
list below, in the order they would help most. What must answer to physics (the water, its ripples,
light and refraction, the glass) stays in the shader.

| Element | Drawn in | How it reads now | Verdict | Picture wanted |
| --- | --- | --- | --- | --- |
| Koi | `Koi.draw()` on the fish canvas, restyled by each look's shader; from a painted sheet in ukiyo-e, Monet, 青花 and Dunhuang (preview) | Good in water and ink; a silhouette restyled in glow, blueprint and ASCII, which suits them | Painted per look where a sheet has come; keep in water (and in ink unless a painted one is clearly better) | A sheet per look, bent along the live spine: see the koi sheet in the brief |
| Lily pads, lotus flowers and buds | `padsNow()` on the pads canvas; from `water/lilies` on the water in a preview build, from `monet/lilies` in Monet | Drawn, flat discs with a notch and flowers of a few ellipses: the weakest thing on the water look | Replaced on the water in a preview build | one per painted look still wanted |
| Petals, autumn leaves | `drawTop()` paths | Leaves pass; petals are two ellipses | Replace petals and leaves together | `water/afloat` sheet |
| Snowflakes | dots on the air canvas | Fine: they are small and moving | Keep | none |
| Dragonflies | paths on the air canvas | Stiff; wings are plain ellipses | Replace | `water/dragonfly` sprite, 4 wing frames |
| Fireflies (preview) | soft dots | Fine | Keep | none |
| Devot's dove, ocra's spider | rendered sprites (`sprites.js`); a look's own picture of them where it has one | The first renders: the sitting dove is plain | Replace with the revised renders when approved | Blender job, below |
| Paper boats | three paths in `drawTop()` | Read as boats; a little bare | Replace when convenient | in `water/afloat` |
| Moon, sun glint | shader | Light, not an object | Keep | none |
| The tree's shade | a texture drawn once | Good on water; wrong on the painted looks (switched off there) | Keep | none |
| Pebble bed (water look) | `BED` shader, drawn once | Good; it is what the refraction reads from, and the first thing seen | Keep for now | A Blender-rendered bed with a normal map would be the one thing to try, behind a flag, at no cost to the first visit's budget only if it fits in about 150 KB |
| Ink: seasonal motif | `painting.js`, from pictures | Painted, and in use | Done | none |
| Ink: far hills, mist | canvas washes, CSS | Good | Keep; hills later | `ink/hills` later |
| Seals (ten looks and 锦程) | the brush face in CSS | A family, but running script, not seal script | Replace | `ink/seals` (asked) |
| Ink: inscription | the brush face | Good | Keep | none |
| Festival things (preview) | canvas paths | Lanterns pass; the dragon boat is crude | Replace the boat and the lanterns | asked: `water/dragon-boat`, `water/lanterns` |
| Borders and frames | pictures (青花's rim, the Dunhuang band, the relief's frieze) | In keeping | Done | in use (`qinghua/rim`, `corner`; `dunhuang/border`; `relief/frieze`) |
| Solar-term block, chapter headers, the album's paper | type and CSS | In keeping | Keep | per look only where asked below |
| Presses | shader, per look | Good where they are physics (rings, blots); ukiyo-e's claws are stiff | Ukiyo-e's replaced in a preview build | in use (`ukiyo/waves`) |

Highest value, in order: Monet's painted bed; a koi sheet per look (one look first, as the proof);
lily pads and flowers for the water look; the dove and the spider as rendered sprites; the seals in
true seal script.

#### The art brief

Every look's main pictures are made by the thread on the owner's machine; this brief is the whole of
what each look needs, in the order to make it, so nothing has to be asked. A look is built to work
without its pictures and to take each one as it comes. What has been delivered is in the tables
above; this list says what each thing is for and what is still wanted.

**Each look in its own pictures.** Wherever a look shows something, it should be that look's own
picture of it, in its own manner, not the water's thing recoloured: its water, its koi, its plants,
what floats and what flies, its dove and spider, its seal. Where the manner has no such thing, the
look goes without it and shows what it does have instead (the star chart has no lily pads or
dragonflies; its rain is a shower of meteors). Glow, the blueprint and ASCII are light, ruled line and
characters by nature, and are drawn in code. So besides the lines in each kit below, every painted
look (ukiyo-e, Monet, 青花, Dunhuang, the relief) has (delivered, to wire in; the relief's as a
pair) a sheet `afloat.webp`, 1024 × 512,
4 × 2, of what drifts on its water through the year in its own hand: two spring petals, two autumn
leaves, a snow crystal or a frost flower, and, where the manner has one, a dragonfly or another small
flying thing seen from above (a crane or a butterfly for Dunhuang, a bee or a swallow for the relief).

**The round asked for now** (every line is already in a look's kit below, or is new there; make them
in this order, commit each lot as it is done, and say in its table what came out):

All of it is delivered, and all of it is in use (how is under "Each look's own pictures in the
code" below) but five: ink's `stems` (how it sits with the plum and the reeds has to be composed), the
star chart's old framed plate (gone), ukiyo-e's `paper` (the shader's own grain is still used),
Monet's `strokes` and `canvas`, and Dunhuang's `caisson`; and the heights of the relief's `afloat`,
`dove` and `spider`, since what floats and flies is drawn above the stone, not carved in it.

**Each look's own pictures in the code.** `LOOK_ART` in `newlooks.js` says, for each look, which sheet
holds its lily pads (by size, with their flowers and bud), what drifts and flies, and its dove and
spider; `artOf()` in `engine.js` fetches a sheet the first time its look needs it, and until it has
come what the pond draws for every look stands. `drawPads()`, `drawTop()`, the dragonflies in
`drawAir()` and `drawCell()` each draw from the look's sheet when there is one, and the shaders of
ukiyo-e, 青花 and Dunhuang lay painted pads and drift in as they are (`uArt`), without the line and
flat colour they give the pond's own. On the star chart the pads' places hold planets, nebulae and
clusters in the plate's line. Ukiyo-e's painted water is the top half of its texture, its crests the
bottom half. 青花 has its medallion, large and pale, in the right of the bowl. The relief has its
papyrus and duck from their own pictures and a cartouche round the solar term. A new look adds its
entry to `LOOK_ART`; a new kind of thing adds a key there and a place that draws it.

1. Water: `dragon-boat`, `lanterns`, `afloat`, `dragonfly`.
2. Ukiyo-e: `bed`, `bed-tall`, `paper`, `lilies`.
3. 青花: `lotus`, `medallion`.
4. Dunhuang: `lotus`.
5. Star chart: `nebulae`.
6. Monet: `lilies-autumn`, `dragonfly`.
7. Ink: `stems`.
8. Egyptian relief: `papyrus`, `duck`, `cartouche`, each as a pair.
9. Each painted look's `afloat` sheet (above).
10. The dove and the spider dressed for ink, Monet, 青花, Dunhuang, the star chart, the blueprint
    and the relief. They are drawn by the image model from the brief's words, not from the Blender
    sheets, so their proportions are not those sheets'.

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

**The dove and the spider: the second version is delivered and drawn**, as `dove-v2-1.webp` to `-3` and
`spider-v2-1.webp` to `-3` in `public/pond/water/`: cells of 384, the rows in the order asked for,
the orange on the pedipalps. The table under "Water" has the files, the rows each holds, the
framing and what is weak.

What follows is the brief the stills were made to.

**The dove and the spider** (Blender; in `public/pond/water/`). **Status: delivered.** The first sheets
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

Where the revision stands: the stills were approved and the whole sheets are rendered, in cells of
384 for both, since that is more than the size the dove is drawn at and half the weight of 512.

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
3. Delivered and in use (preview): `lilies-768.webp` (summer pads, autumn pads, two flowers and a
   bud; cells of 192). Delivered and in use:
   `afloat.webp`, 1024 × 512, 4 × 2: two cherry petals, three autumn leaves (maple, ginkgo, oak), a
   folded paper boat from above in three tones.
4. Ornaments: none.
5. Press: none (it is the water itself).
6. Dove and spider: the neutral sheets as rendered: delivered (`dove.webp`, `spider.webp`), and drawn
   from in a preview build; the revised ones replace them.
7. Delivered and in use: `dragonfly.webp`, 1024 × 256, four frames of a dragonfly from above, wings in four positions
   of a beat.
8. **Delivered and in use:** the dragon boat of the Dragon Boat festival, which is three paths today and reads as
   a red sliver. `dragon-boat.webp`, 1024 × 512, two frames stacked in rows of 256, the boat from
   straight above, bow to the right, about 940 pixels long and at most 110 across with its paddles,
   centred in its row. A long narrow hull in red lacquer with a band of gold scales along each side;
   a carved dragon's head at the bow (horns, whiskers, an open mouth, in gold and green) and its tail
   curling up at the stern; a drummer with a drum facing the crew just behind the head; two files of
   nine paddlers; a helmsman with a long oar at the stern. Frame 1: the paddles reaching forward,
   blades just entering the water. Frame 2: the stroke's end, blades back. The hull, the head, the
   drum and the helmsman are the same to the pixel in both frames; only the paddlers and paddles
   differ. No water, wake, spray or shadow (the pond draws its own wake). Drawn about 240 pixels
   long on screen, so keep the shapes bold: a head that reads at that size matters more than
   detail. In the manner of the water look's own pictures (like softened photographs). Under 120 KB.
9. **Delivered and in use:** `lanterns.webp`, 512 × 256, two cells of 256, from straight above: a river lantern
   (a paper lotus of pale pink petals round a small candle) and a red paper lantern (round, gold
   caps top and bottom, ribs showing). No glow painted (the pond adds the light), no shadow. Each
   is drawn about 40 pixels across. Under 40 KB.

**Ink** (the benchmark; Jincheng's favourite). Judge it by: a Song or Yuan album leaf; empty paper
is most of it.
1. Bed: the shader's paper. P2 `hills.webp`, 2048 × 512, three far hills as pale washes, for the foot.
2. Koi: the pond's own wash koi are liked and stay. P1, **for an A/B only**: `koi.webp` to the
   common spec as ink wash koi (wet body, dry-brush edge, the spot and patches in cinnabar
   `#B8382A`). It replaces the drawn ones only if it is clearly better in motion.
3. Seasons: delivered and in use (`willow`, `lotus`, `reeds`, `plum`). Composited by multiplying
   into the paper, faded at their outer edges.
   Delivered and in use: `stems.webp`, 1024 × 1024, withered lotus (残荷) in ink: a few dry bent stems, a curled brown
   leaf, a seed-pod, entering from the right edge like the others; it joins the reeds in late autumn
   and stands alone under the plum in winter.
4. Ornaments: none; the inscription and the 锦程 seal are type.
5. Press: the shader's blot. Nothing wanted.
6. Dove and spider: delivered and in use: each as three ink-wash poses on one sheet `dove.webp` / `spider.webp`,
   768 × 256 (sitting, moving, wings or legs spread), in the manner of Bada Shanren's birds:
   a few wet strokes, black and grey. Multiplied into the paper.
7. Delivered and drawn (a seal is its cell of the sheet in the seal's colour, by a CSS mask, once the sheet has come; the brushed characters until then: `sealsPic()` in `engine.js`, `sealCell()` in `seals.ts`): `seals.webp`, 1024 × 768, 4 × 3, true seal script (篆书), vermilion `#B8382A`, the stone's
   uneven edge, white characters out of red (白文) or red characters and border on transparent
   (朱文): 墨 (square, 白), 浮世 (tall, 朱), 莲 (round, 白), 青花 (tall, 白), 敦煌 (tall, 朱), 光
   (round, 朱), 图 (square, 白), 字 (square, 朱), 星 (round, 白), 刻 (square, 白, for the relief),
   锦程 (tall, 白, 锦 over 程), one cell empty. Tall is 3 : 5. Used in the album, the stamp and
   under the solar term.
9. **Asked of the local thread: two clues, painted.** A look on show carries a small mark that
   points to the next look's gesture. Drawn in code over a painting two of them read as faults, so
   those two looks carry none for now (`CLUES` in `engine.js` holds what each look shows):
   - Monet's pond, pointing to the bowl (once round the rim): a file named clue.webp in the Monet
     folder under `public/pond/`, about 320 × 240 with alpha, one lily pad seen from above in the
     painting's own hand and palette, its rim alone picked out in the bowl's cobalt (`#1c3f9a`) as a
     loaded brush would lay it, edges feathered to nothing.
   - The porcelain bowl, pointing to Dunhuang (rub the dust off): clue.webp in the bowl's folder,
     about 240 × 240 with alpha, a reign mark in cobalt as on the foot of a bowl, half hidden under a
     film of ochre dust with a few strokes wiped through it, edges feathered to nothing.

8. **Asked of the local thread: five more seals, for the volume of occasions** (`hours` in `VOLUMES`, `seals.ts`). A second sheet `seals-2.webp` in
   `public/pond/ink/`, 1024 × 512, cells of 256, 4 × 2, cut and coloured exactly as `seals.webp` is
   (same face, same vermilion `#B8382A`, the tone in the alpha, square and round 232 across and
   centred): row 1 雨 (square, 白), 雪 (round, 白), 月 (round, 朱), 节 (square, 朱); row 2 晨
   (square, 白), 舟 (round, 白, the race's idle seal), then two cells empty. Under the budget for a file in `public/`. Until it comes
   these five are their characters in the brush (`CUT` in `seals.ts` lists what the sheets hold).

**Ukiyo-e.** Judge it by: a Hokusai or Hiroshige print at arm's length: flat colour, a key line,
bokashi gradation, paper showing.
1. **Delivered and in use:** `bed.webp`, 2048 × 1152, opaque to every edge, with `bed-tall.webp`, 1080 × 1920, the
   same water painted again upright (not a crop). The water of a print, seen from above, with nothing
   in it: flat Prussian blue in three or four tones (`#16365f`, `#1f4a7a`, `#33638c`, a little
   `#8fb4c8`), the swell as long carved contour lines that run in parallel bands and curl at their
   ends, bokashi gradation from dark at the left to lighter at the right, a keyline `#0c1b27`. No
   foam crests, no boats, no fish, no sky, no text, no seal. The left third (the top third of the
   upright one) quieter and darker, with fewer lines: the title's type stands there. In the manner
   of Hokusai's and Hiroshige's water, not a copy of a print. It replaces the shader's bands, which
   read as blotches; the shader keeps the moving foam and the press. Under 300 KB and 120 KB (a bed
   may pass the budget, with its line in the size check).
   Delivered and in use: `paper.webp`, 512 × 512, washi grain with a few long fibres, greyscale, opaque, seamless.
2. Delivered and in use: `koi.webp` + mask, as a carp print.
3. Delivered and in use: `lilies.webp`, 1024 × 512, 4 × 2: lotus leaves and flowers as a print draws them from above;
   maple leaves and cherry petals for the seasons.
4. Ornaments: none (no cartouche: it was tried and taken out).
5. Delivered and in use: `waves.webp`, for the press and the arrival.
6. Dove and spider: tinted flat, with a key line added in code. Nothing wanted.
7. Seal: on the ink sheet.

**Glow.** Light only: the shader draws everything. Nothing wanted. Dove and spider: tinted as light.

**Blueprint.** Judge it by: a draughtsman's sheet, white line on blue.
2. P1 `koi.webp` (no mask needed: visitors are told apart by their dimension labels): white line
   drawings of a koi from above with a centre line, station marks along the spine and the fins'
   construction lines, line only, no fill, the line `#EAF3FF`.
6. Dove and spider: delivered and in use: the same as line drawings, one pose each, 512 × 512.
Everything else is ruled in the shader. Nothing more wanted.

**ASCII.** Characters only. Nothing wanted.

**Monet.** Judge it by: at thumbnail size it is a late Nymphéas panel.
1. Delivered and in use: `bed`, `bed-1280`, `bed-tall`.
2. Delivered and in use: `koi-v2` + mask, to the common spec.
3. Delivered and in use: `lilies`. Delivered and in use: an autumn row for it, `lilies-autumn.webp` (pads gone yellow-brown), 1024 × 256.
4. Ornaments: none.
5. Delivered, not yet used: `strokes`, `canvas`. For the press and the arrival.
6. Dove and spider: delivered and in use: `dove.webp`, `spider.webp`, 768 × 256, three poses each as a few loaded
   oil dabs, soft edges, no line.
   Delivered and in use: `dragonfly.webp`, 512 × 256, two dragonflies as a few thin dabs (the drawn one is only
   dimmed for now).
7. Seal: on the ink sheet.

**青花.** Judge it by: a Yuan or early Ming blue-and-white dish seen from above: cobalt only, on
white, the blue pooling at line ends.
1. Bed: the shader's glaze and crackle. Delivered and in use: `medallion.webp`, 1024 × 1024: a double ring, and in it
   two koi among lotus and water-weed in line and wash; it lies large and pale in the right half.
2. Delivered: `koi` + mask, to the common spec.
3. Delivered and in use: `lotus.webp`, 1024 × 512, 4 × 2, in the cobalt: three lotus leaves from above, two flowers,
   a bud, a seed-pod, a spray of water-weed. They replace the shader's pad outlines.
4. Delivered: `rim`, `corner`.
5. Press: the shader's craze line. Nothing wanted.
6. Dove and spider: delivered and in use: `dove.webp`, `spider.webp`, 768 × 256, three poses each in cobalt line and
   wash.
7. Seal: on the ink sheet; the stamp is shown in cobalt, as a reign mark is.

**Dunhuang.** Judge it by: a Mogao wall of the high Tang, sooted and flaked, with the weight of a
dark painted game mural.
1. Delivered and in use: the figures, `sky-flowers`, `border`, `cloud-trail`, `halo`; `caisson`
   delivered, to be placed.
2. Delivered and in use: `koi.webp` + mask, as mural fish.
3. Delivered and in use: `lotus.webp`, 1024 × 512, 4 × 2: lotus leaves and flowers as cave ceilings paint them, flat
   mineral green, white and cinnabar in the same line.
4. Delivered: `border`. 5. Press: the shader's flaking. Nothing wanted.
6. Dove and spider: delivered and in use: `dove.webp`, `spider.webp`, 768 × 256, three poses each in the wall's
   manner (the dove as the white birds of the murals).
7. Seal: on the ink sheet.

**Star chart.** Judge it by: a plate from an eighteenth-century celestial atlas.
1. Delivered and in use: `grid.webp`, a grid that tiles (the plate it replaced is gone).
2. Delivered and in use: `koi-figures`. P1: the same to the common spec (four rows,
   outline and engraved scales only, with a mask of where a visitor's colour tints the line).
3. Delivered and in use: `nebulae.webp`, 1024 × 512, 4 × 2: engraved discs and wreaths that stand for the lily pads
   (a ringed planet, a nebula as stippling, a cluster, an armillary ring), the pale line `#C9D4F0`.
4. P2 `compass.webp`, 512 × 512, a compass rose in the same engraving.
5. Press: the shader's star. Nothing wanted.
6. Dove and spider: delivered and in use: as engraved constellation figures, one pose each, 512 × 512 (Columba the
   dove; a spider in the same hand).
7. Seal: on the ink sheet.

**Egyptian relief** (built on the first lot; what is still wanted is below). Judge it by: painted limestone relief from a New Kingdom
tomb under a raking light: carved, pale, cool, nothing like the Dunhuang wall's warm paint.
Every picture comes as a pair of the same size: `-h` the height (mid grey the stone's face,
lighter raised, darker cut in; opaque) and `-c` the faded paint over it (Egyptian blue `#3F6FA8`,
green `#5E8F6A`, red ochre `#A8482C`, yellow `#D6A23E`, black line; transparent where bare).
1. Delivered and in use: `stone-h.webp`, the limestone face.
2. Delivered and in use: `koi-h.webp`, `koi-c.webp` + `koi-mask.webp`, to the common spec.
   Delivered and in use: the bolder cut, `koi-c-bold.webp`, `koi-h-bold.webp`, `koi-mask-bold.webp`
   (the first cut is gone).
3. Delivered and in use: `fish`, `lotus`, `frieze`. Delivered and in use: `papyrus`, 512 × 1024, a papyrus clump; `duck`, 512 ×
   512, a duck in profile.
4. Delivered and in use: `cartouche`, 512 × 768, an empty cartouche ring, upright, for the solar term. Nothing in it.
5. Press: a chip and dust, in the shader. Nothing wanted.
6. Dove and spider: delivered and in use (their paint; raised, like the rest): `dove-h/-c`, `spider-h/-c`, one pose each, 512 × 512 (the
   dove in the manner of the birds of the marsh scenes).
7. Seal: 刻, on the ink sheet. No hieroglyphic text anywhere, real or invented.

## Languages

The language is chosen apart from the look: the En / 中 / 日 segments
beside 墨 (L steps through them) turn the pond's words to plain,
natural Chinese, set in the brush, or plain Japanese, and back: the
greeting, the contents, the clock and every chapter. It's remembered (`pond-lang`); a first visit takes the
browser's language. The words are `ZH` and `JA` in `content.ts`;
`L(en, zh)` in `engine.js` picks them (from `ZH`, which points at the
Japanese when 日 is chosen), and `speak()` rewrites the page's own words as the language
changes. A new piece of copy needs its Chinese in `ZH` and its Japanese
in `JA` too.

## Looks, gestures and languages

The first six looks ([decision 0026](../decisions/0026-looks-and-gestures.md)); the five that came
after are under "The five later looks":
water, ink, ukiyo-e (a woodblock print), glow (the pond at night, lit by
what moves), blueprint (a drawing on blue paper, the koi measured in the
air) and ASCII (the pond in characters).

- **How they're drawn:** each is a function in the water's shader
  (`look()`, brought in by `reveal()`); ASCII's characters are the glass
  pass's (`uAscii`, a strip of glyphs drawn by `atlas()`). `setLook()`
  runs the front for any of them. Ice and snow are drawn in each look's
  own idiom (`gIce`, `gHit`, `snowOn()`), and cracking the ice works in
  all of them.
- **One layout in every look and language.** The blocks that hold type are sized by the page, not by
  the face: the greeting is two lines of the water's measure (standing on its last line), the line
  under it two lines, the contents' first column one width, the chat's pill one width; a frame a look draws round a block (the blueprint's title block) takes no room. So
  a change of look or language changes the face and nothing's place. The one exception is the three
  looks with a band or a rim (青花, Dunhuang, the relief): they lift the clock and the controls clear
  of it, all three by the same distance. `tools/pond/layout.cjs` measures every block in every look
  and says which differ; a new look, face or block is run through it.
- **The page through a change:** the title page's type fades out as a look comes and back in its
  face; the controls only dim. A look that puts the page's blocks elsewhere (青花's rim, the Dunhuang
  wall's bands, a face's own measure) has them glide there from where they stood (`glide()`, the
  blocks in `GLIDES`); a new block that a look can move goes in that list. Under reduced motion they
  just change.
- **Finding them** (`gest` in `engine.js`), each with a cue while it
  builds (`drawGesture()`):
  - ink: hold still on the water for 1.2 s (I and 墨 still work);
  - ukiyo-e: stir the water once round;
  - glow: press the light on the water (the moon's, or the sun's glint
    by day);
  - blueprint: draw a long straight line;
  - Egyptian relief: draw a zigzag of three peaks or more;
  - Monet: four taps in one place; 青花: once round the rim of the screen; Dunhuang: rub back and
    forth over a spot; the star chart: three taps far apart (the table is in `gestures.ts`);
  - ASCII: type five letters that aren't shortcuts within 3 s (each
    lands on the water at the pointer); or, where there are no keys, tap five times in a row along
    a level line within 3 s.
  - A rub and a zigzag are read along the stroke's own line (`aligned()` in `gestures.ts`), since a
    hand draws on a slant; a rub may be brushed in several strokes lifted within about two seconds
    of each other (`gest.carry` in `engine.js`).
  - With `?gest` in the address, each stroke is shown in a corner as the rules read it
    (`describe()` in `gestures.ts`): for when a gesture won't take on someone's machine.

  In a look, a press on the gold koi (mine) brings the water back, from
  the koi, before whatever lies over it.
- **What a look leaves out:** the seasons' things show only where the look's manner has a place for
  them (`NEW_WITHOUT` in `newlooks.js`): no lily pads, dragonflies or fireflies on the star chart; no
  dragonflies or fireflies on glaze, the painted wall or carved stone. A new look says what it does
  without, and a new seasonal thing is checked against every look.
- **Weather:** rain falls only where the look can carry it (`RAINY`,
  `drawRain()`):
  - in ink as fine dry strokes;
  - in ukiyo-e as Hiroshige's straight lines;
  - in ASCII as falling `|` and `/`;
  - on the star chart as a shower of meteors, with nothing falling on the water.

  Glow and blueprint hold it off. In ukiyo-e the swell's bands and foam follow only large crests,
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
- If anything fails there is no weather, and nothing is said.

**Privacy:** the place goes only to Open-Meteo, to ask for its weather, and is kept only in this
browser's half-hour cache (`pond-weather`). Nothing about it is stored or sent anywhere else.

## The later details

These came after the pond's first version and are part of it (`preview.js`). Only the panel at the
end is for trying things: it shows with `?preview` in the address, or in a build with
`PUBLIC_POND_PREVIEW=1`, as the single-file demo is.

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
- **The panel** (`?preview` only): a small panel at the bottom forces each of these, with the time of day, the weather and
  the look.

## Changing it

- **Wording:** `content.ts`, in English, `ZH` and `JA` alike; the album's
  words are in `seals.ts`.
- **Something on the water:** its section in `engine.js`. Check it in a
  browser with motion on and off, on a phone width, and in winter and
  summer (the season follows the calendar: set the machine's date).
- **A chapter:** `SHEETS`, `CHAPTERS` and `ORDER` in `engine.js` (the
  numbers in `CHAPTERS` are the contents' and the keys 1 to 4), its row in
  `index.astro`'s `.toc`; add it to
  `scripts/smoke.mjs`'s list of the pond's chapters too.
- `npm run test:smoke` opens the pond and every chapter; `astro dev` has a
  stand-in backend that works across tabs, for trying accounts, notes,
  chat and presence.
