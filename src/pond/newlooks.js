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
float grain(vec2 P){ return .5+.5*noise(P*1.9)*(.6+.4*noise(P*.7+9.)); }
// one layer of short loaded strokes: cells longer than they are high, every other row set off; returns the
// stroke's own place (where its colour is taken) and how much of it covers here, thick in the middle
vec2 dab(vec2 P, vec2 cell, float seed, out float cover, out float ridge){
  vec2 q=P/cell; q.x+=step(1.,mod(floor(q.y),2.))*.5; vec2 id=floor(q), f=fract(q)-.5;
  vec2 j=(hash2(id+seed)-.5)*vec2(.5,.3); f-=j*.5;
  float a=(hash1(id+seed*3.)-.5)*.5; f=vec2(f.x*cos(a)-f.y*sin(a)*cell.y/cell.x, f.x*sin(a)*cell.x/cell.y+f.y*cos(a));
  float d=length(f*vec2(1.9,2.1)); cover=1.-smoothstep(.72,1.02,d+(noise(P*.35+seed)-.5)*.28);
  ridge=f.y*2.; vec2 at=(id+.5+j); at.x-=step(1.,mod(id.y,2.))*.5; return at*cell;
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
  col*=.86+.3*hash1(floor(at/7.)+seed);
  vec4 pd=textureLod(uPads,uv,2.); vec3 pc=pd.rgb/max(pd.a,1e-3);
  col=mix(col,mix(vec3(.26,.50,.36),vec3(.48,.62,.40),hash1(floor(at/9.)+seed))*(.8+.5*pc.g)+vec3(.5,.2,.3)*clamp((pc.r-pc.g)*2.,0.,1.),smoothstep(.25,.6,pd.a));
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
  vec2 P=gP+gG*70.+vec2(sin(gP.y*.02+uTime*.3),0.)*1.5;
  float c1,r1,c2,r2,c3,r3;
  vec2 a1=dab(P,vec2(46.,17.),1.,c1,r1), a2=dab(P+vec2(13.,7.),vec2(34.,13.),5.,c2,r2), a3=dab(P.yx+vec2(5.,21.),vec2(40.,12.),9.,c3,r3);
  vec3 col=pondOil(P,0.)*.92;
  col=mix(col,pondOil(a1,1.),c1);
  // reflections run downwards: upright strokes where the trees stand in the water
  float up=smoothstep(.5,.7,fbm(gP*vec2(.006,.0018)+20.));
  col=mix(col,pondOil(a3.yx-vec2(21.,5.)+vec2(0.,0.),9.)*vec3(.82,.9,.84),c3*up);
  col=mix(col,pondOil(a2-vec2(13.,7.),5.),c2*.92);
  // thick paint catches the light along a stroke's upper edge, and the canvas shows through its weave
  float ridge=mix(r1*c1,r2*c2,c2);
  col+=vec3(.10,.10,.09)*smoothstep(.2,.9,-ridge)-vec3(.07)*smoothstep(.3,.95,ridge);
  col+=vec3(.9,.95,1.)*clamp(abs(gLap)*14.,0.,.5)*(1.-gCalm*.8)*step(.4,c2);
  col*=.95+.05*sin(gP.x*2.6)*sin(gP.y*2.6);
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
  float e=min(min(P.x,uCss.x-P.x),min(P.y,uCss.y-P.y)), along=(min(P.x,uCss.x-P.x)<min(P.y,uCss.y-P.y))?P.y:P.x;
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
  // the water: ribbons that rise and fall together, a white line between each
  float y=P.y+26.*sin(P.x*.011+uTime*.12)+10.*sin(P.x*.031-uTime*.2)+gH*70., band=y/30., bi=floor(band), bf=fract(band);
  vec3 bc=mod(bi,3.)<1.?qing:mod(bi,3.)<2.?lv:mix(qing,bai,.55);
  c=mix(c,bc,.62*keep*(1.-gCalm*.96)); c=mix(c,bai,smoothstep(.43,.5,abs(bf-.5))*.7*keep*(1.-gCalm*.96));
  // two ribbons adrift, as the flying figures trail them
  for(int i=0;i<2;i++){ float fi=float(i), x=P.x+uTime*(6.+fi*3.), yy=uCss.y*(.24+.5*fi)+46.*sin(x*.006+fi*2.)+18.*sin(x*.017), w=7.+5.*sin(x*.011+fi);
    float rb=1.-smoothstep(w-1.5,w,abs(P.y-yy)); c=mix(c,mix(zhu,bai,.25+.5*fi),rb*.7*keep*smoothstep(.3,.6,noise(vec2(x*.002,fi*7.)))*(1.-gCalm)); c=mix(c,line,(1.-smoothstep(0.,1.2,abs(abs(P.y-yy)-w)))*rb*.0); }
  // lotus pads: mineral green, ringed dark; the flower red and white
  vec4 pd=textureLod(uPads,uv,0.); float pe=textureLod(uPads,uv,1.5).a; vec3 pc=pd.rgb/max(pd.a,1e-3);
  c=mix(c,mix(lv*1.1,zhu,clamp((pc.r-pc.g)*2.5,0.,1.)),pd.a*.9*keep); c=mix(c,line,clamp(abs(pd.a-pe)*3.,0.,1.)*.85);
  // koi: flat colour inside a dark line, red where they are red
  vec4 f0; float fa,fb,fc,red; fishAt(f0,fa,fb,fc,red); vec3 fcol=f0.rgb/max(f0.a,1e-3);
  c=mix(c,mix(mix(bai,vec3(.80,.56,.22),clamp((fcol.r-fcol.b)*1.6-.1,0.,1.)),zhu,smoothstep(.2,.5,red)),f0.a*mix(1.,keep,.5));
  c=mix(c,line,clamp((fa-fb)*3.8,0.,1.));
  c=mix(c,wall,gCalm*.62);
  vec4 tp=textureLod(uTop,uv,0.); float te=textureLod(uTop,uv,1.5).a; c=mix(c,tp.rgb/max(tp.a,1e-3)*.8,tp.a*.8*keep*(1.-gCalm*.6)); c=mix(c,line,clamp(abs(tp.a-te)*3.,0.,1.)*.7);
  // a press: the pigment lifts off in a patch, and its dust drifts out and settles
  for(int i=0;i<10;i++){ vec3 b=uBlot[i]; if(b.z<0.) continue;
    float t=b.z, R=10.+34.*(1.-exp(-t*3.)), d=length(P-b.xy)+(noise(P*.2)-.5)*16.;
    c=mix(c,wall*1.06,(1.-smoothstep(R*.7,R,d))*exp(-t*.05)*.9);
    float ring=R+70.*(1.-exp(-t*.9)); c=mix(c,bai*.9,step(.86,hash1(floor(P/3.)+floor(b.x)))*(1.-smoothstep(0.,26.,abs(d-ring)))*exp(-t*1.1)*.8); }
  // age: fine cracks, and the soot of lamps towards the edges
  c=mix(c,line,seams(P/90.)*.2); c*=1.-.5*dot(uv-.5,uv-.5); c*=.94+.12*noise(P*1.3);
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
float star5(vec2 p,float r){ float a=atan(p.x,-p.y), s=6.2831853/5.; a=mod(a,s)-s*.5; vec2 q=length(p)*vec2(cos(a),abs(sin(a)));
  vec2 e=vec2(cos(s*.5),sin(s*.5)); q-=r*e; vec2 w=vec2(-e.y*.42-e.x*.6,e.x*.42-e.y*.6); float hh=clamp(dot(q,w)/dot(w,w),0.,1.); return length(q-w*hh); }
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
  c=mix(c,mix(ylw,wht,step(.5,fcol.b)),f0.a*fh*.5*g); c=mix(c,pnk,smoothstep(.2,.5,red)*g*.9); c=mix(c,wht,clamp((fa-fb)*3.8,0.,1.)*(.55+.45*g));
  vec4 tp=textureLod(uTop,uv,0.); float te=textureLod(uTop,uv,1.5).a; c=mix(c,ylw,clamp(abs(tp.a-te)*3.,0.,1.)*g*.8);
  // the border the class draws round its board: a line, a row of points in two colours, a line
  float e=min(min(P.x,uCss.x-P.x),min(P.y,uCss.y-P.y)), along=(min(P.x,uCss.x-P.x)<min(P.y,uCss.y-P.y))?P.y:P.x;
  float zig=abs(fract(along/26.)-.5)*2., bl=(1.-smoothstep(0.,1.3,abs(e-8.)-.7))+(1.-smoothstep(0.,1.3,abs(e-30.)-.7));
  float tri=1.-smoothstep(0.,1.6,abs((e-12.)-zig*14.)-.8);
  c=mix(c,ylw,bl*g*.85*(1.-gCalm*.4)); c=mix(c,mod(floor(along/26.),2.)<1.?pnk:blu,tri*step(10.,e)*step(e,28.)*g*.9*(1.-gCalm*.4));
  // in two corners, what every board has: a few stars
  for(int i=0;i<3;i++){ float fi=float(i); vec2 sp=vec2(uCss.x-70.-fi*44.,uCss.y-64.-mod(fi,2.)*22.);
    c=mix(c,i==1?pnk:ylw,(1.-smoothstep(0.,1.5,abs(star5(P-sp,13.-fi*2.))-.7))*g*.9); }
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
