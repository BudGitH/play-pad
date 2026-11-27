/* ============================================================================
 * FILE: vehicle-spots.js
 * PURPOSE: Where the toy cars and bicycles are parked, in each region, and where they may not go
 *          (the no-drive zones: mosques, the mataf, the hawker centre, the flats' void decks...).
 * BUSINESS CONTEXT: AC-H6. In the kampung the spots are chosen here (a kerbside car, a carpark
 *   bay, two bicycles); in Makkah / Madinah they come from the world code (KQ.Holy.vehicleSpots,
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
  /** Body colours: a kampung mix, and the white / silver / gold cars of Makkah and Madinah. */
  const KAMPUNG_CARS = [0xd0453a, 0x2f9d8f];
  const KAMPUNG_BIKES = [0x2f8f5b, 0xe8a21a];
  const HOLY_CARS = [0xf1f0ea, 0xc9ccd2, 0xd9c28a, 0xf1f0ea, 0x8fa4b8];
  const HOLY_BIKES = [0x2f8f5b, 0x2f6fb0, 0xe8a21a];

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

  /** Parked in the kampung: a kerbside car on the E-W road, a carpark bay, two bicycles by the paths. */
  function kampungSpots() {
    return [
      { kind: "car", x: -22, z: 2.1, heading: PI / 2, color: KAMPUNG_CARS[0] },
      { kind: "car", x: -17.5, z: 34.25, heading: PI / 2, color: KAMPUNG_CARS[1] },
      { kind: "bike", x: -33, z: 8.4, heading: PI / 2, color: KAMPUNG_BIKES[0] },
      { kind: "bike", x: 40, z: 8.6, heading: PI / 2, color: KAMPUNG_BIKES[1] },
    ];
  }

  /** The spots the Haramain world lists ({x, z, heading, kind}), given body colours; [] when it lists none. */
  function haramainSpots() {
    const list = KQ.Holy && Array.isArray(KQ.Holy.vehicleSpots) ? KQ.Holy.vehicleSpots : [];
    let cars = 0;
    let bikes = 0;
    return list
      .filter(
        (s) => s && Number.isFinite(s.x) && Number.isFinite(s.z) && /^(car|bike)$/.test(s.kind),
      )
      .map(function (s) {
        const pool = s.kind === "car" ? HOLY_CARS : HOLY_BIKES;
        const i = s.kind === "car" ? cars++ : bikes++;
        return {
          kind: s.kind,
          x: s.x,
          z: s.z,
          heading: s.heading || 0,
          color: pool[i % pool.length],
        };
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
