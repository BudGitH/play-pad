/* ============================================================================
 * FILE: region.js
 * PURPOSE: Decides which region of Kampung Quest this page runs: "kampung" (the default, the
 *          Singapore neighbourhood) or "haramain" (Makkah + Madinah). Sets KQ.region before any
 *          other script reads it, from ?region= first, then the saved choice.
 * BUSINESS CONTEXT: features/kampung-quest-haramain/requirements.md (region contract).
 * DEPENDENCIES: none (data layer; loads first). Storage key "kampung-quest:region" is separate
 *   from the audited save schema; every storage call is wrapped (blocked storage = default).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const KEY = "kampung-quest:region";
  const REGIONS = ["kampung", "haramain"];

  /** Read the saved region id from storage ("" when missing or blocked). */
  function readSaved() {
    try {
      return window.localStorage.getItem(KEY) || "";
    } catch (err) {
      return "";
    }
  }

  /** Remember a region choice; false when storage is blocked. */
  function writeSaved(id) {
    try {
      window.localStorage.setItem(KEY, id);
      return true;
    } catch (err) {
      return false;
    }
  }

  /** The region for this page: a valid ?region= wins (and is remembered), else the saved one. */
  function choose() {
    let asked = "";
    try {
      asked = new URLSearchParams(window.location.search).get("region") || "";
    } catch (err) {
      asked = "";
    }
    if (REGIONS.indexOf(asked) !== -1) {
      writeSaved(asked);
      return asked;
    }
    const saved = readSaved();
    return REGIONS.indexOf(saved) !== -1 ? saved : "kampung";
  }

  KQ.region = choose();
  KQ.Region = { KEY, REGIONS, readSaved, writeSaved, isHaramain: () => KQ.region === "haramain" };
})((window.KQ = window.KQ || {}));
