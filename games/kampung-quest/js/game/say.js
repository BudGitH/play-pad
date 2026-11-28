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

  /** Remember a hint as heard (a lower-case key only) and store the preferences. */
  function remember(key) {
    if (!/^[a-z-]{1,24}$/.test(key)) return;
    if (Object.keys(G.Settings.prefs.seen).length >= G.Settings.MAX_SEEN) return; // keeps the prefs blob under its cap
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
