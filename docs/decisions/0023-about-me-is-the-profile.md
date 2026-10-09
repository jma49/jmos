# 0023. About Me is the profile

- Date: 2026-10-08
- Status: accepted

## Context

Jincheng wanted one link to share that introduces them: who they are,
their projects, and a quick way to the résumé. About Me was a page of
work history, close to the Résumé, and the projects lived in a separate
Finder window.

## Decision

About Me is the profile, and `/profile` opens it: a temporary redirect
to `/?open=about`, like the old résumé PDF links, so it can point
elsewhere later. It reads like a status page, after
[ryo.lu](https://ryo.lu/): one large sentence on what Jincheng is doing
now, a few lines on who they are rather than their jobs, short lists
(things to open here, past work, where to find them), then the projects
as cards. The words are `summary` in `src/content/site.ts`.

A standalone `/profile` page, outside the desktop, was turned down: it
would be a second rendering of the same content to keep in step, and
JM/OS is the introduction ([0013](0013-a-hideout-not-a-portfolio.md)).

## Consequences

- The bios stay in `site.ts`: the short one for the Résumé's profile,
  the Terminal, the screen saver and the plain-text copy of the page, the
  long one for `llms.txt`. About Me uses neither, so the desktop no longer
  gets the long one.
- Nothing is added to the desktop or the Dock
  ([0021](0021-nothing-is-added-to-the-desktop.md)); About Me was already
  on it.
