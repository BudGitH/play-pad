/* ============================================================================
 * FILE: missions-data.js
 * PURPOSE: Data for Kampung Quest's missions, stickers and NPC chat lines.
 * BUSINESS CONTEXT: AC-11, AC-12, business rule 1 (child-friendly: errands, helping
 *   neighbours, a lost cat, recycling, delivering kuih, a clean playground, giving
 *   salam to the imam). Only contract POI / NPC ids are used (checked by tests).
 *   Step types: goto(poi) talk(npc) buy(poi [+item]) deliver(npc [+item]) collect(poi, count).
 * DEPENDENCIES: none at load time (validated against ids.js by the unit tests).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/missions.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  /** One mission step: what to do (type), where or to whom (target) and the label the tracker shows. */
  function step(type, target, label, extra) {
    return Object.assign({ type, target, label }, extra || {});
  }

  /** Assemble a mission from its three dialogue pages (intro, reminder, thanks), steps and reward. */
  function mission(id, title, titleMs, giver, lines, steps, reward) {
    return {
      id,
      title,
      titleMs,
      giver,
      intro: lines[0],
      reminder: lines[1],
      thanks: lines[2],
      steps,
      reward,
    };
  }

  const MISSIONS = [
    mission(
      "prata_for_nenek",
      "Roti prata for Nenek",
      "Roti prata untuk Nenek",
      "nenek",
      [
        [
          "Assalamualaikum, cucu! Nenek lapar la.",
          "Can you buy one roti prata from the hawker centre for me? Terima kasih!",
        ],
        ["The prata stall is at the hawker centre, sayang."],
        ["Alhamdulillah... wah, sedap! Thank you, cucu. Here's a little something for you."],
      ],
      [
        step("buy", "stall_prata", "Buy roti prata at the prata stall", { item: "roti_prata" }),
        step("deliver", "nenek", "Bring the roti prata to Nenek", { item: "roti_prata" }),
      ],
      { coins: 5, stickers: ["sticker_prata"] },
    ),

    mission(
      "salam_to_imam",
      "Salam for the Imam",
      "Salam untuk Imam",
      "atuk",
      [
        [
          "Assalamualaikum, young one. Atuk has a favour to ask.",
          "Please give my salam to Imam Hakim at the mosque.",
        ],
        ["Imam Hakim is near the mosque gate, nak."],
        ["Alhamdulillah. You are a good child. Take this for your trouble."],
      ],
      [
        step("goto", "mosque_gate", "Walk to the mosque gate"),
        step("talk", "imam_hakim", "Give salam to Imam Hakim", {
          line: "Waalaikumsalam wa rahmatullah, nak. Thank you for Atuk's salam. May Allah bless you!",
        }),
      ],
      { coins: 4, stickers: ["sticker_salam"] },
    ),

    mission(
      "lost_cat",
      "Find Mimi the cat",
      "Cari kucing Mimi",
      "kid_aisyah",
      [
        [
          "Assalamualaikum! My kucing Mimi is missing!",
          "Can you help me look for her? She likes quiet, shady places.",
        ],
        ["Please keep looking. Mimi must be somewhere near the park!"],
        ["Mimi! Mimi, you're safe! Terima kasih so much!"],
      ],
      [
        step("goto", "park", "Look for Mimi in the park"),
        step("goto", "playground", "Check the playground"),
        step("deliver", "kid_aisyah", "Bring Mimi back to Aisyah", { item: "cat" }),
      ],
      { coins: 6, stickers: ["sticker_cat"] },
    ),

    mission(
      "recycling_hero",
      "Recycling hero",
      "Wira kitar semula",
      "aunty_mei",
      [
        [
          "Hello, hello! Aunty is collecting old cans.",
          "Can help me pick up 3 cans in the park? Then put them in the recycling bin.",
        ],
        ["Three cans from the park, then the recycling bin. Jia you!"],
        ["Wah, so clever! The earth says thank you. Here, for you."],
      ],
      [
        step("collect", "park", "Pick up 3 cans in the park", { count: 3, item: "can" }),
        step("goto", "recycling", "Put them in the recycling bin"),
        step("talk", "aunty_mei", "Tell Aunty Mei you're done"),
      ],
      { coins: 5, stickers: ["sticker_recycle"] },
    ),

    mission(
      "groceries_for_atuk",
      "Groceries for Atuk",
      "Barang dapur untuk Atuk",
      "makcik_siti",
      [
        [
          "Assalamualaikum, nak! Atuk's groceries are too heavy for him.",
          "Can you buy a bag at the mini-mart and carry it to him?",
        ],
        ["The mini-mart has the groceries. Then take them to Atuk, ya."],
        ["Alhamdulillah, thank you! You're so helpful."],
      ],
      [
        step("buy", "minimart", "Buy a bag of groceries at the mini-mart", { item: "groceries" }),
        step("deliver", "atuk", "Carry the groceries to Atuk", { item: "groceries" }),
      ],
      { coins: 6, stickers: ["sticker_groceries"] },
    ),

    mission(
      "kuih_delivery",
      "Kuih delivery",
      "Hantar kuih",
      "hawker_aminah",
      [
        [
          "Assalamualaikum! I made kuih lapis this morning.",
          "Please take a box to Cik Farah at the library and one to Dr Nurul.",
        ],
        ["Cik Farah first, then Dr Nurul. Careful with the kuih!"],
        ["Alhamdulillah! Everyone loved the kuih. Terima kasih!"],
      ],
      [
        step("deliver", "librarian_farah", "Give kuih to Cik Farah", {
          item: "kuih_lapis",
          line: "Kuih lapis! Ooh, my favourite. Terima kasih!",
        }),
        step("deliver", "dr_nurul", "Give kuih to Dr Nurul", {
          item: "kuih_lapis",
          line: "How thoughtful! Please thank Kak Aminah for me.",
        }),
      ],
      { coins: 6, stickers: ["sticker_kuih"] },
    ),

    mission(
      "clean_playground",
      "Clean the playground",
      "Bersihkan taman permainan",
      "pakcik_rahman",
      [
        [
          "Assalamualaikum, adik! The playground has some litter.",
          "Can you pick up 4 pieces so the children can play safely?",
        ],
        ["Four pieces of litter, then the recycling bin. Jazakallah khair!"],
        ["Alhamdulillah, so clean now! Here is a little reward."],
      ],
      [
        step("collect", "playground", "Pick up 4 pieces of litter", { count: 4, item: "litter" }),
        step("goto", "recycling", "Take it to the recycling point"),
        step("talk", "pakcik_rahman", "Tell Pakcik Rahman it's clean"),
      ],
      { coins: 7, stickers: ["sticker_playground"] },
    ),

    mission(
      "return_the_book",
      "Return the book",
      "Pulangkan buku",
      "kid_irfan",
      [
        [
          "Assalamualaikum! Can you help me? I'm late for football.",
          "Please return this book to Cik Farah at the library.",
        ],
        ["Cik Farah is at the library. Thanks!"],
        ["Yay, no late fee! You're the best. Terima kasih!"],
      ],
      [
        step("deliver", "librarian_farah", "Return Irfan's book to Cik Farah", {
          item: "book",
          line: "Thank you! Tell Irfan he's welcome to borrow another one.",
        }),
        step("talk", "kid_irfan", "Tell Irfan the book is back"),
      ],
      { coins: 4, stickers: ["sticker_book"] },
    ),

    mission(
      "get_well_card",
      "A card for Atuk",
      "Kad untuk Atuk",
      "dr_nurul",
      [
        [
          "Assalamualaikum! Atuk has a little cough today.",
          "A get-well card from the mini-mart would cheer him up.",
        ],
        ["The mini-mart sells get-well cards. Then take it to Atuk."],
        ["What a lovely card, thank you! Alhamdulillah, I feel better already."],
      ],
      [
        step("buy", "minimart", "Buy a get-well card at the mini-mart", { item: "get_well_card" }),
        step("deliver", "atuk", "Give the card to Atuk", { item: "get_well_card" }),
      ],
      { coins: 5, stickers: ["sticker_card"] },
    ),

    mission(
      "parcel_run",
      "Parcel run",
      "Hantar bungkusan",
      "postman_dan",
      [
        [
          "Good day! So many parcels today.",
          "Can you help me deliver three? Uncle Lim, Makcik Siti and Pakcik Rahman.",
        ],
        ["Three parcels: Uncle Lim, Makcik Siti, Pakcik Rahman."],
        ["Wonderful! You're an honorary postman now."],
      ],
      [
        step("deliver", "uncle_lim", "Deliver a parcel to Uncle Lim", {
          item: "parcel",
          line: "Ah, my parcel! Thank you, young one.",
        }),
        step("deliver", "makcik_siti", "Deliver a parcel to Makcik Siti", {
          item: "parcel",
          line: "Terima kasih, nak! Waalaikumsalam.",
        }),
        step("deliver", "pakcik_rahman", "Deliver a parcel to Pakcik Rahman", {
          item: "parcel",
          line: "Jazakallah khair, adik.",
        }),
      ],
      { coins: 7, stickers: ["sticker_parcel"] },
    ),

    mission(
      "teh_tarik_for_uncle",
      "Teh tarik for Uncle Lim",
      "Teh tarik untuk Uncle Lim",
      "hawker_ali",
      [
        [
          "Assalamualaikum! Uncle Lim loves a hot teh tarik in the morning.",
          "Can you buy one at the drinks stall and take it to him?",
        ],
        ["Teh tarik from the drinks stall, then Uncle Lim. Don't spill!"],
        ["Thank you, my friend! Sedap, sedap."],
      ],
      [
        step("buy", "stall_drinks", "Buy a teh tarik", { item: "teh_tarik" }),
        step("deliver", "uncle_lim", "Take the teh tarik to Uncle Lim", { item: "teh_tarik" }),
      ],
      { coins: 5, stickers: ["sticker_tehtarik"] },
    ),

    mission(
      "fun_day_flyers",
      "Kampung Fun Day flyers",
      "Risalah Hari Keseronokan",
      "barber_raju",
      [
        [
          "Hello, hello! The Kampung Fun Day is coming up.",
          "Can you hand out flyers to Cik Farah, Aunty Mei and Wei?",
        ],
        ["Three flyers: Cik Farah, Aunty Mei and Wei."],
        ["Fantastic! Everyone will come now. Thank you!"],
      ],
      [
        step("deliver", "librarian_farah", "Give a flyer to Cik Farah", { item: "flyer" }),
        step("deliver", "aunty_mei", "Give a flyer to Aunty Mei", { item: "flyer" }),
        step("deliver", "kid_wei", "Give a flyer to Wei", {
          item: "flyer",
          line: "Cool! I'll bring my friends!",
        }),
      ],
      { coins: 6, stickers: ["sticker_funday"] },
    ),
  ];

  /** Sticker catalogue: one per mission plus a star for each prayer. */
  const STICKERS = [
    ["sticker_prata", "Roti prata"],
    ["sticker_salam", "Salam"],
    ["sticker_cat", "Mimi the cat"],
    ["sticker_recycle", "Recycling hero"],
    ["sticker_groceries", "Groceries"],
    ["sticker_kuih", "Kuih lapis"],
    ["sticker_playground", "Clean playground"],
    ["sticker_book", "Library book"],
    ["sticker_card", "Get-well card"],
    ["sticker_parcel", "Parcel run"],
    ["sticker_tehtarik", "Teh tarik"],
    ["sticker_funday", "Fun Day"],
    ["prayer_subuh", "Subuh star"],
    ["prayer_zohor", "Zohor star"],
    ["prayer_asar", "Asar star"],
    ["prayer_maghrib", "Maghrib star"],
    ["prayer_isyak", "Isyak star"],
  ].map((pair) => ({ id: pair[0], name: pair[1] }));

  /**
   * Friendly small talk. Muslim neighbours open with "Assalamualaikum" and the hero's reply button
   * answers "Waalaikumsalam" (a reply never comes first); the neighbours who are not Muslim
   * (Uncle Lim, Aunty Mei, Wei, Raju, Dan) use a plain friendly greeting. Everyone is kind.
   */
  const CHAT = {
    nenek: ["Assalamualaikum, cucu! Sudah makan?", "Don't forget to pray on time, ya."],
    atuk: [
      "Assalamualaikum, young one. Nice day for a walk.",
      "Atuk used to sell kuih at this very market.",
    ],
    imam_hakim: [
      "Assalamualaikum, adik. May Allah bless your day.",
      "The mosque is always open to you.",
    ],
    makcik_siti: [
      "Assalamualaikum, nak! Hati-hati, ya.",
      "Have you eaten? The nasi lemak is sedap today.",
    ],
    pakcik_rahman: [
      "Assalamualaikum, adik! Helping the neighbours is a good habit.",
      "Good morning! Many hands make light work.",
    ],
    uncle_lim: ["Morning! Weather very nice today, hor?", "Hello, young one! Eat already?"],
    aunty_mei: [
      "Aiyo, hello! So energetic, you!",
      "Selamat pagi! Aunty is learning Malay. Bagus tak?",
    ],
    hawker_ali: [
      "Assalamualaikum! Roti prata fresh from the pan!",
      "Come, come - lapar? Good food here.",
    ],
    hawker_aminah: [
      "Assalamualaikum! Nasi lemak, still hot!",
      "Try my kuih, adik. Halal and homemade.",
    ],
    barber_raju: [
      "Hello, hello! Hair getting long, ah?",
      "Come and sit! A neat haircut makes a happy day.",
    ],
    dr_nurul: [
      "Assalamualaikum! Drink water and rest well.",
      "A healthy kampung is a happy kampung.",
    ],
    librarian_farah: [
      "Assalamualaikum! Shh... a story is waiting for you.",
      "Reading takes you everywhere.",
    ],
    kid_irfan: ["Assalamualaikum! Want to play at the playground?", "I can run super fast!"],
    kid_aisyah: ["Assalamualaikum! Have you seen my cat Mimi?", "I like drawing. Do you?"],
    kid_wei: ["Hi! Want to play later?", "My kite can fly really high!"],
    postman_dan: ["Good day! So many parcels today.", "Neighbours here are the friendliest."],
  };

  KQ.Sim.MISSIONS = MISSIONS;
  KQ.Sim.STICKERS = STICKERS;
  KQ.Sim.CHAT = CHAT;
  KQ.Sim.SALAM = { greet: "Assalamualaikum!", reply: "Waalaikumsalam!" };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
