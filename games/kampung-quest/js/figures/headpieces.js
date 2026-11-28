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
    return hood(hd, kid ? -0.072 : -0.095, kid ? 0.3 : 0.5);
  }

  /** The hood itself: `hem` is how low the drape reaches, `fall` how far it slopes forward-down. */
  function hood(hd, hem, fall) {
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
      pos.setXYZ(i, pos.getX(i), y - Math.max(0, z) * fall * (y / hem), z);
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

  /** The girl hero's plain hijab: a snug hood to the shoulders with a little pin at the chin. */
  function hijab(hd) {
    return hood(hd, -0.085, 0.42);
  }

  /** A sporty hijab: shorter and snug, with a band round the crown in the second colour. */
  function hijabSport(hd) {
    const list = hood({ type: "hijab", colour: hd.colour }, -0.06, 0.25);
    const band = new THREE.TorusGeometry(0.1235, 0.0075, 6, 40);
    list.push(
      G.place(G.paint(band, hd.accent || hd.colour), [0, 0.15, -0.004], [Math.PI / 2.1, 0, 0]),
    );
    return list;
  }

  /** A five-petal flower of little blobs facing out from the head at (x, y, z). */
  function flower(p, r, petal, centre) {
    const list = [];
    const out = Math.atan2(p[0], p[2]);
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * TAU;
      const dx = Math.cos(a) * r * Math.cos(out);
      const dz = -Math.cos(a) * r * Math.sin(out);
      const q = [p[0] + dx, p[1] + Math.sin(a) * r, p[2] + dz];
      list.push(blob([r * 0.8, r * 0.8, r * 0.45], q, [0, out, 0], petal));
    }
    list.push(blob([r * 0.55, r * 0.55, r * 0.5], p, null, centre));
    return list;
  }

  /** A flower hijab: the plain one with a cluster of little flowers at the side of the face. */
  function hijabFlower(hd) {
    const list = hood({ type: "hijab", colour: hd.colour }, -0.085, 0.42);
    const petal = hd.accent || "#ffffff";
    const centre = "#f2c230";
    return list.concat(
      flower([0.098, 0.15, 0.052], 0.013, petal, centre),
      flower([0.11, 0.11, 0.02], 0.009, petal, centre),
      flower([0.084, 0.182, 0.026], 0.008, petal, centre),
    );
  }

  /** The girl's own hair: a rounded cap a little longer at the sides, with a soft fringe across the brow. */
  function girlHair(hd, low) {
    const y0 = low ? -0.004 : 0.03;
    const w = low ? 0.128 : 0.12;
    const prof = [w - 0.012, y0, w, y0 + 0.024, w, 0.12, 0.118, 0.162, 0.108, 0.2];
    prof.push(0.083, 0.228, 0.04, 0.241, 0, 0.243);
    const g = carve(G.lathe(densify(prof, 0.016), 32), 0.92, -0.12, 0.146, 0.092); // hair frames the face
    g.computeVertexNormals();
    const list = [G.paint(g, hd.colour)];
    list.push(blob([0.088, 0.03, 0.04], [0, 0.166, 0.084], [0.25, 0, 0], hd.colour)); // fringe
    list.push(blob([0.04, 0.028, 0.03], [-0.05, 0.158, 0.088], [0.25, 0, 0.3], hd.colour));
    return list;
  }

  /** A hair tie or scrunchie: a small torus in the accent colour. */
  function tie(hd, p, r, s) {
    const t = new THREE.TorusGeometry(s || 0.016, 0.006, 6, 16);
    return G.place(G.paint(t, hd.accent || "#e46f9c"), p, r || null);
  }

  /** Ponytail: hair tied high at the back with a ribbon, the tail swinging down to the neck. */
  function girlPonytail(hd) {
    const list = girlHair(hd, false);
    list.push(tie(hd, [0, 0.19, -0.118], [0.3, 0, 0], 0.018));
    list.push(blob([0.034, 0.075, 0.034], [0, 0.12, -0.142], [-0.28, 0, 0], hd.colour));
    list.push(blob([0.026, 0.03, 0.026], [0, 0.05, -0.155], null, hd.colour));
    return list;
  }

  /** Two braids: a chain of little plaits behind each ear, each tied off with a ribbon. */
  function girlBraids(hd) {
    const list = girlHair(hd, false);
    for (let s = -1; s <= 1; s += 2) {
      for (let k = 0; k < 4; k += 1) {
        const p = [s * (0.1 - k * 0.004), 0.085 - k * 0.032, -0.03 - k * 0.008];
        list.push(blob([0.024, 0.02, 0.024], p, [0, 0, s * 0.3], hd.colour));
      }
      list.push(tie(hd, [s * 0.086, -0.04, -0.06], [Math.PI / 2, 0, 0], 0.013));
      list.push(blob([0.016, 0.018, 0.016], [s * 0.085, -0.058, -0.062], null, hd.colour));
    }
    return list;
  }

  /** A round bun on top at the back, with a scrunchie. */
  function girlBun(hd) {
    const list = girlHair(hd, false);
    list.push(blob([0.056, 0.05, 0.054], [0, 0.236, -0.064], null, hd.colour));
    list.push(tie(hd, [0, 0.205, -0.06], [Math.PI / 2 - 0.5, 0, 0], 0.036));
    return list;
  }

  /** A short bob to the jaw with a clip in the accent colour. */
  function girlBob(hd) {
    const list = girlHair(hd, true);
    list.push(
      blob([0.012, 0.02, 0.008], [0.082, 0.17, 0.072], [0, 0.7, 0.4], hd.accent || hd.colour),
    );
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
    hijab: hijab,
    hijab_sport: hijabSport,
    hijab_flower: hijabFlower,
    girl_ponytail: girlPonytail,
    girl_braids: girlBraids,
    girl_bun: girlBun,
    girl_bob: girlBob,
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
