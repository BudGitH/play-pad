/* ============================================================================
 * FILE: crowd-members.js
 * PURPOSE: One crowd extra standing, sitting, queueing, chatting, exercising, sweeping or
 *          roaming at a fixed spot: builds the person from a slot, picks which pose it holds
 *          right now (so a table talks in turn, a queue shuffles its weight) and steps it.
 * BUSINESS CONTEXT: "bustling" world. Extras are scenery with manners: they stay out of walls
 *   (every spot and every roaming target is collider-checked), make way for the hero and the
 *   cast, and never need collision resolution of their own.
 * DEPENDENCIES: crowd-zones.js, util.js, KQ.Sim.Crowd, KQ.Figures (seatDrop numbers, poses).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const SC = () => KQ.Sim.Crowd;
  const MAKE_WAY = 0.85;
  const MAX_SHIFT = 0.45;
  /** A person at a fixed spot re-chooses their pose this often (seconds), not every frame. */
  const POSE_EVERY_S = 1.5;
  const RATES = { idle: 0.22, sit: 0.22, eat: 0.4, talk: 0.55, walk: 1.2, run: 2.6 };

  /** The age group each kind of spot draws its people from. */
  const ROLE = { play: "kid", exercise: "elder", bench: "any", sweep: "adult" };

  /** Loop speed (cycles per second) of a pose. */
  function rateOf(pose) {
    return RATES[pose] || KQ.Figures.CROWD_RATES[pose] || 0.3;
  }

  /** A cleaner's high-visibility outfit. */
  function cleanerOutfit(seed) {
    const o = SC().outfit(seed, "adult");
    return Object.assign(o, {
      top: "#f08a24",
      long: true,
      legs: "#3b3f4a",
      skirt: false,
      shorts: false,
      head: "cap",
      headColour: "#f08a24",
    });
  }

  /** The outfit for a slot's person (stable: the same slot and block always dresses the same). */
  function outfitFor(slot, block) {
    const seed = slot.id + "@" + block;
    if (slot.kind === "sweep") return cleanerOutfit(seed);
    return SC().outfit(seed, ROLE[slot.kind] || "any");
  }

  /**
   * Make the extra who occupies a slot.
   * @param {object} slot from KQ.Game.CrowdZones.build
   * @param {number} block the occupancy block (so a new shift brings new faces)
   * @param {boolean} instant true to appear fully grown (first fill / teleport)
   */
  function create(slot, block, instant) {
    const outfit = outfitFor(slot, block);
    const draw = U.rng(U.hash(slot.id + "#" + block));
    return {
      id: slot.id,
      slot,
      kind: slot.kind,
      block,
      outfit,
      kid: outfit.kid,
      scale: outfit.scale,
      x: slot.x,
      z: slot.z,
      y: slot.y,
      heading: slot.heading,
      bx: slot.x,
      bz: slot.z,
      ox: 0,
      oz: 0,
      pose: "idle",
      phase: draw(),
      rate: 0.22,
      show: instant ? 1 : 0.01,
      leaving: false,
      mode: slot.roam ? "roam" : slot.line ? "pace" : "rest",
      t: draw() * 30,
      phoner: draw() < 0.22,
      draw,
      goal: null,
      wait: draw() * 1.5,
      dir: 1,
      prop: slot.kind === "sweep" ? "broom" : null,
      walker: false,
    };
  }

  /** The drop from the figure's origin to a seat (the cast's seatDrop, for a crowd figure). */
  function seatDrop(m) {
    const d = m.kid ? KQ.Figures.CROWD_KID_DIMS : KQ.Figures.CROWD_DIMS;
    return (d.hipH - d.legD / 2) * d.scale * m.scale;
  }

  /** Pose of a table or bench diner: one person talks at a time, the rest eat, sit or look at a phone. */
  function sittingPose(m, clock) {
    const slot = m.slot;
    const speaker = SC().speakerAt(slot.group, Math.max(2, slot.size || 2), clock, 7);
    if (slot.index === speaker && slot.kind !== "bus") return "sittalk";
    if (slot.kind === "bus" || slot.kind === "bench") return m.phoner ? "sitphone" : "sit";
    const k = SC().hash01(m.id + ":" + Math.floor((clock + m.t) / 9));
    if (m.phoner && k > 0.7) return "sitphone";
    return k < 0.72 ? "eat" : "sit";
  }

  /** Pose of someone standing in a queue, at a lift or at the bus stop. */
  function waitingPose(m, clock) {
    if (m.kind === "queue" && m.slot.index === 0) return "order";
    const k = SC().hash01(m.id + ":" + Math.floor((clock + m.t) / 14));
    if (m.kind === "bus" && k > 0.8) return "browse";
    return m.phoner && k > 0.25 ? "phone" : "wait";
  }

  /** The pose a person at a fixed spot holds right now. */
  function restPose(m, clock) {
    if (m.slot.sit) return sittingPose(m, clock);
    if (m.kind === "chat") {
      const s = m.slot;
      return SC().speakerAt(s.group, s.size, clock, 5) === s.index ? "talk" : "listen";
    }
    if (m.kind === "exercise") return "taiji";
    return waitingPose(m, clock);
  }

  /** Stand somebody aside when the hero or a cast neighbour is closer than MAKE_WAY; ease back after. */
  function makeWay(m, dt, others, world) {
    let px = 0;
    let pz = 0;
    others.forEach(function (o) {
      const d = U.dist(m.x, m.z, o.x, o.z);
      if (d > MAKE_WAY || d < 1e-3) return;
      px += ((m.x - o.x) / d) * (MAKE_WAY - d);
      pz += ((m.z - o.z) / d) * (MAKE_WAY - d);
    });
    const k = px || pz ? 6 : 2.5;
    const wantX = U.clamp(m.ox + px, -MAX_SHIFT, MAX_SHIFT) * (px || pz ? 1 : 0);
    const wantZ = U.clamp(m.oz + pz, -MAX_SHIFT, MAX_SHIFT) * (px || pz ? 1 : 0);
    const nx = U.damp(m.ox, wantX, k, dt);
    const nz = U.damp(m.oz, wantZ, k, dt);
    if (G.CrowdZones.clear(world, m.bx + nx, m.bz + nz, 0.25)) {
      m.ox = nx;
      m.oz = nz;
    }
    m.x = m.bx + m.ox;
    m.z = m.bz + m.oz;
  }

  /** Kids running about: pick a clear spot in the play area, run to it, hop a while, repeat. */
  function roam(m, dt, C) {
    const r = m.slot.roam;
    if (m.wait > 0) {
      m.wait -= dt;
      m.pose = "hop";
      return;
    }
    if (!m.goal) {
      const a = m.draw() * 6.283;
      const d = 1.5 + m.draw() * r.r;
      const gx = r.x + Math.cos(a) * d;
      const gz = r.z + Math.sin(a) * d;
      m.goal = G.CrowdZones.segmentClear(C.world, m.x, m.z, gx, gz, 0.3) ? { x: gx, z: gz } : null;
      m.wait = m.goal ? 0 : 0.4;
      return;
    }
    const arrived = stepToward(m, m.goal.x, m.goal.z, 2.3, dt);
    m.pose = "run";
    m.rate = 2.3 * 0.95;
    if (arrived) {
      m.goal = null;
      m.wait = 0.8 + m.draw() * 2.4;
    }
  }

  /** Walk a person toward a point at `speed`; true on arrival. Also turns it to face the way it goes. */
  function stepToward(m, tx, tz, speed, dt) {
    const dx = tx - m.x;
    const dz = tz - m.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.1) return true;
    const s = Math.min(d, speed * dt);
    m.x += (dx / d) * s;
    m.z += (dz / d) * s;
    m.heading = U.dampAngle(m.heading, Math.atan2(dx, dz), 10, dt);
    return d - s < 0.1;
  }

  /** A cleaner sweeping back and forth along a line. */
  function pace(m, dt) {
    const l = m.slot.line;
    const goal = m.dir > 0 ? { x: l.x1, z: l.z1 } : { x: l.x0, z: l.z0 };
    if (stepToward(m, goal.x, goal.z, 0.3, dt)) m.dir = -m.dir;
    m.pose = "sweep";
  }

  /** Step a fixed-spot person by dt: choose the pose, move if it moves, and ease in or out. */
  function update(m, dt, C) {
    m.t += dt;
    if (m.mode === "roam") roam(m, dt, C);
    else if (m.mode === "pace") pace(m, dt);
    else {
      const bucket = Math.floor(m.t / POSE_EVERY_S);
      if (bucket !== m.poseBucket) {
        m.poseBucket = bucket;
        m.pose = restPose(m, C.clock);
      }
      if (!m.slot.sit) makeWay(m, dt, C.others, C.world);
      m.heading = U.dampAngle(m.heading, m.slot.heading, 6, dt);
    }
    if (m.mode === "rest") m.rate = rateOf(m.pose);
    else if (m.pose === "sweep" || m.pose === "hop") m.rate = rateOf(m.pose);
    m.phase = (m.phase + dt * m.rate) % 1;
    if (m.kind === "exercise") m.phase = (C.clock * m.rate + 0.015 * (m.slot.index || 0)) % 1;
    m.show = U.damp(m.show, m.leaving ? 0 : 1, 6, dt);
    m.y = m.slot.sit ? m.slot.y - seatDrop(m) : C.world.heightAt(m.x, m.z);
  }

  G.CrowdMembers = { create, update, restPose, stepToward, seatDrop, rateOf };
})((window.KQ = window.KQ || {}));
