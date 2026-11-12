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
