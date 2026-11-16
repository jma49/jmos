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
  square in front, with no other keyboard or mouse. Above its screen,
  their lower edges on its lid's upper edge as seen from the seat, two
  monitors strictly side by side, in one plane and not turned toward the
  seat, on a dual arm clamped to the desk's back edge: a
  Samsung Odyssey OLED G8 (G80SD, 32 in) on the left and a Dell 27 on the
  right. Both are the MacBook's extended displays. Behind the desk the
  room's wall is glass from floor to ceiling, and outside it, close, one
  big tree.
- **The map.** The Samsung shows a map of the United States with the
  states Jincheng has been to marked: Texas, Florida (Tampa), Ohio,
  Illinois (Chicago), Indiana, Wisconsin (Milwaukee), California,
  Washington (Seattle) and Georgia (Atlanta). Pressing a state opens the
  photographs he took there.
- **How it is made.** Modelled and lit in Blender from scripts kept in
  `tools/pond/room/` (`scene.py` builds it, `export.py` bakes the light
  and writes what the browser loads into `public/room/`: the model,
  Meshopt-compressed, the light maps, the garden as a picture and a
  manifest). The page's code is `src/room/`, drawn with three.js, which
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
  scene says a bedroom, glass and a tree, and no more.

## Open

- The way in. As designed it is reached only after the third ending,
  which takes weeks; whether it should be easier is Jincheng's to say.
- The photographs, which he will add.
- What the Dell and the MacBook's own screen show.

## Consequences

- The site gains a 3D library and a scene of some megabytes, held to a
  budget and loaded on demand.
- The pictures the scene needs (wood, metal, cloth, the tree) are asked
  of the art thread; models are built here.
