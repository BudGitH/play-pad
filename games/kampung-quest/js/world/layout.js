/* Kampung Quest — the town plan (KQ.WorldParts.LAYOUT). One place for every footprint so the
   builders, colliders, POIs and walk graph agree. Units: metres, Y up, north = -Z, east = +X.
   Two roads cross at the origin and split the town into four quadrants:
     NW mosque · NE hawker centre, shops, library · SW blocks A + B, carpark · SE block C,
     playground, park, bus stop. The mosque's qibla wall faces west-north-west (−X), as in
     Singapore (qibla bearing ≈ 293°). */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});

  P.LAYOUT = {
    half: 72, // playable half-size: the town spans −72..72 on X and Z
    road: { half: 3.5, walk: 6.0, kerb: 0.12 }, // carriageway |c| < 3.5, sidewalk 3.5..6
    crossings: [
      { axis: "x", at: -10 }, // zebra crossings over the E–W road (fixed x)
      { axis: "x", at: 10 },
      { axis: "x", at: -37 },
      { axis: "x", at: 30 },
      { axis: "z", at: -10 }, // over the N–S road (fixed z)
      { axis: "z", at: 10 },
      { axis: "z", at: -31 },
      { axis: "z", at: 40 },
    ],
    blocks: [
      {
        id: "block_a",
        num: "118",
        x0: -56,
        x1: -24,
        z0: 16,
        z1: 25,
        floors: 10,
        band: "#2a8c8c",
        wall: "#f3efe6",
        corridor: "+z",
      },
      {
        id: "block_b",
        num: "120",
        x0: -56,
        x1: -24,
        z0: 46,
        z1: 55,
        floors: 12,
        band: "#c4613a",
        wall: "#f1e6d2",
        corridor: "-z",
      },
      {
        id: "block_c",
        num: "122",
        x0: 34,
        x1: 64,
        z0: 46,
        z1: 55,
        floors: 9,
        band: "#2f5fa8",
        wall: "#eef0f2",
        corridor: "-z",
      },
    ],
    hawker: { x0: 14, x1: 38, z0: -32, z1: -12, h: 4.6 },
    stalls: [
      { id: "stall_prata", text: "ROTI PRATA", sub: "Prata kosong · telur", bg: "#d9822b" },
      {
        id: "stall_nasi_lemak",
        text: "NASI LEMAK",
        sub: "Ayam goreng · ikan bilis",
        bg: "#2f7d4f",
      },
      { id: "stall_mee_soto", text: "MEE SOTO", sub: "Soto ayam · bergedil", bg: "#c43b2f" },
      { id: "stall_drinks", text: "MINUMAN", sub: "Teh tarik · Milo · air bandung", bg: "#2a63b0" },
      { id: "stall_satay", text: "SATAY", sub: "Ayam · daging · kuah kacang", bg: "#7b3f9e" },
    ],
    shops: { x0: 44, x1: 68, z0: -24, z1: -12, arcade: 2.4, h: 3.6 },
    shopUnits: [
      {
        id: "minimart",
        x0: 44,
        x1: 53,
        text: "MINI MART",
        sub: "Kedai runcit · groceries",
        bg: "#e23b3b",
      },
      { id: "barber", x0: 53, x1: 59, text: "BARBER", sub: "Gunting rambut", bg: "#1d4fa8" },
      { id: "clinic", x0: 59, x1: 68, text: "KLINIK", sub: "Family clinic", bg: "#1a8c7a" },
    ],
    library: { x0: 46, x1: 66, z0: -60, z1: -40, h: 6 },
    mosque: {
      x0: -58,
      x1: -12,
      z0: -58,
      z1: -10, // compound wall
      hall: { x0: -52, x1: -32, z0: -46, z1: -20, h: 7 },
      verandah: { x0: -32, x1: -28 },
      gate: { z0: -34, z1: -28 },
      wudu: { x0: -29, x1: -17, z0: -55, z1: -49 },
      minaret: { x: -17, z: -14 },
      menDoor: { z0: -36, z1: -30 },
      womenDoor: { x0: -40, x1: -36 },
      womenScreenZ: -25,
    },
    playground: { x0: 12, x1: 28, z0: 14, z1: 28 },
    park: { x0: 34, x1: 70, z0: 10, z1: 38 },
    busStop: { x0: 16, x1: 24, z0: 6.2, z1: 8.6 },
    carpark: { x0: -20, x1: -8, z0: 28, z1: 44 },
    recycling: { x: 19, z: -9 },
    linkways: [
      { x0: -38.6, x1: -35.4, z0: 6, z1: 16 }, // block A → road
      { x0: -38.6, x1: -35.4, z0: 25, z1: 46 }, // block A ↔ block B
      { x0: 47.4, x1: 50.6, z0: 6, z1: 46 }, // block C → road (through the park)
      { x0: 24, x1: 30, z0: 6, z1: 8.6 }, // bus stop extension
    ],
  };
})((window.KQ = window.KQ || {}));
