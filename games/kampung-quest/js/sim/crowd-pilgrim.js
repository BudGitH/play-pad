/* ============================================================================
 * FILE: crowd-pilgrim.js
 * PURPOSE: The pure rules of the Haramain pilgrim crowd (no THREE, no DOM): what pilgrims wear
 *          (ihram, abayas, thobes), how busy each holy activity is through the day (the Haram
 *          never sleeps), the tawaf ring (anticlockwise seen from above), the sa'i lane
 *          (Safa to Marwa and back), the congregational prayer timeline and the qibla.
 *          When KQ.region is "haramain" it also wraps KQ.Sim.Crowd (occupancy, outfit,
 *          walkerTarget, KINDS), so the rest of the crowd code needs no region checks.
 * BUSINESS CONTEXT: AC-H2 (pilgrims: ihram, tawaf anticlockwise, prayer rows facing qibla,
 *   Quran readers). Deterministic: the same slot key and time give the same answer.
 * DEPENDENCIES: crowd.js (KQ.Sim.Crowd). HOW TO TEST: npm run test:kq (crowd-pilgrim.test.mjs).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};
  const SC = KQ.Sim.Crowd;
  const TAU = Math.PI * 2;

  /** The Haramain activity kinds (a slot's `kind`), added to KQ.Sim.Crowd.KINDS in that region. */
  const KINDS = [
    "tawaf",
    "sai",
    "prayer",
    "read",
    "dua",
    "rest",
    "clean",
    "guard",
    "photo",
    "vendor",
  ];
  /** The crowd is bigger in the holy cities: how many extras each quality tier keeps alive. */
  const HOLY_CAPS = { low: 90, med: 140, high: 200 };
  /** Tawaf lanes (metres from the Kaaba's centre) and the walking speed range in m/s. */
  const RING = { rMin: 12.5, rMax: 24.5, vMin: 0.8, vMax: 1.05 };
  /** The sa'i lane: x lanes, and the z extent between Safa and Marwa. */
  const SAI = { zMin: -37, zMax: 37, xs: [40.1, 41.6, 43, 44.4, 45.8], vMin: 0.9, vMax: 1.2 };
  /** One prayer (two raka'at shown): [pose, seconds]. Everyone in a hall follows the same timeline. */
  const PRAYER_CYCLE = [
    ["qiyam", 8],
    ["ruku", 3],
    ["itidal", 2.5],
    ["sujud", 3],
    ["julus", 2],
    ["sujud", 3],
    ["qiyam", 6],
    ["ruku", 3],
    ["itidal", 2.5],
    ["sujud", 3],
    ["julus", 2],
    ["sujud", 3],
    ["julus", 5],
  ];
  const CYCLE_LEN = PRAYER_CYCLE.reduce((n, p) => n + p[1], 0);

  /** A smooth bump around hour `c` with half-width `w` (hours), height 1. */
  function bump(hour, c, w) {
    const x = Math.max(0, 1 - Math.abs(hour - c) / w);
    return x * x * (3 - 2 * x);
  }

  /** How full the prayer halls are: busiest just after each prayer time (minutes list), never empty. */
  function prayerLoad(minute, times) {
    const hour = (((minute % 1440) + 1440) % 1440) / 60;
    let v = 0.12;
    (times || []).forEach((t) => (v = Math.max(v, 0.12 + 0.88 * bump(hour, t / 60 + 0.2, 0.55))));
    return v;
  }

  /** "HH:MM" -> minutes (NaN when malformed). */
  function toMin(text) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || ""));
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  }

  /** The five prayer minutes of KQ.PRAYER_TIMES (empty when absent). */
  function prayerMinutes() {
    const t = KQ.PRAYER_TIMES;
    if (!t) return [];
    return ["subuh", "zohor", "asar", "maghrib", "isyak"]
      .map((k) => toMin(t[k]))
      .filter(Number.isFinite);
  }

  /**
   * How busy a holy activity is, 0..1, at a game minute. Tawaf and sa'i run all day and night with a
   * midday dip; prayer rows fill after each prayer; readers peak after Fajr and Isha; dua is steady.
   */
  function occupancy(kind, minute) {
    const hour = (((minute % 1440) + 1440) % 1440) / 60;
    if (kind === "tawaf") return 0.9 - 0.25 * bump(hour, 14, 2.5);
    if (kind === "sai") return 0.8 - 0.2 * bump(hour, 14, 2.5);
    if (kind === "prayer") return prayerLoad(minute, prayerMinutes());
    if (kind === "read") return 0.45 + 0.4 * Math.max(bump(hour, 6, 1.5), bump(hour, 19.5, 1.5));
    if (kind === "dua") return 0.75;
    return restOccupancy(kind, hour);
  }

  /** Rest, cleaners, guards, photo groups and vendors: busy by day, fewer at night, never none. */
  function restOccupancy(kind, hour) {
    const day = Math.max(bump(hour, 11, 6), bump(hour, 17, 3), 0.1);
    if (kind === "rest") return 0.35 + 0.4 * day;
    if (kind === "clean") return 0.5;
    if (kind === "guard") return 1;
    if (kind === "photo") return 0.12 + 0.75 * day;
    if (kind === "vendor") return 0.25 + 0.65 * day;
    return 0;
  }

  /** The anticlockwise tawaf ring: position (x, z) and heading of a walker at time t (seconds). */
  function tawafAt(ring, t) {
    const th = ring.th0 + (ring.v / ring.r) * t;
    return {
      th,
      x: ring.r * Math.cos(th),
      z: -ring.r * Math.sin(th),
      heading: Math.atan2(-Math.sin(th), -Math.cos(th)),
    };
  }

  /** A cleaner on a patrol line {x0, z0, x1, z1, v, phase}: out and back, with its heading. */
  function patrolAt(line, t) {
    const dx = line.x1 - line.x0;
    const dz = line.z1 - line.z0;
    const len = Math.hypot(dx, dz) || 1;
    const d = (line.phase * 2 * len + line.v * t) % (2 * len);
    const out = d < len;
    const f = (out ? d : 2 * len - d) / len;
    const h = Math.atan2(dx, dz);
    return { x: line.x0 + dx * f, z: line.z0 + dz * f, heading: out ? h : h + Math.PI };
  }

  /** A sa'i walker on its lane at time t: ping-pong between Safa (z min) and Marwa, with its heading. */
  function saiAt(lane, t) {
    const span = SAI.zMax - SAI.zMin;
    const d = (lane.phase * 2 * span + lane.v * t) % (2 * span);
    const south = d < span;
    return {
      x: lane.x + (lane.dx || 0) * (south ? -1 : 1),
      z: south ? SAI.zMin + d : SAI.zMax - (d - span),
      heading: south ? 0 : Math.PI,
      south,
    };
  }

  /** The pose of the congregation at time t (seconds), with `offset` seconds of ripple (rows follow the imam). */
  function prayerPose(t, offset) {
    let u = (((t - (offset || 0)) % CYCLE_LEN) + CYCLE_LEN) % CYCLE_LEN;
    for (let i = 0; i < PRAYER_CYCLE.length; i += 1) {
      if (u < PRAYER_CYCLE[i][1]) return PRAYER_CYCLE[i][0];
      u -= PRAYER_CYCLE[i][1];
    }
    return "qiyam";
  }

  /** Heading (yaw, 0 = facing +z) that faces the qibla from (x, z): the Kaaba in Makkah, south in Madinah. */
  function qiblaHeading(x, z) {
    if (x > 300) return 0;
    if (Math.hypot(x, z) < 0.5) return 0;
    return Math.atan2(-x, -z);
  }

  // ---------- outfits (the profiles are in crowd-pilgrim-dress.js) ----------

  /** Which dress code a seed asks for: ihram at the tawaf and sa'i, thobes in Madinah, mixed elsewhere. */
  function codeOf(seed) {
    if (seed.indexOf("tawaf:") === 0 || seed.indexOf("sai:") === 0) return "ihram";
    if (seed.indexOf("nabawi") !== -1 || seed.indexOf("quba") !== -1) return "thobe";
    return "mix";
  }

  /** Dress an outfit (made by the base outfit()) as a pilgrim, deterministically from the seed. */
  function dress(o, seed) {
    return SC.PilgrimDress.dress(o, seed, codeOf(seed));
  }

  /**
   * The key that decides whether a prayer-row spot is occupied: spots in the same ~12 m stretch of a
   * row share one, so a row fills (or empties) in whole stretches, like a real saf.
   */
  function rowGroup(key) {
    const p = key.split(":");
    const n = Number(p[3]);
    return (
      p.slice(0, 3).join(":") + ":" + (p[1] === "haram" ? Math.floor(n / 12) : Math.floor(n / 120))
    );
  }

  /** Turn the crowd wrappers on for the Haramain region (called once at load). */
  function install() {
    const base = { occupancy: SC.occupancy, outfit: SC.outfit, slotActive: SC.slotActive };
    SC.slotActive = (key, occ, minute) =>
      base.slotActive(key.indexOf("pray:") === 0 ? rowGroup(key) : key, occ, minute);
    KINDS.forEach((k) => SC.KINDS.indexOf(k) === -1 && SC.KINDS.push(k));
    SC.occupancy = function (kind, minute) {
      if (KINDS.indexOf(kind) !== -1) return occupancy(kind, minute);
      const v = base.occupancy(kind, minute);
      return kind === "chat" || kind === "queue" ? Math.max(v, 0.7) : v;
    };
    SC.outfit = (seed, role, female) => dress(base.outfit(seed, role, female), String(seed));
    SC.capFor = (tier) => HOLY_CAPS[tier] || HOLY_CAPS.med;
    SC.walkerTarget = function (minute, tier) {
      const cap = SC.capFor(tier);
      return Math.round(cap * 0.3 * (0.7 + 0.3 * bump((((minute / 60) % 24) + 24) % 24, 12, 7)));
    };
  }

  const Pilgrim = {
    KINDS,
    RING,
    HOLY_CAPS,
    SAI,
    PRAYER_CYCLE,
    CYCLE_LEN,
    occupancy,
    prayerLoad,
    tawafAt,
    saiAt,
    patrolAt,
    prayerPose,
    rowGroup,
    qiblaHeading,
    dress,
    codeOf,
    install,
    TAU,
  };
  SC.Pilgrim = Pilgrim;
  if (KQ.region === "haramain") install();
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
