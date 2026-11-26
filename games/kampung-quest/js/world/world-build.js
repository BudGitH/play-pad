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
      map: P.Canvas.tex(c, true),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const geo = new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2);
    const list = spots.map((p) => ({
      x: p.x,
      y: heightAt(p.x, p.z) + 0.03,
      z: p.z,
      sx: p.s,
      sy: 1,
      sz: p.s,
    }));
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
    hawker.position.set(
      (L.hawker.x0 + L.hawker.x1) / 2,
      L.hawker.h - 0.6,
      (L.hawker.z0 + L.hawker.z1) / 2,
    );
    const w = L.mosque.wudu;
    const wudu = new THREE.PointLight(0xf2f6ff, 0, 11, 1.6);
    wudu.position.set((w.x0 + w.x1) / 2, 2.7, (w.z0 + w.z1) / 2 + 0.6);
    group.add(hall, hawker, wudu);
    return { hall, hawker, wudu };
  }

  /** Additive glow halos around every lamp head (one Points draw call, faded in at night). */
  function lampHalos(ctx) {
    if (!P.Patterns3) return null;
    const pts = ctx.lamps.map((p) => [p.x, p.y - 0.05, p.z, 2.2]);
    ctx.pools.forEach((p) => pts.push([p.x, (p.y || 3) + 0.1, p.z, p.warm ? 1.3 : 1.0]));
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        pts.flatMap((p) => p.slice(0, 3)),
        3,
      ),
    );
    const mat = new THREE.PointsMaterial({
      map: P.Patterns3.halo(),
      size: 1.6,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halos = new THREE.Points(g, mat);
    halos.name = "lampHalos";
    halos.renderOrder = 3;
    return halos;
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
    const r = {
      hawker: 9,
      mosque_hall: 8,
      park: 10,
      playground: 7,
      block_a: 8,
      block_b: 8,
      block_c: 8,
      library: 5,
    };
    Object.keys(r).forEach((id) => pois[id] && (pois[id].radius = r[id]));
    return pois;
  }

  /** Static meshes never move (steam / smoke are sprites, lights are not meshes): skip their per-frame matrix work. */
  function freezeStatics(group) {
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      if (o.isMesh && o !== group) o.matrixAutoUpdate = false;
    });
  }

  /** Heavy static batches are split into ground cells so culling works (see Batch.build). */
  const CHUNK = { cell: 72, minTris: 7000 };

  /**
   * Build the whole neighbourhood once: batched geometry, lights, sky, nav graph and the runtime
   * handle.
   * @param scene the THREE scene to add the world to.
   * @param opts { quality, renderer } (quality defaults to 'high').
   * @returns the world object (update, heightAt, pois, colliders, walkGraph, ...).
   */
  function build(scene, opts) {
    opts = opts || {};
    const tier = opts.quality || "high";
    const kit = W.parts.makeKit(opts);
    const L = P.LAYOUT;
    const group = new THREE.Group();
    group.name = "kampungWorld";
    const ctx = { L, colliders: [], lamps: [], pools: [], tables: [], atlas: kit.atlas };
    ctx.mats = kit.mats;
    ctx.win = kit.pat.windows;
    ctx.letterUV = kit.atlas.letterboxes();
    const B = new P.Batch(P.Materials.UV_SCALES, CHUNK);
    B.floors = [];
    const areas = W.parts.buildAreas(B, group, kit, ctx);
    const inst = W.parts.buildInstanced(group, kit, ctx);
    kit.atlas.texture.needsUpdate = true;
    B.build(kit.mats, group);
    finishDetail(group, ctx, W.parts.makeHeightAt(B.floors));
    if (P.AOField && P.Surface) P.Surface.apply(group, P.AOField.build(L, ctx.colliders));
    freezeStatics(group);
    scene.add(group);
    P.Sky.fromPrayerTimes();
    const rig = P.Lighting.create(scene, opts.renderer, tier);
    rig.glow = Object.keys(P.Materials.GLOW).map((k) => ({
      mat: kit.mats[k],
      base: P.Materials.GLOW[k],
    }));
    const pl = pointLights(group, areas.mosque, L);
    const nav = P.Nav.build(L);
    return W.runtime({ scene, group, kit, ctx, areas, inst, rig, nav, B, tier, pl });
  }
  /** Light pools, contact shadows, steam and the map edge (need the final floors/colliders). */
  function finishDetail(group, ctx, heightAt) {
    const spots = ctx.lamps.map((p) => ({ x: p.x, z: p.z, s: 1 })).concat(ctx.pools);
    group.add(lampPools(spots, heightAt));
    const halos = lampHalos(ctx);
    if (halos) group.add(halos);
    P.Detail.contactShadows(group, ctx.colliders, heightAt, []);
    ctx.steamSprites = P.Clutter.steam(group, ctx.steam || []);
    if (P.Life) ctx.smokeSprites = P.Life.smoke(group, (ctx.steam || [])[3]);
    if (P.Foliage) {
      const C = ctx.colliders;
      const blocked = (x, z) =>
        C.some((c) => x > c.minX - 0.1 && x < c.maxX + 0.1 && z > c.minZ - 0.1 && z < c.maxZ + 0.1);
      const spots = P.Foliage.tuftSpots(P.Town.treeList(), ctx.L);
      P.Foliage.tufts(group, ctx.mats.tuft, spots, heightAt, blocked);
    }
    boundary(ctx.L, ctx.colliders);
  }

  W.build = build;
  W.helpers = { finishPois, lampPools };
})((window.KQ = window.KQ || {}));
