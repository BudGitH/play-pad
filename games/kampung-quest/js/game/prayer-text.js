/* ============================================================================
 * FILE: prayer-text.js
 * PURPOSE: The words of the prayer screens: the picture-tile labels, the short dhikr shown after
 *          each posture (Arabic, transliteration, English), the azan caption cues (with a safe
 *          fallback when KQ.AZAN_TEXT is missing) and the gentle copy.
 * BUSINESS CONTEXT: AC-8 / AC-7 and business rule 5 (religious accuracy, Shafi'i practice as in
 *   Singapore). The recitations are the standard ones: takbir, Al-Fatihah opening, ruku',
 *   i'tidal, sujud, between the two sujud, tasyahud, salam, qunut (Subuh).
 * DEPENDENCIES: KQ.AZAN_TEXT (optional), KQ.Sim.Prayer.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});

  const D = (ar, tr, en) => ({ ar, tr, en });
  const DHIKR = {
    takbir: D("ٱللَّٰهُ أَكْبَرُ", "Allahu akbar", "Allah is the Greatest"),
    qiyam: D(
      "بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ۝ ٱلْحَمْدُ لِلَّٰهِ رَبِّ ٱلْعَٰلَمِينَ",
      "Bismillahir-rahmanir-rahim. Alhamdu lillahi rabbil 'alamin",
      "In the name of Allah, the Most Kind, the Most Merciful. All praise is for Allah, Lord of the worlds",
    ),
    ruku: D(
      "سُبْحَانَ رَبِّيَ ٱلْعَظِيمِ",
      "Subhana rabbiyal 'azim (3 times)",
      "Glory be to my Lord, the Most Great",
    ),
    itidal: D(
      "سَمِعَ ٱللَّٰهُ لِمَنْ حَمِدَهُ",
      "Sami'allahu liman hamidah",
      "Allah hears whoever praises Him",
    ),
    qunut: D(
      "ٱللَّٰهُمَّ ٱهْدِنِي فِيمَنْ هَدَيْتَ",
      "Allahummahdini fiman hadait",
      "O Allah, guide me among those You have guided",
    ),
    sujud: D(
      "سُبْحَانَ رَبِّيَ ٱلْأَعْلَىٰ",
      "Subhana rabbiyal a'la (3 times)",
      "Glory be to my Lord, the Most High",
    ),
    julus: D("رَبِّ ٱغْفِرْ لِي", "Rabbighfir li", "My Lord, forgive me"),
    tasyahud: D("ٱلتَّحِيَّاتُ لِلَّٰهِ", "At-tahiyyatu lillah", "All greetings are for Allah"),
    salam: D(
      "ٱلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ ٱللَّٰهِ",
      "Assalamu 'alaikum wa rahmatullah",
      "Peace and Allah's mercy be upon you",
    ),
    // The doa after wudu (the shahadatayn), said at the end of wudu.
    doa: D(
      "أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا ٱللَّٰهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ",
      "Ashhadu an la ilaha illallah wahdahu la syarika lah, wa ashhadu anna Muhammadan 'abduhu wa rasuluh",
      "I bear witness that there is no god but Allah alone, who has no partner, and I bear witness that Muhammad is His servant and His Messenger",
    ),
  };

  /** [label, sub, picture key, dhikr key] per prayer step type. */
  const TILE = {
    takbir: ["Takbir", "Hands up", "takbir", "takbir"],
    qiyam: ["Qiyam", "Stand", "qiyam", "qiyam"],
    ruku: ["Ruku", "Bow", "ruku", "ruku"],
    itidal: ["I'tidal", "Stand up", "itidal", "itidal"],
    sujud: ["Sujud", "Forehead down", "sujud", "sujud"],
    julus: ["Julus", "Sit", "julus", "julus"],
    tasyahud_awal: ["Tasyahud", "Sit (first)", "tasyahud", "tasyahud"],
    tasyahud_akhir: ["Tasyahud", "Sit (last)", "tasyahud", "tasyahud"],
    salam_r: ["Salam", "Turn right", "salam_r", "salam"],
    salam_l: ["Salam", "Turn left", "salam_l", "salam"],
    qunut: ["Doa qunut", "Palms up", "qunut", "qunut"],
  };
  const NATURAL = [
    "takbir",
    "qiyam",
    "ruku",
    "itidal",
    "qunut",
    "sujud",
    "julus",
    "tasyahud_awal",
    "tasyahud_akhir",
    "salam_r",
    "salam_l",
  ];
  const POOL = [
    "takbir",
    "qiyam",
    "ruku",
    "itidal",
    "sujud",
    "julus",
    "tasyahud_awal",
    "salam_r",
    "salam_l",
  ];

  const FALLBACK_AZAN = [
    {
      ar: "ٱللَّٰهُ أَكْبَرُ، ٱللَّٰهُ أَكْبَرُ",
      translit: "Allahu Akbar, Allahu Akbar",
      en: "Allah is the Greatest, Allah is the Greatest",
      start: 0,
      end: 6,
    },
  ];

  /** The azan caption cues from the data file, or a short built-in set if the data did not load. */
  function azanCues() {
    return Array.isArray(KQ.AZAN_TEXT) && KQ.AZAN_TEXT.length ? KQ.AZAN_TEXT : FALLBACK_AZAN;
  }

  /** The clear name of the voluntary prayer, shown on the Pray button, panel and praise card. */
  const SUNAT_NAME = "Sunat prayer";
  /** The same name with its length, for screen readers and the panel. */
  const SUNAT_LABEL = SUNAT_NAME + " (2 raka'at)";

  /**
   * What to call a prayer flow on screen: "Zohor", "Zohor (make-up)" or, for the voluntary one,
   * "Sunat prayer".
   */
  function flowLabel(name, kind) {
    if (name === KQ.Sim.Prayer.SUNAT) return SUNAT_NAME;
    return KQ.Sim.Prayer.DISPLAY[name] + (kind === "qada" ? " (make-up)" : "");
  }

  /** The azan card title for a prayer, e.g. "It's Zohor time! Let's go and pray." */
  function title(name) {
    return "It's " + KQ.Sim.Prayer.DISPLAY[name] + " time! Let's go and pray.";
  }

  /**
   * The short, picture-first hint after a wrong posture tap, naming the expected tile: "Nearly!
   * Next: Ruku (bow)." Unknown types give an empty hint (never an error message).
   */
  function nextHint(type) {
    const t = TILE[type];
    if (!t) return "";
    const sub = t[1].toLowerCase();
    return (
      "Nearly! Next: " + t[0] + (sub.indexOf("(") === -1 ? " (" + sub + ")." : " - " + sub + ".")
    );
  }

  /** Four tiles for the "what comes next" question: the valid next step(s) plus look-alike-free decoys. */
  function choices(valid, seed) {
    const same = (a, b) => TILE[a][2] === TILE[b][2];
    const pool = POOL.filter((t) => !valid.some((v) => same(t, v)) && valid.indexOf(t) === -1);
    const picks = valid.slice();
    let h = seed >>> 0;
    while (picks.length < 4 && pool.length) {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      const t = pool.splice(h % pool.length, 1)[0];
      if (!picks.some((p) => same(p, t))) picks.push(t);
    }
    return picks.sort((a, b) => NATURAL.indexOf(a) - NATURAL.indexOf(b));
  }

  /** What the hero does in each posture, in one short child-friendly sentence (shown on the step card). */
  const STEP_HOW = {
    takbir:
      "Face the qibla, raise both hands to your ears and say Allahu akbar. Make your niat in your heart.",
    qiyam: "Stand with your hands folded on your chest and read Al-Fatihah.",
    ruku: "Bow with a flat back and your hands on your knees.",
    itidal: "Stand up straight again.",
    qunut: "Subuh only: raise your palms and make this dua. You may skip it.",
    sujud: "Put your forehead, nose, hands, knees and toes on the ground.",
    julus: "Sit up calmly between the two prostrations.",
    tasyahud_awal: "Sit for the first tasyahud.",
    tasyahud_akhir: "Sit for the last tasyahud and ask Allah to bless the Prophet.",
    salam_r: "Turn your face to the right and say the salam.",
    salam_l: "Now turn to the left and say the salam.",
  };

  /** Ritual text ids per posture (see js/data/ritual-text.js); the first one is read word by word first. */
  const STEP_TEXTS = {
    takbir: ["takbir"],
    qiyam: ["fatihah"],
    ruku: ["ruku"],
    itidal: ["itidal"],
    qunut: ["qunut"],
    sujud: ["sujud"],
    julus: ["julus"],
    tasyahud_awal: ["tashahhud"],
    tasyahud_akhir: ["tashahhud", "salawat"],
    salam_r: ["salam"],
    salam_l: ["salam"],
  };
  /** The short surahs offered after Al-Fatihah in the first two raka'at (any short surah is fine). */
  const SHORT_SURAHS = ["ikhlas", "kawthar", "kafirun", "falaq", "nas"];

  /** The ritual text items for a posture card: Al-Fatihah plus the short surahs in raka'at 1 and 2. */
  function cardTexts(type, rakaat) {
    const ids = (STEP_TEXTS[type] || []).slice();
    if (type === "qiyam" && rakaat <= 2) ids.push(...SHORT_SURAHS);
    const all = KQ.RITUAL_TEXT || {};
    return ids.filter((id) => all[id]).map((id) => Object.assign({ id }, all[id]));
  }

  /** The one-line instruction for a posture (empty for an unknown type). */
  function howFor(type) {
    return STEP_HOW[type] || "";
  }

  /** What each wudu step says or reads, if anything: the niat, Bismillah and the doa after wudu. */
  const WUDU_TEXTS = { niat: ["wuduNiyyah"], hands: ["bismillah"], doa: ["wuduDoa"] };

  /** The ritual text items for a wudu step card. */
  function wuduTexts(id) {
    const all = KQ.RITUAL_TEXT || {};
    return (WUDU_TEXTS[id] || []).filter((k) => all[k]).map((k) => Object.assign({ id: k }, all[k]));
  }

  G.PrayerText = {
    DHIKR,
    TILE,
    SUNAT_NAME,
    SUNAT_LABEL,
    azanCues,
    title,
    flowLabel,
    choices,
    nextHint,
    cardTexts,
    howFor,
    wuduTexts,
  };
})((window.KQ = window.KQ || {}));
