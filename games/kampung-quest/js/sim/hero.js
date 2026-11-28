/* ============================================================================
 * FILE: hero.js
 * PURPOSE: Who the hero is, as pure data and rules: boy or girl, the girl's hair or hijab style
 *          and scarf colour, the girl's wardrobe (modest outfits x colours, the same rule set API as
 *          KQ.Sim.Wardrobe), the girl's ihram look, and the schema check of the saved choice
 *          `hero: { gender, style, scarf }`.
 * BUSINESS CONTEXT: AC-P8..P10 (features/kampung-quest-playability/requirements.md): the player
 *   picks a boy or a girl hero on New game, can change it at the tailor, and both have
 *   customisation. Every girl outfit is modest (long sleeves, a long skirt or trousers / leggings,
 *   never bare shins); the hijab is optional (hair styles are offered too). Women's ihram is ordinary
 *   modest clothes (white here) with a hijab, the face and hands uncovered.
 * DEPENDENCIES: KQ.Sim.Wardrobe (load it first: the girl's rules are built with Wardrobe.make).
 *   Pure: no THREE, no DOM. Consumer: save.js (cleans the saved choice).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/hero-gender.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};
  const W = KQ.Sim.Wardrobe;
  const sw = W.sw;

  const GENDERS = Object.freeze(["boy", "girl"]);
  const HAIR = "#2e1c12";
  const SHOE = "#7a4a3a";
  const CREAM = "#f2efe6";

  /** The scarf colours (hijab, or the ribbon / hair tie with a hair style). */
  const SCARVES = Object.freeze([
    sw("rose", "Rose pink", "#e46f9c", "#fbd3e2"),
    sw("lilac", "Lilac", "#9a7fd0", "#e3d8f6"),
    sw("sky", "Sky blue", "#4f9fdc", "#d4e9f8"),
    sw("mint", "Mint", "#4bb39a", "#d2efe6"),
    sw("peach", "Peach", "#f0956a", "#fde0cf"),
    sw("sunny", "Sunny yellow", "#f0bf2a", "#fff1bf"),
    sw("teal", "Teal", "#1f8f8a", "#c9ece9"),
    sw("white", "White", "#f6f4ee", "#e46f9c"),
  ]);

  /** Hair or hijab styles: id, name, and whether the hair is covered. */
  const STYLES = Object.freeze([
    Object.freeze({ id: "hijab", name: "Plain hijab", covered: true }),
    Object.freeze({ id: "hijab_sport", name: "Sporty hijab", covered: true }),
    Object.freeze({ id: "hijab_flower", name: "Flower hijab", covered: true }),
    Object.freeze({ id: "ponytail", name: "Ponytail", covered: false }),
    Object.freeze({ id: "braids", name: "Two braids", covered: false }),
    Object.freeze({ id: "bun", name: "Bun", covered: false }),
    Object.freeze({ id: "bob", name: "Short bob", covered: false }),
  ]);

  /** A girl's long-sleeved top piece: colour, sleeves, skin hands, no glove band. */
  function top(c, print) {
    return { torso: c.hex, arms: c.hex, sleeves: "long", print, hands: null, band: null };
  }

  /** Baju kurung: a flowered long top to the knee over a long skirt to the ankle. */
  function kurung(c) {
    const lower = W.shade(c.hex, -0.14);
    return Object.assign(top(c, { style: "kurung", accent: c.alt, accent2: "#fff4cf" }), {
      legs: lower,
      skirt: { top: c.hex, upper: c.hex, lower },
      shoes: SHOE,
    });
  }

  /** A long dress to below the knee, over leggings, with a round collar and a bow. */
  function dress(c) {
    return Object.assign(top(c, { style: "dress", accent: c.alt }), {
      legs: W.shade(c.hex, -0.45),
      skirt: { top: c.hex, upper: c.hex },
      shoes: SHOE,
    });
  }

  /** A tunic to the knee with an embroidered neckline, over cream trousers. */
  function tunic(c) {
    return Object.assign(top(c, { style: "tunic", accent: c.alt }), {
      legs: CREAM,
      skirt: { top: c.hex, upper: c.hex },
      shoes: SHOE,
    });
  }

  /** Abaya: a long, flowing robe to the ankle. */
  function abaya(c) {
    return Object.assign(top(c, { style: "jubah", accent: c.alt }), {
      legs: c.hex,
      skirt: { top: c.hex, upper: c.hex, lower: c.hex },
      shoes: "#2a2420",
    });
  }

  /** Tracksuit: a zip top with long sleeves and long trousers, white trainers. */
  function tracksuit(c) {
    return Object.assign(top(c, { style: "zip", accent: c.alt, badge: "#f4f1e8" }), {
      legs: c.hex,
      band: "#f4f1e8",
      shoes: "#f4f4ef",
    });
  }

  /** Raincoat: a zipped coat to the thigh over dark trousers, with boots. */
  function raincoat(c) {
    return Object.assign(top(c, { style: "zip", accent: c.alt, badge: "#f4f1e8" }), {
      legs: "#2b3548",
      skirt: { top: c.hex, upper: c.hex },
      shoes: "#2b3548",
    });
  }

  /** No head of its own: the girl's head is her hair / hijab choice (see headFor). */
  const NO_HEAD = () => null;

  /** One girl outfit entry. */
  function outfit(id, name, blurb, dressFn, palette) {
    return Object.freeze({ id, name, blurb, dress: dressFn, head: NO_HEAD, palette });
  }

  const GIRL_OUTFITS = Object.freeze([
    outfit("kurung", "Baju kurung", "A flowery top and a long skirt.", kurung, [
      sw("teal", "Teal", "#2f9a8a", "#f7a8c4"),
      sw("pink", "Pink", "#e0669a", "#fff1a8"),
      sw("lilac", "Lilac", "#8f6cc8", "#f7d3e4"),
      sw("sky", "Sky blue", "#4a9fd6", "#fff1a8"),
      sw("mint", "Mint", "#5cbf9c", "#f7a8c4"),
      sw("sunny", "Sunny yellow", "#e8b62a", "#e0669a"),
      sw("maroon", "Maroon", "#8a2f4a", "#f2c94c"),
      sw("cream", "Cream", "#efe3c4", "#e0669a"),
    ]),
    outfit("dress", "Long dress", "A long dress with a bow, over leggings.", dress, [
      sw("rose", "Rose", "#e46f9c", "#ffffff"),
      sw("purple", "Purple", "#7a4fc2", "#f7d3e4"),
      sw("sky", "Sky blue", "#3f95d6", "#ffffff"),
      sw("green", "Leaf green", "#3a9a5a", "#fff1a8"),
      sw("orange", "Orange", "#ee7b2d", "#fff1a8"),
      sw("red", "Red", "#d8403a", "#ffffff"),
      sw("navy", "Navy", "#2c3e6b", "#f2c94c"),
      sw("yellow", "Yellow", "#f0c419", "#e46f9c"),
    ]),
    outfit("tunic", "Tunic & trousers", "A tunic to the knee over cream trousers.", tunic, [
      sw("coral", "Coral", "#e8705a", "#f2c94c"),
      sw("teal", "Teal", "#1f7a7a", "#f2c94c"),
      sw("plum", "Plum", "#7a3a7a", "#f7d3e4"),
      sw("sky", "Sky blue", "#5aa5d8", "#ffffff"),
      sw("mustard", "Mustard", "#d9a21b", "#8a2f4a"),
      sw("green", "Forest green", "#2f6a4a", "#f2c94c"),
      sw("pink", "Pink", "#f07aa8", "#ffffff"),
      sw("navy", "Navy", "#2c3e6b", "#e8dcc0"),
    ]),
    outfit("abaya", "Abaya", "A long, flowing robe.", abaya, [
      sw("black", "Black", "#25262b", "#c9a24a"),
      sw("navy", "Navy", "#23396b", "#e8dcc0"),
      sw("plum", "Plum", "#5e3470", "#e8dcc0"),
      sw("brown", "Brown", "#6b4a2e", "#e8dcc0"),
      sw("teal", "Teal", "#1f6a6a", "#e8dcc0"),
      sw("grey", "Grey", "#6a6d75", "#f2efe6"),
      sw("maroon", "Maroon", "#6e2438", "#e2c46a"),
      sw("cream", "Cream", "#e6dcc4", "#8a5a2b"),
    ]),
    outfit("tracksuit", "Tracksuit", "Sporty and comfy, for running about.", tracksuit, [
      sw("purple", "Purple", "#7a4fc2", "#f0c419"),
      sw("pink", "Pink", "#e0558f", "#ffffff"),
      sw("sky", "Sky blue", "#2f8fe0", "#ffffff"),
      sw("teal", "Teal", "#14958a", "#ffffff"),
      sw("red", "Red", "#d8403a", "#ffffff"),
      sw("green", "Green", "#2f9a55", "#ffffff"),
      sw("navy", "Navy", "#23396b", "#f0c419"),
      sw("orange", "Orange", "#ee7b2d", "#2b3548"),
    ]),
    outfit("raincoat", "Raincoat", "Splash in puddles, stay dry.", raincoat, [
      sw("yellow", "Yellow", "#f2c230", "#d9a41a"),
      sw("pink", "Pink", "#ee6fa0", "#c9507f"),
      sw("purple", "Purple", "#8a5ac8", "#6b3fa8"),
      sw("sky", "Sky blue", "#3fa0e0", "#2a7fba"),
      sw("green", "Green", "#3fa564", "#2b8049"),
      sw("red", "Red", "#d8403a", "#b02a26"),
      sw("orange", "Orange", "#ee7b2d", "#c95f18"),
      sw("teal", "Teal", "#1fa39a", "#16807a"),
    ]),
  ]);

  /** The girl as shipped: a teal baju kurung (her rose hijab comes from DEFAULT). */
  const GIRL_WARDROBE = Object.freeze({ wear: "kurung", tone: "teal" });
  const GIRL = W.make(GIRL_OUTFITS, GIRL_WARDROBE);

  /** A new game: a boy, and the girl's style / scarf ready for when she is chosen. */
  const DEFAULT = Object.freeze({ gender: "boy", style: "hijab", scarf: "rose" });

  /** Pick from a frozen list by id, or the fallback. */
  function byId(list, id, fallback) {
    return (typeof id === "string" && list.find((x) => x.id === id)) || fallback;
  }

  /**
   * Clean a saved hero choice. TRUST_BOUNDARY: the save is untrusted; only the known genders,
   * styles and scarf ids survive, anything else is the default.
   */
  function sanitize(raw) {
    const ok = raw !== null && typeof raw === "object" && !Array.isArray(raw);
    const own = (k) => (ok && Object.prototype.hasOwnProperty.call(raw, k) ? raw[k] : undefined); // never inherited keys
    const src = { gender: own("gender"), style: own("style"), scarf: own("scarf") };
    const gender = GENDERS.indexOf(src.gender) !== -1 ? src.gender : DEFAULT.gender;
    return {
      gender,
      style: byId(STYLES, src.style, byId(STYLES, DEFAULT.style)).id,
      scarf: byId(SCARVES, src.scarf, byId(SCARVES, DEFAULT.scarf)).id,
    };
  }

  /** The wardrobe rule set for a gender (the boy's KQ.Sim.Wardrobe, or the girl's). */
  function wardrobeFor(gender) {
    return gender === "girl" ? GIRL : W;
  }

  /** A hero and wardrobe for a brand-new game of this gender (the chosen hero's own default look). */
  function start(gender, base) {
    const hero = sanitize(Object.assign({}, base || DEFAULT, { gender }));
    const rules = wardrobeFor(hero.gender);
    return { hero, wardrobe: { wear: rules.DEFAULT.wear, tone: rules.DEFAULT.tone } };
  }

  /** The girl's head piece for her style: a hijab in the scarf colour, or hair with a scarf-coloured tie. */
  function headFor(hero) {
    const h = sanitize(hero);
    const c = byId(SCARVES, h.scarf);
    const style = byId(STYLES, h.style);
    if (style.covered) return { type: h.style, colour: c.hex, accent: c.alt };
    return { type: "girl_" + h.style, colour: HAIR, accent: c.hex };
  }

  /** The girl's ihram: ordinary modest clothes, here plain white, face and hands uncovered. */
  function ihramSpec() {
    const white = "#f7f6f1";
    return {
      torso: white,
      arms: white,
      legs: white,
      sleeves: "long",
      print: { style: "none" },
      skirt: { top: white, upper: white, lower: white },
      hands: null,
      band: null,
      shoes: "#a8794b",
    };
  }

  /** With ihram the girl wears a plain white hijab. */
  const ihramHead = () => ({ type: "hijab", colour: "#fbfaf5", accent: "#ece8dc" });

  /** Modest: long sleeves, no bare shins, legs covered by trousers / leggings or a long skirt. */
  function isModest(spec) {
    return Boolean(spec && spec.sleeves === "long" && !spec.bareShins && (spec.legs || spec.skirt));
  }

  /** "Rose pink plain hijab" / "Ponytail": what the screen reader says. */
  function styleName(hero) {
    const h = sanitize(hero);
    const s = byId(STYLES, h.style);
    return s.covered ? byId(SCARVES, h.scarf).name + " " + s.name.toLowerCase() : s.name;
  }

  KQ.Sim.Hero = {
    GENDERS,
    STYLES,
    SCARVES,
    GIRL_OUTFITS,
    GIRL,
    DEFAULT,
    sanitize,
    wardrobeFor,
    start,
    headFor,
    ihramSpec,
    ihramHead,
    isModest,
    styleName,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
