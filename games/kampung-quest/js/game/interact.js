/* ============================================================================
 * FILE: interact.js
 * PURPOSE: Works out what the hero can do right now (the nearest NPC or interactable within about
 *          2 m), shows the floating Talk / action button above it, and runs the action.
 * BUSINESS CONTEXT: AC-12 (a context prompt within 2 m of an interactable), design D (a big
 *   "Talk" button over the NPC's head; "Walk closer" when it is further away), AC-15 (the same
 *   action by key E, and the button is the first thing in the keyboard focus order).
 * DEPENDENCIES: npc-manager.js, mission-flow.js, services.js, prayer-flow.js, collectibles.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  const OBJ_RANGE = 2.4;
  const NPC_RANGE = 2.3;
  const FAR_RANGE = 4.5;
  const SUNAT_ARIA = "Sunat prayer (2 raka'at)";
  const LABELS = {
    counter_: ["Order", "Order food"],
    wudu_tap_: ["Wudu", "Take wudu"],
    prayer_spot: ["Pray", "Pray"],
    minimart_till: ["Pay", "Pay at the till"],
    barber_chair: ["Haircut", "Sit for a haircut"],
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
   * away there (a due or owed prayer, else the voluntary sunat prayer). It is a `fallback`: a
   * neighbour within reach and any real object nearby outrank it (KQ.Sim.Missions.pickTarget).
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

  /** When no fard prayer is owed, the Pray prompt offers the voluntary prayer and says so plainly. */
  function withPrayerLabel(target) {
    if (target && target.id === "prayer_spot" && G.PrayerFlow.isVoluntary()) {
      target.label = "Sunat prayer";
      target.aria = SUNAT_ARIA;
    }
    return target;
  }

  /**
   * The nearest interactable within reach as a Talk-button target, ignoring the women's prayer
   * spot; inside the mosque hall the Pray prompt is the fallback.
   */
  function objectTarget(hero) {
    return withPrayerLabel(nearestObject(hero) || mosqueTarget(hero));
  }

  /** The nearest interactable or pick-up within reach, or null. */
  function nearestObject(hero) {
    let best = null;
    S().world.interactables.forEach(function (it) {
      if (it.id === "prayer_spot_women") return;
      const d = U.dist(hero.x, hero.z, it.pos.x, it.pos.z);
      if (d <= OBJ_RANGE && (!best || d < best.dist)) {
        const l = labelFor(it.id);
        best = {
          kind: "obj",
          id: it.id,
          label: l[0],
          aria: l[1],
          x: it.pos.x,
          z: it.pos.z,
          dist: d,
          enabled: true,
          h: 1.3,
        };
      }
    });
    G.Collectibles.available(S().collect).forEach(function (c) {
      const d = U.dist(hero.x, hero.z, c.x, c.z);
      if (d <= OBJ_RANGE && (!best || d < best.dist)) {
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
      }
    });
    return best;
  }

  /**
   * The nearest visible NPC as a target: 'Talk' when close, 'Walk closer' when further; none if
   * busy or praying.
   */
  function npcTarget(hero) {
    const hit = G.Npcs.nearest(S().npcs, hero.x, hero.z, FAR_RANGE);
    if (!hit || hit.A.talking || (hit.A.goal && hit.A.goal.kind === "pray")) return null;
    const near = hit.d <= NPC_RANGE;
    return {
      kind: "npc",
      id: hit.A.id,
      label: near ? "Talk" : "Walk closer",
      aria: (near ? "Talk to " : "Walk closer to ") + hit.A.name,
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

  /** The current best target or null. Disabled "Walk closer" targets are returned for NPCs only. */
  function find() {
    const P = S().player;
    if (P.locked || G.UI.modalOpen() || S().paused) return null;
    const hero = P.pos;
    forgetFar(hero);
    const obj = objectTarget(hero);
    const npc = npcTarget(hero);
    const pick = KQ.Sim.Missions.pickTarget(npc, obj, wantsNpc(npc));
    return pick === "npc" ? npc : pick === "obj" ? obj : null;
  }

  /**
   * Run the action for a target (talk, pick up, or a service) if it is enabled; returns whether
   * anything ran.
   */
  function activate(t) {
    if (!t || !t.enabled) return false;
    if (t.kind === "npc") talkTo(t);
    else if (t.kind === "item") G.MissionFlow.pickup(t.item);
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
   * library, home, ...).
   */
  function dispatchObject(id) {
    const V = G.Services;
    if (id.indexOf("counter_") === 0) return V.stall(id);
    if (id.indexOf("wudu_tap_") === 0) return G.PrayerFlow.atTaps();
    const table = {
      prayer_spot: G.PrayerFlow.atHall,
      minimart_till: V.minimart,
      barber_chair: V.barber,
      clinic_desk: V.clinic,
      library_desk: V.library,
      home_door: V.home,
      recycling_bins: V.recycle,
      playground: V.play,
      bus_stop_bench: V.bench,
    };
    if (table[id]) table[id]();
  }

  const ICON_FOR = {
    Talk: "talk",
    Order: "bowl",
    Wudu: "drop",
    Pray: "mosque",
    "Sunat prayer": "mosque",
    Pay: "bag",
    Haircut: "scissors",
    "Check-up": "heart",
    Story: "book",
    Rest: "home",
    Recycle: "recycle",
    Play: "star",
    Sit: "pin",
    "Pick up": "hand",
    "Walk closer": "pin",
  };
  const tmp = new THREE.Vector3();

  /** Swap the Talk button's icon to match its label, only when the label changed. */
  function setIcon(R, label) {
    if (R.talkIconName === label) return;
    R.talkIconName = label;
    const node = G.Pictures.icon(ICON_FOR[label] || "talk", "kq-ic-xl");
    R.talk.replaceChild(node, R.talk.firstChild);
  }

  /** Position the floating button over the target (CSS px inside the stage). */
  function place(t, camera, w, h) {
    const R = G.Hud.refs;
    if (!t) {
      R.talk.hidden = true;
      return;
    }
    const base = S().world.heightAt(t.x, t.z);
    tmp.set(t.x, base + t.h, t.z).project(camera);
    const behind = tmp.z > 1;
    const rawX = (tmp.x * 0.5 + 0.5) * w;
    const rawY = (-tmp.y * 0.5 + 0.5) * h;
    const offscreen = rawX < 70 || rawX > w - 70 || rawY < 135 || rawY > h - 150;
    if (!t.enabled && (behind || offscreen)) {
      R.talk.hidden = true;
      return;
    }
    const x = U.clamp(rawX, 70, w - 70);
    const y = U.clamp(rawY, 135, Math.max(136, h - 150));
    R.talk.hidden = false;
    R.talk.classList.toggle("is-far", !t.enabled);
    R.talk.disabled = !t.enabled;
    R.talk.setAttribute("aria-label", t.aria);
    R.talkLabel.textContent = t.label;
    setIcon(R, t.label);
    R.talkKey.hidden = !t.enabled || G.Env.coarse;
    R.talk.style.left = (behind ? w / 2 : x) + "px";
    R.talk.style.top = (behind ? h - 170 : y) + "px";
  }

  G.Interact = { find, activate, place };
})((window.KQ = window.KQ || {}));
