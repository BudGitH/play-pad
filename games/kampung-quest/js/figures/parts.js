// Kampung Quest — body-part geometry for the toy figures (minifig-style build): bevelled trapezoid torso
// with a neck stud, hip block + hip bar, square legs with a knee pivot and separate rectangular feet,
// sloped skirt halves for dresses / jubah, peg arms with an elbow, white-or-skin C-clip hands, and an
// oversized rounded head with a printed face. Every part is painted with vertex colours and merged.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const G = F.Geo;

  /**
   * Part dimensions in figure units (before d.scale). Kids get short legs, like toy "kid legs".
   * @param {object} spec cast spec
   */
  F.dims = function (spec) {
    const kid = !!spec.kid;
    const d = {
      scale: spec.scale || (kid ? 1.0 : 1.1),
      thigh: kid ? 0.08 : 0.13,
      shin: kid ? 0.125 : 0.175,
      footH: 0.048,
      legW: 0.113,
      legD: 0.12,
      legX: 0.0625,
      hipBlockH: 0.055,
      torsoH: 0.27,
      torsoWB: 0.25,
      torsoWT: 0.2,
      torsoD: 0.12,
      neckH: 0.022,
      headR: 0.105,
      headH: 0.19,
      headScale: 1.38,
      shoulderX: 0.131,
      shoulderY: 0.212,
      upperArm: 0.112,
      forearm: 0.1,
    };
    d.hipH = d.thigh + d.shin;
    return d;
  };

  /**
   * A painted rounded box: width, height, depth, corner radius and bevel steps, a colour and an
   * optional skin flag.
   */
  function box(w, h, d, r, k, hex, skin) {
    return G.paint(G.roundedBox(w, h, d, r, k), hex, skin);
  }

  /** Hip block, hip bar and (optionally) a satchel on the hip. Origin = hip pivot. */
  F.partHips = function (spec, d) {
    const top = spec.skirt ? spec.skirt.top || spec.skirt.upper : spec.legs;
    const list = [
      G.place(box(d.torsoWB, d.hipBlockH, d.torsoD, 0.012, 2, top), [0, d.hipBlockH / 2, 0]),
    ];
    const bar = new THREE.CylinderGeometry(0.03, 0.03, d.torsoWB - 0.03, 16, 1);
    list.push(G.place(G.paint(bar, spec.legs), [0, 0.002, -0.004], [0, 0, Math.PI / 2]));
    // crotch notch: a little wedge under the hip block between the legs, like the toy's moulded hip piece
    const notch = G.roundedBox(0.03, 0.03, d.legD - 0.01, 0.008, 1);
    G.taper(notch, 0.35, 1, 1, 1, 0.03);
    list.push(G.place(G.paint(notch, spec.skirt ? top : spec.legs), [0, -0.012, 0]));
    if (spec.belt)
      list.push(
        G.place(
          box(d.torsoWB + 0.004, 0.016, d.torsoD + 0.004, 0.006, 1, spec.belt),
          [0, 0.012, 0],
        ),
      );
    if (spec.bag) {
      list.push(
        G.place(box(0.05, 0.1, 0.12, 0.014, 1, spec.bag), [d.torsoWB / 2 + 0.03, -0.02, 0.01]),
      );
      list.push(
        G.place(box(0.054, 0.035, 0.124, 0.01, 1, spec.bagFlap || spec.bag), [
          d.torsoWB / 2 + 0.031,
          0.02,
          0.01,
        ]),
      );
    }
    return G.merge(list);
  };

  /**
   * A sloped skirt half (one per leg), like a toy dress piece. The inner edge stays straight on the
   * figure's centre line and only the outer side flares, so the two halves never overlap.
   * @param {number} side +1 left leg (+x), -1 right leg
   */
  const SKIRT_INNER = 0.0625; // = dims.legX: the inner edge sits exactly on the centre line
  /**
   * One half of a split skirt, tapered from top to bottom and shifted toward its side so the legs
   * can swing.
   */
  function skirtHalf(side, h, wt, wb, dt, db, hex, y0) {
    const g = G.roundedBox(wb, h, db, 0.014, 1);
    G.taper(g, 1, wt / wb, 1, dt / db, h);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + h / 2) / h;
      const hw = (wb + (wt - wb) * t) / 2;
      pos.setX(i, pos.getX(i) + side * (hw - SKIRT_INNER));
    }
    return G.place(G.paint(g, hex), [0, y0 - h / 2, 0.004]);
  }

  /** Thigh (hip pivot -> knee). Skirted figures get the upper skirt half instead of a bare leg. */
  F.partThigh = function (spec, d, side) {
    const sk = spec.skirt;
    if (sk && sk.upper)
      return G.merge([skirtHalf(side, d.thigh + 0.012, 0.125, 0.142, 0.13, 0.148, sk.upper, 0.01)]);
    const g = G.place(box(d.legW, d.thigh + 0.004, d.legD, 0.014, 1, spec.legs), [
      0,
      -d.thigh / 2 + 0.002,
      0,
    ]);
    return G.merge([g]);
  };

  /** Shin + shoe + band + separate rectangular foot (knee pivot -> sole). */
  F.partShin = function (spec, d, side) {
    const sk = spec.skirt;
    const footY = -d.shin + d.footH / 2;
    const list = [
      G.place(box(d.legW, d.footH, d.legD + 0.03, 0.019, 1, spec.shoes), [0, footY, 0.015]),
    ]; // bevelled toe
    if (sk && sk.lower) {
      const len = d.shin - d.footH + 0.006;
      list.push(skirtHalf(side, len, 0.142, 0.172, 0.148, 0.176, sk.lower, 0.0));
      return G.merge(list);
    }
    const shoeH = spec.band ? 0.032 : 0.0;
    const legH = d.shin - d.footH - shoeH - (spec.band ? 0.02 : 0);
    list.push(G.place(box(d.legW, legH + 0.002, d.legD, 0.012, 1, spec.legs), [0, -legH / 2, 0]));
    if (!spec.band) return G.merge(list);
    list.push(G.place(box(d.legW, 0.02, d.legD, 0.004, 1, spec.band), [0, -legH - 0.01, 0]));
    list.push(
      G.place(box(d.legW, shoeH + 0.004, d.legD, 0.006, 1, spec.shoes), [
        0,
        -legH - 0.02 - shoeH / 2,
        0,
      ]),
    );
    return G.merge(list);
  };

  /** A flat print decal quad on the torso front or back, shaped to the trapezoid's flat face. */
  function torsoDecal(d, r, back) {
    const g = new THREE.PlaneGeometry(1, 1, 1, 1);
    const pos = g.attributes.position;
    const h = d.torsoH - 2 * r;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) * h;
      const t = (y + d.torsoH / 2) / d.torsoH;
      const s = 1 + (d.torsoWT / d.torsoWB - 1) * t;
      pos.setXYZ(i, pos.getX(i) * 2 * (d.torsoWB / 2 - r) * s, y, 0);
    }
    G.paint(g, "#ffffff", false, back ? "back" : "front");
    return G.place(
      g,
      [0, d.torsoH / 2, back ? -d.torsoD / 2 - 0.0009 : d.torsoD / 2 + 0.0009],
      [0, back ? Math.PI : 0, 0],
    );
  }

  /** Trapezoid torso (wider at the waist, like the toy) + neck stud + printed decals. Origin = waist. */
  F.partTorso = function (spec, d) {
    const r = 0.016;
    const g = G.roundedBox(d.torsoWB, d.torsoH, d.torsoD, r, 2);
    G.taper(g, 1, d.torsoWT / d.torsoWB, 1, 0.96, d.torsoH);
    const list = [G.place(G.paint(g, spec.torso), [0, d.torsoH / 2, 0])];
    list.push(torsoDecal(d, r, false), torsoDecal(d, r, true));
    const neck = new THREE.CylinderGeometry(0.044, 0.046, d.neckH + 0.01, 20, 1);
    list.push(G.place(G.paint(neck, spec.skin, true), [0, d.torsoH + d.neckH / 2 - 0.004, 0]));
    return G.merge(list);
  };

  /** Rounded cylinder head with the printed face wrapped on the front half. Origin = top of neck stud. */
  F.partHead = function (spec, d) {
    const R = d.headR;
    const H = d.headH;
    const prof = [
      0,
      0,
      0.078,
      0,
      0.094,
      0.004,
      0.102,
      0.012,
      R,
      0.026,
      R,
      H - 0.026,
      0.102,
      H - 0.012,
    ];
    prof.push(0.094, H - 0.004, 0.078, H, 0, H);
    const head = G.paint(G.lathe(prof, 32), spec.skin, true);
    const face = new THREE.CylinderGeometry(
      R + 0.0011,
      R + 0.0011,
      0.14,
      16,
      1,
      true,
      -Math.PI / 2,
      Math.PI,
    );
    G.place(G.paint(face, "#ffffff", true, "face"), [0, 0.098, 0]);
    return G.merge([head, face]);
  };

  /** Upper arm: rounded shoulder + tapered sleeve. Origin = shoulder pivot, hangs down -y. */
  F.partUpperArm = function (spec, d) {
    const sleeve = spec.sleeves === "bare" ? spec.skin : spec.arms;
    const skin = spec.sleeves === "bare";
    const h = d.upperArm + 0.046;
    const g = G.roundedBox(0.074, h, 0.078, 0.033, 2); // the big top radius is the rounded shoulder
    G.taper(g, 0.9, 1, 0.9, 1, h);
    return G.merge([G.place(G.paint(g, sleeve, skin), [0, 0.036 - h / 2, 0])]);
  };

  /** Forearm (+ sleeve cuff for long sleeves). Origin = elbow pivot. */
  F.partForearm = function (spec, d) {
    const long = spec.sleeves === "long";
    const hex = long ? spec.arms : spec.skin;
    const g = G.roundedBox(0.064, d.forearm + 0.012, 0.07, 0.02, 1);
    G.taper(g, 0.9, 1, 0.9, 1, d.forearm);
    const list = [G.place(G.paint(g, hex, !long), [0, -d.forearm / 2, 0])];
    const joint = G.paint(new THREE.SphereGeometry(0.03, 10, 6), hex, !long);
    list.push(G.place(joint, [0, 0, 0]));
    if (long && spec.cuff)
      list.push(G.place(box(0.068, 0.018, 0.074, 0.007, 1, spec.cuff), [0, -d.forearm + 0.006, 0]));
    return G.merge(list);
  };

  /** Cross-section of a toy hand: a thick annulus with a slot facing down (the C of a C-clip). */
  function clipShape() {
    const R = 0.034;
    const r = 0.0165;
    const gap = 0.5;
    const down = -Math.PI / 2;
    const s = new THREE.Shape();
    s.absarc(0, 0, R, down + gap, down - gap + Math.PI * 2, false);
    s.absarc(0, 0, r, down - gap * 1.25 + Math.PI * 2, down + gap * 1.25, true);
    return s;
  }

  /** C-shaped clip hand on a wrist peg. Origin = wrist pivot; the hole runs front-to-back (z). */
  F.partHand = function (spec) {
    const hex = spec.hands || spec.skin;
    const skin = !spec.hands;
    const peg = G.place(
      G.paint(new THREE.CylinderGeometry(0.02, 0.023, 0.03, 12, 1), hex, skin),
      [0, -0.01, 0],
    );
    const opts = {
      depth: 0.032,
      bevelEnabled: true,
      bevelThickness: 0.007,
      bevelSize: 0.006,
      bevelSegments: 1,
      curveSegments: 10,
    };
    const clip = G.smoothNormals(new THREE.ExtrudeGeometry(clipShape(), opts));
    G.place(clip, [0, -0.052, -0.016]);
    return G.merge([peg, G.paint(clip, hex, skin)]);
  };
})((window.KQ = window.KQ || {}));
