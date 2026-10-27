# 0024. The Browser opens on ocra's page here

- Date: 2026-10-26
- Status: accepted

## Context

The Browser opened on `ocra.majincheng.com`, a copy of ocra's landing
page built for it. ocra moved to its own address, `ocracloud.com`, and
the old host now answers with a redirect there. ocra's new site sends
`frame-ancestors 'none'` and `X-Frame-Options: DENY`, as Assay's and
Devot's do, so the Browser could no longer show its own home: the window
opened on "doesn't allow other sites to show it". The smoke test, which
serves the build without the `/api/framing` function, tried the frame
and failed on the CSP violation that followed.

## Decision

The Browser's home is ocra's page on this site, `/projects/ocra/`, kept
as a path (`BROWSER_HOME` in `src/config/site.ts`) and turned into an
address on the origin the site is running on. `frame-src` in the
Content Security Policy gains `'self'` so a page here may frame another.

Going back to an outside site was turned down: every project's site
refuses framing, so the home would open on a notice again. A new page
for the home was turned down too: the site has one already, and a second
copy of the same words would drift ([0023](0023-about-me-is-the-profile.md)).

## Consequences

- The home loads from the same build as the desktop, with no request to
  another site and no call to `/api/framing`.
- The smoke test frames the site's own page, so it no longer depends on
  another site's headers (or on that site being up) to pass.
- The home is a real page: its links leave the Browser's home, and
  "Open in JM/OS" on it loads the desktop inside the frame.
- The year menu still reaches the Internet Archive directly
  ([0012](0012-the-browser-frames-the-archive-directly.md)); only the
  home stopped using an outside address.
- If ocra ever has a page that allows framing, the home can go back to
  it by changing `BROWSER_HOME` and the policy together.
