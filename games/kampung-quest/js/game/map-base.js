/* ============================================================================
 * FILE: map-base.js
 * PURPOSE: The picture under the full map (KQ.Game.MapBase): the whole region (kampung, Makkah or
 *          Madinah) painted from the world's own data: the ground, parks and plazas, the streets and the
 *          footpaths of the walk graph, every building footprint and tree from the colliders, the camel
 *          yard, caravan track and oasis pond. It is painted ONCE per city into an offscreen canvas and
 *          blitted while the map is open; only when the child zooms in past that canvas's sharpness is the
 *          visible part painted again as vectors (so the closest zoom stays crisp, at no memory cost).
 * BUSINESS CONTEXT: playability round AC-P2 / P3 (a whole-region map with roads, buildings, plazas, water
 *   and green) and the perf rule "paint the static base once; redraw the overlay only while open".
 * DEPENDENCIES: minimap.js (the palette and the town / Haramain site painters), map-places.js (city
 *   bounds), KQ.WorldParts (LAYOUT, HolyMakkah / HolyMadinah ROADS, HolyCamels), the world's colliders and
 *   walkGraph.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const M = () => G.Minimap;
  /** Longest side of the offscreen base, in pixels. */
  const BAKE_PX = 1536;
  /** Past this many times the baked sharpness the view is painted as vectors instead. */
  const SHARP = 1.1;
  const cache = { world: null, bases: {} };
  /** How a collider kind is painted: [shape, size or colour...]. Unlisted kinds >= 6 m2 are plain walls. */
  const STYLE = {
    tree: ["disc", 2.1, "rgba(40,112,58,0.9)"],
    palm: ["disc", 2.4, "rgba(52,128,66,0.92)"],
    hedge: ["rect", "#3f7d47"],
    rock: ["disc", 1.6, "#8b7d6b"],
    tent: ["rect", "#f4efe2"],
    tower: ["rect", "#cbbfa6"],
    "mosque-wall": ["rect", "#e9efe9"],
    minaret: ["rect", "#f3f0e6"],
    basin: ["rect", "#8cc3df"],
    fence: ["rect", "#8a6a45"],
    "tailor-shop": ["rect", "#b455d6"],
    stalls: ["rect", "#e8a54a"],
    bus: ["rect", "#5e8fe0"],
  };
  const SKIP = new Set([
    "car",
    "bike",
    "moto",
    "lamp",
    "pillar",
    "column",
    "bollard",
    "linkway-post",
    "pot",
    "arcade-col",
    "holy-col",
    "post",
    "edge",
    "hijr",
    "camel",
    "hay",
    "gate",
    "tray",
    "rack",
    "till",
    "fruit",
  ]);

  /** Paint one collider by its kind (a footprint, a tree crown or a rock). */
  function paintCollider(ctx, c) {
    if (SKIP.has(c.kind)) return;
    const st = STYLE[c.kind];
    const w = c.maxX - c.minX;
    const d = c.maxZ - c.minZ;
    if (!st && w * d < 6) return;
    const x = (c.minX + c.maxX) / 2;
    const z = (c.minZ + c.maxZ) / 2;
    if (st && st[0] === "disc") {
      ctx.fillStyle = st[2];
      ctx.beginPath();
      ctx.arc(x, z, st[1], 0, 7);
      ctx.fill();
      return;
    }
    ctx.fillStyle = st ? st[1] : "#8a8372";
    ctx.fillRect(c.minX, c.minZ, w, d);
  }

  /** Paint every collider of a city (the world holds both Haramain cities in one list). */
  function paintColliders(ctx, s, city) {
    s.world.colliders.forEach(function (c) {
      if (G.MapPlaces.inCity(city, (c.minX + c.maxX) / 2, (c.minZ + c.maxZ) / 2))
        paintCollider(ctx, c);
    });
  }

  /** The pedestrian graph as pale footpaths (one stroke for all of it). */
  function paintPaths(ctx, s) {
    const g = s.world.walkGraph;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.3;
    ctx.lineCap = "round";
    ctx.beginPath();
    g.edges.forEach(function (e) {
      ctx.moveTo(g.nodes[e[0]].x, g.nodes[e[0]].z);
      ctx.lineTo(g.nodes[e[1]].x, g.nodes[e[1]].z);
    });
    ctx.stroke();
  }

  /** The kampung: the town plan, the car park and bus stop, then paths, buildings and trees. */
  function paintKampung(ctx, s) {
    const L = KQ.WorldParts.LAYOUT;
    const b = G.MapPlaces.bounds("kampung");
    ctx.fillStyle = M().PAL.grass;
    ctx.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    M().paintTown(ctx);
    [
      [L.carpark, "#69707c"],
      [L.busStop, "#5e8fe0"],
    ].forEach(function (r) {
      ctx.fillStyle = r[1];
      ctx.fillRect(r[0].x0, r[0].z0, r[0].x1 - r[0].x0, r[0].z1 - r[0].z0);
    });
    paintPaths(ctx, s);
    paintColliders(ctx, s, "kampung");
  }

  /** One street: an asphalt band with a pale dashed centre line. */
  function paintRoad(ctx, r) {
    const x0 = r.axis === "x" ? r.from : r.at - r.w / 2;
    const z0 = r.axis === "x" ? r.at - r.w / 2 : r.from;
    const w = r.axis === "x" ? r.to - r.from : r.w;
    const h = r.axis === "x" ? r.w : r.to - r.from;
    ctx.fillStyle = "#6d717a";
    ctx.fillRect(x0, z0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    if (r.axis === "x") ctx.moveTo(r.from, r.at), ctx.lineTo(r.to, r.at);
    else ctx.moveTo(r.at, r.from), ctx.lineTo(r.at, r.to);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** The camel yard (hay, fence), the caravan's track and the oasis pond of Makkah's outskirts. */
  function paintCamels(ctx) {
    const C = KQ.WorldParts.HolyCamels;
    if (!C) return;
    const y = C.YARD;
    ctx.fillStyle = "#d9c58f";
    ctx.fillRect(y.x0, y.z0, y.x1 - y.x0, y.z1 - y.z0);
    ctx.strokeStyle = "#8a6a45";
    ctx.lineWidth = 0.9;
    ctx.strokeRect(y.x0, y.z0, y.x1 - y.x0, y.z1 - y.z0);
    const k = C.CARAVAN;
    ctx.strokeStyle = "rgba(120,90,50,0.55)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 2.5]);
    ctx.beginPath();
    ctx.ellipse(k.cx, k.cz, k.rx, k.rz, 0, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#62b6cc";
    ctx.beginPath();
    ctx.arc(C.OASIS.x, C.OASIS.z, 7, 0, 7);
    ctx.fill();
  }

  /** Makkah or Madinah: sand, streets, the sites (mataf, sa'i lane ...), paths, the camels, then buildings and palms. */
  function paintHaramain(ctx, s, city) {
    const b = G.MapPlaces.bounds(city);
    ctx.fillStyle = city === "madinah" ? "#d6c9a3" : M().PAL.sand;
    ctx.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    const roads = (city === "madinah" ? KQ.WorldParts.HolyMadinah : KQ.WorldParts.HolyMakkah).ROADS;
    roads.forEach((r) => paintRoad(ctx, r));
    M().paintHolySites(ctx);
    if (city === "makkah") paintCamels(ctx);
    paintPaths(ctx, s);
    paintColliders(ctx, s, city);
  }

  /** Paint the whole city in world units (x east, z south) onto a context already set to world space. */
  function paintWorld(ctx, s, city) {
    if (city === "kampung") paintKampung(ctx, s);
    else paintHaramain(ctx, s, city);
  }

  /** The baked offscreen canvas of a city (made on first use): { canvas, res (pixels per metre), bounds }. */
  function ensure(s, city) {
    if (cache.world !== s.world) {
      cache.world = s.world;
      cache.bases = {};
    }
    if (cache.bases[city]) return cache.bases[city];
    const b = G.MapPlaces.bounds(city);
    const res = BAKE_PX / Math.max(b.x1 - b.x0, b.z1 - b.z0);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil((b.x1 - b.x0) * res);
    canvas.height = Math.ceil((b.z1 - b.z0) * res);
    const ctx = canvas.getContext("2d");
    ctx.scale(res, res);
    ctx.translate(-b.x0, -b.z0);
    paintWorld(ctx, s, city);
    cache.bases[city] = { canvas, res, bounds: b };
    return cache.bases[city];
  }

  /** Draw the base map into the window for a view (blit the baked canvas, or vectors when zoomed in close). */
  function draw(ctx, view, s, city) {
    ctx.fillStyle = M().PAL.void;
    ctx.fillRect(0, 0, view.w, view.h);
    const base = ensure(s, city);
    const b = base.bounds;
    ctx.save();
    ctx.translate(view.w / 2 - view.cx * view.scale, view.h / 2 - view.cz * view.scale);
    ctx.scale(view.scale, view.scale);
    if (view.scale <= base.res * SHARP) {
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(base.canvas, b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    } else {
      ctx.beginPath();
      ctx.rect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
      ctx.clip();
      paintWorld(ctx, s, city);
    }
    ctx.restore();
  }

  G.MapBase = { draw, ensure, paintWorld };
})((window.KQ = window.KQ || {}));
