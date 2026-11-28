/* ============================================================================
 * FILE: stables.js
 * PURPOSE: Where the rideable animals live (KQ.WorldParts.Stables): the static scenery and the
 *          data the game layer reads. Makkah: a fenced "camel & horse rides" lot beside the camel
 *          yard in the outskirts (a stable shed with stalls, hay, a trough, a wide gate to the
 *          street) holding two rideable camels and three horses, plus one rideable camel at the
 *          palm oasis. Kampung: a little fenced pony-ride corner at the east end of the park, by
 *          block C's void deck, with two ponies. Also the POIs the map shows.
 * BUSINESS CONTEXT: AC-P5, AC-P6 (camels and horses can be ridden; a stable in Makkah's outskirts
 *   and a pony ride by the kampung park; they are on the map: POI ids camel_yard, camel_oasis,
 *   horse_stable, pony_ride). The lots were picked clear of the walk graph, streets and colliders
 *   (a scan, features/kampung-quest-playability/notes-animals.md).
 * HOW IT FITS: holy-makkah.js calls makkah.build(c, free) next to the camel yard (and reserves the
 *   lot so the city fill keeps off it); world.js buildAreas calls kampung.build(B, ctx); the world
 *   runtimes add the POIs (holy-world.js to Makkah's POI table, world-runtime.js to the kampung's).
 *   The animals themselves are rigs made and moved by js/game/mounts.js from MOUNTS.
 * DEPENDENCIES: geo.js (Batch); three.js (Vector3 for the POIs).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const POST_GAP = 2.2;
  const WOOD = 0x9a7a52;
  const RAIL = 0xb08e62;

  /* ------------------------------ shared ------------------------------ */

  /** Push an axis-aligned collider box. */
  function solid(cols, x0, z0, x1, z1, kind) {
    cols.push({
      minX: Math.min(x0, x1),
      maxX: Math.max(x0, x1),
      minZ: Math.min(z0, z1),
      maxZ: Math.max(z0, z1),
      kind: kind || "fence",
    });
  }

  /** One straight run of fence: posts, two rails and a collider. */
  function fenceRun(B, cols, a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / POST_GAP));
    for (let i = 0; i <= n; i += 1) {
      const x = a[0] + ((b[0] - a[0]) * i) / n;
      const z = a[1] + ((b[1] - a[1]) * i) / n;
      B.aabb("wood", x - 0.1, 0, z - 0.1, x + 0.1, 1.25, z + 0.1, WOOD);
    }
    const lo = [Math.min(a[0], b[0]) - 0.05, Math.min(a[1], b[1]) - 0.05];
    const hi = [Math.max(a[0], b[0]) + 0.05, Math.max(a[1], b[1]) + 0.05];
    [0.5, 0.98].forEach((y) => B.aabb("wood", lo[0], y, lo[1], hi[0], y + 0.1, hi[1], RAIL));
    solid(cols, lo[0] - 0.15, lo[1] - 0.15, hi[0] + 0.15, hi[1] + 0.15, "fence");
  }

  /**
   * A rectangular fence r = {x0, z0, x1, z1} with one gate: gate = {side: "n"|"s"|"e"|"w", from, to}
   * (the open stretch along that side, in world x for n / s, world z for e / w). n is the +z side.
   */
  function fence(B, cols, r, gate) {
    const sides = {
      s: [[r.x0, r.z0], [r.x1, r.z0], "x"],
      n: [[r.x0, r.z1], [r.x1, r.z1], "x"],
      w: [[r.x0, r.z0], [r.x0, r.z1], "z"],
      e: [[r.x1, r.z0], [r.x1, r.z1], "z"],
    };
    Object.keys(sides).forEach(function (k) {
      const [a, b, axis] = sides[k];
      if (!gate || gate.side !== k) return fenceRun(B, cols, a, b);
      const at = (v) => (axis === "x" ? [v, a[1]] : [a[0], v]);
      fenceRun(B, cols, a, at(gate.from));
      fenceRun(B, cols, at(gate.to), b);
    });
  }

  /** Hay bales (a small stack) at x, z with a collider. */
  function hay(B, cols, x, z) {
    B.box("paint", x, 0.3, z, 1.4, 0.6, 0.8, 0xd9b95a);
    B.box("paint", x + 1.45, 0.3, z, 1.4, 0.6, 0.8, 0xd2b052);
    B.box("paint", x + 0.72, 0.9, z, 1.4, 0.6, 0.8, 0xe0c266);
    solid(cols, x - 0.75, z - 0.45, x + 2.2, z + 0.45, "hay");
  }

  /** A wooden water trough at x, z (along x) with a collider. */
  function trough(B, cols, x, z) {
    B.aabb("wood", x - 1.2, 0, z - 0.4, x + 1.2, 0.6, z + 0.4, 0x8a6a44);
    B.aabb("glass", x - 1.05, 0.48, z - 0.28, x + 1.05, 0.52, z + 0.28, 0xffffff);
    solid(cols, x - 1.25, z - 0.45, x + 1.25, z + 0.45, "trough");
  }

  /** A POI record like the nav builders make: the nearest walk-graph node is kept for routing. */
  function poi(p, graph) {
    let node = -1;
    let best = Infinity;
    ((graph && graph.nodes) || []).forEach(function (n, i) {
      const d = (n.x - p.x) * (n.x - p.x) + (n.z - p.z) * (n.z - p.z);
      if (d < best) {
        best = d;
        node = i;
      }
    });
    return {
      pos: new THREE.Vector3(p.x, 0, p.z),
      facing: p.facing || 0,
      radius: p.radius || 4,
      node,
    };
  }

  /** Add a list of POIs ({id, x, z, facing, label}) to a POI table, keeping any id already there. */
  function addPois(table, list, graph) {
    list.forEach(function (p) {
      if (!table[p.id]) table[p.id] = Object.assign(poi(p, graph), { label: p.label });
    });
    return table;
  }

  /* ------------------------------ Makkah: camel & horse rides ------------------------------ */

  /** The fenced lot east of the camel yard (gate on its north side, facing the street). */
  const LOT = { x0: -199, z0: -158, x1: -173, z1: -130 };
  const LOT_GATE = { side: "n", from: -193, to: -179 };
  const SHED = { x0: -191, z0: -158, x1: -174, z1: -153.5 };

  /** The stable shed: a back wall, posts, a sloping roof and stall dividers. */
  function shed(c) {
    const B = c.B;
    const s = SHED;
    B.aabb("wood", s.x0, 0, s.z0, s.x1, 2.6, s.z0 + 0.3, 0x8a6440);
    solid(c.colliders, s.x0, s.z0 - 0.1, s.x1, s.z0 + 0.4, "stable");
    for (let x = s.x0; x <= s.x1 + 0.01; x += (s.x1 - s.x0) / 4) {
      B.aabb("wood", x - 0.12, 0, s.z1 - 0.12, x + 0.12, 2.3, s.z1 + 0.12, 0x7a5a38);
      solid(c.colliders, x - 0.18, s.z1 - 0.18, x + 0.18, s.z1 + 0.18, "post");
      B.aabb("wood", x - 0.05, 0, s.z0 + 0.3, x + 0.05, 1.3, s.z1 - 0.6, 0x9a7a52);
    }
    B.box(
      "paint",
      (s.x0 + s.x1) / 2,
      2.55,
      (s.z0 + s.z1) / 2,
      s.x1 - s.x0 + 1.2,
      0.16,
      s.z1 - s.z0 + 1.4,
      0xb4483a,
      0,
    );
    B.box("paint", (s.x0 + s.x1) / 2, 2.7, s.z0 + 0.8, s.x1 - s.x0 + 1.2, 0.14, 1.4, 0x9a3a30, 0);
  }

  /** Build the Makkah lot into the static batch and keep the city fill off it. */
  function makkahBuild(c, free) {
    const L = LOT;
    fence(c.B, c.colliders, L, LOT_GATE);
    c.B.aabb("dirt", L.x0, 0, L.z0, L.x1, 0.03, L.z1, 0xffffff);
    shed(c);
    hay(c.B, c.colliders, -197.2, -156.6);
    trough(c.B, c.colliders, -183, -137.5);
    if (free && free.addBuilt) free.addBuilt(L.x0 - 4, L.z0 - 4, L.x1 + 4, L.z1 + 4);
  }

  /** The rideable animals of Makkah: kind, place, heading (0 faces +z), coat. */
  const MAKKAH_MOUNTS = [
    { id: "camel_sandy", kind: "camel", name: "Sandy", x: -195.2, z: -146, heading: 0.15, coat: 1 },
    { id: "camel_dune", kind: "camel", name: "Dune", x: -195.4, z: -138, heading: -0.1, coat: 3 },
    { id: "camel_noor", kind: "camel", name: "Noor", x: -156, z: 98, heading: -1.9, coat: 2 },
    {
      id: "horse_barq",
      kind: "horse",
      name: "Barq",
      x: -187.5,
      z: -150.2,
      heading: 0,
      coat: "bay",
    },
    {
      id: "horse_layla",
      kind: "horse",
      name: "Layla",
      x: -181.5,
      z: -150.4,
      heading: 0.1,
      coat: "grey",
    },
    {
      id: "horse_amber",
      kind: "horse",
      name: "Amber",
      x: -177,
      z: -144,
      heading: -0.4,
      coat: "palomino",
    },
  ];

  const MAKKAH_POIS = [
    { id: "camel_yard", x: -193, z: -132, facing: Math.PI, label: "Camel rides" },
    { id: "horse_stable", x: -184, z: -132, facing: Math.PI, label: "Horse stable" },
    { id: "camel_oasis", x: -158, z: 92, facing: 0.5, label: "Oasis camel" },
  ];

  /* ------------------------------ Kampung: the pony ride ------------------------------ */

  /** The pony corner at the park's east end, by block C (gate on its west side, toward the linkway). */
  const RING = { x0: 59.5, z0: 35.5, x1: 70.5, z1: 44.5 };
  const RING_GATE = { side: "w", from: 37.5, to: 42.5 };

  /** Build the pony corner into the kampung batch: fence, sand floor, hay, a striped flag pole. */
  function kampungBuild(B, ctx) {
    const R = RING;
    fence(B, ctx.colliders, R, RING_GATE);
    B.aabb("soil", R.x0, 0, R.z0, R.x1, 0.025, R.z1, 0xe2c79a);
    hay(B, ctx.colliders, 66.8, 43.6);
    B.aabb("wood", 59.44, 0, 35.44, 59.56, 2.6, 35.56, 0x8a6a44);
    B.box("paint", 60.05, 2.35, 35.5, 1.1, 0.42, 0.04, 0xff6b85, 0);
    B.box("paint", 60.05, 2.1, 35.5, 1.1, 0.1, 0.05, 0xffd34d, 0);
  }

  const KAMPUNG_MOUNTS = [
    {
      id: "pony_kiwi",
      kind: "pony",
      name: "Kiwi",
      x: 63.2,
      z: 41.2,
      heading: -1.7,
      coat: "chestnut",
    },
    {
      id: "pony_bintang",
      kind: "pony",
      name: "Bintang",
      x: 67.4,
      z: 38.4,
      heading: -1.3,
      coat: "black",
    },
  ];

  const KAMPUNG_POIS = [
    { id: "pony_ride", x: 57.6, z: 40, facing: -Math.PI / 2, label: "Pony ride" },
  ];

  P.Stables = {
    fence,
    addPois,
    makkah: {
      build: makkahBuild,
      LOT,
      MOUNTS: MAKKAH_MOUNTS,
      POIS: MAKKAH_POIS,
      addPois: (table, graph) => addPois(table, MAKKAH_POIS, graph),
    },
    kampung: {
      build: kampungBuild,
      RING,
      MOUNTS: KAMPUNG_MOUNTS,
      POIS: KAMPUNG_POIS,
      addPois: (table, graph) => addPois(table, KAMPUNG_POIS, graph),
    },
    POI_IDS: ["camel_yard", "camel_oasis", "horse_stable", "pony_ride"],
  };
})((window.KQ = window.KQ || {}));
