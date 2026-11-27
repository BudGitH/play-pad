/* ============================================================================
 * FILE: crowd.js
 * PURPOSE: The pure rules of the neighbourhood crowd (no THREE, no DOM): how busy each kind of
 *          place is at each time of day, which fixed spots are occupied right now, how many
 *          strollers are out, what a stroller is (speed, pose), what each extra wears, and the
 *          small layout helpers (a ring of chatters, a stall queue, a tai chi grid).
 * BUSINESS CONTEXT: "bustling" world. The 16 cast neighbours are the named characters; these
 *   extras fill the hawker tables, stall queues, lift lobbies, bus stop, playground and
 *   pavements so the town feels lived in. Everything is deterministic: the same slot key and
 *   time block always give the same answer, so nothing flickers and tests can assert it.
 * DEPENDENCIES: none.
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/crowd.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /** Game minutes per occupancy block: a slot's state only changes at a block boundary. */
  const BLOCK_MIN = 20;
  /**
   * How many extras each quality tier may keep alive at once (fixed spots + strollers). About 2.2x the
   * first crowd (56 / 84 / 120): the owner asked for "a lot more individuals". Only the people in front of the
   * camera are drawn, and all of them share ~25 instanced draw calls, so the cost is vertices, not calls.
   */
  const TIER_CAPS = { low: 120, med: 195, high: 280 };
  /** Strollers as a share of the cap. */
  const WALKER_SHARE = 0.36;
  /** The kinds of fixed activity, with a baseline (night) and peaks in hours: [centre, half-width, height]. */
  const CURVES = {
    diner: {
      base: 0.06,
      peaks: [
        [8.2, 1.4, 0.45],
        [12.7, 1.6, 0.8],
        [19.2, 1.8, 0.7],
        [15.5, 1.2, 0.25],
      ],
    },
    queue: {
      base: 0.05,
      peaks: [
        [8, 1.2, 0.55],
        [12.6, 1.5, 0.9],
        [19, 1.6, 0.8],
        [16, 1.2, 0.3],
      ],
    },
    chat: {
      base: 0.08,
      peaks: [
        [9, 2, 0.4],
        [17.5, 2.5, 0.55],
        [12, 1.5, 0.3],
        [20.5, 1.4, 0.35],
      ],
    },
    lift: {
      base: 0.04,
      peaks: [
        [7.6, 1.4, 0.8],
        [13.2, 1, 0.35],
        [18.2, 1.6, 0.75],
      ],
    },
    bus: {
      base: 0.04,
      peaks: [
        [7.4, 1.4, 0.9],
        [12.5, 1, 0.3],
        [18.2, 1.8, 0.85],
      ],
    },
    exercise: {
      base: 0,
      peaks: [
        [6.4, 0.9, 0.9],
        [18.6, 0.8, 0.6],
      ],
    },
    play: {
      base: 0,
      peaks: [
        [9, 1.2, 0.4],
        [16.8, 1.8, 0.95],
        [19.8, 0.8, 0.4],
      ],
    },
    bench: {
      base: 0.03,
      peaks: [
        [8.5, 1.6, 0.6],
        [11.5, 1.5, 0.5],
        [17, 1.8, 0.7],
      ],
    },
    sweep: {
      base: 0,
      peaks: [
        [7, 1, 0.8],
        [14.2, 0.8, 0.6],
        [20.5, 0.7, 0.5],
      ],
    },
    // browsing and waiting outside the shops, clinic and library: busy mornings, lunch and the evening
    shop: {
      base: 0.1,
      peaks: [
        [10, 1.8, 0.55],
        [13.5, 1.4, 0.45],
        [18.4, 2, 0.8],
      ],
    },
    // picnics and sitting about on the grass: after school and at the weekend-feeling golden hour
    picnic: {
      base: 0,
      peaks: [
        [9.5, 1.4, 0.3],
        [17.2, 1.8, 0.85],
        [19.6, 0.9, 0.5],
      ],
    },
    // people standing about on the pavements: on the phone, waiting for a friend, looking around
    loiter: {
      base: 0.08,
      peaks: [
        [8, 1.4, 0.4],
        [12.8, 1.4, 0.4],
        [18.3, 1.8, 0.6],
        [20.6, 1.2, 0.35],
      ],
    },
  };
  const KINDS = Object.keys(CURVES);
  /** Hours the town is asleep: everything fades out between these. */
  const SLEEP_FROM = 23;
  const SLEEP_TO = 4.8;

  /** Small stable 32-bit string hash (FNV-1a), the same one the game layer uses. */
  function hashString(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  /** A stable number in [0, 1) for a text key. */
  function hash01(text) {
    return hashString(text) / 4294967296;
  }

  /** A smooth bump (0..height) around centre hour c with half-width w. */
  function bump(hour, c, w, height) {
    const x = Math.max(0, 1 - Math.abs(hour - c) / w);
    return height * x * x * (3 - 2 * x);
  }

  /** 1 during the day, fading to 0 around the sleeping hours. */
  function awake(hour) {
    if (hour >= SLEEP_FROM + 1 || hour < SLEEP_TO - 0.6) return 0;
    if (hour >= SLEEP_FROM) return 1 - (hour - SLEEP_FROM);
    if (hour < SLEEP_TO) return 0.4 * (1 - (SLEEP_TO - hour) / 0.6);
    return Math.min(1, 0.4 + (hour - SLEEP_TO) * 1.2);
  }

  /**
   * How busy a kind of place is: 0 (empty) to 1 (every spot taken).
   * @param {string} kind one of KQ.Sim.Crowd.KINDS
   * @param {number} minute game minute of the day (wrapped)
   */
  function occupancy(kind, minute) {
    const curve = CURVES[kind];
    if (!curve || !Number.isFinite(minute)) return 0;
    const hour = (((minute % 1440) + 1440) % 1440) / 60;
    let v = curve.base;
    curve.peaks.forEach((p) => (v = Math.max(v, curve.base + bump(hour, p[0], p[1], p[2]))));
    return Math.min(1, v) * awake(hour);
  }

  /** The occupancy block a minute falls in (changes every BLOCK_MIN game minutes). */
  function blockOf(minute) {
    return Math.floor((((minute % 1440) + 1440) % 1440) / BLOCK_MIN);
  }

  /** Is the fixed spot `key` occupied at this minute? Same key + block always answers the same. */
  function slotActive(key, occ, minute) {
    return hash01(key + "#" + blockOf(minute)) < occ;
  }

  /** The most extras a tier keeps alive (fixed spots + strollers). */
  function capFor(tier) {
    return TIER_CAPS[tier] || TIER_CAPS.med;
  }

  /** How many strollers should be out at this minute on this tier. */
  function walkerTarget(minute, tier) {
    const hour = (((minute % 1440) + 1440) % 1440) / 60;
    const rush =
      bump(hour, 7.7, 1.3, 0.55) + bump(hour, 18.3, 1.6, 0.55) + bump(hour, 12.8, 1.2, 0.25);
    const level = Math.min(1, 0.32 + rush);
    return Math.round(capFor(tier) * WALKER_SHARE * level * awake(hour));
  }

  /** Stroller types: speed (m/s), the walking pose, a loop-speed per m/s, and the prop carried. */
  const WALKERS = {
    commuter: { speed: [1.55, 1.95], pose: "walk", cycles: 0.78, prop: null },
    aunty: { speed: [1.0, 1.3], pose: "walkbag", cycles: 1.05, prop: "bag" },
    elder: { speed: [0.7, 0.95], pose: "walk", cycles: 0.7, prop: null },
    jogger: { speed: [2.5, 3.0], pose: "jog", cycles: 0.78, prop: null },
    kid: { speed: [2.0, 2.6], pose: "run", cycles: 0.95, prop: null },
    stroller: { speed: [1.1, 1.4], pose: "walk", cycles: 0.78, prop: null },
    cyclist: { speed: [3.4, 4.4], pose: "pedal", cycles: 0.5, prop: "bike" },
    // pupils in school uniform with a bag, often in a gang of two or three friends
    student: { speed: [1.5, 2.1], pose: "walkbag", cycles: 0.9, prop: "bag" },
    // a parent holding a little one's hand (the first person is the adult, the rest are children)
    family: { speed: [0.9, 1.15], pose: "walk_hold", cycles: 0.78, prop: null },
  };
  const WALKER_TYPES = Object.keys(WALKERS);

  /** Mix weights of stroller types at a time of day. */
  function walkerWeights(minute) {
    const hour = (((minute % 1440) + 1440) % 1440) / 60;
    return {
      commuter: 2 + bump(hour, 7.6, 1.2, 3) + bump(hour, 18.2, 1.5, 3),
      aunty: 1 + bump(hour, 9, 1.5, 2.5) + bump(hour, 17, 1.5, 2),
      elder: 1 + bump(hour, 8, 2, 1.5),
      jogger: bump(hour, 6.3, 1, 3) + bump(hour, 18.8, 1, 3),
      kid: bump(hour, 7.2, 0.7, 2) + bump(hour, 13.4, 0.8, 2) + bump(hour, 17, 1.5, 3),
      stroller: 1.2,
      cyclist: 0.5 + bump(hour, 17.5, 1.5, 1),
      student: bump(hour, 7, 0.8, 4) + bump(hour, 13.2, 1, 3) + bump(hour, 16.5, 1.5, 1.5),
      family: 0.5 + bump(hour, 9.5, 1.5, 1.5) + bump(hour, 17.6, 1.6, 2.5),
    };
  }

  /**
   * How many people walk together for a stroller type and a draw r in [0, 1): friends in twos and threes,
   * a parent with one or two children, pupils in gangs; everybody else on their own now and then in pairs.
   */
  function walkerGroup(type, r) {
    if (type === "family") return r < 0.7 ? 2 : 3;
    if (type === "student") return r < 0.35 ? 1 : r < 0.7 ? 2 : 3;
    if (type === "stroller") return r < 0.4 ? 1 : r < 0.8 ? 2 : 3;
    if (type === "commuter" || type === "elder") return r < 0.7 ? 1 : 2;
    return 1;
  }

  /** Pick one key of a { key: weight } table with a random number r in [0, 1). */
  function pickWeighted(weights, r) {
    const keys = Object.keys(weights);
    let total = 0;
    keys.forEach((k) => (total += weights[k]));
    let t = r * total;
    for (let i = 0; i < keys.length; i += 1) {
      t -= weights[keys[i]];
      if (t < 0) return keys[i];
    }
    return keys[keys.length - 1];
  }

  /** The stroller type for a random draw at a time of day. */
  function walkerType(minute, r) {
    return pickWeighted(walkerWeights(minute), r);
  }

  // ---------- outfits ----------
  const SKIN = [
    "#f6dcc0",
    "#f0c7a0",
    "#e3a97c",
    "#d49a6c",
    "#c68863",
    "#b87a52",
    "#94603d",
    "#8a5537",
    "#74462f",
  ];
  const SKIN_BY_GROUP = {
    malay: [2, 3, 3, 4, 5, 2],
    chinese: [0, 1, 1, 0, 2],
    indian: [5, 6, 7, 4, 8, 6],
    mixed: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  };
  const TOPS = [
    "#d27aa6",
    "#2f7466",
    "#2f8f6a",
    "#8a5a2b",
    "#4f86c6",
    "#c43c3c",
    "#2c6e9b",
    "#e0884a",
    "#3d8fb6",
    "#6c8f4e",
    "#f0c419",
    "#4bb3a8",
    "#e45b5b",
    "#3f6fa3",
    "#7b56a8",
    "#e6a33a",
    "#f4f1e8",
    "#8fb8d8",
    "#b4533a",
    "#a8c8a0",
    "#c9a0dc",
    "#1f4e79",
    "#ff7a59",
    "#7a1f3d",
  ];
  const BOTTOMS = [
    "#3b3f4a",
    "#b49a6e",
    "#2b2d42",
    "#454a55",
    "#2d5aa0",
    "#5b2a1e",
    "#3f4c6b",
    "#6b6258",
    "#8a7a5c",
    "#1f2a44",
  ];
  const SKIRTS = ["#5d3a86", "#22694f", "#3f4c6b", "#7a2e3a", "#2b2d42", "#8a5a2b", "#2f7466"];
  const TUDUNG = [
    "#7b56a8",
    "#e6a33a",
    "#fbfaf5",
    "#3e5aa8",
    "#c07da8",
    "#a8322b",
    "#2f7466",
    "#f0c0d0",
    "#4b4b52",
    "#5fa8a0",
    "#8a4b6b",
    "#c9b8a0",
  ];
  /** Dark to brown hair (a few dyed or sun-lightened), and the greys of the elders. */
  const HAIR = ["#141012", "#1d1410", "#2a1c14", "#3a2416", "#4a2c1a", "#6b3f22", "#5a1f2a"];
  const GREYS = ["#a8a49d", "#c9c6c0", "#e0ddd6"];
  const BAGS = ["#e23b3b", "#2a63b0", "#f2c230", "#3f9a5a", "#f4f1e8", "#e07a2f", "#8a3fa0"];
  /** Turbans (a few men in the Indian group) and school uniform bottoms. */
  const TURBANS = ["#1f3a6e", "#e6a33a", "#f4f1e8", "#17171c", "#8a1f2b", "#2f7466"];
  const UNIFORM_LEGS = ["#243a78", "#3b4660", "#4a4f5a"];
  const WHITE = "#f4f1e8";

  /** Take one entry of a list by a stable random draw. */
  function pick(list, r) {
    return list[Math.floor(r * list.length) % list.length];
  }

  /**
   * A hex colour lightened (k > 0) or darkened (k < 0) by a fraction |k|, as a new hex. This is how the crowd
   * gets thousands of looks from a few dozen colours: every part's instance colour is its own shade.
   */
  function shade(hex, k) {
    const n = parseInt(String(hex).slice(1), 16);
    const out = [n >> 16, (n >> 8) & 255, n & 255].map(function (c) {
      const v = k >= 0 ? c + (255 - c) * k : c * (1 + k);
      return Math.max(0, Math.min(255, Math.round(v)));
    });
    return "#" + out.map((c) => c.toString(16).padStart(2, "0")).join("");
  }

  /** Scramble 32 bits (the murmur3 finaliser), so draws from similar seeds are not correlated. */
  function scramble(x) {
    let h = x >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /** A deterministic stream of well-mixed draws in [0, 1) for a seed text. */
  function stream(seed) {
    let n = 0;
    return function next() {
      n += 1;
      return scramble(hashString(seed + ":" + n) + Math.imul(n, 0x9e3779b9));
    };
  }

  /** The cultural group an extra belongs to, which steers dress and skin tone. */
  function groupOf(r) {
    if (r < 0.42) return "malay";
    if (r < 0.72) return "chinese";
    if (r < 0.92) return "indian";
    return "mixed";
  }

  /** What a woman wears: a baju kurung set with tudung, a blouse and long skirt, or trousers. */
  function womanOutfit(o, next, group) {
    const kurung = group === "malay" ? next() < 0.7 : next() < 0.25;
    o.female = true;
    o.top = pick(TOPS, next());
    o.long = true;
    if (kurung) {
      o.skirt = true;
      o.legs = o.top;
    } else {
      o.skirt = next() < 0.4;
      o.legs = o.skirt ? pick(SKIRTS, next()) : pick(BOTTOMS, next());
    }
    o.head = group === "malay" || next() < 0.12 ? "tudung" : next() < 0.3 ? "bun" : "hair";
    o.headColour = o.head === "tudung" ? pick(TUDUNG, next()) : pick(HAIR, next());
  }

  /** What a man wears: a collared shirt and trousers, a baju melayu with songkok, a turban, a cap or a tee. */
  function manOutfit(o, next, group) {
    o.top = pick(TOPS, next());
    o.long = next() < 0.45;
    o.legs = pick(BOTTOMS, next());
    const prayerCap = group === "malay" && next() < 0.45;
    if (prayerCap) {
      o.head = next() < 0.65 ? "songkok" : "kopiah";
      o.headColour = o.head === "songkok" ? "#1c1c22" : "#fbfaf5";
    } else if (group === "indian" && next() < 0.16) {
      o.head = "turban";
      o.headColour = pick(TURBANS, next());
      o.long = true;
    } else if (next() < 0.2) {
      o.head = "cap";
      o.headColour = pick(TOPS, next());
    } else {
      o.head = "hair";
      o.headColour = pick(HAIR, next());
    }
  }

  /** What a child wears: a tee and shorts (or a school uniform), a girl sometimes in a tudung. */
  function kidOutfit(o, next, group, girl) {
    o.kid = true;
    o.shorts = !(girl && group === "malay");
    o.top = next() < 0.3 ? WHITE : pick(TOPS, next());
    o.legs = o.top === WHITE ? pick(UNIFORM_LEGS, next()) : pick(BOTTOMS, next());
    o.long = !o.shorts;
    o.skirt = !o.shorts;
    o.female = girl;
    o.head = girl && group === "malay" ? "tudung_kid" : next() < 0.15 ? "cap" : "hair";
    if (o.head === "tudung_kid") o.headColour = pick(TUDUNG, next());
    else o.headColour = o.head === "cap" ? pick(TOPS, next()) : pick(HAIR.slice(0, 4), next());
  }

  /** A pupil's school uniform (white top, navy or grey bottoms): kids in shorts, teens in trousers, girls modest. */
  function uniformOutfit(o, next, group) {
    const modest = o.female && group === "malay";
    o.top = WHITE;
    o.legs = pick(UNIFORM_LEGS, next());
    o.long = !o.kid || modest;
    o.shorts = o.kid && !modest;
    o.skirt = o.female && (!o.kid || modest);
    o.head = modest ? (o.kid ? "tudung_kid" : "tudung") : "hair";
    o.headColour = modest ? "#fbfaf5" : pick(HAIR.slice(0, 4), next());
  }

  /** Height and girth: kids and teens are smaller, adults vary a good deal, a few are stocky or slight. */
  function bodySize(o, next) {
    const g = next();
    if (o.kid) {
      o.scale = 0.88 + next() * 0.2;
      o.girth = 0.92 + next() * 0.14;
    } else if (o.age === "teen") {
      o.scale = 0.84 + next() * 0.1;
      o.girth = 0.9 + next() * 0.12;
    } else {
      o.scale = (o.age === "elder" ? 0.92 : 0.95) + next() * 0.14;
      o.girth =
        g < 0.15 ? 0.88 + next() * 0.06 : g < 0.7 ? 0.95 + next() * 0.1 : 1.08 + next() * 0.14;
    }
  }

  /** The age band a role asks for (a draw decides for "any", and for a pupil's kid or teen). */
  function ageOf(role, next) {
    if (role === "student") return next() < 0.55 ? "kid" : "teen";
    if (role === "any" || !role) {
      const r = next();
      return r < 0.13 ? "kid" : r < 0.2 ? "teen" : r < 0.36 ? "elder" : "adult";
    }
    return role;
  }

  /** Per-person colour variation: each garment a touch lighter or darker, so no two people look alike. */
  function varyColours(o, next) {
    o.skin = shade(o.skin, (next() - 0.5) * 0.1);
    const same = o.legs === o.top;
    o.top = shade(o.top, (next() - 0.5) * 0.2);
    o.legs = same ? o.top : shade(o.legs, (next() - 0.5) * 0.2);
    if (o.head === "tudung" || o.head === "cap")
      o.headColour = shade(o.headColour, (next() - 0.5) * 0.16);
  }

  /**
   * A whole outfit for an extra, from a seed text. `role` steers the age: "adult", "elder", "teen", "kid",
   * "student" (a kid or teen in school uniform) or "any"; `female` (optional boolean) fixes the gender.
   * @returns {{kid:boolean, female:boolean, skin:string, top:string, legs:string, long:boolean,
   *   skirt:boolean, shorts:boolean, head:string, headColour:string, bag:string, bike:string,
   *   scale:number, girth:number, group:string, age:string}}
   */
  function outfit(seed, role, female) {
    const next = stream(seed);
    const group = groupOf(next());
    const o = { kid: false, female: false, skirt: false, shorts: false, long: false, group };
    o.age = ageOf(role, next);
    o.skin = SKIN[pick(SKIN_BY_GROUP[group], next())];
    const drawn = next() < 0.5;
    o.female = female === undefined ? drawn : female;
    if (o.age === "kid") kidOutfit(o, next, group, o.female);
    else if (o.female) womanOutfit(o, next, group);
    else manOutfit(o, next, group);
    if (role === "student") uniformOutfit(o, next, group);
    if (o.age === "elder" && (o.head === "hair" || o.head === "bun"))
      o.headColour = pick(GREYS, next());
    o.bag = pick(BAGS, next());
    o.bike = pick(TOPS, next());
    varyColours(o, next);
    bodySize(o, next);
    return o;
  }

  // ---------- layout helpers ----------
  /** The yaw (rotation.y, 0 = facing +Z) that faces from (ax, az) toward (bx, bz). */
  function headingTo(ax, az, bx, bz) {
    return Math.atan2(bx - ax, bz - az);
  }

  /**
   * Spots on a ring around (cx, cz), each facing the middle, for a standing chat.
   * @param {number} n 2..5 people
   * @param {number} [phase=0] rotation of the first spot in radians
   */
  function circleSlots(cx, cz, n, radius, phase) {
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const a = (phase || 0) + (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * radius;
      const z = cz + Math.sin(a) * radius;
      out.push({ x, z, heading: headingTo(x, z, cx, cz) });
    }
    return out;
  }

  /** A queue of n people standing side by side along x from (x0, z), all facing `heading`. */
  function queueSlots(x0, z, n, step, dir, heading) {
    const out = [];
    for (let i = 0; i < n; i += 1) out.push({ x: x0 + dir * i * step, z, heading, index: i });
    return out;
  }

  /** A cols x rows grid centred on (cx, cz), everyone facing the same way (tai chi, line dancing). */
  function gridSlots(cx, cz, cols, rows, gap, heading) {
    const out = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        out.push({
          x: cx + (c - (cols - 1) / 2) * gap,
          z: cz + (r - (rows - 1) / 2) * gap,
          heading,
        });
      }
    }
    return out;
  }

  /**
   * Whose turn to talk in a chat group at time t (seconds): everyone listens except one, and the
   * speaker changes every `turn` seconds.
   */
  function speakerAt(groupSeed, size, t, turn) {
    const base = Math.floor(hash01(groupSeed) * size);
    return (base + Math.floor(t / turn)) % size;
  }

  KQ.Sim.Crowd = {
    KINDS,
    BLOCK_MIN,
    TIER_CAPS,
    WALKERS,
    WALKER_TYPES,
    hash01,
    occupancy,
    blockOf,
    slotActive,
    capFor,
    walkerTarget,
    walkerWeights,
    walkerType,
    walkerGroup,
    pickWeighted,
    outfit,
    shade,
    headingTo,
    circleSlots,
    queueSlots,
    gridSlots,
    speakerAt,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
