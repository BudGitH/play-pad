/* ============================================================================
 * FILE: settings.js
 * PURPOSE: Player preferences that are not part of the save schema (caption size,
 *          read-to-me, less motion, auto quality) plus environment probes.
 * BUSINESS CONTEXT: AC-15 (accessibility, prefers-reduced-motion), AC-13 edge case
 *   "localStorage blocked -> play without saving, with a small notice".
 * DEPENDENCIES: util.js. Storage key "kampung-quest:prefs" (separate from the save so the
 *   audited save schema in KQ.Sim.Save stays untouched). Every storage call is wrapped.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const PREF_KEY = "kampung-quest:prefs";
  const DEFAULTS = {
    captionSize: "large",
    readToMe: true,
    voices: true,
    lessMotion: "follow",
    autoQuality: true,
    ambience: true,
  };
  const CHOICES = {
    captionSize: ["normal", "large"],
    lessMotion: ["follow", "on", "off"],
  };
  /** A real prefs blob is ~100 characters; refuse anything absurd before parsing it. */
  const MAX_PREF_CHARS = 2000;
  const prefs = Object.assign({}, DEFAULTS);

  /** localStorage if it really works (private modes and blocked storage throw), else null. */
  function getStorage() {
    try {
      const s = window.localStorage;
      s.setItem("kampung-quest:probe", "1");
      s.removeItem("kampung-quest:probe");
      return s;
    } catch (err) {
      return null;
    }
  }

  /** Validate untrusted parsed prefs: enum whitelist and boolean checks, never a raw copy. */
  // TRUST_BOUNDARY: localStorage "kampung-quest:prefs" -> prefs (untrusted; whitelisted per key)
  function cleanPrefs(raw) {
    const out = Object.assign({}, DEFAULTS);
    if (!raw || typeof raw !== "object") return out;
    Object.keys(CHOICES).forEach(function (key) {
      if (CHOICES[key].indexOf(raw[key]) !== -1) out[key] = raw[key];
    });
    if (typeof raw.readToMe === "boolean") out.readToMe = raw.readToMe;
    if (typeof raw.autoQuality === "boolean") out.autoQuality = raw.autoQuality;
    if (typeof raw.ambience === "boolean") out.ambience = raw.ambience;
    if (typeof raw.voices === "boolean") out.voices = raw.voices;
    return out;
  }

  /** Read the saved prefs into `prefs` (defaults on any problem). Never throws. */
  // TRUST_BOUNDARY: localStorage "kampung-quest:prefs" -> parsed JSON (size-capped before parsing)
  function load(storage) {
    if (!storage) return prefs;
    let parsed = null;
    try {
      const text = storage.getItem(PREF_KEY);
      if (typeof text === "string" && text.length <= MAX_PREF_CHARS) parsed = JSON.parse(text);
    } catch (err) {
      parsed = null;
    }
    Object.assign(prefs, cleanPrefs(parsed));
    return prefs;
  }

  /** Store the preferences in storage; returns false when storage is missing or blocked. */
  function save(storage) {
    if (!storage) return false;
    try {
      storage.setItem(PREF_KEY, JSON.stringify(prefs));
      return true;
    } catch (err) {
      return false;
    }
  }

  /** Does the device ask for reduced motion? */
  function systemReducedMotion() {
    return Boolean(
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }

  G.Settings = {
    prefs,
    load,
    save,
    getStorage,
    DEFAULTS,
    /** Less motion: the pause-menu switch, or the device setting when it is on "follow". */
    reduced() {
      if (prefs.lessMotion === "on") return true;
      return prefs.lessMotion === "follow" && systemReducedMotion();
    },
  };

  G.Env = {
    canFetch: KQ.CAN_FETCH !== false && location.protocol !== "file:",
    coarse: Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches),
    isPortrait: () => window.innerHeight > window.innerWidth * 1.05,
  };
})((window.KQ = window.KQ || {}));
