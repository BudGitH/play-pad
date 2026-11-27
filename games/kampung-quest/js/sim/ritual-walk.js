/* ============================================================================
 * FILE: ritual-walk.js
 * PURPOSE: The geometry of walking the rites: counting tawaf rounds around the Kaaba (anticlockwise,
 *          starting at the Black Stone line) and sa'i legs (Safa -> Marwa, 7 legs ending at Marwa)
 *          from the hero's position, and the routes the hero follows when "Walk for me" is on.
 * BUSINESS CONTEXT: AC-H3. Manual walking and auto-walk share one counter: both just move the hero
 *   and the tracker counts what it sees. No fail state: walking the wrong way or far away simply
 *   does not count.
 * COORDINATES: x east, z south (north is -z). Angles are measured on the map, anticlockwise from
 *   east, so walking anticlockwise has the Kaaba on the walker's LEFT.
 * DEPENDENCIES: none (pure). HOW TO TEST: npm run test:kq (tests/kampung-quest/ritual-walk.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const TAU = Math.PI * 2;
  /** The hero must come within this angle of the Black Stone line to start counting rounds. */
  const NEAR_LINE = 0.3;
  /** A round counts a little before the line, so walking a touch wide still counts. */
  const SLACK = 0.2;
  /** Auto-walk speeds in metres per second: walking, and brisk between the green lights. */
  const WALK_SPEED = 5;
  const BRISK_SPEED = 8;

  /** Wrap an angle into (-PI, PI]. */
  function wrap(a) {
    let x = a % TAU;
    if (x > Math.PI) x -= TAU;
    if (x <= -Math.PI) x += TAU;
    return x;
  }

  /** The map angle of a point as seen from a centre (anticlockwise from east, north is -z). */
  function angleOf(cx, cz, x, z) {
    return Math.atan2(-(z - cz), x - cx);
  }

  /** The map angle of the Black Stone corner of the Kaaba ({x, z, w, d, blackStoneCorner:"SE"}). */
  function blackStoneAngle(kaaba) {
    const sx = String(kaaba.blackStoneCorner || "SE").indexOf("W") === -1 ? 1 : -1;
    const sz = String(kaaba.blackStoneCorner || "SE").indexOf("N") === -1 ? 1 : -1;
    return angleOf(kaaba.x, kaaba.z, kaaba.x + (sx * kaaba.w) / 2, kaaba.z + (sz * kaaba.d) / 2);
  }

  /**
   * A tawaf round counter. opts: { cx, cz, startAngle, rMin, rMax, rounds }.
   * feed(x, z) with the hero's position every frame; it returns the rounds counted so far (capped at
   * `rounds`). Counting begins when the hero first passes the Black Stone line.
   */
  function createTawaf(opts) {
    const T = { armed: false, last: null, acc: 0, rounds: 0 };
    const max = opts.rounds || 7;
    function onRing(x, z) {
      const r = Math.hypot(x - opts.cx, z - opts.cz);
      return r >= opts.rMin && r <= opts.rMax;
    }
    function turn(th) {
      if (T.last === null) return;
      T.acc = Math.max(0, T.acc + wrap(th - T.last));
      while (T.acc >= TAU - SLACK && T.rounds < max) {
        T.rounds += 1;
        T.acc -= TAU;
      }
      T.acc = Math.max(0, T.acc);
    }
    return {
      feed(x, z) {
        if (!onRing(x, z)) {
          T.last = null;
          return T.rounds;
        }
        const th = angleOf(opts.cx, opts.cz, x, z);
        if (!T.armed && Math.abs(wrap(th - opts.startAngle)) < NEAR_LINE) {
          T.armed = true;
          T.acc = 0;
          T.last = th;
        } else if (T.armed) turn(th);
        T.last = th;
        return T.rounds;
      },
      get rounds() {
        return T.rounds;
      },
      get armed() {
        return T.armed;
      },
    };
  }

  /**
   * A sa'i leg counter between two hills. opts: { a, b, r, legs } with a = Safa, b = Marwa as
   * {x, z}. Counting begins when the hero is at Safa; each time they reach the OTHER hill a leg is
   * counted, so leg 1 ends at Marwa and leg 7 ends at Marwa.
   */
  function createSai(opts) {
    const S = { armed: false, want: "b", legs: 0 };
    const max = opts.legs || 7;
    const near = (p, x, z) => Math.hypot(x - p.x, z - p.z) <= opts.r;
    return {
      feed(x, z) {
        if (!S.armed) {
          S.armed = near(opts.a, x, z);
          return S.legs;
        }
        const goal = S.want === "b" ? opts.b : opts.a;
        if (S.legs < max && near(goal, x, z)) {
          S.legs += 1;
          S.want = S.want === "b" ? "a" : "b";
        }
        return S.legs;
      },
      get legs() {
        return S.legs;
      },
      get armed() {
        return S.armed;
      },
    };
  }

  /** Which hill leg n (1-based) starts and ends at: odd legs go Safa -> Marwa, even ones back. */
  function saiLeg(n) {
    const out = Math.floor(Number(n) || 1) % 2 === 1;
    return { from: out ? "safa" : "marwa", to: out ? "marwa" : "safa" };
  }

  /** The anticlockwise circle the hero follows: `at(turns)` gives { x, z, heading } after that many turns. */
  function tawafRoute(opts) {
    return {
      at(turns) {
        const a = opts.startAngle + turns * TAU;
        return {
          x: opts.cx + opts.radius * Math.cos(a),
          z: opts.cz - opts.radius * Math.sin(a),
          heading: Math.atan2(-Math.sin(a), -Math.cos(a)),
        };
      },
      circumference: TAU * opts.radius,
    };
  }

  /**
   * The straight lane between the hills: `at(d)` is the position after walking d metres in total
   * (legs alternate direction), `brisk(d)` is true between the green lights, `speed(d)` the pace.
   */
  function saiRoute(opts) {
    const len = Math.hypot(opts.b.x - opts.a.x, opts.b.z - opts.a.z);
    function at(d) {
      const leg = Math.floor(d / len);
      const t = (d - leg * len) / len;
      const [p, q] = leg % 2 === 0 ? [opts.a, opts.b] : [opts.b, opts.a];
      return {
        x: p.x + (q.x - p.x) * t,
        z: p.z + (q.z - p.z) * t,
        heading: Math.atan2(q.x - p.x, q.z - p.z),
        leg: leg + 1,
      };
    }
    const brisk = (d) => {
      const z = at(d).z;
      return z >= opts.lights.z0 && z <= opts.lights.z1;
    };
    return { at, brisk, length: len, speed: (d) => (brisk(d) ? BRISK_SPEED : WALK_SPEED) };
  }

  KQ.Sim.RitualWalk = {
    wrap,
    angleOf,
    blackStoneAngle,
    createTawaf,
    createSai,
    saiLeg,
    tawafRoute,
    saiRoute,
    WALK_SPEED,
    BRISK_SPEED,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
