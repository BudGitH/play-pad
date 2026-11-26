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

  function flowState() {
    return S().sim.prayer.state().flow;
  }

  function screenOpen() {
    return Boolean(F.wui || F.pui);
  }

  /* ------------------------------ azan card ------------------------------ */

  function ensureCard() {
    if (F.card) return F.card;
    F.card = G.PrayerUI.azanCard(() => showWay());
    S().hudHost.insertBefore(F.card.el, S().hudHost.firstChild);
    return F.card;
  }

  function pickCue(cues, t, name) {
    if (name === "subuh" && t >= 70.2 && t <= 72) return cues.find((c) => c.subuhOnly) || null;
    let best = null;
    cues.forEach(function (c) {
      if (c.subuhOnly || c.start === null) return;
      if (t >= c.start - 0.3) best = c;
    });
    return best || cues.find((c) => !c.subuhOnly) || cues[0];
  }

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

  function endAzan() {
    F.azanLive = false;
    G.Audio.stopAzan();
    F.hideAt = S().t + 6;
  }

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

  function maybeShowCard() {
    if (!F.pending) return;
    if (G.UI.modalOpen() || screenOpen() || flowState()) return;
    showCardNow();
  }

  /** The flow has started: the big card goes away; a live azan keeps its slim caption bar. */
  function quietCard() {
    F.pending = false;
    F.expanded = false;
    if (F.azanLive && F.card) {
      F.card.el.classList.add("is-bar");
      return;
    }
    hideCard();
  }

  function hideCard() {
    if (F.card) F.card.el.hidden = true;
    liftHero(0);
  }

  /* ------------------------------ events ------------------------------ */

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

  function onQada(name) {
    G.UI.toast(
      NAMES()[name] + " time has passed. You can make it up (qada) any time. No rush.",
      "hint",
      5200,
    );
  }

  function onNewDay() {
    const m = S().sim.missions.snapshot();
    S().sim.missions.restore({ active: m.active, completed: [], stickers: m.stickers });
    G.Collectibles.resetAll(S().collect);
    G.UI.toast("A new day in the kampung! New missions are ready.", "good", 5200);
  }

  function onEvents(events) {
    events.forEach(function (ev) {
      if (ev.type === "due") onDue(ev.name);
      else if (ev.type === "qada") onQada(ev.name);
      else if (ev.type === "newday") onNewDay();
    });
  }

  /* ------------------------------ guidance ------------------------------ */

  function destination() {
    const ps = S().sim.prayer.state();
    if (!ps.flow && !ps.due && !ps.qada.length) return null;
    return ps.flow && ps.flow.phase === "pray" ? "mosque_hall" : "mosque_wudu";
  }

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

  function showWay() {
    F.guide = true;
    F.guideT = 0;
    F.expanded = false;
    if (F.card) F.card.el.classList.add("is-bar");
    liftHero(0);
    computeGuide();
    G.Audio.play("tap");
    G.UI.toast("Follow the green footprints to the mosque.", "good");
  }

  function clearGuide() {
    F.guide = false;
    F.guideDest = null;
    if (S().markers) G.Markers.showTrail(S().markers, null, S().world.heightAt);
  }

  /* ------------------------------ camera / hero ------------------------------ */

  function frameHero(spot, yawOff, dist) {
    const sheetH = G.UI.state.sheet ? G.UI.state.sheet.offsetHeight : 0;
    G.Camera.setFrame({
      target: { x: spot.x, y: spot.y, z: spot.z },
      yaw: spot.faceYaw + yawOff,
      pitch: 0.2,
      dist,
    });
    G.Camera.setShift(sheetH * 0.45);
  }

  function leaveScreen() {
    G.Camera.setFrame(null);
    G.Camera.setShift(0);
  }

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

  function refreshWudu() {
    if (!F.wui) return;
    G.PrayerUI.wuduUpdate(F.wui, wuduView());
    const step = S().sim.prayer.nextWuduStep();
    if (step) S().player.forcedPose = step.pose;
  }

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

  function wuduPick(i) {
    const info = S().sim.prayer.state().flow;
    if (!info || i === info.wuduIndex) return wuduAct();
    const want = S().sim.prayer.nextWuduStep();
    F.wudu.tried = i;
    F.wudu.hint =
      i < info.wuduIndex
        ? "You did that one already. Well done! Next: " + want.label + "."
        : "Nearly! Next comes: " + want.label + ". Take your time.";
    G.Audio.play("hint");
    refreshWudu();
  }

  function finishWudu() {
    G.UI.closeSheet("done");
    G.Audio.play("good");
    G.UI.toast("Wudu done. Now walk into the prayer hall.", "good", 5000);
    F.guide = true;
    computeGuide();
  }

  function openWudu(tap) {
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
    frameHero({ x: spot.x, y: spot.y, z: spot.z, faceYaw: Math.PI }, 0.6, 3.1);
  }

  function closeWudu() {
    F.wui = null;
    G.Player.release(S().player);
    leaveScreen();
  }

  /* ------------------------------ prayer steps ------------------------------ */

  function validTypes(prayer) {
    const next = prayer.nextPrayStep();
    if (!next) return [];
    const plan = KQ.Sim.Prayer.rakaatPlan(prayer.state().flow.name);
    const idx = plan.findIndex((s) => s.id === next.id);
    const out = [next.type];
    if (next.optional && plan[idx + 1]) out.push(plan[idx + 1].type);
    return out;
  }

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
      tried: F.pray.tried,
      hint: F.pray.hint,
      cue: F.pray.cue,
    };
  }

  function refreshPray() {
    if (F.pui) G.PrayerUI.prayUpdate(F.pui, prayView());
  }

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

  function hintFor(prayer) {
    const want = prayer.nextPrayStep();
    return want
      ? "Nearly! Next comes: " + want.label + ". Take your time."
      : "";
  }

  function openPray() {
    const P = S().player;
    const y = S().world.heightAt(HALL_SPOT.x, HALL_SPOT.z);
    G.Player.lock(P, { x: HALL_SPOT.x, y, z: HALL_SPOT.z, heading: HALL_SPOT.heading }, "idle");
    F.pray = { tried: null, cue: null, hint: "", seed: 0 };
    F.pui = G.PrayerUI.pray({ onPick: prayPick, onClose: closePray });
    refreshPray();
    frameHero({ x: HALL_SPOT.x, y, z: HALL_SPOT.z, faceYaw: Math.PI }, 0, 3.2);
  }

  function closePray() {
    F.pui = null;
    if (!F.completing) G.Player.release(S().player);
    leaveScreen();
  }

  function completePrayer(result) {
    const sim = S().sim;
    sim.economy.add(KQ.Sim.Economy.PRAYER_REWARD_COINS);
    const sticker = sim.missions.grantSticker(KQ.Sim.Missions.prayerSticker(result.name));
    F.completing = true;
    G.UI.closeSheet("done");
    F.completing = false;
    clearGuide();
    G.Audio.play("bell");
    S().player.forcedPose = "doa";
    const lines = [
      result.praise,
      "You earned " +
        KQ.Sim.Economy.PRAYER_REWARD_COINS +
        " coins" +
        (sticker ? " and a " + NAMES()[result.name] + " star sticker." : "."),
    ];
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
    frameHero({ x: HALL_SPOT.x, y: S().player.pos.y, z: HALL_SPOT.z, faceYaw: Math.PI }, 0, 3.2);
  }

  /* ------------------------------ entry points ------------------------------ */

  function startable() {
    const ps = S().sim.prayer.state();
    if (ps.flow) return ps.flow.name;
    if (ps.due) return ps.due;
    return ps.qada.length ? ps.qada[0].name : null;
  }

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

  function syncBarClass() {
    const bar = Boolean(F.card && !F.card.el.hidden && F.card.el.classList.contains("is-bar"));
    S().root.classList.toggle("kq-azan-bar", bar);
  }

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
    resume,
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
