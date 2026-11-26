/* ============================================================================
 * FILE: needs.js
 * PURPOSE: Hunger and energy meters (0..100, 100 = full) that drain with game time.
 * BUSINESS CONTEXT: AC-10. Gentle by design (business rule 2): at 0 the player only
 *   walks a little slower and sees a friendly nudge - there is no fail state.
 *   Eating refills hunger; resting at home / a clinic check-up refills energy.
 * DEPENDENCIES: none. Deterministic: tick() takes game minutes from the clock.
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/needs-economy.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /** Meter points lost per game minute (a 48-min day ~ 1440 game min). */
  const HUNGER_DRAIN_PER_MIN = 0.12;
  const ENERGY_DRAIN_PER_MIN = 0.08;
  /** Energy regained per game minute of resting at home. */
  const REST_PER_MIN = 1.2;
  const LOW_LEVEL = 25;
  const FULL_LEVEL = 95;
  const SLOW_FACTOR = 0.85;

  /** Keep a hunger / energy meter within 0..100, falling back when the value is not a number. */
  function clampMeter(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(100, Math.max(0, n));
  }

  /** Summarise both meters as ok, hungry, tired or hungry-tired for the HUD hint. */
  function statusOf(N) {
    const hungry = N.hunger < LOW_LEVEL;
    const tired = N.energy < LOW_LEVEL;
    if (hungry && tired) return "hungry-tired";
    if (hungry) return "hungry";
    return tired ? "tired" : "ok";
  }

  /** Apply a food item to the meters; refuses with a friendly hint when full or not food. */
  function eat(N, item) {
    if (!item || !Number.isFinite(item.hunger))
      return { ok: false, hint: "That isn't something to eat." };
    if (N.hunger >= FULL_LEVEL)
      return { ok: false, hint: "You're too full right now. Maybe later!" };
    const before = N.hunger;
    N.hunger = clampMeter(N.hunger + item.hunger, N.hunger);
    if (Number.isFinite(item.energy)) N.energy = clampMeter(N.energy + item.energy, N.energy);
    return { ok: true, gained: N.hunger - before, hint: "Sedap! Delicious." };
  }

  /**
   * Create the needs tracker.
   * @param {{hunger?:number, energy?:number}} [start] initial levels (clamped 0..100)
   */
  function create(start) {
    const opts = start || {};
    const N = { hunger: clampMeter(opts.hunger, 85), energy: clampMeter(opts.energy, 90) };
    return {
      get hunger() {
        return N.hunger;
      },
      get energy() {
        return N.energy;
      },
      tick(gameMinutes) {
        if (!(gameMinutes > 0) || !Number.isFinite(gameMinutes)) return;
        N.hunger = clampMeter(N.hunger - HUNGER_DRAIN_PER_MIN * gameMinutes, 0);
        N.energy = clampMeter(N.energy - ENERGY_DRAIN_PER_MIN * gameMinutes, 0);
      },
      eat: (item) => eat(N, item),
      rest(gameMinutes) {
        if (!(gameMinutes > 0) || !Number.isFinite(gameMinutes)) return 0;
        const before = N.energy;
        N.energy = clampMeter(N.energy + REST_PER_MIN * gameMinutes, N.energy);
        return N.energy - before;
      },
      /** Friendly clinic check-up: energy back to full. */
      checkup() {
        N.energy = 100;
      },
      canEat: () => N.hunger < FULL_LEVEL,
      isHungry: () => N.hunger < LOW_LEVEL,
      isTired: () => N.energy < LOW_LEVEL,
      status: () => statusOf(N),
      /** 1 normally; slightly slower when hungry or tired (never a stop). */
      speedFactor: () => (statusOf(N) === "ok" ? 1 : SLOW_FACTOR),
      snapshot: () => ({ hunger: N.hunger, energy: N.energy }),
      restore(raw) {
        const src = raw && typeof raw === "object" ? raw : {};
        N.hunger = clampMeter(src.hunger, 85);
        N.energy = clampMeter(src.energy, 90);
      },
    };
  }

  KQ.Sim.Needs = {
    create,
    HUNGER_DRAIN_PER_MIN,
    ENERGY_DRAIN_PER_MIN,
    REST_PER_MIN,
    LOW_LEVEL,
    FULL_LEVEL,
    clampMeter,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
