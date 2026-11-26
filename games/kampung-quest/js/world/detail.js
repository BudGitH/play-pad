/* Kampung Quest — the detail layer (KQ.WorldParts.Detail): contact shadows (soft AO blobs
   under every prop/pillar from the collider list), road wear (tyre tracks, patches, kerb dirt,
   drains, manholes), a distant skyline ring, and street clutter (bicycles, motorbikes, potted
   plants, bollards, hedges). Each kind is one draw call. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const SKIP = new Set(["edge", "lib", "lib-glass", "shop-back", "clinic-glass", "stalls", "screen", "fence", "mosque-wall"]);

  function decalMat(map, opacity) {
    return new THREE.MeshBasicMaterial({
      map, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
  }
  const flat = () => P.cached("flatPlane", () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));

  /** Soft contact shadows under everything that stands on the ground. */
  function contactShadows(group, colliders, heightAt, extra) {
    const list = [];
    colliders.forEach((c) => {
      if (SKIP.has(c.kind)) return;
      const w = c.maxX - c.minX;
      const d = c.maxZ - c.minZ;
      if (w * d > 60) return;
      const pad = c.kind === "tree" ? 1.6 : c.kind === "car" ? 0.5 : 0.7;
      const x = (c.minX + c.maxX) / 2;
      const z = (c.minZ + c.maxZ) / 2;
      list.push({ x, y: heightAt(x, z) + 0.025, z, sx: w + pad, sy: 1, sz: d + pad });
    });
    extra.forEach((e) => list.push({ x: e.x, y: heightAt(e.x, e.z) + 0.025, z: e.z, sx: e.w, sy: 1, sz: e.d }));
    const im = P.instanced(flat(), decalMat(P.Patterns2.blob(), 1), list, { cast: false, receive: false });
    im.name = "contactShadows";
    im.renderOrder = 1;
    group.add(im);
  }

  /** Tyre wear, patches, kerb grime, drains and manholes on the carriageways. */
  function roadWear(B, L) {
    const r = P.rng(404);
    const h = L.half + 40;
    for (let t = -h; t < h; t += 7) {
      [-1.75, 1.75].forEach((c) => {
        [-0.45, 0.45].forEach((o) => {
          B.plane("grime", t + 3.5, 0.016, c + o, 7.4, 0.5, [-Math.PI / 2, 0, 0], null, 0xffffff);
          B.plane("grime", c + o, 0.017, t + 3.5, 7.4, 0.5, [-Math.PI / 2, 0, Math.PI / 2], null, 0xffffff);
        });
      });
      if (r() < 0.35) B.plane("grime", t + r() * 6, 0.018, (r() - 0.5) * 5, 1.5 + r() * 2.5, 1 + r() * 1.5, [-Math.PI / 2, 0, r()], null, 0x777777);
      if (r() < 0.35) B.plane("grime", (r() - 0.5) * 5, 0.018, t + r() * 6, 1 + r() * 1.5, 1.5 + r() * 2.5, [-Math.PI / 2, 0, r()], null, 0x777777);
    }
    kerbGrime(B, L, h);
  }
  function kerbGrime(B, L, h) {
    const e = L.road.half - 0.25;
    for (let t = -h; t < h; t += 12) {
      [-e, e].forEach((c) => {
        B.plane("grime", t + 6, 0.019, c, 12, 0.5, [-Math.PI / 2, 0, 0], null, 0xffffff);
        B.plane("grime", c, 0.019, t + 6, 12, 0.5, [-Math.PI / 2, 0, Math.PI / 2], null, 0xffffff);
        if (Math.abs(t) > 8) {
          B.box("dark", t + 2, 0.012, c + Math.sign(c) * 0.02, 0.9, 0.012, 0.42, 0x2a2c2e);
          for (let k = 0; k < 6; k++) B.box("metal", t + 1.62 + k * 0.15, 0.02, c + Math.sign(c) * 0.02, 0.04, 0.01, 0.38, 0x55585b);
        }
      });
      if (Math.abs(t) > 8) B.cyl("metal", t + 9, 0.013, 1.75, 0.35, 0.012, 20, 0x4a4c4e);
    }
  }

  /** A ring of distant towers to fill the horizon (fogged to silhouettes). */
  function skyline(group, mats) {
    const r = P.rng(2024);
    const list = [];
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + r() * 0.08;
      const d = 150 + r() * 90;
      const hgt = 26 + r() * 40;
      list.push({ x: Math.cos(a) * d, y: hgt / 2, z: Math.sin(a) * d, ry: r() * 3, sx: 14 + r() * 18, sy: hgt, sz: 10 + r() * 8, color: r() < 0.5 ? 0xffffff : 0xe8e0d4 });
    }
    const im = P.instanced(P.cached("skyBox", () => new THREE.BoxGeometry(1, 1, 1)), mats.skyline, list, { cast: false, receive: false });
    im.name = "skyline";
    group.add(im);
  }

  P.Detail = { contactShadows, roadWear, skyline, decalMat, flat };
})((window.KQ = window.KQ || {}));
