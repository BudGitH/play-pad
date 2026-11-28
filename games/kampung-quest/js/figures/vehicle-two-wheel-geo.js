/* ============================================================================
 * FILE: vehicle-two-wheel-geo.js
 * PURPOSE: Kampung Quest — the two-wheelers (F.VehicleTwoWheel), built smooth and lifelike: round tubes, swept
 *          curves, moulded panels with smooth (crease-angle) shading; no boxes for body parts.
 *          The bicycle has a thin round-tube diamond frame (top, down, seat and head tubes, paired chain and seat
 *          stays), curved fork blades, 16 laced spokes on round tyres, a chain ring with cranks and pedals, a chain
 *          to the rear sprocket, a shaped saddle on its post, a swept riser handlebar with grips and brake levers
 *          on a fork that turns about the head tube, mudguards, a tube rack, a round lamp, reflectors, a bell and a
 *          kickstand. The scooter is a step-through: a rounded rear cowl over the rear wheel, a floorboard, a
 *          curved leg shield, a cushioned seat, a swept exhaust, a grab rail, a front fender and a rounded
 *          handlebar cowl with its headlight and round mirrors.
 *          Each comes as a few merged geometries: a tinted frame / body, dark trim, the steering end (which turns
 *          with the front wheel) and, for the scooter, lamps.
 *            F.VehicleTwoWheel.bike() / .moto() -> { frame, trim, fork, wheel, pivotZ, wheelY, rearZ, frontZ, lamp? }
 *          Local frame: faces +z, left +x, the origin on the ground mid-wheelbase; pivotZ is the steering axis,
 *          frontZ the front hub (both on the ground plane's z axis).
 * BUSINESS CONTEXT: AC-R8 (realism round) and AC-P14 (playability round: "bicycle with a real frame (diamond
 *   frame, spokes, chain, handlebars); scooter recognisable"; the owner asked for smooth, lifelike, not boxy),
 *   features/kampung-quest-playability/requirements.md.
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

  /** The diamond frame, tinted: thin round seat, top, down and head tubes and the paired chain and seat stays. */
  function bikeFrame() {
    const parts = [
      P.rod(B.bb, B.seat, 0.016, WHITE, 12),
      P.rod(B.seat, B.headTop, 0.015, WHITE, 12),
      P.rod(B.bb, B.headLow, 0.019, WHITE, 12),
      P.rod(B.headLow, [0, 0.61, 0.295], 0.022, WHITE, 12),
      P.drum("x", 0.024, 0.07, B.bb, WHITE, 12),
      P.lens(0.04, 0.04, 0.04, B.seat, WHITE),
    ];
    [-0.05, 0.05].forEach(function (x) {
      const chain = [
        [x * 0.4, 0.21, 0],
        [x * 0.9, 0.24, -0.25],
        [x, B.hubY, B.rear],
      ];
      const stay = [
        [x * 0.3, 0.42, -0.1],
        [x * 0.9, 0.35, -0.3],
        [x, B.hubY, B.rear],
      ];
      parts.push(P.bent(chain, 0.009, WHITE), P.bent(stay, 0.008, WHITE));
    });
    return G.merge(parts);
  }

  /** The drive train on the chain side (+x): chain ring, cranks, pedals, rear sprocket and the chain between them. */
  function driveTrain() {
    const x = 0.07;
    return [
      P.drum("x", 0.09, 0.01, [x, 0.21, 0], GREY, 24),
      P.drum("x", 0.03, 0.03, [x, 0.21, 0], DARK, 12),
      P.drum("x", 0.04, 0.01, [x, B.hubY, B.rear], GREY, 16),
      P.rod([x, 0.3, 0], [x, B.hubY + 0.04, B.rear], 0.005, BLACK, 4),
      P.rod([x, 0.12, 0], [x, B.hubY - 0.04, B.rear], 0.005, BLACK, 4),
      P.rod([0.09, 0.21, 0], [0.09, 0.12, 0.14], 0.01, GREY),
      P.rod([-0.09, 0.21, 0], [-0.09, 0.3, -0.14], 0.01, GREY),
      P.block(0.09, 0.02, 0.05, [0.13, 0.12, 0.14], DARK),
      P.block(0.09, 0.02, 0.05, [-0.13, 0.3, -0.14], DARK),
    ];
  }

  /** A tube rack over the rear wheel, on two struts each side. */
  function rack() {
    const y = 0.58;
    const parts = [];
    [-0.07, 0.07].forEach(function (x) {
      parts.push(P.rod([x, y, -0.36], [x, y, -0.7], 0.007, GREY, 6));
      parts.push(P.rod([x, y, -0.62], [x * 0.7, B.hubY, B.rear], 0.006, GREY, 6));
    });
    [-0.36, -0.5, -0.7].forEach((z) =>
      parts.push(P.rod([-0.07, y, z], [0.07, y, z], 0.006, GREY, 6)),
    );
    parts.push(P.rod([0, y - 0.01, -0.36], [0, 0.42, -0.13], 0.006, GREY, 6));
    return parts;
  }

  /** The fixed dark bits: shaped saddle and post, rack, rear mudguard and reflector, kickstand, drive train. */
  function bikeTrim() {
    const stand = [
      [-0.04, 0.2, -0.12],
      [-0.1, 0.1, -0.17],
      [-0.14, 0.01, -0.21],
    ];
    const parts = [
      P.lens(0.15, 0.05, 0.15, [0, 0.462, -0.17], DARK, [0.06, 0, 0], 14),
      P.lens(0.07, 0.04, 0.16, [0, 0.458, -0.07], DARK, [-0.06, 0, 0], 12),
      P.rod(B.seat, [0, 0.445, -0.14], 0.011, STEEL),
      P.halfRing(0, B.hubY, B.rear, 0.31, 0.012, DARK),
      P.lens(0.05, 0.03, 0.015, [0, 0.55, -0.72], "#d62b2b", [-0.5, 0, 0]),
      P.bent(stand, 0.008, GREY),
    ];
    return G.merge(parts.concat(rack(), driveTrain()));
  }

  /** The handlebar, local to the steering axis: stem, swept riser bar, grips, brake levers, bell. */
  function handlebar() {
    const bar = [
      [-0.26, 0.665, -0.09],
      [-0.17, 0.665, -0.02],
      [-0.06, 0.655, 0.03],
      [0.06, 0.655, 0.03],
      [0.17, 0.665, -0.02],
      [0.26, 0.665, -0.09],
    ];
    const stem = [
      [0, 0.6, -0.01],
      [0, 0.65, 0.0],
      [0, 0.655, 0.03],
    ];
    const parts = [P.bent(bar, 0.01, DARK, 24), P.bent(stem, 0.013, STEEL, 6)];
    [-1, 1].forEach(function (k) {
      const lever = [
        [k * 0.15, 0.67, 0],
        [k * 0.18, 0.66, 0.05],
        [k * 0.21, 0.64, 0.07],
      ];
      parts.push(P.rod([k * 0.22, 0.665, -0.055], [k * 0.27, 0.665, -0.1], 0.016, BLACK, 10));
      parts.push(P.bent(lever, 0.005, DARK, 6));
    });
    parts.push(P.lens(0.045, 0.025, 0.045, [0.1, 0.685, 0.02], "#e6c34a"));
    return parts;
  }

  /** The steering end, local to the steering axis: curved fork blades to the front hub, handlebar, lamp, mudguard. */
  function bikeFork() {
    const hz = B.frontZ - B.pivotZ;
    const parts = [
      P.lens(0.1, 0.035, 0.05, [0, 0.5, 0.01], STEEL),
      P.lens(0.07, 0.06, 0.08, [0, 0.58, 0.05], "#e9e9e4"),
      P.lens(0.05, 0.045, 0.02, [0, 0.58, 0.09], "#fff6d6"),
      P.halfRing(0, B.hubY, hz, 0.31, 0.012, DARK),
      P.lens(0.03, 0.03, 0.01, [0, 0.42, hz + 0.29], "#f4f4f0"),
    ];
    [-0.04, 0.04].forEach(function (x) {
      const blade = [
        [x, B.hubY, hz],
        [x * 0.95, 0.38, hz - 0.08],
        [x * 0.75, 0.5, 0.01],
      ];
      parts.push(P.bent(blade, 0.011, STEEL));
    });
    return G.merge(parts.concat(handlebar()));
  }

  /** The bicycle's shared geometries. */
  function bike() {
    if (cache.bike) return cache.bike;
    cache.bike = {
      frame: bikeFrame(),
      trim: bikeTrim(),
      fork: bikeFork(),
      wheel: P.spokedWheel(0.28, 0.022, 0.044),
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
    p.quadraticCurveTo(0.24, 0.42, 0.2, 0.5);
    p.quadraticCurveTo(0.16, 0.57, 0.02, 0.57);
    p.lineTo(-0.75, 0.57);
    p.quadraticCurveTo(-1.1, 0.58, -1.08, 0.4);
    p.quadraticCurveTo(-1.05, 0.3, -0.94, 0.3);
    p.absarc(-0.62, 0.24, 0.3, Math.PI, 0, true);
    p.lineTo(0.22, 0.3);
    return p;
  }

  /** The leg shield's side view: a curved apron rising from the floor to the handlebar. */
  function shieldShape() {
    const p = new THREE.Shape();
    p.moveTo(0.28, 0.3);
    p.quadraticCurveTo(0.52, 0.3, 0.52, 0.6);
    p.quadraticCurveTo(0.53, 0.8, 0.56, 0.92);
    p.lineTo(0.49, 0.92);
    p.quadraticCurveTo(0.45, 0.48, 0.26, 0.39);
    p.lineTo(0.28, 0.3);
    return p;
  }

  /** The seat's side view: a cushion, rounded at both ends, its top about 0.665 m up. */
  function seatShape() {
    const p = new THREE.Shape();
    p.moveTo(-0.76, 0.56);
    p.quadraticCurveTo(-0.8, 0.65, -0.66, 0.66);
    p.quadraticCurveTo(-0.3, 0.67, 0.08, 0.66);
    p.quadraticCurveTo(0.2, 0.655, 0.18, 0.58);
    p.lineTo(-0.76, 0.56);
    return p;
  }

  /** The scooter's painted body: the rounded rear cowl, the floorboard and the curved leg shield. */
  function motoBody() {
    const cowl = P.squeeze(
      P.sideShape(cowlShape(), 0.42, WHITE, 0.07, 10, 3),
      (y, z) => (1 - 0.3 * P.smooth(0.4, 0.62, y)) * (1 - 0.3 * P.smooth(-0.7, -1.12, z)),
    );
    const shield = P.squeeze(
      P.sideShape(shieldShape(), 0.46, WHITE, 0.035, 10, 3),
      (y, z) => (1 - 0.35 * P.smooth(0.5, 0.95, y)) * (1 - 0.2 * P.smooth(0.42, 0.56, z)),
    );
    const floor = P.block(0.34, 0.06, 0.34, [0, 0.33, 0.36], WHITE);
    return G.merge([P.smoothed(cowl, 50), P.smoothed(shield, 50), floor]);
  }

  /** The exhaust: a pipe swept from under the floor back along the right side to a silencer with a tip. */
  function exhaust() {
    const pipe = [
      [-0.05, 0.22, 0.1],
      [-0.14, 0.2, -0.2],
      [-0.2, 0.24, -0.5],
    ];
    return [
      P.bent(pipe, 0.022, CHROME_DARK, 10),
      P.drum("z", 0.05, 0.36, [-0.2, 0.25, -0.68], "#5d6168", 14),
      P.drum("z", 0.028, 0.08, [-0.2, 0.26, -0.89], STEEL, 10),
    ];
  }

  /** The scooter's fixed dark bits: cushioned seat, floor mat, grab rail, exhaust, side stand, number plate, trim. */
  function motoTrim() {
    const rail = [
      [-0.14, 0.66, -0.66],
      [-0.15, 0.7, -0.9],
      [0, 0.71, -1.0],
      [0.15, 0.7, -0.9],
      [0.14, 0.66, -0.66],
    ];
    const stand = [
      [0.16, 0.24, -0.3],
      [0.2, 0.12, -0.34],
      [0.22, 0.01, -0.38],
    ];
    const parts = [
      P.smoothed(P.sideShape(seatShape(), 0.3, "#23252b", 0.05, 10, 3), 55),
      P.block(0.3, 0.012, 0.3, [0, 0.365, 0.36], "#23252b"),
      P.bent(rail, 0.013, GREY, 20),
      P.bent(stand, 0.012, DARK, 6),
      P.block(0.2, 0.1, 0.012, [0, 0.42, -1.1], "#f4f4f0"),
    ];
    [-1, 1].forEach((k) =>
      parts.push(P.rod([k * 0.2, 0.44, 0.0], [k * 0.2, 0.44, -0.9], 0.008, CHROME_DARK, 6)),
    );
    return G.merge(parts.concat(exhaust()));
  }

  /** The scooter's lamps: a tail light, four indicators. */
  function motoLamp() {
    const parts = [P.lens(0.2, 0.08, 0.06, [0, 0.52, -1.08], "#d62b2b", [0, 0, 0], 14)];
    [-1, 1].forEach(function (k) {
      parts.push(P.lens(0.06, 0.05, 0.06, [k * 0.15, 0.5, -1.06], "#f2a51c"));
      parts.push(P.lens(0.06, 0.05, 0.06, [k * 0.2, 0.92, 0.6], "#f2a51c"));
    });
    return G.merge(parts);
  }

  /** One round mirror on its stalk (k = side). */
  function mirror(k) {
    const stalk = [
      [k * 0.22, 0.99, -0.34],
      [k * 0.27, 1.08, -0.36],
      [k * 0.3, 1.15, -0.37],
    ];
    return [
      P.bent(stalk, 0.008, DARK, 6),
      P.lens(0.11, 0.075, 0.025, [k * 0.31, 1.18, -0.37], "#23252b", [0, 0, 0], 14),
      P.lens(0.09, 0.06, 0.01, [k * 0.31, 1.18, -0.385], "#9fb0c2", [0, 0, 0], 14),
    ];
  }

  /** The scooter's handlebar cowl, local to the front hub: rounded shell, headlight, swept bar, grips, mirrors. */
  function motoHead() {
    const bar = [
      [-0.31, 0.97, -0.38],
      [-0.15, 0.98, -0.32],
      [0.15, 0.98, -0.32],
      [0.31, 0.97, -0.38],
    ];
    const parts = [
      P.lens(0.34, 0.18, 0.3, [0, 0.96, -0.28], "#ecebe6", [0, 0, 0], 16),
      P.lens(0.17, 0.12, 0.06, [0, 0.95, -0.14], "#fff6d6", [0, 0, 0], 16),
      P.bent(bar, 0.016, DARK, 16),
      P.lens(0.12, 0.05, 0.08, [0, 1.05, -0.34], "#23252b"),
    ];
    [-1, 1].forEach(function (k) {
      parts.push(P.rod([k * 0.27, 0.975, -0.365], [k * 0.34, 0.97, -0.395], 0.022, BLACK, 10));
      parts.push(...mirror(k));
    });
    return parts;
  }

  /** The scooter's steering end, local to the front hub: telescopic fork, column, handlebar cowl, front fender. */
  function motoFork() {
    const parts = [
      P.rod([-0.05, 0.24, 0], [-0.04, 0.6, -0.12], 0.02, GREY),
      P.rod([0.05, 0.24, 0], [0.04, 0.6, -0.12], 0.02, GREY),
      P.rod([0, 0.6, -0.12], [0, 0.93, -0.3], 0.03, GREY),
      P.halfRing(0, 0.24, 0, 0.29, 0.04, "#e4e6ea"),
    ];
    return G.merge(parts.concat(motoHead()));
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
