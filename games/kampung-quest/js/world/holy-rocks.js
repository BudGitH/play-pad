/* ============================================================================
 * FILE: holy-rocks.js
 * PURPOSE: Rocky mountains and boulders for the Haramain world (KQ.WorldParts.HolyRocks):
 *          Jabal-style brown granite massifs (a ridged-noise cone with strata bands, per-vertex
 *          colour that fades to sand at the foot, UVs for the CC0 rock photo) and small scattered
 *          boulders. Instanced: three mountain shapes, one boulder shape.
 * BUSINESS CONTEXT: owner feedback "rocky mountains (Jabal-style hills around the city)": the old
 *   hills were flat-shaded lumpy cones with no texture.
 * DEPENDENCIES: geo.js (instanced, cached, rng), holy-kit.js (material `rock`).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const TAU = Math.PI * 2;
  const SAND = [0.78, 0.66, 0.5];
  /** Photo repeats around the base and up the slope. */
  const REPEAT = [16, 5];

  /** Hash of a lattice point to 0..1. */
  function hash(i, j, k, seed) {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /** Smooth 3D value noise in 0..1. */
  function noise3(x, y, z, seed) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const f = (t) => t * t * (3 - 2 * t);
    const fx = f(x - xi);
    const fy = f(y - yi);
    const fz = f(z - zi);
    const lerp = (a, b, t) => a + (b - a) * t;
    const at = (a, b, c) => hash(xi + a, yi + b, zi + c, seed);
    const face = (c) =>
      lerp(lerp(at(0, 0, c), at(1, 0, c), fx), lerp(at(0, 1, c), at(1, 1, c), fx), fy);
    return lerp(face(0), face(1), fz);
  }

  /** Two octaves of noise around a circle at height y (so the seam closes). */
  function ridge(a, y, seed) {
    const cx = Math.cos(a);
    const cz = Math.sin(a);
    const n1 = noise3(cx * 1.6 + 7, y * 2.2, cz * 1.6 + 7, seed);
    const n2 = noise3(cx * 4.1 + 3, y * 5.3, cz * 4.1 + 3, seed + 91);
    return { n1, n2, rid: 1 - Math.abs(2 * n2 - 1) };
  }

  /** Vertex colour of a slope point: strata bands, vertical streaks, darker crests, sand at the foot. */
  function slopeColour(y, q, band) {
    const strata = 0.5 + 0.5 * Math.sin(y * 34 + q.n1 * 6);
    const k = 0.78 + 0.3 * strata + 0.28 * q.rid - 0.18 * band;
    const warm = 0.7 + 0.3 * y;
    const c = [k * 1.5 * warm, k * 1.16 * warm, k * 0.9];
    const foot = 1 - Math.min(1, y / 0.16);
    return c.map((v, i) => (v * (1 - foot * 0.85) + SAND[i] * foot * 0.85) * 1.55);
  }

  /** One displaced, textured mountain of unit radius and height (translate/scale per instance). */
  function mountainGeo(seed) {
    return P.cached("holyMountain" + seed, () => {
      const g = new THREE.ConeGeometry(1, 1, 36, 14, true);
      g.translate(0, 0.5, 0);
      const pos = g.attributes.position;
      const uv = g.attributes.uv;
      const col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i += 1) {
        const y = pos.getY(i);
        const a = Math.atan2(pos.getZ(i), pos.getX(i));
        const q = ridge(a, y, seed * 17);
        const rad = (1 - y) * (0.5 + 0.42 * q.n1 + 0.12 * q.rid);
        const peak = y * (0.62 + 0.55 * q.n1 + 0.22 * q.rid);
        pos.setXYZ(
          i,
          Math.cos(a) * rad,
          peak + Math.sin(y * 40 + q.n1 * 5) * 0.012,
          Math.sin(a) * rad,
        );
        uv.setXY(i, uv.getX(i) * REPEAT[0], uv.getY(i) * REPEAT[1]);
        col.set(slopeColour(y, q, (1 - y) * q.n2), i * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      return g;
    });
  }

  /** Instanced mountains: list of { x, z, w, h, seed 1..3 }; one InstancedMesh per shape. */
  function mountains(group, mats, list) {
    [1, 2, 3].forEach((seed) => {
      const mine = list.filter((h) => h.seed === seed);
      if (!mine.length) return;
      const items = mine.map((h) => ({
        x: h.x,
        y: -1.5,
        z: h.z,
        ry: h.ry !== undefined ? h.ry : seed * 1.7 + h.x * 0.013,
        sx: h.w,
        sy: h.h,
        sz: h.w,
      }));
      const im = P.instanced(mountainGeo(seed), mats.rock, items, { cast: false });
      im.name = "holyHills" + seed;
      group.add(im);
    });
  }

  /** A small boulder: a rough icosahedron with a sandy foot. */
  function boulderGeo() {
    return P.cached("holyBoulder", () => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const pos = g.attributes.position;
      const col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i += 1) {
        const n = noise3(pos.getX(i) * 1.7 + 4, pos.getY(i) * 1.7, pos.getZ(i) * 1.7 + 4, 5);
        const k = 0.75 + 0.5 * n;
        pos.setXYZ(i, pos.getX(i) * k, Math.max(pos.getY(i), -0.25) * k * 0.8, pos.getZ(i) * k);
        const shade = (0.8 + 0.5 * n) * 1.5;
        col.set([shade * 1.15, shade * 0.9, shade * 0.7], i * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      return g;
    });
  }

  /** Boulders: list of { x, z, s, ry }. Returns the InstancedMesh. */
  function boulders(group, mats, list) {
    const items = list.map((b) => ({
      x: b.x,
      y: 0.05,
      z: b.z,
      ry: b.ry || 0,
      sx: b.s * 1.3,
      sy: b.s,
      sz: b.s,
    }));
    const im = P.instanced(boulderGeo(), mats.rock, items, { cast: true });
    im.name = "holyBoulders";
    group.add(im);
    return im;
  }

  P.HolyRocks = { mountains, boulders, noise3, TAU };
})((window.KQ = window.KQ || {}));
