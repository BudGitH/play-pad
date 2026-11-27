/* ============================================================================
 * FILE: wardrobe.js
 * PURPOSE: The hero's wardrobe as pure data and rules: the outfits (garment + the colours it comes
 *          in), the saved choice { wear, tone }, its schema check, and the plain overrides the
 *          figure layer paints onto the hero (KQ.Figures.dressHero).
 * BUSINESS CONTEXT: owner feedback "customise the character": a tailor in the kampung and one in
 *   Makkah / Madinah offer outfits and a palette of colours each. The default (the classic jacket in
 *   royal blue) is the hero's own colour family and is never repainted. Every outfit is modest
 *   (long sleeves or sleeves to the elbow, knee-length shorts at the shortest) and child-friendly.
 * DEPENDENCIES: none (pure: no THREE, no DOM). Optional consumer: save.js (cleans the saved choice).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/wardrobe.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const WHITE = "#f6f5f0";
  const SHOE_DARK = "#2a2420";
  const SHOE_BROWN = "#5a4136";
  const HAIR = "#3a2416";

  /** One colour choice: id, spoken name, main colour, and a second colour the outfit uses for trim. */
  function sw(id, name, hex, alt) {
    return Object.freeze({ id, name, hex, alt });
  }

  /** Mix a #rrggbb colour towards white (k > 0) or black (k < 0). */
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const to = k >= 0 ? 255 : 0;
    const f = Math.abs(k);
    const ch = (v) => Math.round(v + (to - v) * f);
    const r = ch((n >> 16) & 255);
    const g = ch((n >> 8) & 255);
    const b = ch(n & 255);
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  /** A light or dark ink that reads on a colour (for a badge on a white or a dark shirt). */
  function ink(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.72 ? "#2d5aa0" : "#f4f1e8";
  }

  /** The hero's classic jacket and trousers (royal blue is the hero's own look). */
  function classic(c) {
    return {
      torso: c.hex,
      legs: c.hex,
      print: { style: "zip", accent: c.alt, badge: "#f6c945" },
      sleeves: "bare",
      hands: WHITE,
      band: WHITE,
      shoes: "#d7232c",
    };
  }

  /** Baju Melayu: a long-sleeved top and trousers with a contrasting sampin over the hips. */
  function bajuMelayu(c) {
    return {
      torso: c.hex,
      arms: c.hex,
      legs: c.hex,
      sleeves: "long",
      print: { style: "baju_melayu", accent: c.alt },
      skirt: { upper: c.alt },
      hands: null,
      band: null,
      shoes: SHOE_DARK,
    };
  }

  /** T-shirt with a round badge and knee-length shorts over bare shins and white socks. */
  function tee(c) {
    return {
      torso: c.hex,
      arms: c.hex,
      legs: c.alt,
      sleeves: "short",
      print: { style: "tee", accent: ink(c.hex) },
      bareShins: true,
      hands: WHITE,
      band: WHITE,
      shoes: "#d7232c",
    };
  }

  /** Kurta: a long-sleeved tunic to the knee over cream trousers. */
  function kurta(c) {
    return {
      torso: c.hex,
      arms: c.hex,
      legs: "#f2efe6",
      sleeves: "long",
      print: { style: "baju_melayu", accent: c.alt },
      skirt: { top: c.hex, upper: c.hex },
      hands: null,
      band: null,
      shoes: SHOE_BROWN,
    };
  }

  /** Thobe: a long robe to the ankle with a round neck, a placket and a chest pocket. */
  function thobe(c) {
    return {
      torso: c.hex,
      arms: c.hex,
      legs: c.hex,
      sleeves: "long",
      print: { style: "thobe", accent: c.alt },
      skirt: { top: c.hex, upper: c.hex, lower: c.hex },
      hands: null,
      band: null,
      shoes: SHOE_BROWN,
    };
  }

  /** Jubah: a long robe with soft fold lines, in deeper colours. */
  function jubah(c) {
    return {
      torso: c.hex,
      arms: c.hex,
      legs: c.hex,
      sleeves: "long",
      print: { style: "jubah" },
      skirt: { top: c.hex, upper: c.hex, lower: c.hex },
      hands: null,
      band: null,
      shoes: SHOE_DARK,
    };
  }

  /** Raincoat: a zipped coat to the thigh over dark trousers, with boots. */
  function raincoat(c) {
    return {
      torso: c.hex,
      arms: c.hex,
      legs: "#2b3548",
      sleeves: "long",
      print: { style: "zip", accent: c.alt, badge: "#f4f1e8" },
      skirt: { top: c.hex, upper: c.hex },
      hands: WHITE,
      band: null,
      shoes: "#2b3548",
    };
  }

  /** Sports kit: a numbered jersey, knee-length shorts and socks. */
  function sporty(c) {
    return {
      torso: c.hex,
      arms: c.hex,
      legs: c.alt,
      sleeves: "short",
      print: { style: "sports", accent: c.alt },
      bareShins: true,
      hands: WHITE,
      band: WHITE,
      shoes: "#d7232c",
    };
  }

  /** A cap in the outfit's colour (a rain hat, a sports cap). */
  const capIn = (c, band) => ({
    type: "cap",
    colour: c.hex,
    peak: c.alt,
    band,
    hair: HAIR,
  });
  /** Short dark hair: the head for outfits without a hat. */
  const HAIR_ONLY = { type: "hair_short", colour: "#2a1c14" };
  const SONGKOK = { type: "songkok", colour: "#1c1c22", hair: HAIR };

  const OUTFITS = Object.freeze([
    {
      id: "classic",
      name: "Classic jacket",
      blurb: "Adam's own zip jacket and cap.",
      palette: [
        sw("royal", "Royal blue", "#1d4fc6", "#3f74e8"),
        sw("sky", "Sky blue", "#2f8fe0", "#6cb4f2"),
        sw("teal", "Teal", "#14958a", "#3cc0b4"),
        sw("green", "Leaf green", "#3a9a45", "#66c46f"),
        sw("sunny", "Sunny yellow", "#e8a91c", "#ffd05a"),
        sw("orange", "Orange", "#ee7b2d", "#ffa55e"),
        sw("purple", "Purple", "#7a4fc2", "#a07ee6"),
        sw("pink", "Pink", "#e0558f", "#f58cb5"),
      ],
      dress: classic,
      head: (c) => ({
        type: "cap",
        colour: c.hex,
        peak: shade(c.hex, -0.12),
        badge: "#f6c945",
        hair: HAIR,
      }),
    },
    {
      id: "baju_melayu",
      name: "Baju Melayu",
      blurb: "A festive set with a songkok.",
      palette: [
        sw("teal", "Teal", "#2f7466", "#8a2338"),
        sw("maroon", "Maroon", "#8a2338", "#d9b04a"),
        sw("royal", "Royal blue", "#2a56b8", "#d9b04a"),
        sw("green", "Leaf green", "#3a8a4a", "#e2b13c"),
        sw("purple", "Purple", "#6b4aa8", "#e2b13c"),
        sw("orange", "Orange", "#d9742b", "#6b3a1c"),
        sw("sky", "Sky blue", "#4a9fd6", "#1f4f8a"),
        sw("cream", "Cream", "#efe3c4", "#8a5a2b"),
      ],
      dress: bajuMelayu,
      head: () => SONGKOK,
    },
    {
      id: "tee",
      name: "T-shirt & shorts",
      blurb: "Cool and comfy for a sunny day.",
      palette: [
        sw("sunny", "Sunny yellow", "#f0c419", "#2d5aa0"),
        sw("red", "Red", "#e45b5b", "#3a6e3a"),
        sw("sky", "Sky blue", "#4aa0d8", "#2b3548"),
        sw("mint", "Mint", "#4bb3a8", "#5a4a7a"),
        sw("orange", "Orange", "#ee7b2d", "#2b3548"),
        sw("pink", "Pink", "#f07aa8", "#3f4c6b"),
        sw("lime", "Lime", "#8ac43c", "#2b3548"),
        sw("white", "White", "#f4f1e8", "#2d5aa0"),
      ],
      dress: tee,
      head: () => HAIR_ONLY,
    },
    {
      id: "kurta",
      name: "Kurta",
      blurb: "A long tunic over cream trousers.",
      palette: [
        sw("maroon", "Maroon", "#8a2338", "#d9b04a"),
        sw("navy", "Navy", "#2c3e6b", "#e2c46a"),
        sw("forest", "Forest green", "#2f6a4a", "#e2c46a"),
        sw("mustard", "Mustard", "#d9a21b", "#7a4a1c"),
        sw("teal", "Teal", "#1f7a7a", "#e8dcc0"),
        sw("sky", "Sky blue", "#5aa5d8", "#ffffff"),
        sw("cream", "Cream", "#efe6d0", "#8a5a2b"),
        sw("charcoal", "Charcoal", "#4a4d55", "#d9d2c0"),
      ],
      dress: kurta,
      head: () => HAIR_ONLY,
    },
    {
      id: "thobe",
      name: "Thobe",
      blurb: "A long robe with a kufi cap.",
      palette: [
        sw("white", "White", "#f3f1ea", "#cfc8b6"),
        sw("cream", "Cream", "#efe6d2", "#c9b98f"),
        sw("grey", "Light grey", "#d6d3cc", "#a9a496"),
        sw("sand", "Sand", "#cdb892", "#a8946a"),
        sw("sky", "Sky blue", "#bcd6ea", "#8fb2cf"),
        sw("mint", "Mint", "#c8e0cf", "#98bfa6"),
        sw("navy", "Navy", "#2c3e6b", "#8fa2cf"),
        sw("charcoal", "Charcoal", "#4a4d55", "#9a9ca6"),
      ],
      dress: thobe,
      head: (c) => ({ type: "kopiah", colour: "#fbfaf5", accent: c.alt }),
    },
    {
      id: "jubah",
      name: "Jubah",
      blurb: "A long robe with a songkok.",
      palette: [
        sw("white", "White", "#f3f1ea", "#cfc8b6"),
        sw("navy", "Navy", "#23396b", "#8fa2cf"),
        sw("maroon", "Maroon", "#7a2a3a", "#d9b04a"),
        sw("forest", "Forest green", "#2f6a4a", "#e2c46a"),
        sw("brown", "Brown", "#6b4a2e", "#d9b04a"),
        sw("teal", "Teal", "#1f7a7a", "#e8dcc0"),
        sw("plum", "Plum", "#6a3a7a", "#e8dcc0"),
        sw("black", "Black", "#25262b", "#9a9ca6"),
      ],
      dress: jubah,
      head: () => SONGKOK,
    },
    {
      id: "raincoat",
      name: "Raincoat",
      blurb: "Splash in puddles, stay dry.",
      palette: [
        sw("yellow", "Yellow", "#f2c230", "#d9a41a"),
        sw("orange", "Orange", "#ee7b2d", "#c95f18"),
        sw("red", "Red", "#d8403a", "#b02a26"),
        sw("sky", "Sky blue", "#3fa0e0", "#2a7fba"),
        sw("green", "Green", "#3fa564", "#2b8049"),
        sw("purple", "Purple", "#8a5ac8", "#6b3fa8"),
        sw("pink", "Pink", "#ee6fa0", "#c9507f"),
        sw("teal", "Teal", "#1fa39a", "#16807a"),
      ],
      dress: raincoat,
      head: (c) => capIn(c, undefined),
    },
    {
      id: "sporty",
      name: "Sports kit",
      blurb: "A numbered jersey and a cap.",
      palette: [
        sw("red", "Red", "#d8403a", "#f4f1e8"),
        sw("royal", "Royal blue", "#1d4fc6", "#f4f1e8"),
        sw("green", "Green", "#2f9a55", "#f4f1e8"),
        sw("orange", "Orange", "#ee7b2d", "#2b3548"),
        sw("sunny", "Yellow", "#f0c419", "#2b3548"),
        sw("purple", "Purple", "#7a4fc2", "#f4f1e8"),
        sw("teal", "Teal", "#14958a", "#f4f1e8"),
        sw("navy", "Navy", "#23396b", "#f0c419"),
      ],
      dress: sporty,
      head: (c) => capIn(c, "#f4f1e8"),
    },
  ]);

  /** The hero as shipped: the classic jacket in royal blue. */
  const DEFAULT = Object.freeze({ wear: "classic", tone: "royal" });

  /** An outfit by id, or null. */
  function find(id) {
    return OUTFITS.find((o) => o.id === id) || null;
  }

  /** The outfit a choice names (the classic one for anything unknown). */
  function outfitOf(w) {
    return (w && find(w.wear)) || OUTFITS[0];
  }

  /** The colour a choice names inside its outfit's palette (the first swatch for an unknown tone). */
  function swatchOf(w) {
    const o = outfitOf(w);
    return o.palette.find((c) => w && c.id === w.tone) || o.palette[0];
  }

  /** Is this choice the hero's own look (so nothing needs repainting)? */
  function isDefault(w) {
    return outfitOf(w).id === DEFAULT.wear && swatchOf(w).id === DEFAULT.tone;
  }

  /**
   * Clean a saved choice. TRUST_BOUNDARY: the save is untrusted; only known outfit and colour ids
   * survive, anything else falls back to the hero's own look.
   */
  function sanitize(raw) {
    const ok = raw !== null && typeof raw === "object" && !Array.isArray(raw);
    const o = ok && typeof raw.wear === "string" ? find(raw.wear) : null;
    if (!o) return { wear: DEFAULT.wear, tone: DEFAULT.tone };
    const tone = typeof raw.tone === "string" ? raw.tone : "";
    const c = o.palette.find((p) => p.id === tone) || o.palette[0];
    return { wear: o.id, tone: c.id };
  }

  /** Switch outfit but keep the colour when the new outfit comes in it (so a favourite colour follows). */
  function choose(w, wearId) {
    const o = find(wearId) || outfitOf(w);
    const keep = w && o.palette.find((c) => c.id === w.tone);
    return { wear: o.id, tone: (keep || o.palette[0]).id };
  }

  /** Same outfit, another colour (unknown ids keep the current one). */
  function recolour(w, toneId) {
    const o = outfitOf(w);
    const c = o.palette.find((p) => p.id === toneId) || swatchOf(w);
    return { wear: o.id, tone: c.id };
  }

  /** The plain overrides to paint on the hero for a choice (the figure layer merges them over the hero spec). */
  function specFor(w) {
    return outfitOf(w).dress(swatchOf(w));
  }

  /** The head piece that goes with the outfit (used when the barber's look is "classic", no hat). */
  function headFor(w) {
    return outfitOf(w).head(swatchOf(w));
  }

  /** "Teal Baju Melayu": what the bag and the screen reader say. */
  function nameOf(w) {
    return swatchOf(w).name + " " + outfitOf(w).name;
  }

  KQ.Sim.Wardrobe = {
    OUTFITS,
    DEFAULT,
    find,
    outfitOf,
    swatchOf,
    isDefault,
    sanitize,
    choose,
    recolour,
    specFor,
    headFor,
    nameOf,
    shade,
    ink,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
