/* ============================================================================
 * FILE: hints.js
 * PURPOSE: Decides when to give a gentle, one-time nudge: the first-meal nudge for a new player,
 *          and a friendly "food low" / "energy low" note the first time each meter dips under the
 *          low line on a day. Pure logic: the game layer shows the toast and the hawker marker.
 * BUSINESS CONTEXT: Product success metric "a new player eats at least one meal without help"
 *   (PM review). Child-friendly rule: a nudge is a kind suggestion shown once, never a scolding,
 *   never a penalty (business rule 2). What was already shown is saved so a reload never repeats it.
 * DEPENDENCIES: none (the caller passes the facts in as plain numbers and flags).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/hints.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /** With no mission done yet, the first-meal nudge shows at 10:00 (minutes after midnight). */
  const NUDGE_MINUTE = 600;
  const FIRST_MEAL = "first-meal";
  const FOOD_LOW = "food-low";
  const ENERGY_LOW = "energy-low";
  const MAX_DAY = 99999;

  /** The saved shape of a brand-new player: nothing shown yet, nothing eaten. */
  function defaults() {
    return { nudged: false, ate: false, foodDay: 0, energyDay: 0 };
  }

  /** A day number from untrusted input: a whole number 0..MAX_DAY, else 0 (0 = never shown). */
  function cleanDay(value) {
    const n = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(n)) return 0;
    return Math.min(MAX_DAY, Math.max(0, Math.floor(n)));
  }

  /**
   * Validate a saved hints section (untrusted input): flags are strictly `true` or false, days are
   * clamped; anything else (a missing section in an older save, junk) gives the defaults.
   * TRUST_BOUNDARY: localStorage -> hints (untrusted; booleans and day numbers only)
   */
  function sanitize(raw) {
    const src = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    return {
      nudged: src.nudged === true,
      ate: src.ate === true,
      foodDay: cleanDay(src.foodDay),
      energyDay: cleanDay(src.energyDay),
    };
  }

  /** Is the first-meal nudge due: not shown, never ate, can eat and afford it, and it is a good moment? */
  function firstMealDue(H, ctx) {
    if (H.nudged || H.ate || !ctx.canEat || !ctx.canAfford) return false;
    const lateEnough = ctx.day > 1 || ctx.minute >= NUDGE_MINUTE;
    return ctx.completed > 0 || ctx.hungry === true || lateEnough;
  }

  /**
   * Which hint to show now, or null. The first-meal nudge wins; then "food low" and "energy low",
   * each at most once per game day.
   * @param {object} H the hints state
   * @param {{minute:number, day:number, completed:number, hungry:boolean, tired:boolean,
   *   canEat:boolean, canAfford:boolean}} ctx facts from the game layer
   */
  function nextHint(H, ctx) {
    if (firstMealDue(H, ctx)) return FIRST_MEAL;
    if (ctx.hungry && H.foodDay !== ctx.day) return FOOD_LOW;
    if (ctx.tired && H.energyDay !== ctx.day) return ENERGY_LOW;
    return null;
  }

  /** Remember that a hint was shown (first-meal also counts as today's "food low" when hungry). */
  function recordShown(H, kind, ctx) {
    if (kind === FIRST_MEAL) {
      H.nudged = true;
      if (ctx.hungry) H.foodDay = cleanDay(ctx.day);
    }
    if (kind === FOOD_LOW) H.foodDay = cleanDay(ctx.day);
    if (kind === ENERGY_LOW) H.energyDay = cleanDay(ctx.day);
  }

  /**
   * Create the hints tracker.
   * @param {object} [start] a saved hints section (sanitised)
   */
  function create(start) {
    const H = sanitize(start);
    return {
      next: (ctx) => nextHint(H, ctx),
      markShown: (kind, ctx) => recordShown(H, kind, ctx),
      /** The hero ate a real meal: the first-meal goal is met and the hawker marker can go. */
      noteAte() {
        H.ate = true;
      },
      /** Is the hawker marker wanted: the nudge was shown and the hero has not eaten since. */
      markerWanted: () => H.nudged && !H.ate,
      get nudged() {
        return H.nudged;
      },
      get ate() {
        return H.ate;
      },
      snapshot: () => Object.assign({}, H),
      restore(raw) {
        Object.assign(H, sanitize(raw));
      },
    };
  }

  KQ.Sim.Hints = {
    create,
    sanitize,
    defaults,
    NUDGE_MINUTE,
    FIRST_MEAL,
    FOOD_LOW,
    ENERGY_LOW,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
