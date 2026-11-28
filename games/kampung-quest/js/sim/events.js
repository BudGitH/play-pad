/* ============================================================================
 * FILE: events.js
 * PURPOSE: The world-event director: decides WHEN a small scripted moment (a football kick-about,
 *          an ice-cream cart, a wedding procession, a flock of pigeons ...) starts near the hero
 *          and when it ends. Pure scheduling and choice; js/game/world-events.js shows them.
 * BUSINESS CONTEXT: playability round AC-P18. At most one event at a time, one every few minutes
 *   of free play, never during a prayer, the azan, a rite, a menu or a pause (the play clock only
 *   runs while nothing blocks it), and the choice avoids repeating the last events. Nothing here
 *   can fail the player: an event is a little extra life, optional to join.
 * DEPENDENCIES: none (no THREE, no DOM). Randomness is injected (seed it for repeatable tests).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/events.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const DAY = [7 * 60, 19 * 60];
  /**
   * Every event: its region, the window of the game day it fits (minutes), how long it lasts at
   * most (seconds of free play), how often it is picked (weight), and the name on the radar blip.
   */
  const CATALOGUE = [
    {
      id: "football",
      region: "kampung",
      day: [8 * 60, 18 * 60],
      secs: 75,
      weight: 3,
      label: "Football",
    },
    {
      id: "icecream",
      region: "kampung",
      day: [10 * 60, 18 * 60],
      secs: 80,
      weight: 3,
      label: "Ice cream",
    },
    { id: "catchase", region: "kampung", day: DAY, secs: 50, weight: 2, label: "Mimi" },
    {
      id: "kompang",
      region: "kampung",
      day: [9 * 60, 18 * 60],
      secs: 60,
      weight: 2,
      label: "Wedding",
    },
    { id: "rain", region: "kampung", day: [0, 24 * 60], secs: 40, weight: 2, label: "Rain" },
    {
      id: "balloon",
      region: "kampung",
      day: [8 * 60, 18 * 60],
      secs: 55,
      weight: 2,
      label: "Balloon",
    },
    { id: "pigeons", region: "haramain", day: [0, 24 * 60], secs: 25, weight: 3, label: "Pigeons" },
    {
      id: "dates",
      region: "haramain",
      day: [0, 24 * 60],
      secs: 80,
      weight: 3,
      label: "Free dates",
    },
    { id: "photo", region: "haramain", day: [0, 24 * 60], secs: 80, weight: 2, label: "Photo" },
  ];

  const CONFIG = {
    /** Seconds of free play before the first event, and the gap (min..max) between events. */
    firstDelay: 75,
    gapMin: 140,
    gapMax: 260,
    /** How many of the latest events are not picked again straight away. */
    avoidLast: 2,
  };

  /** The reasons that stop an event; the first true flag names the reason. */
  const REASONS = [
    "paused",
    "modal",
    "azan",
    "prayerDue",
    "prayerScreen",
    "ritual",
    "eating",
    "mounted",
    "riding",
  ];

  /**
   * Why events must wait right now, or null when the way is clear.
   * @param {Object<string, boolean>} flags any of REASONS set true
   */
  function blockedReason(flags) {
    const f = flags || {};
    return REASONS.find((name) => f[name]) || null;
  }

  /** Is this event allowed in this region at this minute of the game day? */
  function fits(ev, region, minute, exclude) {
    const m = Number.isFinite(minute) ? minute : 12 * 60;
    return (
      ev.region === region &&
      m >= ev.day[0] &&
      m < ev.day[1] &&
      !(exclude && exclude.indexOf(ev.id) !== -1)
    );
  }

  /** Pick an event by weight from the ones that fit, skipping the latest few; null if none fits. */
  function choose(rand, region, minute, recent, exclude) {
    const all = CATALOGUE.filter((ev) => fits(ev, region, minute, exclude));
    const fresh = all.filter((ev) => recent.indexOf(ev.id) === -1);
    const pool = fresh.length > 0 ? fresh : all;
    const total = pool.reduce((sum, ev) => sum + ev.weight, 0);
    if (total <= 0) return null;
    let roll = rand() * total;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= pool[i].weight;
      if (roll < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /** The catalogue entry for an id, or null. */
  function byId(id) {
    return CATALOGUE.find((ev) => ev.id === id) || null;
  }

  /** The next gap in seconds (a roll between gapMin and gapMax). */
  function nextGap(K) {
    return K.cfg.gapMin + K.roll() * (K.cfg.gapMax - K.cfg.gapMin);
  }

  /** Begin an event now: mark it active and remember it among the recent ones. */
  function begin(K, ev) {
    K.active = { id: ev.id, left: ev.secs, label: ev.label };
    K.recent.push(ev.id);
    if (K.recent.length > K.cfg.avoidLast) K.recent.shift();
    K.started += 1;
    return { type: "start", id: ev.id, secs: ev.secs };
  }

  /** End the active event, set the next gap, and describe it. */
  function finish(K, reason, wait) {
    const id = K.active.id;
    K.active = null;
    K.wait = Number.isFinite(wait) ? wait : nextGap(K);
    return { type: "end", id, reason };
  }

  /** While an event runs: count its time down (or end it when blocked or out of time). */
  function tickActive(K, dt, ctx, why) {
    if (why) return finish(K, why);
    K.active.left -= dt;
    return K.active.left <= 0 ? finish(K, "time") : null;
  }

  /** While waiting: count the quiet time down and start the next event when it is due. */
  function tickWaiting(K, dt, ctx) {
    K.wait -= dt;
    if (K.wait > 0) return null;
    const ev = choose(K.roll, ctx.region, ctx.minute, K.recent, ctx.exclude);
    if (!ev) {
      K.wait = 30;
      return null;
    }
    return begin(K, ev);
  }

  /**
   * Make a director.
   * @param {() => number} rand random source in [0, 1)
   * @param {object} [config] overrides for CONFIG (tests)
   */
  function create(rand, config) {
    const K = {
      cfg: Object.assign({}, CONFIG, config || {}),
      roll: rand || Math.random,
      active: null,
      recent: [],
      started: 0,
      wait: 0,
    };
    K.wait = K.cfg.firstDelay;
    return {
      /**
       * Advance by `dt` seconds of wall time.
       * @param {{region:string, minute:number, flags:object, exclude?:string[]}} ctx
       * @returns {{type:"start"|"end", id:string}|null} what changed (never both in one call)
       */
      update(dt, ctx) {
        const why = blockedReason(ctx.flags);
        if (K.active) return tickActive(K, dt, ctx, why);
        return why ? null : tickWaiting(K, dt, ctx);
      },
      /** Start a named event now (tests, or a mission that asks for it); refused while one runs. */
      force(id, flags) {
        const ev = byId(id);
        if (!ev || K.active || blockedReason(flags)) return null;
        return begin(K, ev);
      },
      /** End the active event early (it finished its own script, or the hero left). */
      stop(reason, wait) {
        return K.active ? finish(K, reason || "done", wait) : null;
      },
      active: () => (K.active ? Object.assign({}, K.active) : null),
      debug: () => ({
        active: K.active ? K.active.id : null,
        wait: Number(K.wait.toFixed(1)),
        recent: K.recent.slice(),
        started: K.started,
      }),
    };
  }

  KQ.Sim.Events = { create, choose, blockedReason, byId, CATALOGUE, CONFIG, REASONS };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
