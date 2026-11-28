// Kampung Quest — sculpted head pieces (separate, swappable meshes like toy hair / hat pieces):
// cap (with a crescent badge), songkok, kopiah, and the fitted hoods (tudung, the girl hero's hijabs).
// Hair pieces live in headpieces-hair.js and register into the same table. All original sculpts — no
// spikes, no quills.
// Fit rules (checked by features/kampung-quest-playability/figures/audit.mjs and
// tests/kampung-quest-figures.spec.mjs): every piece is measured against the real head lathe
// (F.headProfile: radius 0.105, top 0.19 in head units). Hats sit 2-6 mm off the head with their
// lower rim no more than 3 mm away (no floating brims, no head showing through); hoods frame a
// rounded face opening whose lip tucks into the head; lathes use 48 segments and smoothed seams.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const G = F.Geo;
  const TAU = Math.PI * 2;
  const pieceCache = {};

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

  /** A lathe with smooth normals across its back seam (no crease line down the back of a hood or cap). */
  function smoothLathe(pairs, segs, phiStart, phiLength) {
    const g = G.lathe(pairs, segs, phiStart, phiLength);
    g.computeVertexNormals();
    return G.smoothNormals(g);
  }

  /** A closed ring (a band round a hat) between radii r0..r1 and heights y0..y1. */
  function ring(r0, r1, y0, y1, hex) {
    const g = G.lathe([r0, y0, r1, y0, r1, y1, r0, y1, r0, y0], 48);
    g.computeVertexNormals();
    return G.paint(g, hex);
  }

  /**
   * A dome profile [r, y ...] from (r, y0) curving up to the crown at y0 + h (a quarter ellipse),
   * appended to `out`.
   */
  function domeProfile(out, r, y0, h, steps) {
    for (let i = 1; i <= steps; i += 1) {
      const a = (i / steps) * (Math.PI / 2);
      out.push(i === steps ? 0 : r * Math.cos(a), y0 + h * Math.sin(a));
    }
    return out;
  }

  /**
   * Baseball-style cap: one shell (snug lower rim, round crown), a band, the peak, a button and a
   * small crescent badge on the front, plus short hair at the nape.
   */
  function cap(hd) {
    const shell = domeProfile([0.1075, 0.142, 0.1105, 0.166], 0.1105, 0.166, 0.068, 10);
    const list = [G.paint(smoothLathe(shell, 48), hd.colour)];
    list.push(ring(0.1092, 0.1125, 0.143, 0.165, hd.band || hd.colour));
    const front = [];
    const peak = new THREE.CylinderGeometry(0.09, 0.09, 0.011, 24, 1, false, -Math.PI / 2, Math.PI);
    front.push(
      G.place(G.paint(peak, hd.peak || hd.colour), [0, 0.15, 0.058], [0.13, 0, 0], [1, 1, 1.36]),
    );
    if (hd.badge)
      front.push(G.place(crescentBadge(0.021, hd.badge), [0.0, 0.19, 0.0995], [-0.6, 0, 0]));
    // worn peak-back (hd.reversed, for the prayer postures): the peak and badge turn, the hair stays
    if (hd.reversed) front.forEach((g) => G.place(g, null, [0, Math.PI, 0]));
    list.push(...front, blob([0.014, 0.008, 0.014], [0, 0.233, 0], null, hd.colour));
    if (hd.hair) list.push(F.napeHair(hd.hair, 0.146));
    return list;
  }

  /** The songkok: a lathed flat-topped cap (slightly oval), with short hair at the nape. */
  function songkok(hd) {
    const prof = [0, 0.146, 0.111, 0.146, 0.1125, 0.2, 0.11, 0.214, 0.099, 0.221, 0, 0.221];
    const list = [G.place(G.paint(smoothLathe(prof, 48), hd.colour), null, null, [1, 1, 0.965])];
    if (hd.hair) list.push(F.napeHair(hd.hair, 0.15));
    return list;
  }

  /** The kopiah: a lathed cap with three thin trim rings in the accent colour. */
  function kopiah(hd) {
    const prof = [0, 0.146, 0.1095, 0.146, 0.1105, 0.198, 0.104, 0.214, 0.09, 0.222, 0, 0.222];
    const list = [G.paint(smoothLathe(prof, 48), hd.colour)];
    [0.163, 0.183, 0.201].forEach(function (y) {
      const ring = new THREE.TorusGeometry(y > 0.2 ? 0.1085 : 0.1105, 0.0022, 4, 48);
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

  /**
   * The hoods: [hem, fall] of each one's shoulder drape (how low it reaches, how far it slopes
   * forward-down over the chest). The drape is its own mesh on the torso (F.headDrapeGeometry,
   * placed by build.js), so it stays on the shoulders when the head turns or nods, and only the
   * hood itself moves with the head: no gap at the neck, no drape swinging through the shoulders.
   */
  const DRAPES = {
    tudung: [-0.095, 0.5],
    tudung_kid: [-0.072, 0.3],
    hijab: [-0.085, 0.42],
    hijab_sport: [-0.06, 0.25],
    hijab_flower: [-0.085, 0.42],
  };

  /** Tudung: one sculpted hood (crown, face frame, under-chin) over a shoulder drape. */
  function tudung(hd) {
    return hood(hd);
  }

  /**
   * The fitted hood's profile: snug over the head (8-11 mm off it, the cloth's thickness), closed
   * under the chin, its lower edge tucked inside the drape.
   */
  const HOOD_PROFILE = [0.118, -0.03, 0.121, -0.016, 0.116, 0.012, 0.1135, 0.06, 0.115, 0.118];
  HOOD_PROFILE.push(0.1135, 0.162, 0.105, 0.196, 0.085, 0.219, 0.045, 0.231, 0, 0.234);

  /** Squash the part of a hood or drape below the jaw front to back (the toy's shoulders are flat). */
  function squashLow(g, fall, hem) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y >= 0) continue;
      const z = pos.getZ(i) * 0.82;
      pos.setXYZ(i, pos.getX(i), y - Math.max(0, z) * fall * (y / hem), z);
    }
    g.computeVertexNormals();
    return G.smoothNormals(g);
  }

  /** The hood itself (moves with the head); its drape is F.headDrapeGeometry. */
  function hood(hd) {
    const g = G.lathe(densify(HOOD_PROFILE, 0.012), 56);
    carve(g, 0.9, 0.026, 0.17, 0.088); // a rounded face opening that frames the printed face
    const list = [G.paint(squashLow(g, 0, -1), hd.colour)];
    if (hd.accent) list.push(blob([0.011, 0.011, 0.006], [0, -0.002, 0.113], null, hd.accent));
    if (hd.under) list.push(underScarf(hd.under));
    return list;
  }

  /** The thin under-scarf line across the brow, inside the face opening. */
  function underScarf(hex) {
    const t = new THREE.TorusGeometry(0.1052, 0.0045, 6, 40, 1.7);
    return G.place(G.paint(t, hex), [0, 0.166, 0], [Math.PI / 2, 0, Math.PI / 2 - 0.85]);
  }

  /** The girl hero's plain hijab: a snug hood to the shoulders with a little pin at the chin. */
  function hijab(hd) {
    return hood(hd);
  }

  /** A sporty hijab: shorter and snug, with a band hugging the crown in the second colour. */
  function hijabSport(hd) {
    const list = hood({ type: "hijab", colour: hd.colour });
    const band = new THREE.TorusGeometry(0.1158, 0.0055, 6, 56);
    list.push(G.place(G.paint(band, hd.accent || hd.colour), [0, 0.152, -0.006], [1.48, 0, 0]));
    return list;
  }

  /** A five-petal flower of little blobs on the hood surface at angle `a` from the face, height y. */
  function flower(a, y, r, petal, centre) {
    const R = 0.116;
    const p = [Math.sin(a) * R, y, Math.cos(a) * R];
    const list = [];
    for (let i = 0; i < 5; i += 1) {
      const b = (i / 5) * TAU;
      const q = [
        p[0] + Math.cos(b) * r * Math.cos(a),
        y + Math.sin(b) * r,
        p[2] - Math.cos(b) * r * Math.sin(a),
      ];
      list.push(blob([r * 0.8, r * 0.8, r * 0.45], q, [0, a, 0], petal));
    }
    list.push(blob([r * 0.55, r * 0.55, r * 0.5], p, [0, a, 0], centre));
    return list;
  }

  /** A flower hijab: the plain one with a cluster of little flowers on the side of the hood. */
  function hijabFlower(hd) {
    const list = hood({ type: "hijab", colour: hd.colour });
    const petal = hd.accent || "#ffffff";
    const centre = "#f2c230";
    return list.concat(
      flower(1.12, 0.15, 0.014, petal, centre),
      flower(1.32, 0.112, 0.01, petal, centre),
      flower(0.98, 0.186, 0.009, petal, centre),
    );
  }

  const PIECES = {
    cap: cap,
    songkok: songkok,
    kopiah: kopiah,
    tudung: tudung,
    tudung_kid: tudung,
    hijab: hijab,
    hijab_sport: hijabSport,
    hijab_flower: hijabFlower,
  };
  F.HEAD_PIECE_FN = PIECES; // headpieces-hair.js adds the hair pieces
  F.HeadKit = { blob, densify, carve, smoothLathe };

  /** Every head-piece type (hats, hoods and hair). */
  F.headPieceTypes = () => Object.keys(PIECES);

  const drapeCache = {};
  /**
   * The shoulder drape of a hood (tudung, hijab), or null for every other piece. Head units with the
   * head's origin (the top of the neck): build.js puts it on the torso at the neck, scaled like the
   * head. Its top edge tucks inside the hood.
   */
  F.headDrapeGeometry = function (hd) {
    const d = hd && DRAPES[hd.type];
    if (!d) return null;
    const key = hd.type + "|" + hd.colour;
    if (drapeCache[key]) return drapeCache[key];
    const hem = d[0];
    const prof = [0.15, hem, 0.163, hem + 0.012, 0.153, hem * 0.5, 0.13, -0.02, 0.117, 0.004];
    const g = squashLow(G.lathe(densify(prof, 0.012), 56), d[1], hem);
    drapeCache[key] = G.merge([G.paint(g, hd.colour)]);
    return drapeCache[key];
  };

  /** Geometry for a head-piece spec { type, colour, ... } (cached by its content). Origin = head origin. */
  F.headPieceGeometry = function (hd) {
    const key = JSON.stringify(hd);
    if (pieceCache[key]) return pieceCache[key];
    const make = PIECES[hd.type] || PIECES.hair_short;
    pieceCache[key] = G.merge(make(hd));
    return pieceCache[key];
  };
})((window.KQ = window.KQ || {}));
