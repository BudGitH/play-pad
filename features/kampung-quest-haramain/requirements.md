# Kampung Quest — Haramain (Makkah & Madinah) + easier tasks

Feature tier: Standard. Personas: young Muslim child (6-10) playing with a parent; parent checking accuracy.
(Product step skipped by owner instruction, 2026-11-27.)

## Owner request (paraphrased)
Add a Makkah / Madinah scenery: Masjid al-Haram (Kaaba, tawaf), Masjid Nabawi (interior as accurate as we can,
representative), pilgrims praying. Tasks: Umrah step by step, Hajj highlights, ziarah. Enter cars, ride bicycles
outside. Times of day. NPC voices play with speech bubbles. Make eating / praying tasks easy: a simple
step-by-step UI (frame by frame, item by item, word by word); surahs shown in full and scrollable. Sunni practice.

Note: Masjid Nabawi is in **Madinah**, not Makkah — the region holds both cities with a bus between them.

## Region contract
- `?region=haramain` (also a "Travel to Makkah & Madinah" title/pause option that saves the choice and reloads).
  Default stays `kampung`; existing tests must stay green.
- Anchors: `js/data/holy-sites.js` (`KQ.HOLY`). Qibla in Makkah = toward the Kaaba.
- Prayer times for the region: Umm al-Qura Makkah times (cite source in the data file or mark as approximate).

## Acceptance criteria
- AC-H1 Haramain world loads with no console errors (http + file://), Kaaba + mataf + maqam + Zamzam + Safa/Marwa,
  Nabawi exterior (green dome, minarets, umbrellas) and interior (white columns with arches, red carpet rows,
  green-carpet Rawdah, mihrab, minbar, chandeliers). No depiction of the Prophet ﷺ or the Companions; no faces on
  the Kaaba or graves; the grave area is a closed green/brass screen only.
- AC-H2 Pilgrims: crowd in ihram (men two white cloths, women modest), circling the Kaaba anticlockwise, standing in
  prayer rows facing qibla, sitting reading Quran in Nabawi. Uses the instanced crowd budget.
- AC-H3 Umrah stepper: ihram + niyyah at miqat, talbiyah, tawaf 7 anticlockwise rounds starting at the Black Stone
  corner (istilam wave, "Bismillah, Allahu Akbar"), 2 raka'at behind Maqam Ibrahim, Zamzam, sa'i 7 legs Safa→Marwa
  (Safa start, Marwa end), tahallul. Each step: one card, one "Next" button, full text with Arabic, transliteration,
  meaning; round/leg counter. Walking is optional: a "Go there" button moves the hero.
- AC-H4 Hajj highlights stepper (8-13 Dhul Hijjah): Mina, Arafah (wuquf), Muzdalifah (pebbles), Jamarat
  (Aqabah 7 pebbles), qurban, hair, Tawaf Ifadah, sa'i, days of tashriq, Tawaf Wada'. Simplified, child-friendly.
- AC-H5 Ziarah: Nabawi salam, pray in Rawdah (2 raka'at), Quba (2 raka'at), Uhud, Baqi' (visit, dua, no
  touching/kissing of graves).
- AC-H6 Vehicles: enter / exit a car (drive) and ride a bicycle in both regions; never harm anyone; not inside
  mosques/mataf.
- AC-H7 Voices: every NPC speech bubble / dialogue line is also spoken (Web Speech API, per-character pitch/rate);
  muted setting respected; silent fallback when unavailable; never during azan.
- AC-H8 Easy task UI: prayer and eating flows become one-card-at-a-time steppers with a big Next; recitation shown
  word by word (tap word / auto-highlight) with the full surah available in a scrollable panel. Shafi'i/Sunni.
