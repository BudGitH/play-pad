/* ============================================================================
 * FILE: hud-view.js
 * PURPOSE: Keeps the HUD in step with the sim: clock, next-prayer note, the five-prayer strip (and
 *          the status card's due / qada glow), coins, the food / energy bars, the picture mission
 *          card, the Missions badge and the mute button.
 * BUSINESS CONTEXT: AC-6 (clock), AC-10 (meters), AC-11 (tracker, "paused" while praying),
 *   design D (the needs announce their numbers as text; colour is never the only signal: each bar
 *   also has an icon, a length and a word, "Hungry" / "Tired" when low).
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
    const sunat = Boolean(ps.flow) && ps.flow.kind === "sunat";
    // a fard prayer falling due always outranks a (calm, optional) sunat flow
    if (sunat && !ps.due) return G.PrayerText.flowLabel(ps.flow.name, ps.flow.kind);
    if (ps.flow && !sunat) return "Praying " + label(ps.flow.name);
    if (ps.due) return label(ps.due) + " time!";
    // inMin is GAME minutes (the sim's clock), so the countdown follows game time, never the wall clock
    if (ps.next && ps.next.inMin <= 60)
      return label(ps.next.name) + " in " + Math.max(1, Math.ceil(ps.next.inMin)) + " min";
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

  /** The spoken label of the needs bars: both numbers, plus a kind "low" note for a meter under the low line. */
  function needsLabel(food, energy, needs) {
    let text = "Food " + food + " of 100, energy " + energy + " of 100.";
    if (needs.isHungry()) text += " Food low \u2014 time to eat.";
    if (needs.isTired()) text += " Energy low \u2014 time to rest.";
    return text;
  }

  /** The bar colour for a level: green when full, through yellow, to orange when low (never red). */
  function needColour(level) {
    const hue = 30 + (105 * Math.min(100, Math.max(0, level))) / 100;
    return "hsl(" + Math.round(hue) + " 78% 52%)";
  }

  /**
   * One need's bar, word and low state: the bar's length and colour follow the level, and under the
   * low line the word turns kind ("Hungry" / "Tired") and the row pulses softly (a static amber
   * outline under reduced motion).
   */
  function paintNeed(kind, level, low, words) {
    const R = H().refs;
    const fill = R[kind + "Fill"];
    fill.style.transform = "scaleX(" + level / 100 + ")";
    fill.style.background = low ? "" : needColour(level);
    R[kind + "Row"].classList.toggle("is-low", low);
    R[kind + "Word"].textContent = low ? words[1] : words[0];
  }

  /**
   * Refresh both need bars and the bars' spoken label (only when a value or the low state changed).
   */
  function updateNeeds(needs) {
    const R = H().refs;
    const food = Math.round(needs.hunger);
    const energy = Math.round(needs.energy);
    const f = food + "|" + energy + "|" + needs.status();
    if (R.lastNeeds === f) return;
    R.lastNeeds = f;
    paintNeed("food", food, needs.isHungry(), ["Food", "Hungry"]);
    paintNeed("energy", energy, needs.isTired(), ["Energy", "Tired"]);
    R.needs.setAttribute("aria-label", needsLabel(food, energy, needs));
    R.needs.title = "Food " + food + ", energy " + energy;
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

  const CHIP_VERB = {
    talk: "Talk to ",
    goto: "Go to ",
    ride: "",
    photo: "",
    greet: "",
    escort: "",
  };

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

  /**
   * In Makkah and Madinah there are no neighbours with missions: the card shows the rite under way
   * (the Umrah / Hajj / Ziarah step) or how to begin one.
   */
  function renderRites(sim) {
    const R = H().refs;
    const rite = sim.umrah ? sim.umrah.summary() : null;
    const sig = "rites|" + rite;
    if (R.missionSig === sig) return;
    R.missionSig = sig;
    const msg = rite || "Tap Umrah below to begin: Umrah, Hajj or Ziarah.";
    U.clear(R.missionBody);
    R.mission.classList.remove("is-paused");
    R.missionTitle.textContent = rite ? "Your journey" : "Makkah and Madinah";
    R.missionText = R.missionTitle.textContent + ". " + msg;
    R.missionBody.appendChild(U.el("p", { cls: "kq-small kq-ritual-line", text: msg }));
    setChip(G.Pictures.icon("mosque"), rite || "Tap Umrah to begin");
    if (rite) G.HudLayout.peek("mission");
    nameMissionToggle();
  }

  /** Redraw the mission card only when its signature (mission, step, count, paused) changes; peek only when the mission or step changes. */
  function renderMission(sim) {
    if (KQ.region === "haramain" && !sim.missions.active()) return renderRites(sim);
    const R = H().refs;
    const prog = sim.missions.progress();
    const mission = sim.missions.active();
    let sig = "none";
    if (mission && prog) sig = mission.id + prog.stepIndex + ":" + prog.count + ":" + prog.paused;
    else if (sim.missions.available().length === 0) sig = "done";
    const state = sig;
    const rite = sim.umrah ? sim.umrah.summary() : null;
    sig += "|" + rite;
    if (R.missionSig === sig) return;
    const first = R.missionSig === undefined;
    const stepKey = mission && prog ? mission.id + ":" + prog.stepIndex : "none";
    const newStep = !first && mission && R.missionStep !== stepKey;
    R.missionSig = sig;
    R.missionStep = stepKey;
    U.clear(R.missionBody);
    R.mission.classList.toggle("is-paused", Boolean(prog && prog.paused));
    if (mission && prog) renderMissionSteps(mission, prog);
    else renderNoMission(state);
    if (rite)
      R.missionBody.appendChild(U.el("p", { cls: "kq-small kq-ritual-line", text: "🕋 " + rite }));
    // only a new mission or a new step shows the full card for a few seconds (phones); a collected
    // can or a prayer pause / resume just updates the chip
    if (newStep) G.HudLayout.peek("mission");
    nameMissionToggle();
  }

  /**
   * On a phone the folded mission card is a button; give it an explicit spoken name (mission and
   * step) so it can never be announced as an unnamed button. Elsewhere it is a plain panel.
   */
  function nameMissionToggle() {
    const t = H().refs.missionToggle;
    if (t.getAttribute("role") === "button")
      t.setAttribute("aria-label", H().refs.missionText || "Mission");
    else t.removeAttribute("aria-label");
  }

  /** Turn a class on a node, only touching the DOM when the answer changed. */
  function flag(key, node, cls, on) {
    if (H().refs[key] === on) return;
    H().refs[key] = on;
    node.classList.toggle(cls, on);
  }

  /**
   * The prayer-time card is the Pray button: it glows gold while a prayer is due or being prayed,
   * and gets a dashed gold edge while one is waiting to be made up (qada).
   */
  function updatePrayCard(ps) {
    const R = H().refs;
    const urgent = Boolean(ps.due || (ps.flow && ps.flow.kind !== "sunat"));
    flag("praydue", R.status, "is-due", urgent);
    flag("prayqada", R.status, "is-qada", !urgent && ps.qada.length > 0);
  }

  /** The spoken name of the Missions button: the one in progress, else how many wait to be found. */
  function missionsLabel(active, waiting) {
    if (active)
      return "Missions, 1 in progress" + (waiting ? ", " + waiting + " more to find" : "");
    return waiting ? "Missions, " + waiting + " to find" : "Missions, all done";
  }

  /**
   * Refresh the Missions button: the badge is the number of missions under way (a green "1" with a
   * green edge on the button) or, when none is, how many wait to be found (pink).
   */
  function updateMissions(sim) {
    const R = H().refs;
    if (!R.dockBtns.missions) return; // Makkah and Madinah have no missions: the dock has no Missions button
    const active = Boolean(sim.missions.active());
    const waiting = sim.missions.available().length;
    const shown = active ? 1 : waiting;
    H().setText("badge", R.badge, shown ? String(shown) : "");
    R.badge.hidden = !shown;
    flag("misactive", R.badge, "is-active", active);
    flag("misbtn", R.dockBtns.missions, "is-active", active);
    const name = missionsLabel(active, waiting);
    if (R.misname !== name) {
      R.misname = name;
      R.dockBtns.missions.setAttribute("aria-label", name);
    }
  }

  /** Per-frame HUD refresh. `sim` is the KQ.Sim bundle; `muted` the sound state. */
  function update(sim, muted) {
    const R = H().refs;
    const ps = sim.prayer.state();
    H().setText("clock", R.clockText, sim.clock.hhmm());
    H().setText("nextp", R.nextp, nextNote(ps));
    const spoken = "Clock " + sim.clock.hhmm() + ". " + nextNote(ps) + " " + prayerSummary(ps);
    R.status.setAttribute("aria-label", spoken + " Opens today's prayers.");
    updatePrayers(ps);
    H().setText("coins", R.coinNum, String(sim.economy.coins));
    R.coins.setAttribute("aria-label", sim.economy.coins + " coins");
    updateNeeds(sim.needs);
    renderMission(sim);
    updatePrayCard(ps);
    updateMissions(sim);
    G.HudLayout.measure();
    if (R.mutedState !== muted) {
      R.mutedState = muted;
      U.clear(R.mute).appendChild(G.Pictures.icon(muted ? "mute" : "sound"));
      R.mute.setAttribute("aria-pressed", String(!muted)); // pressed = sound is on
    }
  }

  G.HudView = { update, nextNote, nameMissionToggle };
})((window.KQ = window.KQ || {}));
