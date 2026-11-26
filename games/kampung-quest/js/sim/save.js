/* ============================================================================
 * FILE: save.js
 * PURPOSE: Defensive localStorage persistence under the key "kampung-quest:v1".
 * BUSINESS CONTEXT: AC-13 and the edge cases "corrupt or missing saves fall back to
 *   a new game without throwing" and "localStorage blocked -> play without saving".
 *   Risk (requirements NFR): the save is UNTRUSTED input - it is parsed, schema-checked,
 *   numbers are clamped, unknown ids are dropped, and only known keys are ever read
 *   (so a hand-crafted "__proto__" key or "1e999" number cannot do harm).
 * DEPENDENCIES: optional KQ.Sim.Prayer / KQ.Sim.Missions / KQ.Sim.Economy for the
 *   sub-schemas (load order: ids, clock, prayer, needs, economy, missions, schedule, save).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/save.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const KEY = "kampung-quest:v1";
  const VERSION = 1;
  /** A real save is a few KB; refuse absurd blobs before parsing. */
  const MAX_CHARS = 200000;
  const QUALITIES = ["low", "med", "high"];
  const DEFAULT_OUTFIT = { hair: "classic", hat: "none" };

  function clampNumber(value, min, max, fallback) {
    const n = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function pick(list, value, fallback) {
    return typeof value === "string" && list.indexOf(value) !== -1 ? value : fallback;
  }

  /** A brand-new game: 07:00 on day 1, starter coins, full-ish meters. */
  function defaultState() {
    return {
      v: VERSION,
      clock: { minute: 420, day: 1 },
      coins: 10,
      needs: { hunger: 85, energy: 90 },
      missions: { active: null, completed: [], stickers: [] },
      prayers: null,
      outfit: Object.assign({}, DEFAULT_OUTFIT),
      pos: null,
      settings: { muted: false, quality: "med" },
    };
  }

  function cleanMissions(raw) {
    const missions = KQ.Sim.Missions;
    if (missions && missions.sanitizeSnapshot) return missions.sanitizeSnapshot(raw);
    return defaultState().missions;
  }

  function cleanPrayers(raw) {
    const prayer = KQ.Sim.Prayer;
    return prayer && prayer.sanitizeSnapshot ? prayer.sanitizeSnapshot(raw) : null;
  }

  function cleanOutfit(raw) {
    const options = KQ.Sim.OUTFIT_OPTIONS || {
      hair: [DEFAULT_OUTFIT.hair],
      hat: [DEFAULT_OUTFIT.hat],
    };
    const src = isObject(raw) ? raw : {};
    return {
      hair: pick(options.hair, src.hair, DEFAULT_OUTFIT.hair),
      hat: pick(options.hat, src.hat, DEFAULT_OUTFIT.hat),
    };
  }

  function cleanPos(raw) {
    if (!isObject(raw)) return null;
    const x = clampNumber(raw.x, -1000, 1000, NaN);
    const z = clampNumber(raw.z, -1000, 1000, NaN);
    return Number.isNaN(x) || Number.isNaN(z) ? null : { x, z };
  }

  /**
   * Validate and normalise any value into a safe save state.
   * @param {*} raw parsed JSON (untrusted)
   * @returns {object|null} clean state, or null when the shape/version is unusable
   */
  function sanitize(raw) {
    if (!isObject(raw) || raw.v !== VERSION) return null;
    const base = defaultState();
    const clock = isObject(raw.clock) ? raw.clock : {};
    const needs = isObject(raw.needs) ? raw.needs : {};
    const settings = isObject(raw.settings) ? raw.settings : {};
    return {
      v: VERSION,
      clock: {
        minute: clampNumber(clock.minute, 0, 1439.99, base.clock.minute),
        day: Math.floor(clampNumber(clock.day, 1, 99999, 1)),
      },
      coins: Math.floor(clampNumber(raw.coins, 0, 99999, base.coins)),
      needs: {
        hunger: clampNumber(needs.hunger, 0, 100, base.needs.hunger),
        energy: clampNumber(needs.energy, 0, 100, base.needs.energy),
      },
      missions: cleanMissions(raw.missions),
      prayers: cleanPrayers(raw.prayers),
      outfit: cleanOutfit(raw.outfit),
      pos: cleanPos(raw.pos),
      settings: {
        muted: settings.muted === true,
        quality: pick(QUALITIES, settings.quality, "med"),
      },
    };
  }

  function fresh(status, error) {
    const result = { state: defaultState(), status };
    if (error) result.error = error;
    return result;
  }

  /**
   * Load a save. NEVER throws.
   * @param {Storage|null} storage localStorage-like object (may be null or throwing)
   * @returns {{state:object, status:'loaded'|'new'|'corrupt'|'unavailable', error?:string}}
   *   `state` is always a valid, clamped state (a new game unless status is 'loaded').
   */
  function load(storage) {
    let text;
    try {
      text = storage.getItem(KEY);
    } catch (err) {
      return fresh("unavailable", String(err && err.message));
    }
    if (text === null || text === undefined) return fresh("new");
    if (typeof text !== "string" || text.length > MAX_CHARS) return fresh("corrupt", "bad value");
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return fresh("corrupt", "not JSON");
    }
    const clean = sanitize(parsed);
    return clean ? { state: clean, status: "loaded" } : fresh("corrupt", "wrong schema");
  }

  /**
   * Save a state (sanitised first so junk is never written). NEVER throws.
   * @returns {{ok:boolean, reason?:'unavailable'|'invalid'}}
   */
  function save(storage, state) {
    const clean = isObject(state) ? sanitize(Object.assign({}, state, { v: VERSION })) : null;
    if (!clean) return { ok: false, reason: "invalid" };
    try {
      storage.setItem(KEY, JSON.stringify(clean));
    } catch (err) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true };
  }

  /** Forget the save (start over). Never throws. */
  function clear(storage) {
    try {
      storage.removeItem(KEY);
    } catch (err) {
      return false;
    }
    return true;
  }

  /** Build a save state from the live sim modules: { clock, economy, needs, missions, prayer, outfit, pos, settings }. */
  function capture(sim) {
    const base = defaultState();
    return {
      v: VERSION,
      clock: { minute: sim.clock.minute, day: sim.clock.day },
      coins: sim.economy.coins,
      needs: sim.needs.snapshot(),
      missions: sim.missions.snapshot(),
      prayers: sim.prayer ? sim.prayer.snapshot() : null,
      outfit: sim.outfit || base.outfit,
      pos: sim.pos || null,
      settings: sim.settings || base.settings,
    };
  }

  /** Push a (clean) state into the live sim modules. */
  function apply(state, sim) {
    sim.clock.set(state.clock.minute);
    sim.clock.day = state.clock.day;
    sim.economy.restore({ coins: state.coins });
    sim.needs.restore(state.needs);
    sim.missions.restore(state.missions);
    if (sim.prayer && state.prayers) sim.prayer.restore(state.prayers);
  }

  KQ.Sim.Save = { KEY, VERSION, load, save, clear, sanitize, defaultState, capture, apply };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
