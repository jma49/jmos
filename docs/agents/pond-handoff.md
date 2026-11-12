# The pond's looks: handoff (2026-11-12)

For whoever picks this work up next, with no memory of how it got here. It covers the branch
`cloud/youthful-bardeen-mq3cpl`: five looks added as previews, a seal album, a second performance
pass, and the move from drawing things in code to painted pictures. How the pond itself works is in
[pond.md](pond.md); this page is the state of the work, what is left, and what was learnt.

## 1. Where things are

- **Branch and PR:** `cloud/youthful-bardeen-mq3cpl`, draft PR
  [jma49/jmos#294](https://github.com/jma49/jmos/pull/294). It stays a draft and is not merged until
  Jincheng approves. Push to no other branch.
- **Two threads work on the branch.** An agent in the cloud writes the code; an agent on Jincheng's
  own machine makes the pictures (an image model and Blender are only reachable from there) and
  commits them to the same branch. They talk through the doc: the art brief and its wanted lists
  under "Pictures for the looks" in [pond.md](pond.md). Always `git pull --rebase origin
  cloud/youthful-bardeen-mq3cpl` before a push; the other thread pushes often. Don't edit the
  delivered-pictures tables that thread writes; add what is wanted to the brief.
- **The demo** is one self-contained HTML file published as an artifact:
  <https://claude.ai/artifact/LT41KxtTa8V65mrLMpxjMJ>. To rebuild and republish it:

  ```bash
  PUBLIC_POND_PREVIEW=1 npx astro build --outDir /tmp/pond-demo
  ```

  ```bash
  node tools/pond/inline.mjs /tmp/pond-demo /tmp/pond-looks.html
  ```

  Then publish `/tmp/pond-looks.html` to that artifact's URL (keep the same URL). The inliner needs
  `pyftsubset` (fontTools) on the path, and `esbuild`, which is no longer among the site's dependencies
  (`npm i --no-save esbuild`). It inlines every picture under `/pond/<look>/` it finds named
  in the script, so a new look's folder must be added to the list in its `swap` line. The build flag
  turns on the preview looks and the Preview panel (bottom centre: every look, the album, "Stamp all
  seals", "Clear seals", dates, weather).
- **Tools kept from the session** are in `tools/pond/` (they were scratch files; they work, they are
  not polished). All take a built `dist` directory as their first argument and write pictures into a
  folder beside themselves (ignored by git). They run headless Chromium with a software renderer.

  | Tool | What it does |
  | --- | --- |
  | `inline.mjs` | The build into one HTML file, for the artifact. |
  | `pol.cjs` | Title-page screenshots of given looks at a given size and scale; `DATE=<month index>` shifts the date (seasons), `SHEET=1` adds a chapter, `WAIT` the settle time. |
  | `demo.cjs` | The album in each state and language, a stamp in each look, each new look's title, chapter, press and winter. |
  | `trans.cjs`, `koi.cjs` | Frame sequences on a virtual clock: a look arriving and leaving (`PRESS=x,y` adds a press and what it leaves); a look's painted koi swimming, turning and curling (`koi.cjs <dist> <look>`). |
| `life.cjs` | The dove and the spider through their states, as strips of crops round each, in the looks given (`HOUR` sets the time of day). It opens the page with `?perf`, which hands their places to `window.__pond`. Slow: six minutes a look and more. |
| `virtual.cjs` | The virtual clock the newer tools share. |
| `glide.cjs` | The layout glide between looks, measured: where each block stood, where it is drawn the moment the look's styles apply, where it ends. |
  | `terms.cjs` | Ink in each of the 24 solar terms. |
  | `ab.cjs`, `abdiff.py` | A deterministic A/B of two builds (seeded random, virtual clock, frames stepped by hand) and the largest pixel difference. |
  | `gest5.cjs` | Each look's gesture made with a real pointer, and which look arrives. |
  | `fishcost.cjs`, `pace-nogl.cjs`, `bench.cjs` | The fish layer's CPU time with `?perf`; frames drawn a second with WebGL off; the water shader alone, timed. |
  
## 2. The state of each look

"Preview" means it exists only in a build with `PUBLIC_POND_PREVIEW=1`.

| Look | State | Pictures in use | Delivered, not used | Wrong or unverified |
| --- | --- | --- | --- | --- |
| Water | Live. Unchanged but for the seal on a koi. In a preview build the dove and the spider are sprites. | `water/dove`, `water/spider` (preview only; placeholders, being redone), `water/lilies` (preview only) | none | Petals and the dragonfly are still drawn in code. The pictured pads were seen in summer and autumn at 1280 × 800; shipping them means 157 KB more after the first screen, which the image budget (982 of 1100 KB) doesn't have room for as it stands. The sprites were seen in frame sequences in the water, ink and the blueprint (flight, landing, sitting, preening, take-off); the other looks' dress was made but not looked at. The spider reads as a dark soft shape on its pad, as the model did. |
| Ink | Live; Jincheng's favourite and the benchmark. Seasonal motif is now a painting; seasons put right. | `ink/willow`, `lotus`, `reeds`, `plum` | none | Checked at 1280, 1440, 2000 and phone in summer only. Dry lotus stems asked for, not drawn. The seals are still the brush face, not seal script. |
| Ukiyo-e | Live. Its arrival has a carved-wave front. In a preview build: the great crests on that front, wavelets round a press, painted koi. | `ukiyo/waves`, `koi` + mask (preview only) | none | The crests were judged in a 640 × 400 frame sequence only. The press's wavelets are small beside its two swell rings; whether the rings should thin is a matter of taste on a real screen. |
| Glow | Live. Goes dark, then relights in rings. | none wanted | none | Seen once in a frame sequence. |
| Blueprint | Live. Plots its lines before the paper's blue floods in. | none | none | Seen once in a frame sequence. |
| ASCII | Live. Resolves a cell at a time. | none wanted | none | Seen once in a frame sequence. |
| Monet | Preview. Rebuilt on its paintings: bed, lilies, koi. | `monet/bed`, `bed-1280`, `bed-tall`, `lilies`, `koi-v2` + mask | `strokes`, `canvas` | The press is a soft dab from the shader, not the stamps. The dove is only dimmed. |
| 青花 | Preview. Painted rim and corners; painted koi with visitors' colours through the mask; the frame is the page's margin. | `qinghua/rim`, `corner`, `koi` + mask | none | Lotus and the pads are still shader outlines. The tint through the mask has never been seen with a second visitor. |
| Dunhuang | Preview. The flying figures are the wall; mural koi; nothing painted under the controls. | `dunhuang/feitian-pipa`, `feitian-flowers`, `feitian-far`, `sky-flowers`, `border`, `cloud-trail`, `halo`, `koi` + mask | `caisson`, `feitian-pipa-2560` (never fetched while the picture texture is at most 2048 across: see pond.md) | The caisson has no place. Seen at 1280 × 800, 1920 × 900 and a 390 × 844 phone; shorter phones are held by a test, not seen. |
| Star chart | Preview. Koi drawn as constellations in code, the atlas's koi in outline behind each; the plate's grid in the sky. | `stars/plate`, `koi-figures` | none | Seen once, at 1280 × 800, a few seconds in. The grid repeats mirrored: where a mirror line crosses the window the meridians kink; not seen after minutes of turning. |
| Egyptian relief | Preview. Built: carved and painted limestone under a light that goes round with the day; zigzag water; the frieze and a marsh of the delivered carvings; a chisel's strike for a press; sand blown off as it arrives; the zigzag gesture; the seal 刻. The blackboard is gone from the code. | `relief/fish`, `lotus`, `frieze` (each `-h` and `-c`), `koi-c`, `koi-h` + mask, `stone-h` | none | Seen at 1280 × 800 (dawn, noon, night), 1440 × 900 (dusk, and dawn with its own koi and stone), a phone in winter, and its arrival and a press in a 640 × 400 frame sequence. The carved koi are small on screen, so their cut scales are fine: to be judged on a real screen. Chapters, the album's stamp, the dove and the spider in its dress, and a second language were not looked at. |

Jincheng's words that still stand:

- Ink: "梅花和荷叶是不能在一个地方同时出现的，这种常识问题不要犯错" (fixed at the source, with a
  test; keep it so).
- Monet's synthesised strokes: "这个完全都不是优化风格了，太杂乱了". After the paintings went in:
  "很好就是这样". No stroke synthesis in the shader again.
- Koi: "最好是每个风格的鱼都有自己专属的素材".
- Pictures over code: "把一些不协调的代码生成的素材用真实的图像资产替代"; "我建议每个风格的主要素材
  都用本地线程去做，你给出明确的指引".
- The Blender sheets: "鸽子不够细致，不够写实，参考现实中的鸽子去做。跳蛛的细节还要继续优化。"
- The blackboard: "明显比其他的差很多…首先考虑换掉这个风格" (replaced by the Egyptian relief).
- Layout between looks: "如果组件位置有变化，切换的时候丝滑一些".

## 3. What ships when

- **On main already:** the six looks, the weather, the first performance pass (PRs 287 to 292).
- **In this branch, ready in a release build (no flag):** the second performance pass (each look its
  own shader pass, GPU-timed adaptive scale, quiet pace when covered or in the background); the
  seal album and the one-line hint; ink's painted motifs and the season rules; each live look's own
  arrival; reduced motion as a cross-fade (never run under reduced motion: test it first).
- **Preview only (`PUBLIC_POND_PREVIEW=1`):** Monet, 青花, Dunhuang, the star chart, their gestures,
  commands and seals, painted koi, the Preview panel. `?preview` in the address also turns the
  panel's festival and weather previews on in any build of this branch; `?perf` shows the numbers
  overlay (fps, CPU per part, GPU time, which pass, scale).
- **Open decision:** in a release build the album's first volume is only ink and ukiyo-e, and the
  second glow, blueprint and ASCII. Whether the album ships before the new looks do, with volumes
  that small, is Jincheng's call.
- Ink's painting commits (`31081b0`, `f6cfdeb`, `85fa581`, `57488f6`) were kept self-contained so
  they can ship first.

## 4. The queue, in order

Done since this page was first written, in a preview build (each its own commit): the dove and the
spider as sprites, with three.js and `life.js` no longer fetched; ukiyo-e's crests and koi; the star
chart's plate and figures; Dunhuang's halo, its koi, and nothing painted under the controls; Monet's
koi moved to the common sheet. What is left of those:

1. **Dove and spider: the release build.** Waiting on the revised renders (the brief says what). When
   the `-v2` sheets come: point `SHEETS` in `sprites.js` at them, set the frame counts and order in
   `doveFrame()` and `spiderFrame()` (and in `sprites.test.ts`), look at every look's dress with
   `tools/pond/life.cjs`, then draw them from sprites in a release build too and delete `life.js`,
   the three.js dependency and the models' half of `drawDove()` and `drawSpider()` (about 500 KB,
   130 KB gzipped, and a 512 px 3D render a frame while the dove is out).
2. **Ukiyo-e, to ship:** the crests and the painted koi are behind the preview flag (`CRESTS` in the
   pass, `KOI_SHEETS`). Shipping them means the look fetches its pictures in a release build: a
   decision for Jincheng once he has seen them on a real screen.
3. **Star chart:** look at the grid after the sky has turned a while; if the mirror line's kink shows,
   ask for a plate that tiles.
4. **Dunhuang:** a place for the caisson (the album page or a chapter's header for this look; the
   wall's left is the title's). `feitian-pipa-2560.webp` and its line in
   `scripts/check-public-sizes.mjs` can go unless the picture texture is to grow past 2048.
5. **Layout glides between looks: done, to be felt on a real screen.** When a look's styles apply,
   the title block, the clock, the three groups of controls, the gauge and the Preview pill ease from
   where they stood to where the look puts them (`glide()` in `engine.js`: measured before and after,
   a transform laid over their own, 640 ms), and the controls only dim to 0.4 through a change instead
   of vanishing. The type of the title page still fades out and back, since its face changes: a true
   cross-fade in place would need the old look's styles kept on a copy, which the selectors
   (`#pond[data-look]`) don't allow without a rewrite. `tools/pond/glide.cjs` prints each block's
   place before, at the swap and after; it was right for 青花 and Dunhuang at 1280 × 800. Not done:
   a performance trace for reflow (two rounds of `getBoundingClientRect` on seven elements, once a
   change of look).
6. **Egyptian relief: built; to be finished.** How it is drawn is in pond.md ("Egyptian relief").
   Left: the cartouche round the solar term (not delivered); its chapters and stamp through the
   finish checklist (item 10); how strong the light and the stone's dressing should be, which is a
   matter for a real screen.
7. **Exits designed** where the arrival run backwards looks wrong (only the stars have their own).
8. **Reduced motion: seen once.** Every look was brought in and sent back under reduced motion
   (`RM=1` with `tools/pond/pol.cjs`): each cross-fades in and out with no error. Seen as stills at
   800 × 500 only; glow's page type is still hidden 1.5 s into leaving, where the others' has come
   back, which may only be its longer fade.
9. **A visitor's colour on painted koi: seen with visitors who are not there.** With `?perf` a tool
   can show koi for visitors who are not there (`window.__pond.visitors`; `VISITORS=1` with
   `tools/pond/pol.cjs` or `koi.cjs`). Three were added, in blue, violet and green: in ukiyo-e and
   Monet their patches take the colour through the mask and read clearly; in 青花 the colour is laid
   under the cobalt wash and is pale, paler still under the title. Whether 青花 should show a
   visitor's colour more strongly, or keep to cobalt, is Jincheng's to say. Not done with two real
   browsers signed in.
10. **The finish checklist, ink as the benchmark,** for every look: title page; every chapter
    (Timeline, Photos, Music, Notes, Chat, About, Account, ⌘K, the album) with rules, buttons, focus
    rings, scrollbars, selection, hover, the photo viewer; the press; tags; gauge; clock and term;
    dove and spider; seasons and weather; the stamp; sounds; phone. Report fixes by look.
11. **The final review by an independent reviewer:** looks × seasons × weather × chapters ×
    desktop and phone × En, 中, 日.
12. **Performance on a real Mac with `?perf`:** frame rate, GPU time and scale in each look and
    through each arrival. Nothing here could measure that (see the traps).

## 5. Rules learnt the hard way

- **Jincheng's standing preferences:** things line up exactly; no labels or copy that read as
  machine-made; plain wording in all three languages; the seasons make common sense; calm beats
  clever; a painted picture wherever code-drawing looks rough; nothing added to the cost of a frame;
  the picture's quality never traded for speed. Ink is the standard every look is held to.
- **Before every push:** `npm run check` (0 errors and 0 hints: CI failed once on an unused
  directive that only this shows), `npm run lint`, `npm run format:check`, `npm test`, `npm run
  build`, `npm run test:smoke`, `npm run perf`, `node scripts/check-public-sizes.mjs`, `node
  scripts/check-doc-paths.mjs`. Then pull with rebase, then push.
- **Only this branch.** The PR stays a draft. Commit messages and docs say what a thing does, not
  how it came about.
- **A look must work without its pictures** and take each as it comes; pictures load with their
  look, never on the first visit.
- **One commit for one thing**, so a piece (ink's paintings, say) can ship alone.
- **Software-rendered screenshots judge stills only:** composition, colour, overlap. They can't
  judge frame rate, fades or anything timed.

## 6. Known traps

- **The headless renderer is slow (one to five frames a second).** Anything that eases over frames
  looks unfinished in a screenshot taken too soon: the tree's shade fading from a look that has
  none, CSS animations (the stamp sits at its first frame; the tools force it), the shade's grey
  smudges on 青花 and Dunhuang. Wait longer (`WAIT=22000`) or judge on a real machine.
- **Gestures are timed by the pointer events' own timestamps.** Under slow frames a scripted press
  can turn into a hold (ink) or miss; `gest5.cjs` loads a fresh page for each. A scripted click that
  lands on the gold koi takes the pond back to water.
- **The virtual-clock harnesses** (`ab.cjs`, `trans.cjs`) replace the clock, timers and
  `requestAnimationFrame`, turn off audio and CSS animation, and block three.js; they are
  deterministic only because of all four.
- **Size budget:** 200 KB a file in `public/`. A picture over it needs a line in
  `scripts/check-public-sizes.mjs` with its reason (Dunhuang's large figure and Monet's bed have one).
- **Doc paths:** `scripts/check-doc-paths.mjs` fails on a path in backticks that doesn't exist. A
  folder asked for but not delivered goes in its `ALLOWED` list; a file wanted is named without its
  folder.
- **The one picture texture** (`uMural`, unit 10) holds the picture of the look last asked for
  (Dunhuang's wall, Monet's bed, 青花's rim, the star chart's plate, ukiyo-e's crests). Going straight from one of those looks to another
  swaps it while the old look is still on screen.
- **`PREVIEW`** in `engine.js` comes from the build flag on this branch's release path and also from
  `?preview` (via `preview.js`); a release build of this branch therefore shows the preview looks to
  anyone who adds `?preview`. Decide before merging whether that is wanted.
