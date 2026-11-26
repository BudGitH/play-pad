/* Kampung Quest — the mosque, part 4 (KQ.WorldParts.MosqueInside): carpeted prayer hall
   (rows run parallel to the qibla wall), qibla wall with a tiled dado and the mihrab niche,
   a wooden minbar, four marble columns, a lattice screen for the women's section, Quran
   shelves, a chandelier; then `build` assembles the whole mosque and returns its spots. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const S = () => P.MosqueShell;

  /** Carpet plane with mat rows repeating towards the qibla (−X). */
  function carpet(group, mats, h) {
    const w = h.x1 - h.x0 - 0.4;
    const d = h.z1 - h.z0 - 0.4;
    const tex = mats.carpet.map;
    tex.repeat.set(w / 1.25, d / 0.85);
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, mats.carpet);
    mesh.position.set((h.x0 + h.x1) / 2, S().PLINTH + 0.012, (h.z0 + h.z1) / 2);
    mesh.receiveShadow = true;
    mesh.name = "prayerCarpet";
    group.add(mesh);
  }

  /** Qibla wall dado, mihrab niche (tiled, projecting outside) and minbar. */
  function qibla(B, h, ctx) {
    const y = S().PLINTH;
    const xi = h.x0 + 0.19;
    B.aabb("tilework", xi, y, h.z0 + 0.4, xi + 0.03, y + 1.5, -34.3, 0xffffff);
    B.aabb("tilework", xi, y, -31.7, xi + 0.03, y + 1.5, h.z1 - 0.4, 0xffffff);
    B.aabb("tilework", h.x0 - 1.4, y, -34.3, h.x0 - 1.2, y + 4.2, -31.7, 0xffffff);
    B.aabb("tilework", h.x0 - 1.4, y, -34.3, h.x0 - 0.18, y + 4.2, -34.1, 0xffffff);
    B.aabb("tilework", h.x0 - 1.4, y, -31.9, h.x0 - 0.18, y + 4.2, -31.7, 0xffffff);
    B.aabb("plaster", h.x0 - 1.6, y, -34.6, h.x0 - 1.4, y + 4.6, -31.4, S().WALL);
    B.aabb("plaster", h.x0 - 1.6, y, -34.6, h.x0 - 0.18, y + 4.6, -34.3, S().WALL);
    B.aabb("plaster", h.x0 - 1.6, y, -31.7, h.x0 - 0.18, y + 4.6, -31.4, S().WALL);
    B.aabb("plaster", h.x0 - 1.4, y + 4.0, -34.3, h.x0 - 0.18, y + 4.6, -31.7, S().WALL);
    B.aabb("gold", xi, y + 4.0, -34.7, xi + 0.05, y + 4.15, -31.3, 0xd9b25c);
    B.aabb("marble", h.x0 - 1.2, y, -34.1, h.x0 - 0.18, y + 0.08, -31.9, 0xffffff);
    ctx.colliders.push({ minX: h.x0 - 1.7, maxX: h.x0 - 0.1, minZ: -34.7, maxZ: -31.3, kind: "mihrab" });
    minbar(B, h.x0 + 0.25, -30.2, ctx);
  }
  function minbar(B, x, z, ctx) {
    const y = S().PLINTH;
    for (let i = 0; i < 5; i++) B.aabb("wood", x + 2.4 - i * 0.45, y, z - 0.45, x + 2.4 - i * 0.45 + 0.45, y + 0.28 * (i + 1), z + 0.45, 0x7a4a26);
    B.aabb("wood", x, y, z - 0.5, x + 0.5, y + 1.6, z + 0.5, 0x6a3e1f);
    [-0.5, 0.5].forEach((dz) => B.aabb("wood", x, y + 1.6, z + dz - 0.04, x + 0.5, y + 3.2, z + dz + 0.04, 0x6a3e1f));
    B.aabb("wood", x - 0.1, y + 3.2, z - 0.6, x + 0.6, y + 3.35, z + 0.6, 0x6a3e1f);
    P.Mosque.dome(B, x + 0.25, z, y + 3.35, 0.32);
    ctx.colliders.push({ minX: x - 0.1, maxX: x + 2.9, minZ: z - 0.55, maxZ: z + 0.55, kind: "minbar" });
  }

  /** Columns, women's lattice screen, shelves and the chandelier; returns the lamp spot. */
  function furnish(B, h, m, ctx) {
    const y = S().PLINTH;
    [[-46, -40], [-38, -40], [-46, -26], [-38, -26]].forEach(([x, z]) => {
      B.cyl("marble", x, y + 3.5, z, 0.32, 7, 16, 0xffffff);
      B.cyl("gold", x, y + 6.8, z, 0.4, 0.3, 16, 0xd9b25c);
      ctx.colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, kind: "column" });
    });
    const zs = m.womenScreenZ;
    B.plane("railing", -38, y + 0.9, zs, 12, 1.8, 0, null, 0x7a4a26);
    B.aabb("wood", -44.1, y, zs - 0.05, -32, y + 0.08, zs + 0.05, 0x6a3e1f);
    ctx.colliders.push({ minX: -44.1, maxX: -32.2, minZ: zs - 0.15, maxZ: zs + 0.15, kind: "screen" });
    B.aabb("wood", h.x1 - 0.75, y, h.z0 + 1, h.x1 - 0.2, y + 1.8, h.z0 + 4, 0x6a3e1f);
    B.aabb("books", h.x1 - 0.77, y + 0.1, h.z0 + 1.05, h.x1 - 0.74, y + 1.75, h.z0 + 3.95, 0xffffff);
    ctx.colliders.push({ minX: h.x1 - 0.8, maxX: h.x1 - 0.1, minZ: h.z0 + 0.9, maxZ: h.z0 + 4.1, kind: "shelf" });
    const c = new THREE.Vector3((h.x0 + h.x1) / 2, y + 5.2, (h.z0 + h.z1) / 2);
    B.geo("gold", P.cached("ring", () => new THREE.TorusGeometry(1.2, 0.06, 8, 32)), P.compose(c.x, c.y, c.z, [Math.PI / 2, 0, 0], 1, 1, 1), 0xd9b25c);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      B.cyl("lamp", c.x + Math.cos(a) * 1.2, c.y + 0.15, c.z + Math.sin(a) * 1.2, 0.08, 0.25, 8, 0xffffff);
    }
    B.cyl("metal", c.x, c.y + 1.0, c.z, 0.02, 2.0, 6, 0xd9b25c);
    return c;
  }

  /** Assemble the mosque. Returns { taps, hallSpot, lightPos, gate }. */
  function build(B, group, mats, ctx) {
    const m = ctx.L.mosque;
    const h = m.hall;
    S().grounds(B, m);
    S().hallWalls(B, m, ctx);
    S().hallRoof(B, m);
    S().verandah(B, m, ctx);
    P.MosqueYard.compound(B, m, ctx);
    P.MosqueYard.minaret(B, m, ctx);
    P.MosqueYard.womenWudu(B, m, ctx);
    const taps = P.MosqueYard.wudu(B, m, ctx);
    carpet(group, mats, h);
    qibla(B, h, ctx);
    const lightPos = furnish(B, h, m, ctx);
    return { taps, lightPos, hallSpot: { x: -45, z: -33, facing: -Math.PI / 2 } };
  }

  P.MosqueInside = { build };
})((window.KQ = window.KQ || {}));
