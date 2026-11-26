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

  function labelFor(id) {
    const key = Object.keys(LABELS).find((k) => id.indexOf(k) === 0);
    return key ? LABELS[key] : ["Use", "Use"];
  }

  function objectTarget(hero) {
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

  /** The current best target or null. Disabled "Walk closer" targets are returned for NPCs only. */
  function find() {
    const P = S().player;
    if (P.locked || G.UI.modalOpen() || S().paused) return null;
    const hero = P.pos;
    const obj = objectTarget(hero);
    const npc = npcTarget(hero);
    if (npc && npc.enabled && (!obj || npc.dist - 0.4 <= obj.dist)) return npc;
    return obj || npc;
  }

  function activate(t) {
    if (!t || !t.enabled) return false;
    if (t.kind === "npc") G.MissionFlow.talk(t.agent);
    else if (t.kind === "item") G.MissionFlow.pickup(t.item);
    else dispatchObject(t.id);
    return true;
  }

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
