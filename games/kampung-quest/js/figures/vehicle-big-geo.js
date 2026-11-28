/* ============================================================================
 * FILE: vehicle-big-geo.js
 * PURPOSE: Kampung Quest — the lorry (F.VehicleBig.lorry): a modern Japanese-style light truck, generic and
 *          unbranded. A cab-over cab moulded like the cars (F.VehicleLoft: rounded front corners, a raked wrap-round
 *          windscreen, roof edges rounded, sides leaning in), with a black grille band, LED head lamps low on the
 *          corners, a bumper with steps, big mirrors on arms, a cab interior (dash, two seats, the wheel) seen
 *          through clear glass; behind it a chassis, a flat tray with drop sides and a green canvas canopy, dual
 *          rear wheels, rear lamps on the chassis, an under-run bar, a fuel tank and a diesel exhaust. Its two cab
 *          doors swing on their front edges like a car's (cut out of the cab only while open).
 *            F.VehicleBig.lorry(lhd, low) -> a geometry set (F.VehicleCars.makeSet) with doors, seats, exhaust
 *          Also F.VehicleBig.bus (vehicle-bus-geo.js) and doorRig (the bus's own door meshes).
 *          Local frame: faces +z, left +x, the origin on the ground mid-wheelbase.
 * BUSINESS CONTEXT: owner's realism pass ("lorry: modern Japanese-style light truck cab, curved, with a canopy"),
 *   features/kampung-quest-playability/notes-vehicles.md.
 * DEPENDENCIES: KQ.Figures.VehicleLoft, VehicleParts, VehicleMats, VehicleCars (makeSet, recolour), Geo.
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicles-ground.spec.mjs tests/kampung-quest-vehicle-rig.spec.mjs
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const P = () => F.VehicleParts;
  const L = () => F.VehicleLoft;
  const C = () => F.VehicleMats.CLS;
  const PI = Math.PI;
  const BLACK = "#16171a";
  const DARK = "#2b2d33";
  const cache = {};
  const T = (g, cls) => P().tag(g, cls === undefined ? 0 : cls);

  /** Lorry sizes: cab front / back, tray front / back, deck height, width, wheel radius, axles, cab roof. */
  const LOR = {
    zf: 2.55,
    cab: 1.12,
    tray: 1.02,
    zr: -2.7,
    deck: 0.92,
    w: 1.9,
    r: 0.38,
    axF: 1.75,
    axR: -1.5,
    roof: 2.24,
  };
  /** Window band (ring angles on the cab's upper half), door span, door index sides. */
  const WIN = [0.02, 0.56];
  const DOOR = [2.12, 1.22];

  /** The cab's section: a boxy bottom, a rounded roof edge, the sides leaning in toward the roof. */
  function cabSec(z) {
    const dz = Math.abs(z - LOR.axF);
    const arch = 0.5;
    const b = dz < arch ? LOR.r + Math.sqrt(arch * arch - dz * dz) : 0.5;
    return {
      b: Math.max(0.5, b),
      t: LOR.roof,
      m: 1.3,
      hwLo: LOR.w / 2,
      hwUp: LOR.w / 2,
      nLo: 9,
      nUp: 5,
      tuck: 0.12,
    };
  }

  /** The cab's plan: rounded front corners with the windscreen raked back, a square back. */
  function cabPlan(z, y) {
    const zc = (LOR.zf + LOR.cab) / 2;
    const front = z > zc;
    const end = front ? LOR.zf - 0.24 * P().smooth(1.25, 2.24, y) : LOR.cab;
    const u = Math.abs(z - zc) / Math.abs(end - zc);
    if (u >= 1) return 0;
    const m = front ? 5 : 16;
    return Math.pow(1 - Math.pow(u, m), 1 / m);
  }

  const CAB = { zf: LOR.zf, zr: LOR.cab, sec: (st) => cabSec(st.z), plan: cabPlan };

  /** The layer and owner of a cab quad: windscreen, door skins and windows, frames, the rest painted. */
  function cabOwner(zc, a, sx) {
    const door = zc < DOOR[0] - 0.005 && zc > DOOR[1] + 0.005 ? (sx > 0 ? 1 : 0) : -1;
    const own = (layer) => layer + ":" + (door < 0 ? "body" : "door" + door);
    if (a > WIN[0] && a < WIN[1]) {
      if (zc > LOR.zf - 0.3) return "glass:body";
      return door < 0 ? "paint:body" : own("glass");
    }
    if ((a > WIN[0] - 0.05 && a <= WIN[0]) || (a >= WIN[1] && a < WIN[1] + 0.05))
      return door < 0 && zc < LOR.zf - 0.3 ? "paint:body" : own("trim");
    if (a > -0.95 && a < WIN[0]) return own("paint");
    return "paint:body";
  }

  /** The cab's skin as layer pieces. */
  function cabPieces(low) {
    const pick = (lo, hi, n) =>
      Array.from({ length: n }, (_, i) => ({ a: lo + ((hi - lo) * i) / n, tag: "" }));
    const ring = [].concat(
      pick(-PI / 2, -0.95, 2),
      pick(-0.95, WIN[0] - 0.05, low ? 2 : 4),
      pick(WIN[0] - 0.05, WIN[0], 1),
      pick(WIN[0], WIN[1], low ? 3 : 5),
      pick(WIN[1], WIN[1] + 0.05, 1),
      pick(WIN[1] + 0.05, PI / 2, low ? 3 : 5),
      [{ a: PI / 2, tag: "" }],
    );
    const extra = [DOOR[0], DOOR[1], LOR.zf - 0.3, LOR.axF + 0.5, LOR.axF - 0.5, LOR.axF];
    const st = L().stations(LOR.cab, LOR.zf, low ? 14 : 24, extra, 4);
    const body = Object.assign({ owner: cabOwner }, CAB);
    const out = L().loft(body, st, ring, () => null);
    return Object.keys(out).map(function (key) {
      const [layer, owner] = key.split(":");
      const g = layer === "trim" ? F.VehicleCars.recolour(out[key], BLACK, C().gloss) : out[key];
      return { layer, owner, g };
    });
  }

  /** A decal on the cab's front face over x half-width hw at heights y0..y1. */
  function front(hw, y0, y1, eps, hex, cls) {
    const test = (x, y, z) => L().inside(CAB, x, y, z);
    return L().decal(
      test,
      6,
      1,
      (u, v) => [
        [(u - 0.5) * 2 * hw, y0 + (y1 - y0) * v, LOR.zf + 0.5],
        [0, 0, -1],
      ],
      eps,
      hex,
      cls,
    );
  }

  /** A lamp wrapping a front corner of the cab (k = side) at heights y0..y1. */
  function cornerLamp(k, y0, y1, a0, a1, eps, hex, cls) {
    const test = (x, y, z) => L().inside(CAB, x, y, z);
    const c = [k * (LOR.w / 2 - 0.3), LOR.zf - 0.3];
    const ray = (u, v) => {
      const a = a0 + (a1 - a0) * u;
      const d = [k * Math.sin(a), 0, Math.cos(a)];
      return [
        [c[0] + d[0] * 1.2, y0 + (y1 - y0) * v, c[1] + d[2] * 1.2],
        [-d[0], 0, -d[2]],
      ];
    };
    return L().decal(test, 5, 1, ray, eps, hex, cls);
  }

  /** The cab front: grille band, head lamps, indicators, bumper, steps, plate, wipers, mirrors. */
  function cabFront(scheme) {
    const p = P();
    const parts = [
      front(0.62, 0.92, 1.18, 0.004, BLACK, C().gloss),
      front(0.6, 1.1, 1.12, 0.008, "#9aa0a8", C().chrome),
    ];
    [-1, 1].forEach(function (k) {
      parts.push(cornerLamp(k, 0.66, 0.86, 0.25, 1.1, 0.004, "#15171b", C().gloss));
      parts.push(cornerLamp(k, 0.7, 0.82, 0.3, 0.75, 0.008, "#eef3fb", C().head));
      parts.push(cornerLamp(k, 0.83, 0.85, 0.3, 1.0, 0.008, "#eef3fb", C().drl));
      parts.push(
        cornerLamp(k, 0.7, 0.82, 0.8, 1.05, 0.008, "#f39a1e", k > 0 ? C().indL : C().indR),
      );
      parts.push(
        T(p.block(0.34, 0.04, 0.22, [k * 0.7, 0.42, LOR.cab + 0.55], "#9aa0a8"), C().chrome),
      );
      parts.push(
        T(
          p.rod([k * 0.05, 1.33, LOR.zf - 0.12], [k * 0.55, 1.36, LOR.zf - 0.2], 0.009, BLACK),
          C().satin,
        ),
      );
      parts.push(...lorryMirror(k));
    });
    parts.push(
      T(p.block(LOR.w * 0.98, 0.17, 0.16, [0, 0.52, LOR.zf - 0.02], "#3b3f46"), C().satin),
    );
    parts.push(plate(0.62, LOR.zf + 0.07, 1, scheme.front));
    return parts.filter(Boolean);
  }

  /** A big mirror on a bent arm at the cab's front corner (k = side). */
  function lorryMirror(k) {
    const p = P();
    const x = k * (LOR.w / 2);
    return [
      T(
        p.bent(
          [
            [x - k * 0.05, 1.7, LOR.zf - 0.35],
            [x + k * 0.18, 1.78, LOR.zf - 0.3],
            [x + k * 0.2, 1.6, LOR.zf - 0.25],
          ],
          0.016,
          BLACK,
          10,
        ),
        C().gloss,
      ),
      T(p.lens(0.1, 0.32, 0.07, [x + k * 0.2, 1.5, LOR.zf - 0.25], BLACK, null, 10), C().gloss),
      T(
        p.lens(0.08, 0.28, 0.02, [x + k * 0.2, 1.5, LOR.zf - 0.29], "#8fa2b4", null, 10),
        C().gloss,
      ),
    ];
  }

  /** A plate box on the front (dir 1) or rear (dir -1) at height y, face z. */
  function plate(y, z, dir, colours) {
    const p = P();
    const parts = [p.block(0.5, 0.11, 0.024, [0, y, z], colours[0])];
    [-0.2, -0.165, -0.13, -0.06, -0.025, 0.01, 0.045, 0.12].forEach((x) =>
      parts.push(p.box(0.024, 0.06, 0.008, [x * dir, y, z + dir * 0.014], colours[1])),
    );
    return F.Geo.merge(parts);
  }

  /** The canvas canopy's cross-section: walls with a rounded top over the hoops. */
  function canopyShape() {
    const w = LOR.w / 2 - 0.02;
    const s = new THREE.Shape();
    s.moveTo(-w, 0);
    s.lineTo(-w, 0.95);
    s.quadraticCurveTo(-w, 1.25, -w + 0.3, 1.27);
    s.lineTo(w - 0.3, 1.27);
    s.quadraticCurveTo(w, 1.25, w, 0.95);
    s.lineTo(w, 0);
    s.lineTo(-w, 0);
    return s;
  }

  /** The canopy: the section pushed back along the tray, with ribs, standing on the deck. */
  function canopy() {
    const len = LOR.tray - LOR.zr - 0.1;
    const g = new THREE.ExtrudeGeometry(canopyShape(), {
      depth: len,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 8,
    });
    g.translate(0, LOR.deck + 0.16, LOR.zr + 0.05);
    return T(P().smoothed(P().paint(g, "#3f6b4a"), 45), C().matte);
  }

  /** The diesel exhaust's run under the chassis to its outlet on the right. */
  const EXHAUST = [
    [-0.3, 0.5, 0.6],
    [-0.6, 0.45, 0.3],
    [-0.78, 0.42, 0.1],
  ];

  /** One side's rear lamps on the chassis (k): tail, brake, indicator, reverse. */
  function rearLamps(k) {
    const p = P();
    const z = LOR.zr + 0.01;
    return [
      T(p.block(0.3, 0.12, 0.05, [k * 0.68, 0.62, z + 0.01], "#c0121b"), C().tail),
      T(p.block(0.12, 0.1, 0.055, [k * 0.68, 0.62, z], "#e1141f"), C().brake),
      T(p.block(0.08, 0.08, 0.055, [k * 0.86, 0.62, z], "#f39a1e"), k > 0 ? C().indL : C().indR),
      T(p.block(0.06, 0.06, 0.055, [k * 0.5, 0.62, z], "#eef1f4"), C().reverse),
    ];
  }

  /** The chassis and tray: rails, deck, drop sides, tailboard, rear mudguards, lamps, under-run bar, tank, exhaust. */
  function tray(scheme) {
    const p = P();
    const len = LOR.tray - LOR.zr;
    const zc = (LOR.tray + LOR.zr) / 2;
    const parts = [
      p.block(0.9, 0.18, LOR.zf - LOR.zr - 0.3, [0, 0.55, (LOR.zf + LOR.zr) / 2 - 0.1], BLACK),
      p.block(LOR.w, 0.08, len, [0, LOR.deck, zc], "#6d6256"),
      T(p.drum("z", 0.17, 0.62, [0.6, 0.6, 0.15], "#8d939b", 14), C().chrome),
      T(p.block(LOR.w - 0.2, 0.08, 0.08, [0, 0.38, LOR.zr + 0.1], "#3b3f46"), C().satin),
      T(p.bent(EXHAUST, 0.03, "#5d6168", 10), C().satin),
      canopy(),
      plate(0.62, LOR.zr - 0.02, -1, scheme.rear),
    ];
    [-1, 1].forEach(function (k) {
      parts.push(p.block(0.04, 0.16, len, [k * (LOR.w / 2), LOR.deck + 0.1, zc], "#c9b89a"));
      parts.push(p.halfRing(k * (LOR.w / 2 - 0.12), LOR.r, LOR.axR, 0.5, 0.05, DARK));
      parts.push(...rearLamps(k));
    });
    return parts;
  }

  /** Inside the cab: floor, dash with a screen, two seats, the parked wheel (owner "steer"). */
  function cabInside(driverX) {
    const p = P();
    const seat = "#3a4152";
    const body = F.Geo.merge([
      p.block(LOR.w - 0.2, 0.05, 1.2, [0, 0.98, LOR.cab + 0.62], "#1f2024"),
      p.lens(LOR.w - 0.3, 0.3, 0.4, [0, 1.3, LOR.zf - 0.28], "#25272c", null, 12),
      T(p.box(0.26, 0.14, 0.02, [0, 1.42, LOR.zf - 0.46], "#8fb4d8"), C().screen),
      p.block(0.5, 0.1, 0.48, [driverX, 1.22, 1.76], seat),
      p.block(0.5, 0.1, 0.48, [-driverX, 1.22, 1.76], seat),
      p.block(0.5, 0.6, 0.1, [driverX, 1.55, 1.46], seat, [-0.12, 0, 0]),
      p.block(0.5, 0.6, 0.1, [-driverX, 1.55, 1.46], seat, [-0.12, 0, 0]),
    ]);
    const wheel = P().steering().rotateX(0.64).translate(driverX, 1.24, 2.02);
    return [
      { layer: "trim", owner: "body", g: body },
      { layer: "trim", owner: "steer", g: wheel },
    ];
  }

  /** The lorry's geometry set (`lhd` puts the driver on the left), cached per side and tier. */
  function lorry(lhd, low) {
    const key = "lorry" + (lhd ? "l" : "r") + (low ? "-low" : "");
    if (!cache[key]) cache[key] = P().withDetail(low, () => lorrySet(lhd, low));
    return cache[key];
  }

  /** Build the lorry's geometry set at the detail already chosen (see lorry). */
  function lorrySet(lhd, low) {
    const driverX = lhd ? 0.45 : -0.45;
    const scheme = F.VehicleCars.PLATES[lhd ? "plain" : "black"];
    const trim = F.Geo.merge(
      tray(scheme)
        .concat(cabFront(scheme))
        .map((g) => (g.attributes.aSkin ? g : T(g))),
    );
    const pieces = cabPieces(low).concat(
      [{ layer: "trim", owner: "body", g: trim }],
      cabInside(driverX),
    );
    const doors = [0, 1].map((k) => lorryDoor(k, driverX));
    return F.VehicleCars.makeSet(pieces, doors, {
      style: "lorry",
      driverX,
      seats: [
        { pos: [driverX, 1.0, 1.72], heading: 0, kind: "driver" },
        { pos: [-driverX, 1.0, 1.72], heading: 0, kind: "front" },
      ],
      exhaust: [-0.8, 0.42, 0.08],
      fuel: "diesel",
      axles: [LOR.axF, LOR.axR],
      width: LOR.w,
      length: LOR.zf - LOR.zr,
      mid: (LOR.zf + LOR.zr) / 2,
      wheelR: LOR.r,
      inset: 0.2,
      steerAt: [1.24, 2.02],
      height: LOR.roof,
    });
  }

  /** Cab door k (0 right, 1 left): hinged on its front edge. */
  function lorryDoor(k, driverX) {
    const sx = k === 1 ? 1 : -1;
    const seat = sx > 0 === driverX > 0 ? 0 : 1;
    return {
      side: sx > 0 ? "L" : "R",
      seat,
      hinge: [sx * (LOR.w / 2 - 0.02), 1.2, DOOR[0]],
      sx,
      kind: "hinge",
    };
  }

  F.VehicleBig = Object.assign(F.VehicleBig || {}, { lorry, LOR });
})((window.KQ = window.KQ || {}));
