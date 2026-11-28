/* ============================================================================
 * FILE: hi.js
 * PURPOSE: The words and the counting for "Say hi" (and for a kid who says hi first): what the
 *          hero says, how a crowd extra answers by age and kind, and a small tally that turns
 *          every few friendly hellos into a tiny reward. Pure logic: the game layer picks the
 *          person and draws the bubbles.
 * BUSINESS CONTEXT: playability round AC-P17 (kids and neighbours greet, and can be greeted).
 *   Religious accuracy follows greet.js: the salaam exchange happens only between Muslim people
 *   (a Malay-group extra in the kampung, every pilgrim in Makkah and Madinah); everybody else
 *   gets a plain "Hello!". Child-friendly: nobody ever ignores, scolds or refuses the hero; a
 *   reply is always warm. The reward is capped so hellos stay friendly, not a coin farm.
 * DEPENDENCIES: none (no THREE, no DOM). Randomness is injected.
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/hi.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const SALAAM = "Assalamualaikum!";
  const REPLY = "Waalaikumsalam!";
  /** What the hero says first, by whether the other person is Muslim. */
  const HERO_SALAAM = SALAAM;
  const HERO_HELLO = "Hello!";

  /** How a person answers, by kind. `{m}` lines are for Muslim people, `{o}` for everyone else. */
  const ANSWERS = {
    kid: {
      m: [REPLY + " Wanna play?", REPLY + " Nice cap!", REPLY + " Hi, friend!"],
      o: ["Hi! Nice cap!", "Hi! Wanna play?", "Hello! Want to see my ball?"],
    },
    teen: {
      m: [REPLY + " Good to see you!", REPLY + " Nice day, right?"],
      o: ["Hey! Nice day, right?", "Hi there! Good to see you."],
    },
    adult: {
      m: [REPLY + " Hati-hati, ya.", REPLY + " Have a good day!"],
      o: ["Hello! Have a good day!", "Hi, young one! Nice day, hor?"],
    },
    elder: {
      m: [REPLY + " Good child. Mind how you go.", REPLY + " Terima kasih, nak!"],
      o: ["Hello, hello! Such a polite child.", "Aiyo, so friendly! Hello!"],
    },
  };

  /** What a kid who spots the hero first calls out (Muslim kids start with the salaam). */
  const KID_FIRST = {
    m: [SALAAM, SALAAM, SALAAM],
    o: ["Hi! Nice cap!", "Hello! Wanna play?", "Hi hi hi!"],
  };

  /** The age band a person falls in; anything unknown counts as an adult. */
  function bandOf(person) {
    if (person && (person.kid || person.age === "kid")) return "kid";
    const age = person && person.age;
    return age === "teen" || age === "elder" ? age : "adult";
  }

  /** Pick one entry from a list by a roll in [0, 1). */
  function pick(list, rand) {
    return list[Math.floor(rand() * list.length) % list.length];
  }

  /**
   * The exchange when the hero says hi to `person`.
   * @param {{kid?:boolean, age?:string, muslim?:boolean}} person
   * @param {() => number} rand a random source in [0, 1)
   * @returns {{hero:string, reply:string, band:string}}
   */
  function say(person, rand) {
    const muslim = Boolean(person && person.muslim);
    const band = bandOf(person);
    return {
      hero: muslim ? HERO_SALAAM : HERO_HELLO,
      reply: pick(ANSWERS[band][muslim ? "m" : "o"], rand),
      band,
    };
  }

  /**
   * What a kid says when they greet the hero first, and the hero's reply bubble.
   * @returns {{kid:string, hero:string}}
   */
  function kidFirst(person, rand) {
    const muslim = Boolean(person && person.muslim);
    const line = pick(KID_FIRST[muslim ? "m" : "o"], rand);
    return { kid: line, hero: line === SALAAM ? REPLY : "Hi!" };
  }

  /** Reward rules: a coin every EVERY hellos (at most MAX_COINS times), a sticker at STICKER_AT. */
  const TALLY = { every: 5, maxCoins: 6, stickerAt: 10, stickerId: "sticker_friendly" };

  /**
   * A tally of hellos. `note()` counts one and says what it earns: `{count, coins, sticker}`
   * (coins 0 and sticker null most of the time).
   */
  function createTally(config) {
    const cfg = Object.assign({}, TALLY, config || {});
    let count = 0;
    let paid = 0;
    return {
      note() {
        count += 1;
        let coins = 0;
        if (count % cfg.every === 0 && paid < cfg.maxCoins) {
          paid += 1;
          coins = 1;
        }
        return { count, coins, sticker: count === cfg.stickerAt ? cfg.stickerId : null };
      },
      count: () => count,
      paid: () => paid,
      reset() {
        count = 0;
        paid = 0;
      },
    };
  }

  KQ.Sim.Hi = { say, kidFirst, createTally, bandOf, TALLY, SALAAM, REPLY };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
