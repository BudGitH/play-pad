/* ============================================================================
 * FILE: hud-view.js
 * PURPOSE: Keeps the HUD in step with the sim: clock, next-prayer note, the five-prayer strip,
 *          coins, the food / energy ring, the picture mission card, dock states and the mute button.
 * BUSINESS CONTEXT: AC-6 (clock), AC-10 (meters), AC-11 (tracker, "paused" while praying),
 *   design D (the ring announces its numbers as text; colour is never the only signal).
 * DEPENDENCIES: hud.js (refs), names.js, pictures.js, KQ.Sim state passed in.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const H = () => G.Hud;
  const label = (n) => KQ.Sim.Prayer.DISPLAY[n] || n;

  /**
   * The short note beside the clock: praying now, a prayer's time, one coming soon, or the next
   * prayer and its time.
   */
  function nextNote(ps) {
    if (ps.flow) return "Praying " + label(ps.flow.name);
    if (ps.due) return label(ps.due) + " time!";
    if (ps.next && ps.next.inMin <= 30) return label(ps.next.name) + " soon";
    if (!ps.next) return "";
    return "Next: " + label(ps.next.name) + " " + KQ.PRAYER_TIMES[ps.next.name];
  }

  /**
   * CSS class for one prayer chip: done, due, qada or the next one; a status is never colour alone
   * (the icon changes too).
   */
  function prayerClass(entry, isNext) {
    const base = "kq-prayer";
    if (entry.status === "done" || entry.status === "qada-done") return base + " is-done";
    if (entry.status === "due" || entry.status === "in-progress") return base + " is-due";
    if (entry.status === "qada") return base + " is-qada";
    return base + (isNext ? " is-next" : "");
  }

  /** The spoken state of one prayer for a screen reader (the strip shows it only as an icon and a colour). */
  function prayerState(entry) {
    if (entry.home) return "prayed at home";
    if (entry.status === "done" || entry.status === "qada-done") return "done";
    if (entry.status === "due" || entry.status === "in-progress") return "now";
    return entry.status === "qada" ? "make up" : "not yet";
  }

  /** 'Prayers: Subuh done, Zohor now, Asar not yet, ...' for the status card's spoken label. */
  function prayerSummary(ps) {
    const parts = ps.prayers.map((entry) => label(entry.name) + " " + prayerState(entry));
    return "Prayers: " + parts.join(", ") + ".";
  }

  /**
   * Refresh the five-prayer strip: chip classes, and the mosque icon turning into a tick once a
   * prayer is done.
   */
  function updatePrayers(ps) {
    const R = H().refs;
    const nextIdx = ps.due || ps.flow ? -1 : ps.prayers.findIndex((p) => p.status === "upcoming");
    ps.prayers.forEach(function (entry, i) {
      const slot = R.prayers[entry.name];
      if (!slot) return;
      const cls = prayerClass(entry, i === nextIdx);
      H().setClass("pc" + entry.name, slot.item, cls);
      const done = cls.indexOf("is-done") !== -1;
      if (R["pd" + entry.name] !== done) {
        R["pd" + entry.name] = done;
        U.clear(slot.ic).appendChild(G.Pictures.icon(done ? "check" : "mosque"));
      }
    });
  }

  /** The spoken label of the needs ring: both numbers, plus a kind "low" note for a meter under the low line. */
  function needsLabel(food, energy, needs) {
    let text = "Food " + food + " of 100, energy " + energy + " of 100.";
    if (needs.isHungry()) text += " Food low \u2014 time to eat.";
    if (needs.isTired()) text += " Energy low \u2014 time to rest.";
    return text;
  }

  /**
   * Give a meter that is under the low line a soft amber highlight (a pulsing ring; still under
   * reduced motion): the chip and its ring arc get `is-low`. The words are in the ring's label.
   */
  function markLow(needs) {
    const R = H().refs;
    const hungry = needs.isHungry();
    const tired = needs.isTired();
    R.foodChip.classList.toggle("is-low", hungry);
    R.arcleft.classList.toggle("is-low", hungry);
    R.energyChip.classList.toggle("is-low", tired);
    R.arcright.classList.toggle("is-low", tired);
  }

  /**
   * Refresh the food / energy numbers, the ring arcs, the low highlight and the ring's spoken label
   * (only when a value changed).
   */
  function updateNeeds(needs) {
    const R = H().refs;
    const food = Math.round(needs.hunger);
    const energy = Math.round(needs.energy);
    H().setText("food", R.foodNum, String(food));
    H().setText("energy", R.energyNum, String(energy));
    const f = food + "|" + energy + "|" + needs.status();
    if (H().refs.lastNeeds === f) return;
    R.lastNeeds = f;
    R.arcleft.setAttribute("stroke-dasharray", food + " 100");
    R.arcright.setAttribute("stroke-dasharray", energy + " 100");
    R.ring.setAttribute("aria-label", needsLabel(food, energy, needs));
    markLow(needs);
  }

  /**
   * Build one step chip for the mission card (done, now or to-do), with a progress count on the
   * current counted step.
   */
  function stepChip(step, i, now, mission, count) {
    const st = i < now ? "done" : i === now ? "now" : "todo";
    let text = G.Names.stepLabel(step, i, mission);
    if (st === "now" && step.count > 1) text += " " + count + "/" + step.count;
    const ic = U.el("span", { cls: "kq-step-ic" }, G.Pictures.stepIcon(step.type));
    if (st === "done")
      ic.appendChild(U.el("i", { cls: "kq-step-check" }, G.Pictures.icon("check")));
    return U.el("span", { cls: "kq-step is-" + st }, ic, U.el("span", { text }));
  }

  /** The one-line chip a phone shows while the mission card is folded: the step to do now. */
  function setChip(iconEl, text) {
    const R = H().refs;
    R.chipText.textContent = text;
    U.clear(R.chipIc).appendChild(iconEl);
  }

  const CHIP_VERB = { talk: "Talk to ", goto: "Go to " };

  /** Set the phone's one-line mission chip to the current step (or 'Waiting while we pray'). */
  function chipFor(mission, prog) {
    const step = mission.steps[prog.stepIndex];
    let text = (CHIP_VERB[step.type] || "") + G.Names.stepLabel(step, prog.stepIndex, mission);
    if (step.count > 1) text += " " + prog.count + "/" + step.count;
    setChip(G.Pictures.stepIcon(step.type), prog.paused ? "Waiting while we pray" : text);
  }

  /**
   * Draw the active mission: title, an arrowed row of step chips, and a waiting note while a prayer
   * pauses it.
   */
  function renderMissionSteps(mission, prog) {
    const R = H().refs;
    R.missionTitle.textContent = mission.title;
    R.missionText = mission.title + ". " + prog.label;
    const row = U.el("div", { cls: "kq-steps" });
    mission.steps.forEach((s, i) => {
      if (i)
        row.appendChild(U.el("span", { cls: "kq-step-arrow", "aria-hidden": "true", text: "→" }));
      row.appendChild(stepChip(s, i, prog.stepIndex, mission, prog.count));
    });
    R.missionBody.appendChild(row);
    if (prog.paused)
      R.missionBody.appendChild(U.el("p", { cls: "kq-waiting", text: "Waiting while we pray" }));
    chipFor(mission, prog);
  }

  /**
   * Draw the empty mission card: 'find a neighbour with a star' before any mission, a cheer when
   * all are done.
   */
  function renderNoMission(sig) {
    const R = H().refs;
    const done = sig === "done";
    const msg = done
      ? "All missions done. Masya-Allah! New ones tomorrow."
      : "Find a neighbour with a star over their head and say salam.";
    R.missionTitle.textContent = done ? "All done!" : "No mission yet";
    R.missionText = R.missionTitle.textContent + ". " + msg;
    R.missionBody.appendChild(U.el("p", { cls: "kq-small", text: msg }));
    setChip(
      G.Pictures.icon("star"),
      done ? "All missions done!" : "Say salam to a neighbour with a star",
    );
  }

  /** Redraw the mission card only when its signature (mission, step, count, paused) changes; peek only when the mission or step changes. */
  function renderMission(sim) {
    const R = H().refs;
    const prog = sim.missions.progress();
    const mission = sim.missions.active();
    let sig = "none";
    if (mission && prog) sig = mission.id + prog.stepIndex + ":" + prog.count + ":" + prog.paused;
    else if (sim.missions.available().length === 0) sig = "done";
    if (R.missionSig === sig) return;
    const first = R.missionSig === undefined;
    const stepKey = mission && prog ? mission.id + ":" + prog.stepIndex : "none";
    const newStep = !first && mission && R.missionStep !== stepKey;
    R.missionSig = sig;
    R.missionStep = stepKey;
    U.clear(R.missionBody);
    R.mission.classList.toggle("is-paused", Boolean(prog && prog.paused));
    if (mission && prog) renderMissionSteps(mission, prog);
    else renderNoMission(sig);
    // only a new mission or a new step shows the full card for a few seconds (phones); a collected
    // can or a prayer pause / resume just updates the chip
    if (newStep) G.HudLayout.peek("mission");
  }

  /**
   * Refresh the dock: the Pray button glows when a prayer is due or in qada, and Missions shows the
   * new-mission badge.
   */
  function updateDock(sim, ps, extra) {
    const R = H().refs;
    const pray = R.dockBtns.pray;
    const qadaCount = ps.qada.length;
    const cls = "kq-dock-btn" + (ps.due || ps.flow ? " is-due" : qadaCount ? " is-qada" : "");
    H().setClass("praybtn", pray, cls);
    const avail = sim.missions.active() ? 0 : sim.missions.available().length;
    H().setText("badge", R.badge, avail ? String(avail) : "");
    R.badge.hidden = !avail;
    R.dockBtns.missions.setAttribute(
      "aria-label",
      "Missions" + (avail ? ", " + avail + " new" : ""),
    );
    void extra;
  }

  /** Per-frame HUD refresh. `sim` is the KQ.Sim bundle; `muted` the sound state. */
  function update(sim, muted) {
    const R = H().refs;
    const ps = sim.prayer.state();
    H().setText("clock", R.clockText, sim.clock.hhmm());
    H().setText("nextp", R.nextp, nextNote(ps));
    const spoken = "Clock " + sim.clock.hhmm() + ". " + nextNote(ps) + " " + prayerSummary(ps);
    R.status.setAttribute("aria-label", spoken);
    updatePrayers(ps);
    H().setText("coins", R.coinNum, String(sim.economy.coins));
    R.coins.setAttribute("aria-label", sim.economy.coins + " coins");
    updateNeeds(sim.needs);
    renderMission(sim);
    updateDock(sim, ps);
    G.HudLayout.measure();
    if (R.mutedState !== muted) {
      R.mutedState = muted;
      U.clear(R.mute).appendChild(G.Pictures.icon(muted ? "mute" : "sound"));
      R.mute.setAttribute("aria-pressed", String(muted));
      R.mute.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    }
  }

  G.HudView = { update, nextNote };
})((window.KQ = window.KQ || {}));
