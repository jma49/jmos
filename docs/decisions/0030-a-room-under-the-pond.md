# 0030. A room under the pond

- Date: 2026-11-16
- Status: accepted (being built; the layout is agreed from a greybox, and a
  preview is on the site at an address nothing links to)

## Context

[0029](0029-no-name-the-third-ending.md) ends at a door and leaves what
it opens on to Jincheng. An earlier idea, a pond the visitor paints for
themselves, is dropped. He decided: under the pond is his own room, as it
is now, in three dimensions, in the manner of felixrieseberg.com (a desk
scene modelled in Blender and drawn live in the browser with baked
light), and of a quality no lower than that site's.

## Decision

- **The scene.** A desk seen from its seat. On it, an open MacBook Pro
  (dark grey, as his is) square in front, with no other keyboard or mouse. Above its screen,
  their lower edges on its lid's upper edge as seen from the seat, two
  monitors strictly side by side, in one plane and not turned toward the
  seat, on a dual arm clamped to the desk's back edge: a
  Samsung Odyssey OLED G8 (G80SD, 32 in) on the left and a Dell 27 on the
  right. Both are the MacBook's extended displays. Behind the desk the
  room's wall is glass from floor to ceiling. The desk top is a pale
  oak and the floor a beige carpet, as his are, and three keepsakes of
  his stand on the desk: a blue anniversary mug, a small figurine and a
  black cat plush, each modelled from his photographs of it. Their
  lettering is set from open-licence fonts until the art thread draws
  it; the fonts are not kept in the repository.
- **The view.** Outside the glass is what is outside his own window,
  in general terms and modelled, not photographed: the room is on an
  upper floor, with a narrow balcony (artificial turf edged with white
  pebbles, a parapet of lap siding under a white cap), beyond it at
  eye level a row of twisted junipers, behind them a taller tree with
  pinnate leaves (taken for a walnut) and a weeping pepper tree, and
  lower on one side a neighbour's steep roof. Each kind of tree is a
  species of its own in `scene.py` (how it grows, and its state in
  each season), so one can be changed for another.
- **The seasons.** The window shows the season of the visitor's own
  date, by the northern meteorological seasons (spring from March,
  summer from June, autumn from September, winter from December), each
  at the same dusk hour so the room's baked light fits them all; a
  press on the view outside turns to the next. The climate is a mild
  one where it does not snow, so the seasons are told quietly: the
  junipers and the pepper tree keep their leaves, the walnut comes
  into small leaf with catkins in spring, is full in summer, yellows
  and drops from the top in autumn and is bare in winter; autumn
  leaves dry leaflets on the balcony and a few drifting down; winter
  is the rainy season, grey and wet, with light rain falling. Snow was
  built first and taken out: it would have been untrue.
- **The map.** The Samsung shows a map of the United States with the
  states Jincheng has been to marked: Texas, Florida (Tampa), Ohio,
  Illinois (Chicago), Indiana, Wisconsin (Milwaukee), California,
  Washington (Seattle) and Georgia (Atlanta). Pressing a state opens the
  photographs he took there.
- **The other two screens** show real things, not stand-ins. The Dell
  shows the site's own desktop: a picture of `/os` at the screen's
  2560 by 1440 with the Projects and Macintosh HD windows open, kept as
  `public/room/screens/dell.webp`. The MacBook shows an editor in full
  screen with `src/room/season.ts` open, its text taken from the file
  when the site is built, and under it a terminal with the newest
  commits on `main` (their subjects only, kept in
  `src/room/terminal.json`) and the file's line count; `src/room/editor.js`
  draws it once on a canvas, in JetBrains Mono from the site's own
  bundle. Nothing on either names a person the site does not already
  name. Both are sent to the graphics card once and glow as the Samsung
  does. To make the picture and the terminal's lines again, from a
  built site being served:
  `node tools/pond/room/web/shot-screens.cjs [port]`. The clock, the
  time zone and reduced motion are pinned as the project covers' are,
  and nothing outside the site is fetched. `room.glb` still carries the
  two stand-in pictures these replace, until `export.py` leaves them
  out.
- **How it is made.** Modelled and lit in Blender from scripts kept in
  `tools/pond/room/` (`scene.py` builds it, `export.py` bakes the light
  and writes what the browser loads into `public/room/`: the model,
  Meshopt-compressed, the light maps, the outside as a picture for
  each season and a manifest). The room's light is baked once, in
  summer's dusk; the manifest carries for each season a small tint
  that sits the room with that season's sky. The page's code is `src/room/`, drawn with three.js, which
  the site bundles for that page alone; `tools/pond/room/web/` keeps only
  the helpers that make the map's outlines and take the page's picture.
  It is fetched only when a visitor goes down to it, never on a first
  visit.
- **The preview.** Until the way in is decided the room is at `/room`
  (`src/pages/room.astro`): nothing links to it, it asks search engines
  not to index it and it is not in the sitemap. That one path has its own
  Content Security Policy in `vercel.json`, the site's with two things
  three.js needs added: WebAssembly (the model's decoder) and reading
  `blob:` (the model's own pictures).
- **Where his home is** is not written anywhere in the repository: the
  scene says a bedroom, glass, a balcony and trees, and no more. The
  photographs he showed of the view and of his things were looked at
  and are not kept.

## Open

- The way in. As designed it is reached only after the third ending,
  which takes weeks; whether it should be easier is Jincheng's to say.
- The photographs, which he will add.

## Consequences

- The site gains a 3D library and a scene of some megabytes, held to a
  budget and loaded on demand.
- The pictures the scene needs (wood, metal, cloth, the trees' leaves
  and bark, the keepsakes' printed faces) are asked of the art thread;
  models are built here.
- Four backdrops are kept where one was. A visit fetches one, and
  another only when the season is turned.
