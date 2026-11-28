/* ============================================================================
 * FILE: missions-more.js
 * PURPOSE: The second batch of missions (playability round AC-P19): more verbs than "buy and
 *          deliver" (push, collect, escort, race the bubble, say hi, photograph, ride) in both
 *          regions, the two Makkah / Madinah guides who give the Haramain ones, and the extra
 *          stickers. Appended to KQ.Sim.MISSIONS / STICKERS before missions.js reads them.
 * BUSINESS CONTEXT: AC-P19 (>= 8 new missions, varied verbs, spread over both regions, no fail
 *   state). New step types, all matched by the existing generic `type + target (+ item)` rule:
 *     greet(people|kids, count)  say hi to people (crowd extras and neighbours)
 *     photo(poi)                 stand at a place and press Photo
 *     ride(poi, item?)           arrive at a place on a bicycle / scooter / car / mount
 *     escort(poi, who)           walk a neighbour (`who`) to a place; they follow the hero
 *   A step may carry `verb` (the button word) and `quick` (no dialogue page, just a bubble) and a
 *   mission may carry `beat: {secs, coins}` ("beat the bubble": faster earns a bonus, slower
 *   loses nothing), `region` ("kampung" by default) and `needs` (places the world must have).
 *   Gender-neutral wording toward the hero (a girl hero is a choice). Muslim givers open with the
 *   salaam; non-Muslim ones use a plain greeting (the same rule as missions-data.js).
 * DEPENDENCIES: missions-data.js (loads first). Pure: no THREE, no DOM.
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/missions.test.mjs, missions-more.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /** The two guides who give the Makkah and Madinah missions (they stand at a fixed place). */
  const GUIDES = {
    guide_makkah: { name: "Ustaz Bilal", muslim: true, city: "makkah", poi: "forecourt" },
    guide_madinah: { name: "Ustazah Mariam", muslim: true, city: "madinah", poi: "busStop" },
  };

  /** Makkah and Madinah place ids missions may use (the optional ones exist only when built). */
  const HOLY_POI_IDS = [
    "forecourt",
    "gate",
    "zamzam",
    "clock",
    "mataf",
    "safa",
    "marwa",
    "miqat",
    "busStop",
    "nabGate",
    "rawdah",
    "quba",
    "uhud",
    "camel_yard",
    "horse_stable",
    "pony_ride",
  ];

  /** One step: type, target, label and any extras (count, item, verb, quick, who, line). */
  function step(type, target, label, extra) {
    return Object.assign({ type, target, label }, extra || {});
  }

  /** A mission from its parts; `extra` carries region, needs and beat. */
  function make(id, title, titleMs, giver, lines, steps, reward, extra) {
    return Object.assign(
      {
        id,
        title,
        titleMs,
        giver,
        intro: lines[0],
        reminder: lines[1],
        thanks: lines[2],
        steps,
        reward,
      },
      extra || {},
    );
  }

  const KAMPUNG = [
    make(
      "push_the_car",
      "Push the stalled car",
      "Tolak kereta",
      "uncle_lim",
      [
        [
          "Aiyo, my car won't start right here!",
          "Can you help me push it? Press Push three times when I say heave!",
        ],
        ["Heave-ho! Press Push three times, ah."],
        ["Vroom! It works! You are strong, young one. Here, for you."],
      ],
      [
        step("talk", "uncle_lim", "Push the car with Uncle Lim", {
          count: 3,
          verb: "Push",
          quick: true,
        }),
        step("talk", "uncle_lim", "Hear the engine start", { line: "Vroom vroom! Thank you!" }),
      ],
      { coins: 5, stickers: ["sticker_push"] },
    ),
    make(
      "rambutan_basket",
      "Rambutans for Makcik Siti",
      "Rambutan untuk Makcik Siti",
      "makcik_siti",
      [
        [
          "Assalamualaikum, nak! The rambutans in the park are ripe.",
          "Can you pick 5 for me? I'll make a sweet fruit bowl.",
        ],
        ["Five rambutans from the park, then bring them to me."],
        ["Alhamdulillah, so juicy! Here is a little something for you."],
      ],
      [
        step("collect", "park", "Pick 5 rambutans in the park", { count: 5, item: "rambutan" }),
        step("deliver", "makcik_siti", "Bring the rambutans to Makcik Siti", { item: "rambutan" }),
      ],
      { coins: 6, stickers: ["sticker_rambutan"] },
    ),
    make(
      "walk_wei_home",
      "Walk Wei home",
      "Hantar Wei pulang",
      "aunty_mei",
      [
        [
          "Hello, hello! It's getting late and Wei is still out.",
          "Can you walk Wei home to Block C? Ask Wei to come along.",
        ],
        ["Wei will follow you. Walk to Block C together, ya."],
        ["Aiyo, safe and sound! Thank you for looking after him. Here, for you."],
      ],
      [
        step("talk", "kid_wei", "Ask Wei to come with you", {
          line: "Okay! Let's go home. Race you there!",
        }),
        step("escort", "block_c", "Walk Wei home to Block C", { who: "kid_wei" }),
        step("talk", "aunty_mei", "Tell Aunty Mei that Wei is home"),
      ],
      { coins: 7, stickers: ["sticker_walkhome"] },
    ),
    make(
      "prata_dash",
      "Hot prata dash",
      "Roti prata panas",
      "hawker_ali",
      [
        [
          "Assalamualaikum! Dr Nurul is on a short break.",
          "Roti prata is best when hot. Can you beat the bubble? Fast is a bonus, slow is fine!",
        ],
        ["Prata from my stall, then to Dr Nurul. No rush, but hot is best!"],
        ["Sedap! Thank you, you're quick. Terima kasih!"],
      ],
      [
        step("buy", "stall_prata", "Buy a hot roti prata", { item: "roti_prata" }),
        step("deliver", "dr_nurul", "Take the prata to Dr Nurul", { item: "roti_prata" }),
      ],
      { coins: 4, stickers: ["sticker_pratadash"] },
      { beat: { secs: 100, coins: 3 } },
    ),
    make(
      "friendly_five",
      "Say hi to five people",
      "Sapa lima orang",
      "kid_irfan",
      [
        [
          "Assalamualaikum! I want our kampung to be extra friendly.",
          "Can you say hi to 5 people? Press Say hi when you are near someone.",
        ],
        ["Say hi to 5 people. Smiles are free!"],
        ["Yay! So many new friends. Terima kasih!"],
      ],
      [
        step("greet", "people", "Say hi to 5 people", { count: 5, verb: "Say hi" }),
        step("talk", "kid_irfan", "Tell Irfan how it went"),
      ],
      { coins: 5, stickers: ["sticker_friendly5"] },
    ),
    make(
      "kampung_photos",
      "Kampung photo album",
      "Album gambar kampung",
      "kid_aisyah",
      [
        [
          "Assalamualaikum! I'm making a picture album for school.",
          "Can you take photos of the mosque gate and the playground?",
        ],
        ["A photo at the mosque gate, then one at the playground. Press Photo!"],
        ["Cantik! My teacher will love it. Terima kasih!"],
      ],
      [
        step("photo", "mosque_gate", "Take a photo at the mosque gate", { verb: "Photo" }),
        step("photo", "playground", "Take a photo at the playground", { verb: "Photo" }),
        step("talk", "kid_aisyah", "Show Aisyah the photos"),
      ],
      { coins: 6, stickers: ["sticker_photos"] },
    ),
    make(
      "bike_to_library",
      "Ride to the library",
      "Berbasikal ke perpustakaan",
      "postman_dan",
      [
        [
          "Good day! I have a parcel of books for the library.",
          "Hop on a bicycle (or any ride) and take it to the library. Careful on the road!",
        ],
        ["Ride to the library, then give the parcel to Cik Farah."],
        ["Ding-ding! Quick as the post. Thank you!"],
      ],
      [
        step("ride", "library", "Ride to the library", { verb: "Ride" }),
        step("deliver", "librarian_farah", "Give the parcel to Cik Farah", {
          item: "parcel",
          line: "Books! Thank you for riding all this way.",
        }),
      ],
      { coins: 6, stickers: ["sticker_bike"] },
    ),
    make(
      "visit_the_ponies",
      "Visit the ponies",
      "Melawat kuda kecil",
      "kid_wei",
      [
        [
          "Hi! There are ponies in the park today.",
          "Go and see them, then tell me what they look like!",
        ],
        ["The ponies are in the park. Go and say hello!"],
        ["Wow, ponies! Thank you for telling me. Here, for you."],
      ],
      [
        step("goto", "pony_ride", "Visit the ponies"),
        step("talk", "kid_wei", "Tell Wei about the ponies"),
      ],
      { coins: 5, stickers: ["sticker_pony"] },
      { needs: ["pony_ride"] },
    ),
  ];

  const HARAMAIN = [
    make(
      "h_new_friends",
      "Say salaam to pilgrims",
      "Beri salam kepada jemaah",
      "guide_makkah",
      [
        [
          "Assalamualaikum, welcome to Makkah!",
          "Visitors from all over the world are here. Please say hi to 4 of them.",
        ],
        ["Say hi to 4 pilgrims. A smile is a gift."],
        ["Jazakallah khair! You made the Haram friendlier."],
      ],
      [
        step("greet", "people", "Say hi to 4 pilgrims", { count: 4, verb: "Say hi" }),
        step("talk", "guide_makkah", "Tell Ustaz Bilal"),
      ],
      { coins: 5, stickers: ["sticker_hellopilgrims"] },
      { region: "haramain" },
    ),
    make(
      "h_zamzam_walk",
      "Zamzam and the clock tower",
      "Zamzam dan menara jam",
      "guide_makkah",
      [
        [
          "Assalamualaikum! Let me show you two good places.",
          "Visit the zamzam taps, then the clock tower.",
        ],
        ["First the zamzam taps, then the clock tower."],
        ["Alhamdulillah! Now you know your way around."],
      ],
      [
        step("goto", "zamzam", "Walk to the zamzam taps"),
        step("goto", "clock", "Walk to the clock tower"),
        step("talk", "guide_makkah", "Tell Ustaz Bilal"),
      ],
      { coins: 6, stickers: ["sticker_zamzam"] },
      { region: "haramain" },
    ),
    make(
      "h_visit_camels",
      "Visit the camels",
      "Melawat unta",
      "guide_makkah",
      [
        [
          "Assalamualaikum! Camels live near the edge of the city.",
          "Find the camel yard and take a photo for me.",
        ],
        ["Find the camel yard and press Photo."],
        ["Masya-Allah, what lovely camels! Thank you."],
      ],
      [
        step("goto", "camel_yard", "Walk to the camel yard"),
        step("photo", "camel_yard", "Take a photo of the camels", { verb: "Photo" }),
        step("talk", "guide_makkah", "Show Ustaz Bilal"),
      ],
      { coins: 7, stickers: ["sticker_camels"] },
      { region: "haramain", needs: ["camel_yard"] },
    ),
    make(
      "h_madinah_photos",
      "Photos in Madinah",
      "Gambar di Madinah",
      "guide_madinah",
      [
        [
          "Assalamualaikum! Welcome to Madinah, the city of light.",
          "Please take photos of the Prophet's Mosque gate and of Quba.",
        ],
        ["A photo at the mosque gate, then one at Quba."],
        ["Jazakallah khair! Beautiful memories."],
      ],
      [
        step("photo", "nabGate", "Take a photo at the Prophet's Mosque gate", { verb: "Photo" }),
        step("photo", "quba", "Take a photo at Quba", { verb: "Photo" }),
        step("talk", "guide_madinah", "Show Ustazah Mariam"),
      ],
      { coins: 7, stickers: ["sticker_madinahphotos"] },
      { region: "haramain" },
    ),
    make(
      "h_ride_to_quba",
      "Ride to Quba",
      "Menaiki kenderaan ke Quba",
      "guide_madinah",
      [
        [
          "Assalamualaikum! Quba is a little way from here.",
          "Ride a bike, scooter or car there, then tell me about it.",
        ],
        ["Ride to Quba. Go slowly near people, ya."],
        ["Alhamdulillah! A fine journey. Terima kasih."],
      ],
      [
        step("ride", "quba", "Ride to Quba", { verb: "Ride" }),
        step("talk", "guide_madinah", "Tell Ustazah Mariam"),
      ],
      { coins: 6, stickers: ["sticker_qubaride"] },
      { region: "haramain" },
    ),
  ];

  const MORE_STICKERS = [
    ["sticker_push", "Push the car"],
    ["sticker_rambutan", "Rambutans"],
    ["sticker_walkhome", "Walk home"],
    ["sticker_pratadash", "Prata dash"],
    ["sticker_friendly5", "Say hi"],
    ["sticker_photos", "Photo album"],
    ["sticker_bike", "Bike ride"],
    ["sticker_pony", "Ponies"],
    ["sticker_hellopilgrims", "New friends"],
    ["sticker_zamzam", "Zamzam walk"],
    ["sticker_camels", "Camels"],
    ["sticker_madinahphotos", "Madinah photos"],
    ["sticker_qubaride", "Ride to Quba"],
    ["sticker_friendly", "Friendly"],
    ["sticker_wedding", "Wedding guest"],
    ["sticker_gift", "Dates and zamzam"],
  ].map((pair) => ({ id: pair[0], name: pair[1] }));

  KAMPUNG.concat(HARAMAIN).forEach((m) => KQ.Sim.MISSIONS.push(m));
  MORE_STICKERS.forEach((s) => KQ.Sim.STICKERS.push(s));
  KQ.Sim.GUIDES = GUIDES;
  // The guides are neighbours too (talkable, with a profile) but NOT in NPC_IDS, so the kampung
  // cast, the schedule and the voices never build them; only the Makkah / Madinah world does.
  Object.keys(GUIDES).forEach((id) => {
    KQ.Sim.NPC_PROFILE[id] = { name: GUIDES[id].name, muslim: true, adult: true, guide: true };
  });
  KQ.Sim.CHAT.guide_makkah = [
    "Assalamualaikum! Welcome to Makkah. Walk slowly and smile at everyone.",
    "The Haram is full of friends you have not met yet.",
  ];
  KQ.Sim.CHAT.guide_madinah = [
    "Assalamualaikum! Welcome to Madinah, the city of light.",
    "Take your time. Madinah is a gentle place.",
  ];
  KQ.Sim.HOLY_POI_IDS = HOLY_POI_IDS;
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
