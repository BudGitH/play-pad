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

  /** Build the live sim objects, then push a (clean) save state into them. */
  function create(state) {
    const S = KQ.Sim;
    const prayer = S.Prayer.create(KQ.PRAYER_TIMES);
    const sim = {
      clock: S.Clock.create({ times: KQ.PRAYER_TIMES }),
      prayer,
      needs: S.Needs.create(),
      economy: S.Economy.create(),
      missions: S.Missions.create({ isPaused: () => prayer.isBlockingMissions() }),
      outfit: Object.assign({}, state.outfit),
      pos: state.pos,
      settings: Object.assign({}, state.settings),
    };
    S.Save.apply(state, sim);
    return sim;
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
