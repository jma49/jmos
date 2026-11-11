# 0025. The pond

- Date: 2026-11-11
- Status: accepted

## Context

Jincheng wanted the site to stop looking like ryOS, whose design, layout
and assets JM/OS shares ([0001](0001-keep-the-retro-assets.md)), and to
stand with personal sites such as hux.pro in finish while being its own.
After several prototypes he chose a pond seen from above: a ripple
simulation with koi, lily pads and the year's 24 solar terms, glass drawn
in the same shader, Devot's dove and ocra's jumping spider as three.js
models, and a title page on the water with chapters that open as a sheet
of glass. Turned down on the way: a two-scene site (a wire scene beside
the pond; far less real than the water, and no good point to switch), a
"ten thousand days" timeline, a letter over the pond (he preferred the
glass), cards on the water in a grid, in stepping stones and in two
banks (the type has to sit on calmer water, which cards over a busy pond
never did), and a chart-like timeline beside the one in soundings.

## Decision

- The pond is built at `/pond` beside the desktop, which stays at `/`
  until the pond has everything the home page needs; then they swap
  (ROADMAP.md). The desktop's code is kept in the private repository
  `jma49/jmos-classic` as well as in this one's history.
- It keeps the desktop's accounts, chat, guestbook and presence (the
  same backend and rules), reached from the command bar, a Chat button
  that counts who's here, and chapters. Stickies, AirDrop, Soapbox and
  the apps and applets don't come along for now.
- Photos come from Unsplash at build time, newest first, at full size in
  the viewer; the music is the library the iPod plays.
- The engine (`src/pond/engine.js`, `life.js`) is plain JavaScript,
  ported from the prototype as it was, with the parts that reach the rest
  of the site (`music.ts`, `people.ts`, `content.ts`) in TypeScript.
  Typing 4,500 lines of tuned drawing code would have been a rewrite
  with nothing to check it against; typing it section by section, with
  the prototype's behaviour to compare, is left for later.
- Type: a serif (Cormorant Garamond, self-hosted) for what is set large,
  the solar term in a brush hand (Zhi Mang Xing, cut to its characters), the
  system's sans for the rest, no monospace labels or tracked capitals:
  Jincheng found those read as machine-made.
- three.js (about 126 KB gzipped, with the models) loads only once the
  pond has settled, never with the first screen.

## Consequences

- [0001](0001-keep-the-retro-assets.md), [0013](0013-a-hideout-not-a-portfolio.md)
  and [0021](0021-nothing-is-added-to-the-desktop.md) hold for the
  desktop while it is the home page, and lapse with it.
- The pond has its own map, [docs/agents/pond.md](../agents/pond.md),
  and the smoke test opens it and each of its chapters.
- The engine isn't type-checked; a change to it is checked in a browser
  (motion on and off, a phone width, winter and summer) and by the smoke
  test.
