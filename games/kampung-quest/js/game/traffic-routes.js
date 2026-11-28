/* ============================================================================
 * FILE: traffic-routes.js
 * PURPOSE: Where the ambient traffic cars drive: the road lanes they follow in each region, the kerbside parking
 *          bays they pull into, the looks of the cars, and how a car's place along its road turns into x, z and
 *          a heading.
 * BUSINESS CONTEXT: owner request for cars driven around the town. Kampung: the N-S road (the E-W road belongs to
 *   the bus, whose lanes sit too close to the middle for a car to share, see notes-vehicle-life.md); Makkah: the
 *   outer streets only, always clear of every no-drive zone (checked here against KQ.Holy.inNoDrive).
 * CONVENTIONS: a route has an `axis` ("z" runs north-south, "x" east-west), a stretch `from`..`to` along it and a
 *   lane `lane` (metres off the road's middle). Direction +1 goes toward increasing coordinate. Left-hand traffic
 *   in the kampung (a car keeps to the left of the middle), right-hand in Makkah.
 * DEPENDENCIES: KQ.WorldParts.LAYOUT (kampung roads and zebra crossings), KQ.Holy (Haramain no-drive zones).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const PI = Math.PI;
  /** Where cars enter and leave the kampung's N-S road (|z|), as the bus does at |x| 70. */
  const END = 70;
  /** The kampung lane and the bay's lateral offset (m off the road's middle); a bay is on the car's left kerb. */
  const LANE = 0.95;
  const BAY_X = 2.7;
  /** Kerbside parking bays on the N-S road (z), clear of the zebra crossings at z -31, -10, 10, 40 and the E-W junction. */
  const BAYS = [-52, -21, 22, 52];
  /** A Makkah lane's offset from the street's middle (m): between the rows of parked cars at +-3. */
  const HOLY_LANE = 1.3;
  /** Minimum clear distance from every Haramain no-drive zone for a lane to be used (m). */
  const ZONE_CLEAR = 6;
  const LOOKS = {
    kampung: [
      { style: "sedan", color: 0xf1f1ee },
      { style: "suv", color: 0x8e9399 },
      { style: "taxi", color: 0xf4f4f0 },
      { style: "hatch", color: 0x7a1f26 },
      { style: "mpv", color: 0xe9e9e6 },
      { style: "sedan", color: 0x23395b },
    ],
    haramain: [
      { style: "taxi", color: 0xf4f3ee },
      { style: "suv", color: 0xf1f0ea },
      { style: "sedan", color: 0xc9ccd2 },
    ],
  };
  /** Makkah's outer streets (centre z, stretch in x, half width): the ones the Haram's zones never touch. */
  const HOLY_STREETS = [
    { at: 85, from: -125, to: 120, half: 7, name: "Makkah south street" },
    { at: -175, from: -125, to: 120, half: 6, name: "Makkah north street" },
  ];

  /** The region this page runs. */
  const region = () => G.VehicleSpots.region();

  /** The kampung's N-S route. */
  function kampungRoutes() {
    return [
      {
        id: "ns",
        axis: "z",
        from: -END,
        to: END,
        lane: LANE,
        bays: BAYS,
        bayLat: BAY_X,
        rightHand: false,
      },
    ];
  }

  /** Is a lane of a Haramain street clear of every no-drive zone along its whole stretch? */
  function laneClear(s, lat) {
    const holy = KQ.Holy;
    if (!holy || typeof holy.inNoDrive !== "function") return false;
    for (let u = s.from; u <= s.to; u += 8) if (holy.inNoDrive(u, lat, ZONE_CLEAR)) return false;
    return true;
  }

  /** Makkah's outer routes: right-hand traffic, lanes 1.3 m off the middle (the parked cars stand at +-3, in the usual lanes), only where both lanes are clear of zones. */
  function holyRoutes() {
    return HOLY_STREETS.filter(
      (s) => laneClear(s, s.at + HOLY_LANE) && laneClear(s, s.at - HOLY_LANE),
    ).map((s) => ({
      id: "holy:" + s.at,
      axis: "x",
      centre: s.at,
      from: s.from,
      to: s.to,
      lane: HOLY_LANE,
      bays: [],
      rightHand: true,
      name: s.name,
    }));
  }

  /** The routes of this region. */
  function routes() {
    return region() === "haramain" ? holyRoutes() : kampungRoutes();
  }

  /** The heading of a car going `dir` (+1 / -1) on a route. */
  function headingOf(r, dir) {
    if (r.axis === "z") return dir > 0 ? 0 : PI;
    return dir > 0 ? PI / 2 : -PI / 2;
  }

  /** The lateral coordinate (x for an N-S road, z for an E-W one) of a car's lane going `dir`. */
  function laneCoord(r, dir) {
    if (r.axis === "z") return dir * r.lane; // left-hand traffic: south-bound (heading 0) on +x
    return r.centre + dir * r.lane; // right-hand traffic: east-bound (heading +x) on the +z side
  }

  /** The bay's lateral coordinate for a car going `dir` (the kerb on its left, kampung only). */
  const bayCoord = (r, dir) => dir * r.bayLat;

  /** World x, z of a place on a route: `u` along it, `lat` the lateral coordinate. */
  const pointAt = (r, u, lat) => (r.axis === "z" ? { x: lat, z: u } : { x: u, z: lat });

  /** The along-coordinate of a world point on a route. */
  const alongOf = (r, x, z) => (r.axis === "z" ? z : x);

  /** The zebra crossings over a route's road, for Sim.Traffic.crossingCap: {axis, at, half, margin}. */
  function crossingsOf(r) {
    const L = KQ.WorldParts && KQ.WorldParts.LAYOUT;
    if (!L || r.axis !== "z") return [];
    return L.crossings
      .filter((c) => c.axis === "z")
      .map((c) => ({ axis: "z", at: c.at, half: L.road.half, margin: 0.8 }));
  }

  /** The look of the nth traffic car. */
  function lookOf(n) {
    const list = LOOKS[region()];
    return list[n % list.length];
  }

  G.TrafficRoutes = {
    END,
    routes,
    headingOf,
    laneCoord,
    bayCoord,
    pointAt,
    alongOf,
    crossingsOf,
    lookOf,
    BAYS,
    LANE,
    BAY_X,
    ZONE_CLEAR,
  };
})((window.KQ = window.KQ || {}));
