// Kampung Quest — sculpted head pieces (separate, swappable meshes like toy hair / hat pieces):
// cap (with a crescent badge), songkok, kopiah, tudung (crown + face frame + back shell + shoulder drape),
// and short / bun / quiff hair. All original sculpts — no spikes, no quills.
(function (KQ) {
  "use strict";
  var F = (KQ.Figures = KQ.Figures || {});
  var G = F.Geo;
  var TAU = Math.PI * 2;
  var pieceCache = {};

  function dome(r, y, sy, hex, segs) {
    var g = new THREE.SphereGeometry(r, segs || 26, 9, 0, TAU, 0, Math.PI / 2);
    return G.place(G.paint(g, hex), [0, y, 0], null, [1, sy, 1]);
  }
  function blob(s, p, r, hex) {
    return G.place(G.paint(new THREE.SphereGeometry(1, 16, 10), hex), p, r, s);
  }
  /** Hair round the sides and back, open at the front so the face shows. */
  function backShell(r, y0, y1, open, hex) {
    var g = new THREE.CylinderGeometry(r, r - 0.002, y1 - y0, 26, 1, false, open, TAU - 2 * open);
    return G.place(G.paint(g, hex), [0, (y0 + y1) / 2, 0]);
  }

  /** A crescent outline (outer circle minus an offset inner circle) as an extruded, bevelled badge. */
  function crescentBadge(R, hex) {
    var r = R * 0.84;
    var dx = R * 0.42;
    var ix = (R * R - r * r + dx * dx) / (2 * dx);
    var iy = Math.sqrt(R * R - ix * ix);
    var a = Math.atan2(iy, ix);
    var b = Math.atan2(iy, ix - dx);
    var s = new THREE.Shape();
    s.absarc(0, 0, R, a, TAU - a, false);
    s.absarc(dx, 0, r, TAU - b, b, true);
    var opts = { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 10 };
    return G.paint(new THREE.ExtrudeGeometry(s, opts), hex);
  }

  /** Baseball-style cap: crown, band, peak, button and a small crescent badge on the front. */
  function cap(hd) {
    var list = [dome(0.119, 0.165, 0.62, hd.colour)];
    list.push(G.place(G.paint(new THREE.CylinderGeometry(0.119, 0.118, 0.024, 26, 1), hd.band || hd.colour), [0, 0.155, 0]));
    var peak = new THREE.CylinderGeometry(0.092, 0.092, 0.011, 20, 1, false, -Math.PI / 2, Math.PI);
    list.push(G.place(G.paint(peak, hd.peak || hd.colour), [0, 0.148, 0.074], [0.13, 0, 0], [1, 1, 1.28]));
    list.push(blob([0.014, 0.008, 0.014], [0, 0.238, 0], null, hd.colour));
    if (hd.badge) list.push(G.place(crescentBadge(0.022, hd.badge), [0.0, 0.196, 0.1], [-0.55, 0, 0]));
    if (hd.hair) list.push(backShell(0.111, 0.07, 0.15, 1.75, hd.hair));
    return list;
  }

  function songkok(hd) {
    var prof = [0, 0.146, 0.114, 0.146, 0.114, 0.2, 0.111, 0.214, 0.1, 0.221, 0, 0.221];
    var list = [G.place(G.paint(G.lathe(prof, 28), hd.colour), null, null, [1, 1, 0.93])];
    if (hd.hair) list.push(backShell(0.109, 0.09, 0.15, 1.55, hd.hair));
    return list;
  }

  function kopiah(hd) {
    var prof = [0, 0.146, 0.113, 0.146, 0.113, 0.198, 0.106, 0.214, 0.092, 0.222, 0, 0.222];
    var list = [G.paint(G.lathe(prof, 28), hd.colour)];
    [0.163, 0.183, 0.203].forEach(function (y) {
      var ring = new THREE.TorusGeometry(0.1135, 0.0022, 4, 40);
      list.push(G.place(G.paint(ring, hd.accent || hd.colour), [0, y, 0], [Math.PI / 2, 0, 0]));
    });
    return list;
  }

  /** Shoulder drape of a tudung: a flared lathe with a longer front panel over the chest. */
  function drape(hd, kid) {
    var hem = kid ? -0.075 : -0.095;
    var prof = [0.14, hem + 0.004, 0.168, hem, 0.176, hem * 0.9, 0.16, hem * 0.45, 0.126, 0.004, 0.094, 0.026];
    var g = G.lathe(prof, 30);
    var pos = g.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i);
      if (y < 0) pos.setY(i, y - Math.max(0, pos.getZ(i)) * (kid ? 0.25 : 0.42) * (-y / -hem));
    }
    g.computeVertexNormals();
    return G.place(G.paint(g, hd.colour), null, null, [1, 1, 0.86]);
  }

  function tudung(hd) {
    var kid = hd.type === "tudung_kid";
    var open = 1.0;
    var list = [dome(0.122, 0.152, 0.74, hd.colour, 28)];
    list.push(G.place(G.paint(new THREE.TorusGeometry(0.121, 0.0115, 7, 32), hd.colour), [0, 0.152, 0], [Math.PI / 2, 0, 0]));
    list.push(backShell(0.124, 0.004, 0.152, open, hd.colour));
    for (var s = -1; s <= 1; s += 2) {
      var rim = new THREE.CylinderGeometry(0.0125, 0.0125, 0.15, 8, 1);
      list.push(G.place(G.paint(rim, hd.colour), [s * Math.sin(open) * 0.123, 0.078, Math.cos(open) * 0.123]));
    }
    list.push(drape(hd, kid));
    if (hd.accent) list.push(blob([0.012, 0.012, 0.007], [0, 0.012, 0.112], null, hd.accent));
    if (hd.under) list.push(G.place(G.paint(new THREE.TorusGeometry(0.111, 0.008, 5, 32), hd.under), [0, 0.142, 0.004], [Math.PI / 2, 0, 0]));
    return list;
  }

  /** Short sculpted hair; options add a side-part fringe, a bun or a single smooth front quiff. */
  function hair(hd) {
    var list = [dome(0.115, 0.14, 0.66, hd.colour), backShell(0.114, 0.06, 0.142, 1.2, hd.colour)];
    list.push(blob([0.1, 0.03, 0.052], [0.012, 0.15, 0.072], [0.15, 0, -0.14], hd.colour)); // side-part fringe
    if (hd.type === "hair_bun") list.push(blob([0.052, 0.048, 0.05], [0, 0.2, -0.088], null, hd.colour));
    if (hd.type === "hair_quiff") list.push(blob([0.072, 0.044, 0.07], [0, 0.205, 0.045], [-0.45, 0, 0], hd.colour));
    if (hd.accent) list.push(blob([0.01, 0.01, 0.03], [0, 0.205, -0.104], null, hd.accent)); // hair pin
    return list;
  }

  var PIECES = {
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
    var key = JSON.stringify(hd);
    if (pieceCache[key]) return pieceCache[key];
    var make = PIECES[hd.type] || hair;
    pieceCache[key] = G.merge(make(hd));
    return pieceCache[key];
  };
})((window.KQ = window.KQ || {}));
