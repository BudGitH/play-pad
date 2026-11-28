/* ============================================================================
 * FILE: camel-mesh.js
 * PURPOSE: The friendly toy dromedary (KQ.Figures.CamelToy), shared by the rideable camels (one
 *          skinned mesh each, js/game/mount-rigs.js) and the instanced herd (js/world/holy-camel-*):
 *          one smooth body with ONE clear hump, slim legs with knobbly knees and wide padded feet,
 *          a short tufted tail, and a colourful Bedouin blanket with tassels laid ON the back (it is
 *          built from the body's own surface, so it can never float). The neck and the gentle face
 *          are in camel-face.js. Two detail levels: "hi" (ridden, < 6k triangles) and "lo" (herd,
 *          < 2k triangles per animal).
 * BUSINESS CONTEXT: owner feedback "Improve the camel models, please. It just looks not nice for the
 *   kids." (children 6-10): soft rounded volumes, warm sand coat, lighter belly and muzzle.
 * DIMENSIONS: hump top about 1.96 m, withers 1.67 m, the rider's hips at SEAT (on a cushion just
 *   in front of the hump). Model space: origin on the ground under the body, +z forward.
 * DEPENDENCIES: animal-loft.js, animal-rig.js (quadBones), camel-face.js (neck, head).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const L = () => F.AnimalLoft;

  /** The palette (coat colours are multiplied by a coat tint; trims are not). */
  const C = {
    coat: 0xf0c78e,
    belly: 0xfbe9c8,
    dark: 0xcf9f66,
    pad: 0x9a7656,
    toe: 0x7a5a40,
    tuft: 0x8a5e3a,
  };
  const BLANKET = {
    main: 0xc8372d,
    stripe: 0xf6efe0,
    gold: 0xf2b630,
    ink: 0x2b2230,
    green: 0x2f8a5a,
  };
  const TASSELS = [0xf2b630, 0x2f7fd0, 0x2f8a5a, 0xe86a2a];
  const DETAIL = {
    hi: {
      seg: 14,
      sub: 2,
      neckSeg: 12,
      neckSub: 2,
      headSeg: 12,
      legSeg: 8,
      legSub: 1,
      ball: [10, 6],
      knee: [8, 5],
      small: [7, 4],
      extras: true,
      tassels: 4,
    },
    lo: {
      seg: 8,
      sub: 2,
      neckSeg: 8,
      neckSub: 1,
      headSeg: 8,
      legSeg: 6,
      legSub: 1,
      ball: [7, 4],
      knee: null,
      small: [5, 3],
      extras: false,
      tassels: 2,
    },
  };
  const SEAT_Z = 0.27;

  /** Bone pivots: body centre, neck base, poll (head), tail root, hips and knees (FL, FR, HL, HR). */
  const PIVOT = {
    body: [0, 1.3, 0],
    neck: [0, 1.5, 0.74],
    head: [0, 2.24, 1.3],
    tail: [0, 1.52, -0.98],
    hips: [
      [0.2, 1.2, 0.52],
      [-0.2, 1.2, 0.52],
      [0.2, 1.22, -0.6],
      [-0.2, 1.22, -0.6],
    ],
    knees: [
      [0.2, 0.6, 0.56],
      [-0.2, 0.6, 0.56],
      [0.2, 0.62, -0.68],
      [-0.2, 0.62, -0.68],
    ],
  };
  /** Foot pad (half height, half length): the rig keeps the lowest pad on the ground. */
  const PAD = [0.05, 0.13];

  /** The body's control rings, rump to chest: the hump rises behind the withers. */
  const BODY = [
    { p: [0, 1.4, -1.0], rx: 0.05 },
    { p: [0, 1.42, -0.92], rx: 0.26, up: 0.2, dn: 0.26 },
    { p: [0, 1.4, -0.72], rx: 0.38, up: 0.27, dn: 0.36 },
    { p: [0, 1.37, -0.42], rx: 0.41, up: 0.36, dn: 0.4, pinch: 0.25 },
    { p: [0, 1.36, -0.12], rx: 0.42, up: 0.66, dn: 0.41, pinch: 0.5 },
    { p: [0, 1.36, 0.16], rx: 0.41, up: 0.52, dn: 0.41, pinch: 0.42 },
    { p: [0, 1.37, 0.45], rx: 0.37, up: 0.3, dn: 0.4, pinch: 0.1 },
    { p: [0, 1.33, 0.72], rx: 0.3, up: 0.24, dn: 0.33 },
    { p: [0, 1.27, 0.88], rx: 0.17, up: 0.14, dn: 0.2 },
    { p: [0, 1.24, 0.94], rx: 0.05 },
  ];

  /** Coat colour with a lighter belly underneath (a = angle round the body, 0 = top). */
  function coatAt(tint) {
    const t = (h) => L().tint(h, tint);
    return (u, a) => L().mix(t(C.coat), t(C.belly), (-Math.cos(a) - 0.25) * 2.2);
  }

  /** The body loft's frames (cached per detail). */
  const bodyFrames = (d) => L().frames(BODY, d.sub);

  /** The body: one smooth surface with the hump. */
  function body(d, tint) {
    return L().tube(BODY, { seg: d.seg, sub: d.sub, col: coatAt(tint) });
  }

  /** One leg's control rings down from the hip (front or hind) at side x. */
  function legRings(front, x) {
    const z = front
      ? [0.5, 0.53, 0.55, 0.56, 0.56, 0.56, 0.57, 0.58]
      : [-0.56, -0.6, -0.66, -0.68, -0.66, -0.64, -0.63, -0.62];
    const top = front
      ? { y: 1.32, rx: 0.15, up: 0.17, dn: 0.16 }
      : { y: 1.38, rx: 0.19, up: 0.24, dn: 0.22 };
    const thigh = front ? { y: 1.0, rx: 0.11, up: 0.12 } : { y: 1.05, rx: 0.14, up: 0.16 };
    const ys = [top.y, thigh.y, 0.76, 0.61, 0.46, 0.2, 0.11, 0.075];
    const rs = [
      top,
      thigh,
      { rx: 0.072 },
      { rx: 0.082 },
      { rx: 0.055 },
      { rx: 0.048 },
      { rx: 0.058 },
      { rx: 0.03 },
    ];
    return ys.map((y, i) => Object.assign({}, rs[i], { p: [x, y, z[i]] }));
  }

  /** One leg: smooth thigh and shin, a knobbly darker knee, a wide soft foot pad with two toes. */
  function leg(d, i, tint) {
    const front = i < 2;
    const x = PIVOT.hips[i][0];
    const kz = PIVOT.knees[i][2];
    const fz = front ? 0.6 : -0.6;
    const out = [
      L().tube(legRings(front, x), {
        seg: d.legSeg,
        sub: d.legSub,
        col: () => L().tint(C.coat, tint),
      }),
      L().ball([0.1, PAD[0], PAD[1]], [x, PAD[0], fz], C.pad, d.extras ? d.ball : d.small),
    ];
    if (d.knee)
      out.push(
        L().ball([0.085, 0.08, 0.075], [x, 0.61, kz + 0.025], L().tint(C.dark, tint), d.knee),
      );
    if (d.extras)
      [1, -1].forEach((s) =>
        out.push(L().ball([0.042, 0.035, 0.045], [x + s * 0.045, 0.035, fz + 0.1], C.toe, d.small)),
      );
    return out;
  }

  /** The short tail with a dark tuft. */
  function tail(d, tint) {
    const rings = [
      { p: [0, 1.53, -0.97], rx: 0.05 },
      { p: [0, 1.4, -1.06], rx: 0.04 },
      { p: [0, 1.24, -1.09], rx: 0.034 },
      { p: [0, 1.16, -1.09], rx: 0.03 },
    ];
    return [
      L().tube(rings, {
        seg: d.extras ? 6 : 5,
        sub: d.extras ? 2 : 1,
        col: () => L().tint(C.coat, tint),
      }),
      L().ball([0.055, 0.1, 0.05], [0, 1.1, -1.09], C.tuft, d.extras ? d.ball : d.small),
    ];
  }

  /** The Bedouin blanket: a red cloth, cream / gold stripes, a gold and ink border, laid on the skin. */
  function blanket(d, fr) {
    const k = L();
    const u0 = k.uAtZ(fr, -0.36);
    const u1 = k.uAtZ(fr, 0.5);
    const A = 1.72;
    const rows = d.extras ? 10 : 6;
    const cols = d.extras ? 16 : 10;
    /** A one-colour patch; thin stripes need few rows (across), thin borders few columns. */
    const patch = (ua, ub, a0, a1, off, hex) => {
      const r = ub - ua < 0.05 ? 2 : rows;
      const c = a1 - a0 < 0.5 ? 2 : cols;
      return k.shell(fr, { u0: ua, u1: ub, a0, a1, off, rows: r, cols: c }, () => hex);
    };
    const out = [patch(u0, u1, -A, A, 0.022, BLANKET.main)];
    [0.1, 0.86].forEach(function (s) {
      if (!d.extras) return;
      const a = u0 + (u1 - u0) * s;
      out.push(patch(a, a + 0.018, -A, A, 0.026, BLANKET.stripe));
      out.push(patch(a + 0.022, a + 0.03, -A, A, 0.026, BLANKET.green));
    });
    [1, -1].forEach(function (s) {
      out.push(patch(u0, u1, s > 0 ? A - 0.24 : -A, s > 0 ? A : -A + 0.24, 0.027, BLANKET.gold));
      out.push(
        patch(u0, u1, s > 0 ? A - 0.3 : -A + 0.26, s > 0 ? A - 0.26 : -A + 0.3, 0.027, BLANKET.ink),
      );
    });
    return out.concat(tassels(d, fr, u0, u1, A));
  }

  /** Tassels hanging from the blanket's lower edge on both sides. */
  function tassels(d, fr, u0, u1, A) {
    const k = L();
    const out = [];
    const n = d.tassels;
    [1, -1].forEach(function (s) {
      for (let i = 0; i < n; i += 1) {
        const u = u0 + ((u1 - u0) * (i + 0.5)) / n;
        const top = k.point(fr, u, s * A, 0.026);
        const end = top.clone().add(new THREE.Vector3(0.012 * s, -0.09, 0));
        const hex = TASSELS[i % TASSELS.length];
        if (d.extras) out.push(k.rope([top, end], 0.007, hex, 2));
        out.push(k.ball([0.026, 0.04, 0.026], [end.x, end.y - 0.02, end.z], hex, d.small));
      }
    });
    return out;
  }

  /** The seat: a round orange cushion on the blanket and a wooden horn in front of it. */
  function cushion(d, fr) {
    const k = L();
    const top = k.point(fr, k.uAtZ(fr, SEAT_Z), 0, 0.022);
    const horn = k.point(fr, k.uAtZ(fr, SEAT_Z + 0.2), 0, 0.022);
    return [
      k.ball([0.2, 0.075, 0.17], [0, top.y + 0.045, SEAT_Z], 0xe8862a, d.ball, [0.25, 0, 0]),
      k.ball([0.15, 0.03, 0.12], [0, top.y + 0.1, SEAT_Z - 0.01], 0xf2b630, d.small, [0.25, 0, 0]),
      k.rope([horn.toArray(), [0, horn.y + 0.12, horn.z + 0.01]], 0.022, 0x8a5a34, 2),
      k.ball([0.04, 0.035, 0.04], [0, horn.y + 0.135, horn.z + 0.01], 0xa8703e, d.small),
    ];
  }

  /** Where the rider's hips go (model space): on the cushion. */
  function seat() {
    const fr = bodyFrames(DETAIL.hi);
    const top = L().point(fr, L().uAtZ(fr, SEAT_Z), 0, 0.022);
    return { y: top.y + 0.13 + 0.05, z: SEAT_Z - 0.02 };
  }

  /**
   * All parts by bone for a detail level ("hi" | "lo") and coat tint (hex, applied to fur only):
   * { body, saddle, neck, head, tail, legs: [4 lists] } (model space).
   */
  function parts(level, tint) {
    const d = DETAIL[level] || DETAIL.hi;
    const fr = bodyFrames(d);
    const face = F.CamelFace.parts(d, tint);
    return {
      body: [body(d, tint)],
      saddle: blanket(d, fr).concat(cushion(d, fr)),
      neck: face.neck,
      head: face.head,
      tail: tail(d, tint),
      legs: [0, 1, 2, 3].map((i) => leg(d, i, tint)),
    };
  }

  /** The AnimalRig spec for a ridden camel of a coat tint: bones, parts, seat and leg lengths. */
  function spec(tint) {
    const p = parts("hi", tint);
    const on = (bone, list) => list.map((geo) => ({ geo, bone }));
    const list = [].concat(
      on("body", p.body),
      on("body", p.saddle),
      on("neck", p.neck),
      on("head", p.head),
      on("tail", p.tail),
    );
    F.AnimalRig.LEGS.forEach(function (k, i) {
      const split = { y: PIVOT.knees[i][1], bone: "knee" + k };
      p.legs[i].forEach((geo) => list.push({ geo, bone: "hip" + k, split }));
    });
    return { bones: F.AnimalRig.quadBones(PIVOT), parts: list, seat: seat(), legLen: legLen() };
  }

  /** Per leg: hip, knee and the pad + toes outline (for AnimalRig.groundDrop). */
  function legLen() {
    const R = F.AnimalRig;
    return PIVOT.hips.map(function (h, i) {
      const fz = i < 2 ? 0.6 : -0.6;
      const toes = [-0.035, 0, 0.035].map((dz) => [
        0.035 - 0.035 * Math.cos(dz * 30),
        fz + 0.1 + dz + 0.01,
      ]);
      return R.legData(
        h,
        PIVOT.knees[i],
        R.footOutline(PAD[0], fz, PAD[0], PAD[1], toes.concat([[0.035, fz + 0.145]])),
      );
    });
  }

  F.CamelToy = { parts, spec, seat, legLen, PIVOT, PAD, C, DETAIL };
})((window.KQ = window.KQ || {}));
