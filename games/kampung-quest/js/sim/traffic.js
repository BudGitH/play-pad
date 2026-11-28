/* ============================================================================
 * FILE: traffic.js
 * PURPOSE: The pure rules of the ambient traffic and the bus's passengers: how fast a car may go with people,
 *          other vehicles and a zebra crossing ahead, where it sits on the road while it pulls into a parking
 *          bay, how many cars a tier allows, how many people get off and on at a stop, and when a car that is
 *          held up for good quietly goes away. No THREE, no DOM.
 * BUSINESS CONTEXT: AC-P26 (features/kampung-quest-playability/requirements.md). Owner request "cars driven around with people in them, buses with passengers getting on
 *   and off". Child-friendly (CLAUDE.md): traffic only ever slows down for a person, the hero, the bus or
 *   another car; it never touches anyone and never holds the hero up for good (a car held up too long, out
 *   of sight, simply goes away).
 * CONVENTIONS: heading 0 faces +z, forward = (sin h, cos h), a bigger heading turns LEFT (as in vehicle.js).
 * DEPENDENCIES: none. HOW TO TEST: npm run test:kq (tests/kampung-quest/traffic.test.mjs).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /** Comfortable stopping rate (m/s^2), the clear gap kept to a person and to a vehicle (m), a person's radius. */
  const COMFORT = 5;
  const GAP_PERSON = 0.9;
  const GAP_VEHICLE = 1.2;
  const PERSON_R = 0.4;
  /** How far ahead anything matters, at least (m); fast cars look as far as they need to stop. */
  const LOOK = 16;
  /** How much of the other vehicle's width counts as in the way. */
  const WIDTH_SHARE = 0.9;

  /** Traffic cars allowed per quality tier, by region. */
  const COUNTS = {
    kampung: { low: 2, med: 3, high: 4 },
    haramain: { low: 1, med: 2, high: 3 },
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const smooth = (t) => t * t * (3 - 2 * t);

  /** How many traffic cars a tier and region allow. */
  function countFor(tier, region) {
    const row = COUNTS[region === "haramain" ? "haramain" : "kampung"];
    return row[tier] === undefined ? row.med : row[tier];
  }

  /** A point's place in a car's frame: `fwd` ahead, `lat` to its left (positive). */
  function local(c, x, z) {
    const dx = x - c.x;
    const dz = z - c.z;
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    return { fwd: dx * fx + dz * fz, lat: dx * fz - dz * fx };
  }

  /** How far ahead matters for a car going `speed` (m): what it needs to stop plus its length and a margin. */
  function lookAhead(c, speed) {
    return Math.max(LOOK, (speed * speed) / (2 * COMFORT) + c.halfLen + 4);
  }

  /** The speed allowed with something `gap` metres ahead that itself moves at `along` m/s the same way (>= 0). */
  function allowed(gap, along) {
    if (gap <= 0) return 0;
    return Math.sqrt(Math.max(0, along) * Math.max(0, along) + 2 * COMFORT * gap);
  }

  /** The speed cap a person ahead gives (Infinity when they are not in the way). */
  function personCap(c, p) {
    const at = local(c, p.x, p.z);
    const reach = lookAhead(c, c.speed || 0);
    if (Math.abs(at.lat) > c.halfWid + PERSON_R + 0.3 || at.fwd < -c.halfLen) return Infinity;
    if (at.fwd > reach) return Infinity;
    if (at.fwd <= c.halfLen) return 0;
    return allowed(at.fwd - c.halfLen - PERSON_R - GAP_PERSON, 0);
  }

  /**
   * The points of another vehicle that matter: its nose, middle and tail, and one more a second ahead of its
   * nose (so a car pulling out across the road is seen before it gets there).
   */
  function samples(o, ref) {
    const fx = Math.sin(o.heading);
    const fz = Math.cos(o.heading);
    const h = o.halfLen || 0;
    const crossing = Math.abs(Math.cos(o.heading - ref)) < 0.7;
    const lead = crossing ? Math.max(0, o.speed || 0) : 0;
    const offs = [];
    for (let d = -h; d < h; d += 2) offs.push(d); // a long vehicle (the bus) is several points
    offs.push(h, h + lead);
    return offs.map((d) => ({ x: o.x + fx * d, z: o.z + fz * d }));
  }

  /** The speed cap another vehicle gives a car (Infinity when it is not in the way). */
  function vehicleCap(c, o) {
    const reach = lookAhead(c, c.speed || 0);
    const sideLimit = c.halfWid + (o.halfWid || 0.8) * WIDTH_SHARE;
    const along = (o.speed || 0) * (Math.cos(o.heading - c.heading) > 0.5 ? 1 : 0);
    let cap = Infinity;
    samples(o, c.heading).forEach(function (p) {
      const at = local(c, p.x, p.z);
      if (Math.abs(at.lat) >= sideLimit || at.fwd < -c.halfLen * 0.5 || at.fwd > reach) return;
      cap = Math.min(
        cap,
        at.fwd <= c.halfLen ? 0 : allowed(at.fwd - c.halfLen - GAP_VEHICLE, along),
      );
    });
    return cap;
  }

  /**
   * The zebra crossing's cap. `cr` is {axis, at, half, margin}: "x" = the crossing is at fixed x across the
   * E-W road (people walk along z), "z" = at fixed z across the N-S road; `half` is the road's half width and
   * `margin` the extra metres either side that count. A car before the stripes stops short of them while
   * anyone stands on them; one already on them goes on.
   */
  function crossingCap(c, cr, people) {
    const alongX = Math.abs(Math.sin(c.heading)) > 0.7;
    if ((cr.axis === "x") !== alongX) return Infinity; // only crossings over the road it drives on
    if (!people.some((p) => onCrossing(cr, p))) return Infinity;
    const w = cr.margin + 1.4;
    const mid = cr.axis === "x" ? { x: cr.at, z: c.z } : { x: c.x, z: cr.at };
    const at = local(c, mid.x, mid.z);
    if (at.fwd < 0) return Infinity;
    const edge = at.fwd - w - c.halfLen - GAP_PERSON;
    if (edge < -GAP_PERSON - 0.5) return Infinity; // already over the stripes: carry on
    return edge <= 0 ? 0 : allowed(edge, 0);
  }

  /** Is a person on the crossing (its stripes and the margin each side, across the carriageway's width)? */
  function onCrossing(cr, p) {
    const along = cr.axis === "x" ? p.x - cr.at : p.z - cr.at;
    const across = cr.axis === "x" ? p.z : p.x;
    return Math.abs(along) <= 1.4 + cr.margin && Math.abs(across) <= cr.half + 0.6;
  }

  /** The least of several caps. */
  const combine = (caps) => caps.reduce((a, b) => Math.min(a, b), Infinity);

  /**
   * The cap on a traffic car: the slowest allowed by every person, other vehicle and busy crossing.
   * @param c the car {x, z, heading, speed, halfLen, halfWid}
   */
  function capFor(c, people, vehicles, crossings) {
    const caps = [];
    people.forEach((p) => caps.push(personCap(c, p)));
    vehicles.forEach((o) => caps.push(vehicleCap(c, o)));
    (crossings || []).forEach((cr) => caps.push(crossingCap(c, cr, people)));
    return combine(caps);
  }

  /**
   * Lateral offset while pulling into (or out of) a bay: `lane` far away, `bay` at the stop, eased over `len`
   * metres; `d` = metres still to go to the bay stop (0 at the stop, negative once past it when pulling out).
   */
  function bayOffset(lane, bay, d, len) {
    const k = smooth(clamp(1 - d / len, 0, 1));
    return lane + (bay - lane) * k;
  }

  /**
   * How many people get off and on at a stop.
   * @param {()=>number} rng 0..1
   * @param {number} seated people on board, @param {number} waiting people at the stop, @param {number} seats
   * @returns {{off:number, on:number}} 1-3 off (if anyone is on), 1-3 on (if anyone waits and there is room)
   */
  function boarding(rng, seated, waiting, seats) {
    const pick = () => 1 + Math.floor(rng() * 3);
    const off = seated > 0 ? Math.min(seated, pick()) : 0;
    const room = Math.max(0, seats - (seated - off));
    const on = waiting > 0 ? Math.min(waiting, room, pick()) : 0;
    return { off, on };
  }

  /** Seconds a car may be held up by something that is not a person before it gives up and goes away. */
  const STUCK_SECS = 14;

  /**
   * Should a held-up car quietly go away? Only when it was stopped by a vehicle (not by a person on foot or the
   * hero), for STUCK_SECS, and nobody can see it (so it never vanishes in front of the child).
   */
  function shouldVanish(stuckSecs, byPerson, seen) {
    return !byPerson && !seen && stuckSecs > STUCK_SECS;
  }

  KQ.Sim.Traffic = {
    COUNTS,
    STUCK_SECS,
    countFor,
    local,
    lookAhead,
    allowed,
    personCap,
    vehicleCap,
    crossingCap,
    onCrossing,
    capFor,
    combine,
    bayOffset,
    boarding,
    shouldVanish,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
