/* ============================================================================
 * FILE: holy-ground.js
 * PURPOSE: The ground of the Haramain cities (KQ.WorldParts.HolyGround): the photo desert sand
 *          under everything, soft-edged patches of dust and darker compacted earth over it (one
 *          merged mesh with per-vertex alpha), and the streets: asphalt with a dashed centre
 *          line, solid edge lines, zebra crossings, concrete kerbs, limestone footways and a
 *          dusty verge where the pavement meets the sand.
 * BUSINESS CONTEXT: owner feedback "actual textures on the environment, Makkah outskirts more
 *   like the real thing". The old ground was one tinted concrete slab and bare asphalt strips.
 * DEPENDENCIES: geo.js (Batch, rng), holy-kit.js (materials `sand`, `dust`).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const TAU = Math.PI * 2;
  const RING = 18;
  const DUST_UV = 3.4;
  const KERB = 0.28;

  /** The big photo sand slab under a city: x0..x1, z0..z1 (top at y = 0). */
  function sand(c, b) {
    c.B.aabb("sand", b.x0, -0.4, b.z0, b.x1, 0, b.z1, 0xffffff);
  }

  /** One street: asphalt, kerbs, limestone footways, a dusty verge, edge lines and a dashed centre line. */
  function road(c, r) {
    const B = c.B;
    const h = r.w / 2;
    const run = (a0, a1, b0, b1, key, y1, col) => {
      if (r.axis === "x") B.aabb(key, a0, 0, b0, a1, y1, b1, col);
      else B.aabb(key, b0, 0, a0, b1, y1, a1, col);
    };
    run(r.from, r.to, r.at - h, r.at + h, "asphalt", 0.04, 0xffffff);
    [-1, 1].forEach((s) => {
      const edge = r.at + s * h;
      const lo = Math.min(edge, edge + s * KERB);
      run(r.from, r.to, lo, lo + KERB, "concrete", 0.16, 0xd2cab8);
      const a = s < 0 ? edge - 3.5 : edge + KERB;
      run(r.from, r.to, a, a + 3.5 - KERB, "limestone", 0.12, 0xece1c9);
    });
    lines(c, r);
  }

  /** Dashed centre line, solid edge lines. */
  function lines(c, r) {
    const B = c.B;
    const h = r.w / 2;
    const x = r.axis === "x";
    for (let t = r.from + 4; t < r.to - 4; t += 9) {
      B.decal(
        "marking",
        x ? t : r.at,
        0.05,
        x ? r.at : t,
        x ? 3.5 : 0.25,
        x ? 0.25 : 3.5,
        0,
        0xf2f0e6,
      );
    }
    [-1, 1].forEach((s) => {
      const mid = (r.from + r.to) / 2;
      const len = r.to - r.from - 2;
      const off = r.at + s * (h - 0.45);
      B.decal(
        "marking",
        x ? mid : off,
        0.05,
        x ? off : mid,
        x ? len : 0.16,
        x ? 0.16 : len,
        0,
        0xe9e6da,
      );
    });
  }

  /** Zebra crossing stripes across street `r` at position `t` along it. */
  function zebra(c, r, t) {
    const h = r.w / 2;
    for (let k = 0.9; k < r.w - 0.5; k += 1.1) {
      const across = r.at - h + k;
      const x = r.axis === "x";
      c.B.decal(
        "marking",
        x ? t : across,
        0.055,
        x ? across : t,
        x ? 0.5 : 0.5,
        x ? 0.5 : 0.5,
        0,
        0xf4f2e8,
      );
      c.B.decal(
        "marking",
        x ? t - 1 : across,
        0.055,
        x ? across : t - 1,
        x ? 2 : 0.5,
        x ? 0.5 : 2,
        0,
        0xf4f2e8,
      );
    }
  }

  /** Dust and compacted-earth patches: [{x, z, rx, rz, rot, rgb, a}], seeded and spread over a rectangle. */
  function patches(b, seed, n) {
    const r = P.rng(seed);
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const dark = r() < 0.45;
      out.push({
        x: b.x0 + r() * (b.x1 - b.x0),
        z: b.z0 + r() * (b.z1 - b.z0),
        rx: 8 + r() * 26,
        rz: 6 + r() * 18,
        rot: r() * Math.PI,
        rgb: dark ? [1.05, 0.95, 0.85] : [1.7, 1.62, 1.5],
        a: dark ? 0.5 : 0.55,
      });
    }
    return out;
  }

  /** Push one patch (a centre vertex and two rings, alpha fading to 0 at the rim) into the arrays. */
  function addPatch(g, p, rnd) {
    const base = g.pos.length / 3;
    const put = (x, z, a) => {
      g.pos.push(x, 0.015, z);
      g.uv.push(x / DUST_UV, z / DUST_UV);
      g.col.push(p.rgb[0], p.rgb[1], p.rgb[2], a);
    };
    put(p.x, p.z, p.a);
    const cs = Math.cos(p.rot);
    const sn = Math.sin(p.rot);
    [0.55, 1].forEach((k, ring) => {
      for (let i = 0; i < RING; i += 1) {
        const a = (i / RING) * TAU;
        const wob = 1 + (rnd() - 0.5) * 0.35;
        const lx = Math.cos(a) * p.rx * k * wob;
        const lz = Math.sin(a) * p.rz * k * wob;
        put(p.x + lx * cs - lz * sn, p.z + lx * sn + lz * cs, ring === 0 ? p.a * 0.85 : 0);
      }
    });
    for (let i = 0; i < RING; i += 1) {
      const n = (i + 1) % RING;
      g.idx.push(base, base + 1 + n, base + 1 + i);
      g.idx.push(base + 1 + i, base + 1 + n, base + 1 + RING + i);
      g.idx.push(base + 1 + n, base + 1 + RING + n, base + 1 + RING + i);
    }
  }

  /** Merge the patches into one transparent mesh (one draw call) with the dust material. */
  function dust(group, mat, list) {
    const g = { pos: [], uv: [], col: [], idx: [] };
    const rnd = P.rng(4242);
    list.forEach((p) => addPatch(g, p, rnd));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(g.col, 4));
    geo.setIndex(g.idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = "holyDust";
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    group.add(mesh);
    return mesh;
  }

  P.HolyGround = { sand, road, zebra, patches, dust };
})((window.KQ = window.KQ || {}));
