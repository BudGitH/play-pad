/* Kampung Quest — the detail layer (KQ.WorldParts.Detail): contact shadows (soft AO blobs
   under every prop/pillar from the collider list; parked vehicles are runtime meshes with their
   own cast shadow, not part of this list), road wear (tyre tracks, patches, kerb dirt, drains,
   manholes) and a distant skyline ring. Street clutter (pots, bollards, hedges) lives in
   clutter.js. Each kind is one draw call. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const SKIP = new Set([
    "edge",
    "lib",
    "lib-glass",
    "shop-back",
    "clinic-glass",
    "stalls",
    "screen",
    "fence",
    "mosque-wall",
  ]);

  /**
   * Translucent, depth-write-off material with polygon offset so ground decals sit on the road
   * without z-fighting.
   */
  function decalMat(map, opacity) {
    return new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
  }
  const flat = () =>
    P.cached("flatPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));

  /** Soft contact shadows under everything that stands on the ground. */
  function contactShadows(group, colliders, heightAt, extra) {
    const list = [];
    colliders.forEach((c) => {
      if (SKIP.has(c.kind)) return;
      const w = c.maxX - c.minX;
      const d = c.maxZ - c.minZ;
      if (w * d > 60) return;
      const pad = c.kind === "tree" ? 1.6 : 0.7;
      const x = (c.minX + c.maxX) / 2;
      const z = (c.minZ + c.maxZ) / 2;
      list.push({ x, y: heightAt(x, z) + 0.025, z, sx: w + pad, sy: 1, sz: d + pad });
    });
    extra.forEach((e) =>
      list.push({ x: e.x, y: heightAt(e.x, e.z) + 0.025, z: e.z, sx: e.w, sy: 1, sz: e.d }),
    );
    const im = P.instanced(flat(), decalMat(P.Patterns2.blob(), 1), list, {
      cast: false,
      receive: false,
    });
    im.name = "contactShadows";
    im.renderOrder = 1;
    group.add(im);
  }

  /** Tyre wear, patches, kerb grime, drains and manholes on the carriageways. */
  function roadWear(B, L) {
    const r = P.rng(404);
    const h = L.half + 40;
    const H = Math.PI / 2;
    for (let t = -h; t < h; t += 7) {
      [-2.2, -1.3, 1.3, 2.2].forEach((c) => {
        B.decal("grime", t + 3.5, 0.016, c, 7.4, 0.5, 0);
        B.decal("grime", c, 0.017, t + 3.5, 7.4, 0.5, H);
      });
      const a = (r() - 0.5) * 5;
      const b = t + r() * 6;
      if (r() < 0.35) B.decal("grime", b, 0.018, a, 2 + r() * 2, 1 + r(), r(), 0x777777);
      if (r() < 0.35) B.decal("grime", a, 0.018, b, 2 + r() * 2, 1 + r(), H + r(), 0x777777);
    }
    kerbGrime(B, L, h);
  }
  /**
   * Lay grime strips along both kerbs of the road, with storm drains and manhole covers along the
   * way.
   */
  function kerbGrime(B, L, h) {
    const e = L.road.half - 0.25;
    for (let t = -h; t < h; t += 12) {
      [-e, e].forEach((c) => {
        B.decal("grime", t + 6, 0.019, c, 12, 0.5, 0);
        B.decal("grime", c, 0.019, t + 6, 12, 0.5, Math.PI / 2);
        if (Math.abs(t) > 8) drain(B, t + 2, c + Math.sign(c) * 0.02);
      });
      if (Math.abs(t) > 8) B.cyl("metal", t + 9, 0.013, 1.75, 0.35, 0.012, 20, 0x4a4c4e);
    }
  }
  /** Kerbside drain grating. */
  function drain(B, x, z) {
    B.box("dark", x, 0.012, z, 0.9, 0.012, 0.42, 0x2a2c2e);
    for (let k = 0; k < 6; k++)
      B.box("metal", x - 0.38 + k * 0.15, 0.02, z, 0.04, 0.01, 0.38, 0x55585b);
  }

  /** Haze uniforms shared by the skyline (fog colour copied in by the runtime each update). */
  const HAZE = { kqHazeCol: { value: new THREE.Color(0xcfe0ee) }, kqHaze: { value: 0.5 } };
  /**
   * Clone a material with fog off and a shader tweak that blends toward the shared haze colour
   * (distant skyline haze).
   */
  function hazeMaterial(base) {
    const m = base.clone();
    m.fog = false;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, HAZE);
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform vec3 kqHazeCol;\nuniform float kqHaze;",
        )
        .replace(
          "#include <dithering_fragment>",
          "gl_FragColor.rgb = mix( gl_FragColor.rgb, kqHazeCol, kqHaze );\n#include <dithering_fragment>",
        );
    };
    m.customProgramCacheKey = () => "kqHaze";
    m.userData.kqSkip = true; // keep the Surface patch from replacing the haze hook
    return m;
  }
  /** Set the haze colour (linear fog colour) and strength. */
  function setHaze(col, night) {
    HAZE.kqHazeCol.value.copy(col);
    HAZE.kqHaze.value = 0.56 - 0.21 * night;
  }

  /** The cheerful HDB pastels (cream, mint, peach, lemon, sky blue, blush) for the far blocks. */
  const PASTEL = [0xfff6e6, 0xcdeedd, 0xffd9c2, 0xfff0a8, 0xcfe4fa, 0xf8d6e4];

  /** Two rings of distant HDB slabs and point blocks, hazed towards the fog colour. */
  function skyline(group, mats) {
    const r = P.rng(2024);
    const list = [];
    const ring = (n, d0, d1, tone) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.1;
        const d = d0 + r() * (d1 - d0);
        const point = r() < 0.25;
        const hgt = (point ? 38 : 26) + r() * 24;
        const c = 0.72 + r() * 0.28;
        list.push({
          x: Math.cos(a) * d,
          y: hgt / 2,
          z: Math.sin(a) * d,
          ry: -a + Math.PI / 2 + (r() - 0.5) * 0.9,
          sx: point ? 16 + r() * 6 : 34 + r() * 26,
          sy: hgt,
          sz: point ? 16 + r() * 6 : 10 + r() * 3,
          color: new THREE.Color(PASTEL[Math.floor(r() * PASTEL.length)])
            .multiplyScalar(c * tone)
            .getHex(),
        });
      }
    };
    ring(24, 200, 250, 0.95);
    ring(36, 270, 340, 0.88);
    const mat = mats.skyline.userData.far ? hazeMaterial(mats.skyline) : mats.skyline;
    const im = P.instanced(
      P.cached("skyBox", () => new THREE.BoxGeometry(1, 1, 1)),
      mat,
      list,
      { cast: false, receive: false },
    );
    im.name = "skyline";
    group.add(im);
    mats.skyline = mat; // the night-glow fader drives the hazed clone
  }

  P.Detail = { contactShadows, roadWear, skyline, decalMat, flat, setHaze, HAZE };
})((window.KQ = window.KQ || {}));
