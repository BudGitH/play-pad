/* ============================================================================
 * FILE: holy-makkah.js
 * PURPOSE: Makkah outside the Haram (KQ.WorldParts.HolyMakkah): the sandy ground, streets with
 *          pavements and lane marks, the gate plaza and hotel forecourt, the clock-tower hotel
 *          and the hotel skyline, palms, the miqat bus stop, and the Hajj zones (Mina tents,
 *          Arafah with Jabal Rahmah, Muzdalifah, the three Jamarat pillars) plus a hill ring.
 * BUSINESS CONTEXT: AC-H1 (scenery), AC-H4 (Hajj highlights places). Simplified, play-scale.
 * DEPENDENCIES: holy-kit.js, geo.js (Batch, instanced), KQ.HOLY anchors.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const K = () => P.HolyKit;
  /** Play bounds of the Makkah half of the world (invisible edge walls sit just outside). */
  const BOUNDS = { x0: -310, x1: 125, z0: -225, z1: 135 };
  /** Streets: centre line, width, extent. axis "x" runs east-west at z = at. */
  const ROADS = [
    { axis: "x", at: -106, from: -310, to: 125, w: 12 },
    { axis: "x", at: -175, from: -130, to: 125, w: 12 },
    { axis: "x", at: 85, from: -130, to: 125, w: 14 },
    { axis: "x", at: 10, from: -310, to: -85, w: 12 },
    { axis: "z", at: -60, from: -215, to: -106, w: 12 },
    { axis: "z", at: 80, from: -215, to: 125, w: 14 },
    { axis: "z", at: -85, from: -106, to: 85, w: 12 },
    { axis: "z", at: -120, from: -106, to: 10, w: 10 },
  ];

  /** One street: asphalt, two paved footways and a dashed centre line. */
  function road(c, r) {
    const B = c.B;
    const h = r.w / 2;
    const run = (a0, a1, b0, b1, key, y0, y1, col) => {
      if (r.axis === "x") B.aabb(key, a0, y0, b0, a1, y1, b1, col);
      else B.aabb(key, b0, y0, a0, b1, y1, a1, col);
    };
    run(r.from, r.to, r.at - h, r.at + h, "asphalt", 0, 0.04, 0xffffff);
    run(r.from, r.to, r.at - h - 3.5, r.at - h, "paving", 0, 0.12, 0xe2d8c2);
    run(r.from, r.to, r.at + h, r.at + h + 3.5, "paving", 0, 0.12, 0xe2d8c2);
    for (let t = r.from + 4; t < r.to - 4; t += 9) {
      const x = r.axis === "x" ? t : r.at;
      const z = r.axis === "x" ? r.at : t;
      B.decal("marking", x, 0.05, z, r.axis === "x" ? 3.5 : 0.25, r.axis === "x" ? 0.25 : 3.5, 0, 0xf2f0e6);
    }
  }

  /** The sandy ground under everything and the paved plazas. */
  function ground(c) {
    const B = c.B;
    B.aabb("concrete", -330, -0.4, -235, 150, 0, 150, 0xd6c29c);
    B.aabb("marble", -34, 0, -96.5, 34, 0.1, -58, 0xece6d6);
    B.aabb("marble", -8, 0, -116, 8, 0.08, -96, 0xf4efe2);
    B.aabb("tiles", -34, 0.1, -96.5, 34, 0.12, -95.9, 0xb8aa84);
    B.aabb("tiles", -34, 0.1, -58.6, 34, 0.12, -58, 0xb8aa84);
  }

  /** The clock-tower hotel: podium, tower, a banded top with four clock faces, a gold dome and crescent. */
  function clockTower(c) {
    const B = c.B;
    const t = KQ.HOLY.makkah.clockTower;
    B.aabb("hotel", t.x - 17, 0, t.z - 17, t.x + 17, 42, t.z + 17, 0xf0e8d8);
    B.aabb("hotel", t.x - 11, 42, t.z - 11, t.x + 11, 104, t.z + 11, 0xf6efe0);
    B.aabb("paint", t.x - 13.5, 104, t.z - 13.5, t.x + 13.5, 122, t.z + 13.5, 0xe3d6b4);
    [
      [0, 13.6, 0],
      [0, -13.6, Math.PI],
      [13.6, 0, Math.PI / 2],
      [-13.6, 0, -Math.PI / 2],
    ].forEach((f) => B.plane("clock", t.x + f[0], 113, t.z + f[1], 17, 17, f[2], null, 0xffffff));
    B.aabb("gold", t.x - 14.2, 122, t.z - 14.2, t.x + 14.2, 123.6, t.z + 14.2, 0xd9b04a);
    K().dome(B, { key: "gold", x: t.x, y: 123.6, z: t.z, r: 9, k: 1.1, color: 0xe2bd62, bulge: 1.1 });
    B.cyl("gold", t.x, 142, t.z, 0.5, 14, 8, 0xe2bd62);
    K().solid(c.colliders, t.x - 17, t.z - 17, t.x + 17, t.z + 17, "tower");
  }

  /** Hotel blocks: [x0, z0, x1, z1, height]; each becomes a podium plus a slimmer tower. */
  const HOTELS = [
    [-122, -160, -76, -118, 70],
    [-48, -150, -22, -118, 56],
    [22, -150, 70, -118, 84],
    [88, -160, 124, -118, 64],
    [-120, -214, -70, -182, 92],
    [-46, -214, 20, -182, 76],
    [40, -214, 116, -182, 98],
    [-76, 100, -34, 140, 80],
    [-26, 100, 30, 134, 110],
    [38, 102, 70, 132, 74],
    [-124, 26, -96, 74, 60],
    [96, -70, 124, -20, 66],
    [96, 14, 124, 72, 78],
  ];

  /** The hotel skyline: every block gets a podium and a tower of the `hotel` facade material. */
  function hotels(c) {
    HOTELS.forEach((h) => {
      const w = h[2] - h[0];
      const d = h[3] - h[1];
      const inset = Math.min(w, d) * 0.14;
      c.B.aabb("hotel", h[0], 0, h[1], h[2], 16, h[3], 0xf0e8d8);
      c.B.aabb("hotel", h[0] + inset, 16, h[1] + inset, h[2] - inset, h[4], h[3] - inset, 0xeee6d4);
      c.B.aabb("paint", h[0] + inset - 0.3, h[4], h[1] + inset - 0.3, h[2] - inset + 0.3, h[4] + 1, h[3] - inset + 0.3, 0xcdbf9a);
      K().solid(c.colliders, h[0], h[1], h[2], h[3], "tower");
    });
  }

  /** Palm spots: rows in the plaza and forecourt, along the main streets. */
  function palmSpots() {
    const out = [];
    for (let x = -30; x <= 30; x += 10) {
      [-92, -62].forEach((z) => x !== 0 && out.push({ x, z, s: 0.9 + ((x * 7) % 5) / 25 }));
    }
    for (let x = -100; x <= 120; x += 22) out.push({ x, z: -94.5, s: 1 }, { x, z: -117.5, s: 1.1 });
    for (let z = -100; z <= 120; z += 24) out.push({ x: 92, z, s: 1 }, { x: 68, z, s: 1.05 });
    return out.filter((p) => Math.abs(p.x) > 1 || p.z > -60 || p.z < -118);
  }

  /** The miqat bus stop (Masjid Aisha, Tan'im): a shelter, a bench, a sign board and a parked bus. */
  function busStop(c) {
    const B = c.B;
    const m = KQ.HOLY.makkah.miqat;
    B.aabb("whitePlaster", m.x - 3, 0, m.z - 1, m.x + 3, 0.12, m.z + 1.4, 0xf4efe2);
    [-2.6, 2.6].forEach((dx) => B.cyl("metal", m.x + dx, 1.4, m.z + 1, 0.07, 2.8, 6, 0x8e959b));
    B.aabb("paint", m.x - 3.2, 2.8, m.z - 1.2, m.x + 3.2, 3, m.z + 1.6, 0x1f7a4d);
    B.aabb("wood", m.x - 2.2, 0.35, m.z + 0.5, m.x + 2.2, 0.55, m.z + 1.1, 0x8a6a44);
    B.aabb("whitePlaster", m.x - 5.2, 0.4, m.z - 5.8, m.x - 2.2, 3.4, m.z + 5.2, 0xf6f4ee);
    B.aabb("paint", m.x - 5.25, 1.3, m.z - 5.8, m.x - 2.15, 1.8, m.z + 5.2, 0x1f7a4d);
    B.aabb("glass", m.x - 5.3, 1.9, m.z - 5.4, m.x - 2.1, 3, m.z + 4.8, 0xffffff);
    [-3.5, 3.5].forEach((dz) => B.cyl("dark", m.x - 3.7, 0.4, m.z + dz, 0.5, 0.8, 10, 0x222226));
    K().solid(c.colliders, m.x - 5.4, m.z - 5.9, m.x - 2, m.z + 5.3, "bus");
    K().solid(c.colliders, m.x + 2.5, m.z + 0.8, m.x + 3.1, m.z + 1.2, "post");
  }

  /** Mina: a grid of white tents with a gravel yard and aisles. */
  function mina(c) {
    const B = c.B;
    const m = KQ.HOLY.hajj.mina;
    B.cyl("concrete", m.x, 0.04, m.z, 26, 0.1, 40, 0xcdbfa4);
    for (let i = -3; i <= 3; i += 1) {
      for (let j = -3; j <= 3; j += 1) {
        if (i === 0 || j === 0) continue;
        const x = m.x + i * 6 + Math.sign(i) * 1;
        const z = m.z + j * 6 + Math.sign(j) * 1;
        B.aabb("plastic", x - 2, 0, z - 2, x + 2, 2.4, z + 2, 0xf6f3ea);
        B.geo("plastic", new THREE.ConeGeometry(3.1, 1.8, 4), P.compose(x, 3.3, z, Math.PI / 4, 1, 1, 1), 0xefe9d8);
        K().solid(c.colliders, x - 2, z - 2, x + 2, z + 2, "tent");
      }
    }
  }

  /** Arafah: open ground with Jabal Rahmah (a rocky hill with steps and a white marker pillar). */
  function arafah(c, hills) {
    const a = KQ.HOLY.hajj.arafah;
    c.B.cyl("concrete", a.x, 0.04, a.z, 30, 0.1, 40, 0xd2bfa0);
    hills.push({ x: a.x, z: a.z, w: 12, h: 10, seed: 2 });
    for (let i = 0; i < 6; i += 1) {
      c.B.aabb("marble", a.x - 1.2, i * 0.5, a.z + 8 - i * 1.0, a.x + 1.2, i * 0.5 + 0.5, a.z + 9 - i * 1.0, 0xe8e2d2);
    }
    c.B.box("marble", a.x, 11.5, a.z, 1.6, 4.8, 1.6, 0xf6f2e6);
    c.B.box("marble", a.x, 14.2, a.z, 1.0, 0.6, 1.0, 0xe2bd62);
    K().solid(c.colliders, a.x - 6, a.z - 6, a.x + 6, a.z + 6, "rock");
  }

  /** Muzdalifah: an open pebbly plain under floodlights. */
  function muzdalifah(c) {
    const m = KQ.HOLY.hajj.muzdalifah;
    c.B.cyl("concrete", m.x, 0.05, m.z, 20, 0.12, 36, 0xbca98a);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      K().lamp(c.B, c, m.x + Math.cos(a) * 13, m.z + Math.sin(a) * 13, 10);
    }
  }

  /** The three Jamarat pillars, each in a low oval basin. */
  function jamarat(c) {
    const j = KQ.HOLY.hajj.jamarat;
    [-12, 0, 12].forEach((dx) => {
      const x = j.x + dx;
      c.B.aabb("concrete", x - 4.2, 0, j.z - 6.4, x + 4.2, 0.9, j.z + 6.4, 0xd7ccb4);
      c.B.aabb("tiles", x - 3.4, 0.9, j.z - 5.6, x + 3.4, 0.95, j.z + 5.6, 0xb9ad94);
      c.B.box("concrete", x, 3.4, j.z, 1.5, 6, 5.4, 0xcbbd9f);
      c.B.box("concrete", x, 6.6, j.z, 1.9, 0.4, 5.8, 0xb9ad94);
      K().solid(c.colliders, x - 4.2, j.z - 6.4, x + 4.2, j.z + 6.4, "basin");
    });
  }

  /** A ring of rocky hills outside the play bounds. */
  function hillRing(hills) {
    const r = P.rng(77);
    for (let i = 0; i < 22; i += 1) {
      const a = (i / 22) * Math.PI * 2;
      const cx = -90 + Math.cos(a) * 340;
      const cz = -50 + Math.sin(a) * 250;
      hills.push({ x: cx + r() * 20, z: cz + r() * 20, w: 70 + r() * 60, h: 38 + r() * 40, seed: 1 + (i % 3) });
    }
  }

  /** Build all of Makkah outside the Haram. Returns what the world needs (palms, hills, vehicle spots). */
  function build(c) {
    const hills = [];
    ground(c);
    ROADS.forEach((r) => road(c, r));
    clockTower(c);
    hotels(c);
    busStop(c);
    mina(c);
    arafah(c, hills);
    muzdalifah(c);
    jamarat(c);
    hillRing(hills);
    for (let x = -100; x <= 110; x += 30) K().lamp(c.B, c, x, -96, 8);
    return { palms: palmSpots(), hills };
  }

  P.HolyMakkah = { build, BOUNDS, ROADS };
})((window.KQ = window.KQ || {}));
