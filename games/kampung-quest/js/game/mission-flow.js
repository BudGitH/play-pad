/* ============================================================================
 * FILE: mission-flow.js
 * PURPOSE: Glue between the mission state machine (KQ.Sim.Missions), the world and the UI:
 *          talking to neighbours (offer, remind, deliver, thank, small talk), proximity "goto"
 *          steps, picking things up, rewards, the giver stars and the marker position.
 * BUSINESS CONTEXT: AC-11 (>= 8 missions, tracker, world marker, minimap arrow), AC-12 (polite
 *   Assalamualaikum / Waalaikumsalam), business rule 2 (missions pause while a prayer is blocking:
 *   the sim refuses to accept or progress, and the NPC says "let's pray first").
 * DEPENDENCIES: KQ.Sim.Missions / Economy, ui-dialogue.js, npc-manager.js, collectibles.js, names.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  const chat = {};

  function sim() {
    return S().sim;
  }

  function activeStep() {
    const prog = sim().missions.progress();
    const mission = sim().missions.active();
    return prog && mission ? mission.steps[prog.stepIndex] : null;
  }

  /** What the hero is carrying for the current step (or null). */
  function carrying() {
    const step = activeStep();
    const prog = sim().missions.progress();
    if (!step || !prog || prog.stepIndex === 0) return null;
    return step.type === "deliver" ? G.Names.itemName(step.item) : null;
  }

  function rewardText(res) {
    const names = res.reward.stickers
      .map((id) => (KQ.Sim.STICKERS.find((s) => s.id === id) || {}).name)
      .filter(Boolean);
    return (
      "Mission done! +" +
      res.reward.coins +
      " coins" +
      (names.length ? " and a sticker: " + names.join(", ") : "")
    );
  }

  /** Show feedback for a notify() result. Returns the result unchanged. */
  function applyResult(res) {
    if (!res || !res.changed) return res;
    S().hudDirty = true;
    if (res.completed) {
      sim().economy.add(res.reward.coins);
      G.Audio.play("good");
      setTimeout(() => G.Audio.play("coin"), 350);
      G.UI.toast(rewardText(res), "gold", 5600);
    } else if (res.stepDone) {
      G.Audio.play("good");
      G.UI.toast("Step done! Next: " + sim().missions.progress().label, "good");
    } else {
      G.Audio.play("coin");
      const p = sim().missions.progress();
      G.UI.toast("Got it! " + p.count + " of " + p.need, "good", 2000);
    }
    return res;
  }

  function notify(event) {
    return applyResult(sim().missions.notify(event));
  }

  function offer(A, mission) {
    const m = mission;
    G.Dialogue.open({
      name: A.name,
      muslim: KQ.Sim.NPC_PROFILE[A.id].muslim,
      lines: m.intro,
      choices: [
        { label: "Waalaikumsalam! Yes", primary: true, onPick: () => accept(m) },
        { label: "Later" },
      ],
      onClose: () => G.Npcs.endTalk(A),
    });
  }

  function accept(m) {
    const res = sim().missions.accept(m.id);
    if (!res.ok) {
      G.UI.toast(res.hint, "hint");
      return;
    }
    G.Audio.play("good");
    G.UI.toast("New mission: " + m.title, "gold", 4200);
    S().hudDirty = true;
  }

  function say(A, lines) {
    G.Dialogue.open({
      name: A.name,
      muslim: KQ.Sim.NPC_PROFILE[A.id].muslim,
      lines,
      onClose: () => G.Npcs.endTalk(A),
    });
  }

  function smallTalk(A) {
    chat[A.id] = (chat[A.id] || 0) + 1;
    const line = KQ.Sim.Missions.chatLine(A.id, chat[A.id] - 1);
    const lines = Array.isArray(line) ? line : [line];
    say(A, lines);
  }

  function stepTalk(A, prog, step) {
    const res = notify({ type: prog.type, target: A.id, item: step.item });
    const lines = res.completed ? res.lines : [res.line || KQ.Sim.SALAM.reply + " Terima kasih!"];
    say(A, lines.length ? lines : ["Terima kasih!"]);
  }

  /** Start a conversation with an NPC agent. */
  function talk(A) {
    const m = sim().missions;
    const prog = m.progress();
    const paused = m.isPausedNow();
    G.Npcs.startTalk(A);
    const P = S().player;
    P.heading = Math.atan2(A.x - P.pos.x, A.z - P.pos.z);
    G.Player.sync(P);
    const step = activeStep();
    const isStepTarget =
      prog && (prog.type === "talk" || prog.type === "deliver") && prog.target === A.id;
    if (isStepTarget && !paused) return stepTalk(A, prog, step);
    const giver = m.available().find((x) => x.giver === A.id);
    if (paused && (giver || isStepTarget)) {
      return say(A, ["It's prayer time. Let's pray first, then carry on, InsyaAllah!"]);
    }
    if (!prog && giver) return offer(A, giver);
    const active = m.active();
    if (active && active.giver === A.id) return say(A, active.reminder);
    smallTalk(A);
  }

  /** Proximity "goto" steps. */
  function checkGoto() {
    const prog = sim().missions.progress();
    if (!prog || prog.paused || prog.type !== "goto") return;
    const poi = S().world.pois[prog.target];
    const hero = S().player.pos;
    if (poi && U.dist(hero.x, hero.z, poi.pos.x, poi.pos.z) <= Math.max(poi.radius, 3)) {
      notify({ type: "goto", target: prog.target });
    }
  }

  function pickup(item) {
    G.Collectibles.take(S().collect, item);
    const isCan = item.kind === "can";
    G.Audio.play("tap");
    notify({ type: "collect", target: isCan ? "park" : "playground", item: item.kind });
  }

  /** Stars over the heads of neighbours who have a mission to give. */
  function syncStars() {
    const m = sim().missions;
    const free = !m.active() && !m.isPausedNow();
    const givers = free ? m.available().map((x) => x.giver) : [];
    S().npcs.agents.forEach(function (A) {
      const praying = Boolean(A.goal && A.goal.kind === "pray");
      G.Markers.starFor(S().markers, A).visible =
        !A.hidden && !praying && givers.indexOf(A.id) !== -1;
    });
  }

  /** World position of the active mission target ({x, z, y}) or null. */
  function targetPos() {
    const prog = sim().missions.progress();
    if (!prog || prog.paused) return null;
    const world = S().world;
    if (prog.type === "collect") {
      const hero = S().player.pos;
      const items = G.Collectibles.available(S().collect).sort(
        (a, b) => U.dist(hero.x, hero.z, a.x, a.z) - U.dist(hero.x, hero.z, b.x, b.z),
      );
      if (items[0]) return { x: items[0].x, z: items[0].z };
    }
    if (prog.markerKind === "npc") {
      const A = S().npcs.byId[prog.target];
      if (A && !A.hidden) return { x: A.x, z: A.z };
      const home = A && A.goal && A.goal.home ? world.pois[A.goal.home] : null;
      if (home) return { x: home.pos.x, z: home.pos.z };
      return A ? { x: A.x, z: A.z } : null;
    }
    const poi = world.pois[prog.target];
    return poi ? { x: poi.pos.x, z: poi.pos.z } : null;
  }

  G.MissionFlow = {
    talk,
    notify,
    checkGoto,
    pickup,
    syncStars,
    targetPos,
    carrying,
    applyResult,
    activeStep,
  };
})((window.KQ = window.KQ || {}));
