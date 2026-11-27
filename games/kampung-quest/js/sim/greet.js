/* ============================================================================
 * FILE: greet.js
 * PURPOSE: Decides when two walking citizens (or a citizen and the hero) greet each other as they
 *          pass: "Assalamualaikum!" and the reply "Waalaikumsalam!". Pure logic: the game layer
 *          passes in who is where and shows the bubbles; this keeps the pairing, the chance, the
 *          cooldowns and the caps so the screen is never spammed.
 * BUSINESS CONTEXT: Owner request "citizens say salaam when their paths cross". Religious accuracy:
 *   the salaam exchange happens only between Muslim citizens (cast `muslim`, crowd group "malay");
 *   everyone else exchanges a plain "Hello!" / "Hi!", so nobody is made to say a Muslim greeting
 *   that is not theirs. Child-friendly: no one is ever ignored with a scolding or a penalty; a
 *   greeting is just a small friendly caption.
 * RULES: both people must be walking (a citizen the hero walks past may also be standing), within
 *   PASS_DIST metres, not walking along together (friends in a pair share a `group`, and people
 *   heading the same way are not "crossing"), within NEAR_HERO of the hero, each with a cooldown,
 *   one global gap between greetings and at most MAX_ACTIVE greetings on screen at once.
 * DEPENDENCIES: none (no THREE, no DOM). Time is passed in (seconds); randomness is injected.
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/greet.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const SALAAM = "Assalamualaikum!";
  const REPLY = "Waalaikumsalam!";
  const HELLO = "Hello!";
  const HI = "Hi!";
  /** The id the hero goes by in a greeting (the reply bubble sits above them). */
  const HERO = "hero";

  const CONFIG = {
    /** Only people this close to the hero greet (the rest of the town is off screen). */
    nearHero: 25,
    /** Two walkers pass this close and one may say salaam. */
    passDist: 2.5,
    /** A citizen this close to the hero may greet the hero. */
    heroDist: 3,
    /** Chance that a pass becomes a greeting (rolled once per pass). */
    pairChance: 0.5,
    heroChance: 0.75,
    /** Seconds before the same pair / the same citizen-and-hero may greet again (after a greeting / a quiet pass). */
    pairCooldown: 60,
    pairMissCooldown: 20,
    heroCooldown: 75,
    heroMissCooldown: 20,
    /** Seconds a person is "busy" after greeting or being greeted. */
    personCooldown: 12,
    /** Minimum seconds between any two new greetings anywhere, and the most that may show at once. */
    globalGap: 3,
    maxActive: 3,
    /** How long the first bubble shows, when the reply comes, and how long the reply shows. */
    bubbleSeconds: 2.6,
    replyDelay: 1,
    /** Headings whose cosine is above this are "walking the same way", not crossing. */
    crossCos: 0.35,
  };

  /** Squared distance between two things with x and z. */
  function d2(a, b) {
    return (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z);
  }

  /** A stable key for an unordered pair of ids. */
  function pairKey(a, b) {
    return a < b ? a + "|" + b : b + "|" + a;
  }

  /** The two lines of an exchange: salaam and its reply when `muslim`, else a plain hello. */
  function words(muslim) {
    return muslim ? [SALAAM, REPLY] : [HELLO, HI];
  }

  /** Does a roll against `chance` succeed? (A forced chance overrides, for tests.) */
  function hit(K, chance) {
    return K.roll() < (K.S.force === null ? chance : K.S.force);
  }

  /** May another greeting start now (not too soon after the last, not too many on screen)? */
  function slotOpen(K, now) {
    return K.S.live.length < K.cfg.maxActive && now - K.S.lastAt >= K.cfg.globalGap;
  }

  /** Is this person free to greet (no recent greeting)? */
  function free(K, p, now) {
    return (K.S.personAt[p.id] || -1e9) <= now;
  }

  /** Forget finished greetings and old cooldown entries so the maps stay small. */
  function prune(K, now) {
    const S = K.S;
    S.live = S.live.filter((g) => g.until > now);
    [S.pairAt, S.personAt, S.heroAt].forEach(function (map) {
      const keys = Object.keys(map);
      if (keys.length > 64) keys.forEach((k) => map[k] <= now && delete map[k]);
    });
  }

  /** Make and remember one greeting from `from` to `to` (an id), saying `lines`. */
  function record(K, now, kind, from, to, lines) {
    const S = K.S;
    S.serial += 1;
    const g = {
      id: S.serial,
      kind,
      from,
      to,
      text: lines[0],
      replyText: lines[1],
      at: now,
      replyAt: now + K.cfg.replyDelay,
      until: now + K.cfg.replyDelay + K.cfg.bubbleSeconds,
    };
    S.live.push(g);
    S.lastAt = now;
    S.personAt[from] = now + K.cfg.personCooldown;
    if (to !== HERO) S.personAt[to] = now + K.cfg.personCooldown;
    return g;
  }

  /** Is this citizen close to the hero, with someone moving, and free to greet them? */
  function heroEligible(K, now, p, hero) {
    const c = K.cfg;
    const close = d2(p, hero) <= c.heroDist * c.heroDist;
    const moving = hero.moving || p.state === "walk";
    return close && moving && free(K, p, now) && (K.S.heroAt[p.id] || -1e9) <= now;
  }

  /** The first citizen close enough to greet the hero (rolled once), or null. */
  function greetHero(K, now, near, hero) {
    for (let i = 0; i < near.length; i += 1) {
      const p = near[i];
      if (!heroEligible(K, now, p, hero)) continue;
      if (!slotOpen(K, now)) return null;
      const yes = hit(K, K.cfg.heroChance);
      K.S.heroAt[p.id] = now + (yes ? K.cfg.heroCooldown : K.cfg.heroMissCooldown);
      if (yes) return record(K, now, "hero", p.id, HERO, words(p.muslim));
    }
    return null;
  }

  /** Are these two walkers crossing paths (not friends, not walking along together)? */
  function crossing(K, a, b) {
    if (a.state !== "walk" || b.state !== "walk") return false;
    if (a.group && a.group === b.group) return false;
    return Math.cos(a.heading - b.heading) <= K.cfg.crossCos;
  }

  /** Roll once for a close, crossing pair; the greeting (or null) when one started. */
  function tryPair(K, now, a, b) {
    const key = pairKey(a.id, b.id);
    if ((K.S.pairAt[key] || -1e9) > now || !free(K, a, now) || !free(K, b, now)) return null;
    if (!slotOpen(K, now)) return null;
    const yes = hit(K, K.cfg.pairChance);
    K.S.pairAt[key] = now + (yes ? K.cfg.pairCooldown : K.cfg.pairMissCooldown);
    if (!yes) return null;
    const first = K.roll() < 0.5 ? a : b;
    const other = first === a ? b : a;
    return record(K, now, "pair", first.id, other.id, words(a.muslim && b.muslim));
  }

  /** The first greeting among walkers who pass within PASS_DIST (at most one per call), or null. */
  function greetPairs(K, now, near) {
    const r2 = K.cfg.passDist * K.cfg.passDist;
    for (let i = 0; i < near.length; i += 1) {
      for (let j = i + 1; j < near.length; j += 1) {
        if (d2(near[i], near[j]) > r2 || !crossing(K, near[i], near[j])) continue;
        const g = tryPair(K, now, near[i], near[j]);
        if (g) return g;
      }
    }
    return null;
  }

  /**
   * Look at everyone near the hero and start at most one new greeting.
   * @returns {object[]} the greetings that started: {id, kind, from, to, text, replyText, at, replyAt, until}
   */
  function step(K, now, people, hero) {
    prune(K, now);
    const lim = K.cfg.nearHero * K.cfg.nearHero;
    const near = people.filter((p) => d2(p, hero) <= lim);
    const g = greetHero(K, now, near, hero) || greetPairs(K, now, near);
    return g ? [g] : [];
  }

  /** The empty bookkeeping: nothing said, no cooldowns. */
  function freshState(force) {
    return { serial: 0, lastAt: -1e9, live: [], pairAt: {}, personAt: {}, heroAt: {}, force };
  }

  /**
   * Make a greeter.
   * @param {() => number} rand a random source in [0, 1) (inject a seeded one for repeatable play)
   * @param {object} [config] overrides for CONFIG (tests)
   */
  function create(rand, config) {
    const K = {
      cfg: Object.assign({}, CONFIG, config || {}),
      roll: rand || Math.random,
      S: freshState(null),
    };
    return {
      /**
       * Start at most one new greeting among the people near the hero.
       * @param {number} now seconds (any steady clock)
       * @param {{id:string,x:number,z:number,heading:number,state:string,muslim:boolean,group?:string}[]} people
       *   each citizen that may greet: state "walk" or "stand" (callers leave out seated, praying,
       *   talking and hidden ones)
       * @param {{x:number,z:number,moving:boolean}} hero
       */
      update: (now, people, hero) => step(K, now, people, hero),
      /** Greetings whose bubbles are still showing at `now`. */
      active: (now) => K.S.live.filter((g) => g.until > now),
      /** How many greetings have started in total. */
      count: () => K.S.serial,
      /** Force the chance of every roll (0..1), or null to go back to the normal chances (tests). */
      setChance(p) {
        K.S.force = p === null || p === undefined ? null : Number(p);
      },
      /** Forget every cooldown and greeting (a teleport or a time jump). */
      reset() {
        K.S = freshState(K.S.force);
      },
      debug: () => ({ total: K.S.serial, live: K.S.live.length, force: K.S.force }),
    };
  }

  KQ.Sim.Greet = { create, CONFIG, SALAAM, REPLY, HELLO, HI, HERO };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
