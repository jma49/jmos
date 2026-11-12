// Five looks that are only previews (a build with PUBLIC_POND_PREVIEW=1): Monet's water lilies in oil,
// blue-and-white porcelain (青花), a Dunhuang mural (敦煌), a star chart (星图) and an Egyptian relief,
// carved and painted limestone. Each is a function of the water pass, drawn from what that pass has already worked
// out (the ripples, the koi, the pads, where the water was pressed), as the other looks are; none adds a
// pass, and each is built as a pass of its own once it is asked for (engine.js, fsPart).

/** The new looks and their numbers in the shader, after the six that ship. */
export const NEW_LOOKS = ['monet', 'qinghua', 'dunhuang', 'stars', 'relief'];
export const NEW_SID = { monet: 6, qinghua: 7, dunhuang: 8, stars: 9, relief: 10 };

/** How each lays the dove and the spider into the air, the glass's tint, and how fast its front runs out. */
export const NEW_LAY = {
  monet: ['source-over', 0.5],
  qinghua: ['multiply', 0.85],
  dunhuang: ['multiply', 0.8],
  stars: ['lighter', 0.6],
  relief: ['multiply', 0.9]
};
export const NEW_GLASS = {
  monet: [0.2, 0.26, 0.36],
  qinghua: [0.93, 0.95, 0.97],
  dunhuang: [0.8, 0.66, 0.46],
  stars: [0.01, 0.015, 0.045],
  relief: [0.86, 0.83, 0.76]
};

/** How much of the tree's shade lies over each: none on glaze, plaster, the night sky or carved stone. */
export const NEW_SHADE = { monet: 0.5, qinghua: 0, dunhuang: 0, stars: 0, relief: 0 };

/** 青花's pictures: the rim's lotus scroll and its corner, the koi and where a visitor's colour goes on them. */
export const QINGHUA = {
  rim: '/pond/qinghua/rim.webp',
  corner: '/pond/qinghua/corner.webp',
  koi: '/pond/qinghua/koi.webp',
  koiMask: '/pond/qinghua/koi-mask.webp'
};
/**
 * The painted koi of each look that has them: the sheet, how high a row is, where the tail ends, which row is
 * mine and which the visitor's, which rows the rest take, and how a colour is laid on: through the mask into
 * a grey koi's patches (a visitor's colour; for the pond's own koi the look's one `patch` colour, or with `own`
 * the koi's own, snapped to the look's `palette` if it has one), under a `wash` over the whole fish if any.
 * A carved sheet also has its `height` and the colour that stands for `bare` stone (engine.js, carved()).
 */
export const KOI_SHEETS = {
  ukiyo: { src: '/pond/ukiyo/koi.webp', mask: '/pond/ukiyo/koi-mask.webp', rowH: 384, x1: 962, host: 0, you: 1, others: [2, 3], own: true },
  monet: { src: '/pond/monet/koi-v2.webp', mask: '/pond/monet/koi-mask.webp', rowH: 384, x1: 962, host: 0, you: 1, others: [2, 3], own: true },
  dunhuang: {
    src: '/pond/dunhuang/koi.webp',
    mask: '/pond/dunhuang/koi-mask.webp',
    rowH: 384,
    x1: 962,
    host: 0,
    you: 1,
    others: [2, 3],
    own: true,
    // the wall's own cinnabar, blue and green, whichever is nearest a koi's colour, so no pigment is foreign to it
    palette: ['#b34026', '#2b6385', '#4d856e', '#cc8f38']
  },
  relief: {
    // (the bolder cut: a koi is drawn about a sixth of the sheet's size)
    src: '/pond/relief/koi-c-bold.webp',
    height: '/pond/relief/koi-h-bold.webp',
    mask: '/pond/relief/koi-mask-bold.webp',
    rowH: 384,
    x1: 962,
    host: 0,
    you: 1,
    others: [2, 3],
    own: true,
    // red ochre, Egyptian blue, green, yellow ochre
    palette: ['#a8482c', '#3f6fa8', '#5e8f6a', '#d6a23e'],
    // what stands for bare stone in the picture made of the paint and the height (lookRelief knows it)
    bare: '#e2dccd'
  },
  qinghua: {
    src: '/pond/qinghua/koi.webp',
    mask: '/pond/qinghua/koi-mask.webp',
    rowH: 384,
    x1: 962,
    host: 0,
    you: 1,
    others: [2, 3],
    wash: '#3d5fc0',
    patch: '#0f2470'
  }
};
/** Monet's pictures (public/pond/monet/): the painted water in three shapes, and the lilies (the koi are in KOI_SHEETS). */
export const MONET = {
  bed: '/pond/monet/bed.webp',
  bedSmall: '/pond/monet/bed-1280.webp',
  bedTall: '/pond/monet/bed-tall.webp',
  lilies: '/pond/monet/lilies.webp'
};
/** Ukiyo-e's pictures (public/pond/ukiyo/): the wave crests of a press and of its arrival (the koi are in KOI_SHEETS). */
export const UKIYO = { waves: '/pond/ukiyo/waves.webp' };
/**
 * The star chart's pictures (public/pond/stars/): an engraved grid that tiles, and a koi in outline for the
 * figure behind each constellation (`figure` is the straight koi's paint in its sheet).
 */
export const STARS = {
  grid: '/pond/stars/grid.webp',
  figures: '/pond/stars/koi-figures.webp',
  figure: [46, 184, 424, 163]
};
/**
 * The relief's pictures (public/pond/relief/), each a pair that lines up to the pixel: `C` the faded paint,
 * `H` the height (mid grey the stone's face).
 */
export const RELIEF = {
  fishC: '/pond/relief/fish-c.webp',
  fishH: '/pond/relief/fish-h.webp',
  lotusC: '/pond/relief/lotus-c.webp',
  lotusH: '/pond/relief/lotus-h.webp',
  friezeC: '/pond/relief/frieze-c.webp',
  friezeH: '/pond/relief/frieze-h.webp',
  stoneH: '/pond/relief/stone-h.webp'
};
/**
 * Where the relief's carvings go on a wall of W by H: the frieze along the top and the foot; in the right
 * half a marsh as tombs carve it (a papyrus clump, a duck, lotus in flower and in bud, a leaf) over two
 * tilapia; the left left bare for the title. A narrow wall has the frieze and one tilapia under the
 * contents. Each entry is [pair, source x, y, w, h, x, y, w, h]; nothing but the frieze lies under the controls.
 */
export function reliefLayout(W, H, wide) {
  const band = wide ? 40 : 26,
    frieze = [];
  for (let x = 0; x < W; x += band * 8)
    frieze.push(['frieze', 0, 0, 1024, 128, x, 0, band * 8, band], ['frieze', 0, 0, 1024, 128, x, H - band, band * 8, band]);
  // a motif of the lotus sheet, by its cell, drawn s across about (x, y); a tilapia, by its cell, w across
  const motif = (i, j, x, y, s) => ['lotus', i * 256 + 14, j * 256 + 14, 228, 228, x - s / 2, y - s / 2, s, s],
    fish = (i, x, y, w) => ['fish', i * 512 + 20, 120, 472, 272, x, y, w, (w * 272) / 472];
  if (!wide) {
    const w = Math.min(W * 0.78, H * 0.5),
      h = (w * 272) / 472;
    // (under the contents on an upright wall; at the right of a small one that is wider than tall)
    return [...frieze, fish(0, W > H ? W * 0.95 - w : W * 0.5 - w / 2, Math.min(H * (W > H ? 0.36 : 0.66), H - MURAL_FOOT_NARROW - h), w)];
  }
  const foot = H - Math.max(MURAL_FOOT, band + 46),
    u = Math.min(H, W * 0.6),
    w1 = Math.min(W * 0.27, u * 0.56),
    h1 = (w1 * 272) / 472,
    w2 = w1 * 0.66,
    h2 = (w2 * 272) / 472,
    y1 = Math.min(H * 0.5, foot - h1 - h2 * 0.75);
  return [
    ...frieze,
    motif(2, 1, W * 0.875, H * 0.3, u * 0.25),
    motif(3, 1, W * 0.735, H * 0.27, u * 0.17),
    motif(0, 0, W * 0.8, H * 0.43, u * 0.13),
    motif(2, 0, W * 0.935, H * 0.5, u * 0.11),
    motif(0, 1, W * 0.6, H * 0.33, u * 0.13),
    fish(0, W * 0.6, y1, w1),
    fish(1, W * 0.52, Math.min(y1 + h1 * 0.95, foot - h2), w2)
  ];
}
/** The Dunhuang wall's pictures (public/pond/dunhuang/), fetched the first time the look is asked for. */
export const MURAL = {
  pipa: '/pond/dunhuang/feitian-pipa.webp',
  flowers: '/pond/dunhuang/feitian-flowers.webp',
  sky: '/pond/dunhuang/sky-flowers.webp',
  far: '/pond/dunhuang/feitian-far.webp',
  border: '/pond/dunhuang/border.webp',
  trail: '/pond/dunhuang/cloud-trail.webp',
  halo: '/pond/dunhuang/halo.webp'
};
/** How far up from the wall's foot the page's controls reach on a wide wall: nothing painted lies under them. */
export const MURAL_FOOT = 76;
/** The same on a narrow wall, where the languages sit over the row of controls. */
export const MURAL_FOOT_NARROW = 116;
/** The centrepiece again, larger: asked for in its place only where the wall is drawn wide enough to need it. */
export const MURAL_LARGE = { pipa: '/pond/dunhuang/feitian-pipa-2560.webp' };
/**
 * Where each picture goes on a wall of W by H: the pipa player high in the right half, flying left towards
 * the title; the one scattering flowers lower right, coming down, her lotus falling on towards the pond; a
 * few clouds by them, the pearl once; the left third left as plaster. On a narrow wall, one figure, in the
 * open water under the contents. Each entry is [picture, source x, y, w, h, x, y, w, h, strength]; faces are [x, y, radius], kept from flaking.
 */
export function muralLayout(W, H, wide) {
  const cell = (i, j) => [i * 256 + 40, j * 256 + 40, 176, 176],
    // (a wide wall's loose motifs stop above the controls)
    sky = (i, j, x, y, s) => ['sky', ...cell(i, j), x - s / 2, (wide ? Math.min(y, H - MURAL_FOOT - s / 2) : y) - s / 2, s, s];
  if (!wide) {
    // (below the contents, in the open water: at the top she would lie under the greeting)
    // (and clear of the controls: her paint ends 0.83 of the way down her picture)
    // On a small window that is wider than tall she is smaller, so she still fits under the greeting.
    const w = Math.min(W * 1.25, H * 0.9),
      x = W * 0.03,
      y = Math.min(H * 0.615, H - MURAL_FOOT_NARROW - (w / 2) * 0.83);
    return {
      draw: [sky(1, 0, W * 0.84, H * 0.6, W * 0.2), ['pipa', 0, 0, 1536, 768, x, y, w, w / 2]],
      faces: [
        [x + w * 0.11, y + w * 0.2, w * 0.05],
        [0, 0, 0]
      ]
    };
  }
  const w1 = Math.min(W * 0.5, H * 1.05),
    x1 = W * 0.965 - w1,
    y1 = H * 0.07,
    y2 = H * 0.5,
    // (the lower figure and the cloud under her end above the controls: the cloud's foot is 0.585 of her width down)
    w2 = Math.min(W * 0.43, H * 0.9, (H - MURAL_FOOT - y2) / 0.585),
    x2 = W * 0.95 - w2,
    u = Math.min(W, H * 1.6) / 1280,
    // (her falling lotus come down no further than the controls either)
    v = Math.min(u, Math.max(0, H - MURAL_FOOT - y2 - w2 * 0.5) / 119);
  return {
    draw: [
      sky(0, 0, x1 + w1 * 0.9, y1 + w1 * 0.44, 110 * u),
      sky(2, 0, x1 - 30 * u, y1 + w1 * 0.36, 96 * u),
      sky(1, 0, x2 + w2 * 0.96, y2 + w2 * 0.08, 100 * u),
      sky(3, 1, x1 - 120 * u, y1 + 40 * u, 84 * u),
      // far off, small, flying the other way: depth on a wide wall
      ...(W > 1100 ? [['far', 0, 0, 768, 384, W * 0.3, H * 0.085, W * 0.15, W * 0.075, 0.55]] : []),
      // a long cloud leading in under the lower figure, its tail towards the pond
      ['trail', 1024, 0, -1024, 256, x2 + w2 * 0.2, y2 + w2 * 0.43, w2 * 0.62, w2 * 0.155, 0.8],
      // a halo behind the pipa player's head, as the figures of the caves wear
      ['halo', 0, 0, 512, 512, x1 + w1 * 0.11 - w1 * 0.075, y1 + w1 * 0.2 - w1 * 0.075, w1 * 0.15, w1 * 0.15, 0.85],
      ['pipa', 0, 0, 1536, 768, x1, y1, w1, w1 / 2],
      ['flowers', 0, 0, 1536, 768, x2, y2, w2, w2 / 2],
      sky(3, 0, x2 - 70 * u, y2 + w2 * 0.47, 62 * u),
      sky(1, 1, x2 - 150 * u, y2 + w2 * 0.5 + 50 * v, 54 * Math.min(u, v * 1.6)),
      sky(2, 1, x2 - 230 * u, y2 + w2 * 0.5 + 96 * v, 46 * Math.min(u, v * 1.6))
    ],
    faces: [
      [x1 + w1 * 0.11, y1 + w1 * 0.2, w1 * 0.05],
      [x2 + w2 * 0.255, y2 + w2 * 0.385, w2 * 0.05]
    ]
  };
}

/** The command bar's entries: found by name only, as the other looks are. */
export const NEW_COMMANDS = [
  ['monet', 'Water lilies', 'Monet’s pond in oil; or dab the water a few times in one place', 'monet water lilies oil paint impression giverny 睡莲 莫奈'],
  ['qinghua', '青花 Blue and white', 'Porcelain; or run a finger round the rim of the screen', 'qinghua porcelain blue white china cobalt 青花瓷 染付'],
  ['dunhuang', '敦煌 Dunhuang', 'A cave mural; or rub the wall back and forth', 'dunhuang mural cave fresco mogao 敦煌 壁画'],
  ['stars', 'Star chart', 'The night sky in the water; or tap three points far apart', 'stars star chart atlas constellation night sky 星图 星図'],
  [
    'relief',
    'Egyptian relief',
    'Carved and painted stone; or draw a zigzag of three peaks',
    'relief egypt egyptian carved stone tomb limestone nile 浮雕 埃及 レリーフ'
  ]
];

/** The looks' functions, added to the water pass after the six that ship. */
export const NEW_GLSL = `
// ---------- the preview looks ----------
uniform vec3 uFace[2];
float grain(vec2 P){ return .5+.5*noise(P*1.9)*(.6+.4*noise(P*.7+9.)); }
// Monet: an oil painting of the pond's water is the bed (a picture, laid into one texture once). The water over
// it is a wet surface: it bends the painting a little where it moves and catches a sheen, and the paint's
// own ridges take a little light. The lilies and the koi are painted too (engine.js draws them from their
// sheets onto the pads' and the fish's canvases), so here they are only laid over, with a soft shade under them.
vec3 lookMonet(){
  vec2 uv=gUv, P=gP, ruv=uv+gG*gIa*.028+gRef*.3;
  vec4 bed=texture(uMural,ruv);
  vec3 col=mix(vec3(.27,.38,.52)*(.85+.3*fbm(P*.004)),bed.rgb,bed.a);
  float ridge=dot(col-texture(uMural,ruv-vec2(0.,1.6)/uCss).rgb,vec3(.333))*bed.a;
  col+=vec3(.55,.54,.48)*clamp(ridge*3.,-.05,.09);
  col+=vec3(.9,.95,1.)*clamp(abs(gLap)*3.,0.,.045)*(1.-gCalm*.8);
  vec4 pd=textureLod(uPads,uv+gG*gIa*.006,0.); float ps=textureLod(uPads,uv+vec2(.004,.007),2.).a;
  col*=1.-.24*ps*(1.-pd.a); col=pd.rgb*.97+col*(1.-pd.a);
  vec4 f=textureLod(uFish,uv+gRef*.3,.7); col*=1.-.2*textureLod(uFish,uv+vec2(.004,.007),3.).a*(1.-f.a); col=f.rgb+col*(1.-f.a);
  // (what sits or floats on the water is taken into the painting: softened, and greyed towards the water)
  vec4 tp=textureLod(uTop,uv,2.2); col=mix(col,mix(tp.rgb/max(tp.a,1e-3),vec3(.30,.33,.48),.5),tp.a*.7);
  // a press: a dab of paint, its edge soft and uneven, that spreads and blends into what is under it
  for(int i=0;i<10;i++){ vec3 bl=uBlot[i]; if(bl.z<0.) continue;
    float t=bl.z, R=14.+46.*sqrt(t)*(1.-exp(-t*1.4)), d=length(P-bl.xy)+(noise(P*.09+bl.x)-.5)*16.+(noise(P*.4)-.5)*5.;
    vec3 paint=mix(vec3(.96,.88,.66),vec3(.93,.62,.70),step(.5,fract(bl.x*.37)));
    col=mix(col,mix(paint,col,smoothstep(0.,6.,t)*.75),(1.-smoothstep(R*.55,R,d))*exp(-t*.14)); }
  // winter: the ice in white and the palest blue, laid on thick
  col=mix(col,mix(vec3(.88,.91,.95),vec3(.74,.81,.92),noise(P*.02)),gIce*.78);
  col*=.97+.03*sin(P.x*2.6)*sin(P.y*2.6);
  col=mix(col,col*vec3(.60,.65,.78),gCalm*.68);
  return col;
}
// 青花: white glaze with a soft gloss and a fine crackle; the koi, the lotus and the water in cobalt, in
// line and wash, the blue pooling where a line ends; a band of pattern round the rim
float seigaiha(vec2 P){ vec2 q=P/vec2(44.,22.); q.x+=step(1.,mod(floor(q.y),2.))*.5; vec2 f=fract(q); f.x-=.5; f.y=1.-f.y;
  float r=length(f*vec2(1.,.5)*2.), l=0.; for(int i=1;i<4;i++) l=max(l,1.-smoothstep(0.,.07,abs(r-float(i)*.3)));
  return l*step(r,1.02); }
vec3 lookQinghua(){
  vec2 P=gP, uv=gUv;
  vec3 glaze=vec3(.935,.95,.955)-vec3(.05,.035,.02)*fbm(P*.004)+vec3(.03)*smoothstep(.75,.2,length((uv-vec2(.32,.24))*vec2(1.,1.6)));
  vec3 deep=vec3(.06,.14,.42), wash=vec3(.36,.50,.80);
  float pool=.62+.38*noise(P*.09)+.5*smoothstep(.62,.9,noise(P*.035+5.));
  vec3 c=glaze;
  // the water: scale-waves in a pale line, firmer where it moves
  float wv=seigaiha(P+gG*36.); c=mix(c,wash,wv*(.16+clamp(abs(gLap)*30.+length(gG)*1.4,0.,.6))*(1.-gCalm*.97)*pool);
  // pads and lotus: a washed leaf inside a drawn line, veins from its heart
  vec4 pd=textureLod(uPads,uv,0.); float pe=textureLod(uPads,uv,1.6).a, pw=textureLod(uPads,uv,3.).a;
  // (under the title's type the pads and the koi are only faintly there, as in the other looks)
  float clr=1.-gCalm*.78;
  c=mix(c,wash,pw*.34*pool*clr); c=mix(c,deep,clamp(abs(pd.a-pe)*3.2,0.,1.)*pool*clr);
  vec3 pc=pd.rgb/max(pd.a,1e-3); c=mix(c,deep,clamp((pc.r-pc.g)*2.2,0.,1.)*pd.a*.6);
  // koi: outline in the deep blue, the body a wash, their red patches filled dark
  vec4 f0; float fa,fb,fc,red; fishAt(f0,fa,fb,fc,red);
  vec3 c0=c, cd=mix(c,f0.rgb/max(f0.a,1e-3),f0.a*clamp(pool+.3,0.,1.));   // painted koi, as they are
  c=mix(c,wash,fb*.5*pool); c=mix(c,deep,clamp((fa-fb)*3.6,0.,1.)*clamp(pool,0.,1.)); c=mix(c,deep,smoothstep(.2,.6,red)*.85*pool);
  c=mix(c,mix(wash,deep,.4),step(.5,f0.a)*smoothstep(.34,.46,abs(fract((P.x+P.y)*.11)-.5))*.35);
  c=mix(c0,mix(c,cd,uSprite),clr);
  vec4 tp=textureLod(uTop,uv,0.); float te=textureLod(uTop,uv,1.5).a; c=mix(c,deep,clamp(abs(tp.a-te)*3.,0.,1.)*.8*pool);
  // the rim: two lines and a row of petals between them
  float fs=mix(1.,.56,uCalm.x), e=min(min(P.x,uCss.x-P.x),min(P.y,uCss.y-P.y))/fs, along=((min(P.x,uCss.x-P.x)<min(P.y,uCss.y-P.y))?P.y:P.x)/fs;
  // (what is painted inside the bowl stops at the rim: nothing swims under it)
  c=mix(c,glaze,1.-smoothstep(39.,43.,e));
  float rim=(1.-smoothstep(0.,1.,abs(e-10.)-.5))+(1.-smoothstep(0.,1.,abs(e-13.5)-.2))+(1.-smoothstep(0.,1.,abs(e-36.)-.4));
  float pet=1.-smoothstep(0.,1.1,abs(length(vec2((fract(along/24.)-.5)*24.,e-25.))-8.)-.5);
  // (the rim is a painted lotus scroll once it has come; a row of beads between lines until then)
  vec4 rm=texture(uMural,uv); c=mix(c,rm.rgb/max(rm.a,1e-3),rm.a*uPic*clamp(pool+.2,0.,1.));
  c=mix(c,deep,(1.-uPic)*clamp(rim+pet*step(15.,e)*step(e,35.),0.,1.)*clamp(pool,0.,1.)*.85);
  // the crackle, and a new craze line from each press, running out along the glaze
  // (the crackle comes last as the glaze cools, ticking across a patch at a time)
  c=mix(c,vec3(.55,.50,.44),(seams(P/46.)*.13+seams(P/17.+3.)*.05)*smoothstep(0.,.1,uLookT-1.7-hash1(floor(P/130.))*.9));
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
    vec2 d=P-b.xy; float t=b.z, R=10.+150.*(1.-exp(-t*1.6)), r=length(d), an=atan(d.y,d.x)+noise(vec2(r*.03,b.x))*1.1;
    float ray=1.-smoothstep(0.,.9+r*.004,abs(sin(an*2.5+b.y*.1))*r*.5);
    c=mix(c,vec3(.36,.36,.42),ray*step(r,R)*(1.-r/R)*exp(-t*.07)*.8); }
  // winter: the ice is the glaze itself, whiter and more crazed; its cracks in the blue
  if(gIce>0.){ c=mix(c,vec3(.97,.98,.99),gIce*.55); c=mix(c,vec3(.5,.52,.56),seams(P/9.)*.12*gIce); c=mix(c,deep,clamp(gHit.x,0.,1.)*.8);
    c=mix(c,wash,step(.9,hash1(floor(P/12.)))*uSnow*gIce*.5*(1.-smoothstep(.2,.4,length(fract(P/12.)-.5)))); }
  return c;
}
// 敦煌: plaster the colour of the earth, flaked and old; the water in banded ribbons of mineral blue and
// green, the koi and the lotus with a dark line round them, as on a cave's ceiling
vec3 lookDunhuang(){
  vec2 P=gP, uv=gUv;
  vec3 wall=vec3(.68,.51,.30)*(.9+.2*fbm(P*.006))-vec3(.05,.045,.04)*smoothstep(.6,.95,noise(P*vec2(.012,.05)));
  float flake=smoothstep(.56,.62,fbm(P*.021+4.))+smoothstep(.78,.8,noise(P*.11))*.6, keep=1.-clamp(flake,0.,1.)*.86;
  vec3 qing=vec3(.17,.39,.52), lv=vec3(.30,.52,.43), zhu=vec3(.70,.25,.15), bai=vec3(.93,.88,.76), line=vec3(.18,.11,.07);
  vec3 c=wall;
  // the painting on the wall: the flying figures (pictures, laid into one texture once), under the wear so
  // they age with it. The pigment is uneven and deeper than fresh paint, patches of it are lost (never a face),
  // the line is a little broken, and what was gold leaf catches the light, more where the water moves.
  vec4 mu=texture(uMural,uv+gG*.006); vec3 mo=mu.rgb/max(mu.a,1e-3); float ml=dot(mo,vec3(.333));
  float face=0.; for(int i=0;i<2;i++) face=max(face,1.-smoothstep(uFace[i].z*.6,uFace[i].z,length(P-uFace[i].xy)));
  float lost=clamp(flake,0.,1.)*(1.-face), gold=(1.-smoothstep(.1,.24,distance(mo,vec3(.80,.56,.22))))*mu.a*(1.-lost);
  vec3 mp=mo*(.70+.36*noise(P*.045))*(.9+.2*noise(P*.9)); mp=mix(mp,mp*mp*1.3,.42);
  c=mix(c,mp,mu.a*(1.-lost*.82)*(1.-.4*step(ml,.28)*step(.62,noise(P*.7)))*(1.-gCalm*mix(.75,.3,uCalm.x)));
  c+=vec3(1.,.80,.42)*gold*(.08+.5*pow(noise(P*.3+vec2(uTime*.12,0.)),3.)+clamp(abs(gLap)*26.+length(gG)*1.2,0.,.6))*(1.-gCalm*.75);
  // the water plays over it: ribbons that rise and fall together, thin, firmer where it moves
  float y=P.y+26.*sin(P.x*.011+uTime*.12)+10.*sin(P.x*.031-uTime*.2)+gH*70., band=y/30., bi=floor(band), bf=fract(band);
  vec3 bc=mod(bi,3.)<1.?qing:mod(bi,3.)<2.?lv:mix(qing,bai,.55); float wet=clamp(abs(gLap)*20.+length(gG)*1.5,0.,1.);
  c=mix(c,bc,(.12+.34*wet)*keep*(1.-gCalm*.96)*(1.-mu.a*.7)); c=mix(c,bai,smoothstep(.43,.5,abs(bf-.5))*(.2+.45*wet)*keep*(1.-gCalm*.96)*(1.-mu.a*.6));
  // lotus pads: mineral green, ringed dark; the flower red and white
  vec4 pd=textureLod(uPads,uv,0.); float pe=textureLod(uPads,uv,1.5).a; vec3 pc=pd.rgb/max(pd.a,1e-3);
  c=mix(c,mix(lv*1.1,zhu,clamp((pc.r-pc.g)*2.5,0.,1.)),pd.a*.9*keep); c=mix(c,line,clamp(abs(pd.a-pe)*3.,0.,1.)*.85);
  // koi: flat colour inside a dark line, red where they are red
  vec4 f0; float fa,fb,fc,red; fishAt(f0,fa,fb,fc,red); vec3 fcol=f0.rgb/max(f0.a,1e-3);
  // (painted koi, from the look's own sheet, are laid in as they are: they carry their line)
  c=mix(c,mix(mix(mix(bai,vec3(.80,.56,.22),clamp((fcol.r-fcol.b)*1.6-.1,0.,1.)),zhu,smoothstep(.2,.5,red)),fcol,uSprite),f0.a*mix(1.,keep,.5));
  c=mix(c,line,clamp((fa-fb)*3.8,0.,1.)*(1.-uSprite));
  c=mix(c,wall*1.14,gCalm*.62*(1.-mu.a*.75*uCalm.x));
  vec4 tp=textureLod(uTop,uv,0.); float te=textureLod(uTop,uv,1.5).a; c=mix(c,tp.rgb/max(tp.a,1e-3)*.8,tp.a*.8*keep*(1.-gCalm*.6)); c=mix(c,line,clamp(abs(tp.a-te)*3.,0.,1.)*.7);
  // a press: the pigment lifts off in a patch, and its dust drifts out and settles
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
    float t=b.z, R=10.+34.*(1.-exp(-t*3.)), d=length(P-b.xy)+(noise(P*.2)-.5)*16.;
    c=mix(c,wall*1.06,(1.-smoothstep(R*.7,R,d))*exp(-t*.05)*.9);
    float ring=R+70.*(1.-exp(-t*.9)); c=mix(c,bai*.9,step(.86,hash1(floor(P/3.)+floor(b.x)))*(1.-smoothstep(0.,26.,abs(d-ring)))*exp(-t*1.1)*.8); }
  // age: fine cracks, and the soot of lamps towards the edges
  c=mix(c,line,seams(P/150.+noise(P*.004)*1.5)*.13*smoothstep(.3,.6,noise(P*.006+9.))); float soot=smoothstep(.5,0.,uv.y)*.34*(.6+.6*fbm(P*vec2(.004,.012)+5.))+pow(clamp(length((uv-.5)*vec2(1.,1.08))*1.42,0.,1.),3.5)*.62;
  c*=1.-soot*(1.-gCalm*.6); c=mix(c,c*vec3(1.,.86,.66),.22); c*=.94+.12*noise(P*1.3);
  // winter: frost on the wall, white and dry
  if(gIce>0.){ c=mix(c,bai,gIce*.5*(.6+.4*noise(P*.4))); c=mix(c,line,clamp(gHit.x,0.,1.)*.7); c=mix(c,vec3(1.),step(.93,hash1(floor(P/7.)))*uSnow*gIce*.5); }
  return c;
}
// 星图: the night sky in the water. The koi are drawn as constellations (engine.js draws them so in this
// look); the pads are ringed discs of faint cloud; the ripples the rings of orbits; a press is a new star
float star4(vec2 d,float s){ float r=length(d); return exp(-r*r/(s*s))+.35*exp(-abs(d.x)*1.2/s)*exp(-abs(d.y)*9./s)+.35*exp(-abs(d.y)*1.2/s)*exp(-abs(d.x)*9./s); }
vec3 lookStars(){
  vec2 P=gP, uv=gUv;
  // the sky turns, slowly, about a point off the top
  vec2 pole=vec2(uCss.x*.62,-uCss.y*.5); float an=uTime*.004; vec2 d0=P-pole; vec2 S=pole+vec2(d0.x*cos(an)-d0.y*sin(an),d0.x*sin(an)+d0.y*cos(an));
  vec3 c=vec3(.010,.016,.045)+vec3(.012,.02,.05)*fbm(S*.002);
  // the atlas's engraved grid (a picture that tiles, repeated), faint, turning with the sky; it is ruled
  // in after the first stars are out
  c+=vec3(.79,.83,.94)*texture(uMural,S/520.).a*uPic*.2*(1.-gCalm*.5)*smoothstep(1.2,3.2,uLookT);
  float band=exp(-pow(((S.x-pole.x)*.55+(S.y-pole.y)*.83-uCss.y*.95)/(uCss.y*.2),2.));
  c+=vec3(.16,.17,.24)*band*(.25+.75*fbm(S*.006+3.))*.55+vec3(.5,.52,.6)*band*pow(noise(S*.5),6.)*.5;
  // (the stars come out a few at a time as the dusk deepens, the brightest first)
  for(int k=0;k<2;k++){ float sz=k==0?46.:19.; vec2 id=floor(S/sz), f=fract(S/sz)-.5, o=(hash2(id+float(k)*7.)-.5)*.7; float h=hash1(id+float(k)*13.);
    float tw=.75+.25*sin(uTime*(1.+h*2.)+h*40.), m=step(k==0?.72:.6,h);
    c+=mix(vec3(.8,.87,1.),vec3(1.,.9,.74),step(.9,h))*(k==0?star4((f-o)*sz,1.1+h*1.2):exp(-dot(f-o,f-o)*sz*sz/.7))*m*tw*(k==0?.9:.5)*smoothstep(0.,.5,uLookT-.5-(1.-h)*4.2*(k==0?1.:1.4)); }
  // orbits: the ripples as thin rings
  float ring=smoothstep(.45,.5,abs(fract(gH*14.)-.5));
  c+=vec3(.45,.6,.9)*ring*smoothstep(.015,.07,abs(gLap)*4.+abs(gH)*.7)*.3*(1.-gCalm*.9);
  // pads: a ring, and a little cloud inside it
  vec4 pd=textureLod(uPads,uv,0.); float pe=textureLod(uPads,uv,1.6).a;
  c+=vec3(.42,.3,.62)*pd.a*fbm(P*.02+2.)*.3+vec3(.6,.75,1.)*clamp(abs(pd.a-pe)*3.,0.,1.)*.4;
  // the koi, already drawn as stars and the lines between them
  // (their lines join once the stars are out)
  vec4 f=textureLod(uFish,uv+gRef*.2,0.); c+=(f.rgb*1.15+vec3(.25,.4,.8)*textureLod(uFish,uv,3.).a*.3)*smoothstep(1.8,2.8,uLookT);
  // leaving: dawn comes up from the horizon and the stars go out in it
  if(uLeave>=0.) c=mix(c,vec3(.34,.26,.30)+vec3(.3,.2,.1)*uv.y,smoothstep(0.,1.6,uLeave)*(.25+.5*uv.y));
  vec4 tp=textureLod(uTop,uv,1.); c+=vec3(.6,.7,1.)*tp.a*.14;
  // a press: a star is born, flares, and settles to a point that fades; a streak falls away from it
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
    float t=b.z, k=exp(-t*.5), puls=1.+.5*sin(t*9.)*exp(-t*2.); vec2 d=P-b.xy;
    c+=vec3(.9,.95,1.)*star4(d,(3.+10.*exp(-t*3.))*puls)*k*1.4;
    vec2 dir=normalize(vec2(.8,.6)*sign(fract(b.x*.13)-.5)), hp=b.xy+dir*t*520.; float al=dot(P-hp,dir), pr=length(P-hp-dir*al);
    c+=vec3(.8,.9,1.)*exp(-pr*pr/3.)*smoothstep(-90.,0.,al)*step(al,0.)*step(t,.9)*(1.-t/.9); }
  // winter: a thin veil of light across the sky where the ice lies, its cracks as faint lines
  if(gIce>0.){ c+=vec3(.05,.14,.16)*gIce*(.5+.5*fbm(P*.01+uTime*.02)); c+=vec3(.5,.7,.9)*gHit.x*.6;
    c+=vec3(.8,.9,1.)*step(.997-.002*uSnow,hash1(floor((P+vec2(0.,uTime*14.))/4.)))*uSnow*gIce*.6; }
  c=mix(c,vec3(.01,.014,.04),gCalm*.4);
  return c;
}
// Egyptian relief: painted limestone, carved low, under a raking light that goes round with the day. What
// stands in the pond stands proud of the stone (the koi, the pads, and the tomb's own carvings, which are a
// picture: its paint in the top half of the look's texture, its height in the bottom half); the water is the
// sign for water, rows of zigzag cut into the face; the paint is flat, faded and worn off in patches.
vec3 lookRelief(){
  vec2 P=gP, uv=gUv; float flt=1.-gCalm*.8;
  vec3 stone=vec3(.845,.82,.76)*(.95+.09*fbm(P*.004))-vec3(.03)*smoothstep(.62,.9,noise(P*vec2(.011,.04)+2.));
  vec3 blu=vec3(.27,.45,.66), grn=vec3(.39,.57,.43), red=vec3(.64,.29,.18), ylw=vec3(.82,.63,.26), dark=vec3(.24,.2,.17);
  // where the paint has held: less at the edges of the wall, and in patches
  float held=smoothstep(.34,.58,fbm(P*.017+7.))*(.75+.25*noise(P*.6));
  // the tomb's carvings
  vec2 mv=vec2(uv.x,clamp(uv.y,.002,.998)*.5); vec4 pc=texture(uMural,mv)*uPic; float ph=(texture(uMural,mv+vec2(0.,.5)).r-.502)*uPic, carv=smoothstep(.03,.09,ph);
  // the koi and the pads, with a shoulder where they rise
  // (a koi from the look's carved sheet, uSprite, brings its own line, cut in, and says where it is bare)
  vec4 f0; float fa,fb,fc,rd; fishAt(f0,fa,fb,fc,rd); vec3 fcol=f0.rgb/max(f0.a,1e-3);
  float fbare=(1.-smoothstep(.05,.14,distance(fcol,vec3(.886,.863,.804))))*uSprite, fline=(1.-smoothstep(.22,.42,dot(fcol,vec3(.333))))*f0.a*uSprite;
  vec4 pd=textureLod(uPads,uv,0.); float pb=textureLod(uPads,uv,1.6).a; vec3 pcol=pd.rgb/max(pd.a,1e-3);
  vec4 tp=textureLod(uTop,uv,0.); float tb=textureLod(uTop,uv,1.5).a;
  float proud=clamp(max(max(smoothstep(.08,.7,fb),pb),max(carv,tb)),0.,1.);
  // the water: zigzags in rows, each row sliding a little, shaken where the water moves; none under the
  // type, nor in the plain band under the frieze, where the clock stands
  vec2 Q=P+gG*70.; float row=floor(Q.y/28.), zx=Q.x/30.+row*.37+uTime*.012*(mod(row,2.)<1.?1.:-1.)+gH*2.;
  float zig=abs((fract(Q.y/28.)-.5)*28.-(abs(fract(zx)-.5)*2.-.5)*11.), groove=(1.-smoothstep(.9,2.6,zig))*(1.-proud)*(1.-gCalm)*smoothstep(.15,.22,uv.y);
  // the surface: its height above the stone's face, in pixels
  float h=ph*34.+smoothstep(.08,.7,fb)*4.6+pb*3.2+tb*2.2-groove*.75+((noise(P*.45)-.5)*.22+(noise(vec2(P.x+P.y,P.x-P.y)*vec2(.03,.16))-.5)*.16)*(1.-uPic);
  // (scales cut into the koi, veins into the pads)
  h-=smoothstep(.5,.9,f0.a)*(1.-smoothstep(.5,1.5,abs(length(fract(P/7.+vec2(floor(P.y/7.)*.5,0.))-vec2(.5,1.))*7.-4.)))*.35*(1.-uSprite)+fline*1.3;
  h-=pd.a*(1.-smoothstep(.0,.12,abs(fract(atan(P.y-uCss.y*.5,P.x-uCss.x*.5)*4.)-.5)-.44))*.5;
  h*=flt;
  // a press is a chisel's strike: a chip out of the face, bare stone in it, and its dust thrown out
  float bare=0., dust=0.;
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
    float t=b.z, d=length(P-b.xy)+(noise(P*.35+b.x)-.5)*5., R=7.+5.*fract(b.x*.37), chip=(1.-smoothstep(R*.35,R,d))*exp(-t*.05);
    h-=chip*2.6; bare=max(bare,chip);
    float ring=R+60.*(1.-exp(-t*1.6)); dust+=step(.8,hash1(floor(P/2.5)+floor(b.y)))*(1.-smoothstep(0.,22.,abs(d-ring)))*exp(-t*1.4); }
  if(gIce>0.) h-=clamp(gHit.x,0.,1.)*1.6;
  // the light: from the left in the morning, overhead at noon, from the right towards evening, always low;
  // by night a lamp held low at one side
  float dayT=clamp((uDay-.25)/.5,0.,1.), night=step(uDay,.25)+step(.75,uDay);
  float th=mix(mix(-2.62,-.52,dayT),2.25,night), el=mix(mix(.4,.66,sin(dayT*3.1416)),.38,night);
  vec3 L=vec3(cos(th)*cos(el),sin(th)*cos(el),sin(el));
  vec2 dh=vec2(dFdx(h),dFdy(h))*(uRes.x/uCss.x); vec3 n=normalize(vec3(-dh,1.));
  float lit=dot(n,L)/L.z;
  // what stands proud throws a short shadow away from the light
  vec2 so=L.xy*7./uCss; float shade=clamp((max(max(smoothstep(.08,.7,textureLod(uFish,uv+so,1.5).a),textureLod(uPads,uv+so,1.6).a),
    smoothstep(.03,.09,(texture(uMural,vec2(uv.x+so.x,clamp(uv.y+so.y,.002,.998)*.5+.5)).r-.502)*uPic))-proud)*flt,0.,1.);
  // the paint, flat and faded, over the stone
  vec3 c=stone;
  c=mix(c,blu,(.1*(1.-proud)+groove*.42)*held*flt*(1.-gCalm));
  c=mix(c,mix(pc.rgb/max(pc.a,1e-3),stone,.18),pc.a*.92);
  c=mix(c,mix(mix(grn,red,clamp((pcol.r-pcol.g)*2.5,0.,1.)),stone,.2),pd.a*(.35+.5*held));
  vec3 fp=mix(mix(vec3(.9,.87,.8),ylw,clamp((fcol.r-fcol.b)*1.7-.1,0.,1.)),red,smoothstep(.2,.5,rd));
  // (under the title's type the koi are only faintly there, as in the other looks)
  c=mix(c,mix(mix(fp,fcol,uSprite),stone,.12),f0.a*mix(.6+.35*held,(1.-fbare)*.92,uSprite)*(1.-gCalm*.72));
  c=mix(c,mix(tp.rgb/max(tp.a,1e-3),stone,.45),tp.a*.7);
  c=mix(c,dark,clamp(max(max((fa-fb)*3.4,abs(pd.a-pb)*2.6),abs(tp.a-tb)*2.4),0.,1.)*.7*flt);
  c=mix(c,stone*1.06,bare);
  c*=mix(1.,clamp(lit,.42,1.65),.9)*(1.-shade*.34);
  c*=mix(vec3(1.),vec3(1.,.92,.78)*.88,night);
  c+=vec3(.9,.88,.82)*dust*.5;
  // winter: frost on the stone, white in the cuts
  if(gIce>0.){ c=mix(c,vec3(.95,.96,.97),gIce*.4*(.6+.4*noise(P*.5))); c=mix(c,vec3(1.),step(.9,hash1(floor(P/7.)))*(1.-smoothstep(.9,2.,length(fract(P/7.)*7.-3.5-(hash2(floor(P/7.))-.5)*3.)))*uSnow*gIce*.7); }
  return c;
}
vec3 lookNew(int s){
  if(s==6) return lookMonet();
  if(s==7) return lookQinghua();
  if(s==8) return lookDunhuang();
  if(s==9) return lookStars();
  return lookRelief();
}
`;
