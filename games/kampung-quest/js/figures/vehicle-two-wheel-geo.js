/* ============================================================================
 * FILE: vehicle-two-wheel-geo.js
 * PURPOSE: Kampung Quest — the two-wheelers (F.VehicleTwoWheel). The bicycle has a real diamond frame (top, down,
 *          seat and head tubes, paired chain and seat stays), 16 laced spokes, a chain ring with cranks and pedals,
 *          a chain to the rear sprocket, a shaped saddle on its post, swept-back handlebars with grips and brake
 *          levers on a fork that turns about the head tube, mudguards, a rack, a small basket, a bell, a lamp and
 *          a kickstand. The scooter is a step-through: a curved rear cowl over the rear wheel, a floorboard, a
 *          curved leg shield, a long seat, a front fender and a handlebar cowl with its headlight and mirrors.
 *          Each comes as a few merged geometries: a tinted frame / body, dark trim, the steering end (which turns
 *          with the front wheel) and, for the scooter, lamps.
 *            F.VehicleTwoWheel.bike() / .moto() -> { frame, trim, fork, wheel, pivotZ, wheelY, rearZ, frontZ, lamp? }
 *          Local frame: faces +z, left +x, the origin on the ground mid-wheelbase; pivotZ is the steering axis,
 *          frontZ the front hub (both on the ground plane's z axis).
 * BUSINESS CONTEXT: AC-R8 (realism round) and AC-P14 (playability round: "bicycle with a real frame (diamond
 *   frame, spokes, chain, handlebars); scooter recognisable"), features/kampung-quest-playability/requirements.md.
 * DEPENDENCIES: KQ.Figures.VehicleParts (vehicle-parts.js), KQ.Figures.Geo (geometry.js).
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicles-all.spec.mjs tests/kampung-quest-vehicles-ground.spec.mjs
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const P = F.VehicleParts;
  const G = F.Geo;
  const WHITE = "#ffffff";
  const DARK = "#2b2d33";
  const BLACK = "#1d1e22";
  const GREY = "#9aa0a8";
  const STEEL = "#c4c8ce";
  const CHROME_DARK = "#8d939b";
  const cache = {};

  /* ------------------------------ bicycle ------------------------------ */

  /** Bicycle joints (z forward, y up): bottom bracket, seat cluster, head tube ends, rear hub. */
  const B = {
    bb: [0, 0.21, 0],
    seat: [0, 0.43, -0.11],
    headTop: [0, 0.58, 0.3],
    headLow: [0, 0.48, 0.335],
    rear: -0.5,
    hubY: 0.28,
    pivotZ: 0.32,
    frontZ: 0.5,
  };

  /** The diamond frame, tinted: seat, top, down and head tubes and the paired chain and seat stays. */
  function bikeFrame() {
    const parts = [
      P.rod(B.bb, B.seat, 0.02, WHITE),
      P.rod(B.seat, B.headTop, 0.019, WHITE),
      P.rod(B.bb, B.headLow, 0.024, WHITE),
      P.rod(B.headLow, [0, 0.61, 0.295], 0.028, WHITE),
      P.drum("x", 0.03, 0.07, B.bb, WHITE, 10),
    ];
    [-0.05, 0.05].forEach(function (x) {
      parts.push(P.rod([x * 0.4, 0.21, 0], [x, B.hubY, B.rear], 0.012, WHITE));
      parts.push(P.rod([x * 0.4, 0.42, -0.1], [x, B.hubY, B.rear], 0.011, WHITE));
    });
    return G.merge(parts);
  }

  /** The drive train on the chain side (+x): chain ring, cranks, pedals, rear sprocket and the chain between them. */
  function driveTrain() {
    const x = 0.07;
    const parts = [
      P.drum("x", 0.09, 0.012, [x, 0.21, 0], GREY, 18),
      P.drum("x", 0.04, 0.03, [x, 0.21, 0], DARK, 10),
      P.drum("x", 0.04, 0.012, [x, B.hubY, B.rear], GREY, 12),
      P.rod([x, 0.3, 0], [x, B.hubY + 0.04, B.rear], 0.006, BLACK, 4),
      P.rod([x, 0.12, 0], [x, B.hubY - 0.04, B.rear], 0.006, BLACK, 4),
      P.rod([0.09, 0.21, 0], [0.09, 0.12, 0.14], 0.013, GREY),
      P.rod([-0.09, 0.21, 0], [-0.09, 0.3, -0.14], 0.013, GREY),
      P.block(0.1, 0.025, 0.06, [0.13, 0.12, 0.14], DARK),
      P.block(0.1, 0.025, 0.06, [-0.13, 0.3, -0.14], DARK),
    ];
    return parts;
  }

  /** The fixed dark bits: shaped saddle and post, rack, rear mudguard and reflector, kickstand, drive train. */
  function bikeTrim() {
    const parts = [
      P.block(0.16, 0.05, 0.13, [0, 0.445, -0.18], DARK),
      P.block(0.08, 0.04, 0.13, [0, 0.448, -0.07], DARK),
      P.rod(B.seat, [0, 0.42, -0.14], 0.014, STEEL),
      P.block(0.18, 0.018, 0.3, [0, 0.6, -0.55], DARK),
      P.rod([0.07, 0.6, -0.45], [0.05, B.hubY, B.rear], 0.008, GREY),
      P.rod([-0.07, 0.6, -0.45], [-0.05, B.hubY, B.rear], 0.008, GREY),
      P.halfRing(0, B.hubY, B.rear, 0.31, 0.014, DARK),
      P.block(0.05, 0.03, 0.02, [0, 0.58, -0.71], "#d62b2b"),
      P.rod([-0.05, 0.2, -0.12], [-0.14, 0.01, -0.21], 0.01, GREY),
    ];
    return G.merge(parts.concat(driveTrain()));
  }

  /** The wire basket, as twelve thin rods, local to the steering axis (in front of the handlebar). */
  function basket() {
    const parts = [];
    const [x, z0, z1, y0, y1] = [0.13, 0.08, 0.27, 0.62, 0.74];
    [y0, y1].forEach(function (y) {
      parts.push(
        ...P.tube(
          [
            [-x, y, z0],
            [x, y, z0],
            [x, y, z1],
            [-x, y, z1],
            [-x, y, z0],
          ],
          0.006,
          GREY,
        ),
      );
    });
    [
      [-x, z0],
      [x, z0],
      [-x, z1],
      [x, z1],
    ].forEach((c) => parts.push(P.rod([c[0], y0, c[1]], [c[0], y1, c[1]], 0.006, GREY)));
    return parts;
  }

  /** The handlebar, local to the steering axis: stem, swept-back bar, grips, brake levers, bell. */
  function handlebar() {
    const bar = [
      [-0.25, 0.66, -0.06],
      [-0.12, 0.665, 0.02],
      [0.12, 0.665, 0.02],
      [0.25, 0.66, -0.06],
    ];
    const parts = P.tube(bar, 0.012, DARK);
    parts.push(P.rod([0, 0.6, -0.01], [0, 0.665, 0.02], 0.016, STEEL));
    [-1, 1].forEach(function (k) {
      parts.push(P.rod([k * 0.21, 0.66, -0.03], [k * 0.27, 0.66, -0.08], 0.02, "#d7232c"));
      parts.push(P.rod([k * 0.15, 0.67, 0.01], [k * 0.2, 0.655, 0.06], 0.006, DARK));
    });
    parts.push(P.drum("y", 0.028, 0.02, [0.09, 0.69, 0.02], "#f2c230", 10));
    return parts;
  }

  /** The steering end, local to the steering axis: fork blades to the front hub, handlebar, lamp, basket, mudguard. */
  function bikeFork() {
    const hz = B.frontZ - B.pivotZ;
    const parts = [
      P.rod([-0.04, B.hubY, hz], [-0.03, 0.5, 0.01], 0.013, STEEL),
      P.rod([0.04, B.hubY, hz], [0.03, 0.5, 0.01], 0.013, STEEL),
      P.block(0.1, 0.03, 0.05, [0, 0.5, 0.01], STEEL),
      P.block(0.08, 0.07, 0.06, [0, 0.58, 0.05], "#fff3c4"),
      P.halfRing(0, B.hubY, hz, 0.31, 0.014, DARK),
    ];
    return G.merge(parts.concat(handlebar(), basket()));
  }

  /** The bicycle's shared geometries. */
  function bike() {
    if (cache.bike) return cache.bike;
    cache.bike = {
      frame: bikeFrame(),
      trim: bikeTrim(),
      fork: bikeFork(),
      wheel: P.spokedWheel(0.28, 0.025, 0.05),
      pivotZ: B.pivotZ,
      frontZ: B.frontZ,
      wheelY: B.hubY,
      rearZ: B.rear,
      foot: { mid: 0, hl: 0.8, hw: 0.2 },
    };
    return cache.bike;
  }

  /* ------------------------------ scooter ------------------------------ */

  /** The rear cowl's side view: under the seat from the floor back to the tail, with an arch over the rear wheel. */
  function cowlShape() {
    const p = new THREE.Shape();
    p.moveTo(0.22, 0.3);
    p.lineTo(0.22, 0.5);
    p.quadraticCurveTo(0.2, 0.58, 0.05, 0.58);
    p.lineTo(-0.8, 0.58);
    p.quadraticCurveTo(-1.08, 0.58, -1.08, 0.42);
    p.quadraticCurveTo(-1.06, 0.3, -0.95, 0.3);
    p.absarc(-0.62, 0.24, 0.3, Math.PI, 0, true);
    p.lineTo(0.22, 0.3);
    return p;
  }

  /** The leg shield's side view: a curved panel rising from the floor to the handlebar. */
  function shieldShape() {
    const p = new THREE.Shape();
    p.moveTo(0.3, 0.3);
    p.quadraticCurveTo(0.5, 0.32, 0.5, 0.6);
    p.lineTo(0.55, 0.92);
    p.lineTo(0.48, 0.92);
    p.quadraticCurveTo(0.44, 0.46, 0.26, 0.38);
    p.lineTo(0.3, 0.3);
    return p;
  }

  /** The scooter's painted body: the bulbous rear cowl, the floorboard and the curved leg shield. */
  function motoBody() {
    const cowl = P.squeeze(
      P.sideShape(cowlShape(), 0.42, WHITE, 0.04, 6),
      (y, z) => (1 - 0.3 * P.smooth(0.42, 0.62, y)) * (1 - 0.25 * P.smooth(-0.7, -1.1, z)),
    );
    const shield = P.squeeze(
      P.sideShape(shieldShape(), 0.44, WHITE, 0.02, 6),
      (y) => 1 - 0.35 * P.smooth(0.5, 0.95, y),
    );
    return G.merge([cowl, shield, P.block(0.34, 0.06, 0.34, [0, 0.33, 0.36], WHITE)]);
  }

  /** The scooter's fixed dark bits: seat, floor mat, grab rail, exhaust, side stand, number plate, side trim. */
  function motoTrim() {
    const parts = [
      P.block(0.3, 0.1, 0.92, [0, 0.62, -0.3], "#23252b"),
      P.block(0.3, 0.012, 0.3, [0, 0.365, 0.36], "#23252b"),
      ...P.tube(
        [
          [-0.14, 0.7, -0.68],
          [-0.15, 0.72, -0.95],
          [0.15, 0.72, -0.95],
          [0.14, 0.7, -0.68],
        ],
        0.014,
        GREY,
      ),
      P.drum("z", 0.045, 0.4, [0.2, 0.24, -0.66], GREY, 10),
      P.drum("z", 0.03, 0.06, [0.2, 0.24, -0.89], "#3b3e45", 8),
      P.rod([-0.16, 0.24, -0.3], [-0.22, 0.01, -0.38], 0.014, DARK),
      P.block(0.2, 0.1, 0.012, [0, 0.42, -1.1], "#f4f4f0"),
    ];
    [-1, 1].forEach((k) =>
      parts.push(P.block(0.012, 0.03, 0.9, [k * 0.205, 0.44, -0.45], CHROME_DARK)),
    );
    return G.merge(parts);
  }

  /** The scooter's lamps: a tail light, a stop light, four indicators. */
  function motoLamp() {
    const parts = [P.block(0.18, 0.07, 0.05, [0, 0.52, -1.08], "#d62b2b")];
    [-1, 1].forEach(function (k) {
      parts.push(P.block(0.05, 0.05, 0.05, [k * 0.15, 0.5, -1.06], "#f2a51c"));
      parts.push(P.block(0.05, 0.05, 0.05, [k * 0.2, 0.92, 0.6], "#f2a51c"));
    });
    return G.merge(parts);
  }

  /** The scooter's steering end, local to the front hub: column, bars, grips, mirrors, headlight cowl, fender. */
  function motoFork() {
    const parts = [
      P.rod([-0.05, 0.24, 0], [-0.04, 0.6, -0.12], 0.02, GREY),
      P.rod([0.05, 0.24, 0], [0.04, 0.6, -0.12], 0.02, GREY),
      P.rod([0, 0.6, -0.12], [0, 0.93, -0.3], 0.03, GREY),
      P.rod([-0.3, 0.95, -0.34], [0.3, 0.95, -0.34], 0.018, DARK),
      P.block(0.1, 0.045, 0.045, [-0.3, 0.95, -0.34], "#23252b"),
      P.block(0.1, 0.045, 0.045, [0.3, 0.95, -0.34], "#23252b"),
      P.block(0.3, 0.16, 0.2, [0, 0.96, -0.26], "#e9e6dc"),
      P.drum("z", 0.07, 0.04, [0, 0.97, -0.15], "#fff6d6", 14),
      P.block(0.18, 0.05, 0.1, [0, 1.05, -0.34], "#23252b"),
      P.halfRing(0, 0.24, 0, 0.29, 0.04, "#e4e6ea"),
    ];
    [-1, 1].forEach(function (k) {
      parts.push(P.rod([k * 0.24, 0.97, -0.34], [k * 0.3, 1.15, -0.36], 0.009, DARK));
      parts.push(P.block(0.11, 0.07, 0.025, [k * 0.31, 1.18, -0.36], "#23252b"));
    });
    return G.merge(parts);
  }

  /** The scooter's shared geometries. */
  function moto() {
    if (cache.moto) return cache.moto;
    cache.moto = {
      frame: motoBody(),
      trim: motoTrim(),
      fork: motoFork(),
      lamp: motoLamp(),
      wheel: P.scooterWheel(0.24, 0.1),
      pivotZ: 0.72,
      frontZ: 0.72,
      wheelY: 0.24,
      rearZ: -0.62,
      foot: { mid: -0.06, hl: 1.04, hw: 0.3 },
    };
    return cache.moto;
  }

  F.VehicleTwoWheel = { bike, moto };
})((window.KQ = window.KQ || {}));
