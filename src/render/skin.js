/**
 * Draw a character as a skinned mesh instead of a stack of cut-out pieces.
 *
 * The cut-out renderer draws each part as its own quad on its own transform.
 * Two pieces that meet at a joint are two separate drawings, so when the joint
 * bends they come apart -- which is why the punching arm read as a floating
 * sleeve with a glove on the end and a gap at the shoulder. Nothing in the
 * animation layer can close a gap between two independent quads.
 *
 * Here the whole illustration is one texture under one mesh. Every vertex is
 * bound to the bones near it, and its position is the weighted blend of what
 * those bones would each do to it, so the geometry at a joint belongs to both
 * bones and bends across them. There are no pieces to detach.
 *
 * The bone matrices are the ones the existing rig already solves -- the same
 * numbers the hitboxes ride on -- so the simulation does not change at all.
 * What changes is only how the result is drawn.
 *
 * It renders to its own WebGL canvas and composites that into the 2D stage in
 * one `drawImage`, reading the live transform off the 2D context so the camera
 * and the mirrored reflection pass come along for free.
 */

const VERT = `
attribute vec2 aPos;
attribute vec4 aBone;
attribute vec4 aWeight;
uniform mat3 uBones[24];
uniform mat3 uView;
uniform vec2 uTexSize;
varying vec2 vUV;
void main() {
  vec3 p = vec3(aPos, 1.0);
  vec2 skinned =
      aWeight.x * (uBones[int(aBone.x)] * p).xy
    + aWeight.y * (uBones[int(aBone.y)] * p).xy
    + aWeight.z * (uBones[int(aBone.z)] * p).xy
    + aWeight.w * (uBones[int(aBone.w)] * p).xy;
  vec3 d = uView * vec3(skinned, 1.0);
  gl_Position = vec4(d.xy, 0.0, 1.0);
  vUV = aPos / uTexSize;
}`;

const FRAG = `
precision mediump float;
uniform sampler2D uTex;
uniform float uAlpha;
varying vec2 vUV;
void main() {
  vec4 c = texture2D(uTex, vUV);
  if (c.a < 0.004) discard;
  gl_FragColor = vec4(c.rgb, c.a * uAlpha);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

export class Skinner {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2; this.canvas.height = 2;
    this.gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
    this.ok = !!this.gl;
    /**
     * A software GL implementation rasterises on the CPU, and a skinned mesh
     * is far more work per pixel than blitting a dozen quads -- measured in a
     * container with no GPU at all, this path ran at 24fps where the cut-out
     * path ran at 60. Machines with a real GPU are the other way round and it
     * is not close. So the renderer is chosen by what is actually underneath
     * rather than by hoping, and anything software-rasterised keeps the
     * cut-out path. `?skin=force` overrides, which is how the test suite
     * exercises this code on a machine that would otherwise never run it.
     */
    if (this.ok) {
      const forced = typeof location !== 'undefined' && /\bskin=force\b/.test(location.search);
      const dbg = this.gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(dbg ? this.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '');
      this.renderer = name;
      this.software = /swiftshader|llvmpipe|software|basic render/i.test(name);
      if (this.software && !forced) this.ok = false;
    }
    if (!this.ok) return;
    const gl = this.gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    this.loc = {
      aPos: gl.getAttribLocation(prog, 'aPos'),
      aBone: gl.getAttribLocation(prog, 'aBone'),
      aWeight: gl.getAttribLocation(prog, 'aWeight'),
      uBones: gl.getUniformLocation(prog, 'uBones'),
      uView: gl.getUniformLocation(prog, 'uView'),
      uTexSize: gl.getUniformLocation(prog, 'uTexSize'),
      uTex: gl.getUniformLocation(prog, 'uTex'),
      uAlpha: gl.getUniformLocation(prog, 'uAlpha'),
    };
    this.built = new Map();
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** Buffers and texture for one mesh, built once and kept. */
  prepare(id, mesh, image) {
    if (!this.ok || this.built.has(id)) return this.built.get(id);
    const gl = this.gl;
    const n = mesh.verts.length;
    const pos = new Float32Array(n * 2);
    const bone = new Float32Array(n * 4);
    const weight = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      pos[i * 2] = mesh.verts[i][0];
      pos[i * 2 + 1] = mesh.verts[i][1];
      const ws = mesh.weights[i];
      for (let k = 0; k < 4; k++) {
        bone[i * 4 + k] = ws[k] ? ws[k][0] : 0;
        weight[i * 4 + k] = ws[k] ? ws[k][1] : 0;
      }
    }
    const idx = new Uint16Array(mesh.tris.length * 3);
    mesh.tris.forEach((t, i) => { idx[i * 3] = t[0]; idx[i * 3 + 1] = t[1]; idx[i * 3 + 2] = t[2]; });

    const buf = (data, target = gl.ARRAY_BUFFER) => {
      const b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return b;
    };
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    const entry = {
      pos: buf(pos), bone: buf(bone), weight: buf(weight),
      idx: buf(idx, gl.ELEMENT_ARRAY_BUFFER), count: idx.length,
      tex, size: mesh.size, order: mesh.bones.map((b) => b.name), pivots: mesh.bones.map((b) => b.pivot),
    };
    this.built.set(id, entry);
    return entry;
  }

  /**
   * @param ctx    the 2D stage context, with its camera transform applied.
   * @param items  [{ id, mesh, image, matrices, alpha }] -- `matrices` is what
   *               Rig.solve returned, keyed by part name.
   */
  draw(ctx, items) {
    if (!this.ok || !items.length) return false;
    const gl = this.gl;
    const target = ctx.canvas;
    if (this.canvas.width !== target.width || this.canvas.height !== target.height) {
      this.canvas.width = target.width;
      this.canvas.height = target.height;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    // Only the pixels a character can possibly cover are composited back.
    // Handing the whole canvas to drawImage three times a frame -- once for
    // the reflections and once per fighter -- cost two thirds of the frame
    // rate on its own: 24fps, against 60 for the cut-out path it replaced.
    let dirty = null;

    // The 2D context already holds the camera, the device pixel ratio and, on
    // the reflection pass, the flip about the floor. Reading it here instead
    // of recomputing it is what keeps those three things from drifting.
    const t = ctx.getTransform();
    const W = this.canvas.width;
    const H = this.canvas.height;
    // device pixels -> clip space, composed with the 2D transform
    const view = new Float32Array([
      (2 * t.a) / W, (-2 * t.b) / H, 0,
      (2 * t.c) / W, (-2 * t.d) / H, 0,
      (2 * t.e) / W - 1, 1 - (2 * t.f) / H, 1,
    ]);
    gl.uniformMatrix3fv(this.loc.uView, false, view);

    for (const item of items) {
      const e = this.prepare(item.id, item.mesh, item.image);
      if (!e) continue;
      const bones = new Float32Array(24 * 9);
      for (let i = 0; i < e.order.length && i < 24; i++) {
        const m = item.matrices[e.order[i]];
        const [px, py] = e.pivots[i];
        if (!m) { bones[i * 9] = 1; bones[i * 9 + 4] = 1; bones[i * 9 + 8] = 1; continue; }
        const [a, b, c, d, ex, f] = m;
        // world_i composed with a translation by -pivot, so a vertex given in
        // the illustration's own pixels lands where that bone puts it.
        bones[i * 9 + 0] = a; bones[i * 9 + 1] = b; bones[i * 9 + 2] = 0;
        bones[i * 9 + 3] = c; bones[i * 9 + 4] = d; bones[i * 9 + 5] = 0;
        bones[i * 9 + 6] = ex - a * px - c * py;
        bones[i * 9 + 7] = f - b * px - d * py;
        bones[i * 9 + 8] = 1;
      }
      gl.uniformMatrix3fv(this.loc.uBones, false, bones);
      gl.uniform2f(this.loc.uTexSize, e.size[0], e.size[1]);
      gl.uniform1f(this.loc.uAlpha, item.alpha ?? 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, e.tex);
      gl.uniform1i(this.loc.uTex, 0);
      for (const [loc, b, size] of [[this.loc.aPos, e.pos, 2], [this.loc.aBone, e.bone, 4], [this.loc.aWeight, e.weight, 4]]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, e.idx);
      gl.drawElements(gl.TRIANGLES, e.count, gl.UNSIGNED_SHORT, 0);

      // Where this character landed, in device pixels: every bone's transform
      // applied to the illustration's own corners, which bounds any vertex
      // those bones can move, then through the 2D transform.
      const [tw, th] = e.size;
      for (let i = 0; i < e.order.length && i < 24; i++) {
        const m = item.matrices[e.order[i]];
        if (!m) continue;
        const [px, py] = e.pivots[i];
        const [a, b, c, d, ex, f] = m;
        for (const [cx, cy] of [[0, 0], [tw, 0], [0, th], [tw, th]]) {
          const wx = a * (cx - px) + c * (cy - py) + ex;
          const wy = b * (cx - px) + d * (cy - py) + f;
          const dx = t.a * wx + t.c * wy + t.e;
          const dy = t.b * wx + t.d * wy + t.f;
          dirty = dirty
            ? [Math.min(dirty[0], dx), Math.min(dirty[1], dy), Math.max(dirty[2], dx), Math.max(dirty[3], dy)]
            : [dx, dy, dx, dy];
        }
      }
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (dirty) {
      const x0 = Math.max(0, Math.floor(dirty[0]) - 2);
      const y0 = Math.max(0, Math.floor(dirty[1]) - 2);
      const x1 = Math.min(W, Math.ceil(dirty[2]) + 2);
      const y1 = Math.min(H, Math.ceil(dirty[3]) + 2);
      if (x1 > x0 && y1 > y0) ctx.drawImage(this.canvas, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    }
    ctx.restore();
    return true;
  }
}
