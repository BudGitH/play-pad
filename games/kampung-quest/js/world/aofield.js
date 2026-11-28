/* Kampung Quest — baked world-space occlusion field (KQ.WorldParts.AOField). One top-down
   RGBA DataTexture over the whole town, rasterised once at build time from the layout's roofs
   and the collider footprints, then blurred:
     R  sky visibility under roofs (1 = open sky; deep inside a hawker hall ≈ 0.25)
     G  contact occlusion around footprints (pillar bases, wall–floor junctions, under tables)
     B  warm bounce / interior-lamp fill weight (lit interiors: hawker, void decks, prayer hall)
     A  roof height / 20 m (occlusion only applies below it)
   The Surface shader patch samples it by world XZ, so roofed interiors stop looking flat
   without per-vertex tessellation or a uv2 lightmap. Procedural: works on file:// too. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  /** Field resolution in texels per side: `AOField.res` (boot sets 512 on the low tier: a quarter of the work, AC-P22). */
  const FULL_RES = 1024;
  let RES = FULL_RES;
  const ORIGIN = -80;
  const SIZE = 160;
  const H_MAX = 20;
  const SKIP = new Set(["edge", "lib-glass", "clinic-glass", "screen", "tree"]);

  /** Roofed areas from the town plan: { x0, x1, z0, z1, h, warm, vis }. */
  function roofs(L) {
    const out = [];
    const add = (x0, x1, z0, z1, h, warm, vis) => out.push({ x0, x1, z0, z1, h, warm, vis });
    const H = L.hawker;
    add(H.x0 - 1.6, H.x1 + 1.6, H.z0 - 1.6, H.z1 + 1.6, H.h + 3.4, 1, 0.3);
    const vh = P.HDB ? P.HDB.VOID_H - 0.35 : 3;
    L.blocks.forEach((b) => add(b.x0, b.x1, b.z0, b.z1, vh, 0.85, 0.35));
    L.linkways.forEach((w) => add(w.x0 - 0.3, w.x1 + 0.3, w.z0, w.z1, 2.9, 0.35, 0.55));
    const bs = L.busStop;
    add(bs.x0 - 0.3, bs.x1 + 0.3, bs.z0 - 0.3, bs.z1 + 0.3, 2.9, 0.35, 0.55);
    const m = L.mosque;
    const pl = P.MosqueShell ? P.MosqueShell.PLINTH : 0.22;
    add(m.hall.x0, m.hall.x1, m.hall.z0, m.hall.z1, pl + m.hall.h - 0.1, 1, 0.2);
    add(m.verandah.x0, m.verandah.x1 + 0.3, m.hall.z0, m.hall.z1, pl + 4.4, 0.6, 0.35);
    add(m.wudu.x0 - 0.3, m.wudu.x1 + 0.3, m.wudu.z0 - 0.3, m.wudu.z1 + 0.8, 3.0, 0.7, 0.3);
    const S = L.shops;
    add(S.x0, S.x1, S.z0, S.z1, S.h - 0.12, 0.9, 0.2);
    const Lb = L.library;
    add(Lb.x0, Lb.x1, Lb.z0, Lb.z1 + 2.5, Lb.h, 0.9, 0.25);
    add(57, 63, 19, 25, 2.8, 0.3, 0.5); // park gazebo
    return out;
  }

  const px = (v) => Math.round(((v - ORIGIN) / SIZE) * RES);
  const clampI = (v) => Math.max(0, Math.min(RES - 1, v));

  /** Fill a world-space rect of a Float32 channel with `v` using `op` (min / max / set). */
  function fillRect(ch, x0, x1, z0, z1, v, op) {
    const a = clampI(px(x0));
    const b = clampI(px(x1));
    const c = clampI(px(z0));
    const d = clampI(px(z1));
    for (let y = c; y <= d; y++) {
      for (let x = a; x <= b; x++) {
        const i = y * RES + x;
        ch[i] = op === "max" ? Math.max(ch[i], v) : op === "min" ? Math.min(ch[i], v) : v;
      }
    }
  }

  /** In-place separable box blur (radius r px), `passes` times ≈ Gaussian. */
  function blur(ch, r, passes) {
    const tmp = new Float32Array(ch.length);
    for (let p = 0; p < passes; p++) {
      blurAxis(ch, tmp, r, 1, RES);
      blurAxis(tmp, ch, r, RES, 1);
    }
  }
  /** One blur pass along an axis: `step` between taps, `line` between lines. */
  function blurAxis(src, dst, r, step, line) {
    const inv = 1 / (2 * r + 1);
    for (let l = 0; l < RES; l++) {
      const base = l * line;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[base + clampI(k) * step];
      for (let i = 0; i < RES; i++) {
        dst[base + i * step] = acc * inv;
        acc += src[base + clampI(i + r + 1) * step] - src[base + clampI(i - r) * step];
      }
    }
  }

  /** Rasterise the four channels (Float32, 0..1). */
  function channels(roofList, colliders) {
    const n = RES * RES;
    const sky = new Float32Array(n).fill(1);
    const touch = new Float32Array(n).fill(1);
    const warm = new Float32Array(n);
    const hgt = new Float32Array(n);
    roofList.forEach((r) => {
      fillRect(sky, r.x0, r.x1, r.z0, r.z1, r.vis, "min");
      fillRect(warm, r.x0, r.x1, r.z0, r.z1, r.warm, "max");
      fillRect(hgt, r.x0 - 1.5, r.x1 + 1.5, r.z0 - 1.5, r.z1 + 1.5, r.h / H_MAX, "max");
    });
    colliders.forEach((c) => {
      if (SKIP.has(c.kind) || (c.maxX - c.minX) * (c.maxZ - c.minZ) > 900) return;
      fillRect(touch, c.minX, c.maxX, c.minZ, c.maxZ, 0, "set");
    });
    const deep = new Float32Array(n);
    roofList.forEach((r) => fillRect(deep, r.x0, r.x1, r.z0, r.z1, 1, "set"));
    const px1024 = (r) => Math.max(1, Math.round((r * RES) / FULL_RES)); // radii were tuned at 1024
    blur(sky, px1024(6), 2);
    blur(deep, px1024(20), 2);
    for (let i = 0; i < n; i++) sky[i] = Math.min(1, sky[i] * (1.25 - 0.5 * deep[i]));
    blur(touch, px1024(2), 2);
    blur(warm, px1024(8), 2);
    return { sky, touch, warm, hgt };
  }

  /** Pack into an RGBA DataTexture (linear, clamped, mipmapped). */
  function pack(ch) {
    const data = new Uint8Array(RES * RES * 4);
    const b = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
    for (let i = 0; i < RES * RES; i++) {
      data[i * 4] = b(ch.sky[i]);
      data[i * 4 + 1] = b(0.3 + 0.7 * ch.touch[i]);
      data[i * 4 + 2] = b(ch.warm[i]);
      data[i * 4 + 3] = b(ch.hgt[i]);
    }
    const t = new THREE.DataTexture(data, RES, RES, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }

  /** Build the field. Returns { texture, origin: Vector3(ox, oz, size), roofs }. */
  function build(L, colliders) {
    RES = P.AOField.res || FULL_RES;
    const list = roofs(L);
    const tex = pack(channels(list, colliders));
    tex.name = "kqAOField";
    return { texture: tex, origin: new THREE.Vector3(ORIGIN, ORIGIN, SIZE), roofs: list };
  }

  P.AOField = { build, roofs, RES: FULL_RES, res: FULL_RES, ORIGIN, SIZE, H_MAX };
})((window.KQ = window.KQ || {}));
