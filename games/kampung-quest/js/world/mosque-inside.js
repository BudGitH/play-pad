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
    P.collide(ctx.colliders, h.x0 - 1.7, h.x0 - 0.1, -34.7, -31.3, "mihrab");
    minbar(B, h.x0 + 0.25, -30.2, ctx);
  }
  /** Build the imam's minbar: five steps rising to a pulpit. */
  function minbar(B, x, z, ctx) {
    const y = S().PLINTH;
    for (let i = 0; i < 5; i++)
      B.aabb(
        "wood",
        x + 2.4 - i * 0.45,
        y,
        z - 0.45,
        x + 2.4 - i * 0.45 + 0.45,
        y + 0.28 * (i + 1),
        z + 0.45,
        0x7a4a26,
      );
    B.aabb("wood", x, y, z - 0.5, x + 0.5, y + 1.6, z + 0.5, 0x6a3e1f);
    [-0.5, 0.5].forEach((dz) =>
      B.aabb("wood", x, y + 1.6, z + dz - 0.04, x + 0.5, y + 3.2, z + dz + 0.04, 0x6a3e1f),
    );
    B.aabb("wood", x - 0.1, y + 3.2, z - 0.6, x + 0.6, y + 3.35, z + 0.6, 0x6a3e1f);
    P.Mosque.dome(B, x + 0.25, z, y + 3.35, 0.32);
    P.collide(ctx.colliders, x - 0.1, x + 2.9, z - 0.55, z + 0.55, "minbar");
  }

  /** Warm timber dado on the three non-qibla walls, leaving the door openings clear. */
  function dado(B, h) {
    const y = P.MosqueShell.PLINTH;
    const t = 0.18;
    const run = (a, b, fn) => {
      if (b - a > 0.1) fn(a, b);
    };
    const seg = (x0, x1, z0, z1) => B.aabb("wood", x0, y, z0, x1, y + 1.0, z1, 0x8a5a32);
    run(h.x0 + 0.2, h.x1 - 0.2, (a, b) => seg(a, b, h.z0 + t, h.z0 + t + 0.04));
    run(h.x0 + 0.2, -39.2, (a, b) => seg(a, b, h.z1 - t - 0.04, h.z1 - t));
    run(-36.8, h.x1 - 0.2, (a, b) => seg(a, b, h.z1 - t - 0.04, h.z1 - t));
    [
      [h.z0 + 0.2, -36.4],
      [-34.0, -32.0],
      [-29.6, h.z1 - 0.2],
    ].forEach(([a, b]) => seg(h.x1 - t - 0.04, h.x1 - t, a, b));
  }

  /** Columns, women's lattice screen, shelves and the chandelier; returns the lamp spot. */
  const COLUMNS = [-46, -40, -38, -40, -46, -26, -38, -26];
  /**
   * Furnish the hall: marble columns with gold capitals, the women's screen, and their colliders.
   */
  function furnish(B, h, m, ctx) {
    const y = S().PLINTH;
    for (let i = 0; i < COLUMNS.length; i += 2) {
      const x = COLUMNS[i];
      const z = COLUMNS[i + 1];
      B.cyl("marble", x, y + 3.5, z, 0.32, 7, 16, 0xffffff);
      B.cyl("gold", x, y + 6.8, z, 0.4, 0.3, 16, 0xd9b25c);
      P.collide(ctx.colliders, x - 0.4, x + 0.4, z - 0.4, z + 0.4, "column");
    }
    const zs = m.womenScreenZ;
    B.plane("railing", -38, y + 0.9, zs, 12, 1.8, 0, null, 0x7a4a26);
    B.aabb("wood", -44.1, y, zs - 0.05, -32, y + 0.08, zs + 0.05, 0x6a3e1f);
    P.collide(ctx.colliders, -44.1, -32.2, zs - 0.15, zs + 0.15, "screen");
    const x1 = h.x1;
    const z0 = h.z0;
    B.aabb("wood", x1 - 0.75, y, z0 + 1, x1 - 0.2, y + 1.8, z0 + 4, 0x6a3e1f);
    B.aabb("books", x1 - 0.77, y + 0.1, z0 + 1.05, x1 - 0.74, y + 1.75, z0 + 3.95, 0xffffff);
    P.collide(ctx.colliders, x1 - 0.8, x1 - 0.1, z0 + 0.9, z0 + 4.1, "shelf");
    return chandelier(B, new THREE.Vector3((h.x0 + h.x1) / 2, y + 5.2, (h.z0 + h.z1) / 2));
  }
  /** Brass ring chandelier with eight lamps; returns its centre (the hall light). */
  function chandelier(B, c) {
    const ring = P.cached("ring", () => new THREE.TorusGeometry(1.2, 0.06, 8, 32));
    B.geo("gold", ring, P.compose(c.x, c.y, c.z, [Math.PI / 2, 0, 0], 1, 1, 1), 0xd9b25c);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = c.x + Math.cos(a) * 1.2;
      B.cyl("lamp", x, c.y + 0.15, c.z + Math.sin(a) * 1.2, 0.08, 0.25, 8, 0xffffff);
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
    P.MosqueYard.courtLamps(B, ctx);
    const taps = P.MosqueYard.wudu(B, m, ctx);
    carpet(group, mats, h);
    qibla(B, h, ctx);
    dado(B, h);
    const lightPos = furnish(B, h, m, ctx);
    if (P.Ornament) P.Ornament.build(B, m, ctx);
    return { taps, lightPos, hallSpot: { x: -45, z: -33, facing: -Math.PI / 2 } };
  }

  P.MosqueInside = { build };
})((window.KQ = window.KQ || {}));
