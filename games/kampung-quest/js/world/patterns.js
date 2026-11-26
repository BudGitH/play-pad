/* Kampung Quest — repeating procedural patterns: HDB windows + flat doors (colour, roughness
   and night-glow twins share one layout), corridor railing, prayer-hall carpet, leaf canopy,
   barber pole, mihrab tilework and library book spines. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const C = () => P.Canvas;

  const CURTAINS = [
    "#e9dcc0",
    "#c7d9e6",
    "#f0c9b8",
    "#d8e7c9",
    "#efe6d4",
    "#bfc8e0",
    "#f4f0e6",
    "#e4c7d8",
  ];
  const CELL = 128;

  /** One window cell (variant v) drawn for a given pass: 'col' | 'rough' | 'glow'. */
  function windowCell(ctx, x, y, v, pass) {
    const frame = pass === "col" ? "#eef0ee" : pass === "rough" ? "#9a9a9a" : "#000";
    ctx.fillStyle = frame;
    ctx.fillRect(x, y, CELL, CELL);
    const panes = 3 + (v % 2);
    const pw = (CELL - 12) / panes;
    const cover = 0.25 + ((v * 37) % 60) / 100;
    for (let i = 0; i < panes; i++) {
      const px = x + 6 + i * pw;
      if (pass === "col") paneColour(ctx, px, y + 8, pw - 4, CELL - 16, v, cover, i);
      else if (pass === "rough")
        (ctx.fillStyle = "#262626"), ctx.fillRect(px, y + 8, pw - 4, CELL - 16);
      else paneGlow(ctx, px, y + 8, pw - 4, CELL - 16, v, cover);
    }
    ctx.fillStyle = frame;
    ctx.fillRect(x, y + CELL * 0.3, CELL, 4);
  }
  function paneColour(ctx, x, y, w, h, v, cover, i) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#5f7486");
    g.addColorStop(0.6, "#2c3a47");
    g.addColorStop(1, "#46596a");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = CURTAINS[v % CURTAINS.length];
    ctx.globalAlpha = 0.85;
    if (v % 3 !== 2) ctx.fillRect(x, y, w, h * cover);
    else if (i % 2 === 0) ctx.fillRect(x, y, w * 0.7, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x + w * 0.15, y + 2, w * 0.12, h - 4);
  }
  /* Night glow per variant: warm bulbs, neutral LED, cool fluorescent, TV-blue; some curtained
     (curtain colour tints and dims the glow), some with blinds (bright slats). */
  const GLOWS = [
    "#ffd49a",
    "#fff0d6",
    "#d2e4ff",
    "#ffc37a",
    "#ffe2b4",
    "#c9dcff",
    "#ffb98a",
    "#f6e9cc",
  ];
  function paneGlow(ctx, x, y, w, h, v, cover) {
    ctx.fillStyle = GLOWS[v % GLOWS.length];
    ctx.fillRect(x, y, w, h);
    if (v % 3 === 0) {
      ctx.fillStyle = "rgba(120,60,40,0.45)"; // drawn curtain: dimmer, tinted
      ctx.fillRect(x, y, w, h);
    }
    if (v % 4 === 1) {
      ctx.fillStyle = "rgba(0,0,0,0.5)"; // blinds
      for (let k = y; k < y + h; k += 7) ctx.fillRect(x, k, w, 3);
    }
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    if (v % 3 !== 2) ctx.fillRect(x, y, w, h * cover * 0.5);
    else ctx.fillRect(x + w * 0.55, y, w * 0.45, h);
  }

  /** A flat main door + metal gate (cell variant 8..11). */
  function doorCell(ctx, x, y, v, pass) {
    const wood = ["#7a4b2a", "#a8734a", "#5b3a26", "#c49a6c"][v % 4];
    ctx.fillStyle = pass === "col" ? "#d9d6cf" : pass === "rough" ? "#b0b0b0" : "#000";
    ctx.fillRect(x, y, CELL, CELL);
    if (pass === "glow") return;
    ctx.fillStyle = pass === "col" ? wood : "#8a8a8a";
    ctx.fillRect(x + 10, y + 6, CELL * 0.62, CELL - 6);
    if (pass !== "col") return;
    ctx.strokeStyle = "#3a3f44";
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) ctx.strokeRect(x + 12 + i * 12, y + 8, 2, CELL - 10);
    ctx.fillStyle = "#c8a646";
    ctx.fillRect(x + CELL * 0.62, y + CELL * 0.55, 5, 5);
    ctx.fillStyle = "#3e8a46";
    ctx.fillRect(x + CELL * 0.8, y + CELL * 0.7, 18, 30);
  }

  /** Build the window atlas twins: 8 window variants (row 0..1) + 4 door variants (row 2). */
  function windows() {
    const out = {};
    ["col", "rough", "glow"].forEach((pass) => {
      const c = C().canvas(CELL * 4, CELL * 4);
      const ctx = c.getContext("2d");
      for (let v = 0; v < 8; v++)
        windowCell(ctx, (v % 4) * CELL, Math.floor(v / 4) * CELL, v, pass);
      for (let v = 0; v < 4; v++) doorCell(ctx, v * CELL, 2 * CELL, v, pass);
      out[pass] = C().tex(c, pass !== "rough");
    });
    out.uv = (cell) => {
      const cx = cell % 4;
      const cy = Math.floor(cell / 4);
      return [cx / 4 + 0.004, 1 - (cy + 1) / 4 + 0.004, (cx + 1) / 4 - 0.004, 1 - cy / 4 - 0.004];
    };
    return out;
  }

  /** Corridor/fence railing (alpha-tested): rails top+bottom, balusters every 1/8. */
  function railing() {
    const c = C().canvas(128, 128);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 128, 12);
    ctx.fillRect(0, 116, 128, 12);
    for (let i = 0; i < 8; i++) ctx.fillRect(i * 16 + 6, 0, 4, 128);
    return C().tex(c, true, true);
  }

  /** Prayer-hall carpet: rows of green prayer mats with gold-edged arches pointing to u=0. */
  function carpet() {
    const c = C().canvas(256, 192);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#1f5c3c";
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = "#2c7a4f";
    ctx.fillRect(12, 10, 232, 172);
    ctx.strokeStyle = "#d8b45a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(240, 24);
    ctx.lineTo(90, 24);
    ctx.quadraticCurveTo(14, 96, 90, 168);
    ctx.lineTo(240, 168);
    ctx.stroke();
    ctx.fillStyle = "#7a1f2a";
    ctx.fillRect(244, 0, 12, 192);
    ctx.fillStyle = "rgba(216,180,90,0.55)";
    for (let i = 0; i < 5; i++) ctx.fillRect(130 + i * 18, 88, 8, 16);
    return C().tex(c, true, true);
  }

  /** Leafy canopy: dark-to-light green clumps (used with world/instance UVs on blobs). */
  function leaves() {
    const c = C().canvas(256, 256);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#3f6a2a";
    ctx.fillRect(0, 0, 256, 256);
    const r = P.rng(99);
    const greens = ["#2d5220", "#4f7f2f", "#6a9a3a", "#365f25", "#88b04a", "#25451a"];
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = greens[Math.floor(r() * greens.length)];
      ctx.beginPath();
      ctx.ellipse(r() * 256, r() * 256, 2 + r() * 5, 1 + r() * 3, r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    return C().tex(c, true, true);
  }

  /** Barber pole stripes (scrolled via texture offset). */
  function barber() {
    const c = C().canvas(64, 128);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 64, 128);
    const cols = ["#d7262e", "#ffffff", "#1d4fa8", "#ffffff"];
    for (let i = -4; i < 12; i++) {
      ctx.fillStyle = cols[((i % 4) + 4) % 4];
      ctx.beginPath();
      ctx.moveTo(0, i * 16);
      ctx.lineTo(64, i * 16 - 32);
      ctx.lineTo(64, i * 16 - 16);
      ctx.lineTo(0, i * 16 + 16);
      ctx.fill();
    }
    return C().tex(c, true, true);
  }

  /** Eight-point-star geometric tilework (mihrab, mosque dado). */
  function tilework() {
    const c = C().canvas(128, 128);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#f4efe2";
    ctx.fillRect(0, 0, 128, 128);
    ctx.translate(64, 64);
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = k ? "#1f7a74" : "#d6aa45";
      ctx.save();
      ctx.rotate((k * Math.PI) / 4);
      ctx.fillRect(-34 + k * 8, -34 + k * 8, 68 - k * 16, 68 - k * 16);
      ctx.restore();
    }
    ctx.fillStyle = "#f4efe2";
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = "#1f4f6e";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 125, 125);
    return C().tex(c, true, true);
  }

  /** Library shelf: rows of book spines. */
  function books() {
    const c = C().canvas(256, 256);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(0, 0, 256, 256);
    const r = P.rng(7);
    const cols = [
      "#b23a3a",
      "#2f5d8a",
      "#e0b84a",
      "#3f7f4f",
      "#efe6d0",
      "#7d4f9a",
      "#d9773a",
      "#26323f",
    ];
    for (let row = 0; row < 4; row++) {
      let x = 4;
      while (x < 250) {
        const w = 5 + r() * 9;
        const h = 44 + r() * 14;
        ctx.fillStyle = cols[Math.floor(r() * cols.length)];
        ctx.fillRect(x, row * 64 + 60 - h, w - 1, h);
        x += w;
      }
      ctx.fillStyle = "#4e3420";
      ctx.fillRect(0, row * 64 + 58, 256, 6);
    }
    return C().tex(c, true, true);
  }

  /** Glossy white wall tiles with grey grout (wudu wall, stall backs). */
  function wallTiles() {
    const c = C().canvas(128, 128);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#b9bfc2";
    ctx.fillRect(0, 0, 128, 128);
    const r = P.rng(11);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = 236 + Math.floor(r() * 14);
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 3})`;
        ctx.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
      }
    }
    return C().tex(c, true, true);
  }

  P.Patterns = { windows, railing, carpet, leaves, barber, tilework, books, wallTiles, CELL };
})((window.KQ = window.KQ || {}));
