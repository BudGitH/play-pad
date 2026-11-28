/* ============================================================================
 * FILE: vehicle-two-wheel-geo.js
 * PURPOSE: Kampung Quest — the city bicycle (F.VehicleTwoWheel.bike) and the shared two-wheeler plumbing:
 *          - frame (painted): thin round tubes (top, down, seat, head tube, paired chain and seat stays) with
 *            welded joints and a bottom-bracket shell;
 *          - trim: a sprung saddle on its post, a chain guard over the chain, the rear sprocket run, rim-brake
 *            calipers, a rear mudguard with stays, a tube rack, a red rear lamp and reflector, a kickstand, and the
 *            parked crank set (owner "crank": it becomes its own turning mesh once somebody pedals);
 *          - fork (turns): a fork with a crown and curved blades, headset, a swept-back city bar, grips, brake
 *            levers with cables looping to the brakes, a bell, a front lamp, a front mudguard, and a wire basket on
 *            some bikes;
 *          - wheels: laced spokes; the rear one carries the sprocket.
 *          F.VehicleTwoWheel.bike(basket, low) -> { frame, trimFor(mask), fork, wheel, rearWheel, crank, crankAt, ...}
 *          F.VehicleTwoWheel.rig(v, hex) attaches the two-wheeler rig (pedals, wheels, steer, kickstand, helmet).
 *          The scooter is vehicle-two-wheel-dress.js. Local frame: faces +z, left +x, origin on the ground
 *          mid-wheelbase; pivotZ is the steering axis, frontZ the front hub.
 * BUSINESS CONTEXT: owner's realism pass ("bicycles: realistic city bike"), AC-P14,
 *   features/kampung-quest-playability/notes-vehicles.md.
 * DEPENDENCIES: KQ.Figures.VehicleParts, VehicleMats (classes), Geo; THREE.
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicle-rig.spec.mjs tests/kampung-quest-vehicles-all.spec.mjs
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const P = () => F.VehicleParts;
  const G = () => F.Geo;
  const C = () => F.VehicleMats.CLS;
  const WHITE = "#ffffff";
  const DARK = "#2b2d33";
  const BLACK = "#1d1e22";
  const STEEL = "#c4c8ce";
  const cache = {};

  /** Bicycle joints (z forward, y up): bottom bracket, seat cluster, head tube ends, rear hub, steering axis. */
  const B = {
    bb: [0, 0.21, 0],
    seat: [0, 0.45, -0.115],
    headTop: [0, 0.6, 0.3],
    headLow: [0, 0.47, 0.34],
    rear: -0.5,
    hubY: 0.28,
    pivotZ: 0.32,
    frontZ: 0.5,
  };

  /** [x, y, z] points from a flat list. */
  const triples = (a) =>
    a.filter((_, i) => i % 3 === 0).map((v, i) => [v, a[i * 3 + 1], a[i * 3 + 2]]);
  /** A tagged piece (class from F.VehicleMats.CLS). */
  const T = (g, cls) => P().tag(g, cls === undefined ? 0 : cls);

  /** The frame, tinted: seat, top, down and head tubes, paired stays, welded joints and the bottom-bracket shell. */
  function bikeFrame() {
    const p = P();
    const parts = [
      p.rod(B.bb, [0, 0.47, -0.122], 0.015, WHITE, 12),
      p.rod([0, 0.44, -0.11], [0, 0.57, 0.305], 0.014, WHITE, 12),
      p.rod(B.bb, [0, 0.48, 0.335], 0.018, WHITE, 12),
      p.rod([0, 0.45, 0.345], [0, 0.62, 0.297], 0.021, WHITE, 12),
      p.drum("x", 0.024, 0.075, B.bb, WHITE, 12),
    ];
    const joints = triples([0, 0.44, -0.11, 0, 0.57, 0.305, 0, 0.48, 0.335, 0, 0.22, 0.01]);
    joints.forEach((j) => parts.push(p.lens(0.036, 0.036, 0.036, j, WHITE, null, 8)));
    [-1, 1].forEach(function (k) {
      const chain = triples([
        k * 0.02,
        0.21,
        -0.01,
        k * 0.05,
        0.24,
        -0.25,
        k * 0.055,
        B.hubY,
        B.rear,
      ]);
      const stay = triples([
        k * 0.012,
        0.43,
        -0.12,
        k * 0.045,
        0.36,
        -0.3,
        k * 0.055,
        B.hubY,
        B.rear,
      ]);
      parts.push(p.bent(chain, 0.008, WHITE), p.bent(stay, 0.007, WHITE));
    });
    return G().merge(parts);
  }

  /** The chain guard over the top run (city bikes cover their chain), the lower run, the rear derailleur hanger. */
  function chainRun() {
    const p = P();
    const x = 0.068;
    return [
      T(p.lens(0.02, 0.07, 0.5, [x + 0.01, 0.29, -0.24], "#1a1b1f", [-0.12, 0, 0], 10), C().gloss),
      T(p.rod([x, 0.12, 0], [x, B.hubY - 0.04, B.rear], 0.005, "#3d3f44", 4), C().satin),
    ];
  }

  /** A sprung city saddle on its post, two coil springs under its tail. */
  function saddle() {
    const p = P();
    const parts = [
      p.lens(0.17, 0.05, 0.17, [0, 0.505, -0.18], "#2a2420", [0.06, 0, 0], 14),
      p.lens(0.08, 0.045, 0.16, [0, 0.5, -0.07], "#2a2420", [-0.06, 0, 0], 12),
      T(p.rod([0, 0.45, -0.115], [0, 0.485, -0.13], 0.011, STEEL), C().chrome),
    ];
    [-0.05, 0.05].forEach((x) =>
      parts.push(T(p.rod([x, 0.47, -0.22], [x, 0.49, -0.23], 0.012, "#55585e", 6), C().chrome)),
    );
    return parts;
  }

  /** Rim-brake calipers at the seat stays' bridge (rear). */
  function rearBrake() {
    const p = P();
    return [
      T(p.rod([-0.045, 0.52, -0.42], [0.045, 0.52, -0.42], 0.006, STEEL, 6), C().chrome),
      T(p.block(0.12, 0.03, 0.025, [0, 0.54, -0.43], "#3a3d44"), C().satin),
    ];
  }

  /** A tube rack over the rear wheel, on two struts each side, a mudguard with stays, the rear lamp. */
  function rackAndGuard() {
    const p = P();
    const y = 0.6;
    const parts = [T(p.halfRing(0, B.hubY, B.rear, 0.31, 0.014, "#c9ccd2"), C().chrome)];
    [-0.07, 0.07].forEach(function (x) {
      parts.push(p.rod([x, y, -0.36], [x, y, -0.72], 0.007, "#9aa0a8", 6));
      parts.push(p.rod([x, y, -0.66], [x * 0.75, B.hubY, B.rear], 0.006, "#9aa0a8", 6));
      parts.push(p.rod([x * 0.9, 0.3, -0.78], [x * 0.75, B.hubY, B.rear], 0.004, "#9aa0a8", 4));
    });
    [-0.36, -0.5, -0.72].forEach((z) =>
      parts.push(p.rod([-0.07, y, z], [0.07, y, z], 0.006, "#9aa0a8", 6)),
    );
    parts.push(p.rod([0, y - 0.01, -0.36], [0, 0.44, -0.13], 0.006, "#9aa0a8", 6));
    parts.push(T(p.lens(0.06, 0.035, 0.03, [0, y - 0.04, -0.74], "#c0121b"), C().tail));
    parts.push(T(p.lens(0.05, 0.03, 0.012, [0, 0.42, -0.79], "#d62b2b", [-0.5, 0, 0]), C().brake));
    return parts;
  }

  /** The kickstand (parked bikes lean on it). */
  function stand() {
    return [
      P().bent(
        [
          [-0.04, 0.2, -0.12],
          [-0.1, 0.1, -0.17],
          [-0.14, 0.01, -0.21],
        ],
        0.008,
        "#9aa0a8",
      ),
    ];
  }

  /** The crank set about the bottom bracket (local to it): chain ring, two cranks, two pedals. */
  function crankSet() {
    const p = P();
    const parts = [
      T(p.drum("x", 0.095, 0.008, [0.07, 0, 0], "#b9bdc3", 26), C().chrome),
      T(p.drum("x", 0.06, 0.01, [0.071, 0, 0], "#2b2d33", 12), C().satin),
    ];
    [-1, 1].forEach(function (k) {
      const end = [k * 0.09, -k * 0.155, 0];
      parts.push(T(p.rod([k * 0.085, 0, 0], end, 0.011, "#9aa0a8", 6), C().chrome));
      parts.push(
        T(p.block(0.09, 0.022, 0.06, [end[0] + k * 0.05, end[1], 0], "#26272b"), C().rubber),
      );
      parts.push(
        T(p.lens(0.012, 0.012, 0.05, [end[0] + k * 0.095, end[1], 0], "#f2a51c"), C().lens),
      );
    });
    return G().merge(parts);
  }

  /** The fixed trim pieces: [{g, owner}] ("crank" = the parked crank set at the bottom bracket). */
  function bikeTrimPieces() {
    const fixed = saddle().concat(chainRun(), rearBrake(), rackAndGuard(), stand());
    const crank = crankSet().translate(B.bb[0], B.bb[1], B.bb[2]);
    return [
      { g: G().merge(fixed), owner: "body" },
      { g: crank, owner: "crank" },
    ];
  }

  /** One side of the bar (k): grip, brake lever, the cable looping down to the brake. */
  function barSide(k) {
    const p = P();
    const lever = triples([k * 0.17, 0.695, -0.05, k * 0.2, 0.685, 0, k * 0.23, 0.67, 0]);
    const cable = triples([
      k * 0.17,
      0.69,
      -0.05,
      k * 0.12,
      0.75,
      0.05,
      k * 0.02,
      0.66,
      0.06,
      0,
      0.55,
      0.04,
    ]);
    return [
      T(
        p.rod([k * 0.235, 0.69, -0.115], [k * 0.285, 0.69, -0.19], 0.017, "#3a2e26", 10),
        C().rubber,
      ),
      T(p.bent(lever, 0.005, DARK, 6), C().satin),
      T(p.bent(cable, 0.003, BLACK, 10), C().matte),
    ];
  }

  /** The swept-back city bar, stem, grips, levers, cables, bell (local to the steering axis). */
  function handlebar() {
    const p = P();
    const bar = triples([
      -0.27, 0.69, -0.16, -0.2, 0.69, -0.07, -0.09, 0.68, 0, 0.09, 0.68, 0, 0.2, 0.69, -0.07, 0.27,
      0.69, -0.16,
    ]);
    const stem = triples([0, 0.62, -0.01, 0, 0.67, 0, 0, 0.68, 0]);
    const parts = [
      T(p.bent(bar, 0.011, "#c9ccd2", 24), C().chrome),
      T(p.bent(stem, 0.013, STEEL, 6), C().chrome),
    ];
    [-1, 1].forEach((k) => parts.push(...barSide(k)));
    parts.push(T(p.lens(0.05, 0.028, 0.05, [0.12, 0.71, -0.02], "#d8dbe0"), C().chrome));
    return parts;
  }

  /** The fork: crown, curved blades to the hub, headset rings, front brake, mudguard, lamp. */
  function forkParts() {
    const p = P();
    const hz = B.frontZ - B.pivotZ;
    const parts = [
      T(p.lens(0.1, 0.035, 0.05, [0, 0.45, 0.02], STEEL), C().chrome),
      T(p.drum("y", 0.026, 0.018, [0, 0.628, -0.02], "#3a3d44", 10), C().satin),
      T(p.drum("y", 0.026, 0.018, [0, 0.44, 0.022], "#3a3d44", 10), C().satin),
      T(p.halfRing(0, B.hubY, hz, 0.31, 0.014, "#c9ccd2"), C().chrome),
      T(p.block(0.12, 0.03, 0.025, [0, 0.43, 0.06], "#3a3d44"), C().satin),
      T(p.lens(0.07, 0.065, 0.08, [0, 0.58, 0.07], "#e9e9e4"), C().chrome),
      T(p.lens(0.05, 0.045, 0.02, [0, 0.58, 0.11], "#f4f1e4"), C().head),
    ];
    [-0.04, 0.04].forEach((x) =>
      parts.push(
        T(
          p.bent(
            [
              [x, B.hubY, hz],
              [x * 0.95, 0.36, hz - 0.07],
              [x * 0.75, 0.45, 0.02],
            ],
            0.011,
            STEEL,
          ),
          C().chrome,
        ),
      ),
    );
    return parts;
  }

  /** A wire basket on the front (steers with the bar): a frame of rods with a floor. */
  function basket() {
    const p = P();
    const parts = [T(p.block(0.3, 0.01, 0.22, [0, 0.48, 0.22], "#7a7f86"), C().chrome)];
    const top = 0.66;
    [
      [-0.15, 0.11],
      [0.15, 0.11],
      [-0.15, 0.33],
      [0.15, 0.33],
    ].forEach((c) =>
      parts.push(
        T(p.rod([c[0], 0.48, c[1]], [c[0] * 1.05, top, c[1]], 0.005, "#aeb3ba", 4), C().chrome),
      ),
    );
    [0.48, 0.57, top].forEach(function (y) {
      parts.push(T(p.rod([-0.15, y, 0.11], [0.15, y, 0.11], 0.004, "#aeb3ba", 4), C().chrome));
      parts.push(T(p.rod([-0.15, y, 0.33], [0.15, y, 0.33], 0.004, "#aeb3ba", 4), C().chrome));
      [-0.15, 0.15].forEach((x) =>
        parts.push(T(p.rod([x, y, 0.11], [x, y, 0.33], 0.004, "#aeb3ba", 4), C().chrome)),
      );
    });
    parts.push(T(p.rod([0, 0.48, 0.11], [0, 0.6, 0.02], 0.006, "#aeb3ba", 4), C().chrome));
    return parts;
  }

  /** The bicycle's steering end, local to the steering axis. */
  function bikeFork(withBasket) {
    return G().merge(forkParts().concat(handlebar(), withBasket ? basket() : []));
  }

  /** The rear wheel: the laced wheel plus its sprocket on the chain side. */
  function rearWheel(low) {
    const p = P();
    const w = p.spokedWheel(0.28, 0.022, 0.044, low);
    return G().merge([w, T(p.drum("x", 0.042, 0.012, [0.06, 0, 0], "#9aa0a8", 16), C().chrome)]);
  }

  /** Trim variants: bit 1 drops the parked crank, bit 2 the stand (merged on demand, cached). */
  function trimVariant(set, mask) {
    const key = "t" + mask;
    if (set.merged[key]) return set.merged[key];
    const bit = { crank: 1, stand: 2, standUp: 4 };
    const keep = set.trimPieces.filter(
      (p) => !((bit[p.owner] || 0) & mask) && !(p.owner === "standUp" && !(mask & 2)),
    );
    set.merged[key] = G().merge(keep.map((p) => p.g));
    return set.merged[key];
  }

  /** Does a bike of this colour get a front basket? (about one in three, fixed per colour) */
  function basketFor(hex) {
    return ((Number(hex) || 0) >> 3) % 3 === 0;
  }

  /** The bicycle's shared geometries (cached per basket and tier). */
  function bike(withBasket, low) {
    const key = "bike" + (withBasket ? "b" : "") + (low ? "l" : "");
    if (!cache[key]) cache[key] = P().withDetail(low, () => bikeSet(withBasket, low));
    return cache[key];
  }

  /** Build the bicycle's geometry set at the detail already chosen (see bike). */
  function bikeSet(withBasket, low) {
    const set = {
      kind: "bike",
      frame: bikeFrame(),
      trimPieces: bikeTrimPieces(),
      merged: {},
      fork: bikeFork(withBasket),
      wheel: P().spokedWheel(0.28, 0.022, 0.044, low),
      rearWheel: rearWheel(low),
      crank: crankSet(),
      crankAt: B.bb,
      pivotZ: B.pivotZ,
      frontZ: B.frontZ,
      wheelY: B.hubY,
      rearZ: B.rear,
      foot: { mid: 0, hl: 0.82, hw: 0.2 },
      seats: [{ pos: [0, 0.2, -0.1], heading: 0, kind: "driver" }],
      exhaust: null,
    };
    set.trimFor = (mask) => trimVariant(set, mask);
    return set;
  }

  /** Split the crank set out as its own turning mesh (first pedal stroke). */
  function splitCrank(v) {
    const geo = v.twoGeo;
    v.crank = new THREE.Mesh(geo.crank, v.trimMat);
    v.crank.name = "crank";
    v.crank.position.set(geo.crankAt[0], geo.crankAt[1], geo.crankAt[2]);
    v.group.add(v.crank);
    v.twoMask |= 1;
    v.trimMesh.geometry = geo.trimFor(v.twoMask);
  }

  /** The two-wheeler rig: pedals (bicycle), wheels, steer, kickstand (scooter), helmet, plus the common parts. */
  function rig(v, hex) {
    const geo = v.twoGeo;
    v.twoMask = 0;
    const r = F.VehicleRig.base(v, {
      seats: geo.seats,
      exhaust: geo.exhaust,
      fuel: geo.exhaust ? "petrol" : undefined,
    });
    if (!geo.exhaust) r.exhaust = null;
    r.helmet = F.VehicleRig.helmet(helmetHex(hex));
    if (geo.crank) {
      r.pedals = function (phase) {
        if (!v.crank) splitCrank(v);
        v.crank.rotation.x = phase;
      };
    }
    if (geo.kind === "moto") {
      r.stand = "down";
      r.kickstand = function (down) {
        r.stand = down ? "down" : "up";
        v.twoMask = down ? v.twoMask & ~2 : v.twoMask | 2;
        v.trimMesh.geometry = geo.trimFor(v.twoMask);
      };
    }
    return r;
  }

  /** A rider's helmet colour that goes with the machine (white, black or the body colour). */
  function helmetHex(hex) {
    const c = new THREE.Color(hex || 0xd0453a);
    const l = c.getHSL({}).l;
    return l > 0.75 ? "#24262b" : l < 0.2 ? "#f2f2ee" : "#" + c.getHexString();
  }

  F.VehicleTwoWheel = Object.assign(F.VehicleTwoWheel || {}, {
    bike,
    basketFor,
    rig,
    trimVariant,
    B,
  });
})((window.KQ = window.KQ || {}));
