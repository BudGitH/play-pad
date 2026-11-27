// Kampung Quest — sculpted head pieces (separate, swappable meshes like toy hair / hat pieces):
// cap (with a crescent badge), songkok, kopiah, tudung (crown + face frame + back shell + shoulder drape),
// and short / bun / quiff hair. All original sculpts — no spikes, no quills.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const G = F.Geo;
  const TAU = Math.PI * 2;
  const pieceCache = {};

  /**
   * A half-sphere dome of radius r raised to height y and squashed by sy (the base of caps and
   * hair).
   */
  function dome(r, y, sy, hex, segs) {
    const g = new THREE.SphereGeometry(r, segs || 26, 9, 0, TAU, 0, Math.PI / 2);
    return G.place(G.paint(g, hex), [0, y, 0], null, [1, sy, 1]);
  }
  /**
   * A small ellipsoid of size s at position p (turned by r), used for hair tufts, buns and buttons.
   */
  function blob(s, p, r, hex) {
    return G.place(G.paint(new THREE.SphereGeometry(1, 14, 9), hex), p, r, s);
  }
  /** A crescent outline (outer circle minus an offset inner circle) as an extruded, bevelled badge. */
  function crescentBadge(R, hex) {
    const r = R * 0.84;
    const dx = R * 0.42;
    const ix = (R * R - r * r + dx * dx) / (2 * dx);
    const iy = Math.sqrt(R * R - ix * ix);
    const a = Math.atan2(iy, ix);
    const b = Math.atan2(iy, ix - dx);
    const s = new THREE.Shape();
    s.absarc(0, 0, R, a, TAU - a, false);
    s.absarc(dx, 0, r, TAU - b, b, true);
    const opts = {
      depth: 0.004,
      bevelEnabled: true,
      bevelThickness: 0.0015,
      bevelSize: 0.0015,
      bevelSegments: 1,
      curveSegments: 8,
    };
    return G.paint(G.smoothNormals(new THREE.ExtrudeGeometry(s, opts)), hex);
  }

  /** Baseball-style cap: crown, band, peak, button and a small crescent badge on the front. */
  function cap(hd) {
    const list = [dome(0.119, 0.165, 0.62, hd.colour)];
    list.push(
      G.place(
        G.paint(new THREE.CylinderGeometry(0.119, 0.118, 0.024, 26, 1), hd.band || hd.colour),
        [0, 0.155, 0],
      ),
    );
    const peak = new THREE.CylinderGeometry(
      0.092,
      0.092,
      0.011,
      20,
      1,
      false,
      -Math.PI / 2,
      Math.PI,
    );
    list.push(
      G.place(G.paint(peak, hd.peak || hd.colour), [0, 0.148, 0.074], [0.13, 0, 0], [1, 1, 1.28]),
    );
    list.push(blob([0.014, 0.008, 0.014], [0, 0.238, 0], null, hd.colour));
    if (hd.badge)
      list.push(G.place(crescentBadge(0.022, hd.badge), [0.0, 0.196, 0.1], [-0.55, 0, 0]));
    if (hd.hair) list.push(blob([0.104, 0.062, 0.07], [0, 0.128, -0.052], null, hd.hair));
    return list;
  }

  /** The songkok: a lathed flat-topped cap, with an optional hair tuft behind it. */
  function songkok(hd) {
    const prof = [0, 0.146, 0.114, 0.146, 0.114, 0.2, 0.111, 0.214, 0.1, 0.221, 0, 0.221];
    const list = [G.place(G.paint(G.lathe(prof, 28), hd.colour), null, null, [1, 1, 0.93])];
    if (hd.hair) list.push(blob([0.106, 0.05, 0.07], [0, 0.138, -0.048], null, hd.hair));
    return list;
  }

  /** The kopiah: a lathed cap with three thin trim rings in the accent colour. */
  function kopiah(hd) {
    const prof = [0, 0.146, 0.113, 0.146, 0.113, 0.198, 0.106, 0.214, 0.092, 0.222, 0, 0.222];
    const list = [G.paint(G.lathe(prof, 28), hd.colour)];
    [0.163, 0.183, 0.203].forEach(function (y) {
      const ring = new THREE.TorusGeometry(0.1135, 0.0022, 4, 40);
      list.push(G.place(G.paint(ring, hd.accent || hd.colour), [0, y, 0], [Math.PI / 2, 0, 0]));
    });
    return list;
  }

  /** Re-sample a [r, y, r, y ...] profile so no step is longer than `step` (smooth carving needs it). */
  function densify(pairs, step) {
    const out = [pairs[0], pairs[1]];
    for (let i = 2; i < pairs.length; i += 2) {
      const dr = pairs[i] - pairs[i - 2];
      const dy = pairs[i + 1] - pairs[i - 1];
      const n = Math.max(1, Math.ceil(Math.hypot(dr, dy) / step));
      for (let k = 1; k <= n; k++)
        out.push(pairs[i - 2] + (dr * k) / n, pairs[i - 1] + (dy * k) / n);
    }
    return out;
  }

  /**
   * Sculpt a face opening into a hood: vertices inside a front oval (half-angle `ang`, y0..y1) are pulled
   * in towards radius rIn, with a smooth roll so the edge reads as a thick, rounded moulded lip.
   */
  function carve(g, ang, y0, y1, rIn) {
    const pos = g.attributes.position;
    const cy = (y0 + y1) / 2;
    const hy = (y1 - y0) / 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const th = Math.atan2(x, z) / ang;
      const ey = (pos.getY(i) - cy) / hy;
      const t = Math.max(0, Math.min(1, (1.12 - (th * th + ey * ey)) / 0.42));
      const r = Math.hypot(x, z);
      if (t <= 0 || r < 1e-5) continue;
      const k = t * t * (3 - 2 * t);
      const f = (r + (rIn - r) * k) / r;
      pos.setX(i, x * f);
      pos.setZ(i, z * f);
    }
    return g;
  }

  /** Tudung: one sculpted hood (crown, face frame, under-chin) flowing into a shoulder drape. */
  function tudung(hd) {
    const kid = hd.type === "tudung_kid";
    const hem = kid ? -0.072 : -0.095;
    const prof = [
      0.13,
      hem,
      0.15,
      hem + 0.012,
      0.146,
      hem * 0.5,
      0.128,
      -0.012,
      0.119,
      0.015,
      0.121,
      0.06,
    ];
    prof.push(0.124, 0.12, 0.122, 0.165, 0.112, 0.205, 0.088, 0.228, 0.045, 0.24, 0, 0.243);
    const g = carve(G.lathe(densify(prof, 0.024), 32), 0.98, 0.002, 0.174, 0.088);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y >= 0) continue;
      const z = pos.getZ(i) * 0.82;
      pos.setXYZ(i, pos.getX(i), y - Math.max(0, z) * (kid ? 0.3 : 0.5) * (y / hem), z);
    }
    g.computeVertexNormals();
    const list = [G.paint(g, hd.colour)];
    if (hd.accent) list.push(blob([0.012, 0.012, 0.007], [0, 0.004, 0.1], null, hd.accent));
    if (hd.under)
      list.push(
        G.place(
          G.paint(new THREE.TorusGeometry(0.103, 0.007, 5, 36, 2.2), hd.under),
          [0, 0.166, 0],
          [Math.PI / 2, 0, 0.47],
        ),
      );
    return list;
  }

  /** Short sculpted hair: a carved cap with a hairline; options add a side-part fringe, a bun or a quiff. */
  function hair(hd) {
    const prof = [
      0.104, 0.05, 0.113, 0.07, 0.116, 0.12, 0.115, 0.16, 0.106, 0.2, 0.082, 0.226, 0.04, 0.238, 0,
      0.24,
    ];
    const g = carve(G.lathe(densify(prof, 0.018), 30), 1.3, -0.12, 0.146, 0.092);
    g.computeVertexNormals();
    const list = [G.paint(g, hd.colour)];
    list.push(blob([0.085, 0.024, 0.045], [0.018, 0.152, 0.078], [0.2, 0, -0.16], hd.colour)); // side-part fringe
    if (hd.type === "hair_bun")
      list.push(blob([0.052, 0.048, 0.05], [0, 0.2, -0.088], null, hd.colour));
    if (hd.type === "hair_quiff")
      list.push(blob([0.075, 0.03, 0.062], [0.012, 0.214, 0.058], [-0.32, 0, -0.18], hd.colour));
    if (hd.accent) list.push(blob([0.01, 0.01, 0.03], [0, 0.205, -0.104], null, hd.accent)); // hair pin
    return list;
  }

  /** A trim: the same carved hair, but only a skin-thick coat close to the head (no fringe). */
  function buzz(hd) {
    const prof = [
      0.104, 0.05, 0.108, 0.07, 0.109, 0.12, 0.108, 0.16, 0.101, 0.2, 0.079, 0.224, 0.04, 0.234, 0,
      0.236,
    ];
    const g = carve(G.lathe(densify(prof, 0.018), 30), 1.3, -0.12, 0.146, 0.092);
    g.computeVertexNormals();
    return [G.paint(g, hd.colour)];
  }

  /** A shave: nothing visible, only a tiny speck hidden inside the head so the piece is never empty. */
  function bald(hd) {
    return [blob([0.004, 0.004, 0.004], [0, 0.05, 0], null, hd.colour)];
  }

  const PIECES = {
    hair_buzz: buzz,
    hair_bald: bald,
    cap: cap,
    songkok: songkok,
    kopiah: kopiah,
    tudung: tudung,
    tudung_kid: tudung,
    hair_short: hair,
    hair_bun: hair,
    hair_quiff: hair,
  };
  F.HEAD_PIECES = Object.keys(PIECES);

  /** Geometry for a head-piece spec { type, colour, ... } (cached by its content). Origin = head origin. */
  F.headPieceGeometry = function (hd) {
    const key = JSON.stringify(hd);
    if (pieceCache[key]) return pieceCache[key];
    const make = PIECES[hd.type] || hair;
    pieceCache[key] = G.merge(make(hd));
    return pieceCache[key];
  };
})((window.KQ = window.KQ || {}));
