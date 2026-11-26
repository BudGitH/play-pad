// Kampung Quest — body-part geometry for the toy figures (minifig-style build): bevelled trapezoid torso
// with a neck stud, hip block + hip bar, square legs with a knee pivot and separate rectangular feet,
// sloped skirt halves for dresses / jubah, peg arms with an elbow, white-or-skin C-clip hands, and an
// oversized rounded head with a printed face. Every part is painted with vertex colours and merged.
(function (KQ) {
  "use strict";
  var F = (KQ.Figures = KQ.Figures || {});
  var G = F.Geo;

  /**
   * Part dimensions in figure units (before d.scale). Kids get short legs, like toy "kid legs".
   * @param {object} spec cast spec
   */
  F.dims = function (spec) {
    var kid = !!spec.kid;
    var d = {
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

  function box(w, h, d, r, k, hex, skin) {
    return G.paint(G.roundedBox(w, h, d, r, k), hex, skin);
  }

  /** Hip block, hip bar and (optionally) a satchel on the hip. Origin = hip pivot. */
  F.partHips = function (spec, d) {
    var top = spec.skirt ? spec.skirt.top || spec.skirt.upper : spec.legs;
    var list = [G.place(box(d.torsoWB, d.hipBlockH, d.torsoD, 0.012, 2, top), [0, d.hipBlockH / 2, 0])];
    var bar = new THREE.CylinderGeometry(0.03, 0.03, d.torsoWB - 0.03, 16, 1);
    list.push(G.place(G.paint(bar, spec.legs), [0, 0.002, -0.004], [0, 0, Math.PI / 2]));
    // crotch notch: a little wedge under the hip block between the legs, like the toy's moulded hip piece
    var notch = G.roundedBox(0.03, 0.03, d.legD - 0.01, 0.008, 1);
    G.taper(notch, 0.35, 1, 1, 1, 0.03);
    list.push(G.place(G.paint(notch, spec.skirt ? top : spec.legs), [0, -0.012, 0]));
    if (spec.belt) list.push(G.place(box(d.torsoWB + 0.004, 0.016, d.torsoD + 0.004, 0.006, 1, spec.belt), [0, 0.012, 0]));
    if (spec.bag) {
      list.push(G.place(box(0.05, 0.1, 0.12, 0.014, 1, spec.bag), [d.torsoWB / 2 + 0.03, -0.02, 0.01]));
      list.push(G.place(box(0.054, 0.035, 0.124, 0.01, 1, spec.bagFlap || spec.bag), [d.torsoWB / 2 + 0.031, 0.02, 0.01]));
    }
    return G.merge(list);
  };

  /**
   * A sloped skirt half (one per leg), like a toy dress piece. The inner edge stays straight on the
   * figure's centre line and only the outer side flares, so the two halves never overlap.
   * @param {number} side +1 left leg (+x), -1 right leg
   */
  var SKIRT_INNER = 0.0625; // = dims.legX: the inner edge sits exactly on the centre line
  function skirtHalf(side, h, wt, wb, dt, db, hex, y0) {
    var g = G.roundedBox(wb, h, db, 0.014, 1);
    G.taper(g, 1, wt / wb, 1, dt / db, h);
    var pos = g.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var t = (pos.getY(i) + h / 2) / h;
      var hw = (wb + (wt - wb) * t) / 2;
      pos.setX(i, pos.getX(i) + side * (hw - SKIRT_INNER));
    }
    return G.place(G.paint(g, hex), [0, y0 - h / 2, 0.004]);
  }

  /** Thigh (hip pivot -> knee). Skirted figures get the upper skirt half instead of a bare leg. */
  F.partThigh = function (spec, d, side) {
    var sk = spec.skirt;
    if (sk && sk.upper) return G.merge([skirtHalf(side, d.thigh + 0.012, 0.125, 0.142, 0.13, 0.148, sk.upper, 0.01)]);
    var g = G.place(box(d.legW, d.thigh + 0.004, d.legD, 0.014, 1, spec.legs), [0, -d.thigh / 2 + 0.002, 0]);
    return G.merge([g]);
  };

  /** Shin + shoe + band + separate rectangular foot (knee pivot -> sole). */
  F.partShin = function (spec, d, side) {
    var sk = spec.skirt;
    var footY = -d.shin + d.footH / 2;
    var list = [G.place(box(d.legW, d.footH, d.legD + 0.03, 0.02, 2, spec.shoes), [0, footY, 0.015])]; // bevelled toe
    if (sk && sk.lower) {
      var len = d.shin - d.footH + 0.006;
      list.push(skirtHalf(side, len, 0.142, 0.172, 0.148, 0.176, sk.lower, 0.0));
      return G.merge(list);
    }
    var shoeH = spec.band ? 0.032 : 0.0;
    var legH = d.shin - d.footH - shoeH - (spec.band ? 0.02 : 0);
    list.push(G.place(box(d.legW, legH + 0.002, d.legD, 0.012, 1, spec.legs), [0, -legH / 2, 0]));
    if (!spec.band) return G.merge(list);
    list.push(G.place(box(d.legW, 0.02, d.legD, 0.004, 1, spec.band), [0, -legH - 0.01, 0]));
    list.push(G.place(box(d.legW, shoeH + 0.004, d.legD, 0.006, 1, spec.shoes), [0, -legH - 0.02 - shoeH / 2, 0]));
    return G.merge(list);
  };

  /** A flat print decal quad on the torso front or back, shaped to the trapezoid's flat face. */
  function torsoDecal(d, r, back) {
    var g = new THREE.PlaneGeometry(1, 1, 1, 1);
    var pos = g.attributes.position;
    var h = d.torsoH - 2 * r;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) * h;
      var t = (y + d.torsoH / 2) / d.torsoH;
      var s = 1 + (d.torsoWT / d.torsoWB - 1) * t;
      pos.setXYZ(i, pos.getX(i) * 2 * (d.torsoWB / 2 - r) * s, y, 0);
    }
    G.paint(g, "#ffffff", false, back ? "back" : "front");
    return G.place(g, [0, d.torsoH / 2, back ? -d.torsoD / 2 - 0.0009 : d.torsoD / 2 + 0.0009], [0, back ? Math.PI : 0, 0]);
  }

  /** Trapezoid torso (wider at the waist, like the toy) + neck stud + printed decals. Origin = waist. */
  F.partTorso = function (spec, d) {
    var r = 0.016;
    var g = G.roundedBox(d.torsoWB, d.torsoH, d.torsoD, r, 2);
    G.taper(g, 1, d.torsoWT / d.torsoWB, 1, 0.96, d.torsoH);
    var list = [G.place(G.paint(g, spec.torso), [0, d.torsoH / 2, 0])];
    list.push(torsoDecal(d, r, false), torsoDecal(d, r, true));
    var neck = new THREE.CylinderGeometry(0.044, 0.046, d.neckH + 0.01, 20, 1);
    list.push(G.place(G.paint(neck, spec.skin, true), [0, d.torsoH + d.neckH / 2 - 0.004, 0]));
    return G.merge(list);
  };

  /** Rounded cylinder head with the printed face wrapped on the front half. Origin = top of neck stud. */
  F.partHead = function (spec, d) {
    var R = d.headR;
    var H = d.headH;
    var prof = [0, 0, 0.078, 0, 0.094, 0.004, 0.102, 0.012, R, 0.026, R, H - 0.026, 0.102, H - 0.012];
    prof.push(0.094, H - 0.004, 0.078, H, 0, H);
    var head = G.paint(G.lathe(prof, 32), spec.skin, true);
    var face = new THREE.CylinderGeometry(R + 0.0011, R + 0.0011, 0.14, 16, 1, true, -Math.PI / 2, Math.PI);
    G.place(G.paint(face, "#ffffff", true, "face"), [0, 0.098, 0]);
    return G.merge([head, face]);
  };

  /** Upper arm: rounded shoulder + tapered sleeve. Origin = shoulder pivot, hangs down -y. */
  F.partUpperArm = function (spec, d) {
    var sleeve = spec.sleeves === "bare" ? spec.skin : spec.arms;
    var skin = spec.sleeves === "bare";
    var h = d.upperArm + 0.046;
    var g = G.roundedBox(0.074, h, 0.078, 0.033, 2); // the big top radius is the rounded shoulder
    G.taper(g, 0.9, 1, 0.9, 1, h);
    return G.merge([G.place(G.paint(g, sleeve, skin), [0, 0.036 - h / 2, 0])]);
  };

  /** Forearm (+ sleeve cuff for long sleeves). Origin = elbow pivot. */
  F.partForearm = function (spec, d) {
    var long = spec.sleeves === "long";
    var hex = long ? spec.arms : spec.skin;
    var g = G.roundedBox(0.064, d.forearm + 0.012, 0.07, 0.02, 1);
    G.taper(g, 0.9, 1, 0.9, 1, d.forearm);
    var list = [G.place(G.paint(g, hex, !long), [0, -d.forearm / 2, 0])];
    var joint = G.paint(new THREE.SphereGeometry(0.03, 10, 6), hex, !long);
    list.push(G.place(joint, [0, 0, 0]));
    if (long && spec.cuff) list.push(G.place(box(0.068, 0.018, 0.074, 0.007, 1, spec.cuff), [0, -d.forearm + 0.006, 0]));
    return G.merge(list);
  };

  /** Cross-section of a toy hand: a thick annulus with a slot facing down (the C of a C-clip). */
  function clipShape() {
    var R = 0.034;
    var r = 0.0165;
    var gap = 0.5;
    var down = -Math.PI / 2;
    var s = new THREE.Shape();
    s.absarc(0, 0, R, down + gap, down - gap + Math.PI * 2, false);
    s.absarc(0, 0, r, down - gap * 1.25 + Math.PI * 2, down + gap * 1.25, true);
    return s;
  }

  /** C-shaped clip hand on a wrist peg. Origin = wrist pivot; the hole runs front-to-back (z). */
  F.partHand = function (spec) {
    var hex = spec.hands || spec.skin;
    var skin = !spec.hands;
    var peg = G.place(G.paint(new THREE.CylinderGeometry(0.02, 0.023, 0.03, 12, 1), hex, skin), [0, -0.01, 0]);
    var opts = { depth: 0.032, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.006, bevelSegments: 1, curveSegments: 10 };
    var clip = G.smoothNormals(new THREE.ExtrudeGeometry(clipShape(), opts));
    G.place(clip, [0, -0.052, -0.016]);
    return G.merge([peg, G.paint(clip, hex, skin)]);
  };
})((window.KQ = window.KQ || {}));
