/* ============================================================================
 * FILE: vehicle-car-dress.js
 * PURPOSE: Kampung Quest — what dresses a car's moulded body (F.VehicleCarDress), all shot onto the curved skin
 *          as thin decals (F.VehicleLoft.decal) so they follow it exactly:
 *            - front: slim LED head lamps wrapping round the corners (dark housing, a DRL strip, a projector, an
 *              amber indicator), a slim upper grille with a bright strip, a big lower intake with slats, a bumper
 *              lip, the plate; an electric car gets a closed nose;
 *            - rear: wrap-round tail lamps (tail strip, brake, indicator, reverse) joined by a light bar on the
 *              sedans, a diffuser, the plate, a tail pipe (not on an electric car), a high brake lamp;
 *            - sides: flush door handles in a dark recess on every door, mirrors on the front doors with an
 *              indicator in the cap, wipers, a fin aerial, roof rails (SUV / MPV), a roof spoiler, the taxi sign.
 *          Each piece is {layer: "paint" | "trim" | "roof", owner: "body" | "door0".., g}; lamps are trim pieces
 *          tagged with a lamp class (F.VehicleMats.CLS) so they light up from the trim material's uniforms.
 *            F.VehicleCarDress.front(s, o) / rear(s, o) / sides(s, o) -> [piece]; o = {lhd, scheme, fuel}
 *            F.VehicleCarDress.exhaust(s) -> the tail pipe's tip [x, y, z]
 * BUSINESS CONTEXT: owner's realism pass ("door handles, the lights light up when stopping, exhaust"),
 *   features/kampung-quest-playability/notes-vehicles.md, "Realism pass". No badges, logos or maker shapes.
 * DEPENDENCIES: KQ.Figures.VehicleLoft, VehicleParts, VehicleMats, VehicleCarShape.
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicle-rig.spec.mjs
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const L = () => F.VehicleLoft;
  const P = () => F.VehicleParts;
  const C = () => F.VehicleMats.CLS;
  const lerp = (a, b, t) => a + (b - a) * t;
  const BLACK = "#121316";
  const CHROME = "#d5d8dd";

  /** A piece of a layer owned by the body or a door. */
  const piece = (layer, owner, g) => (g ? { layer, owner, g } : null);

  /** The inside test of a style's tub. */
  const tester = (s) => (x, y, z) => L().inside(s.body, x, y, z);

  /** A decal on the tub (see F.VehicleLoft.decal). */
  function decal(s, nu, nv, ray, eps, hex, cls) {
    const k = P().detail() < 0.7 ? 0.6 : 1;
    return L().decal(tester(s), Math.max(1, Math.round(nu * k)), nv, ray, eps, hex, cls);
  }

  /** A ray round a corner: from centre c (plan), at angle phi from straight ahead toward side k, height y. */
  function corner(c, k, phi, y) {
    const dir = [k * Math.sin(phi), 0, Math.cos(phi)];
    return [
      [c[0] + dir[0] * 1.4, y, c[1] + dir[2] * 1.4],
      [-dir[0], 0, -dir[2]],
    ];
  }

  /** A ray straight at the nose (dir -1) or the tail (dir 1) through (x, y). */
  const straight = (s, x, y, dir) => [
    [x, y, dir < 0 ? s.zf + 0.5 : s.zr - 0.5],
    [0, 0, dir],
  ];

  /** A ray at the side k through (z, y). */
  const sideRay = (k, z, y) => [
    [k * 1.6, y, z],
    [-k, 0, 0],
  ];

  /** The head lamp of side k: a slim swept lens wrapping the corner, its parts by (u, v) ranges and class. */
  function headLamp(s, k, o) {
    const c = [k * (s.w / 2 - 0.42), s.zf - 0.42];
    const top = (u) => s.nose - 0.035 + 0.03 * u;
    const h = (u) => 0.075 - 0.035 * u;
    const ray = (u0, u1, v0, v1) => (u, v) =>
      corner(
        c,
        k,
        lerp(0.14, 1.2, lerp(u0, u1, u)),
        top(lerp(u0, u1, u)) - h(lerp(u0, u1, u)) * (1 - lerp(v0, v1, v)),
      );
    const ind = k > 0 ? C().indL : C().indR;
    return [
      piece("trim", "body", decal(s, 10, 2, ray(0, 1, 0, 1), 0.003, "#15171b", C().gloss)),
      piece(
        "trim",
        "body",
        decal(s, 10, 1, ray(0.02, 0.95, 0.74, 0.94), 0.006, "#eef3fb", C().drl),
      ),
      piece("trim", "body", decal(s, 3, 1, ray(0.06, 0.4, 0.12, 0.62), 0.006, "#dfe7f0", C().head)),
      piece("trim", "body", decal(s, 3, 1, ray(0.66, 0.98, 0.1, 0.56), 0.006, "#f39a1e", ind)),
    ].concat(
      o.low
        ? []
        : [
            piece(
              "trim",
              "body",
              decal(s, 3, 1, ray(0.42, 0.62, 0.12, 0.62), 0.006, "#9aa3ad", C().chrome),
            ),
          ],
    );
  }

  /** A flat patch on the nose or tail over x0..x1 (x1 may be narrower at the top: a trapezoid), y0..y1. */
  function face(s, dir, xb, xt, y0, y1, eps, hex, cls) {
    const ray = (u, v) => straight(s, (u - 0.5) * 2 * lerp(xb, xt, v), lerp(y0, y1, v), dir);
    return decal(s, 8, 2, ray, eps, hex, cls);
  }

  /** The grille, intake, lip and fog slots; an electric car has a closed nose with a thin dark strip. */
  function nose(s, o) {
    const out = [];
    const g = s.nose;
    if (o.fuel !== "electric") {
      out.push(face(s, -1, 0.42, 0.4, g - 0.085, g - 0.025, 0.004, BLACK, C().gloss));
      out.push(face(s, -1, 0.4, 0.38, g - 0.04, g - 0.03, 0.007, CHROME, C().chrome));
    } else out.push(face(s, -1, 0.36, 0.34, g - 0.06, g - 0.05, 0.004, BLACK, C().gloss));
    const yI = s.chin + 0.05;
    out.push(face(s, -1, 0.52, 0.42, yI, g - 0.13, 0.004, "#1b1c20", C().matte));
    for (let i = 1; i < (o.low ? 2 : 4); i += 1) {
      const y = lerp(yI, g - 0.13, i / 4);
      out.push(
        face(
          s,
          -1,
          lerp(0.52, 0.42, i / 4) - 0.02,
          lerp(0.52, 0.42, i / 4) - 0.02,
          y,
          y + 0.01,
          0.007,
          "#3a3d44",
          C().satin,
        ),
      );
    }
    return out.map((g2) => piece("trim", "body", g2));
  }

  /** A number plate box on the nose (dir -1) or tail (dir 1) at height y, on the skin. */
  function plateAt(s, y, dir, colours) {
    const t = L().hit(tester(s), straight(s, 0, y, dir)[0], [0, 0, dir], 2);
    const z = (dir < 0 ? s.zf + 0.5 : s.zr - 0.5) + dir * (t || 0.5) - dir * 0.012;
    const parts = [P().block(0.5, 0.11, 0.024, [0, y, z], colours[0])];
    [-0.2, -0.165, -0.13, -0.06, -0.025, 0.01, 0.045, 0.12].forEach((x) =>
      parts.push(P().box(0.024, 0.06, 0.008, [x * -dir, y, z - dir * 0.014], colours[1])),
    );
    return F.Geo.merge(parts);
  }

  /** Everything on the front. */
  function front(s, o) {
    const out = headLamp(s, 1, o).concat(headLamp(s, -1, o), nose(s, o));
    out.push(piece("trim", "body", plateAt(s, s.chin + 0.16, -1, o.scheme.front)));
    return out.filter(Boolean);
  }

  /** The tail lamp of side k: dark housing, tail strip, brake, indicator and reverse segments. */
  function tailLamp(s, k) {
    const c = [k * (s.w / 2 - 0.36), s.zr + 0.36];
    const top = (s.deck === null ? s.belt + s.rise : s.deck) - 0.045;
    const h = (u) => 0.1 - 0.04 * u;
    const ray = (u0, u1, v0, v1) => (u, v) => {
      const uu = lerp(u0, u1, u);
      return corner(c, k, Math.PI - lerp(0.12, 1.2, uu), top - h(uu) * (1 - lerp(v0, v1, v)));
    };
    const ind = k > 0 ? C().indL : C().indR;
    return [
      ["#2a0a0d", C().gloss, 0, 1, 0, 1, 0.003],
      ["#c0121b", C().tail, 0.02, 0.98, 0.62, 0.92, 0.006],
      ["#e1141f", C().brake, 0.04, 0.5, 0.12, 0.56, 0.006],
      ["#f39a1e", ind, 0.54, 0.76, 0.12, 0.5, 0.006],
      ["#eef1f4", C().reverse, 0.79, 0.97, 0.12, 0.5, 0.006],
    ].map((d) =>
      piece("trim", "body", decal(s, 9, 1, ray(d[2], d[3], d[4], d[5]), d[6], d[0], d[1])),
    );
  }

  /** Everything on the back: lamps, light bar, diffuser, plate, high brake lamp, tail pipe. */
  function rear(s, o) {
    const out = tailLamp(s, 1).concat(tailLamp(s, -1));
    const top = (s.deck === null ? s.belt + s.rise : s.deck) - 0.045;
    if (s.deck !== null)
      out.push(
        piece(
          "trim",
          "body",
          face(s, 1, 0.42, 0.42, top - 0.03, top - 0.012, 0.005, "#b0111a", C().tail),
        ),
      );
    out.push(
      piece(
        "trim",
        "body",
        face(s, 1, 0.66, 0.6, s.chin + 0.03, s.chin + 0.12, 0.004, "#1b1c20", C().matte),
      ),
    );
    out.push(piece("trim", "body", plateAt(s, top - 0.24, 1, o.scheme.rear)));
    if (o.fuel !== "electric") out.push(piece("trim", "body", tailPipe(s)));
    return out.filter(Boolean);
  }

  /** The tail pipe's tip (local), under the right of the rear bumper. */
  function exhaust(s) {
    return [-(s.w / 2 - 0.42), s.chin + 0.07, s.zr - 0.03];
  }

  /** A chrome tail pipe with a dark bore, poking out under the bumper. */
  function tailPipe(s) {
    const e = exhaust(s);
    return F.Geo.merge([
      P().tag(P().drum("z", 0.032, 0.22, [e[0], e[1], e[2] + 0.1], CHROME, 10), C().chrome),
      P().tag(P().drum("z", 0.022, 0.012, [e[0], e[1], e[2] - 0.006], "#0d0d0f", 8), C().matte),
    ]);
  }

  /** The belt line's height on the doors at z (the shoulder seam on the tub). */
  const beltAt = (s, z) => L().point(s.body, { z }, F.VehicleCarShape.A_SHOULDER)[1];

  /** A flush handle on door `door` (index) of side k: a dark recess and a bright bar, both owned by the door. */
  function handle(s, k, door) {
    const zEnd = door < 2 ? s.doors[1] : s.doors[2];
    const z = zEnd + 0.16;
    const y = beltAt(s, z) - 0.085;
    const own = "door" + door;
    const ray = (dz, dy) => (u, v) => sideRay(k, z + (u - 0.5) * dz, y + (v - 0.5) * dy);
    return [
      piece("trim", own, decal(s, 2, 1, ray(0.19, 0.045), 0.003, "#17181b", C().matte)),
      piece("trim", own, decal(s, 2, 1, ray(0.15, 0.022), 0.009, CHROME, C().chrome)),
    ];
  }

  /** The side mirror on front door `door` of side k: arm, body-colour cap, glass, indicator strip. */
  function mirror(s, k, door) {
    const z = s.doors[0] - 0.07;
    const y = beltAt(s, z) + 0.05;
    const t = L().hit(tester(s), [k * 1.6, y - 0.08, z], [-k, 0, 0], 2) || 0.8;
    const x = k * (1.6 - t);
    const at = [x + k * 0.14, y + 0.06, z - 0.02];
    const own = "door" + door;
    const trim = (g, cls) => piece("trim", own, P().tag(g, cls));
    const glass = [at[0] + k * 0.005, at[1], at[2] - 0.045];
    const ind = [at[0] + k * 0.07, at[1] - 0.03, at[2] + 0.03];
    return [
      trim(
        P().rod([x - k * 0.02, y - 0.04, z], [at[0] - k * 0.06, at[1] - 0.02, at[2]], 0.022, BLACK),
        C().gloss,
      ),
      piece("paint", own, P().lens(0.2, 0.11, 0.11, at, "#ffffff", [0, -k * 0.12, 0], 12)),
      trim(P().lens(0.17, 0.085, 0.03, glass, "#8fa2b4"), C().gloss),
      trim(
        P().lens(0.09, 0.018, 0.05, ind, "#f39a1e", [0, -k * 0.5, 0]),
        k > 0 ? C().indL : C().indR,
      ),
    ];
  }

  /** The handles on all four doors and the two mirrors. */
  function doorDress(s) {
    const out = [];
    [0, 1, 2, 3].forEach((d) => out.push(...handle(s, s.doorSides[d] === "L" ? 1 : -1, d)));
    [0, 1].forEach((d) => out.push(...mirror(s, s.doorSides[d] === "L" ? 1 : -1, d)));
    return out;
  }

  /** The roof's height and half width at z (on the greenhouse). */
  function roofAt(s, z, a) {
    return L().point(s.gh, { z }, a);
  }

  /** Two wipers resting at the windscreen base, a fin aerial at the back of the roof. */
  function smallBits(s) {
    const y = beltAt(s, s.A) + 0.03;
    const out = [-0.05, 0.55].map((x) =>
      P().tag(
        P().rod([x - 0.02, y, s.A - 0.06], [x - 0.5, y + 0.02, s.A - 0.1], 0.009, BLACK),
        C().satin,
      ),
    );
    const fin = roofAt(s, s.C + 0.12, Math.PI / 2);
    out.push(
      P().tag(P().lens(0.05, 0.08, 0.17, [0, fin[1] + 0.025, s.C + 0.12], BLACK), C().gloss),
    );
    return out.map((g) => piece("trim", "body", g));
  }

  /** Roof rails along the roof's edges (SUV, MPV), on four feet. */
  function rails(s) {
    const out = [];
    [-1, 1].forEach(function (k) {
      const pts = [];
      for (let i = 0; i <= 6; i += 1) {
        const z = lerp(s.B - 0.05, s.C + 0.06, i / 6);
        const p = roofAt(s, z, 1.3);
        pts.push([k * p[0] * 0.98, p[1] + 0.04, z]);
      }
      out.push(P().tag(P().bent(pts, 0.016, "#b9bdc3", 12), C().chrome));
      [pts[0], pts[6]].forEach((p) =>
        out.push(
          P().tag(P().block(0.04, 0.05, 0.08, [p[0], p[1] - 0.025, p[2]], BLACK), C().matte),
        ),
      );
    });
    return out.map((g) => piece("trim", "body", g));
  }

  /** A spoiler: a lip on a sedan's boot, or a peak over a hatch / SUV tailgate with the high brake lamp under it. */
  function spoiler(s) {
    if (s.deck !== null) {
      const t = L().hit(tester(s), [0, s.deck + 0.5, s.zr + 0.08], [0, -1, 0], 2) || 0.5;
      return [
        piece(
          "paint",
          "body",
          P().block(s.w * 0.6, 0.02, 0.07, [0, s.deck + 0.5 - t + 0.006, s.zr + 0.08], "#ffffff"),
        ),
      ];
    }
    const r = roofAt(s, s.C, Math.PI / 2);
    return [
      piece(
        "paint",
        "body",
        P().lens(
          s.w * 0.62,
          0.05,
          0.26,
          [0, r[1] + 0.005, s.C - 0.04],
          "#ffffff",
          [0.25, 0, 0],
          14,
        ),
      ),
      piece(
        "trim",
        "body",
        P().tag(P().box(0.36, 0.022, 0.02, [0, r[1] - 0.03, s.C - 0.15], "#d8141d"), C().brake),
      ),
    ];
  }

  /** The high brake lamp at the top of a sedan's rear glass. */
  function highBrake(s) {
    const r = roofAt(s, s.C - 0.05, Math.PI / 2);
    return piece(
      "trim",
      "body",
      P().tag(P().box(0.34, 0.025, 0.03, [0, r[1] - 0.03, s.C - 0.07], "#d8141d"), C().brake),
    );
  }

  /** Strokes of "TAXI": [x, y, width, height, tilt] in a letter's own frame (metres). */
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

  /** The word "TAXI" in dark strokes on a face of the sign (dir 1 front, -1 back). */
  function word(at, dir) {
    const out = [];
    LETTERS.forEach(function (strokes, i) {
      const cx = at[0] + dir * (i - 1.5) * 0.1;
      strokes.forEach(function (st) {
        const g = P().paint(new THREE.BoxGeometry(st[2], st[3], 0.008), "#1b1c20");
        out.push(F.Geo.place(g, [cx + dir * st[0], at[1] + st[1], at[2]], [0, 0, dir * st[4]]));
      });
    });
    return out;
  }

  /** The taxi's roof sign: a lit cream box reading "TAXI" both ways. */
  function taxiSign(s) {
    const z = (s.B + s.C) / 2;
    const y = roofAt(s, z, Math.PI / 2)[1] + 0.09;
    const parts = [P().tag(P().block(0.5, 0.15, 0.2, [0, y, z], "#fff1b0"), C().sign)];
    parts.push(...word([0, y, z + 0.102], 1), ...word([0, y, z - 0.102], -1));
    parts.push(P().block(0.42, 0.03, 0.16, [0, y - 0.085, z], BLACK));
    return [piece("trim", "body", F.Geo.merge(parts))];
  }

  /** Everything on the sides and the roof. */
  function sides(s) {
    const out = doorDress(s).concat(smallBits(s));
    if (s.rails) out.push(...rails(s));
    if (s.spoiler || s.roofSpoiler) out.push(...spoiler(s));
    if (!s.roofSpoiler) out.push(highBrake(s));
    if (s.sign) out.push(...taxiSign(s));
    return out.filter(Boolean);
  }

  F.VehicleCarDress = { front, rear, sides, exhaust, beltAt, roofAt };
})((window.KQ = window.KQ || {}));
