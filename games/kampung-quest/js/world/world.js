/* Kampung Quest — KQ.World.build: assembles the neighbourhood (see the other js/world files),
   wires up lighting and returns the contract object:
   { pois, colliders, walkGraph, interactables, lights, update(dt, clock), setQuality(tier),
     setShadowTarget(v), heightAt(x, z), group, qualityHints(tier), dispose() }.
   Script order: geo, textures, canvas, patterns, patterns2, materials, layout, sky, lighting,
   roads, hdb, hawker, mosque, mosque-shell, mosque-yard, mosque-inside, shops, services, trees,
   props, town, detail, clutter, nav, world, world-runtime, world-build. */
(function (KQ) {
  "use strict";
  const P = KQ.WorldParts;

  /** Textures, atlases and the material catalogue. */
  function makeKit(opts) {
    P.Tex.base = opts.assetBase || KQ.ASSET_BASE || "assets/";
    if (opts.renderer) P.Tex.setAnisotropy(opts.renderer.capabilities.getMaxAnisotropy());
    const atlas = new P.Canvas.Atlas(2048);
    const pat = {
      windows: P.Patterns.windows(),
      railing: P.Patterns.railing(),
      carpet: P.Patterns.carpet(),
      leaves: P.Patterns.leaves(),
      tilework: P.Patterns.tilework(),
      books: P.Patterns.books(),
      wallTiles: P.Patterns.wallTiles(),
    };
    const mats = P.Materials.create(pat, atlas);
    return { atlas, pat, mats };
  }

  /** Build all scenery into the batch / group. Returns per-area results. */
  function buildAreas(B, group, kit, ctx) {
    const L = ctx.L;
    P.Roads.build(B, ctx);
    const blocks = L.blocks.map((b) => P.HDB.block(B, b, ctx));
    const hawker = P.Hawker.build(B, ctx);
    group.add(hawker.fans.mesh);
    const mosque = P.MosqueInside.build(B, group, kit.mats, ctx);
    const S = L.shops;
    P.Shops.row(B, S, ctx);
    P.Shops.fronts(B, S, ctx);
    const mart = P.Shops.minimart(B, L.shopUnits[0], S, ctx);
    const barber = P.Services.barber(B, L.shopUnits[1], S, ctx, group);
    const clinic = P.Services.clinic(B, L.shopUnits[2], S, ctx);
    const library = P.Services.library(B, L.library, ctx);
    P.Props.playground(B, L.playground, ctx);
    L.linkways.forEach((lw) => P.Props.linkway(B, lw, ctx));
    P.Props.busStop(B, L.busStop, ctx);
    const bins = P.Props.recycling(B, L.recycling, ctx);
    P.Town.plazas(B);
    P.Town.carpark(B, L.carpark);
    P.Town.park(B, L.park, ctx);
    P.Detail.roadWear(B, L);
    ctx.potSpots = [];
    P.Clutter.pots(B, ctx.colliders, ctx.potSpots);
    P.Clutter.bollards(B, ctx.colliders);
    P.Clutter.hedges(B, ctx.colliders);
    return { blocks, hawker, mosque, mart, barber, clinic, library, bins };
  }

  /** Instanced vegetation, furniture and cars. */
  function buildInstanced(group, kit, ctx) {
    const trees = P.Trees.build(group, kit.mats, P.Town.treeList(), ctx.colliders);
    const potPlants = ctx.potSpots.map((p) => ({ x: p.x, z: p.z, y: 1.0, s: 0.75 }));
    const shrubs = P.Trees.shrubs(group, kit.mats, potPlants.concat(P.Town.shrubSpots()));
    P.Clutter.vehicles(group, kit.mats, ctx.colliders);
    P.Detail.skyline(group, kit.mats);
    P.Trees.tables(group, kit.mats, ctx.tables, ctx.colliders);
    P.Town.cars(group, kit.mats, ctx.colliders);
    return { trees, shrubs };
  }

  /** Interactables from the area results (ids are stable; see the report). */
  function interactables(a) {
    const list = [];
    const add = (id, poi, x, z, label) =>
      list.push({ id, poi, pos: new THREE.Vector3(x, 0, z), label });
    Object.keys(a.hawker.spots).forEach((id) => {
      const s = a.hawker.spots[id];
      add("counter_" + id.replace("stall_", ""), id, s.x, s.counterZ + 0.4, "Order food");
    });
    a.mosque.taps.forEach((t, i) =>
      add("wudu_tap_" + (i + 1), "mosque_wudu", t.x, t.z, "Take wudu"),
    );
    const m = a.mosque.hallSpot;
    add("prayer_spot", "mosque_hall", m.x, m.z, "Pray");
    add("prayer_spot_women", "mosque_hall", -38, -22.5, "Pray");
    add("minimart_till", "minimart", a.mart.till.x, a.mart.till.z - 0.4, "Pay at the till");
    add("barber_chair", "barber", a.barber.chair.x, a.barber.chair.z - 0.7, "Sit for a haircut");
    add("clinic_desk", "clinic", a.clinic.desk.x, a.clinic.desk.z - 0.5, "Clinic check-up");
    add("library_desk", "library", a.library.desk.x, a.library.desk.z - 0.5, "Borrow a story");
    const lift = a.blocks[0].lift;
    add("home_door", "home", lift.x, lift.z - 0.6, "Go home and rest");
    add("recycling_bins", "recycling", a.bins.x, a.bins.z - 0.5, "Recycle");
    add("playground", "playground", 21.5, 21.5, "Play");
    add("bus_stop_bench", "bus_stop", 20, 7.4, "Sit and wait");
    return list;
  }

  /** Highest registered floor under (x, z); 0 (grass) when none. */
  function makeHeightAt(floors) {
    return function heightAt(x, z) {
      let y = 0;
      for (let i = 0; i < floors.length; i++) {
        const f = floors[i];
        if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ && f.y > y) y = f.y;
      }
      return y;
    };
  }

  KQ.World = KQ.World || {};
  KQ.World.parts = { makeKit, buildAreas, buildInstanced, interactables, makeHeightAt };
})((window.KQ = window.KQ || {}));
