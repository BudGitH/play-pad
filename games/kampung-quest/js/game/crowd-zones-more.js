/* ============================================================================
 * FILE: crowd-zones-more.js
 * PURPOSE: More fixed spots for the kampung crowd, beyond the hawker, lifts, bus stop and play
 *          areas of crowd-zones.js: people browsing or waiting outside the shops, clinic and
 *          library; picnic circles on the park and block lawns; and loners standing on the
 *          pavements (on the phone, waiting for a friend, looking around).
 * BUSINESS CONTEXT: owner feedback "add a lot more individuals and characters across both
 *   regions". Every spot is checked against the world colliders like the rest, so nobody is ever
 *   placed in a wall; nothing here adds a mesh (all of it is drawn by the one instanced kit).
 * DEPENDENCIES: crowd-zones.js (clear, openPoints), util.js, KQ.Sim.Crowd (circleSlots).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const C = () => KQ.Sim.Crowd;

  /** The shop fronts people wait or browse at (POI ids), and how many places each holds. */
  const SHOPS = ["minimart", "barber", "clinic", "library"];
  const SHOP_DX = [-2.3, -1.55, -0.8, 0.8, 1.55, 2.3];

  /** People standing in front of each shop, facing the door: a loose row two deep. */
  function shopSlots(world) {
    const out = [];
    SHOPS.filter((id) => world.pois[id]).forEach(function (id) {
      const poi = world.pois[id];
      SHOP_DX.forEach(function (dx, i) {
        const x = poi.pos.x + dx;
        const z = poi.pos.z + 0.9 + (i % 2) * 0.75;
        if (!G.CrowdZones.clear(world, x, z)) return;
        out.push({
          id: "shop:" + id + ":" + i,
          kind: "shop",
          x,
          z,
          heading: poi.facing === undefined ? Math.PI : poi.facing,
          group: "shop:" + id,
          index: i,
        });
      });
    });
    return out;
  }

  /** Lawns where people sit in a circle on the grass: a rectangle and how many circles it should hold. */
  const PICNIC_AREAS = [
    { name: "picnicPark", x0: 36, x1: 68, z0: 12, z1: 36, groups: 5 },
    { name: "picnicLawnAB", x0: -55, x1: -26, z0: 27, z1: 44, groups: 2 },
    { name: "picnicBlockC", x0: 34, x1: 64, z0: 38, z1: 45, groups: 1 },
    { name: "picnicPlay", x0: 12, x1: 29, z0: 12, z1: 29, groups: 1 },
  ];

  /** Picnic circles: 3 to 5 people sitting on the ground facing each other. */
  function picnicSlots(world) {
    const out = [];
    PICNIC_AREAS.forEach(function (area) {
      const taken = [];
      G.CrowdZones.openPoints(world, area, 1.5, 2.5).forEach(function (p) {
        if (taken.length >= area.groups || taken.some((q) => U.dist(p.x, p.z, q.x, q.z) < 7))
          return;
        taken.push(p);
        const size = 3 + Math.floor(p.r * 3);
        const gid = "picnic:" + area.name + ":" + taken.length;
        C()
          .circleSlots(p.x, p.z, size, 0.85, p.r * 6)
          .forEach((q, i) =>
            out.push({
              id: gid + ":" + i,
              kind: "picnic",
              x: q.x,
              z: q.z,
              heading: q.heading,
              group: gid,
              index: i,
              size,
            }),
          );
      });
    });
    return out;
  }

  /** The most pavement loners, and how far apart (m) they stand. */
  const LOITER_MAX = 70;
  const LOITER_APART = 7;
  /** Offsets from a walk-graph node to try, in metres: beside the path, not on it. */
  const LOITER_SIDE = [
    [1.3, 0],
    [-1.3, 0],
    [0, 1.3],
    [0, -1.3],
  ];

  /** The first clear spot beside a graph node, or null. */
  function besideNode(world, n, rnd) {
    const start = Math.floor(rnd() * LOITER_SIDE.length);
    for (let k = 0; k < LOITER_SIDE.length; k += 1) {
      const o = LOITER_SIDE[(start + k) % LOITER_SIDE.length];
      if (G.CrowdZones.clear(world, n.x + o[0], n.z + o[1]))
        return { x: n.x + o[0], z: n.z + o[1] };
    }
    return null;
  }

  /** People standing about beside the walk graph, spread out, each facing a stable random way. */
  function loiterSlots(world, pathP) {
    const out = [];
    if (!pathP || !pathP.nodes) return out;
    const rnd = U.rng(U.hash("loiter"));
    pathP.nodes
      .map((n) => ({ n, r: rnd() }))
      .sort((a, b) => a.r - b.r)
      .forEach(function (e) {
        if (out.length >= LOITER_MAX) return;
        const spot = besideNode(world, e.n, rnd);
        if (!spot || out.some((s) => U.dist(s.x, s.z, spot.x, spot.z) < LOITER_APART)) return;
        out.push({
          id: "loiter:" + out.length,
          kind: "loiter",
          x: spot.x,
          z: spot.z,
          heading: rnd() * 6.283,
          group: "loiter:" + out.length,
          index: 0,
        });
      });
    return out;
  }

  G.CrowdZonesMore = {
    build: (world, pathP) =>
      [].concat(shopSlots(world), picnicSlots(world), loiterSlots(world, pathP)),
  };
})((window.KQ = window.KQ || {}));
