/* ============================================================================
 * FILE: actions.js
 * PURPOSE: Which actions the hero can take right now, and in which order the chooser shows them.
 *          Pure ordering: the game layer gathers the candidates (a neighbour, a counter, a camel,
 *          a person to say hi to ...), this file ranks, de-duplicates and caps them.
 * BUSINESS CONTEXT: playability round AC-P24 ("one big button, always in the same place"). With
 *   two or more actions in reach the child sees up to three picture tiles instead of a silent
 *   winner (a neighbour's Talk used to hide the ice-cream cart, Say hi and shop counters).
 *   The nearest action is first (highlighted, runs on E) except that mission business and a
 *   prayer that is owed come before everything else; Say hi and the "I am tired" Rest come last.
 * DEPENDENCIES: none (no THREE, no DOM).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/action-order.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /** How many picture tiles the chooser shows at most. */
  const MAX_TILES = 3;
  /** Ranks: the lower comes first; the nearest wins inside a rank. */
  const RANK = { business: 0, prayer: 1, near: 2, hi: 3, tired: 4 };

  /** The rank of a candidate: its own `rank` when the game layer set one, else by kind. */
  function rankOf(t) {
    if (Number.isFinite(t.rank)) return t.rank;
    if (t.kind === "step") return RANK.business;
    if (t.kind === "hi") return RANK.hi;
    return RANK.near;
  }

  /** What makes two candidates "the same action": the same picture and word (`key`), else kind + label. */
  function dupKey(t) {
    return t.key || t.kind + ":" + t.label;
  }

  /** Is a candidate usable (a real, enabled target)? */
  function usable(t) {
    return Boolean(t) && t.enabled !== false;
  }

  /** The candidates in the order the chooser shows them (rank, then distance; ties keep the given order). */
  function order(list) {
    return list
      .filter(usable)
      .map((t, i) => ({ t, i }))
      .sort(function (a, b) {
        const r = rankOf(a.t) - rankOf(b.t);
        if (r) return r;
        const d = (a.t.dist || 0) - (b.t.dist || 0);
        return d || a.i - b.i;
      })
      .map((e) => e.t);
  }

  /** The ordered candidates with duplicates of the same action collapsed (the first = nearest stays). */
  function collapse(list) {
    const seen = {};
    return order(list).filter(function (t) {
      const k = dupKey(t);
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  /** The chooser's tiles: ordered, de-duplicated, at most `cap` (3 by default). */
  function arrange(list, cap) {
    const max = Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : MAX_TILES;
    return collapse(list || []).slice(0, max);
  }

  KQ.Sim.Actions = { arrange, order, collapse, rankOf, RANK, MAX_TILES };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
