/* ============================================================================
 * FILE: crowd-walkers.js
 * PURPOSE: The crowd's strollers: commuters, aunties with shopping, joggers, kids running, elders,
 *          friends walking in pairs and cyclists. They appear on the pavements around the hero,
 *          follow the world's walk graph (sidewalks, zebra crossings, spurs to the places) from
 *          one place to the next, sometimes stop to wait or glance around, and drop away when far.
 * BUSINESS CONTEXT: "bustling" world. Walking only ever follows the walk graph, which the world
 *   keeps clear of buildings, so strollers need no collision handling; each keeps to its own side
 *   of the pavement so people passing in opposite directions do not overlap.
 * DEPENDENCIES: pathing.js (G.Path), crowd-members.js, crowd-zones.js, KQ.Sim.Crowd.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const SC = () => KQ.Sim.Crowd;
  /** A stroller held up this long (s) by something in the way leaves even in view (a stopped bus must not wait for them for ever). */
  const STUCK_GIVE_UP = 4;
  const SPAWN_MIN = 28;
  const SPAWN_MAX = 54;
  const LANE = 0.5;
  /** A lane-shifted waypoint must leave this much room (a person's radius) around it. */
  const LANE_CLEAR = 0.3;
  /** Places a stroller may head for (the mosque hall and wudu area are left to the cast). */
  const SKIP = ["mosque_hall", "mosque_hall_women", "mosque_wudu"];

  /** The graph node ids of the places strollers head for. */
  function destinations(C) {
    if (!C.dests) {
      C.dests = Object.keys(C.world.pois)
        .filter((k) => SKIP.indexOf(k) === -1)
        .map((k) => C.world.pois[k].node);
    }
    return C.dests;
  }

  /** Is (x, z) somewhere a new stroller can appear without anyone noticing? */
  function unseen(C, x, z) {
    return !C.visibleNear(x, z);
  }

  /** A graph node 28-54 m from the hero that is out of sight, or null. */
  function pickSpawnNode(C, hero) {
    const nodes = C.pathP.nodes;
    for (let i = 0; i < 10; i += 1) {
      const n = nodes[Math.floor(C.rng() * nodes.length)];
      const d = U.dist(n.x, n.z, hero.x, hero.z);
      if (d >= SPAWN_MIN && d <= SPAWN_MAX && unseen(C, n.x, n.z)) return n;
    }
    return null;
  }

  /** The polyline sideways by `lane` metres (to the right of the way it goes), segment by segment; null if it clips anything. */
  function shifted(pts, lane, world) {
    const out = [];
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.2) continue;
      const nx = (-(b.z - a.z) / len) * lane;
      const nz = ((b.x - a.x) / len) * lane;
      const ends = out.length ? [b] : [a, b];
      for (let k = 0; k < ends.length; k += 1) {
        const p = { x: ends[k].x + nx, z: ends[k].z + nz };
        const last = out[out.length - 1];
        const free =
          G.CrowdZones.clear(world, p.x, p.z, LANE_CLEAR) &&
          (!last || G.CrowdZones.segmentClear(world, last.x, last.z, p.x, p.z, LANE_CLEAR));
        if (!free) return null;
        out.push(p);
      }
    }
    return out;
  }

  /** The route as waypoints kept to the walker's own side of the pavement, or down the middle where that would clip something. */
  function lanePath(pts, lane, world) {
    const path = shifted(pts, lane, world) || shifted(pts, 0, world);
    return path || pts.map((p) => ({ x: p.x, z: p.z }));
  }

  /** The way from (x, z) to a graph node as lane-shifted waypoints, or null. */
  function routeTo(C, x, z, node, lane) {
    const pts = G.Path.toNode(C.pathP, x, z, node);
    if (!pts || pts.length < 2) return null;
    const path = lanePath(pts, lane, C.world);
    return path.length ? path : null;
  }

  /** Pick where to go next: usually a place, sometimes right across town. */
  function pickDestination(C, fromNode) {
    const list = C.rng() < 0.7 ? destinations(C) : C.pathP.nodes.map((n) => n.id);
    for (let i = 0; i < 6; i += 1) {
      const node = list[Math.floor(C.rng() * list.length)];
      if (node !== fromNode) return node;
    }
    return list[0];
  }

  /** The age role a stroller of this type is drawn from; in a family, the first is the parent and the rest children. */
  function roleOf(type, k) {
    if (type === "family") return k === 0 ? "adult" : "kid";
    if (type === "student") return "student";
    return type === "kid" ? "kid" : type === "elder" ? "elder" : "adult";
  }

  /** The pose a stroller of this type walks with (family members hold hands: a parent and a small child). */
  function poseOf(type, k) {
    return type === "family" && k > 0 ? "walk_hold_kid" : SC().WALKERS[type].pose;
  }

  /** Make a stroller person (not yet placed); `k` is the place in a group (0 = the first). */
  function makeWalker(C, type, id, lane, k) {
    const T = SC().WALKERS[type];
    const female = type === "aunty" ? true : undefined;
    const outfit = SC().outfit(id, roleOf(type, k || 0), female);
    const draw = U.rng(U.hash(id));
    const speed = T.speed[0] + (T.speed[1] - T.speed[0]) * draw();
    return {
      id,
      slot: { id, kind: "walker", sit: false, heading: 0, y: 0 },
      kind: "walker",
      wtype: type,
      outfit,
      kid: outfit.kid,
      scale: outfit.scale,
      x: 0,
      z: 0,
      y: 0,
      heading: 0,
      pose: poseOf(type, k || 0),
      phase: draw(),
      rate: speed * T.cycles,
      show: 0.01,
      leaving: false,
      mode: "walk",
      t: 0,
      draw,
      speed,
      lane,
      path: [],
      wp: 0,
      linger: 0,
      prop: T.prop,
      walker: true,
    };
  }

  /** Start a walker at node `from` heading for `dest`; false when no route exists. */
  function launch(C, m, from, dest) {
    const path = routeTo(C, from.x, from.z, dest, m.lane);
    if (!path) return false;
    m.path = path;
    m.wp = 0;
    m.x = path[0].x;
    m.z = path[0].z;
    m.y = C.world.heightAt(m.x, m.z);
    return true;
  }

  /** Lanes (metres right of the pavement centre) for a group of n walking side by side. */
  function lanesFor(C, n) {
    if (n === 1) return [C.rng() < 0.5 ? LANE : -LANE];
    return n === 2 ? [-LANE * 0.8, LANE * 0.8] : [-LANE * 1.3, 0, LANE * 1.3];
  }

  /** Spawn one stroller (or a group of friends or a family) on a pavement out of sight. Returns the new members. */
  function spawn(C, hero, minute, room) {
    const from = pickSpawnNode(C, hero);
    if (!from) return [];
    const type = SC().walkerType(minute, C.rng());
    const size = Math.min(SC().walkerGroup(type, C.rng()), Math.max(1, room));
    const dest = pickDestination(C, from.id);
    const id = "walker:" + C.serial++;
    const out = [];
    lanesFor(C, size).forEach(function (lane, i) {
      const m = makeWalker(C, type, id + (i ? "abc"[i - 1] : ""), lane, i);
      if (i && out[0]) {
        m.speed = out[0].speed;
        m.rate = out[0].rate;
      }
      if (launch(C, m, from, dest)) out.push(m);
    });
    return out;
  }

  /** Reached the end of a route: linger a while, or head somewhere else; leave if no route. */
  function arrived(C, m) {
    if (m.onArrive) {
      const done = m.onArrive; // a person walking to a vehicle door (vehicle-occupants.js): hand over
      m.onArrive = null;
      done(m);
      if (!m.gone)
        Object.assign(m, { linger: 2, lingerPose: "wait", next: pickDestination(C, -1) });
      return;
    }
    const here = { x: m.x, z: m.z };
    if (m.draw() < 0.3 && m.wtype !== "cyclist" && m.wtype !== "jogger") {
      m.linger = 4 + m.draw() * 6;
      m.lingerPose = ["wait", "phone", "browse"][Math.floor(m.draw() * 3)];
      m.next = pickDestination(C, -1);
      return;
    }
    if (!launch(C, m, here, pickDestination(C, -1))) m.leaving = true;
  }

  /** Linger in place (waiting, on the phone or looking at the shops), then set off again. */
  function lingering(C, m, dt) {
    m.linger -= dt;
    m.pose = m.lingerPose;
    m.rate = SC().WALKERS.commuter.cycles * 0.2;
    if (m.linger <= 0 && m.next !== undefined) {
      if (!launch(C, m, { x: m.x, z: m.z }, m.next)) m.leaving = true;
      m.next = undefined;
      m.pose = SC().WALKERS[m.wtype].pose;
      m.rate = m.speed * SC().WALKERS[m.wtype].cycles;
    }
  }

  /**
   * Something parked on the way (a bicycle on the footway): do not walk into it. Wait where we were, and
   * once nobody can see it happen, leave and let someone else take the walk.
   */
  function holdIfBlocked(C, m, from, dt) {
    if (G.CrowdZones.clear(C.world, m.x, m.z, 0.25)) {
      m.stuck = 0;
      return;
    }
    m.x = from.x;
    m.z = from.z;
    m.stuck = (m.stuck || 0) + dt;
    // unseen, they just go; but someone held up for good (the bus waits for them while they wait for the bus) gives way too
    if (m.stuck > 1 && (!C.visibleNear(m.x, m.z) || m.stuck > STUCK_GIVE_UP)) m.leaving = true;
  }

  /** Step a stroller along its path by dt; make way for the hero as it passes. */
  function update(C, m, dt) {
    if (m.linger > 0) lingering(C, m, dt);
    else if (m.path.length) {
      const goal = m.path[m.wp];
      const from = { x: m.x, z: m.z };
      if (G.CrowdMembers.stepToward(m, goal.x, goal.z, m.speed, dt)) m.wp += 1;
      holdIfBlocked(C, m, from, dt);
      if (m.wp >= m.path.length) {
        m.path = [];
        arrived(C, m);
      }
    }
    m.phase = (m.phase + dt * m.rate) % 1;
    m.show = U.damp(m.show, m.leaving ? 0 : 1, 6, dt);
    m.y = C.world.heightAt(m.x, m.z);
    sidestep(C, m);
  }

  /** Nudge a walker clear of the hero (and cast) when they would overlap. */
  function sidestep(C, m) {
    C.others.forEach(function (o) {
      const d = U.dist(m.x, m.z, o.x, o.z);
      if (d > 0.7 || d < 1e-3) return;
      const k = (0.7 - d) * 0.5;
      const nx = m.x + ((m.x - o.x) / d) * k;
      const nz = m.z + ((m.z - o.z) / d) * k;
      if (G.CrowdZones.clear(C.world, nx, nz, 0.2)) {
        m.x = nx;
        m.z = nz;
      }
    });
  }

  /**
   * Hand a person who just got off a vehicle (or the bus) to the crowd: a stroller of their own outfit starting at
   * (x, z), at once fully shown, heading for a place. Returns the new member, or null when there is no room or
   * no route.
   */
  function adopt(C, outfit, x, z) {
    if (C.members.length >= C.kit.people - 12) return null;
    const id = "walker:" + C.serial++;
    const type = outfit.kid ? "kid" : outfit.age === "elder" ? "elder" : "commuter";
    const m = makeWalker(C, type, id, C.rng() < 0.5 ? LANE : -LANE, 0);
    Object.assign(m, { outfit, kid: outfit.kid, scale: outfit.scale, prop: null });
    if (!launch(C, m, { x, z }, pickDestination(C, -1))) return null;
    m.x = x;
    m.z = z;
    m.show = 1;
    C.members.push(m);
    C.byId.set(m.id, m);
    return m;
  }

  /**
   * Turn a person already in the crowd (a waiting passenger, a walker) into one who walks the given points and then
   * calls onArrive(m). Their old spot is held empty for a minute (C.cool) so the same face does not pop back.
   */
  function redirect(C, m, pts, onArrive) {
    const T = SC().WALKERS.commuter;
    Object.assign(m, {
      walker: true,
      wtype: "commuter",
      mode: "walk",
      path: pts,
      wp: 0,
      linger: 0,
      speed: 1.5,
      rate: 1.5 * T.cycles,
      pose: T.pose,
      lane: 0,
      prop: null,
      onArrive,
      leaving: false,
    });
    C.cool = C.cool || {};
    if (m.slot && m.slot.id) C.cool[m.slot.id] = C.clock + 75;
  }

  G.CrowdWalkers = { spawn, update, adopt, redirect, SPAWN_MIN, SPAWN_MAX };
})((window.KQ = window.KQ || {}));
