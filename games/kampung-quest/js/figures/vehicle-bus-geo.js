/* ============================================================================
 * FILE: vehicle-bus-geo.js
 * PURPOSE: Kampung Quest — the town bus (F.VehicleBig.bus): a modern, generic, unbranded low-floor single-decker.
 *          Its body is moulded like the cars (F.VehicleLoft): a rounded front with a big raked windscreen, rounded
 *          roof edges, round wheel arches, a light body with a green stripe and a dark skirt, a black-framed band
 *          of see-through windows down both sides (you can see the seats and poles inside), an LED destination sign
 *          reading "KAMPUNG 21" (front, side, and "21" at the back; lit dot by dot), LED lamps, rabbit-ear mirrors,
 *          a driver's cab. Two doors on the LEFT (Singapore): a two-leaf fold-out door at the front and a sliding
 *          plug door in the middle, each its own mesh on a pivot (F.Vehicles.setDoors / rig.doors[k].open).
 *            F.VehicleBig.bus(low) -> { body, trim, glass, doors: [door], seats, exhaust, axles, width, length,
 *                                       mid, wheelR, inset, driverX, steerAt }
 *            F.VehicleBig.doorRig(v, door, mat) -> a rig door {side, seat, pivot, kind, pose(e)}
 *          Local frame: faces +z, left +x, origin on the ground mid-wheelbase.
 * BUSINESS CONTEXT: owner's realism pass ("bus: modern low-floor, rounded front, big windscreen, LED sign,
 *   windows you can see through, fold doors on the left, seats and poles"), notes-vehicles.md.
 * DEPENDENCIES: KQ.Figures.VehicleLoft, VehicleParts, VehicleMats, Geo; THREE.
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicles-ground.spec.mjs tests/kampung-quest-vehicle-rig.spec.mjs
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const P = () => F.VehicleParts;
  const L = () => F.VehicleLoft;
  const C = () => F.VehicleMats.CLS;
  const PI = Math.PI;
  const BLACK = "#121316";
  const GREEN = "#2f8f5b";
  const cache = {};
  const T = (g, cls) => P().tag(g, cls === undefined ? 0 : cls);
  /** Sizes: ends, width, roof, wheel radius, axles, floor, waist, the two left doors' centres and width. */
  const BUS = {
    zf: 5.05,
    zr: -5.0,
    w: 2.45,
    roof: 3.05,
    r: 0.48,
    axF: 2.7,
    axR: -2.4,
    floor: 0.36,
    m: 1.0,
    bot: 0.32,
  };
  const DOORS = [
    { z: 3.95, w: 1.15, kind: "fold" },
    { z: 0.2, w: 1.2, kind: "slide" },
  ];
  const N_LO = 8;
  const N_UP = 6;
  /** Heights of the window band (glass) and its black frame. */
  const WIN = { lo: 1.27, hi: 2.58, frameLo: 1.21, frameHi: 2.66 };

  /** The ring angle at height y on the mid-body section (inverse of the superellipse halves). */
  function ringAt(y) {
    if (y >= BUS.m)
      return Math.asin(Math.pow(Math.min(1, (y - BUS.m) / (BUS.roof - BUS.m)), N_UP / 2));
    return -Math.asin(Math.pow(Math.min(1, (BUS.m - y) / (BUS.m - BUS.bot)), N_LO / 2));
  }

  /** The bus's section: square-ish with rounded roof edges, round arches over the axles. */
  function sec(z) {
    let b = BUS.bot;
    [BUS.axF, BUS.axR].forEach(function (ax) {
      const dz = Math.abs(z - ax);
      if (dz < 0.6) b = Math.max(b, BUS.r + Math.sqrt(0.36 - dz * dz));
    });
    return {
      b,
      t: BUS.roof,
      m: Math.max(BUS.m, b + 0.08),
      hwLo: BUS.w / 2,
      hwUp: BUS.w / 2,
      nLo: N_LO,
      nUp: N_UP,
      tuck: 0.05,
    };
  }

  /** Plan: rounded front corners, the windscreen's top leaning back; a nearly square back. */
  function plan(z, y) {
    const zc = 0;
    const front = z > zc;
    const end = front ? BUS.zf - 0.28 * P().smooth(1.0, BUS.roof, y) : BUS.zr;
    const u = Math.abs(z - zc) / Math.abs(end - zc);
    if (u >= 1) return 0;
    const m = front ? 22 : 40;
    return Math.pow(1 - Math.pow(u, m), 1 / m);
  }

  const BODY = { zf: BUS.zf, zr: BUS.zr, sec: (st) => sec(st.z), plan };

  /** Is z in left door k's opening? */
  const inDoor = (z) => DOORS.some((d) => Math.abs(z - d.z) < d.w / 2);

  /** The layer of a body quad: door holes (left), windscreen and windows (glass), frames and sign band (trim). */
  function owner(zc, a, sx) {
    const y = (lo) => ringAt(lo);
    if (sx > 0 && inDoor(zc) && a < y(WIN.frameHi)) return "hole:body";
    const frontFace = zc > BUS.zf - 0.45;
    if (frontFace)
      return a > y(0.98) && a < y(2.62)
        ? "glass:body"
        : a >= y(2.62) && a < y(2.98)
          ? "trim:body"
          : "paint:body";
    if (zc < BUS.zr + 0.15)
      return a > y(1.9) && a < y(2.6) && Math.abs(zc) > 0 ? "glass:body" : "paint:body";
    if (a > y(WIN.lo) && a < y(WIN.hi)) return pillar(zc) ? "trim:body" : "glass:body";
    if (a > y(WIN.frameLo) && a < y(WIN.frameHi)) return "trim:body";
    return "paint:body";
  }

  /** Is z on a window pillar (one every 1.3 m, behind the front door)? */
  function pillar(z) {
    if (z > 3.4) return Math.abs(z - 4.6) < 0.06;
    const f = (((z - 0.95) % 1.3) + 1.3) % 1.3;
    return f < 0.09;
  }

  /** The livery as vertex colours: dark skirt, a green stripe under the windows and one along the roof edge. */
  function livery(st, rg, y) {
    if (rg.a <= -1.45) return "#141517";
    if (y < 0.46) return "#3b3f46";
    if (y > 0.88 && y < 1.1) return GREEN;
    if (y > 2.72 && y < 2.78) return GREEN;
    return null;
  }

  /** The body skin as layer pieces (door openings left out: the doors are their own meshes). */
  function skin(low) {
    const ys = [
      0.42,
      0.46,
      0.7,
      0.88,
      0.98,
      1.1,
      WIN.frameLo,
      WIN.lo,
      1.9,
      WIN.hi,
      2.62,
      WIN.frameHi,
      2.72,
      2.78,
      2.86,
      2.98,
    ];
    const ring = [
      { a: -PI / 2, tag: "" },
      { a: -1.45, tag: "" },
    ].concat(ys.map((y) => ({ a: ringAt(y), tag: "" })));
    [0.3, 0.55, 0.8, 1.05, 1.3, PI / 2]
      .slice(low ? 3 : 0)
      .forEach((a) => a > ringAt(2.98) && ring.push({ a, tag: "" }));
    ring.sort((p, q) => p.a - q.a);
    const extra = [BUS.zf - 0.45, BUS.zr + 0.15];
    DOORS.forEach((d) => extra.push(d.z - d.w / 2, d.z + d.w / 2));
    [BUS.axF, BUS.axR].forEach((ax) => extra.push(ax - 0.6, ax + 0.6, ax - 0.3, ax + 0.3, ax));
    for (let z = 0.95 - 1.3 * 4; z < 3.4; z += 1.3) extra.push(z, z + 0.09);
    extra.push(4.54, 4.66);
    const st = L().stations(BUS.zr, BUS.zf, low ? 20 : 34, extra, 6);
    const out = L().loft(Object.assign({ owner }, BODY), st, ring, livery);
    delete out["hole:body"];
    return out;
  }

  /* ------------------------------ LED sign ------------------------------ */

  /** 5 x 7 dot glyphs (rows top to bottom, "1" = lit). */
  const GLYPHS = {
    K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
    2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
    1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  };

  /** The lit dots of a text, centred, as [x, y] in dot units (x right, y up). */
  function dots(text) {
    const out = [];
    const w = text.length * 6 - 1;
    text.split("").forEach(function (ch, i) {
      (GLYPHS[ch] || GLYPHS[" "]).forEach(function (row, r) {
        for (let c = 0; c < 5; c += 1) if (row[c] === "1") out.push([i * 6 + c - w / 2, 3 - r]);
      });
    });
    return out;
  }

  /** An LED sign: amber dots (lit, class "sign") on a black panel, at `at`, turned by yaw, dot pitch `pitch`. */
  function ledSign(text, at, yaw, pitch) {
    const parts = [];
    const n = text.length * 6;
    parts.push(
      T(P().box(n * pitch + 0.06, 9 * pitch, 0.012, [0, 0, -0.008], "#0c0c0d"), C().gloss),
    );
    dots(text).forEach(function (d) {
      const q = P().paint(new THREE.PlaneGeometry(pitch * 0.72, pitch * 0.72), "#ffb21e");
      parts.push(T(q.translate(d[0] * pitch, d[1] * pitch, 0.001), C().sign));
    });
    return F.Geo.merge(parts).rotateY(yaw).translate(at[0], at[1], at[2]);
  }

  /** The three signs: front (route + name), left side by the front door, back (route number). */
  function signs() {
    const test = (x, y, z) => L().inside(BODY, x, y, z);
    const t = L().hit(test, [0, 2.8, BUS.zf + 1], [0, 0, -1], 3) || 1;
    return [
      ledSign("KAMPUNG 21", [0, 2.8, BUS.zf + 1 - t + 0.02], 0, 0.026),
      ledSign("KAMPUNG 21", [BUS.w / 2 + 0.012, 2.44, 2.2], PI / 2, 0.02),
      ledSign("21", [0, 2.62, BUS.zr - 0.012], PI, 0.03),
    ];
  }

  /* ------------------------------ dress ------------------------------ */

  /** A decal on the bus's front (dir -1 shoots back from ahead) or rear face. */
  function face(x0, x1, y0, y1, dir, eps, hex, cls) {
    const test = (x, y, z) => L().inside(BODY, x, y, z);
    const zo = dir < 0 ? BUS.zf + 1 : BUS.zr - 1;
    return L().decal(
      test,
      3,
      1,
      (u, v) => [
        [x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, zo],
        [0, 0, -dir],
      ],
      eps,
      hex,
      cls,
    );
  }

  /** Head lamps, DRLs, indicators (front), tail / brake / indicator / reverse clusters (rear), bumpers, plates. */
  function lamps() {
    const out = [];
    [-1, 1].forEach(function (k) {
      const x = k * 0.82;
      out.push(face(x - 0.22, x + 0.22, 0.56, 0.78, -1, 0.004, "#15171b", C().gloss));
      out.push(face(x - 0.18, x + 0.04, 0.6, 0.74, -1, 0.008, "#eef3fb", C().head));
      out.push(face(x - 0.2, x + 0.2, 0.76, 0.78, -1, 0.008, "#eef3fb", C().drl));
      out.push(
        face(
          x + k * 0.06,
          x + k * 0.18,
          0.6,
          0.74,
          -1,
          0.008,
          "#f39a1e",
          k > 0 ? C().indL : C().indR,
        ),
      );
      out.push(face(x - 0.12, x + 0.12, 0.6, 1.3, 1, 0.004, "#2a0a0d", C().gloss));
      out.push(face(x - 0.1, x + 0.1, 1.0, 1.26, 1, 0.008, "#c0121b", C().tail));
      out.push(face(x - 0.1, x + 0.1, 0.84, 0.98, 1, 0.008, "#e1141f", C().brake));
      out.push(
        face(x - 0.1, x + 0.1, 0.72, 0.82, 1, 0.008, "#f39a1e", k > 0 ? C().indL : C().indR),
      );
      out.push(face(x - 0.1, x + 0.1, 0.62, 0.7, 1, 0.008, "#eef1f4", C().reverse));
    });
    out.push(face(-0.5, 0.5, 2.92, 2.96, 1, 0.006, "#e1141f", C().brake));
    out.push(face(-1.0, 1.0, 1.1, 1.5, 1, 0.004, "#26282c", C().matte));
    return out.filter(Boolean);
  }

  /** A rabbit-ear mirror on a curved arm at the front corner (k = side). */
  function mirror(k) {
    const p = P();
    return [
      T(
        p.bent(
          [
            [k * 1.1, 2.55, BUS.zf - 0.25],
            [k * 1.32, 2.62, BUS.zf + 0.05],
            [k * 1.26, 2.25, BUS.zf + 0.3],
          ],
          0.025,
          BLACK,
          10,
        ),
        C().gloss,
      ),
      T(p.lens(0.12, 0.36, 0.06, [k * 1.26, 2.05, BUS.zf + 0.3], BLACK, null, 10), C().gloss),
    ];
  }

  /** Bumpers, plates, wipers, the mirrors, an exhaust pipe and the roof pods. */
  function fittings() {
    const p = P();
    const plate = (z) => p.block(0.52, 0.12, 0.03, [0, 0.5, z], "#141516");
    const parts = [
      T(p.block(BUS.w * 0.94, 0.2, 0.14, [0, 0.42, BUS.zf - 0.02], "#3b3f46"), C().satin),
      T(p.block(BUS.w * 0.94, 0.2, 0.14, [0, 0.42, BUS.zr + 0.02], "#3b3f46"), C().satin),
      plate(BUS.zf + 0.06),
      plate(BUS.zr - 0.06),
      T(p.block(1.5, 0.28, 2.6, [0, BUS.roof + 0.1, -2.9], "#d9dcdf"), C().satin),
      T(p.drum("z", 0.05, 0.2, [-0.9, 0.3, BUS.zr + 0.05], "#6b6f76", 10), C().satin),
    ];
    [-0.5, 0.45].forEach((x) =>
      parts.push(
        T(p.rod([x, 1.02, BUS.zf - 0.02], [x - 0.6, 1.08, BUS.zf - 0.04], 0.012, BLACK), C().satin),
      ),
    );
    [-1, 1].forEach((k) => parts.push(...mirror(k)));
    return parts;
  }

  /* ------------------------------ inside ------------------------------ */

  /** The seat layout: [x, z, heading] of each seat (forward rows both sides, a bench at the back). */
  function seatSpots() {
    const out = [];
    for (let z = 2.9; z > -4.3; z -= 0.82) [-0.95, -0.55].forEach((x) => out.push([x, z, 0]));
    for (let z = -0.95; z > -4.3; z -= 0.82) [0.55, 0.95].forEach((x) => out.push([x, z, 0]));
    [2.6, 1.8].forEach((z) => out.push([0.98, z, -PI / 2]));
    [-0.9, -0.45, 0, 0.45, 0.9].forEach((x) => out.push([x, -4.6, 0]));
    return out;
  }

  /** One bus seat (box shell, cushion, back, grab handle) at a spot. */
  function seat(s) {
    const p = P();
    const g = F.Geo.merge([
      p.box(0.4, 0.08, 0.42, [0, 0.8, 0], "#2d6f8f"),
      p.box(0.4, 0.5, 0.07, [0, 1.06, -0.2], "#2d6f8f"),
      T(p.box(0.36, 0.05, 0.04, [0, 1.33, -0.21], "#c9ccd2"), C().chrome),
      p.box(0.3, 0.38, 0.3, [0, 0.56, 0], "#3a3d44"),
    ]);
    return g.rotateY(s[2]).translate(s[0], 0, s[1]);
  }

  /** Floor, walls under the windows, ceiling, seats, yellow poles and rails, the driver's cab. */
  function inside() {
    const p = P();
    const len = BUS.zf - BUS.zr - 0.6;
    const parts = [
      p.box(BUS.w - 0.2, 0.03, len, [0, BUS.floor, 0], "#5b5f66"),
      p.box(BUS.w - 0.24, 0.02, len, [0, BUS.roof - 0.16, 0], "#e6e7e3"),
      p.box(0.03, 0.85, len, [BUS.w / 2 - 0.1, 0.8, 0], "#c9ccd0"),
      p.box(0.03, 0.85, len, [-BUS.w / 2 + 0.1, 0.8, 0], "#c9ccd0"),
      p.box(0.06, 1.2, 0.5, [-0.45, 1.0, 3.55], "#3a3d44"),
      p.lens(1.0, 0.3, 0.5, [-0.7, 1.05, 4.6], "#25272c", null, 10),
      p.box(0.45, 0.1, 0.45, [-0.75, 0.9, 3.95], "#2a2c31"),
      p.box(0.45, 0.6, 0.08, [-0.75, 1.25, 3.72], "#2a2c31"),
    ].concat(seatSpots().map(seat));
    const pole = (x, z) =>
      T(p.rod([x, BUS.floor, z], [x, BUS.roof - 0.16, z], 0.022, "#f2c230", 6), C().gloss);
    for (let z = 2.5; z > -4.3; z -= 1.64) parts.push(pole(-0.32, z), pole(0.32, z));
    [-0.6, 0.6].forEach((x) =>
      parts.push(
        T(
          p.rod([x, BUS.roof - 0.4, 3.2], [x, BUS.roof - 0.4, -4.2], 0.02, "#f2c230", 6),
          C().gloss,
        ),
      ),
    );
    return F.Geo.merge(parts.map((g) => (g.attributes.aSkin ? g : T(g))));
  }

  /** Bus seats as rig seats (the seated figure's origin: cushion top 0.84 minus the drop). */
  function rigSeats() {
    const out = [{ pos: [-0.75, 0.68, 3.95], heading: 0, kind: "driver" }];
    seatSpots().forEach((s) => out.push({ pos: [s[0], 0.57, s[1]], heading: s[2], kind: "bus" }));
    return out;
  }

  /* ------------------------------ doors ------------------------------ */

  /** A glazed door leaf (frame, dark glass, a rubber edge), `w` wide, extending from its hinge along `dir` z. */
  function leaf(w, dir) {
    const p = P();
    const h = 2.28;
    const g = F.Geo.merge([
      T(p.box(0.05, h, w, [0, 0.36 + h / 2, (dir * w) / 2], "#2e3340"), C().satin),
      T(p.box(0.056, h - 0.4, w - 0.12, [0, 0.5 + h / 2, (dir * w) / 2], "#3d5269"), C().gloss),
      T(p.box(0.06, h, 0.03, [0, 0.36 + h / 2, dir * (w - 0.015)], "#111214"), C().rubber),
    ]);
    return g;
  }

  /** The door descriptions: the front fold-out door (two leaves) and the middle sliding plug door. */
  function doorSpecs() {
    const x = BUS.w / 2 + 0.03;
    const f = DOORS[0];
    const m = DOORS[1];
    return [
      {
        side: "L",
        seat: 0,
        kind: "fold",
        x,
        leaves: [
          { geo: leaf(f.w / 2, -1), at: [x, 0, f.z + f.w / 2], swing: -1 },
          { geo: leaf(f.w / 2, 1), at: [x, 0, f.z - f.w / 2], swing: 1 },
        ],
      },
      {
        side: "L",
        seat: 1 + seatSpots().findIndex((s) => s[0] > 0 && Math.abs(s[1] - m.z) < 2),
        kind: "slide",
        x,
        z: m.z,
        slide: m.w / 2 + 0.05,
        leaves: [
          {
            geo: F.Geo.merge([
              leaf(m.w / 2, -1).translate(0, 0, m.w / 2),
              leaf(m.w / 2, 1).translate(0, 0, -m.w / 2),
            ]),
            at: [x, 0, m.z],
          },
        ],
      },
    ];
  }

  /** Build a bus door's meshes on its pivots and its rig door (pose(e) with e the eased 0..1 opening). */
  function doorRig(v, d, mat) {
    const pivot = new THREE.Group();
    pivot.name = "door-pivot";
    v.group.add(pivot);
    const leaves = d.leaves.map(function (l) {
      const g = new THREE.Group();
      g.position.set(l.at[0], l.at[1], l.at[2]);
      const m = new THREE.Mesh(l.geo, mat);
      m.name = "door";
      g.add(m);
      pivot.add(g);
      return { g, l };
    });
    const pose = (e) =>
      leaves.forEach(function (it) {
        if (d.kind === "fold") it.g.rotation.y = it.l.swing * 1.45 * e;
        else it.g.position.set(it.l.at[0] + Math.min(e * 3, 1) * 0.07, 0, it.l.at[2] - e * d.slide);
      });
    return { side: d.side, seat: d.seat, pivot, kind: d.kind, pose };
  }

  /** The bus's shared geometries (per tier). */
  function bus(low) {
    const key = low ? "low" : "hi";
    if (cache[key]) return cache[key];
    const old = P().setDetail(low ? 0.55 : 1);
    const sk = skin(low);
    const trim = [
      sk["trim:body"] && F.VehicleCars.recolour(sk["trim:body"], BLACK, C().gloss),
      inside(),
    ]
      .concat(lamps(), fittings(), signs())
      .filter(Boolean);
    cache[key] = {
      style: "bus",
      body: sk["paint:body"],
      trim: F.Geo.merge(trim.map((g) => (g.attributes.aSkin ? g : T(g)))),
      glass: sk["glass:body"],
      doors: doorSpecs(),
      seats: rigSeats(),
      exhaust: [-0.9, 0.3, BUS.zr - 0.06],
      axles: [BUS.axF, BUS.axR],
      width: BUS.w,
      length: BUS.zf - BUS.zr,
      mid: (BUS.zf + BUS.zr) / 2,
      wheelR: BUS.r,
      inset: 0.3,
      driverX: -0.75,
      steerAt: [1.25, 4.35],
      noBlob: true,
    };
    P().setDetail(old);
    return cache[key];
  }

  F.VehicleBig = Object.assign(F.VehicleBig || {}, { bus, doorRig, BUS });
})((window.KQ = window.KQ || {}));
