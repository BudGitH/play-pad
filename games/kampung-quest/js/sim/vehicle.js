/* ============================================================================
 * FILE: vehicle.js
 * PURPOSE: The pure driving rules for the toy car and the bicycle: how speed follows the stick,
 *          how fast each turns, how the vehicle brakes gently for people, and where it may not
 *          go (no-drive zones such as mosques and the mataf). No THREE, no DOM, no walls: the
 *          game layer applies these numbers and does the collision with Collide.settle.
 * BUSINESS CONTEXT: features/kampung-quest-haramain/requirements.md AC-H6 (drive a car, ride a
 *   bicycle in both regions; never harm anyone; never inside mosques / the mataf). Child-friendly
 *   (CLAUDE.md): a vehicle only ever slows down for a person, it has no way to hurt one and no
 *   fail state.
 * CONVENTIONS: heading 0 faces +z, forward = (sin h, cos h); a bigger heading turns LEFT (the
 *   figures' left is +x). Stick: x > 0 = right, y > 0 = forward (a car is steered like a car:
 *   push up to go, down to brake then reverse, left / right to steer).
 * DEPENDENCIES: none (loads with the other js/sim files). HOW TO TEST: npm run test:kq
 *   (tests/kampung-quest/vehicle.test.mjs).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /**
   * What each kind of vehicle can do. Speeds in m/s (the hero walks 2.3 and runs 4.4: the bicycle
   * is faster than a run, the car faster still), turn in rad/s at full lock, halfLen / halfWid the
   * body, ring the two circles (centre offset along the body, radius) used against the walls.
   */
  const SPECS = {
    car: {
      label: "Drive",
      maxFwd: 7.5,
      maxRev: 2.4,
      accel: 4.2,
      brake: 10,
      coast: 2.6,
      turn: 1.9,
      turnSpeed: 1.3,
      minGrip: 0,
      halfLen: 1.4,
      halfWid: 0.8,
      ring: { off: 0.6, r: 0.78 },
      camDist: 5.4,
      camPitch: 0.34,
    },
    bike: {
      label: "Ride",
      maxFwd: 5.8,
      maxRev: 1.2,
      accel: 3.2,
      brake: 8,
      coast: 1.6,
      turn: 2.6,
      turnSpeed: 0.9,
      minGrip: 0.3,
      halfLen: 0.62,
      halfWid: 0.26,
      ring: { off: 0.2, r: 0.34 },
      camDist: 4.2,
      camPitch: 0.3,
    },
  };
  /** The stick must pass this before it counts (a resting thumb does not creep). */
  const DEAD = 0.12;
  /** Comfortable stopping rate used to work out how fast is "slow enough" near a person. */
  const COMFORT = 6.5;
  /** Clear space kept between a bumper and a person, and the body radius of a person. */
  const GAP = 0.55;
  const PERSON_R = 0.4;
  /** How far ahead a person matters (m). */
  const LOOK = 14;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** A vehicle of a kind standing at x, z facing `heading` (null for an unknown kind). */
  function create(kind, x, z, heading) {
    const spec = SPECS[kind];
    if (!spec) return null;
    return { kind, spec, x, z, heading: heading || 0, speed: 0, steer: 0 };
  }

  /** The stick's forward / back push with a dead zone, -1..1. */
  function throttleOf(move) {
    const y = move && Number.isFinite(move.y) ? move.y : 0;
    return Math.abs(y) < DEAD ? 0 : clamp(y, -1, 1);
  }

  /** The stick's sideways push with a dead zone, -1..1. */
  function steerOf(move) {
    const x = move && Number.isFinite(move.x) ? move.x : 0;
    return Math.abs(x) < DEAD ? 0 : clamp(x, -1, 1);
  }

  /** The speed the stick asks for: up to the top speed forward, a slow crawl in reverse. */
  function wantedSpeed(spec, throttle) {
    return throttle >= 0 ? throttle * spec.maxFwd : throttle * spec.maxRev;
  }

  /**
   * Move the speed toward what the stick asks for: gentle acceleration, firm braking (pushing
   * against the way it rolls, or letting go of the stick, rolls to a halt).
   */
  function stepSpeed(v, throttle, dt) {
    const s = v.spec;
    const want = wantedSpeed(s, throttle);
    const against = throttle !== 0 && Math.sign(want) !== Math.sign(v.speed) && Math.abs(v.speed) > 0.2;
    let rate = s.accel;
    if (against) rate = s.brake;
    else if (throttle === 0 || Math.abs(want) < Math.abs(v.speed)) rate = s.coast;
    const dv = clamp(want - v.speed, -rate * dt, rate * dt);
    v.speed += dv;
    if (throttle === 0 && Math.abs(v.speed) < 0.05) v.speed = 0;
    return v.speed;
  }

  /** How well the wheels bite at this speed: none when standing (cars), less at the top end. */
  function grip(v) {
    const s = v.spec;
    const lift = clamp(Math.abs(v.speed) / s.turnSpeed, 0, 1);
    const calm = 1 - 0.4 * clamp(Math.abs(v.speed) / s.maxFwd, 0, 1);
    return Math.max(s.minGrip, lift) * calm;
  }

  /**
   * Turn by the stick. Pushing right turns right (the heading shrinks); reversing flips it like a
   * real car's rear end. `steer` keeps the smoothed wheel angle for drawing.
   */
  function stepHeading(v, steer, dt) {
    v.steer += (steer - v.steer) * clamp(dt * 9, 0, 1);
    const dir = v.speed < -0.05 ? -1 : 1;
    v.heading -= steer * v.spec.turn * grip(v) * dir * dt;
    return v.heading;
  }

  /** Roll the vehicle forward along its heading for dt seconds (no walls here). */
  function advance(v, dt) {
    v.x += Math.sin(v.heading) * v.speed * dt;
    v.z += Math.cos(v.heading) * v.speed * dt;
  }

  /** A point's place relative to a vehicle: `fwd` along its heading, `lat` to its left. */
  function local(v, x, z) {
    const dx = x - v.x;
    const dz = z - v.z;
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    return { fwd: dx * fx + dz * fz, lat: dx * fz - dz * fx };
  }

  /** The speed a person ahead (in the travel direction `dir`, +1 / -1) allows, or Infinity. */
  function allowedBy(v, p, dir) {
    const s = v.spec;
    const at = local(v, p.x, p.z);
    const ahead = at.fwd * dir;
    if (Math.abs(at.lat) > s.halfWid + PERSON_R + 0.25 || ahead < -s.halfLen || ahead > LOOK)
      return Infinity;
    const gap = ahead - s.halfLen - PERSON_R - GAP;
    if (ahead <= s.halfLen) return 0; // already alongside / overlapping: hold still
    return gap <= 0 ? 0 : Math.sqrt(2 * COMFORT * gap);
  }

  /**
   * The fastest the vehicle may go (a magnitude, m/s) given the people near it, in the direction
   * it is travelling (forward when still). Infinity when the way is clear.
   * @param {{x:number,z:number}[]} people anyone on foot (cast, crowd)
   */
  function speedCap(v, people) {
    const dir = v.speed < -0.05 ? -1 : 1;
    let cap = Infinity;
    for (let i = 0; i < people.length; i += 1) cap = Math.min(cap, allowedBy(v, people[i], dir));
    return cap;
  }

  /**
   * Slow the vehicle to the cap, firmly but never abruptly (twice the comfortable rate, so it
   * always stops in time). Returns true when it had to brake for someone.
   */
  function brakeFor(v, cap, dt) {
    const m = Math.abs(v.speed);
    if (m <= cap) return false;
    const next = Math.max(cap, m - 2 * COMFORT * dt);
    v.speed = Math.sign(v.speed) * next;
    return true;
  }

  /* ------------------------------ no-drive zones ------------------------------ */

  /**
   * Turn a list of no-drive zones in any of the shapes the world code may give into circles and
   * rectangles: {x,z,r}, {x0,x1,z0,z1}, {minX,maxX,minZ,maxZ}, {x,z,w,d} (centre and full size).
   * Anything else is dropped. `say` is the friendly line shown when a vehicle is stopped.
   */
  function normalizeZones(list) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach(function (z) {
      const zone = shapeOf(z);
      if (zone) out.push(zone);
    });
    return out;
  }

  /** One zone in the canonical shape, or null. */
  function shapeOf(z) {
    if (!z || typeof z !== "object") return null;
    const say = typeof z.say === "string" ? z.say : "";
    const num = (k) => Number.isFinite(z[k]);
    if (num("x") && num("z") && num("r")) return { kind: "circle", x: z.x, z: z.z, r: z.r, say };
    if (num("minX") && num("maxX") && num("minZ") && num("maxZ"))
      return { kind: "rect", minX: z.minX, maxX: z.maxX, minZ: z.minZ, maxZ: z.maxZ, say };
    if (num("x0") && num("x1") && num("z0") && num("z1"))
      return { kind: "rect", minX: z.x0, maxX: z.x1, minZ: z.z0, maxZ: z.z1, say };
    if (num("x") && num("z") && num("w") && num("d"))
      return rectAround(z.x, z.z, z.w / 2, z.d / 2, say);
    return null;
  }

  /** A rectangle zone centred on x, z with half sizes hx, hz. */
  function rectAround(x, z, hx, hz, say) {
    return { kind: "rect", minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, say };
  }

  /** Is a circle of radius r at x, z touching this zone? */
  function touches(zone, x, z, r) {
    if (zone.kind === "circle") {
      const dx = x - zone.x;
      const dz = z - zone.z;
      return dx * dx + dz * dz < (zone.r + r) * (zone.r + r);
    }
    return x > zone.minX - r && x < zone.maxX + r && z > zone.minZ - r && z < zone.maxZ + r;
  }

  /** The first zone a vehicle circle at x, z touches, or null. */
  function zoneAt(zones, x, z, r) {
    for (let i = 0; i < zones.length; i += 1) if (touches(zones[i], x, z, r)) return zones[i];
    return null;
  }

  /**
   * May the vehicle go from (x0, z0) to (x1, z1)? It may unless the new place is in a zone the old
   * one was not (so a vehicle somehow inside a zone can always drive back out). Returns the zone
   * that blocks it, or null.
   */
  function blockedMove(zones, x0, z0, x1, z1, r) {
    const next = zoneAt(zones, x1, z1, r);
    if (!next) return null;
    return zoneAt(zones, x0, z0, r) === next ? null : next;
  }

  KQ.Sim.Vehicle = {
    SPECS,
    create,
    throttleOf,
    steerOf,
    stepSpeed,
    stepHeading,
    advance,
    local,
    speedCap,
    brakeFor,
    normalizeZones,
    zoneAt,
    blockedMove,
    DEAD,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
