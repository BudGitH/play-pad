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
  const SEAT_RANGE = 14;

  const IMAM_SPOT_X = -49.2;
  const WOMEN = [
    "nenek",
    "makcik_siti",
    "hawker_aminah",
    "dr_nurul",
    "librarian_farah",
    "kid_aisyah",
  ];

  /**
   * Prayer slots. Men: straight saf lines across the hall (x = -45 is the hero's own saf, then two
   * more behind it), imam alone in front, all north of the hero so the camera side stays clear.
   * Women: columns of three in the women's section behind the screen. Everyone faces the qibla (-X).
   */
  function buildSlots(world) {
    const men = [];
    [-45, -42.6, -40.2].forEach(function (x) {
      for (let k = x === HERO_SPOT.x ? 1 : 0; k < 8; k += 1) {
        const z = HERO_SPOT.z - k * 1.6;
        if (!G.Collide.blockedAt(world.colliders, x, z, 0.65)) men.push({ x, z, taken: null });
      }
    });
    const women = [];
    for (let x = -37; x >= -49; x -= 2.4) {
      [-24, -22.7, -21.4].forEach(function (z) {
        if (!G.Collide.blockedAt(world.colliders, x, z, 0.6)) women.push({ x, z, taken: null });
      });
    }
    return { men, women };
  }

  /**
   * Claim a free prayer-row slot for an NPC (the imam has his own spot, women use the women's
   * rows); null when full.
   */
  function claimSlot(M, A) {
    if (A.id === "imam_hakim") return { x: IMAM_SPOT_X, z: HERO_SPOT.z };
    const list = WOMEN.indexOf(A.id) !== -1 ? M.slots.women : M.slots.men;
    const free = list.find((s) => !s.taken || s.taken === A.id);
    if (!free) return null;
    free.taken = A.id;
    return free;
  }

  /** Free any prayer-row slot held by an NPC. */
  function releaseSlot(M, A) {
    M.slots.men.concat(M.slots.women).forEach(function (s) {
      if (s.taken === A.id) s.taken = null;
    });
  }

  /** Where a stall's cook stands: just behind the counter. */
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

  /** A goal to sit at a free seat near a place, or null if every seat is taken. */
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

  /**
   * A goal to pray in a free row spot facing the qibla, or simply stand at the mosque when the rows
   * are full.
   */
  function prayGoal(M, A, poi) {
    const slot = claimSlot(M, A);
    if (!slot) return { kind: "stand", x: poi.pos.x, z: poi.pos.z, heading: poi.facing };
    A.slot = slot;
    const women = WOMEN.indexOf(A.id) !== -1;
    return {
      kind: "pray",
      x: slot.x,
      z: slot.z,
      heading: -Math.PI / 2,
      ghostLeg: true,
      pathPoi: women ? "mosque_hall_women" : "mosque_hall",
    };
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
