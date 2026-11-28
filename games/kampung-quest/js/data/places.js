/* ============================================================================
 * FILE: places.js
 * PURPOSE: The establishment registry (KQ.PLACES): every kind of place a child can look for on the
 *          radar and the full map (its icon, colour, child-friendly name and how important it is), and
 *          WHERE each place comes from in each region / city. Positions are never written here: a
 *          source names a world POI (`poi`) or, when the world has no POI for it, a named lookup (`at`)
 *          that map-places.js resolves from the world data (KQ.HOLY, the camel yard, the layout). A source
 *          whose POI is absent is simply skipped, so a place another feature adds later (camel_yard,
 *          horse_stable, pony_ride) shows up by itself and is never an error.
 * BUSINESS CONTEXT: playability round AC-P1 (features/kampung-quest-playability/requirements.md): every
 *   establishment in both regions has a labelled icon on the full map and shows on the radar in range.
 * DEPENDENCIES: none (data only). Icon names are keys of KQ.Game.Pictures.ICONS (map-icons.js adds them).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  /**
   * Kinds. prio: lower wins when icons collide (1 = landmark ... 8 = small stuff). rim: keeps a
   * blip on the radar's edge when out of range. radar: false = full map only (too small / many).
   */
  const KINDS = Object.freeze({
    mosque: { label: "Mosque", icon: "mosque", color: "#30d158", prio: 1, rim: true, radar: true },
    kaaba: { label: "Kaaba", icon: "kaaba", color: "#1c1c22", prio: 1, rim: true, radar: true },
    nabawi: {
      label: "Prophet's Mosque",
      icon: "mosque",
      color: "#2f9e6e",
      prio: 1,
      rim: true,
      radar: true,
    },
    rawdah: { label: "Rawdah", icon: "star", color: "#1f8a5b", prio: 3, radar: true },
    gate: { label: "Gate", icon: "gate", color: "#3aa57a", prio: 3, radar: true },
    wudu: { label: "Wudu place", icon: "drop", color: "#4fb6e8", prio: 6, radar: false },
    water: { label: "Zamzam water", icon: "drop", color: "#3b9ed6", prio: 3, radar: true },
    food: {
      label: "Hawker centre",
      icon: "bowl",
      color: "#ff9f0a",
      prio: 2,
      rim: true,
      radar: true,
    },
    stall: { label: "Food stall", icon: "bowl", color: "#f2b13c", prio: 7, radar: false },
    shop: { label: "Shop", icon: "cart", color: "#e23b3b", prio: 4, radar: true },
    barber: { label: "Barber", icon: "scissors", color: "#2a62c9", prio: 5, radar: true },
    clinic: { label: "Clinic", icon: "cross", color: "#1a9c86", prio: 5, radar: true },
    library: { label: "Library", icon: "book", color: "#6d8fd0", prio: 4, radar: true },
    tailor: { label: "Tailor", icon: "shirt", color: "#b455d6", prio: 2, radar: true },
    home: { label: "Home", icon: "home", color: "#f4a8b8", ink: "#6b2a3a", prio: 3, radar: true },
    flats: { label: "Flats", icon: "flats", color: "#a79c86", prio: 6, radar: false },
    playground: { label: "Playground", icon: "swing", color: "#e0b449", prio: 4, radar: true },
    park: { label: "Park", icon: "tree", color: "#4b9a52", prio: 4, radar: true },
    bus: { label: "Bus stop", icon: "bus", color: "#5e8fe0", prio: 6, radar: true },
    rides: { label: "Cars and bikes", icon: "car", color: "#8a8f9c", prio: 7, radar: false },
    recycling: { label: "Recycling", icon: "recycle", color: "#3fae6a", prio: 8, radar: false },
    camel: { label: "Camels", icon: "camel", color: "#d4a24c", prio: 2, radar: true },
    horse: { label: "Horses", icon: "horse", color: "#b5651d", prio: 2, radar: true },
    oasis: { label: "Oasis", icon: "palm", color: "#2fa56a", prio: 5, radar: true },
    hotel: { label: "Hotel", icon: "hotel", color: "#6e7ac0", prio: 5, radar: true },
    hill: { label: "Hill", icon: "hill", color: "#c09a58", prio: 3, radar: true },
    hajj: { label: "Hajj place", icon: "tent", color: "#e0a458", prio: 5, radar: true },
    landmark: { label: "Landmark", icon: "clock", color: "#8a93a0", prio: 6, radar: true },
  });

  /**
   * Sources per region / city: { id, kind, poi?, at?, label? }. The id `mosque` is the place the prayer
   * guidance leads to (its blip grows and points while a prayer is due).
   */
  const SOURCES = Object.freeze({
    kampung: [
      { id: "mosque", kind: "mosque", poi: "mosque_gate", label: "Mosque" },
      { id: "wudu", kind: "wudu", poi: "mosque_wudu" },
      { id: "hawker", kind: "food", poi: "hawker" },
      { id: "stall_prata", kind: "stall", poi: "stall_prata", label: "Roti prata" },
      { id: "stall_nasi_lemak", kind: "stall", poi: "stall_nasi_lemak", label: "Nasi lemak" },
      { id: "stall_mee_soto", kind: "stall", poi: "stall_mee_soto", label: "Mee soto" },
      { id: "stall_drinks", kind: "stall", poi: "stall_drinks", label: "Drinks and kuih" },
      { id: "stall_satay", kind: "stall", poi: "stall_satay", label: "Satay" },
      { id: "minimart", kind: "shop", poi: "minimart", label: "Mini mart" },
      { id: "barber", kind: "barber", poi: "barber" },
      { id: "clinic", kind: "clinic", poi: "clinic" },
      { id: "library", kind: "library", poi: "library" },
      { id: "tailor", kind: "tailor", poi: "tailor", label: "Butik tailor" },
      { id: "home", kind: "home", poi: "home" },
      { id: "block_b", kind: "flats", poi: "block_b", label: "Block 120" },
      { id: "block_c", kind: "flats", poi: "block_c", label: "Block 122" },
      { id: "playground", kind: "playground", poi: "playground" },
      { id: "park", kind: "park", poi: "park" },
      { id: "bus_stop", kind: "bus", poi: "bus_stop" },
      { id: "carpark", kind: "rides", at: "layout:carpark", label: "Car park" },
      { id: "recycling", kind: "recycling", poi: "recycling" },
      { id: "pony_ride", kind: "horse", poi: "pony_ride", label: "Pony ride" },
    ],
    makkah: [
      { id: "kaaba", kind: "kaaba", at: "holy:makkah.kaaba" },
      { id: "mosque", kind: "mosque", poi: "mosque_gate", label: "Haram gate" },
      { id: "safa", kind: "hill", poi: "safa", label: "Safa" },
      { id: "marwa", kind: "hill", poi: "marwa", label: "Marwa" },
      { id: "zamzam", kind: "water", poi: "zamzam" },
      { id: "wudu", kind: "wudu", poi: "wudu" },
      { id: "tailor", kind: "tailor", poi: "tailor" },
      { id: "salon", kind: "barber", poi: "salon", label: "Hair salon" },
      { id: "hotel", kind: "hotel", poi: "forecourt", label: "Hotel" },
      { id: "clock", kind: "landmark", poi: "clock", label: "Clock tower" },
      { id: "miqat", kind: "bus", poi: "miqat", label: "Miqat bus stop" },
      { id: "mina", kind: "hajj", poi: "mina", label: "Mina" },
      { id: "arafah", kind: "hajj", poi: "arafah", label: "Arafah" },
      { id: "muzdalifah", kind: "hajj", poi: "muzdalifah", label: "Muzdalifah" },
      { id: "jamarat", kind: "hajj", poi: "jamarat", label: "Jamarat" },
      {
        id: "camel_yard",
        kind: "camel",
        poi: "camel_yard",
        at: "camels:yard",
        label: "Camel yard",
      },
      { id: "caravan", kind: "camel", at: "camels:caravan", label: "Camel caravan" },
      { id: "oasis", kind: "oasis", at: "camels:oasis" },
      { id: "horse_stable", kind: "horse", poi: "horse_stable", label: "Horse stable" },
      { id: "rides", kind: "rides", at: "rides" },
    ],
    madinah: [
      { id: "nabawi", kind: "nabawi", at: "holy:madinah.nabawi" },
      { id: "mosque", kind: "mosque", poi: "mosque_gate", label: "Mosque gate" },
      { id: "rawdah", kind: "rawdah", poi: "rawdah" },
      { id: "wudu", kind: "wudu", poi: "mosque_wudu" },
      { id: "quba", kind: "mosque", poi: "quba", label: "Masjid Quba" },
      { id: "uhud", kind: "hill", poi: "uhud", label: "Mount Uhud" },
      { id: "baqi", kind: "park", poi: "baqi", label: "Baqi' garden" },
      { id: "bus", kind: "bus", poi: "busStop" },
      { id: "tailor", kind: "tailor", poi: "tailor" },
      { id: "hotels", kind: "hotel", at: "hotels:madinah" },
      { id: "rides", kind: "rides", at: "rides" },
    ],
  });

  KQ.PLACES = Object.freeze({ KINDS, SOURCES });
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
