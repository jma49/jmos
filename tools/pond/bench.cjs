// @ts-nocheck (a scratch tool kept from the session: see docs/agents/pond-handoff.md)
// The water shader alone, old (A) and new (B), drawn into 960x600 with the same uniforms, timed with finish()
const { chromium } = require('playwright');
const src = require('./fs.json'); // made from engine.js's FS: see the handoff
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  const out = await p.evaluate((src) => {
    const c = document.createElement('canvas'),
      gl = c.getContext('webgl2');
    const sh = (t, s) => {
      const x = gl.createShader(t);
      gl.shaderSource(x, s);
      gl.compileShader(x);
      if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(x);
      return x;
    };
    const prog = (fs) => {
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, src.VS));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(pr, 0, 'a');
      gl.linkProgram(pr);
      return pr;
    };
    const P = { A: prog(src.A), B: prog(src.B), L: prog(src.LOOK), W: prog(src.WATER) };
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (let u = 0; u < 10; u++) {
      gl.activeTexture(gl.TEXTURE0 + u);
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(16).fill(90));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    const W = 960,
      H = 600,
      tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, W, H);
    const set = (pr, cfg) => {
      gl.useProgram(pr);
      const L = (n) => gl.getUniformLocation(pr, n);
      ['uBed', 'uH', 'uFish', 'uPads', 'uTop', 'uIceN', 'uAtlas'].forEach((n, i) => gl.uniform1i(L(n), i));
      gl.uniform2f(L('uRes'), W, H);
      gl.uniform2f(L('uCss'), W / 1.5, H / 1.5);
      gl.uniform2f(L('uGrid'), 232, 145);
      gl.uniform1f(L('uTime'), 12.3);
      gl.uniform1f(L('uSwell'), 1);
      gl.uniform1f(L('uAmb'), 1);
      gl.uniform1f(L('uCaI'), 1);
      gl.uniform3f(L('uCaC'), 1, 1, 1);
      gl.uniform3f(L('uTint'), 1, 1, 1);
      gl.uniform3f(L('uSeason'), 1, 1, 1);
      gl.uniform3f(L('uSky'), 0.5, 0.6, 0.7);
      gl.uniform2f(L('uMoonPos'), 0.6, 0.1);
      gl.uniform1f(L('uGlint'), 1);
      gl.uniform1f(L('uFocus'), 1);
      gl.uniform1i(L('uStyle'), cfg.s);
      gl.uniform1i(L('uPrev'), cfg.s);
      gl.uniform4f(L('uInk'), cfg.s ? 2000 : 0, 300, 200, cfg.s ? 1 : 0);
      gl.uniform2f(L('uCalm'), 0, 1);
    };
    const res = {},
      px = new Uint8Array(4);
    for (const [name, cfg] of [
      ['water', { s: 0 }],
      ['ink', { s: 1 }],
      ['ukiyo', { s: 2 }],
      ['ascii', { s: 5 }]
    ]) {
      const t = { A: [], B: [], V: [] };
      const V = cfg.s ? 'L' : 'W';
      for (let r = 0; r < 4; r++)
        for (const k of ['A', 'B', 'V']) {
          set(P[k === 'V' ? V : k], cfg);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          const a = performance.now();
          for (let i = 0; i < 4; i++) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          t[k].push((performance.now() - a) / 4);
        }
      const med = (v) => v.sort((x, y) => x - y)[v.length >> 1];
      res[name] = { old: +med(t.A).toFixed(1), new: +med(t.B).toFixed(1), variant: +med(t.V).toFixed(1) };
    }
    return res;
  }, src);
  for (const [k, v] of Object.entries(out))
    console.log(
      k.padEnd(6),
      'old',
      v.old,
      'ms  whole',
      v.new,
      `ms (${(((v.new - v.old) / v.old) * 100).toFixed(0)}%)  variant`,
      v.variant,
      `ms (${(((v.variant - v.old) / v.old) * 100).toFixed(0)}%)`
    );
  await b.close();
})();
