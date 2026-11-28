/* ============================================================================
 * FILE: say-hi.js
 * PURPOSE: "Say hi" to the people of the town. A crowd extra within reach (kids especially)
 *          becomes greet-able: the Talk button offers "Say hi", the hero's hello and the person's
 *          reply show as speech bubbles, the person turns and waves, and a tiny tally pays a
 *          capped "Friendly" reward. Kids nearby also sometimes call out first.
 * BUSINESS CONTEXT: playability round AC-P17 ("like the Haramain greeting"). Extras are still NOT
 *   talkable (no dialogue page): a hello is a bubble pair, nothing more. Words and the reward
 *   rule are pure, in js/sim/hi.js; the salaam is only between Muslim people (a Malay-group
 *   extra in the kampung, every pilgrim in Makkah and Madinah), others get "Hello!".
 * DEPENDENCIES: crowd.js (members), greetings.js (bubbles), mission-flow.js (greet steps), player.js,
 *   KQ.Sim.Hi. No new meshes: the wave is the crowd kit's own "wave" pose (a baked bank entry).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  /** How close a person must be to be offered "Say hi", and how close a kid must be to call out first. */
  const REACH = 2.5;
  const KID_CALL = 6;
  /** Seconds before the same person is offered again, and the least gap between any two hellos. */
  const PERSON_COOLDOWN = 25;
  const GLOBAL_GAP = 1.6;
  /** A kid who calls out first: how often we look, how likely, and the quiet time after one. */
  const LOOK_EVERY = 0.5;
  const KID_CHANCE = 0.1;
  const KID_QUIET = 18;
  const WAVE_SECONDS = 3;
  /** Holy-region activity kinds that may be greeted (the rest are praying, circling or reading). */
  const HOLY_OK = { chat: true };
  const H = {
    tally: null,
    rng: null,
    now: 0,
    lastAt: -1e9,
    kidAt: -1e9,
    seen: {},
    lookT: 0,
    kidChance: null,
    total: 0,
    last: null,
  };

  /** Create the tally and random source on first use (the game state exists by then). */
  function ensure() {
    if (H.tally) return;
    H.tally = KQ.Sim.Hi.createTally();
    H.rng = U.rng(U.hash("kq-say-hi"));
  }

  /** Is this extra a Muslim person (every pilgrim; a Malay-group extra in the kampung)? */
  function muslimOf(m) {
    return KQ.region === "haramain" || Boolean(m.outfit && m.outfit.group === "malay");
  }

  /** May this extra be greeted now: out and about, on their feet and not at their prayers? */
  function greetable(m) {
    if (m.leaving || m.show < 0.8 || (m.slot && m.slot.sit)) return false;
    if (m.mode === "holy") return Boolean(HOLY_OK[m.kind]);
    return Boolean(m.walker) || m.mode === "rest" || m.mode === "roam" || m.mode === "pace";
  }

  /** Is the hero too busy to be greeted or to greet (a menu, a prayer, a rite, a pause, a ride)? */
  function busy() {
    const s = S();
    if (!s || s.paused || G.UI.modalOpen() || G.PrayerFlow.screenOpen()) return true;
    return G.Vehicles.mounted() || Boolean(G.RitualFlow.debug().rite);
  }

  /** The nearest greet-able extra within `r` metres of the hero that has not been greeted lately. */
  function nearestPerson(hero, r, kidsOnly) {
    let best = null;
    S().crowd.members.forEach(function (m) {
      if (!greetable(m) || (kidsOnly && !m.kid) || (H.seen[m.id] || -1e9) > H.now) return;
      const d = U.dist(m.x, m.z, hero.x, hero.z);
      if (d <= r && (!best || d < best.d)) best = { m, d };
    });
    return best;
  }

  /**
   * The "Say hi" prompt for the nearest extra in reach, as an Interact target, or null. Quiet
   * while the hero is busy or a greeting has only just happened.
   */
  function target(hero) {
    ensure();
    if (!S().crowd || busy() || H.now - H.lastAt < GLOBAL_GAP) return null;
    const hit = nearestPerson(hero, REACH, false);
    if (!hit) return null;
    const m = hit.m;
    return {
      kind: "hi",
      id: m.id,
      label: "Say hi",
      aria: m.kid ? "Say hi to the child" : "Say hi to this person",
      x: m.x,
      z: m.z,
      dist: hit.d,
      enabled: true,
      h: m.kid ? 1.35 : 1.8,
      member: m,
    };
  }

  /** Make an extra stop, face the hero and wave for a few seconds (the crowd calls hold() while it lasts). */
  function startWave(m, seconds) {
    if (!(m.waveT > 0)) m.waveWas = { pose: m.pose, rate: m.rate };
    m.waveT = seconds;
  }

  /**
   * One step of an extra who is waving: stands still, turns to the hero, keeps their phase and
   * fade running, then gets their old pose back. Called by crowd.js instead of the usual step.
   */
  function hold(C, m, dt) {
    const hero = C.others[0];
    m.waveT -= dt;
    m.t += dt;
    m.pose = "wave";
    m.rate = 0.9;
    if (hero) m.heading = U.dampAngle(m.heading, Math.atan2(hero.x - m.x, hero.z - m.z), 8, dt);
    m.phase = (m.phase + dt * m.rate) % 1;
    m.show = U.damp(m.show, m.leaving ? 0 : 1, 6, dt);
    m.y = C.world.heightAt(m.x, m.z);
    if (m.waveT <= 0 && m.waveWas) {
      m.pose = m.waveWas.pose;
      m.rate = m.waveWas.rate;
      m.waveWas = null;
      m.poseBucket = -1; // a person at a fixed spot picks a fresh pose at once
    }
  }

  /** Pay out what the tally says (a coin, a sticker) with a small toast; also tells the missions. */
  function reward(person, id) {
    const r = H.tally.note();
    const sim = S().sim;
    G.MissionFlow.notify({ type: "greet", target: "people", who: id }); // each person counts once per mission step
    if (person && person.kid) G.MissionFlow.notify({ type: "greet", target: "kids", who: id });
    if (r.coins > 0) {
      sim.economy.add(r.coins);
      G.Audio.play("coin");
      G.UI.toast("So friendly! +" + r.coins + " coin", "gold", 2600);
      S().hudDirty = true;
    }
    if (r.sticker && sim.missions.grantSticker(r.sticker)) {
      G.UI.toast("New sticker: Friendly!", "gold", 4200);
    }
    H.total = r.count;
    return r;
  }

  /** The hero turns to a point and raises a hand for a moment. */
  function heroWave(at) {
    const P = S().player;
    if (P.locked) return; // a prayer, a rite or a ride already holds the hero: no wave on top of it
    P.heading = Math.atan2(at.x - P.pos.x, at.z - P.pos.z);
    G.Player.sync(P);
    const ticket = G.Player.lock(P, null, "wave");
    S().after(1.3, () => G.Player.release(P, ticket));
  }

  /** Say hi to an extra: the hero's hello, their reply a moment later, a wave, the tally. */
  function sayHi(m) {
    ensure();
    const who = { kid: m.kid, age: m.outfit && m.outfit.age, muslim: muslimOf(m) };
    const words = KQ.Sim.Hi.say(who, H.rng);
    G.Greetings.say("hero", words.hero, 0, 2.4);
    G.Greetings.say(m.id, words.reply, 1, 3);
    startWave(m, WAVE_SECONDS);
    heroWave(m);
    H.seen[m.id] = H.now + PERSON_COOLDOWN;
    H.lastAt = H.now;
    H.last = { id: m.id, hero: words.hero, reply: words.reply, band: words.band };
    reward(who, m.id);
    return true;
  }

  /** A kid calls out first ("Hi! Nice cap!") and the hero's reply shows over the hero. */
  function kidCalls(m) {
    const who = { kid: true, muslim: muslimOf(m) };
    const words = KQ.Sim.Hi.kidFirst(who, H.rng);
    G.Greetings.say(m.id, words.kid, 0, 2.6);
    G.Greetings.say("hero", words.hero, 1, 2.4);
    startWave(m, 2.6);
    H.seen[m.id] = H.now + PERSON_COOLDOWN;
    H.lastAt = H.kidAt = H.now;
    H.last = { id: m.id, kid: words.kid, hero: words.hero, first: true };
    reward(who, m.id);
  }

  /** A hello with a cast neighbour (small talk) also counts for the tally and the "say hi" missions. */
  function noteTalk(id) {
    ensure();
    H.lastAt = H.now;
    reward({ kid: false }, id);
  }

  /** Look for a kid close by who may call out first (only now and then, and never in a hurry). */
  function lookForKid(hero) {
    if (H.now - H.kidAt < KID_QUIET || H.now - H.lastAt < GLOBAL_GAP * 3) return;
    const p = H.kidChance === null ? KID_CHANCE : H.kidChance;
    if (H.rng() >= p) return;
    const hit = nearestPerson(hero, KID_CALL, true);
    if (hit) kidCalls(hit.m);
  }

  /** Per-step update: time, and every LOOK_EVERY seconds a chance that a kid calls out. */
  function update(dt, hero) {
    ensure();
    H.now += dt;
    H.lookT += dt;
    if (H.lookT < LOOK_EVERY) return;
    H.lookT = 0;
    if (S().crowd && !busy()) lookForKid(hero);
  }

  /** Force the chance that a kid calls out per look (tests), or null for the normal chance. */
  function setKidChance(p) {
    const reset = p === null || p === undefined;
    if (!reset && !Number.isFinite(Number(p))) return false;
    H.kidChance = reset ? null : Number(p);
    return true;
  }

  /** The tally and the last hello, for tests. */
  function debug() {
    ensure();
    return {
      count: H.tally.count(),
      paid: H.tally.paid(),
      last: H.last,
      waving: S() && S().crowd ? S().crowd.members.filter((m) => m.waveT > 0).length : 0,
    };
  }

  G.Hi = { target, sayHi, noteTalk, update, hold, setKidChance, debug, REACH };
})((window.KQ = window.KQ || {}));
