/* Kampung Quest — the mosque, part 3 (KQ.WorldParts.MosqueYard): compound fence with the
   main (east) and women's-side (south) gates, the minaret, the open-sided wudu shelter with a
   row of taps, a low seat ledge and a drain trough, and the women's wudu room. Returns the
   tap spots. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const S = () => P.MosqueShell;
  const TAPS = 8;

  /** A fence segment: low wall + railing + capped pillars; adds a collider. */
  function fence(B, ctx, x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.5) return;
    const rot = Math.atan2(z0 - z1, x1 - x0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    B.box("plaster", cx, 0.35, cz, len, 0.7, 0.28, S().WALL, rot);
    B.box("paint", cx, 0.72, cz, len, 0.06, 0.34, S().TEAL, rot);
    B.plane("railing", cx, 1.15, cz, len, 0.8, rot, null, 0x2c5f5a);
    const n = Math.max(1, Math.round(len / 4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      B.box("plaster", x0 + (x1 - x0) * t, 0.8, z0 + (z1 - z0) * t, 0.5, 1.6, 0.5, S().WALL);
    }
    ctx.colliders.push({
      minX: Math.min(x0, x1) - 0.25,
      maxX: Math.max(x0, x1) + 0.25,
      minZ: Math.min(z0, z1) - 0.25,
      maxZ: Math.max(z0, z1) + 0.25,
      kind: "fence",
    });
  }

  /** Gate posts with small domes and a name board. */
  function gatePosts(B, ctx, a, b, label) {
    [a, b].forEach(([x, z]) => {
      B.box("plaster", x, 1.5, z, 0.9, 3.0, 0.9, S().WALL);
      B.box("paint", x, 3.05, z, 1.0, 0.12, 1.0, S().TEAL);
      P.Mosque.dome(B, x, z, 3.1, 0.42);
      P.collide(ctx.colliders, x - 0.5, x + 0.5, z - 0.5, z + 0.5, "gate");
    });
    if (!label) return;
    const rot = a[0] === b[0] ? Math.PI / 2 : 0;
    B.box(
      "plaster",
      (a[0] + b[0]) / 2,
      3.4,
      (a[1] + b[1]) / 2,
      rot ? 0.4 : Math.abs(b[0] - a[0]),
      0.7,
      rot ? Math.abs(b[1] - a[1]) : 0.4,
      S().WALL,
    );
    const uv = ctx.atlas.sign({
      w: 5,
      h: 0.7,
      text: label,
      sub: "Assalamualaikum · Welcome",
      bg: "#1f7a74",
      bg2: "#17615c",
    });
    B.plane(
      "sign",
      (a[0] + b[0]) / 2 + (rot ? 0.22 : 0),
      3.4,
      (a[1] + b[1]) / 2 + (rot ? 0 : 0.22),
      4.6,
      0.64,
      rot,
      uv,
    );
  }

  /** Compound fence around the mosque with the two gate gaps. */
  function compound(B, m, ctx) {
    const g = m.gate;
    const w = m.womenDoor;
    fence(B, ctx, m.x0, m.z0, m.x1, m.z0);
    fence(B, ctx, m.x0, m.z0, m.x0, m.z1);
    fence(B, ctx, m.x1, m.z0, m.x1, g.z0 - 0.5);
    fence(B, ctx, m.x1, g.z1 + 0.5, m.x1, m.z1);
    fence(B, ctx, m.x0, m.z1, w.x0 - 0.5, m.z1);
    fence(B, ctx, w.x1 + 0.5, m.z1, m.x1, m.z1);
    gatePosts(B, ctx, [m.x1, g.z0 - 0.5], [m.x1, g.z1 + 0.5], "MASJID KAMPUNG DAMAI");
    gatePosts(B, ctx, [w.x0 - 0.5, m.z1], [w.x1 + 0.5, m.z1], null);
  }

  /** Garden bollard lamps around the courtyard. */
  function courtLamps(B, ctx) {
    [
      [-24, -40],
      [-16, -40],
      [-24, -22],
      [-16, -26],
      [-22, -14],
    ].forEach(([x, z]) => {
      B.cyl("paint", x, 1.1, z, 0.07, 2.2, 8, 0x2c5f5a);
      B.geo(
        "lamp",
        P.cached("globe", () => new THREE.SphereGeometry(0.22, 14, 10)),
        P.compose(x, 2.35, z, 0, 1, 1, 1),
      );
      ctx.pools.push({ x, z, s: 0.65, y: 2.3, warm: true });
      P.collide(ctx.colliders, x - 0.15, x + 0.15, z - 0.15, z + 0.15, "bollard");
    });
  }

  /** Octagonal minaret with a balcony, a lantern and a small dome. */
  function minaret(B, m, ctx) {
    const { x, z } = m.minaret;
    B.box("plaster", x, 1.5, z, 3.2, 3.0, 3.2, S().WALL);
    B.box("paint", x, 3.05, z, 3.4, 0.14, 3.4, S().TEAL);
    B.cyl("plaster", x, 9.6, z, 1.15, 13.2, 8, S().WALL);
    [6, 10].forEach((y) => B.cyl("paint", x, y, z, 1.2, 0.18, 8, S().TEAL));
    B.cyl("plaster", x, 16.3, z, 1.75, 0.3, 16, 0xefe9dc);
    B.geo(
      "railing",
      P.cached("balc", () => new THREE.CylinderGeometry(1.7, 1.7, 0.9, 24, 1, true)),
      P.compose(x, 16.9, z, 0, 1, 1, 1),
      0x2c5f5a,
    );
    B.cyl("plaster", x, 18.0, z, 0.95, 3.2, 8, S().WALL);
    B.cyl("lamp", x, 18.2, z, 0.97, 0.5, 8, 0xffffff);
    B.cyl("paint", x, 19.65, z, 1.15, 0.16, 16, S().TEAL);
    P.Mosque.dome(B, x, z, 19.7, 1.0);
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + (k * Math.PI) / 4;
      const r = 1.15 * Math.cos(Math.PI / 8) + 0.01;
      [8.2, 12.4].forEach((y) =>
        B.box("dark", x + Math.sin(a) * r, y, z + Math.cos(a) * r, 0.32, 1.0, 0.04, 0x2b3a40, a),
      );
      B.box("paint", x + Math.sin(a) * r, 15.2, z + Math.cos(a) * r, 0.86, 0.5, 0.03, S().TEAL, a);
    }
    P.collide(ctx.colliders, x - 1.7, x + 1.7, z - 1.7, z + 1.7, "minaret");
  }

  /** Men's wudu shelter: tiled back wall, taps, drain trough, low seat ledge, roof. */
  function wudu(B, m, ctx) {
    const w = m.wudu;
    B.aabb("tiles", w.x0, 0, w.z0, w.x1, 0.14, w.z1 + 0.6, 0xeef2f2);
    B.aabb("wallTile", w.x0, 0.14, w.z0, w.x1, 2.6, w.z0 + 0.25, 0xffffff);
    for (let x = w.x0 + 1.5; x < w.x1; x += 4) {
      B.box("lamp", x, 2.97, (w.z0 + w.z1) / 2, 1.2, 0.05, 0.12, 0xffffff);
      ctx.pools.push({ x, z: (w.z0 + w.z1) / 2, s: 0.7, y: 2.8 });
    }
    B.aabb("tilework", w.x0, 1.4, w.z0 + 0.25, w.x1, 1.7, w.z0 + 0.27, 0xffffff);
    B.aabb("dark", w.x0 + 0.2, 0.14, w.z0 + 0.25, w.x1 - 0.2, 0.17, w.z0 + 0.6, 0x5d6466);
    B.aabb("marble", w.x0 + 0.2, 0.14, w.z0 + 1.0, w.x1 - 0.2, 0.42, w.z0 + 1.45, 0xf0f0ea);
    B.aabb("concrete", w.x0 - 0.3, 3.0, w.z0 - 0.3, w.x1 + 0.3, 3.25, w.z1 + 0.8, 0xe9e4d8);
    for (let x = w.x0; x <= w.x1 + 0.01; x += (w.x1 - w.x0) / 4)
      B.box("plaster", x, 1.57, w.z1 + 0.4, 0.3, 2.86, 0.3, S().WALL);
    P.collide(ctx.colliders, w.x0, w.x1, w.z0 - 0.3, w.z0 + 0.4, "wudu-wall");
    const sign = ctx.atlas.sign({
      w: 4,
      h: 0.6,
      text: "TEMPAT WUDUK",
      sub: "Ablution · Lelaki (men)",
      bg: "#1f7a74",
    });
    B.plane("sign", (w.x0 + w.x1) / 2, 2.75, w.z1 + 0.82, 3.4, 0.5, 0, sign);
    return taps(B, w);
  }
  function taps(B, w) {
    const out = [];
    const step = (w.x1 - w.x0) / TAPS;
    for (let i = 0; i < TAPS; i++) {
      const x = w.x0 + step * (i + 0.5);
      B.box("chrome", x, 0.98, w.z0 + 0.36, 0.08, 0.08, 0.26, 0xffffff);
      B.box("chrome", x, 0.9, w.z0 + 0.47, 0.07, 0.18, 0.07, 0xffffff);
      B.cyl("chrome", x, 1.1, w.z0 + 0.32, 0.06, 0.12, 10, 0xffffff);
      B.box("chrome", x, 1.17, w.z0 + 0.32, 0.22, 0.03, 0.04, 0xffffff);
      out.push({ x, z: w.z0 + 1.0 + 0.25, tapZ: w.z0 + 0.42 });
    }
    return out;
  }

  /** Small enclosed women's wudu room beside the women's entrance. */
  function womenWudu(B, m, ctx) {
    const x0 = m.hall.x0 + 1;
    const z0 = m.hall.z1 + 1.2;
    B.aabb("plaster", x0, 0.1, z0, x0 + 5, 3.0, z0 + 3, S().WALL);
    B.aabb("paint", x0 - 0.05, 2.7, z0 - 0.05, x0 + 5.05, 3.1, z0 + 3.05, S().TEAL);
    B.box("wood", x0 + 4.2, 1.15, z0 + 3.02, 0.9, 2.0, 0.06, 0x7a5232);
    const sign = ctx.atlas.sign({
      w: 2.4,
      h: 0.5,
      text: "WUDUK WANITA",
      sub: "Women's ablution",
      bg: "#7a3f74",
    });
    B.plane("sign", x0 + 2, 2.35, z0 + 3.03, 2.2, 0.46, 0, sign);
    P.collide(ctx.colliders, x0, x0 + 5, z0, z0 + 3, "wudu-women");
  }

  P.MosqueYard = { compound, minaret, wudu, womenWudu, courtLamps, TAPS };
})((window.KQ = window.KQ || {}));
