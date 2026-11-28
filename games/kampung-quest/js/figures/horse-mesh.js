/* ============================================================================
 * FILE: horse-mesh.js
 * PURPOSE: The toy horse and pony (KQ.Figures.HorseMesh): smooth, vertex-coloured bodies in the
 *          game's soft toy style, built as an AnimalRig spec (bones + parts) so each draws as one
 *          skinned mesh. A deep barrel with a gentle dip for the saddle, long slim legs with
 *          knees, hocks, fetlocks and dark hooves, an arched neck, a clean head (horse-head.js)
 *          with a flowing mane and tail, a leather saddle on a saddle cloth with a girth and
 *          stirrups, a bridle and reins up to the rider's hands. Five coats with white socks /
 *          a blaze on some. The pony is chunkier (shorter legs, rounder barrel, bigger head,
 *          a fluffier mane), then drawn at PONY_SCALE by the game.
 * BUSINESS CONTEXT: AC-P6 (horses look like horses, a few coat colours); owner feedback "the
 *   horse can be a little bit more polished".
 * DIMENSIONS: horse withers about 1.3 m (the toy hero is about 0.9 m tall); seat from spec().seat.
 * DEPENDENCIES: animal-loft.js, animal-rig.js (quadBones), horse-head.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const L = () => F.AnimalLoft;

  /** Coats: body, mane / tail, muzzle, lower legs (points), saddle cloth; socks (leg indices), blaze. */
  const COATS = {
    bay: {
      coat: 0x6a3a22,
      mane: 0x201614,
      muzzle: 0x44291c,
      point: 0x2e2420,
      cloth: 0x2e6fb8,
      socks: [],
      blaze: false,
    },
    chestnut: {
      coat: 0xbe6a30,
      mane: 0x8a3c1c,
      muzzle: 0x9a5430,
      point: 0xbe6a30,
      cloth: 0x2a8a62,
      socks: [0, 3],
      blaze: true,
    },
    grey: {
      coat: 0xdcd8d0,
      mane: 0x9e9890,
      muzzle: 0x8a847c,
      point: 0xb8b2aa,
      cloth: 0xc23a4a,
      socks: [],
      blaze: false,
    },
    black: {
      coat: 0x3a3532,
      mane: 0x161414,
      muzzle: 0x2a2624,
      point: 0x3a3532,
      cloth: 0xe0a628,
      socks: [1, 2],
      blaze: true,
    },
    palomino: {
      coat: 0xe0ac5e,
      mane: 0xf6eedc,
      muzzle: 0xc0904e,
      point: 0xe0ac5e,
      cloth: 0x7a4ab0,
      socks: [2, 3],
      blaze: true,
    },
  };
  const WHITE = 0xf4efe6;
  const HOOF = 0x3a2e26;
  const LEATHER = 0x7a4626;
  const STRAP = 0x3e2818;
  /** Kinds: leg height L (hip), girth G, head scale H, mane strands and fluff. */
  const SHAPES = {
    horse: { L: 0.84, G: 1, H: 1, mane: 11, fluff: 1.15, tail: 0.6 },
    pony: { L: 0.66, G: 1.12, H: 1.16, mane: 13, fluff: 1.6, tail: 0.5 },
  };

  /** Bone pivots for a shape: body centre, neck base, poll, tail root, hips and knees / hocks. */
  function pivots(sh) {
    const cy = sh.L + 0.17;
    const x = 0.14 * sh.G;
    return {
      body: [0, cy, 0],
      neck: [0, cy + 0.1, 0.5],
      head: [0, cy + 0.62, 0.86],
      tail: [0, cy + 0.12, -0.74],
      hips: [
        [x, sh.L, 0.46],
        [-x, sh.L, 0.46],
        [x, sh.L + 0.04, -0.5],
        [-x, sh.L + 0.04, -0.5],
      ],
      knees: [
        [x, 0.5 * sh.L, 0.47],
        [-x, 0.5 * sh.L, 0.47],
        [x, 0.52 * sh.L, -0.6],
        [-x, 0.52 * sh.L, -0.6],
      ],
    };
  }

  /** A body ring at z, dy above the body centre, radii scaled by the girth. */
  function ring(sh, z, dy, rx, up, dn) {
    return {
      p: [0, sh.L + 0.17 + dy, z],
      rx: rx * sh.G,
      up: (up || rx) * sh.G,
      dn: (dn || up || rx) * sh.G,
    };
  }

  /** The barrel from the tail to the chest: rump, a slight dip for the saddle, withers, chest. */
  function bodyRings(sh) {
    return [
      ring(sh, -0.8, 0.06, 0.05),
      ring(sh, -0.72, 0.05, 0.2, 0.2, 0.22),
      ring(sh, -0.5, 0.04, 0.28, 0.27, 0.28),
      ring(sh, -0.2, 0.0, 0.27, 0.23, 0.29),
      ring(sh, 0.1, 0.0, 0.28, 0.24, 0.3),
      ring(sh, 0.38, 0.03, 0.26, 0.27, 0.28),
      ring(sh, 0.58, 0.02, 0.19, 0.22, 0.22),
      ring(sh, 0.68, 0.0, 0.1, 0.12, 0.12),
      ring(sh, 0.72, 0.0, 0.03),
    ];
  }

  /** The arched neck from the shoulder to the poll (crest = the ring's "up" side). */
  function neckRings(sh) {
    return [
      ring(sh, 0.42, 0.06, 0.16, 0.2, 0.2),
      ring(sh, 0.62, 0.28, 0.13, 0.16, 0.14),
      ring(sh, 0.72, 0.47, 0.1, 0.12, 0.1),
      ring(sh, 0.8, 0.6, 0.09, 0.1, 0.09),
      ring(sh, 0.87, 0.66, 0.085),
      ring(sh, 0.9, 0.68, 0.04),
    ];
  }

  /** A front (i < 2) or hind leg's rings down from inside the body to the pastern (y as a share of L). */
  function legRings(sh, i) {
    const x = pivots(sh).hips[i][0];
    const g = sh.G;
    const front = [
      [sh.L + 0.12, 0.46, 0.1, 0.12],
      [0.8 * sh.L, 0.47, 0.085, 0.1],
      [0.6 * sh.L, 0.47, 0.058, 0.064],
      [0.5 * sh.L, 0.475, 0.054, 0.06],
      [0.4 * sh.L, 0.475, 0.042, 0.045],
      [0.22 * sh.L, 0.48, 0.038, 0.04],
      [0.15 * sh.L, 0.485, 0.047, 0.05],
      [0.1, 0.49, 0.042, 0.042],
    ];
    const hind = [
      [sh.L + 0.16, -0.48, 0.13, 0.17],
      [0.86 * sh.L, -0.52, 0.11, 0.13],
      [0.68 * sh.L, -0.57, 0.07, 0.085],
      [0.52 * sh.L, -0.6, 0.055, 0.07],
      [0.4 * sh.L, -0.58, 0.042, 0.045],
      [0.22 * sh.L, -0.56, 0.038, 0.04],
      [0.15 * sh.L, -0.55, 0.047, 0.05],
      [0.1, -0.54, 0.042, 0.042],
    ];
    return (i < 2 ? front : hind).map((r) => ({
      p: [x, r[0], r[1]],
      rx: r[2] * g,
      up: r[3] * g,
      dn: r[3] * g,
    }));
  }

  /** A hoof: a short flared cylinder with a flat sole on the ground. */
  function hoof(x, z, g, seg) {
    const rings = [
      { p: [x, 0.11, z], rx: 0.045 * g },
      { p: [x, 0.02, z + 0.01], rx: 0.064 * g },
      { p: [x, 0.0, z + 0.01], rx: 0.062 * g },
      { p: [x, 0.0, z + 0.01], rx: 0.005 },
    ];
    return L().tube(rings, { seg, sub: 1, col: () => HOOF });
  }

  /** One leg's parts: the leg (coat, white or dark below the knee), a knee / hock bump, the hoof. */
  function leg(sh, c, i) {
    const k = L();
    const low = c.socks.indexOf(i) >= 0 ? WHITE : c.point;
    const knee = pivots(sh).knees[i];
    const col = (u) => k.mix(c.coat, low, (u - 0.42) * 6);
    const rings = legRings(sh, i);
    const last = rings[rings.length - 1].p;
    const bump =
      i < 2 ? [knee[0], knee[1], knee[2] + 0.018] : [knee[0], knee[1] + 0.02, knee[2] - 0.05];
    return [
      k.tube(rings, { seg: 9, sub: 1, col }),
      k.ball([0.05 * sh.G, 0.06, 0.05], bump, c.coat, [8, 5]),
      hoof(last[0], last[2], sh.G, 9),
    ];
  }

  /** The saddle cloth (with a white trim), the leather saddle, girth, flaps and stirrups. */
  function saddle(sh, c, fr) {
    const k = L();
    const u0 = k.uAtZ(fr, -0.3);
    const u1 = k.uAtZ(fr, 0.32);
    const patch = (a0, a1, off, hex, rows, cols) =>
      k.shell(fr, { u0, u1, a0, a1, off, rows, cols }, () => hex);
    const top = k.point(fr, k.uAtZ(fr, 0.02), 0, 0);
    const out = [
      patch(-1.3, 1.3, 0.014, c.cloth, 8, 12),
      patch(1.18, 1.34, 0.018, WHITE, 8, 2),
      patch(-1.34, -1.18, 0.018, WHITE, 8, 2),
      k.band(fr, k.uAtZ(fr, 0.22), 0.035, 0.02, STRAP, 14),
      k.ball([0.19 * sh.G, 0.06, 0.23], [0, top.y + 0.02, 0.02], LEATHER, [12, 6]),
      k.ball([0.08, 0.06, 0.06], [0, top.y + 0.06, 0.21], LEATHER, [8, 5]),
      k.ball([0.13 * sh.G, 0.06, 0.05], [0, top.y + 0.07, -0.17], LEATHER, [8, 5]),
    ];
    [1, -1].forEach((s) => out.push(...stirrup(fr, s)));
    return out;
  }

  /** One side's flap, stirrup leather and stirrup iron. */
  function stirrup(fr, s) {
    const k = L();
    const u = k.uAtZ(fr, 0.08);
    const flap = k.shell(
      fr,
      {
        u0: u - 0.07,
        u1: u + 0.07,
        a0: s > 0 ? 0.75 : -1.25,
        a1: s > 0 ? 1.25 : -0.75,
        off: 0.024,
        rows: 3,
        cols: 4,
      },
      () => LEATHER,
    );
    const from = k.point(fr, u, s * 1.05, 0.03);
    const to = k.point(fr, u, s * 1.75, 0.06).setY(fr[0].p.y - 0.36);
    return [
      flap,
      k.rope([from, to], 0.009, STRAP, 3),
      k.ball([0.04, 0.012, 0.035], to.toArray(), 0xb0b0b0, [8, 4]),
    ];
  }

  /** The tail: a short dock and a few flowing strands (on the tail bone). */
  function tail(sh, c, pv) {
    const k = L();
    const t = pv.tail;
    const end = [0, t[1] - 0.1, t[2] - 0.1];
    const out = [
      k.tube(
        [
          { p: t, rx: 0.06 },
          { p: [0, t[1] - 0.05, t[2] - 0.06], rx: 0.055 },
          { p: end, rx: 0.05 },
        ],
        { seg: 8, sub: 1, col: () => c.mane },
      ),
    ];
    const n = sh.fluff > 1 ? 6 : 5;
    for (let i = 0; i < n; i += 1) {
      const s = (i / (n - 1)) * 2 - 1;
      const w = 0.03 * sh.fluff;
      const pts = [
        { p: end, rx: w, up: w * 1.3 },
        { p: [s * 0.04, end[1] - sh.tail * 0.4, end[2] - 0.08], rx: w * 0.9, up: w * 1.2 },
        { p: [s * 0.07, end[1] - sh.tail * 0.8, end[2] - 0.06], rx: w * 0.6, up: w * 0.8 },
        { p: [s * 0.08, end[1] - sh.tail, end[2] - 0.02 + 0.02 * s], rx: 0.004 },
      ];
      out.push(k.tube(pts, { seg: 6, sub: 1, col: () => c.mane }));
    }
    return out;
  }

  /** The AnimalRig spec for a horse ("horse") or pony ("pony") of a coat (unknown coat = bay). */
  function spec(coatName, kind) {
    const c = COATS[coatName] || COATS.bay;
    const sh = SHAPES[kind] || SHAPES.horse;
    const pv = pivots(sh);
    const k = L();
    const body = k.tube(bodyRings(sh), { seg: 14, sub: 2, col: () => c.coat });
    const fr = body.userData.frames;
    const neckGeo = k.tube(neckRings(sh), { seg: 12, sub: 2, col: () => c.coat });
    const head = F.HorseHead.parts(sh, c, pv, neckGeo.userData.frames);
    const on = (bone, list) => list.map((geo) => ({ geo, bone }));
    const parts = [].concat(
      on("body", [body]),
      on("body", saddle(sh, c, fr)),
      on("body", head.handReins(seatOf(fr))),
      on("neck", [neckGeo].concat(head.neck)),
      on("head", head.head),
      on("tail", tail(sh, c, pv)),
    );
    F.AnimalRig.LEGS.forEach(function (n, i) {
      const split = { y: pv.knees[i][1], bone: "knee" + n };
      leg(sh, c, i).forEach((geo) => parts.push({ geo, bone: "hip" + n, split }));
    });
    return { bones: F.AnimalRig.quadBones(pv), parts, seat: seatOf(fr), legLen: legLen(pv, sh) };
  }

  /** The rider's hips: on the saddle's seat (the saddle top is 0.08 m over the back). */
  function seatOf(fr) {
    const top = L().point(fr, L().uAtZ(fr, 0.02), 0, 0);
    return { y: top.y + 0.08 + 0.05, z: 0.0 };
  }

  /** Per leg: hip, knee and the hoof's sole outline (for AnimalRig.groundDrop). */
  function legLen(pv, sh) {
    const R = F.AnimalRig;
    return pv.hips.map(function (h, i) {
      const z = legRings(sh, i).pop().p[2] + 0.01;
      const r = 0.064 * sh.G;
      return R.legData(h, pv.knees[i], [
        [0, z - r],
        [0, z],
        [0, z + r],
        [0.02, z - r],
        [0.02, z + r],
      ]);
    });
  }

  F.HorseMesh = { spec, pivots, COATS, SHAPES, COAT_NAMES: Object.keys(COATS), STRAP };
})((window.KQ = window.KQ || {}));
