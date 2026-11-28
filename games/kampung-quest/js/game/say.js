/* ============================================================================
 * FILE: say.js
 * PURPOSE: G.Say(key, text): a spoken hint for children who cannot read yet, said ONCE per kind of
 *          action ("Tap the big button to talk."). It speaks through voice.js, so every gate
 *          applies (mute, pause, hidden tab, azan, a prayer screen, the "Character voices" switch,
 *          no speechSynthesis). A hint that was refused is not counted as heard, so it is tried
 *          again the next time the action appears.
 * BUSINESS CONTEXT: playability round AC-P24.5. What was heard is kept in the preferences
 *   (prefs.seen, booleans only), never in the save.
 * DEPENDENCIES: voice.js, settings.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const S = () => G.S;
  const said = [];

  /** Has this hint already been heard (this game or an earlier visit)? */
  function heard(key) {
    return Boolean(G.Settings.prefs.seen[key]);
  }

  /**
   * Make room for one more heard hint: forget the oldest keys (insertion order; the keys are letters
   * and dashes, never integer-like, so the order holds) until there are fewer than MAX_SEEN. This
   * keeps the prefs blob under its cap, and a new hint is always heard once instead of being refused.
   */
  function evictOldest(seen) {
    const keys = Object.keys(seen);
    while (keys.length >= G.Settings.MAX_SEEN) delete seen[keys.shift()];
  }

  /** Remember a hint as heard (a lower-case key only) and store the preferences. */
  function remember(key) {
    if (!/^[a-z-]{1,24}$/.test(key)) return;
    evictOldest(G.Settings.prefs.seen);
    delete G.Settings.prefs.seen[key]; // re-inserted last, so it is the newest
    G.Settings.prefs.seen[key] = true;
    said.push(key);
    G.Settings.save(S() ? S().storage : null);
  }

  /**
   * Say a hint once. Returns true only when it was spoken now.
   * @param {string} key the kind of action (a table key from action-words.js)
   * @param {string} text the short line to speak
   */
  function Say(key, text) {
    if (!text || heard(key) || !G.Voice) return false;
    if (!G.Voice.hint(text)) return false;
    remember(key);
    return true;
  }

  Say.heard = heard;
  Say.log = () => said.slice();
  /** Forget every heard hint (tests, and a fresh game). */
  Say.reset = function () {
    G.Settings.prefs.seen = Object.create(null);
    said.length = 0;
  };

  G.Say = Say;
})((window.KQ = window.KQ || {}));
