/* ============================================================================
 * FILE: schedule.js
 * PURPOSE: NPC daily routines by time of day, with prayer-time overrides.
 * BUSINESS CONTEXT: AC-5 (NPC life) and requirements business rule 5: at prayer
 *   times most Muslim adult NPCs and the imam walk to the mosque and pray in
 *   mosque_hall; Muslim children join for Maghrib and Isyak. uncle_lim, aunty_mei,
 *   kid_wei, barber_raju and postman_dan keep their own day and are friendly.
 *   Hawkers stay at their stalls during opening hours except Zohor (Abang Ali)
 *   and Asar (Kak Aminah), where they take turns so the stalls never close.
 *   The routine is a pure function of (npc, minute, prayerState): no randomness.
 * DEPENDENCIES: ids.js (KQ.Sim.POI_IDS / NPC_PROFILE).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/schedule.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const ACTIVITIES = ["walk", "sit", "eat", "shop", "pray", "idle", "play"];
  /** Game minutes a prayer lasts for NPCs (about 50 real seconds). */
  const PRAY_WINDOW_MIN = 25;
  /** Game minutes before a prayer when NPCs start heading to the mosque. */
  const LEAD_IN_MIN = 8;
  const KID_PRAYERS = ["maghrib", "isyak"];
  const FALLBACK = { poi: "park", activity: "idle", indoors: false };

  /** [startHour, poi, activity] blocks; the last block with start <= now applies. */
  const ROUTINES = {
    nenek: [
      [0, "block_a", "idle"],
      [6.5, "block_a", "eat"],
      [8, "hawker", "eat"],
      [9.25, "park", "sit"],
      [11, "block_a", "idle"],
      [12.25, "block_a", "eat"],
      [14, "library", "sit"],
      [15.5, "park", "sit"],
      [17, "block_a", "idle"],
      [18, "block_a", "eat"],
      [21.5, "block_a", "idle"],
    ],
    atuk: [
      [0, "block_a", "idle"],
      [6.5, "block_a", "eat"],
      [8, "mosque_gate", "sit"],
      [9.5, "hawker", "sit"],
      [11.5, "park", "sit"],
      [13, "block_a", "eat"],
      [14.5, "block_a", "idle"],
      [16, "playground", "sit"],
      [17.5, "block_a", "eat"],
      [21.5, "block_a", "idle"],
    ],
    imam_hakim: [
      [0, "mosque_gate", "idle"],
      [7, "mosque_gate", "walk"],
      [9, "mosque_hall", "idle"],
      [11, "mosque_gate", "idle"],
      [14, "hawker", "eat"],
      [15, "mosque_gate", "idle"],
      [17, "mosque_gate", "walk"],
      [21.5, "mosque_gate", "idle"],
    ],
    makcik_siti: [
      [0, "block_b", "idle"],
      [6.5, "block_b", "eat"],
      [8, "minimart", "shop"],
      [9, "hawker", "eat"],
      [10.5, "park", "walk"],
      [12, "block_b", "eat"],
      [13, "block_b", "idle"],
      [15.5, "hawker", "sit"],
      [17, "playground", "sit"],
      [18, "block_b", "eat"],
      [21.5, "block_b", "idle"],
    ],
    pakcik_rahman: [
      [0, "block_b", "idle"],
      [6.5, "block_b", "eat"],
      [8, "mosque_gate", "walk"],
      [9, "recycling", "walk"],
      [10.5, "hawker", "eat"],
      [12, "mosque_gate", "sit"],
      [13.5, "block_b", "idle"],
      [15, "park", "sit"],
      [17, "playground", "walk"],
      [18, "block_b", "eat"],
      [21.5, "block_b", "idle"],
    ],
    uncle_lim: [
      [0, "block_c", "idle"],
      [6, "park", "walk"],
      [7.5, "hawker", "eat"],
      [9, "bus_stop", "sit"],
      [10.5, "hawker", "sit"],
      [12.5, "hawker", "eat"],
      [14, "block_c", "idle"],
      [16, "park", "sit"],
      [17.5, "minimart", "shop"],
      [18.5, "block_c", "eat"],
      [21, "block_c", "idle"],
    ],
    aunty_mei: [
      [0, "block_c", "idle"],
      [6, "park", "walk"],
      [7.5, "minimart", "shop"],
      [9, "hawker", "eat"],
      [11, "bus_stop", "sit"],
      [12.5, "block_c", "eat"],
      [14, "library", "sit"],
      [16, "playground", "sit"],
      [17.5, "hawker", "eat"],
      [19, "block_c", "idle"],
    ],
    hawker_ali: [
      [0, "block_a", "idle"],
      [6, "stall_prata", "idle"],
      [18.5, "block_a", "walk"],
      [19, "block_a", "eat"],
      [21.5, "block_a", "idle"],
    ],
    hawker_aminah: [
      [0, "block_b", "idle"],
      [6, "stall_nasi_lemak", "idle"],
      [18.5, "block_b", "walk"],
      [19, "block_b", "eat"],
      [21.5, "block_b", "idle"],
    ],
    barber_raju: [
      [0, "block_c", "idle"],
      [8, "barber", "idle"],
      [12.5, "hawker", "eat"],
      [13.5, "barber", "idle"],
      [19, "block_c", "walk"],
      [19.5, "block_c", "eat"],
      [21.5, "block_c", "idle"],
    ],
    dr_nurul: [
      [0, "block_b", "idle"],
      [7.5, "bus_stop", "walk"],
      [8, "clinic", "idle"],
      [12.5, "hawker", "eat"],
      [13.5, "clinic", "idle"],
      [17.5, "park", "walk"],
      [18.5, "block_b", "eat"],
      [21.5, "block_b", "idle"],
    ],
    librarian_farah: [
      [0, "block_a", "idle"],
      [8, "library", "idle"],
      [12.5, "hawker", "eat"],
      [13.5, "library", "idle"],
      [17.5, "park", "walk"],
      [18.5, "block_a", "eat"],
      [21.5, "block_a", "idle"],
    ],
    kid_irfan: [
      [0, "block_a", "idle"],
      [7.5, "block_a", "eat"],
      [8.5, "playground", "play"],
      [11, "hawker", "eat"],
      [12, "playground", "play"],
      [14, "library", "sit"],
      [15.5, "playground", "play"],
      [17.5, "block_a", "eat"],
      [20, "block_a", "idle"],
    ],
    kid_aisyah: [
      [0, "block_b", "idle"],
      [7.5, "block_b", "eat"],
      [8.5, "park", "play"],
      [11, "hawker", "eat"],
      [12, "playground", "play"],
      [14, "library", "sit"],
      [16, "park", "play"],
      [17.5, "block_b", "eat"],
      [20, "block_b", "idle"],
    ],
    kid_wei: [
      [0, "block_c", "idle"],
      [7.5, "block_c", "eat"],
      [9, "playground", "play"],
      [11.5, "hawker", "eat"],
      [12.5, "playground", "play"],
      [15, "park", "play"],
      [17.5, "block_c", "eat"],
      [20, "block_c", "idle"],
    ],
    postman_dan: [
      [0, "block_c", "idle"],
      [7, "minimart", "walk"],
      [8, "block_a", "walk"],
      [9, "block_b", "walk"],
      [10, "block_c", "walk"],
      [11, "hawker", "eat"],
      [12, "bus_stop", "walk"],
      [13, "block_a", "walk"],
      [14.5, "block_b", "walk"],
      [16, "library", "walk"],
      [17, "bus_stop", "sit"],
      [18, "block_c", "idle"],
    ],
  };

  /** Hawkers: which prayer's turn each takes while the stalls are open. */
  const HAWKER_TURN = { hawker_ali: "zohor", hawker_aminah: "asar" };

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function baseBlock(npcId, minute) {
    const blocks = ROUTINES[npcId];
    let found = blocks[0];
    for (let i = 0; i < blocks.length; i += 1) {
      if (blocks[i][0] * 60 <= minute) found = blocks[i];
    }
    return found;
  }

  function describe(poi, activity) {
    const resting = activity === "idle" || activity === "eat";
    return { poi, activity, indoors: resting && poi.indexOf("block_") === 0 };
  }

  /** Normalise Prayer.state() / a bare name / null into { current, next }. */
  function readPrayerState(prayerState) {
    if (typeof prayerState === "string")
      return { current: { name: prayerState, sinceMin: 0 }, next: null };
    if (!prayerState || typeof prayerState !== "object") return { current: null, next: null };
    let current = prayerState.current || null;
    if (!current && typeof prayerState.due === "string")
      current = { name: prayerState.due, sinceMin: 0 };
    return { current, next: prayerState.next || null };
  }

  /** Does this NPC take part in this prayer, given what they are doing now? */
  function joinsPrayer(npcId, prayerName, base) {
    const profile = KQ.Sim.NPC_PROFILE[npcId];
    if (!profile || !profile.muslim) return false;
    if (!profile.adult) return KID_PRAYERS.indexOf(prayerName) !== -1;
    if (hasOwn(HAWKER_TURN, npcId) && base[1].indexOf("stall_") === 0)
      return HAWKER_TURN[npcId] === prayerName;
    return true;
  }

  function prayerOverride(npcId, base, prayerState) {
    const around = readPrayerState(prayerState);
    const current = around.current;
    if (
      current &&
      current.sinceMin >= 0 &&
      current.sinceMin < PRAY_WINDOW_MIN &&
      joinsPrayer(npcId, current.name, base)
    ) {
      return describe("mosque_hall", "pray");
    }
    const next = around.next;
    if (
      next &&
      next.inMin >= 0 &&
      next.inMin <= LEAD_IN_MIN &&
      joinsPrayer(npcId, next.name, base)
    ) {
      return describe("mosque_gate", "walk");
    }
    return null;
  }

  /**
   * What is this NPC doing right now?
   * @param {string} npcId contract NPC id (unknown ids get a harmless park idle)
   * @param {number} minute game minute of the day (0..1439.99; wrapped/guarded)
   * @param {object|string|null} prayerState KQ.Sim.Prayer state() (uses .current/.next/.due)
   * @returns {{poi:string, activity:string, indoors:boolean}} poi is always a contract POI id
   */
  function routineFor(npcId, minute, prayerState) {
    if (typeof npcId !== "string" || !hasOwn(ROUTINES, npcId)) return Object.assign({}, FALLBACK);
    const safe = Number.isFinite(minute) ? ((minute % 1440) + 1440) % 1440 : 0;
    const base = baseBlock(npcId, safe);
    return prayerOverride(npcId, base, prayerState) || describe(base[1], base[2]);
  }

  KQ.Sim.Schedule = { routineFor, ROUTINES, ACTIVITIES, PRAY_WINDOW_MIN, LEAD_IN_MIN, HAWKER_TURN };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
