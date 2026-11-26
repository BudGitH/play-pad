/* ============================================================================
 * FILE: prayer.js
 * PURPOSE: The five daily prayers: when each is due, the wudu sequence, the
 *          raka'at step plans, and the gentle due -> qada lifecycle.
 * BUSINESS CONTEXT: AC-7, AC-8, AC-9 and the edge cases in
 *   features/kampung-quest/requirements.md (PLAY-013). Religious accuracy rules
 *   (Shafi'i practice, as followed in Singapore):
 *   - Raka'at: Subuh 2, Zohor 4, Asar 4, Maghrib 3, Isyak 4.
 *   - Each raka'at: qiyam (Al-Fatihah) -> ruku' -> i'tidal -> sujud -> julus
 *     (sitting between the two prostrations) -> sujud. Takbiratul ihram (with
 *     the niat) only opens the first raka'at.
 *   - Tasyahud awal after raka'at 2 in 3- and 4-raka'at prayers; tasyahud akhir
 *     in the final raka'at; then salam to the right and to the left.
 *   - Subuh: doa qunut in the i'tidal of the 2nd raka'at (Shafi'i) - an optional
 *     step flagged `qunut` that the player may skip.
 *   - Wudu: niat, wash hands x3 (sunnah), rinse mouth x3, sniff water into the
 *     nose x3, wash face x3 (fard), right arm to the elbow x3, left arm x3,
 *     wipe the head, wipe the ears, right foot to the ankles x3, left foot x3,
 *     doa after wudu. Fard in the Shafi'i school: niat, face, arms, wiping part
 *     of the head, feet, and doing them in order (tertib).
 *   - Subuh time ends at Syuruk (sunrise); every other prayer ends when the next
 *     one starts; Isyak runs to the next Subuh. A prayer that outlives its time
 *     becomes a gentle "qada" (make-up) prayer: no penalty, no scolding.
 *   Prayer TIMES are injected (KQ.PRAYER_TIMES) - never hard-coded here.
 * DEPENDENCIES: ids.js not required; clock.js (KQ.Sim.Clock.parseHHMM) must load
 *   first. No THREE, no DOM, no Date.now: deterministic.
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/prayer.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const DAY = 1440;
  const NAMES = ["subuh", "zohor", "asar", "maghrib", "isyak"];
  const DISPLAY = {
    subuh: "Subuh",
    zohor: "Zohor",
    asar: "Asar",
    maghrib: "Maghrib",
    isyak: "Isyak",
  };
  const RAKAAT = { subuh: 2, zohor: 4, asar: 4, maghrib: 3, isyak: 4 };
  const STATUSES = ["upcoming", "due", "in-progress", "done", "qada", "qada-done"];
  const MAX_QADA = 10;
  const MAX_ENTRIES = 30;

  /* ------------------------------ wudu data ------------------------------ */

  function wudu(id, label, labelMs, count, fard, pose) {
    return { id, label, labelMs, count, fard, pose };
  }

  /** Wudu in the Shafi'i order. `fard` marks the obligatory acts. */
  const WUDU_STEPS = [
    wudu("niat", "Make your intention (niat)", "Berniat wuduk", 1, true, "idle"),
    wudu("hands", "Wash both hands", "Basuh kedua tangan", 3, false, "wudu_hands"),
    wudu("mouth", "Rinse your mouth", "Berkumur", 3, false, "wudu_face"),
    wudu("nose", "Sniff water into your nose", "Menghirup air ke hidung", 3, false, "wudu_face"),
    wudu("face", "Wash your face", "Basuh muka", 3, true, "wudu_face"),
    wudu(
      "arm_r",
      "Wash your right arm to the elbow",
      "Basuh tangan kanan hingga siku",
      3,
      true,
      "wudu_hands",
    ),
    wudu(
      "arm_l",
      "Wash your left arm to the elbow",
      "Basuh tangan kiri hingga siku",
      3,
      true,
      "wudu_hands",
    ),
    wudu("head", "Wipe your head", "Sapu kepala", 1, true, "wudu_face"),
    wudu("ears", "Wipe your ears", "Sapu telinga", 1, false, "wudu_face"),
    wudu(
      "foot_r",
      "Wash your right foot to the ankle",
      "Basuh kaki kanan hingga buku lali",
      3,
      true,
      "wudu_feet",
    ),
    wudu(
      "foot_l",
      "Wash your left foot to the ankle",
      "Basuh kaki kiri hingga buku lali",
      3,
      true,
      "wudu_feet",
    ),
    wudu("doa", "Say the doa after wudu", "Baca doa selepas wuduk", 1, false, "doa"),
  ];

  /* ------------------------------ prayer plan ---------------------------- */

  const STEP_INFO = {
    takbir: ["Takbiratul ihram (with niat)", "Takbiratul ihram", "takbir", "Allahu Akbar"],
    qiyam: ["Stand and recite Al-Fatihah", "Qiyam - baca Al-Fatihah", "qiyam", "Al-Fatihah"],
    ruku: ["Bow (ruku')", "Rukuk", "ruku", "Subhana rabbiyal 'azim"],
    itidal: ["Stand up straight (i'tidal)", "Iktidal", "itidal", "Sami'allahu liman hamidah"],
    qunut: ["Doa qunut (optional)", "Doa qunut (pilihan)", "doa", "Allahummahdini fiman hadait"],
    sujud: ["Prostrate (sujud)", "Sujud", "sujud", "Subhana rabbiyal a'la"],
    julus: ["Sit between the two prostrations", "Duduk antara dua sujud", "julus", "Rabbighfir li"],
    tasyahud_awal: ["Sit for the first tasyahud", "Tahiyyat awal", "julus", "At-tahiyyat..."],
    tasyahud_akhir: [
      "Sit for the final tasyahud",
      "Tahiyyat akhir",
      "julus",
      "At-tahiyyat... salawat",
    ],
    salam_r: ["Salam to the right", "Salam ke kanan", "salam_r", "Assalamu'alaikum wa rahmatullah"],
    salam_l: ["Salam to the left", "Salam ke kiri", "salam_l", "Assalamu'alaikum wa rahmatullah"],
  };

  function makeStep(type, rakaat, suffix) {
    const info = STEP_INFO[type];
    const id = rakaat ? type + "_" + rakaat + (suffix || "") : type;
    const step = { id, type, label: info[0], labelMs: info[1], pose: info[2], cue: info[3] };
    if (rakaat) step.rakaat = rakaat;
    if (type === "qunut") {
      step.optional = true;
      step.qunut = true;
    }
    return step;
  }

  /** Steps of one raka'at, including the sitting that ends it (if any). */
  function rakaatSteps(name, rakaat) {
    const total = RAKAAT[name];
    const steps = [];
    if (rakaat === 1) steps.push(makeStep("takbir"));
    steps.push(makeStep("qiyam", rakaat), makeStep("ruku", rakaat), makeStep("itidal", rakaat));
    if (name === "subuh" && rakaat === 2) steps.push(makeStep("qunut", rakaat));
    steps.push(
      makeStep("sujud", rakaat, "a"),
      makeStep("julus", rakaat),
      makeStep("sujud", rakaat, "b"),
    );
    if (rakaat === total) steps.push(makeStep("tasyahud_akhir"));
    else if (rakaat === 2) steps.push(makeStep("tasyahud_awal"));
    return steps;
  }

  function normaliseName(raw) {
    const name = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    return NAMES.indexOf(name) === -1 ? null : name;
  }

  /**
   * Ordered prayer steps (fresh copies) for one prayer, ending in both salams.
   * @param {string} rawName subuh|zohor|asar|maghrib|isyak (case-insensitive)
   * @returns {object[]} [] for an unknown name
   */
  function rakaatPlan(rawName) {
    const name = normaliseName(rawName);
    if (!name) return [];
    const plan = [];
    for (let rakaat = 1; rakaat <= RAKAAT[name]; rakaat += 1) {
      plan.push(...rakaatSteps(name, rakaat));
    }
    plan.push(makeStep("salam_r"), makeStep("salam_l"));
    return plan;
  }

  /* ------------------------------ timing -------------------------------- */

  function parseTimes(times) {
    const parse = KQ.Sim.Clock.parseHHMM;
    const parsed = {};
    let previous = -1;
    ["subuh", "syuruk", "zohor", "asar", "maghrib", "isyak"].forEach(function (key) {
      const minutes = parse(times && times[key]);
      if (Number.isNaN(minutes) || minutes <= previous) {
        throw new RangeError("Prayer times: '" + key + "' is missing, malformed or out of order");
      }
      parsed[key] = minutes;
      previous = minutes;
    });
    return parsed;
  }

  function windowFor(name, day, t) {
    const base = (day - 1) * DAY;
    const ends = {
      subuh: t.syuruk,
      zohor: t.asar,
      asar: t.maghrib,
      maghrib: t.isyak,
      isyak: t.subuh + DAY,
    };
    return { startAbs: base + t[name], endAbs: base + ends[name] };
  }

  function makeEntry(name, day, status, t) {
    const win = windowFor(name, day, t);
    return {
      name,
      day,
      status,
      startAbs: win.startAbs,
      endAbs: win.endAbs,
      late: false,
      prefilled: false,
    };
  }

  /* ------------------------------ lifecycle ------------------------------ */

  function addDay(S, day) {
    NAMES.forEach(function (name) {
      S.entries.push(makeEntry(name, day, "upcoming", S.t));
    });
    S.lastDay = day;
  }

  /** First update of a new game: prayers already past at the start count as prayed at home. */
  function initialise(S, abs, day) {
    addDay(S, day);
    S.entries.forEach(function (entry) {
      if (entry.startAbs <= abs) {
        entry.status = "done";
        entry.prefilled = true;
      }
    });
    S.lastAbs = abs;
  }

  function prune(S, day) {
    S.entries = S.entries.filter(function (entry) {
      const finished = entry.status === "done" || entry.status === "qada-done";
      return entry.day >= day || !finished;
    });
    const qada = S.entries.filter((entry) => entry.status === "qada");
    qada.slice(0, Math.max(0, qada.length - MAX_QADA)).forEach(function (entry) {
      S.entries.splice(S.entries.indexOf(entry), 1);
    });
  }

  function advanceEntry(entry, abs, events) {
    const base = { name: entry.name, day: entry.day };
    if (entry.status === "upcoming" && abs >= entry.startAbs) {
      entry.status = "due";
      events.push(Object.assign({ type: "due", at: entry.startAbs }, base));
    }
    if (entry.status === "due" && abs >= entry.endAbs) {
      entry.status = "qada";
      events.push(Object.assign({ type: "qada", at: entry.endAbs }, base));
    }
  }

  const EVENT_ORDER = { newday: 0, qada: 1, due: 2 };

  function sortEvents(events) {
    return events.sort((a, b) => a.at - b.at || EVENT_ORDER[a.type] - EVENT_ORDER[b.type]);
  }

  function update(S, minute, day) {
    const abs = (day - 1) * DAY + minute;
    if (!Number.isFinite(abs)) return [];
    S.now = abs;
    if (S.lastAbs === null) {
      initialise(S, abs, day);
      return [];
    }
    if (abs <= S.lastAbs) return [];
    const events = [];
    for (let d = Math.max(S.lastDay + 1, day - 1); d <= day; d += 1) {
      addDay(S, d);
      events.push({ type: "newday", day: d, at: (d - 1) * DAY });
    }
    S.entries.forEach((entry) => advanceEntry(entry, abs, events));
    S.lastAbs = abs;
    if (!S.flow && events.some((event) => event.type === "due")) S.wuduClean = false;
    prune(S, day);
    return sortEvents(events);
  }

  /* ------------------------------ flow ----------------------------------- */

  function copyStep(step) {
    return step ? Object.assign({}, step) : null;
  }

  function sortedEntries(S, status, name) {
    return S.entries
      .filter((entry) => entry.status === status && (!name || entry.name === name))
      .sort((a, b) => a.startAbs - b.startAbs);
  }

  function pickEntry(S, name) {
    const order = ["in-progress", "due", "qada"];
    for (let i = 0; i < order.length; i += 1) {
      const found = sortedEntries(S, order[i], name)[0];
      if (found) return found;
    }
    return null;
  }

  function findFlowEntry(S) {
    const flow = S.flow;
    if (!flow) return null;
    return (
      S.entries.find(
        (e) =>
          e.name === flow.name &&
          e.day === flow.day &&
          (e.status === "in-progress" || e.status === "qada"),
      ) || null
    );
  }

  function cancelFlow(S) {
    const entry = findFlowEntry(S);
    if (entry && entry.status === "in-progress") entry.status = "due";
    S.flow = null;
  }

  function startFlow(S, rawName) {
    const name = normaliseName(rawName);
    if (!name) return { ok: false, hint: "Hmm, I don't know that prayer. Try the prayer card!" };
    if (S.flow && S.flow.name === name) return flowInfo(S, true);
    const entry = pickEntry(S, name);
    if (!entry) {
      return {
        ok: false,
        hint: DISPLAY[name] + " is not ready yet. I'll let you know when it's time, InsyaAllah!",
      };
    }
    cancelFlow(S);
    const kind = entry.status === "qada" ? "qada" : "due";
    if (kind === "due") entry.status = "in-progress";
    S.flow = {
      name,
      day: entry.day,
      kind,
      phase: S.wuduClean ? "pray" : "wudu",
      wuduIdx: 0,
      prayIdx: 0,
    };
    return flowInfo(S, true);
  }

  function flowInfo(S, ok) {
    const flow = S.flow;
    if (!flow) return { ok: false, hint: "No prayer in progress." };
    const plan = rakaatPlan(flow.name);
    return {
      ok: ok,
      hint: "",
      name: flow.name,
      kind: flow.kind,
      phase: flow.phase,
      wuduIndex: flow.wuduIdx,
      wuduTotal: WUDU_STEPS.length,
      prayIndex: flow.prayIdx,
      prayTotal: plan.length,
      rakaat: RAKAAT[flow.name],
    };
  }

  function wrongStepHint(expected) {
    return "Good try! The next step is: " + expected.label + " (" + expected.labelMs + ").";
  }

  function wuduStep(S, id) {
    const flow = S.flow;
    if (!flow)
      return {
        ok: false,
        hint: "Wudu is for getting ready to pray - wait for the azan, InsyaAllah!",
      };
    if (flow.phase !== "wudu")
      return { ok: false, hint: "Your wudu is done! Head into the prayer hall." };
    const expected = WUDU_STEPS[flow.wuduIdx];
    if (id !== expected.id) return { ok: false, hint: wrongStepHint(expected) };
    flow.wuduIdx += 1;
    const done = flow.wuduIdx >= WUDU_STEPS.length;
    if (done) {
      flow.phase = "pray";
      S.wuduClean = true;
    }
    return { ok: true, hint: "", done, step: copyStep(expected) };
  }

  function stepMatches(step, id) {
    return Boolean(step) && (step.id === id || step.type === id);
  }

  function matchPrayStep(plan, index, id) {
    if (stepMatches(plan[index], id)) return index;
    if (plan[index] && plan[index].optional && stepMatches(plan[index + 1], id)) return index + 1;
    return -1;
  }

  function finishFlow(S) {
    const flow = S.flow;
    const entry = findFlowEntry(S);
    const qada = flow.kind === "qada";
    const late = Boolean(entry) && S.now >= entry.endAbs;
    if (entry) {
      entry.status = qada ? "qada-done" : "done";
      entry.late = late;
    }
    S.flow = null;
    const label = DISPLAY[flow.name];
    let praise = "Alhamdulillah! You prayed " + label + ". Well done!";
    if (qada) praise = "Alhamdulillah! You made up your " + label + ". Well done!";
    else if (late)
      praise = "Alhamdulillah - better late than never! Well done for praying " + label + ".";
    return { name: flow.name, kind: flow.kind, late, praise };
  }

  function prayStep(S, id) {
    const flow = S.flow;
    if (!flow)
      return {
        ok: false,
        hint: "Wait for the azan, then we pray together, InsyaAllah!",
        done: false,
      };
    if (flow.phase !== "pray") {
      return {
        ok: false,
        hint: "Let's take wudu at the taps first, then come into the hall.",
        done: false,
      };
    }
    const plan = rakaatPlan(flow.name);
    const target = matchPrayStep(plan, flow.prayIdx, id);
    if (target === -1) return { ok: false, hint: wrongStepHint(plan[flow.prayIdx]), done: false };
    flow.prayIdx = target + 1;
    if (flow.prayIdx < plan.length) return { ok: true, hint: "", done: false, step: plan[target] };
    return { ok: true, hint: "", done: true, step: plan[target], result: finishFlow(S) };
  }

  function nextStep(S, phase) {
    const flow = S.flow;
    if (!flow || flow.phase !== phase) return null;
    if (phase === "wudu") return copyStep(WUDU_STEPS[flow.wuduIdx]);
    return copyStep(rakaatPlan(flow.name)[flow.prayIdx]);
  }

  /* ------------------------------ state ---------------------------------- */

  function timeline(S) {
    const day = Math.floor(S.now / DAY) + 1;
    const list = [];
    for (let d = Math.max(1, day - 1); d <= day + 1; d += 1) {
      NAMES.forEach((name) => list.push({ name, startAbs: windowFor(name, d, S.t).startAbs }));
    }
    return list;
  }

  /** Most recent prayer start and the next one (minutes since / until). */
  function surroundings(S) {
    const list = timeline(S);
    const past = list.filter((item) => item.startAbs <= S.now);
    const future = list.filter((item) => item.startAbs > S.now);
    const current = past.length ? past[past.length - 1] : null;
    const next = future[0] || null;
    return {
      current: current ? { name: current.name, sinceMin: S.now - current.startAbs } : null,
      next: next ? { name: next.name, inMin: next.startAbs - S.now } : null,
    };
  }

  function publicEntry(S, entry) {
    const clock = KQ.Sim.Clock;
    const hh = Math.floor((entry.startAbs % DAY) / 60);
    return {
      name: entry.name,
      label: DISPLAY[entry.name],
      day: entry.day,
      status: entry.status,
      time: clock.pad2(hh) + ":" + clock.pad2(Math.floor(entry.startAbs % 60)),
      late: entry.late,
      prefilled: entry.prefilled,
      rakaat: RAKAAT[entry.name],
    };
  }

  function dueName(S) {
    const active = S.entries.filter((e) => e.status === "due" || e.status === "in-progress");
    active.sort((a, b) => a.startAbs - b.startAbs);
    return active.length ? active[0].name : null;
  }

  function stateOf(S) {
    const day = Math.floor(S.now / DAY) + 1;
    const around = surroundings(S);
    const today = S.entries.filter((e) => e.day === day).sort((a, b) => a.startAbs - b.startAbs);
    return {
      day,
      prayers: today.map((entry) => publicEntry(S, entry)),
      qada: S.entries.filter((e) => e.status === "qada").map((entry) => publicEntry(S, entry)),
      due: dueName(S),
      blocking: isBlocking(S),
      current: around.current,
      next: around.next,
      wuduClean: S.wuduClean,
      flow: S.flow ? flowInfo(S, true) : null,
    };
  }

  function isBlocking(S) {
    return S.entries.some((entry) => entry.status === "due" || entry.status === "in-progress");
  }

  /* ------------------------------ persistence ---------------------------- */

  const PHASES = ["wudu", "pray"];

  function cleanInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
  }

  function cleanEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = normaliseName(raw.name);
    if (!name || STATUSES.indexOf(raw.status) === -1) return null;
    return {
      name,
      day: cleanInt(raw.day, 1, 99999, 1),
      status: raw.status,
      late: raw.late === true,
      prefilled: raw.prefilled === true,
    };
  }

  function cleanFlow(raw) {
    const name = raw && typeof raw === "object" ? normaliseName(raw.name) : null;
    if (!name || PHASES.indexOf(raw.phase) === -1) return null;
    return {
      name,
      day: cleanInt(raw.day, 1, 99999, 1),
      kind: raw.kind === "qada" ? "qada" : "due",
      phase: raw.phase,
      wuduIdx: cleanInt(raw.wuduIdx, 0, WUDU_STEPS.length - 1, 0),
      prayIdx: cleanInt(raw.prayIdx, 0, rakaatPlan(name).length - 1, 0),
    };
  }

  /**
   * Validate a saved prayer snapshot (untrusted input).
   * @returns {object|null} a clean snapshot, or null when unusable
   */
  function sanitizeSnapshot(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.entries)) return null;
    const entries = raw.entries.slice(0, MAX_ENTRIES).map(cleanEntry).filter(Boolean);
    const lastAbs = Number(raw.lastAbs);
    return {
      entries,
      lastAbs: Number.isFinite(lastAbs) && lastAbs >= 0 ? Math.min(lastAbs, 99999 * DAY) : null,
      lastDay: cleanInt(raw.lastDay, 0, 99999, 0),
      wuduClean: raw.wuduClean === true,
      flow: cleanFlow(raw.flow),
    };
  }

  function snapshot(S) {
    return {
      entries: S.entries.map((e) => ({
        name: e.name,
        day: e.day,
        status: e.status,
        late: e.late,
        prefilled: e.prefilled,
      })),
      lastAbs: S.lastAbs,
      lastDay: S.lastDay,
      wuduClean: S.wuduClean,
      flow: S.flow ? Object.assign({}, S.flow) : null,
    };
  }

  function restore(S, raw) {
    const clean = sanitizeSnapshot(raw);
    if (!clean) return false;
    S.entries = clean.entries.map((e) =>
      Object.assign(makeEntry(e.name, e.day, e.status, S.t), {
        late: e.late,
        prefilled: e.prefilled,
      }),
    );
    S.lastAbs = clean.lastAbs;
    S.lastDay = clean.lastDay;
    S.now = clean.lastAbs === null ? 0 : clean.lastAbs;
    S.wuduClean = clean.wuduClean;
    S.flow = clean.flow;
    if (S.flow && !findFlowEntry(S)) S.flow = null;
    S.entries.forEach(function (entry) {
      if (entry.status === "in-progress" && !S.flow) entry.status = "due";
    });
    return true;
  }

  /* ------------------------------ public API ----------------------------- */

  /**
   * Create a prayer tracker.
   * @param {object} times KQ.PRAYER_TIMES-shaped {subuh, syuruk, zohor, asar, maghrib, isyak} "HH:MM"
   * @throws {RangeError} when a time is missing, malformed or out of order
   */
  function create(times) {
    const S = {
      t: parseTimes(times),
      entries: [],
      lastAbs: null,
      lastDay: 0,
      now: 0,
      flow: null,
      wuduClean: false,
    };
    return {
      update: (minute, day) => update(S, minute, day),
      state: () => stateOf(S),
      startFlow: (name) => startFlow(S, name),
      cancelFlow: () => cancelFlow(S),
      wuduStep: (id) => wuduStep(S, id),
      prayStep: (id) => prayStep(S, id),
      nextWuduStep: () => nextStep(S, "wudu"),
      nextPrayStep: () => nextStep(S, "pray"),
      due: () => dueName(S),
      isBlockingMissions: () => isBlocking(S),
      snapshot: () => snapshot(S),
      restore: (raw) => restore(S, raw),
    };
  }

  WUDU_STEPS.forEach(Object.freeze);
  Object.freeze(WUDU_STEPS);

  KQ.Sim.Prayer = {
    create,
    rakaatPlan,
    sanitizeSnapshot,
    WUDU_STEPS,
    NAMES,
    DISPLAY,
    RAKAAT,
    STATUSES,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
