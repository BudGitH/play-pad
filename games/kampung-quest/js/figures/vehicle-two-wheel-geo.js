// Kampung Quest — the two-wheelers (F.VehicleTwoWheel): a diamond-frame bicycle (mudguards, rack, chain ring,
// cranks, pedals, a wire basket, bell, lamp, spoked wheels) and a scooter (leg shield, floor, seat, rear body,
// steering column with headlight, mirrors and grips). Each comes as a few merged geometries: a tinted frame / body,
// dark trim, the steering end (which turns with the front wheel) and, for the scooter, lamps.
//   F.VehicleTwoWheel.bike() / .moto() -> { frame, trim, fork, wheel, hub:[front pivot z, wheel centre y, rear z], lamp? }
// Local frame: faces +z, left +x, the origin on the ground mid-wheelbase.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const P = F.VehicleParts;
  const G = F.Geo;
  const PI = Math.PI;
  const WHITE = "#ffffff";
  const DARK = "#2b2d33";
  const GREY = "#9aa0a8";
  const cache = {};

  /** A half-ring mudguard over a wheel (centre y, z): the upper half of a thin torus in the y-z plane. */
  function guard(y, z, r, tube, hex) {
    const g = new THREE.TorusGeometry(r, tube, 4, 14, PI).rotateY(PI / 2);
    return P.paint(g, hex).translate(0, y, z);
  }

  /* ------------------------------ bicycle ------------------------------ */

  /** The diamond frame, tinted: seat, top, down, head tubes and the paired chain and seat stays. */
  function bikeFrame() {
    const bb = [0, 0.21, 0];
    const seat = [0, 0.42, -0.1];
    const headTop = [0, 0.58, 0.3];
    const headLow = [0, 0.5, 0.33];
    const parts = [
      P.rod(bb, seat, 0.017, WHITE),
      P.rod(seat, headTop, 0.017, WHITE),
      P.rod(bb, headLow, 0.02, WHITE),
      P.rod(headLow, headTop, 0.025, WHITE),
    ];
    [-0.05, 0.05].forEach(function (x) {
      parts.push(P.rod([x, 0.21, 0], [x, 0.28, -0.5], 0.012, WHITE));
      parts.push(P.rod([x, 0.42, -0.1], [x, 0.28, -0.5], 0.01, WHITE));
    });
    return G.merge(parts);
  }

  /** The fixed dark bits: saddle and post, rack, rear mudguard, chain ring, cranks, pedals. */
  function bikeTrim() {
    const parts = [
      P.block(0.14, 0.05, 0.28, [0, 0.44, -0.14], DARK),
      P.rod([0, 0.42, -0.1], [0, 0.43, -0.12], 0.014, GREY),
      P.block(0.2, 0.02, 0.32, [0, 0.62, -0.55], DARK),
      P.rod([0.07, 0.62, -0.5], [0.04, 0.28, -0.5], 0.008, GREY),
      P.rod([-0.07, 0.62, -0.5], [-0.04, 0.28, -0.5], 0.008, GREY),
      guard(0.28, -0.5, 0.3, 0.012, "#2b2d33"),
      P.drum("x", 0.09, 0.015, [0.07, 0.21, 0], GREY, 14),
      P.rod([0.09, 0.21, 0], [0.09, 0.12, 0.14], 0.013, GREY),
      P.rod([-0.09, 0.21, 0], [-0.09, 0.3, -0.14], 0.013, GREY),
      P.block(0.1, 0.025, 0.06, [0.12, 0.12, 0.14], DARK),
      P.block(0.1, 0.025, 0.06, [-0.12, 0.3, -0.14], DARK),
      P.block(0.05, 0.03, 0.03, [0, 0.62, -0.62], "#d62b2b"),
    ];
    return G.merge(parts);
  }

  /** The wire basket, as twelve thin rods, local to the front hub. */
  function basket() {
    const parts = [];
    const x = 0.17;
    const z0 = 0.02;
    const z1 = 0.3;
    const y0 = 0.5;
    const y1 = 0.66;
    [y0, y1].forEach(function (y) {
      parts.push(
        P.rod([-x, y, z0], [x, y, z0], 0.007, GREY),
        P.rod([-x, y, z1], [x, y, z1], 0.007, GREY),
      );
      parts.push(
        P.rod([-x, y, z0], [-x, y, z1], 0.007, GREY),
        P.rod([x, y, z0], [x, y, z1], 0.007, GREY),
      );
    });
    [
      [-x, z0],
      [x, z0],
      [-x, z1],
      [x, z1],
    ].forEach((c) => parts.push(P.rod([c[0], y0, c[1]], [c[0], y1, c[1]], 0.007, GREY)));
    return parts;
  }

  /** The steering end, local to the front hub: fork, stem, handlebar, grips, levers, lamp, bell, basket, mudguard. */
  function bikeFork() {
    const parts = [
      P.rod([-0.04, 0.28, 0], [-0.03, 0.54, -0.17], 0.014, GREY),
      P.rod([0.04, 0.28, 0], [0.03, 0.54, -0.17], 0.014, GREY),
      P.rod([0, 0.54, -0.17], [0, 0.63, -0.19], 0.018, GREY),
      P.rod([-0.25, 0.64, -0.2], [0.25, 0.64, -0.2], 0.013, DARK),
      P.block(0.09, 0.04, 0.04, [-0.25, 0.64, -0.2], "#d7232c"),
      P.block(0.09, 0.04, 0.04, [0.25, 0.64, -0.2], "#d7232c"),
      P.rod([-0.2, 0.66, -0.2], [-0.2, 0.66, -0.08], 0.008, DARK),
      P.rod([0.2, 0.66, -0.2], [0.2, 0.66, -0.08], 0.008, DARK),
      P.block(0.09, 0.08, 0.06, [0, 0.72, -0.17], "#fff3c4"),
      P.block(0.07, 0.07, 0.07, [0.13, 0.7, -0.19], "#f2c230"),
      guard(0.28, 0, 0.3, 0.012, "#2b2d33"),
    ];
    return G.merge(parts.concat(basket()));
  }

  /** The bicycle's shared geometries. */
  function bike() {
    if (cache.bike) return cache.bike;
    cache.bike = {
      frame: bikeFrame(),
      trim: bikeTrim(),
      fork: bikeFork(),
      wheel: P.spokedWheel(0.28, 0.03, 0.06),
      pivotZ: 0.5,
      wheelY: 0.28,
      rearZ: -0.5,
    };
    return cache.bike;
  }

  /* ------------------------------ scooter ------------------------------ */

  /** The scooter's painted body: floor, leg shield, rear body, tail cap and rear fender. */
  function motoBody() {
    const shield = P.block(0.38, 0.5, 0.07, [0, 0.7, 0.56], WHITE, [-0.3, 0, 0]);
    return G.merge([
      P.block(0.34, 0.07, 0.66, [0, 0.43, 0.2], WHITE),
      shield,
      P.block(0.4, 0.28, 0.74, [0, 0.5, -0.5], WHITE),
      P.block(0.34, 0.14, 0.3, [0, 0.62, -0.88], WHITE),
      P.block(0.24, 0.3, 0.4, [0, 0.56, 0.1], WHITE),
      guard(0.24, -0.62, 0.29, 0.02, WHITE),
    ]);
  }

  /** The scooter's fixed dark bits: seat, floor mat, grab rail, exhaust, footrest, stand, number plate. */
  function motoTrim() {
    return G.merge([
      P.block(0.32, 0.1, 0.7, [0, 0.6, -0.12], "#23252b"),
      P.block(0.3, 0.012, 0.6, [0, 0.468, 0.2], "#23252b"),
      P.rod([-0.14, 0.74, -0.45], [-0.14, 0.74, -0.85], 0.015, GREY),
      P.rod([0.14, 0.74, -0.45], [0.14, 0.74, -0.85], 0.015, GREY),
      P.rod([-0.14, 0.74, -0.85], [0.14, 0.74, -0.85], 0.015, GREY),
      P.drum("z", 0.05, 0.42, [0.2, 0.3, -0.62], "#9aa0a8", 8),
      P.rod([-0.18, 0.2, -0.3], [-0.18, 0.05, -0.38], 0.015, DARK),
      P.block(0.2, 0.1, 0.012, [0, 0.52, -1.06], "#f4f4f0"),
    ]);
  }

  /** The scooter's lamps: a tail light, the stop light, four indicators. */
  function motoLamp() {
    const parts = [P.block(0.2, 0.07, 0.05, [0, 0.64, -1.04], "#d62b2b")];
    [-1, 1].forEach(function (k) {
      parts.push(P.block(0.05, 0.05, 0.05, [k * 0.21, 0.62, -1.02], "#f2a51c"));
      parts.push(P.block(0.05, 0.05, 0.05, [k * 0.27, 0.99, -0.24], "#f2a51c"));
    });
    return G.merge(parts);
  }

  /** The scooter's steering end, local to the front hub: column, bars, grips, mirrors, headlight cowl, fender. */
  function motoFork() {
    const parts = [
      P.rod([-0.05, 0.24, 0], [-0.05, 0.93, -0.34], 0.02, GREY),
      P.rod([0.05, 0.24, 0], [0.05, 0.93, -0.34], 0.02, GREY),
      P.rod([-0.3, 0.95, -0.34], [0.3, 0.95, -0.34], 0.018, DARK),
      P.block(0.1, 0.045, 0.045, [-0.3, 0.95, -0.34], "#23252b"),
      P.block(0.1, 0.045, 0.045, [0.3, 0.95, -0.34], "#23252b"),
      P.block(0.24, 0.22, 0.18, [0, 0.9, -0.22], "#e9e6dc"),
      P.block(0.16, 0.13, 0.05, [0, 0.9, -0.12], "#fff6d6"),
      P.block(0.18, 0.06, 0.1, [0, 1.0, -0.4], "#23252b"),
      guard(0.24, 0, 0.275, 0.025, "#e4e6ea"),
    ];
    [-1, 1].forEach(function (k) {
      parts.push(P.rod([k * 0.28, 0.96, -0.34], [k * 0.3, 1.14, -0.38], 0.01, DARK));
      parts.push(P.block(0.11, 0.07, 0.025, [k * 0.3, 1.17, -0.38], "#23252b"));
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
      wheelY: 0.24,
      rearZ: -0.62,
    };
    return cache.moto;
  }

  F.VehicleTwoWheel = { bike, moto };
})((window.KQ = window.KQ || {}));
