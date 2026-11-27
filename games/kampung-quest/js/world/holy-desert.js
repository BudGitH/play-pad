/* ============================================================================
 * FILE: holy-desert.js
 * PURPOSE: Desert dressing for the Haramain cities (KQ.WorldParts.HolyDesert): scattered dry scrub
 *          (instanced), boulders (instanced, with a collider when big enough to block), and a
 *          sample helper that keeps all of it off roads, plazas, buildings and the paths.
 * BUSINESS CONTEXT: owner feedback "Makkah outside the Haram: desert ground, rocky hills, date
 *   palms": bare sand reads as a flat sheet; scrub and stones give it scale and life.
 * DEPENDENCIES: holy-lots.js (free-lot test), holy-rocks.js (boulders), geo.js (instanced, rng).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const K = () => P.HolyKit;
  const TAU_HALF = Math.PI;

  /** A dry shrub: three flattened lumps in olive / khaki, vertex coloured. */
  function scrubGeo() {
    return P.cached("holyScrub", () => {
      const parts = [
        [0, 0.28, 0, 0.55, 0.32, 0.5, 0x7d8a4a],
        [0.35, 0.2, 0.15, 0.38, 0.22, 0.34, 0x9a9a5a],
        [-0.3, 0.18, -0.2, 0.36, 0.2, 0.32, 0x6f7f40],
      ].map(([x, y, z, sx, sy, sz, hex]) => {
        const g = new THREE.IcosahedronGeometry(1, 0).scale(sx, sy, sz).translate(x, y, z);
        return P.HolyKit.tint(g, hex);
      });
      return mergeFlat(parts);
    });
  }

  /** Merge non-indexed geometries with position + color. */
  function mergeFlat(list) {
    const pos = [];
    const col = [];
    list.forEach((g) => {
      pos.push(...g.attributes.position.array);
      col.push(...g.attributes.color.array);
    });
    const m = new THREE.BufferGeometry();
    m.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    m.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    m.computeVertexNormals();
    return m;
  }

  /** Dry shrubs: list of { x, z, s } as one InstancedMesh. */
  function scrub(group, mats, list) {
    const items = list.map((s, i) => ({
      x: s.x,
      y: 0,
      z: s.z,
      ry: i * 1.3,
      sx: s.s,
      sy: s.s,
      sz: s.s,
    }));
    const mat =
      mats.scrubMat ||
      (mats.scrubMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    const im = P.instanced(scrubGeo(), mat, items, { cast: false });
    im.name = "holyScrub";
    group.add(im);
    return im;
  }

  /** Is (x, z) away from the holy-site discs of the Hajj sector (Mina, Muzdalifah, Arafah, Jamarat)? */
  function awayFromSites(x, z) {
    const h = KQ.HOLY.hajj;
    const sites = [
      [h.mina, 46],
      [h.muzdalifah, 30],
      [h.arafah, 40],
      [h.jamarat, 28],
    ];
    return sites.every(([s, r]) => Math.hypot(x - s.x, z - s.z) > r);
  }

  /** Draw `n` points from rectangle `b` through `ok(x, z)` with a seeded generator. */
  function sample(b, n, seed, ok) {
    const r = P.rng(seed);
    const out = [];
    for (let i = 0; i < n * 4 && out.length < n; i += 1) {
      const x = b.x0 + r() * (b.x1 - b.x0);
      const z = b.z0 + r() * (b.z1 - b.z0);
      if (ok(x, z)) out.push({ x, z, s: 0.5 + r() * 0.9, ry: r() * TAU_HALF });
    }
    return out;
  }

  /**
   * Scatter shrubs and boulders over a city's play bounds `b` and the desert ring outside it.
   * `free` is the city's lot test (holy-lots.js). Boulders in the play area get colliders.
   */
  function dress(c, group, mats, free, b, seed) {
    const inBounds = (x, z) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
    const lot = (x, z, m) => free(x - m, z - m, x + m, z + m, 1.5);
    const open = (x, z, m) => free.open(x - m, z - m, x + m, z + m, 1);
    const wide = { x0: b.x0 - 90, z0: b.z0 - 70, x1: b.x1 + 90, z1: b.z1 + 70 };
    const sc = sample(wide, 190, seed, (x, z) =>
      inBounds(x, z) ? open(x, z, 1) && awayFromSites(x, z) : true,
    );
    const bo = sample(wide, 90, seed + 1, (x, z) =>
      inBounds(x, z) ? lot(x, z, 1.4) && awayFromSites(x, z) : true,
    );
    scrub(group, mats, sc);
    P.HolyRocks.boulders(
      group,
      mats,
      bo.map((p) => Object.assign(p, { s: 0.5 + p.s * 0.9 })),
    );
    bo.forEach((p) => {
      if (inBounds(p.x, p.z) && p.s > 0.7)
        K().solid(c.colliders, p.x - p.s, p.z - p.s, p.x + p.s, p.z + p.s, "rock");
    });
    return { scrub: sc.length, boulders: bo.length };
  }

  P.HolyDesert = { dress, scrub, sample, awayFromSites };
})((window.KQ = window.KQ || {}));
