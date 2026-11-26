/* Kampung Quest — photographic PBR textures with procedural fallbacks (KQ.WorldParts.Tex).
   Over http(s) the CC0 ambientCG photo sets in assets/textures/ are loaded (see
   assets/CREDITS.md). Under file:// Chrome blocks image uploads to WebGL, so every set has a
   procedural CanvasTexture stand-in drawn from seeded noise (docs/LEARNINGS.md, PLAY-007). */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});

  /** Photo sets: file stem → which extra maps exist, plus the fallback recipe. */
  const SETS = {
    asphalt: { n: true, r: true, fb: { base: [74, 74, 76], amp: 34, speck: 0.5 } },
    paving: {
      n: true,
      fb: { base: [196, 188, 172], amp: 22, grid: [4, 4], grout: [130, 124, 112] },
    },
    plaster: { n: true, fb: { base: [236, 234, 228], amp: 10, speck: 0.05 } },
    grass: { n: true, fb: { base: [86, 120, 48], amp: 46, speck: 0.6, blades: true } },
    concrete: { n: true, fb: { base: [176, 174, 168], amp: 20, speck: 0.2 } },
    tiles: {
      n: true,
      fb: { base: [214, 196, 168], amp: 18, grid: [2, 2], grout: [160, 150, 136] },
    },
    marble: { n: true, fb: { base: [222, 224, 228], amp: 12, veins: true } },
    roof: { n: true, fb: { base: [178, 92, 58], amp: 26, grid: [8, 8], grout: [120, 60, 40] } },
    rubber: { n: true, fb: { base: [210, 210, 210], amp: 30, speck: 0.7 } },
    carpet: { colour: false, n: true, fb: null },
    bark: { n: true, fb: { base: [104, 92, 70], amp: 40, streaks: true } },
    terrazzo: {
      n: true,
      r: true,
      fb: { base: [178, 172, 162], amp: 26, speck: 0.35, grid: [2, 2], grout: [96, 92, 86] },
    },
    hedge: { fb: { base: [52, 84, 38], amp: 50, speck: 0.5, blades: true } },
    leaves: { a: true, fb: null }, // alpha leaf-cluster atlas (2 cells); canvas cards on file://
    tuft: { a: true, fb: null }, // alpha grass tuft card
    carpet_d: { linear: true, fb: null }, // carpet fibre detail, multiplied ×2 over the pattern
  };

  /** Cheap 2D value noise (seeded), used to draw the fallback textures. */
  function valueNoise(seed) {
    const r = P.rng(seed);
    const g = new Float32Array(64 * 64).map(() => r());
    return function (x, y) {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const at = (a, b) => g[(((b & 63) << 6) | (a & 63)) >>> 0];
      const top = at(xi, yi) * (1 - xf) + at(xi + 1, yi) * xf;
      const bot = at(xi, yi + 1) * (1 - xf) + at(xi + 1, yi + 1) * xf;
      return top * (1 - yf) + bot * yf;
    };
  }

  /** Brightness offset for one texel of a fallback recipe. */
  function texel(fb, noise, rnd, x, y, size) {
    let v = (noise(x / 16, y / 16) - 0.5) * fb.amp + (noise(x / 4, y / 4) - 0.5) * fb.amp * 0.5;
    if (fb.speck && rnd() < fb.speck) v += (rnd() - 0.5) * fb.amp;
    if (fb.blades) v += (noise(x / 1.5, y / 6) - 0.5) * fb.amp;
    if (fb.streaks) v += (noise(x / 2, y / 24) - 0.5) * fb.amp * 1.4;
    if (fb.veins)
      v -= Math.max(0, 1 - Math.abs(Math.sin(x / 20 + noise(x / 30, y / 30) * 9)) * 18) * 40;
    if (fb.grid) {
      const cx = (x / size) * fb.grid[0];
      const cy = (y / size) * fb.grid[1];
      const edge = Math.min(cx % 1, cy % 1, 1 - (cx % 1), 1 - (cy % 1));
      if (edge < 0.03) return null;
    }
    return v;
  }

  /** Draw a procedural colour texture for `fb` into a new canvas. */
  function drawFallback(name, fb) {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(size, size);
    const noise = valueNoise(name.length * 977 + 13);
    const rnd = P.rng(name.length * 31 + 7);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = texel(fb, noise, rnd, x, y, size);
        const col = v === null ? fb.grout : fb.base.map((b) => b + v);
        const i = (y * size + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /** Shared wrap/encoding setup. */
  function prep(tex, srgb) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
    tex.anisotropy = P.Tex.anisotropy;
    return tex;
  }

  /** Load one photo file (async; the Texture fills in when the image arrives). */
  function loadPhoto(file, srgb) {
    const loader = (P.Tex.loader = P.Tex.loader || new THREE.TextureLoader());
    const tex = loader.load(P.Tex.base + "textures/" + file, undefined, undefined, () => {
      console.warn("[KQ.World] texture failed, keeping blank:", file);
    });
    return prep(tex, srgb);
  }

  const cache = new Map();
  /** Get the map set for `name`: { map, normalMap, roughnessMap } (missing ones are null). */
  function set(name) {
    if (cache.has(name)) return cache.get(name);
    const s = SETS[name];
    const out = { map: null, normalMap: null, roughnessMap: null, alphaMap: null };
    out.photo = KQ.CAN_FETCH;
    if (KQ.CAN_FETCH) {
      if (s.colour !== false) out.map = loadPhoto(name + ".jpg", !s.linear);
      if (s.n) out.normalMap = loadPhoto(name + "_n.jpg", false);
      if (s.r) out.roughnessMap = loadPhoto(name + "_r.jpg", false);
      if (s.a) out.alphaMap = loadPhoto(name + "_a.jpg", false);
    } else if (s.fb) {
      out.map = prep(new THREE.CanvasTexture(drawFallback(name, s.fb)), true);
    }
    cache.set(name, out);
    return out;
  }

  /** Anisotropy for textures created from now on (call before building materials). */
  function setAnisotropy(n) {
    P.Tex.anisotropy = Math.max(1, Math.min(8, n || 1));
  }

  P.Tex = { base: "assets/", anisotropy: 4, SETS, set, setAnisotropy, valueNoise };
})((window.KQ = window.KQ || {}));
