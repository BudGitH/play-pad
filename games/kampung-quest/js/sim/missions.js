/* ============================================================================
 * FILE: missions.js
 * PURPOSE: Mission state machine: accept, step matching from world events, rewards,
 *          pause while a prayer is blocking, snapshot/restore.
 * BUSINESS CONTEXT: AC-11 and business rule 2: when a prayer is due, new mission
 *   progress pauses (accepting AND progressing); the active mission is kept and
 *   resumes after the prayer. There is no fail state - missions can be abandoned
 *   and re-accepted at any time.
 *   Event contract for notify(): { type: goto|talk|buy|deliver|collect|greet, target: poi/npc id,
 *   item?: string, count?: number, who?: string (a person's id: a counted step takes each once) }.
 * DEPENDENCIES: missions-data.js (KQ.Sim.MISSIONS, KQ.Sim.STICKERS, KQ.Sim.CHAT).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/missions.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const MISSIONS = KQ.Sim.MISSIONS;
  const STICKERS = KQ.Sim.STICKERS;
  const PAUSED_HINT = "It's prayer time - let's pray first, then carry on, InsyaAllah!";
  /** Steps whose target is a neighbour or guide (everything else points at a place). */
  const NPC_STEP_TYPES = ["talk", "deliver"];

  /** Find a mission definition by id, or null for an unknown id. */
  function missionById(id) {
    return MISSIONS.find((m) => m.id === id) || null;
  }

  /**
   * The missions this tracker can offer: those of its region (default the kampung) whose places
   * exist in this world (a mission may list `needs`, e.g. a camel yard another build adds).
   */
  function offered(M) {
    const has = typeof M.hasPoi === "function" ? M.hasPoi : () => true;
    return MISSIONS.filter(
      (m) => (m.region || "kampung") === M.region && (m.needs || []).every((id) => has(id)),
    );
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
    if (!mission || offered(M).indexOf(mission) === -1)
      return { ok: false, hint: "I don't know that mission." };
    if (M.completed.indexOf(id) !== -1)
      return { ok: false, hint: "You already did this one - well done!" };
    if (M.active) return { ok: false, hint: "Let's finish your current mission first." };
    M.active = { id, step: 0, count: 0, clock: 0 };
    return { ok: true, mission, lines: mission.intro.slice() };
  }

  /** Does a world event satisfy this step (same type and target, and the same item when both name one)? */
  function stepMatches(step, event) {
    if (!step || !event || step.type !== event.type || step.target !== event.target) return false;
    return !step.item || !event.item || step.item === event.item;
  }

  /** The sticker id for a prayer's star. */
  function prayerStickerId(name) {
    return "prayer_" + name;
  }

  /**
   * The reward for finishing a prayer or a qada: the prayer's star sticker and NEVER coins (owner
   * decision: worship does not earn in-game money). Returns `{ coins: 0, newSticker }`.
   */
  function awardPrayer(M, name) {
    return { coins: 0, newSticker: grantStickers(M, [prayerStickerId(name)]).length === 1 };
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
    const fast = Boolean(mission.beat) && M.active.clock <= mission.beat.secs;
    M.active = null;
    M.completed.push(mission.id);
    const newStickers = grantStickers(M, mission.reward.stickers);
    const bonus = fast ? mission.beat.coins : 0;
    return {
      changed: true,
      stepDone: true,
      completed: true,
      mission,
      reward: { coins: mission.reward.coins + bonus, stickers: newStickers, bonus },
      lines: mission.thanks.slice(),
    };
  }

  /**
   * Count free-play seconds on the active mission (only a mission with a "beat the bubble" time
   * uses it). Paused time never counts, and being slow costs nothing: it only misses the bonus.
   */
  function tick(M, dt) {
    const mission = M.active ? missionById(M.active.id) : null;
    if (!mission || !mission.beat || isPaused(M) || !(dt > 0)) return;
    M.active.clock += dt;
  }

  /** Seconds left of the bubble bonus for the active mission, or null when it has none. */
  function bubbleLeft(M) {
    const mission = M.active ? missionById(M.active.id) : null;
    if (!mission || !mission.beat) return null;
    return Math.max(0, mission.beat.secs - M.active.clock);
  }

  /**
   * Is this a repeat hello to a person already counted for this step? A counted step ("Say hi to 5
   * people") takes each person (`event.who`, an id) once, so greeting the same neighbour five times
   * does not finish it. An event with no `who` always counts. Remembers the person otherwise.
   */
  function repeatPerson(M, step, event) {
    if (event.who === undefined || event.who === null || !(step.count > 1)) return false;
    const seen = M.active.seen || (M.active.seen = []);
    if (seen.indexOf(event.who) !== -1) return true;
    seen.push(event.who);
    return false;
  }

  /** Feed a world event to the active mission; advances a step (counting collects) and completes it on the last one. */
  function notify(M, event) {
    const none = { changed: false, stepDone: false, completed: false };
    const step = currentStep(M);
    if (isPaused(M) || !stepMatches(step, event)) return none;
    if (repeatPerson(M, step, event)) return none;
    const mission = missionById(M.active.id);
    const gained = Number.isFinite(event.count) && event.count > 0 ? Math.floor(event.count) : 1;
    M.active.count = Math.min(step.count || 1, M.active.count + gained);
    if (M.active.count < (step.count || 1))
      return { changed: true, stepDone: false, completed: false, mission };
    M.active.step += 1;
    M.active.count = 0;
    M.active.seen = null;
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
      item: step.item || null,
      verb: step.verb || null,
      quick: Boolean(step.quick),
      who: step.who || null,
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
      return offered(M).some((m) => m.giver === npcId && M.completed.indexOf(m.id) === -1);
    }
    const step = currentStep(M);
    return Boolean(step && NPC_STEP_TYPES.indexOf(step.type) !== -1 && step.target === npcId);
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
    M.active = clean.active ? Object.assign({ clock: 0 }, clean.active) : null;
    M.completed = clean.completed;
    M.stickers = clean.stickers;
  }

  /** The raw tracker state for the options given. */
  function newTracker(opts) {
    return {
      active: null,
      completed: [],
      stickers: [],
      paused: Boolean(opts.paused),
      isPaused: opts.isPaused,
      region: opts.region || (typeof KQ.region === "string" ? KQ.region : "kampung"),
      hasPoi: opts.hasPoi,
    };
  }

  /** The saved shape of the tracker (the bubble clock is not saved). */
  function snapshot(M) {
    const a = M.active;
    return {
      active: a ? { id: a.id, step: a.step, count: a.count } : null,
      completed: M.completed.slice(),
      stickers: M.stickers.slice(),
    };
  }

  /**
   * Create the mission tracker.
   * @param {{paused?:boolean, isPaused?:Function, region?:string, hasPoi?:Function}} [options]
   *   isPaused is polled on every call (typically () => prayer.isBlockingMissions()); region picks
   *   the missions offered (default KQ.region); hasPoi(id) says whether the world has a place.
   */
  function create(options) {
    const M = newTracker(options || {});
    return {
      available: () =>
        offered(M).filter(
          (m) => m.id !== (M.active && M.active.id) && M.completed.indexOf(m.id) === -1,
        ),
      /** Every mission this region offers (done or not), for the board. */
      offered: () => offered(M),
      tick: (dt) => tick(M, dt),
      bubbleLeft: () => bubbleLeft(M),
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
      awardPrayer: (name) => awardPrayer(M, name),
      snapshot: () => snapshot(M),
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

  /** A neighbour's display name ("Atuk"), or their id when unknown. */
  function npcName(npcId) {
    const profile = KQ.Sim.NPC_PROFILE && KQ.Sim.NPC_PROFILE[npcId];
    return profile ? profile.name : npcId;
  }

  /**
   * What a neighbour says to a finished talk / deliver step with no authored line: a Malay thank-you
   * for Muslim neighbours, plain English for the others (never a salam reply the hero did not earn).
   */
  function fallbackReply(npcId) {
    const profile = KQ.Sim.NPC_PROFILE && KQ.Sim.NPC_PROFILE[npcId];
    return profile && profile.muslim ? "Terima kasih!" : "Thank you!";
  }

  /** The target neighbour's reply to a talk / deliver step: its authored line, else the profile fallback. */
  function stepReply(npcId, line) {
    return line || fallbackReply(npcId);
  }

  /**
   * The pages shown when the LAST step of a mission (a talk / deliver to `targetId`) completes it:
   * the target's own authored reply first, then the giver's thanks, each attributed to the giver
   * ("Atuk says: ...") when the giver is not the one standing there.
   */
  function completionLines(mission, targetId) {
    const last = mission.steps[mission.steps.length - 1];
    if (mission.giver === targetId) return (last.line ? [last.line] : []).concat(mission.thanks);
    const prefix = npcName(mission.giver) + " says: ";
    return [stepReply(targetId, last.line)].concat(mission.thanks.map((t) => prefix + t));
  }

  /**
   * The child's reply button for a line: 'Thank you!' to a Waalaikumsalam (never a second salam),
   * 'Waalaikumsalam!' to an Assalamualaikum, "You're welcome!" to a thank-you, else a friendly
   * 'Thank you!' (Muslim neighbour) / 'Hello!'.
   */
  function replyLabel(line, muslim) {
    const text = String(line).toLowerCase();
    if (text.indexOf("waalaikumsalam") === 0) return "Thank you!";
    if (text.indexOf("assalamualaikum") === 0) return "Waalaikumsalam!";
    if (/thank|terima kasih|jazakallah/.test(text)) return "You're welcome!";
    return muslim ? "Thank you!" : "Hello!";
  }

  KQ.Sim.Missions = {
    create,
    chatLine,
    sanitizeSnapshot,
    stepReply,
    completionLines,
    replyLabel,
    prayerSticker: prayerStickerId,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
