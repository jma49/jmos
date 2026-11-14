// @ts-nocheck (a scratch tool: see docs/agents/pond-handoff.md)
const { chromium } = require('playwright');
const fs = require('fs');
// The pebble bed drawn once, for the still pond (.nogl in pond.css): BED from engine.js, rendered at a wide
// pond's stone size with the day's water over it, written as a PNG to convert to webp (quality 60):
//   node tools/pond/bed-still.cjs out.png
(async () => {
  const src = fs.readFileSync(require('node:path').join(__dirname, '../../src/pond/engine.js'), 'utf8'),
    at = src.indexOf('const BED = `') + 13,
    frag = src.slice(at, src.indexOf('}`;', at) + 1);
  const b = await chromium.launch();
  const p = await b.newPage();
  const W = 1600,
    H = 1000;
  const url = await p.evaluate(
    async ({ frag, W, H }) => {
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true });
      const sh = (t, src) => {
        const s = gl.createShader(t);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s);
        return s;
      };
      const pr = gl.createProgram();
      gl.attachShader(
        pr,
        sh(gl.VERTEX_SHADER, '#version 300 es\nin vec2 a; out vec2 vUv; void main(){ vUv=vec2(a.x*.5+.5,.5-a.y*.5); gl_Position=vec4(a,0.,1.); }')
      );
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(pr, 0, 'a');
      gl.linkProgram(pr);
      gl.useProgram(pr);
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(gl.getUniformLocation(pr, 'uRes'), W, H);
      gl.uniform1f(gl.getUniformLocation(pr, 'uStone'), 132);
      gl.viewport(0, 0, W, H);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // the water over it, as by day: a cool green tint, a little softness, a vignette
      const out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      const c = out.getContext('2d');
      c.filter = 'blur(1.2px) saturate(0.85)';
      c.drawImage(cv, 0, 0);
      c.filter = 'none';
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = 'rgb(199,240,224)';
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'source-over';
      const g = c.createRadialGradient(W * 0.55, H * 0.45, H * 0.2, W * 0.5, H * 0.5, H * 0.95);
      g.addColorStop(0, 'rgba(4,20,22,0)');
      g.addColorStop(1, 'rgba(4,20,22,.55)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      return out.toDataURL('image/png');
    },
    { frag, W, H }
  );
  fs.writeFileSync(process.argv[2] || 'bed-still.png', Buffer.from(url.split(',')[1], 'base64'));
  await b.close();
})();
