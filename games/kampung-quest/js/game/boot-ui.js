/* ============================================================================
 * FILE: boot-ui.js
 * PURPOSE: The title / loading screen of design D (asset progress with named steps, Start
 *          disabled until ready, a "New game" choice when a save exists), the WebGL-missing card
 *          and the "saving unavailable" notice.
 * BUSINESS CONTEXT: AC-1 (boot with zero errors, http and file://), AC-13 (blocked storage -> play
 *   without saving, with a small notice), edge case "WebGL unavailable -> a friendly message, no
 *   crash". On file:// the photo textures are skipped and drawn in code; no error is shown.
 * DEPENDENCIES: util.js, pictures.js. Works on the static markup in index.html.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const DEFAULT_STEPS = [
    "Streets and blocks",
    "Waking up the neighbours",
    "Painting the town",
    "Azan recording",
    "Pictures",
  ];
  let STEPS = DEFAULT_STEPS;
  const B = {};

  /** Look up the title screen elements once and clear the placeholder load steps. */
  function bind() {
    const q = (id) => document.getElementById(id);
    Object.assign(B, {
      title: q("kqTitle"),
      bar: q("kqBar"),
      status: q("kqLoadStatus"),
      list: q("kqLoadSteps"),
      start: q("kqStart"),
      newGame: q("kqNew"),
      note: q("kqLoadNote"),
      error: q("kqError"),
    });
    U.clear(B.list);
    STEPS = G.Region.applyTitle(q("kqRegions"), q("kqLead")) || DEFAULT_STEPS;
    STEPS.forEach(function (name, i) {
      B.list.appendChild(
        U.el(
          "li",
          { "data-i": String(i), cls: "is-todo" },
          U.el("span", { cls: "kq-li-mark", "aria-hidden": "true", text: "○" }),
          U.el("span", { text: name }),
        ),
      );
    });
    return B;
  }

  /** Update the loading bar (0..1), its spoken value and the status text. */
  function setProgress(p, text) {
    const pct = Math.round(U.clamp(p, 0, 1) * 100);
    B.bar.style.width = pct + "%";
    B.bar.parentElement.setAttribute("aria-valuenow", String(pct));
    B.status.textContent = (text || "Building the town...") + " " + pct + "%";
  }

  /** state: "todo" | "now" | "done" | "skip" */
  function setStep(i, state, detail) {
    const li = B.list.children[i];
    if (!li) return;
    li.className = "is-" + state;
    li.firstChild.textContent =
      state === "done" ? "✓" : state === "now" ? "▶" : state === "skip" ? "–" : "○";
    li.lastChild.textContent = STEPS[i] + (detail ? " · " + detail : "");
  }

  /**
   * Loading finished: enable the primary button and focus it. When a save exists it reads
   * "Continue \u00b7 day N, HH:MM" (`saved`) and "New game" appears beside it as the quieter choice.
   */
  function ready(saved) {
    setProgress(1, "Ready.");
    B.start.disabled = false;
    if (saved) {
      B.start.lastElementChild.textContent = saved;
      B.newGame.hidden = false;
    }
    B.start.focus({ preventScroll: true });
  }

  /** Show a small notice on the title screen (e.g. saving is unavailable). */
  function note(text) {
    B.note.textContent = text;
  }

  /** Hide the title screen once the game starts. */
  function hideTitle() {
    B.title.hidden = true;
  }

  /** Show the friendly WebGL-missing card, with a Retry button wired to onRetry. */
  function showError(onRetry) {
    B.title.hidden = true;
    B.error.hidden = false;
    document.getElementById("kqRetry").addEventListener("click", onRetry);
  }

  G.BootUI = { bind, setProgress, setStep, ready, note, hideTitle, showError, refs: B };
})((window.KQ = window.KQ || {}));
