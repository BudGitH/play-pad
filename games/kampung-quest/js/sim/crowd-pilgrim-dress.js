/* ============================================================================
 * FILE: crowd-pilgrim-dress.js
 * PURPOSE: What each person in the Haramain crowd looks like (pure, no THREE, no DOM): the
 *          nationality profile (skin tones, hair, dress for men and women), age (child, teen,
 *          adult, elder), body size (height and girth), the ihram of men at the tawaf and
 *          sa'i, matching tour-group colours, and the work clothes of guards, cleaners and
 *          vendors. Everything is a deterministic function of the seed text.
 * BUSINESS CONTEXT: AC-H2 and the owner's "true to life" follow-up: a wide range of skin tones,
 *   ages, body sizes and outfits (ihram; abayas in black, white and colours; thobes, shalwar
 *   kameez, baju Melayu, batik, Turkish groups with matching scarves, African kaftans).
 * DEPENDENCIES: crowd.js (KQ.Sim.Crowd.hash01). HOW TO TEST: crowd-pilgrim.test.mjs.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};
  const SC = KQ.Sim.Crowd;
  const WHITE = "#f6f4ee";
  const BLACK = "#17171c";

  /** Skin tones by nationality group (East / South / Southeast Asian, African, Arab, European, Central Asian...). */
  const SKIN = {
    arab: ["#e3b58a", "#d9a679", "#c9966a", "#bd8a5f"],
    southasian: ["#c68863", "#b87a52", "#a96f49", "#94603d"],
    seasian: ["#e0ad7c", "#d49a6c", "#c78e61", "#b98558"],
    eastasian: ["#f2cfa6", "#efc59a", "#e8b98c", "#f0c7a0"],
    african: ["#8a5537", "#6f4630", "#5a3825", "#7a4d33", "#4a2f20"],
    turkish: ["#ecc19a", "#e3b48a", "#f0c7a0", "#e8bb92"],
    european: ["#f6dcc0", "#f2d0ae", "#f4d6b8", "#efc9a4"],
    centralasian: ["#e6bd94", "#dcae84", "#eac59f"],
  };
  /** How common each group is by dress code: ihram (Haram tawaf and sa'i), thobe (Madinah), mix (streets, halls). */
  const MIX = {
    ihram: {
      southasian: 24,
      seasian: 20,
      arab: 14,
      african: 12,
      turkish: 9,
      centralasian: 7,
      eastasian: 6,
      european: 4,
    },
    thobe: {
      arab: 26,
      southasian: 18,
      seasian: 16,
      african: 12,
      turkish: 10,
      centralasian: 7,
      eastasian: 5,
      european: 4,
    },
    mix: {
      arab: 18,
      southasian: 22,
      seasian: 18,
      african: 12,
      turkish: 10,
      centralasian: 8,
      eastasian: 6,
      european: 4,
    },
  };
  const TOUR_COLOURS = [
    "#d9534f",
    "#2f8f5a",
    "#2f6db5",
    "#e6a33a",
    "#8a3fa0",
    "#e07a2f",
    "#1f9aa8",
    "#c43c6b",
  ];
  const SCARVES = [
    "#f6f4ee",
    BLACK,
    "#c43c6b",
    "#2f7a6a",
    "#e6a33a",
    "#5a7fc4",
    "#8a3fa0",
    "#d9663a",
    "#6bb36b",
    "#f0c0d0",
    "#c2b280",
    "#a8322b",
    "#3f4c6b",
  ];
  const BRIGHT = [
    "#d9534f",
    "#e6a33a",
    "#2f8f5a",
    "#2f6db5",
    "#8a3fa0",
    "#e07a2f",
    "#c43c6b",
    "#1f9aa8",
    "#f0c419",
  ];
  const MUTED = [
    "#1f6f5a",
    "#6d2c3e",
    "#2b4a7a",
    "#8a5a44",
    "#6b5b95",
    "#c9a98a",
    "#3f7d6e",
    "#3b3f4a",
  ];
  const DARK_ABAYA = [BLACK, BLACK, BLACK, "#1d2230", "#2b2b30", "#2f3340"];
  const THOBES = [WHITE, WHITE, "#efe9dc", "#d9d6cf", "#c9c2b0", "#8d7a62"];
  const MALAY = ["#2f8f5a", "#2f6db5", "#8a3fa0", "#c43c6b", "#e6a33a", "#1f9aa8", "#6d2c3e"];
  const BATIK = ["#8a5a2b", "#2b4a7a", "#6b3b2a", "#3f6b5a"];
  const HAIR = ["#141012", "#1d1410", "#2a1c14", "#3a2416"];
  const FAIR_HAIR = ["#3a2416", "#6b4423", "#a07040", "#d9b36c", "#8a5a2b"];
  const GREY = ["#a8a49d", "#c9c6c0", "#e0ddd6"];

  /** Pick from a list by a draw in [0, 1). */
  function pick(list, r) {
    return list[Math.floor(r * list.length) % list.length];
  }

  /** Scramble 32 bits (murmur3 finaliser) so draws from similar seeds are not correlated. */
  function scramble(x) {
    let h = x >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /** A stream of well-mixed draws in [0, 1) for a seed (the same seed always gives the same stream). */
  function stream(seed) {
    let n = 0;
    return function next() {
      n += 1;
      return scramble(Math.floor(SC.hash01(seed + ":dress:" + n) * 4294967296) + n * 0x9e3779b9);
    };
  }

  /** Choose a nationality group by weights for a dress code and a draw. */
  function groupFor(code, r) {
    return SC.pickWeighted(MIX[code] || MIX.mix, r);
  }

  /** The tour number in a seed ("tawaf:tour7:3" -> 7), or -1. */
  function tourOf(seed) {
    const m = /:tour(\d+):/.exec(seed);
    return m ? Number(m[1]) : -1;
  }

  /** Hair for a group and age. */
  function hairColour(group, age, next) {
    if (age === "elder") return pick(GREY, next());
    return pick(group === "european" || group === "turkish" ? FAIR_HAIR : HAIR, next());
  }

  /** Men in ihram: two white cloths, arms and one shoulder bare; a bare head, a sun cap or (in a tour) the tour's cap. */
  function ihramMan(o, next, tour) {
    Object.assign(o, { top: WHITE, legs: WHITE, long: false, skirt: true, shorts: false });
    const r = next();
    if (tour) Object.assign(o, { head: "cap", headColour: tour });
    else if (r < 0.58) Object.assign(o, { head: "hair", headColour: o.hair });
    else if (r < 0.8) Object.assign(o, { head: "none" });
    else if (r < 0.9) Object.assign(o, { head: "turban", headColour: WHITE });
    else
      Object.assign(o, {
        head: "cap",
        headColour: pick(["#f6f4ee", "#5a7fc4", "#2f8f5a"], next()),
      });
  }

  /** The dress of a man by nationality (Madinah, streets). */
  const MEN = {
    arab(o, next) {
      const c = pick(THOBES, next());
      Object.assign(o, { top: c, legs: c, long: true, skirt: true });
      const r = next();
      if (r < 0.5) Object.assign(o, { head: "ghutra", headColour: WHITE });
      else if (r < 0.75) Object.assign(o, { head: "ghutra", headColour: "#c0392b" });
      else Object.assign(o, { head: "kopiah", headColour: WHITE });
    },
    southasian(o, next) {
      const c = pick(["#e8e2cf", "#c9d6e6", "#cfe0cf", "#d9c2c2", "#b9a98d", WHITE], next());
      Object.assign(o, {
        top: c,
        legs: next() < 0.6 ? WHITE : "#e8e2cf",
        long: true,
        skirt: false,
      });
      if (next() < 0.7) Object.assign(o, { head: "kopiah", headColour: WHITE });
    },
    seasian(o, next) {
      const batik = next() < 0.4;
      const c = batik ? pick(BATIK, next()) : pick(MALAY, next());
      Object.assign(o, { top: c, legs: batik ? "#1c1c22" : c, long: true, skirt: !batik });
      Object.assign(o, { head: "songkok", headColour: "#1c1c22" });
    },
    eastasian(o, next) {
      Object.assign(o, {
        top: pick(["#4f86c6", "#f4f1e8", "#8fb8d8", "#6c8f4e"], next()),
        legs: "#3b3f4a",
        long: next() < 0.5,
      });
      if (next() < 0.4)
        Object.assign(o, { head: "cap", headColour: pick(["#f4f1e8", "#2b4a7a"], next()) });
    },
    african(o, next) {
      const c = pick(
        ["#e8d9b0", "#2f8f5a", "#2b4a7a", "#e07a2f", "#8a3fa0", WHITE, "#c9a98a"],
        next(),
      );
      Object.assign(o, {
        top: c,
        legs: c,
        long: true,
        skirt: true,
        head: "kopiah",
        headColour: pick([WHITE, c, "#e6a33a"], next()),
      });
    },
    turkish(o, next, tour) {
      Object.assign(o, {
        top: pick(["#2b3a55", "#4b4b52", "#6b5b4a", "#3b3f4a"], next()),
        legs: "#2a2d36",
        long: true,
      });
      if (tour) Object.assign(o, { head: "cap", headColour: tour });
      else if (next() < 0.35) Object.assign(o, { head: "cap", headColour: "#2b3a55" });
    },
    european(o, next) {
      Object.assign(o, {
        top: pick(["#f4f1e8", "#8fb8d8", "#c43c3c", "#3d8fb6"], next()),
        legs: pick(["#b49a6e", "#3b3f4a", "#454a55"], next()),
        long: next() < 0.4,
      });
      if (next() < 0.35)
        Object.assign(o, { head: "cap", headColour: pick(["#2b4a7a", "#f4f1e8"], next()) });
    },
    centralasian(o, next) {
      Object.assign(o, {
        top: pick(["#2f6db5", "#8a3fa0", "#2f8f5a", "#c0392b", "#e6a33a"], next()),
        legs: "#3b3f4a",
        long: true,
        skirt: next() < 0.6,
      });
      Object.assign(o, { head: "doppi", headColour: pick(["#1c1c22", "#2b4a7a"], next()) });
    },
  };

  /** Modest dress for a woman: [garment colour fn, legs rule, scarf style] by nationality. */
  const WOMEN = {
    arab(o, next) {
      const dark = next() < 0.82;
      const c = dark ? pick(DARK_ABAYA, next()) : pick(MUTED, next());
      Object.assign(o, {
        top: c,
        legs: c,
        long: true,
        skirt: true,
        head: "tudung",
        headColour: dark ? BLACK : pick(SCARVES, next()),
      });
    },
    southasian(o, next) {
      const c = pick(BRIGHT.concat(MUTED), next());
      Object.assign(o, {
        top: c,
        legs: pick([WHITE, "#3b3f4a", c, "#d9c2c2"], next()),
        long: true,
        skirt: false,
        head: "tudung",
        headColour: pick(SCARVES, next()),
      });
    },
    seasian(o, next) {
      const c = pick(BRIGHT.concat(MUTED, ["#f0c0d0", "#e8e2cf"]), next());
      Object.assign(o, {
        top: c,
        legs: c,
        long: true,
        skirt: true,
        head: "tudung",
        headColour: pick(SCARVES, next()),
      });
    },
    eastasian(o, next) {
      const c = pick(["#f0c0d0", "#c9d6e6", "#e8e2cf", WHITE, "#8fb8d8"], next());
      Object.assign(o, {
        top: c,
        legs: c,
        long: true,
        skirt: true,
        head: "tudung",
        headColour: pick(SCARVES, next()),
      });
    },
    african(o, next) {
      const c = pick(BRIGHT, next());
      Object.assign(o, {
        top: c,
        legs: pick(BRIGHT, next()),
        long: true,
        skirt: true,
        head: "wrap",
        headColour: pick(BRIGHT, next()),
      });
    },
    turkish(o, next, tour) {
      const c = pick(["#2b3a55", "#6b5b4a", "#3b3f4a", "#6d2c3e", "#c9b8a0"], next());
      Object.assign(o, {
        top: c,
        legs: c,
        long: true,
        skirt: true,
        head: "tudung",
        headColour: tour || pick(SCARVES, next()),
      });
    },
    european(o, next) {
      const c = pick(MUTED.concat([WHITE, "#c9b8a0"]), next());
      Object.assign(o, {
        top: c,
        legs: c,
        long: true,
        skirt: true,
        head: "tudung",
        headColour: pick(SCARVES, next()),
      });
    },
    centralasian(o, next) {
      const c = pick(BRIGHT, next());
      Object.assign(o, {
        top: c,
        legs: c,
        long: true,
        skirt: true,
        head: "tudung",
        headColour: pick(SCARVES, next()),
      });
    },
  };

  /** Women in the ihram code: plain white or black abayas and scarves (most), the tour scarf colour in a tour. */
  function womanAtTawaf(o, group, next, tour) {
    const r = next();
    if (r < 0.4) {
      Object.assign(o, {
        top: WHITE,
        legs: WHITE,
        long: true,
        skirt: true,
        head: "tudung",
        headColour: tour || WHITE,
      });
    } else if (r < 0.65) {
      Object.assign(o, {
        top: BLACK,
        legs: BLACK,
        long: true,
        skirt: true,
        head: "tudung",
        headColour: tour || BLACK,
      });
    } else WOMEN[group](o, next, tour);
  }

  /** Children wear white (ihram) near the Kaaba, bright everyday clothes elsewhere. */
  function child(o, ihram, next) {
    o.kid = true;
    o.shorts = false;
    o.skirt = false;
    o.long = !ihram;
    const c = ihram ? WHITE : pick(BRIGHT.concat(["#f4f1e8", "#8fb8d8"]), next());
    Object.assign(o, { top: c, legs: ihram ? WHITE : pick(["#243a78", "#3b3f4a", c], next()) });
    if (o.female && !ihram)
      Object.assign(o, {
        head: "tudung_kid",
        headColour: pick(SCARVES, next()),
        skirt: true,
        legs: c,
      });
    else Object.assign(o, { head: "hair", headColour: o.hair });
  }

  /** Work clothes by seed prefix, or false when the seed is not one of the staff. */
  function staff(o, seed, next) {
    if (seed.indexOf("guard:") === 0) {
      Object.assign(o, {
        top: "#1f2a44",
        legs: "#1b1f2a",
        long: true,
        skirt: false,
        shorts: false,
        head: "cap",
        headColour: "#1f2a44",
        female: false,
      });
    } else if (seed.indexOf("clean:") === 0) {
      Object.assign(o, {
        top: "#f08a24",
        legs: "#3b3f4a",
        long: true,
        skirt: false,
        shorts: false,
        head: "cap",
        headColour: "#f08a24",
        female: false,
      });
    } else return false;
    o.kid = false;
    o.skin = pick(SKIN[next() < 0.5 ? "southasian" : "seasian"], next());
    return true;
  }

  /** Everyone in a tour group wears the group's colour on the head: a scarf, or a cap. */
  function matchTour(o, tour) {
    if (o.head === "tudung" || o.head === "tudung_kid" || o.head === "wrap") o.headColour = tour;
    else Object.assign(o, { head: "cap", headColour: tour });
  }

  /** The body: height and girth by age (a small share of adults are stocky, elders a little shorter). */
  function body(o, next) {
    const g = next();
    if (o.kid) {
      o.scale = 0.9 + next() * 0.15;
      o.girth = 0.92 + next() * 0.16;
    } else if (o.age === "teen") {
      o.scale = 0.82 + next() * 0.08;
      o.girth = 0.9 + next() * 0.12;
    } else {
      o.scale = (o.age === "elder" ? 0.9 : 0.95) + next() * 0.14;
      o.girth =
        g < 0.62 ? 0.94 + next() * 0.1 : g < 0.9 ? 1.06 + next() * 0.1 : 1.18 + next() * 0.1;
    }
  }

  /** A touch of shade per person on skin and garments, so the same cloth is never quite the same twice. */
  function vary(o, next, tour) {
    // plain white cloth (the ihram, white thobes) stays exactly white
    const lo = (c, k) => (c === WHITE ? c : SC.shade(c, k));
    o.skin = SC.shade(o.skin, (next() - 0.5) * 0.1);
    const same = o.legs === o.top;
    o.top = lo(o.top, (next() - 0.5) * 0.2);
    o.legs = same ? o.top : lo(o.legs, (next() - 0.5) * 0.2);
    if (!tour && (o.head === "tudung" || o.head === "cap"))
      o.headColour = lo(o.headColour, (next() - 0.5) * 0.16);
  }

  /**
   * Dress a base outfit (from KQ.Sim.Crowd outfit) as a pilgrim, from the seed text.
   * @param {object} o the base outfit (mutated and returned)
   * @param {string} seed the person's seed ("tawaf:2:7", "pray:nabawi:3:120@5", "tawaf:tour4:2", ...)
   * @param {string} code the dress code: "ihram", "thobe" or "mix"
   */
  function dress(o, seed, code) {
    const next = stream(seed);
    const tourN = tourOf(seed);
    const tour = tourN >= 0 ? TOUR_COLOURS[tourN % TOUR_COLOURS.length] : null;
    const group =
      tourN >= 0 ? groupFor(code, scramble(tourN * 2654435761 + 7)) : groupFor(code, next());
    const mix = next();
    o.skin = pick(SKIN[group], next());
    o.hair = hairColour(group, o.age, next);
    if (staff(o, seed, next)) {
      body(o, next);
      return o;
    }
    Object.assign(o, {
      head: "hair",
      headColour: o.hair,
      long: false,
      skirt: false,
      shorts: false,
    });
    const ihram = code === "ihram" || (code === "mix" && mix < 0.3);
    if (o.kid) child(o, ihram, next);
    else if (o.female)
      (code === "ihram" ? womanAtTawaf : (a, g, n, t) => WOMEN[g](a, n, t))(o, group, next, tour);
    else if (ihram) ihramMan(o, next, tour);
    else MEN[group](o, next, tour);
    if (tour) matchTour(o, tour);
    if (o.age === "elder" && (o.head === "hair" || o.head === "bun"))
      o.headColour = pick(GREY, next());
    else if (o.head === "hair") o.headColour = o.hair;
    o.bag = tour || pick(BRIGHT, next());
    o.group = group;
    vary(o, next, tour);
    body(o, next);
    return o;
  }

  SC.PilgrimDress = { dress, SKIN, TOUR_COLOURS, tourOf, groupFor, MIX };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
