/* ============================================================================
 * FILE: holy-sites.js
 * PURPOSE: Shared anchors for the Haramain region (Makkah + Madinah): where each
 *          site sits in world metres, so world, crowd, ritual and vehicle code agree.
 * BUSINESS CONTEXT: features/kampung-quest-haramain/requirements.md (the region contract).
 *   Distances are scaled down for play (the real mas'a is ~450 m; here it is 80 m).
 * DEPENDENCIES: none (data only, loads before js/sim).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const p = (x, z, r) => Object.freeze({ x, z, r: r || 4 });
  /** Region ids. "kampung" = the original Singapore neighbourhood (default). */
  KQ.REGIONS = Object.freeze(["kampung", "haramain"]);
  KQ.HOLY = Object.freeze({
    spawn: p(0, -95), // hotel forecourt south of the Haram, Makkah
    makkah: Object.freeze({
      kaaba: Object.freeze({ x: 0, z: 0, w: 10, d: 12, h: 13, blackStoneCorner: "SE" }),
      mataf: p(0, 0, 26), // open marble ring for tawaf
      maqamIbrahim: p(4, -9, 1.5),
      hijrIsmail: p(-8, 0, 5), // semicircle on the NW side
      zamzam: p(-22, -24, 3),
      safa: p(42, -40, 4),
      marwa: p(42, 40, 4),
      masaLane: Object.freeze({ x: 42, z0: -40, z1: 40, w: 10 }), // sa'i corridor
      greenLights: Object.freeze({ z0: -8, z1: 8 }), // men walk briskly between these
      gate: p(0, -55, 5), // King Abdul Aziz gate
      hairSalon: p(20, -80, 3), // tahallul (shave / trim)
      clockTower: p(0, -130, 12),
      miqat: p(-60, -150, 5), // bus stop "Miqat (Masjid Aisyah, Tan'im)"
    }),
    hajj: Object.freeze({
      mina: p(-180, -40, 20),
      arafah: p(-260, 40, 25), // Jabal Rahmah at its centre
      muzdalifah: p(-220, -10, 15),
      jamarat: p(-150, -70, 12), // three pillars along x
    }),
    madinah: Object.freeze({
      origin: p(600, 0, 0),
      nabawi: Object.freeze({ x: 600, z: 0, w: 70, d: 60 }), // prayer hall footprint
      greenDome: p(612, 22, 6), // over the south-east corner (qibla side = +z here)
      rawdah: Object.freeze({ x: 606, z: 18, w: 12, d: 8 }), // green carpet zone
      mihrab: p(604, 29, 1.5),
      minbar: p(598, 27, 1.5),
      salamWall: p(612, 26, 2), // where visitors give salam (ziarah)
      umbrellas: p(600, -50, 30), // courtyard umbrellas
      quba: p(560, 120, 8),
      uhud: p(600, -220, 40),
      baqi: p(660, 10, 15),
      busStop: p(600, -90, 4),
    }),
    /** Qibla in Makkah points at the Kaaba; in Madinah it is +z (south) by our layout. */
    madinahQibla: Object.freeze({ x: 0, z: 1 }),
  });
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
