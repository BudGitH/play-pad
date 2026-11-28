/* ============================================================================
 * FILE: life-chip.js
 * PURPOSE: One small glass chip under the top of the screen for the town's little moments: the
 *          world event under way ("Football: kick the ball!") and the "beat the bubble" timer.
 *          Plain DOM text (textContent only), never takes a tap, hidden while a menu is open.
 * BUSINESS CONTEXT: playability round AC-P18 / AC-P19: an event needs a visible hint, and a timed
 *   mission needs a friendly clock that never says "failed" (when time is up it just goes quiet).
 * DEPENDENCIES: util.js, ui-core.js (modalOpen). Lives in the stage root, above the greeting layer.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const CSS =
    "position:absolute;left:50%;top:max(64px,calc(env(safe-area-inset-top) + 56px));" +
    "transform:translateX(-50%);z-index:5;pointer-events:none;display:flex;flex-direction:column;" +
    "gap:6px;align-items:center;max-width:min(86vw,420px);";
  const ROW_CSS =
    "padding:6px 14px;border-radius:16px;background:rgba(255,253,247,0.92);color:#15151c;" +
    "font:700 14px/1.25 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.25);" +
    "text-align:center;";
  const L = { box: null, live: null, rows: {} };

  /**
   * Build the chip box inside the game root (once). Its event rows sit in a polite status region that
   * exists, empty, from boot, so the first event hint is announced (a live region that is created with its
   * text already in it is not). The "Beat the bubble" countdown is NOT in that region: it changes every
   * second, so mission-steps.js announces only its start and its last ten seconds (G.UI.announce).
   */
  function init() {
    if (L.box) return L.box;
    L.live = U.el("div", { role: "status", "aria-live": "polite", style: "display:contents" });
    L.box = U.el("div", { cls: "kq-life-chip", style: CSS }, L.live);
    G.S.root.insertBefore(L.box, G.S.hudHost);
    return L.box;
  }

  /** The element a row goes in: the live status region for events, the quiet area for the countdown. */
  function parentFor(key) {
    init();
    return key === "bubble" ? L.box : L.live;
  }

  /** Show (or change) a row of text under a key (e.g. "event", "bubble"). */
  function set(key, text) {
    let row = L.rows[key];
    if (!row) {
      row = U.el("div", { cls: "kq-life-row", style: ROW_CSS, "data-key": key });
      L.rows[key] = row;
      parentFor(key).appendChild(row);
    }
    if (row.textContent !== text) row.textContent = text;
    row.hidden = false;
  }

  /** Remove a row. */
  function clear(key) {
    const row = L.rows[key];
    if (row) row.hidden = true;
  }

  /** Hide the whole chip while a menu or a sheet is open. */
  function update() {
    if (L.box) L.box.hidden = G.UI.modalOpen();
  }

  /** What is showing, for tests. */
  function debug() {
    const out = {};
    Object.keys(L.rows).forEach((k) => {
      if (!L.rows[k].hidden) out[k] = L.rows[k].textContent;
    });
    return out;
  }

  G.LifeChip = { init, set, clear, update, debug };
})((window.KQ = window.KQ || {}));
