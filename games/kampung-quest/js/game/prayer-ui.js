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

  /** Which prayer panel to build: 'side' on wide screens, 'bottom' sheet otherwise. */
  function panelVariant() {
    return wantsSide() ? "side" : "bottom";
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
        say(host.title.textContent + ". Call to prayer. Your mission waits until you have prayed.");
        host.saidAt = Date.now();
      }
      if (expanded) autoCollapse(host);
      else clearTimeout(host.collapseTimer);
      wasShown = shown;
      G.HudLayout.measure();
      G.HudLayout.fitTalk();
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
    host.go = G.UI.btn("Show me the way", { cls: "primary kq-big", icon: "mosque", onClick: on });
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

  /**
   * Build one numbered wudu step tile (picture + short label) that reports its index when pressed.
   */
  function wuduTile(step, i, onPick) {
    const num = U.el("i", { cls: "kq-tile-num", text: String(i + 1) });
    return U.el(
      "button",
      {
        type: "button",
        cls: "kq-wtile",
        "data-i": String(i),
        "aria-label": "Step " + (i + 1) + ": " + step.label,
        on: { click: () => onPick(i) },
      },
      num,
      G.Pictures.wudu(step.id, 40),
      U.el("span", { cls: "kq-small", text: shortWudu(step) }),
    );
  }

  const SHORT = {
    niat: "Niat",
    hands: "Hands",
    mouth: "Mouth",
    nose: "Nose",
    face: "Face",
    arm_r: "Right arm",
    arm_l: "Left arm",
    head: "Head",
    ears: "Ears",
    foot_r: "Right foot",
    foot_l: "Left foot",
    doa: "Doa",
  };
  /** The short label a wudu tile shows, falling back to the step's full label. */
  function shortWudu(step) {
    return SHORT[step.id] || step.label;
  }

  /** Build the row of all wudu step tiles, in the correct order. */
  function wuduRow(onPick) {
    const row = U.el("div", { cls: "kq-wudu-row", role: "list" });
    KQ.Sim.Prayer.WUDU_STEPS.forEach((s, i) =>
      row.appendChild(U.el("div", { role: "listitem" }, wuduTile(s, i, onPick))),
    );
    return row;
  }

  /** Wudu screen. h: { onPick(i), onAct(), onClose() } */
  function wudu(h) {
    const row = wuduRow(h.onPick);
    const info = U.el("p", { cls: "kq-wudu-info", text: "" });
    const hint = U.el("p", { cls: "kq-note", role: "status", text: "" });
    const cue = {};
    const cueBox = U.el("div", { cls: "kq-pcue kq-wudu-cue" }, captionLines(cue));
    const act = G.UI.btn("Splash!", {
      cls: "primary kq-big kq-wudu-act",
      icon: "star",
      onClick: h.onAct,
    });
    const title = U.el("h2", { cls: "kq-sheet-title", text: "" });
    const head = U.el(
      "div",
      { cls: "kq-sheet-head" },
      title,
      G.UI.btn("Not now", { icon: "close", onClick: () => G.UI.closeSheet("button") }),
    );
    const box = U.el(
      "div",
      { cls: "kq-menu kq-prayer-sheet" },
      head,
      row,
      U.el("div", { cls: "kq-wudu-foot" }, act, info),
      hint,
      cueBox,
    );
    const handle = G.UI.openSheet({
      el: box,
      label: "Wudu steps",
      variant: panelVariant(),
      scrim: false,
      onClose: h.onClose,
      focus: ".kq-wudu-act",
    });
    return { handle, row, info, hint, act, title, cue };
  }

  const ACT_WORD = { niat: "Say niat", head: "Wipe", ears: "Wipe", doa: "Say doa" };

  /** Refresh the wudu screen. v: { index, taps, step, total, hint } */
  function wuduUpdate(ui, v) {
    const tiles = ui.row.querySelectorAll(".kq-wtile");
    tiles.forEach(function (t, i) {
      t.classList.toggle("is-done", i < v.index);
      t.classList.toggle("is-now", i === v.index);
      t.classList.toggle("is-tried", v.tried === i);
    });
    const cur = tiles[v.index];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest", inline: "center" });
    ui.title.textContent =
      "Wudu at the mosque taps · step " + Math.min(v.index + 1, v.total) + " of " + v.total;
    const word = ACT_WORD[v.step.id] || (v.step.count > 1 ? "Splash!" : "Splash!");
    const count = v.step.count > 1 ? " (" + (v.taps + 1) + " of " + v.step.count + ")" : "";
    ui.act.lastChild.textContent = word + count;
    ui.info.textContent = v.step.label + " · " + v.step.labelMs;
    ui.hint.textContent = v.hint || "";
    setCue(ui.cue, v.step.id === "doa" ? T().DHIKR.doa : {});
    if (ui.said !== v.index) {
      ui.said = v.index;
      say("Step " + Math.min(v.index + 1, v.total) + " of " + v.total + ": " + v.step.label);
    }
  }

  /**
   * Build one prayer posture tile (picture, name, keyboard number) that reports its type when
   * pressed.
   */
  function postureTile(type, i, onPick) {
    const t = T().TILE[type];
    return U.el(
      "button",
      {
        type: "button",
        cls: "kq-ptile",
        "data-type": type,
        "aria-label": t[0] + ", " + t[1] + ". Key " + (i + 1),
        on: { click: () => onPick(type) },
      },
      U.el("i", { cls: "kq-tile-num", text: String(i + 1) }),
      G.Pictures.posture(t[2], 84),
      U.el("b", { text: t[0] }),
      U.el("span", { cls: "kq-small", text: t[1] }),
    );
  }

  /** Prayer steps screen. h: { onPick(type), onClose() } */
  function pray(h) {
    const row = U.el("div", { cls: "kq-prow" });
    const dots = U.el("div", { cls: "kq-dots", role: "img" });
    const title = U.el("h2", { cls: "kq-sheet-title", text: "" });
    const head = U.el(
      "div",
      { cls: "kq-sheet-head" },
      title,
      dots,
      G.UI.btn("Not now", { icon: "close", onClick: () => G.UI.closeSheet("button") }),
    );
    const cue = {};
    const cueBox = U.el("div", { cls: "kq-pcue" }, captionLines(cue));
    const hint = U.el("p", { cls: "kq-note", role: "status", text: "" });
    const side = U.el("div", { cls: "kq-pside" }, cueBox, hint);
    const body = U.el("div", { cls: "kq-pbody" }, row, side);
    const box = U.el("div", { cls: "kq-menu kq-prayer-sheet" }, head, body);
    const handle = G.UI.openSheet({
      el: box,
      label: "Prayer steps",
      variant: panelVariant(),
      scrim: false,
      onClose: h.onClose,
      focus: ".kq-ptile",
    });
    return { handle, row, dots, title, cue, hint, onPick: h.onPick };
  }

  /** Refresh. v: { name, kind, rakaat, total, choices:[type], tried, hint, cue } */
  function prayUpdate(ui, v) {
    const label = KQ.Sim.Prayer.DISPLAY[v.name] + (v.kind === "qada" ? " (make-up)" : "");
    ui.title.textContent = label + " · raka'at " + v.rakaat + " of " + v.total + "";
    ui.dots.setAttribute("aria-label", "Raka'at " + v.rakaat + " of " + v.total);
    U.clear(ui.dots);
    for (let i = 1; i <= v.total; i += 1) {
      ui.dots.appendChild(
        U.el("span", {
          cls: "kq-dot" + (i < v.rakaat ? " is-done" : i === v.rakaat ? " is-now" : ""),
          text: String(i),
        }),
      );
    }
    U.clear(ui.row);
    v.choices.forEach((type, i) => {
      const tile = postureTile(type, i, ui.onPick);
      if (v.tried === type) tile.classList.add("is-tried");
      ui.row.appendChild(tile);
    });
    if (v.cue) setCue(ui.cue, v.cue);
    ui.hint.textContent = v.hint || "";
    const sig = v.rakaat + "|" + (v.cue ? v.cue.en : "");
    if (ui.said !== sig) {
      ui.said = sig;
      say(label + ", raka'at " + v.rakaat + " of " + v.total + ". " + (v.cue ? v.cue.en : ""));
    }
    const first = ui.row.querySelector(".kq-ptile");
    if (first && !ui.row.contains(document.activeElement)) first.focus({ preventScroll: true });
  }

  /**
   * The day card's kind, no-pressure sentence for the current prayer state (in flow, due, qada or
   * all on time).
   */
  function dayMessage(ps) {
    const D = KQ.Sim.Prayer.DISPLAY;
    if (ps.flow)
      return "You are in the middle of " + D[ps.flow.name] + ". Walk to the mosque to carry on.";
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
   * Build the day card's buttons: 'Show me the way' or the qada prayer when there is something to
   * do, else Close.
   */
  function dayButtons(ps, o) {
    const acts = U.el("div", { cls: "kq-bubble-actions" });
    const go = (fn) => () => (G.UI.closeSheet("choice"), fn());
    const D = KQ.Sim.Prayer.DISPLAY;
    if (ps.flow || ps.due) {
      acts.appendChild(
        G.UI.btn("Show me the way", { cls: "primary", icon: "mosque", onClick: go(o.onWay) }),
      );
    } else if (ps.qada.length) {
      const name = ps.qada[0].name;
      const label = "Pray " + D[name] + " (qada) now";
      acts.appendChild(
        G.UI.btn(label, { cls: "primary", icon: "mosque", onClick: go(() => o.onQada(name)) }),
      );
    }
    const later = ps.due || ps.qada.length ? "Later" : "Close";
    acts.appendChild(G.UI.btn(later, { icon: "close", onClick: () => G.UI.closeSheet("button") }));
    return acts;
  }

  /** The prayer day card (dock Pray). o: { sim, onWay, onQada(name), onClose } */
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
