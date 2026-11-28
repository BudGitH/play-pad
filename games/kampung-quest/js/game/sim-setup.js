/* ============================================================================
 * FILE: sim-setup.js
 * PURPOSE: Creates the pure-logic sim (KQ.Sim) from a save state and keeps the
 *          save <-> sim translation in one place (KQ.Game.Sim).
 * BUSINESS CONTEXT: AC-13 (save/load), AC-6 (clock), business rule 2 (missions pause
 *   while a prayer is blocking - wired through Missions' isPaused callback).
 * DEPENDENCIES: KQ.Sim.* (all sim modules), KQ.PRAYER_TIMES.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});

  /** Keep a loaded hero position out of walls and furniture (a saved spot may predate a layout change). */
  function safePos(pos) {
    const world = G.S && G.S.world;
    if (!pos || !world || !G.Collide) return pos;
    return G.Collide.freeSpot(world.colliders, pos.x, pos.z, G.Player.RADIUS);
  }

  /** Build the live sim objects, then push a (clean) save state into them. */
  function create(state) {
    const S = KQ.Sim;
    const prayer = S.Prayer.create(KQ.PRAYER_TIMES);
    const sim = {
      clock: S.Clock.create({ times: KQ.PRAYER_TIMES }),
      prayer,
      umrah: S.Umrah.create(),
      needs: S.Needs.create(),
      hints: S.Hints.create(),
      economy: S.Economy.create(),
      missions: S.Missions.create({
        isPaused: () => prayer.isBlockingMissions(),
        // a mission that needs a place this world does not have (a pony ride, a camel yard) is not offered
        hasPoi: (id) => !G.S || !G.S.world || Boolean(G.S.world.pois && G.S.world.pois[id]),
      }),
      outfit: Object.assign({}, state.outfit),
      wardrobe: Object.assign({}, state.wardrobe),
      pos: safePos(state.pos),
      settings: Object.assign({}, state.settings),
    };
    S.Save.apply(state, sim);
    // Makkah and Madinah: a visit, not a day of chores. Hunger and energy hold still (no nudges).
    if (KQ.region === "haramain") sim.needs.tick = () => {};
    watchStorage();
    return sim;
  }

  let watching = false;

  /**
   * Another tab saved newer progress: this tab stops saving (Save.save refuses) and says so once
   * (the `saveWarned` flag, shared with the blocked-storage notice, keeps it to one toast per
   * page, not one per autosave of the other tab). Called once per page; the `storage` event only
   * fires for OTHER tabs' writes.
   */
  function watchStorage() {
    if (watching) return;
    watching = true;
    window.addEventListener("storage", function (e) {
      const Save = KQ.Sim.Save;
      if (e.key !== Save.KEY || Save.revOf(e.newValue) <= Save.currentRev()) return;
      if (!G.S || G.S.saveWarned) return;
      G.S.saveWarned = true;
      G.UI.toast("Another tab is saving this game. This tab will not overwrite it.", "hint", 7000);
    });
  }

  /** Snapshot the live sim for saving; `heroPos` is {x, z} or null. */
  function capture(sim, heroPos) {
    sim.pos = heroPos;
    return KQ.Sim.Save.capture(sim);
  }

  /** Is a prayer flow active (so the world should slow down and the hero is busy)? */
  function inFlow(sim) {
    return Boolean(sim.prayer.state().flow);
  }

  G.Sim = { create, capture, inFlow };
})((window.KQ = window.KQ || {}));
