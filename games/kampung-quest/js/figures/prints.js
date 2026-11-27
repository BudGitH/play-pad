// Kampung Quest — pad-printed faces and torso prints, drawn into one 512 px CanvasTexture atlas per cast
// spec (no external images, so it works on file://). Layout: torso front | torso back on the top half,
// the 180-degree face wrap below, and a white strip that every plain vertex-coloured part samples.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});

  const SIZE = 512;
  const REGIONS = {
    front: [0, 0, 256, 256],
    back: [256, 0, 256, 256],
    face: [0, 256, 512, 192],
    white: [0, 452, 512, 60],
  };
  const atlasCache = {};
  const INK = "#1d1410";
  const EYE = "#3a2418"; // dark brown eyes for every character (never green)

  /** UV rectangle of an atlas region: { u0, u1, v0 (bottom), v1 (top) }. */
  F.regionUV = function (name) {
    const r = REGIONS[name];
    return {
      u0: r[0] / SIZE,
      u1: (r[0] + r[2]) / SIZE,
      v0: 1 - (r[1] + r[3]) / SIZE,
      v1: 1 - r[1] / SIZE,
    };
  };

  // ---------- tiny canvas helpers ----------
  /** Stroke a rounded polyline from a flat [x, y, x, y ...] list with a colour and width. */
  function stroke(c, pts, color, width) {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = c.lineJoin = "round";
    c.stroke();
  }
  /** Fill a closed polygon from a flat [x, y, x, y ...] list. */
  function poly(c, pts, color) {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
    c.fillStyle = color;
    c.fill();
  }
  /** Fill a circle. */
  function dot(c, x, y, r, color) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
  }
  /** Fill a rounded rectangle. */
  function rect(c, x, y, w, h, color, radius) {
    c.beginPath();
    c.roundRect(x, y, w, h, radius || 0);
    c.fillStyle = color;
    c.fill();
  }
  /** Draw a crescent: a disc with a background-coloured disc cut out of one side. */
  function crescent(c, x, y, r, color, bg) {
    dot(c, x, y, r, color);
    dot(c, x + r * 0.42, y - r * 0.12, r * 0.82, bg);
  }
  F.printHelpers = { stroke: stroke, poly: poly, dot: dot, rect: rect, crescent: crescent };

  // ---------- torso prints (region is 256 x 256, y = 0 at the neck) ----------
  /** Draw the two collar flaps at the neck of a torso print. */
  function collar(c, color, edge) {
    poly(c, [86, 0, 128, 52, 112, 64, 70, 8], color);
    poly(c, [170, 0, 128, 52, 144, 64, 186, 8], color);
    stroke(c, [86, 0, 128, 52, 170, 0], edge, 3);
  }
  /** Draw a vertical row of n buttons. */
  function buttons(c, x, y0, n, gap, color) {
    for (let i = 0; i < n; i++) dot(c, x, y0 + i * gap, 5, color);
  }
  /** Draw the two side seams of a garment. */
  function seams(c, color) {
    stroke(c, [20, 250, 20, 120], color, 2);
    stroke(c, [236, 250, 236, 120], color, 2);
  }

  /** Zip jacket print: zip, pockets and collar at the front, a crescent badge on the back. */
  function zipJacket(c, s, front) {
    const p = s.print;
    if (!front) {
      stroke(c, [30, 70, 128, 92, 226, 70], p.accent, 5);
      crescent(c, 128, 150, 20, p.badge, s.torso);
      return;
    }
    collar(c, p.accent, INK);
    stroke(c, [128, 52, 128, 256], "#f4f4ef", 7);
    for (let y = 62; y < 250; y += 12) stroke(c, [122, y, 134, y], "#c9ccd6", 2);
    rect(c, 121, 70, 14, 26, "#e9e9e2", 4);
    stroke(c, [40, 190, 78, 226], p.accent, 4); // welt pockets
    stroke(c, [216, 190, 178, 226], p.accent, 4);
    dot(c, 186, 104, 23, "#f4f4ef");
    crescent(c, 183, 104, 15, p.badge, "#f4f4ef");
    stroke(c, [0, 248, 256, 248], p.accent, 8); // knit hem
  }

  /** Draw a five-petal flower. */
  function flower(c, x, y, r, petal, centre) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      dot(c, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, petal);
    }
    dot(c, x, y, r * 0.55, centre);
  }
  /**
   * Scatter flowers over the garment from a fixed spot list, rotated by seed so front and back
   * differ.
   */
  function scatterFlowers(c, p, seed) {
    const spots = [30, 60, 200, 52, 70, 140, 180, 150, 40, 220, 120, 200, 222, 232, 110, 96];
    for (let i = 0; i < spots.length; i += 2) {
      const j = (i + seed) % spots.length;
      flower(c, spots[j], spots[(j + 1) % spots.length], 9, p.accent, p.accent2 || "#f6d365");
    }
  }
  /** Baju kurung print: scattered flowers, a neckline and a kerongsang brooch. */
  function kurung(c, s, front) {
    const p = s.print;
    scatterFlowers(c, p, front ? 0 : 4);
    if (!front) return;
    stroke(c, [96, 0, 106, 34, 150, 34, 160, 0], INK, 3);
    for (let i = 0; i < 3; i++) dot(c, 128, 54 + i * 26, 7, "#e2b13c"); // kerongsang brooch
  }

  /** Jubah (long robe) print: fold lines, a placket, buttons and a pocket. */
  function jubah(c, s, front) {
    const fold = "rgba(120,110,95,0.35)";
    stroke(c, [60, 60, 52, 256], fold, 3);
    stroke(c, [196, 60, 204, 256], fold, 3);
    if (!front) return;
    rect(c, 98, 0, 60, 16, "#e6e1d6", 6);
    stroke(c, [128, 14, 128, 150], "#bfb6a5", 4);
    buttons(c, 128, 34, 4, 28, "#d9d2c3");
    rect(c, 166, 88, 40, 6, "#cfc7b6", 3);
  }

  /** Shirt print: collar, buttons and pocket (or a polo placket), with optional batik. */
  function shirt(c, s, front) {
    const p = s.print;
    if (p.batik) batik(c, p);
    if (!front) return seams(c, "rgba(0,0,0,0.18)");
    collar(c, p.collar || p.accent, INK);
    stroke(c, [128, 52, 128, 256], "rgba(0,0,0,0.25)", 3);
    buttons(c, 128, 84, p.polo ? 2 : 6, 32, p.button || "#f2efe6");
    if (p.polo) return dot(c, 186, 104, 9, p.accent2 || "#f2efe6");
    rect(c, 156, 96, 46, 50, "rgba(0,0,0,0.12)", 6); // pocket
    rect(c, 186, 82, 6, 30, p.pen || "#2b62c4", 2);
  }
  /** Batik print: a repeating diamond motif with a dot in the middle. */
  function batik(c, p) {
    for (let y = 30; y < 256; y += 64) {
      for (let x = 20; x < 256; x += 64) {
        const dx = (y / 64) % 2 ? 32 : 0;
        stroke(
          c,
          [x + dx, y, x + dx + 18, y + 18, x + dx, y + 36, x + dx - 18, y + 18, x + dx, y],
          p.accent,
          5,
        );
        dot(c, x + dx, y + 18, 6, p.accent2);
      }
    }
  }

  /** Apron print: the bib, straps, pocket and trim at the front, ties at the back. */
  function apron(c, s, front) {
    const p = s.print;
    if (!front) {
      stroke(c, [30, 170, 128, 150, 226, 170], p.apron, 9); // apron ties
      dot(c, 128, 152, 12, p.apron);
      return;
    }
    collar(c, p.collar || s.torso, INK);
    stroke(c, [60, 0, 84, 92], p.apron, 9);
    stroke(c, [196, 0, 172, 92], p.apron, 9);
    rect(c, 76, 88, 104, 168, p.apron, 10);
    rect(c, 96, 176, 64, 44, p.trim || "rgba(0,0,0,0.1)", 6);
    stroke(c, [76, 92, 180, 92], p.trim || "rgba(0,0,0,0.2)", 4);
    dot(c, 128, 136, 15, p.trim || "#d33b2c"); // little bowl logo
    rect(c, 110, 122, 36, 14, p.apron, 0);
  }

  /** Doctor's coat print: lapels, stethoscope, pocket and name badge. */
  function labcoat(c, s, front) {
    const p = s.print;
    if (!front) return stroke(c, [128, 140, 128, 256], "rgba(0,0,0,0.18)", 3);
    poly(c, [76, 0, 180, 0, 128, 150], p.inner);
    stroke(c, [76, 0, 128, 150, 128, 256], "#b9bec6", 4);
    stroke(c, [180, 0, 128, 150], "#b9bec6", 4);
    rect(c, 160, 168, 50, 50, "rgba(0,0,0,0.08)", 6);
    rect(c, 184, 150, 6, 32, "#2a62c9", 2);
    stroke(c, [60, 0, 66, 90, 98, 120, 120, 120], "#5a6270", 6); // stethoscope
    dot(c, 122, 120, 9, "#aeb6c2");
    rect(c, 40, 120, 40, 52, "#f2f6fb", 4);
    rect(c, 44, 126, 32, 12, p.inner, 2);
  }

  /** Cardigan print: an open front with buttons, a pocket and a small book pin. */
  function cardigan(c, s, front) {
    const p = s.print;
    if (!front) return stroke(c, [0, 244, 256, 244], "rgba(0,0,0,0.25)", 10);
    poly(c, [90, 0, 166, 0, 140, 256, 116, 256], p.inner);
    stroke(c, [90, 0, 116, 256], "rgba(0,0,0,0.3)", 4);
    stroke(c, [166, 0, 140, 256], "rgba(0,0,0,0.3)", 4);
    buttons(c, 108, 70, 5, 36, p.button || "#f1e6c8");
    rect(c, 166, 70, 50, 20, "#f5f1e8", 4);
    rect(c, 172, 76, 30, 6, p.inner, 2);
    rect(c, 40, 120, 26, 34, p.accent || "#c0563b", 3); // little book pin
  }

  /** T-shirt print: a neckline band and either the rocket or a round badge. */
  function tee(c, s, front) {
    const p = s.print;
    stroke(c, [84, 0, 128, 28, 172, 0], p.accent, 8);
    if (!front) return;
    if (p.icon === "rocket") return rocket(c, p);
    dot(c, 128, 130, 46, p.accent);
    stroke(c, [86, 112, 170, 112], s.torso, 6);
    stroke(c, [86, 150, 170, 150], s.torso, 6);
    stroke(c, [0, 236, 256, 236], p.accent, 10);
  }
  /** A small rocket picture for a t-shirt. */
  function rocket(c, p) {
    poly(c, [128, 64, 150, 110, 150, 170, 106, 170, 106, 110], p.accent);
    dot(c, 128, 118, 11, p.accent2);
    poly(c, [106, 150, 86, 182, 106, 172], p.accent2);
    poly(c, [150, 150, 170, 182, 150, 172], p.accent2);
    poly(c, [114, 172, 128, 204, 142, 172], "#f6b23c");
  }

  /** Baju Melayu print: a cekak musang collar band, placket, gold buttons and a pocket. */
  function bajuMelayu(c, s, front) {
    const p = s.print;
    if (!front) return seams(c, "rgba(0,0,0,0.18)");
    rect(c, 92, 0, 72, 18, p.accent, 6); // cekak musang collar band
    stroke(c, [128, 16, 128, 130], "rgba(0,0,0,0.3)", 4);
    buttons(c, 128, 38, 3, 30, "#e2b13c");
    rect(c, 46, 120, 44, 40, "rgba(0,0,0,0.12)", 5);
  }

  /** Barber's smock print: collar, side buttons, pocket and a comb. */
  function smock(c, s, front) {
    const p = s.print;
    if (!front) return seams(c, "rgba(0,0,0,0.2)");
    rect(c, 96, 0, 64, 16, p.accent, 6);
    stroke(c, [170, 16, 190, 256], "rgba(0,0,0,0.3)", 4);
    buttons(c, 182, 40, 5, 40, p.accent);
    rect(c, 36, 120, 50, 50, "rgba(255,255,255,0.18)", 6);
    rect(c, 46, 104, 30, 8, INK, 2); // comb
    for (let x = 48; x < 76; x += 5) stroke(c, [x, 110, x, 122], INK, 2);
  }

  /**
   * Postman's uniform print: epaulettes, pockets, an envelope badge and a strap across the body.
   */
  function uniform(c, s, front) {
    const p = s.print;
    rect(c, 0, 0, 52, 22, p.accent, 4); // epaulettes
    rect(c, 204, 0, 52, 22, p.accent, 4);
    if (!front) return stroke(c, [236, 10, 24, 236], p.strap, 14);
    collar(c, s.torso, INK);
    rect(c, 36, 84, 54, 40, "rgba(0,0,0,0.14)", 4);
    rect(c, 166, 84, 54, 40, "rgba(0,0,0,0.14)", 4);
    rect(c, 176, 92, 34, 22, "#f6f1e3", 2); // envelope badge
    stroke(c, [176, 92, 193, 106, 210, 92], p.accent, 3);
    stroke(c, [24, 10, 236, 236], p.strap, 14);
  }

  const TORSO_STYLES = {
    zip: zipJacket,
    kurung: kurung,
    jubah: jubah,
    shirt: shirt,
    apron: apron,
    labcoat: labcoat,
    cardigan: cardigan,
    tee: tee,
    baju_melayu: bajuMelayu,
    smock: smock,
    uniform: uniform,
  };
  F.TORSO_STYLES = TORSO_STYLES;

  /**
   * Paint a torso texture (front or back region of the atlas) in the base colour plus the style's
   * print, clipped to its region.
   */
  function drawTorso(ctx, spec, front) {
    const r = REGIONS[front ? "front" : "back"];
    ctx.save();
    ctx.translate(r[0], r[1]);
    ctx.beginPath();
    ctx.rect(0, 0, r[2], r[3]);
    ctx.clip();
    ctx.fillStyle = spec.torso;
    ctx.fillRect(0, 0, r[2], r[3]);
    const style = TORSO_STYLES[spec.print && spec.print.style];
    if (style) style(ctx, spec, front);
    ctx.restore();
  }

  /** Build (or reuse) the printed atlas texture for one cast spec. */
  F.makeAtlas = function (spec) {
    if (atlasCache[spec.id]) return atlasCache[spec.id];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);
    drawTorso(ctx, spec, true);
    drawTorso(ctx, spec, false);
    F.drawFace(ctx, spec, REGIONS.face);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    atlasCache[spec.id] = tex;
    return tex;
  };

  F.INK = INK;
  F.EYE_COLOUR = EYE;
})((window.KQ = window.KQ || {}));
