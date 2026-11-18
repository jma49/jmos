// The room in the browser, for the page at /room (src/pages/room.astro; boot.ts starts it once it
// knows there is WebGL). export.py (tools/pond/room) wrote everything this fetches, into
// public/room/: room.glb (the indoor part), lm/*.webp (baked light for the big surfaces),
// backdrop-<season>.webp (what is outside the glass, one picture for each season) and
// manifest.json (the seat camera, the lamp, how light is encoded, the seasons). The map's shapes
// and places are bundled with the code (us-map.json, which tools/pond/room/web/build-map.mjs
// writes, and places.json). The Dell's picture is public/room/screens/dell.webp, which
// tools/pond/room/web/shot-screens.cjs takes of the site's own desktop.
//
// All diffuse light is baked: light maps on the big surfaces, vertex colours on everything
// else. What is live: reflections (an environment captured from the scene itself, and the
// lamp as a point light, both specular only), the screens' glow, bloom and the tone curve.
//
// A press on any of the three screens brings the camera up to it (focusScreen); a press beside
// it, Escape or the "back" control takes it to the seat again (unfocus), and a press on another
// screen, or the left and right arrow keys, takes it across to that one. Each screen is only used
// from close: the Samsung's map (map.js) has states to press; the MacBook (editor.js) has file
// tabs, an editor that scrolls and a terminal that takes the keyboard; the Dell becomes the
// site's desktop itself, /os in a frame laid exactly over its glass, for as long as the camera
// is in front of it.
//
// The window shows the season of the visitor's own date (season.ts); a press on the view outside,
// from the seat, moves to the next one: the backdrops cross-fade, the room's baked light is
// tinted to sit with the new dusk, and what moves outside changes with it (a few leaflets
// drifting down in autumn, light rain in winter; nothing in spring and summer). Only the
// season shown is fetched; another's backdrop comes when it is first asked for.
//
// Query: ?view=laptop|arm|tree|keys (default hero, the seat), ?season=spring|summer|autumn|winter,
// ?still (no drift), ?bloom=0, ?exposure=0.3 (stops).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createEditorScreen } from './editor.js';
import { createMapScreen } from './map.js';
import { focusDistance, verticalFov } from './optics';
import { nextSeason, parseSeason, seasonOf } from './season';
import places from './places.json';
import terminal from './terminal.json';
import usMap from './us-map.json';

const ASSETS = '/room/'; // public/room/, where export.py writes

/**
 * Draws the room on the page's canvas and keeps it drawn. It throws if the browser cannot give
 * the canvas WebGL 2; boot.ts asks first.
 */
export function startRoom() {
  const query = new URLSearchParams(location.search);
  const canvas = document.getElementById('room');
  // Blender's axes (z up, the seat looks toward -y) to three's (y up)
  const bl = (p) => new THREE.Vector3(p[0], p[2], -p[1]);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NoToneMapping; // the last pass does it, as Blender's AgX
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.05, 60);
  // what the MacBook's terminal asks of the room, filled in once the room is there
  const hooks = { season: () => 'summer', effect: () => {} };

  // ---------------------------------------------------------------------------------------------
  // Baked light. A picture or a vertex colour holds (log2(light) - lo) / stops; `light` is the
  // radiance a white matt surface would have there, so the surface shows light * its colour.
  // ---------------------------------------------------------------------------------------------

  const DECODE = /* glsl */ `
vec3 bakedDecode( vec3 v, float lo, float stops ) { return exp2( v * stops + lo ); }
`;

  const CENTROID_COLOR = /* glsl */ `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
  centroid INOUT vec4 vColor;
#endif
`;

  // Reflections have no shadows of their own, so they are dimmed where the baked light says the
  // spot is shut in (under the desk, between the keys): full where light >= occlusion.
  // three.js's sheen is several times stronger than the Principled one the scene was made with,
  // weight for weight; `sheen` scales it back to where the cloth, the mat and the book covers sit
  // in the offline render.
  // The keepsakes on the desk are small and stand in dim corners: `keepsakeFloor` is the least
  // light their baked light is read as, so a white stays a white in the shade. The plush's cloth
  // has its own values (plush, below).
  const settings = { occlusion: 0.02, envIntensity: 1.0, sheen: 0.25, keepsakeFloor: 0.1 };
  // What the season does to the room's baked light (it was baked in summer's dusk): one colour
  // that every baked surface is multiplied by, shared so that changing it changes them all.
  const grade = { value: new THREE.Color(1, 1, 1) };
  const PROBE = { room: [0.2, 0.62, 0.765], laptop: [0, 0.69, 0.79] }; // where the reflections are captured from (Blender axes)

  function bakeLit(material, lo, stops, floor = 0) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.bakeFloor = { value: floor };
      shader.uniforms.bakeLo = { value: lo };
      shader.uniforms.bakeStops = { value: stops };
      shader.uniforms.bakeOcclusion = { value: settings.occlusion };
      shader.uniforms.bakeGrade = grade;
      // With multisampling a pixel's centre can lie outside a thin triangle that only touches it, and
      // the vertex colour is then extrapolated; decoded as a logarithm that makes white specks along
      // every bevel. Sampling at the centroid keeps it inside the triangle.
      shader.vertexShader = shader.vertexShader.replace('#include <color_pars_vertex>', CENTROID_COLOR.replace(/INOUT/g, 'varying'));
      shader.fragmentShader =
        'uniform float bakeLo;\nuniform float bakeStops;\nuniform float bakeOcclusion;\nuniform float bakeFloor;\nuniform vec3 bakeGrade;\n' +
        DECODE +
        shader.fragmentShader
          .replace('#include <color_pars_fragment>', CENTROID_COLOR.replace(/INOUT/g, 'varying'))
          .replace('#include <color_fragment>', '') // the vertex colour is light, not paint
          .replace(
            '#include <aomap_fragment>',
            /* glsl */ `
        #if defined( USE_LIGHTMAP )
          vec3 bakedLight = bakedDecode( texture2D( lightMap, vLightMapUv ).rgb, bakeLo, bakeStops );
        #elif defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          vec3 bakedLight = max( bakedDecode( clamp( vColor.rgb, 0.0, 1.0 ), bakeLo, bakeStops ), vec3( bakeFloor ) );
        #else
          vec3 bakedLight = vec3( 0.0 );
          #define BAKED_NONE
        #endif
        reflectedLight.directDiffuse = vec3( 0.0 );
        reflectedLight.indirectDiffuse = bakedLight * bakeGrade * material.diffuseContribution;
        #ifndef BAKED_NONE
          float bakedOpen = smoothstep( 0.0, bakeOcclusion, dot( bakedLight, vec3( 0.3333 ) ) );
          reflectedLight.indirectSpecular *= bakedOpen;
          reflectedLight.directSpecular *= bakedOpen;
          #ifdef USE_CLEARCOAT
            clearcoatSpecularIndirect *= bakedOpen;
            clearcoatSpecularDirect *= bakedOpen;
          #endif
        #endif
        // the lamp is a point here but a bulb in the room: keep its glints on polished things finite
        reflectedLight.directSpecular = min( reflectedLight.directSpecular, vec3( 1.0 ) );
        #ifdef USE_CLEARCOAT
          clearcoatSpecularDirect = min( clearcoatSpecularDirect, vec3( 1.0 ) );
        #endif
      `
          );
    };
    material.customProgramCacheKey = () => `baked ${lo} ${stops} ${floor}`;
    material.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------------------------
  // The last pass: Blender's AgX with the scene's look ("Medium High Contrast"), so the page and
  // the offline render share one tone curve; then a little dither. The curve itself comes from
  // the manifest, where export.py put what Blender's colour management does to a grey ramp; it
  // stands where three.js's AgX has a polynomial (which is brighter in the middle and has no looks).
  // ---------------------------------------------------------------------------------------------

  const FinishShader = {
    uniforms: {
      tDiffuse: { value: null },
      exposure: { value: 1 },
      curve: { value: null },
      curveSize: { value: 256 },
      log2Min: { value: -12.47393 },
      log2Max: { value: 4.026069 },
      // in front of the left screen: where the glass is in the picture (its middle and half its
      // size, 0..1), the picture's shape, and how far what lies around the glass is turned down
      spot: { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.5) },
      aspect: { value: 1 },
      shade: { value: 0 }
    },
    vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D curve;
    uniform float exposure, curveSize, log2Min, log2Max, aspect, shade;
    uniform vec4 spot;
    varying vec2 vUv;
    const mat3 SRGB_TO_REC2020 = mat3( vec3( 0.6274, 0.0691, 0.0164 ), vec3( 0.3293, 0.9195, 0.0880 ), vec3( 0.0433, 0.0113, 0.8956 ) );
    const mat3 REC2020_TO_SRGB = mat3( vec3( 1.6605, - 0.1246, - 0.0182 ), vec3( - 0.5876, 1.1329, - 0.1006 ), vec3( - 0.0728, - 0.0083, 1.1187 ) );
    const mat3 INSET = mat3( vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ), vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ), vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 ) );
    const mat3 OUTSET = mat3( vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ), vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ), vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 ) );
    float toned( float x ) { return texture2D( curve, vec2( ( x * ( curveSize - 1.0 ) + 0.5 ) / curveSize, 0.5 ) ).r; }
    float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
    void main() {
      vec3 c = max( texture2D( tDiffuse, vUv ).rgb, 0.0 ) * exposure;
      // the room steps back behind the screen being read: darker with the distance from the glass
      float beside = length( max( abs( vUv - spot.xy ) - spot.zw, 0.0 ) * vec2( aspect, 1.0 ) );
      c *= 1.0 - shade * smoothstep( 0.012, 0.12, beside );
      c = INSET * ( SRGB_TO_REC2020 * c );
      c = clamp( ( log2( max( c, 1e-10 ) ) - log2Min ) / ( log2Max - log2Min ), 0.0, 1.0 );
      c = OUTSET * vec3( toned( c.r ), toned( c.g ), toned( c.b ) );
      c = REC2020_TO_SRGB * pow( max( c, 0.0 ), vec3( 2.2 ) );
      c = pow( clamp( c, 0.0, 1.0 ), vec3( 1.0 / 2.2 ) );
      c += ( hash( gl_FragCoord.xy ) - 0.5 ) / 255.0;
      gl_FragColor = vec4( c, 1.0 );
    }`
  };

  // ---------------------------------------------------------------------------------------------
  // Loading.
  // ---------------------------------------------------------------------------------------------

  const textures = new THREE.TextureLoader();
  const loadTexture = (url) => new Promise((resolve, reject) => textures.load(url, resolve, undefined, reject));
  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder); // room.glb is Meshopt-compressed (export.py)

  // What falls outside in a season: how many points, and how bright they are beside the dusk
  // (what a pale thing out there would show). Spring and summer have nothing moving.
  const WEATHER = { autumn: { count: 46, rain: 0, light: 0.55 }, winter: { count: 320, rain: 1, light: 0.5 }, rain: { count: 320 } };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SEASON_SECONDS = 1.2; // the cross-fade from one season to the next; a cut under reduced motion

  /**
   * A small tiling normal map of fine noise: the pile of a plush cloth. Heights are random per
   * texel, smoothed once so neighbours lean together, and wrap at the edges.
   */
  function fuzzNormal(size) {
    let seed = 7;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0; // a fixed sequence, so the cloth is the same on every visit
      return seed / 4294967296;
    };
    const raw = Float32Array.from({ length: size * size }, random);
    const at = (x, y) => raw[((y + size) % size) * size + ((x + size) % size)];
    const height = (x, y) => (at(x, y) * 2 + at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1)) / 6;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const n = new THREE.Vector3(height(x - 1, y) - height(x + 1, y), height(x, y - 1) - height(x, y + 1), 0.35).normalize();
        data.set([n.x * 127.5 + 127.5, n.y * 127.5 + 127.5, n.z * 127.5 + 127.5, 255], (y * size + x) * 4);
      }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(48, 48); // some 5 mm of cloth to a tile
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  /** A season's picture of the outside, fetched the first time it is wanted and kept. */
  const backdrops = new Map();
  function loadBackdrop(manifest, season) {
    if (!backdrops.has(season))
      backdrops.set(
        season,
        loadTexture(ASSETS + manifest.backdrop.seasons[season].file).then(
          (texture) => {
            texture.colorSpace = THREE.NoColorSpace;
            texture.anisotropy = 4;
            return texture;
          },
          (error) => {
            backdrops.delete(season); // so that another press asks again
            throw error;
          }
        )
      );
    return backdrops.get(season);
  }

  async function load() {
    const answer = await fetch(ASSETS + 'manifest.json');
    if (!answer.ok) throw new Error(`manifest.json: ${answer.status}`);
    const manifest = await answer.json();
    const lm = manifest.lightmaps;
    const season = parseSeason(query.get('season')) ?? seasonOf(new Date());
    const [gltf, backdropTex, dellPicture, atlas, editor, ...lightTex] = await Promise.all([
      gltfLoader.loadAsync(ASSETS + 'room.glb'),
      loadBackdrop(manifest, season),
      loadTexture(ASSETS + 'screens/dell.webp'),
      loadTexture(ASSETS + 'keepsakes.webp'),
      createEditorScreen({
        commits: terminal.lines,
        // the map's places as words: "Texas", "Florida (Tampa)"
        places: places.places.map((p) => (p.city ? `${usMap.states[p.state].name} (${p.city})` : usMap.states[p.state].name)),
        season: () => hooks.season(),
        effect: (e) => hooks.effect(e)
      }),
      ...Object.values(lm.files).map((f) => loadTexture(ASSETS + f))
    ]);
    const lightMaps = Object.fromEntries(Object.keys(lm.files).map((k, i) => [k, lightTex[i]]));
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    for (const t of Object.values(lightMaps)) {
      t.flipY = false; // as the GLB's own textures
      t.colorSpace = THREE.NoColorSpace;
      t.channel = 0;
      t.anisotropy = 4;
    }

    // The keepsakes' paint: one picture (tools/pond/room/atlas.py paints it) for every material of
    // the model whose name begins with "atlas"; the model has only where each surface lies on it.
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.flipY = false; // as the GLB's own textures
    atlas.anisotropy = maxAniso;
    // The plush's cloth. Black plush catches light as a soft pale rim and nowhere else: matt, hardly
    // any mirror of the room, a sheen that is dark grey and wide, and a fine fuzz in the surface (a
    // small tiling normal map of noise, made here) that breaks up what highlight is left.
    const fuzz = fuzzNormal(128);
    const isCloth = (m) => m.isMeshPhysicalMaterial && (m.name.startsWith('plush') || m.name === 'atlas plush'); // the plush's tag is not cloth: it has no sheen
    const isKeepsake = (m) => /^(atlas|plush|mug|figurine)/.test(m.name);

    const room = gltf.scene;
    scene.add(room);
    const named = {};
    const done = new Set();
    room.traverse((o) => {
      if (!o.isMesh) return;
      const owner = lightMaps[o.name] ? o.name : o.parent && lightMaps[o.parent.name] ? o.parent.name : null;
      named[o.name] = o;
      const m = o.material;
      if (m.sheen) m.sheen = settings.sheen;
      if (m.name.startsWith('atlas')) m.map = atlas;
      if (isCloth(m) && !done.has(m)) {
        Object.assign(m, { roughness: 1, clearcoat: 0, specularIntensity: 0.15, sheen: 1, sheenRoughness: 0.85, normalMap: fuzz });
        m.sheenColor.setRGB(0.24, 0.24, 0.27, THREE.LinearSRGBColorSpace);
        m.normalScale.set(0.6, 0.6);
      }
      if (m.map) m.map.anisotropy = maxAniso;
      if (m.emissiveMap) m.emissiveMap.anisotropy = maxAniso;
      if (owner) {
        o.material = m.clone(); // walls share a paint but not a light map
        o.material.lightMap = lightMaps[owner];
        bakeLit(o.material, lm.lo, lm.stops);
      } else if (!done.has(m)) {
        done.add(m);
        bakeLit(m, manifest.vertexLight.lo, manifest.vertexLight.stops, isKeepsake(m) ? settings.keepsakeFloor : 0);
      }
      o.material.envMapIntensity = isCloth(m) ? settings.envIntensity * 0.2 : settings.envIntensity;
    });

    // the Samsung (the left screen): its own mesh and material, lit by a canvas (map.js draws it)
    const samsung = named.samsung_screen;
    const map = createMapScreen(usMap, places);
    // two sheets, one texture each: the full one for the picture at rest, a quarter of its pixels
    // for the frames of the panel's slide, so those do not each send 2560 x 1440 to the card
    const mapTextures = new Map(
      [map.canvas, map.motion].map((sheet) => {
        const t = new THREE.CanvasTexture(sheet);
        t.colorSpace = THREE.SRGBColorSpace;
        t.flipY = false;
        t.anisotropy = maxAniso;
        return [sheet, t];
      })
    );
    const mapTexture = mapTextures.get(map.canvas);
    samsung.material.emissiveMap = mapTexture;
    samsung.material.emissive.set(0xffffff);
    samsung.material.emissiveIntensity = manifest.glow.map;

    // The other two screens: the Dell shows the site's own desktop, a picture of /os that
    // tools/pond/room/web/shot-screens.cjs takes, sent to the card once (the desktop itself is laid
    // over it when the camera is in front of it); the MacBook an editor and a terminal, a canvas
    // that editor.js draws and that is sent again when it has changed. The model carries no picture
    // for any screen: export.py leaves them out. All three screens glow alike, so a white on one is
    // a white on another.
    const editorTexture = new THREE.CanvasTexture(editor.canvas);
    for (const [mesh, picture] of [
      [named.dell_screen, dellPicture],
      [named.macbook_screen, editorTexture]
    ]) {
      picture.colorSpace = THREE.SRGBColorSpace;
      picture.flipY = false; // as the GLB's own textures
      picture.anisotropy = maxAniso; // with the mipmaps, what keeps small type from shimmering as the camera drifts
      mesh.material.emissiveMap?.dispose();
      mesh.material.emissiveMap = picture;
      mesh.material.emissive.set(0xffffff);
      mesh.material.emissiveIntensity = manifest.glow.map;
    }

    // the glass: what is outside is already dimmed by it (below); here only its faint mirror of the room
    const glass = named.window_glass;
    // (scene.py's glass mirrors 1.6 times what plain glass would; so does this)
    glass.material = new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      roughness: 0.0,
      metalness: 0.0,
      ior: 1.5,
      specularIntensity: 1.6,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    glass.renderOrder = 2;

    // the outside: a picture on a plane square to the seat's line of sight, out among the nearest
    // trees. It holds two seasons at once, the one shown and the one coming, and `fade` between them.
    const seat = bl(manifest.camera.position),
      aim = bl(manifest.camera.aim);
    const b = manifest.backdrop;
    const h = (2 * b.distance * (b.sensor / 2 / b.lens)) / b.aspect,
      w = h * b.aspect;
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.ShaderMaterial({
        uniforms: {
          map: { value: backdropTex },
          next: { value: backdropTex },
          fade: { value: 0 },
          lo: { value: b.lo },
          stops: { value: b.stops },
          tint: {
            value: new THREE.Color().setRGB(0.93 * 0.936, 0.97 * 0.936, 0.96 * 0.936, THREE.LinearSRGBColorSpace)
          }
        },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
        fragmentShader:
          DECODE +
          'uniform sampler2D map, next; uniform float lo, stops, fade; uniform vec3 tint; varying vec2 vUv;' +
          // the two seasons are mixed as light, not as the logarithms the pictures hold
          'void main() { vec3 a = bakedDecode( texture2D( map, vUv ).rgb, lo, stops ); vec3 b = bakedDecode( texture2D( next, vUv ).rgb, lo, stops );' +
          ' gl_FragColor = vec4( mix( a, b, fade ) * tint, 1.0 ); }'
      })
    );
    backdrop.name = 'backdrop';
    backdrop.position.copy(seat).add(aim.clone().sub(seat).normalize().multiplyScalar(b.distance));
    backdrop.lookAt(seat);
    scene.add(backdrop);

    // What moves outside, between the glass and the picture: points over the balcony, each drawn
    // by the shader as a leaflet turning as it drifts down (autumn) or a thin streak of rain
    // (winter). They are placed by the shader from the time alone, so nothing is sent each frame.
    const count = WEATHER.rain.count;
    const seeds = new Float32Array(count * 4).map(() => Math.random());
    const drops = new THREE.BufferGeometry();
    drops.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    drops.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
    const weather = new THREE.Points(
      drops,
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          rain: { value: 0 }, // 0 leaflets, 1 rain
          amount: { value: 0 },
          scale: { value: 1000 }, // pixels a metre takes, a metre from the camera
          // the space they fall through, in three's axes: the balcony's width, from its floor to
          // above the window's head, from just outside the glass to a little past the parapet
          boxMin: { value: new THREE.Vector3(-2.6, -0.1, 0.2) },
          boxSize: { value: new THREE.Vector3(5.2, 3.0, 1.5) },
          light: { value: new THREE.Color() }
        },
        vertexShader: /* glsl */ `
        attribute vec4 seed;
        uniform float time, rain, scale;
        uniform vec3 boxMin, boxSize;
        varying float vSize, vTurn, vFlat, vSeed;
        void main() {
          vec3 p = seed.xyz;
          // how many times a second it falls the height of the box
          float fall = mix( 0.09 + 0.07 * seed.w, 2.0 + 0.6 * seed.w, rain );
          p.y = fract( p.y - time * fall );
          float sway = 1.0 - rain;
          p.x += sway * 0.05 * sin( time * ( 0.7 + seed.w ) + seed.w * 40.0 ) + rain * 0.02 * ( 1.0 - p.y );
          p.z += sway * 0.04 * sin( time * 0.9 + seed.w * 17.0 );
          vec4 mv = viewMatrix * vec4( boxMin + p * boxSize, 1.0 );
          gl_Position = projectionMatrix * mv;
          float metres = mix( 0.05 + 0.03 * seed.w, 0.17, rain );
          vSize = max( metres * scale / - mv.z, 2.0 );
          gl_PointSize = vSize;
          vTurn = time * ( 0.8 + 1.4 * seed.w ) + seed.w * 60.0;
          vFlat = abs( cos( time * ( 1.1 + seed.z ) + seed.x * 30.0 ) );
          vSeed = seed.w;
        }`,
        fragmentShader: /* glsl */ `
        uniform float rain, amount;
        uniform vec3 light;
        varying float vSize, vTurn, vFlat, vSeed;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float a;
          vec3 c;
          if ( rain > 0.5 ) {
            // a streak down the middle of the point, a little aslant, a pixel wide, fading at its ends
            float off = abs( q.x + q.y * 0.07 ) * vSize;
            a = ( 1.0 - smoothstep( 0.25, 1.0, off ) ) * ( 1.0 - smoothstep( 0.25, 0.5, abs( q.y ) ) ) * 0.5;
            c = light * vec3( 0.8, 0.86, 1.0 );
          } else {
            // a leaflet: an oval turned at some angle, narrowed as it tumbles edge-on
            float s = sin( vTurn ), k = cos( vTurn );
            vec2 r = vec2( k * q.x + s * q.y, ( k * q.y - s * q.x ) / ( 0.12 + 0.34 * vFlat ) );
            a = 1.0 - smoothstep( 0.4, 0.5, length( r ) );
            c = light * mix( vec3( 0.50, 0.42, 0.06 ), vec3( 0.42, 0.22, 0.05 ), vSeed ) * ( 0.6 + 0.4 * vFlat );
          }
          if ( a * amount < 0.004 ) discard;
          gl_FragColor = vec4( c, a * amount );
        }`,
        transparent: true,
        depthWrite: false
      })
    );
    weather.name = 'weather';
    weather.frustumCulled = false; // the points are placed in the shader: their box here says nothing
    weather.renderOrder = 1; // after the picture behind them, before the glass in front
    weather.visible = false;
    scene.add(weather);

    // the lamp: a warm point light. It only adds highlights; its pool on the desk is baked.
    const lamp = new THREE.PointLight(new THREE.Color().setRGB(...manifest.lamp.color, THREE.LinearSRGBColorSpace), manifest.lamp.watts / (4 * Math.PI), 0, 2);
    lamp.position.copy(bl(manifest.lamp.position));
    // one shadow map, drawn once: the shade and whatever stands in the way keep the lamp's glints
    // off what it cannot see (the stem above the shade, the far side of the mug)
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.camera.near = 0.004;
    lamp.shadow.camera.far = 4;
    lamp.shadow.bias = -0.002;
    lamp.shadow.autoUpdate = false;
    lamp.shadow.needsUpdate = true;
    room.traverse((o) => {
      if (!o.isMesh) return;
      const plain = !['lamp_bulb', 'window_glass', 'samsung_screen', 'dell_screen', 'macbook_screen'].includes(o.name);
      o.castShadow = plain;
      o.receiveShadow = plain;
    });
    scene.add(lamp);

    grade.value.setRGB(...manifest.backdrop.seasons[season].grade, THREE.LinearSRGBColorSpace);
    return { manifest, room, named, samsung, map, mapTexture, mapTextures, editor, editorTexture, backdrop, glass, lamp, weather, season };
  }

  // ---------------------------------------------------------------------------------------------
  // Camera: the seat, with a few centimetres of drift after the pointer. No orbit.
  // ---------------------------------------------------------------------------------------------

  const view = {
    position: new THREE.Vector3(),
    aim: new THREE.Vector3(),
    lens: 25,
    sensor: 36
  };
  const drift = { x: 0, y: 0, tx: 0, ty: 0, reach: [0.035, 0.02] }; // metres, sideways and up
  const still = query.has('still');
  // The other places the camera can be: square in front of one of the screens (`on` names it; null
  // is the seat). A move from one place to another takes FOCUS_SECONDS, `f` running from 0 to 1
  // along it, from where the camera stood when the move began (`from`) to where it is headed,
  // which is worked out afresh each time so that a resized page is followed. `screens` holds each
  // screen's glass in the world; `screen` is the one the camera is at, or was at last; `rect` is
  // that glass on the page, in CSS pixels. `position` to `spot` are the camera as last placed.
  const SCREENS = ['samsung', 'macbook', 'dell']; // as they stand on the desk, left to right: the way the arrow keys go
  const focus = {
    on: null,
    f: 0,
    started: 0,
    moving: false,
    screen: null,
    screens: {},
    rect: { x: 0, y: 0, width: 0, height: 0 },
    position: new THREE.Vector3(),
    aim: new THREE.Vector3(),
    reach: 1,
    shade: 0,
    spot: new THREE.Vector4(0.5, 0.5, 0.5, 0.5),
    from: { position: new THREE.Vector3(), aim: new THREE.Vector3(), reach: 1, shade: 0, spot: new THREE.Vector4(0.5, 0.5, 0.5, 0.5) }
  };
  const FOCUS_SECONDS = reducedMotion ? 0.01 : 0.9;
  const FOCUS_FILL = 0.88; // of the picture's width or height, whichever the screen meets first
  // How much of the drift is left in front of a screen. None at the Dell: the desktop laid over
  // it is a rectangle of the page, so its glass has to stay one too.
  const FOCUS_DRIFT = { samsung: 0.12, macbook: 0.12, dell: 0 };
  const FOCUS_SHADE = 0.6; // how much of the light around the screen is taken away there
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10); // no speed and no push at either end
  // The page as the room fills it, in CSS pixels: the window, or what a phone's keyboard leaves of it (resize).
  const page = { width: window.innerWidth, height: window.innerHeight };

  function setView(manifest, name) {
    const v = manifest.views[name] || manifest.views.hero;
    view.position.copy(bl(v.position));
    view.aim.copy(bl(v.aim));
    view.lens = v.lens;
  }

  // placeCamera's own vectors, so that a frame makes none
  const placed = {
    position: new THREE.Vector3(),
    aim: new THREE.Vector3(),
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
    corner: new THREE.Vector3(),
    spot: new THREE.Vector4()
  };
  function placeCamera() {
    const aspect = camera.aspect;
    camera.fov = verticalFov(view.lens, view.sensor, aspect);
    camera.updateProjectionMatrix();
    // where the camera is headed: the seat, or back along a screen's normal as far as puts the screen FOCUS_FILL across the picture
    const { position, aim, forward, right, up } = placed;
    const s = focus.on ? focus.screen : null;
    let reach = 1,
      shade = 0;
    if (s) {
      position.copy(s.centre).addScaledVector(s.normal, focusDistance(s.width, s.height, camera.fov, aspect, FOCUS_FILL));
      aim.copy(s.centre);
      reach = s.drift;
      shade = FOCUS_SHADE;
    } else {
      position.copy(view.position);
      aim.copy(view.aim);
    }
    if (focus.moving) {
      const from = focus.from;
      position.lerpVectors(from.position, position, focus.f);
      aim.lerpVectors(from.aim, aim, focus.f);
      reach = THREE.MathUtils.lerp(from.reach, reach, focus.f);
      shade = THREE.MathUtils.lerp(from.shade, shade, focus.f);
    }
    focus.position.copy(position);
    focus.aim.copy(aim);
    focus.reach = reach;
    focus.shade = shade;
    forward.copy(aim).sub(position).normalize();
    right.copy(forward).cross(camera.up).normalize();
    up.copy(right).cross(forward);
    camera.position
      .copy(position)
      .addScaledVector(right, drift.x * drift.reach[0] * reach)
      .addScaledVector(up, drift.y * drift.reach[1] * reach);
    camera.lookAt(aim); // the camera's up stays the room's: no roll on the way
    const u = finish.uniforms;
    u.shade.value = shade;
    if (focus.screen && (shade > 0 || focus.on)) {
      // where the screen's glass is in the picture: the room around it is turned down
      camera.updateMatrixWorld();
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (const p of focus.screen.corners) {
        const v = placed.corner.copy(p).project(camera);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
      placed.spot.set((x0 + x1) / 4 + 0.5, (y0 + y1) / 4 + 0.5, (x1 - x0) / 4, (y1 - y0) / 4);
      // from one screen to another the lit place goes across with the camera
      if (focus.moving && focus.on && focus.from.shade > 0) u.spot.value.lerpVectors(focus.from.spot, placed.spot, focus.f);
      else u.spot.value.copy(placed.spot);
      focus.spot.copy(u.spot.value);
      u.aspect.value = aspect;
      const r = focus.rect;
      r.x = ((x0 + 1) / 2) * page.width;
      r.y = ((1 - y1) / 2) * page.height;
      r.width = ((x1 - x0) / 2) * page.width;
      r.height = ((y1 - y0) / 2) * page.height;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Go.
  // ---------------------------------------------------------------------------------------------

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  // nothing brighter than this reaches the bloom: the inside of the lamp's shade is some hundred times the sky
  const ClampShader = {
    uniforms: { tDiffuse: { value: null }, limit: { value: 10 } },
    vertexShader: FinishShader.vertexShader,
    fragmentShader:
      'uniform sampler2D tDiffuse; uniform float limit; varying vec2 vUv; void main() { gl_FragColor = vec4( clamp( texture2D( tDiffuse, vUv ).rgb, 0.0, limit ), 1.0 ); }'
  };
  composer.addPass(new ShaderPass(ClampShader));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), Number(query.get('bloom') ?? 0.05), Number(query.get('radius') ?? 0.1), 1.2);
  // Blender's bloom takes only what exceeds its threshold; the pass here would take a bright pixel
  // whole, and the sky would fog the tree. A wide knee comes to much the same as the excess.
  bloom.highPassUniforms.smoothWidth.value = 1.5;
  if (bloom.strength > 0) composer.addPass(bloom);
  const finish = new ShaderPass(FinishShader);
  finish.uniforms.exposure.value = 2 ** Number(query.get('exposure') ?? 0);
  composer.addPass(finish);

  let dirty = true;
  const keys = document.getElementById('keys'); // the field that takes what is typed at the MacBook's terminal
  function resize() {
    // A phone's keyboard, up for the terminal, covers the lower part of the page without making
    // the window any smaller: the room is then drawn in what is left above it, so the line being
    // typed can be seen. (Not while the page is pinched larger, when the same numbers mean that.)
    const seen = window.visualViewport;
    const above = document.activeElement === keys && seen && Math.abs(seen.scale - 1) < 0.01 && seen.height < window.innerHeight - 80;
    const w = window.innerWidth,
      h = above ? Math.round(seen.height) : window.innerHeight;
    canvas.style.height = above ? `${h}px` : '';
    page.width = w;
    page.height = h;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    dirty = true;
  }
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  keys.addEventListener('focus', resize);
  keys.addEventListener('blur', resize);
  // The pointer: it pulls the camera a little (the drift) and it points at what is on the screens.
  // What it points at is worked out in the frame loop, against the camera as last drawn, so the
  // drift cannot put the hit somewhere other than where the picture shows it.
  const pointer = { x: 0, y: 0, known: false, moved: true, down: null };
  window.addEventListener('pointermove', (e) => {
    Object.assign(pointer, {
      x: e.clientX,
      y: e.clientY,
      known: true,
      moved: true
    });
    if (still) return;
    drift.tx = (e.clientX / page.width) * 2 - 1;
    drift.ty = -((e.clientY / page.height) * 2 - 1);
  });

  load()
    .then((world) => {
      const look = world.manifest.look;
      const curve = new THREE.DataTexture(
        Uint16Array.from(look.curve, (v) => THREE.DataUtils.toHalfFloat(v)),
        look.curve.length,
        1,
        THREE.RedFormat,
        THREE.HalfFloatType
      );
      curve.minFilter = curve.magFilter = THREE.LinearFilter;
      curve.needsUpdate = true;
      Object.assign(finish.uniforms.curve, { value: curve });
      finish.uniforms.curveSize.value = look.curve.length;
      finish.uniforms.log2Min.value = look.log2Min;
      finish.uniforms.log2Max.value = look.log2Max;
      if (!query.has('exposure')) finish.uniforms.exposure.value = 2 ** look.exposure;
      setView(world.manifest, query.get('view') || 'hero');
      resize();
      placeCamera();

      // Reflections: the scene's own surroundings, captured once. One capture stands for the whole
      // room; the laptop gets its own from just above its trackpad, since what its deck mirrors (its
      // own screen) is a hand's width away and looks nothing like the room from anywhere else.
      // Both are captured again when the season has changed, since the dusk they mirror has.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const laptopMaterials = [];
      world.named.macbook_screen.parent.traverse((o) => {
        if (o.name !== 'macbook' && o.parent.name !== 'macbook') return;
        if (o.isMesh) {
          o.material = o.material.clone();
          bakeLit(o.material, world.manifest.vertexLight.lo, world.manifest.vertexLight.stops);
          laptopMaterials.push(o.material);
        }
      });
      let captured = [];
      function captureSurroundings() {
        const shown = world.weather.visible;
        world.glass.visible = world.weather.visible = false;
        scene.environment = null;
        const env = pmrem.fromScene(scene, 0, 0.01, 60, { position: bl(PROBE.room) });
        const envLaptop = pmrem.fromScene(scene, 0, 0.03, 60, { position: bl(PROBE.laptop) });
        world.glass.visible = true;
        world.weather.visible = shown;
        scene.environment = env.texture;
        for (const m of laptopMaterials) m.envMap = envLaptop.texture;
        for (const old of captured) old.dispose();
        captured = [env, envLaptop];
      }

      // The seasons. `turn` is a change under way: the picture and the room's tint go from what
      // they were to the new season's over SEASON_SECONDS, and what falls outside changes over at
      // the middle of it.
      const seasons = world.manifest.backdrop.seasons;
      const backdropUniforms = world.backdrop.material.uniforms;
      const weatherUniforms = world.weather.material.uniforms;
      let season = world.season;
      let turn = null;
      let asked = 0;
      const gradeOf = (name) => new THREE.Color().setRGB(...seasons[name].grade, THREE.LinearSRGBColorSpace);
      /** Set what falls outside to a season's (or to nothing), `amount` of the way in. */
      function setWeather(name, amount) {
        const kind = reducedMotion ? null : WEATHER[name];
        world.weather.visible = Boolean(kind) && amount > 0;
        if (!kind) return;
        world.weather.geometry.setDrawRange(0, kind.count);
        weatherUniforms.rain.value = kind.rain;
        weatherUniforms.amount.value = amount;
        // lit by the season's own dusk: its backdrop's mean light
        const light = seasons[name].light ?? [0.3, 0.3, 0.3];
        weatherUniforms.light.value.setRGB(light[0] * kind.light, light[1] * kind.light, light[2] * kind.light, THREE.LinearSRGBColorSpace);
      }
      /** The season is `name` and nothing is changing. */
      function settle(name, texture) {
        season = name;
        turn = null;
        backdropUniforms.map.value = backdropUniforms.next.value = texture;
        backdropUniforms.fade.value = 0;
        grade.value.copy(gradeOf(name));
        setWeather(name, 1);
        document.body.dataset.season = name;
        captureSurroundings();
        dirty = true;
      }
      /**
       * Change the season shown. The new backdrop is fetched if it has not been; the answer says
       * whether the change began (false for a name that is no season, or when a later call overtook this one).
       */
      async function setSeason(name) {
        if (!seasons[name]) return false;
        const mine = ++asked;
        const texture = await loadBackdrop(world.manifest, name);
        if (mine !== asked) return false;
        if (turn) settle(turn.to, turn.texture); // one already under way: finish it at once
        if (name === season) return true;
        if (reducedMotion) {
          settle(name, texture);
          return true;
        }
        backdropUniforms.next.value = texture;
        turn = { from: season, to: name, texture, started: performance.now(), gradeFrom: grade.value.clone(), gradeTo: gradeOf(name) };
        document.body.dataset.season = name;
        return true;
      }
      settle(season, backdropUniforms.map.value);

      // The screens. A ray from the pointer meets a screen's glass; where it meets it, the glass's
      // own texture coordinate says which pixel of that screen's canvas is under it.
      const { map, samsung, mapTextures, editor, editorTexture } = world;
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const aimRay = (x, y) => {
        ndc.set((x / page.width) * 2 - 1, -((y / page.height) * 2 - 1));
        camera.updateMatrixWorld();
        raycaster.setFromCamera(ndc, camera);
      };

      /** A screen's glass in the world: a flat rectangle, its corners found by their texture coordinates. */
      function glassOf(name, mesh, sheet) {
        const corner = (u, v) => {
          const p = mesh.geometry.attributes.position,
            t = mesh.geometry.attributes.uv;
          let best = 0;
          for (let i = 1; i < p.count; i++) if (Math.hypot(t.getX(i) - u, t.getY(i) - v) < Math.hypot(t.getX(best) - u, t.getY(best) - v)) best = i;
          return new THREE.Vector3().fromBufferAttribute(p, best);
        };
        const local = [corner(0, 0), corner(1, 0), corner(0, 1), corner(1, 1)]; // in the mesh's own space
        const [a, b, c, d] = local.map((p) => mesh.localToWorld(p.clone()));
        const across = b.clone().sub(a),
          down = c.clone().sub(a);
        const centre = a.clone().add(b).add(c).add(d).multiplyScalar(0.25);
        const normal = across.clone().cross(down).normalize();
        if (normal.dot(view.position.clone().sub(centre)) < 0) normal.negate(); // the side the seat is on
        // `sheet`: the size of what the glass shows, in its own pixels
        return { name, mesh, sheet, local, centre, normal, width: across.length(), height: down.length(), corners: [a, b, c, d], drift: FOCUS_DRIFT[name] };
      }
      scene.updateMatrixWorld(true);
      focus.screens.samsung = glassOf('samsung', samsung, map);
      focus.screens.macbook = glassOf('macbook', world.named.macbook_screen, editor);
      focus.screens.dell = glassOf('dell', world.named.dell_screen, { width: 2560, height: 1440 });
      focus.screen = focus.screens.samsung;
      const glasses = SCREENS.map((name) => focus.screens[name].mesh);
      const nameOf = new Map(SCREENS.map((name) => [focus.screens[name].mesh, name]));

      const met = [];
      const under = { name: '', x: 0, y: 0 };
      /**
       * Which screen a point of the page (client pixels) is on, the nearest where one stands before
       * another, and where on it in that screen's own pixels; null beside them all. The answer is
       * one object used again at each call.
       */
      function screenAt(x, y) {
        aimRay(x, y);
        met.length = 0;
        const at = raycaster.intersectObjects(glasses, false, met)[0];
        if (!at || !at.uv) return null;
        under.name = nameOf.get(at.object);
        const sheet = focus.screens[under.name].sheet;
        // the textures are not flipped (flipY = false), so v runs down the canvas as y does
        under.x = at.uv.x * sheet.width;
        under.y = at.uv.y * sheet.height;
        return under;
      }
      /** Where on the left screen's glass a point of the page (client pixels) is, as canvas pixels, or null beside it. */
      function onScreen(x, y) {
        const at = screenAt(x, y);
        return at && at.name === 'samsung' ? [at.x, at.y] : null;
      }
      /**
       * Whether a point of the page (client pixels) is on the view outside: the pointer's ray reaches
       * the window's glass with nothing of the room in its way (a frame, a curtain, a monitor, the lamp).
       */
      function onOutside(x, y) {
        aimRay(x, y);
        if (!raycaster.intersectObject(world.glass, false).length) return false;
        return raycaster.intersectObject(world.room, true)[0]?.object === world.glass;
      }
      /** What of the map is under a point of the page (client pixels), with the camera as it stands. */
      function pick(x, y) {
        const at = onScreen(x, y);
        return at ? map.hit(at[0], at[1]) : null;
      }

      // The MacBook's type is sized for the page: where its screen would be small in front of the
      // camera (a narrow window, a phone held upright) the type is made larger on the canvas, to
      // come out near TYPE_SEEN CSS pixels.
      const TYPE_SEEN = 11.5;
      function fitEditor() {
        const s = focus.screens.macbook;
        const across = FOCUS_FILL * Math.min(page.width, (page.height * s.width) / s.height); // the screen's width on the page, from close
        editor.setZoom((TYPE_SEEN * editor.width) / (24 * across));
      }
      fitEditor();
      window.addEventListener('resize', fitEditor);
      editor.bind(keys);

      // The Dell, from close, is the site's desktop itself: /os in a frame laid over the glass,
      // made when the camera first arrives and taken off the page again (so that its scripts
      // stop) when the camera leaves. The picture on the glass stays under it, and is what shows
      // until the desktop has loaded. The desktop is given the glass's own size on the page as
      // its window, and never less than DESK_MIN across: narrower than that it is laid out at
      // DESK_MIN and scaled down to fit.
      const DESK_MIN = 1280;
      const DESK_FADE = reducedMotion ? 0 : 0.3; // seconds
      const desk = { frame: null, live: false };
      const back = document.getElementById('back');
      const full = document.getElementById('full');
      function placeDesk() {
        const r = focus.rect;
        const w = Math.round(r.width),
          h = Math.round(r.height);
        const scale = Math.min(1, w / DESK_MIN);
        const style = desk.frame.style;
        style.width = `${w / scale}px`;
        style.height = `${h / scale}px`;
        style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px) scale(${scale})`;
      }
      function openDesk() {
        const frame = document.createElement('iframe');
        frame.id = 'desk';
        frame.title = 'The site’s desktop';
        frame.src = '/os';
        // set here, not in the page's style sheet: Astro scopes that to the elements the page is built with
        frame.style.cssText = `position: fixed; left: 0; top: 0; border: 0; transform-origin: 0 0; background: #000; opacity: 0; transition: opacity ${DESK_FADE}s ease;`;
        frame.addEventListener('load', () => {
          if (desk.frame !== frame) return; // the camera left before the desktop came
          try {
            // Keys typed in the desktop never reach this page, and Escape has to: it is the way out.
            frame.contentWindow.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') unfocus();
            });
          } catch {
            // the frame has gone to another site (a link followed in it): its keys cannot be heard; the back control still leaves
          }
          frame.style.opacity = '1';
          desk.live = true;
        });
        desk.frame = frame;
        placeDesk();
        document.body.insertBefore(frame, back.parentElement); // under the controls, over the canvas
      }
      /** Takes the desktop off the glass; answers how many seconds its fade takes. */
      function closeDesk() {
        const frame = desk.frame;
        if (!frame) return 0;
        const shown = desk.live;
        desk.frame = null;
        desk.live = false;
        dirty = true;
        if (!shown || !DESK_FADE) {
          frame.remove();
          return 0;
        }
        frame.style.opacity = '0';
        frame.style.pointerEvents = 'none';
        setTimeout(() => frame.remove(), DESK_FADE * 1000);
        return DESK_FADE;
      }

      /** Send the camera to a screen by its name, or to the seat (null). False when it is there already or headed there. */
      function setFocus(name) {
        if (focus.on === name || (name && !focus.screens[name])) return false;
        const { from } = focus;
        from.position.copy(focus.position);
        from.aim.copy(focus.aim);
        from.reach = focus.reach;
        from.shade = focus.shade;
        from.spot.copy(focus.spot);
        focus.on = name;
        if (name) focus.screen = focus.screens[name];
        // the camera waits for the desktop to fade from the Dell's glass: it would not follow the glass across the page
        const wait = closeDesk();
        Object.assign(focus, { f: 0, started: performance.now() + wait * 1000, moving: true });
        if (name) document.body.dataset.focused = name;
        else delete document.body.dataset.focused;
        back.tabIndex = name ? 0 : -1;
        full.tabIndex = name === 'dell' ? 0 : -1;
        if (!name) back.blur();
        if (name !== 'dell') full.blur();
        // the terminal has the keyboard while the camera is at the MacBook
        if (name === 'macbook') keys.focus({ preventScroll: true });
        else keys.blur();
        pointer.moved = true;
        return true;
      }
      const focusScreen = (name = 'samsung') => setFocus(name);
      const unfocus = () => setFocus(null);
      // the controls are on the page, above the canvas: what is pressed there is not a press on the room
      for (const control of [back, full]) for (const type of ['pointerdown', 'pointerup']) control.addEventListener(type, (e) => e.stopPropagation());
      back.addEventListener('click', unfocus);

      // what the MacBook's terminal asks for (terminal.ts)
      hooks.season = () => (turn ? turn.to : season);
      hooks.effect = (e) => {
        if (e.kind === 'season')
          setSeason(e.season).catch((error) => {
            console.error(error);
            editor.print({ text: 'season: its picture did not come', tone: 'error' });
          });
        else if (e.kind === 'focus') setFocus(e.screen);
        else if (e.kind === 'exit') unfocus();
      };

      // From the seat a screen is one thing to press (a hand anywhere on it); what is on it
      // answers only once the camera has arrived in front of it. From the seat the view outside
      // is another thing to press: it turns the season.
      function hover() {
        const at = pointer.known ? screenAt(pointer.x, pointer.y) : null;
        const near = focus.on && !focus.moving && at && at.name === focus.on;
        const onMap = map.point(near && at.name === 'samsung' ? map.hit(at.x, at.y) : null);
        const onEditor = editor.point(near && at.name === 'macbook' ? editor.hit(at.x, at.y) : null);
        let cursor = '';
        if (!focus.on) {
          if (at || (pointer.known && onOutside(pointer.x, pointer.y))) cursor = 'pointer';
        } else if (pointer.known) {
          if (!at) cursor = 'zoom-out';
          else if (at.name !== focus.on || onMap || onEditor) cursor = 'pointer';
        }
        canvas.style.cursor = cursor;
      }
      // a press counts where the pointer goes down and comes up in one place (a tap, a click), not a drag
      window.addEventListener('pointerdown', (e) => {
        if (e.button === 0) pointer.down = { x: e.clientX, y: e.clientY, id: e.pointerId, y1: e.clientY, grip: undefined };
      });
      // a mouse button going down on the canvas would take the keyboard from the terminal
      canvas.addEventListener('mousedown', (e) => {
        if (focus.on === 'macbook') e.preventDefault();
      });
      window.addEventListener('pointerup', (e) => {
        const down = pointer.down;
        pointer.down = null;
        if (!down || down.id !== e.pointerId || Math.hypot(e.clientX - down.x, e.clientY - down.y) > (e.pointerType === 'mouse' ? 6 : 14)) return;
        const at = screenAt(e.clientX, e.clientY);
        if (!focus.on) {
          if (at)
            focusScreen(at.name); // and nothing else: this press does not reach what is on the screen
          else if (onOutside(e.clientX, e.clientY))
            setSeason(nextSeason(turn ? turn.to : season)).catch((error) => {
              console.error(error); // the next backdrop did not come: the season stays as it is
            });
        } else if (!at) unfocus();
        else if (at.name !== focus.on) focusScreen(at.name);
        else if (!focus.moving) {
          if (at.name === 'samsung') map.press(map.hit(at.x, at.y));
          else if (at.name === 'macbook') {
            editor.press(editor.hit(at.x, at.y));
            keys.focus({ preventScroll: true }); // a tap on the screen brings a phone's keyboard up
          }
        }
        // a finger leaves nothing hovering behind it
        if (e.pointerType !== 'mouse') pointer.known = false;
        pointer.moved = true;
      });
      window.addEventListener('pointercancel', () => {
        pointer.down = null;
      });

      // The MacBook's panes scroll: under a wheel (a mouse's, or two fingers on a trackpad) and
      // under a finger dragged on the glass. Page pixels are turned into the canvas's rows.
      const rowsFor = (pixels) => (pixels * editor.height) / (focus.rect.height * editor.rowHeight);
      window.addEventListener(
        'wheel',
        (e) => {
          if (focus.on !== 'macbook' || focus.moving) return;
          const at = screenAt(e.clientX, e.clientY);
          if (at && at.name === 'macbook') editor.scroll(editor.hit(at.x, at.y), e.deltaMode === 1 ? e.deltaY : rowsFor(e.deltaY));
        },
        { passive: true }
      );
      window.addEventListener('pointermove', (e) => {
        const down = pointer.down;
        if (!down || down.id !== e.pointerId || e.pointerType === 'mouse' || focus.on !== 'macbook' || focus.moving) return;
        if (down.grip === undefined) {
          // what the finger went down on
          const at = screenAt(down.x, down.y);
          down.grip = at && at.name === 'macbook' ? editor.hit(at.x, at.y) : null;
        }
        editor.scroll(down.grip, rowsFor(down.y1 - e.clientY));
        down.y1 = e.clientY;
      });

      // Escape undoes the last thing: an open panel first, then the push-in. The arrows go to the
      // screen on that side, but for the MacBook's while a line is being typed there.
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if ((focus.on !== 'macbook' && focus.on !== 'dell' && map.close()) || unfocus()) pointer.moved = true;
          return;
        }
        // a key typed at the MacBook when nothing has the keyboard (the window was left and come back to): the field takes it, and the key with it
        if (focus.on === 'macbook' && document.activeElement === document.body && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
          keys.focus({ preventScroll: true });
        if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || !focus.on || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (e.target === keys && keys.value) return;
        const next = SCREENS[SCREENS.indexOf(focus.on) + (e.key === 'ArrowLeft' ? -1 : 1)];
        if (next && setFocus(next)) e.preventDefault();
      });

      let last = performance.now();
      let drawn = 0; // when the picture was last drawn for the sake of what falls outside
      function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        // With the desktop over the Dell's glass the room is drawn only when something in it has
        // changed (the page resized, a season turning): nothing drifts and nothing falls, and the
        // frames are the desktop's.
        const covered = desk.live;
        let moved = dirty;
        if (focus.moving) {
          const t = THREE.MathUtils.clamp((now - focus.started) / (FOCUS_SECONDS * 1000), 0, 1);
          focus.f = smooth(t);
          if (t >= 1) focus.moving = false;
          pointer.moved = true; // what the pointer is over changes with the camera, and once more on arriving
          moved = true;
        }
        if (!covered) {
          const k = 1 - Math.exp(-dt * 3.5);
          const dx = drift.tx - drift.x,
            dy = drift.ty - drift.y;
          if (Math.abs(dx) + Math.abs(dy) > 1e-4) {
            drift.x += dx * k;
            drift.y += dy * k;
            moved = true;
          } else if (dx || dy) {
            // the last of the way in one step, so the camera rests in the same place however it got there
            drift.x = drift.tx;
            drift.y = drift.ty;
            moved = true;
          }
        }
        if (turn) {
          const t = Math.min((now - turn.started) / (SEASON_SECONDS * 1000), 1);
          const f = smooth(t);
          backdropUniforms.fade.value = f;
          grade.value.lerpColors(turn.gradeFrom, turn.gradeTo, f);
          // what fell in the old season thins out over the first half, the new season's comes in over the second
          if (f < 0.5) setWeather(turn.from, 1 - 2 * f);
          else setWeather(turn.to, 2 * f - 1);
          if (t >= 1) settle(turn.to, turn.texture);
          moved = true;
        }
        // What falls outside moves on its own: the picture is drawn again for it some thirty times
        // a second, and not at all while the tab is hidden (no frames come then, and no time passes).
        if (world.weather.visible && !document.hidden && !covered) {
          weatherUniforms.time.value += dt;
          if (now - drawn > 30) moved = true;
        }
        if (moved) {
          placeCamera();
          if (desk.frame) placeDesk();
        }
        // the camera is in front of the Dell: its desktop comes
        if (focus.on === 'dell' && !focus.moving && !desk.frame) openDesk();
        // the camera has moved under the pointer, or the pointer over the picture
        if (moved || pointer.moved || !map.settled) {
          pointer.moved = false;
          hover();
        }
        const sheet = map.update(now);
        if (sheet) {
          const texture = mapTextures.get(sheet);
          samsung.material.emissiveMap = texture;
          texture.needsUpdate = true;
          moved = true;
        }
        if (editor.update(now)) {
          editorTexture.needsUpdate = true;
          moved = true;
        }
        if (moved) {
          dirty = false;
          drawn = now;
          weatherUniforms.scale.value = renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
          composer.render();
          document.body.dataset.ready = '1';
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);

      /** Where a point of a screen's glass (0..1 across and down it) is on the page right now (client pixels), for tests that press it. */
      function screenPoint(name, u, v) {
        const s = focus.screens[name];
        if (!s) return null;
        const top = s.local[0].clone().lerp(s.local[1], u),
          bottom = s.local[2].clone().lerp(s.local[3], u);
        const p = s.mesh.localToWorld(top.lerp(bottom, v)).project(camera);
        return [((p.x + 1) / 2) * page.width, ((1 - p.y) / 2) * page.height];
      }
      /** Where a state's middle is on the page right now (client pixels), for tests that press it. */
      function statePoint(id) {
        const uv = map.where(id);
        return uv ? screenPoint('samsung', uv[0], uv[1]) : null;
      }

      // for the console and the tests
      window.room = {
        ...world,
        THREE,
        scene,
        camera,
        renderer,
        composer,
        bloom,
        finish,
        settings,
        view,
        drift,
        pointer,
        setView: (name) => {
          setView(world.manifest, name);
          dirty = true;
        },
        redraw: () => {
          dirty = true;
        },
        openState: (id) => map.open(id),
        closeState: () => map.close(),
        pick,
        onScreen,
        screenAt: (x, y) => {
          const at = screenAt(x, y);
          return at ? { ...at } : null;
        },
        screenPoint,
        statePoint,
        focus,
        focusScreen,
        unfocus,
        desk,
        onOutside,
        setSeason,
        /** The season at the window, or the one it is turning to. */
        get season() {
          return turn ? turn.to : season;
        },
        /** The screen the camera is at or on its way to ('samsung', 'macbook', 'dell'), or null at the seat. */
        get focused() {
          return focus.on;
        }
      };
    })
    .catch((e) => {
      console.error(e);
      document.getElementById('note').textContent = 'The room did not load: ' + e.message;
      document.body.dataset.failed = '1';
    });
}
