/* ============================================================================
 * FILE: recite.js
 * PURPOSE: The word-by-word reading cursor for a recitation: which word is "now", moving
 *          forward / back, jumping to a tapped word, and the auto-advance clock.
 * BUSINESS CONTEXT: AC-H8 (recitation shown word by word: tap a word, Next word, or let it
 *   advance by itself). Pure: no DOM, no timers of its own; the UI feeds it `tick(dt)`.
 * DEPENDENCIES: none. HOW TO TEST: npm run test:kq (tests/kampung-quest/recite.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /** Seconds each word stays highlighted when auto-advance is on (slow enough for a child to read along). */
  const AUTO_SECONDS = 1.1;

  /** Split a line of text into its space-separated words (no empty words). */
  function split(text) {
    return String(text || "")
      .split(/\s+/)
      .filter(Boolean);
  }

  /**
   * Flatten a ritual text item ({lines:[{ar,tr,en}]}) into one list of words:
   * [{ ar, tr, line, en }], where `line` is the index of its line and `en` that line's meaning.
   * Arabic and transliteration tokens are paired by position; a short side is padded with "".
   */
  function wordsOf(item) {
    const out = [];
    const lines = item && Array.isArray(item.lines) ? item.lines : [];
    lines.forEach(function (ln, line) {
      const ar = split(ln.ar);
      const tr = split(ln.tr);
      const n = Math.max(ar.length, tr.length);
      for (let i = 0; i < n; i += 1) {
        out.push({ ar: ar[i] || "", tr: tr[i] || "", line, en: ln.en || "" });
      }
    });
    return out;
  }

  /** A cursor over `count` words, starting on the first (never fails, never goes out of range). */
  function create(count) {
    const total = Math.max(0, Math.floor(Number(count) || 0));
    const C = { index: 0, total, clock: 0 };
    const set = (i) => {
      C.index = Math.min(Math.max(0, Math.floor(Number(i) || 0)), Math.max(0, total - 1));
      C.clock = 0;
      return C.index;
    };
    return {
      get index() {
        return C.index;
      },
      get total() {
        return C.total;
      },
      get atEnd() {
        return C.index >= C.total - 1;
      },
      next: () => set(C.index + 1),
      prev: () => set(C.index - 1),
      set,
      reset: () => set(0),
      /** Advance the auto clock by dt seconds; true when it moved to the next word. */
      tick(dt) {
        if (C.index >= C.total - 1) return false;
        C.clock += Math.max(0, Number(dt) || 0);
        if (C.clock < AUTO_SECONDS) return false;
        set(C.index + 1);
        return true;
      },
    };
  }

  KQ.Sim.Recite = { create, wordsOf, split, AUTO_SECONDS };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
