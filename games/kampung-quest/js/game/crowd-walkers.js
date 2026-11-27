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
  const SPAWN_MIN = 28;
  const SPAWN_MAX = 54;
  const LANE = 0.5;
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

  /** Move a polyline sideways by `lane` metres (to the right of the way it goes), segment by segment. */
  function lanePath(pts, lane, world) {
    const out = [];
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.2) continue;
      const nx = (-(b.z - a.z) / len) * lane;
      const nz = ((b.x - a.x) / len) * lane;
      [
        [a, 0.0],
        [b, 1],
      ].forEach(function (e) {
        const x = e[0].x + nx;
        const z = e[0].z + nz;
        const ok = G.CrowdZones.clear(world, x, z, 0.2);
        if (e[1] || !out.length) out.push(ok ? { x, z } : { x: e[0].x, z: e[0].z });
      });
    }
    return out;
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

  /** Make a stroller person (not yet placed). */
  function makeWalker(C, type, id, lane) {
    const T = SC().WALKERS[type];
    const role = type === "kid" ? "kid" : type === "elder" ? "elder" : "adult";
    const female = type === "aunty" ? true : undefined;
    const outfit = SC().outfit(id, role, female);
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
      pose: T.pose,
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

  /** Spawn one stroller (or a pair of friends) on a pavement out of sight. Returns the new members. */
  function spawn(C, hero, minute, allowPair) {
    const from = pickSpawnNode(C, hero);
    if (!from) return [];
    const type = SC().walkerType(minute, C.rng());
    const pair =
      allowPair && ["commuter", "stroller", "elder"].indexOf(type) !== -1 && C.rng() < 0.3;
    const dest = pickDestination(C, from.id);
    const id = "walker:" + C.serial++;
    const out = [];
    const lanes = pair ? [-LANE * 0.8, LANE * 0.8] : [C.rng() < 0.5 ? LANE : -LANE];
    lanes.forEach(function (lane, i) {
      const m = makeWalker(C, type, id + (i ? "b" : ""), lane);
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

  /** Step a stroller along its path by dt; make way for the hero as it passes. */
  function update(C, m, dt) {
    if (m.linger > 0) lingering(C, m, dt);
    else if (m.path.length) {
      const goal = m.path[m.wp];
      if (G.CrowdMembers.stepToward(m, goal.x, goal.z, m.speed, dt)) m.wp += 1;
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

  G.CrowdWalkers = { spawn, update, SPAWN_MIN, SPAWN_MAX };
})((window.KQ = window.KQ || {}));
