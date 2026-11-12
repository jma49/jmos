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

#### Wanted, by look

A first small lot for each look: the two or three pictures that would lift it most. ★ marks the ones
to make first. Unless a line says otherwise: WebP, transparent ground, straight alpha, a margin of at
least 4% inside each picture or cell, nothing cropped, no text or signature, no ageing or paper
texture baked in (the shader adds its own). Sheets are grids of equal cells with one motif in the
middle of each, read left to right, top to bottom.

**Monet** (`public/pond/monet/`). The strokes are procedural tiles now and read as scales; real
brushwork to stamp the scene with is what the look most needs.

- ★ `strokes.webp`, 1024 × 1024, a 4 × 4 sheet of single oil brush strokes as they look on canvas:
  thick paint, bristle streaks along the stroke, a raised ridge at one side and a thinner, dragged
  tail. In greyscale, where lightness is the paint's height (white the thickest) and alpha its
  cover; no colour (the look colours them). Each stroke lies left to right. Row 1: four long loaded
  drags, about 220 pixels long. Row 2: four medium strokes, slightly curved. Row 3: four short dabs,
  about 90 pixels. Row 4: four clusters of three or four small dabs laid together, for lily pads and
  flowers. Reference: the surface of Monet's late Water Lilies seen close.
- ★ `canvas.webp`, 512 × 512, a primed linen canvas weave, greyscale, opaque, seamless on all four
  sides, even in tone with no vignette. It shows between strokes.
- `lilies.webp`, 1024 × 512, a 4 × 2 sheet of water lilies painted in oil, seen from above at a low
  angle: four pads (two with a notch, in different greens), four blossoms (white, pink, deep rose,
  a bud), each a few thick strokes, colour included. They replace the look's dabbed pads.

**青花** (`public/pond/qinghua/`). The rim is beads between lines; a real pattern would make it porcelain.

- ★ `rim.webp`, 1024 × 128, a band of 缠枝莲 (lotus scroll) between two thin lines, cobalt blue line
  and wash with the blue pooling darker at line ends, on transparent. Seamless left to right (it is
  tiled round all four sides). Reference: Yuan and early Ming blue-and-white dish rims. Palette:
  deep cobalt `#0F2470`, wash `#5C80CC`.
- ★ `corner.webp`, 256 × 256, the piece that turns the band through a corner: the two lines meeting
  at a right angle with a 如意 cloud-head or a single lotus in the angle. Drawn for the top-left
  corner (band along the top and down the left); it is mirrored for the others.
- `medallion.webp`, 1024 × 1024, a round 开光 medallion for the bowl's centre: a double ring, and in
  it two koi among lotus and water-weed, line and wash, the same cobalt. It sits large and pale in
  the right half behind the swimming koi.
- Later: three koi poses and two lotus as 青花 motifs, to replace the shader's outlines.

**Ukiyo-e** (`public/pond/ukiyo/`).

- ★ `waves.webp`, 1024 × 512, a 4 × 2 sheet of wave crests in the manner of Hokusai: a curling crest
  with claw-like foam fingers and scattered spray dots, a dark keyline, flat Prussian blue
  (`#1F4A7A`), pale blue (`#8FB4C8`) and paper white (`#F6EDD8`). Four large crests breaking to the
  left, four small wavelets. Used where the water is pressed and along the front as the print
  arrives.
- `paper.webp`, 512 × 512, washi paper grain with a few long fibres, greyscale, opaque, seamless.
- No title cartouche: the cream block was taken out and nothing is asked for in its place.

**Star chart** (`public/pond/stars/`).

- ★ `plate.webp`, 2048 × 1024, an engraved celestial atlas plate without its stars or figures: a
  curved grid of right ascension and declination, the ecliptic and the equator as graduated arcs,
  small tick marks along the frame, in one pale line colour (`#C9D4F0`) on transparent, the line as
  a copper engraving's (thin, a little uneven, hatching where two scales meet). No numerals or
  letters. Reference: Bode's Uranographia, Hevelius. It lies still under the stars and turns with
  them.
- ★ `koi-figures.webp`, 1024 × 512, a 2 × 1 sheet: two koi drawn as constellation figures, the way
  an atlas draws Pisces: outline and a few engraved scales and fin rays in the same pale line, no
  fill, one fish straight and one curved, heads to the left. They sit faintly behind each koi's
  stars.
- `compass.webp`, 512 × 512, an ornamental compass rose in the same engraving, for a lower corner.

**Ink** (`public/pond/ink/`). The look Jincheng is happiest with; these would finish it.

- ★ `seals.webp`, 1024 × 768, a 4 × 3 sheet of seals carved in true seal script (篆书), which the
  brush face can't give: vermilion `#B8382A` and the stone's uneven edge, the cut either white
  characters out of red (白文) or red characters and a red border on transparent (朱文). In order:
  墨 (square, 白文), 浮世 (tall, 朱文), 莲 (round, 白文), 青花 (tall, 白文), 敦煌 (tall, 朱文), 光
  (round, 朱文), 图 (square, 白文), 字 (square, 朱文), 星 (round, 白文), 锦程 (tall, 白文, 锦 over
  程), then two cells left empty. Tall seals are 3 : 5. They replace the album's seals and the stamp.
- ★ Seasonal motifs in ink, each 1024 × 1024, black and grey wash on transparent, painted from one
  edge inward so it can hang at the pond's right edge: `plum.webp` (a plum branch in blossom, a
  touch of red in the flowers), `willow.webp` (willow fronds hanging), `lotus.webp` (a lotus leaf
  and flower on long stems), `reeds.webp` (reeds with two wild geese). Reference: Song and Yuan
  flower-and-bird painting, Bada Shanren for economy.
- Later: three washes of distant hills, 2048 × 512.

**Glow, blueprint, ASCII:** nothing wanted. Each is made of light, ruled line or characters, which
the shader and the type do better than a picture would.

**The dove and the spider:** nothing yet. Their models are dressed for each look first; a look they
can't be dressed for will ask for a small illustration of each here.

**The look that replaces the blackboard:** held until it is chosen.

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
