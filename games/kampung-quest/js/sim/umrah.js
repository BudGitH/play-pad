/* ============================================================================
 * FILE: umrah.js
 * PURPOSE: The rites as ordered steps with counters: Umrah, the Hajj highlights and the Ziarah
 *          (visiting Madinah). Tracks where each rite is, its round / leg / pebble counter, whether
 *          the hero is in ihram and what haircut they chose. Saves and restores safely.
 * BUSINESS CONTEXT: features/kampung-quest-haramain/requirements.md AC-H3, H4, H5. Sunni practice.
 *   Umrah: ihram + niyyah at the miqat -> talbiyah -> enter the Haram with the right foot -> tawaf
 *   (7 rounds, anticlockwise from the Black Stone) -> 2 raka'at behind Maqam Ibrahim -> Zamzam ->
 *   sa'i (7 legs, Safa to Marwa) -> tahallul. There is NO fail state: Next always moves on, a
 *   counter step just needs its count (each Next adds one) and Back is always allowed.
 * DEPENDENCIES: none (pure). Text ids refer to KQ.RITUAL_TEXT (js/data/ritual-text.js).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/umrah.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const RITES = ["umrah", "hajj", "ziarah"];
  const CUTS = ["none", "trim", "shave", "lock"];
  const MAX_COUNT = 99;

  /** One step: id, title, emoji picture, site key (for "Go there"), text ids, kid-friendly lines, options. */
  function step(id, title, emoji, site, texts, how, extra) {
    return Object.freeze(Object.assign({ id, title, emoji, site, texts, how }, extra || {}));
  }
  const counter = (n, unit, plural) => ({ n, unit, plural: plural || unit + "s" });

  const UMRAH = [
    step(
      "ihram",
      "Ihram and niyyah",
      "🤍",
      "miqat",
      ["niyyahUmrah"],
      [
        "At the miqat we enter ihram: boys and men wear two plain white cloths, girls and women wear simple, modest clothes.",
        "Make your niyyah for Umrah, then say it.",
      ],
      { leave: { wear: true } },
    ),
    step(
      "talbiyah",
      "Say the talbiyah",
      "📣",
      "gate",
      ["talbiyah"],
      ["Say the talbiyah out loud on the way to the Haram. Keep saying it until you see the Kaaba."],
    ),
    step(
      "enter",
      "Enter the Haram",
      "🚪",
      "gate",
      ["enterHaram"],
      ["Step into the mosque with your RIGHT foot.", "Say this dua."],
    ),
    step(
      "tawaf",
      "Tawaf: 7 rounds",
      "🕋",
      "mataf",
      ["istilam", "yemeni"],
      [
        "Start at the Black Stone corner. Keep the Kaaba on your LEFT and walk anticlockwise.",
        "Each round, wave to the Black Stone and say Bismillah, Allahu akbar.",
        "Between the Yemeni corner and the Black Stone, say this dua.",
      ],
      { counter: counter(7, "round"), walk: "tawaf" },
    ),
    step(
      "maqam",
      "Two raka'at behind Maqam Ibrahim",
      "🤲",
      "maqamIbrahim",
      ["maqam", "kafirun", "ikhlas"],
      [
        "Pray two short raka'at. After Al-Fatihah read Al-Kafirun in the first and Al-Ikhlas in the second.",
        "If it is crowded, you may pray anywhere in the mosque.",
      ],
      { counter: counter(2, "raka'ah", "raka'at") },
    ),
    step(
      "zamzam",
      "Drink Zamzam",
      "💧",
      "zamzam",
      ["bismillah", "zamzam"],
      ["Say Bismillah and drink Zamzam water. Face the Kaaba if you can, and make a dua."],
    ),
    step(
      "sai",
      "Sa'i: 7 legs",
      "🚶",
      "safa",
      ["safa", "tahlil"],
      [
        "Start at Safa and end at Marwa. Safa to Marwa is leg 1, back to Safa is leg 2, so leg 7 ends at Marwa.",
        "On each hill, face the Kaaba and say this dua. Between the green lights, men walk briskly.",
      ],
      { counter: counter(7, "leg"), walk: "sai" },
    ),
    step(
      "tahallul",
      "Tahallul: cut your hair",
      "✂️",
      "hairSalon",
      [],
      [
        "Men shave the head or trim all their hair short. Women snip a fingertip's length of hair.",
        "Then ihram is over and your Umrah is complete.",
      ],
      { leave: { unwear: true, cut: true }, haircut: true },
    ),
    step("done", "Umrah complete!", "🌟", null, [], [
      "Alhamdulillah! You finished your Umrah. May Allah accept it.",
    ]),
  ];

  const HAJJ = [
    step(
      "h_ihram",
      "Ihram and niyyah for Hajj",
      "🤍",
      "miqat",
      ["niyyahHajj", "talbiyah"],
      [
        "Hajj begins with ihram, just like Umrah. Say your niyyah for Hajj and then the talbiyah.",
        "Keep saying the talbiyah until you throw the first stones on the 10th.",
      ],
      { leave: { wear: true } },
    ),
    step(
      "h_mina",
      "8 Dhul Hijjah: Mina",
      "⛺",
      "mina",
      ["talbiyah"],
      [
        "Today everyone goes to Mina, a city of tents.",
        "We pray Zuhr, Asr, Maghrib, Isha and Fajr here and say the talbiyah.",
      ],
    ),
    step(
      "h_arafah",
      "9 Dhul Hijjah: Arafah",
      "⛰️",
      "arafah",
      ["arafah"],
      [
        "The most important day: wuquf, standing at Arafah from noon until sunset.",
        "The Prophet taught: Hajj is Arafah. Make lots of dua here.",
      ],
    ),
    step(
      "h_muzdalifah",
      "Night of the 9th: Muzdalifah",
      "🌙",
      "muzdalifah",
      [],
      [
        "After sunset we go to Muzdalifah, pray Maghrib and Isha together and sleep under the stars.",
        "Collect 7 small pebbles for tomorrow. Tap for each pebble you pick up.",
      ],
      { counter: counter(7, "pebble") },
    ),
    step(
      "h_aqabah",
      "10 Dhul Hijjah: Jamrat al-Aqabah",
      "🪨",
      "jamarat",
      ["takbir"],
      [
        "Throw 7 pebbles at the big pillar, Jamrat al-Aqabah, one at a time.",
        "Say Allahu akbar with every pebble. Now you can stop the talbiyah.",
      ],
      { counter: counter(7, "pebble") },
    ),
    step(
      "h_qurban",
      "Qurban (the sacrifice)",
      "🐑",
      "mina",
      ["istilam"],
      [
        "A sheep or goat is offered for Allah and its meat is shared, mostly with people in need.",
        "We say Bismillah, Allahu akbar.",
      ],
    ),
    step(
      "h_hair",
      "Cut your hair",
      "✂️",
      "hairSalon",
      [],
      [
        "Men shave the head or trim all their hair; women snip a fingertip's length.",
        "Now you can take off ihram and wear normal clothes again.",
      ],
      { leave: { unwear: true, cut: true }, haircut: true },
    ),
    step(
      "h_ifadah",
      "Tawaf al-Ifadah",
      "🕋",
      "mataf",
      ["istilam", "yemeni"],
      ["Go back to the Kaaba and walk 7 rounds, just like in Umrah."],
      { counter: counter(7, "round"), walk: "tawaf" },
    ),
    step(
      "h_sai",
      "Sa'i for Hajj",
      "🚶",
      "safa",
      ["safa", "tahlil"],
      ["Walk 7 legs between Safa and Marwa, starting at Safa and ending at Marwa."],
      { counter: counter(7, "leg"), walk: "sai" },
    ),
    step(
      "h_tashriq",
      "11-13 Dhul Hijjah: the three pillars",
      "🪨",
      "jamarat",
      ["takbir"],
      [
        "On each of the days of tashriq we throw 7 pebbles at each of the three pillars: small, middle, then big.",
        "Say Allahu akbar with every pebble. Tap once for each pillar finished.",
      ],
      { counter: counter(3, "pillar") },
    ),
    step(
      "h_wada",
      "Tawaf al-Wada' (farewell)",
      "👋",
      "mataf",
      ["istilam", "yemeni"],
      ["Before leaving Makkah we say goodbye to the Kaaba with 7 rounds."],
      { counter: counter(7, "round"), walk: "tawaf" },
    ),
    step("h_done", "Hajj complete!", "🌟", null, [], [
      "Alhamdulillah! You finished the Hajj highlights. May Allah accept every Hajj.",
    ]),
  ];

  const ZIARAH = [
    step(
      "z_salam",
      "Salam to the Prophet",
      "🕌",
      "salamWall",
      ["enterHaram", "salamProphet"],
      [
        "Enter Masjid an-Nabawi with the right foot. Walk quietly and speak softly.",
        "At the Prophet's resting place, give salam. We also greet Abu Bakr and Umar, may Allah be pleased with them.",
      ],
    ),
    step(
      "z_rawdah",
      "Pray in the Rawdah",
      "🟢",
      "rawdah",
      ["fatihah", "ikhlas"],
      [
        "The Rawdah, with the green carpet, is a garden from the gardens of Paradise. Pray 2 raka'at here.",
        "After Al-Fatihah read any short surah, such as Al-Ikhlas.",
      ],
      { counter: counter(2, "raka'ah", "raka'at") },
    ),
    step(
      "z_quba",
      "Pray at Masjid Quba",
      "🤲",
      "quba",
      ["fatihah", "ikhlas"],
      [
        "Quba is the first mosque in Islam. Make wudu at home, then pray 2 raka'at here.",
        "The Prophet said it has the reward of an Umrah.",
      ],
      { counter: counter(2, "raka'ah", "raka'at") },
    ),
    step(
      "z_uhud",
      "Visit Uhud",
      "⛰️",
      "uhud",
      ["graveyard"],
      [
        "Uhud is a mountain where the Muslims fought and many were martyred. We visit, give salam and make dua for them.",
      ],
    ),
    step(
      "z_baqi",
      "Visit Al-Baqi'",
      "🌿",
      "baqi",
      ["graveyard"],
      [
        "Al-Baqi' is the graveyard of the people of Madinah. We give salam and make dua.",
        "We never touch, kiss or pray to graves: we ask Allah alone.",
      ],
    ),
    step("z_done", "Ziarah complete!", "🌟", null, [], [
      "Alhamdulillah! You visited the blessed places of Madinah.",
    ]),
  ];

  const STEPS = { umrah: UMRAH, hajj: HAJJ, ziarah: ZIARAH };
  const TITLES = { umrah: "Umrah", hajj: "Hajj", ziarah: "Ziarah" };

  const clampInt = (v, lo, hi, fb) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : fb;
  };
  const isRite = (r) => RITES.indexOf(r) !== -1;
  /** The step count target (0 when the step has no counter). */
  const targetOf = (st) => (st && st.counter ? st.counter.n : 0);

  /** A fresh tracker state. */
  function blank() {
    const per = (v) => ({ umrah: v, hajj: v, ziarah: v });
    return { last: null, idx: per(0), count: per(0), done: per(false), ihram: false, cut: "none" };
  }

  /**
   * Clean a saved rituals section (untrusted input). Unknown rites / values fall back to the fresh
   * state; indices and counts are clamped into their ranges. Returns null for a non-object.
   */
  // TRUST_BOUNDARY: localStorage -> ritual tracker (untrusted; every field is whitelisted or clamped)
  function sanitize(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const out = blank();
    RITES.forEach(function (rite) {
      const list = STEPS[rite];
      const idx = clampInt(raw.idx && raw.idx[rite], 0, list.length - 1, 0);
      out.idx[rite] = idx;
      out.count[rite] = clampInt(raw.count && raw.count[rite], 0, targetOf(list[idx]), 0);
      out.done[rite] = Boolean(raw.done && raw.done[rite] === true);
    });
    out.last = isRite(raw.last) ? raw.last : null;
    out.ihram = raw.ihram === true;
    out.cut = CUTS.indexOf(raw.cut) === -1 ? "none" : raw.cut;
    return out;
  }

  /** The step the rite is on, with its position and counter, for the UI (fresh copies, never the state). */
  function view(R, rite) {
    const list = STEPS[rite];
    const index = R.idx[rite];
    const st = list[index];
    return {
      rite,
      index,
      total: list.length,
      step: st,
      count: R.count[rite],
      target: targetOf(st),
      full: R.count[rite] >= targetOf(st),
      last: index === list.length - 1,
      done: R.done[rite],
    };
  }

  /** Apply what leaving a step does: put on / take off ihram, choose the default haircut. */
  function leave(R, st) {
    if (!st.leave) return;
    if (st.leave.wear) R.ihram = true;
    if (st.leave.unwear) R.ihram = false;
    if (st.leave.cut && R.cut === "none") R.cut = "trim";
  }

  /** Move to step `index` of a rite with its counter at `count`. */
  function goto(R, rite, index, count) {
    R.idx[rite] = index;
    R.count[rite] = count;
  }

  /**
   * Press "Next". On a counter step each press adds one (until the counter is full); when the step
   * is complete it moves on. Past the last card the rite is marked done.
   */
  function next(R, rite) {
    const v = view(R, rite);
    R.last = rite;
    if (v.target && !v.full) {
      R.count[rite] += 1;
      return { moved: false, counted: true, done: false, view: view(R, rite) };
    }
    if (v.last) {
      R.done[rite] = true;
      return { moved: false, counted: false, done: true, view: view(R, rite) };
    }
    leave(R, v.step);
    goto(R, rite, v.index + 1, 0);
    return { moved: true, counted: false, done: false, view: view(R, rite) };
  }

  /** Go back one step (its counter shows complete: you already did it). Never fails. */
  function back(R, rite) {
    const v = view(R, rite);
    if (v.index === 0) return { moved: false, view: v };
    const prev = STEPS[rite][v.index - 1];
    goto(R, rite, v.index - 1, targetOf(prev));
    R.done[rite] = false;
    return { moved: true, view: view(R, rite) };
  }

  /** Count one more round / leg / pebble on the current counter step (stops at the target). */
  function bump(R, rite) {
    const v = view(R, rite);
    if (!v.target || v.full) return { ok: false, count: R.count[rite], full: v.full };
    R.count[rite] += 1;
    return { ok: true, count: R.count[rite], full: R.count[rite] >= v.target };
  }

  /** Raise the counter to n (a walked round or leg was detected); never lowers it, never passes the target. */
  function setAtLeast(R, rite, n) {
    const v = view(R, rite);
    if (!v.target) return R.count[rite];
    R.count[rite] = Math.min(v.target, Math.max(R.count[rite], clampInt(n, 0, MAX_COUNT, 0)));
    return R.count[rite];
  }

  /** Start (or restart, if it was finished) a rite and make it the active one. */
  function start(R, rite) {
    if (!isRite(rite)) return null;
    if (R.done[rite]) {
      goto(R, rite, 0, 0);
      R.done[rite] = false;
    }
    R.last = rite;
    return view(R, rite);
  }

  /** One line for the mission card: "Umrah: Tawaf: 7 rounds (3 of 7)", or null when no rite is under way. */
  function summary(R) {
    const rite = R.last;
    if (!rite || R.done[rite]) return null;
    const v = view(R, rite);
    const part = v.target ? " (" + v.count + " of " + v.target + ")" : "";
    return TITLES[rite] + ": " + v.step.title + part;
  }

  /** Create a tracker (optionally restoring a saved snapshot). */
  function create(saved) {
    const R = sanitize(saved) || blank();
    return {
      start: (rite) => start(R, rite),
      view: (rite) => (isRite(rite) ? view(R, rite) : null),
      next: (rite) => (isRite(rite) ? next(R, rite) : null),
      back: (rite) => (isRite(rite) ? back(R, rite) : null),
      bump: (rite) => (isRite(rite) ? bump(R, rite) : null),
      setAtLeast: (rite, n) => (isRite(rite) ? setAtLeast(R, rite, n) : 0),
      summary: () => summary(R),
      get active() {
        return R.last && !R.done[R.last] ? R.last : null;
      },
      get ihram() {
        return R.ihram;
      },
      get cut() {
        return R.cut;
      },
      setIhram(on) {
        R.ihram = Boolean(on);
      },
      setCut(c) {
        R.cut = CUTS.indexOf(c) === -1 ? R.cut : c;
      },
      snapshot: () => JSON.parse(JSON.stringify(R)),
      restore(raw) {
        const clean = sanitize(raw);
        if (!clean) return false;
        Object.assign(R, clean);
        return true;
      },
    };
  }

  KQ.Sim.Umrah = { create, sanitize, STEPS, RITES, CUTS, TITLES };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
