/* ============================================================================
 * FILE: crowd.js
 * PURPOSE: The neighbourhood crowd: keeps a capped population of extras alive around the hero
 *          (the fixed spots that are busy right now, plus strollers on the pavements), steps them,
 *          and draws them all through one instanced kit (KQ.Figures.CrowdKit).
 * BUSINESS CONTEXT: "bustling" world. People appear and vanish only where the hero cannot see
 *   it (behind the camera or far away); the headcount follows the time of day and the quality
 *   tier, and nobody beyond range is simulated or drawn, so the cost stays flat as the town grows.
 * DEPENDENCIES: crowd-zones.js, crowd-members.js, crowd-walkers.js, npc-manager.js (seats, cast
 *   positions), KQ.Sim.Crowd, KQ.Figures.CrowdKit.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const SC = () => KQ.Sim.Crowd;
  /** Spots within this range of the hero may be occupied; people leave beyond DESPAWN_R. */
  const SPAWN_R = 60;
  const DESPAWN_R = 68;
  /** Nobody pops in or out of existence closer than this when the hero could see it. */
  const POP_NEAR = 30;
  const RENDER_R = { low: 46, med: 60, high: 74 };
  const RECONCILE_S = 0.4;
  const MAX_PEOPLE = KQ.region === "haramain" ? 210 : 130;
  const CROWD_SEAT = "crowd";

  /**
   * Build the crowd: the instanced kit, every fixed spot and the bookkeeping.
   * @param scene the THREE scene; world the neighbourhood; npcs the NPC manager (seats, walk graph);
   *   renderer the WebGL renderer (for the reflection); camera the game camera.
   */
  function create(scene, world, npcs, renderer, camera) {
    const kit = KQ.Figures.CrowdKit.create(scene, MAX_PEOPLE, KQ.Figures.makeEnv(renderer));
    return {
      world,
      npcs,
      pathP: npcs.pathP,
      camera,
      kit,
      slots: G.CrowdZones.build(world, npcs.seats),
      members: [],
      byId: new Map(),
      others: [],
      clock: 0,
      accT: RECONCILE_S,
      spawnT: 0,
      serial: 0,
      rng: U.rng(20261127),
      tier: "med",
      lastHero: null,
      lastMinute: -1,
      instant: true,
      view: { x: 0, z: 0, fx: 0, fz: 1 },
      dir: new THREE.Vector3(),
      canSee: null,
      visibleNear: null,
    };
  }

  /** Refresh the camera's position and heading on the ground plane. */
  function readView(C) {
    const cam = C.camera;
    cam.getWorldDirection(C.dir);
    const len = Math.hypot(C.dir.x, C.dir.z) || 1;
    C.view.x = cam.position.x;
    C.view.z = cam.position.z;
    C.view.fx = C.dir.x / len;
    C.view.fz = C.dir.z / len;
  }

  /** Cosine of the angle between the camera heading and the direction to (x, z), and the distance. */
  function aim(C, x, z) {
    const dx = x - C.view.x;
    const dz = z - C.view.z;
    const d = Math.hypot(dx, dz) || 1e-6;
    return { d, dot: (dx * C.view.fx + dz * C.view.fz) / d };
  }

  /** Is (x, z) inside what the camera could be showing and close enough to be drawn? */
  function canSee(C, x, z) {
    const a = aim(C, x, z);
    return a.d < 4.5 || (a.d < RENDER_R[C.tier] && a.dot > 0.12);
  }

  /** Would a person popping in at (x, z) be noticed? (Within range and in front of the camera.) */
  function visibleNear(C, x, z) {
    const a = aim(C, x, z);
    return a.d < POP_NEAR && (a.d < 4.5 || a.dot > 0.0);
  }

  /** Everything people must make way for: the hero and the cast neighbours who are out and about. */
  function gatherOthers(C, hero) {
    const list = C.others;
    list.length = 0;
    list.push(hero);
    C.npcs.agents.forEach((A) => !A.hidden && list.push(A));
  }

  /** Did the hero teleport or the clock jump? Then fill the town at once instead of fading it in. */
  function detectJump(C, hero, minute) {
    const moved = C.lastHero ? U.dist(hero.x, hero.z, C.lastHero.x, C.lastHero.z) : 999;
    const gap = Math.abs(minute - C.lastMinute);
    C.lastHero = { x: hero.x, z: hero.z };
    C.lastMinute = minute;
    return moved > 12 || (gap > 4 && gap < 1400);
  }

  /** May a person appear or vanish at (x, z) right now? */
  function mayPop(C, x, z) {
    return C.instant || !visibleNear(C, x, z);
  }

  /** The seat object of the cast manager that goes with a crowd slot, or null for standing spots. */
  function seatOf(C, slot) {
    return slot.sit ? C.npcs.seats[slot.seat] : null;
  }

  /** Put a new person at a slot (claiming its seat). */
  function admit(C, slot, minute) {
    const m = G.CrowdMembers.create(slot, SC().blockOf(minute), C.instant);
    C.members.push(m);
    C.byId.set(m.id, m);
    const seat = seatOf(C, slot);
    if (seat) seat.taken = CROWD_SEAT;
  }

  /** Drop a person (freeing their seat). */
  function release(C, m) {
    C.byId.delete(m.id);
    C.members.splice(C.members.indexOf(m), 1);
    const seat = m.slot && seatOf(C, m.slot);
    if (seat && seat.taken === CROWD_SEAT) seat.taken = null;
  }

  /** Which fixed spots should be occupied now: the busy, free ones nearest the hero, within budget. */
  function wantedSlots(C, hero, minute, budget) {
    const occ = {};
    SC().KINDS.forEach((k) => (occ[k] = SC().occupancy(k, minute)));
    const list = [];
    C.slots.forEach(function (s) {
      const d = U.dist(s.x, s.z, hero.x, hero.z);
      if (d > SPAWN_R || !SC().slotActive(s.id, occ[s.kind], minute)) return;
      const seat = seatOf(C, s);
      if (seat && seat.taken && seat.taken !== CROWD_SEAT) return;
      list.push({ s, d });
    });
    list.sort((a, b) => a.d - b.d);
    return list.slice(0, budget);
  }

  /** Bring the fixed-spot population in line with what is wanted (only popping where nobody looks). */
  function reconcileSpots(C, hero, minute, budget) {
    const want = wantedSlots(C, hero, minute, budget);
    const ids = new Set(want.map((w) => w.s.id));
    C.members.slice().forEach(function (m) {
      if (m.walker || ids.has(m.id)) return;
      const far = U.dist(m.x, m.z, hero.x, hero.z) > DESPAWN_R;
      m.leaving = far || mayPop(C, m.x, m.z) || m.leaving;
    });
    want.forEach(function (w) {
      const have = C.byId.get(w.s.id);
      if (have) have.leaving = false;
      else if (mayPop(C, w.s.x, w.s.z)) admit(C, w.s, minute);
    });
  }

  /** Add one stroller (or a pair) on a pavement out of sight. */
  function addStroller(C, hero, minute) {
    G.CrowdWalkers.spawn(C, hero, minute, SC().capFor(C.tier) - C.members.length >= 2).forEach(
      function (m) {
        if (C.instant) m.show = 1;
        C.members.push(m);
        C.byId.set(m.id, m);
      },
    );
  }

  /** Spawn and retire strollers to follow the time-of-day target. */
  function reconcileWalkers(C, hero, minute, target) {
    const walkers = C.members.filter((m) => m.walker);
    walkers.forEach(function (m) {
      if (U.dist(m.x, m.z, hero.x, hero.z) > DESPAWN_R) m.leaving = true;
    });
    const live = walkers.filter((m) => !m.leaving).length;
    if (live > target + 2) {
      const far = walkers
        .filter((m) => !m.leaving)
        .sort((a, b) => U.dist(b.x, b.z, hero.x, hero.z) - U.dist(a.x, a.z, hero.x, hero.z))[0];
      if (far && mayPop(C, far.x, far.z)) far.leaving = true;
    }
    const room = Math.min(target - live, SC().capFor(C.tier) - C.members.length);
    for (let i = 0; i < (C.instant ? room : Math.min(1, room)); i += 1)
      addStroller(C, hero, minute);
  }

  /** The twice-a-second job: decide who is here. */
  function reconcile(C, hero, minute) {
    const cap = SC().capFor(C.tier);
    const target = SC().walkerTarget(minute, C.tier);
    reconcileSpots(C, hero, minute, Math.max(0, cap - target));
    reconcileWalkers(C, hero, minute, target);
    C.members.slice().forEach(function (m) {
      if (m.leaving && m.show < 0.06) release(C, m);
    });
  }

  /** Step every person and draw the ones in view. */
  function stepAndDraw(C, dt, hero) {
    const kit = C.kit;
    KQ.Figures.CrowdKit.begin(kit);
    C.members.forEach(function (m) {
      if (m.walker) G.CrowdWalkers.update(C, m, dt);
      else G.CrowdMembers.update(m, dt, C);
      if (m.show < 0.03 || !canSee(C, m.x, m.z)) return;
      const grow = m.show * m.show * (3 - 2 * m.show);
      KQ.Figures.CrowdKit.add(kit, {
        x: m.x,
        y: m.y,
        z: m.z,
        heading: m.heading,
        scale: m.scale * Math.max(0.01, grow),
        pose: m.pose,
        phase: m.phase,
        kid: m.kid,
        girth: m.outfit.girth,
        outfit: m.outfit,
        prop: m.prop,
      });
    });
    KQ.Figures.CrowdKit.end(kit);
    return hero;
  }

  /**
   * Per-frame step.
   * @param {object} C the crowd from create()
   * @param {number} dt seconds
   * @param {{x:number,z:number}} hero the hero's ground position
   * @param {{minute:number, tier:string, night:number}} ctx game minute, quality tier, 0..1 night
   */
  function update(C, dt, hero, ctx) {
    C.tier = ctx.tier;
    C.clock += dt;
    C.canSee = (x, z) => canSee(C, x, z);
    C.visibleNear = (x, z) => visibleNear(C, x, z);
    readView(C);
    gatherOthers(C, hero);
    if (detectJump(C, hero, ctx.minute)) C.instant = true;
    if (KQ.region === "haramain") G.CrowdHoly.tick(C.slots, C.clock);
    C.accT += dt;
    if (C.accT >= RECONCILE_S || C.instant) {
      C.accT = 0;
      reconcile(C, hero, ctx.minute);
      if (C.instant) reconcile(C, hero, ctx.minute);
      C.instant = false;
    }
    C.kit.material.envMapIntensity = 0.7 * (1 - 0.6 * ctx.night);
    stepAndDraw(C, dt, hero);
  }

  /** Counts for tests and the dev overlay. */
  function debug(C) {
    const byKind = {};
    C.members.forEach((m) => (byKind[m.kind] = (byKind[m.kind] || 0) + 1));
    return {
      active: C.members.length,
      drawn: C.kit.drawn,
      walkers: C.members.filter((m) => m.walker).length,
      byKind,
      slots: C.slots.length,
      cap: SC().capFor(C.tier),
    };
  }

  /** Everyone's ground position and what they are doing (for tests that check nobody is in a wall). */
  function positions(C) {
    return C.members.map((m) => ({
      id: m.id,
      kind: m.kind,
      x: m.x,
      z: m.z,
      pose: m.pose,
      seated: Boolean(m.slot.sit),
      wtype: m.wtype || null,
      prop: m.prop || null,
      walker: m.walker,
    }));
  }

  /** Show every crowd mesh for a shader compile (true) or hide the unused ones again (false). */
  function showAll(C, on) {
    KQ.Figures.CrowdKit.showAll(C.kit, on);
  }

  G.Crowd = { create, update, debug, positions, showAll, SPAWN_R, DESPAWN_R };
})((window.KQ = window.KQ || {}));
