/* ============================================================================
 * FILE: crowd-zones.js
 * PURPOSE: Finds every fixed spot where a crowd extra can stand, sit, queue or exercise: hawker
 *          and void-deck stools, stall queues, lift lobbies, the bus stop, chat circles,
 *          tai chi grids, kids' play areas and sweeping lines. Built once from the world.
 * BUSINESS CONTEXT: "bustling" world. Every spot is checked against the world colliders (a spot
 *   inside a wall, pillar, table or fence is dropped), so nobody is ever placed in a building.
 * DEPENDENCIES: collide.js, seats.js (the shared seat list), KQ.WorldParts.LAYOUT, KQ.Sim.Crowd.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const C = () => KQ.Sim.Crowd;
  const BODY = 0.3;

  /** Is a person-sized circle at (x, z) clear of every collider? */
  function clear(world, x, z, r) {
    return !G.Collide.blockedAt(world.colliders, x, z, r === undefined ? BODY : r);
  }

  /** Is the straight walk from a to b clear (sampled every 0.4 m)? */
  function segmentClear(world, ax, az, bx, bz, r) {
    const n = Math.max(1, Math.ceil(U.dist(ax, az, bx, bz) / 0.4));
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      if (!clear(world, ax + (bx - ax) * t, az + (bz - az) * t, r)) return false;
    }
    return true;
  }

  /** Which kind of crowd a seat belongs to: hawker diners, the bus stop, or benches and stone tables. */
  function seatKind(seat) {
    const H = KQ.WorldParts.LAYOUT.hawker;
    if (seat.x > H.x0 - 1 && seat.x < H.x1 + 1 && seat.z > H.z0 && seat.z < H.z1 + 1)
      return "diner";
    const B = KQ.WorldParts.LAYOUT.busStop;
    if (seat.x > B.x0 - 1 && seat.x < B.x1 + 1 && seat.z > B.z0 - 1 && seat.z < B.z1 + 1)
      return "bus";
    return "bench";
  }

  const FURNITURE = ["table", "bench", "bus-bench"];

  /** The index of the table or bench a seat belongs to (nearest centre within 1.4 m), or -1. */
  function furnitureOf(world, seat) {
    let best = -1;
    let bestD = 1.4;
    world.colliders.forEach(function (c, i) {
      if (FURNITURE.indexOf(c.kind) === -1) return;
      const d = U.dist(seat.x, seat.z, (c.minX + c.maxX) / 2, (c.minZ + c.maxZ) / 2);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /** Seats as slots; `seat` is the seat's number in the shared list (so the cast can claim the same ones). */
  function seatSlots(world, seats) {
    const counts = {};
    return seats
      .map(function (s, i) {
        const kind = seatKind(s);
        const group = "seat:" + furnitureOf(world, s);
        counts[group] = (counts[group] || 0) + 1;
        return {
          id: kind + ":s" + i,
          kind,
          x: s.x,
          z: s.z,
          y: s.y,
          heading: s.heading,
          seat: i,
          group,
          index: counts[group] - 1,
          sit: true,
        };
      })
      .map((slot) => Object.assign(slot, { size: counts[slot.group] }));
  }

  /** The people queueing at each stall, standing along the counter. */
  function queueSlots(world) {
    const out = [];
    Object.keys(world.pois)
      .filter((k) => k.indexOf("stall_") === 0)
      .forEach(function (id) {
        const p = world.pois[id].pos;
        C()
          .queueSlots(p.x + 0.95, p.z + 0.12, 5, 0.74, 1, Math.PI)
          .forEach(function (q, i) {
            if (!clear(world, q.x, q.z)) return;
            out.push({
              id: "queue:" + id + ":" + i,
              kind: "queue",
              x: q.x,
              z: q.z,
              heading: q.heading,
              index: i,
              group: "queue:" + id,
            });
          });
      });
    return out;
  }

  /** People waiting for the lift at each block's lobby, facing the lift doors. */
  function liftSlots(world) {
    const out = [];
    KQ.WorldParts.LAYOUT.blocks.forEach(function (b) {
      const s = b.corridor === "+z" ? 1 : -1;
      const zc = s > 0 ? b.z1 : b.z0;
      const zw = zc - s * 1.6;
      const zb = s > 0 ? b.z0 : b.z1;
      const fz = s > 0 ? Math.max(zw, zb) - 2 + 0.02 : Math.min(zw, zb) + 2 - 0.02;
      const xc = (b.x0 + b.x1) / 2;
      const heading = s > 0 ? Math.PI : 0;
      [
        [-1.2, 0.85],
        [1.2, 0.85],
        [0, 1.0],
        [-1.7, 1.6],
        [0.5, 1.7],
        [1.9, 1.5],
        [-2.5, 0.9],
        [2.6, 0.9],
        [-0.7, 2.3],
        [1.3, 2.5],
      ].forEach(function (o, i) {
        const x = xc + o[0];
        const z = fz + s * o[1];
        if (clear(world, x, z))
          out.push({
            id: "lift:" + b.id + ":" + i,
            kind: "lift",
            x,
            z,
            heading,
            group: "lift:" + b.id,
          });
      });
    });
    return out;
  }

  /** People standing at the bus stop, looking up the road. */
  function busSlots(world) {
    const B = KQ.WorldParts.LAYOUT.busStop;
    const out = [];
    [17.2, 18.5, 19.8, 21.2, 22.4, 23.3, 25, 26.3, 27.6, 28.9].forEach(function (x, i) {
      [0.6, 1.6].forEach(function (dz, row) {
        const z = B.z0 + dz;
        if (!clear(world, x, z)) return;
        const id = "bus:stand:" + row + ":" + i;
        out.push({ id, kind: "bus", x, z, heading: Math.PI, group: "bus:stand" });
      });
    });
    return out;
  }

  /** Rectangles to look for open floor in, with how many chat circles each should hold. */
  const CHAT_AREAS = [
    { name: "hawker", x0: 14, x1: 38, z0: -27, z1: -11, groups: 5 },
    { name: "hawkerFront", x0: 14, x1: 40, z0: -11.5, z1: -6.8, groups: 3 },
    { name: "shopFront", x0: 42, x1: 70, z0: -11.5, z1: -6.8, groups: 3 },
    { name: "mosqueYard", x0: -30, x1: -14, z0: -44, z1: -12, groups: 3 },
    { name: "libraryFront", x0: 46, x1: 66, z0: -39, z1: -28, groups: 2 },
    { name: "voidA", x0: -55, x1: -25, z0: 16.5, z1: 24.5, groups: 3 },
    { name: "voidB", x0: -55, x1: -25, z0: 46.5, z1: 54.5, groups: 3 },
    { name: "voidC", x0: 35, x1: 63, z0: 46.5, z1: 54.5, groups: 3 },
    { name: "blockAFront", x0: -55, x1: -26, z0: 8, z1: 14.5, groups: 3 },
    { name: "blockABLawn", x0: -55, x1: -26, z0: 27, z1: 44, groups: 3 },
    { name: "blockCFront", x0: 34, x1: 64, z0: 38, z1: 45, groups: 3 },
    { name: "carpark", x0: -20, x1: -8, z0: 28, z1: 44, groups: 2 },
    { name: "playground", x0: 12, x1: 29, z0: 12, z1: 29, groups: 3 },
    { name: "park", x0: 34, x1: 70, z0: 10, z1: 38, groups: 6 },
  ];

  /** Candidate points on a jittered grid in an area, the open ones first in a seeded random order. */
  function openPoints(world, area, clearance, step) {
    const rnd = U.rng(U.hash(area.name));
    const pts = [];
    for (let x = area.x0; x <= area.x1; x += step) {
      for (let z = area.z0; z <= area.z1; z += step) {
        const px = x + (rnd() - 0.5) * step * 0.6;
        const pz = z + (rnd() - 0.5) * step * 0.6;
        if (clear(world, px, pz, clearance)) pts.push({ x: px, z: pz, r: rnd() });
      }
    }
    return pts.sort((a, b) => a.r - b.r);
  }

  /** Chat circles: 2 to 4 people facing each other, spread out inside each area. */
  function chatSlots(world) {
    const out = [];
    CHAT_AREAS.forEach(function (area) {
      const taken = [];
      openPoints(world, area, 1.3, 2.5).forEach(function (p) {
        if (taken.length >= area.groups || taken.some((q) => U.dist(p.x, p.z, q.x, q.z) < 6))
          return;
        taken.push(p);
        const size = p.r < 0.4 ? 2 : p.r < 0.75 ? 3 : p.r < 0.93 ? 4 : 5;
        const gid = "chat:" + area.name + ":" + taken.length;
        C()
          .circleSlots(p.x, p.z, size, 0.5 + 0.08 * size, p.r * 6)
          .forEach((q, i) =>
            out.push({
              id: gid + ":" + i,
              kind: "chat",
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

  /** Tai chi / stretching groups on open ground in the park, everyone facing the same way. */
  function exerciseSlots(world) {
    const out = [];
    const park = { name: "taiji", x0: 36, x1: 68, z0: 12, z1: 36 };
    const taken = [];
    openPoints(world, park, 3.2, 3).forEach(function (p) {
      if (taken.length >= 4 || taken.some((q) => U.dist(p.x, p.z, q.x, q.z) < 9)) return;
      taken.push(p);
      const gid = "exercise:" + taken.length;
      C()
        .gridSlots(p.x, p.z, 3, 2, 1.35, Math.PI * (taken.length % 2 ? 1 : 0.5))
        .forEach((q, i) =>
          out.push({
            id: gid + ":" + i,
            kind: "exercise",
            x: q.x,
            z: q.z,
            heading: q.heading,
            group: gid,
            index: i,
          }),
        );
    });
    return out;
  }

  /** Where kids run and play: a centre and radius, validated per target at run time. */
  const PLAY_AREAS = [
    { id: "playground", x: 21.5, z: 22, r: 7, n: 10 },
    { id: "park", x: 52, z: 24, r: 9, n: 7 },
    { id: "parkW", x: 40, z: 31, r: 5, n: 3 },
    { id: "voidA", x: -40, z: 22.8, r: 4.5, n: 4 },
    { id: "voidB", x: -40, z: 50.5, r: 4.5, n: 4 },
    { id: "voidC", x: 49, z: 50.5, r: 4.5, n: 4 },
    { id: "lawnAB", x: -40, z: 35, r: 6, n: 3 },
  ];

  /** Roaming kids' slots. */
  function playSlots(world) {
    const out = [];
    PLAY_AREAS.forEach(function (a) {
      for (let i = 0; i < a.n; i += 1) {
        const rnd = U.rng(U.hash(a.id + i));
        const ang = rnd() * 6.28;
        const spot = G.Collide.freeSpot(
          world.colliders,
          a.x + Math.cos(ang) * a.r * 0.5,
          a.z + Math.sin(ang) * a.r * 0.5,
          BODY,
        );
        out.push({
          id: "play:" + a.id + ":" + i,
          kind: "play",
          x: spot.x,
          z: spot.z,
          heading: rnd() * 6.28,
          roam: { x: a.x, z: a.z, r: a.r },
        });
      }
    });
    return out;
  }

  /** Cleaners' sweeping lines: the first clear stretch found in each candidate area. */
  const SWEEP_LINES = [
    { id: "hawker", x0: 26, z0: -23, x1: 26, z1: -14 },
    { id: "voidA", x0: -50, z0: 22.6, x1: -45, z1: 22.6 },
    { id: "voidB", x0: -50, z0: 48.4, x1: -45, z1: 48.4 },
    { id: "hawkerFront", x0: 16, z0: -10, x1: 30, z1: -10 },
    { id: "shopFront", x0: 46, z0: -10, x1: 66, z1: -10 },
    { id: "mosqueYard", x0: -26, z0: -40, x1: -26, z1: -20 },
    { id: "busStop", x0: 15, z0: 9.5, x1: 31, z1: 9.5 },
    { id: "voidC", x0: 40, z0: 48.4, x1: 46, z1: 48.4 },
    { id: "parkPath", x0: 38, z0: 12, x1: 38, z1: 22 },
  ];

  /** Sweepers: a line to pace along, kept only when the whole line is clear. */
  function sweepSlots(world) {
    return SWEEP_LINES.filter((l) => segmentClear(world, l.x0, l.z0, l.x1, l.z1, 0.35)).map(
      (l) => ({
        id: "sweep:" + l.id,
        kind: "sweep",
        x: l.x0,
        z: l.z0,
        heading: Math.atan2(l.x1 - l.x0, l.z1 - l.z0),
        line: l,
      }),
    );
  }

  /**
   * Every fixed spot in the world.
   * @param {object} world the built neighbourhood
   * @param {Array} seats the shared seat list (G.Seats.build)
   * @param {object} [pathP] the walk graph (loners stand beside its nodes)
   * @returns {Array<object>} slots: { id, kind, x, z, heading, y?, sit?, seat?, group?, index?, ... }
   */
  function build(world, seats, pathP) {
    if (KQ.region === "haramain") return G.CrowdHoly.build(world, pathP);
    const all = [].concat(
      seatSlots(world, seats),
      queueSlots(world),
      liftSlots(world),
      busSlots(world),
      chatSlots(world),
      exerciseSlots(world),
      playSlots(world),
      sweepSlots(world),
      G.CrowdZonesMore.build(world, pathP),
    );
    all.forEach(function (s) {
      if (s.y === undefined) s.y = world.heightAt(s.x, s.z);
    });
    return all;
  }

  /** Is a slot still usable now? (Seats and the circling pilgrims always are; the rest must have room.) */
  function usable(world, s) {
    if (s.sit || s.holy === "orbit" || s.holy === "lane") return true;
    if (s.line) return segmentClear(world, s.line.x0, s.line.z0, s.line.x1, s.line.z1, 0.5);
    return clear(world, s.x, s.z, 0.25);
  }

  /**
   * Drop the slots that something built after the world has since taken (parked cars, bicycles and
   * scooters are placed on the first frame, after the crowd is laid out).
   */
  function prune(world, slots) {
    return slots.filter((s) => usable(world, s));
  }

  G.CrowdZones = { build, clear, segmentClear, openPoints, prune };
})((window.KQ = window.KQ || {}));
