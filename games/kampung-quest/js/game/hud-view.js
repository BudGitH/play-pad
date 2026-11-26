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

  function nextNote(ps) {
    if (ps.flow) return "Praying " + label(ps.flow.name);
    if (ps.due) return label(ps.due) + " time!";
    if (ps.next && ps.next.inMin <= 30) return label(ps.next.name) + " soon";
    if (!ps.next) return "";
    return "Next: " + label(ps.next.name) + " " + KQ.PRAYER_TIMES[ps.next.name];
  }

  function prayerClass(entry, isNext) {
    const base = "kq-prayer";
    if (entry.status === "done" || entry.status === "qada-done") return base + " is-done";
    if (entry.status === "due" || entry.status === "in-progress") return base + " is-due";
    if (entry.status === "qada") return base + " is-qada";
    return base + (isNext ? " is-next" : "");
  }

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

  function updateNeeds(needs) {
    const R = H().refs;
    const food = Math.round(needs.hunger);
    const energy = Math.round(needs.energy);
    H().setText("food", R.foodNum, String(food));
    H().setText("energy", R.energyNum, String(energy));
    const f = food + "|" + energy;
    if (H().refs.lastNeeds === f) return;
    R.lastNeeds = f;
    R.arcleft.setAttribute("stroke-dasharray", food + " 100");
    R.arcright.setAttribute("stroke-dasharray", energy + " 100");
    R.ring.setAttribute("aria-label", "Food " + food + " of 100, energy " + energy + " of 100");
  }

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

  function chipFor(mission, prog) {
    const step = mission.steps[prog.stepIndex];
    let text = (CHIP_VERB[step.type] || "") + G.Names.stepLabel(step, prog.stepIndex, mission);
    if (step.count > 1) text += " " + prog.count + "/" + step.count;
    setChip(G.Pictures.stepIcon(step.type), prog.paused ? "Waiting while we pray" : text);
  }

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

  function renderMission(sim) {
    const R = H().refs;
    const prog = sim.missions.progress();
    const mission = sim.missions.active();
    let sig = "none";
    if (mission && prog) sig = mission.id + prog.stepIndex + ":" + prog.count + ":" + prog.paused;
    else if (sim.missions.available().length === 0) sig = "done";
    if (R.missionSig === sig) return;
    const first = R.missionSig === undefined;
    R.missionSig = sig;
    U.clear(R.missionBody);
    R.mission.classList.toggle("is-paused", Boolean(prog && prog.paused));
    if (mission && prog) renderMissionSteps(mission, prog);
    else renderNoMission(sig);
    // a new step shows the full card for a few seconds, then it folds back to the chip (phones)
    if (!first && mission) G.HudLayout.peek("mission");
  }

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
    R.status.setAttribute("aria-label", "Clock " + sim.clock.hhmm() + ". " + nextNote(ps));
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
