/* ============================================================================
 * FILE: ritual-flow.js
 * PURPOSE: The controller of the Umrah, Hajj and Ziarah steppers: opens a rite from the dock,
 *          turns the sim's current step into a card, handles Next / Back / Go there / Walk for me /
 *          Put on ihram / Trim / Shave, counts rounds and legs, and keeps a small chip on screen
 *          while the hero walks the rite by hand.
 * BUSINESS CONTEXT: AC-H3, H4, H5. Walking is always optional: Next works, "Go there" moves the
 *   hero (when the region can), "Walk for me" walks the hero and counts, and walking by hand counts
 *   too. No fail state: Next / Back / Not now always work.
 * DEPENDENCIES: KQ.Sim.Umrah (order, counters), ritual-ui.js, ritual-trek.js, ritual-look.js,
 *   KQ.RITUAL_TEXT, optional KQ.Holy.goTo(siteKey) from the region.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const S = () => G.S;
  const U = () => KQ.Sim.Umrah;
  const RF = { rite: null, ctl: null, chip: null, step: null, chooser: null, hint: "" };

  const umrah = () => S().sim.umrah;
  /** Can "Go there" work? Only when the region provides KQ.Holy.goTo. */
  const canGo = () => Boolean(KQ.Holy && typeof KQ.Holy.goTo === "function");

  /** The ritual text items (with their id) for a list of text ids; unknown ids are left out. */
  function textItems(ids) {
    const all = KQ.RITUAL_TEXT || {};
    return ids.filter((id) => all[id]).map((id) => Object.assign({ id }, all[id]));
  }

  /* ------------------------------ cards ------------------------------ */

  /** The label of the big button: "+1 round" while counting, "Next", or the last card's closing word. */
  function nextLabel(v) {
    if (v.target && !v.full) return "+1 " + v.step.counter.unit;
    return v.last ? "Alhamdulillah!" : "Next";
  }

  /** The extra buttons a step offers (ihram clothes, walk for me / walk myself, haircut choice). */
  function extrasFor(v) {
    const st = v.step;
    const out = [];
    if (st.leave && st.leave.wear)
      out.push({
        id: "wear",
        label: umrah().ihram ? "Ihram is on" : "Put on ihram",
        icon: "hand",
        on: umrah().ihram,
      });
    if (st.walk) {
      const auto = G.RitualTrek.isAuto();
      out.push({
        id: "auto",
        label: auto ? "Stop walking" : "Walk for me",
        icon: "play",
        on: auto,
      });
      out.push({ id: "self", label: "I'll walk myself", icon: "run" });
    }
    if (st.haircut) {
      out.push({ id: "trim", label: "Trim", icon: "scissors", on: umrah().cut === "trim" });
      out.push({ id: "shave", label: "Shave", icon: "scissors", on: umrah().cut === "shave" });
    }
    return out;
  }

  /** Where the walking rites say to go and what they mean, plus the gentle "what next" hint, as a calm extra line under the card. */
  function noteFor(v) {
    const hint = v.step.walk ? G.RitualTrek.hint() : "";
    if (v.step.walk === "sai") {
      const leg = KQ.Sim.RitualWalk.saiLeg(Math.min(v.count + 1, v.target));
      const line = v.full
        ? "All 7 legs done, ending at Marwa."
        : "Leg " + (v.count + 1) + ": " + cap(leg.from) + " to " + cap(leg.to) + ".";
      return v.full || !hint ? line : line + " " + hint;
    }
    return hint;
  }

  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  /** The card for the rite's current step. */
  function card(rite) {
    const v = umrah().view(rite);
    const st = v.step;
    const c = {
      key: rite + "-" + st.id,
      kicker: U().TITLES[rite] + " · step " + (v.index + 1) + " of " + v.total,
      index: v.index,
      total: v.total,
      emoji: st.emoji,
      title: st.title,
      how: st.how,
      texts: textItems(st.texts),
      next: { label: nextLabel(v), cls: "kq-rite-next", icon: v.last ? "check" : null },
      canBack: v.index > 0,
      go: Boolean(st.site) && canGo(),
      extras: extrasFor(v),
      note: noteFor(v),
    };
    if (v.target)
      c.counter = {
        count: v.count,
        target: v.target,
        unit: st.counter.unit,
        plural: st.counter.plural,
      };
    return c;
  }

  /** Redraw the card (if open) and the chip, and tell the HUD the mission-card line changed. */
  function refresh() {
    if (RF.rite) G.RitualTrek.sync(umrah().view(RF.rite).count); // the hint follows the card's count
    if (RF.ctl && RF.rite) RF.ctl.show(card(RF.rite));
    syncChip();
    S().hudDirty = true;
  }

  /* ------------------------------ counting ------------------------------ */

  /** A round / leg / pebble was counted (walked or tapped): sound, a word of cheer, and the stepper if it was closed. */
  function counted(before, v) {
    G.Audio.play(v.full ? "good" : "tap");
    const unit = v.step.counter.unit;
    if (v.full)
      G.UI.toast(v.target + " " + v.step.counter.plural + " done! Press Next.", "good", 4200);
    else if (v.step.walk === "tawaf")
      G.UI.toast("Bismillah, Allahu akbar! " + cap(unit) + " " + v.count + " done.", "good", 2600);
    else if (before !== v.count)
      G.UI.toast(cap(unit) + " " + v.count + " of " + v.target + ".", "good", 1800);
    if (v.full && !RF.ctl) reopen();
  }

  /** The tracker (or auto-walk) says n rounds / legs are walked: raise the counter and cheer. */
  function onWalked(n) {
    if (!RF.rite) return;
    const before = umrah().view(RF.rite).count;
    if (umrah().setAtLeast(RF.rite, n) === before) return;
    counted(before, umrah().view(RF.rite));
    refresh();
  }

  /** Watch the hero for a walking step, or stop watching on any other step. */
  function enterStep() {
    const v = umrah().view(RF.rite);
    const id = v.step.id;
    if (RF.step === id) return;
    RF.step = id;
    G.RitualLook.cancel();
    if (v.step.walk) G.RitualTrek.track(v.step.walk, v.count, v.target, onWalked);
    else G.RitualTrek.stop();
  }

  /* ------------------------------ buttons ------------------------------ */

  /** Next: one more on a counter, else the next step; the last card finishes the rite. */
  function onNext() {
    const rite = RF.rite;
    const res = umrah().next(rite);
    if (res.done) return finish(rite);
    if (res.counted) counted(res.view.count - 1, res.view);
    if (res.moved) {
      G.Audio.play("pose");
      G.RitualLook.sync();
    }
    enterStep();
    refresh();
  }

  /** Back: the earlier card (shown as done). */
  function onBack() {
    umrah().back(RF.rite);
    G.RitualTrek.stopAuto();
    enterStep();
    refresh();
  }

  /** Go there: move the hero to the place of this step (the region's job), then redraw. */
  function onGo() {
    const st = umrah().view(RF.rite).step;
    if (!st.site || !canGo()) return;
    KQ.Holy.goTo(st.site, {
      onDone() {
        G.UI.toast("Here we are: " + st.title + ".", "good", 2600);
        refresh();
      },
    });
  }

  /** The extra buttons: ihram, walk for me, walk myself, trim, shave. */
  function onExtra(id) {
    if (id === "wear") return wearIhram();
    if (id === "auto") return toggleAuto();
    if (id === "self") return walkMyself();
    if (id === "trim" || id === "shave") return cutHair(id);
  }

  /** Put the ihram clothes on (Next does it too). */
  function wearIhram() {
    G.RitualLook.wear(true);
    G.Audio.play("pose");
    G.UI.toast("Ihram is on: two white cloths. No cap, simple sandals.", "good", 3600);
    refresh();
  }

  /** Walk for me: start or stop the auto-walk of the tawaf / sa'i. */
  function toggleAuto() {
    if (G.RitualTrek.isAuto()) {
      G.RitualTrek.stopAuto();
      return refresh();
    }
    const v = umrah().view(RF.rite);
    const kind = v.step.walk;
    if (!kind || v.full) return;
    G.RitualTrek.auto(kind, v.count, v.target, onWalked, () => {
      G.UI.toast("Walked! Press Next.", "good", 3000);
      refresh();
    });
    refresh();
  }

  /** "I'll walk myself": close the card so the hero can walk; the chip brings it back. */
  function walkMyself() {
    G.UI.toast(
      "Walk it yourself. Tap the button at the bottom to open the steps again.",
      "hint",
      4200,
    );
    RF.ctl.close("self");
  }

  /** Trim or shave at the salon: the hero sits and the haircut scene plays. */
  function cutHair(kind) {
    G.RitualLook.haircut(kind, refresh);
    refresh();
  }

  /* ------------------------------ open / close ------------------------------ */

  /** The rite is finished: close the card, cheer, show the hero in normal clothes. */
  function finish(rite) {
    G.Audio.play("bell");
    G.RitualTrek.stop();
    RF.hint = "";
    G.RitualLook.sync();
    const ctl = RF.ctl;
    RF.rite = null;
    RF.step = null;
    removeChip();
    if (ctl) ctl.close("done");
    G.UI.toast(U().TITLES[rite] + " complete. Alhamdulillah!", "good", 6000);
    S().hudDirty = true;
  }

  /** The card closed. "Not now" keeps the rite (a chip brings it back); finishing already cleaned up. */
  function onClose(reason) {
    RF.ctl = null;
    G.UI.announce("", "caption");
    G.RitualTrek.stopAuto();
    G.RitualLook.cancel();
    if (RF.rite && reason !== "done") syncChip();
  }

  /** Open a rite ("umrah" | "hajj" | "ziarah") at its current step. */
  function open(rite) {
    if (!S() || !S().started || RF.ctl || !U().RITES.includes(rite)) return false;
    if (S().player.locked || G.PrayerFlow.screenOpen()) return false;
    umrah().start(rite);
    RF.rite = rite;
    RF.step = null;
    RF.ctl = G.RitualUI.open({
      label: U().TITLES[rite] + " steps",
      onNext,
      onBack,
      onGo,
      onExtra,
      onClose,
    });
    enterStep();
    refresh();
    return true;
  }

  /** Bring the card back from the chip. */
  function reopen() {
    if (RF.rite && !RF.ctl) open(RF.rite);
  }

  /* ------------------------------ chip + chooser ------------------------------ */

  /** Remove the minimised chip. */
  function removeChip() {
    if (RF.chip) RF.chip.remove();
    RF.chip = null;
  }

  /** Show the chip (a button with the current step) while a rite is under way and its card is closed. */
  function syncChip() {
    const summary = umrah().summary();
    if (RF.ctl || !RF.rite || !summary) return removeChip();
    const hint = G.RitualTrek.hint();
    const text = hint ? summary + ". " + hint : summary;
    if (!RF.chip) {
      RF.chip = G.UI.btn(text, { cls: "primary kq-ritual-chip", icon: "mosque", onClick: reopen });
      S().hudHost.appendChild(RF.chip);
    }
    RF.chip.lastChild.textContent = text;
  }

  /** One big chooser button: the rite's name and where it is up to. */
  function riteButton(rite) {
    const v = umrah().view(rite);
    const where = v.done
      ? "Done! Do it again"
      : v.index === 0 && !v.count
        ? "Start"
        : "Step " + (v.index + 1) + " of " + v.total;
    const b = G.UI.btn(U().TITLES[rite] + " · " + where, {
      cls: "primary kq-big kq-rite-btn",
      icon: "mosque",
      onClick: () => (G.UI.closeSheet("choice"), open(rite)),
    });
    b.setAttribute("data-rite", rite);
    return b;
  }

  /** The dock's "Umrah, Hajj, Ziarah" chooser. */
  function openMenu() {
    if (RF.ctl) return RF.ctl.handle;
    const acts = G.U.el("div", { cls: "kq-rite-list" }, U().RITES.map(riteButton));
    const box = G.U.el(
      "div",
      { cls: "kq-menu kq-card" },
      G.UI.header("Umrah, Hajj and Ziarah"),
      G.U.el("p", {
        cls: "kq-note",
        text: "Pick one. Each is a few easy steps, and the Next button does everything.",
      }),
      acts,
    );
    return G.UI.openSheet({ el: box, label: "Rites", focus: ".kq-rite-btn" });
  }

  /** Per frame: the walking counter / auto-walk, then the word-by-word auto-advance. */
  function update(dt) {
    G.RitualTrek.update(dt);
    G.RitualUI.tick(dt);
    const hint = G.RitualTrek.hint();
    if (hint !== RF.hint) {
      RF.hint = hint;
      if (RF.rite) refresh(); // only when the sentence changes: a few times a round
    }
  }

  /** A plain description for tests: where the rite is, the counter, ihram, the haircut and the walkers. */
  function debug() {
    const u = S() && S().sim && S().sim.umrah;
    const v = u && RF.rite ? u.view(RF.rite) : null;
    return {
      rite: RF.rite,
      open: Boolean(RF.ctl),
      chip: Boolean(RF.chip),
      step: v ? v.step.id : null,
      index: v ? v.index : null,
      count: v ? v.count : null,
      target: v ? v.target : null,
      done: v ? v.done : null,
      ihram: u ? u.ihram : false,
      cut: u ? u.cut : "none",
      auto: G.RitualTrek.isAuto(),
      tracking: G.RitualTrek.mode(),
      hint: G.RitualTrek.hint(),
      guide: G.RitualGuide.debug(),
      cutting: G.RitualLook.isCutting(),
    };
  }

  G.RitualFlow = {
    open,
    openMenu,
    reopen,
    update,
    debug,
    summary: () => (umrah() ? umrah().summary() : null),
  };
})((window.KQ = window.KQ || {}));
