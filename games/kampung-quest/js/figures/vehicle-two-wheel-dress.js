/* ============================================================================
 * FILE: vehicle-two-wheel-dress.js
 * PURPOSE: Kampung Quest — the scooter (F.VehicleTwoWheel.moto): a step-through underbone ("kapcai"), the small
 *          motorcycle of every Singapore and Malaysian street. Generic, no maker's shape or badge.
 *          - body (painted): a curved front cover / leg shield under the bar, the sculpted spine cover over the
 *            underbone, side panels under the seat sweeping up to the tail, a rear fender;
 *          - trim: a long seat with a pale stitching line, the engine (cylinder, crankcase), a swing arm and twin
 *            rear shocks, a chain case, an exhaust swept under the right side to a muffler with a chrome heat
 *            shield, foot pegs and a footboard plate, a grab rail, a helmet hook, the tail lamp, rear indicators
 *            and plate, and the centre stand (down while parked, folded up while riding: two trim variants);
 *          - front end (turns): telescopic fork legs, a front fender, the headlight cowl with a lamp, indicators
 *            and a clock, the bar with grips and levers, two mirrors on stalks;
 *          - wheels: five-spoke cast rims on slim tyres, a front brake disc.
 *            F.VehicleTwoWheel.moto(low) -> { kind, frame, trimFor(mask), fork, wheel, ... seats, exhaust }
 *          Local frame: faces +z, left +x, origin on the ground mid-wheelbase.
 * BUSINESS CONTEXT: owner's realism pass ("realistic step-through underbone (kapcai) style"),
 *   features/kampung-quest-playability/notes-vehicles.md.
 * DEPENDENCIES: KQ.Figures.VehicleParts, VehicleMats (classes), VehicleTwoWheel (trimVariant), Geo; THREE.
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicle-rig.spec.mjs tests/kampung-quest-vehicles-all.spec.mjs
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const P = () => F.VehicleParts;
  const G = () => F.Geo;
  const C = () => F.VehicleMats.CLS;
  const WHITE = "#ffffff";
  const BLACK = "#1b1c20";
  const GREY = "#5d6168";
  const STEEL = "#c4c8ce";
  const R = 0.27;
  const M = { rear: -0.62, front: 0.72, pivot: 0.72, hub: R };
  const cache = {};
  const T = (g, cls) => P().tag(g, cls === undefined ? 0 : cls);

  /** A smooth side-view solid (a THREE.Shape from [z, y] points with quadratic corners) of width w, squeezed. */
  function panel(points, w, bevel, k) {
    const s = new THREE.Shape();
    s.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 2) {
      const c = points[i];
      const e = points[(i + 1) % points.length];
      s.quadraticCurveTo(c[0], c[1], e[0], e[1]);
    }
    const g = P().sideShape(s, w, WHITE, bevel, 8, 3);
    return P().smoothed(k ? P().squeeze(g, k) : g, 50);
  }

  /** The painted body: front cover / leg shield, spine cover, side panels to the tail, rear fender. */
  /** Points from a flat list: pairs ([z, y]) or triples ([x, y, z]). */
  const pairs = (a) => a.filter((_, i) => i % 2 === 0).map((v, i) => [v, a[i * 2 + 1]]);
  const triples = (a) =>
    a.filter((_, i) => i % 3 === 0).map((v, i) => [v, a[i * 3 + 1], a[i * 3 + 2]]);
  /** Side views of the body panels and the seat (anchor, control, anchor ... as [z, y]). */
  const FRONT = pairs([
    0.56, 0.9, 0.67, 0.64, 0.57, 0.42, 0.5, 0.35, 0.38, 0.41, 0.38, 0.66, 0.43, 0.92, 0.5, 0.98,
  ]);
  const SPINE = pairs([
    0.44, 0.66, 0.28, 0.47, 0.08, 0.47, -0.06, 0.47, -0.1, 0.6, -0.12, 0.42, 0.05, 0.38, 0.3, 0.37,
    0.42, 0.42, 0.47, 0.5,
  ]);
  const SIDE = pairs([
    -0.02, 0.64, 0.03, 0.5, -0.15, 0.46, -0.5, 0.46, -0.75, 0.53, -0.97, 0.58, -0.98, 0.65, -0.92,
    0.67, -0.7, 0.66, -0.35, 0.64,
  ]);
  const SEAT = pairs([
    0.14, 0.62, 0.19, 0.685, 0.08, 0.69, -0.35, 0.7, -0.78, 0.715, -0.87, 0.71, -0.83, 0.64, -0.35,
    0.62,
  ]);

  /** The painted body: front cover / leg shield, spine cover, side panels to the tail. */
  function motoBody() {
    const frontK = (y, z) =>
      (1 - 0.35 * P().smooth(0.7, 0.98, y)) * (1 - 0.3 * P().smooth(0.5, 0.64, z));
    const front = panel(FRONT, 0.34, 0.05, frontK);
    const spine = panel(SPINE, 0.2, 0.04);
    const side = panel(SIDE, 0.3, 0.05, (y, z) => 1 - 0.35 * P().smooth(-0.6, -0.98, z));
    return G().merge([front, spine, side]);
  }

  /** The long seat with its stitching line (both sides), the grab rail and the helmet hook. */
  function seat() {
    const p = P();
    const stitch = (x) =>
      T(
        p.bent(triples([x, 0.66, 0.08, x, 0.672, -0.35, x, 0.685, -0.78]), 0.004, "#8b8f96", 12),
        C().matte,
      );
    const rail = triples([
      -0.15, 0.68, -0.5, -0.16, 0.7, -0.78, 0, 0.71, -0.9, 0.16, 0.7, -0.78, 0.15, 0.68, -0.5,
    ]);
    const hook = triples([0.12, 0.56, 0.16, 0.15, 0.53, 0.18, 0.15, 0.5, 0.16]);
    return [
      T(p.paint(panel(SEAT, 0.27, 0.05), "#202125"), C().satin),
      stitch(0.136),
      stitch(-0.136),
      T(p.bent(rail, 0.013, "#9aa0a8", 16), C().chrome),
      T(p.bent(hook, 0.008, STEEL, 6), C().chrome),
    ];
  }

  /** Engine (cylinder and crankcase), swing arm, twin shocks, chain case, foot pegs and the footboard plate. */
  function engine() {
    const p = P();
    const parts = [
      T(p.drum("z", 0.075, 0.22, [0, 0.34, 0.24], "#8d939b", 14), C().chrome),
      T(p.lens(0.26, 0.24, 0.32, [0, 0.3, 0.02], GREY, null, 12), C().satin),
      T(p.lens(0.08, 0.14, 0.14, [-0.13, 0.3, 0.02], "#9aa0a8", null, 10), C().chrome),
      T(p.lens(0.05, 0.11, 0.42, [0.13, 0.3, -0.33], BLACK, null, 10), C().gloss),
      T(p.block(0.2, 0.012, 0.2, [0, 0.475, 0.17], "#25272a"), C().rubber),
    ];
    [-1, 1].forEach(function (k) {
      parts.push(
        T(p.rod([k * 0.09, 0.3, -0.05], [k * 0.08, M.hub, M.rear], 0.018, "#3a3d44", 8), C().satin),
      );
      parts.push(
        T(
          p.rod(
            [k * 0.1, M.hub + 0.03, M.rear + 0.05],
            [k * 0.12, 0.62, -0.5],
            0.022,
            "#c9302c",
            8,
          ),
          C().gloss,
        ),
      );
      parts.push(
        T(p.rod([k * 0.04, 0.27, 0.12], [k * 0.2, 0.27, 0.12], 0.014, "#26272b", 6), C().rubber),
      );
    });
    return parts;
  }

  /** The exhaust: a pipe from the engine under the right side to a muffler with a chrome heat shield and a tip. */
  function exhaust() {
    const p = P();
    return [
      T(
        p.bent(
          [
            [-0.02, 0.26, 0.3],
            [-0.1, 0.18, 0.15],
            [-0.15, 0.2, -0.15],
            [-0.17, 0.27, -0.35],
          ],
          0.022,
          "#6b6f76",
          12,
        ),
        C().satin,
      ),
      T(p.drum("z", 0.055, 0.42, [-0.17, 0.3, -0.6], "#3b3e45", 14), C().satin),
      T(p.lens(0.04, 0.09, 0.3, [-0.22, 0.31, -0.55], STEEL, null, 10), C().chrome),
      T(p.drum("z", 0.03, 0.08, [-0.17, 0.31, -0.84], STEEL, 10), C().chrome),
    ];
  }

  /** Tail lamp, rear indicators, plate. */
  function tail() {
    const p = P();
    const parts = [T(p.lens(0.16, 0.06, 0.07, [0, 0.62, -0.97], "#c0121b", null, 12), C().brake)];
    [-1, 1].forEach((k) =>
      parts.push(
        T(
          p.lens(0.06, 0.04, 0.05, [k * 0.13, 0.58, -0.95], "#f39a1e"),
          k > 0 ? C().indL : C().indR,
        ),
      ),
    );
    parts.push(T(p.block(0.2, 0.11, 0.012, [0, 0.47, -0.99], "#f4f4f0"), C().matte));
    parts.push(
      T(
        p.bent(
          [
            [0, 0.56, -0.9],
            [0, 0.5, -0.98],
            [0, 0.4, -0.98],
          ],
          0.03,
          "#1b1c20",
          8,
        ),
        C().satin,
      ),
    );
    return parts;
  }

  /** The centre stand: down (two legs to the ground) or folded up under the engine. */
  function centreStand(down) {
    const p = P();
    const parts = [];
    [-1, 1].forEach(function (k) {
      const foot = down ? [k * 0.13, 0.015, -0.16] : [k * 0.13, 0.17, -0.34];
      parts.push(T(p.rod([k * 0.08, 0.24, -0.06], foot, 0.012, "#3a3d44", 6), C().satin));
    });
    return parts;
  }

  /** The fixed trim as owned pieces (the stand comes in a down and an up version). */
  function motoTrimPieces() {
    const fixed = seat().concat(engine(), exhaust(), tail());
    return [
      { g: G().merge(fixed), owner: "body" },
      { g: G().merge(centreStand(true)), owner: "stand" },
      { g: G().merge(centreStand(false)), owner: "standUp" },
    ];
  }

  /** One mirror on its stalk (k = side), local to the front hub. */
  function mirror(k) {
    const p = P();
    return [
      T(
        p.bent(
          [
            [k * 0.2, 1.02, -0.3],
            [k * 0.25, 1.09, -0.31],
            [k * 0.28, 1.15, -0.32],
          ],
          0.008,
          BLACK,
          6,
        ),
        C().satin,
      ),
      T(p.lens(0.12, 0.075, 0.03, [k * 0.29, 1.17, -0.32], "#202125", null, 12), C().gloss),
      T(p.lens(0.1, 0.06, 0.008, [k * 0.29, 1.17, -0.34], "#9fb0c2", null, 12), C().chrome),
    ];
  }

  /** The headlight cowl with lamp, indicators and a clock; bar, grips, levers; mirrors (local to the front hub). */
  function cowl() {
    const p = P();
    const bar = triples([-0.33, 1.0, -0.36, -0.15, 1.01, -0.3, 0.15, 1.01, -0.3, 0.33, 1.0, -0.36]);
    const parts = [
      T(p.lens(0.3, 0.2, 0.28, [0, 0.98, -0.24], "#1d1e22", [0.2, 0, 0], 16), C().gloss),
      T(p.lens(0.17, 0.1, 0.06, [0, 0.96, -0.11], "#eef3fb", [0.2, 0, 0], 16), C().head),
      T(p.lens(0.12, 0.05, 0.08, [0, 1.08, -0.3], "#15171a", null, 10), C().screen),
      T(p.bent(bar, 0.014, "#2a2c31", 14), C().satin),
    ];
    [-1, 1].forEach((k) => parts.push(...barEnd(k), ...mirror(k)));
    return parts;
  }

  /** One end of the bar (k = side): indicator, grip, lever. */
  function barEnd(k) {
    const p = P();
    const lever = triples([k * 0.18, 1.02, -0.3, k * 0.26, 1.015, -0.26, k * 0.32, 1.0, -0.28]);
    return [
      T(p.lens(0.07, 0.04, 0.05, [k * 0.15, 0.97, -0.14], "#f39a1e"), k > 0 ? C().indL : C().indR),
      T(p.rod([k * 0.27, 1.0, -0.35], [k * 0.35, 0.995, -0.38], 0.02, BLACK, 10), C().rubber),
      T(p.bent(lever, 0.006, "#9aa0a8", 6), C().chrome),
    ];
  }

  /** The front end, local to the front hub: telescopic fork, fender, cowl, the brake disc's caliper. */
  function motoFork() {
    const p = P();
    const parts = [
      T(p.halfRing(0, M.hub, 0, R + 0.03, 0.035, "#2a2c31"), C().gloss),
      T(p.block(0.05, 0.08, 0.06, [0.07, M.hub + 0.07, -0.05], "#3a3d44"), C().satin),
    ];
    [-1, 1].forEach(function (k) {
      parts.push(
        T(p.rod([k * 0.065, M.hub, 0], [k * 0.06, 0.62, -0.17], 0.024, STEEL), C().chrome),
      );
      parts.push(
        T(p.rod([k * 0.06, 0.6, -0.16], [k * 0.055, 0.93, -0.3], 0.028, "#2e3035"), C().satin),
      );
    });
    return G().merge(parts.concat(cowl()));
  }

  /** A cast five-spoke wheel on a slim tyre (+ a brake disc on the front one). */
  function castWheel(disc) {
    const p = P();
    const tyre = p.latheX(
      [
        R * 0.78,
        -0.03,
        R * 0.86,
        -0.04,
        R * 0.97,
        -0.03,
        R,
        0,
        R * 0.97,
        0.03,
        R * 0.86,
        0.04,
        R * 0.78,
        0.03,
      ],
      24,
      "#26272c",
      4,
    );
    const rim = [R * 0.8, -0.028, R * 0.74, -0.03, R * 0.72, 0, R * 0.74, 0.03, R * 0.8, 0.028];
    const parts = [
      tyre,
      p.latheX(rim, 22, "#c3c7cd", 1),
      T(p.drum("x", 0.06, 0.08, [0, 0, 0], "#8d939b", 10), C().satin),
      T(p.drum("x", disc ? 0.035 : 0.11, disc ? 0.1 : 0.05, [0, 0, 0], "#5d6168", 12), C().satin),
    ];
    for (let i = 0; i < 5; i += 1) {
      const g = p.paint(new THREE.BoxGeometry(0.03, R * 0.62, 0.02), "#c3c7cd");
      parts.push(T(g.translate(0, R * 0.42, 0).rotateX((i * 2 * Math.PI) / 5), C().satin));
    }
    if (disc) parts.push(T(p.drum("x", R * 0.5, 0.006, [0.045, 0, 0], "#aab0b8", 20), C().chrome));
    return G().merge(parts);
  }

  /** The scooter's shared geometries (cached per tier). */
  function moto(low) {
    const key = "moto" + (low ? "l" : "");
    if (cache[key]) return cache[key];
    const old = P().setDetail(low ? 0.55 : 1);
    const set = {
      kind: "moto",
      frame: motoBody(),
      trimPieces: motoTrimPieces(),
      merged: {},
      fork: motoFork(),
      wheel: castWheel(true),
      rearWheel: castWheel(false),
      pivotZ: M.pivot,
      frontZ: M.front,
      wheelY: M.hub,
      rearZ: M.rear,
      foot: { mid: -0.1, hl: 1.0, hw: 0.36 },
      seats: [
        { pos: [0, 0.405, 0.1], heading: 0, kind: "driver" },
        { pos: [0, 0.43, -0.35], heading: 0, kind: "rear" },
      ],
      exhaust: [-0.17, 0.31, -0.88],
    };
    set.trimFor = (mask) => F.VehicleTwoWheel.trimVariant(set, mask);
    P().setDetail(old);
    cache[key] = set;
    return set;
  }

  F.VehicleTwoWheel = Object.assign(F.VehicleTwoWheel || {}, { moto, MOTO_R: R });
})((window.KQ = window.KQ || {}));
