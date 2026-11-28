/* ============================================================================
 * FILE: map-places.js
 * PURPOSE: Turns the establishment registry (js/data/places.js) into the places of the world the hero
 *          is in: for a region / city, each source is looked up in the world's POI table (or, for a
 *          place that has no POI, a named lookup into the world data: KQ.HOLY, the camel yard, the
 *          layout, the hotels, the vehicle spots) and becomes { id, kind, x, z, label, city, node, reach }.
 *          Nothing is positioned here twice: move a POI and the map follows. A source whose POI or data
 *          is missing is skipped (camel_yard, horse_stable and pony_ride appear when they exist).
 * BUSINESS CONTEXT: playability round AC-P1; read by map-markers.js (radar), bigmap.js (full map)
 *   and map-target.js (go here).
 * DEPENDENCIES: KQ.PLACES, KQ.HOLY, KQ.WorldParts (LAYOUT, HolyCamels, HolyMakkah, HolyMadinah),
 *   KQ.Game.VehicleSpots, KQ.Sim.MapView, the world's pois / poisOf(city).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const WP = () => KQ.WorldParts || {};
  /** Hotels shown in Madinah (the nearest to the Prophet's Mosque), and the vehicle-park grid. */
  const MADINAH_HOTELS = 2;
  const PARK_CELL = 80;
  const PARK_MIN = 4;
  const cache = { world: null, lists: {} };

  /** The cities of the region this world holds. */
  const cities = (s) => (s.world.region === "haramain" ? ["makkah", "madinah"] : ["kampung"]);

  /** The city the hero is in now: "kampung", "makkah" or "madinah". */
  function cityNow(s) {
    return s.world.region === "haramain" && s.world.city ? s.world.city() : "kampung";
  }

  /** The playable rectangle of a city { x0, z0, x1, z1 }, from the world's own constants. */
  function bounds(city) {
    if (city === "makkah") return WP().HolyMakkah.BOUNDS;
    if (city === "madinah") return WP().HolyMadinah.BOUNDS;
    const h = WP().LAYOUT.half + 2;
    return { x0: -h, z0: -h, x1: h, z1: h };
  }

  /** Is a world point inside a city? */
  function inCity(city, x, z) {
    const b = bounds(city);
    return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  }

  /** A city's POI table: the world's own for the current city, `poisOf(city)` for the other one. */
  function poisOf(s, city) {
    const w = s.world;
    return w.poisOf ? w.poisOf(city) : w.pois;
  }

  /** The centre and reach (metres from the centre that count as "there") of a rectangle { x0, z0, x1, z1 }. */
  function rectPoint(r) {
    const reach = Math.max(r.x1 - r.x0, r.z1 - r.z0) / 2 + 3;
    return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, reach };
  }

  /** A site of KQ.HOLY by its dotted path ("makkah.kaaba"): its centre, and a reach from its size. */
  function holyPoint(path) {
    const o = path.split(".").reduce((a, k) => (a ? a[k] : null), KQ.HOLY);
    if (!o) return null;
    const size = o.w ? Math.max(o.w, o.d || 0) / 2 : o.r || 0;
    return { x: o.x, z: o.z, reach: size + 3 };
  }

  /** The three camel places of Makkah's outskirts (holy-camels.js exposes their data). */
  function camelPoint(name) {
    const C = WP().HolyCamels;
    if (!C) return null;
    if (name === "yard") return rectPoint(C.YARD);
    if (name === "caravan") return { x: C.CARAVAN.cx, z: C.CARAVAN.cz, reach: C.CARAVAN.rx + 6 };
    return { x: C.OASIS.x, z: C.OASIS.z, reach: 14 };
  }

  /** The Madinah hotels nearest the Prophet's Mosque (HolyMadinah.HOTELS rows: x0, z0, x1, z1, height). */
  function hotelPoints() {
    const rows = ((WP().HolyMadinah && WP().HolyMadinah.HOTELS) || []).filter((r) => r.length >= 5);
    const n = KQ.HOLY.madinah.nabawi;
    const pts = rows.map((r) => rectPoint({ x0: r[0], z0: r[1], x1: r[2], z1: r[3] }));
    pts.sort((a, b) => Math.hypot(a.x - n.x, a.z - n.z) - Math.hypot(b.x - n.x, b.z - n.z));
    return pts.slice(0, MADINAH_HOTELS);
  }

  /** The places to find a ride: grid cells holding several parked vehicles (the Haramain streets). */
  function ridePoints(city) {
    const spots = G.VehicleSpots ? G.VehicleSpots.spots() : [];
    const here = spots.filter((v) => inCity(city, v.x, v.z));
    return KQ.Sim.MapView.clusterGrid(here, PARK_CELL, PARK_MIN).map((c) =>
      Object.assign(c, { reach: 10 }),
    );
  }

  /** Named lookups for places that are not POIs: always an array of points (possibly empty). */
  function lookup(at, city) {
    const one = (p) => (p ? [p] : []);
    if (at.indexOf("holy:") === 0) return one(holyPoint(at.slice(5)));
    if (at.indexOf("camels:") === 0) return one(camelPoint(at.slice(7)));
    if (at === "layout:carpark")
      return one(Object.assign(rectPoint(WP().LAYOUT.carpark), { reach: 8 }));
    if (at === "hotels:madinah") return hotelPoints();
    return at === "rides" ? ridePoints(city) : [];
  }

  /** The point(s) of one source: its POI when the world has it, else its named lookup. */
  function pointsOf(src, pois, city) {
    const poi = src.poi && pois[src.poi];
    if (poi) return [{ x: poi.pos.x, z: poi.pos.z, node: poi.node, reach: 4 }];
    return src.at ? lookup(src.at, city) : [];
  }

  /** The places of a city (cached for the lifetime of the world). */
  function list(s, city) {
    if (cache.world !== s.world) {
      cache.world = s.world;
      cache.lists = {};
    }
    if (cache.lists[city]) return cache.lists[city];
    const pois = poisOf(s, city) || {};
    const out = [];
    KQ.PLACES.SOURCES[city].forEach(function (src) {
      pointsOf(src, pois, city).forEach(function (p, i) {
        const label = src.label || KQ.PLACES.KINDS[src.kind].label;
        out.push(
          Object.assign({ id: src.id + (i ? "#" + i : ""), kind: src.kind, label, city }, p),
        );
      });
    });
    cache.lists[city] = out;
    return out;
  }

  /** One place of a city by id (or null). */
  function find(s, city, id) {
    return list(s, city).find((p) => p.id === id) || null;
  }

  /** The kind table entry of a place (colour, icon, priority). */
  const kindOf = (place) => KQ.PLACES.KINDS[place.kind];

  G.MapPlaces = { cities, cityNow, bounds, inCity, list, find, kindOf };
})((window.KQ = window.KQ || {}));
