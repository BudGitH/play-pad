/* ============================================================================
 * FILE: hero.js
 * PURPOSE: Who the hero is, for the game layer: the current choice (boy or girl) and its wardrobe
 *          rules, plus the "Who are you?" picker on the title card (two big picture cards, Boy and
 *          Girl). The picker shows on a first run and, with a save, after New game is pressed.
 * BUSINESS CONTEXT: AC-P8 (features/kampung-quest-playability/requirements.md): on New game the
 *   player picks Boy or Girl with big picture cards, by touch or keyboard (arrow keys move the
 *   choice, Tab stays inside the title card's focus trap); the choice is saved (KQ.Sim.Save cleans
 *   it) and can be changed later at the tailor. Boy is pre-selected, so pressing Start straight away
 *   still starts the game (and the existing tests that press Start keep working). `?hero=girl` or
 *   `?hero=boy` pre-selects a card (tests, screenshots).
 * DEPENDENCIES: KQ.Sim.Hero (rules), util.js (U.el, U.svgFrom), ui-core.js (announce, optional).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const Rules = () => KQ.Sim.Hero;

  /** The two card pictures (24 x 24, our own constants, never player text). */
  const PICTURES = {
    boy:
      '<path fill="#1d4fc6" d="M5 24v-5.5C5 16 7 14.6 9.5 14.6h5c2.5 0 4.5 1.4 4.5 3.9V24z"/>' +
      '<path fill="#3f74e8" d="M11.4 14.6h1.2V24h-1.2z"/>' +
      '<circle cx="12" cy="9.6" r="5.2" fill="#e3a97c"/>' +
      '<path fill="#1d4fc6" d="M6.6 8.6a5.4 5.4 0 0 1 10.8 0z"/><path fill="#1a45ad" d="M11 8.2h8.2v1.3H11z"/>' +
      '<circle cx="10" cy="10.4" r=".8" fill="#2b1a10"/><circle cx="14" cy="10.4" r=".8" fill="#2b1a10"/>' +
      '<path fill="none" stroke="#5b2a1e" stroke-width=".7" stroke-linecap="round" d="M10.2 12.4q1.8 1.4 3.6 0"/>',
    girl:
      '<path fill="#2f9a8a" d="M4.6 24l1-5.6C6 16 8 14.8 10 14.8h4c2 0 4 1.2 4.4 3.6l1 5.6z"/>' +
      '<circle cx="9" cy="20" r=".9" fill="#f7a8c4"/><circle cx="15" cy="21" r=".9" fill="#f7a8c4"/>' +
      '<path fill="#e46f9c" d="M12 3.2c-4 0-6.4 3-6.4 6.6 0 2.4.8 4.4 2.2 5.6L12 17l4.2-1.6c1.4-1.2 2.2-3.2 2.2-5.6 0-3.6-2.4-6.6-6.4-6.6z"/>' +
      '<ellipse cx="12" cy="10.4" rx="4" ry="4.4" fill="#e3a97c"/>' +
      '<circle cx="10.4" cy="10.4" r=".8" fill="#2b1a10"/><circle cx="13.6" cy="10.4" r=".8" fill="#2b1a10"/>' +
      '<path fill="none" stroke="#2b1a10" stroke-width=".45" d="M9.3 9.6l-.5-.5M14.7 9.6l.5-.5"/>' +
      '<circle cx="9.4" cy="12" r=".7" fill="#f4a0a0" opacity=".7"/><circle cx="14.6" cy="12" r=".7" fill="#f4a0a0" opacity=".7"/>' +
      '<path fill="none" stroke="#6a2420" stroke-width=".7" stroke-linecap="round" d="M10.8 12.6q1.2 1 2.4 0"/>',
  };
  const LABELS = { boy: "Boy", girl: "Girl" };
  const P = { choice: "boy", host: null, cards: {} };

  /** The hero choice now (the live game's, else a boy). */
  function current() {
    const sim = G.S && G.S.sim;
    return (sim && sim.hero) || Rules().DEFAULT;
  }

  /** Is the hero a girl right now? */
  const isGirl = () => current().gender === "girl";

  /** The wardrobe rules for the current hero (or for `gender`). */
  const rules = (gender) => Rules().wardrobeFor(gender || current().gender);

  /** A big picture card for one gender (a radio button in the "Who are you?" group). */
  function card(gender) {
    const pic = U.svgFrom(PICTURES[gender], "kq-hero-pic");
    const el = U.el(
      "button",
      {
        type: "button",
        cls: "kq-hero-card",
        role: "radio",
        "aria-checked": "false",
        "data-hero": gender,
        on: { click: () => pick(gender), keydown: onKey },
      },
      pic,
      U.el("b", { text: LABELS[gender] }),
    );
    P.cards[gender] = el;
    return el;
  }

  /** Arrow keys move the choice between the two cards (a radio group), focus follows. */
  function onKey(e) {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (keys.indexOf(e.key) === -1) return;
    e.preventDefault();
    const next = P.choice === "boy" ? "girl" : "boy";
    pick(next);
    P.cards[next].focus();
  }

  /** Choose a card: mark it, keep only it in the Tab order, say it. */
  function pick(gender) {
    P.choice = gender === "girl" ? "girl" : "boy";
    Object.keys(P.cards).forEach((g) => {
      const on = g === P.choice;
      P.cards[g].setAttribute("aria-checked", String(on));
      P.cards[g].classList.toggle("is-on", on);
      P.cards[g].tabIndex = on ? 0 : -1;
    });
    if (G.UI && G.UI.announce) G.UI.announce(LABELS[P.choice] + " chosen");
  }

  /** The card picked by the URL (?hero=girl / ?hero=boy), or null. */
  function fromUrl() {
    const v = new URLSearchParams(location.search).get("hero");
    return v === "girl" || v === "boy" ? v : null;
  }

  /**
   * Build the picker into #kqHeroPick. `show` puts it up now (a first run); `initial` is the
   * gender to pre-select (a save's hero, else a boy), the URL flag wins.
   */
  function initPicker(show, initial) {
    const host = document.getElementById("kqHeroPick");
    if (!host) return;
    P.host = host;
    U.clear(host);
    const group = U.el(
      "div",
      { cls: "kq-hero-cards", role: "radiogroup", "aria-labelledby": "kqHeroH" },
      card("boy"),
      card("girl"),
    );
    host.append(
      U.el("h2", { id: "kqHeroH", cls: "kq-hero-h", text: "Who are you?" }),
      group,
      U.el("p", { cls: "kq-small", text: "You can change your hero at the tailor's later." }),
    );
    pick(fromUrl() || initial || "boy");
    host.hidden = !show;
  }

  /** Put the picker up (New game with a save). Returns true when it was hidden and is now shown. */
  function reveal() {
    if (!P.host || !P.host.hidden) return false;
    P.host.hidden = false;
    const btn = G.BootUI && G.BootUI.refs.newGame;
    if (btn && btn.lastElementChild) btn.lastElementChild.textContent = "Start new game";
    P.cards[P.choice].focus({ preventScroll: true });
    return true;
  }

  /** What a test can see: is the picker up, and which card is chosen. */
  function debug() {
    return { picker: Boolean(P.host && !P.host.hidden), choice: P.choice, hero: current() };
  }

  G.Hero = {
    current,
    isGirl,
    rules,
    initPicker,
    reveal,
    choice: () => P.choice,
    debug,
    PICTURES,
  };
})((window.KQ = window.KQ || {}));
