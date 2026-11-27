// Kampung Quest — low-poly part geometry for the instanced crowd. The same toy proportions as the cast
// (F.dims), but about a quarter of the triangles, and every part is painted WHITE so one instance colour
// tints it (skin, shirt, trousers, hat). Dark details (shoes, eyes, mouth) are painted dark and stay dark.
// Each builder returns a merged BufferGeometry whose origin is the joint pivot, like the cast parts.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const G = F.Geo;
  const TAU = Math.PI * 2;
  const WHITE = "#ffffff";
  const SHOE = "#2a2420";
  const EYE = "#3a2418";
  const MOUTH = "#5b1f1a";
  /** The adult proportions every crowd part is built to (kids scale the leg parts at pose time). */
  F.CROWD_DIMS = F.dims({ id: "crowd", kid: false });
  F.CROWD_KID_DIMS = F.dims({ id: "crowd_kid", kid: true });
  const D = F.CROWD_DIMS;

  /** A bevelled painted box with one segment of rounding. */
  function box(w, h, d, r, hex) {
    return G.paint(G.roundedBox(w, h, d, r, 1), hex || WHITE);
  }

  /** A painted ellipsoid of size s at p. */
  function blob(s, p, hex, segs) {
    const g = new THREE.SphereGeometry(1, segs || 8, 6);
    return G.place(G.paint(g, hex || WHITE), p, null, s);
  }

  /** Hip block with its bar: origin = hip pivot. */
  function hips() {
    return G.merge([
      G.place(box(D.torsoWB, D.hipBlockH, D.torsoD, 0.012), [0, D.hipBlockH / 2, 0]),
    ]);
  }

  /** Trouser thigh (hip -> knee). */
  function thigh() {
    return G.merge([
      G.place(box(D.legW, D.thigh + 0.004, D.legD, 0.014), [0, -D.thigh / 2 + 0.002, 0]),
    ]);
  }

  /** Trouser shin (knee -> sole) with a dark shoe. */
  function shin() {
    const legH = D.shin - D.footH;
    return G.merge([
      G.place(box(D.legW, legH + 0.002, D.legD, 0.012), [0, -legH / 2, 0]),
      G.place(box(D.legW, D.footH, D.legD + 0.03, 0.019, SHOE), [0, -D.shin + D.footH / 2, 0.015]),
    ]);
  }

  /** One flared skirt half; the inner edge stays on the centre line so the two halves never overlap. */
  function skirtHalf(side, h, wt, wb, dt, db, y0) {
    const g = G.roundedBox(wb, h, db, 0.014, 1);
    G.taper(g, 1, wt / wb, 1, dt / db, h);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const t = (pos.getY(i) + h / 2) / h;
      pos.setX(i, pos.getX(i) + side * ((wb + (wt - wb) * t) / 2 - D.legX));
    }
    return G.place(G.paint(g, WHITE), [0, y0 - h / 2, 0.004]);
  }

  /** The upper half of a split skirt (hip -> knee) for the left (+1) or right (-1) leg. */
  function skirtThigh(side) {
    return G.merge([skirtHalf(side, D.thigh + 0.012, 0.125, 0.142, 0.13, 0.148, 0.01)]);
  }

  /** The lower half of a split skirt (knee -> hem) plus the shoe. */
  function skirtShin(side) {
    const len = D.shin - D.footH + 0.006;
    return G.merge([
      skirtHalf(side, len, 0.142, 0.172, 0.148, 0.176, 0),
      G.place(box(D.legW, D.footH, D.legD + 0.03, 0.019, SHOE), [0, -D.shin + D.footH / 2, 0.015]),
    ]);
  }

  /** Trapezoid torso: origin = waist. */
  function torso() {
    const g = G.roundedBox(D.torsoWB, D.torsoH, D.torsoD, 0.016, 1);
    G.taper(g, 1, D.torsoWT / D.torsoWB, 1, 0.96, D.torsoH);
    return G.merge([G.place(G.paint(g, WHITE), [0, D.torsoH / 2, 0])]);
  }

  /** Head with a neck, two ears and a printed-on look (dark eyes and mouth). Origin = top of the neck. */
  function head() {
    const R = D.headR;
    const H = D.headH;
    const prof = [
      0,
      0,
      0.08,
      0,
      0.098,
      0.006,
      R,
      0.03,
      R,
      H - 0.03,
      0.098,
      H - 0.006,
      0.07,
      H,
      0,
      H,
    ];
    const list = [G.paint(G.lathe(prof, 14), WHITE)];
    list.push(
      G.place(G.paint(new THREE.CylinderGeometry(0.044, 0.046, D.neckH + 0.012, 8, 1), WHITE), [
        0,
        -D.neckH / 2 - 0.002,
        0,
      ]),
    );
    [-1, 1].forEach((s) => {
      list.push(blob([0.014, 0.024, 0.02], [s * (R + 0.004), 0.09, 0], WHITE, 6));
      list.push(blob([0.013, 0.019, 0.006], [s * 0.034, 0.106, R - 0.008], EYE, 6));
    });
    list.push(G.place(box(0.046, 0.009, 0.008, 0.003, MOUTH), [0, 0.056, R - 0.002]));
    return G.merge(list);
  }

  /** Short hair: a low cap over the crown, a fringe and the back of the head. */
  function hairPieces() {
    const dome = new THREE.SphereGeometry(0.113, 12, 6, 0, TAU, 0, Math.PI / 2);
    return [
      G.place(G.paint(dome, WHITE), [0, 0.128, 0], null, [1, 0.62, 1.02]),
      blob([0.085, 0.03, 0.045], [0, 0.178, 0.07], WHITE),
      blob([0.1, 0.075, 0.045], [0, 0.1, -0.068], WHITE),
    ];
  }

  /** A tudung: a hood round the head and shoulders, open at the face, with a covered brow. */
  function tudung() {
    const hood = [
      0.13, -0.06, 0.124, 0.0, 0.119, 0.06, 0.118, 0.14, 0.104, 0.2, 0.06, 0.228, 0, 0.236,
    ];
    const brow = [0.12, 0.15, 0.112, 0.2, 0.06, 0.229, 0, 0.237];
    return [
      G.paint(G.lathe(hood, 14, 0.95, TAU - 1.9), WHITE),
      G.paint(G.lathe(brow, 8, -0.95, 1.9), WHITE),
    ];
  }

  /** A small book (a Quran) held at the chest. */
  function book() {
    return G.merge([G.place(box(0.15, 0.03, 0.2, 0.006, WHITE), [0, 0, 0])]);
  }

  /** A baseball cap with a short peak. */
  function cap() {
    const dome = new THREE.SphereGeometry(0.119, 12, 5, 0, TAU, 0, Math.PI / 2);
    return [
      G.place(G.paint(dome, WHITE), [0, 0.14, 0], null, [1, 0.7, 1]),
      G.place(box(0.15, 0.012, 0.085, 0.004), [0, 0.15, 0.125]),
    ];
  }

  /** A songkok: a flat-topped felt cap. */
  function songkok() {
    const g = new THREE.CylinderGeometry(0.098, 0.104, 0.085, 14, 1);
    return [G.place(G.paint(g, WHITE), [0, 0.195, 0])];
  }

  /** A white kopiah: a close round cap. */
  function kopiah() {
    const dome = new THREE.SphereGeometry(0.11, 12, 5, 0, TAU, 0, Math.PI / 2);
    return [G.place(G.paint(dome, WHITE), [0, 0.15, 0], null, [1, 0.72, 1])];
  }

  const HATS = {
    hair: hairPieces,
    bun: () => hairPieces().concat([blob([0.05, 0.048, 0.05], [0, 0.205, -0.085], WHITE)]),
    tudung: tudung,
    tudung_kid: tudung,
    cap: cap,
    songkok: songkok,
    kopiah: kopiah,
  };
  F.CROWD_HATS = Object.keys(HATS);

  /** Upper arm: origin = shoulder pivot, hangs down. */
  function upper() {
    const h = D.upperArm + 0.046;
    const g = G.roundedBox(0.074, h, 0.078, 0.033, 1);
    G.taper(g, 0.9, 1, 0.9, 1, h);
    return G.merge([G.place(G.paint(g, WHITE), [0, 0.036 - h / 2, 0])]);
  }

  /** Forearm: origin = elbow. */
  function fore() {
    const g = G.roundedBox(0.064, D.forearm + 0.012, 0.07, 0.02, 1);
    G.taper(g, 0.9, 1, 0.9, 1, D.forearm);
    return G.merge([G.place(G.paint(g, WHITE), [0, -D.forearm / 2, 0])]);
  }

  /** A mitten hand: origin = wrist. */
  function hand() {
    return G.merge([G.place(box(0.06, 0.075, 0.042, 0.016), [0, -0.04, 0])]);
  }

  /** A carrier bag held at the grip: origin = the hand's grip point, the bag hangs below. */
  function bag() {
    return G.merge([
      G.place(box(0.13, 0.15, 0.06, 0.012), [0, -0.12, 0.02]),
      G.place(box(0.05, 0.05, 0.012, 0.004), [0, -0.02, 0.02]),
    ]);
  }

  /** A broom standing on its bristles: origin = the floor under the bristles, the stick leans up +y. */
  function broom() {
    const stick = new THREE.CylinderGeometry(0.009, 0.009, 0.78, 6, 1);
    return G.merge([
      G.place(G.paint(stick, "#c9a96a"), [0, 0.43, 0]),
      G.place(box(0.17, 0.06, 0.05, 0.01, "#e8c968"), [0, 0.03, 0]),
    ]);
  }

  /** A thin bar from p0 to p1 as a box geometry (for bicycle tubes). */
  function strut(p0, p1, w) {
    const a = new THREE.Vector3(p0[0], p0[1], p0[2]);
    const b = new THREE.Vector3(p1[0], p1[1], p1[2]);
    const g = G.paint(new THREE.BoxGeometry(w, w, a.distanceTo(b)), WHITE);
    const m = new THREE.Matrix4().lookAt(b, a, new THREE.Vector3(0, 1, 0));
    m.setPosition(a.clone().add(b).multiplyScalar(0.5));
    return g.applyMatrix4(m);
  }

  /** A small bicycle frame, saddle and handlebar: origin = the ground at the middle of the wheelbase, faces +z. */
  function bikeFrame() {
    return G.merge([
      strut([0, 0.16, -0.3], [0, 0.17, 0.3], 0.02),
      strut([0, 0.16, -0.3], [0, 0.3, -0.06], 0.02),
      strut([0, 0.3, -0.06], [0, 0.31, 0.2], 0.022),
      strut([0, 0.16, -0.02], [0, 0.31, 0.2], 0.02),
      strut([0, 0.31, 0.2], [0, 0.17, 0.3], 0.02),
      G.place(box(0.07, 0.02, 0.11, 0.006), [0, 0.32, -0.08]),
      G.place(box(0.24, 0.02, 0.02, 0.006), [0, 0.36, 0.2]),
    ]);
  }

  /** A wheel: a dark tyre ring lying in the YZ plane. */
  function bikeWheel() {
    const t = new THREE.TorusGeometry(0.15, 0.022, 6, 14);
    t.rotateY(Math.PI / 2);
    return G.merge([G.paint(t, "#2b2b30")]);
  }

  /** All the crowd's part geometries by name, built once on first use. */
  F.crowdGeometries = function () {
    if (F._crowdGeo) return F._crowdGeo;
    const geo = {
      hips: hips(),
      thigh: thigh(),
      shin: shin(),
      skThighL: skirtThigh(1),
      skThighR: skirtThigh(-1),
      skShinL: skirtShin(1),
      skShinR: skirtShin(-1),
      torso: torso(),
      head: head(),
      upper: upper(),
      fore: fore(),
      hand: hand(),
      bag: bag(),
      broom: broom(),
      book: book(),
      bikeFrame: bikeFrame(),
      bikeWheel: bikeWheel(),
    };
    Object.keys(HATS).forEach((k) => (geo["hat_" + k] = G.merge(HATS[k]())));
    if (F.crowdExtraGeometries) Object.assign(geo, F.crowdExtraGeometries());
    F._crowdGeo = geo;
    return geo;
  };
})((window.KQ = window.KQ || {}));
