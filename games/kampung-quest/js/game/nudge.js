/* ============================================================================
 * FILE: nudge.js
 * PURPOSE: Gentle one-time nudges: the first-meal nudge (a toast plus an amber beacon and a bigger
 *          minimap dot at the hawker centre, cleared once the hero eats) and the friendly "food
 *          low" / "energy low" note the first time each meter dips under the low line each day.
 * BUSINESS CONTEXT: Product success metric "a new player eats at least one meal without help"
 *   (PM review). Child-friendly rule: only kind wording, shown once, never a penalty or a scold.
 * DEPENDENCIES: KQ.Sim.Hints (the pure decision + save), KQ.Sim.Needs / Economy, ui-core.js (toast),
 *   audio.js, prayer-flow.js (screenOpen), markers.js and loop.js (they read markerPos()).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const S = () => G.S;
  /** The check runs this often (seconds), not every frame. */
  const CHECK_EVERY = 0.25;
  /** A hint waits this long (game-loop seconds) for a quiet moment, so it lands after the reward toast. */
  const QUIET_SECONDS = 4;

  const TEXT = {
    "first-meal": ["Tummy rumbling? Grab a bite at the hawker centre!", "gold", 7000],
    "food-low": ["Your food meter is low. A snack at the hawker centre will help!", "hint", 6000],
    "energy-low": ["Feeling sleepy? A rest at home will fill your energy.", "hint", 6000],
  };

  /** Shortcut to the pure sim on the shared game state. */
  function sim() {
    return S().sim;
  }

  /** The cheapest hawker dish that fills the tummy (coins), so a nudge only comes when the hero can afford a bite. */
  function cheapestMeal() {
    return Math.min.apply(
      null,
      KQ.Sim.MENU.filter((dish) => dish.hunger > 0).map((dish) => dish.price),
    );
  }

  /** The facts KQ.Sim.Hints decides from: the clock, missions done and the state of the meters and purse. */
  function facts() {
    const m = sim();
    return {
      minute: m.clock.minute,
      day: m.clock.day,
      completed: m.missions.completed().length,
      hungry: m.needs.isHungry(),
      tired: m.needs.isTired(),
      canEat: m.needs.canEat(),
      canAfford: m.economy.coins >= cheapestMeal(),
    };
  }

  /** Is it a bad moment (a sheet or prayer screen open, a prayer due or being prayed)? Then no hint. */
  function busy() {
    return G.UI.modalOpen() || G.PrayerFlow.screenOpen() || sim().prayer.isBlockingMissions();
  }

  /** Show a hint: record it in the save state, then a soft sound and the toast. */
  function show(kind, ctx) {
    const entry = TEXT[kind];
    sim().hints.markShown(kind, ctx);
    G.Audio.play("good");
    G.UI.toast(entry[0], entry[1], entry[2]);
    S().hudDirty = true;
  }

  /**
   * Per-frame check from the UI step: when a hint is due and the moment is quiet for QUIET_SECONDS,
   * show it once. Does nothing while paused (the loop does not call it then).
   */
  function update(dt) {
    const s = S();
    s.nudgeT = (s.nudgeT || 0) + dt;
    if (s.nudgeT < CHECK_EVERY) return;
    const elapsed = s.nudgeT;
    s.nudgeT = 0;
    const ctx = facts();
    const kind = busy() ? null : sim().hints.next(ctx);
    s.nudgeWait = kind ? (s.nudgeWait || 0) + elapsed : 0;
    if (!kind || s.nudgeWait < QUIET_SECONDS) return;
    s.nudgeWait = 0;
    show(kind, ctx);
  }

  /** Where the hawker beacon goes ({x, z}) while the first-meal nudge is on and the hero can still eat, else null. */
  function markerPos() {
    if (!S() || !S().sim || !sim().hints.markerWanted() || !sim().needs.canEat()) return null;
    const hawker = S().world.pois.hawker.pos;
    return { x: hawker.x, z: hawker.z };
  }

  /** The hero ate real food (not an errand item): the first-meal goal is met, so the marker clears. */
  function onAte() {
    sim().hints.noteAte();
    S().hudDirty = true;
  }

  G.Nudge = { update, markerPos, onAte };
})((window.KQ = window.KQ || {}));
