# The pond's looks: handoff (2026-11-12)

For whoever picks this work up next, with no memory of how it got here. It began as the handoff of
the branch `cloud/youthful-bardeen-mq3cpl`: five looks added as previews, a seal album, a second
performance pass, and the move from drawing things in code to painted pictures. All of that is on
main now. How the pond itself works is in [pond.md](pond.md); this page is the state of the work,
what is left, and what was learnt. What is open now is section 0.

## 0. Open now: pictures for the small games

- **For the picture thread, asked 2026-11-17: repaint the keepsakes' paint,
  `public/room/keepsakes.webp`.** This is the one picture wanted now; it comes before
  everything else in this section.

  _What it is._ The room under the pond (`/room`, unlinked;
  [decision 0030](../decisions/0030-a-room-under-the-pond.md)) has three of Jincheng's own
  keepsakes on its desk: a blue mug, a small vinyl figurine and a black cat plush. He asked that
  they be true to the real things ("我给你的纪念物要准确还原"). Their shapes are modelled; everything
  printed, stitched or painted on them is one picture, 1024 × 1024, that the page lays on them.
  What is there now was painted by a script from fonts and flat shapes
  (`tools/pond/room/atlas.py`), and it is the weakest part of the three: the lettering is the
  wrong face, the embroidery is a font, the cloth is a flat colour.

  _What to look at._ Ask Jincheng to paste his photographs of the three into your thread (he has
  seven: the plush from the front, the side and the back; the figurine from three sides; the
  mug). They are reference only: never commit them, never put them in `public/`, never send them
  to a service other than the image model you already use, and do not read or record their
  metadata. Paint from them; do not paste pieces of a photograph into the picture, because a
  photograph carries its own light and the room lights these itself.

  _What to deliver._ One file, the same name and size, replacing the one there: 1024 × 1024,
  opaque, sRGB, WebP, under 150 KB (`cwebp -q 88 -m 6`). Keep a lossless master beside the
  scripts as "keepsakes.png" in a new folder "tex" under `tools/pond/room`. Nothing else changes: the model
  only holds where each surface lies on the picture, so the islands must stay exactly where
  they are. Their rectangles (left, top, right, bottom, from the top left) and what each must
  hold are listed under "the keepsakes' paint" in item 7 of "Asked for now" in
  [pond.md](pond.md), with the positions of the eyes, the nose and the lettering;
  `tools/pond/room/atlas.json` has the same rectangles. Do not run `atlas.py` after you
  deliver: it writes over the file.

  _The islands, in the order they matter, and what is wrong with each now._
  1. `mug` (0, 0, 1024, 352). The lettering. The real one is a white dry-brush hand: heavy
     forward-slanted capitals with streaked, ragged stroke ends, the R of ROAD larger with a
     long leg, the line climbing a little to the right; "HAPPY ANNIVERSARY" under it in the
     same hand, about a third the size. Keep both lines centred where they are, (512, 154)
     and (512, 208), and "ON THE ROAD" about 530 pixels wide: wider and it runs round the
     side of the mug. The glaze round it stays one flat blue, `#5879d4`, because the rest of
     the mug is that blue in the model; no gloss, no reflection, no shading.
  2. `plush-back` (512, 496, 896, 766). "Hawaii" as embroidery: a white stitched script,
     heavier and more slanted than the thin font there now, with the thread's direction
     showing in each stroke, about 265 pixels wide, climbing to the right.
  3. `plush-face` (0, 496, 512, 856). The eyes as cloth: white terry with a raised
     satin-stitch rim; the viewer's left pupil stitched, with a faint grey ring, the right
     one solid black; the nose as orange-brown satin stitch. Keep the eyes' middles at
     (129, 691) and (383, 691) and the nose at (256, 754). The ground is charcoal plush,
     `#58575f`: give it a short nap, evenly, with no light from any side.
  4. `plush-print` (0, 352, 1024, 496). The pineapple print as ink in yellow plush: orange
     lines in an even diamond grid with one dot in each diamond, a little uneven as a print on
     pile is. It wraps the body: the last 20° repeat the first, so the left 54 pixels and the
     right 54 pixels must match, and the pattern must run to the top and bottom edges.
  5. `plush-glasses` (0, 856, 512, 1024). Red felt with its fibre; the two lenses as black
     plush, their middles near (148, 942) and (364, 942); one curved white stitch across the
     top of each. The model cuts the outline, so fill the island with red to its edges.
  6. `plush-ear` (896, 496, 1024, 624). The gold lining as metallic thread in a rounded
     triangle on charcoal. Both ears use it.
  7. `figurine-face` (512, 768, 768, 1024). Already close. Wanted: the eyes' white as a
     crescent at the lower left of each iris, not an even ring; a smaller star highlight; the
     blush softer; the cheek marks as the real tilde.
  8. `figurine-body`, `figurine-back`, `figurine-hood`. The pebbled skin, like a citrus
     peel, finer than now; the quarters' edges crisp; the brown `#50362c`, the yellow
     `#ebc375`.

  _Rules for all of it._ Evenly lit, no shadow, no highlight, no vignette: flat colour and
  material texture only. Paint each island to its edges in its ground colour, and let nothing
  cross from one island into the next (leave the last two pixels of each island plain ground).
  If you think a ground colour is wrong against the photographs, change it and say which and
  to what in your reply, so the matching plain parts of the model can follow. No maker's mark or
  licensed logo beyond what is on the objects themselves.

  _How to see it._ `npm run build`, then `node scripts/serve-dist.mjs`, and open
  `/room?view=mug`, `/room?view=plush`, `/room?view=plushback`, `/room?view=figurine`, and
  `/room` for the seat. A real GPU shows it at once; software WebGL takes a few seconds a
  frame. Judge the lettering on the mug from `?view=mug` beside the photograph: that is the
  test. What the model does with shape and light is the cloud thread's; if an island cannot
  be made to look right because of where it lies on the model (stretched, cut off, too few
  pixels), say so instead of painting round it.

  _How to hand it back._ Commit `public/room/keepsakes.webp` and the master on this branch
  (`git pull --rebase origin cloud/modest-noether-l6tvpo` first), then write under this entry:
  what you changed in each island, any ground colour you changed, and what you could not get
  right. The cloud thread looks at it in the room, asks for changes here if it is not yet
  true to the photographs, and opens the pull request.

  _Handed back: a first repaint, made without the photographs._ Jincheng asked for it to be
  painted and pushed before pasting them here, so every island is painted from the words above
  and not from the objects: read it against the photographs and say here what is untrue. The
  pieces are painted by the image model and set in place by code; the master is
  `tools/pond/room/tex/keepsakes.png`, the picture 135 KB.
  1. `mug`: new lettering in a white dry-brush hand, slanted capitals with ragged ends, the R
     of ROAD the largest with a long leg, climbing to the right. "ON THE ROAD" is 530 wide,
     centred at (512, 154); "HAPPY ANNIVERSARY" 275 wide, centred at (512, 208). The ground is
     flat `#5879d4` to every edge, the white `#f4f4f0`.
  2. `plush-back`: "Hawaii" as a heavy slanted satin-stitch script, 265 wide, centred at
     (704, 631), on charcoal with a short nap.
  3. `plush-face`: eyes of white terry with a stitched rim, 122 across, at (129, 691) and
     (383, 691); the left pupil stitched with a grey ring, the right one plain black, both
     toward the nose; the nose in orange-brown satin stitch at (258, 754). The charcoal's
     middle value is `#58575f`.
  4. `plush-print`: the stand-in's grid and dots kept where they were, now as ink in pile: the
     lines' edges and strength vary and the yellow has a nap. It repeats every 970 pixels, so
     the left 54 and the right 54 are the same, and it runs to the top and bottom edges.
  5. `plush-glasses`: red felt with fibre, two lenses of black plush with their middles at
     (148, 942) and (364, 942), a curved white stitch on each. The red is now `#e10e0b`,
     brighter than the stand-in's: the plain parts of the model should follow, or say so and
     it goes back.
  6. `plush-ear`: a rounded triangle of gold thread in upright rows, in the box the stand-in's
     gold had. It reads as bright yellow thread more than metal.
  7. `figurine-face`: repainted with its irises where they were: the white as a crescent at
     the lower left of each iris, a smaller star, a softer blush, the cheek marks as tildes.
     The skin's colour is kept.
  8. `figurine-body`, `figurine-back`, `figurine-hood`: the same shapes in `#50362c` and
     `#ebc375` with a finer pebble; the quarters' edges are redrawn from the stand-in, so they
     are no truer than it was.

  Not got right, or not known: whether any of it matches the real things (above all the
  mug's hand and the embroidery's letter shapes); the threads carry a little painted relief
  (a pale side and a dark side to each stitch), which is light the room does not cast; the
  last two pixels of each island are plain ground except in the print (it must run to its
  edges) and the three pebbled islands. Send the photographs' corrections as words here, or
  ask Jincheng to paste the photographs into the picture thread.

- **Next cloud review: the gold window and its koi are ready.** Pull through
  `3792c71`: the chosen wide-2/tall-2 beds and the optional right-shifted bed
  are delivered, along with the third koi sheet and its tint mask. The local
  picture work stops at this review. Wire the new bed and koi into the preview,
  compare `bed.webp` with `bed-right.webp`, and check title clearance on wide
  and upright screens. Look at the fish swimming and bending, their white,
  ruby and cobalt against the gold, and the two tintable rows with visitor
  colours. Known weaknesses to judge in motion: the two whites differ in
  warmth, the tint patches lack glass texture, and the cobalt fish is brighter
  than the bed's blue. Reply here with concrete image or code changes needed
  and show the owner the koi before requesting the dragon or lilies. Keep the
  existing first-kit dragon and lilies pending that review.

- **Branch:** `cloud/modest-noether-l6tvpo`. Two threads work on it, as before: the thread in the
  cloud writes the code and the briefs; the thread on Jincheng's own machine makes the pictures (it
  can call the image model there) and commits them to this same branch. Always `git pull --rebase
  origin cloud/modest-noether-l6tvpo` before a push. The cloud thread opens the pull requests and
  merges them; after a merge it brings main back into the branch and does not rewrite it, so a
  clone of the branch stays good.
- **What the round is for:** the pond's small games, the first being the Dragon Gate (鲤鱼跃龙门: a
  koi that leaps a third time in a visit goes as a dragon). What is wanted, in the order to make
  it, is the list "Asked for now" in the art brief in [pond.md](pond.md); the rules every picture
  keeps are under "For every picture" there.
- **Delivered on this branch and in use:** the dragon for seven looks (the water's, ukiyo-e's,
  青花's, Dunhuang's, Monet's, the star chart's figure, the relief's pair); the second and third
  sheets of seals, so every seal is cut; painted clues for Monet's pond, the bowl, ukiyo-e and the
  star chart; the midge the spider hunts. Each was looked at in the pond at 1280 × 800.
- **Delivered and in use (2026-11-16): the taiji and the eight trigrams in ink** for the koi's
  circle (`taiji.webp`, `bagua.webp`). Seen in the pond at 1280 × 760 and 390 × 780: both sit
  right, the trigrams in the 先天 order, the gold koi showing through the dark half. Nothing is
  open now.
- **Dropped (2026-11-16): the stained glass look.** Jincheng: "抛弃玻璃这个风格吧。先做主线".
  Stop all work on it; its pictures are removed and the blueprint stays. Why is in the brief
  under "Stained glass: dropped". No new look is asked for now.
- **Asked again, where a picture can be bettered:** the cloud thread writes what to redo here and
  in the brief after seeing a picture in the pond; a second version takes the first one's name, and
  its table says what changed. Done so far, and in use: ukiyo-e's dragon (true proportions, fierce
  eyes, antlers, larger legs) and Monet's clue (its rim one loaded stroke). Nothing is open now.
- **Delivered and in use: the ten strokes of the second ending** (item 6 of "Asked for now"; the
  design is decision 0028): one stroke of 真 for each painted look, and the seal 真 on `seals-4`.
- **Handing a picture back:** commit it under `public/pond/<look>/` with the name the brief gives;
  run `node scripts/check-public-sizes.mjs` (200 KB a file); add its line to that look's table of
  pictures in pond.md, with what came out and what is weak; pull with rebase, and push. Leave the
  code alone and say in the commit message which pictures came: the cloud thread lists each and
  looks at it in the pond.
- **Seeing a dragon move before it is listed:** the last paragraph of "The dragon sheet".
- **Jincheng's to decide:** whether the water's own koi, which are drawn in code and read well,
  should be tried as a painted sheet too. Nothing is asked for it until he says.
- **To come, not asked yet:** the goldfish-scooping game will want a paper scoop, a few goldfish
  seen from above and a bowl. Its lines go into the brief when its design is settled; there is
  nothing to make for it yet beyond its seal.

## 1. Where things are

- **Branch and PR:** the looks were built on `cloud/youthful-bardeen-mq3cpl` (draft PR
  [jma49/jmos#294](https://github.com/jma49/jmos/pull/294)); what it held is on main. The branch
  open now is named in section 0. Push to no other branch.
- **Two threads work on a branch.** An agent in the cloud writes the code; an agent on Jincheng's
  own machine makes the pictures (an image model and Blender are only reachable from there) and
  commits them to the same branch. They talk through the doc: the art brief and its wanted lists
  under "Pictures for the looks" in [pond.md](pond.md). Always pull with rebase before a push; the
  other thread pushes often. Don't edit the delivered-pictures tables that thread writes; add what
  is wanted to the brief.
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
| `finish.cjs` | The finish checklist as contact sheets: each look's title page and chapters (the album among them), and a phone sheet. About three minutes a look. |
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
- Pictures, for anything new: "如果有新的美术资产需求…写一个文档交接给我开出来的本地线程。不要自己代码画，很明显比
  其他美术资产差" (a new thing the pond shows is asked of the local thread through the brief; the
  cloud thread builds the code to take the picture and does not draw it).

## 3. What ships when

- **On main already:** the six looks, the weather, the first performance pass (PRs 287 to 292).
- **In this branch, ready in a release build (no flag):** the second performance pass (each look its
  own shader pass, GPU-timed adaptive scale, quiet pace when covered or in the background); the
  seal album and the one-line hint; ink's painted motifs and the season rules; each live look's own
  arrival; reduced motion as a cross-fade (never run under reduced motion: test it first).
- **Preview only (`PUBLIC_POND_PREVIEW=1`):** Monet, 青花, Dunhuang, the star chart, their gestures,
  seals, painted koi, the Preview panel. `?preview` in the address also turns the
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
    look, a sheet of the title page and every chapter (the album among them) at 1280 × 800, and a
    phone sheet. All ten were looked at (in winter, English). Since then: a painted koi under the
    title's type is at half strength in ukiyo-e; in the relief a koi passes behind the tomb's
    carvings; 青花's medallion is paler. Left: ink's koi cross the greeting on a phone, as on the
    water; the Preview pill sits over the bottom row's controls on a phone (preview builds only). Not
    covered by
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

- **The first screen's brushed characters come from one small file.** The brush face comes in
  chunks of about 60 KB and a page fetched every chunk one of its characters fell in: 300 KB for
  the solar term and the language switch. `scripts/pond-first-brush.mjs` cuts those few dozen
  characters into `public/pond/type/brush-first.woff2` (11 KB) and writes `src/pond/brush-first.css`,
  declared after the chunks so the browser takes it for them. The pond's first load went from 528
  KB to 222 KB (phone: 504 to 199). A test holds the stylesheet to the characters the source
  names; cut the file again when a term, the seal or the switch gains a character.
- **A look's pass alone is stood in for by its pass over the water** until it is built (`standIn`),
  and starts building as the look comes in; the passes of the next three looks a visitor has not
  found are built ahead once the pond is still, where passes build off the main thread.
- **The first frame builds only the water's pass, and the whole pass is never built.** The whole
  pass, with every look in it, held the main thread for seconds under a software GPU when it was
  built before the first frame (CI's smoke test timed out on it), and on the owner's Mac it was not
  ready when looks were asked for: arrivals did not play, the look just appeared. A look now has two
  small passes of its own, built when it is first asked for: over the water (`OVER`, for coming in
  and going out) and alone. Its arrival's clock starts when its pass is ready (`stepInk`), and a
  look's own pass never draws two looks: one asked for while another shows comes in over a still of
  the frame as it was (`snapNow()`, `uSnap`), and the frame holds that still while the new pass
  builds, so no water shows between them (it once did: the last look drew back to the water first).
  Without the still (no WebGL copy) it falls back to drawing back first (`lookNext`). Every look added
  must keep to this; never put two looks in one pass. With `?gest` the readout lists what each pass took to build.

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
