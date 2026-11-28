/* ============================================================================
 * FILE: vehicle-car-geo.js
 * PURPOSE: Kampung Quest — the toy car bodies (F.VehicleCars). A car is drawn from its side view with curves (a
 *          rounded nose, a crowned bonnet, a sloping boot, rounded roof corners, a wheel arch round each axle),
 *          pushed out to its width and then squeezed so it narrows toward the nose, the tail and the roof (the
 *          "tumblehome" that stops it looking like a slab). Then it is dressed: arch trims, pillars, window
 *          rubbers, roof, bumpers with a lower lip, grille, plates, mirrors on arms, wipers, door seams and
 *          handles, side skirts, seats, dash, wrap-round head and tail lamps, fog lamps. Five styles: hatch, sedan,
 *          taxi (a sedan with a roof sign), suv, mpv. Everything of one car merges into five geometries (tinted
 *          body, roof, dark trim, glass, lamps) so a car is a few draw calls; the wheels and steering wheel are
 *          separate (vehicle-meshes.js). Local frame: faces +z, left +x.
 *            F.VehicleCars.build(style, lhd) -> { body, roof, trim, glass, lamp, axles:[front z, rear z], width,
 *                                                  length, mid, style, driverX }
 * BUSINESS CONTEXT: AC-R8 (realism round) and AC-P14 (playability round: "cars with proper body curvature, wheel
 *   arches, windows, lights, mirrors; draw-call budget kept"), features/kampung-quest-playability/requirements.md.
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
      hoodTip: 0.66,
      hoodLead: 0.8,
      A: 0.62,
      B: 0.18,
      C: -1.5,
      D: -1.7,
      roof: 1.58,
      tail: 0.92,
      w: 1.62,
      rows: [-0.95],
      rails: true,
      flare: true,
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
  /** The kampung taxi's plain two-tone livery (no operator's name or colours): teal lower body, white upper. */
  const TAXI_LIVERY = { lower: "#1f7a8c", upper: "#f4f4f0" };
  /**
   * Number plates. Singapore (LTA): white characters on black front and rear, or the "Euro" option of black on
   * white at the front and black on yellow at the rear, in the pattern S + 2 letters, a number, a check letter
   * (features/kampung-quest-playability/sg-cars-reference.md). Makkah / Madinah cars get a plain white plate.
   */
  const PLATES = {
    black: { front: ["#141516", "#f2f2f0"], rear: ["#141516", "#f2f2f0"] },
    euro: { front: ["#f4f4f0", "#141516"], rear: ["#f2c230", "#141516"] },
    plain: { front: ["#f4f4f0", "#23252b"], rear: ["#f4f4f0", "#23252b"] },
  };
  /** Which Singapore plate each style wears (both are common; a fixed choice keeps the geometry shared). */
  const SG_PLATE = { hatch: "euro", sedan: "black", taxi: "black", suv: "euro", mpv: "black" };
  const cache = {};
  const lerp = (a, b, t) => a + (b - a) * t;

  /** The bottom edge from rear to front, with a round wheel arch over each axle. */
  function bottomEdge(path, s) {
    [s.axR, s.axF].forEach(function (zc) {
      path.lineTo(zc - ARCH_R, SILL);
      path.absarc(zc, WHEEL_Y, ARCH_R, Math.PI, 0, true);
      path.lineTo(zc + ARCH_R, SILL);
    });
  }

  /**
   * The body's side view: a bumper with a lip, an upright nose with a small radius, a flat bonnet rising
   * gently to the windscreen, the beltline, a straight boot deck, a squared-off tail, and the wheel arches.
   */
  function tubShape(s) {
    const p = new THREE.Shape();
    p.moveTo(s.zf - 0.1, SILL);
    p.quadraticCurveTo(s.zf + 0.03, SILL, s.zf + 0.03, SILL + 0.1);
    p.lineTo(s.zf + 0.03, SILL + 0.2);
    p.lineTo(s.zf - 0.005, SILL + 0.23);
    p.lineTo(s.zf, s.hoodTip - 0.05);
    p.quadraticCurveTo(s.zf, s.hoodLead, s.zf - 0.12, s.hoodLead + 0.005);
    p.lineTo(s.A, s.belt);
    p.lineTo(s.D, s.belt);
    p.lineTo(s.zr + 0.12, s.tail);
    p.quadraticCurveTo(s.zr, s.tail, s.zr, s.tail - 0.1);
    p.lineTo(s.zr, SILL + 0.23);
    p.lineTo(s.zr - 0.03, SILL + 0.2);
    p.lineTo(s.zr - 0.03, SILL + 0.1);
    p.quadraticCurveTo(s.zr - 0.03, SILL, s.zr + 0.1, SILL);
    bottomEdge(p, s);
    p.lineTo(s.zf - 0.1, SILL);
    return p;
  }

  /** The cabin's side view (windscreen, roof, rear glass) with rounded roof corners. */
  function cabinShape(s) {
    const p = new THREE.Shape();
    const y0 = s.belt - 0.02;
    p.moveTo(s.A, y0);
    p.lineTo(lerp(s.A, s.B, 0.86), lerp(y0, s.roof, 0.86));
    p.quadraticCurveTo(s.B, s.roof, s.B - 0.14, s.roof + 0.005);
    p.quadraticCurveTo((s.B + s.C) / 2, s.roof + 0.03, s.C + 0.14, s.roof + 0.005);
    p.quadraticCurveTo(s.C, s.roof, lerp(s.C, s.D, 0.15), lerp(s.roof, y0, 0.15));
    p.lineTo(s.D, y0);
    p.lineTo(s.A, y0);
    return p;
  }

  /** How much narrower the cabin is at height y (1 at the beltline, 0.86 at the roof). */
  const cabinK = (s) => (y) => 1 - 0.14 * P.smooth(s.belt, s.roof, y);

  /** How much narrower the body is at (y, z): it tucks in toward the nose and tail and at the shoulder. */
  function bodyK(s) {
    const mid = (s.zf + s.zr) / 2;
    const half = (s.zf - s.zr) / 2;
    return (y, z) =>
      (1 - 0.05 * P.smooth(half - 0.45, half, Math.abs(z - mid))) *
      (1 - 0.035 * P.smooth(s.belt - 0.1, s.belt + 0.03, y));
  }

  /**
   * The roof panel on its own (it fades while somebody drives so the hero shows; parked it is solid): the cabin's
   * own outline a touch larger, cut flat 8 cm under the roof line, so it caps the glass exactly.
   */
  function roofGeo(s) {
    const g = P.squeeze(P.sideShape(cabinShape(s), s.w - 0.2, WHITE, 0.05, 8, 2), cabinK(s));
    const pos = g.attributes.position;
    const cut = s.roof - 0.08;
    const [zr, zf] = cutSpan(s, cut);
    for (let i = 0; i < pos.count; i += 1) {
      if (pos.getY(i) >= cut) continue;
      pos.setY(i, cut);
      pos.setZ(i, Math.max(zr, Math.min(zf, pos.getZ(i))));
    }
    return P.smoothed(g, 40);
  }

  /**
   * Where the cabin's outline crosses height y (rear z, front z), on its windscreen and rear-glass lines,
   * plus the bevel: the roof cap is the cabin above y, so points below are pulled onto that line, not ahead of it.
   */
  function cutSpan(s, y) {
    const y0 = s.belt - 0.02;
    const at = (z0, z1, ya, yb) => z0 + (z1 - z0) * ((y - ya) / (yb - ya));
    const front = at(s.A, lerp(s.A, s.B, 0.86), y0, lerp(y0, s.roof, 0.86));
    const rear = at(s.D, lerp(s.C, s.D, 0.15), y0, lerp(s.roof, y0, 0.15));
    return [rear - 0.05, front + 0.05];
  }

  /** The painted (tinted) parts: the curved body, its pillars (A, B, C) leaning in with the glass. */
  function bodyParts(s, livery) {
    const cw = s.w - 0.2;
    const top = (cw / 2) * 0.87;
    const tub = P.squeeze(P.sideShape(tubShape(s), s.w, WHITE, 0.035, 8, 2), bodyK(s));
    const parts = [P.smoothed(tub, 34)];
    [-1, 1].forEach(function (k) {
      const x = (k * cw) / 2;
      parts.push(P.rod([x, s.belt, s.A], [k * top, s.roof - 0.03, s.B - 0.06], 0.045, WHITE));
      parts.push(P.rod([k * top, s.roof - 0.03, s.C + 0.08], [x, s.belt, s.D], 0.07, WHITE));
      parts.push(P.rod([x, s.belt, -0.45], [k * top, s.roof - 0.02, -0.45], 0.04, WHITE));
    });
    const g = G.merge(parts);
    return livery ? twoTone(g, s.belt - 0.06, livery) : g;
  }

  /** Bake a two-tone livery into the body's vertex colours: `lower` under height y, `upper` above it. */
  function twoTone(g, y, livery) {
    const lo = new THREE.Color(livery.lower);
    const hi = new THREE.Color(livery.upper);
    const pos = g.attributes.position;
    const col = g.attributes.color;
    for (let i = 0; i < pos.count; i += 1) {
      const c = pos.getY(i) < y ? lo : hi;
      col.setXYZ(i, c.r, c.g, c.b);
    }
    return g;
  }

  /** Front and rear: bumpers with a dark lower lip, grille with a chrome bar, intake, fog lamps' bezels, plates. */
  function endsTrim(s, scheme) {
    const parts = [
      P.block(s.w * 0.9, 0.05, 0.1, [0, SILL + 0.015, s.zf + 0.0], BLACK),
      P.block(s.w * 0.9, 0.05, 0.1, [0, SILL + 0.015, s.zr - 0.0], BLACK),
      P.block(s.w * 0.36, 0.12, 0.06, [0, lampY(s), s.zf + 0.01], BLACK),
      P.block(s.w * 0.36, 0.02, 0.065, [0, lampY(s) + 0.03, s.zf + 0.014], CHROME),
      P.block(s.w * 0.36, 0.02, 0.065, [0, lampY(s) - 0.03, s.zf + 0.014], CHROME),
      P.drum("z", 0.035, 0.14, [0.5, 0.27, s.zr - 0.04], "#9aa0a8", 8),
    ];
    parts.push(...plate(s.zf + 0.045, SILL + 0.15, 1, scheme.front));
    parts.push(...plate(s.zr - 0.045, SILL + 0.15, -1, scheme.rear));
    return parts;
  }

  /** The headlamps' and grille's height: on the upright part of the nose, below its rounded top. */
  const lampY = (s) => s.hoodTip - 0.13;

  /**
   * A number plate on the front (dir 1) or the rear (dir -1) face at height y, in [background, characters]:
   * Singapore's pattern, three letters, a gap, four digits, a gap, a check letter (made-up, as bars).
   */
  function plate(z, y, dir, colours) {
    const parts = [P.block(0.5, 0.11, 0.03, [0, y, z], colours[0])];
    [-0.2, -0.165, -0.13, -0.06, -0.025, 0.01, 0.045, 0.12].forEach((x) =>
      parts.push(P.box(0.024, 0.06, 0.008, [x * dir, y, z + dir * 0.017], colours[1])),
    );
    return parts;
  }

  /** The dark wheel wells behind the tyres, a dark trim round each arch (both sides) and the side skirts. */
  function archTrim(s) {
    const parts = [P.block(1.3, 0.1, s.zf - s.zr - 0.7, [0, 0.25, (s.zf + s.zr) / 2], BLACK)];
    [s.axF, s.axR].forEach(function (zc) {
      parts.push(P.block(1.3, 0.44, ARCH_R * 2, [0, 0.48, zc], BLACK));
      const t = s.flare ? 0.055 : 0.032;
      [-1, 1].forEach((k) =>
        parts.push(P.halfRing(k * (s.w / 2 - 0.03 + t / 2), WHEEL_Y, zc, ARCH_R + 0.02, t, DARK)),
      );
    });
    [-1, 1].forEach((k) =>
      parts.push(
        P.block(
          0.05,
          0.06,
          s.axF - s.axR - 2 * ARCH_R - 0.06,
          [k * (s.w / 2 - 0.01), SILL + 0.02, (s.axF + s.axR) / 2],
          DARK,
        ),
      ),
    );
    return parts;
  }

  /** One side's details: door seams, chrome handles, window rubber along the belt, a mirror on its arm, a wiper. */
  function sideTrim(s, k) {
    const x = (k * s.w) / 2;
    const xin = (k * (s.w - 0.2)) / 2;
    const mx = k * (s.w / 2 + 0.11);
    const parts = [
      P.rod([xin, s.belt + 0.01, s.A], [xin, s.belt + 0.01, s.D], 0.016, BLACK),
      P.lens(0.17, 0.11, 0.12, [mx, s.belt + 0.14, s.A - 0.1], DARK),
      P.lens(0.02, 0.085, 0.1, [mx + k * 0.06, s.belt + 0.14, s.A - 0.08], "#7d8a99"),
      P.rod(
        [k * (s.w / 2 - 0.04), s.belt + 0.04, s.A - 0.08],
        [mx, s.belt + 0.12, s.A - 0.1],
        0.016,
        DARK,
      ),
      P.rod(
        [k * 0.55, s.belt + 0.04, s.A - 0.03],
        [k * 0.05, s.belt + 0.06, s.A - 0.03],
        0.01,
        BLACK,
      ),
    ];
    [s.A - 0.02, -0.45].forEach((z) =>
      parts.push(P.box(0.012, s.belt - 0.32, 0.014, [x * 0.995, (s.belt + 0.3) / 2, z], BLACK)),
    );
    [-0.1, -0.8].forEach((z) =>
      parts.push(P.block(0.024, 0.03, 0.16, [x, s.belt - 0.08, z], CHROME)),
    );
    return parts;
  }

  /**
   * The inside: a dark deck over the cabin, a dash, the passenger's seat back and headrest, low rear seat backs, and
   * (SUV, MPV) roof rails. The driver's seat back is left out and the rear ones are low, so the hero shows from behind.
   */
  function insideTrim(s, driverX) {
    const seat = "#3a4152";
    const cw = s.w - 0.2;
    const top = s.belt + 0.04; // the body's top face: its bevel stands proud of the beltline
    const parts = [
      P.block(cw - 0.08, 0.025, s.A - s.D - 0.1, [0, top + 0.012, (s.A + s.D) / 2], "#34373f"),
      P.block(cw - 0.1, 0.18, 0.3, [0, top + 0.1, 0.5], "#23252b"),
      P.block(0.42, 0.4, 0.1, [-driverX, top + 0.2, -0.34], seat),
      P.block(0.2, 0.12, 0.08, [-driverX, top + 0.46, -0.34], seat),
      P.block(0.42, 0.06, 0.5, [driverX, top + 0.04, -0.05], seat),
    ];
    s.rows.forEach((z) =>
      parts.push(P.block(cw - 0.14, 0.24, 0.1, [0, top + 0.12, z - 0.2], seat)),
    );
    if (s.rails) parts.push(...roofRails(s));
    return parts;
  }

  /** Two roof rails with their feet. */
  function roofRails(s) {
    const parts = [];
    [-1, 1].forEach(function (k) {
      const x = k * 0.5;
      parts.push(
        P.rod([x, s.roof + 0.09, s.B - 0.14], [x, s.roof + 0.09, s.C + 0.14], 0.02, "#9aa0a8"),
      );
      [s.B - 0.14, s.C + 0.14].forEach((z) =>
        parts.push(P.rod([x, s.roof + 0.03, z], [x, s.roof + 0.09, z], 0.02, DARK)),
      );
    });
    return parts;
  }

  /** All the dark, vertex-coloured trim in one geometry. */
  function trimGeo(s, driverX, scheme, extra) {
    const parts = endsTrim(s, scheme).concat(archTrim(s), sideTrim(s, -1), sideTrim(s, 1));
    return G.merge(parts.concat(insideTrim(s, driverX), extra || []));
  }

  /** One side's lamps: a wrap-round headlamp in a chrome bezel, an indicator, a wrap-round tail lamp, a fog lamp. */
  function sideLamps(s, k) {
    const head = lampY(s);
    const tail = s.tail - 0.24;
    const side = k * (s.w / 2) * 0.93;
    return [
      P.lens(0.32, 0.12, 0.12, [k * 0.5, head, s.zf - 0.02], "#fff6d6", [0, k * 0.3, 0], 12),
      P.lens(0.12, 0.08, 0.1, [k * 0.48, head, s.zf + 0.02], "#ffffff", [0, k * 0.3, 0]),
      P.lens(0.06, 0.1, 0.2, [side, head, s.zf - 0.18], "#fff6d6"),
      P.lens(0.12, 0.05, 0.08, [k * 0.68, head - 0.1, s.zf], "#f2a51c"),
      P.lens(0.36, 0.12, 0.12, [k * 0.54, tail, s.zr], "#d62b2b", [0, -k * 0.3, 0], 12),
      P.lens(0.06, 0.12, 0.22, [side, tail, s.zr + 0.16], "#d62b2b"),
      P.lens(0.1, 0.06, 0.08, [k * 0.3, tail, s.zr - 0.01], "#f4f4f0"),
      P.drum("z", 0.045, 0.06, [k * 0.55, 0.3, s.zf + 0.02], "#fffbe8", 14),
    ];
  }

  /** The lamps' pieces (drawn unlit so they glow a little at dusk) and the taxi's roof sign. */
  function lampParts(s) {
    const parts = sideLamps(s, -1).concat(sideLamps(s, 1));
    if (!s.sign) return parts;
    const z = (s.B + s.C) / 2;
    const y = s.roof + 0.16;
    parts.push(P.block(0.5, 0.15, 0.2, [0, y, z], "#fff1b0"));
    parts.push(...word([0, y, z + 0.102], 1), ...word([0, y, z - 0.102], -1));
    return parts;
  }

  /** Strokes of each letter of "TAXI": [x, y, width, height, tilt] in a letter's own frame (metres). */
  const LETTERS = [
    [
      [0, 0.04, 0.075, 0.016, 0],
      [0, 0, 0.016, 0.095, 0],
    ],
    [
      [-0.019, 0, 0.015, 0.1, -0.36],
      [0.019, 0, 0.015, 0.1, 0.36],
      [0, -0.012, 0.04, 0.013, 0],
    ],
    [
      [0, 0, 0.015, 0.105, 0.6],
      [0, 0, 0.015, 0.105, -0.6],
    ],
    [[0, 0, 0.016, 0.095, 0]],
  ];

  /** The word "TAXI" in dark strokes on a face of the sign (dir 1 front, -1 back, read the right way round). */
  function word(at, dir) {
    const out = [];
    LETTERS.forEach(function (strokes, i) {
      const cx = at[0] + dir * (i - 1.5) * 0.1;
      strokes.forEach(function (st) {
        const g = P.paint(new THREE.BoxGeometry(st[2], st[3], 0.008), "#1b1c20");
        out.push(G.place(g, [cx + dir * st[0], at[1] + st[1], at[2]], [0, 0, dir * st[4]]));
      });
    });
    return out;
  }

  /**
   * Build (and cache) the geometries of a style; an unknown style is a sedan. `lhd` puts the driver on the left
   * (x > 0), else on the right (Singapore).
   */
  function build(style, lhd, low) {
    const name = STYLES[style] ? style : "sedan";
    const key = name + (lhd ? "-l" : "-r") + (low ? "-low" : "");
    if (cache[key]) return cache[key];
    const old = P.setDetail(low ? 0.55 : 1);
    cache[key] = assemble(name, lhd, low);
    P.setDetail(old);
    return cache[key];
  }

  /**
   * The geometry set of a style. Low tier: fewer segments everywhere and the lamps merged into the trim (one
   * draw call less per car). Singapore cars wear Singapore plates; a kampung taxi wears the two-tone livery.
   */
  function assemble(name, lhd, low) {
    const s = STYLES[name];
    const driverX = lhd ? DRIVER_X : -DRIVER_X;
    const livery = s.sign && !lhd ? TAXI_LIVERY : null;
    const scheme = PLATES[lhd ? "plain" : SG_PLATE[name]];
    const lamps = lampParts(s);
    const glass = P.squeeze(P.sideShape(cabinShape(s), s.w - 0.24, WHITE, 0.04, 8, 2), cabinK(s));
    return {
      style: name,
      driverX,
      livery,
      body: bodyParts(s, livery),
      roof: roofGeo(s),
      trim: trimGeo(s, driverX, scheme, low ? lamps : null),
      glass: P.smoothed(glass, 45),
      lamp: low ? null : G.merge(lamps),
      axles: [s.axF, s.axR],
      width: s.w,
      length: s.zf - s.zr,
      mid: (s.zf + s.zr) / 2,
    };
  }

  F.VehicleCars = { build, STYLES: Object.keys(STYLES), ARCH_R, WHEEL_Y };
})((window.KQ = window.KQ || {}));
