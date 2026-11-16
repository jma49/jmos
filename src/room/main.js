// The room in the browser, for the page at /room (src/pages/room.astro; boot.ts starts it once it
// knows there is WebGL). export.py (tools/pond/room) wrote everything this fetches, into
// public/room/: room.glb (the indoor part), lm/*.webp (baked light for the big surfaces),
// backdrop.webp (the garden behind the glass) and manifest.json (the seat camera, the lamp, how
// light is encoded). The map's shapes and places are bundled with the code (us-map.json, which
// tools/pond/room/web/build-map.mjs writes, and places.json).
//
// All diffuse light is baked: light maps on the big surfaces, vertex colours on everything
// else. What is live: reflections (an environment captured from the scene itself, and the
// lamp as a point light, both specular only), the screens' glow, bloom and the tone curve.
//
// A press on the left screen brings the camera up to it (focusScreen); a press beside it, Escape
// or the "back" control takes it to the seat again (unfocus). The map is only pressed from close.
//
// Query: ?view=laptop|arm|tree|keys (default hero, the seat), ?still (no drift),
// ?bloom=0, ?exposure=0.3 (stops).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createMapScreen } from './map.js';
import { focusDistance, verticalFov } from './optics';
import places from './places.json';
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
  const settings = { occlusion: 0.02, envIntensity: 1.0, sheen: 0.25 };
  const PROBE = { room: [0.2, 0.62, 0.765], laptop: [0, 0.69, 0.79] }; // where the reflections are captured from (Blender axes)

  function bakeLit(material, lo, stops) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.bakeLo = { value: lo };
      shader.uniforms.bakeStops = { value: stops };
      shader.uniforms.bakeOcclusion = { value: settings.occlusion };
      // With multisampling a pixel's centre can lie outside a thin triangle that only touches it, and
      // the vertex colour is then extrapolated; decoded as a logarithm that makes white specks along
      // every bevel. Sampling at the centroid keeps it inside the triangle.
      shader.vertexShader = shader.vertexShader.replace('#include <color_pars_vertex>', CENTROID_COLOR.replace(/INOUT/g, 'varying'));
      shader.fragmentShader =
        'uniform float bakeLo;\nuniform float bakeStops;\nuniform float bakeOcclusion;\n' +
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
          vec3 bakedLight = bakedDecode( clamp( vColor.rgb, 0.0, 1.0 ), bakeLo, bakeStops );
        #else
          vec3 bakedLight = vec3( 0.0 );
          #define BAKED_NONE
        #endif
        reflectedLight.directDiffuse = vec3( 0.0 );
        reflectedLight.indirectDiffuse = bakedLight * material.diffuseContribution;
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
    material.customProgramCacheKey = () => `baked ${lo} ${stops}`;
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

  async function load() {
    const answer = await fetch(ASSETS + 'manifest.json');
    if (!answer.ok) throw new Error(`manifest.json: ${answer.status}`);
    const manifest = await answer.json();
    const lm = manifest.lightmaps;
    const [gltf, backdropTex, ...lightTex] = await Promise.all([
      gltfLoader.loadAsync(ASSETS + 'room.glb'),
      loadTexture(ASSETS + manifest.backdrop.file),
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
      if (m.map) m.map.anisotropy = maxAniso;
      if (m.emissiveMap) m.emissiveMap.anisotropy = maxAniso;
      if (owner) {
        o.material = m.clone(); // walls share a paint but not a light map
        o.material.lightMap = lightMaps[owner];
        bakeLit(o.material, lm.lo, lm.stops);
      } else if (!done.has(m)) {
        done.add(m);
        bakeLit(m, manifest.vertexLight.lo, manifest.vertexLight.stops);
      }
      o.material.envMapIntensity = settings.envIntensity;
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

    // the glass: the garden is already dimmed by it (below); here only its faint mirror of the room
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

    // the garden: a picture on a plane square to the seat's line of sight, out where the tree stands
    const seat = bl(manifest.camera.position),
      aim = bl(manifest.camera.aim);
    const b = manifest.backdrop;
    const h = (2 * b.distance * (b.sensor / 2 / b.lens)) / b.aspect,
      w = h * b.aspect;
    backdropTex.colorSpace = THREE.NoColorSpace;
    backdropTex.anisotropy = 4;
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.ShaderMaterial({
        uniforms: {
          map: { value: backdropTex },
          lo: { value: b.lo },
          stops: { value: b.stops },
          tint: {
            value: new THREE.Color().setRGB(0.93 * 0.936, 0.97 * 0.936, 0.96 * 0.936, THREE.LinearSRGBColorSpace)
          }
        },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
        fragmentShader:
          DECODE +
          'uniform sampler2D map; uniform float lo, stops; uniform vec3 tint; varying vec2 vUv;' +
          'void main() { gl_FragColor = vec4( bakedDecode( texture2D( map, vUv ).rgb, lo, stops ) * tint, 1.0 ); }'
      })
    );
    backdrop.name = 'backdrop';
    backdrop.position.copy(seat).add(aim.clone().sub(seat).normalize().multiplyScalar(b.distance));
    backdrop.lookAt(seat);
    scene.add(backdrop);

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

    return { manifest, named, samsung, map, mapTexture, mapTextures, backdrop, glass, lamp };
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
  // The other place the camera can be: square in front of the left screen. `f` runs from 0 (the
  // seat) to 1 (the screen); `on` is where it is headed. `screen` is the glass in the world.
  const focus = { on: false, f: 0, from: 0, started: 0, moving: false, screen: null };
  const FOCUS_SECONDS = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.01 : 0.9;
  const FOCUS_FILL = 0.88; // of the picture's width or height, whichever the screen meets first
  const FOCUS_DRIFT = 0.12; // how much of the drift is left in front of the screen
  const FOCUS_SHADE = 0.6; // how much of the light around the screen is taken away there
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10); // no speed and no push at either end

  function setView(manifest, name) {
    const v = manifest.views[name] || manifest.views.hero;
    view.position.copy(bl(v.position));
    view.aim.copy(bl(v.aim));
    view.lens = v.lens;
  }

  function placeCamera() {
    const aspect = camera.aspect;
    camera.fov = verticalFov(view.lens, view.sensor, aspect);
    camera.updateProjectionMatrix();
    const position = view.position.clone(),
      aim = view.aim.clone();
    let reach = 1;
    if (focus.f > 0 && focus.screen) {
      // back along the glass's normal, as far as puts the screen FOCUS_FILL across the picture
      const s = focus.screen;
      const distance = focusDistance(s.width, s.height, camera.fov, aspect, FOCUS_FILL);
      position.lerp(s.centre.clone().addScaledVector(s.normal, distance), focus.f);
      aim.lerp(s.centre, focus.f);
      reach = THREE.MathUtils.lerp(1, FOCUS_DRIFT, focus.f);
    }
    const forward = aim.clone().sub(position).normalize();
    const right = forward.clone().cross(camera.up).normalize();
    const up = right.clone().cross(forward);
    camera.position
      .copy(position)
      .addScaledVector(right, drift.x * drift.reach[0] * reach)
      .addScaledVector(up, drift.y * drift.reach[1] * reach);
    camera.lookAt(aim); // the camera's up stays the room's: no roll on the way
    const u = finish.uniforms;
    u.shade.value = 0;
    if (focus.f > 0 && focus.screen) {
      camera.updateMatrixWorld();
      const box = new THREE.Box2();
      for (const p of focus.screen.corners) {
        const v = p.clone().project(camera);
        box.expandByPoint(new THREE.Vector2(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5));
      }
      u.spot.value.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.max.x - box.min.x) / 2, (box.max.y - box.min.y) / 2);
      u.aspect.value = aspect;
      u.shade.value = FOCUS_SHADE * focus.f;
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
  function resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    dirty = true;
  }
  window.addEventListener('resize', resize);
  // The pointer: it pulls the camera a little (the drift) and it points at the left screen's map.
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
    drift.tx = (e.clientX / window.innerWidth) * 2 - 1;
    drift.ty = -((e.clientY / window.innerHeight) * 2 - 1);
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
      const pmrem = new THREE.PMREMGenerator(renderer);
      world.glass.visible = false;
      const env = pmrem.fromScene(scene, 0, 0.01, 60, {
        position: bl(PROBE.room)
      });
      const envLaptop = pmrem.fromScene(scene, 0, 0.03, 60, {
        position: bl(PROBE.laptop)
      });
      world.glass.visible = true;
      scene.environment = env.texture;
      world.named.macbook_screen.parent.traverse((o) => {
        if (o.name !== 'macbook' && o.parent.name !== 'macbook') return;
        if (o.isMesh) {
          o.material = o.material.clone();
          bakeLit(o.material, world.manifest.vertexLight.lo, world.manifest.vertexLight.stops);
          o.material.envMap = envLaptop.texture;
        }
      });
      pmrem.dispose();

      // The map on the left screen. A ray from the pointer meets the screen's glass; where it meets
      // it, the glass's own texture coordinate says which pixel of the map's canvas is under it.
      const { map, samsung, mapTextures } = world;
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      /** Where on the left screen's glass a point of the page (client pixels) is, as canvas pixels, or null beside it. */
      function onScreen(x, y) {
        ndc.set((x / window.innerWidth) * 2 - 1, -((y / window.innerHeight) * 2 - 1));
        camera.updateMatrixWorld();
        raycaster.setFromCamera(ndc, camera);
        const at = raycaster.intersectObject(samsung, false)[0];
        // the texture is not flipped (flipY = false), so v runs down the canvas as y does
        return at && at.uv ? [at.uv.x * map.width, at.uv.y * map.height] : null;
      }
      /** What of the map is under a point of the page (client pixels), with the camera as it stands. */
      function pick(x, y) {
        const at = onScreen(x, y);
        return at ? map.hit(at[0], at[1]) : null;
      }

      // The glass in the world: a flat rectangle, its corners found by their texture coordinates.
      const corner = (u, v) => {
        const p = samsung.geometry.attributes.position,
          t = samsung.geometry.attributes.uv;
        let best = 0;
        for (let i = 1; i < p.count; i++) if (Math.hypot(t.getX(i) - u, t.getY(i) - v) < Math.hypot(t.getX(best) - u, t.getY(best) - v)) best = i;
        return new THREE.Vector3().fromBufferAttribute(p, best);
      };
      const corners = [corner(0, 0), corner(1, 0), corner(0, 1), corner(1, 1)]; // in the mesh's own space
      {
        scene.updateMatrixWorld(true);
        const [a, b, c, d] = corners.map((p) => samsung.localToWorld(p.clone()));
        const across = b.clone().sub(a),
          down = c.clone().sub(a);
        const centre = a.clone().add(b).add(c).add(d).multiplyScalar(0.25);
        const normal = across.clone().cross(down).normalize();
        if (normal.dot(view.position.clone().sub(centre)) < 0) normal.negate(); // the side the seat is on
        focus.screen = { centre, normal, width: across.length(), height: down.length(), corners: [a, b, c, d] };
      }

      const back = document.getElementById('back');
      function setFocus(on) {
        if (focus.on === on) return false;
        Object.assign(focus, { on, from: focus.f, started: performance.now(), moving: true });
        document.body.toggleAttribute('data-focused', on);
        back.tabIndex = on ? 0 : -1;
        if (!on) back.blur();
        pointer.moved = true;
        return true;
      }
      const focusScreen = () => setFocus(true);
      const unfocus = () => setFocus(false);
      // the control is on the page, above the canvas: what is pressed there is not a press on the room
      for (const type of ['pointerdown', 'pointerup']) back.addEventListener(type, (e) => e.stopPropagation());
      back.addEventListener('click', unfocus);

      // From the seat the screen is one thing to press (a hand anywhere on it); the map's own states
      // answer only once the camera has arrived in front of it.
      function hover() {
        const at = pointer.known ? onScreen(pointer.x, pointer.y) : null;
        const near = focus.on && !focus.moving;
        const hand = map.point(near && at ? map.hit(at[0], at[1]) : null);
        canvas.style.cursor = focus.on ? (hand ? 'pointer' : at || !pointer.known ? '' : 'zoom-out') : at ? 'pointer' : '';
      }
      // a press counts where the pointer goes down and comes up in one place (a tap, a click), not a drag
      window.addEventListener('pointerdown', (e) => {
        if (e.button === 0) pointer.down = { x: e.clientX, y: e.clientY, id: e.pointerId };
      });
      window.addEventListener('pointerup', (e) => {
        const down = pointer.down;
        pointer.down = null;
        if (!down || down.id !== e.pointerId || Math.hypot(e.clientX - down.x, e.clientY - down.y) > (e.pointerType === 'mouse' ? 6 : 14)) return;
        const at = onScreen(e.clientX, e.clientY);
        if (!focus.on) {
          if (at) focusScreen(); // and nothing else: this press does not reach the map
        } else if (!at) unfocus();
        else if (!focus.moving) map.press(map.hit(at[0], at[1]));
        // a finger leaves nothing hovering behind it
        if (e.pointerType !== 'mouse') pointer.known = false;
        pointer.moved = true;
      });
      window.addEventListener('pointercancel', () => {
        pointer.down = null;
      });
      // Escape undoes the last thing: an open panel first, then the push-in
      window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (map.close() || unfocus()) pointer.moved = true;
      });

      let last = performance.now();
      function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const k = 1 - Math.exp(-dt * 3.5);
        const dx = drift.tx - drift.x,
          dy = drift.ty - drift.y;
        let moved = dirty;
        if (focus.moving) {
          const t = Math.min((now - focus.started) / (FOCUS_SECONDS * 1000), 1);
          focus.f = THREE.MathUtils.lerp(focus.from, focus.on ? 1 : 0, smooth(t));
          if (t >= 1) focus.moving = false;
          pointer.moved = true; // what the pointer is over changes with the camera, and once more on arriving
          moved = true;
        }
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
        if (moved) placeCamera();
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
        if (moved) {
          dirty = false;
          composer.render();
          document.body.dataset.ready = '1';
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);

      /** Where a state's middle is on the page right now (client pixels), for tests that press it. */
      function statePoint(id) {
        const uv = map.where(id);
        if (!uv) return null;
        const top = corners[0].clone().lerp(corners[1], uv[0]),
          bottom = corners[2].clone().lerp(corners[3], uv[0]);
        const v = samsung.localToWorld(top.lerp(bottom, uv[1])).project(camera);
        return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight];
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
        statePoint,
        focus,
        focusScreen,
        unfocus,
        /** True when the camera is at the screen or on its way there. */
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
