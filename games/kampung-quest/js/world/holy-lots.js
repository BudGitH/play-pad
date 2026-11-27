/* ============================================================================
 * FILE: holy-lots.js
 * PURPOSE: "Is this ground free to build on?" for the Haramain outskirts (KQ.WorldParts.HolyLots).
 *          Streets (with footways and dust verge), the Haram and its plazas, the Hajj sector, the
 *          existing hotels, vehicle spots and no-drive zones all keep a clearance so the new city
 *          blocks, camels and desert dressing never sit on a path the hero, the crowd or a car uses.
 * BUSINESS CONTEXT: the city fabric around the Haram (holy-city.js), camel yards (holy-camels.js)
 *   and desert dressing (holy-desert.js) all ask the same question; keeping one answer means the
 *   walk graph in holy-nav.js stays valid without being edited.
 * DEPENDENCIES: holy-makkah.js / holy-madinah.js (ROADS, HOTELS), holy-nav.js (vehicleSpots, noDrive).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  /** Footway width (3.5) plus the dusty verge and a little air. */
  const VERGE = 5.5;

  /** Rectangles that must stay open in Makkah: [x0, z0, x1, z1]. */
  const MAKKAH_KEEP = [
    [-80, -100, 80, 72], // the Haram, its minarets and the strip to the street (stalls, walk spurs)
    [-44, -124, 44, -50], // gate plaza and forecourt
    [-24, -150, 24, -112], // the clock tower
    [-72, -158, -48, -140], // the miqat bus stop
  ];

  /** The Hajj sector of Makkah: Mina, Muzdalifah, Arafah, Jamarat and their paths (no blocks; light dressing only). */
  const MAKKAH_SECTOR = [[-300, -100, -135, 75]];

  /** Rectangles that must stay open in Madinah. */
  const MADINAH_KEEP = [
    [540, -100, 660, 56], // the Prophet's Mosque and its courtyard
    [530, 94, 592, 146], // Masjid Quba
    [636, -12, 684, 32], // the Baqi'
    [576, -206, 624, -174], // Uhud viewpoint
    [585, -200, 615, -180],
  ];

  /** A road as the rectangle [x0, z0, x1, z1] of its carriageway, footways and dust verge, grown by `m`. */
  function roadRect(r, m) {
    const half = r.w / 2 + VERGE + m;
    return r.axis === "x"
      ? [r.from - half, r.at - half, r.to + half, r.at + half]
      : [r.at - half, r.from - half, r.at + half, r.to + half];
  }

  /** Do rectangles a and b ([x0, z0, x1, z1]) overlap? */
  function overlap(a, b) {
    return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  }

  /** True when a vehicle spot or a no-drive zone touches the rectangle grown by `m`. */
  function nearVehicles(q, m) {
    const H = KQ.Holy || {};
    const spots = Array.isArray(H.vehicleSpots) ? H.vehicleSpots : [];
    const hit = (s) =>
      s.x > q[0] - 7 - m && s.x < q[2] + 7 + m && s.z > q[1] - 7 - m && s.z < q[3] + 7 + m;
    if (spots.some(hit)) return true;
    const zones = Array.isArray(H.noDrive) ? H.noDrive : [];
    return zones.some((n) =>
      n.kind === "rect" ? overlap(q, [n.x0 - m, n.z0 - m, n.x1 + m, n.z1 + m]) : false,
    );
  }

  /**
   * A predicate `freeRect(x0, z0, x1, z1, m)` for one city: false when the rectangle grown by `m`
   * metres touches a road, a kept rectangle, a building already placed (`addBuilt`) or a vehicle spot.
   */
  function make(city) {
    const mk = city === "makkah";
    const roads = (mk ? P.HolyMakkah : P.HolyMadinah).ROADS;
    const keep = mk ? MAKKAH_KEEP : MADINAH_KEEP;
    const sector = mk ? MAKKAH_SECTOR : [];
    const built = [];
    const test = (list) => (x0, z0, x1, z1, m) => {
      const g = m || 0;
      const q = [x0 - g, z0 - g, x1 + g, z1 + g];
      return (
        !roads.some((r) => overlap(q, roadRect(r, 0))) &&
        !list.some((k) => overlap(q, k)) &&
        !built.some((b) => overlap(q, b)) &&
        !nearVehicles(q, 0)
      );
    };
    const free = test(keep.concat(sector));
    free.open = test(keep);
    free.addBuilt = (x0, z0, x1, z1) => built.push([x0, z0, x1, z1]);
    free.keep = keep;
    return free;
  }

  P.HolyLots = { make, overlap, roadRect, MAKKAH_KEEP, MAKKAH_SECTOR, MADINAH_KEEP, VERGE };
})((window.KQ = window.KQ || {}));
