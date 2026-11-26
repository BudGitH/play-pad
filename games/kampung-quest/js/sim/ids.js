/* ============================================================================
 * FILE: ids.js
 * PURPOSE: Shared id vocabulary (POIs, NPCs) + NPC profiles for Kampung Quest's
 *          pure-logic layer. Single source of truth for sim modules and tests.
 * BUSINESS CONTEXT: PLAY-013 module contract (features/kampung-quest/contract.md).
 * DEPENDENCIES: none (no THREE, no DOM). Load FIRST in games/kampung-quest/js/sim.
 * HOW TO TEST: npm run test:kq
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /** World places NPCs and missions may refer to (must match KQ.World pois). */
  const POI_IDS = [
    "home",
    "block_a",
    "block_b",
    "block_c",
    "hawker",
    "stall_prata",
    "stall_nasi_lemak",
    "stall_mee_soto",
    "stall_drinks",
    "stall_satay",
    "mosque_gate",
    "mosque_wudu",
    "mosque_hall",
    "minimart",
    "barber",
    "clinic",
    "library",
    "playground",
    "bus_stop",
    "park",
    "recycling",
  ];

  /**
   * NPC profiles. `muslim` drives prayer behaviour in the schedule; `adult` marks who
   * goes to the mosque for every prayer. `name` is the display name for the HUD.
   */
  const NPC_PROFILE = {
    nenek: { name: "Nenek", muslim: true, adult: true },
    atuk: { name: "Atuk", muslim: true, adult: true },
    imam_hakim: { name: "Imam Hakim", muslim: true, adult: true },
    makcik_siti: { name: "Makcik Siti", muslim: true, adult: true },
    pakcik_rahman: { name: "Pakcik Rahman", muslim: true, adult: true },
    uncle_lim: { name: "Uncle Lim", muslim: false, adult: true },
    aunty_mei: { name: "Aunty Mei", muslim: false, adult: true },
    hawker_ali: { name: "Abang Ali", muslim: true, adult: true },
    hawker_aminah: { name: "Kak Aminah", muslim: true, adult: true },
    barber_raju: { name: "Barber Raju", muslim: false, adult: true },
    dr_nurul: { name: "Dr Nurul", muslim: true, adult: true },
    librarian_farah: { name: "Cik Farah", muslim: true, adult: true },
    kid_irfan: { name: "Irfan", muslim: true, adult: false },
    kid_aisyah: { name: "Aisyah", muslim: true, adult: false },
    kid_wei: { name: "Wei", muslim: false, adult: false },
    postman_dan: { name: "Postman Dan", muslim: false, adult: true },
  };

  const NPC_IDS = Object.keys(NPC_PROFILE);

  KQ.Sim.POI_IDS = POI_IDS;
  KQ.Sim.NPC_IDS = NPC_IDS;
  KQ.Sim.NPC_PROFILE = NPC_PROFILE;
  KQ.Sim.isPoi = function isPoi(id) {
    return typeof id === "string" && POI_IDS.indexOf(id) !== -1;
  };
  KQ.Sim.isNpc = function isNpc(id) {
    return typeof id === "string" && Object.prototype.hasOwnProperty.call(NPC_PROFILE, id);
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
