/* ============================================================================
 * FILE: npc-goals.js
 * PURPOSE: Turns a schedule routine ({poi, activity, indoors}) into a concrete NPC goal:
 *          a standing spot, a seat, a prayer-row slot, a cook spot behind a stall counter,
 *          a wander area, or "indoors" (hidden unless the hero is near the door).
 * BUSINESS CONTEXT: AC-5 and business rule 5 (Muslim NPCs pray in a row facing the qibla;
 *   the imam stands in front). Hall geometry from the world: qibla is -X, columns at
 *   (-46|-38, -40|-26), mihrab on the west wall.
 * DEPENDENCIES: collide.js, seats.js, util.js, KQ.Sim.Schedule output.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const HERO_SPOT = { x: -45, z: -33 };
  const IMAM_SPOT = { x: -48.6, z: -33 };
  const SEAT_RANGE = 14;

  /** Prayer-row slots in the men's hall, nearest the hero's own spot first. */
  function buildSlots(world) {
    const slots = [];
    [-48.6, -45, -42.2, -39.6].forEach(function (x) {
      for (let z = -43.6; z <= -27; z += 2) {
        if (U.dist(x, z, HERO_SPOT.x, HERO_SPOT.z) < 1.5) continue;
        if (U.dist(x, z, IMAM_SPOT.x, IMAM_SPOT.z) < 1.3) continue;
        if (G.Collide.blockedAt(world.colliders, x, z, 0.65)) continue;
        if (Math.abs(x - HERO_SPOT.x) < 1.8 && z > HERO_SPOT.z) continue; // the camera's side of the hero
        slots.push({ x, z, taken: null });
      }
    });
    slots.sort(
      (a, b) =>
        U.dist(a.x, a.z, HERO_SPOT.x, HERO_SPOT.z) - U.dist(b.x, b.z, HERO_SPOT.x, HERO_SPOT.z),
    );
    return slots;
  }

  function claimSlot(M, A) {
    if (A.id === "imam_hakim") return { x: IMAM_SPOT.x, z: IMAM_SPOT.z };
    const free = M.slots.find((s) => !s.taken || s.taken === A.id);
    if (!free) return null;
    free.taken = A.id;
    return free;
  }

  function releaseSlot(M, A) {
    M.slots.forEach(function (s) {
      if (s.taken === A.id) s.taken = null;
    });
  }

  function stallCook(poi) {
    return { x: poi.pos.x, z: poi.pos.z - 2.1 };
  }

  /** A personal standing spot near the POI so figures do not stack on one point. */
  function standSpot(M, A, poi) {
    const a = (U.hash(A.id) % 628) / 100;
    const r = 0.8 + (U.hash(A.id + "r") % 80) / 100;
    return G.Collide.freeSpot(
      M.world.colliders,
      poi.pos.x + Math.cos(a) * r,
      poi.pos.z + Math.sin(a) * r,
      0.4,
    );
  }

  function sitGoal(M, A, poi, r) {
    const seat = G.Seats.claim(
      M.seats,
      poi.pos.x,
      poi.pos.z,
      Math.max(poi.radius, SEAT_RANGE),
      A.id,
    );
    if (!seat) return null;
    A.seat = seat;
    return {
      kind: "sit",
      activity: r.activity,
      x: seat.x,
      z: seat.z,
      y: seat.y,
      heading: seat.heading,
      ghostLeg: true,
    };
  }

  function prayGoal(M, A, poi) {
    const slot = claimSlot(M, A);
    if (!slot) return { kind: "stand", x: poi.pos.x, z: poi.pos.z, heading: poi.facing };
    A.slot = slot;
    return { kind: "pray", x: slot.x, z: slot.z, heading: -Math.PI / 2, ghostLeg: true };
  }

  /** Build the goal for a routine. Releases whatever the agent held before. */
  function goalFor(M, A, r) {
    G.Seats.release(M.seats, A.id);
    releaseSlot(M, A);
    A.seat = A.slot = null;
    const poi = M.world.pois[r.poi] || M.world.pois.park;
    if (r.indoors) {
      return { kind: "hide", x: poi.pos.x, z: poi.pos.z, heading: poi.facing, home: r.poi };
    }
    if (r.activity === "pray") return prayGoal(M, A, poi);
    if (r.activity === "sit" || r.activity === "eat") {
      const g = sitGoal(M, A, poi, r);
      if (g) return g;
    }
    if (r.activity === "walk" || r.activity === "play") {
      const free = r.activity === "play";
      return { kind: "wander", x: poi.pos.x, z: poi.pos.z, heading: poi.facing, free, poi: r.poi };
    }
    if (r.poi.indexOf("stall_") === 0) {
      const cook = stallCook(poi);
      return { kind: "stand", x: poi.pos.x, z: poi.pos.z, heading: 0, cookSpot: cook };
    }
    const s = standSpot(M, A, poi);
    return { kind: "stand", x: s.x, z: s.z, heading: poi.facing, ghostLeg: false };
  }

  /** A random nearby place for a strolling / playing NPC, or null. */
  function pickWander(M, A) {
    const g = A.goal;
    const poi = M.world.pois[g.poi];
    if (g.free) {
      const a = A.rng() * Math.PI * 2;
      const r = 1 + A.rng() * Math.min(5, poi.radius * 0.7);
      return G.Collide.freeSpot(
        M.world.colliders,
        poi.pos.x + Math.cos(a) * r,
        poi.pos.z + Math.sin(a) * r,
        0.4,
      );
    }
    const nodes = G.Path.nodesNear(M.pathP, poi.pos.x, poi.pos.z, Math.min(14, poi.radius + 8));
    const n = nodes[Math.floor(A.rng() * nodes.length)];
    return n ? { x: n.x, z: n.z } : null;
  }

  G.NpcGoals = { buildSlots, goalFor, pickWander, releaseSlot, HERO_SPOT };
})((window.KQ = window.KQ || {}));
