/* ============================================================================
 * FILE: speech.js
 * PURPOSE: Optional "read to me" through the browser's speechSynthesis.
 * BUSINESS CONTEXT: Design D: every text card has a read-to-me button for pre-readers. Voices
 *   vary by device, so the button is hidden when there is no voice and captions / labels are
 *   always the floor. The azan is never read out. Privacy: it prefers an English voice that runs
 *   on the device (localService), so game text stays on the device; when the browser offers only
 *   network-backed voices it still speaks with one of them (the text is game dialogue only: no
 *   names, no personal data), so "offline" is NOT guaranteed on every browser.
 * DEPENDENCIES: settings.js. Never throws.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  let voices = 0;
  let chosen = null;

  /** The browser's speech synthesiser, or null when it is not supported. */
  function synth() {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
      ? window.speechSynthesis
      : null;
  }

  /** Is this an English voice (en, en-SG, en-GB...)? */
  function isEnglish(voice) {
    return /^en([-_]|$)/i.test(String(voice.lang || ""));
  }

  /** Best voice: English and on-device first (en-SG over other English), else any English, else the default. */
  function pickVoice(list) {
    const rank = (v) =>
      (v.localService ? 0 : 2) + (isEnglish(v) ? 0 : 4) + (/^en[-_]SG/i.test(v.lang) ? 0 : 1);
    return list.slice().sort((a, b) => rank(a) - rank(b))[0] || null;
  }

  /** Re-read the voice list (it loads late on some browsers) and remember the best one. */
  function countVoices() {
    const s = synth();
    const list = s ? s.getVoices() : [];
    voices = list.length;
    chosen = pickVoice(list);
    return voices;
  }

  /**
   * Start counting voices (they load late in some browsers) so read-to-me knows whether it can
   * speak.
   */
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

  /**
   * Read text aloud in a gentle English voice (stopping what was being said); returns false when it
   * cannot.
   */
  function speak(text) {
    const s = synth();
    if (!s || !available()) return false;
    try {
      s.cancel();
      const u = new window.SpeechSynthesisUtterance(String(text).slice(0, 600));
      u.lang = "en-SG";
      if (chosen && isEnglish(chosen)) u.voice = chosen;
      u.rate = 0.9;
      u.pitch = 1.1;
      s.speak(u);
      return true;
    } catch (err) {
      return false;
    }
  }

  /** Stop any speech at once; failures are ignored since speech is optional. */
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
