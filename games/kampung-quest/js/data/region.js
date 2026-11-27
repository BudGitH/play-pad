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

  /** Draw-once picture markup (our own constants; viewBox 0 0 160 100) for the region cards. */
  const ART_KAMPUNG =
    '<rect width="160" height="100" fill="#9fd3f2"/><circle cx="132" cy="22" r="11" fill="#ffe27a"/>' +
    '<rect y="74" width="160" height="26" fill="#6fae5e"/><rect y="86" width="160" height="14" fill="#6b6e75"/>' +
    '<rect x="12" y="26" width="34" height="50" fill="#f0c9a0"/><rect x="50" y="38" width="30" height="38" fill="#e8b4b8"/>' +
    '<g fill="#5b7fa6"><rect x="17" y="32" width="6" height="8"/><rect x="28" y="32" width="6" height="8"/><rect x="17" y="48" width="6" height="8"/><rect x="28" y="48" width="6" height="8"/><rect x="56" y="44" width="6" height="8"/><rect x="68" y="44" width="6" height="8"/></g>' +
    '<rect x="96" y="52" width="40" height="24" fill="#f4f1e6"/><path d="M104 52a12 12 0 0 1 24 0z" fill="#2f9e6e"/>' +
    '<rect x="138" y="40" width="6" height="36" fill="#f4f1e6"/><path d="M141 32l4 8h-8z" fill="#2f9e6e"/>' +
    '<circle cx="86" cy="66" r="9" fill="#4f8a50"/><rect x="85" y="68" width="2.5" height="10" fill="#6b4a2a"/>';
  const ART_HARAMAIN =
    '<rect width="160" height="100" fill="#f6d9a0"/><circle cx="124" cy="24" r="11" fill="#fff3c4"/>' +
    '<rect y="70" width="160" height="30" fill="#efe9da"/><ellipse cx="62" cy="86" rx="54" ry="11" fill="#ffffff" opacity="0.8"/>' +
    '<rect x="112" y="48" width="36" height="26" fill="#f1ece0"/><path d="M118 48a12 12 0 0 1 24 0z" fill="#2f8f5a"/>' +
    '<rect x="108" y="30" width="5" height="44" fill="#f4efe4"/><rect x="147" y="30" width="5" height="44" fill="#f4efe4"/>' +
    '<path d="M110.5 24l3 6h-6zM149.5 24l3 6h-6z" fill="#2f8f5a"/>' +
    '<rect x="42" y="42" width="40" height="36" fill="#1c1c22"/><rect x="42" y="50" width="40" height="6" fill="#d9b04a"/>' +
    '<rect x="62" y="60" width="9" height="18" fill="#d9b04a"/><rect x="42" y="78" width="40" height="3" fill="#9d9684"/>';

  /**
   * The regions the player can visit. Add an entry here to add a region (plus its world builder);
   * the title screen and the pause menu build their picture cards from this list.
   */
  const LIST = [
    {
      id: "kampung",
      name: "Kampung (Singapore)",
      tagline: "Help your neighbours, eat and pray",
      lead: "A day in the neighbourhood: help, eat, pray.",
      art: ART_KAMPUNG,
    },
    {
      id: "haramain",
      name: "Makkah & Madinah",
      tagline: "Visit the Kaaba and the Prophet's Mosque",
      lead: "A visit to Makkah and Madinah: learn, walk, pray.",
      art: ART_HARAMAIN,
      steps: [
        "Streets and mosques",
        "Pilgrims (instanced crowd)",
        "Photo textures",
        "Azan recording",
        "Pictures",
      ],
    },
  ];
  const IDS = LIST.map((r) => r.id);

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
    if (IDS.indexOf(asked) !== -1) {
      writeSaved(asked);
      return asked;
    }
    const saved = readSaved();
    return IDS.indexOf(saved) !== -1 ? saved : "kampung";
  }

  KQ.region = choose();
  KQ.Region = {
    KEY,
    LIST,
    IDS,
    readSaved,
    writeSaved,
    get: (id) => LIST.find((r) => r.id === (id || KQ.region)) || LIST[0],
    isHaramain: () => KQ.region === "haramain",
  };
})((window.KQ = window.KQ || {}));
