// Devot's dove and ocra's jumping spider, as three.js models built in code (no model files),
// for the pond (engine.js). Ported from the asset sheet they were designed on.
/*
   Both are three.js models built in code. Each is drawn from straight above into a small picture every
   frame, lit from the side the pond is lit from, and the picture is laid into the pond where the
   creature is: the spider on the layer of floating things, the dove in the air over the glass. */
import * as T3 from 'three';

export function makeLife() {
  const V = (x, y, z) => new T3.Vector3(x, y, z),
    TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp = (a, b, t) => a + (b - a) * t,
    rnd = (a, b) => a + Math.random() * (b - a);
  let seed = 7;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  // Catmull-Rom through rows of numbers: one row per control section.
  function through(rows, t) {
    const n = rows.length - 1,
      f = clamp(t, 0, 1) * n,
      i = Math.min(n - 1, Math.floor(f)),
      u = f - i;
    const p0 = rows[Math.max(0, i - 1)],
      p1 = rows[i],
      p2 = rows[i + 1],
      p3 = rows[Math.min(n, i + 2)];
    return p1.map(
      (_, k) =>
        0.5 * (2 * p1[k] + (p2[k] - p0[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * u * u * u)
    );
  }
  // A body lofted along a spine that lies in the XY plane. Each control row is [x, y, half-width, half-height];
  // `sq` squares the cross-section off. Returns the geometry and a way to find any point on the skin.
  function loft(rows, { rings = 44, seg = 30, sq = 2 } = {}) {
    const frame = (t) => {
      const c = through(rows, t),
        a = through(rows, Math.max(0, t - 0.01)),
        b = through(rows, Math.min(1, t + 0.01));
      let tx = b[0] - a[0],
        ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      return { c, tx, ty, ux: -ty, uy: tx };
    };
    const at = (t, ang) => {
      const f = frame(t),
        cs = Math.cos(ang),
        sn = Math.sin(ang),
        sx = Math.sign(cs) * Math.pow(Math.abs(cs), 2 / sq),
        sy = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / sq);
      const rz = Math.max(f.c[2], 1e-4),
        ry = Math.max(f.c[3], 1e-4);
      return {
        p: V(f.c[0] + f.ux * sy * ry, f.c[1] + f.uy * sy * ry, sx * rz),
        n: V((f.ux * sy) / ry, (f.uy * sy) / ry, sx / rz).normalize(),
        t: V(f.tx, f.ty, 0),
        r: (rz + ry) / 2
      };
    };
    const pos = [],
      idx = [];
    for (let i = 0; i <= rings; i++)
      for (let j = 0; j < seg; j++) {
        const q = at(i / rings, (j / seg) * TAU).p;
        pos.push(q.x, q.y, q.z);
      }
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < seg; j++) {
        const a = i * seg + j,
          b = i * seg + ((j + 1) % seg),
          c = a + seg,
          d = b + seg;
        idx.push(a, c, b, b, c, d);
      }
    const geo = new T3.BufferGeometry();
    geo.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return { geo, at, rows };
  }
  // One feather: a cambered blade along +X from the quill at the origin, face up. Unit length and width;
  // `band` darkens a stretch of it (start, end, how much), and the tip beyond the band is pale.
  function featherGeo({ segs = 7, camber = 0.16, droop = 0.06, band, edge = 0.14 } = {}) {
    const pos = [],
      col = [],
      idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs,
        w = 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(t * 0.93 + 0.035, 0.78)), 0.55);
      for (const k of [-1, -0.5, 0, 0.5, 1]) {
        pos.push(t, -camber * k * k * w - droop * t * t, k * w);
        let c = (1 - edge * Math.abs(k)) * (1 - 0.1 * t);
        if (band) c *= t > band[0] && t < band[1] ? 1 - band[2] : t >= band[1] ? 1.12 : 1;
        col.push(c, c, c);
      }
    }
    for (let i = 0; i < segs; i++)
      for (let k = 0; k < 4; k++) {
        const a = i * 5 + k,
          b = a + 1,
          c = a + 5,
          d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    const geo = new T3.BufferGeometry();
    geo.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }
  // Where a feather (or a hair) goes: at `p`, lying along `d`, its face towards `n`.
  const _m = new T3.Matrix4(),
    _x = V(),
    _y = V(),
    _z = V();
  function place(mesh, i, p, d, n, len, wid, thick = 1) {
    _x.copy(d).normalize();
    _z.crossVectors(_x, n).normalize();
    _y.crossVectors(_z, _x).normalize();
    _m.makeBasis(_x.clone().multiplyScalar(len), _y.clone().multiplyScalar(thick), _z.clone().multiplyScalar(wid));
    _m.setPosition(p);
    mesh.setMatrixAt(i, _m);
  }
  // A tapered limb between two points, with rounded ends.
  function limb(r0, r1, len, material) {
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const a = (i / 5) * Math.PI * 0.5;
      pts.push(new T3.Vector2(Math.sin(a) * r0, -Math.cos(a) * r0));
    }
    for (let i = 0; i <= 5; i++) {
      const a = (i / 5) * Math.PI * 0.5;
      pts.push(new T3.Vector2(Math.cos(a) * r1, len + Math.sin(a) * r1));
    }
    const m = new T3.Mesh(new T3.LatheGeometry(pts, 14), material);
    m.castShadow = true;
    return m;
  }
  const _up = V(0, 1, 0),
    _q = new T3.Quaternion();
  function span(mesh, a, b) {
    mesh.position.copy(a);
    mesh.quaternion.copy(_q.setFromUnitVectors(_up, b.clone().sub(a).normalize()));
  }

  function makeDove(scene) {
    const bird = new T3.Group();
    scene.add(bird);
    const C = (h) => new T3.Color(h),
      jit = (c, a) => c.clone().multiplyScalar(1 + (rand() - 0.5) * a);
    const TEAL = C('#56cdb2'),
      PALE = C('#a4e9d8'),
      RUMP = C('#c8f3e9'),
      NECK = C('#2fa590'),
      WING = C('#a9e6d6'),
      BAR = C('#1d645c'),
      DARK = C('#257a71');
    const plume = new T3.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0,
      sheen: 0.6,
      sheenRoughness: 0.5,
      sheenColor: C('#dffaf2'),
      side: T3.DoubleSide
    });
    const shimmer = new T3.MeshPhysicalMaterial({
      vertexColors: true,
      color: '#49bfa8',
      roughness: 0.45,
      metalness: 0,
      sheen: 0.5,
      sheenColor: C('#e6fff6'),
      iridescence: 0.7,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [220, 620],
      side: T3.DoubleSide
    });
    const skin = new T3.MeshStandardMaterial({ color: '#4fc4aa', roughness: 0.75 });
    const fGeo = featherGeo(),
      tailGeo = featherGeo({ band: [0.7, 0.93, 0.6], camber: 0.1 }),
      flightGeo = featherGeo({ camber: 0.1, droop: 0.03, band: [0.55, 1.01, 0.5] });
    // perched and flying: the same body, with the neck up or stretched forward
    const PERCH = [
      [-1.3, 0.06, 0.05, 0.04],
      [-1.02, 0.1, 0.3, 0.25],
      [-0.5, 0.1, 0.52, 0.47],
      [0.02, 0.06, 0.6, 0.56],
      [0.5, 0.13, 0.54, 0.53],
      [0.84, 0.38, 0.4, 0.4],
      [0.99, 0.6, 0.29, 0.3],
      [1.08, 0.77, 0.22, 0.225],
      [1.12, 0.86, 0.19, 0.19]
    ];
    const FLY = [
      [-1.3, 0.06, 0.05, 0.04],
      [-1.02, 0.1, 0.3, 0.25],
      [-0.5, 0.1, 0.52, 0.45],
      [0.02, 0.06, 0.6, 0.52],
      [0.5, 0.1, 0.54, 0.5],
      [0.86, 0.2, 0.38, 0.38],
      [1.08, 0.3, 0.25, 0.26],
      [1.24, 0.36, 0.185, 0.19],
      [1.32, 0.38, 0.16, 0.16]
    ];
    const mix = (f) => PERCH.map((r, i) => r.map((v, k) => lerp(FLY[i][k], v, f)));
    let body = loft(mix(1));
    const bodyMesh = new T3.Mesh(body.geo, skin);
    bodyMesh.castShadow = true;
    bird.add(bodyMesh);
    // contour feathers: rows round the body, each row half a step round from the last, tips towards the tail
    const spots = [];
    for (let t = 0.07; t < 0.97; ) {
      const neck = clamp((t - 0.62) / 0.3, 0, 1),
        len = lerp(0.36, 0.13, neck) * (t < 0.2 ? 0.75 : 1),
        q = body.at(t, 0),
        n = Math.max(6, Math.round((TAU * q.r) / (len * 0.42)));
      for (let j = 0; j < n; j++)
        spots.push({ t, a: ((j + (spots.length % 2) * 0.5) / n) * TAU + rand() * 0.05, len: len * (0.9 + rand() * 0.2), neck, row: spots.length });
      t += (len * 0.4) / 2.9;
    }
    const coat = new T3.InstancedMesh(fGeo, plume, spots.length),
      collar = new T3.InstancedMesh(fGeo, shimmer, spots.length);
    coat.castShadow = true;
    bird.add(coat, collar);
    let nc = 0,
      nk = 0;
    const who = [];
    spots.forEach((s) => {
      const up = Math.sin(s.a),
        shiny = s.neck > 0.34 && s.neck < 0.97;
      const col = shiny
        ? jit(C('#ffffff'), 0.1)
        : jit(
            s.t < 0.2
              ? RUMP.clone().lerp(TEAL, s.t / 0.2)
              : up < -0.2
                ? PALE
                : TEAL.clone()
                    .lerp(PALE, clamp(-up, 0, 1) * 0.6)
                    .lerp(NECK, s.neck),
            0.12
          );
      if (shiny) {
        collar.setColorAt(nk, col);
        who.push([collar, nk++, s]);
      } else {
        coat.setColorAt(nc, col);
        who.push([coat, nc++, s]);
      }
    });
    coat.count = nc;
    collar.count = nk;
    const dress = () => {
      for (const [mesh, i, s] of who) {
        const q = body.at(s.t, s.a);
        place(mesh, i, q.p.addScaledVector(q.n, 0.012), q.t.clone().negate().addScaledVector(q.n, 0.035), q.n, s.len, s.len * 0.9);
      }
      coat.instanceMatrix.needsUpdate = collar.instanceMatrix.needsUpdate = true;
    };
    dress();

    // the head turns on the neck: skull, beak, cere, eyes, and small feathers of its own
    const head = new T3.Group();
    head.scale.setScalar(1.1);
    bird.add(head);
    const skull = loft(
      [
        [-0.16, 0.0, 0.02, 0.02],
        [-0.09, 0.05, 0.17, 0.17],
        [0.05, 0.13, 0.215, 0.205],
        [0.19, 0.13, 0.2, 0.19],
        [0.32, 0.08, 0.13, 0.125],
        [0.41, 0.045, 0.06, 0.055]
      ],
      { rings: 26, seg: 26 }
    );
    const skullMesh = new T3.Mesh(skull.geo, skin);
    skullMesh.castShadow = true;
    head.add(skullMesh);
    const hs = [];
    for (let t = 0.16; t < 0.86; t += 0.075) {
      const n = Math.round(14 + 10 * Math.sin(t * Math.PI));
      for (let j = 0; j < n; j++) hs.push([t, ((j + (hs.length % 2) * 0.5) / n) * TAU]);
    }
    const cap = new T3.InstancedMesh(fGeo, plume, hs.length);
    cap.castShadow = true;
    head.add(cap);
    hs.forEach(([t, a], i) => {
      const q = skull.at(t, a);
      place(cap, i, q.p.addScaledVector(q.n, 0.006), q.t.clone().negate().addScaledVector(q.n, 0.16), q.n, 0.105, 0.085);
      cap.setColorAt(i, jit(NECK.clone().lerp(TEAL, 0.35), 0.1));
    });
    const horn = new T3.MeshPhysicalMaterial({ color: '#2b3138', roughness: 0.35, clearcoat: 0.6 });
    const upper = new T3.Mesh(
      loft(
        [
          [0.38, 0.055, 0.062, 0.045],
          [0.48, 0.04, 0.048, 0.036],
          [0.58, 0.005, 0.024, 0.022],
          [0.635, -0.035, 0.004, 0.004]
        ],
        { rings: 14, seg: 14 }
      ).geo,
      horn
    );
    const lower = new T3.Mesh(
      loft(
        [
          [0.38, 0.005, 0.05, 0.03],
          [0.48, -0.012, 0.036, 0.02],
          [0.585, -0.03, 0.008, 0.008]
        ],
        { rings: 12, seg: 12 }
      ).geo,
      horn
    );
    upper.castShadow = true;
    head.add(upper, lower);
    const wax = new T3.MeshStandardMaterial({ color: '#f1f0ea', roughness: 0.85 });
    for (const sz of [1, -1]) {
      const cere = new T3.Mesh(new T3.SphereGeometry(1, 16, 12), wax);
      cere.scale.set(0.062, 0.036, 0.036);
      cere.position.set(0.425, 0.09, sz * 0.032);
      head.add(cere);
      const eye = new T3.Group();
      eye.position.set(0.165, 0.14, sz * 0.186);
      eye.rotation.y = sz * -0.18;
      head.add(eye);
      const iris = new T3.Mesh(
        new T3.SphereGeometry(0.047, 24, 18),
        new T3.MeshPhysicalMaterial({ color: '#f08a2c', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04 })
      );
      eye.add(iris);
      const pupil = new T3.Mesh(new T3.SphereGeometry(0.03, 18, 14), new T3.MeshPhysicalMaterial({ color: '#07080a', roughness: 0.05, clearcoat: 1 }));
      pupil.position.z = sz * 0.022;
      eye.add(pupil);
      const ring = new T3.Mesh(new T3.TorusGeometry(0.05, 0.009, 10, 28), new T3.MeshStandardMaterial({ color: '#9fb0ac', roughness: 0.8 }));
      ring.position.z = sz * 0.004;
      eye.add(ring);
      eye.userData.lid = iris;
    }

    // wings: every feather has a place folded against the flank and a place spread in flight
    const wingN = [],
      wingMeshes = [];
    const SH = V(0.55, 0.44, 0.44),
      EL = V(0.38, 0.47, 0.98),
      WR = V(0.68, 0.47, 1.66),
      TP = V(0.42, 0.45, 2.3);
    const along = (a, b, u) => a.clone().lerp(b, u);
    const add = (geo, col, folded, spread, len, wid) => wingN.push({ geo, col, fo: folded, sp: spread, len, wid });
    const flank = loft(PERCH),
      side = (t, a, out = 0.03) => {
        const q = flank.at(t, a);
        return [q.p.addScaledVector(q.n, out), q.n];
      };
    for (let i = 0; i < 10; i++) {
      // primaries, outermost first: folded, a dark point that reaches over the tail
      const u = i / 9,
        dirS = V(-lerp(0.42, 1, u), 0, lerp(0.91, 0.16, u)).normalize();
      add(
        flightGeo,
        DARK,
        [V(-0.3 - u * 0.12, 0.17 + u * 0.07, 0.6 + u * 0.01), V(-1, -0.02 + u * 0.03, -0.3 + u * 0.06), V(0.08, 0.5, 0.86)],
        [along(TP, WR, u), dirS, V(0, 1, 0.04)],
        [lerp(1.3, 0.95, u), lerp(1.12, 1.3, Math.sin(u * Math.PI) * 0.5 + u * 0.5)],
        [0.2, 0.3]
      );
    }
    for (let i = 0; i < 10; i++) {
      // secondaries: the lower edge of the folded wing, dark at the ends
      const u = i / 9;
      add(
        flightGeo,
        WING.clone().lerp(TEAL, 0.25),
        [V(-0.62 + u * 0.5, 0.02 + u * 0.1, 0.55 + u * 0.09), V(-1, 0.03, -0.16), V(0.05, 0.45, 0.89)],
        [along(WR, EL, u), V(-1, 0, 0.06).normalize(), V(0, 1, 0.03)],
        [0.72, lerp(1.08, 0.92, u)],
        [0.22, 0.3]
      );
    }
    for (let i = 0; i < 4; i++) {
      const u = i / 3;
      add(
        fGeo,
        TEAL.clone().lerp(WING, 0.6),
        [V(-0.2 + u * 0.14, 0.3 + u * 0.05, 0.6), V(-1, 0.04, -0.18), V(0.02, 0.6, 0.8)],
        [along(EL, SH, u), V(-1, 0, 0.1).normalize(), V(0, 1, 0.02)],
        [0.6, 0.8],
        [0.21, 0.3]
      );
    }
    // the coverts: a shield of small pale feathers over the folded wing, with two dark bars across its lower half
    const arm = (s) => (s < 0.2 ? along(SH, EL, s / 0.2) : s < 0.58 ? along(EL, WR, (s - 0.2) / 0.38) : along(WR, TP, (s - 0.58) / 0.42));
    let nCov = 0,
      nBar = 0;
    for (let r = 0, t = 0.2; t < 0.52; t += 0.02, r++) {
      const tn = (t - 0.2) / 0.32,
        h = 0.8 * Math.pow(Math.sin(Math.PI * (0.12 + 0.83 * tn)), 0.6),
        mid = lerp(0.5, 0.42, tn),
        len = lerp(0.3, 0.15, tn),
        n = Math.max(3, Math.round((2 * h * 0.56) / (len * 0.5)));
      for (let i = 0; i < n; i++) {
        const an = (i + (r % 2) * 0.5) / n,
          a = mid + (an * 2 - 1) * h,
          [p, nn] = side(t, a, 0.04 + 0.035 * Math.sin(Math.PI * tn) * Math.sin(Math.PI * an));
        const q = flank.at(t, a);
        let sp = ((nCov++ * 0.618034) % 1) * 0.94,
          bar = an < 0.8 && (r === 2 || r === 5),
          ch = bar ? (r === 2 ? 1 : 0.7) : 1 - tn;
        if (bar) sp = 0.06 + ((nBar++ * 0.618034) % 1) * 0.52;
        add(
          fGeo,
          bar ? jit(BAR, 0.1) : jit(WING, 0.08),
          [p, q.t.clone().negate().addScaledVector(nn, 0.1), nn],
          [
            arm(sp).add(V(0.04 - ch * 0.5 * (1 - 0.4 * sp), 0.04 - ch * 0.012, 0)),
            V(-1, 0, sp > 0.58 ? lerp(0.05, 0.5, (sp - 0.58) / 0.42) : 0.05).normalize(),
            V(0, 1, 0)
          ],
          [len, len * 1.35],
          [len * 0.85, len * 1.1]
        );
      }
    }
    const kinds = new Map();
    wingN.forEach((f) => {
      if (!kinds.has(f.geo)) kinds.set(f.geo, []);
      kinds.get(f.geo).push(f);
    });
    for (const [geo, list] of kinds)
      for (const sz of [1, -1]) {
        const mesh = new T3.InstancedMesh(geo, plume, list.length);
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        list.forEach((f, i) => mesh.setColorAt(i, f.col));
        bird.add(mesh);
        wingMeshes.push([mesh, list, sz]);
      }
    const _p = V(),
      _d = V(),
      _n = V(),
      _ax = V(1, 0, 0);
    function wings(fold, beat) {
      for (const [mesh, list, sz] of wingMeshes) {
        list.forEach((f, i) => {
          _p.copy(f.sp[0]).lerp(f.fo[0], fold);
          _d.copy(f.sp[1]).lerp(f.fo[1], fold).normalize();
          _n.copy(f.sp[2]).lerp(f.fo[2], fold).normalize();
          if (fold < 0.98) {
            const reach = clamp((f.sp[0].z - SH.z) / 1.86, 0, 1),
              ang = (1 - fold) * (beat.a * Math.sin(beat.ph - reach * 1.1) * (0.55 + 0.6 * reach) + 0.12);
            _p.sub(SH).applyAxisAngle(_ax, -ang).add(SH);
            _d.applyAxisAngle(_ax, -ang);
            _n.applyAxisAngle(_ax, -ang);
          }
          if (sz < 0) {
            _p.z = -_p.z;
            _d.z = -_d.z;
            _n.z = -_n.z;
          }
          place(mesh, i, _p, _d, _n, lerp(f.len[1], f.len[0], fold), lerp(f.wid[1], f.wid[0], fold));
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    // the tail: twelve feathers that close to a wedge and open to a fan
    const tail = new T3.InstancedMesh(tailGeo, plume, 12);
    tail.castShadow = true;
    bird.add(tail);
    for (let i = 0; i < 12; i++) tail.setColorAt(i, jit(TEAL.clone().lerp(PALE, 0.3), 0.06));
    function fan(open) {
      for (let i = 0; i < 12; i++) {
        const u = i / 11 - 0.5,
          ph = u * 2 * lerp(0.13, 0.6, open);
        place(tail, i, V(-1.18, 0.07 - Math.abs(u) * 0.03, Math.sin(ph) * 0.12), V(-Math.cos(ph), -0.07, Math.sin(ph)), V(0.05, 1, u * 0.25), 1.02, 0.25);
      }
      tail.instanceMatrix.needsUpdate = true;
    }

    // legs and feet
    const legs = new T3.Group();
    bird.add(legs);
    const coral = new T3.MeshPhysicalMaterial({ color: '#e2553a', roughness: 0.55, clearcoat: 0.2 }),
      claw = new T3.MeshStandardMaterial({ color: '#2a2422', roughness: 0.5 });
    for (const sz of [1, -1]) {
      const leg = new T3.Group();
      leg.position.set(0.02, -0.4, sz * 0.17);
      legs.add(leg);
      const shin = limb(0.05, 0.036, 0.42, coral);
      span(shin, V(0, 0.02, 0), V(0.05, -0.38, 0));
      leg.add(shin);
      for (const [ang, len] of [
        [0, 0.3],
        [0.5, 0.26],
        [-0.5, 0.26],
        [Math.PI, 0.15]
      ]) {
        const toe = limb(0.03, 0.02, len, coral),
          tip = V(0.05 + Math.cos(ang * sz) * len, -0.41, Math.sin(ang * sz) * len);
        span(toe, V(0.05, -0.385, 0), tip);
        leg.add(toe);
        const nail = new T3.Mesh(new T3.ConeGeometry(0.018, 0.07, 8), claw);
        span(nail, tip, tip.clone().add(V(Math.cos(ang * sz) * 0.06, -0.012, Math.sin(ang * sz) * 0.06)));
        nail.translateY(0.03);
        leg.add(nail);
      }
    }
    bird.position.y = 0.82;

    const st = { fold: 1, ph: 0, look: 0, lookGoal: 0, nextLook: 1, blink: 3, t: 0 };
    // o: the heading on the screen, whether the wings are out, how far the head is down to drink, how high it is
    function step(dt, o) {
      st.t += dt;
      const was = st.fold;
      st.fold += ((o.fly ? 0 : 1) - st.fold) * Math.min(1, dt * (o.fly ? 9 : 4.5));
      const flying = 1 - st.fold;
      st.ph += dt * 15;
      if (Math.abs(st.fold - was) > 0.002) {
        body = loft(mix(st.fold));
        bodyMesh.geometry.dispose();
        bodyMesh.geometry = body.geo;
        dress();
      }
      wings(st.fold, { a: 0.95, ph: st.ph });
      fan(flying * 0.75 + 0.05);
      const top = through(mix(st.fold), 1);
      head.position.set(top[0] + 0.02, top[1] + 0.02, 0);
      if (st.t > st.nextLook) {
        st.lookGoal = rnd(-0.9, 0.9) * st.fold;
        st.nextLook = st.t + rnd(0.7, 2.6);
      }
      st.look += (st.lookGoal - st.look) * Math.min(1, dt * 14);
      const d = (o.dip || 0) * st.fold;
      head.rotation.set(0, st.look * (1 - d), -d * 1.25 + flying * -0.1 + Math.sin(st.t * 1.3) * 0.03);
      bird.rotation.set(0, -o.a, -d * 0.42 - flying * 0.05);
      bird.position.y = 0.82 + (o.h || 0) * 1.6 + flying * Math.sin(st.ph) * -0.05;
      legs.scale.setScalar(1 - flying * 0.55);
      legs.rotation.z = flying * 1.1;
      legs.position.y = flying * 0.12;
      st.blink -= dt;
      const shut = st.blink < 0.12 && st.blink > 0;
      if (st.blink < 0) st.blink = rnd(2, 6);
      head.children.forEach((c) => {
        if (c.userData.lid) c.scale.y = shut ? 0.12 : 1;
      });
    }
    wings(1, { a: 0, ph: 0 });
    fan(0.05);
    return { step };
  }

  function makeSpider(scene) {
    const root = new T3.Group(),
      bodyG = new T3.Group();
    scene.add(root);
    root.add(bodyG);
    const chitin = new T3.MeshStandardMaterial({ color: '#1d1714', roughness: 0.82, envMapIntensity: 0.4 });
    const fur = new T3.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
    const hairGeo = new T3.ConeGeometry(0.017, 1, 4, 1);
    hairGeo.translate(0, 0.5, 0);
    hairGeo.rotateZ(-Math.PI / 2); // along +X, like a feather
    const carapace = loft(
      [
        [-0.66, 0.4, 0.04, 0.04],
        [-0.5, 0.44, 0.42, 0.3],
        [-0.14, 0.52, 0.6, 0.43],
        [0.24, 0.55, 0.63, 0.45],
        [0.5, 0.52, 0.6, 0.42],
        [0.63, 0.47, 0.52, 0.35],
        [0.69, 0.44, 0.3, 0.2]
      ],
      { sq: 2.7, rings: 40, seg: 36 }
    );
    const abdomen = loft(
      [
        [-0.6, 0.42, 0.05, 0.05],
        [-0.78, 0.44, 0.34, 0.32],
        [-1.2, 0.46, 0.52, 0.48],
        [-1.62, 0.42, 0.44, 0.4],
        [-1.92, 0.36, 0.2, 0.18],
        [-2.02, 0.33, 0.03, 0.03]
      ],
      { rings: 40, seg: 36 }
    );
    const waist = new T3.Group(),
      abdomenG = new T3.Group();
    waist.position.set(-0.6, 0.42, 0);
    abdomenG.position.set(0.6, -0.42, 0);
    waist.add(abdomenG);
    bodyG.add(waist);
    for (const part of [carapace, abdomen]) {
      const m = new T3.Mesh(part.geo, chitin);
      m.castShadow = true;
      (part === abdomen ? abdomenG : bodyG).add(m);
    }
    // fur: thousands of short hairs laid back along the body; the markings are hairs of another colour
    const BLACK = new T3.Color('#2a211c'),
      BROWN = new T3.Color('#5a4636'),
      WHITE = new T3.Color('#f3ecdd'),
      TAN = new T3.Color('#c9a878');
    function coat(part, n, len, tone, parent, back) {
      const mesh = new T3.InstancedMesh(hairGeo, fur, n);
      mesh.castShadow = false;
      parent.add(mesh);
      for (let i = 0; i < n; i++) {
        const t = 0.03 + rand() * 0.94,
          a = rand() * TAU,
          q = part.at(t, a),
          l = len * (0.6 + rand() * 0.8);
        place(
          mesh,
          i,
          q.p,
          q.t
            .clone()
            .multiplyScalar(0.9 * back)
            .addScaledVector(q.n, 0.55)
            .add(V(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.35)),
          q.n,
          l,
          1,
          1
        );
        mesh.setColorAt(
          i,
          tone(t, a, q)
            .clone()
            .multiplyScalar(0.8 + rand() * 0.4)
        );
      }
      return mesh;
    }
    coat(
      abdomen,
      3600,
      0.095,
      (t, a, q) => {
        const top = Math.sin(a) < -0.45,
          mid = Math.abs(q.p.z);
        if (top && t > 0.3 && t < 0.52 && mid < 0.2 - (t - 0.3) * 0.5) return WHITE; // the large mark in the middle of the back
        if (top && ((t > 0.6 && t < 0.68) || (t > 0.76 && t < 0.82)) && mid > 0.1 && mid < 0.24) return WHITE; // two pairs of spots behind it
        if (t < 0.2 && Math.sin(a) < 0.2) return TAN; // a pale band across the front
        return rand() < 0.2 ? BROWN : BLACK;
      },
      abdomenG,
      1
    );
    coat(
      carapace,
      3000,
      0.07,
      (t, a) => {
        if (t > 0.86 && Math.sin(a) < 0.1) return WHITE; // the moustache under the eyes
        if (t > 0.3 && t < 0.42 && Math.sin(a) > 0.2) return TAN;
        return rand() < 0.25 ? BROWN : BLACK;
      },
      bodyG,
      -1
    );
    // eyes: two large and two small across the face, four more on top
    const glass = new T3.MeshPhysicalMaterial({
      color: '#050506',
      roughness: 0.03,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.6
    });
    const rimM = new T3.MeshStandardMaterial({ color: '#c79a5a', roughness: 0.8 });
    for (const [x, y, z, r] of [
      [0.7, 0.5, 0.185, 0.175],
      [0.63, 0.57, 0.45, 0.098],
      [0.3, 0.83, 0.42, 0.036],
      [0.04, 0.84, 0.47, 0.066]
    ])
      for (const sz of [1, -1]) {
        const e = new T3.Mesh(new T3.SphereGeometry(r, 28, 20), glass);
        e.position.set(x, y, z * sz);
        bodyG.add(e);
        if (r > 0.08) {
          const ring = new T3.Mesh(new T3.TorusGeometry(r * 0.98, r * 0.11, 8, 30), rimM);
          ring.position.set(x - r * 0.25, y, z * sz);
          ring.rotation.y = Math.PI / 2;
          bodyG.add(ring);
        }
      }
    // chelicerae in metallic green, and the two palps it signals with
    const jewel = new T3.MeshPhysicalMaterial({
      color: '#1f9c6a',
      roughness: 0.22,
      metalness: 0.9,
      iridescence: 1,
      iridescenceIOR: 1.9,
      iridescenceThicknessRange: [300, 700]
    });
    const palps = [];
    for (const sz of [1, -1]) {
      const ch = new T3.Mesh(new T3.SphereGeometry(1, 20, 14), jewel);
      ch.scale.set(0.1, 0.2, 0.11);
      ch.position.set(0.63, 0.24, sz * 0.13);
      ch.castShadow = true;
      bodyG.add(ch);
      const palp = new T3.Group();
      palp.position.set(0.6, 0.3, sz * 0.3);
      bodyG.add(palp);
      palps.push(palp);
      const a = limb(0.05, 0.045, 0.2, chitin);
      span(a, V(0, 0, 0), V(0.16, -0.06, sz * 0.04));
      const b = limb(0.05, 0.06, 0.16, chitin);
      span(b, V(0.16, -0.06, sz * 0.04), V(0.24, -0.2, sz * 0.02));
      palp.add(a, b);
      const tuft = new T3.InstancedMesh(hairGeo, fur, 80);
      palp.add(tuft);
      for (let i = 0; i < 80; i++) {
        const p = V(0.16, -0.06, sz * 0.04).lerp(V(0.24, -0.2, sz * 0.02), rand()),
          n = V(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
        place(tuft, i, p.addScaledVector(n, 0.04), n, V(0, 1, 0.01), 0.09, 1, 1);
        tuft.setColorAt(i, WHITE);
      }
    }
    // legs: three stiff pieces each, placed every frame between the hip and a foot that stays on the ground
    const legs = [],
      HIPS = [
        [0.42, 0.28, 0.44],
        [0.16, 0.28, 0.5],
        [-0.1, 0.28, 0.5],
        [-0.34, 0.28, 0.44]
      ],
      REST = [
        [1.08, 0.86],
        [0.5, 1.16],
        [-0.4, 1.16],
        [-1.18, 0.8]
      ],
      LEN = [
        [0.6, 0.58, 0.4],
        [0.5, 0.48, 0.34],
        [0.5, 0.5, 0.34],
        [0.6, 0.64, 0.4]
      ],
      THICK = [0.125, 0.09, 0.085, 0.095];
    for (let k = 0; k < 4; k++)
      for (const sz of [1, -1]) {
        const [l1, l2, l3] = LEN[k],
          r = THICK[k],
          parts = [limb(r, r * 0.8, l1, chitin), limb(r * 0.78, r * 0.55, l2, chitin), limb(r * 0.5, r * 0.22, l3, chitin)];
        parts.forEach((m, i) => {
          root.add(m);
          const n = [120, 100, 50][i],
            L = [l1, l2, l3][i],
            rr = [r, r * 0.7, r * 0.4][i],
            h = new T3.InstancedMesh(hairGeo, fur, n);
          m.add(h);
          for (let j = 0; j < n; j++) {
            const y = rand() * L,
              a = rand() * TAU,
              nn = V(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55).normalize();
            place(h, j, V(Math.cos(a) * rr * 0.9, y, Math.sin(a) * rr * 0.9), nn, V(0, 1, 0), 0.04 + rand() * 0.05, 1, 1);
            h.setColorAt(
              j,
              (y < L * 0.14 || y > L * 0.88 ? (rand() < 0.7 ? WHITE : TAN) : rand() < 0.35 ? BROWN : BLACK).clone().multiplyScalar(0.8 + rand() * 0.4)
            );
          }
        });
        legs.push({
          k,
          sz,
          parts,
          hip: V(HIPS[k][0], HIPS[k][1], HIPS[k][2] * sz),
          foot: V(REST[k][0], 0.02, REST[k][1] * sz),
          home: V(REST[k][0], 0.02, REST[k][1] * sz),
          lift: 0
        });
      }
    const _h = V(),
      _f = V(),
      _k = V(),
      _mm = V(),
      _a = V(),
      _b = V(),
      _c = V();
    // the joint between two bones of length a and b that span from p to q, bulging towards `out`
    function knee(p, q, a, b, out, res) {
      const d = Math.min(p.distanceTo(q), (a + b) * 0.999),
        x = (a * a - b * b + d * d) / (2 * d),
        h = Math.sqrt(Math.max(0, a * a - x * x));
      _a.copy(q).sub(p).normalize();
      _b.copy(out).addScaledVector(_a, -out.dot(_a)).normalize();
      return res.copy(p).addScaledVector(_a, x).addScaledVector(_b, h);
    }
    function pose() {
      bodyG.updateMatrixWorld(true);
      root.updateMatrixWorld(true);
      const inv = new T3.Matrix4().copy(root.matrixWorld).invert();
      for (const L of legs) {
        _h.copy(L.hip).applyMatrix4(bodyG.matrixWorld).applyMatrix4(inv);
        _f.copy(L.foot).applyMatrix4(inv);
        const [l1, l2, l3] = LEN[L.k],
          out = _c.set(0, 1, 0).addScaledVector(V(_f.x - _h.x, 0, _f.z - _h.z).normalize(), 0.25);
        knee(_h, _f, l1, l2 + l3 * 0.9, out, _k);
        knee(_k, _f, l2, l3, out, _mm);
        span(L.parts[0], _h, _k);
        span(L.parts[1], _k, _mm);
        span(L.parts[2], _mm, _f);
      }
    }
    const st = { t: 0, pitch: 0 };
    // o: the heading on the screen, where the eight feet stand about the body, how far it is crouched,
    // how high it has jumped, and how far the face is lifted towards whoever is looking down at it
    function step(dt, o) {
      st.t += dt;
      st.pitch += (o.pitch - st.pitch) * Math.min(1, dt * 7);
      root.rotation.y = -o.a;
      bodyG.position.set(0, 0.14 - o.crouch * 0.17 + o.lift + Math.sin(st.t * 2.1) * 0.008, 0);
      bodyG.rotation.set(0, 0, st.pitch);
      waist.rotation.z = -st.pitch * 0.8 + Math.sin(st.t * 1.4) * 0.025 - o.lift * 0.08;
      palps.forEach((q, i) => {
        q.rotation.z = Math.sin(st.t * 5 + i * Math.PI) * 0.1 - 0.05;
      });
      const air = clamp(o.lift * 6, 0, 1);
      for (const L of legs) {
        const f = o.feet[(L.sz > 0 ? 0 : 4) + L.k];
        L.foot.set(f[0], lerp(0.02, bodyG.position.y - 0.05, air), f[1]);
      }
      pose();
    }
    pose();
    return { step };
  }

  const N = 512,
    canvas = document.createElement('canvas');
  const renderer = new T3.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(N, N, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T3.SRGBColorSpace;
  renderer.toneMapping = T3.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T3.PCFSoftShadowMap;
  // what the shiny parts reflect: a dim room with a soft light above, one to the side and a green glow from below
  const room = new T3.Scene();
  room.background = new T3.Color('#0c1a1b');
  const panel = (w, h, col, pos) => {
    const m = new T3.Mesh(new T3.PlaneGeometry(w, h), new T3.MeshBasicMaterial({ color: col, side: T3.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    room.add(m);
  };
  panel(16, 16, new T3.Color(2.6, 2.6, 2.4), V(-4, 14, -6));
  panel(8, 12, new T3.Color(1, 1.25, 1.5), V(14, 5, 3));
  panel(30, 30, new T3.Color(0.12, 0.3, 0.26), V(0, -10, 0));
  const pm = new T3.PMREMGenerator(renderer),
    env = pm.fromScene(room, 0.03).texture;
  pm.dispose();
  // a world for each: the light comes from the upper left of the screen, as the pond's does; the ground only takes the shadow
  function world(ext, shade) {
    const scene = new T3.Scene();
    scene.environment = env;
    const key = new T3.DirectionalLight('#fff4e2', 1.9);
    key.position.set(-5, 11, -6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.radius = 4;
    Object.assign(key.shadow.camera, { left: -ext * 1.4, right: ext * 1.4, top: ext * 1.4, bottom: -ext * 1.4, near: 1, far: 40 });
    scene.add(key);
    scene.add(new T3.HemisphereLight('#cfe6ff', '#1c3a30', 0.6));
    const rim = new T3.DirectionalLight('#7fe6d0', 0.6);
    rim.position.set(7, 4, 6);
    scene.add(rim);
    const ground = new T3.Mesh(new T3.PlaneGeometry(ext * 4, ext * 4), new T3.ShadowMaterial({ opacity: shade }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const camera = new T3.OrthographicCamera(-ext, ext, ext, -ext, 0.1, 60);
    camera.position.set(0, 30, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    return { scene, camera, key, ground };
  }
  const DOVE = 4,
    SPIDER = 2.7,
    dw = world(DOVE, 0.42),
    sw = world(SPIDER, 0.4),
    bird = makeDove(dw.scene),
    jumper = makeSpider(sw.scene),
    warm = new T3.Color();
  // Each look dresses the two its own way, by swapping materials once when the look changes (nothing
  // more a frame): ink a flat wash, ukiyo-e flat bands of colour, glow a lit silhouette, blueprint a
  // wire drawing, ASCII a pale shape the page sets like type. The water keeps them as they are.
  const DRESS = {
      ink: new T3.MeshBasicMaterial({ color: '#221e1a' }),
      glow: new T3.MeshBasicMaterial({ color: '#4ff5e6' }),
      blueprint: new T3.MeshBasicMaterial({ color: '#e8f3ff', wireframe: true }),
      ascii: new T3.MeshBasicMaterial({ color: '#cfe6df' })
    },
    toon = new Map();
  function dress(name) {
    for (const w of [dw, sw]) {
      w.scene.overrideMaterial = DRESS[name] || null;
      w.ground.visible = !DRESS[name];
      w.scene.traverse((o) => {
        if (!o.isMesh || o === w.ground) return;
        o.userData.orig ??= o.material;
        const m = o.userData.orig;
        if (name !== 'ukiyo' || Array.isArray(m)) o.material = m;
        else {
          if (!toon.has(m)) toon.set(m, new T3.MeshToonMaterial({ color: m.color ? m.color.clone() : 0xffffff, map: m.map || null }));
          o.material = toon.get(m);
        }
      });
    }
  }
  return {
    canvas,
    size: N,
    DOVE,
    SPIDER,
    dress,
    // each draws its creature into the picture; whoever asked lays the picture into the pond straight after
    dove(dt, o) {
      bird.step(dt, o);
      dw.ground.material.opacity = 0.42 * (1 - clamp(o.h * 4, 0, 1));
      renderer.toneMappingExposure = 0.95 * (0.3 + 0.7 * o.amb);
      dw.key.color.set('#fff4e2').multiply(warm.setRGB(lerp(1, o.tint[0], 0.5), lerp(1, o.tint[1], 0.5), lerp(1, o.tint[2], 0.5)));
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, N, N);
      renderer.render(dw.scene, dw.camera);
    },
    spider(dt, o) {
      jumper.step(dt, o);
      renderer.toneMappingExposure = 0.95;
      renderer.setViewport(0, 0, N / 2, N / 2);
      renderer.setScissor(0, 0, N / 2, N / 2);
      renderer.setScissorTest(true);
      renderer.render(sw.scene, sw.camera);
    }
  };
}
