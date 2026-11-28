/* ============================================================================
 * FILE: vehicle-life.js
 * PURPOSE: The pure rules of vehicles that feel lived in: the get-in / get-out timeline (walk to the door,
 *          open it, climb in, close it; and back), when the brake, reverse and head lights are on, how the
 *          indicators blink, and how much exhaust a petrol, diesel or electric vehicle puffs. No THREE,
 *          no DOM: the game layer (vehicle-enter.js, vehicle-lights.js, exhaust.js) applies the numbers.
 * BUSINESS CONTEXT: owner request "see the people getting in and out of cars, lights on the vehicles that
 *   light up when they stop and go, even exhaust". Audience children 6-10: only the feel of getting in and
 *   out is borrowed from games like GTA; nobody is ever pulled out of a vehicle and nothing crashes.
 * DEPENDENCIES: none. HOW TO TEST: npm run test:kq (tests/kampung-quest/vehicle-life.test.mjs).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /**
   * Phases (name, seconds) of getting in and out per kind. A four-wheeler: walk to the door, open it, climb in,
   * close it (1.55 s; the lorry's cab is higher, 1.7 s). A two-wheeler: a quick step and a swing over.
   */
  const PLANS = {
    car: {
      in: [
        ["walk", 0.5],
        ["open", 0.3],
        ["climb", 0.45],
        ["close", 0.3],
      ],
      out: [
        ["open", 0.3],
        ["climb", 0.45],
        ["close", 0.35],
      ],
    },
    lorry: {
      in: [
        ["walk", 0.55],
        ["open", 0.3],
        ["climb", 0.55],
        ["close", 0.3],
      ],
      out: [
        ["open", 0.3],
        ["climb", 0.55],
        ["close", 0.35],
      ],
    },
    moto: {
      in: [
        ["walk", 0.25],
        ["swing", 0.4],
      ],
      out: [
        ["swing", 0.35],
        ["step", 0.2],
      ],
    },
    bike: {
      in: [
        ["walk", 0.2],
        ["swing", 0.35],
      ],
      out: [
        ["swing", 0.3],
        ["step", 0.2],
      ],
    },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ease = (t) => t * t * (3 - 2 * t);

  /**
   * The phases of a kind and direction ("in" | "out") with their start and end times, and the total. `walk`
   * (seconds, optional) replaces the length of the "walk" phase, so a long way round the car takes a little longer.
   */
  function plan(kind, dir, walk) {
    const rows = (PLANS[kind] || PLANS.car)[dir === "out" ? "out" : "in"];
    let t = 0;
    const phases = rows.map(function (r) {
      const len = r[0] === "walk" && walk > 0 ? walk : r[1];
      const p = { name: r[0], t0: t, t1: t + len };
      t += len;
      return p;
    });
    return { phases, total: t };
  }

  /** Is this kind one with a door to open (a car or a lorry)? */
  function hasDoor(kind) {
    return kind === "car" || kind === "lorry";
  }

  /**
   * Where everything is `t` seconds into getting in ("in") or out ("out"):
   *   phase     the phase name ("done" when over);  k  progress 0..1 inside it;
   *   door      how far the door is open 0..1 (always 0 for a two-wheeler);
   *   approach  0..1 along the walk from where the hero stood to the door point (in);
   *   seat      0 standing at the door point .. 1 in the seat;
   *   away      0..1 along the step from the door point to the place he is set down (out).
   */
  function at(kind, dir, t, walk) {
    const p = plan(kind, dir, walk);
    const out = dir === "out";
    const time = clamp(t, 0, p.total);
    const ph = p.phases.find((x) => time <= x.t1) || p.phases[p.phases.length - 1];
    const k = ph.t1 > ph.t0 ? clamp((time - ph.t0) / (ph.t1 - ph.t0), 0, 1) : 1;
    const done = t >= p.total;
    const s = { phase: done ? "done" : ph.name, k, door: 0, approach: 1, seat: 0, away: 0, done };
    const st = (out ? outState : inState)(ph.name, ease(k), done);
    Object.assign(s, st);
    if (!hasDoor(kind)) s.door = 0;
    return s;
  }

  /** The state numbers of an "in" phase at eased progress e. */
  function inState(name, e, done) {
    if (done) return { approach: 1, seat: 1, door: 0 };
    if (name === "walk") return { approach: e, seat: 0, door: 0 };
    if (name === "open") return { approach: 1, seat: 0, door: e };
    if (name === "climb" || name === "swing") return { approach: 1, seat: e, door: 1 };
    return { approach: 1, seat: 1, door: 1 - e }; // close
  }

  /** The state numbers of an "out" phase at eased progress e. */
  function outState(name, e, done) {
    if (done) return { approach: 1, seat: 0, door: 0, away: 1 };
    if (name === "open") return { approach: 1, seat: 1, door: e, away: 0 };
    if (name === "climb" || name === "swing") return { approach: 1, seat: 1 - e, door: 1, away: 0 };
    if (name === "step") return { approach: 1, seat: 0, door: 0, away: e };
    return { approach: 1, seat: 0, door: 1 - e, away: e }; // close: stepping away while it shuts
  }

  /** Total seconds of getting in / out for a kind. */
  const total = (kind, dir, walk) => plan(kind, dir, walk).total;

  /**
   * The way from where he stands to the door point, in the vehicle's frame ({fwd, lat}, lat > 0 left): straight
   * when he is on the door's side or well clear; round the nearer end of the body when he stands on the far side.
   */
  function approachPath(from, door, halfLen, halfWid) {
    const far = from.lat * door.lat < 0 && Math.abs(from.lat) < halfWid + 1.4;
    if (!far) return [from, door];
    const end = (from.fwd >= door.fwd ? 1 : -1) * (halfLen + 0.7);
    const side = Math.sign(from.lat) * (halfWid + 0.6);
    return [from, { fwd: end, lat: side }, { fwd: end, lat: door.lat }, door];
  }

  /** The point `k` (0..1) of the way along a polyline of {fwd, lat}, by length. */
  function alongPath(pts, k) {
    const lens = [];
    let sum = 0;
    for (let i = 1; i < pts.length; i += 1) {
      const l = Math.hypot(pts[i].fwd - pts[i - 1].fwd, pts[i].lat - pts[i - 1].lat);
      lens.push(l);
      sum += l;
    }
    let left = clamp(k, 0, 1) * sum;
    for (let i = 0; i < lens.length; i += 1) {
      if (left <= lens[i] || i === lens.length - 1) {
        const u = lens[i] > 0 ? clamp(left / lens[i], 0, 1) : 1;
        return {
          fwd: pts[i].fwd + (pts[i + 1].fwd - pts[i].fwd) * u,
          lat: pts[i].lat + (pts[i + 1].lat - pts[i].lat) * u,
        };
      }
      left -= lens[i];
    }
    return pts[pts.length - 1];
  }

  /** How long to give the walk phase for a path (about 3.2 m/s, between 0.3 and 1.0 s). */
  function pathLength(pts) {
    let sum = 0;
    for (let i = 1; i < pts.length; i += 1)
      sum += Math.hypot(pts[i].fwd - pts[i - 1].fwd, pts[i].lat - pts[i - 1].lat);
    return sum;
  }
  const walkSecs = (len) => clamp(len / 3.2, 0.3, 1.0);

  /**
   * The sound cue for this moment of a get-in / get-out: "open" the first time the door starts to open, "close" the
   * first time it is nearly shut again (the clunk). `fired` is a {open, close} record kept by the caller.
   */
  function cue(s, fired) {
    if (!fired.open && s.door > 0.05) {
      fired.open = true;
      return "open";
    }
    if (fired.open && !fired.close && s.door < 0.12 && s.phase !== "walk" && s.phase !== "open") {
      fired.close = true;
      return "close";
    }
    return null;
  }

  /** Which side the driver's door is on: "R" when the driver sits right of the middle (seatX < 0), else "L". */
  const driverSide = (seatX) => (seatX < 0 ? "R" : "L");

  /**
   * The hero's height above the ground while climbing between the door point and the seat: a little hop up
   * over the sill (the seat's own height at `seat` = 1). `seat` 0..1, `seatY` the seat's height.
   */
  function climbHeight(seat, seatY, kind) {
    const lift = kind === "lorry" ? 0.22 : kind === "car" ? 0.1 : 0.14;
    return seatY * ease(seat) + Math.sin(seat * Math.PI) * lift;
  }

  /* ------------------------------ lights ------------------------------ */

  /** Deceleration (m/s^2) beyond which the brake lights show, and the speed under which it counts as stopped. */
  const BRAKE_DECEL = 0.8;
  const STOPPED = 0.25;
  /** Night level (0..1) at which the headlights come on, and the lower level they go off at. */
  const HEAD_ON = 0.22;
  const HEAD_OFF = 0.12;

  /**
   * Which lights a vehicle shows.
   * @param {{speed:number, accel:number, engine:boolean, braking?:boolean, night:number, headWas?:boolean}} s
   *   speed (signed, m/s), accel (signed change of the speed, m/s^2), engine on, braking (forced down by a
   *   person or a car ahead), night 0..1, and whether the headlights were on already (so they do not flicker)
   * @returns {{brake:boolean, reverse:boolean, head:boolean}}
   */
  function lightsFor(s) {
    const m = Math.abs(s.speed);
    const slowing = s.accel * Math.sign(s.speed || 1) < -BRAKE_DECEL;
    const brake = Boolean(s.engine) && (m < STOPPED || slowing || Boolean(s.braking));
    const reverse = Boolean(s.engine) && s.speed < -0.1;
    const head = Boolean(s.engine) && s.night >= (s.headWas ? HEAD_OFF : HEAD_ON);
    return { brake, reverse, head };
  }

  /** How fast the indicator blinks (cycles per second). */
  const BLINK_HZ = 1.5;

  /** Is the indicator lamp lit at game time `t` (seconds)? On for the first half of each cycle. */
  function blinkOn(t) {
    return (t * BLINK_HZ) % 1 < 0.5;
  }

  /** The indicator side for a lateral move: "L" / "R" (left / right of the way it faces) or null when going straight. */
  function indicatorFor(lateral, threshold) {
    const limit = threshold === undefined ? 0.3 : threshold;
    if (Math.abs(lateral) < limit) return null;
    return lateral > 0 ? "L" : "R";
  }

  /* ------------------------------ exhaust ------------------------------ */

  /**
   * What each fuel puffs: puffs a second at idle, extra puffs per m/s^2 of acceleration (diesel puffs more at
   * pull-away), how pale the smoke is (1 white, 0 black), and the size of a fresh puff (m). Electric: nothing.
   */
  const FUELS = {
    petrol: { idle: 1.1, perAccel: 1.2, pale: 1, size: 0.17 },
    diesel: { idle: 1.5, perAccel: 2.4, pale: 0.78, size: 0.21 },
  };
  const MAX_PUFF_RATE = 9;

  /** Is this a fuel that puffs exhaust ("petrol" or "diesel"; "electric" and anything else do not)? */
  const puffs = (fuel) => Object.prototype.hasOwnProperty.call(FUELS, fuel);

  /**
   * Puffs per second for a vehicle: none when the engine is off or the fuel does not puff; idle plus a boost
   * while accelerating, and a little less once it cruises.
   */
  function puffRate(fuel, speed, accel, engine) {
    if (!engine || !puffs(fuel)) return 0;
    const f = FUELS[fuel];
    const boost = clamp(accel, 0, 4) * f.perAccel;
    const cruise = clamp(Math.abs(speed) / 12, 0, 1) * 0.35;
    return clamp(f.idle * (1 - cruise) + boost, 0, MAX_PUFF_RATE);
  }

  /** The look of a fuel's smoke: {pale, size}; null for a fuel that does not puff. */
  const puffLook = (fuel) =>
    puffs(fuel) ? { pale: FUELS[fuel].pale, size: FUELS[fuel].size } : null;

  /** How long a puff lives (s) and how fast it rises (m/s). */
  const PUFF_LIFE = 1.1;
  const PUFF_RISE = 0.45;

  /** A puff of age `age` seconds: its size (grows to ~3x), opacity (fades out) and height gained. */
  function puffAt(age, size) {
    const k = clamp(age / PUFF_LIFE, 0, 1);
    return {
      size: size * (1 + 2 * Math.sqrt(k)),
      alpha: 0.85 * (1 - k) * Math.min(1, age / 0.08),
      rise: PUFF_RISE * age,
      alive: age < PUFF_LIFE,
    };
  }

  /** The fuel a model burns when its rig does not say: diesel for the lorry, the bus and taxis, petrol otherwise. */
  function fuelOf(kind, style) {
    if (kind === "bike") return "none";
    if (kind === "lorry" || kind === "bus") return "diesel";
    return style === "taxi" ? "diesel" : "petrol";
  }

  KQ.Sim.VehicleLife = {
    plan,
    at,
    total,
    approachPath,
    cue,
    alongPath,
    pathLength,
    walkSecs,
    hasDoor,
    driverSide,
    climbHeight,
    lightsFor,
    blinkOn,
    indicatorFor,
    puffs,
    puffRate,
    puffLook,
    puffAt,
    fuelOf,
    BLINK_HZ,
    PUFF_LIFE,
    MAX_PUFF_RATE,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
