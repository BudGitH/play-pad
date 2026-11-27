/**
 * Kampung Quest - prayer times for the Haramain region (Makkah and Madinah), late November 2026.
 *
 * APPROXIMATE, not copied from a published timetable. They are computed for Makkah (21.42 N,
 * 39.83 E, UTC+3) on 27 November 2026 with the Umm al-Qura method's parameters: Fajr at 18.5 deg
 * below the horizon, Isha 90 minutes after Maghrib, Maghrib at sunset, Asr when a shadow equals
 * the object's length (the Shafi'i / majority reckoning), Dhuhr at solar noon. Expect up to
 * about 3 minutes of difference from the official Umm al-Qura calendar; Madinah is within about
 * 2 minutes of the same values. The game uses these fixed values only (no network, no
 * geolocation). Keys keep the Malay-named ids the rest of the game uses (subuh = Fajr,
 * zohor = Dhuhr, isyak = Isha).
 *
 * Loads after prayer-times.js and replaces KQ.PRAYER_TIMES when the region is "haramain".
 */
(function (KQ) {
  "use strict";

  KQ.PRAYER_TIMES_MAKKAH = Object.freeze({
    date: "2026-11-27",
    source:
      "Approximate: computed for Makkah (21.42 N, 39.83 E, UTC+3) with Umm al-Qura parameters " +
      "(Fajr 18.5 deg, Isha 90 min after Maghrib). Not an official timetable.",
    approximate: true,
    subuh: "05:18",
    syuruk: "06:39",
    zohor: "12:08",
    asar: "15:15",
    maghrib: "17:37",
    isyak: "19:07",
  });
  if (KQ.region === "haramain") KQ.PRAYER_TIMES = KQ.PRAYER_TIMES_MAKKAH;
})((window.KQ = window.KQ || {}));
