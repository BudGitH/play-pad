/* ============================================================================
 * FILE: ritual-ui.js
 * PURPOSE: The one-card-at-a-time stepper that every guided task uses: Umrah, Hajj, Ziarah, wudu,
 *          each prayer posture and eating. One card = a picture or emoji, a short title, a few
 *          kid-friendly lines, the words to say (Arabic, transliteration, meaning) shown WORD BY
 *          WORD, a counter, and ONE big Next button.
 * BUSINESS CONTEXT: AC-H8 (frame by frame, item by item, word by word; surahs shown in full and
 *   scrollable) and AC-H3 (a counter with a big "+1 round" tap). There is no way to fail here: Next
 *   always works, Back always works, "Not now" always closes.
 * DEPENDENCIES: ui-core.js (sheets), util.js, pictures.js, KQ.Sim.Recite. Text only through textContent.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const R = () => KQ.Sim.Recite;
  const el = U.el;

  /** A side panel on wide screens (the hero stays centred in the rest), a bottom sheet otherwise. */
  function variant() {
    return window.innerWidth >= 700 && window.innerHeight >= 340 ? "side" : "bottom";
  }

  /**
   * Slide the picture so the hero stays in the free part of the screen beside the open panel (to
   * the left of a side panel, above a bottom sheet). No panel: no shift.
   */
  function fitShift() {
    const box = G.UI.state.sheet;
    const tucked = G.RitualUI.active && G.RitualUI.active.minimised; // a chip leaves the hero centred
    if (!box || tucked) return G.Camera.setShift(0, 0);
    const side = box.parentElement.classList.contains("kq-sheet-side");
    if (side) G.Camera.setShift(0, box.offsetWidth * 0.5);
    else G.Camera.setShift(box.offsetHeight * 0.5, 0);
  }

  /** Arabic text span: right to left, language-tagged so screen readers pick the right voice. */
  function arabic(text, cls) {
    return el("span", { cls: cls || "kq-ar", lang: "ar", dir: "rtl", text });
  }

  /* ------------------------------ word by word ------------------------------ */

  /** One tappable word: the Arabic on top, the transliteration under it. */
  function wordButton(w, i, onPick) {
    return el(
      "button",
      {
        type: "button",
        cls: "kq-word",
        "data-i": String(i),
        "aria-label": "Word " + (i + 1) + ": " + w.tr,
        on: { click: () => onPick(i) },
      },
      arabic(w.ar, "kq-w-ar"),
      el("span", { cls: "kq-w-tr", text: w.tr }),
    );
  }

  /** Mark which word is now (aria-current), which were said and scroll the current one into view. */
  function markWords(box, index) {
    box.querySelectorAll(".kq-word").forEach(function (b, i) {
      b.classList.toggle("is-now", i === index);
      b.classList.toggle("is-said", i < index);
      if (i === index) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    const cur = box.querySelector(".kq-word.is-now");
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /** The text the full panel shows: every line with its Arabic, transliteration and meaning. */
  function fullPanel(item) {
    const box = el("div", {
      cls: "kq-full",
      tabindex: "0",
      role: "region",
      "aria-label": "Full text of " + item.title,
    });
    item.lines.forEach(function (ln) {
      box.appendChild(
        el(
          "div",
          { cls: "kq-full-line" },
          arabic(ln.ar),
          el("p", { cls: "kq-tr", text: ln.tr }),
          el("p", { cls: "kq-en", text: ln.en }),
        ),
      );
    });
    return box;
  }

  /**
   * The word-by-word block for one text: the words, the meaning of the current line, the
   * Back / Next word / Auto / Show full text controls. `rs` is the reading state kept across redraws:
   * { cursor, auto, full }.
   */
  function reciteBlock(item, rs) {
    const words = R().wordsOf(item);
    if (!rs.cursor || rs.cursor.total !== words.length) rs.cursor = R().create(words.length);
    const row = el("div", { cls: "kq-words", dir: "rtl", role: "group", "aria-label": item.title });
    words.forEach((w, i) =>
      row.appendChild(
        wordButton(w, i, (n) => {
          rs.cursor.set(n);
          paint();
        }),
      ),
    );
    const meaning = el("p", { cls: "kq-en kq-meaning", role: "status", text: "" });
    const full = fullPanel(item);
    full.hidden = !rs.full;
    function paint() {
      markWords(row, rs.cursor.index);
      meaning.textContent = words.length ? words[rs.cursor.index].en : "";
    }
    const controls = wordControls(rs, words, paint, full);
    paint();
    const block = el("div", { cls: "kq-recite" }, row, meaning, controls, full);
    block.repaint = paint;
    return block;
  }

  /** Buttons under the words: previous word, next word, auto-advance toggle, show / hide the full text. */
  function wordControls(rs, words, paint, full) {
    const prev = G.UI.btn("", {
      icon: "arrow",
      cls: "kq-icon-btn kq-word-prev",
      label: "Previous word",
      onClick: () => (rs.cursor.prev(), paint()),
    });
    const nextWord = G.UI.btn("Next word", {
      cls: "kq-word-next",
      onClick: () => (rs.cursor.next(), paint()),
    });
    const auto = toggle("Auto", "kq-word-auto", rs.auto, (on) => (rs.auto = on));
    const showFull = toggle("Show full text", "kq-show-full", rs.full, function (on) {
      rs.full = on;
      full.hidden = !on;
    });
    return el("div", { cls: "kq-word-controls" }, prev, nextWord, auto, showFull);
  }

  /** A pressed / not pressed button (aria-pressed) that flips its own look and tells the caller. */
  function toggle(text, cls, initial, onChange) {
    const b = G.UI.btn(text, { cls: cls + (initial ? " is-on" : "") });
    b.setAttribute("aria-pressed", String(Boolean(initial)));
    b.addEventListener("click", function () {
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("is-on", on);
      onChange(on);
    });
    return b;
  }

  /** Chips to switch between several texts on one card (Al-Fatihah, then a short surah, ...). */
  function chips(texts, active, onPick) {
    const row = el("div", { cls: "kq-chips", role: "group", "aria-label": "Choose what to read" });
    texts.forEach(function (t, i) {
      const b = el("button", {
        type: "button",
        cls: "kq-chip-btn" + (i === active ? " is-on" : ""),
        "aria-pressed": String(i === active),
        text: t.title,
        on: { click: () => onPick(i) },
      });
      row.appendChild(b);
    });
    return row;
  }

  /* ------------------------------ the card ------------------------------ */

  /** The picture or emoji at the top of a card. */
  function art(card) {
    if (card.picture) return el("div", { cls: "kq-step-art" }, card.picture);
    return el(
      "div",
      { cls: "kq-step-art", "aria-hidden": "true" },
      el("span", { text: card.emoji || "⭐" }),
    );
  }

  /** The counter line and its dots, e.g. "Round 3 of 7". */
  function counterBlock(c) {
    const unit = c.target === 1 ? c.unit : c.plural || c.unit + "s";
    const label = c.unitLabel || unit.charAt(0).toUpperCase() + unit.slice(1);
    const dots = el("div", { cls: "kq-dots kq-step-dots", "aria-hidden": "true" });
    for (let i = 1; i <= c.target && i <= 12; i += 1) {
      dots.appendChild(
        el("span", {
          cls: "kq-dot" + (i <= c.count ? " is-done" : i === c.count + 1 ? " is-now" : ""),
          text: String(i),
        }),
      );
    }
    const text = el("p", {
      cls: "kq-step-count",
      role: "status",
      text: label + ": " + c.count + " of " + c.target,
    });
    return el("div", { cls: "kq-step-counter" }, text, dots);
  }

  /** The row of progress dots for the whole task (e.g. 12 wudu steps), with the current one marked. */
  function progress(card) {
    const total = card.total || 0;
    if (!total || total > 30) return null;
    const row = el("div", { cls: "kq-stepbar", role: "img", "aria-label": card.kicker || "" });
    for (let i = 0; i < total; i += 1) {
      row.appendChild(
        el("i", {
          cls: "kq-sp" + (i < card.index ? " is-done" : i === card.index ? " is-now" : ""),
        }),
      );
    }
    return row;
  }

  /** The body of a card: art, title, lines, recitation, counter, note. */
  function bodyOf(card, rs) {
    const kids = [art(card), el("h3", { cls: "kq-step-title", text: card.title })];
    (card.how || []).forEach((t) => kids.push(el("p", { cls: "kq-step-how", text: t })));
    const texts = card.texts || [];
    if (texts.length) {
      rs.textIndex = Math.min(rs.textIndex || 0, texts.length - 1);
      if (texts.length > 1)
        kids.push(chips(texts, rs.textIndex, (i) => rs.redraw((rs.textIndex = i))));
      const item = texts[rs.textIndex];
      kids.push(reciteBlock(item, rs));
      kids.push(el("p", { cls: "kq-small kq-step-ref", text: item.ref }));
    }
    return kids;
  }

  /** The footer: Back, Go there, extra buttons and the big Next. */
  function footOf(card, h, ctl) {
    const next = G.UI.btn(card.next.label, {
      cls: "primary kq-big kq-step-next " + (card.next.cls || ""),
      icon: card.next.icon || null,
      disabled: card.next.disabled,
      onClick: () => h.onNext(),
    });
    ctl.nextBtn = next;
    const row = el("div", { cls: "kq-step-sub" });
    if (card.canBack)
      row.appendChild(
        G.UI.btn("Back", { cls: "kq-step-back", icon: "arrow", onClick: () => h.onBack() }),
      );
    if (card.go && h.onGo)
      row.appendChild(
        G.UI.btn("Go there", { cls: "kq-step-go", icon: "pin", onClick: () => h.onGo() }),
      );
    (card.extras || []).forEach((x) =>
      row.appendChild(
        G.UI.btn(x.label, {
          cls: "kq-step-extra " + (x.cls || "") + (x.on ? " is-on" : ""),
          icon: x.icon,
          onClick: () => h.onExtra(x.id),
        }),
      ),
    );
    const top = [];
    if (card.counter) top.push(counterBlock(card.counter));
    if (card.note) top.push(el("p", { cls: "kq-note", role: "status", text: card.note }));
    return el("div", { cls: "kq-step-foot" }, top, next, row);
  }

  /* ------------------------------ the sheet, minimise and restore ------------------------------ */

  /** Close reasons that only move the card (it lives on): the owner's onClose must not hear them. */
  const KEEPS_CARD = ["minimise", "relayout"];

  /** Show the card's sheet (side panel or bottom sheet by screen size) and keep its handle. */
  function showSheet(ctl, h, parts) {
    ctl.handle = G.UI.openSheet({
      el: parts.box,
      label: h.label,
      variant: variant(),
      scrim: false,
      onClose: (reason) => onSheetClose(ctl, h, reason),
      focus: ".kq-step-next",
    });
  }

  /** The sheet closed: a minimise or re-layout keeps the card; anything else ends it for good. */
  function onSheetClose(ctl, h, reason) {
    if (KEEPS_CARD.indexOf(reason) !== -1) return;
    endCard(ctl, h, reason);
  }

  /** End the card (finished, "Not now", Escape, replaced...): chip gone, camera centred, owner told. */
  function endCard(ctl, h, reason) {
    ctl.closed = true;
    ctl.minimised = false;
    G.RitualMin.remove(ctl);
    if (G.RitualUI.active === ctl) G.RitualUI.active = null;
    G.UI.state.root.classList.remove("kq-min-locked");
    G.Camera.setShift(0, 0);
    h.onClose(reason);
  }

  /**
   * Tuck the card away into its chip. `by` is "child" (the Hide button, H or -) or "game" (the game
   * is moving the hero, or the child chose to walk the rite): a "game" card comes back by itself at
   * the next step that needs a tap, a "child" card stays down and the chip pulses instead.
   */
  function minimise(ctl, by) {
    if (ctl.closed || ctl.minimised) return;
    ctl.minimised = true;
    ctl.by = by;
    ctl.handle.close("minimise");
    G.Camera.setShift(0, 0);
    G.UI.state.root.classList.toggle("kq-min-locked", Boolean(G.S.player && G.S.player.locked));
    const chip = G.RitualMin.show(ctl, () => ctl.restore());
    G.RitualMin.paint(chip, ctl.card);
    G.HudLayout.measure();
    chip.el.focus({ preventScroll: true });
  }

  /** Bring the card back from its chip (the child tapped it, or the step needs a tap). */
  function restore(ctl, h, parts) {
    if (ctl.closed || !ctl.minimised) return;
    ctl.minimised = false;
    ctl.by = null;
    G.RitualMin.remove(ctl);
    G.UI.state.root.classList.remove("kq-min-locked");
    showSheet(ctl, h, parts);
    ctl.rs.redraw();
  }

  /** The step now needs a tap: a game-minimised card comes back, a child-minimised one pulses its chip. */
  function needsTap(ctl) {
    if (!ctl.minimised) return;
    if (ctl.by === "game") ctl.restore();
    else G.RitualMin.pulse(ctl);
  }

  /** Switch the open card between side panel and bottom sheet (rotation) without ending it. */
  function relayout(ctl, h, parts) {
    if (ctl.closed || ctl.minimised || !ctl.handle) return;
    const side = Boolean(
      G.UI.state.sheet && G.UI.state.sheet.parentElement.classList.contains("kq-sheet-side"),
    );
    if (side === (variant() === "side")) return fitShift();
    ctl.handle.close("relayout");
    showSheet(ctl, h, parts);
    ctl.rs.redraw();
  }

  /**
   * The game's own action (Walk for me, the haircut scene) starts or stops. Starting tucks a visible
   * card away so the child can watch; stopping brings it back, or pulses the chip if the child had
   * hidden it. Only the edges count, so a card the child opened mid-action stays open.
   */
  function setBusy(on) {
    const ctl = G.RitualUI.active;
    const was = Boolean(G.RitualUI.busy);
    G.RitualUI.busy = Boolean(on);
    if (!ctl || was === Boolean(on)) return;
    if (on) minimise(ctl, "game");
    else needsTap(ctl);
  }

  /** Hide / show the active card (the H and - keys). Returns true when there was a card to toggle. */
  function toggleMin() {
    const ctl = G.RitualUI.active;
    if (!ctl || ctl.closed) return false;
    if (ctl.minimised) ctl.restore();
    else ctl.minimise("child");
    return true;
  }

  /**
   * Open a stepper sheet. h: { label, onNext, onBack, onGo, onExtra(id), onClose(reason) }.
   * Returns a controller { show(card), close(), tick(dt), minimise(by), restore(), needsTap(),
   * relayout(), nextBtn, minimised }. `card`:
   * { kicker, index, total, emoji | picture, title, how[], texts[] (ritual text items), counter
   *   { count, target, unit, plural }, next { label, disabled, cls }, canBack, go, extras[], note,
   *   chip { name, count, cue } (what the minimised chip says), key (changes when the card changes:
   *   resets the reading position) }.
   */
  function open(h) {
    if (G.RitualUI.active) G.RitualUI.active.close("replaced");
    const rs = { cursor: null, auto: false, full: false, textIndex: 0, key: null };
    const ctl = { rs, card: null, closed: false, minimised: false, by: null, chip: null };
    const parts = shell(() => ctl.minimise("child"));
    rs.redraw = () => draw(ctl, h, parts);
    ctl.show = (card) => show(ctl, card);
    ctl.close = (reason) => closeCard(ctl, h, reason || "done");
    ctl.tick = (dt) => tick(ctl, dt);
    ctl.minimise = (by) => minimise(ctl, by);
    ctl.restore = () => restore(ctl, h, parts);
    ctl.needsTap = () => needsTap(ctl);
    ctl.relayout = () => relayout(ctl, h, parts);
    showSheet(ctl, h, parts);
    G.RitualUI.active = ctl;
    return ctl;
  }

  /** A new card: redraw it, and if the card is minimised keep its chip current (counting goes on). */
  function show(ctl, card) {
    if (ctl.closed) return;
    const rs = ctl.rs;
    if (rs.key !== card.key) Object.assign(rs, { key: card.key, cursor: null, textIndex: 0 });
    ctl.card = card;
    rs.redraw();
    if (ctl.minimised && ctl.chip) G.RitualMin.paint(ctl.chip, card);
  }

  /** Close the card from outside: through its sheet, or directly when it is minimised (no sheet is up). */
  function closeCard(ctl, h, reason) {
    if (ctl.closed) return;
    if (ctl.minimised) endCard(ctl, h, reason);
    else ctl.handle.close(reason);
  }

  /** The empty sheet content: header (title, Hide, Not now), progress, the scrolling body and the pinned footer. */
  function shell(onMinimise) {
    const title = el("h2", { cls: "kq-sheet-title", text: "" });
    const prog = el("div", { cls: "kq-stepbar-host" });
    const head = el(
      "div",
      { cls: "kq-sheet-head" },
      title,
      prog,
      G.RitualMin.minimiseButton(onMinimise),
      G.UI.btn("Not now", { icon: "close", onClick: () => G.UI.closeSheet("button") }),
    );
    const body = el("div", { cls: "kq-stepper-body" });
    const foot = el("div", { cls: "kq-stepper-foot-host" });
    const box = el("div", { cls: "kq-menu kq-prayer-sheet kq-stepper" }, head, body, foot);
    return { box, title, prog, body, foot };
  }

  /** Redraw head, body and foot from the current card (keeps the reading state; refocuses Next). */
  function draw(ctl, h, parts) {
    const card = ctl.card;
    const keep = parts.body.scrollTop;
    parts.title.textContent = card.kicker;
    U.clear(parts.prog);
    const p = progress(card);
    if (p) parts.prog.appendChild(p);
    U.clear(parts.body);
    bodyOf(card, ctl.rs).forEach((n) => parts.body.appendChild(n));
    U.clear(parts.foot);
    parts.foot.appendChild(footOf(card, h, ctl));
    parts.body.scrollTop = keep;
    if (!ctl.minimised) focusAfterDraw(ctl);
    G.UI.announce(card.kicker + ". " + card.title, "caption");
  }

  /** Re-frame the hero beside the panel and keep keyboard focus inside the card (on Next by default). */
  function focusAfterDraw(ctl) {
    fitShift();
    const sheet = G.UI.state.sheet;
    const active = document.activeElement;
    if (ctl.nextBtn && (!active || !sheet || !sheet.contains(active) || active === document.body))
      ctl.nextBtn.focus({ preventScroll: true });
  }

  /** Per frame: auto-advance the highlighted word when Auto is on. */
  function tick(ctl, dt) {
    const rs = ctl.rs;
    if (!rs.auto || !rs.cursor || ctl.closed) return;
    if (rs.cursor.tick(dt)) {
      const row = G.UI.state.sheet && G.UI.state.sheet.querySelector(".kq-recite");
      if (row && row.repaint) row.repaint();
    }
  }

  /** A plain description for tests: is a card up, minimised, and what its chip says. */
  function debug() {
    const ctl = G.RitualUI.active;
    const chip = ctl && ctl.chip;
    return {
      active: Boolean(ctl),
      minimised: Boolean(ctl && ctl.minimised),
      by: ctl ? ctl.by : null,
      busy: Boolean(G.RitualUI.busy),
      pulsing: Boolean(chip && chip.el.classList.contains("is-pulse")),
      chip: chip ? chip.el.textContent : null,
      kicker: ctl && ctl.card ? ctl.card.kicker : null,
    };
  }

  G.RitualUI = {
    open,
    fitShift,
    variant,
    active: null,
    busy: false,
    setBusy,
    toggleMin,
    debug,
    /** Rotation / resize: switch the open card's panel (a minimised card re-opens in the right one). */
    refit() {
      if (G.RitualUI.active) G.RitualUI.active.relayout();
    },
    tick(dt) {
      if (G.RitualUI.active) G.RitualUI.active.tick(dt);
    },
  };
})((window.KQ = window.KQ || {}));
