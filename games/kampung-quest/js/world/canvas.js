/* Kampung Quest — procedural canvas textures that are always generated (no files needed):
   the sign atlas (shop boards, block numbers, HALAL labels, letterboxes), HDB window/door
   atlas (+ roughness and night-glow twins), railings, prayer carpet, leaves, barber pole,
   mihrab tilework and library book spines. Works identically on file:// and http(s). */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});

  /** Create a blank w x h canvas for procedural textures. */
  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  /**
   * Wrap a canvas as a THREE texture (sRGB for colour maps, linear for data maps), optionally
   * repeating, at the quality's anisotropy.
   */
  function tex(c, srgb, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
    t.anisotropy = P.Tex.anisotropy;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  /* ---------- sign atlas (shelf packer) ---------- */
  /**
   * A sign atlas: one shared canvas texture with a shelf packer (alloc) that hands out slots for signs and letters.
   */
  function Atlas(size) {
    this.c = canvas(size, size);
    this.ctx = this.c.getContext("2d");
    this.size = size;
    this.x = 0;
    this.y = 0;
    this.rowH = 0;
    this.texture = tex(this.c, true);
  }
  /** Reserve a w×h pixel slot; returns {x,y,w,h,uv:[u0,v0,u1,v1]}. */
  Atlas.prototype.alloc = function (w, h) {
    if (this.x + w > this.size) (this.x = 0), (this.y += this.rowH + 2), (this.rowH = 0);
    const s = { x: this.x, y: this.y, w, h };
    this.x += w + 2;
    this.rowH = Math.max(this.rowH, h);
    const S = this.size;
    s.uv = [s.x / S, 1 - (s.y + h) / S, (s.x + w) / S, 1 - s.y / S];
    return s;
  };

  /** Fit text into a box, shrinking the font until it fits. */
  function fitText(ctx, text, x, y, maxW, px, weight) {
    let size = px;
    do {
      ctx.font = `${weight || 800} ${size}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
      size -= 2;
    } while (ctx.measureText(text).width > maxW && size > 8);
    ctx.fillText(text, x, y);
  }

  /** A green generic "HALAL" text label (not any certification mark). */
  function halalBadge(ctx, x, y, h) {
    const w = h * 2.6;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = "#13803a";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, "HALAL", x + w / 2, y + h / 2 + 1, w - 8, h * 0.62, 900);
  }

  /** Shop/stall signboard: bg colour, big title, optional sub line and HALAL label. */
  Atlas.prototype.sign = function (o) {
    const s = this.alloc(Math.round(o.w * 110), Math.round(o.h * 110));
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
    g.addColorStop(0, o.bg);
    g.addColorStop(1, o.bg2 || o.bg);
    ctx.fillStyle = g;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = o.edge || "rgba(255,255,255,0.7)";
    ctx.lineWidth = 4;
    ctx.strokeRect(s.x + 4, s.y + 4, s.w - 8, s.h - 8);
    ctx.fillStyle = o.fg || "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textW = s.w - (o.halal ? s.h * 1.9 : 0) - 24;
    const cx = s.x + 12 + textW / 2;
    const ty = s.y + s.h * (o.sub ? 0.4 : 0.52);
    fitText(ctx, o.text, cx, ty, textW, s.h * (o.sub ? 0.46 : 0.6));
    if (o.sub) fitText(ctx, o.sub, cx, s.y + s.h * 0.78, textW, s.h * 0.22, 700);
    if (o.halal) halalBadge(ctx, s.x + s.w - s.h * 1.75, s.y + s.h * 0.3, s.h * 0.4);
    return s.uv;
  };

  /** Painted HDB block number (big coloured digits, transparent-looking on wall colour). */
  Atlas.prototype.blockNumber = function (text, colour, wall) {
    const s = this.alloc(260, 200);
    const ctx = this.ctx;
    ctx.fillStyle = wall;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = colour;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, text, s.x + s.w / 2, s.y + s.h / 2 + 8, s.w - 20, 180, 900);
    return s.uv;
  };

  /** A wall of HDB letterboxes (grey-blue doors with number tags). */
  Atlas.prototype.letterboxes = function () {
    const s = this.alloc(480, 240);
    const ctx = this.ctx;
    ctx.fillStyle = "#59636b";
    ctx.fillRect(s.x, s.y, s.w, s.h);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 12; c++) {
        const x = s.x + 6 + c * 39;
        const y = s.y + 6 + r * 38;
        ctx.fillStyle = (r + c) % 5 === 0 ? "#8f9aa3" : "#a9b4bc";
        ctx.fillRect(x, y, 35, 34);
        ctx.fillStyle = "#2c3338";
        ctx.fillRect(x + 6, y + 6, 23, 3);
        ctx.fillStyle = "#f4f4f0";
        ctx.fillRect(x + 10, y + 20, 15, 8);
      }
    }
    return s.uv;
  };

  /** A plain coloured panel with a short label (notice boards, bus stop plate, etc.). */
  Atlas.prototype.panel = function (o) {
    return this.sign(Object.assign({ edge: "rgba(0,0,0,0.15)" }, o));
  };

  P.Canvas = { canvas, tex, Atlas, fitText };
})((window.KQ = window.KQ || {}));
