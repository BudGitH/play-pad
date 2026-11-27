/* ============================================================================
 * FILE: holy-madinah.js
 * PURPOSE: Madinah outside Masjid Nabawi (KQ.WorldParts.HolyMadinah): photo sand ground, streets,
 *          hotels, palms, Masjid Quba (white, four minarets), Jabal Uhud, the Baqi' (a plain
 *          walled yard with no graves shown) and the ring of dark hills.
 * BUSINESS CONTEXT: AC-H1 (scenery), AC-H5 (ziarah places). Qibla is +z (south) in this city.
 * DEPENDENCIES: holy-kit.js, holy-makkah.js (road builder shape), geo.js, KQ.HOLY.madinah.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const K = () => P.HolyKit;
  const BOUNDS = { x0: 480, x1: 725, z0: -215, z1: 160 };
  const ROADS = [
    { axis: "x", at: -105, from: 490, to: 720, w: 12 },
    { axis: "x", at: 60, from: 530, to: 700, w: 12 },
    { axis: "z", at: 530, from: -105, to: 150, w: 10 },
    { axis: "z", at: 700, from: -105, to: 150, w: 10 },
    { axis: "z", at: 560, from: 60, to: 150, w: 8 },
    { axis: "z", at: 600, from: -200, to: -105, w: 10 },
  ];
  const HOTELS = [
    [490, -100, 520, -50, 60],
    [490, -40, 520, 20, 72],
    [706, -100, 724, -50, 66],
    [706, -40, 724, 30, 58],
    [600, 70, 690, 110, 54],
    [580, 130, 600, 150, 48],
    [492, 70, 520, 130, 64],
    [500, -160, 580, -118, 50],
    [624, -160, 690, -118, 58],
  ];

  /** The Quba domes (one big, four small) and four minarets. */
  function qubaRoof(c, q) {
    const dome = (dx, dz, r) =>
      K().dome(c.B, {
        key: "paint",
        x: q.x + dx,
        y: 9.8,
        z: q.z + dz,
        r,
        k: 0.95,
        color: 0xf2eee2,
        drumKey: "whitePlaster",
      });
    dome(0, 0, 5);
    [-9, 9].forEach((dx) => [-5, 5].forEach((dz) => dome(dx, dz, 1.9)));
    const list = [];
    [-15, 15].forEach((dx) =>
      [-11, 11].forEach((dz) => list.push({ x: q.x + dx, z: q.z + dz, h: 36 })),
    );
    K().minarets(c.B, list, c);
  }

  /** Quba mosque: a white hall of arched walls round a green carpet, domes and 4 minarets. */
  function quba(c) {
    const B = c.B;
    const q = KQ.HOLY.madinah.quba;
    B.aabb("marble", q.x - 24, 0, q.z - 22, q.x + 24, 0.1, q.z + 22, 0xf1ece0);
    B.aabb("greenCarpet", q.x - 11, 0.1, q.z - 7, q.x + 11, 0.14, q.z + 7, 0xffffff);
    const run = (axis, fixed) =>
      P.HolyHaram.arcade(c, {
        axis,
        fixed,
        from: axis === "x" ? q.x - 12 : q.z - 8,
        to: axis === "x" ? q.x + 12 : q.z + 8,
        n: axis === "x" ? 4 : 3,
        t: 0.8,
      });
    [q.z - 8, q.z + 8].forEach((z) => run("x", z));
    [q.x - 12, q.x + 12].forEach((x) => run("z", x));
    B.aabb("whitePlaster", q.x - 12.5, 9, q.z - 8.5, q.x + 12.5, 9.8, q.z + 8.5, 0xf6f1e6);
    qubaRoof(c, q);
  }

  /** The Baqi': a plain walled yard of beige gravel, a gate gap on the west side. Nothing inside it is modelled. */
  function baqi(c) {
    const b = KQ.HOLY.madinah.baqi;
    const x0 = b.x - 15;
    const x1 = b.x + 15;
    const z0 = b.z - 15;
    const z1 = b.z + 15;
    c.B.aabb("dirt", x0, 0, z0, x1, 0.06, z1, 0xe0d0ae);
    const wl = (a, bz, cx, dz) =>
      K().wall(c.B, c, {
        x0: a,
        z0: bz,
        x1: cx,
        z1: dz,
        y1: 2.6,
        t: 0.7,
        color: 0xe6dcc4,
        kind: "fence",
      });
    wl(x0, z0, x1, z0);
    wl(x0, z1, x1, z1);
    wl(x1, z0, x1, z1);
    wl(x0, z0, x0, b.z - 3);
    wl(x0, b.z + 3, x0, z1);
    [b.z - 3.4, b.z + 3.4].forEach((z) => c.B.box("whitePlaster", x0, 1.8, z, 1, 3.6, 1, 0xf4efe4));
  }

  /** Madinah palm spots: rows along the umbrella plaza, the streets and the Quba road. */
  function palmSpots() {
    const out = [];
    for (let x = 545; x <= 655; x += 18) out.push({ x, z: -93, s: 1.05 });
    for (let x = 500; x <= 700; x += 20) {
      if (x !== 600) out.push({ x, z: -117, s: 1 });
      out.push({ x, z: 52, s: 1 });
    }
    for (let z = -95; z <= 140; z += 24) out.push({ x: 539, z, s: 1 }, { x: 691, z, s: 1.05 });
    return out.filter((p) => !(p.z > -35 && p.z < 52 && p.x > 545 && p.x < 650));
  }

  /** Hotels: a podium and tower in the facade styles (stone and glass alternate), as colliders. */
  function hotels(c, free) {
    HOTELS.forEach((h, i) => {
      P.HolyCity.block(c, {
        x0: h[0],
        z0: h[1],
        x1: h[2],
        z1: h[3],
        h: P.HolyCity.floors(h[4]),
        style: i % 2 ? "hotel" : "stoneHotel",
        seed: 200 + i,
        solid: true,
      });
      free.addBuilt(h[0] - 3, h[1] - 3, h[2] + 3, h[3] + 3);
    });
  }

  /** Madinah is lower than Makkah: inner blocks and a backdrop ring of mid-rise blocks inside the hills. */
  function cityFill(c, free) {
    const cfg = {
      seed: 411,
      cell: [34, 30],
      density: 0.95,
      origin: [600, -20],
      hBase: 62,
      hFall: 0.08,
      hMax: 54,
      solid: true,
      pads: true,
    };
    P.HolyCity.fill(c, cfg, free, { x0: BOUNDS.x0, z0: BOUNDS.z0, x1: BOUNDS.x1, z1: BOUNDS.z1 });
    const ring = Object.assign({}, cfg, { seed: 412, solid: false, pads: false, cell: [48, 44] });
    const inEllipse = (x, z) => ((x - 600) / 255) ** 2 + ((z + 40) / 215) ** 2 < 1;
    const outside = (x, z) => x < BOUNDS.x0 || x > BOUNDS.x1 || z < BOUNDS.z0 || z > BOUNDS.z1;
    P.HolyCity.fill(
      c,
      ring,
      free,
      { x0: 420, z0: -300, x1: 790, z1: 230 },
      (x, z) => outside(x, z) && inEllipse(x, z),
    );
  }

  /** Hills: Uhud (a big rocky range, behind a small viewing plaza) and a ring of hills. */
  function hillsList() {
    const u = KQ.HOLY.madinah.uhud;
    const out = [
      { x: u.x, z: u.z - 38, w: 90, h: 58, seed: 3 },
      { x: u.x - 75, z: u.z - 45, w: 60, h: 36, seed: 1 },
      { x: u.x + 80, z: u.z - 42, w: 66, h: 40, seed: 2 },
    ];
    const r = P.rng(31);
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2;
      out.push({
        x: 600 + Math.cos(a) * 300 + r() * 20,
        z: -40 + Math.sin(a) * 250 + r() * 20,
        w: 70 + r() * 50,
        h: 34 + r() * 30,
        seed: 1 + (i % 3),
      });
    }
    return out.filter((h) => h.z > -230 || Math.abs(h.x - u.x) < 140);
  }

  /** Build Madinah outside the mosque. Returns what the world needs (palms, hills). */
  function build(c) {
    P.HolyGround.sand(c, { x0: 360, z0: -440, x1: 950, z1: 340 });
    const free = P.HolyLots.make("madinah");
    ROADS.forEach((r) => P.HolyMakkah.road(c, r));
    c.B.aabb("marble", 585, 0, -200, 615, 0.1, -180, 0xe9e3d2);
    c.B.aabb("marble", 590, 0, -116, 610, 0.1, -88, 0xe9e3d2);
    hotels(c, free);
    quba(c);
    baqi(c);
    const tl = KQ.HOLY.madinah.tailor;
    const sign = { title: "TAILOR", sub: "Thobes · Kufis · Clothes" };
    P.Tailor.build(c.B, c, { x: tl.x, z: tl.z, face: 1 }, sign);
    const bs = KQ.HOLY.madinah.busStop;
    c.B.aabb("paint", bs.x - 3, 2.8, bs.z - 1.2, bs.x + 3, 3, bs.z + 1.6, 0x1f7a4d);
    [-2.6, 2.6].forEach((dx) => c.B.cyl("metal", bs.x + dx, 1.4, bs.z + 1, 0.07, 2.8, 6, 0x8e959b));
    for (let x = 500; x <= 700; x += 40) K().lamp(c.B, c, x, -96, 8);
    cityFill(c, free);
    return { palms: palmSpots(), hills: hillsList(), free };
  }

  P.HolyMadinah = { build, BOUNDS, ROADS };
})((window.KQ = window.KQ || {}));
