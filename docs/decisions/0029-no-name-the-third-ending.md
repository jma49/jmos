# 0029. No name: the pond's third ending

- Date: 2026-11-16
- Status: accepted (built as far as the door; what lies under the pond is not decided)

## Context

[0028](0028-the-pond-has-three-endings.md) gave the pond three endings and
left the third designed only. The second ends with the visitor holding
the seal 真, the first in the album that is not a master's. The third is
for whoever goes back after that. Jincheng chose how long it takes (three
solar terms), that it is built up to its end with the pond's bed left for
later, and that the pond should age as visitors finish it.

## Decision

Everything the pond has asked of a visitor so far is to touch it. The
third ending asks for the one thing it never has: to leave it alone.

- **The gold koi leaves.** From the day after the seal 真 is stamped, the
  gold koi is missing from three looks, in the order of the strokes; once
  the solar term has turned, from three more; once it has turned again,
  from the last four. Nothing says so: a visitor finds a look without it.
- **A look left alone fades.** In a look the gold koi has left, with no
  press, no pointer moved and no key for three quarters of a minute, the
  pond slows and then the look draws in, slowly, to the visitor's koi,
  and the water is under it. That look has faded: its seal in the album is
  pale. The look can still be chosen; the gold koi stays gone from it.
- **Three solar terms.** The first three looks can fade at once, so the
  whole takes at least what is left of one term and two more: four to six
  weeks, and no one day. The term has stood in the corner of the page all
  along; it is the only clue.
- **The end.** When the tenth look has faded the gold koi comes back over
  the plain water, and it is not gold any more. No seal is stamped: this
  ending has no name.
- **No hints.** The second ending is told slowly; this one is not told.
- **It is kept with the seals,** in this browser, and cleared with them.
- **The pond ages.** Every visitor who reaches the end is counted once by
  the database (`pond_endings`, by a salted hash of their address), and
  the count fades the looks a little for everyone: a loss of colour while
  a look is on show, `1 - exp(-n / 150)` of the way. One visitor cannot
  be seen; it is meant to take years.

## Not built yet

- **What is under the pond.** The end is a door: `nameless()` in
  `src/pond/seals.ts` says a visitor has reached it. It opens on his room
  ([0030](0030-a-room-under-the-pond.md)), which is being built.

## Consequences

- The album keeps one more thing, the looks that have faded.
- The gold koi can be absent, so nothing in a look may depend on it being
  there: pressing it to go back to the water has the control beside it.
- The wait is measured on the wall clock, since a look may slow the
  pond's own.
