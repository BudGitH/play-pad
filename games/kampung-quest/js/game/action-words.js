/* ============================================================================
 * FILE: action-words.js
 * PURPOSE: ONE table for every kind of action the Action button can offer: its picture, its one
 *          word and the short line that is spoken the first time a child sees it. Every target the
 *          game makes ({kind, id, label, ...}) is mapped to a row here; anything unknown falls back
 *          to the hand picture and its own label, so a new action slots in with no HUD change.
 * BUSINESS CONTEXT: playability round AC-P24.4 / AC-P24.5 (the same picture and word everywhere,
 *   spoken hints for children who cannot read yet). The words are plain: no "Sunat", "Wudu" or
 *   "Walk closer" on any button.
 * DEPENDENCIES: pictures.js (icons). Adds a few small icons to the shared icon set.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const ICONS = G.Pictures.ICONS;
  ICONS.moon = "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z";
  ICONS.icecream = "M12 22 7.5 12h9zM12 2a5 5 0 0 0-4.6 7h9.2A5 5 0 0 0 12 2z";
  ICONS.balloon =
    "M12 2a6 7 0 0 0-6 7c0 3.8 3 6.6 5.2 7.8L10 19l2-1 2 1-1.2-2.2C15 15.6 18 12.8 18 9a6 7 0 0 0-6-7zm-.8 17.6h1.6V22h-1.6z";
  ICONS.paw =
    "M12 12c-3 0-5.5 3-5.5 5.2 0 1.6 1.4 2.3 2.8 2.3 1 0 1.8-.4 2.7-.4s1.7.4 2.7.4c1.4 0 2.8-.7 2.8-2.3C17.5 15 15 12 12 12zM5.5 7.4a2 2.6 0 1 1 0 5.2 2 2.6 0 0 1 0-5.2zM9.2 2.8a2 2.7 0 1 1 0 5.4 2 2.7 0 0 1 0-5.4zM14.8 2.8a2 2.7 0 1 1 0 5.4 2 2.7 0 0 1 0-5.4zM18.5 7.4a2 2.6 0 1 1 0 5.2 2 2.6 0 0 1 0-5.2z";
  ICONS.animal =
    "M3 19v-3.5l3-1.3.8-5.2 3 2.8h4.2l2.2-4.8 2.3 1.1-1.2 4.6 3.7 2.3V19h-2.3v-2.4h-2.2V19h-2.2v-3.4H9.6V19H7.4v-2.4H5.3V19z";
  ICONS.bench = "M3 10h18v3H3zM4 13h2v6H4zm14 0h2v6h-2zM5 5h14v3.4H5z";

  /**
   * The table. key -> { icon, word, say }. `say` is the one short spoken hint ("" = none). The words
   * are single, plain English words (or two short ones) a seven-year-old can learn once.
   */
  const TABLE = {
    talk: { icon: "talk", word: "Talk", say: "Tap the big button to talk." },
    "say-hi": { icon: "hand", word: "Say hi", say: "Tap the big button to say hi." },
    eat: { icon: "bowl", word: "Eat", say: "Tap the big button to pick some food." },
    buy: { icon: "bag", word: "Buy", say: "Tap the big button to buy something." },
    pray: { icon: "mosque", word: "Pray", say: "Tap Pray. I will help you with every step." },
    "pray-here": {
      icon: "mosque",
      word: "Pray here",
      say: "Tap Pray here to pray right where you are.",
    },
    rest: { icon: "moon", word: "Rest", say: "Tap Rest to feel full of energy again." },
    sit: { icon: "bench", word: "Sit", say: "Tap Sit to take a seat." },
    "ride-animal": { icon: "animal", word: "Ride", say: "Tap Ride to climb on." },
    "ride-bike": { icon: "bike", word: "Ride", say: "Tap Ride to hop on." },
    drive: { icon: "car", word: "Drive", say: "Tap Drive to get in." },
    exit: { icon: "exit", word: "Get off", say: "Tap Get off to climb down." },
    pickup: { icon: "hand", word: "Pick up", say: "Tap Pick up to take it." },
    play: { icon: "star", word: "Play", say: "Tap Play to have fun." },
    haircut: { icon: "scissors", word: "Haircut", say: "Tap Haircut to change your hair." },
    clothes: { icon: "shirt", word: "Clothes", say: "Tap Clothes to try new clothes." },
    checkup: { icon: "heart", word: "Check-up", say: "Tap Check-up to see the doctor." },
    story: { icon: "book", word: "Story", say: "Tap Story to hear a story." },
    recycle: { icon: "recycle", word: "Recycle", say: "Tap Recycle to look after the earth." },
    photo: { icon: "camera", word: "Photo", say: "Tap Photo to take a picture." },
    push: { icon: "hand", word: "Push", say: "Tap Push to give a hand." },
    catch: { icon: "balloon", word: "Catch", say: "Tap Catch to catch it." },
    pet: { icon: "paw", word: "Pet", say: "Tap Pet to stroke the cat." },
    icecream: { icon: "icecream", word: "Ice cream", say: "Tap Ice cream to buy a treat." },
    dates: { icon: "bowl", word: "Dates", say: "Tap Dates to get some." },
    zamzam: { icon: "drop", word: "Zamzam", say: "Tap Zamzam to get a drink." },
  };
  const FALLBACK_ICON = "hand";

  /** Interactable id prefix -> table key (the world's objects). */
  const OBJECTS = {
    counter_: "eat",
    wudu_tap_: "pray",
    prayer_spot: "pray",
    pray_here: "pray-here",
    minimart_till: "buy",
    barber_chair: "haircut",
    wardrobe_stall: "clothes",
    clinic_desk: "checkup",
    library_desk: "story",
    home_door: "rest",
    recycling_bins: "recycle",
    playground: "play",
    bus_stop_bench: "sit",
  };
  /** A target label (lower case) -> table key, for mission steps, events and quick verbs. */
  const LABELS = {
    photo: "photo",
    push: "push",
    catch: "catch",
    pet: "pet",
    "ice cream": "icecream",
    dates: "dates",
    zamzam: "zamzam",
    talk: "talk",
  };

  /** The key of an object prompt, by its id prefix (null when unknown). */
  function objectKey(id) {
    const hit = Object.keys(OBJECTS).find((k) => id.indexOf(k) === 0);
    return hit ? OBJECTS[hit] : null;
  }

  /** The key of a vehicle or animal prompt ("vehicle:..." / "mount:..."), or null for any other id. */
  function rideKey(t) {
    const id = String(t.id || "");
    if (id === "vehicle:exit" || id === "mount:exit") return "exit";
    if (id.indexOf("mount:hi") === 0) return "say-hi";
    if (id.indexOf("mount:") === 0) return "ride-animal";
    if (id.indexOf("vehicle:") !== 0) return null;
    return String(t.label) === "Drive" ? "drive" : "ride-bike";
  }

  /** The table key for a target (the game's {kind, id, label}); null when the table has no row for it. */
  function keyOf(t) {
    if (!t) return null;
    const kinds = { hi: "say-hi", item: "pickup", rest: "rest" };
    if (kinds[t.kind]) return kinds[t.kind];
    const ride = rideKey(t);
    if (ride) return ride;
    const byLabel = LABELS[String(t.label || "").toLowerCase()];
    if (t.kind === "npc") return byLabel || (t.label ? null : "talk"); // a quick verb of its own keeps its word
    return objectKey(String(t.id || "")) || byLabel || null;
  }

  /**
   * The picture, word and spoken hint for a target. Unknown actions degrade to the hand picture and
   * the target's own label, with no spoken hint, so they still work and still look like the others.
   * @returns {{key:string, icon:string, word:string, say:string, known:boolean}}
   */
  function info(t) {
    const key = keyOf(t);
    const row = key ? TABLE[key] : null;
    if (row) return { key, icon: row.icon, word: row.word, say: row.say, known: true };
    const word = (t && t.label) || "Use";
    const slug = String(word)
      .toLowerCase()
      .replace(/[^a-z]+/g, "-")
      .slice(0, 24);
    return { key: "other-" + slug, icon: FALLBACK_ICON, word, say: "", known: false };
  }

  G.ActionWords = { info, keyOf, TABLE, FALLBACK_ICON };
})((window.KQ = window.KQ || {}));
