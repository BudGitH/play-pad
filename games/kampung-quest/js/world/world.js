/* Kampung Quest — KQ.World.build: assembles the neighbourhood (see the other js/world files),
   wires up lighting and returns the contract object:
   { pois, colliders, walkGraph, interactables, lights, update(dt, clock), setQuality(tier),
     setShadowTarget(v), heightAt(x, z), group, qualityHints(tier), dispose() }.
   Script order: geo, textures, canvas, patterns, materials, layout, sky, lighting, roads, hdb,
   hawker, mosque, mosque-shell, mosque-yard, mosque-inside, shops, services, trees, props,
   town, nav, world. */
(function (KQ) {
  "use strict";
  const P = KQ.WorldParts;

  /** Textures, atlases and the material catalogue. */
  function makeKit(opts) {
    P.Tex.base = opts.assetBase || KQ.ASSET_BASE || "assets/";
    if (opts.renderer) P.Tex.setAnisotropy(opts.renderer.capabilities.getMaxAnisotropy());
    const atlas = new P.Canvas.Atlas(2048);
    const pat = {
      windows: P.Patterns.windows(), railing: P.Patterns.railing(), carpet: P.Patterns.carpet(),
      leaves: P.Patterns.leaves(), tilework: P.Patterns.tilework(), books: P.Patterns.books(),
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
    return { blocks, hawker, mosque, mart, barber, clinic, library, bins };
  }

  /** Instanced vegetation, furniture and cars. */
  function buildInstanced(group, kit, ctx) {
    const trees = P.Trees.build(group, kit.mats, P.Town.treeList(), ctx.colliders);
    const shrubs = P.Trees.shrubs(group, kit.mats, P.Town.shrubSpots());
    P.Trees.tables(group, kit.mats, ctx.tables, ctx.colliders);
    P.Town.cars(group, kit.mats, ctx.colliders);
    return { trees, shrubs };
  }

  /** Interactables from the area results (ids are stable; see the report). */
  function interactables(a) {
    const v = (x, z) => new THREE.Vector3(x, 0, z);
    const list = [];
    Object.keys(a.hawker.spots).forEach((id) => {
      const s = a.hawker.spots[id];
      list.push({ id: "counter_" + id.replace("stall_", ""), poi: id, pos: v(s.x, s.counterZ + 0.4), label: "Order food" });
    });
    a.mosque.taps.forEach((t, i) => list.push({ id: "wudu_tap_" + (i + 1), poi: "mosque_wudu", pos: v(t.x, t.z), label: "Take wudu" }));
    list.push(
      { id: "prayer_spot", poi: "mosque_hall", pos: v(a.mosque.hallSpot.x, a.mosque.hallSpot.z), label: "Pray" },
      { id: "prayer_spot_women", poi: "mosque_hall", pos: v(-38, -22.5), label: "Pray" },
      { id: "minimart_till", poi: "minimart", pos: v(a.mart.till.x, a.mart.till.z - 0.4), label: "Pay at the till" },
      { id: "barber_chair", poi: "barber", pos: v(a.barber.chair.x, a.barber.chair.z - 0.7), label: "Sit for a haircut" },
      { id: "clinic_desk", poi: "clinic", pos: v(a.clinic.desk.x, a.clinic.desk.z - 0.5), label: "Clinic check-up" },
      { id: "library_desk", poi: "library", pos: v(a.library.desk.x, a.library.desk.z - 0.5), label: "Borrow a story" },
      { id: "home_door", poi: "home", pos: v(a.blocks[0].lift.x, a.blocks[0].lift.z - 0.6), label: "Go home and rest" },
      { id: "recycling_bins", poi: "recycling", pos: v(a.bins.x, a.bins.z - 0.5), label: "Recycle" },
      { id: "playground", poi: "playground", pos: v(21.5, 21.5), label: "Play" },
      { id: "bus_stop_bench", poi: "bus_stop", pos: v(20, 7.4), label: "Sit and wait" },
    );
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
