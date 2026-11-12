# 0026. Looks, found by gestures

- Date: 2026-11-12
- Status: accepted

## Context

Ink and paper (墨) shipped as a switch beside the pond's controls. Jincheng
then asked for more looks, each with its own type and words, and reviewed
a demo of five: ink, ukiyo-e, glow, blueprint and pixel. He found pixel
too busy (the stones turned to noise) and asked for an ASCII look in its
place. He did not want the looks behind buttons, but found "in some
inventive way". The language was to be chosen apart from the look, with
Japanese added. The first demo of ukiyo-e in rain turned the whole pond
into foam, and he asked that each look keep only the weather and seasons
it can draw well, and drop the rest.

## Decision

- Six looks: water, ink, ukiyo-e, glow, blueprint and ASCII. Each is a
  function in the water's shader; ASCII's characters are drawn in the
  glass pass. One front brings any look in over another, and the water
  back.
- Each look is found by a gesture on the water:
  - ink: hold still for 1.2 s (I and 墨 still work);
  - ukiyo-e: stir the water once round;
  - glow: press the light on the water;
  - blueprint: draw a long straight line;
  - ASCII: type five letters that aren't shortcuts. On a phone, type
    "ascii" or "text" in ⌘K.

  Each gesture shows a cue while it builds, so an ordinary press or
  stroke never surprises. Pressing the gold koi (Jincheng's) in any look
  brings the water back, and it takes precedence over whatever lies above
  it. ⌘K finds the looks when they are searched for, and never lists
  them.
- The language is its own switch: English, 中文 or 日本語. Chinese stays in
  the brush. Japanese is set in Yuji Syuku and Shippori Mincho, with
  M PLUS 1 Code in ASCII and Klee One in blueprint.
- Each look keeps only the weather it can draw well. Rain falls in water,
  ink (dry strokes), ukiyo-e (Hiroshige's straight lines) and ASCII
  (falling characters). Glow and blueprint hold the rain off. Ice and
  snow are drawn in every look, in that look's idiom, and cracking the
  ice works in all of them.
- Each look has its own quiet sounds: brush and paper, wood and koto, a
  soft shimmer, pencil and ruler, keys. They play for a press, the ice
  cracking, a gesture's cue and the look coming in.
- The looks' type and Japanese load the first time a look or 日 is
  chosen (`looks.css`, linked at run time), so a first visit costs what
  the water alone costs.

## Consequences

- [0025](0025-the-pond.md)'s rule of no monospace holds for the water and
  ink. Blueprint and ASCII set their own type in monospace on purpose:
  it is their medium.
- A new chapter or control needs its colours in each look's rules in
  `pond.css`, as ink already required.
- The gestures are part of the engine and aren't type-checked. Check them
  with a mouse and on a touch screen.
