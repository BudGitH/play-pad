/* ============================================================================
 * FILE: mission-steps.js
 * PURPOSE: The newer mission verbs that need the world (missions-more.js): "Photo" at a place,
 *          "ride to" a place, "escort" a neighbour home (they follow the hero), quick "Push"
 *          presses, and the friendly "beat the bubble" clock with its chip.
 * BUSINESS CONTEXT: AC-P19. None of these can fail: a photo is a button press, a ride counts when
 *   you arrive on any ride, an escorted kid just walks behind you (and says "Wait for me!" if you
 *   run ahead), and a slow time only misses a bonus.
 * DEPENDENCIES: mission-flow.js (notify), npc-manager.js (agents), vehicles.js, greetings.js
 *   (bubbles), life-chip.js, KQ.Sim.Missions (progress, tick, bubbleLeft).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  /** How close to a place a photo, a ride or a walk home counts. */
  const PLACE_MIN = 4;
  const FOLLOW_GAP = 1.3;
  const CHECK_EVERY = 0.25;
  const WAIT_CALL_EVERY = 9;
  const M = { checkT: 0, escortId: null, callAt: -1e9, flashEl: null, now: 0, photos: 0 };

  /** The mission progress view (or null) while the mission is running (not waiting for a prayer). */
  function live() {
    const p = S().sim.missions.progress();
    return p && !p.paused ? p : null;
  }

  /** Where a step's place is ({x, z, r}) or null when this world has no such place. */
  function placeOf(id) {
    const poi = S().world.pois && S().world.pois[id];
    return poi ? { x: poi.pos.x, z: poi.pos.z, r: Math.max(poi.radius || 0, PLACE_MIN) } : null;
  }

  /** The "Photo" prompt while a photo step is active and the hero stands at its place, else null. */
  function stepTarget(hero) {
    const p = live();
    if (!p || p.type !== "photo" || G.Vehicles.mounted()) return null;
    const at = placeOf(p.target);
    if (!at || U.dist(hero.x, hero.z, at.x, at.z) > at.r) return null;
    return {
      kind: "step",
      id: "photo:" + p.target,
      label: p.verb || "Photo",
      aria: "Take a photo",
      x: hero.x,
      z: hero.z,
      dist: U.dist(hero.x, hero.z, at.x, at.z),
      enabled: true,
      h: 1.9,
      step: p,
    };
  }

  /** A white flash that fades in a quarter of a second (the camera shutter), no sound beyond a click. */
  function flash() {
    if (!M.flashEl) {
      M.flashEl = U.el("div", {
        cls: "kq-flash",
        "aria-hidden": "true",
        style:
          "position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:6;" +
          "transition:opacity 0.28s ease-out;",
      });
      S().root.insertBefore(M.flashEl, S().hudHost);
    }
    const el = M.flashEl;
    el.style.transition = "none";
    el.style.opacity = G.Settings.reduced() ? "0.25" : "0.85";
    void el.offsetWidth; // restart the fade
    el.style.transition = "opacity 0.28s ease-out";
    el.style.opacity = "0";
  }

  /** Press the Photo button: flash, click, and tell the mission. */
  function pressStep(t) {
    flash();
    G.Audio.play("tap");
    G.Audio.play("pose");
    M.photos += 1;
    G.UI.toast("Click! Nice photo.", "good", 1800);
    G.MissionFlow.notify({ type: "photo", target: t.step.target });
  }

  /** Is the hero riding something (a bike, scooter, car, camel, horse or pony)? */
  function riding() {
    const mounts = G.Mounts && typeof G.Mounts.riding === "function" && G.Mounts.riding(); // camel, horse, pony
    return Boolean(G.Vehicles.mounted() || mounts);
  }

  /** A ride step is done when the hero arrives at the place while riding. */
  function checkRide(p) {
    const at = placeOf(p.target);
    const hero = S().player.pos;
    if (!at || !riding() || U.dist(hero.x, hero.z, at.x, at.z) > at.r) return;
    G.MissionFlow.notify({ type: "ride", target: p.target });
  }

  /** Does the step ask to escort this neighbour right now? The agent, or null. */
  function escortee(p) {
    return p && p.type === "escort" && p.who ? S().npcs.byId[p.who] || null : null;
  }

  /** Start an escorted neighbour following the hero (routines and hiding are suspended for them). */
  function beginEscort(A) {
    A.escort = true;
    A.hidden = false;
    A.talking = false;
    A.show = Math.max(A.show, 0.9);
    A.goal = { kind: "wander", hurry: true, x: A.x, z: A.z, heading: A.heading };
    A.routineKey = "escort";
    A.path = [];
    A.idleT = 1;
    M.escortId = A.id;
  }

  /** Let an escorted neighbour go back to their day. */
  function endEscort() {
    const A = M.escortId && S().npcs.byId[M.escortId];
    M.escortId = null;
    if (!A) return;
    A.escort = false;
    A.routineKey = "";
    A.path = [];
    G.Npcs.invalidate(S().npcs);
  }

  /** The neighbour walks to a point just behind the hero (or stands and faces them when close). */
  function follow(A, dt) {
    const P = S().player;
    const bx = P.pos.x - Math.sin(P.heading) * FOLLOW_GAP + Math.cos(P.heading) * 0.5;
    const bz = P.pos.z - Math.cos(P.heading) * FOLLOW_GAP - Math.sin(P.heading) * 0.5;
    A.idleT = 1; // never wander off while escorting
    if (U.dist(A.x, A.z, bx, bz) > 0.9) {
      A.path = [{ x: bx, z: bz }];
      A.wp = 0;
    } else {
      A.path = [];
      A.heading = U.dampAngle(A.heading, Math.atan2(P.pos.x - A.x, P.pos.z - A.z), 5, dt);
    }
    if (U.dist(A.x, A.z, P.pos.x, P.pos.z) > 14 && M.now - M.callAt > WAIT_CALL_EVERY) {
      M.callAt = M.now;
      G.Greetings.say(A.id, "Wait for me!", 0, 2.4);
    }
  }

  /** The escorted neighbour is home when they and the hero are at the place: the step is done. */
  function checkEscort(p, A) {
    const at = placeOf(p.target);
    const hero = S().player.pos;
    if (!at || U.dist(A.x, A.z, at.x, at.z) > at.r + 1 || U.dist(hero.x, hero.z, at.x, at.z) > 8) {
      return;
    }
    G.Greetings.say(A.id, "Home sweet home! Thank you!", 0, 3);
    G.Npcs.wave(A, 3);
    endEscort();
    G.MissionFlow.notify({ type: "escort", target: p.target });
  }

  /** Keep escort state in step with the mission: follow while the step is active, release otherwise. */
  function escortUpdate(p, dt) {
    const A = escortee(p);
    if (M.escortId && (!A || A.id !== M.escortId)) endEscort();
    if (!A) return;
    if (!A.escort) beginEscort(A);
    follow(A, dt);
    checkEscort(p, A);
  }

  /** The beat-the-bubble chip: time left, no failure word; it just goes quiet at zero. */
  function bubbleChip() {
    const left = S().sim.missions.bubbleLeft();
    if (left === null || left <= 0) return G.LifeChip.clear("bubble");
    const s = Math.ceil(left);
    G.LifeChip.set(
      "bubble",
      "Beat the bubble: " + Math.floor(s / 60) + ":" + U.pad2(s % 60) + " for a bonus",
    );
  }

  /**
   * Per-step update (from Loop.stepActors): the bubble clock, the chip, the escort follow and the
   * ride check.
   */
  function update(dt) {
    M.now += dt;
    S().sim.missions.tick(dt);
    const p = live();
    escortUpdate(p, dt);
    M.checkT += dt;
    if (M.checkT < CHECK_EVERY) return;
    M.checkT = 0;
    bubbleChip();
    G.LifeChip.update();
    if (p && p.type === "ride") checkRide(p);
  }

  /** Counters for tests. */
  function debug() {
    return { escorting: M.escortId, photos: M.photos, chip: G.LifeChip.debug() };
  }

  G.MissionSteps = { update, stepTarget, pressStep, flash, debug };
})((window.KQ = window.KQ || {}));
