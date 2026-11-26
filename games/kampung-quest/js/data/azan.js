/**
 * Kampung Quest - azan (call to prayer) caption cues.
 *
 * Recording: assets/audio/azan.ogg / azan.mp3 (86.5 s), derived from
 * "The Adhan - Muslim Call to Prayer - Aaqib Azeez.mp3" (Wikimedia Commons,
 * CC BY-SA 4.0, uploader Atcovi). See assets/audio/azan_license.txt.
 *
 * Wording: the standard Sunni adhan as given in the Wikipedia article "Adhan"
 * (https://en.wikipedia.org/wiki/Adhan, table "Recital": takbir, shahadatayn,
 * hayya 'ala s-salah, hayya 'ala l-falah, closing takbir, la ilaha illallah;
 * the Subuh-only line "as-salatu khayrun mina n-nawm" after hayya 'ala
 * l-falah), cross-checked against the Subuh text in a Bisnis.com guide
 * (https://kabar24.bisnis.com/read/20240228/79/1735024/bacaan-adzan-sholat-subuh-lengkap-dan-doa-anjuran-rasulullah-saw).
 * Transliteration uses the common Malay/Singapore romanisation. The Shafi'i
 * practice of saying each testimony of faith twice matches this recording.
 *
 * Timing method: ffmpeg `silencedetect` (noise -35 dB, min 0.2 s) on the
 * shipped azan.ogg found 12 breath groups separated by silences; a Whisper
 * (faster-whisper "small", Arabic) pass over each group confirmed the words in
 * order. Each cue below is one breath group (start = silence end, end =
 * next silence start, in seconds from the file start, +/- ~0.1 s). The
 * "Allahu Akbar" pairs are sung legato with no silence between the two
 * repeats, so each pair is one cue; `repeat` says how many times it is said.
 *
 * The Subuh-only line has no audio (the same recording plays for every
 * prayer): it carries `subuhOnly: true` and null times. Show it as a caption
 * only, for Subuh, in the order position it occupies here (after the second
 * "Hayya 'alal-falah" cue, before the closing takbir).
 */
(function (KQ) {
  "use strict";

  KQ.AZAN_TEXT = Object.freeze([
    {
      ar: "ٱللَّٰهُ أَكْبَرُ، ٱللَّٰهُ أَكْبَرُ",
      translit: "Allahu Akbar, Allahu Akbar",
      en: "Allah is the Greatest, Allah is the Greatest",
      repeat: 2,
      start: 0.62,
      end: 5.14,
    },
    {
      ar: "ٱللَّٰهُ أَكْبَرُ، ٱللَّٰهُ أَكْبَرُ",
      translit: "Allahu Akbar, Allahu Akbar",
      en: "Allah is the Greatest, Allah is the Greatest",
      repeat: 2,
      start: 6.12,
      end: 10.81,
    },
    {
      ar: "أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا ٱللَّٰهُ",
      translit: "Asyhadu an la ilaha illallah",
      en: "I bear witness that there is no god but Allah",
      start: 11.47,
      end: 18.44,
    },
    {
      ar: "أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا ٱللَّٰهُ",
      translit: "Asyhadu an la ilaha illallah",
      en: "I bear witness that there is no god but Allah",
      start: 19.14,
      end: 26.54,
    },
    {
      ar: "أَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ ٱللَّٰهِ",
      translit: "Asyhadu anna Muhammadar Rasulullah",
      en: "I bear witness that Muhammad is the Messenger of Allah",
      start: 28.82,
      end: 36.87,
    },
    {
      ar: "أَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ ٱللَّٰهِ",
      translit: "Asyhadu anna Muhammadar Rasulullah",
      en: "I bear witness that Muhammad is the Messenger of Allah",
      start: 37.61,
      end: 45.49,
    },
    {
      ar: "حَيَّ عَلَى ٱلصَّلَاةِ",
      translit: "Hayya 'alas-solah",
      en: "Come to prayer",
      start: 47.85,
      end: 52.41,
    },
    {
      ar: "حَيَّ عَلَى ٱلصَّلَاةِ",
      translit: "Hayya 'alas-solah",
      en: "Come to prayer",
      start: 53.64,
      end: 58.8,
    },
    {
      ar: "حَيَّ عَلَى ٱلْفَلَاحِ",
      translit: "Hayya 'alal-falah",
      en: "Come to success",
      start: 60.17,
      end: 64.44,
    },
    {
      ar: "حَيَّ عَلَى ٱلْفَلَاحِ",
      translit: "Hayya 'alal-falah",
      en: "Come to success",
      start: 65.67,
      end: 70.22,
    },
    {
      ar: "ٱلصَّلَاةُ خَيْرٌ مِنَ ٱلنَّوْمِ",
      translit: "As-solatu khairum minan-naum",
      en: "Prayer is better than sleep",
      repeat: 2,
      subuhOnly: true,
      start: null,
      end: null,
    },
    {
      ar: "ٱللَّٰهُ أَكْبَرُ، ٱللَّٰهُ أَكْبَرُ",
      translit: "Allahu Akbar, Allahu Akbar",
      en: "Allah is the Greatest, Allah is the Greatest",
      repeat: 2,
      start: 71.99,
      end: 76.64,
    },
    {
      ar: "لَا إِلَٰهَ إِلَّا ٱللَّٰهُ",
      translit: "La ilaha illallah",
      en: "There is no god but Allah",
      start: 77.62,
      end: 83.99,
    },
  ]);
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
