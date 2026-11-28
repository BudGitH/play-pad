/* ============================================================================
 * FILE: world-events-holy.js
 * PURPOSE: Three Makkah / Madinah moments for world-events.js: a flock of pigeons takes off all
 *          at once when a child runs up (holy-pigeons.js), a volunteer at a little table hands out
 *          dates and zamzam water (take both), and a family asks the hero to take their photo.
 * BUSINESS CONTEXT: AC-P18 in the Haramain region. Respectful and calm: the people greet with the
 *   salaam, nothing is sold, and nothing happens near the rites (the director never starts an
 *   event during an Umrah / Hajj / Ziarah step, a prayer, or the azan).
 * DEPENDENCIES: world-events.js, event-actors.js, holy-pigeons.js (FLOCKS) and the world's
 *   burstPigeons, mission-steps.js (the camera flash), KQ.Sim.Events.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;

  /* ------------------------------ pigeons ------------------------------ */

  /** The flock centre nearest the hero that is 10-45 m away, or null. */
  function nearestFlock(hero) {
    const flocks =
      (KQ.WorldParts && KQ.WorldParts.HolyPigeons && KQ.WorldParts.HolyPigeons.FLOCKS) || [];
    let best = null;
    flocks.forEach(function (f) {
      const d = U.dist(f[0], f[1], hero.x, hero.z);
      if (d >= 10 && d <= 45 && (!best || d < best.d)) best = { x: f[0], z: f[1], d };
    });
    return best;
  }

  /** A child starts running at the flock. */
  function pigeonStart(st) {
    const env = st.env;
    const world = env.world();
    const flock = nearestFlock(env.hero());
    if (!flock || typeof world.burstPigeons !== "function") return false;
    st.flock = flock;
    const hero = env.hero();
    const dx = hero.x - flock.x;
    const dz = hero.z - flock.z;
    const d = Math.hypot(dx, dz) || 1;
    const start = G.Collide.freeSpot(
      world.colliders,
      flock.x + (dx / d) * 7,
      flock.z + (dz / d) * 7,
      0.4,
    );
    st.kid = env.actor("ev_child", start.x, start.z, Math.atan2(-dx, -dz));
    G.Actors.walkTo(st.kid, flock.x, flock.z, 3);
    env.chip("A child runs at the pigeons!");
    return true;
  }

  /** When the child is close the whole flock takes off together; a moment later it is over. */
  function pigeonUpdate(st) {
    const env = st.env;
    if (!st.burst && U.dist(st.kid.x, st.kid.z, st.flock.x, st.flock.z) < 3.2) {
      st.burst = true;
      st.at = env.now();
      env.world().burstPigeons(st.flock.x, st.flock.z, 10);
      env.say(st.kid.id, "Whee! Fly, fly!", 0, 2.6);
      env.sound("good");
      st.kid.waveT = 3;
      G.Actors.walkTo(st.kid, null);
      env.chip("Whoosh! Up they go.");
    }
    return st.burst && env.now() > st.at + 6 ? "done" : null;
  }

  /** The pigeon-takeoff script. */
  function pigeons(env) {
    const st = { env, flock: null, kid: null, burst: false, at: 0 };
    return {
      start: () => pigeonStart(st),
      update: () => pigeonUpdate(st),
      anchor: () => st.flock,
      info: () => ({ burst: st.burst }),
    };
  }

  /* ------------------------------ dates and zamzam ------------------------------ */

  /** A little table with a cloth, a tray of dates and a white jug with a gold band. */
  function tableMesh() {
    const g = new THREE.Group();
    const std = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.7), std(0xfaf6ea));
    top.position.y = 0.85;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.6), std(0xe9e2cf));
    legs.position.y = 0.4;
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16), std(0xc9a13a));
    tray.position.set(-0.35, 0.92, 0);
    g.add(top, legs, tray);
    for (let i = 0; i < 7; i += 1) {
      const date = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), std(0x4a2a14));
      date.scale.set(1, 0.7, 1.4);
      date.position.set(
        -0.35 + Math.cos(i * 0.9) * 0.14 * (i % 3),
        0.97,
        Math.sin(i * 0.9) * 0.14 * (i % 3),
      );
      g.add(date);
    }
    const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 12), std(0xf4f6f8));
    jug.position.set(0.4, 1.06, 0);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.05, 12), std(0xd9b04a));
    band.position.set(0.4, 1.1, 0);
    g.add(jug, band);
    g.traverse((o) => (o.castShadow = o.isMesh));
    return g;
  }

  /** The volunteer and table appear on the plaza, a few metres from the hero. */
  function datesStart(st) {
    const env = st.env;
    const at = env.spot(6, 11, 2, true);
    if (!at) return false;
    const hero = env.hero();
    const face = Math.atan2(hero.x - at.x, hero.z - at.z);
    st.table = env.mesh(tableMesh());
    st.table.position.set(
      at.x + Math.sin(face) * 0.9,
      env.world().heightAt(at.x, at.z),
      at.z + Math.cos(face) * 0.9,
    );
    st.table.rotation.y = face + Math.PI / 2;
    st.at = at;
    st.vol = env.actor("ev_volunteer", at.x, at.z, face);
    st.vol.waveT = 3;
    env.say(st.vol.id, "Assalamualaikum! Dates and zamzam, please!", 0.6, 3.4);
    env.chip("A volunteer is giving out dates and zamzam.");
    return true;
  }

  /** Keep the volunteer facing the hero and calling out now and then. */
  function datesUpdate(st, dt) {
    const hero = st.env.hero();
    G.Actors.face(st.vol, hero.x, hero.z, dt);
    st.call -= dt;
    if (st.call <= 0 && !st.done) {
      st.call = 12;
      st.vol.waveT = 2.4;
      st.env.say(st.vol.id, "Dates! Zamzam! Please, take.", 0, 2.8);
    }
    return st.done && st.env.now() > st.doneAt + 5 ? "done" : null;
  }

  /** Take what is offered: the dates first, then the water; both together are a small gift. */
  function datesPress(st) {
    const env = st.env;
    const first = !st.dates;
    if (first) st.dates = true;
    else st.water = true;
    G.Audio.play("good");
    env.say("hero", first ? "Bismillah. Shukran!" : "Alhamdulillah!", 0, 2.4);
    env.say(
      st.vol.id,
      first ? "Jazakallah khair. Zamzam too?" : "Ameen. Enjoy your visit!",
      0.8,
      2.8,
    );
    G.Player.lockFor(G.S.player, 1.6, "eat");
    if (st.dates && st.water) {
      st.done = true;
      st.doneAt = env.now();
      env.reward({ coins: 1, sticker: "sticker_gift", text: "Dates and zamzam!" });
      G.Hi.noteTalk();
    }
  }

  /** The dates-and-zamzam script. */
  function dates(env) {
    const st = { env, call: 6, dates: false, water: false, done: false, doneAt: 0 };
    return {
      start: () => datesStart(st),
      update: (dt) => datesUpdate(st, dt),
      anchor: () => st.at || null,
      info: () => ({ dates: st.dates, water: st.water }),
      target(hero) {
        const d = U.dist(hero.x, hero.z, st.table.position.x, st.table.position.z);
        if (d > 2.8 || st.done) return null;
        const label = st.dates ? "Zamzam" : "Dates";
        const aria = st.dates ? "Take a cup of zamzam water" : "Take a date";
        return {
          id: "gift",
          label,
          aria,
          x: st.table.position.x,
          z: st.table.position.z,
          dist: d,
          h: 1.6,
        };
      },
      press: () => datesPress(st),
    };
  }

  /* ------------------------------ a family asks for a photo ------------------------------ */

  /** Dad, mum and child stand together a few metres away, facing the hero. */
  function photoStart(st) {
    const env = st.env;
    const at = env.spot(6, 11, 2.2, true);
    if (!at) return false;
    const hero = env.hero();
    const face = Math.atan2(hero.x - at.x, hero.z - at.z);
    const side = { x: Math.cos(face), z: -Math.sin(face) };
    st.at = at;
    st.family = [
      env.actor("ev_dad", at.x - side.x * 0.8, at.z - side.z * 0.8, face),
      env.actor("ev_mum", at.x + side.x * 0.8, at.z + side.z * 0.8, face),
      env.actor("ev_child", at.x + Math.sin(face) * 0.1, at.z + Math.cos(face) * 0.1, face),
    ];
    st.family[0].waveT = 3;
    env.say("ev_dad", "Assalamualaikum! Could you take our photo?", 0.6, 3.6);
    env.chip("A family would like their photo taken.");
    return true;
  }

  /** The family keeps looking at the hero. */
  function photoUpdate(st, dt) {
    const hero = st.env.hero();
    st.family.forEach((a) => G.Actors.face(a, hero.x, hero.z, dt));
    return st.done && st.env.now() > st.doneAt + 5 ? "done" : null;
  }

  /** Take the photo: a flash, a cheer, a small thank-you. */
  function photoPress(st) {
    const env = st.env;
    G.MissionSteps.flash();
    G.Audio.play("tap");
    G.Audio.play("pose");
    st.family.forEach((a) => (a.waveT = 3));
    env.say("ev_dad", "Shukran! Jazakallah khair!", 0.5, 3);
    env.say("ev_child", "Thank you!", 1.2, 2.4);
    st.done = true;
    st.doneAt = env.now();
    env.reward({ coins: 2, text: "A happy family photo!" });
    G.Hi.noteTalk();
  }

  /** The family-photo script. */
  function photo(env) {
    const st = { env, family: [], done: false, doneAt: 0, at: null };
    return {
      start: () => photoStart(st),
      update: (dt) => photoUpdate(st, dt),
      anchor: () => st.at,
      info: () => ({ done: st.done }),
      target(hero) {
        const d = U.dist(hero.x, hero.z, st.at.x, st.at.z);
        if (d > 3.4 || st.done) return null;
        return {
          id: "family",
          label: "Photo",
          aria: "Take their photo",
          x: st.at.x,
          z: st.at.z,
          dist: d,
          h: 2,
        };
      },
      press: () => photoPress(st),
    };
  }

  G.WorldEvents.SCRIPTS.pigeons = pigeons;
  G.WorldEvents.SCRIPTS.dates = dates;
  G.WorldEvents.SCRIPTS.photo = photo;
})((window.KQ = window.KQ || {}));
