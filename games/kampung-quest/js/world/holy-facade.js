/* ============================================================================
 * FILE: holy-facade.js
 * PURPOSE: Building facades for the Haramain cities (KQ.WorldParts.HolyFacade): three tileable
 *          canvas textures, each with a night-glow twin, one tile = 28.8 m x 28.8 m = 8 floors
 *          (3.6 m) x 16 bays (1.8 m):
 *            hotel      blue curtain-wall glass with spandrels, mullions and cream fins
 *            stoneHotel limestone cladding (the CC0 photo when it can be fetched, drawn joints
 *                       otherwise) with recessed windows, lintels and sills
 *            apartment  painted concrete with balconies, shutters, blinds and air-conditioners
 *          Generic buildings: no brand, no sign, no lettering.
 * BUSINESS CONTEXT: owner feedback "Makkah outside the Haram should look like the real city:
 *   better textures, better models". The old facade was one flat 8 x 8 window grid.
 * DEPENDENCIES: canvas.js (canvas, tex), textures.js (Tex.image), geo.js (rng).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const FLOORS = 8;
  const BAYS = 16;
  /** Metres one texture repeat covers (used by HolyKit.UV). */
  const TILE = 28.8;
  const SIZE = 1024;
  const GLOW_SIZE = 512;

  /** Which windows are lit at night, plus a small variant number per window (blind colour, shutter). */
  function cells(seed) {
    const r = P.rng(seed);
    const out = [];
    for (let f = 0; f < FLOORS; f += 1) {
      const row = [];
      for (let b = 0; b < BAYS; b += 1) row.push({ lit: r() < 0.36, v: Math.floor(r() * 4) });
      out.push(row);
    }
    return out;
  }

  /** The window rectangle of floor `f` (0 = top row of the canvas), bay `b`, in canvas pixels for `size`. */
  function winRect(style, f, b, size) {
    const bw = size / BAYS;
    const fh = size / FLOORS;
    const w = style === "hotel" ? bw * 0.86 : bw * 0.62;
    const h = style === "hotel" ? fh * 0.56 : fh * 0.5;
    const y = f * fh + (style === "hotel" ? fh * 0.3 : fh * 0.22);
    return { x: b * bw + (bw - w) / 2, y, w, h };
  }

  /** Vertical sky-reflection gradient used for glass. */
  function glassFill(g, r, v) {
    const k = [0, 0.1, -0.08, 0.05][v];
    const grad = g.createLinearGradient(0, r.y, 0, r.y + r.h);
    grad.addColorStop(0, shade([172, 206, 226], k));
    grad.addColorStop(1, shade([38, 72, 92], k));
    g.fillStyle = grad;
    g.fillRect(r.x, r.y, r.w, r.h);
  }

  /** "rgb()" string of a base colour lightened or darkened by `k` (-1..1). */
  function shade(c, k) {
    const f = (n) => Math.max(0, Math.min(255, Math.round(n + (k > 0 ? (255 - n) * k : n * k))));
    return "rgb(" + f(c[0]) + "," + f(c[1]) + "," + f(c[2]) + ")";
  }

  /* ------------------------------ glass tower ------------------------------ */

  /** Curtain wall: cream panels, a continuous glass band per floor, mullions and a few fins. */
  function drawHotel(g, size, cl) {
    const bw = size / BAYS;
    const fh = size / FLOORS;
    g.fillStyle = "#d9d5c9";
    g.fillRect(0, 0, size, size);
    for (let f = 0; f < FLOORS; f += 1) {
      g.fillStyle = "#9fb0ba";
      g.fillRect(0, f * fh + fh * 0.86, size, fh * 0.14);
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(0, f * fh + fh * 0.86, size, 2);
      for (let b = 0; b < BAYS; b += 1) glassFill(g, winRect("hotel", f, b, size), cl[f][b].v);
    }
    g.fillStyle = "#f3efe3";
    for (let b = 0; b < BAYS; b += 1) g.fillRect(b * bw - 2, 0, b % 4 === 0 ? 8 : 3, size);
    sunStreaks(g, size);
  }

  /** Two soft diagonal highlights across the whole tile, like sun on glass. */
  function sunStreaks(g, size) {
    g.save();
    g.globalAlpha = 0.1;
    g.fillStyle = "#ffffff";
    [0.12, 0.55].forEach((x) => {
      g.beginPath();
      g.moveTo(size * x, 0);
      g.lineTo(size * (x + 0.08), 0);
      g.lineTo(size * (x - 0.2), size);
      g.lineTo(size * (x - 0.28), size);
      g.closePath();
      g.fill();
    });
    g.restore();
  }

  /* ------------------------------ limestone ------------------------------ */

  /** Stone base: the photo tiled four by four, washed towards cream, or hand-drawn joints. */
  function stoneBase(g, size, img) {
    g.fillStyle = "#e4d6b8";
    g.fillRect(0, 0, size, size);
    if (img) {
      const t = size / 4;
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 4; x += 1) g.drawImage(img, x * t, y * t, t, t);
      }
      g.globalAlpha = 0.4;
      g.fillStyle = "#ead9b0";
      g.fillRect(0, 0, size, size);
      g.globalAlpha = 1;
      return;
    }
    g.fillStyle = "rgba(120,100,70,0.28)";
    for (let y = 0; y < size; y += 32) {
      g.fillRect(0, y, size, 2);
      for (let x = (y / 32) % 2 ? 0 : 48; x < size; x += 96) g.fillRect(x, y, 2, 32);
    }
  }

  /** One recessed stone window: lighter surround, sill, glass, mullions and an inner top shadow. */
  function stoneWindow(g, r, v) {
    g.fillStyle = "rgba(255,248,230,0.7)";
    g.fillRect(r.x - 7, r.y - 9, r.w + 14, r.h + 14);
    g.fillStyle = "rgba(90,70,40,0.35)";
    g.fillRect(r.x - 7, r.y + r.h + 5, r.w + 14, 3);
    g.fillStyle = "#34414a";
    g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    glassFill(g, r, v);
    g.fillStyle = "rgba(0,0,0,0.38)";
    g.fillRect(r.x, r.y, r.w, 6);
    g.fillStyle = "#3d4a52";
    g.fillRect(r.x + r.w / 2 - 1.5, r.y, 3, r.h);
    g.fillRect(r.x, r.y + r.h * 0.38, r.w, 3);
  }

  /** Limestone cladding with a window in every bay of every floor and a cornice line per floor. */
  function drawStone(g, size, cl, img) {
    stoneBase(g, size, img);
    const fh = size / FLOORS;
    for (let f = 0; f < FLOORS; f += 1) {
      g.fillStyle = "rgba(255,250,236,0.55)";
      g.fillRect(0, f * fh, size, 5);
      g.fillStyle = "rgba(80,62,36,0.3)";
      g.fillRect(0, f * fh + 5, size, 3);
      for (let b = 0; b < BAYS; b += 1) stoneWindow(g, winRect("stone", f, b, size), cl[f][b].v);
    }
  }

  /* ------------------------------ apartments ------------------------------ */

  const WALL = ["#e8dcc2", "#e2d2b0"];
  const SHUTTER = ["#7b5a3a", "#3f7a58", "#a9a395", "#6a4a2e"];

  /** Soft stains on the wall so large flat areas are not one colour. */
  function stains(g, size) {
    const r = P.rng(8821);
    for (let i = 0; i < 90; i += 1) {
      g.fillStyle = r() < 0.5 ? "rgba(120,96,60,0.07)" : "rgba(255,255,255,0.06)";
      g.fillRect(r() * size, r() * size, 40 + r() * 160, 20 + r() * 90);
    }
  }

  /** One apartment window with its frame, shutter or blind, and (some floors) a balcony and an air-conditioner. */
  function aptWindow(g, r, v, balcony) {
    g.fillStyle = "#f4efe4";
    g.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    glassFill(g, r, v);
    g.fillStyle = SHUTTER[v];
    if (v % 2 === 0) g.fillRect(r.x - 10, r.y - 4, 10, r.h + 8);
    if (v === 1) g.fillRect(r.x, r.y, r.w, r.h * 0.45);
    if (!balcony) return;
    g.fillStyle = "#cdbf9f";
    g.fillRect(r.x - 12, r.y + r.h + 4, r.w + 24, 8);
    g.fillStyle = "rgba(70,60,45,0.55)";
    for (let x = r.x - 10; x < r.x + r.w + 12; x += 7) g.fillRect(x, r.y + r.h - 16, 2, 20);
    if (v === 3) {
      g.fillStyle = "#b9bdc0";
      g.fillRect(r.x + r.w + 6, r.y + r.h * 0.1, 18, 14);
    }
  }

  /** Painted apartment blocks. */
  function drawApartment(g, size, cl) {
    g.fillStyle = WALL[0];
    g.fillRect(0, 0, size, size);
    stains(g, size);
    const fh = size / FLOORS;
    for (let f = 0; f < FLOORS; f += 1) {
      g.fillStyle = "rgba(255,255,255,0.4)";
      g.fillRect(0, f * fh, size, 4);
      for (let b = 0; b < BAYS; b += 1) {
        aptWindow(g, winRect("apt", f, b, size), cl[f][b].v, f % 2 === 1);
      }
    }
  }

  /* ------------------------------ night twins and materials ------------------------------ */

  /** Emissive twin: black with the lit windows in warm lamp colours (a few cool TV-blue). */
  function drawGlow(g, size, cl, style) {
    g.fillStyle = "#000";
    g.fillRect(0, 0, size, size);
    for (let f = 0; f < FLOORS; f += 1) {
      for (let b = 0; b < BAYS; b += 1) {
        if (!cl[f][b].lit) continue;
        const r = winRect(style, f, b, size);
        g.fillStyle = cl[f][b].v === 2 ? "#b9d4ff" : "#ffd08a";
        g.fillRect(r.x, r.y, r.w, r.h);
      }
    }
  }

  const STYLES = {
    hotel: { seed: 515, draw: (g, s, c) => drawHotel(g, s, c), rough: 0.35, metal: 0.45 },
    stoneHotel: {
      seed: 733,
      draw: (g, s, c, img) => drawStone(g, s, c, img),
      rough: 0.85,
      metal: 0,
      photo: "limestone.jpg",
      glowAs: "stone",
    },
    apartment: {
      seed: 902,
      draw: (g, s, c) => drawApartment(g, s, c),
      rough: 0.9,
      metal: 0,
      glowAs: "apt",
    },
  };

  /** Make one facade material (colour + glow map) for `name`; redraws when the stone photo arrives. */
  function material(name) {
    const st = STYLES[name];
    const cl = cells(st.seed);
    const col = P.Canvas.canvas(SIZE, SIZE);
    const glow = P.Canvas.canvas(GLOW_SIZE, GLOW_SIZE);
    st.draw(col.getContext("2d"), SIZE, cl, null);
    drawGlow(glow.getContext("2d"), GLOW_SIZE, cl, st.glowAs || "hotel");
    const map = P.Canvas.tex(col, true, true);
    const emissiveMap = P.Canvas.tex(glow, true, true);
    if (st.photo) {
      P.Tex.image(st.photo, (img) => {
        st.draw(col.getContext("2d"), SIZE, cl, img);
        map.needsUpdate = true;
      });
    }
    return new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      emissive: 0xffffff,
      emissiveIntensity: 0,
      vertexColors: true,
      roughness: st.rough,
      metalness: st.metal,
      envMapIntensity: name === "hotel" ? 0.9 : 0.5,
    });
  }

  /** The three facade materials, keyed hotel / stoneHotel / apartment. */
  function materials() {
    return {
      hotel: material("hotel"),
      stoneHotel: material("stoneHotel"),
      apartment: material("apartment"),
    };
  }

  P.HolyFacade = { materials, TILE, STYLE_NAMES: Object.keys(STYLES) };
})((window.KQ = window.KQ || {}));
