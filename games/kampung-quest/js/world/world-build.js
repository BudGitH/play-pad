/* Kampung Quest — KQ.World.build(scene, { quality, renderer, assetBase }) and the runtime
   (time-of-day update, quality tiers, shadow target, animated fans / barber pole, lamp pools
   and the few real point lights). Loaded last. */
(function (KQ) {
  "use strict";
  const P = KQ.WorldParts;
  const W = KQ.World;

  /** Soft additive light pools under the street lamps (one instanced draw call). */
  function lampPools(spots, heightAt) {
    const c = P.Canvas.canvas(128, 128);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,214,150,1)");
    g.addColorStop(0.5, "rgba(255,190,120,0.35)");
    g.addColorStop(1, "rgba(255,180,110,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const mat = new THREE.MeshBasicMaterial({
      map: P.Canvas.tex(c, true), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    });
    const geo = new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2);
    const list = spots.map((p) => ({ x: p.x, y: heightAt(p.x, p.z) + 0.03, z: p.z, sx: p.s, sy: 1, sz: p.s }));
    const im = P.instanced(geo, mat, list, { cast: false, receive: false });
    im.name = "lampPools";
    im.renderOrder = 2;
    return im;
  }

  /** The handful of real lights besides sun + hemi (no shadows). */
  function pointLights(group, mosque, L) {
    const hall = new THREE.PointLight(0xffe2b8, 1.0, 24, 1.6);
    hall.position.copy(mosque.lightPos);
    const hawker = new THREE.PointLight(0xf4f6ff, 0, 30, 1.4);
    hawker.position.set((L.hawker.x0 + L.hawker.x1) / 2, L.hawker.h - 0.6, (L.hawker.z0 + L.hawker.z1) / 2);
    group.add(hall, hawker);
    return { hall, hawker };
  }

  /** Invisible map-edge walls. */
  function boundary(L, colliders) {
    const h = L.half;
    colliders.push(
      { minX: -h - 2, maxX: h + 2, minZ: -h - 2, maxZ: -h, kind: "edge" },
      { minX: -h - 2, maxX: h + 2, minZ: h, maxZ: h + 2, kind: "edge" },
      { minX: -h - 2, maxX: -h, minZ: -h, maxZ: h, kind: "edge" },
      { minX: h, maxX: h + 2, minZ: -h, maxZ: h, kind: "edge" },
    );
  }

  /** Merge nav POIs with the contract ids, adding radii for the big areas. */
  function finishPois(pois) {
    const r = { hawker: 9, mosque_hall: 8, park: 10, playground: 7, block_a: 8, block_b: 8, block_c: 8, library: 5 };
    Object.keys(r).forEach((id) => pois[id] && (pois[id].radius = r[id]));
    return pois;
  }

  function build(scene, opts) {
    opts = opts || {};
    const tier = opts.quality || "high";
    const kit = W.parts.makeKit(opts);
    const L = P.LAYOUT;
    const group = new THREE.Group();
    group.name = "kampungWorld";
    const ctx = { L, colliders: [], lamps: [], pools: [], tables: [], atlas: kit.atlas, win: kit.pat.windows };
    ctx.letterUV = kit.atlas.letterboxes();
    const B = new P.Batch(P.Materials.UV_SCALES);
    B.floors = [];
    const areas = W.parts.buildAreas(B, group, kit, ctx);
    const inst = W.parts.buildInstanced(group, kit, ctx);
    kit.atlas.texture.needsUpdate = true;
    B.build(kit.mats, group);
    const heightAt = W.parts.makeHeightAt(B.floors);
    const spots = ctx.lamps.map((p) => ({ x: p.x, z: p.z, s: 1 })).concat(ctx.pools);
    group.add(lampPools(spots, heightAt));
    P.Detail.contactShadows(group, ctx.colliders, heightAt, []);
    ctx.steamSprites = P.Clutter.steam(group, ctx.steam || []);
    boundary(L, ctx.colliders);
    scene.add(group);
    const rig = P.Lighting.create(scene, opts.renderer, tier);
    rig.glow = Object.keys(P.Materials.GLOW).map((k) => ({ mat: kit.mats[k], base: P.Materials.GLOW[k] }));
    const nav = P.Nav.build(L);
    return W.runtime({ scene, group, kit, ctx, areas, inst, rig, nav, B, tier, pl: pointLights(group, areas.mosque, L) });
  }

  W.build = build;
  W.helpers = { finishPois, lampPools };
})((window.KQ = window.KQ || {}));
