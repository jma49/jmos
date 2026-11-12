// Five looks that are only previews (a build with PUBLIC_POND_PREVIEW=1): Monet's water lilies in oil,
// blue-and-white porcelain (青花), a Dunhuang mural (敦煌), a star chart (星图) and a school blackboard
// newspaper (黑板报). Each is a function of the water pass, drawn from what that pass has already worked
// out (the ripples, the koi, the pads, where the water was pressed), as the other looks are; none adds a
// pass, and each is built as a pass of its own once it is asked for (engine.js, fsPart).

/** The new looks and their numbers in the shader, after the six that ship. */
export const NEW_LOOKS = ['monet', 'qinghua', 'dunhuang', 'stars', 'chalk'];
export const NEW_SID = { monet: 6, qinghua: 7, dunhuang: 8, stars: 9, chalk: 10 };

/** How each lays the dove and the spider into the air, the glass's tint, and how fast its front runs out. */
export const NEW_LAY = { qinghua: ['multiply', 0.85], dunhuang: ['multiply', 0.8], stars: ['lighter', 0.6], chalk: ['screen', 0.7] };
export const NEW_GLASS = {
  monet: [0.2, 0.26, 0.36],
  qinghua: [0.93, 0.95, 0.97],
  dunhuang: [0.8, 0.66, 0.46],
  stars: [0.01, 0.015, 0.045],
  chalk: [0.07, 0.17, 0.13]
};

/** How much of the tree's shade lies over each: none on glaze, plaster, the night sky or a board. */
export const NEW_SHADE = { monet: 0.5, qinghua: 0, dunhuang: 0, stars: 0, chalk: 0 };

/** The Dunhuang wall's pictures (public/pond/dunhuang/), fetched the first time the look is asked for. */
export const MURAL = { pipa: '/pond/dunhuang/feitian-pipa.webp', flowers: '/pond/dunhuang/feitian-flowers.webp', sky: '/pond/dunhuang/sky-flowers.webp' };
/**
 * Where each picture goes on a wall of W by H: the pipa player high in the right half, flying left towards
 * the title; the one scattering flowers lower right, coming down, her lotus falling on towards the pond; a
 * few clouds by them, the pearl once; the left third left as plaster. On a narrow wall, one figure, in the
 * open water under the contents. Each entry is [picture, source x, y, w, h, x, y, w, h]; faces are [x, y, radius], kept from flaking.
 */
export function muralLayout(W, H, wide) {
  const cell = (i, j) => [i * 256 + 40, j * 256 + 40, 176, 176],
    sky = (i, j, x, y, s) => ['sky', ...cell(i, j), x - s / 2, y - s / 2, s, s];
  if (!wide) {
    // (below the contents, in the open water: at the top she would lie under the greeting)
    const w = W * 1.25,
      x = W * 0.03,
      y = H * 0.615;
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
    w2 = Math.min(W * 0.43, H * 0.9),
    x2 = W * 0.95 - w2,
    y2 = H * 0.5,
    u = Math.min(W, H * 1.6) / 1280;
  return {
    draw: [
      sky(0, 0, x1 + w1 * 0.9, y1 + w1 * 0.44, 110 * u),
      sky(2, 0, x1 - 30 * u, y1 + w1 * 0.36, 96 * u),
      sky(1, 0, x2 + w2 * 0.96, y2 + w2 * 0.08, 100 * u),
      sky(3, 1, x1 - 120 * u, y1 + 40 * u, 84 * u),
      ['pipa', 0, 0, 1536, 768, x1, y1, w1, w1 / 2],
      ['flowers', 0, 0, 1536, 768, x2, y2, w2, w2 / 2],
      sky(3, 0, x2 - 70 * u, y2 + w2 * 0.47, 62 * u),
      sky(1, 1, x2 - 150 * u, y2 + w2 * 0.5 + 50 * u, 54 * u),
      sky(2, 1, x2 - 230 * u, y2 + w2 * 0.5 + 96 * u, 46 * u)
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
  ['chalk', 'Blackboard', 'A school board in chalk; or draw a tick', 'chalk blackboard board school newspaper 黑板报 黒板']
];

/** The looks' functions, added to the water pass after the six that ship. */
export const NEW_GLSL = `
// ---------- the preview looks ----------
uniform sampler2D uMural; uniform vec3 uFace[2];
float grain(vec2 P){ return .5+.5*noise(P*1.9)*(.6+.4*noise(P*.7+9.)); }
// one layer of loaded strokes. Each lies along the water's flow where it is, a little off it; longer or shorter,
// pressed harder or less; ragged at its ends where the bristles part. Returns the stroke's own place (where its
// colour is taken), how much of it covers here, and where across its width this is (for the ridge of paint).
vec2 dab(vec2 P, vec2 cell, float seed, out float cover, out float ridge){
  vec2 q=P/cell; q.x+=step(1.,mod(floor(q.y),2.))*.5; vec2 id=floor(q), f=fract(q)-.5;
  vec2 j=(hash2(id+seed)-.5)*vec2(.6,.4); f-=j*.5;
  vec2 at=id+.5+j*.5; at.x-=step(1.,mod(id.y,2.))*.5; at*=cell;
  float a=(noise(at*.0035+seed)-.5)*1.3+(hash1(id+seed*3.)-.5)*.5+clamp(gG.x*5.,-.3,.3);
  float ln=.8+.55*hash1(id+seed*5.), pr=.6+.4*hash1(id+seed*7.);
  vec2 px=f*cell, r=vec2(px.x*cos(a)+px.y*sin(a),-px.x*sin(a)+px.y*cos(a))/cell; r.x/=ln;
  float d=length(r*vec2(1.7,2.15))+(noise(P*.3+seed)-.5)*.3+abs(noise(vec2(r.y*11.,id.x+seed))-.5)*.5*smoothstep(.18,.5,abs(r.x));
  cover=(1.-smoothstep(.5,1.06,d))*pr; ridge=r.y*2.; return at;
}
// what Monet's pond is at a place: water in violet, green, rose and blue, the lilies' pads, the koi
vec3 pondOil(vec2 at, float seed){
  vec2 uv=at/uCss;
  float a=fbm(at*.0042+vec2(0.,uTime*.006)), b=fbm(at*vec2(.011,.0034)+7.+seed), c=noise(at*.0028+3.);
  vec3 col=mix(vec3(.30,.36,.60),vec3(.25,.47,.42),smoothstep(.35,.65,a));
  col=mix(col,vec3(.52,.42,.66),smoothstep(.5,.78,b)*.8);
  col=mix(col,vec3(.84,.60,.68),smoothstep(.52,.78,c)*smoothstep(.36,.6,b)*.85);
  col=mix(col,vec3(.70,.80,.90),smoothstep(.56,.84,fbm(at*vec2(.004,.016)+11.))*.7);
  col=mix(col,vec3(.14,.30,.26),smoothstep(.6,.86,fbm(at*vec2(.009,.003)+31.))*.6);
  col=mix(col,vec3(.93,.86,.70),smoothstep(.74,.92,noise(at*.006+17.))*.5);
  // broken colour: each stroke leans to one pure pigment, so the eye does the mixing
  float hq=hash1(floor(at/4.)+seed*11.);
  col=mix(col,hq<.25?vec3(.44,.34,.72):hq<.5?vec3(.20,.40,.74):hq<.75?vec3(.18,.50,.38):vec3(.88,.58,.70),.26*step(.5,seed));
  col*=.86+.3*hash1(floor(at/7.)+seed);
  // the lilies: pads in thick greens, lighter where the light catches them; the flowers pink and white
  vec4 pd=textureLod(uPads,uv,1.6); vec3 pc=pd.rgb/max(pd.a,1e-3); float hp=hash1(floor(at/9.)+seed);
  vec3 leaf=mix(mix(vec3(.20,.42,.30),vec3(.44,.62,.38),hp),vec3(.62,.74,.50),step(.82,hp));
  col=mix(col,mix(leaf,mix(vec3(.97,.90,.92),vec3(.93,.52,.66),hp),clamp((pc.r-pc.g)*3.,0.,1.)),smoothstep(.2,.55,pd.a));
  vec4 f=textureLod(uFish,uv+gRef*.25,2.2); vec3 fc=f.rgb/max(f.a,1e-3);
  col=mix(col,mix(fc*1.15+vec3(.08,.02,-.04),vec3(.95,.5,.2),clamp((fc.r-fc.b)*1.2,0.,.6)),smoothstep(.3,.7,f.a));
  vec4 tp=textureLod(uTop,uv,1.5); col=mix(col,tp.rgb/max(tp.a,1e-3),smoothstep(.3,.7,tp.a)*.8);
  for(int i=0;i<10;i++){ vec3 bl=uBlot[i]; if(bl.z<0.) continue;
    float t=bl.z, R=16.+54.*sqrt(t)*(1.-exp(-t*1.4)), d=length(at-bl.xy)+(hash1(floor(at/5.))-.5)*14.;
    vec3 paint=mix(vec3(.96,.86,.62),vec3(.93,.58,.66),step(.5,fract(bl.x*.37)));
    col=mix(col,mix(paint,col,smoothstep(0.,7.,t)*.7),(1.-smoothstep(R*.6,R,d))*exp(-t*.12)); }
  // winter: the ice in white and the palest blue, laid on thick
  col=mix(col,mix(vec3(.86,.90,.95),vec3(.72,.80,.92),hash1(floor(at/6.)+seed)),gIce*.82);
  return col;
}
vec3 lookMonet(){
  vec2 P=gP+gG*26.+vec2(sin(gP.y*.02+uTime*.3),0.)*1.5;
  float c1,r1,c2,r2,c3,r3,c4,r4;
  vec2 a1=dab(P,vec2(58.,19.),1.,c1,r1), a2=dab(P+vec2(13.,7.),vec2(38.,13.),5.,c2,r2), a3=dab(P.yx+vec2(5.,21.),vec2(62.,11.),9.,c3,r3), a4=dab(P+vec2(31.,3.),vec2(22.,9.),13.,c4,r4);
  // an underpainting, then the strokes over it wet into wet: each takes a little of what is under it
  vec3 col=pondOil(P,0.)*.9;
  col=mix(col,pondOil(a1,1.),c1);
  // reflections are dragged downwards: long upright strokes where the trees stand in the water
  float up=smoothstep(.42,.66,fbm(gP*vec2(.006,.0018)+20.));
  col=mix(col,pondOil(a3.yx-vec2(21.,5.),9.)*vec3(.80,.90,.86),c3*up*.9);
  col=mix(col,pondOil(a2-vec2(13.,7.),5.),c2);
  c4*=step(.42,hash1(floor(a4/7.)));
  col=mix(col,pondOil(a4-vec2(31.,3.),13.)*1.06,c4*.9);
  // thick paint stands up: light along a stroke's upper edge, a thin shadow under its lower one
  float cov=max(max(c1*.6,c2),c4), ridge=c4>.3?r4:c2>.3?r2:r1;
  col+=vec3(.17,.16,.14)*smoothstep(.2,.85,-ridge)*cov-vec3(.11,.11,.12)*smoothstep(.3,.95,ridge)*cov;
  col+=vec3(.9,.95,1.)*clamp(abs(gLap)*14.,0.,.5)*(1.-gCalm*.8)*step(.4,c2);
  // the canvas shows through, a weave under everything
  col*=.94+.06*sin(gP.x*2.6)*sin(gP.y*2.6);
  col=mix(col,vec3(.27,.30,.42),gCalm*.5);
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
  c=mix(c,wash,pw*.34*pool); c=mix(c,deep,clamp(abs(pd.a-pe)*3.2,0.,1.)*pool);
  vec3 pc=pd.rgb/max(pd.a,1e-3); c=mix(c,deep,clamp((pc.r-pc.g)*2.2,0.,1.)*pd.a*.6);
  // koi: outline in the deep blue, the body a wash, their red patches filled dark
  vec4 f0; float fa,fb,fc,red; fishAt(f0,fa,fb,fc,red);
  c=mix(c,wash,fb*.5*pool); c=mix(c,deep,clamp((fa-fb)*3.6,0.,1.)*clamp(pool,0.,1.)); c=mix(c,deep,smoothstep(.2,.6,red)*.85*pool);
  c=mix(c,mix(wash,deep,.4),step(.5,f0.a)*smoothstep(.34,.46,abs(fract((P.x+P.y)*.11)-.5))*.35);
  vec4 tp=textureLod(uTop,uv,0.); float te=textureLod(uTop,uv,1.5).a; c=mix(c,deep,clamp(abs(tp.a-te)*3.,0.,1.)*.8*pool);
  // the rim: two lines and a row of petals between them
  float fs=mix(1.,.56,uCalm.x), e=min(min(P.x,uCss.x-P.x),min(P.y,uCss.y-P.y))/fs, along=((min(P.x,uCss.x-P.x)<min(P.y,uCss.y-P.y))?P.y:P.x)/fs;
  // (what is painted inside the bowl stops at the rim: nothing swims under it)
  c=mix(c,glaze,1.-smoothstep(39.,43.,e));
  float rim=(1.-smoothstep(0.,1.,abs(e-10.)-.5))+(1.-smoothstep(0.,1.,abs(e-13.5)-.2))+(1.-smoothstep(0.,1.,abs(e-36.)-.4));
  float pet=1.-smoothstep(0.,1.1,abs(length(vec2((fract(along/24.)-.5)*24.,e-25.))-8.)-.5);
  c=mix(c,deep,clamp(rim+pet*step(15.,e)*step(e,35.),0.,1.)*clamp(pool,0.,1.)*.85);
  // the crackle, and a new craze line from each press, running out along the glaze
  c=mix(c,vec3(.55,.50,.44),seams(P/46.)*.13+seams(P/17.+3.)*.05);
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
  vec3 wall=vec3(.76,.60,.39)*(.9+.2*fbm(P*.006))-vec3(.07,.06,.05)*smoothstep(.55,.9,noise(P*vec2(.012,.05)));
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
  c=mix(c,mix(mix(bai,vec3(.80,.56,.22),clamp((fcol.r-fcol.b)*1.6-.1,0.,1.)),zhu,smoothstep(.2,.5,red)),f0.a*mix(1.,keep,.5));
  c=mix(c,line,clamp((fa-fb)*3.8,0.,1.));
  c=mix(c,wall,gCalm*.62*(1.-mu.a*.75*uCalm.x));
  vec4 tp=textureLod(uTop,uv,0.); float te=textureLod(uTop,uv,1.5).a; c=mix(c,tp.rgb/max(tp.a,1e-3)*.8,tp.a*.8*keep*(1.-gCalm*.6)); c=mix(c,line,clamp(abs(tp.a-te)*3.,0.,1.)*.7);
  // a press: the pigment lifts off in a patch, and its dust drifts out and settles
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
    float t=b.z, R=10.+34.*(1.-exp(-t*3.)), d=length(P-b.xy)+(noise(P*.2)-.5)*16.;
    c=mix(c,wall*1.06,(1.-smoothstep(R*.7,R,d))*exp(-t*.05)*.9);
    float ring=R+70.*(1.-exp(-t*.9)); c=mix(c,bai*.9,step(.86,hash1(floor(P/3.)+floor(b.x)))*(1.-smoothstep(0.,26.,abs(d-ring)))*exp(-t*1.1)*.8); }
  // age: fine cracks, and the soot of lamps towards the edges
  c=mix(c,line,seams(P/150.+noise(P*.004)*1.5)*.13*smoothstep(.3,.6,noise(P*.006+9.))); c*=1.-1.15*dot(uv-.5,uv-.5)*(1.-gCalm*.55); c=mix(c,c*vec3(.84,.76,.64),.3*(1.-gCalm)); c*=.94+.12*noise(P*1.3);
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
  float band=exp(-pow(((S.x-pole.x)*.55+(S.y-pole.y)*.83-uCss.y*.95)/(uCss.y*.2),2.));
  c+=vec3(.16,.17,.24)*band*(.25+.75*fbm(S*.006+3.))*.55+vec3(.5,.52,.6)*band*pow(noise(S*.5),6.)*.5;
  for(int k=0;k<2;k++){ float sz=k==0?46.:19.; vec2 id=floor(S/sz), f=fract(S/sz)-.5, o=(hash2(id+float(k)*7.)-.5)*.7; float h=hash1(id+float(k)*13.);
    float tw=.75+.25*sin(uTime*(1.+h*2.)+h*40.), m=step(k==0?.72:.6,h);
    c+=mix(vec3(.8,.87,1.),vec3(1.,.9,.74),step(.9,h))*(k==0?star4((f-o)*sz,1.1+h*1.2):exp(-dot(f-o,f-o)*sz*sz/.7))*m*tw*(k==0?.9:.5); }
  // orbits: the ripples as thin rings
  float ring=smoothstep(.45,.5,abs(fract(gH*14.)-.5));
  c+=vec3(.45,.6,.9)*ring*smoothstep(.015,.07,abs(gLap)*4.+abs(gH)*.7)*.3*(1.-gCalm*.9);
  // pads: a ring, and a little cloud inside it
  vec4 pd=textureLod(uPads,uv,0.); float pe=textureLod(uPads,uv,1.6).a;
  c+=vec3(.42,.3,.62)*pd.a*fbm(P*.02+2.)*.3+vec3(.6,.75,1.)*clamp(abs(pd.a-pe)*3.,0.,1.)*.4;
  // the koi, already drawn as stars and the lines between them
  vec4 f=textureLod(uFish,uv+gRef*.2,0.); c+=f.rgb*1.15+vec3(.25,.4,.8)*textureLod(uFish,uv,3.).a*.3;
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
// 黑板报: a dark green board, smudged where it was wiped; everything in chalk
vec3 lookChalk(){
  vec2 P=gP, uv=gUv;
  vec3 board=vec3(.085,.215,.165)*(.92+.16*fbm(P*.003));
  // where the eraser passed: long pale smears, and the dust left in the board's grain
  float sm=smoothstep(.5,.85,fbm(P*vec2(.0035,.012)+vec2(3.,0.)))*.5+smoothstep(.6,.9,fbm(P.yx*vec2(.004,.014)+8.))*.3;
  vec3 c=board+vec3(.10,.12,.11)*sm+vec3(.05)*step(.93,noise(P*1.6))*.5;
  float g=grain(P); vec3 wht=vec3(.95,.95,.9), blu=vec3(.62,.8,.95), ylw=vec3(.98,.88,.5), pnk=vec3(.98,.62,.68), grn=vec3(.66,.9,.6);
  // the water: wavy lines, hatched, in pale blue chalk
  float row=(P.y+7.*sin(P.x*.024+floor(P.y/30.)*1.7)+gH*90.)/30., wl=smoothstep(.44,.5,abs(fract(row)-.5));
  wl*=step(.34,noise(vec2(P.x*.012+floor(row)*5.,floor(row))))*(.35+clamp(abs(gLap)*20.+length(gG),0.,.5));
  c=mix(c,blu,wl*g*(1.-gCalm*.85));
  // pads and lotus: drawn round, filled with a few slanting strokes
  vec4 pd=textureLod(uPads,uv,0.); float pe=textureLod(uPads,uv,1.5).a; vec3 pc=pd.rgb/max(pd.a,1e-3);
  float hat=smoothstep(.3,.44,abs(fract((P.x-P.y)*.07)-.5));
  c=mix(c,mix(grn,pnk,clamp((pc.r-pc.g)*2.5,0.,1.)),(clamp(abs(pd.a-pe)*3.2,0.,1.)+pd.a*hat*.4)*g);
  // koi: a white line round them, their patches rubbed in with coloured chalk
  vec4 f0; float fa,fb,fc,red; fishAt(f0,fa,fb,fc,red); vec3 fcol=f0.rgb/max(f0.a,1e-3);
  float fh=smoothstep(.28,.44,abs(fract((P.x+P.y)*.09)-.5));
  c=mix(c,mix(ylw,wht,step(.5,fcol.b)),f0.a*fh*.5*g); c=mix(c,pnk,smoothstep(.2,.5,red)*g*.9); c=mix(c,wht,clamp((fa-fb)*4.4+(fb-fc)*.5,0.,1.)*(.8+.2*g));
  vec4 tp=textureLod(uTop,uv,0.); float te=textureLod(uTop,uv,1.5).a; c=mix(c,ylw,clamp(abs(tp.a-te)*3.,0.,1.)*g*.8);
  // the border the class draws round its board, always on top: two lines, a row of points in two colours
  // between them, and a fan of arcs in each corner
  float fs=mix(1.,.56,uCalm.x); vec2 ed=vec2(min(P.x,uCss.x-P.x),min(P.y,uCss.y-P.y))/fs; float e=min(ed.x,ed.y), along=(ed.x<ed.y?P.y:P.x)/fs;
  c=mix(c,board+vec3(.10,.12,.11)*sm,1.-smoothstep(42.,46.,e));
  float zig=abs(fract(along/30.)-.5)*2., bl=(1.-smoothstep(0.,1.3,abs(e-9.)-.8))+(1.-smoothstep(0.,1.3,abs(e-39.)-.8));
  float tri=1.-smoothstep(0.,1.6,abs((e-14.)-zig*20.)-.9), corner=step(ed.x,46.)*step(ed.y,46.), cr=length(ed-46.);
  c=mix(c,ylw,bl*g*.9*(1.-corner));
  c=mix(c,mod(floor(along/30.),2.)<1.?pnk:blu,tri*step(11.,e)*step(e,37.)*g*.9*(1.-corner));
  for(int i=0;i<3;i++){ float rr=12.+float(i)*12.; c=mix(c,i==0?ylw:i==1?pnk:blu,(1.-smoothstep(0.,1.4,abs(cr-rr)-.9))*corner*step(cr,40.)*g*.9); }
  // drawings in coloured chalk, where a wide board has room: a sun up top, flowers along the bottom
  if(uCalm.x<.5){
    vec2 sp=P-vec2(uCss.x*.52,88.); float sr=length(sp), sa=atan(sp.y,sp.x);
    c=mix(c,ylw,((1.-smoothstep(0.,1.5,abs(sr-19.)-1.))+(1.-smoothstep(0.,.16,abs(fract(sa*12./6.2832)-.5)-.07))*step(26.,sr)*step(sr,38.+4.*sin(sa*6.)))*g*.9);
    for(int i=0;i<3;i++){ float fi=float(i); vec2 fp=P-vec2(uCss.x*(.535+.045*fi),uCss.y-78.-mod(fi,2.)*9.); float fr=length(fp), fa=atan(fp.y,fp.x);
      c=mix(c,i==1?ylw:pnk,(1.-smoothstep(0.,1.4,abs(fr-(7.+3.5*cos(fa*5.)))-.8))*g*.9); c=mix(c,i==1?pnk:ylw,(1.-smoothstep(1.5,3.,fr))*g);
      c=mix(c,grn,(1.-smoothstep(0.,1.3,abs(fp.x-2.*sin(fp.y*.2))-.8))*step(11.,fp.y)*step(fp.y,30.)*g*.9); }
  }
  // the ledge under the board, and the dust that has settled on it
  float ly=(uCss.y-P.y)/fs; c=mix(c,vec3(.33,.25,.16)*(.85+.3*noise(P*vec2(.05,.8))),1.-smoothstep(4.,5.5,ly));
  c=mix(c,wht,step(.82+.16*smoothstep(4.,26.,ly),hash1(floor(P/2.)))*step(ly,26.)*.55);
  // a press: a small burst of chalk dust, and the mark it leaves, slow to fade
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
    float t=b.z, d=length(P-b.xy), R=6.+46.*(1.-exp(-t*2.2));
    c=mix(c,wht,step(.8,hash1(floor(P/2.5)+floor(b.y)))*(1.-smoothstep(R*.3,R,d))*exp(-t*1.2)*.9);
    c=mix(c,wht,(1.-smoothstep(0.,1.6,abs(d-7.)-1.))*g*exp(-t*.08)*.8); }
  // winter: the ice as a pale rubbing, its cracks in white, the snow as dots
  if(gIce>0.){ c=mix(c,wht,gIce*hat*.2*g); c=mix(c,wht,clamp(gHit.x,0.,1.)*g);
    c=mix(c,wht,(1.-smoothstep(1.2,2.2,length(fract(P/18.)*18.-9.-(hash2(floor(P/18.))-.5)*9.)))*step(1.-.4*uSnow,hash1(floor(P/18.)+3.))*gIce*g); }
  return c;
}
vec3 lookNew(int s){
  if(s==6) return lookMonet();
  if(s==7) return lookQinghua();
  if(s==8) return lookDunhuang();
  if(s==9) return lookStars();
  return lookChalk();
}
`;
