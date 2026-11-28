/* ============================================================================
 * FILE: save.js
 * PURPOSE: Defensive localStorage persistence under the key "kampung-quest:v1".
 * BUSINESS CONTEXT: AC-13 and the edge cases "corrupt or missing saves fall back to
 *   a new game without throwing" and "localStorage blocked -> play without saving".
 *   Risk (requirements NFR): the save is UNTRUSTED input - it is parsed, schema-checked,
 *   numbers are clamped, unknown ids are dropped, and only known keys are ever read
 *   (so a hand-crafted "__proto__" key or "1e999" number cannot do harm).
 * DEPENDENCIES: optional KQ.Sim.Prayer / KQ.Sim.Missions / KQ.Sim.Economy / KQ.Sim.Hints for the
 *   sub-schemas (load order: ids, clock, prayer, needs, hints, economy, missions, schedule, save).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/save.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /** One save slot per region: the kampung keeps the original key, other regions add their id. */
  const REGION = typeof KQ.region === "string" && KQ.region !== "kampung" ? KQ.region : "";
  const KEY = "kampung-quest:v1" + (REGION ? ":" + REGION : "");
  const VERSION = 1;
  /** A real save is a few KB; refuse absurd blobs before parsing. */
  const MAX_CHARS = 200000;
  const QUALITIES = ["low", "med", "high"];
  const DEFAULT_OUTFIT = { hair: "classic", hat: "none" };
  /** The hero's wardrobe choice (outfit + colour); the same look is worn in every region. */
  const DEFAULT_WARDROBE = { wear: "classic", tone: "royal" };
  /** Who the hero is (boy or girl, the girl's hair / hijab style and scarf colour; KQ.Sim.Hero). */
  const DEFAULT_HERO = { gender: "boy", style: "hijab", scarf: "rose" };
  /** The look (barber style + wardrobe) is shared by every region's save slot under this key. */
  const LOOK_KEY = "kampung-quest:look";
  /** The walkable world is about +/-72 m (edge colliders); a saved position must sit inside it. */
  const WORLD_HALF = REGION ? 1000 : 70;
  const MAX_REV = 1e9;
  /**
   * The revision this tab last loaded or wrote (tab-local: every page has its own copy of this
   * script). A save is refused when storage holds a newer one (another tab got ahead).
   */
  let knownRev = 0;

  /** Parse a number or numeric string and clamp it to a range; anything else gives the fallback (never NaN or Infinity). */
  function clampNumber(value, min, max, fallback) {
    const n = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  /** A plain object (not null, not an array): the only shape the save accepts for a section. */
  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  /** Return the value only when it is in the whitelist, else the fallback (enum check for untrusted input). */
  function pick(list, value, fallback) {
    return typeof value === "string" && list.indexOf(value) !== -1 ? value : fallback;
  }

  /** A brand-new game: 07:00 on day 1, starter coins, full-ish meters. */
  function defaultState() {
    return {
      v: VERSION,
      rev: 0,
      clock: { minute: 420, day: 1 },
      coins: 10,
      needs: { hunger: 85, energy: 90 },
      missions: { active: null, completed: [], stickers: [] },
      prayers: null,
      rituals: null,
      hints: { nudged: false, ate: false, foodDay: 0, energyDay: 0 },
      outfit: Object.assign({}, DEFAULT_OUTFIT),
      wardrobe: Object.assign({}, DEFAULT_WARDROBE),
      hero: Object.assign({}, DEFAULT_HERO),
      pos: null,
      settings: { muted: false, quality: "med" },
    };
  }

  /** Sanitise the saved missions section through the missions module; falls back to an empty one. */
  function cleanMissions(raw) {
    const missions = KQ.Sim.Missions;
    if (missions && missions.sanitizeSnapshot) return missions.sanitizeSnapshot(raw);
    return defaultState().missions;
  }

  /** Sanitise the saved prayer snapshot through the prayer module; null means start the tracker fresh. */
  function cleanPrayers(raw) {
    const prayer = KQ.Sim.Prayer;
    return prayer && prayer.sanitizeSnapshot ? prayer.sanitizeSnapshot(raw) : null;
  }

  /** Sanitise the saved rituals section (Umrah / Hajj / Ziarah progress); null (or a save from before it existed) starts them fresh. */
  function cleanRituals(raw) {
    const umrah = KQ.Sim.Umrah;
    return umrah && umrah.sanitize ? umrah.sanitize(raw) : null;
  }

  /** Sanitise the saved hints section (what was already nudged); a save from before hints gets the defaults. */
  function cleanHints(raw) {
    const hints = KQ.Sim.Hints;
    return hints && hints.sanitize ? hints.sanitize(raw) : defaultState().hints;
  }

  /** Whitelist the saved hair and hat against the known outfit options. */
  function cleanOutfit(raw) {
    const options = KQ.Sim.OUTFIT_OPTIONS || {
      hair: [DEFAULT_OUTFIT.hair],
      hat: [DEFAULT_OUTFIT.hat],
    };
    const src = isObject(raw) ? raw : {};
    return {
      hair: pick(options.hair, src.hair, DEFAULT_OUTFIT.hair),
      hat: pick(options.hat, src.hat, DEFAULT_OUTFIT.hat),
    };
  }

  /**
   * Whitelist the saved wardrobe choice (outfit and colour ids) through the wardrobe rules of the
   * hero's gender (a girl's outfit id is not a boy's, and the other way round).
   */
  function cleanWardrobe(raw, gender) {
    const hero = KQ.Sim.Hero;
    const wardrobe = hero && gender ? hero.wardrobeFor(gender) : KQ.Sim.Wardrobe;
    return wardrobe && wardrobe.sanitize
      ? wardrobe.sanitize(raw)
      : Object.assign({}, DEFAULT_WARDROBE);
  }

  /** Whitelist the saved hero choice (gender, style, scarf) through the hero module. */
  function cleanHero(raw) {
    const hero = KQ.Sim.Hero;
    return hero && hero.sanitize ? hero.sanitize(raw) : Object.assign({}, DEFAULT_HERO);
  }

  /** A hero position inside the playable bounds, or null (the game then uses the start spot). */
  function cleanPos(raw) {
    if (!isObject(raw)) return null;
    const x = clampNumber(raw.x, -1e6, 1e6, NaN);
    const z = clampNumber(raw.z, -1e6, 1e6, NaN);
    const inside = Math.abs(x) <= WORLD_HALF && Math.abs(z) <= WORLD_HALF;
    return Number.isNaN(x) || Number.isNaN(z) || !inside ? null : { x, z };
  }

  /** The revision number inside a raw save string (0 when absent or malformed). */
  // TRUST_BOUNDARY: localStorage / storage event -> number (untrusted text; never throws)
  function revOf(text) {
    if (typeof text !== "string" || text.length > MAX_CHARS) return 0;
    try {
      const d = JSON.parse(text);
      return isObject(d) && Number.isInteger(d.rev) ? clampNumber(d.rev, 0, MAX_REV, 0) : 0;
    } catch (err) {
      return 0;
    }
  }

  /** Read the raw save string; null when absent or when storage throws (blocked storage). */
  function readText(storage) {
    try {
      return storage.getItem(KEY);
    } catch (err) {
      return null;
    }
  }

  /**
   * Validate and normalise any value into a safe save state.
   * TRUST_BOUNDARY: localStorage -> game state (untrusted; clamped, schema-checked, ids whitelisted)
   * @param {*} raw parsed JSON (untrusted)
   * @returns {object|null} clean state, or null when the shape/version is unusable
   */
  function sanitize(raw) {
    if (!isObject(raw) || raw.v !== VERSION) return null;
    const base = defaultState();
    const clock = isObject(raw.clock) ? raw.clock : {};
    const needs = isObject(raw.needs) ? raw.needs : {};
    const settings = isObject(raw.settings) ? raw.settings : {};
    const hero = cleanHero(raw.hero);
    return {
      v: VERSION,
      rev: Math.floor(clampNumber(raw.rev, 0, MAX_REV, 0)),
      clock: {
        minute: clampNumber(clock.minute, 0, 1439.99, base.clock.minute),
        day: Math.floor(clampNumber(clock.day, 1, 99999, 1)),
      },
      coins: Math.floor(clampNumber(raw.coins, 0, 99999, base.coins)),
      needs: {
        hunger: clampNumber(needs.hunger, 0, 100, base.needs.hunger),
        energy: clampNumber(needs.energy, 0, 100, base.needs.energy),
      },
      missions: cleanMissions(raw.missions),
      prayers: cleanPrayers(raw.prayers),
      rituals: cleanRituals(raw.rituals),
      hints: cleanHints(raw.hints),
      outfit: cleanOutfit(raw.outfit),
      wardrobe: cleanWardrobe(raw.wardrobe, hero.gender),
      hero,
      pos: cleanPos(raw.pos),
      settings: {
        muted: settings.muted === true,
        quality: pick(QUALITIES, settings.quality, "med"),
      },
    };
  }

  /** The result of a load that found nothing usable: a default new game plus the reason. */
  function fresh(status, error) {
    const result = { state: defaultState(), status };
    if (error) result.error = error;
    return result;
  }

  /** The hero's own clothes: what a New game (and a "cleared" shared look) gives every region. */
  function defaultLook() {
    return {
      outfit: Object.assign({}, DEFAULT_OUTFIT),
      wardrobe: Object.assign({}, DEFAULT_WARDROBE),
      hero: Object.assign({}, DEFAULT_HERO),
    };
  }

  /**
   * The look shared by every region: what the barber and the tailor last saved, or null. Never
   * throws. TRUST_BOUNDARY: localStorage (untrusted; the hair / hat and the wardrobe ids are
   * whitelisted, anything else is ignored).
   */
  function readLook(storage) {
    try {
      const text = storage.getItem(LOOK_KEY);
      if (typeof text !== "string" || text.length > MAX_CHARS) return null;
      const d = JSON.parse(text);
      if (!isObject(d) || d.v !== VERSION) return null;
      if (d.cleared === true) return defaultLook(); // New game: every region slot starts bare again
      const look = { outfit: cleanOutfit(d.outfit), wardrobe: d.wardrobe };
      if (isObject(d.hero)) look.hero = cleanHero(d.hero); // an older look keeps the slot's hero
      return look;
    } catch (err) {
      return null;
    }
  }

  /** Remember the look for the other regions (best effort: a full or blocked store is ignored). */
  function writeLook(storage, state) {
    try {
      const look = { v: VERSION, outfit: state.outfit, wardrobe: state.wardrobe, hero: state.hero };
      storage.setItem(LOOK_KEY, JSON.stringify(look));
    } catch (err) {
      /* the slot itself still holds the look; only the other regions miss out */
    }
  }

  /**
   * Forget the shared look (New game starts from the hero's own clothes in EVERY region). It leaves
   * a "cleared" marker rather than removing the key: with the key gone, another region's slot
   * would still hold the old wardrobe and bring it back on the next load (QA round 2, MEDIUM).
   * The marker is replaced by the real look at the next save.
   */
  function clearLook(storage) {
    try {
      storage.setItem(LOOK_KEY, JSON.stringify({ v: VERSION, cleared: true }));
    } catch (err) {
      /* the cleared slot itself still starts bare; only another region's slot may keep its look */
    }
  }

  /** A loaded or new game wears the shared look, so the hero looks the same in every region. */
  function withLook(result, storage) {
    if (result.status !== "loaded" && result.status !== "new") return result;
    const look = readLook(storage);
    if (!look) return result;
    Object.assign(result.state, look);
    const st = result.state;
    st.hero = cleanHero(st.hero);
    st.wardrobe = cleanWardrobe(st.wardrobe, st.hero.gender); // the look's ids must fit the hero's gender
    return result;
  }

  /**
   * Load a save. NEVER throws. TRUST_BOUNDARY: this reads localStorage (untrusted).
   * @param {Storage|null} storage localStorage-like object (may be null or throwing)
   * @returns {{state:object, status:'loaded'|'new'|'corrupt'|'unavailable', error?:string}}
   *   `state` is always a valid, clamped state (a new game unless status is 'loaded').
   */
  function load(storage) {
    return withLook(loadSlot(storage), storage);
  }

  /** The slot of this region (without the shared look). */
  function loadSlot(storage) {
    let text;
    try {
      text = storage.getItem(KEY);
    } catch (err) {
      return fresh("unavailable", String(err && err.message));
    }
    if (text === null || text === undefined) return fresh("new");
    if (typeof text !== "string" || text.length > MAX_CHARS) return fresh("corrupt", "bad value");
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return fresh("corrupt", "not JSON");
    }
    if (isObject(parsed) && parsed.cleared === true) {
      knownRev = Math.floor(clampNumber(parsed.rev, 0, MAX_REV, 0));
      return fresh("new"); // a "New game" marker: nothing to continue, but its revision still counts
    }
    const clean = sanitize(parsed);
    if (!clean) return fresh("corrupt", "wrong schema");
    knownRev = clean.rev;
    return { state: clean, status: "loaded" };
  }

  /**
   * Save a state (sanitised first so junk is never written). NEVER throws. Refuses (reason
   * "stale") when another tab has saved newer progress since this one loaded, so a stale tab can
   * never overwrite it (ledger: multi-tab-save-overwrite).
   * @returns {{ok:boolean, reason?:'unavailable'|'invalid'|'stale', rev?:number}}
   */
  function save(storage, state) {
    const clean = isObject(state) ? sanitize(Object.assign({}, state, { v: VERSION })) : null;
    if (!clean) return { ok: false, reason: "invalid" };
    if (revOf(readText(storage)) > knownRev) return { ok: false, reason: "stale" };
    clean.rev = Math.min(MAX_REV, knownRev + 1);
    try {
      storage.setItem(KEY, JSON.stringify(clean));
    } catch (err) {
      return { ok: false, reason: "unavailable" };
    }
    knownRev = clean.rev;
    writeLook(storage, clean);
    return { ok: true, rev: clean.rev };
  }

  /**
   * Forget the save (start over). Never throws. It leaves a tiny "cleared" marker with a revision
   * ABOVE everything seen so far instead of removing the key, so another tab that still holds the
   * old game is refused as stale and can never bring it back (RISK2-01). load() reads the marker
   * as a new game.
   * @returns {boolean} false when storage is unavailable
   */
  function clear(storage) {
    const next = Math.min(MAX_REV, Math.max(knownRev, revOf(readText(storage))) + 1);
    try {
      storage.setItem(KEY, JSON.stringify({ v: VERSION, rev: next, cleared: true }));
    } catch (err) {
      return false;
    }
    knownRev = next;
    clearLook(storage);
    return true;
  }

  /** Build a save state from the live sim modules: { clock, economy, needs, missions, prayer, hints, outfit, pos, settings }. */
  function capture(sim) {
    const base = defaultState();
    return {
      v: VERSION,
      rev: knownRev,
      clock: { minute: sim.clock.minute, day: sim.clock.day },
      coins: sim.economy.coins,
      needs: sim.needs.snapshot(),
      missions: sim.missions.snapshot(),
      prayers: sim.prayer ? sim.prayer.snapshot() : null,
      rituals: sim.umrah ? sim.umrah.snapshot() : null,
      hints: sim.hints ? sim.hints.snapshot() : base.hints,
      outfit: sim.outfit || base.outfit,
      wardrobe: sim.wardrobe || base.wardrobe,
      hero: sim.hero || base.hero,
      pos: sim.pos || null,
      settings: sim.settings || base.settings,
    };
  }

  /** Push a (clean) state into the live sim modules. */
  function apply(state, sim) {
    sim.clock.set(state.clock.minute);
    sim.clock.day = state.clock.day;
    sim.economy.restore({ coins: state.coins });
    sim.needs.restore(state.needs);
    sim.missions.restore(state.missions);
    if (sim.prayer && state.prayers) sim.prayer.restore(state.prayers);
    if (sim.umrah && state.rituals) sim.umrah.restore(state.rituals);
    if (sim.hints) sim.hints.restore(state.hints);
  }

  /** The revision this tab holds (for the cross-tab `storage` listener). */
  const currentRev = () => knownRev;

  KQ.Sim.Save = {
    KEY,
    VERSION,
    WORLD_HALF,
    load,
    save,
    clear,
    sanitize,
    defaultState,
    capture,
    apply,
    revOf,
    currentRev,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
