// Kampung Quest — hair head pieces (registered into the table of headpieces.js): short / bun / quiff
// hair, the tahallul trim and shave, the short hair under a cap or songkok, and the girl hero's own
// hair (ponytail, braids, bun, bob) with a ribbon in her scarf colour. The ponytail and the braids are
// shaped to read from the front and 3/4 views too (the tail peeks out beside the head, the braids hang
// forward over the shoulders), and nothing pokes into the shoulders.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const G = F.Geo;
  const K = F.HeadKit;
  const blob = K.blob;

  /** A carved lathe shell with smooth normals (the shared hair cap). */
  function shell(prof, segs, ang, rIn) {
    const g = K.carve(G.lathe(K.densify(prof, 0.016), segs), ang, -0.12, 0.146, rIn);
    g.computeVertexNormals();
    return G.smoothNormals(g);
  }

  /** Short hair at the nape, tucked under a hat rim at height `top` (back half of the head only). */
  F.napeHair = function (hex, top) {
    const prof = [0.097, 0.08, 0.1075, 0.093, 0.1075, top - 0.008, 0.096, top];
    const g = G.lathe(prof, 30, Math.PI / 2 + 0.35, Math.PI - 0.7);
    g.computeVertexNormals();
    return G.paint(g, hex);
  };

  /** Short sculpted hair: a carved cap with a hairline; options add a side-part fringe, a bun or a quiff. */
  function hair(hd) {
    const prof = [0.097, 0.044, 0.113, 0.066, 0.116, 0.12, 0.115, 0.16, 0.106, 0.2, 0.082, 0.226];
    prof.push(0.04, 0.238, 0, 0.24);
    const list = [G.paint(shell(prof, 48, 1.3, 0.086), hd.colour)];
    list.push(blob([0.085, 0.024, 0.045], [0.018, 0.152, 0.078], [0.2, 0, -0.16], hd.colour)); // side-part fringe
    if (hd.type === "hair_bun")
      list.push(blob([0.052, 0.048, 0.05], [0, 0.2, -0.088], null, hd.colour));
    if (hd.type === "hair_quiff")
      list.push(blob([0.075, 0.03, 0.062], [0.012, 0.214, 0.058], [-0.32, 0, -0.18], hd.colour));
    if (hd.accent) list.push(blob([0.01, 0.01, 0.03], [0, 0.205, -0.104], null, hd.accent)); // hair pin
    return list;
  }

  /** The girl's own hair: a rounded cap a little longer at the sides, with a soft fringe across the brow. */
  function girlHair(hd, low) {
    const y0 = low ? -0.004 : 0.03;
    const w = low ? 0.128 : 0.12;
    const prof = [w - 0.014, y0, w, y0 + 0.024, w, 0.12, 0.118, 0.162, 0.108, 0.2];
    prof.push(0.083, 0.228, 0.04, 0.241, 0, 0.243);
    const list = [G.paint(shell(prof, 48, 0.92, 0.088), hd.colour)]; // hair frames the face
    list.push(blob([0.088, 0.028, 0.038], [0, 0.168, 0.088], [0.3, 0, 0], hd.colour)); // fringe
    list.push(blob([0.04, 0.026, 0.028], [-0.05, 0.16, 0.091], [0.3, 0, 0.3], hd.colour));
    return list;
  }

  /** A hair tie or scrunchie: a small torus in the accent colour. */
  function tie(hd, p, r, s) {
    const t = new THREE.TorusGeometry(s || 0.016, 0.006, 6, 16);
    return G.place(G.paint(t, hd.accent || "#e46f9c"), p, r || null);
  }

  /**
   * Ponytail: tied high on the crown with a ribbon; the tail puffs up over the crown (seen from the
   * front) and swings down past her right side (seen in 3/4 and from the front).
   */
  function girlPonytail(hd) {
    const list = girlHair(hd, false);
    list.push(tie(hd, [0.006, 0.222, -0.086], [1.0, 0, 0], 0.022));
    list.push(blob([0.04, 0.034, 0.04], [0.01, 0.246, -0.1], null, hd.colour));
    list.push(blob([0.034, 0.062, 0.034], [-0.052, 0.19, -0.14], [-0.5, 0, 0.45], hd.colour));
    list.push(blob([0.03, 0.05, 0.03], [-0.104, 0.118, -0.122], [-0.2, 0, 0.35], hd.colour));
    list.push(blob([0.022, 0.03, 0.022], [-0.126, 0.07, -0.1], null, hd.colour));
    return list;
  }

  /** Two braids: plaits from behind the ears hanging forward over the shoulders, each tied off with a ribbon. */
  function girlBraids(hd) {
    const list = girlHair(hd, false);
    for (let s = -1; s <= 1; s += 2) {
      for (let k = 0; k < 4; k += 1) {
        const p = [s * (0.119 + k * 0.004), 0.096 - k * 0.032, 0.012 + k * 0.014];
        list.push(blob([0.025, 0.021, 0.025], p, [0.35, 0, s * 0.2], hd.colour));
      }
      list.push(tie(hd, [s * 0.133, -0.03, 0.06], [Math.PI / 2 - 0.35, 0, 0], 0.014));
      list.push(blob([0.017, 0.02, 0.017], [s * 0.134, -0.05, 0.066], null, hd.colour));
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
      blob([0.012, 0.02, 0.008], [0.082, 0.17, 0.08], [0, 0.7, 0.4], hd.accent || hd.colour),
    );
    return list;
  }

  /** A trim: the same carved hair, but only a skin-thick coat close to the head (no fringe). */
  function buzz(hd) {
    const prof = [0.09, 0.05, 0.1085, 0.063, 0.1092, 0.12, 0.1085, 0.16, 0.101, 0.2, 0.079, 0.224];
    prof.push(0.04, 0.234, 0, 0.236);
    return [G.paint(shell(prof, 48, 1.3, 0.08), hd.colour)];
  }

  /** A shave: nothing visible, only a tiny speck hidden inside the head so the piece is never empty. */
  function bald(hd) {
    return [blob([0.004, 0.004, 0.004], [0, 0.05, 0], null, hd.colour)];
  }

  Object.assign(F.HEAD_PIECE_FN, {
    hair_buzz: buzz,
    hair_bald: bald,
    hair_short: hair,
    hair_bun: hair,
    hair_quiff: hair,
    girl_ponytail: girlPonytail,
    girl_braids: girlBraids,
    girl_bun: girlBun,
    girl_bob: girlBob,
  });
})((window.KQ = window.KQ || {}));
