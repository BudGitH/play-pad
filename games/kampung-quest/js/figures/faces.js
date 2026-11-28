// Kampung Quest — printed faces. Drawn into the face strip of a figure's atlas (512 x 192 px that wraps
// the front half of the head). Every face is original: dark-brown eyes with catch-lights, simple brows
// and a mouth, plus optional glasses, beard, moustache, wrinkles, lashes, freckles and blush.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});

  const CX = 256; // face centre on the strip
  const EYE_Y = 86;
  const MOUTH_Y = 152;

  /** The shared 2D drawing helpers (dot, stroke, poly) from the print module. */
  function h() {
    return F.printHelpers;
  }

  /**
   * The heroes' finer eye (boy and girl, `face.hero`): a dark-brown eye with a warm brown lower
   * iris ring, two catch-lights and a thin upper lid line; the girl adds three little lashes at the
   * outer corner. Still dark-brown eyes (never green), two separate eyes (no joined patch).
   */
  function heroEye(c, x, s, f) {
    c.beginPath();
    c.ellipse(x, EYE_Y, 11, 15, 0, 0, Math.PI * 2);
    c.fillStyle = F.EYE_COLOUR;
    c.fill();
    c.beginPath();
    c.ellipse(x, EYE_Y + 4, 7.5, 8.5, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    c.strokeStyle = "rgba(150,92,52,0.85)";
    c.lineWidth = 3;
    c.stroke();
    h().dot(c, x - 3.5, EYE_Y - 6, 4.2, "#ffffff");
    h().dot(c, x + 3.5, EYE_Y + 5, 1.8, "rgba(255,255,255,0.85)");
    c.beginPath();
    c.ellipse(x, EYE_Y + 1, 13, 17, 0, 1.12 * Math.PI, 1.88 * Math.PI);
    c.strokeStyle = F.INK;
    c.lineWidth = f.lashes ? 4 : 2.6;
    c.stroke();
    if (!f.lashes) return;
    for (let k = 0; k < 3; k += 1) {
      const a = -0.5 - k * 0.32;
      const ex = x + s * (10 + k * 1.5);
      const ey = EYE_Y - 12 + k * 3;
      h().stroke(c, [ex, ey, ex + s * 8 * Math.cos(a + 0.2), ey + 8 * Math.sin(a)], F.INK, 2.6);
    }
  }

  /** Draw both eyes with highlights; kids get larger eyes, and optional lashes. */
  function eyes(c, f) {
    if (f.hero) {
      for (let s = -1; s <= 1; s += 2) heroEye(c, CX + s * 46, s, f);
      return;
    }
    const big = f.kid ? 1.22 : 1;
    const gap = f.kid ? 44 : 46;
    for (let s = -1; s <= 1; s += 2) {
      const x = CX + s * gap;
      c.beginPath();
      c.ellipse(x, EYE_Y, 9.5 * big, 13.5 * big, 0, 0, Math.PI * 2);
      c.fillStyle = F.EYE_COLOUR;
      c.fill();
      h().dot(c, x - 3 * big, EYE_Y - 5 * big, 3.6 * big, "#ffffff");
      h().dot(c, x + 3 * big, EYE_Y + 5 * big, 1.6 * big, "rgba(255,255,255,0.8)");
      if (f.lashes)
        h().stroke(
          c,
          [x + s * 8 * big, EYE_Y - 10 * big, x + s * 15 * big, EYE_Y - 16 * big],
          F.INK,
          3,
        );
      if (f.wrinkles)
        h().stroke(
          c,
          [x + s * 20, EYE_Y - 4, x + s * 28, EYE_Y, x + s * 20, EYE_Y + 6],
          "rgba(90,50,30,0.55)",
          2.4,
        );
    }
  }

  /** The heroes' brows: soft tapered strokes (filled, thick in the middle), gentler for the girl. */
  function heroBrows(c, f) {
    const col = f.browColour || "#3a2416";
    const up = f.lashes ? -3 : 0;
    for (let s = -1; s <= 1; s += 2) {
      const x = CX + s * 46;
      const inner = EYE_Y - 27 + up + (f.focused ? -1 : 2);
      c.beginPath();
      c.moveTo(x - s * 17, inner);
      c.quadraticCurveTo(x, EYE_Y - 41 + up, x + s * 17, EYE_Y - 30 + up);
      c.quadraticCurveTo(x, EYE_Y - 35 + up, x - s * 17, inner + 4);
      c.closePath();
      c.fillStyle = col;
      c.fill();
    }
  }

  /** Draw both eyebrows, thicker or lifted by the face's settings. */
  function brows(c, f) {
    if (f.hero) return heroBrows(c, f);
    const col = f.browColour || F.INK;
    const w = f.thickBrows ? 7 : 4.5;
    const lift = f.kid ? -4 : 0;
    for (let s = -1; s <= 1; s += 2) {
      const x = CX + s * 46;
      c.beginPath();
      c.moveTo(x - s * 16, EYE_Y - 26 + lift + (f.focused ? -2 : 3));
      c.quadraticCurveTo(x, EYE_Y - 38 + lift, x + s * 16, EYE_Y - 30 + lift + (f.focused ? 3 : 0));
      c.strokeStyle = col;
      c.lineWidth = w;
      c.lineCap = "round";
      c.stroke();
    }
  }

  /** Draw the mouth in the face's style (smile by default, grin with teeth, and so on). */
  function mouth(c, f) {
    const kind = f.mouth || "smile";
    c.lineCap = "round";
    if (kind === "grin") {
      c.beginPath();
      c.moveTo(CX - 30, MOUTH_Y - 8);
      c.quadraticCurveTo(CX, MOUTH_Y + 26, CX + 30, MOUTH_Y - 8);
      c.closePath();
      c.fillStyle = "#5b1f1a";
      c.fill();
      h().poly(
        c,
        [CX - 26, MOUTH_Y - 6, CX + 26, MOUTH_Y - 6, CX + 20, MOUTH_Y + 1, CX - 20, MOUTH_Y + 1],
        "#fbfaf6",
      );
      return;
    }
    if (f.hero) return heroSmile(c);
    const w = kind === "calm" ? 16 : 24;
    const dip = kind === "calm" ? 6 : 13;
    c.beginPath();
    c.moveTo(CX - w, MOUTH_Y - 4);
    c.quadraticCurveTo(CX, MOUTH_Y + dip, CX + w, MOUTH_Y - 4);
    c.strokeStyle = "#5b2a1e";
    c.lineWidth = 4.5;
    c.stroke();
  }

  /** The heroes' smile: a small open smile with a rosy lower lip and soft corner dimples. */
  function heroSmile(c) {
    c.beginPath();
    c.moveTo(CX - 24, MOUTH_Y - 6);
    c.quadraticCurveTo(CX, MOUTH_Y + 20, CX + 24, MOUTH_Y - 6);
    c.quadraticCurveTo(CX, MOUTH_Y + 2, CX - 24, MOUTH_Y - 6);
    c.fillStyle = "#6a2420";
    c.fill();
    c.beginPath();
    c.moveTo(CX - 10, MOUTH_Y + 7);
    c.quadraticCurveTo(CX, MOUTH_Y + 12, CX + 10, MOUTH_Y + 7);
    c.strokeStyle = "rgba(232,110,110,0.9)";
    c.lineWidth = 3;
    c.stroke();
    for (let s = -1; s <= 1; s += 2)
      h().stroke(
        c,
        [CX + s * 27, MOUTH_Y - 10, CX + s * 30, MOUTH_Y - 3],
        "rgba(110,60,40,0.5)",
        2.4,
      );
  }

  /** Draw the small nose line. */
  function nose(c) {
    c.beginPath();
    c.moveTo(CX - 6, 124);
    c.quadraticCurveTo(CX, 130, CX + 6, 124);
    c.strokeStyle = "rgba(110,60,40,0.55)";
    c.lineWidth = 3;
    c.stroke();
  }

  /** Draw blush and freckles when the face asks for them. */
  function cheeks(c, f) {
    if (f.blush) {
      for (let s = -1; s <= 1; s += 2) {
        const g = c.createRadialGradient(CX + s * 66, 122, 2, CX + s * 66, 122, 22);
        g.addColorStop(0, "rgba(232,110,110,0.45)");
        g.addColorStop(1, "rgba(232,110,110,0)");
        c.fillStyle = g;
        c.fillRect(CX + s * 66 - 24, 98, 48, 48);
      }
    }
    if (!f.freckles) return;
    const pts = [-70, 112, -60, 120, -76, 124, 62, 114, 72, 120, 58, 124];
    for (let i = 0; i < pts.length; i += 2)
      h().dot(c, CX + pts[i], pts[i + 1], 2.2, "rgba(140,80,50,0.55)");
  }

  /** Draw round-cornered glasses with arms, in the face's frame colour. */
  function glasses(c, f) {
    const col = f.glassesColour || "#3a3a44";
    for (let s = -1; s <= 1; s += 2) {
      c.beginPath();
      c.roundRect(CX + s * 46 - 21, EYE_Y - 18, 42, 36, 12);
      c.strokeStyle = col;
      c.lineWidth = 4;
      c.stroke();
      h().stroke(c, [CX + s * 67, EYE_Y - 8, CX + s * 118, EYE_Y - 12], col, 4);
    }
    h().stroke(c, [CX - 25, EYE_Y - 6, CX, EYE_Y - 10, CX + 25, EYE_Y - 6], col, 4);
  }

  /** Draw a moustache in the face's hair colour. */
  function moustache(c, f) {
    c.beginPath();
    c.moveTo(CX, MOUTH_Y - 16);
    c.quadraticCurveTo(CX - 18, MOUTH_Y - 26, CX - 34, MOUTH_Y - 8);
    c.quadraticCurveTo(CX - 16, MOUTH_Y - 14, CX, MOUTH_Y - 9);
    c.quadraticCurveTo(CX + 16, MOUTH_Y - 14, CX + 34, MOUTH_Y - 8);
    c.quadraticCurveTo(CX + 18, MOUTH_Y - 26, CX, MOUTH_Y - 16);
    c.fillStyle = f.hairColour || F.INK;
    c.fill();
  }

  /** A neat jaw-line beard that frames the mouth (leaves the mouth clear). */
  function beard(c, f) {
    c.beginPath();
    c.moveTo(CX - 92, 104);
    c.quadraticCurveTo(CX - 88, 186, CX, 192);
    c.quadraticCurveTo(CX + 88, 186, CX + 92, 104);
    c.lineTo(CX + 78, 104);
    c.quadraticCurveTo(CX + 66, 160, CX + 30, MOUTH_Y + 2);
    c.quadraticCurveTo(CX, MOUTH_Y + 26, CX - 30, MOUTH_Y + 2);
    c.quadraticCurveTo(CX - 66, 160, CX - 78, 104);
    c.closePath();
    c.fillStyle = f.hairColour || F.INK;
    c.fill();
    // fine print detail: little strands along the edge
    for (let x = -70; x <= 70; x += 14)
      h().stroke(c, [CX + x, 176, CX + x * 0.9, 186], "rgba(255,255,255,0.12)", 2);
  }

  /** Draw a whole face into the atlas face region. */
  F.drawFace = function (ctx, spec, region) {
    const f = spec.face || {};
    ctx.save();
    ctx.translate(region[0], region[1]);
    ctx.fillStyle = spec.skin;
    ctx.fillRect(0, 0, region[2], region[3]);
    cheeks(ctx, f);
    if (f.beard) beard(ctx, f);
    eyes(ctx, f);
    brows(ctx, f);
    nose(ctx);
    if (f.moustache) moustache(ctx, f);
    mouth(ctx, f);
    if (f.glasses) glasses(ctx, f);
    ctx.restore();
  };
})((window.KQ = window.KQ || {}));
