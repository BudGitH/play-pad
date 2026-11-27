/* Kampung Quest — tileable procedural grunge atlas (KQ.WorldParts.Grunge), one 512² RGBA
   DataTexture that the Surface shader patch multiplies over every world material:
     R  macro blotches (plaster / paint / paving colour variation, breaks photo tiling)
     G  vertical rain streaks and water stains (fading downwards, wraps vertically)
     B  fine grime and speckle (dirt in corners, worn paint, oil spots)
     A  low-frequency puddle mask (wet patches on roads, paving and wudu tiles)
   Pure maths, so identical on file:// and http(s). */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const N = 512;

  /** Periodic value noise: lattice of `period` cells over the whole tile, smooth-stepped. */
  function periodic(seed) {
    const r = P.rng(seed);
    const g = new Float32Array(256 * 256).map(() => r());
    return function (u, v, period) {
      const x = u * period;
      const y = v * period;
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      let fx = x - xi;
      let fy = y - yi;
      fx = fx * fx * (3 - 2 * fx);
      fy = fy * fy * (3 - 2 * fy);
      const at = (a, b) => g[(b % period & 255) * 256 + (a % period & 255)];
      const top = at(xi, yi) * (1 - fx) + at(xi + 1, yi) * fx;
      const bot = at(xi, yi + 1) * (1 - fx) + at(xi + 1, yi + 1) * fx;
      return top * (1 - fy) + bot * fy;
    };
  }
  /** Fractal sum of periodic octaves starting at `base` cells. */
  function fbm(noise, u, v, base, oct) {
    let s = 0;
    let a = 0.5;
    let p = base;
    for (let i = 0; i < oct; i++) {
      s += a * noise(u, v, p);
      p *= 2;
      a *= 0.5;
    }
    return s / (1 - Math.pow(0.5, oct));
  }

  /** Vertical streak field (wrapping in both axes). */
  function streakField() {
    const f = new Float32Array(N * N);
    const r = P.rng(913);
    for (let k = 0; k < 150; k++) {
      const x0 = Math.floor(r() * N);
      const y0 = Math.floor(r() * N);
      const w = 1 + Math.floor(r() * 5);
      const len = 30 + r() * 260;
      const amp = 0.25 + r() * 0.75;
      for (let t = 0; t < len; t++) {
        const fade = Math.pow(1 - t / len, 1.6) * amp;
        const y = (y0 + t) % N;
        for (let d = 0; d < w; d++)
          f[y * N + ((x0 + d) % N)] += fade * (d === 0 || d === w - 1 ? 0.6 : 1);
      }
    }
    return f;
  }

  /** Fill the RGBA bytes. */
  function fill(data, streaks) {
    const nA = periodic(11);
    const nB = periodic(23);
    const nC = periodic(37);
    const sp = P.rng(5);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N;
        const v = y / N;
        const i = (y * N + x) * 4;
        const macro = fbm(nA, u, v, 4, 4);
        const fine = fbm(nB, u, v, 16, 3) * 0.8 + (sp() < 0.04 ? sp() * 0.2 : 0.1);
        data[i] = Math.round(Math.min(1, Math.max(0, (macro - 0.5) * 1.6 + 0.5)) * 255);
        data[i + 1] = Math.round(Math.min(1, streaks[y * N + x] * 0.7) * 255);
        data[i + 2] = Math.round(Math.min(1, fine) * 255);
        data[i + 3] = Math.round(fbm(nC, u, v, 3, 3) * 255);
      }
    }
  }

  let cached = null;
  /** The shared grunge texture (built once). */
  function texture() {
    if (cached) return cached;
    const data = new Uint8Array(N * N * 4);
    fill(data, streakField());
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.needsUpdate = true;
    t.name = "kqGrunge";
    cached = t;
    return t;
  }

  P.Grunge = { texture, periodic, fbm };
})((window.KQ = window.KQ || {}));
