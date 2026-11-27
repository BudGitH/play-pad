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
  const HALL_SPOT = { x: -45, z: -33, heading: -Math.PI / 2 };
  const NAMES = () => KQ.Sim.Prayer.DISPLAY;

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
    card: null,
    wui: null,
    pui: null,
    wudu: { taps: 0, tried: -1 },
    pray: { tried: null, cue: null, hint: "", seed: 0 },
  };
  const S = () => G.S;

  /**
   * The sim's live prayer-flow record (phase, wudu / prayer progress), or null when no flow is
   * running.
   */
  function flowState() {
    return S().sim.prayer.state().flow;
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
    if (G.UI.modalOpen() || screenOpen() || flowState()) return;
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
    F.name = name;
    F.t = 0;
    F.cueIdx = -1;
    F.expanded = true;
    F.guide = false;
    F.azanLive = true;
    const busy = Boolean(flowState());
    if (busy) {
      G.Audio.stopAzan();
    } else {
      G.Audio.startAzan();
    }
    F.pending = true;
    if (G.Audio.azanActive() === false && G.Audio.debug().muted)
      G.UI.toast("Sound is off, so you can read the azan here.", "hint");
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

  /** Route the sim's prayer events (due, qada, newday) to their handlers. */
  function onEvents(events) {
    events.forEach(function (ev) {
      if (ev.type === "due") onDue(ev.name);
      else if (ev.type === "qada") onQada(ev.name);
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
    if (!ps.flow && !ps.due && !ps.qada.length) return null;
    return ps.flow && ps.flow.phase === "pray" ? "mosque_hall" : "mosque_wudu";
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
    if (S().markers) G.Markers.showTrail(S().markers, null, S().world.heightAt);
  }

  /* ------------------------------ camera / hero ------------------------------ */

  /**
   * Frame the camera on the hero at a prayer spot, offset to the side so the open panel does not
   * cover them.
   */
  function frameHero(spot, yawOff, dist) {
    F.lastYawOff = yawOff;
    F.lastDist = dist;
    const box = G.UI.state.sheet;
    const side = Boolean(box && box.parentElement.classList.contains("kq-sheet-side"));
    G.Camera.setFrame({
      target: { x: spot.x, y: spot.y, z: spot.z },
      yaw: spot.faceYaw + yawOff,
      pitch: 0.12,
      dist: side ? dist : dist * 1.45,
      lift: 0.5,
    });
    if (!box) return G.Camera.setShift(0, 0);
    if (side) G.Camera.setShift(0, box.offsetWidth * 0.5);
    else G.Camera.setShift(box.offsetHeight * 0.5, 0);
  }

  /** Give the camera back to normal play after a wudu / prayer screen closes. */
  function leaveScreen() {
    G.Camera.setFrame(null);
    G.Camera.setShift(0, 0);
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
    if (step) S().player.forcedPose = step.pose;
  }

  /**
   * One tap on the wudu action: count it, play the sound, and complete the step once its count is
   * reached.
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
   * A wudu tile was picked: the right one acts, a wrong one gives a gentle hint with the next step
   * named.
   */
  function wuduPick(i) {
    const info = S().sim.prayer.state().flow;
    if (!info || i === info.wuduIndex) return wuduAct();
    const want = S().sim.prayer.nextWuduStep();
    F.wudu.tried = i;
    F.wudu.hint =
      i < info.wuduIndex
        ? "You did that one already. Well done! Next: " + want.label + "."
        : "Nearly! Next: " + want.label + ".";
    G.Audio.play("hint");
    refreshWudu();
  }

  /** Wudu is complete: close the screen, celebrate, and guide the hero on to the prayer hall. */
  function finishWudu() {
    G.UI.closeSheet("done");
    G.Audio.play("good");
    G.UI.toast("Wudu done. Now walk into the prayer hall.", "good", 5000);
    F.guide = true;
    computeGuide();
  }

  /** Lock the hero at the tap, open the wudu screen and frame the camera on them. */
  function openWudu(tap) {
    F.lastTap = tap;
    const P = S().player;
    const spot = {
      x: tap.pos.x,
      y: S().world.heightAt(tap.pos.x, tap.pos.z),
      z: tap.pos.z + 0.9,
      heading: Math.PI,
    };
    G.Player.lock(P, spot, "idle");
    F.wudu = { taps: 0, tried: -1, hint: "" };
    F.wui = G.PrayerUI.wudu({ onPick: wuduPick, onAct: wuduAct, onClose: closeWudu });
    refreshWudu();
    frameHero({ x: spot.x, y: spot.y, z: spot.z, faceYaw: Math.PI }, 0.7, 2.3);
  }

  /** The wudu screen closed: release the hero and the camera. */
  function closeWudu() {
    F.wui = null;
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
    const total = KQ.Sim.Prayer.RAKAAT[flow.name];
    const valid = validTypes(prayer);
    const rakaat =
      next && next.rakaat ? next.rakaat : next && next.type.indexOf("salam") === 0 ? total : 1;
    const seed = U.hash(next ? next.id : "end") + flow.prayIndex * 7;
    return {
      name: flow.name,
      kind: flow.kind,
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
    if (F.pui) G.PrayerUI.prayUpdate(F.pui, prayView());
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

  /** Lock the hero at the hall's prayer spot, open the prayer screen and frame the camera. */
  function openPray() {
    const P = S().player;
    const y = S().world.heightAt(HALL_SPOT.x, HALL_SPOT.z);
    G.Player.lock(P, { x: HALL_SPOT.x, y, z: HALL_SPOT.z, heading: HALL_SPOT.heading }, "idle");
    F.pray = { tried: null, cue: null, hint: "", seed: 0 };
    F.pui = G.PrayerUI.pray({ onPick: prayPick, onClose: closePray });
    refreshPray();
    frameHero({ x: HALL_SPOT.x, y, z: HALL_SPOT.z, faceYaw: Math.PI }, 0.55, 2.3);
  }

  /**
   * The prayer screen closed: release the hero unless the completion card is about to take over.
   */
  function closePray() {
    F.pui = null;
    G.UI.announce("", "caption");
    if (!F.completing) G.Player.release(S().player);
    leaveScreen();
  }

  /**
   * The prayer is done: award the star sticker (never coins), then show the praise card and release
   * the hero when it closes.
   */
  function completePrayer(result) {
    const sim = S().sim;
    const award = sim.missions.awardPrayer(result.name);
    F.completing = true;
    G.UI.closeSheet("done");
    F.completing = false;
    clearGuide();
    G.Audio.play("bell");
    S().player.forcedPose = "doa";
    const lines = [result.praise];
    if (award.newSticker) lines.push("You got a " + NAMES()[result.name] + " star sticker.");
    G.Menus.card({
      title: "You prayed " + NAMES()[result.name] + "!",
      variant: "bubble",
      paragraphs: lines,
      buttons: [{ label: "Alhamdulillah", primary: true, icon: "check" }],
      onClose() {
        G.Player.release(S().player);
        leaveScreen();
        S().hudDirty = true;
        G.UI.toast("Missions can carry on now.", "good");
      },
    });
    frameHero({ x: HALL_SPOT.x, y: S().player.pos.y, z: HALL_SPOT.z, faceYaw: Math.PI }, 0.55, 2.3);
  }

  /* ------------------------------ entry points ------------------------------ */

  /**
   * Name of the prayer the child can start now (running flow, due prayer, or the oldest qada), or
   * null.
   */
  function startable() {
    const ps = S().sim.prayer.state();
    if (ps.flow) return ps.flow.name;
    if (ps.due) return ps.due;
    return ps.qada.length ? ps.qada[0].name : null;
  }

  /** Nothing to pray right now: say so kindly and name the next prayer and its time. */
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

  /** The hero used a wudu tap. */
  function atTaps() {
    const name = startable();
    if (!name) return notNow();
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

  /** The hero used the prayer spot in the hall. */
  function atHall() {
    const flow = flowState();
    if (!flow) {
      const name = startable();
      if (!name) return notNow("Prayer is for prayer time.");
      G.UI.toast("Let's take wudu at the taps first, then come into the hall.", "hint", 5000);
      return;
    }
    if (flow.phase !== "pray") {
      G.UI.toast("Let's take wudu at the taps first, then come into the hall.", "hint", 5000);
      F.guide = true;
      return computeGuide();
    }
    clearGuide();
    quietCard();
    openPray();
  }

  /** Open the day card listing today's prayers, with ways to start a guide or a qada prayer. */
  function openDayCard() {
    return G.PrayerUI.dayCard({
      sim: S().sim,
      onWay: showWay,
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
    G.UI.toast("Let's finish your " + NAMES()[flow.name] + " prayer.", "good");
  }

  /** After loading a save with a prayer already due: show its card quietly (no second azan). */
  function restoreDue() {
    const due = S().sim.prayer.due();
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

  /** After a resize or rotation: switch the prayer panel between side and bottom, then re-frame. */
  function refit() {
    const open = F.wui ? "wudu" : F.pui ? "pray" : null;
    if (!open) return;
    const box = G.UI.state.sheet;
    const isSide = Boolean(box && box.parentElement.classList.contains("kq-sheet-side"));
    if (isSide === G.PrayerUI.wantsSide()) return frameAgain();
    G.UI.closeSheet("refit");
    if (open === "wudu") openWudu(F.lastTap);
    else openPray();
  }

  /** Re-apply the last prayer framing after a resize or rotation that kept the same panel layout. */
  function frameAgain() {
    const f = G.Camera.state.frame;
    if (f)
      frameHero(
        { x: f.target.x, y: f.target.y, z: f.target.z, faceYaw: Math.PI },
        F.lastYawOff,
        F.lastDist,
      );
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
    pickTile(i) {
      if (!F.pui) return false;
      const tile = F.pui.row.querySelectorAll(".kq-ptile")[i];
      if (tile) tile.click();
      return Boolean(tile);
    },
    destination,
    dueNow: () => Boolean(S().sim.prayer.due()),
  };
})((window.KQ = window.KQ || {}));
