/* ============================================================================
 * FILE: horse-mesh.js
 * PURPOSE: The toy horse (KQ.Figures.HorseMesh): a low-poly, vertex-coloured horse in the game's
 *          soft toy style, built as an AnimalRig spec (bones + parts) so it draws as one skinned
 *          mesh. Clearly a horse, not a camel: a deep barrel with no hump, long slim legs with dark
 *          hooves, an arched neck with a dark mane and forelock, a long tail, pointed ears, a
 *          brown saddle on a coloured blanket with stirrups, and a bridle with reins. Five coats
 *          (bay, chestnut, grey, black, palomino); the pony is the same horse drawn smaller.
 * BUSINESS CONTEXT: AC-P6 (horses look like horses, a few coat colours; a stable in Makkah's
 *   outskirts and a pony ride by the kampung park).
 * DIMENSIONS: withers about 1.25 m (the toy hero is about 0.9 m tall); the saddle seat is SEAT.
 * DEPENDENCIES: animal-rig.js (geometry kit, quadBones).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const K = () => F.AnimalRig.geo;

  /** Coats: body, mane / tail, muzzle, lower legs (socks), saddle blanket. */
  const COATS = {
    bay: { coat: 0x8a5634, mane: 0x241a14, muzzle: 0x5a3a26, sock: 0x2a201a, blanket: 0x2e6fb8 },
    chestnut: {
      coat: 0xb4642e,
      mane: 0x7a3418,
      muzzle: 0x8a4a26,
      sock: 0xf2ede4,
      blanket: 0x2a8a62,
    },
    grey: { coat: 0xd8d4cc, mane: 0x9a958c, muzzle: 0x7a756e, sock: 0xd8d4cc, blanket: 0xc23a4a },
    black: { coat: 0x34302e, mane: 0x141212, muzzle: 0x24201e, sock: 0xf2ede4, blanket: 0xe0a628 },
    palomino: {
      coat: 0xd9a75a,
      mane: 0xf5ecd6,
      muzzle: 0xb88a48,
      sock: 0xd9a75a,
      blanket: 0x7a4ab0,
    },
  };
  const HOOF = 0x2a2420;
  const LEATHER = 0x6a3e22;
  const STRAP = 0x3a2416;
  const EYE = 0x161210;
  /** Where the rider's hips sit (model space): on the saddle seat. */
  const SEAT = { y: 1.35, z: 0.03 };

  /** The bone pivots (model space): front legs at the shoulder, hind legs at the hip. */
  const PIVOT = {
    body: [0, 1.0, 0],
    neck: [0, 1.12, 0.6],
    head: [0, 1.55, 0.88],
    tail: [0, 1.12, -0.72],
    hips: [
      [0.15, 0.82, 0.48],
      [-0.15, 0.82, 0.48],
      [0.15, 0.84, -0.5],
      [-0.15, 0.84, -0.5],
    ],
    knees: [
      [0.15, 0.42, 0.49],
      [-0.15, 0.42, 0.49],
      [0.15, 0.45, -0.56],
      [-0.15, 0.45, -0.56],
    ],
  };

  /** Barrel, chest, rump and withers: a horse's deep body with a level back. */
  function body(c) {
    const k = K();
    return [
      k.ell([0.27, 0.28, 0.6], [0, 1.0, 0], c.coat),
      k.ell([0.26, 0.3, 0.29], [0, 1.02, 0.42], c.coat),
      k.ell([0.28, 0.29, 0.31], [0, 1.05, -0.42], c.coat),
      k.ell([0.17, 0.13, 0.22], [0, 1.18, 0.38], c.coat),
    ];
  }

  /** Saddle blanket, seat with pommel and cantle, girth straps and stirrups. */
  function saddle(c) {
    const k = K();
    const out = [
      k.box([0.6, 0.03, 0.5], [0, 1.27, 0.04], c.blanket),
      k.box([0.62, 0.032, 0.06], [0, 1.272, -0.2], 0xf2ede4),
      k.ell([0.21, 0.06, 0.25], [0, 1.3, 0.03], LEATHER),
      k.ell([0.09, 0.07, 0.06], [0, 1.35, 0.25], LEATHER),
      k.ell([0.15, 0.07, 0.06], [0, 1.35, -0.18], LEATHER),
    ];
    [1, -1].forEach(function (s) {
      out.push(k.box([0.03, 0.4, 0.07], [0.265 * s, 1.03, 0.14], STRAP));
      out.push(k.limb([0.23 * s, 1.27, 0.08], [0.3 * s, 0.86, 0.1], 0.012, 0.012, STRAP, 4));
      out.push(k.box([0.09, 0.03, 0.07], [0.3 * s, 0.84, 0.1], 0x9a9a9a));
    });
    return out;
  }

  /** The arched neck with a dark mane along its crest (on the neck bone). */
  function neck(c) {
    const k = K();
    const out = [
      k.limb([0, 1.08, 0.56], [0, 1.54, 0.86], 0.18, 0.1, c.coat),
      k.ell([0.14, 0.24, 0.16], [0, 1.3, 0.7], c.coat, -0.6),
    ];
    for (let i = 0; i < 7; i += 1) {
      const t = i / 6;
      const p = [0, 1.18 + 0.4 * t + 0.08, 0.5 + 0.32 * t - 0.09];
      out.push(k.ell([0.045, 0.1, 0.07], p, c.mane, -0.5));
    }
    return out;
  }

  /** Head: skull, long face, lighter muzzle, nostrils, eyes, pointed ears, forelock and bridle. */
  function head(c) {
    const k = K();
    const out = [
      k.ell([0.11, 0.12, 0.16], [0, 1.6, 0.94], c.coat),
      k.limb([0, 1.58, 0.98], [0, 1.37, 1.16], 0.1, 0.075, c.coat),
      k.ell([0.085, 0.08, 0.1], [0, 1.35, 1.17], c.muzzle),
      k.ell([0.06, 0.08, 0.05], [0, 1.69, 0.99], c.mane),
      k.limb([-0.1, 1.68, 0.96], [0.1, 1.68, 0.96], 0.014, 0.014, STRAP, 4),
      k.box([0.19, 0.03, 0.035], [0, 1.43, 1.1], STRAP),
    ];
    [1, -1].forEach(function (s) {
      out.push(k.ell([0.022, 0.022, 0.02], [0.04 * s, 1.33, 1.26], EYE));
      out.push(k.ell([0.03, 0.035, 0.03], [0.1 * s, 1.62, 1.0], EYE));
      out.push(k.ell([0.01, 0.01, 0.01], [0.122 * s, 1.635, 1.015], 0xffffff));
      out.push(k.cone(0.035, 0.13, [0.065 * s, 1.7, 0.9], c.coat, -0.25));
      out.push(k.limb([0.1 * s, 1.64, 0.95], [0.085 * s, 1.37, 1.12], 0.013, 0.013, STRAP, 4));
    });
    return out;
  }

  /** The reins from the bit up over the neck to the saddle's front (on the neck bone). */
  function reins() {
    const k = K();
    const out = [];
    [1, -1].forEach(function (s) {
      out.push(k.limb([0.09 * s, 1.37, 1.11], [0.12 * s, 1.47, 0.76], 0.012, 0.012, STRAP, 4));
      out.push(k.limb([0.12 * s, 1.47, 0.76], [0.1 * s, 1.38, 0.32], 0.012, 0.012, STRAP, 4));
    });
    return out;
  }

  /** Tail: a short dock and a long full switch (on the tail bone). */
  function tail(c) {
    const k = K();
    return [
      k.limb([0, 1.13, -0.72], [0, 1.0, -0.84], 0.06, 0.05, c.mane),
      k.ell([0.08, 0.3, 0.09], [0, 0.8, -0.9], c.mane, 0.25),
      k.ell([0.06, 0.18, 0.07], [0, 0.6, -0.94], c.mane, 0.15),
    ];
  }

  /** One front leg: forearm (hip bone), then cannon, fetlock and hoof (knee bone, by height). */
  function frontLeg(c, x, sock) {
    const k = K();
    return [
      k.ell([0.1, 0.2, 0.11], [x, 0.68, 0.49], c.coat),
      k.limb([x, 0.62, 0.49], [x, 0.43, 0.49], 0.075, 0.058, c.coat),
      k.ell([0.06, 0.06, 0.06], [x, 0.42, 0.49], c.coat),
      k.limb([x, 0.41, 0.49], [x, 0.11, 0.5], 0.048, 0.045, sock),
      k.ell([0.055, 0.045, 0.055], [x, 0.12, 0.51], sock),
      k.limb([x, 0.1, 0.51], [x, 0, 0.52], 0.06, 0.07, HOOF),
    ];
  }

  /** One hind leg: thigh and gaskin (hip bone), hock, cannon and hoof (knee bone). */
  function hindLeg(c, x, sock) {
    const k = K();
    return [
      k.ell([0.12, 0.24, 0.16], [x, 0.76, -0.46], c.coat),
      k.limb([x, 0.66, -0.5], [x, 0.46, -0.56], 0.085, 0.06, c.coat),
      k.ell([0.06, 0.065, 0.07], [x, 0.45, -0.57], c.coat),
      k.limb([x, 0.44, -0.57], [x, 0.11, -0.52], 0.048, 0.045, sock),
      k.ell([0.055, 0.045, 0.055], [x, 0.12, -0.51], sock),
      k.limb([x, 0.1, -0.51], [x, 0, -0.5], 0.06, 0.07, HOOF),
    ];
  }

  /** The four legs as rig parts, split at the knee / hock height between the two bones. */
  function legs(c) {
    const out = [];
    const sock = (i) => (i % 2 === 0 ? c.sock : c.coat);
    ["FL", "FR", "HL", "HR"].forEach(function (k, i) {
      const x = PIVOT.hips[i][0];
      const geo = i < 2 ? frontLeg(c, x, sock(i)) : hindLeg(c, x, sock(i + 1));
      const split = { y: PIVOT.knees[i][1], bone: "knee" + k };
      geo.forEach((g) => out.push({ geo: g, bone: "hip" + k, split }));
    });
    return out;
  }

  /** The AnimalRig spec for a horse of a coat (an unknown coat falls back to bay). */
  function spec(coatName) {
    const c = COATS[coatName] || COATS.bay;
    const on = (bone, list) => list.map((geo) => ({ geo, bone }));
    const parts = [].concat(
      on("body", body(c)),
      on("body", saddle(c)),
      on("neck", neck(c)),
      on("neck", reins()),
      on("head", head(c)),
      on("tail", tail(c)),
      legs(c),
    );
    return { bones: F.AnimalRig.quadBones(PIVOT), parts };
  }

  F.HorseMesh = { spec, COATS, PIVOT, SEAT, COAT_NAMES: Object.keys(COATS) };
})((window.KQ = window.KQ || {}));
