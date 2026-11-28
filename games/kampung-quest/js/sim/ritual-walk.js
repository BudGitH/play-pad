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
  /** The hero must come within this angle (about 35 degrees) of the Black Stone line to start counting rounds. */
  const NEAR_LINE = 0.6;
  /** A round counts a little before the line (about 26 degrees), so walking a touch wide still counts. */
  const SLACK = 0.45;
  /**
   * Auto-walk pace in metres per second. Calm and child-friendly: about a stroll (the hero's own
   * walk is 2.3 m/s), a little quicker between the green lights. One tawaf round is ~31 s.
   */
  const TAWAF_SPEED = 2.8;
  const WALK_SPEED = 3;
  const BRISK_SPEED = 4.2;
  /** The auto-walk circle around the Kaaba (metres from its centre). */
  const TAWAF_RADIUS = 14;
  /** Guide dots: metres between two dots, and how many dots ahead of the hero glow. */
  const DOT_GAP = 2;
  const LIT_AHEAD = 4;
  /** Half the length (m) of the gold start line across the tawaf lane. */
  const LINE_HALF = 5;

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
   * Add the hero's turn since the last position to a tawaf counter state. The count is CUMULATIVE
   * against the Black Stone line: T.total is the anticlockwise angle walked since the line (it never
   * drops below -SLACK, so clockwise steps cannot build up debt), and round n is banked once
   * T.total >= n * TAU - SLACK. The forgiving SLACK is therefore spent once, not once per round: the
   * seventh round needs about 6.93 laps from the line, never 6.5 (QA round 2, HIGH).
   */
  function turnTawaf(T, th, max) {
    if (T.last === null) return;
    const d = wrap(th - T.last);
    if (Math.abs(d) > 0.01) T.back = d < 0;
    T.total = Math.max(-SLACK, T.total + d);
    while (T.rounds < max && T.total >= (T.rounds + 1) * TAU - SLACK) T.rounds += 1;
  }

  /**
   * A tawaf round counter. opts: { cx, cz, startAngle, rMin, rMax, rounds }.
   * feed(x, z) with the hero's position every frame; it returns the rounds counted so far (capped at
   * `rounds`). Counting begins when the hero first passes the Black Stone line. Leaving the ring
   * pauses counting and keeps the progress, so wandering off a little never loses a round.
   */
  function createTawaf(opts) {
    const T = { armed: false, last: null, total: 0, rounds: 0, back: false, onRing: false };
    const max = opts.rounds || 7;
    /**
     * Feed one walker position; counts a lap each time the ring is closed.
     * @param {number} x world x
     * @param {number} z world z
     * @returns {number} the rounds counted so far
     */
    function feed(x, z) {
      const r = Math.hypot(x - opts.cx, z - opts.cz);
      T.onRing = r >= opts.rMin && r <= opts.rMax;
      if (!T.onRing) {
        T.last = null;
        return T.rounds;
      }
      const th = angleOf(opts.cx, opts.cz, x, z);
      if (!T.armed && Math.abs(wrap(th - opts.startAngle)) < NEAR_LINE) {
        Object.assign(T, { armed: true, total: wrap(th - opts.startAngle), last: th });
      } else if (T.armed) turnTawaf(T, th, max);
      T.last = th;
      return T.rounds;
    }
    return {
      feed,
      get rounds() {
        return T.rounds;
      },
      get armed() {
        return T.armed;
      },
      /** How far through the current round the hero is, 0..1. */
      get progress() {
        return Math.max(0, Math.min(1, (T.total - T.rounds * TAU) / TAU));
      },
      /** True while the hero is walking clockwise (the wrong way round). */
      get back() {
        return T.back;
      },
      get onRing() {
        return T.onRing;
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
      /** The hill the hero is heading for now: "b" (Marwa) or "a" (Safa). */
      get want() {
        return S.want;
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
      at: (turns) => circlePoint(opts, opts.startAngle + turns * TAU),
      circumference: TAU * opts.radius,
    };
  }

  /** The point on the circle at a map angle, with the heading of an anticlockwise walker there. */
  function circlePoint(opts, a) {
    return {
      x: opts.cx + opts.radius * Math.cos(a),
      z: opts.cz - opts.radius * Math.sin(a),
      heading: Math.atan2(-Math.sin(a), -Math.cos(a)),
    };
  }

  /**
   * The straight lane between the hills: `at(d)` is the position after walking d metres in total
   * (legs alternate direction), `brisk(d)` is true between the green lights, `speed(d)` the pace.
   */
  function saiRoute(opts) {
    const len = Math.hypot(opts.b.x - opts.a.x, opts.b.z - opts.a.z);
    /**
     * The walker position at a distance along the route.
     * @param {number} d metres walked so far (legs alternate direction)
     * @returns {{x: number, z: number, heading: number, leg: number}} the point and facing
     */
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

  /* ------------------------------ guidance: dots, lines, hints ------------------------------ */

  /** A short gold line across the path: from (x1, z1) to (x2, z2). */
  function crossLine(x, z, dx, dz, half) {
    return { x1: x - dx * half, z1: z - dz * half, x2: x + dx * half, z2: z + dz * half };
  }

  /** The dotted anticlockwise circle round the Kaaba (opts: { cx, cz, startAngle, radius }) and its start line. */
  function tawafGuide(opts) {
    const n = Math.max(8, Math.round((TAU * opts.radius) / DOT_GAP));
    const dots = [];
    for (let i = 0; i < n; i += 1) dots.push(circlePoint(opts, opts.startAngle + (i / n) * TAU));
    const s = dots[0];
    const out = { x: Math.cos(opts.startAngle), z: -Math.sin(opts.startAngle) };
    return { closed: true, dots, lines: [crossLine(s.x, s.z, out.x, out.z, LINE_HALF)] };
  }

  /** The dotted lane from Safa to Marwa (opts: { a, b, w }) with a line across it at each hill. */
  function saiGuide(opts) {
    const len = Math.hypot(opts.b.x - opts.a.x, opts.b.z - opts.a.z);
    const ux = (opts.b.x - opts.a.x) / len;
    const uz = (opts.b.z - opts.a.z) / len;
    const n = Math.max(2, Math.round(len / DOT_GAP));
    const heading = Math.atan2(ux, uz);
    const dots = [];
    for (let i = 0; i <= n; i += 1) {
      const t = (i / n) * len;
      dots.push({ x: opts.a.x + ux * t, z: opts.a.z + uz * t, heading });
    }
    const half = (opts.w || 10) / 2;
    const lines = [opts.a, opts.b].map((p) => crossLine(p.x, p.z, -uz, ux, half));
    return { closed: false, dots, lines };
  }

  /** Index of the dot nearest to a point. */
  function nearestDot(dots, x, z) {
    let best = 0;
    let bestD = Infinity;
    dots.forEach((d, i) => {
      const k = (d.x - x) * (d.x - x) + (d.z - z) * (d.z - z);
      if (k < bestD) [best, bestD] = [i, k];
    });
    return best;
  }

  /** Indices of the dots to glow: the next few ahead of `from`, going `dir` (+1 / -1), wrapping on a closed circle. */
  function litAhead(guide, from, dir, count) {
    const n = guide.dots.length;
    const out = [];
    for (let k = 1; k <= count; k += 1) {
      const i = from + dir * k;
      if (guide.closed) out.push(((i % n) + n) % n);
      else if (i >= 0 && i < n) out.push(i);
    }
    return out;
  }

  /**
   * What to light now. s: { x, z, armed, want } (the hero's position, whether counting has begun and,
   * for sa'i, the hill being walked to). Returns { lit: dot indices, from: nearest dot, arrow: {x, z,
   * heading} | null } where the arrow stands on the first glowing dot and points along the path.
   */
  function guideState(guide, s) {
    const dots = guide.dots;
    const near = nearestDot(dots, s.x, s.z);
    let from = near;
    let dir = 1;
    if (guide.closed) from = s.armed ? near : dots.length - 1;
    else dir = (s.armed ? s.want === "b" : near === 0) ? 1 : -1;
    const lit = litAhead(guide, from, dir, LIT_AHEAD);
    if (!lit.length) return { lit, from, arrow: null };
    const a = dots[from];
    const b = dots[lit[0]];
    const heading = a === b ? b.heading : Math.atan2(b.x - a.x, b.z - a.z);
    return { lit, from, arrow: { x: b.x, z: b.z, heading } };
  }

  /**
   * One gentle sentence for the tawaf. s: { rounds, target, armed, onRing, back, progress }. Never
   * scolds: the wrong way gets "Other way, please", and everything else says what to do next.
   */
  function tawafHint(s) {
    if (s.rounds >= s.target) return "All " + s.target + " rounds done. Press Next.";
    if (!s.armed) return "Walk to the gold line by the Black Stone corner, then follow the dots.";
    if (!s.onRing) return "Come back to the dots round the Kaaba and keep going.";
    if (s.back) return "Other way, please: keep the Kaaba on your LEFT.";
    const n = s.rounds + 1;
    if (s.progress >= 0.8) return "Nearly round " + n + "! Walk on to the gold line.";
    if (s.rounds === 0 && s.progress < 0.1)
      return "Off we go! Keep the Kaaba on your left and follow the dots.";
    return "Round " + n + " of " + s.target + ": keep the Kaaba on your left.";
  }

  /**
   * One gentle sentence for sa'i. s: { legs, target, armed, want, toGoal } with toGoal the metres
   * left to the hill being walked to.
   */
  function saiHint(s) {
    if (s.legs >= s.target) return "All " + s.target + " legs done, ending at Marwa. Press Next.";
    const goal = s.want === "b" ? "Marwa" : "Safa";
    if (!s.armed) return "Walk to Safa to begin, then follow the dots to Marwa.";
    if (s.toGoal < 12) return "Nearly at " + goal + "! Touch the gold line.";
    return "Follow the dots to " + goal + ".";
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
    tawafGuide,
    saiGuide,
    guideState,
    tawafHint,
    saiHint,
    WALK_SPEED,
    BRISK_SPEED,
    TAWAF_SPEED,
    TAWAF_RADIUS,
    DOT_GAP,
    LIT_AHEAD,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
