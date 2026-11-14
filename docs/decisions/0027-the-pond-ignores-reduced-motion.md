# 0027. The pond ignores reduced motion

- Date: 2026-11-14
- Status: accepted

## Context

The pond honoured the system's reduced-motion setting: a look came in as a
plain cross-fade instead of its arrival (ink spreading, the print's wave,
the night falling), and the water stood still (no swell, no light moving
on the bed). Jincheng found the looks had no arrival on his computer,
though they had one on his phone: the computer asked for reduced motion
(macOS's Reduce motion, or Windows with animations off), the phone did
not. Each look's arrival is the point of the look, and he asked that the
pond not be built around accessibility settings.

## Decision

The pond moves the same on every device, whatever the system asks of
motion: `RM` in `src/pond/engine.js` is `false`, and `pond.css` has no
reduced-motion rules. The branches on `RM` stay, as a quiet mode should
one be wanted. The desktop (`/os`) is unchanged.

## Consequences

- A visitor who asked their system for less motion sees the pond's motion
  anyway: the swell, the arrivals, the controls gliding to a look's places.
- A computer and a phone show the same pond, so what is checked on one
  holds on the other.
