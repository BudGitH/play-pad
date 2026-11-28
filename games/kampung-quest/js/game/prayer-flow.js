/* ============================================================================
 * FILE: prayer-flow.js
 * PURPOSE: The prayer controller (business rules 2 and 5): the azan with live captions, the
 *          guidance trail to the mosque, wudu at the taps, the prayer steps in the hall with the
 *          hero taking each posture, the reward, and the qada card.
 * BUSINESS CONTEXT: AC-7 (azan once, captions always, audio only when visible + unmuted), AC-8
 *   (wudu order, raka'at counts, hero poses, gentle hints, no fail state), AC-9 (late = still
 *   praised; missed = qada, any time, no penalty). Edge cases: a prayer due during a menu shows its
 *   card after the menu closes; reloading mid-flow resumes at the start of the step; Maghrib ->
 *   Isyak are tracked separately by KQ.Sim.Prayer.
 * DEPENDENCIES: KQ.Sim.Prayer (the logic), prayer-ui.js, prayer-text.js, audio.js, player.js,
 *   camera.js, markers.js, pathing.js. Reads shared state from KQ.Game.S.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const KAMPUNG_HALL = { x: -45, z: -33, heading: -Math.PI / 2 };
  /** The hero's prayer spot: the kampung mosque's, or the current holy city's (Haramain region). */
  const hallNow = () =>
    KQ.region === "haramain" && KQ.Holy && KQ.Holy.world
      ? KQ.Holy.HALL[KQ.Holy.world.city()]
      : KAMPUNG_HALL;
  const HALL_SPOT = {
    get x() {
      return hallNow().x;
    },
    get z() {
      return hallNow().z;
    },
    get heading() {
      return hallNow().heading;
    },
  };
  const NAMES = () => KQ.Sim.Prayer.DISPLAY;
  const SUNAT = () => KQ.Sim.Prayer.SUNAT;
  /** A sunat prayer the hero wandered away from (this far from the hall, no screen open) is dropped. */
  const STRAY_M = 50;
  /** Sheet-close reasons that are not a "Not now": the sunat flow carries on. */
  const KEEP_FLOW = ["done", "refit", "replaced"];

  const F = {
    name: null,
    azanLive: false,
    t: 0,
    cueIdx: -1,
    pending: false,
    expanded: false,
    hideAt: 0,
    guide: false,
    guideT: 0,
    wayTo: null,
    strayT: 0,
    card: null,
    wui: null,
    pui: null,
    wudu: { taps: 0, tried: -1 },
    pray: { tried: null, cue: null, hint: "", seed: 0 },
    viewShift: 0,
    viewName: null,
    shotSpot: null,
    shotKind: null,
  };
  const S = () => G.S;

  /**
   * The sim's live prayer-flow record (phase, wudu / prayer progress), or null when no flow is
   * running.
   */
  function flowState() {
    return S().sim.prayer.state().flow;
  }

  /** Is a FARD prayer flow running? A sunat flow does not hold back the azan of a prayer that falls due. */
  function fardFlowRunning() {
    const flow = flowState();
    return Boolean(flow) && flow.kind !== "sunat";
  }

  /** Is a sunat flow running (open or not)? */
  function sunatFlowRunning() {
    const flow = flowState();
    return Boolean(flow) && flow.kind === "sunat";
  }

  /** Is a wudu or prayer screen showing? Cards and guidance hold back while one is. */
  function screenOpen() {
    return Boolean(F.wui || F.pui);
  }

  /* ------------------------------ azan card ------------------------------ */

  /**
   * Build the azan card on first use (lazily, so no DOM exists before it is needed) and return it.
   */
  function ensureCard() {
    if (F.card) return F.card;
    F.card = G.PrayerUI.azanCard(() => showWay());
    S().hudHost.insertBefore(F.card.el, S().hudHost.firstChild);
    return F.card;
  }

  /**
   * Choose the caption cue for azan time t: the cue whose start has passed (Subuh's extra line only
   * in its own window).
   */
  function pickCue(cues, t, name) {
    if (name === "subuh" && t >= 70.2 && t <= 72) return cues.find((c) => c.subuhOnly) || null;
    let best = null;
    cues.forEach(function (c) {
      if (c.subuhOnly || c.start === null) return;
      if (t >= c.start - 0.3) best = c;
    });
    return best || cues.find((c) => !c.subuhOnly) || cues[0];
  }

  /**
   * Per frame while the azan is live: follow the audio clock when there is one, update the caption,
   * and end the azan after its last cue.
   */
  function advanceCaptions(dt) {
    F.t += dt;
    const at = G.Audio.azanTime();
    if (at !== null) F.t = at;
    const cues = G.PrayerText.azanCues();
    const cue = pickCue(cues, F.t, F.name);
    const idx = cues.indexOf(cue);
    if (idx !== F.cueIdx && F.card) {
      F.cueIdx = idx;
      G.PrayerUI.setCue(F.card, cue);
    }
    const last = cues.reduce((m, c) => Math.max(m, c.end || 0), 0);
    if (F.t > last + 2.5 || (G.Audio.azanEnded() && F.t > last - 1)) endAzan();
  }

  /**
   * The azan has finished: stop its audio and leave the bar up for a few seconds before it hides.
   */
  function endAzan() {
    F.azanLive = false;
    G.Audio.stopAzan();
    F.hideAt = S().t + 6;
  }

  /**
   * Reveal the azan card with the current caption, as a bar or expanded, and lift the hero clear of
   * it.
   */
  function showCardNow() {
    const card = ensureCard();
    card.title.textContent = G.PrayerText.title(F.name);
    card.el.hidden = false;
    card.el.classList.toggle("is-bar", !F.expanded);
    card.el.classList.toggle("is-large", G.Settings.prefs.captionSize === "large");
    G.PrayerUI.setCue(card, pickCue(G.PrayerText.azanCues(), F.t, F.name));
    F.pending = false;
    liftHero(F.expanded ? card.el.offsetHeight : 0);
  }

  /** Nudge the picture up so a bottom card does not cover the hero. */
  function liftHero(px) {
    if (!screenOpen()) G.Camera.setShift(px * 0.4);
  }

  /**
   * Show a queued azan card once nothing else (modal, prayer screen, running flow) is in the way.
   */
  function maybeShowCard() {
    if (!F.pending) return;
    if (G.UI.modalOpen() || screenOpen() || fardFlowRunning()) return;
    showCardNow();
  }

  /** The flow has started: the azan stops (we are praying now) and its captions go away. */
  function quietCard() {
    F.pending = false;
    F.expanded = false;
    if (F.azanLive) endAzan();
    hideCard();
  }

  /** Hide the azan card and give the hero's framing back. */
  function hideCard() {
    if (F.card) F.card.el.hidden = true;
    liftHero(0);
  }

  /* ------------------------------ events ------------------------------ */

  /**
   * A prayer has fallen due: start the azan (unless already praying) and queue its card; toast the
   * captions hint when sound is off.
   */
  function onDue(name) {
    dropIdleSunat();
    F.name = name;
    F.t = 0;
    F.cueIdx = -1;
    F.expanded = true;
    F.guide = false;
    F.azanLive = true;
    const busy = fardFlowRunning();
    if (busy) {
      G.Audio.stopAzan();
    } else {
      G.Audio.startAzan();
    }
    F.pending = true;
    if (G.Audio.azanActive() === false && G.Audio.debug().muted)
      G.UI.toast("Sound is off, so you can read the azan here.", "hint");
  }

  /**
   * A fard prayer falling due always takes over from a sunat flow nobody is looking at (its wudu
   * screen / prayer screen is closed): drop the flow, keep the wudu clean. A sunat screen that is
   * still open is left alone; the azan card shows once it closes.
   */
  function dropIdleSunat() {
    if (sunatFlowRunning() && !screenOpen()) S().sim.prayer.cancelFlow();
  }

  /** A prayer window has passed: tell the child, kindly, that it can be made up (qada) any time. */
  function onQada(name) {
    G.UI.toast(
      NAMES()[name] + " time has passed. You can make it up (qada) any time. No rush.",
      "hint",
      5200,
    );
  }

  /** Midnight rollover: reset the day's missions and collectibles and announce the fresh day. */
  function onNewDay() {
    const m = S().sim.missions.snapshot();
    S().sim.missions.restore({ active: m.active, completed: [], stickers: m.stickers });
    G.Collectibles.resetAll(S().collect);
    G.UI.toast("A new day in the kampung! New missions are ready.", "good", 5200);
  }

  /**
   * The one `due` event that should start an azan: the last prayer to fall due in this batch whose
   * window has not already closed in the same batch. A long clock jump (rest, a menu, a test hook)
   * can cross several start times at once; the azan sounds for the prayer that is actually due
   * now, once, not for every start time that was stepped over.
   */
  function liveDue(events) {
    let live = null;
    events.forEach(function (ev) {
      if (ev.type === "due") live = ev;
      else if (ev.type === "qada" && live && live.name === ev.name && live.day === ev.day)
        live = null;
    });
    return live;
  }

  /** Route the sim's prayer events (due, qada, newday) to their handlers. */
  function onEvents(events) {
    const live = liveDue(events);
    events.forEach(function (ev) {
      if (ev.type === "due") {
        if (ev === live) onDue(ev.name);
      } else if (ev.type === "qada") onQada(ev.name);
      else if (ev.type === "newday") onNewDay();
    });
  }

  /* ------------------------------ guidance ------------------------------ */

  /**
   * The POI the guidance trail should lead to (taps for wudu, hall for prayer), or null when
   * nothing is pending.
   */
  function destination() {
    const ps = S().sim.prayer.state();
    if (ps.flow) return ps.flow.phase === "pray" ? "mosque_hall" : "mosque_wudu";
    if (ps.due || ps.qada.length) return "mosque_wudu";
    return F.wayTo;
  }

  /**
   * Recompute the footprint trail from the hero to the destination; clear it once the hero is
   * within 4 m.
   */
  function computeGuide() {
    const dest = destination();
    const hero = S().player.pos;
    const world = S().world;
    if (!dest || U.dist(hero.x, hero.z, world.pois[dest].pos.x, world.pois[dest].pos.z) < 4) {
      G.Markers.showTrail(S().markers, null, world.heightAt);
      F.guideDest = null;
      F.wayTo = null;
      return;
    }
    F.guideDest = dest;
    const pts = G.Path.toPoi(S().npcs.pathP, hero.x, hero.z, dest);
    G.Markers.showTrail(
      S().markers,
      pts ? [{ x: hero.x, z: hero.z }].concat(pts) : null,
      world.heightAt,
    );
  }

  /** The phone auto-collapse shrank the card to its pill: drop the camera lift with it. */
  function collapse() {
    F.expanded = false;
    if (F.card) F.card.el.classList.add("is-bar");
    liftHero(0);
  }

  /**
   * The child tapped 'Show me the way': turn the guide on, fold the azan card and draw the trail.
   */
  function showWay() {
    F.guide = true;
    F.guideT = 0;
    collapse();
    keepFocus();
    computeGuide();
    G.Audio.play("tap");
    G.UI.toast("Follow the green footprints to the mosque.", "good");
  }

  /**
   * The 'Show me the way' button folds away with the azan card; if keyboard focus was on it (or
   * lost), move it to the Pray dock button so it never drops to the page body.
   */
  function keepFocus() {
    const a = document.activeElement;
    const lost = !a || a === document.body || !a.isConnected;
    if (!lost && !(F.card && F.card.el.contains(a))) return;
    const pray = G.Hud.refs.dockBtns && G.Hud.refs.dockBtns.pray;
    if (pray) pray.focus({ preventScroll: true });
  }

  /** Turn the guidance trail off and remove its footprints. */
  function clearGuide() {
    F.guide = false;
    F.guideDest = null;
    F.wayTo = null;
    if (S().markers) G.Markers.showTrail(S().markers, null, S().world.heightAt);
  }

  /* ------------------------------ camera / hero ------------------------------ */

  /**
   * Cut to the shot for the current step: the view (close-up, front, side, behind) chosen by
   * "Change view" for this kind of step, eased by the camera's scripted-shot API. `kind` is the
   * posture type (prayer) or the pose (wudu); `spot` {x, y, z, heading} is where the hero stands.
   */
  function shot(kind, spot) {
    if (spot) F.shotSpot = spot;
    if (kind) F.shotKind = kind;
    if (!F.shotSpot) return;
    const list = G.Shots.views(F.shotKind);
    F.viewName = list[F.viewShift % list.length];
    G.Camera.shot(G.Shots.frame(F.viewName, F.shotSpot, F.shotKind));
    G.RitualUI.fitShift();
  }

  /** "Change view": the next of the three angles (close-up / front / side / behind), kept for the next steps too. */
  function changeView() {
    F.viewShift += 1;
    shot();
    G.UI.announce("View: " + G.Shots.NAMES[F.viewName], "caption");
    G.UI.toast("View: " + G.Shots.NAMES[F.viewName], "hint", 1400, "view");
  }

  /** Give the camera back to normal play after a wudu / prayer screen closes. */
  function leaveScreen() {
    G.Camera.clearShot();
    G.Camera.setShift(0, 0);
    F.shotSpot = null;
  }

  /** The wudu tap closest to the hero, or null if none is registered. */
  function nearestTap() {
    const hero = S().player.pos;
    let best = null;
    S().world.interactables.forEach(function (it) {
      if (it.id.indexOf("wudu_tap_") !== 0) return;
      const d = U.dist(hero.x, hero.z, it.pos.x, it.pos.z);
      if (!best || d < best.d) best = { it, d };
    });
    return best ? best.it : null;
  }

  /* ------------------------------ wudu ------------------------------ */

  /** Snapshot of wudu progress (step index, taps so far, hint) for the wudu screen to draw. */
  function wuduView() {
    const info = S().sim.prayer.state().flow;
    const step = S().sim.prayer.nextWuduStep();
    return {
      index: info.wuduIndex,
      total: info.wuduTotal,
      taps: F.wudu.taps,
      step,
      tried: F.wudu.tried,
      hint: F.wudu.hint,
    };
  }

  /** Redraw the wudu screen and put the hero in the current step's pose. */
  function refreshWudu() {
    if (!F.wui) return;
    G.PrayerUI.wuduUpdate(F.wui, wuduView());
    const step = S().sim.prayer.nextWuduStep();
    if (!step) return;
    S().player.forcedPose = step.pose;
    shot(step.pose.indexOf("wudu_") === 0 ? step.pose : "wudu_idle");
  }

  /**
   * "Next" on a wudu card: one wash (a tap of the 3 for the washes), with the hero's matching move
   * and sound. The step is done after its last tap, and the last step finishes the wudu.
   */
  function wuduAct() {
    const prayer = S().sim.prayer;
    const step = prayer.nextWuduStep();
    if (!step) return;
    F.wudu.tried = -1;
    F.wudu.hint = "";
    F.wudu.taps += 1;
    S().player.forcedPose = step.pose;
    G.Audio.play(step.pose === "idle" || step.pose === "doa" ? "tap" : "splash");
    if (F.wudu.taps >= step.count) {
      F.wudu.taps = 0;
      const res = prayer.wuduStep(step.id);
      if (res.ok && res.done) return finishWudu();
    }
    refreshWudu();
  }

  /**
   * Wudu is complete: close the screen and celebrate. Started "right here", the prayer steps open in
   * the same place; otherwise the hero is guided on to the prayer hall.
   */
  function finishWudu() {
    const here = F.lastHere;
    G.UI.closeSheet("done");
    G.Audio.play("good");
    if (here) return openPray(here);
    G.UI.toast("Wudu done. Now walk into the prayer hall.", "good", 5000);
    F.guide = true;
    computeGuide();
  }

  /** Where the hero stands for wudu: at the tap, or (`here`) right where they are. */
  function wuduSpot(tap, here) {
    if (here) return here;
    return {
      x: tap.pos.x,
      y: S().world.heightAt(tap.pos.x, tap.pos.z),
      z: tap.pos.z + 0.9,
      heading: Math.PI,
    };
  }

  /** Lock the hero at the tap (or `here`), open the wudu stepper and frame the camera on them. */
  function openWudu(tap, here) {
    F.lastTap = tap;
    F.lastHere = here || null;
    const spot = wuduSpot(tap, here);
    G.Player.lock(S().player, spot, "idle");
    F.wudu = { taps: 0, tried: -1, hint: "" };
    F.viewShift = 0;
    F.shotSpot = { x: spot.x, y: spot.y, z: spot.z, heading: spot.heading };
    F.wui = G.PrayerUI.wudu({ onAct: wuduAct, onView: changeView, onClose: closeWudu });
    refreshWudu();
  }

  /**
   * "Not now" (button, Escape, backdrop, dock) on a sunat screen ends the optional prayer (the wudu
   * stays clean), so the clock, the ambience and the HUD do not stay in prayer mode. A finished
   * step ("done"), a re-layout ("refit") or a sheet swap ("replaced") keeps the flow.
   */
  function letSunatGo(reason) {
    if (KEEP_FLOW.indexOf(reason) !== -1 || !sunatFlowRunning()) return;
    S().sim.prayer.cancelFlow();
    S().hudDirty = true;
  }

  /** The wudu screen closed: release the hero and the camera. */
  function closeWudu(reason) {
    F.wui = null;
    letSunatGo(reason);
    G.UI.announce("", "caption");
    G.Player.release(S().player);
    leaveScreen();
  }

  /* ------------------------------ prayer steps ------------------------------ */

  /**
   * The posture types accepted as the next prayer step (an optional step also accepts the one after
   * it).
   */
  function validTypes(prayer) {
    const next = prayer.nextPrayStep();
    if (!next) return [];
    const plan = KQ.Sim.Prayer.rakaatPlan(prayer.state().flow.name);
    const idx = plan.findIndex((s) => s.id === next.id);
    const out = [next.type];
    if (next.optional && plan[idx + 1]) out.push(plan[idx + 1].type);
    return out;
  }

  /**
   * Snapshot of prayer progress (rakaat, choices, hint, dhikr cue) for the prayer screen to draw.
   */
  function prayView() {
    const prayer = S().sim.prayer;
    const flow = prayer.state().flow;
    const next = prayer.nextPrayStep();
    const total = KQ.Sim.Prayer.rakaatOf(flow.name);
    const valid = validTypes(prayer);
    const rakaat =
      next && next.rakaat ? next.rakaat : next && next.type.indexOf("salam") === 0 ? total : 1;
    const seed = U.hash(next ? next.id : "end") + flow.prayIndex * 7;
    return {
      name: flow.name,
      kind: flow.kind,
      stepId: next ? next.id : "end",
      rakaat,
      total,
      choices: G.PrayerText.choices(valid, seed),
      want: valid,
      tried: F.pray.tried,
      hint: F.pray.hint,
      cue: F.pray.cue,
    };
  }

  /** Redraw the prayer screen if it is open. */
  function refreshPray() {
    if (!F.pui) return;
    const view = prayView();
    G.PrayerUI.prayUpdate(F.pui, view);
    const next = S().sim.prayer.nextPrayStep();
    if (next) S().player.forcedPose = next.pose; // the hero shows the posture the card is about
    shot(view.want[0]);
  }

  /**
   * A posture tile was picked: a wrong one gives a hint, the right one poses the hero and advances
   * (or completes) the prayer.
   */
  function prayPick(type) {
    const prayer = S().sim.prayer;
    const res = prayer.prayStep(type);
    if (!res.ok) {
      F.pray.tried = type;
      F.pray.hint = hintFor(prayer);
      G.Audio.play("hint");
      return refreshPray();
    }
    F.pray.tried = null;
    F.pray.hint = "";
    const tile = G.PrayerText.TILE[res.step.type] || G.PrayerText.TILE.qiyam;
    F.pray.cue = G.PrayerText.DHIKR[tile[3]];
    S().player.forcedPose = res.step.pose;
    G.Audio.play("pose");
    if (res.done) return completePrayer(res.result);
    refreshPray();
  }

  /** The short gentle "Nearly! Next: Ruku (bow)." hint naming the expected posture (empty at the end). */
  function hintFor(prayer) {
    const want = prayer.nextPrayStep();
    return want ? G.PrayerText.nextHint(want.type) : "";
  }

  /**
   * Lock the hero at the hall's prayer spot (or `here`, facing the qibla), open the prayer stepper
   * and frame the camera.
   */
  function openPray(here) {
    const P = S().player;
    const spot = here || { x: HALL_SPOT.x, z: HALL_SPOT.z, heading: HALL_SPOT.heading };
    const y = S().world.heightAt(spot.x, spot.z);
    F.praySpot = { x: spot.x, z: spot.z, heading: spot.heading };
    F.lastHere = here || null;
    G.Player.lock(P, { x: spot.x, y, z: spot.z, heading: spot.heading }, "idle");
    F.pray = { tried: null, cue: null, hint: "", seed: 0 };
    F.viewShift = 0;
    F.shotSpot = { x: spot.x, y, z: spot.z, heading: spot.heading };
    F.pui = G.PrayerUI.pray({ onPick: prayPick, onView: changeView, onClose: closePray });
    refreshPray();
  }

  /**
   * The prayer screen closed: release the hero unless the completion card is about to take over.
   */
  function closePray(reason) {
    F.pui = null;
    letSunatGo(reason);
    G.UI.announce("", "caption");
    if (!F.completing) G.Player.release(S().player);
    leaveScreen();
  }

  /**
   * The prayer is done: award the star sticker (never coins), then show the praise card and release
   * the hero when it closes.
   */
  function completePrayer(result) {
    const voluntary = result.kind === "sunat";
    const award = voluntary ? { newSticker: false } : S().sim.missions.awardPrayer(result.name);
    F.completing = true;
    G.UI.closeSheet("done");
    F.completing = false;
    clearGuide();
    G.Audio.play("bell");
    S().player.forcedPose = "doa";
    const lines = [result.praise];
    if (award.newSticker) lines.push("You got a " + NAMES()[result.name] + " star sticker.");
    G.Menus.card({
      title: voluntary ? "You prayed a sunat prayer!" : "You prayed " + NAMES()[result.name] + "!",
      variant: "bubble",
      paragraphs: lines,
      buttons: [{ label: "Alhamdulillah", primary: true, icon: "check" }],
      onClose() {
        G.Player.release(S().player);
        leaveScreen();
        S().hudDirty = true;
        if (!voluntary) G.UI.toast("Missions can carry on now.", "good");
      },
    });
    const at = F.praySpot || HALL_SPOT;
    F.viewShift = 0;
    shot("qiyam", { x: at.x, y: S().player.pos.y, z: at.z, heading: at.heading });
  }

  /* ------------------------------ entry points ------------------------------ */

  /**
   * Name of the FARD prayer the child can start now (running fard flow, due prayer, or the oldest
   * qada), or null when none is owed. Then the Pray action offers the voluntary sunat prayer.
   */
  function startable() {
    const ps = S().sim.prayer.state();
    if (ps.flow && ps.flow.kind !== "sunat") return ps.flow.name;
    if (ps.due) return ps.due;
    return ps.qada.length ? ps.qada[0].name : null;
  }

  /** True when the Pray action would start the voluntary sunat prayer (no fard prayer is owed). */
  function isVoluntary() {
    return !startable();
  }

  /** Nothing could start: say so kindly and name the next prayer and its time. */
  function notNow(extra) {
    const ps = S().sim.prayer.state();
    const next = ps.next
      ? NAMES()[ps.next.name] + " at " + KQ.PRAYER_TIMES[ps.next.name]
      : "tomorrow";
    G.UI.toast(
      (extra || "The taps are ready for prayer time.") + " Next prayer: " + next + ".",
      "hint",
      4600,
    );
  }

  /** The hero used a wudu tap: wudu for the due, qada or (when none is owed) sunat prayer. */
  function atTaps() {
    const name = startable() || SUNAT();
    const prayer = S().sim.prayer;
    const res = prayer.startFlow(name);
    if (!res.ok) return notNow();
    clearGuide();
    quietCard();
    if (res.phase === "pray") {
      G.UI.toast(
        "You are still clean from your last wudu. Walk into the prayer hall.",
        "good",
        5000,
      );
      F.guide = true;
      return computeGuide();
    }
    const tap = nearestTap();
    if (tap) openWudu(tap);
  }

  /**
   * The heading that faces the qibla from a spot: from the region (KQ.Holy.qiblaAt, in Makkah and
   * Madinah) when it knows, else the mosque hall's heading (the kampung's qibla is west).
   */
  function qiblaHeading(x, z) {
    const holy = KQ.Holy;
    const q = holy && typeof holy.qiblaAt === "function" ? holy.qiblaAt(x, z) : null;
    if (typeof q === "number" && Number.isFinite(q)) return q;
    if (q && Number.isFinite(q.yaw)) return q.yaw;
    if (q && Number.isFinite(q.x) && Number.isFinite(q.z)) return Math.atan2(q.x, q.z);
    return HALL_SPOT.heading;
  }

  /** The spot the hero prays on when they start "right here": where they stand, facing the qibla. */
  function heroHere() {
    const p = S().player.pos;
    return { x: p.x, z: p.z, y: S().world.heightAt(p.x, p.z), heading: qiblaHeading(p.x, p.z) };
  }

  /**
   * "Wudu and prayer right here" (no walking): start the owed prayer (or the voluntary sunat one)
   * and open its stepper where the hero stands. Used by the Pray card, so a child never has to
   * find the taps or the hall to take part.
   */
  function startHere() {
    const res = S().sim.prayer.startFlow(startable() || SUNAT());
    if (!res.ok) return notNow(res.hint);
    clearGuide();
    quietCard();
    const here = heroHere();
    if (res.phase === "wudu") openWudu(null, here);
    else openPray(here);
  }

  /** A sunat prayer from the hall: straight to the prayer steps when still clean, else wudu first. */
  function sunatAtHall() {
    if (!S().sim.prayer.state().wuduClean) {
      G.UI.toast(
        G.PrayerText.SUNAT_LABEL + " begins with wudu. Let's go to the taps first.",
        "hint",
        5000,
      );
      F.wayTo = "mosque_wudu";
      F.guide = true;
      return computeGuide();
    }
    if (!S().sim.prayer.startFlow(SUNAT()).ok) return notNow();
    clearGuide();
    openPray();
  }

  /**
   * The flow the hall's Pray action works on, with a fard prayer always winning: a sunat flow is
   * replaced by the owed prayer, and with no flow but a clean wudu (carried over from a dropped
   * sunat flow) the owed prayer starts straight at its prayer phase.
   */
  function hallFlow() {
    const flow = flowState();
    const owed = startable();
    const prayer = S().sim.prayer;
    if (flow && flow.kind !== "sunat") return flow;
    if (!owed) return flow;
    if (flow || prayer.state().wuduClean) prayer.startFlow(owed);
    return flowState();
  }

  /** Say, kindly, that wudu comes first, and lead the hero to the taps. */
  function wuduFirst() {
    G.UI.toast("Let's take wudu at the taps first, then come into the hall.", "hint", 5000);
    F.guide = true;
    computeGuide();
  }

  /** The hero used the prayer spot in the hall (or the Pray button anywhere inside it). */
  function atHall() {
    const flow = hallFlow();
    if (!flow) {
      if (!startable()) return sunatAtHall();
      return G.UI.toast(
        "Let's take wudu at the taps first, then come into the hall.",
        "hint",
        5000,
      );
    }
    if (flow.phase !== "pray") return wuduFirst();
    clearGuide();
    quietCard();
    openPray();
  }

  /** Open the day card listing today's prayers, with ways to start a guide or a qada prayer. */
  function openDayCard() {
    return G.PrayerUI.dayCard({
      sim: S().sim,
      onWay: showWay,
      onHere: startHere,
      onQada(name) {
        S().sim.prayer.startFlow(name);
        showWay();
      },
    });
  }

  /** Continue a flow that was saved mid-way (reload): place the hero and open the step screen. */
  function resume() {
    const flow = flowState();
    if (!flow) return;
    const world = S().world;
    if (flow.phase === "wudu") {
      const tap = world.interactables.find((i) => i.id === "wudu_tap_4");
      G.Player.place(S().player, tap.pos.x, tap.pos.z + 0.9, Math.PI, world.heightAt);
      openWudu(tap);
    } else {
      G.Player.place(S().player, HALL_SPOT.x, HALL_SPOT.z, HALL_SPOT.heading, world.heightAt);
      openPray();
    }
    G.UI.toast(
      "Let's finish your " +
        G.PrayerText.flowLabel(flow.name, flow.kind) +
        (flow.kind === "sunat" ? "." : " prayer."),
      "good",
    );
  }

  /** After loading a save with a prayer already due: show its card quietly (no second azan). */
  function restoreDue() {
    const due = S().sim.prayer.due();
    if (due) dropIdleSunat(); // a saved sunat never hides the owed fard's card on reload
    if (!due || flowState()) return;
    F.name = due;
    F.t = 0;
    F.cueIdx = -1;
    F.expanded = true;
    F.pending = true;
  }

  /** Root classes for the CSS: `kq-azan-bar` (the pill is up) and `kq-azan-full` (the whole card is up). */
  function syncBarClass() {
    const shown = Boolean(F.card && !F.card.el.hidden);
    const bar = shown && F.card.el.classList.contains("is-bar");
    S().root.classList.toggle("kq-azan-bar", bar);
    const wasFull = S().root.classList.contains("kq-azan-full");
    S().root.classList.toggle("kq-azan-full", shown && !bar);
    if (wasFull && !(shown && !bar)) G.UI.releaseToasts();
  }

  /**
   * After a resize or rotation: switch the open card between side panel and bottom sheet (a minimised
   * card stays minimised: the same card is kept, not rebuilt), then re-frame the shot.
   */
  function refit() {
    G.RitualUI.refit();
    if (F.wui || F.pui) frameAgain();
  }

  /** Re-apply the shot after a resize or rotation that kept the same panel layout. */
  function frameAgain() {
    shot();
  }

  /**
   * A sunat prayer is optional: if the hero starts one and then wanders far from the mosque with no
   * screen open, quietly let it go (their wudu stays clean) so the clock does not stay slowed.
   */
  function dropStraySunat(dt) {
    const flow = flowState();
    if (!flow || flow.kind !== "sunat" || screenOpen() || G.UI.modalOpen()) {
      F.strayT = 0;
      return;
    }
    F.strayT += dt;
    if (F.strayT < 1) return;
    F.strayT = 0;
    const hero = S().player.pos;
    const hall = S().world.pois.mosque_hall.pos;
    if (U.dist(hero.x, hero.z, hall.x, hall.z) <= STRAY_M) return;
    S().sim.prayer.cancelFlow();
    clearGuide();
    S().hudDirty = true;
  }

  /**
   * Per-frame tick: advance the azan captions, hide a finished bar, show a queued card and refresh
   * the guidance trail.
   */
  function update(dt) {
    syncBarClass();
    if (F.azanLive) advanceCaptions(dt);
    else if (
      F.card &&
      !F.card.el.hidden &&
      F.card.el.classList.contains("is-bar") &&
      S().t >= F.hideAt
    )
      hideCard();
    maybeShowCard();
    dropStraySunat(dt);
    if (!F.guide) return;
    F.guideT += dt;
    if (F.guideT > 1) {
      F.guideT = 0;
      if (destination()) computeGuide();
      else clearGuide();
    }
  }

  /** Clear all azan and guidance state when the sim's prayer tracker is rebuilt (clock jump or reload). */
  function reset() {
    hideCard();
    F.pending = false;
    F.azanLive = false;
    clearGuide();
  }

  G.PrayerFlow = {
    onEvents,
    update,
    atTaps,
    atHall,
    openDayCard,
    showWay,
    collapse,
    resume,
    refit,
    restoreDue,
    reset,
    state: F,
    screenOpen,
    /** Key 1 presses Next on the open wudu / prayer card (the other number keys have no tile any more). */
    pickTile(i) {
      const ui = F.pui || F.wui;
      if (!ui || i !== 0 || !ui.ctl.nextBtn) return false;
      if (ui.ctl.minimised) return ui.ctl.restore(), true; // key 1 brings a tucked-away card back first
      ui.ctl.nextBtn.click();
      return true;
    },
    startHere,
    destination,
    isVoluntary,
    dueNow: () => Boolean(S().sim.prayer.due()),
  };
})((window.KQ = window.KQ || {}));
