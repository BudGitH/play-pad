/* ============================================================================
 * FILE: names.js
 * PURPOSE: Child-friendly display names for places, stalls, items and mission steps (the sim
 *          holds ids; the HUD needs words).
 * BUSINESS CONTEXT: Design D: short labels under every picture; AC-11 tracker text.
 * DEPENDENCIES: KQ.Sim.NPC_PROFILE / MENU / SHOP.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const POI = {
    home: "Home",
    block_a: "Block A",
    block_b: "Block B",
    block_c: "Block C",
    hawker: "Hawker centre",
    stall_prata: "Prata stall",
    stall_nasi_lemak: "Nasi lemak stall",
    stall_mee_soto: "Mee soto stall",
    stall_drinks: "Drinks stall",
    stall_satay: "Satay stall",
    mosque_gate: "Mosque gate",
    mosque_wudu: "Wudu taps",
    mosque_hall: "Prayer hall",
    minimart: "Mini-mart",
    barber: "Barber",
    clinic: "Clinic",
    library: "Library",
    playground: "Playground",
    bus_stop: "Bus stop",
    park: "Park",
    recycling: "Recycling",
  };
  const STALL = {
    stall_prata: ["Ali's Prata & Mamak", "hawker_ali"],
    stall_nasi_lemak: ["Aminah's Nasi Lemak", "hawker_aminah"],
    stall_mee_soto: ["Mee Soto & Mee Rebus", null],
    stall_drinks: ["Minuman & Kuih", null],
    stall_satay: ["Satay Corner", null],
  };
  const ITEM_SHORT = {
    roti_prata: "prata",
    groceries: "groceries",
    get_well_card: "card",
    teh_tarik: "teh tarik",
    kuih_lapis: "kuih",
  };

  /** A neighbour's display name from their id (the id itself if unknown). */
  function npc(id) {
    const p = KQ.Sim.NPC_PROFILE[id];
    return p ? p.name : id;
  }

  /** A place's display name from its id (the id itself if unknown). */
  function poi(id) {
    return POI[id] || id;
  }

  /** Short picture label for one mission step ("Buy prata", "Nenek", "Back to Nenek"). */
  function stepLabel(step, index, mission) {
    if (step.type === "talk") return npc(step.target);
    if (step.type === "buy") return "Buy " + (ITEM_SHORT[step.item] || "it");
    if (step.type === "goto") return poi(step.target);
    if (step.type === "collect") return "Pick up " + (step.count || 1);
    const first = mission && mission.steps[0];
    const backToGiver = first && step.target === mission.giver && index > 0;
    return backToGiver ? "Back to " + npc(step.target) : "Give to " + npc(step.target);
  }

  /** A menu / shop item's display name from its id (the id itself if unknown). */
  function itemName(id) {
    const item = KQ.Sim.Economy.findItem(id);
    return item ? item.name : id;
  }

  /** Words for a prayer strip entry's state (full phrase, e.g. for the Pray card and screen readers). */
  const PRAYER_STATUS = {
    done: "Prayed",
    "qada-done": "Made up",
    due: "Time to pray",
    "in-progress": "Praying",
    qada: "Make up (qada)",
    upcoming: "Later",
  };

  /** The label for one prayer entry: "Prayed at home" for a prayer already past at game start, else by status. */
  function prayerStatus(entry) {
    if (entry.home) return "Prayed at home";
    return PRAYER_STATUS[entry.status] || "Later";
  }

  G.Names = { npc, poi, stepLabel, itemName, prayerStatus, STALL, POI };
})((window.KQ = window.KQ || {}));
