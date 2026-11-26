/* ============================================================================
 * FILE: speech.js
 * PURPOSE: Optional "read to me" through the browser's speechSynthesis (offline, no network).
 * BUSINESS CONTEXT: Design D: every text card has a read-to-me button for pre-readers. Voices
 *   vary by device, so the button is hidden when there is no voice and captions / labels are
 *   always the floor. The azan is never read out.
 * DEPENDENCIES: settings.js. Never throws.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  let voices = 0;

  function synth() {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
      ? window.speechSynthesis
      : null;
  }

  function countVoices() {
    const s = synth();
    voices = s ? s.getVoices().length : 0;
    return voices;
  }

  function init() {
    const s = synth();
    if (!s) return;
    countVoices();
    if (s.addEventListener) s.addEventListener("voiceschanged", countVoices);
  }

  /** True when a voice exists and the player has not turned read-to-me off. */
  function available() {
    return Boolean(synth()) && voices > 0 && G.Settings.prefs.readToMe;
  }

  function speak(text) {
    const s = synth();
    if (!s || !available()) return false;
    try {
      s.cancel();
      const u = new window.SpeechSynthesisUtterance(String(text).slice(0, 600));
      u.lang = "en-SG";
      u.rate = 0.9;
      u.pitch = 1.1;
      s.speak(u);
      return true;
    } catch (err) {
      return false;
    }
  }

  function cancel() {
    const s = synth();
    if (!s) return;
    try {
      s.cancel();
    } catch (err) {
      return;
    }
  }

  G.Speech = { init, available, speak, cancel };
})((window.KQ = window.KQ || {}));
