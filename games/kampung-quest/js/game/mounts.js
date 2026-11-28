/* ============================================================================
 * FILE: mounts.js
 * PURPOSE: The rideable animals (KQ.Game.Mounts): camels by the Makkah camel yard and the oasis,
 *          horses at the Makkah stable, ponies at the kampung pony ride. Spawns them from
 *          KQ.WorldParts.Stables, keeps each standing animal solid, animates the near ones and
 *          hides the far ones, offers a "Camel" / "Horse" / "Pony" prompt within reach that opens
 *          a small menu ("Say hi" or "Ride"), plays the greeting, and hands riding to mount-ride.js.
 * BUSINESS CONTEXT: AC-P5 (camels: say hi + ride), AC-P6 (horses at a stable and a pony ride),
 *   AC-P7 (they never hurt anyone: a standing animal only blocks like a fence; the ridden one
 *   slows and stops for people). Child-friendly: no fail state; a friendly line when riding
 *   somewhere animals do not go.
 * HOW IT FITS: Loop.stepActors calls update(dt, move, free) right after Vehicles.update and skips
 *   Player.update while it returns true. Interact asks target(hero) and sends "mount:..." ids to
 *   press(). The hook __kq.mounts() is debug().
 * RULES: a standing animal is a collider (two boxes, removed while ridden); animals beyond DRAW_FAR
 *   are not drawn and not posed; one left far from home goes back when the hero is far away.
 * DEPENDENCIES: mount-rigs.js, mount-ride.js, mount-sound.js, collide.js, ui-menus.js (card),
 *   vehicle-spots.js (region), KQ.Sim.Mount, KQ.WorldParts.Stables.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  const SM = () => KQ.Sim.Mount;
  /** The prompt shows within this many metres of an animal's body. */
  const REACH = 2.0;
  /** Animals farther than this from the hero are not drawn or posed (m). */
  const DRAW_FAR = 60;
  /** An animal left this far from home goes back once the hero is this far from it (m). */
  const HOME_FAR = 45;
  const NOUN = { camel: "Camel", horse: "Horse", pony: "Pony" };
  const HI_SECS = 1.6;
  const M = { list: [], ready: false, t: 0, cullT: 0, homeT: 0, hi: 0, menus: 0 };

  /* ------------------------------ setup ------------------------------ */

  /** The two circles an animal's body is tested with, as {x, z}. */
  function rings(a) {
    const r = a.sim.spec.ring;
    const k = a.rig.scale;
    const fx = Math.sin(a.sim.heading);
    const fz = Math.cos(a.sim.heading);
    return [-1, 1].map((s) => ({
      x: a.sim.x + fx * r.off * k * s,
      z: a.sim.z + fz * r.off * k * s,
    }));
  }

  /** Make a standing animal solid (the shared colliders list: hero, NPCs and camera). */
  function park(a) {
    unpark(a);
    const r = a.sim.spec.ring.r * a.rig.scale;
    a.boxes = rings(a).map((c) => ({
      minX: c.x - r,
      maxX: c.x + r,
      minZ: c.z - r,
      maxZ: c.z + r,
      kind: "animal",
      mount: a.id,
    }));
    a.boxes.forEach((b) => S().world.colliders.push(b));
  }

  /** Take an animal's boxes out of the world (it is about to be ridden). */
  function unpark(a) {
    if (!a.boxes) return;
    const list = S().world.colliders;
    a.boxes.forEach(function (b) {
      const i = list.indexOf(b);
      if (i !== -1) list.splice(i, 1);
    });
    a.boxes = null;
  }

  /** Add one animal from its definition {id, kind, name, x, z, heading, coat}. */
  function spawn(def) {
    const sim = SM().create(def.kind, def.x, def.z, def.heading);
    if (!sim) return null;
    const rig = G.MountRigs.build(def);
    const free = G.Collide.freeSpot(S().world.colliders, sim.x, sim.z, sim.spec.ring.r + 0.1);
    sim.x = free.x;
    sim.z = free.z;
    const a = { id: def.id, kind: def.kind, name: def.name, sim, rig, hi: 0, hiYaw: 0, bob: 0 };
    a.seed = M.list.length * 1.9;
    a.home = { x: sim.x, z: sim.z, heading: sim.heading };
    a.y = S().world.heightAt(sim.x, sim.z);
    S().scene.add(rig.mesh);
    G.MountRigs.pose(a, 0);
    park(a);
    M.list.push(a);
    return a;
  }

  /** The animals of the current region, built once the world exists (from the first update). */
  function ensure() {
    const s = S();
    if (M.ready || !s || !s.world || !s.scene || !KQ.WorldParts.Stables) return;
    M.ready = true;
    const st = KQ.WorldParts.Stables;
    const defs = G.VehicleSpots.region() === "haramain" ? st.makkah.MOUNTS : st.kampung.MOUNTS;
    defs.forEach(spawn);
    setTier(s.quality);
  }

  /** Shadows only above the low tier (one shadow draw call per near animal otherwise). */
  function setTier(tier) {
    M.tier = tier;
    M.list.forEach((a) => (a.rig.mesh.castShadow = tier !== "low"));
  }

  /* ------------------------------ greeting and the menu ------------------------------ */

  /** "Say hi": the animal turns its head to the hero and nods, with its call; a friendly line. */
  function sayHi(a) {
    const hero = S().player.pos;
    const to = Math.atan2(hero.x - a.sim.x, hero.z - a.sim.z);
    a.hiYaw = U.clamp(SM().angleTo(a.sim.heading, to), -0.9, 0.9);
    a.hi = HI_SECS;
    M.hi += 1;
    a.called = G.MountSound.call(a.kind);
    const line = { camel: " grunts hello!", horse: " whinnies hello!", pony: " nods hello!" };
    G.UI.toast(a.name + line[a.kind], "hint", 2400);
    G.UI.announce(a.name + " the " + a.kind + " says hello");
    return true;
  }

  /** The little menu: a picture-less card with Say hi and Ride (keyboard: Tab / Enter). */
  function openMenu(a) {
    M.menus += 1;
    const noun = a.kind;
    G.Menus.card({
      title: a.name + " the " + noun,
      paragraphs: [
        a.name + " is a gentle " + noun + ". Say hi, or climb on for a ride!",
        "While riding, push the stick where you want to go. Press Exit to get down.",
      ],
      buttons: [
        { label: "Say hi", icon: "hand", onClick: () => sayHi(a) },
        { label: "Ride", icon: "play", primary: true, onClick: () => G.MountRide.mount(a) },
        { label: "Not now", icon: "close" },
      ],
    });
  }

  /** Press a "mount:..." prompt id: "mount:<id>" opens the menu, "mount:hi:<id>" / "mount:ride:<id>" act. */
  function press(id) {
    if (G.MountRide.riding()) return G.MountRide.leave();
    const parts = String(id).split(":");
    const a = byId(parts[parts.length - 1]);
    if (!a) return false;
    if (parts[1] === "hi") return sayHi(a);
    if (parts[1] === "ride") return G.MountRide.mount(a);
    openMenu(a);
    return true;
  }

  const byId = (id) => M.list.find((a) => a.id === id) || null;

  /* ------------------------------ the prompt ------------------------------ */

  /** How far the hero stands from an animal's body (m, 0 touching). */
  function gapTo(a, hero) {
    const r = a.sim.spec.ring.r * a.rig.scale;
    return Math.min(...rings(a).map((c) => U.dist(hero.x, hero.z, c.x, c.z) - r));
  }

  /** The Talk-button target: Exit while riding, else the nearest standing animal in reach. */
  function target(hero) {
    if (!M.ready) return null;
    if (G.MountRide.riding()) return G.MountRide.exitTarget();
    let best = null;
    M.list.forEach(function (a) {
      const d = gapTo(a, hero);
      if (d <= REACH && (!best || d < best.d)) best = { a, d };
    });
    if (!best) return null;
    const a = best.a;
    return {
      kind: "obj",
      id: "mount:" + a.id,
      label: NOUN[a.kind],
      aria: "Say hi to or ride " + a.name + " the " + a.kind,
      x: a.sim.x,
      z: a.sim.z,
      dist: best.d,
      enabled: true,
      h: (a.kind === "camel" ? 2.6 : 1.9) * a.rig.scale,
    };
  }

  /* ------------------------------ per frame ------------------------------ */

  /** Hide the far animals (checked twice a second); the ridden one is always drawn. */
  function cull(hero, dt) {
    M.cullT -= dt;
    if (M.cullT > 0) return;
    M.cullT = 0.5;
    const ridden = G.MountRide.current();
    M.list.forEach(function (a) {
      a.rig.mesh.visible = a === ridden || U.dist(a.sim.x, a.sim.z, hero.x, hero.z) < DRAW_FAR;
    });
  }

  /** Put an animal back where it lives (nobody sees it: the hero is far away). */
  function returnHome(a) {
    unpark(a);
    a.sim.x = a.home.x;
    a.sim.z = a.home.z;
    a.sim.heading = a.home.heading;
    a.sim.speed = 0;
    a.y = S().world.heightAt(a.sim.x, a.sim.z);
    G.MountRigs.pose(a, M.t);
    park(a);
  }

  /** Once a second: an animal left far from home goes back when the hero is far from it. */
  function sendHome(hero, dt) {
    M.homeT += dt;
    if (M.homeT < 1) return;
    M.homeT = 0;
    const ridden = G.MountRide.current();
    M.list.forEach(function (a) {
      if (a === ridden) return;
      const away = U.dist(a.sim.x, a.sim.z, a.home.x, a.home.z) > 0.5;
      if (away && U.dist(a.sim.x, a.sim.z, hero.x, hero.z) > HOME_FAR) returnHome(a);
    });
  }

  /** Pose the drawn standing animals (the ridden one is posed by mount-ride.js). */
  function animate(dt) {
    const ridden = G.MountRide.current();
    M.list.forEach(function (a) {
      if (a === ridden || !a.rig.mesh.visible) return;
      if (a.hi > 0) a.hi = Math.max(0, a.hi - dt);
      G.MountRigs.pose(a, M.t);
    });
  }

  /**
   * Called every sim step from Loop.stepActors, after Vehicles.update.
   * @returns {boolean} true when the hero is riding and this module moved him (skip Player.update)
   */
  function update(dt, move, free) {
    ensure();
    if (!M.ready) return false;
    M.t += dt;
    const P = S().player;
    if (S().quality !== M.tier) setTier(S().quality);
    cull(P.pos, dt);
    sendHome(P.pos, dt);
    animate(dt);
    return G.MountRide.update(dt, move, free);
  }

  /** Test hook: every animal, which one is ridden, and the counters. */
  function debug() {
    const ridden = G.MountRide.current();
    return Object.assign(
      {
        ready: M.ready,
        region: G.VehicleSpots.region(),
        riding: ridden ? ridden.id : null,
        hi: M.hi,
        menus: M.menus,
        sound: G.MountSound.debug(),
        list: M.list.map((a) => ({
          id: a.id,
          kind: a.kind,
          name: a.name,
          x: +a.sim.x.toFixed(2),
          z: +a.sim.z.toFixed(2),
          y: +a.y.toFixed(3),
          heading: +a.sim.heading.toFixed(2),
          speed: +a.sim.speed.toFixed(2),
          gait: a.sim.gait,
          phase: +a.sim.phase.toFixed(3),
          visible: a.rig.mesh.visible,
          ridden: a === ridden,
          greeting: a.hi > 0,
        })),
      },
      G.MountRide.debug(),
    );
  }

  G.Mounts = {
    update,
    target,
    press,
    sayHi: (id) => (byId(id) ? sayHi(byId(id)) : false),
    byId,
    park,
    unpark,
    rings,
    debug,
    list: () => M.list,
    riding: () => G.MountRide.riding(),
    DRAW_FAR,
  };
})((window.KQ = window.KQ || {}));
