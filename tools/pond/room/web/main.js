// The room in the browser. export.py (tools/pond/room) wrote everything this loads:
// room.glb (the indoor part), lm/*.webp (baked light for the big surfaces), backdrop.webp (the
// garden behind the glass) and manifest.json (the seat camera, the lamp, how light is encoded).
//
// All diffuse light is baked: light maps on the big surfaces, vertex colours on everything
// else. What is live: reflections (an environment captured from the scene itself, and the
// lamp as a point light, both specular only), the screens' glow, bloom and the tone curve.
//
// Query: ?view=laptop|arm|tree|keys (default hero, the seat), ?still (no drift),
// ?bloom=0, ?exposure=0.3 (stops).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

const query = new URLSearchParams(location.search);
const canvas = document.getElementById("room");
// Blender's axes (z up, the seat looks toward -y) to three's (y up)
const bl = (p) => new THREE.Vector3(p[0], p[2], -p[1]);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
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
    shader.vertexShader = shader.vertexShader.replace(
      "#include <color_pars_vertex>",
      CENTROID_COLOR.replace(/INOUT/g, "varying"),
    );
    shader.fragmentShader =
      "uniform float bakeLo;\nuniform float bakeStops;\nuniform float bakeOcclusion;\n" +
      DECODE +
      shader.fragmentShader
        .replace(
          "#include <color_pars_fragment>",
          CENTROID_COLOR.replace(/INOUT/g, "varying"),
        )
        .replace("#include <color_fragment>", "") // the vertex colour is light, not paint
        .replace(
          "#include <aomap_fragment>",
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
      `,
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
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D curve;
    uniform float exposure, curveSize, log2Min, log2Max;
    varying vec2 vUv;
    const mat3 SRGB_TO_REC2020 = mat3( vec3( 0.6274, 0.0691, 0.0164 ), vec3( 0.3293, 0.9195, 0.0880 ), vec3( 0.0433, 0.0113, 0.8956 ) );
    const mat3 REC2020_TO_SRGB = mat3( vec3( 1.6605, - 0.1246, - 0.0182 ), vec3( - 0.5876, 1.1329, - 0.1006 ), vec3( - 0.0728, - 0.0083, 1.1187 ) );
    const mat3 INSET = mat3( vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ), vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ), vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 ) );
    const mat3 OUTSET = mat3( vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ), vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ), vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 ) );
    float toned( float x ) { return texture2D( curve, vec2( ( x * ( curveSize - 1.0 ) + 0.5 ) / curveSize, 0.5 ) ).r; }
    float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
    void main() {
      vec3 c = max( texture2D( tDiffuse, vUv ).rgb, 0.0 ) * exposure;
      c = INSET * ( SRGB_TO_REC2020 * c );
      c = clamp( ( log2( max( c, 1e-10 ) ) - log2Min ) / ( log2Max - log2Min ), 0.0, 1.0 );
      c = OUTSET * vec3( toned( c.r ), toned( c.g ), toned( c.b ) );
      c = REC2020_TO_SRGB * pow( max( c, 0.0 ), vec3( 2.2 ) );
      c = pow( clamp( c, 0.0, 1.0 ), vec3( 1.0 / 2.2 ) );
      c += ( hash( gl_FragCoord.xy ) - 0.5 ) / 255.0;
      gl_FragColor = vec4( c, 1.0 );
    }`,
};

// ---------------------------------------------------------------------------------------------
// Loading.
// ---------------------------------------------------------------------------------------------

const textures = new THREE.TextureLoader();
const loadTexture = (url) =>
  new Promise((resolve, reject) =>
    textures.load(url, resolve, undefined, reject),
  );
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(
  new DRACOLoader().setDecoderPath(
    "./node_modules/three/examples/jsm/libs/draco/gltf/",
  ),
);

/** The Samsung's picture: a canvas, so a map can be drawn on it later. For now the calm navy of the offline render. */
function mapCanvas() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 576;
  const g = c.getContext("2d");
  const srgb = (v) =>
    Math.round(
      255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055),
    );
  const stops = [
    [0, [0.02, 0.052, 0.165]],
    [1, [0.006, 0.016, 0.06]],
  ];
  // scene.py's ramp runs over distance in the picture's own 0..1 square, out to 0.75; draw a
  // circle in that square and let the canvas stretch it
  g.save();
  g.scale(c.width, c.height);
  const grad = g.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, 0.75);
  // the ramp is linear in light, so place a few stops for the sRGB canvas to follow it
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const rgb = stops[0][1].map((a, k) => a + (stops[1][1][k] - a) * t);
    grad.addColorStop(t, `rgb(${rgb.map(srgb).join(",")})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, 1, 1);
  g.restore();
  return c;
}

async function load() {
  const manifest = await (await fetch("./manifest.json")).json();
  const lm = manifest.lightmaps;
  const [gltf, backdropTex, ...lightTex] = await Promise.all([
    gltfLoader.loadAsync("./room.glb"),
    loadTexture("./" + manifest.backdrop.file),
    ...Object.values(lm.files).map((f) => loadTexture("./" + f)),
  ]);
  const lightMaps = Object.fromEntries(
    Object.keys(lm.files).map((k, i) => [k, lightTex[i]]),
  );
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
    const owner = lightMaps[o.name]
      ? o.name
      : o.parent && lightMaps[o.parent.name]
        ? o.parent.name
        : null;
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

  // the Samsung (the left screen): its own mesh and material, lit by a canvas
  const samsung = named.samsung_screen;
  const mapTexture = new THREE.CanvasTexture(mapCanvas());
  mapTexture.colorSpace = THREE.SRGBColorSpace;
  mapTexture.flipY = false;
  mapTexture.anisotropy = maxAniso;
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
    side: THREE.DoubleSide,
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
          value: new THREE.Color().setRGB(
            0.93 * 0.936,
            0.97 * 0.936,
            0.96 * 0.936,
            THREE.LinearSRGBColorSpace,
          ),
        },
      },
      vertexShader:
        "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }",
      fragmentShader:
        DECODE +
        "uniform sampler2D map; uniform float lo, stops; uniform vec3 tint; varying vec2 vUv;" +
        "void main() { gl_FragColor = vec4( bakedDecode( texture2D( map, vUv ).rgb, lo, stops ) * tint, 1.0 ); }",
    }),
  );
  backdrop.name = "backdrop";
  backdrop.position
    .copy(seat)
    .add(aim.clone().sub(seat).normalize().multiplyScalar(b.distance));
  backdrop.lookAt(seat);
  scene.add(backdrop);

  // the lamp: a warm point light. It only adds highlights; its pool on the desk is baked.
  const lamp = new THREE.PointLight(
    new THREE.Color().setRGB(
      ...manifest.lamp.color,
      THREE.LinearSRGBColorSpace,
    ),
    manifest.lamp.watts / (4 * Math.PI),
    0,
    2,
  );
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
    const plain = ![
      "lamp_bulb",
      "window_glass",
      "samsung_screen",
      "dell_screen",
      "macbook_screen",
    ].includes(o.name);
    o.castShadow = plain;
    o.receiveShadow = plain;
  });
  scene.add(lamp);

  return { manifest, named, samsung, mapTexture, backdrop, glass, lamp };
}

// ---------------------------------------------------------------------------------------------
// Camera: the seat, with a few centimetres of drift after the pointer. No orbit.
// ---------------------------------------------------------------------------------------------

const view = {
  position: new THREE.Vector3(),
  aim: new THREE.Vector3(),
  lens: 25,
  sensor: 36,
};
const drift = { x: 0, y: 0, tx: 0, ty: 0, reach: [0.035, 0.02] }; // metres, sideways and up
const still = query.has("still");

function setView(manifest, name) {
  const v = manifest.views[name] || manifest.views.hero;
  view.position.copy(bl(v.position));
  view.aim.copy(bl(v.aim));
  view.lens = v.lens;
}

function placeCamera() {
  const aspect = camera.aspect;
  // Blender fits the sensor's width to the longer side of the picture
  const half = view.sensor / 2 / view.lens;
  camera.fov = THREE.MathUtils.radToDeg(
    2 * Math.atan(aspect >= 1 ? half / aspect : half),
  );
  camera.updateProjectionMatrix();
  const forward = view.aim.clone().sub(view.position).normalize();
  const right = forward.clone().cross(camera.up).normalize();
  const up = right.clone().cross(forward);
  camera.position
    .copy(view.position)
    .addScaledVector(right, drift.x * drift.reach[0])
    .addScaledVector(up, drift.y * drift.reach[1]);
  camera.lookAt(view.aim);
}

// ---------------------------------------------------------------------------------------------
// Go.
// ---------------------------------------------------------------------------------------------

const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
);
composer.addPass(new RenderPass(scene, camera));
// nothing brighter than this reaches the bloom: the inside of the lamp's shade is some hundred times the sky
const ClampShader = {
  uniforms: { tDiffuse: { value: null }, limit: { value: 10 } },
  vertexShader: FinishShader.vertexShader,
  fragmentShader:
    "uniform sampler2D tDiffuse; uniform float limit; varying vec2 vUv; void main() { gl_FragColor = vec4( clamp( texture2D( tDiffuse, vUv ).rgb, 0.0, limit ), 1.0 ); }",
};
composer.addPass(new ShaderPass(ClampShader));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(1, 1),
  Number(query.get("bloom") ?? 0.05),
  Number(query.get("radius") ?? 0.1),
  1.2,
);
// Blender's bloom takes only what exceeds its threshold; the pass here would take a bright pixel
// whole, and the sky would fog the tree. A wide knee comes to much the same as the excess.
bloom.highPassUniforms.smoothWidth.value = 1.5;
if (bloom.strength > 0) composer.addPass(bloom);
const finish = new ShaderPass(FinishShader);
finish.uniforms.exposure.value = 2 ** Number(query.get("exposure") ?? 0);
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
window.addEventListener("resize", resize);
window.addEventListener("pointermove", (e) => {
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
      THREE.HalfFloatType,
    );
    curve.minFilter = curve.magFilter = THREE.LinearFilter;
    curve.needsUpdate = true;
    Object.assign(finish.uniforms.curve, { value: curve });
    finish.uniforms.curveSize.value = look.curve.length;
    finish.uniforms.log2Min.value = look.log2Min;
    finish.uniforms.log2Max.value = look.log2Max;
    if (!query.has("exposure"))
      finish.uniforms.exposure.value = 2 ** look.exposure;
    setView(world.manifest, query.get("view") || "hero");
    resize();
    placeCamera();

    // Reflections: the scene's own surroundings, captured once. One capture stands for the whole
    // room; the laptop gets its own from just above its trackpad, since what its deck mirrors (its
    // own screen) is a hand's width away and looks nothing like the room from anywhere else.
    const pmrem = new THREE.PMREMGenerator(renderer);
    world.glass.visible = false;
    const env = pmrem.fromScene(scene, 0, 0.01, 60, {
      position: bl(PROBE.room),
    });
    const envLaptop = pmrem.fromScene(scene, 0, 0.03, 60, {
      position: bl(PROBE.laptop),
    });
    world.glass.visible = true;
    scene.environment = env.texture;
    world.named.macbook_screen.parent.traverse((o) => {
      if (o.name !== "macbook" && o.parent.name !== "macbook") return;
      if (o.isMesh) {
        o.material = o.material.clone();
        bakeLit(
          o.material,
          world.manifest.vertexLight.lo,
          world.manifest.vertexLight.stops,
        );
        o.material.envMap = envLaptop.texture;
      }
    });
    pmrem.dispose();

    let last = performance.now();
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const k = 1 - Math.exp(-dt * 3.5);
      const dx = drift.tx - drift.x,
        dy = drift.ty - drift.y;
      if (Math.abs(dx) + Math.abs(dy) > 1e-4) {
        drift.x += dx * k;
        drift.y += dy * k;
        dirty = true;
      }
      if (dirty) {
        dirty = false;
        placeCamera();
        composer.render();
        document.body.dataset.ready = "1";
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // for the console and for what comes next (a map on the Samsung: draw on mapTexture.image, then mapTexture.needsUpdate = true)
    window.room = {
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
      ...world,
      setView: (name) => {
        setView(world.manifest, name);
        dirty = true;
      },
      redraw: () => {
        dirty = true;
      },
    };
  })
  .catch((e) => {
    console.error(e);
    document.getElementById("note").textContent =
      "the room did not load: " + e.message;
  });
