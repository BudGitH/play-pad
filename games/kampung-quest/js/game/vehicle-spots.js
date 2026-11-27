/* ============================================================================
 * FILE: vehicle-spots.js
 * PURPOSE: Where the toy cars and bicycles are parked, in each region, and where they may not go
 *          (the no-drive zones: mosques, the mataf, the hawker centre, the flats' void decks...).
 * BUSINESS CONTEXT: AC-H6. In the kampung the spots are chosen here (the kerbside and carpark
 *   cars, the bicycles and scooters by the paths); in Makkah / Madinah they come from the world code (KQ.Holy.vehicleSpots,
 *   KQ.Holy.noDrive) with the anchors in KQ.HOLY as the fallback for the zones.
 * DEPENDENCIES: KQ.WorldParts.LAYOUT (the kampung plan), KQ.HOLY / KQ.Holy (optional: the
 *   Haramain data and world), KQ.Sim.Vehicle (zone shapes). Everything is read lazily and
 *   defensively: a missing module simply means no spots / no zones.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const PI = Math.PI;
  const MASJID = "Let's walk inside the masjid";
  /**
   * Car looks: a body style and a colour. The kampung mixes bright hatchbacks, sedans, taxis, an SUV and an MPV;
   * Makkah and Madinah are mostly white, silver and black (white taxis, SUVs, family MPVs) with the odd gold car.
   */
  const KAMPUNG_LOOKS = [
    { style: "hatch", color: 0xd0453a },
    { style: "sedan", color: 0xc8ccd0 },
    { style: "hatch", color: 0x2a3c5c },
    { style: "suv", color: 0xb02a2a },
    { style: "taxi", color: 0xf2f2f0 },
    { style: "sedan", color: 0x1d1d1f },
    { style: "mpv", color: 0x5a7d9a },
    { style: "hatch", color: 0x2f9d8f },
    { style: "taxi", color: 0xe8b818 },
    { style: "sedan", color: 0x2f6fb0 },
  ];
  const HOLY_LOOKS = [
    { style: "taxi", color: 0xf4f3ee },
    { style: "suv", color: 0xf1f0ea },
    { style: "sedan", color: 0xc9ccd2 },
    { style: "mpv", color: 0xf1f0ea },
    { style: "sedan", color: 0x23262b },
    { style: "taxi", color: 0xf4f3ee },
    { style: "suv", color: 0xc9ccd2 },
    { style: "sedan", color: 0xd9c28a },
    { style: "hatch", color: 0xf1f0ea },
    { style: "suv", color: 0x2a2d33 },
    { style: "mpv", color: 0xc9ccd2 },
    { style: "sedan", color: 0x8fa4b8 },
  ];
  /** Bicycle and scooter colours (the kampung's, which the Haramain streets share). */
  const BIKE_COLOURS = [
    0x2f6fb0, 0xd94f4f, 0x2b2b2b, 0xf2c230, 0x3f9a5a, 0xe8e8e8, 0x8a4fbf, 0xd9773a,
  ];
  const MOTO_COLOURS = [0xd94f4f, 0xf2c230, 0x2f6fb0, 0xe8e8e8, 0x3f9a5a, 0x2b2b2b];

  /** The region this page runs: "haramain" or "kampung" (the default). */
  function region() {
    let r = KQ.region;
    if (!r) {
      try {
        r = new URLSearchParams(location.search).get("region");
      } catch (err) {
        r = null;
      }
    }
    return r === "haramain" ? "haramain" : "kampung";
  }

  /**
   * Parked in the kampung: every car, bicycle and scooter the town shows. The cars stand along the E-W road and in
   * the carpark, the bicycles and scooters by the paths, the shops and the flats. Heading PI / 2 faces +x.
   */
  const KAMPUNG_CARS = [
    [-22, 2.1, PI / 2],
    [-17.5, 34.25, PI / 2],
    [-17.5, 29.25, PI / 2],
    [-17.5, 31.75, PI / 2],
    [-17.5, 36.75, PI / 2],
    [-10.5, 29.25, -PI / 2],
    [-10.5, 34.25, -PI / 2],
    [-10.5, 41.75, -PI / 2],
    [60, 2, PI / 2],
    [-62, -2, -PI / 2],
  ];
  const KAMPUNG_BIKES = [
    [-33, 8.4, PI / 2],
    [40, 8.6, PI / 2],
    [-31, 12, PI],
    [-29.8, 12, PI],
    [-28.6, 12, PI],
    [13.2, -8.4, PI],
    [13.2, -7.6, PI],
    [36.5, 43.2, PI / 2],
    [37.3, 43.2, PI / 2],
    [25.4, 7.6, PI / 2],
  ];
  const KAMPUNG_MOTOS = [
    [-19.2, 41.2, PI],
    [-19.2, 42.2, PI],
    [-19.2, 43.2, PI],
    [61, -7.3, PI / 2],
    [63, -7.3, PI / 2],
    [-21.5, 50.5, PI / 2],
  ];

  /** Rows of [x, z, heading] into kampung spots of one kind with colours / looks taken round the pool. */
  function kampungOf(kind, rows, look) {
    return rows.map((r, i) => Object.assign({ kind, x: r[0], z: r[1], heading: r[2] }, look(i)));
  }

  /** The spots of the kampung. */
  function kampungSpots() {
    return kampungOf("car", KAMPUNG_CARS, (i) => KAMPUNG_LOOKS[i % KAMPUNG_LOOKS.length])
      .concat(
        kampungOf("bike", KAMPUNG_BIKES, (i) => ({ color: BIKE_COLOURS[i % BIKE_COLOURS.length] })),
      )
      .concat(
        kampungOf("moto", KAMPUNG_MOTOS, (i) => ({ color: MOTO_COLOURS[i % MOTO_COLOURS.length] })),
      );
  }

  /** The look of the nth spot of a kind in Makkah and Madinah (the spot's own `style` / `color` win). */
  function holyLook(s, n) {
    if (s.kind === "car") return Object.assign({}, HOLY_LOOKS[n % HOLY_LOOKS.length], pick(s));
    const pool = s.kind === "bike" ? BIKE_COLOURS : MOTO_COLOURS;
    return Object.assign({ color: pool[n % pool.length] }, pick(s));
  }

  /** A spot's own look overrides, if it has any. */
  function pick(s) {
    const o = {};
    if (typeof s.style === "string") o.style = s.style;
    if (Number.isFinite(s.color)) o.color = s.color;
    return o;
  }

  /** The spots the Haramain world lists ({x, z, heading, kind}), given looks; [] when it lists none. */
  function haramainSpots() {
    const list = KQ.Holy && Array.isArray(KQ.Holy.vehicleSpots) ? KQ.Holy.vehicleSpots : [];
    const count = { car: 0, bike: 0, moto: 0 };
    return list
      .filter(
        (s) =>
          s && Number.isFinite(s.x) && Number.isFinite(s.z) && /^(car|bike|moto)$/.test(s.kind),
      )
      .map(function (s) {
        const look = holyLook(s, count[s.kind]++);
        return Object.assign(
          { kind: s.kind, x: s.x, z: s.z, heading: s.heading || 0, lhd: true },
          look,
        );
      });
  }

  /** The parking spots of this page's region. */
  function spots() {
    return region() === "haramain" ? haramainSpots() : kampungSpots();
  }

  /** A rectangle zone with its friendly line. */
  function rect(r, say, grow) {
    const g = grow || 0;
    return { x0: r.x0 - g, x1: r.x1 + g, z0: r.z0 - g, z1: r.z1 + g, say };
  }

  /** The kampung places a car never drives into: the mosque compound, hawker centre, shops, library, flats, playground. */
  function kampungZones() {
    const L = KQ.WorldParts && KQ.WorldParts.LAYOUT;
    if (!L) return [];
    const zones = [rect(L.mosque, MASJID), rect(L.hawker, "Let's walk in the hawker centre")];
    zones.push(rect(L.shops, "Let's walk along the shops", 2.5));
    zones.push(rect(L.library, "Let's walk into the library"));
    zones.push(rect(L.playground, "Let's walk to the playground"));
    L.blocks.forEach((b) => zones.push(rect(b, "Let's walk under the flats", 1)));
    return zones;
  }

  /** Fallback Haramain zones from the anchors in KQ.HOLY: the mataf, the Masjid al-Haram's mas'a, Nabawi and its courtyard. */
  function haramainZones() {
    const H = KQ.HOLY;
    if (!H) return [];
    const zones = [];
    if (H.makkah) {
      zones.push({
        x: H.makkah.mataf.x,
        z: H.makkah.mataf.z,
        r: H.makkah.mataf.r + 4,
        say: MASJID,
      });
      const m = H.makkah.masaLane;
      zones.push({ x0: m.x - m.w, x1: m.x + m.w, z0: m.z0 - 6, z1: m.z1 + 6, say: MASJID });
    }
    if (H.madinah) {
      const n = H.madinah.nabawi;
      zones.push({ x: n.x, z: n.z, w: n.w + 8, d: n.d + 8, say: MASJID });
      zones.push({
        x: H.madinah.umbrellas.x,
        z: H.madinah.umbrellas.z,
        r: H.madinah.umbrellas.r,
        say: MASJID,
      });
    }
    return zones;
  }

  /**
   * Every no-drive zone in force, in the shapes KQ.Sim.Vehicle.normalizeZones accepts: the
   * world's own (KQ.Holy.noDrive) plus the region's built-in ones. Read afresh each call so a
   * world that builds its list late still counts.
   */
  function zones() {
    const haram = region() === "haramain";
    const own = haram && KQ.Holy && Array.isArray(KQ.Holy.noDrive) ? KQ.Holy.noDrive : [];
    const base = haram ? haramainZones() : kampungZones();
    return KQ.Sim.Vehicle.normalizeZones(own.map(named).concat(base, extra));
  }

  /** A world zone with its friendly line: its own `say`, else from its name (mosques and the mataf are the masjid). */
  function named(z) {
    if (!z || typeof z.say === "string") return z;
    const mosque = /masjid|mataf|mas'a|haram|nabawi|quba|baqi/i.test(String(z.name || ""));
    return Object.assign({}, z, { say: mosque ? MASJID : "Let's walk here" });
  }

  /** Zones added at run time (tests, future regions): the same shapes as KQ.Holy.noDrive. */
  const extra = [];
  function addZone(z) {
    extra.push(z);
    return () => extra.splice(extra.indexOf(z), 1);
  }

  G.VehicleSpots = { region, spots, zones, addZone, MASJID };
})((window.KQ = window.KQ || {}));
