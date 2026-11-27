/* ============================================================================
 * FILE: eat-flow.js
 * PURPOSE: Eating as a short stepper after the food is bought: wash your hands, say Bismillah,
 *          eat with your right hand (tap for each bite), say the Alhamdulillah dua.
 * BUSINESS CONTEXT: AC-H8 (eating becomes a one-card-at-a-time stepper). The food itself is
 *   already eaten (hunger refilled) when this opens, so closing it early never costs anything: no
 *   fail state, no scolding. Every food is halal.
 * DEPENDENCIES: ritual-ui.js (the stepper), player.js (poses), KQ.RITUAL_TEXT.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const S = () => G.S;
  const BITES = 3;
  const E = { ctl: null, step: 0, bites: 0, item: null };

  /** Ritual text items by id (a missing one is left out, never an error). */
  function texts(ids) {
    const all = KQ.RITUAL_TEXT || {};
    return ids.filter((id) => all[id]).map((id) => Object.assign({ id }, all[id]));
  }

  /** The four steps: id, title, emoji, lines, texts and the hero's pose. */
  const STEPS = [
    {
      id: "wash",
      title: "Wash your hands",
      emoji: "🧼",
      how: ["Wash both hands with soap and water before you eat."],
      texts: [],
      pose: "wudu_hands",
    },
    {
      id: "bismillah",
      title: "Say Bismillah",
      emoji: "🤲",
      how: [
        "Say Bismillah before the first bite.",
        "If you forget, you can say it later: Bismillahi awwalahu wa akhirah.",
      ],
      texts: ["bismillah", "eatForgot"],
      pose: "doa",
    },
    {
      id: "eat",
      title: "Eat with your right hand",
      emoji: "🍽️",
      how: ["Use your RIGHT hand and take small bites. Tap for each bite."],
      texts: [],
      pose: "eat",
      bites: BITES,
    },
    {
      id: "alhamdulillah",
      title: "Say Alhamdulillah",
      emoji: "😊",
      how: ["Thank Allah for your food."],
      texts: ["eatAfter"],
      pose: "doa",
    },
  ];

  /** The card for the current step (with the bite counter on the eating step). */
  function card() {
    const st = STEPS[E.step];
    const last = E.step === STEPS.length - 1;
    const full = !st.bites || E.bites >= st.bites;
    const c = {
      key: "eat-" + st.id,
      kicker: "Eating · step " + (E.step + 1) + " of " + STEPS.length,
      index: E.step,
      total: STEPS.length,
      emoji: st.emoji,
      title: st.title,
      how: st.how,
      texts: texts(st.texts),
      next: { label: last ? "Alhamdulillah!" : full ? "Next" : "Take a bite", cls: "kq-eat-next" },
    };
    if (E.item && st.id === "eat") c.picture = G.Pictures.dish(E.item.id, 72);
    if (st.bites) c.counter = { count: E.bites, target: st.bites, unit: "bite", plural: "bites" };
    return c;
  }

  /** Put the hero in the current step's pose. */
  function pose() {
    if (S().player.locked) S().player.forcedPose = STEPS[E.step].pose;
  }

  /** Redraw the card and the hero's pose. */
  function refresh() {
    if (!E.ctl) return;
    pose();
    E.ctl.show(card());
  }

  /** Next: a bite on the eating step until the plate is done, then on to the next card; the last card finishes. */
  function onNext() {
    const st = STEPS[E.step];
    if (st.bites && E.bites < st.bites) {
      E.bites += 1;
      G.Audio.play("tap");
      return refresh();
    }
    if (E.step >= STEPS.length - 1) return finish();
    E.step += 1;
    G.Audio.play("pose");
    refresh();
  }

  /** The meal is finished: a happy sound and a kind word. */
  function finish() {
    G.Audio.play("good");
    E.ctl.close("done");
    G.UI.toast("Alhamdulillah! That was yummy.", "good", 3600);
  }

  /** The stepper closed (finished or "Not now"): give the hero back. */
  function onClose() {
    E.ctl = null;
    G.UI.announce("", "caption");
    G.Player.release(S().player);
  }

  /**
   * Open the eating stepper for a food item ({ id, name }). The hero stays where they stand (no
   * walking to a seat) and takes the eating poses.
   */
  function start(item) {
    Object.assign(E, { step: 0, bites: 0, item: item || null });
    G.Player.lock(S().player, null, STEPS[0].pose);
    E.ctl = G.RitualUI.open({ label: "Eating steps", onNext, onClose });
    refresh();
    return E.ctl;
  }

  G.EatFlow = { start, steps: () => STEPS.length, open: () => Boolean(E.ctl) };
})((window.KQ = window.KQ || {}));
