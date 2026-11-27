/* ============================================================================
 * FILE: holy-haram.js
 * PURPOSE: Masjid al-Haram in Makkah (KQ.WorldParts.HolyHaram): the Kaaba (black kiswah, gold
 *          band, door, silver Black Stone frame), Hijr Ismail, the white marble mataf, Maqam
 *          Ibrahim, the Zamzam taps, wudu taps, arcaded halls, the gate, Safa / Marwa with the
 *          mas'a lane and its green lights, and the minarets.
 * BUSINESS CONTEXT: AC-H1. Distances are play-scale (the mas'a is 80 m). No faces, no people:
 *   buildings only. Anchors come from KQ.HOLY (js/data/holy-sites.js).
 * DEPENDENCIES: holy-kit.js, geo.js (Batch), mosque.js (finial).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const K = () => P.HolyKit;
  const HALL_H = 9;
  const MARBLE = 0xf1ece0;

  /** The complex floor (off-white marble) and the whiter mataf disc with its dark rim. */
  function floors(c) {
    const B = c.B;
    B.aabb("marble", -60, 0, -58, 60, 0.1, 58, 0xcfc8b6);
    const disc = new THREE.CircleGeometry(26, 72).rotateX(-Math.PI / 2);
    B.geo("marble", disc, P.compose(0, 0.12, 0, 0, 1, 1, 1), 0xe6e1d3);
    const rim = new THREE.RingGeometry(25.4, 26.2, 72).rotateX(-Math.PI / 2);
    B.geo("tiles", rim, P.compose(0, 0.135, 0, 0, 1, 1, 1), 0x6d665c);
    const inner = new THREE.RingGeometry(11.6, 11.9, 64).rotateX(-Math.PI / 2);
    B.geo("tiles", inner, P.compose(0, 0.135, 0, 0, 1, 1, 1), 0xb8aa84);
  }

  /** The Kaaba: kiswah cube, gold band, door, Black Stone corner (door wall faces -z, stone at +x,-z). */
  function kaaba(c) {
    const B = c.B;
    B.aabb("marble", -5.7, 0, -6.7, 5.7, 0.35, 6.7, 0xf4f0e6);
    B.box("kiswah", 0, 6.8, 0, 10, 13, 12, 0x1c1c22);
    B.box("gold", 0, 9.4, 0, 10.18, 1.4, 12.18, 0xd9b04a);
    B.box("gold", 0, 8.5, 0, 10.1, 0.12, 12.1, 0xb98f35);
    B.box("kiswah", 0, 13.05, 0, 10.2, 0.2, 12.2, 0x121216);
    B.box("gold", 2.2, 4.6, -6.04, 3.7, 5.4, 0.14, 0xa8812c);
    B.box("gold", 2.2, 4.5, -6.14, 2.5, 4.2, 0.16, 0xe2bd62);
    B.box("gold", 2.2, 4.5, -6.24, 0.1, 4.0, 0.08, 0xb98f35);
    B.box("chrome", 4.95, 1.65, -5.95, 1.0, 1.0, 1.0, 0xdfe3e8);
    B.box("dark", 5.08, 1.65, -6.08, 0.72, 0.72, 0.72, 0x1a1412);
    for (let i = 0; i < 6; i += 1) {
      B.box("kiswah", -4 + i * 1.6, 4.4, -6.03, 0.5, 8.4, 0.05, 0x2a2a31);
    }
    K().solid(c.colliders, -5.6, -6.6, 5.6, 6.6, "tower");
  }

  /** Hijr Ismail: a low white semicircular wall on the -x side, centred on the Kaaba's -x wall. */
  function hijr(c) {
    const cx = -5;
    const r = 5.6;
    const n = 14;
    for (let i = 0; i < n; i += 1) {
      const a0 = Math.PI / 2 + (i / n) * Math.PI;
      const a1 = Math.PI / 2 + ((i + 1) / n) * Math.PI;
      const x0 = cx + Math.cos(a0) * r;
      const z0 = Math.sin(a0) * r;
      const x1 = cx + Math.cos(a1) * r;
      const z1 = Math.sin(a1) * r;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      const len = Math.hypot(x1 - x0, z1 - z0) + 0.2;
      c.B.box("marble", mx, 0.75, mz, len, 1.5, 1.3, 0xffffff, Math.atan2(-(z1 - z0), x1 - x0));
      K().solid(c.colliders, mx - 0.7, mz - 0.7, mx + 0.7, mz + 0.7, "hijr");
    }
    const floor = new THREE.CircleGeometry(r - 0.7, 24, Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
    c.B.geo("tiles", floor, P.compose(cx, 0.14, 0, 0, 1, 1, 1), 0x9fb8a2);
  }

  /** Maqam Ibrahim: a gold-framed glass cage on a marble plinth, with a small gold dome. */
  function maqam(c) {
    const B = c.B;
    const m = KQ.HOLY.makkah.maqamIbrahim;
    B.cyl("marble", m.x, 0.3, m.z, 1.15, 0.6, 16, 0xffffff);
    B.box("glass", m.x, 1.55, m.z, 1.5, 1.6, 1.5, 0xffffff);
    [-0.78, 0.78].forEach((dx) =>
      [-0.78, 0.78].forEach((dz) => B.cyl("gold", m.x + dx, 1.5, m.z + dz, 0.06, 1.7, 6, 0xe2bd62)),
    );
    B.box("gold", m.x, 2.4, m.z, 1.7, 0.18, 1.7, 0xe2bd62);
    K().dome(B, { key: "gold", x: m.x, y: 2.5, z: m.z, r: 0.85, k: 0.9, color: 0xe2bd62 });
    K().solid(c.colliders, m.x - 1.2, m.z - 1.2, m.x + 1.2, m.z + 1.2, "maqam");
  }

  /** The Zamzam taps: a small roofed pavilion with a marble counter and a row of steel taps. */
  function zamzam(c) {
    const B = c.B;
    const z = KQ.HOLY.makkah.zamzam;
    B.aabb("marble", z.x - 3.4, 0, z.z - 1.6, z.x + 3.4, 0.9, z.z - 0.4, 0xffffff);
    for (let i = 0; i < 6; i += 1) {
      B.cyl("chrome", z.x - 2.5 + i, 1.05, z.z - 0.7, 0.06, 0.3, 8, 0xdfe3e8);
      B.box("chrome", z.x - 2.5 + i, 1.2, z.z - 0.55, 0.06, 0.06, 0.3, 0xdfe3e8);
    }
    [-3.4, 3.4].forEach((dx) =>
      B.cyl("whitePlaster", z.x + dx, 1.7, z.z + 0.7, 0.18, 3.4, 8, 0xf1ece0),
    );
    B.aabb("whitePlaster", z.x - 3.8, 3.4, z.z - 2.0, z.x + 3.8, 3.7, z.z + 1.2, 0xf1ece0);
    B.aabb("paint", z.x - 3.9, 3.7, z.z - 2.1, z.x + 3.9, 3.85, z.z + 1.3, 0x1f7a4d);
    K().solid(c.colliders, z.x - 3.4, z.z - 1.6, z.x + 3.4, z.z - 0.4, "counter");
  }

  /** A row of ablution taps on a marble trough (the four `wudu_tap_N` interactables sit here). */
  function wudu(c) {
    const B = c.B;
    B.aabb("wetTiles", -42, 0.1, 33.8, -29, 0.9, 35.4, 0xffffff);
    for (let i = 0; i < 4; i += 1) {
      B.cyl("chrome", -40.5 + i * 3.6, 1.1, 35.55, 0.07, 0.4, 8, 0xdfe3e8);
    }
    K().solid(c.colliders, -42, 33.8, -29, 35.4, "counter");
  }

  /** One arched run (an arcade) along x (axis "x", fixed z) or z, `n` bays, with pier colliders. */
  function arcade(c, o) {
    const w = (o.to - o.from) / o.n;
    const hw = 2.4;
    const g = K().archSlab(w, HALL_H, hw, 4.4, o.t || 1.2);
    for (let i = 0; i < o.n; i += 1) {
      const mid = o.from + w * (i + 0.5);
      const x = o.axis === "x" ? mid : o.fixed;
      const z = o.axis === "x" ? o.fixed : mid;
      c.B.geo(
        "whitePlaster",
        g,
        P.compose(x, 0, z, o.axis === "x" ? 0 : Math.PI / 2, 1, 1, 1),
        MARBLE,
      );
      const t = (o.t || 1.2) / 2;
      const lo = [mid - w / 2, mid - hw];
      const hi = [mid + hw, mid + w / 2];
      [lo, hi].forEach((p) => {
        if (o.axis === "x")
          K().solid(c.colliders, p[0], o.fixed - t, p[1], o.fixed + t, "arcade-col");
        else K().solid(c.colliders, o.fixed - t, p[0], o.fixed + t, p[1], "arcade-col");
      });
    }
  }

  /** Slim round columns in a hall (one row) with gilt capitals; they are low colliders. */
  function columnRow(c, o) {
    for (let i = 0; i <= o.n; i += 1) {
      const t = o.from + ((o.to - o.from) * i) / o.n;
      const x = o.axis === "x" ? t : o.fixed;
      const z = o.axis === "x" ? o.fixed : t;
      c.B.cyl("whitePlaster", x, HALL_H / 2, z, 0.55, HALL_H, 12, 0xf6f1e6);
      c.B.box("gold", x, HALL_H - 0.3, z, 1.5, 0.5, 1.5, 0xd9bf80);
      K().solid(c.colliders, x - 0.55, z - 0.55, x + 0.55, z + 0.55, "holy-col");
    }
  }

  /** Roof slabs and ceiling lamps over the halls and the mas'a lane. */
  function roofs(c) {
    const B = c.B;
    const slabs = [
      [-60, -58, 60, -44],
      [-60, 44, 60, 58],
      [-60, -44, -48, 44],
      [47, -44, 60, 44],
      [38.4, -44, 47, 44],
    ];
    slabs.forEach((s) => {
      B.aabb("whitePlaster", s[0], HALL_H, s[1], s[2], HALL_H + 0.8, s[3], 0xefe8d8);
      B.aabb("paint", s[0], HALL_H + 0.8, s[1], s[2], HALL_H + 1.1, s[3], 0xd8cfb8);
    });
    for (let x = -54; x <= 54; x += 12) {
      [-51, 51].forEach((z) => B.box("chandelier", x, HALL_H - 0.4, z, 1.2, 0.2, 1.2, 0xfff1d0));
    }
  }

  /** Outer walls with the gate opening on the north side (x -6..6). */
  function outer(c) {
    const wl = (x0, z0, x1, z1) =>
      K().wall(c.B, c, { x0, z0, x1, z1, y1: HALL_H + 1.1, t: 1.6, key: "whitePlaster" });
    wl(-60, -58, -6, -58);
    wl(6, -58, 60, -58);
    wl(-60, 58, 60, 58);
    wl(-60, -58, -60, 58);
    wl(60, -58, 60, 58);
  }

  /** The gate (King Abdul Aziz style): a tall pointed arch between two towers with green domes. */
  function gate(c) {
    const B = c.B;
    B.geo(
      "whitePlaster",
      K().archSlab(12, 15, 4.6, 6.6, 2.6),
      P.compose(0, 0, -58, 0, 1, 1, 1),
      0xf6f1e4,
    );
    B.aabb("gold", -6.2, 15, -59.4, 6.2, 15.6, -56.6, 0xd9b04a);
    B.aabb("paint", -6.2, 14.7, -59.4, 6.2, 15, -56.6, 0x1f7a4d);
    [-1, 1].forEach((s) => {
      K().dome(c.B, { key: "paint", x: s * 5.2, y: 15.6, z: -58, r: 1.8, k: 1.1, color: 0x2f8f5a });
    });
    K().solid(c.colliders, -6, -59.3, -4.6, -56.7, "mosque-wall");
    K().solid(c.colliders, 4.6, -59.3, 6, -56.7, "mosque-wall");
  }

  /** Safa and Marwa: rocky marble-clad mounds at the two ends of the lane, with arched windows. */
  function hills(c) {
    const B = c.B;
    [-1, 1].forEach((s) => {
      const z = s * 42;
      B.aabb("marble", 39, 0.1, z - 2.4, 46, 0.6, z + 2.4, 0xd8d0c0);
      B.aabb("marble", 40, 0.6, z - 1.8, 45, 1.2, z + 1.8, 0xc9c0ae);
      const rock = new THREE.ConeGeometry(2.6, 2.4, 9);
      B.geo("concrete", rock, P.compose(42.5, 1.2, z + s * 1.2, 0, 1.2, 1, 1), 0x8a6a52);
      B.geo(
        "whitePlaster",
        K().archSlab(8.4, 9, 2.6, 3.2, 0.8),
        P.compose(42.7, 0, s * 44.2, 0, 1, 1, 1),
        MARBLE,
      );
      B.cyl("greenLight", 42.7, 3.5, s * 43.7, 0.2, 0.2, 8, 0xffffff);
    });
    B.aabb("whitePlaster", 38.4, 0, -44.6, 47, 9, -43.8, 0xf0ead9);
    B.aabb("whitePlaster", 38.4, 0, 43.8, 47, 9, 44.6, 0xf0ead9);
    K().solid(c.colliders, 38.4, -44.9, 47, -43.5, "mosque-wall");
    K().solid(c.colliders, 38.4, 43.5, 47, 44.9, "mosque-wall");
  }

  /** The mas'a lane: its two arcaded walls, the green light strips (z -8..8) and ceiling lamps. */
  function masa(c) {
    const B = c.B;
    const lane = KQ.HOLY.makkah.masaLane;
    arcade(c, { axis: "z", fixed: 38.4, from: -44, to: 44, n: 14 });
    arcade(c, { axis: "z", fixed: 47, from: -44, to: 44, n: 14 });
    const g = KQ.HOLY.makkah.greenLights;
    [37.9, 47.5].forEach((x) =>
      B.box("greenLight", x, 6.2, (g.z0 + g.z1) / 2, 0.12, 0.35, g.z1 - g.z0, 0xffffff),
    );
    B.box(
      "greenLight",
      lane.x + 0.7,
      HALL_H - 0.5,
      (g.z0 + g.z1) / 2,
      0.5,
      0.15,
      g.z1 - g.z0,
      0xffffff,
    );
    for (let z = -36; z <= 36; z += 12)
      B.box("chandelier", 42.7, HALL_H - 0.4, z, 0.9, 0.2, 0.9, 0xfff1d0);
    B.aabb("marble", 38.4, 0.1, -44, 47, 0.14, 44, 0xd9d3c3);
  }

  /** Corner and gate minarets. */
  function towers(c) {
    const list = [
      { x: -57, z: -55, h: 72 },
      { x: 57, z: -55, h: 72 },
      { x: -57, z: 55, h: 72 },
      { x: 57, z: 55, h: 72 },
      { x: -14, z: -62, h: 64 },
      { x: 14, z: -62, h: 64 },
      { x: 62, z: 0, h: 60 },
    ];
    K().minarets(c.B, list, c);
  }

  /** Tall flood lamps around the courtyard (their halos glow at night). */
  function lights(c) {
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      K().lamp(c.B, c, Math.cos(a) * 33, Math.sin(a) * 36, 9);
    }
  }

  /** Build the whole Haram into the context (batch + colliders). */
  function build(c) {
    floors(c);
    kaaba(c);
    hijr(c);
    maqam(c);
    zamzam(c);
    wudu(c);
    outer(c);
    arcade(c, { axis: "x", fixed: -44, from: -48, to: 38.4, n: 13 });
    arcade(c, { axis: "x", fixed: 44, from: -48, to: 38.4, n: 13 });
    arcade(c, { axis: "z", fixed: -48, from: -44, to: 44, n: 14 });
    [-51, 51].forEach((z) => columnRow(c, { axis: "x", fixed: z, from: -57, to: 57, n: 19 }));
    columnRow(c, { axis: "z", fixed: -54, from: -38, to: 38, n: 12 });
    columnRow(c, { axis: "z", fixed: 53.5, from: -38, to: 38, n: 12 });
    roofs(c);
    gate(c);
    hills(c);
    masa(c);
    towers(c);
    lights(c);
  }

  P.HolyHaram = { build, arcade };
})((window.KQ = window.KQ || {}));
