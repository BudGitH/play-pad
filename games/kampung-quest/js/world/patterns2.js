/* Kampung Quest — detail-layer canvases (KQ.WorldParts.Patterns2): soft contact-shadow blob,
   road/kerb grime, facade rain streaks, alpha leaf cards, a distant-skyline facade and a
   steam puff. All procedural, so they work on file:// too. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const C = () => P.Canvas;

  /** Rounded-rectangle soft shadow (alpha in the red channel is not needed: drawn black). */
  function blob() {
    const c = C().canvas(128, 128);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,0.62)");
    g.addColorStop(0.45, "rgba(0,0,0,0.42)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return C().tex(c, true);
  }

  /** Blotchy dark grime with soft alpha (tyre wear, patches, kerb dirt, damp). */
  function grime() {
    const c = C().canvas(256, 256);
    const ctx = c.getContext("2d");
    const n = P.Tex.valueNoise(77);
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const v = n(x / 18, y / 18) * 0.6 + n(x / 5, y / 5) * 0.4;
        const edge = Math.min(x, y, 255 - x, 255 - y) / 40;
        const i = (y * 256 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 20 + v * 25;
        img.data[i + 3] = Math.max(0, Math.min(1, edge)) * (60 + v * 140);
      }
    }
    ctx.putImageData(img, 0, 0);
    return C().tex(c, true);
  }

  /** Vertical rain streaks fading downwards (under ledges, AC units, parapets). */
  function streaks() {
    const c = C().canvas(128, 256);
    const ctx = c.getContext("2d");
    const r = P.rng(5);
    for (let i = 0; i < 40; i++) {
      const x = r() * 128;
      const w = 1 + r() * 4;
      const len = 60 + r() * 190;
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(40,38,34,${0.35 + r() * 0.3})`);
      g.addColorStop(1, "rgba(40,38,34,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, w, len);
    }
    return C().tex(c, true);
  }

  /** Alpha leaf cluster card (several leaflets, rain-tree style). */
  function leafCard() {
    const c = C().canvas(256, 256);
    const ctx = c.getContext("2d");
    const r = P.rng(31);
    const greens = ["#2f5a22", "#3f7029", "#56893a", "#6c9c45", "#284b1c", "#82ad52"];
    for (let i = 0; i < 520; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 112;
      ctx.save();
      ctx.translate(128 + Math.cos(a) * d, 128 + Math.sin(a) * d);
      ctx.rotate(r() * Math.PI);
      ctx.fillStyle = greens[Math.floor(r() * greens.length)];
      ctx.beginPath();
      ctx.ellipse(0, 0, 5 + r() * 6, 2.5 + r() * 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return C().tex(c, true);
  }

  /** Distant tower facade: window grid (colour) + a night-glow twin. */
  function skyline() {
    const out = {};
    ["col", "glow"].forEach((pass) => {
      const c = C().canvas(128, 256);
      const ctx = c.getContext("2d");
      const r = P.rng(8);
      ctx.fillStyle = pass === "col" ? "#d8d4cc" : "#000";
      ctx.fillRect(0, 0, 128, 256);
      for (let y = 4; y < 256; y += 10) {
        for (let x = 4; x < 124; x += 12) {
          const lit = r() < 0.35;
          ctx.fillStyle = pass === "col" ? "#5c6874" : lit ? "#ffd89a" : "#000";
          ctx.fillRect(x, y, 8, 6);
        }
      }
      out[pass] = C().tex(c, true, true);
    });
    return out;
  }

  /** Soft white puff for steam sprites. */
  function puff() {
    const c = C().canvas(64, 64);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return C().tex(c, true);
  }

  P.Patterns2 = { blob, grime, streaks, leafCard, skyline, puff };
})((window.KQ = window.KQ || {}));
