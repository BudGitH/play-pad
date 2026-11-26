/* Kampung Quest — street furniture and play (KQ.WorldParts.Props): playground on soft rubber
   flooring, covered linkways, bus stop shelter, recycling bins, park benches and paths, the
   carpark, parked cars (static, instanced) and the paved plazas that join it all up. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const col = (c, x0, x1, z0, z1, kind) => c.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, kind });

  /** Playground: colour-zoned rubber floor, tower + slide, swings, spring riders, see-saw. */
  function playground(B, pg, ctx) {
    B.aabb("concrete", pg.x0 - 0.3, 0, pg.z0 - 0.3, pg.x1 + 0.3, 0.16, pg.z1 + 0.3, 0xd6d2c8);
    B.aabb("rubber", pg.x0, 0, pg.z0, pg.x1, 0.17, pg.z1, 0x5aa04a);
    B.aabb("rubber", pg.x0 + 1, 0, pg.z0 + 1, pg.x0 + 8, 0.175, pg.z0 + 8, 0x3f86c8);
    B.aabb("rubber", pg.x1 - 7, 0, pg.z1 - 6, pg.x1 - 1, 0.175, pg.z1 - 1, 0xe8892f);
    tower(B, pg.x0 + 4.5, pg.z0 + 4.5, ctx);
    swings(B, pg.x1 - 4, pg.z1 - 3.5, ctx);
    [
      [pg.x1 - 4, pg.z0 + 3, 0xe8432f],
      [pg.x1 - 2, pg.z0 + 4.5, 0xf2c230],
    ].forEach(([x, z, c]) => {
      B.geo(
        "metal",
        P.cached("spring", () => new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8)),
        P.compose(x, 0.42, z, 0, 1, 1, 1),
        0x8a8f94,
      );
      B.geo(
        "plastic",
        P.cached("rider", () => new THREE.SphereGeometry(0.35, 16, 10)),
        P.compose(x, 0.85, z, 0, 1.4, 0.8, 0.8),
        c,
      );
      B.box("plastic", x + 0.42, 1.05, z, 0.24, 0.3, 0.22, c);
    });
    B.box("plastic", pg.x0 + 4, 0.55, pg.z1 - 3, 3.4, 0.1, 0.32, 0xe8432f, [0, 0, 0.12]);
    B.box("metal", pg.x0 + 4, 0.3, pg.z1 - 3, 0.3, 0.45, 0.3, 0x8a8f94);
    col(ctx.colliders, pg.x0 + 2.2, pg.x0 + 5.8, pg.z1 - 3.4, pg.z1 - 2.6, "seesaw");
  }
  function tower(B, x, z, ctx) {
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach(([dx, dz]) => B.cyl("metal", x + dx, 1.5, z + dz, 0.08, 3.0, 10, 0xf2c230));
    B.box("plastic", x, 1.4, z, 2.2, 0.12, 2.2, 0x3f86c8);
    B.geo(
      "plastic",
      P.cached("roofcone", () => new THREE.ConeGeometry(1.7, 1.0, 4)),
      P.compose(x, 3.4, z, Math.PI / 4, 1, 1, 1),
      0xe8432f,
    );
    B.box("plastic", x + 2.3, 0.78, z, 3.0, 0.08, 0.8, 0x2fa05a, [0, 0, -0.45]);
    [-0.42, 0.42].forEach((dz) =>
      B.box("plastic", x + 2.3, 0.95, z + dz, 3.0, 0.22, 0.06, 0x23824a, [0, 0, -0.45]),
    );
    for (let i = 0; i < 5; i++)
      B.box("metal", x, 0.3 + i * 0.27, z - 1.25, 0.8, 0.05, 0.05, 0xf2c230);
    col(ctx.colliders, x - 1.2, x + 3.6, z - 1.3, z + 1.2, "tower");
  }
  function swings(B, x, z, ctx) {
    [-1.6, 1.6].forEach((dx) => {
      B.box("metal", x + dx, 1.2, z - 0.5, 0.08, 2.5, 0.08, 0xe8432f, [0.2, 0, 0]);
      B.box("metal", x + dx, 1.2, z + 0.5, 0.08, 2.5, 0.08, 0xe8432f, [-0.2, 0, 0]);
    });
    B.box("metal", x, 2.4, z, 3.4, 0.1, 0.1, 0xe8432f);
    [-0.7, 0.7].forEach((dx) => {
      [-0.2, 0.2].forEach((ox) => B.box("metal", x + dx + ox, 1.6, z, 0.02, 1.6, 0.02, 0x9aa0a6));
      B.box("plastic", x + dx, 0.78, z, 0.5, 0.05, 0.22, 0x2b2b2b);
    });
    col(ctx.colliders, x - 1.8, x + 1.8, z - 0.9, z + 0.9, "swings");
  }

  /** Covered linkway: posts both sides and a slightly pitched roof (posts are colliders). */
  function linkway(B, lw, ctx) {
    const alongZ = lw.z1 - lw.z0 > lw.x1 - lw.x0;
    const len = alongZ ? lw.z1 - lw.z0 : lw.x1 - lw.x0;
    B.aabb("paving", lw.x0, 0, lw.z0, lw.x1, 0.12, lw.z1, 0xf0ece6);
    for (let t = 1; t < len; t += 4) {
      [0, 1].forEach((side) => {
        const x = alongZ ? (side ? lw.x1 - 0.15 : lw.x0 + 0.15) : lw.x0 + t;
        const z = alongZ ? lw.z0 + t : side ? lw.z1 - 0.15 : lw.z0 + 0.15;
        B.box("paint", x, 1.45, z, 0.14, 2.9, 0.14, 0x4f5a62);
        col(ctx.colliders, x - 0.12, x + 0.12, z - 0.12, z + 0.12, "linkway-post");
      });
    }
    B.aabb("paint", lw.x0 - 0.3, 2.9, lw.z0, lw.x1 + 0.3, 2.98, lw.z1, 0x4f5a62);
    for (let t = 3; t < len - 1; t += 8) {
      const x = alongZ ? (lw.x0 + lw.x1) / 2 : lw.x0 + t;
      const z = alongZ ? lw.z0 + t : (lw.z0 + lw.z1) / 2;
      B.box("lamp", x, 2.87, z, alongZ ? 0.12 : 1.0, 0.04, alongZ ? 1.0 : 0.12, 0xffffff);
      ctx.pools.push({ x, z, s: 0.55, y: 2.7 });
    }
    B.aabb("concrete", lw.x0 - 0.35, 2.98, lw.z0, lw.x1 + 0.35, 3.1, lw.z1, 0xe8e4dc);
  }

  /** Bus stop shelter with bench, glass back panel and a service sign pole. */
  function busStop(B, bs, ctx) {
    B.aabb("paving", bs.x0 - 2, 0, bs.z0 - 0.4, bs.x1 + 2, 0.12, bs.z1 + 0.6, 0xe9e4dc);
    [bs.x0 + 0.3, bs.x1 - 0.3].forEach((x) =>
      B.box("paint", x, 1.45, bs.z1 - 0.3, 0.16, 2.9, 0.16, 0x3d4a55),
    );
    B.box(
      "paint",
      (bs.x0 + bs.x1) / 2,
      2.98,
      (bs.z0 + bs.z1) / 2,
      bs.x1 - bs.x0 + 0.6,
      0.12,
      bs.z1 - bs.z0 + 0.6,
      0x3d4a55,
      [-0.06, 0, 0],
    );
    B.plane("glass", (bs.x0 + bs.x1) / 2, 1.5, bs.z1 - 0.2, bs.x1 - bs.x0 - 0.8, 2.2, Math.PI);
    B.aabb("wood", bs.x0 + 1, 0.42, bs.z1 - 1.0, bs.x1 - 1, 0.5, bs.z1 - 0.5, 0xa0714a);
    B.box("lamp", (bs.x0 + bs.x1) / 2, 2.88, (bs.z0 + bs.z1) / 2, 3, 0.04, 0.12, 0xffffff);
    ctx.pools.push({ x: (bs.x0 + bs.x1) / 2, z: (bs.z0 + bs.z1) / 2, s: 0.7, y: 2.7 });
    B.aabb("metal", bs.x0 + 1, 0.12, bs.z1 - 0.8, bs.x0 + 1.1, 0.42, bs.z1 - 0.7, 0x9aa0a6);
    B.aabb("metal", bs.x1 - 1.1, 0.12, bs.z1 - 0.8, bs.x1 - 1, 0.42, bs.z1 - 0.7, 0x9aa0a6);
    col(ctx.colliders, bs.x0, bs.x1, bs.z1 - 1.05, bs.z1, "bus-bench");
    const px = bs.x0 - 1;
    B.cyl("paint", px, 1.4, bs.z0 + 0.1, 0.05, 2.8, 8, 0x3d4a55);
    const uv = ctx.atlas.sign({
      w: 1.6,
      h: 0.9,
      text: "BUS STOP",
      sub: "11829 · 12 · 33 · 961",
      bg: "#3d4a55",
      bg2: "#2d3740",
    });
    B.plane("sign", px, 2.45, bs.z0 + 0.14, 1.0, 0.56, 0, uv);
    B.plane("sign", px, 2.45, bs.z0 + 0.06, 1.0, 0.56, Math.PI, uv);
    col(ctx.colliders, px - 0.12, px + 0.12, bs.z0 - 0.02, bs.z0 + 0.22, "bus-pole");
  }

  /** Recycling point: three blue bins with lids and labels. */
  function recycling(B, r, ctx) {
    B.aabb("concrete", r.x - 2.4, 0, r.z - 1.1, r.x + 2.4, 0.13, r.z + 0.9, 0xd8d4cc);
    const uv = ctx.atlas.sign({
      w: 1.1,
      h: 0.5,
      text: "RECYCLE",
      sub: "Kitar semula",
      bg: "#1f5fa8",
    });
    [-1.4, 0, 1.4].forEach((dx) => {
      B.aabb("plastic", r.x + dx - 0.6, 0.13, r.z - 0.9, r.x + dx + 0.6, 1.35, r.z + 0.1, 0x2a6fc4);
      B.aabb(
        "plastic",
        r.x + dx - 0.63,
        1.35,
        r.z - 0.93,
        r.x + dx + 0.63,
        1.45,
        r.z + 0.13,
        0x1d4f92,
      );
      B.aabb("dark", r.x + dx - 0.3, 1.0, r.z + 0.1, r.x + dx + 0.3, 1.12, r.z + 0.12, 0x10161c);
      B.plane("decal", r.x + dx, 0.7, r.z + 0.115, 1.0, 0.45, 0, uv);
    });
    col(ctx.colliders, r.x - 2.1, r.x + 2.1, r.z - 1.0, r.z + 0.2, "bins");
    return { x: r.x, z: r.z + 1.0, facing: Math.PI };
  }

  P.Props = { playground, linkway, busStop, recycling };
})((window.KQ = window.KQ || {}));
