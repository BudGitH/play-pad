/* ============================================================================
 * FILE: vehicle-car-inside.js
 * PURPOSE: Kampung Quest — a car's cabin (F.VehicleCarInside), seen through the tinted glass and through an open
 *          door: a floor, a curved dashboard with an instrument hood and a softly lit centre screen, a console,
 *          shaped seats (cushion, raked back, headrest) for every seat, the door-side liners, and a parked
 *          steering wheel (owner "steer": it is swapped for the animated one while somebody drives). Also the
 *          seat list of the rig ({pos, heading, kind}) and where the steering wheel sits.
 *            F.VehicleCarInside.seats(s, driverX) -> [{pos: [x, y, z], heading, kind}]
 *            F.VehicleCarInside.pieces(s, driverX, low) -> [piece]
 *            F.VehicleCarInside.STEER_AT -> [y, z] of the steering wheel's centre (a car's)
 * BUSINESS CONTEXT: owner's realism pass ("people inside can be seen"), rig.interior / rig.seats in vehicle-rig.js.
 * DEPENDENCIES: KQ.Figures.VehicleParts, VehicleMats, VehicleCarDress (belt height), Geo.
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicle-rig.spec.mjs (seats inside the body box)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const P = () => F.VehicleParts;
  const C = () => F.VehicleMats.CLS;
  /** A seated figure's origin height in a car (vehicle-meshes.js SEAT.car.y) and the seat cushion's top. */
  const ORIGIN_Y = 0.315;
  const CUSHION_TOP = 0.585;
  const STEER_AT = [0.87, 0.3];
  const SEAT_HEX = ["#34373e", "#5a4c40", "#3b4350"];

  /** Every seat: driver, front passenger, then the rear rows right then left. Local, facing +z (heading 0). */
  function seats(s, driverX) {
    const lift = s.sill - 0.21;
    const out = [
      { pos: [driverX, ORIGIN_Y + lift, 0], heading: 0, kind: "driver" },
      { pos: [-driverX, ORIGIN_Y + lift, 0], heading: 0, kind: "front" },
    ];
    s.rows.forEach((z) =>
      [-0.36, 0.36].forEach((x) =>
        out.push({ pos: [x, ORIGIN_Y + lift + 0.02, z], heading: 0, kind: "rear" }),
      ),
    );
    return out;
  }

  /** One seat: cushion, raked back, headrest (rounded blocks), at x, z with its cushion top at y. */
  function seat(x, y, z, hex, w, low, back) {
    const h = back || 0.52;
    const parts = [
      P().block(w, 0.09, 0.44, [x, y - 0.045, z + 0.04], hex),
      P().block(w, h, 0.1, [x, y + h / 2 - 0.02, z - 0.22 - h * 0.09], hex, [-0.18, 0, 0]),
    ];
    if (!low && !back)
      parts.push(
        P().block(w * 0.5, 0.13, 0.08, [x, y + h + 0.06, z - 0.33 - h * 0.09], hex, [-0.18, 0, 0]),
      );
    return parts;
  }

  /** The dashboard: a soft curved top, an instrument hood in front of the driver, a lit screen, vents. */
  function dash(s, driverX) {
    const y = F.VehicleCarDress.beltAt(s, s.A - 0.3);
    const cw = s.w - 0.34;
    return [
      P().lens(cw, 0.2, 0.5, [0, y - 0.02, s.A - 0.18], "#25272c", [0, 0, 0], 14),
      P().lens(0.36, 0.1, 0.2, [driverX, y + 0.06, s.A - 0.38], "#1c1d21", [0, 0, 0], 10),
      P().tag(P().box(0.3, 0.16, 0.02, [0, y + 0.07, s.A - 0.42], "#8fb4d8"), C().screen),
      P().block(0.22, 0.16, 0.6, [0, CUSHION_TOP - 0.02, 0.15], "#25272c"),
    ];
  }

  /** The parked steering wheel (owner "steer"), tilted toward the driver like the animated one. */
  function wheel(driverX) {
    const g = P().steering();
    g.rotateX(0.64);
    return g.translate(driverX, STEER_AT[0], STEER_AT[1]);
  }

  /** The cabin's pieces: floor and liners, dash, seats (body); the parked steering wheel (owner "steer"). */
  function pieces(s, driverX, low) {
    const hex = SEAT_HEX[s.name.length % SEAT_HEX.length];
    const lift = s.sill - 0.21;
    const top = CUSHION_TOP + lift;
    const len = s.A - s.D - 0.2;
    const parts = [
      P().block(s.w - 0.3, 0.03, len, [0, 0.34 + lift, (s.A + s.D) / 2], "#1f2024"),
      P().block(s.w - 0.36, 0.4, 0.04, [0, 0.55 + lift, s.A - 0.08], "#1f2024"),
    ].concat(dash(s, driverX));
    [driverX, -driverX].forEach((x) => parts.push(...seat(x, top, 0, hex, 0.42, low)));
    s.rows.forEach((z) => parts.push(...seat(0, top, z, hex, s.w - 0.5, low, 0.5)));
    const body = F.Geo.merge(parts.map((g) => P().tag(g, g.attributes.aSkin.getX(0) || C().matte)));
    return [
      { layer: "trim", owner: "body", g: body },
      { layer: "trim", owner: "steer", g: wheel(driverX) },
    ];
  }

  F.VehicleCarInside = { seats, pieces, STEER_AT, ORIGIN_Y };
})((window.KQ = window.KQ || {}));
