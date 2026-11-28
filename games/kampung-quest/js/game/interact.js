/* ============================================================================
 * FILE: interact.js
 * PURPOSE: Works out what the hero can do right now (every neighbour, counter, animal, vehicle,
 *          person to say hi to, event prompt or pick-up within reach), arranges those actions for
 *          the chooser (KQ.Sim.Actions: nearest first, up to three) and runs the one the child
 *          picks. The Action control and the world pointer are drawn by action-bar.js.
 * BUSINESS CONTEXT: AC-12 (a context prompt within 2 m of an interactable), AC-15 (the same
 *   action by key E; numbers 1-3 pick another), AC-P24 (one fixed Action button; with two or more
 *   actions in reach the child sees them all instead of a silent winner), AC-P25 (Rest in one tap,
 *   Pray is one path).
 * DEPENDENCIES: npc-manager.js, mission-flow.js, services.js, prayer-flow.js, collectibles.js,
 *   action-words.js, KQ.Sim.Actions.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  const OBJ_RANGE = 2.4;
  const NPC_RANGE = 2.3;
  const FAR_RANGE = 4.5;
  const RANK = () => KQ.Sim.Actions.RANK;
  const LABELS = {
    counter_: ["Eat", "Order food"],
    wudu_tap_: ["Pray", "Pray"],
    prayer_spot: ["Pray", "Pray"],
    minimart_till: ["Buy", "Pay at the till"],
    barber_chair: ["Haircut", "Sit for a haircut"],
    wardrobe_stall: ["Clothes", "Change clothes"],
    clinic_desk: ["Check-up", "Clinic check-up"],
    library_desk: ["Story", "Borrow a story"],
    home_door: ["Rest", "Go home and rest"],
    recycling_bins: ["Recycle", "Recycle"],
    playground: ["Play", "Play"],
    bus_stop_bench: ["Sit", "Sit and wait"],
  };

  /**
   * The [button label, spoken label] pair for an interactable, found by its id prefix ('Use' by
   * default).
   */
  function labelFor(id) {
    const key = Object.keys(LABELS).find((k) => id.indexOf(k) === 0);
    return key ? LABELS[key] : ["Use", "Use"];
  }

  /** The prayer hall plus its verandah (the whole inside of the mosque), from the town plan; null if unknown. */
  function mosqueZone() {
    const L = KQ.WorldParts && KQ.WorldParts.LAYOUT && KQ.WorldParts.LAYOUT.mosque;
    return L ? { x0: L.hall.x0, x1: L.verandah.x1, z0: L.hall.z0, z1: L.hall.z1 } : null;
  }

  /**
   * A "Pray" prompt for a hero anywhere inside the mosque hall, so praying is always one press
   * away there (a due or owed prayer, else the voluntary extra prayer). It is a `fallback`: it only
   * shows when no real object is in reach.
   */
  function mosqueTarget(hero) {
    const zone = mosqueZone();
    if (!zone || hero.x < zone.x0 || hero.x > zone.x1 || hero.z < zone.z0 || hero.z > zone.z1)
      return null;
    const spot = S().world.pois.mosque_hall.pos;
    return {
      kind: "obj",
      id: "prayer_spot",
      label: "Pray",
      aria: "Pray",
      x: hero.x,
      z: hero.z,
      dist: U.dist(hero.x, hero.z, spot.x, spot.z),
      enabled: true,
      h: 2.1,
      fallback: true,
    };
  }

  /** Can the hero rest now: energy is not full and no fard prayer is due, in progress or being called? */
  function restOk() {
    return S().sim.needs.canRest() && !G.PrayerFlow.restBlocked();
  }

  /** The "Rest" prompt for a hero who is Tired, wherever they stand (it comes last in the chooser). */
  function tiredTarget(hero) {
    if (!S().sim.needs.isTired() || !restOk()) return null;
    return {
      kind: "rest",
      id: "rest_here",
      label: "Rest",
      aria: "Rest and get your energy back",
      x: hero.x,
      z: hero.z,
      dist: 0,
      enabled: true,
      h: 2,
      rank: RANK().tired,
    };
  }

  /** "Pray here": while the footprints lead to the mosque, a child far from it may pray where they stand. */
  function prayHereTarget(hero) {
    const pf = G.PrayerFlow;
    if (!pf.state.guide || pf.inCompound() || pf.screenOpen()) return null;
    return {
      kind: "obj",
      id: "pray_here",
      label: "Pray here",
      aria: "Pray right here",
      x: hero.x,
      z: hero.z,
      dist: 1,
      enabled: true,
      h: 2,
      rank: RANK().prayer,
    };
  }

  /** One interactable as an action target; the home door and benches only offer Rest when it makes sense. */
  function objectOf(it, d) {
    const l = labelFor(it.id);
    const rest = it.id === "bus_stop_bench" && restOk();
    if (it.id === "home_door" && !restOk()) return null;
    return {
      kind: "obj",
      id: it.id,
      label: rest ? "Rest" : l[0],
      aria: rest ? "Sit and rest" : l[1],
      x: it.pos.x,
      z: it.pos.z,
      dist: d,
      enabled: true,
      h: 1.3,
    };
  }

  /** The nearest interactable within reach (ignoring the other hero's prayer spot) as a target, or null. */
  function nearestObject(hero) {
    let best = null;
    const other = G.Hero.isGirl() ? "prayer_spot" : "prayer_spot_women"; // each hero has one row
    S().world.interactables.forEach(function (it) {
      if (it.id === other) return;
      const d = U.dist(hero.x, hero.z, it.pos.x, it.pos.z);
      const t = d <= OBJ_RANGE && (!best || d < best.dist) ? objectOf(it, d) : null;
      if (t) best = t;
    });
    return best;
  }

  /** The nearest pick-up (can, litter) within reach as a target, or null. */
  function nearestItem(hero) {
    let best = null;
    G.Collectibles.available(S().collect).forEach(function (c) {
      const d = U.dist(hero.x, hero.z, c.x, c.z);
      if (d > OBJ_RANGE || (best && d >= best.dist)) return;
      best = {
        kind: "item",
        id: c.id,
        label: "Pick up",
        aria: "Pick up",
        x: c.x,
        z: c.z,
        dist: d,
        enabled: true,
        h: 0.7,
        item: c,
      };
    });
    return best;
  }

  /** The button word for a quick mission step with this neighbour ("Push"), or null. */
  function quickVerb(A) {
    const p = S().sim.missions.progress();
    return p && p.quick && !p.paused && p.target === A.id && p.verb ? p.verb : null;
  }

  /** The nearest visible neighbour (not busy, not praying) within FAR_RANGE with how far, or null. */
  function nearestNpc(hero) {
    const hit = G.Npcs.nearest(S().npcs, hero.x, hero.z, FAR_RANGE);
    if (!hit || hit.A.talking || (hit.A.goal && hit.A.goal.kind === "pray")) return null;
    return hit;
  }

  /** A neighbour as a target: "Talk" when close; one further off is only pointed at (no button). */
  function npcOf(hit) {
    const near = hit.d <= NPC_RANGE;
    return {
      kind: "npc",
      id: hit.A.id,
      label: (near && quickVerb(hit.A)) || "Talk",
      aria: "Talk to " + hit.A.name,
      x: hit.A.x,
      z: hit.A.z,
      dist: hit.d,
      enabled: near,
      h: 1.5,
      agent: hit.A,
    };
  }

  /** Talks the hero has already had (npc id -> mission key), so the counter can win afterwards. */
  const talked = {};
  /** The neighbour a few steps away that the world arrow points at (no button), or null. */
  let farOne = null;

  /** A key for "what this NPC could talk about right now" (offer, or the current step). */
  function businessKey() {
    const prog = S().sim.missions.progress();
    return prog ? prog.id + ":" + prog.stepIndex : "offer";
  }

  /**
   * Does this neighbour have mission business the hero has not just heard? A hawker stands
   * ~0.15 m behind the counter, so without this the counter would always win. Once the hero has
   * talked (declined an offer, say) the counter wins again until they walk away.
   */
  function wantsNpc(npc) {
    return Boolean(npc) && S().sim.missions.wantsTalk(npc.id) && talked[npc.id] !== businessKey();
  }

  /** Forget talks with neighbours the hero has walked away from. */
  function forgetFar(hero) {
    Object.keys(talked).forEach(function (id) {
      const A = S().npcs.byId[id];
      if (!A || U.dist(hero.x, hero.z, A.x, A.z) > FAR_RANGE) delete talked[id];
    });
  }

  /** The neighbour candidate (ranked as mission business when it is); a far one is only remembered for the arrow. */
  function neighbour(hero) {
    farOne = null;
    const hit = nearestNpc(hero);
    if (!hit) return null;
    const t = npcOf(hit);
    if (!t.enabled) return void (farOne = t);
    t.rank = wantsNpc(t) ? RANK().business : RANK().near;
    return t;
  }

  /** Make an owed prayer's prompt rank above ordinary things (nothing owed: the extra prayer is ordinary). */
  function rankPrayer(t) {
    const pray = t && (t.id.indexOf("prayer_spot") === 0 || t.id.indexOf("wudu_tap_") === 0);
    if (pray && !G.PrayerFlow.isVoluntary()) t.rank = RANK().prayer;
    return t;
  }

  /** Every place-bound candidate: object (else the mosque fallback), pick-up, vehicle, animal and its hello. */
  function placeTargets(hero) {
    const obj = nearestObject(hero) || mosqueTarget(hero);
    return [
      rankPrayer(obj),
      nearestItem(hero),
      G.Vehicles.target(hero),
      G.Mounts.target(hero),
      G.Mounts.hiTarget(hero),
    ];
  }

  /** Every candidate in reach, before they are ordered. */
  function candidates(hero) {
    return placeTargets(hero).concat([
      neighbour(hero),
      G.MissionSteps.stepTarget(hero), // a mission's "Photo"
      G.WorldEvents.target(hero), // an event's prompt (the ice-cream cart)
      G.Hi.target(hero), // a person to say hi to
      tiredTarget(hero),
      prayHereTarget(hero),
    ]);
  }

  /**
   * The actions in reach, arranged for the chooser: the first is the big Action button (E), the next
   * ones are tiles 2 and 3. Empty when a sheet is open, the game is paused or the hero is held.
   */
  function find() {
    const P = S().player;
    farOne = null;
    if (P.locked || G.UI.modalOpen() || S().paused) return [];
    const hero = P.pos;
    if (G.Vehicles.mounted()) return [G.Vehicles.target(hero)].filter(Boolean); // in a vehicle the only prompt is Get off
    if (G.Mounts.riding()) return [G.Mounts.target(hero)].filter(Boolean); // on an animal, likewise
    forgetFar(hero);
    const list = candidates(hero).filter(Boolean);
    list.forEach((t) => (t.key = G.ActionWords.keyOf(t) || undefined));
    return KQ.Sim.Actions.arrange(list);
  }

  /** The neighbour a few steps away that the world arrow points at (there is no button for it), or null. */
  const far = () => farOne;

  /**
   * Run the action for a target (talk, pick up, a service ...) if it is enabled; returns whether
   * anything ran.
   */
  function activate(t) {
    if (!t || !t.enabled) return false;
    if (t.kind === "npc") talkTo(t);
    else if (t.kind === "hi") G.Hi.sayHi(t.member);
    else if (t.kind === "event") G.WorldEvents.press(t);
    else if (t.kind === "step") G.MissionFlow.pressStep(t);
    else if (t.kind === "item") G.MissionFlow.pickup(t.item);
    else if (t.kind === "rest") G.Services.restHere();
    else dispatchObject(t.id);
    return true;
  }

  /**
   * Talk to an NPC target and remember which mission business was already handled, so the counter
   * wins afterwards.
   */
  function talkTo(t) {
    if (wantsNpc(t)) talked[t.id] = businessKey();
    G.MissionFlow.talk(t.agent);
  }

  /**
   * Open what an interactable id stands for (stall, taps, prayer hall, mini-mart, barber, clinic,
   * library, home, ...). Every prayer door (taps, hall) runs the same next step.
   */
  function dispatchObject(id) {
    const V = G.Services;
    if (id.indexOf("vehicle:") === 0) return G.Vehicles.press(id);
    if (id.indexOf("mount:") === 0) return G.Mounts.press(id);
    if (id.indexOf("counter_") === 0) return V.stall(id);
    if (id.indexOf("wudu_tap_") === 0 || id.indexOf("prayer_spot") === 0)
      return G.PrayerFlow.next();
    const table = {
      pray_here: G.PrayerFlow.startHere,
      minimart_till: V.minimart,
      barber_chair: V.barber,
      wardrobe_stall: G.Wardrobe.open,
      clinic_desk: V.clinic,
      library_desk: V.library,
      home_door: V.restHere,
      recycling_bins: V.recycle,
      playground: V.play,
      bus_stop_bench: V.bench,
    };
    if (table[id]) table[id]();
  }

  G.Interact = { find, far, activate };
})((window.KQ = window.KQ || {}));
