/**
 * Kampung Quest - hard-coded Singapore prayer times for 26 November 2026.
 *
 * Source: MUIS (Majlis Ugama Islam Singapura) "Muslim Prayer Timetable 2026",
 * published on Singapore's open-data portal data.gov.sg, dataset id
 * d_d441e7242e78efc566024dd5b0d9829c (agency: Majlis Ugama Islam Singapura,
 * last updated 2026-04-02). Row 2026-11-26 (Thurs). Retrieved 2026-11-26 via
 * https://api-production.data.gov.sg/v1/public/api/datasets/<id>/poll-download.
 * Cross-checked: the same agency's consolidated dataset
 * d_a6a206cba471fe04b62dd886ef5eaf22 gives identical values.
 * (muis.gov.sg itself returned HTTP 403 to automated access.)
 *
 * No network, no geolocation: the game uses these fixed values only.
 */
(function (KQ) {
  "use strict";

  KQ.PRAYER_TIMES = Object.freeze({
    date: "2026-11-26",
    source:
      "MUIS (Majlis Ugama Islam Singapura), Muslim Prayer Timetable 2026, " +
      "via data.gov.sg dataset d_d441e7242e78efc566024dd5b0d9829c " +
      "(https://data.gov.sg/datasets/d_d441e7242e78efc566024dd5b0d9829c/view), " +
      "row 2026-11-26; retrieved 2026-11-26",
    subuh: "05:29",
    syuruk: "06:51",
    zohor: "12:54",
    asar: "16:17",
    maghrib: "18:54",
    isyak: "20:08",
  });
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
