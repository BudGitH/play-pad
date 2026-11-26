/* ============================================================================
 * FILE: missions.js
 * PURPOSE: Mission state machine: accept, step matching from world events, rewards,
 *          pause while a prayer is blocking, snapshot/restore.
 * BUSINESS CONTEXT: AC-11 and business rule 2: when a prayer is due, new mission
 *   progress pauses (accepting AND progressing); the active mission is kept and
 *   resumes after the prayer. There is no fail state - missions can be abandoned
 *   and re-accepted at any time.
 *   Event contract for notify(): { type: goto|talk|buy|deliver|collect, target: poi/npc id,
 *   item?: string, count?: number }.
 * DEPENDENCIES: missions-data.js (KQ.Sim.MISSIONS, KQ.Sim.STICKERS, KQ.Sim.CHAT).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/missions.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const MISSIONS = KQ.Sim.MISSIONS;
  const STICKERS = KQ.Sim.STICKERS;
  const PAUSED_HINT = "It's prayer time - let's pray first, then carry on, InsyaAllah!";
  const NPC_STEP_TYPES = ["talk", "deliver"];

  /** Find a mission definition by id, or null for an unknown id. */
  function missionById(id) {
    return MISSIONS.find((m) => m.id === id) || null;
  }

  /** Is this a real sticker id? Unknown ids are never stored (untrusted save input). */
  function stickerKnown(id) {
    return STICKERS.some((s) => s.id === id);
  }

  /** Missions pause while the host flag is set or a prayer is blocking (business rule 2). */
  function isPaused(M) {
    return M.paused || (typeof M.isPaused === "function" && Boolean(M.isPaused()));
  }

  /** The step the active mission is waiting on, or null when none is active. */
  function currentStep(M) {
    const mission = M.active ? missionById(M.active.id) : null;
    return mission ? mission.steps[M.active.step] : null;
  }

  /** Start a mission and hand back its intro; refuses politely while paused, done, unknown or another is active. */
  function accept(M, id) {
    if (isPaused(M)) return { ok: false, hint: PAUSED_HINT };
    const mission = missionById(id);
    if (!mission) return { ok: false, hint: "I don't know that mission." };
    if (M.completed.indexOf(id) !== -1)
      return { ok: false, hint: "You already did this one - well done!" };
    if (M.active) return { ok: false, hint: "Let's finish your current mission first." };
    M.active = { id, step: 0, count: 0 };
    return { ok: true, mission, lines: mission.intro.slice() };
  }

  /** Does a world event satisfy this step (same type and target, and the same item when both name one)? */
  function stepMatches(step, event) {
    if (!step || !event || step.type !== event.type || step.target !== event.target) return false;
    return !step.item || !event.item || step.item === event.item;
  }

  /** Add known stickers the hero does not own yet, returning only the newly added ones. */
  function grantStickers(M, ids) {
    const added = [];
    ids.forEach(function (id) {
      if (stickerKnown(id) && M.stickers.indexOf(id) === -1) {
        M.stickers.push(id);
        added.push(id);
      }
    });
    return added;
  }

  /** Finish the active mission: record it, grant the reward stickers and describe the result for the UI. */
  function complete(M, mission) {
    M.active = null;
    M.completed.push(mission.id);
    const newStickers = grantStickers(M, mission.reward.stickers);
    return {
      changed: true,
      stepDone: true,
      completed: true,
      mission,
      reward: { coins: mission.reward.coins, stickers: newStickers },
      lines: mission.thanks.slice(),
    };
  }

  /** Feed a world event to the active mission; advances a step (counting collects) and completes it on the last one. */
  function notify(M, event) {
    const none = { changed: false, stepDone: false, completed: false };
    const step = currentStep(M);
    if (isPaused(M) || !stepMatches(step, event)) return none;
    const mission = missionById(M.active.id);
    const gained = Number.isFinite(event.count) && event.count > 0 ? Math.floor(event.count) : 1;
    M.active.count = Math.min(step.count || 1, M.active.count + gained);
    if (M.active.count < (step.count || 1))
      return { changed: true, stepDone: false, completed: false, mission };
    M.active.step += 1;
    M.active.count = 0;
    if (M.active.step >= mission.steps.length) return complete(M, mission);
    return { changed: true, stepDone: true, completed: false, mission, line: step.line || null };
  }

  /** The tracker view of the active mission (title, step index and count, label), or null when idle. */
  function progress(M) {
    const step = currentStep(M);
    if (!step) return null;
    const mission = missionById(M.active.id);
    return {
      id: mission.id,
      title: mission.title,
      stepIndex: M.active.step,
      stepCount: mission.steps.length,
      count: M.active.count,
      need: step.count || 1,
      type: step.type,
      target: step.target,
      label: step.label,
      markerKind: NPC_STEP_TYPES.indexOf(step.type) === -1 ? "poi" : "npc",
      paused: isPaused(M),
    };
  }

  /**
   * Does this NPC have something to say about a mission right now? True when they can give a
   * mission (none is active) or when the active step is to talk to / deliver to them.
   */
  function wantsTalk(M, npcId) {
    if (!M.active) {
      return MISSIONS.some((m) => m.giver === npcId && M.completed.indexOf(m.id) === -1);
    }
    const step = currentStep(M);
    return Boolean(step && NPC_STEP_TYPES.indexOf(step.type) !== -1 && step.target === npcId);
  }

  /**
   * Which of two interaction targets wins when the hero is in range of both. A neighbour with
   * mission business beats a nearby object (a stall counter is ~0.15 m from its hawker, so
   * distance alone never picks the hawker); otherwise the nearer one wins, with a small bias
   * towards the neighbour.
   * @param {{enabled:boolean, dist:number}|null} npc
   * @param {{dist:number}|null} obj
   * @param {boolean} wants whether the neighbour has mission business
   * @returns {"npc"|"obj"|null} null when neither is a usable choice
   */
  function pickTarget(npc, obj, wants) {
    const npcOk = Boolean(npc && npc.enabled);
    if (npcOk && (!obj || wants || npc.dist - 0.4 <= obj.dist)) return "npc";
    if (obj) return "obj";
    return npc ? "npc" : null;
  }

  // TRUST_BOUNDARY: localStorage -> mission tracker (untrusted; unknown ids and counts are dropped)
  function sanitizeSnapshot(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const unique = (list, known) =>
      (Array.isArray(list) ? list : []).filter((id, i, all) => known(id) && all.indexOf(id) === i);
    const completed = unique(
      src.completed,
      (id) => typeof id === "string" && Boolean(missionById(id)),
    );
    const stickers = unique(src.stickers, (id) => typeof id === "string" && stickerKnown(id));
    return { active: cleanActive(src.active, completed), completed, stickers };
  }

  /** Validate a saved active mission: known id, not already done, step and count clamped into range. */
  function cleanActive(raw, completed) {
    const mission =
      raw && typeof raw === "object" && typeof raw.id === "string" ? missionById(raw.id) : null;
    if (!mission || completed.indexOf(mission.id) !== -1) return null;
    const stepIndex = Math.min(
      mission.steps.length - 1,
      Math.max(0, Math.floor(Number(raw.step)) || 0),
    );
    const need = mission.steps[stepIndex].count || 1;
    const count = Math.min(need - 1, Math.max(0, Math.floor(Number(raw.count)) || 0));
    return { id: mission.id, step: stepIndex, count };
  }

  /** Load a saved mission snapshot into the tracker after cleaning it. */
  function restore(M, raw) {
    const clean = sanitizeSnapshot(raw);
    M.active = clean.active;
    M.completed = clean.completed;
    M.stickers = clean.stickers;
  }

  /**
   * Create the mission tracker.
   * @param {{paused?:boolean, isPaused?:Function}} [options] isPaused is polled on every call
   *   (typically () => prayer.isBlockingMissions()).
   */
  function create(options) {
    const opts = options || {};
    const M = {
      active: null,
      completed: [],
      stickers: [],
      paused: Boolean(opts.paused),
      isPaused: opts.isPaused,
    };
    return {
      available: () =>
        MISSIONS.filter(
          (m) => m.id !== (M.active && M.active.id) && M.completed.indexOf(m.id) === -1,
        ),
      accept: (id) => accept(M, id),
      active: () => (M.active ? missionById(M.active.id) : null),
      notify: (event) => notify(M, event),
      progress: () => progress(M),
      abandon() {
        const had = Boolean(M.active);
        M.active = null;
        return had;
      },
      setPaused(value) {
        M.paused = Boolean(value);
      },
      isPausedNow: () => isPaused(M),
      wantsTalk: (npcId) => wantsTalk(M, npcId),
      completed: () => M.completed.slice(),
      stickers: () => M.stickers.slice(),
      grantSticker: (id) => grantStickers(M, [id]).length === 1,
      snapshot: () => ({
        active: M.active ? Object.assign({}, M.active) : null,
        completed: M.completed.slice(),
        stickers: M.stickers.slice(),
      }),
      restore: (raw) => restore(M, raw),
    };
  }

  /** Small-talk line for an NPC (cycles through its lines by `index`). */
  function chatLine(npcId, index) {
    const lines = Object.prototype.hasOwnProperty.call(KQ.Sim.CHAT, npcId)
      ? KQ.Sim.CHAT[npcId]
      : null;
    if (!lines) return KQ.Sim.SALAM.greet;
    const n = Number.isFinite(index) ? Math.abs(Math.floor(index)) : 0;
    return lines[n % lines.length];
  }

  KQ.Sim.Missions = {
    create,
    chatLine,
    pickTarget,
    sanitizeSnapshot,
    prayerSticker: (name) => "prayer_" + name,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
