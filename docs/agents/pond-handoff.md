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
| `finish.cjs` | The finish checklist as contact sheets: each look's title page, chapters, album and command bar, and a phone sheet. About three minutes a look. |
| `layout.cjs` | Where every block of the title page stands in each look, and which differ from the water's: `node layout.cjs <dist> [w] [h] [lang]`. |
  | `terms.cjs` | Ink in each of the 24 solar terms. |
  | `ab.cjs`, `abdiff.py` | A deterministic A/B of two builds (seeded random, virtual clock, frames stepped by hand) and the largest pixel difference. |
  | `gest5.cjs` | Each look's gesture made with a real pointer, and which look arrives. |
  | `fishcost.cjs`, `pace-nogl.cjs`, `bench.cjs` | The fish layer's CPU time with `?perf`; frames drawn a second with WebGL off; the water shader alone, timed. |
  
## 2. The state of each look

Every look is live. "Preview only" marks what exists only in a build with `PUBLIC_POND_PREVIEW=1` (or with `?preview`).

| Look | State | Pictures in use | Delivered, not used | Wrong or unverified |
| --- | --- | --- | --- | --- |
| Water | Live. Unchanged but for the seal on a koi. The dove and the spider are sprites. | `water/dove-v2-1` to `-3`, `water/spider-v2-1` to `-3`, `water/lilies-768` (preview only) | none | Petals and the dragonfly are still drawn in code. The pictured pads were seen in summer and autumn at 1280 × 800; shipping them means 77 KB more on every visit, once the pond has settled. The sprites were seen in frame sequences in the water, ink and the blueprint (flight, landing, sitting, preening, take-off); the other looks' dress was made but not looked at. The spider reads as a dark soft shape on its pad, as the model did. |
| Ink | Live; Jincheng's favourite and the benchmark. Seasonal motif is now a painting, the lotus, reeds and plum growing in from the right edge itself; seasons put right. The seals everywhere are cut in small seal script. | `ink/willow`, `lotus`, `reeds`, `plum`, `seals` | none | Checked at 1280, 1440, 2000 and phone in summer only. Dry lotus stems asked for, not drawn. A seal being stamped in the corner was not pictured (the album and the inscription were). |
| Ukiyo-e | Live. Its arrival has a carved-wave front. In a preview build: the great crests on that front, wavelets round a press, painted koi. | `ukiyo/waves`, `koi` + mask (preview only) | none | The crests were judged in a 640 × 400 frame sequence only. The press's wavelets are small beside its two swell rings; whether the rings should thin is a matter of taste on a real screen. |
| Glow | Live. Goes dark, then relights in rings. | none wanted | none | Seen once in a frame sequence. |
| Blueprint | Live. Plots its lines before the paper's blue floods in. | none | none | Seen once in a frame sequence. |
| ASCII | Live. Resolves a cell at a time. | none wanted | none | Seen once in a frame sequence. |
| Monet | Live. Rebuilt on its paintings: bed, lilies, koi. | `monet/bed`, `bed-1280`, `bed-tall`, `lilies`, `koi-v2` + mask | `strokes`, `canvas` | The press is a soft dab from the shader, not the stamps. The dove is only dimmed. |
| 青花 | Live. Painted rim and corners; painted koi with visitors' colours through the mask; the frame is the page's margin. | `qinghua/rim`, `corner`, `koi` + mask | none | Lotus and the pads are still shader outlines. The tint through the mask has never been seen with a second visitor. |
| Dunhuang | Live. The flying figures are the wall; mural koi; nothing painted under the controls. | `dunhuang/feitian-pipa`, `feitian-flowers`, `feitian-far`, `sky-flowers`, `border`, `cloud-trail`, `halo`, `koi` + mask | `caisson`, `feitian-pipa-2560` (never fetched while the picture texture is at most 2048 across: see pond.md) | The caisson has no place. Seen at 1280 × 800, 1920 × 900 and a 390 × 844 phone; shorter phones are held by a test, not seen. |
| Star chart | Live. Koi drawn as constellations in code, the atlas's koi in outline behind each; the plate's grid in the sky. | `stars/grid`, `koi-figures` | none | Seen at 1280 × 800, a few seconds in. The grid tiles, so it has no edge as the sky turns; it is quieter than the framed plate it replaced. |
| Egyptian relief | Live. Built: carved and painted limestone under a light that goes round with the day; zigzag water; the frieze and a marsh of the delivered carvings; a chisel's strike for a press; sand blown off as it arrives; the zigzag gesture; the seal 刻. The blackboard is gone from the code. | `relief/fish`, `lotus`, `frieze` (each `-h` and `-c`), `koi-c-bold`, `koi-h-bold` + mask, `stone-h` | none | Seen at 1280 × 800 (dawn, noon, night), 1440 × 900 (dusk, and dawn with its own koi and stone), a phone in winter, and its arrival and a press in a 640 × 400 frame sequence. The carved koi are small on screen, so their cut scales are fine: to be judged on a real screen. Chapters, the album's stamp, the dove and the spider in its dress, and a second language were not looked at. |

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
- Layout: "切换字体的时候整个页面上的所有非风格部分的内容不要有乱跳的变动。也就是布局统一" (done: see
  "One layout in every look and language" in pond.md; keep it so).
- Seasons by look: "不是所有的界面都要有荷叶蜻蜓，季节特点要符合艺术风格"; the star chart's rain is a
  meteor shower.
- Pictures: "每一种风格尽可能的全部用自己独有的美术资产。能定制的就定制。"

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

1. **Dove and spider: the second renders are in.** The pond draws the two from the `-v2` sheets
   (three files each, packed into one picture in `sprites.js`); the first sheets are deleted. Seen
   with `tools/pond/life.cjs` on the water and in ukiyo-e only; the other dresses were not looked
   at again. The spider is darker than the first one and hard to make out on a dark pad. The
   dove's walking row and the spider's turned frames are not played.
2. **Everything ships**, by Jincheng's word: every look with its own pictures, the water's own
   pictures, the sprites, and the later details (moon, wind, festivals, fireflies, ambience). Only
   the panel that forces each state is behind `?preview`.
3. **Star chart:** whether the quiet grid is enough, or the atlas wants its equator and ecliptic back
   as a second, fixed layer: Jincheng's to say on a real screen.
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
10. **The finish checklist: one pass done from contact sheets.** `tools/pond/finish.cjs` makes, for each
    look, a sheet of the title page, every chapter, the album and the command bar at 1280 × 800, and a
    phone sheet. All ten were looked at (in winter, English). Fixed: the command bar was dark glass
    under dark type in 青花, Dunhuang and the relief. Since then: a painted koi under the
    title's type is at half strength in ukiyo-e; in the relief a koi passes behind the tomb's
    carvings; 青花's medallion is paler. Left: ink's koi cross the greeting on a phone, as on the
    water; the Preview pill sits on the search box on a phone (preview builds only). Not covered by
    the sheets: hover, focus rings, scrollbars, selection, sounds, the other
    seasons and languages.
11. **The final review by an independent reviewer:** looks × seasons × weather × chapters ×
    desktop and phone × En, 中, 日.
12. **Performance on a real Mac with `?perf`:** frame rate, GPU time and scale in each look and
    through each arrival. Nothing here could measure that (see the traps).

The round asked of the local thread came back whole (nine looks' pictures, and each painted look's
sheet of what drifts and flies), and it is wired in: each look's own lily pads, drift, flyers, dove
and spider (`LOOK_ART`), ukiyo-e's painted water, 青花's medallion, the relief's papyrus, duck and
cartouche, Monet's autumn pads, the water's drift and dragonfly, the dragon boat and the lanterns.
Seen once each, in summer at 1280 × 800. Not used: ink's `stems`, ukiyo-e's `paper`, Monet's
`strokes` and `canvas`, Dunhuang's `caisson`. Not looked at: autumn, winter and spring in each look,
the dove and spider's own pictures in motion, phones, the festivals.

Asked of the local thread since this page was first written, delivered, and in use: the relief's koi
sheet and stone face, then a lighter lily sheet for the water, a grid that tiles for the star chart,
and a bolder cut of the relief's koi. The files each replaced are deleted.

- **The first frame builds only the water's pass.** The whole pass, with every look in it, is built
  in the background once the pond has settled (or when a look is first asked for). Built before the
  first frame, as it once was, it held the main thread for seconds under a software GPU: CI's smoke
  test timed out waiting for the page's `load` with its own fonts still unanswered. A new look
  makes the whole pass longer; never build it before the first frame.

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
