/* Kampung Quest — realism-pass canvases (KQ.WorldParts.Patterns3): the mosque's geometric
   lattice screen (jali, arch-shaped alpha), the abstract geometric frieze band (interlaced
   eight-point rosettes — deliberately NO lettering or real text), a woven prayer-carpet design,
   the void-deck notice board, hazy distant HDB facades, and the lamp halo. All procedural, so
   they work on file:// too. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const C = () => P.Canvas;

  /** Eight-point star (two overlapping squares) path centred at (x, y), radius r. */
  function star8(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 + Math.PI / 8;
      const k = i % 2 === 0 ? r : r * 0.72;
      ctx[i ? "lineTo" : "moveTo"](x + Math.cos(a) * k, y + Math.sin(a) * k);
    }
    ctx.closePath();
  }

  /** Arched lattice screen: white strapwork of 8-point stars, alpha outside the arch. */
  function lattice() {
    const c = C().canvas(128, 264);
    const ctx = c.getContext("2d");
    const hw = 64;
    const spring = 264 - (2.5 / 3.3) * 264;
    ctx.beginPath();
    ctx.moveTo(0, 264);
    ctx.lineTo(0, spring);
    ctx.arc(hw, spring, hw, Math.PI, 0);
    ctx.lineTo(128, 264);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    for (let y = 8; y < 280; y += 32) {
      for (let x = (y / 32) % 2 ? 16 : 0; x < 150; x += 32) {
        star8(ctx, x, y, 15);
        ctx.stroke();
      }
    }
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(3, 264);
    ctx.lineTo(3, spring);
    ctx.arc(hw, spring, hw - 3, Math.PI, 0);
    ctx.lineTo(125, 264);
    ctx.stroke();
    return C().tex(c, true);
  }

  /** Square frieze tile: teal ground, gold rosette, interlaced ribbon, border lines. */
  function frieze() {
    const c = C().canvas(128, 128);
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "#1c615c");
    g.addColorStop(0.5, "#23716a");
    g.addColorStop(1, "#1c615c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#cfae62";
    ctx.fillRect(0, 6, 128, 6);
    ctx.fillRect(0, 116, 128, 6);
    ctx.strokeStyle = "#d8b86a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-10, 64);
    ctx.bezierCurveTo(30, 22, 34, 22, 64, 40);
    ctx.bezierCurveTo(94, 22, 98, 22, 138, 64);
    ctx.moveTo(-10, 64);
    ctx.bezierCurveTo(30, 106, 34, 106, 64, 88);
    ctx.bezierCurveTo(94, 106, 98, 106, 138, 64);
    ctx.stroke();
    star8(ctx, 64, 64, 26);
    ctx.fillStyle = "#d8b86a";
    ctx.fill();
    star8(ctx, 64, 64, 15);
    ctx.fillStyle = "#1c615c";
    ctx.fill();
    star8(ctx, 64, 64, 7);
    ctx.fillStyle = "#e9d3a0";
    ctx.fill();
    return C().tex(c, true, true);
  }

  /** One prayer-mat cell: arch pointing to u = 0 (the qibla), border, star medallion. */
  function carpet() {
    const c = C().canvas(512, 352);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#1f4f3a";
    ctx.fillRect(0, 0, 512, 352);
    ctx.fillStyle = "#6e1f26";
    ctx.fillRect(488, 0, 24, 352);
    ctx.fillStyle = "#285f46";
    ctx.fillRect(18, 16, 462, 320);
    carpetBorder(ctx);
    ctx.beginPath();
    ctx.moveTo(470, 46);
    ctx.lineTo(170, 46);
    ctx.bezierCurveTo(40, 60, 40, 292, 170, 306);
    ctx.lineTo(470, 306);
    ctx.closePath();
    ctx.fillStyle = "#2f6b50";
    ctx.fill();
    ctx.strokeStyle = "#c9a85c";
    ctx.lineWidth = 7;
    ctx.stroke();
    star8(ctx, 190, 176, 44);
    ctx.fillStyle = "#b8975a";
    ctx.fill();
    star8(ctx, 190, 176, 24);
    ctx.fillStyle = "#6e1f26";
    ctx.fill();
    ctx.fillStyle = "rgba(201,168,92,0.7)";
    for (let i = 0; i < 4; i++) star8(ctx, 330 + i * 38, 176, 9), ctx.fill();
    return C().tex(c, true, true);
  }
  /** Draw the prayer carpet's frame and gold border beads. */
  function carpetBorder(ctx) {
    ctx.strokeStyle = "#b8975a";
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 22, 450, 308);
    ctx.fillStyle = "rgba(201,168,92,0.75)";
    for (let x = 40; x < 470; x += 22) {
      ctx.fillRect(x, 27, 8, 8);
      ctx.fillRect(x, 317, 8, 8);
    }
  }

  /** Hazy distant HDB slab facade: corridor bands, window rows, a coloured gable band. */
  function farFacade() {
    const out = {};
    ["col", "glow"].forEach((pass) => {
      const c = C().canvas(256, 256);
      const ctx = c.getContext("2d");
      const r = P.rng(81);
      ctx.fillStyle = pass === "col" ? "#d9d5cc" : "#000";
      ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 16) farFloor(ctx, y, r, pass);
      if (pass === "col") {
        ctx.fillStyle = "#9aa9a6";
        ctx.fillRect(0, 0, 14, 256);
        ctx.fillStyle = "#c9c4ba";
        ctx.fillRect(118, 0, 20, 256);
      }
      out[pass] = C().tex(c, true, true);
    });
    return out;
  }
  /**
   * Draw one row of tiny far-away windows for the distant skyline (colour pass or emissive pass).
   */
  function farFloor(ctx, y, r, pass) {
    if (pass === "col") {
      ctx.fillStyle = "#eeebe4";
      ctx.fillRect(0, y + 11, 256, 3);
    }
    for (let x = 18; x < 250; x += 12) {
      if (x > 112 && x < 140) continue;
      const lit = r() < 0.32;
      const warm = r() < 0.75;
      if (pass === "col") ctx.fillStyle = r() < 0.15 ? "#8a8f8c" : "#6c7880";
      else ctx.fillStyle = lit ? (warm ? "#ffd393" : "#cfe0ff") : "#000";
      ctx.fillRect(x, y + 3, 8, 7);
    }
  }

  /** Round soft halo for lamp glow sprites. */
  function halo() {
    const c = C().canvas(64, 64);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,236,200,1)");
    g.addColorStop(0.18, "rgba(255,214,150,0.55)");
    g.addColorStop(0.5, "rgba(255,190,120,0.12)");
    g.addColorStop(1, "rgba(255,180,110,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return C().tex(c, true);
  }

  P.Patterns3 = { lattice, frieze, carpet, farFacade, halo, star8 };
})((window.KQ = window.KQ || {}));
