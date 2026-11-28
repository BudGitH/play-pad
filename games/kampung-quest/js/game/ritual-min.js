/* ============================================================================
 * FILE: ritual-min.js
 * PURPOSE: The "minimise" half of the one-card-at-a-time stepper (ritual-ui.js): the Hide button on a
 *          card, and the small chip a minimised card turns into (the step's picture, a short name and
 *          a counter such as "Tawaf 3/7" or "Rakaat 2/4", plus a cue of at most six words). Tap, Enter
 *          or the H / - key brings the card back.
 * BUSINESS CONTEXT: AC-P15 / AC-P16 (playability round). A stepper card is a modal sheet: while it is
 *   up the hero cannot walk and the controls are hidden. The owner asked that a child can tuck it
 *   away to watch the hero, walk the rite by hand, or use the joystick and Jump, and that the card
 *   tucks itself away while the game moves the hero (Walk for me, the haircut scene) and comes back at
 *   the next step that needs a tap.
 * DEPENDENCIES: util.js (el), pictures.js (icons), ui-core.js (UI.btn). Text only through textContent.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const el = U.el;
  /** The chip's cue is a few words, never a sentence. */
  const MAX_CUE_WORDS = 6;
  /** How long a gentle "your turn" pulse lasts on a chip the child minimised by hand (ms). */
  const PULSE_MS = 2600;

  /** A chevron over a tray line: the Hide (minimise) icon. */
  G.Pictures.ICONS.minimise = "M7.4 7.6 12 12.2l4.6-4.6L18 9l-6 6-6-6zM6 17h12v2.4H6z";

  /** The first `n` words of a text (the rest is dropped, with no ellipsis: a cue should read whole). */
  function clampWords(text, n) {
    const words = String(text || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return words.slice(0, n).join(" ");
  }

  /** The step's picture as a small chip icon: a copy of its drawing, else its emoji, else a mosque. */
  function iconOf(card) {
    if (card.picture && card.picture.cloneNode) return card.picture.cloneNode(true);
    if (card.emoji)
      return el("span", { cls: "kq-min-emoji", "aria-hidden": "true", text: card.emoji });
    return G.Pictures.icon("mosque");
  }

  /** "3/7": the counter if the card has one, else the card's place in its task (step 4 of 9). */
  function countOf(card) {
    if (card.counter) return card.counter.count + "/" + card.counter.target;
    if (card.total) return Math.min(card.index + 1, card.total) + "/" + card.total;
    return "";
  }

  /** What the chip shows for a card: { icon, name, count, cue }. A card may supply `chip` = { name, count, cue }. */
  function contentOf(card) {
    const c = card.chip || {};
    const cue = c.cue || (card.next && card.next.label) || "";
    return {
      icon: iconOf(card),
      name: c.name || String(card.title || "").split(":")[0],
      count: c.count !== undefined ? c.count : countOf(card),
      cue: clampWords(cue, MAX_CUE_WORDS),
    };
  }

  /** The Hide button for a card's header (48 px; the word shows on roomy screens, the icon alone on a phone). */
  function minimiseButton(onClick) {
    const b = G.UI.btn("Hide", {
      icon: "minimise",
      cls: "kq-minimise",
      label: "Hide the steps (minimise)",
      onClick,
    });
    b.setAttribute("title", "Hide the steps (H)");
    return b;
  }

  /** Build an empty chip: a button that calls `onRestore`. */
  function buildChip(onRestore) {
    const ic = el("span", { cls: "kq-min-ic" });
    const name = el("b", { cls: "kq-min-name", text: "" });
    const count = el("span", { cls: "kq-min-count", text: "" });
    const cue = el("span", { cls: "kq-min-cue", text: "" });
    const text = el(
      "span",
      { cls: "kq-min-text" },
      el("span", { cls: "kq-min-line" }, name, document.createTextNode(" "), count),
      document.createTextNode(" "),
      cue,
    );
    const open = G.Pictures.icon("chevron", "kq-min-open");
    const b = G.UI.btn("", { cls: "primary kq-min-chip", onClick: onRestore });
    b.append(ic, text, open);
    return { el: b, ic, name, count, cue, pulseTimer: null };
  }

  /** Write a card's content into a chip (text through textContent) and name it for screen readers. */
  function paint(chip, card) {
    const c = contentOf(card);
    U.clear(chip.ic);
    chip.ic.appendChild(c.icon);
    chip.name.textContent = c.name;
    chip.count.textContent = c.count;
    chip.cue.textContent = c.cue;
    const said = [c.name + (c.count ? " " + c.count : ""), c.cue, "Open the steps"].filter(Boolean);
    chip.el.setAttribute("aria-label", said.join(". "));
  }

  /** Put a chip on screen for a controller (creating it on first use) and return it. */
  function show(ctl, onRestore) {
    if (!ctl.chip) {
      ctl.chip = buildChip(onRestore);
      G.S.hudHost.appendChild(ctl.chip.el);
    }
    ctl.chip.el.hidden = false;
    return ctl.chip;
  }

  /** Take a controller's chip off the screen for good. */
  function remove(ctl) {
    const chip = ctl.chip;
    if (!chip) return;
    clearTimeout(chip.pulseTimer);
    chip.el.remove();
    ctl.chip = null;
    if (G.HudLayout) G.HudLayout.measure();
  }

  /** A gentle "your turn" pulse for a few seconds (still, for a player who prefers less motion). */
  function pulse(ctl) {
    const chip = ctl.chip;
    if (!chip) return;
    clearTimeout(chip.pulseTimer);
    chip.el.classList.add("is-pulse");
    chip.pulseTimer = setTimeout(() => chip.el.classList.remove("is-pulse"), PULSE_MS);
  }

  G.RitualMin = { minimiseButton, show, paint, remove, pulse, clampWords, contentOf };
})((window.KQ = window.KQ || {}));
