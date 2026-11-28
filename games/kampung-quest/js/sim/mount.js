/* ============================================================================
 * FILE: mount.js
 * PURPOSE: The pure riding rules for the animals the hero can ride (camel, horse, pony): top
 *          speeds, how the animal turns toward where the stick points, which gait it uses at a
 *          speed (walk, pace, trot, canter), where each leg is in its stride, and the places
 *          beside it the rider may step down to. No THREE, no DOM, no walls: the game layer
 *          (js/game/mounts.js, mount-ride.js) applies these numbers and does the collision.
 * BUSINESS CONTEXT: features/kampung-quest-playability/requirements.md AC-P5..P7 (ride a camel
 *   and a horse, faster than running; the ridden animal has an animated gait; animals never hurt
 *   anyone: they slow and stop for people, via KQ.Sim.Vehicle.speedCap / brakeFor).
 * CONVENTIONS: heading 0 faces +z, forward = (sin h, cos h), like KQ.Sim.Vehicle. Legs are listed
 *   [front-left, front-right, hind-left, hind-right]. The stick is steered like walking: the
 *   animal turns toward the direction pushed (camera-relative), not like a car.
 * DEPENDENCIES: none at load (vehicle.js for braking at call time). HOW TO TEST: npm run test:kq
 *   (tests/kampung-quest/mount.test.mjs).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /** The hero's running speed (m/s, js/game/player.js RUN): every animal is quicker than this. */
  const HERO_RUN = 4.4;
  const TAU = Math.PI * 2;

  /**
   * What each animal can do. top in m/s (camel ~1.8x a run, horse ~2.2x, pony ~2x), accel / brake
   * in m/s^2, turn in rad/s (quicker when slow), halfLen / halfWid the body (used by the people
   * braking), ring the two circles tested against walls, gaits by speed, seat the rider's place.
   */
  const SPECS = {
    camel: {
      top: HERO_RUN * 1.8,
      accel: 3.2,
      brake: 7,
      turn: 2.2,
      halfLen: 1.35,
      halfWid: 0.55,
      ring: { off: 0.7, r: 0.6 },
      gaits: [
        { name: "walk", upTo: 2.6, stride: 1.9, duty: 0.66, swing: 0.42, knee: 0.7, bob: 0.03 },
        { name: "pace", upTo: Infinity, stride: 3.3, duty: 0.5, swing: 0.55, knee: 0.9, bob: 0.06 },
      ],
      camDist: 6.2,
      camPitch: 0.36,
    },
    horse: {
      top: HERO_RUN * 2.2,
      accel: 4.2,
      brake: 8,
      turn: 2.6,
      halfLen: 1.0,
      halfWid: 0.36,
      ring: { off: 0.5, r: 0.45 },
      gaits: [
        { name: "walk", upTo: 2.4, stride: 1.5, duty: 0.66, swing: 0.36, knee: 0.8, bob: 0.02 },
        { name: "trot", upTo: 6.2, stride: 2.4, duty: 0.5, swing: 0.5, knee: 1.1, bob: 0.05 },
        {
          name: "canter",
          upTo: Infinity,
          stride: 3.4,
          duty: 0.42,
          swing: 0.62,
          knee: 1.2,
          bob: 0.07,
        },
      ],
      camDist: 5.2,
      camPitch: 0.32,
    },
    pony: {
      top: HERO_RUN * 2.0,
      accel: 4,
      brake: 8,
      turn: 2.8,
      halfLen: 0.8,
      halfWid: 0.3,
      ring: { off: 0.4, r: 0.38 },
      gaits: [
        { name: "walk", upTo: 2.2, stride: 1.2, duty: 0.66, swing: 0.36, knee: 0.8, bob: 0.02 },
        { name: "trot", upTo: 5.6, stride: 1.9, duty: 0.5, swing: 0.5, knee: 1.1, bob: 0.04 },
        {
          name: "canter",
          upTo: Infinity,
          stride: 2.8,
          duty: 0.42,
          swing: 0.6,
          knee: 1.2,
          bob: 0.06,
        },
      ],
      camDist: 4.6,
      camPitch: 0.3,
    },
  };

  /** When each leg starts its step, as a fraction of the stride [FL, FR, HL, HR]. */
  const FOOTFALL = {
    walk: [0.25, 0.75, 0, 0.5], // four-beat: hind-left, fore-left, hind-right, fore-right
    pace: [0, 0.5, 0, 0.5], // a camel's pace: both legs of a side together
    trot: [0, 0.5, 0.5, 0], // diagonal pairs
    canter: [0.33, 0.66, 0, 0.33], // three-beat: hind-left, then the diagonal pair, then fore-right
  };
  /** The stick must pass this before it counts. */
  const DEAD = 0.12;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const frac = (v) => v - Math.floor(v);

  /** The shortest signed turn from heading a to heading b (-PI..PI). */
  function angleTo(a, b) {
    return Math.atan2(Math.sin(b - a), Math.cos(b - a));
  }

  /** An animal of a kind standing at x, z facing `heading` (null for an unknown kind). */
  function create(kind, x, z, heading) {
    const spec = SPECS[kind];
    if (!spec) return null;
    return { kind, spec, x, z, heading: heading || 0, speed: 0, phase: 0, gait: "stand" };
  }

  /**
   * What the stick asks for, camera-relative like walking: { heading, mag } (mag 0..1, 0 inside
   * the dead zone). `yaw` is the camera's heading.
   */
  function wishOf(move, yaw) {
    const mx = move && Number.isFinite(move.x) ? move.x : 0;
    const my = move && Number.isFinite(move.y) ? move.y : 0;
    const mag = Math.min(1, Math.hypot(mx, my));
    if (mag < DEAD) return { heading: null, mag: 0 };
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const wx = fx * my - fz * mx;
    const wz = fz * my + fx * mx;
    return { heading: Math.atan2(wx, wz), mag };
  }

  /**
   * One step of riding: turn toward the wished heading (slower at speed), and speed up to
   * mag * top (less while turning sharply, so it can turn on the spot like an animal).
   */
  function steer(m, wish, dt) {
    const s = m.spec;
    let want = 0;
    if (wish && wish.heading !== null && wish.mag > 0) {
      const diff = angleTo(m.heading, wish.heading);
      const rate = s.turn * (1 - 0.45 * clamp(m.speed / s.top, 0, 1));
      m.heading += clamp(diff, -rate * dt, rate * dt);
      want = wish.mag * s.top * clamp(Math.cos(diff) * 1.2, 0.15, 1);
    }
    const rate = want > m.speed ? s.accel : s.brake;
    m.speed += clamp(want - m.speed, -rate * dt, rate * dt);
    if (want === 0 && m.speed < 0.05) m.speed = 0;
    return m.speed;
  }

  /** Slow to a halt at a gentle rate (the rider is getting down). */
  function stopGently(m, dt) {
    m.speed = Math.max(0, m.speed - m.spec.brake * 0.7 * dt);
    return m.speed;
  }

  /** Walk forward along the heading for dt seconds (no walls here). */
  function advance(m, dt) {
    m.x += Math.sin(m.heading) * m.speed * dt;
    m.z += Math.cos(m.heading) * m.speed * dt;
  }

  /** The gait for a speed: "stand" when still, else the first gait whose upTo covers it. */
  function gaitFor(spec, speed) {
    if (speed < 0.15) return null;
    return spec.gaits.find((g) => speed <= g.upTo) || spec.gaits[spec.gaits.length - 1];
  }

  /** Move the stride phase on by the distance covered (one stride = one cycle); returns the gait name. */
  function stepGait(m, dt) {
    const g = gaitFor(m.spec, m.speed);
    m.gait = g ? g.name : "stand";
    if (g) m.phase = frac(m.phase + (m.speed * dt) / g.stride);
    return m.gait;
  }

  /**
   * One leg's pose at stride phase `phase`: hip swing (rad, + forward) and knee fold (rad). On the
   * ground (the first `duty` of its cycle) the hoof sweeps back; in the air it swings forward
   * with the knee folded.
   */
  function legPose(gait, phase, leg) {
    const off = (FOOTFALL[gait.name] || FOOTFALL.walk)[leg];
    const u = frac(phase - off);
    if (u < gait.duty) {
      const k = u / gait.duty;
      return { hip: gait.swing * (1 - 2 * k), knee: 0.08 };
    }
    const k = (u - gait.duty) / (1 - gait.duty);
    return {
      hip: gait.swing * (-1 + 2 * (0.5 - 0.5 * Math.cos(k * Math.PI))),
      knee: gait.knee * Math.sin(k * Math.PI),
    };
  }

  /** All four legs and the body's bob / nod for an animal's current gait (standing: all zero). */
  function stance(m) {
    const g = gaitFor(m.spec, m.speed);
    if (!g) return { legs: [0, 1, 2, 3].map(() => ({ hip: 0, knee: 0 })), bob: 0, nod: 0 };
    return {
      legs: [0, 1, 2, 3].map((i) => legPose(g, m.phase, i)),
      bob: g.bob * Math.abs(Math.sin(m.phase * TAU * (g.name === "canter" ? 1 : 2))),
      nod: 0.08 * Math.sin(m.phase * TAU * (g.name === "canter" ? 1 : 2)),
    };
  }

  /**
   * Places beside an animal for the rider to step down to, nearest first: left, right, behind,
   * ahead, then a bit further left / right ({x, z}).
   */
  function exitSpots(m) {
    const side = m.spec.halfWid + 0.7;
    const end = m.spec.halfLen + 0.7;
    const fx = Math.sin(m.heading);
    const fz = Math.cos(m.heading);
    const at = (fwd, lat) => ({ x: m.x + fx * fwd + fz * lat, z: m.z + fz * fwd - fx * lat });
    return [at(0, side), at(0, -side), at(-end, 0), at(end, 0), at(0, side + 1), at(0, -side - 1)];
  }

  /** Slow the animal for anyone on foot ahead (KQ.Sim.Vehicle's rules); true when it braked. */
  function yieldTo(m, people, dt) {
    const SV = KQ.Sim.Vehicle;
    return SV.brakeFor(m, SV.speedCap(m, people || []), dt);
  }

  KQ.Sim.Mount = {
    SPECS,
    FOOTFALL,
    HERO_RUN,
    DEAD,
    create,
    wishOf,
    steer,
    stopGently,
    advance,
    gaitFor,
    stepGait,
    legPose,
    stance,
    exitSpots,
    yieldTo,
    angleTo,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
