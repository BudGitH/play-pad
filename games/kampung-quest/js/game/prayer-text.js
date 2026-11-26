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
      "ٱلْحَمْدُ لِلَّٰهِ رَبِّ ٱلْعَٰلَمِينَ",
      "Alhamdu lillahi rabbil 'alamin",
      "All praise is for Allah, Lord of the worlds",
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
    doa: D(
      "رَبَّنَا آتِنَا فِي ٱلدُّنْيَا حَسَنَةً",
      "Rabbana atina fid-dunya hasanah",
      "Our Lord, give us good in this world",
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

  function azanCues() {
    return Array.isArray(KQ.AZAN_TEXT) && KQ.AZAN_TEXT.length ? KQ.AZAN_TEXT : FALLBACK_AZAN;
  }

  function title(name) {
    return "It's " + KQ.Sim.Prayer.DISPLAY[name] + " time! Let's go and pray.";
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

  G.PrayerText = { DHIKR, TILE, azanCues, title, choices };
})((window.KQ = window.KQ || {}));
