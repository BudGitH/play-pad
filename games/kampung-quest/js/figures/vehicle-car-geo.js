// Kampung Quest — the toy car bodies (F.VehicleCars). A car is drawn from its side view (bonnet, cabin, boot,
// wheel arches), pushed out to its width, then dressed: glass, pillars, roof, bumpers, grille, plates, mirrors,
// wipers, door seams, seats, dash and lamps. Five styles: hatch, sedan, taxi (a sedan with a roof sign), suv, mpv.
// Everything of one car merges into four geometries (tinted body, dark trim, glass, lamps) so a car is a few
// draw calls; the wheels and steering wheel are separate (vehicle-meshes.js). Local frame: faces +z, left +x.
//   F.VehicleCars.build(style) -> { body, trim, glass, lamp, axles:[front z, rear z], style }
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const P = F.VehicleParts;
  const G = F.Geo;
  const WHITE = "#ffffff";
  const DARK = "#2b2d33";
  const BLACK = "#1b1c20";
  const CHROME = "#c9ccd2";
  /** The height of the wheel arches' centre and radius, and the sill (bottom of the body). */
  const WHEEL_Y = 0.3;
  const ARCH_R = 0.37;
  const SILL = 0.22;
  /** How far the driver sits from the middle of the car. */
  const DRIVER_X = 0.34;
  /**
   * Per style (z forward): body ends zf / zr, axles axF / axR, the beltline (top of the doors), the bonnet tip and
   * leading edge, windscreen base A and top B, rear glass top C and base D, roof height, boot top, body width, rows
   * of rear seats, and whether it has a roof sign / rails.
   */
  const STYLES = {
    hatch: {
      zf: 1.65,
      zr: -1.55,
      axF: 1.0,
      axR: -0.95,
      belt: 0.8,
      hoodTip: 0.6,
      hoodLead: 0.72,
      A: 0.62,
      B: 0.15,
      C: -0.95,
      D: -1.32,
      roof: 1.42,
      tail: 0.8,
      w: 1.54,
      rows: [-0.95],
    },
    sedan: {
      zf: 1.9,
      zr: -1.8,
      axF: 1.15,
      axR: -1.05,
      belt: 0.8,
      hoodTip: 0.58,
      hoodLead: 0.72,
      A: 0.62,
      B: 0.12,
      C: -0.8,
      D: -1.1,
      roof: 1.42,
      tail: 0.84,
      w: 1.58,
      rows: [-0.95],
    },
    suv: {
      zf: 1.8,
      zr: -1.8,
      axF: 1.1,
      axR: -1.05,
      belt: 0.88,
      hoodTip: 0.68,
      hoodLead: 0.84,
      A: 0.6,
      B: 0.28,
      C: -1.5,
      D: -1.7,
      roof: 1.58,
      tail: 0.92,
      w: 1.62,
      rows: [-0.95],
      rails: true,
    },
    mpv: {
      zf: 1.8,
      zr: -1.9,
      axF: 1.1,
      axR: -1.1,
      belt: 0.86,
      hoodTip: 0.62,
      hoodLead: 0.78,
      A: 0.75,
      B: 0.5,
      C: -1.6,
      D: -1.85,
      roof: 1.62,
      tail: 0.9,
      w: 1.6,
      rows: [-0.95, -1.55],
      rails: true,
    },
  };
  STYLES.taxi = Object.assign({}, STYLES.sedan, { sign: true });
  const cache = {};

  /** The bottom edge from rear to front, cut by a wheel arch round each axle. */
  function bottomEdge(s) {
    const out = [];
    [s.axR, s.axF].forEach(function (zc) {
      out.push([zc - ARCH_R, SILL]);
      out.push(...P.arch(zc, WHEEL_Y, ARCH_R, 8));
      out.push([zc + ARCH_R, SILL]);
    });
    return out;
  }

  /** The body's whole side outline: bonnet, beltline, boot, then the bottom with its arches. */
  function tubOutline(s) {
    const top = [
      [s.zf, SILL],
      [s.zf, s.hoodTip],
      [s.zf - 0.12, s.hoodLead],
      [s.A, s.belt],
      [s.D, s.belt],
      [s.zr + 0.12, s.tail],
      [s.zr, s.tail - 0.12],
      [s.zr, SILL],
    ];
    return top.concat(bottomEdge(s));
  }

  /** The cabin's side outline (windscreen, roof, rear glass). */
  function cabinOutline(s) {
    return [
      [s.A, s.belt - 0.02],
      [s.B, s.roof],
      [s.C, s.roof],
      [s.D, s.belt - 0.02],
    ];
  }

  /** The roof panel on its own (the roof fades while somebody is driving so the hero shows). */
  function roofGeo(s) {
    const cw = s.w - 0.2;
    return P.block(cw + 0.04, 0.06, s.B - s.C + 0.1, [0, s.roof + 0.01, (s.B + s.C) / 2], WHITE);
  }

  /** The painted (tinted) parts: the body and the pillars. */
  function bodyParts(s) {
    const cw = s.w - 0.2;
    const parts = [P.sideSolid(tubOutline(s), s.w, WHITE)];
    [-1, 1].forEach(function (k) {
      const x = (k * cw) / 2;
      parts.push(P.rod([x, s.belt, s.A], [x, s.roof, s.B], 0.04, WHITE));
      parts.push(P.rod([x, s.roof, s.C], [x, s.belt, s.D], 0.06, WHITE));
      parts.push(P.rod([x, s.belt, -0.45], [x, s.roof, -0.45], 0.035, WHITE));
    });
    return G.merge(parts);
  }

  /** Front and rear: bumpers, grille, intake, plates (a plate is a white board with dark characters). */
  function endsTrim(s) {
    const parts = [
      P.block(s.w + 0.02, 0.12, 0.16, [0, 0.3, s.zf - 0.04], DARK),
      P.block(s.w + 0.02, 0.12, 0.16, [0, 0.3, s.zr + 0.04], DARK),
      P.block(0.72, 0.13, 0.06, [0, 0.5, s.zf + 0.005], BLACK),
      P.block(0.72, 0.025, 0.065, [0, 0.5, s.zf + 0.008], CHROME),
      P.block(0.9, 0.07, 0.06, [0, 0.28, s.zf + 0.02], BLACK),
      P.drum("z", 0.035, 0.14, [0.5, 0.27, s.zr - 0.04], "#9aa0a8", 8),
    ];
    parts.push(...plate(s.zf + 0.012, 0.4, 1), ...plate(s.zr - 0.012, 0.46, -1));
    return parts;
  }

  /** A number plate on the front (dir 1) or the rear (dir -1) face at height y. */
  function plate(z, y, dir) {
    const parts = [P.block(0.44, 0.1, 0.03, [0, y, z], "#f4f4f0")];
    for (let i = -2; i <= 2; i += 1) {
      parts.push(P.block(0.035, 0.055, 0.012, [i * 0.075, y, z + dir * 0.016], "#23252b"));
    }
    return parts;
  }

  /** The sides: door seams and handles, mirrors, wipers and the wheel wells (dark boxes behind the tyres). */
  function sidesTrim(s) {
    const parts = [P.block(1.3, 0.1, s.zf - s.zr - 0.7, [0, 0.25, (s.zf + s.zr) / 2], BLACK)];
    [s.axF, s.axR].forEach((zc) =>
      parts.push(P.block(1.3, 0.44, ARCH_R * 2, [0, 0.48, zc], BLACK)),
    );
    [-1, 1].forEach(function (k) {
      const x = (k * s.w) / 2;
      [s.A, -0.45].forEach((z) => parts.push(P.block(0.012, 0.46, 0.014, [x, 0.55, z], BLACK)));
      [-0.1, -0.8].forEach((z) =>
        parts.push(P.block(0.022, 0.03, 0.16, [x, s.belt - 0.08, z], CHROME)),
      );
      const mx = k * (s.w / 2 + 0.09);
      parts.push(P.block(0.16, 0.11, 0.1, [mx, s.belt + 0.14, s.A - 0.08], DARK));
      parts.push(
        P.rod(
          [k * (s.w / 2 - 0.04), s.belt + 0.05, s.A - 0.05],
          [mx, s.belt + 0.13, s.A - 0.08],
          0.015,
          DARK,
        ),
      );
      parts.push(
        P.rod(
          [k * 0.55, s.belt + 0.03, s.A - 0.04],
          [k * 0.05, s.belt + 0.05, s.A - 0.04],
          0.01,
          BLACK,
        ),
      );
    });
    return parts;
  }

  /**
   * The inside: a dark deck over the cabin, a dash, the passenger's seat back and headrest, low rear seat backs, and
   * (SUV, MPV) roof rails. The driver's seat back is left out and the rear ones are low, so the hero shows from behind.
   */
  function insideTrim(s, driverX) {
    const seat = "#3a4152";
    const cw = s.w - 0.2;
    const top = s.belt + 0.04; // the body's top face: its bevel stands 4 cm proud of the beltline
    const parts = [
      P.block(cw - 0.04, 0.025, s.A - s.D - 0.1, [0, top + 0.012, (s.A + s.D) / 2], "#34373f"),
      P.block(cw - 0.06, 0.18, 0.3, [0, top + 0.1, 0.5], "#23252b"),
      P.block(0.42, 0.4, 0.1, [-driverX, top + 0.2, -0.34], seat),
      P.block(0.2, 0.12, 0.08, [-driverX, top + 0.46, -0.34], seat),
      P.block(0.42, 0.06, 0.5, [driverX, top + 0.04, -0.05], seat),
    ];
    s.rows.forEach((z) => parts.push(P.block(cw - 0.1, 0.24, 0.1, [0, top + 0.12, z - 0.2], seat)));
    if (s.rails) parts.push(...roofRails(s));
    return parts;
  }

  /** Two roof rails with their feet. */
  function roofRails(s) {
    const parts = [];
    [-1, 1].forEach(function (k) {
      const x = k * 0.5;
      parts.push(
        P.rod([x, s.roof + 0.09, s.B - 0.1], [x, s.roof + 0.09, s.C + 0.1], 0.02, "#9aa0a8"),
      );
      [s.B - 0.1, s.C + 0.1].forEach((z) =>
        parts.push(P.rod([x, s.roof + 0.03, z], [x, s.roof + 0.09, z], 0.02, DARK)),
      );
    });
    return parts;
  }

  /** All the dark, vertex-coloured trim in one geometry. */
  function trimGeo(s, driverX) {
    return G.merge(endsTrim(s).concat(sidesTrim(s), insideTrim(s, driverX)));
  }

  /** The lamps (drawn unlit so they glow a little at dusk): head, tail, reverse, indicators and the taxi sign. */
  function lampGeo(s) {
    const parts = [];
    [-1, 1].forEach(function (k) {
      parts.push(P.block(0.3, 0.13, 0.08, [k * 0.52, 0.66, s.zf - 0.02], "#fff6d6"));
      parts.push(P.block(0.1, 0.06, 0.07, [k * 0.7, 0.52, s.zf - 0.02], "#f2a51c"));
      parts.push(P.block(0.34, 0.12, 0.08, [k * 0.55, s.tail - 0.1, s.zr + 0.02], "#d62b2b"));
      parts.push(P.block(0.1, 0.06, 0.07, [k * 0.33, s.tail - 0.1, s.zr + 0.025], "#f4f4f0"));
    });
    if (s.sign)
      parts.push(P.block(0.5, 0.15, 0.22, [0, s.roof + 0.14, (s.B + s.C) / 2], "#fff1b0"));
    return G.merge(parts);
  }

  /**
   * Build (and cache) the geometries of a style; an unknown style is a sedan. `lhd` puts the driver on the left
   * (x > 0), else on the right (Singapore).
   */
  function build(style, lhd) {
    const name = STYLES[style] ? style : "sedan";
    const key = name + (lhd ? "-l" : "-r");
    if (cache[key]) return cache[key];
    const s = STYLES[name];
    const glass = P.sideSolid(cabinOutline(s), s.w - 0.24, WHITE, 0.03);
    cache[key] = {
      style: name,
      driverX: lhd ? DRIVER_X : -DRIVER_X,
      body: bodyParts(s),
      roof: roofGeo(s),
      trim: trimGeo(s, lhd ? DRIVER_X : -DRIVER_X),
      glass,
      lamp: lampGeo(s),
      axles: [s.axF, s.axR],
      width: s.w,
      length: s.zf - s.zr,
    };
    return cache[key];
  }

  F.VehicleCars = { build, STYLES: Object.keys(STYLES), ARCH_R, WHEEL_Y };
})((window.KQ = window.KQ || {}));
