/* ============================================================================
 * FILE: ambience-mix.js
 * PURPOSE: The pure maths behind the ambient soundscape: given a clock minute and where the hero
 *          stands, how loud is each layer (traffic, wind, leaves, hawker murmur, crickets,
 *          birds, crockery clinks), how muffled is the bus (inside the mosque hall) and what is the
 *          floor surface. No Web Audio, no DOM, no THREE: the prayer times and the town's
 *          rectangles are passed in, so it is unit-tested with fixtures.
 * BUSINESS CONTEXT: owner request "atmospheric sounds". Birds follow the day (Subuh to Maghrib),
 *   crickets the night, the hawker centre its opening hours, traffic the rush hours, and the
 *   mosque compound is calmer. The azan / prayer quiet rule is NOT here (it is wiring, in
 *   js/game/ambience.js).
 * DEPENDENCIES: none. Called by js/game/ambience.js with KQ.PRAYER_TIMES and the town layout.
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/ambience-mix.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};
  const HOUR = 60;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /** "HH:MM" to minutes (0 for anything that is not a time). */
  function toMin(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm));
    return m ? Number(m[1]) * HOUR + Number(m[2]) : 0;
  }

  /** The prayer times the day is built on (Subuh, Syuruk = sunrise, Maghrib = sunset), in minutes. */
  function dayTimes(times) {
    return {
      subuh: toMin(times.subuh),
      syuruk: toMin(times.syuruk),
      maghrib: toMin(times.maghrib),
    };
  }

  /** 0 below a, 1 above b, smooth between. */
  function ramp(v, a, b) {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /** Distance from a point to a rectangle {x0,x1,z0,z1} (0 inside). */
  function rectDist(r, x, z) {
    return Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
  }

  /** 1 at distance `near` or less, 0 at `far` or more. */
  function prox(d, near, far) {
    return 1 - ramp(d, near, far);
  }

  /** A bump of height 1 centred on a minute, `half` minutes wide each side. */
  function bump(m, centre, half) {
    return 1 - ramp(Math.abs(m - centre), 0, half);
  }

  /**
   * What the clock says: how loud birds, insects, traffic and the hawker centre are.
   * @param {number} minute minutes since midnight (any number; wraps)
   * @param {{subuh:string,syuruk:string,maghrib:string}} times "HH:MM" prayer times
   */
  function mixTime(minute, times) {
    const m = ((minute % 1440) + 1440) % 1440;
    const t = dayTimes(times);
    const birds = ramp(m, t.subuh, t.syuruk + 30) * (1 - ramp(m, t.maghrib - 50, t.maghrib + 10));
    const insects = Math.max(
      ramp(m, t.maghrib - 5, t.maghrib + 25),
      1 - ramp(m, t.subuh - 15, t.subuh + 15),
    );
    const deep = Math.max(ramp(m, 22 * HOUR, 23 * HOUR), 1 - ramp(m, 5 * HOUR, 6 * HOUR));
    const rush = bump(m, 8 * HOUR, 70) + bump(m, 18 * HOUR, 80);
    const open = ramp(m, 6 * HOUR, 7 * HOUR) * (1 - ramp(m, 21.5 * HOUR, 22.5 * HOUR));
    return {
      birds,
      insects,
      traffic: lerp(1, 0.4, deep) * (1 + 0.2 * rush),
      open: 0.12 + 0.88 * open,
    };
  }

  /**
   * Where the hero stands: near the hawker centre, in the park, in the mosque, near a road.
   * @param {{hawker:object,park:object,mosque:{hall:object}}} rects rectangles {x0,x1,z0,z1}
   */
  function mixPlace(x, z, rects) {
    const L = rects;
    const indoor = 1 - ramp(rectDist(L.mosque.hall, x, z), 0, 3);
    const compound = prox(rectDist(L.mosque, x, z), 0, 6);
    const green = prox(rectDist(L.park, x, z), 0, 22);
    const road = prox(Math.min(Math.abs(x), Math.abs(z)), 6, 40);
    const hawker = prox(rectDist(L.hawker, x, z), 0, 26) * (1 - indoor);
    const surface = indoor > 0.5 ? "carpet" : rectDist(L.park, x, z) === 0 ? "grass" : "paving";
    return { indoor, compound, green, road, hawker, surface };
  }

  /**
   * The full target mix for a clock minute and a hero position: per-bed levels 0..1, how muffled
   * the bus is (0 open air .. 1 inside the mosque hall) and the overall level.
   */
  function mixFor(minute, x, z, times, rects) {
    const t = mixTime(minute, times);
    const p = mixPlace(x, z, rects);
    const calm = 1 - 0.4 * p.compound;
    return {
      traffic: t.traffic * lerp(0.45, 1, p.road) * calm,
      wind: 0.6 * (0.8 + 0.2 * p.green),
      leaves: 0.5 + 0.5 * p.green,
      murmur: t.open * p.hawker,
      crickets: t.insects * (0.7 + 0.3 * p.green),
      birds: t.birds * (0.75 + 0.25 * p.green),
      clink: t.open * p.hawker,
      indoor: p.indoor,
      master: 1 - 0.45 * p.indoor,
      surface: p.surface,
    };
  }

  KQ.Sim.AmbienceMix = { toMin, dayTimes, ramp, rectDist, prox, bump, mixTime, mixPlace, mixFor };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
