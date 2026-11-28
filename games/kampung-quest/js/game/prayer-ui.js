/* ============================================================================
 * FILE: prayer-ui.js
 * PURPOSE: The prayer screens of design D: the azan card with live captions, the wudu steps
 *          screen (numbered picture tiles + one big action button), the prayer steps screen
 *          (posture pictures, raka'at dots, dhikr caption, gentle hint), the prayer day card with
 *          the qada ("make it up") option, and the completion card.
 * BUSINESS CONTEXT: AC-7 (captions: Arabic, transliteration, English), AC-8 (wudu in the correct
 *   order, raka'at counts, a wrong tap is a gentle hint, no fail state), AC-9 (qada card with gentle
 *   copy). Hints never use red, a cross or a score.
 * DEPENDENCIES: ui-core.js, pictures.js, prayer-text.js, ui-screens.js (day strip).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const T = () => G.PrayerText;

  /** A side panel on wide screens (the hero stays centred in the rest), a bottom sheet otherwise. */
  function wantsSide() {
    return window.innerWidth >= 700 && window.innerHeight >= 340;
  }

  /**
   * Create the Arabic, transliteration and English caption paragraphs on a host and return them in
   * order.
   */
  function captionLines(host) {
    host.ar = U.el("p", { cls: "kq-ar", lang: "ar", dir: "rtl", text: "" });
    host.tr = U.el("p", { cls: "kq-tr", lang: "ms-Latn", text: "" });
    host.en = U.el("p", { cls: "kq-en", text: "" });
    return [host.ar, host.tr, host.en];
  }

  const SAY_GAP_MS = 4000;
  const COLLAPSE_MS = 9000;

  /** Tell screen readers (polite, own region so toasts never cut it off). */
  function say(text) {
    if (text) G.UI.announce(text, "caption");
  }

  /** Announce the azan caption phrase, at most once every few seconds (the latest one wins). */
  function sayCue(host, text) {
    if (!host.el || host.el.hidden || !text) return;
    const wait = SAY_GAP_MS - (Date.now() - (host.saidAt || 0));
    host.pendingSay = text;
    if (wait <= 0) return flushCue(host);
    if (!host.sayTimer) host.sayTimer = setTimeout(() => flushCue(host), wait);
  }

  /** Speak the pending caption now to screen readers and record when, to pace the next one. */
  function flushCue(host) {
    host.sayTimer = null;
    if (!host.pendingSay || host.el.hidden) return;
    host.saidAt = Date.now();
    say(host.pendingSay);
    host.pendingSay = "";
  }

  /**
   * Show a cue's Arabic, transliteration and English lines on a host and announce its English
   * phrase.
   */
  function setCue(host, cue) {
    host.ar.textContent = cue.ar || "";
    host.tr.textContent = cue.translit || cue.tr || "";
    host.en.textContent = cue.en || "";
    sayCue(host, cue.en);
  }

  /** On a phone the expanded card shrinks to the caption pill by itself, so it never hides the controls. */
  function autoCollapse(host) {
    clearTimeout(host.collapseTimer);
    const compact = window.matchMedia(
      "(max-height: 520px), (orientation: portrait) and (max-width: 700px)",
    );
    if (!compact.matches) return;
    host.collapseTimer = setTimeout(function () {
      if (!host.el.hidden) G.PrayerFlow.collapse();
    }, COLLAPSE_MS);
  }

  /** React to the card being shown: announce it once and start the auto-collapse timer. */
  function watchCard(host) {
    let wasShown = false;
    new MutationObserver(function () {
      const shown = !host.el.hidden;
      const expanded = shown && !host.el.classList.contains("is-bar");
      if (shown && !wasShown) {
        const title = host.title.textContent.replace(/[.!?\s]+$/, ""); // it already ends in "pray."
        say(title + ". Call to prayer. Your mission waits until you have prayed.");
        host.saidAt = Date.now();
      }
      if (expanded) autoCollapse(host);
      else clearTimeout(host.collapseTimer);
      wasShown = shown;
      G.HudLayout.measure();
    }).observe(host.el, { attributes: true, attributeFilter: ["hidden", "class"] });
  }

  /** The azan card (a HUD overlay, not a modal: the player can keep walking). */
  function azanCard(on) {
    const host = {};
    host.title = U.el("h3", { cls: "kq-azan-title", text: "" });
    host.sub = U.el("p", {
      cls: "kq-small kq-azan-sub",
      text: "Your mission waits (paused) until you have prayed.",
    });
    host.go = G.UI.btn("Pray", {
      cls: "primary kq-big",
      icon: "mosque",
      label: "Pray",
      onClick: on,
    });
    host.body = U.el("div", { cls: "kq-azan-cues" }, captionLines(host));
    host.el = U.el(
      "section",
      {
        cls: "kq-glass kq-azan",
        id: "kqAzan",
        role: "region",
        "aria-label": "Call to prayer",
        hidden: true,
      },
      host.title,
      host.sub,
      host.body,
      host.go,
    );
    watchCard(host);
    return host;
  }

  /** The wudu step's reminder line: how many times, and whether this part is a must (fard) or sunnah. */
  function wuduHow(step) {
    const lines = [step.labelMs];
    if (step.count > 1) lines.push("Do this " + step.count + " times.");
    lines.push(step.fard ? "This part of wudu is a must (fard)." : "This part of wudu is sunnah.");
    return lines;
  }

  const ACT_WORD = { niat: "Say niat", head: "Wipe", ears: "Wipe", doa: "Say doa" };
  const VIEW_BUTTON = { id: "view", label: "Change view", icon: "refresh" };

  /** Wudu stepper. h: { onAct(), onView(), onClose() }. One card per wudu step; Next is one wash. */
  function wudu(h) {
    const ctl = G.RitualUI.open({
      label: "Wudu steps",
      onNext: h.onAct,
      onExtra: () => h.onView(),
      onClose: h.onClose,
    });
    return { ctl, handle: ctl.handle };
  }

  /** Refresh the wudu stepper. v: { index, total, taps, step } (the sim's current wudu step and the washes so far). */
  function wuduUpdate(ui, v) {
    const step = v.step;
    const word = ACT_WORD[step.id] || "Splash!";
    const count = step.count > 1 ? " (" + (v.taps + 1) + " of " + step.count + ")" : "";
    const card = {
      key: "wudu-" + v.index,
      kicker: "Wudu at the mosque taps · step " + Math.min(v.index + 1, v.total) + " of " + v.total,
      index: v.index,
      total: v.total,
      picture: G.Pictures.wudu(step.id, 72),
      title: step.label,
      how: wuduHow(step),
      texts: T().wuduTexts(step.id),
      next: { label: word + count, cls: "kq-wudu-act" },
      chip: {
        name: "Wudu",
        count: Math.min(v.index + 1, v.total) + "/" + v.total,
        cue: step.label,
      },
      extras: [VIEW_BUTTON],
    };
    if (step.count > 1)
      card.counter = { count: v.taps, target: step.count, unit: "wash", unitLabel: "Done" };
    ui.ctl.show(card);
  }

  /** Prayer stepper. h: { onPick(type), onClose() }. One card per posture; Next takes the posture. */
  function pray(h) {
    const ui = { pick: h.onPick, want: null };
    ui.ctl = G.RitualUI.open({
      label: "Prayer steps",
      onNext: () => ui.pick(ui.want[0]),
      onExtra: (id) => (id === "view" ? h.onView() : ui.pick(ui.want[1])),
      onClose: h.onClose,
    });
    ui.handle = ui.ctl.handle;
    return ui;
  }

  /**
   * Refresh the prayer stepper. v: { name, kind, rakaat, total, stepId, want:[type] } where want[0]
   * is the posture to take now (and want[1], when an optional step is up, the one after it).
   */
  function prayUpdate(ui, v) {
    ui.want = v.want;
    const type = v.want[0];
    const tile = T().TILE[type] || T().TILE.qiyam;
    const label = T().flowLabel(v.name, v.kind);
    const card = {
      key: "pray-" + v.stepId,
      kicker: label + " · raka'at " + v.rakaat + " of " + v.total,
      index: v.rakaat - 1,
      total: v.total,
      picture: G.Pictures.posture(tile[2], 112),
      title: tile[0] + " (" + tile[1].toLowerCase() + ")",
      how: [T().howFor(type)],
      texts: T().cardTexts(type, v.rakaat),
      next: { label: "Next", cls: "kq-pray-next" },
      chip: { name: "Rakaat", count: v.rakaat + "/" + v.total, cue: "Now: " + tile[0] },
      extras: (v.want.length > 1 ? [{ id: "skip", label: "Skip this" }] : []).concat(VIEW_BUTTON),
    };
    ui.ctl.show(card);
  }

  /**
   * The day card's kind, no-pressure sentence for the current prayer state (in flow, due, qada or
   * all on time).
   */
  function dayMessage(ps) {
    const D = KQ.Sim.Prayer.DISPLAY;
    if (ps.flow)
      return (
        "You are in the middle of " +
        T().flowLabel(ps.flow.name, ps.flow.kind) +
        ". Walk to the mosque to carry on."
      );
    if (ps.due) return D[ps.due] + " is ready. Let's go to the mosque together.";
    if (ps.qada.length) {
      return (
        D[ps.qada[0].name] +
        " is waiting to be made up (qada). You were busy, and that is okay. You can pray it now or any time. No rush."
      );
    }
    const next = ps.next ? D[ps.next.name] + " at " + KQ.PRAYER_TIMES[ps.next.name] : "tomorrow";
    return "All prayers are on time. Next: " + next + ".";
  }

  /**
   * Build the day card's buttons: one "Pray" (a little extra when nothing is owed) that always does
   * the next right thing, and a way out.
   */
  function dayButtons(ps, o) {
    const acts = U.el("div", { cls: "kq-bubble-actions" });
    const owed = ps.flow || ps.due || ps.qada.length;
    acts.appendChild(
      G.UI.btn(owed ? "Pray" : "Pray a little extra", {
        cls: "primary kq-pray-here",
        icon: "mosque",
        onClick: () => (G.UI.closeSheet("choice"), o.onPray()),
      }),
    );
    acts.appendChild(
      G.UI.btn(owed ? "Later" : "Close", {
        icon: "close",
        onClick: () => G.UI.closeSheet("button"),
      }),
    );
    return acts;
  }

  /** The prayer day card (dock Pray). o: { sim, onPray, onClose } */
  function dayCard(o) {
    const ps = o.sim.prayer.state();
    const msg = dayMessage(ps);
    const read = G.UI.readButton(() => msg);
    const box = U.el(
      "div",
      { cls: "kq-menu kq-card" },
      G.UI.header("Prayer", { extras: [read], close: false }),
      G.Screens.dayStrip(o.sim),
      U.el("p", { cls: "kq-note", text: msg }),
      dayButtons(ps, o),
    );
    return G.UI.openSheet({
      el: box,
      label: "Prayer",
      onClose: o.onClose,
      focus: ".kq-bubble-actions button",
    });
  }

  G.PrayerUI = {
    wantsSide,
    azanCard,
    setCue,
    wudu,
    wuduUpdate,
    pray,
    prayUpdate,
    dayCard,
  };
})((window.KQ = window.KQ || {}));
