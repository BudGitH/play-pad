/* ============================================================================
 * FILE: world-events-town.js
 * PURPOSE: Three more kampung moments for world-events.js: a kompang wedding procession that walks
 *          past (groom, bride, two drummers; stay close to join in), a sudden light rain shower
 *          (streaks round the hero, two passers-by with umbrellas, a rainbow after), and a kid's
 *          balloon that floats away (catch it and hand it back).
 * BUSINESS CONTEXT: AC-P18. Gentle and optional: the procession never blocks the way, rain is a
 *   single line-segment mesh (one draw call) that follows the hero, and a balloon that is not
 *   caught just floats off with a kind word.
 * DEPENDENCIES: world-events.js, event-actors.js, collide.js, crowd-zones.js, KQ.Sim.Events.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const secsOf = (id) => KQ.Sim.Events.byId(id).secs;

  /* ------------------------------ kompang wedding procession ------------------------------ */

  const JOIN_NEAR = 7;
  const JOIN_SECONDS = 6;

  /** A kompang: a small hand drum hung at the hip (cylinder with a pale skin). */
  function drumMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.07, 14),
      new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.7 }),
    );
    const skin = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 14),
      new THREE.MeshStandardMaterial({ color: 0xf1e2c4, roughness: 0.9 }),
    );
    skin.position.y = 0.037;
    skin.rotation.x = -Math.PI / 2;
    g.add(body, skin);
    g.position.set(0.12, 0.75, 0.3);
    g.rotation.x = 0.5;
    return g;
  }

  /** Two clear ends of a straight walk 8-11 m to either side of the hero's view, or null. */
  function processionPath(st) {
    const env = st.env;
    const hero = env.hero();
    const yaw = G.Camera.state.yaw;
    const world = env.world();
    const reach = [11, 13, 8];
    for (let i = 0; i < reach.length; i += 1) {
      const a = {
        x: hero.x + Math.sin(yaw - 0.6) * reach[i],
        z: hero.z + Math.cos(yaw - 0.6) * reach[i],
      };
      const b = {
        x: hero.x + Math.sin(yaw + 0.6) * reach[i],
        z: hero.z + Math.cos(yaw + 0.6) * reach[i],
      };
      const ahead = {
        x: hero.x + Math.sin(yaw) * reach[i] * 0.9,
        z: hero.z + Math.cos(yaw) * reach[i] * 0.9,
      };
      if (
        G.CrowdZones.segmentClear(world, a.x, a.z, ahead.x, ahead.z, 0.6) &&
        G.CrowdZones.segmentClear(world, ahead.x, ahead.z, b.x, b.z, 0.6)
      )
        return [a, ahead, b];
    }
    return null;
  }

  /** The party starts at one end of the walk, in a loose line: drummers, then the couple. */
  function kompangStart(st) {
    const env = st.env;
    st.path = processionPath(st);
    if (!st.path) return false;
    const a = st.path[0];
    const cast = [
      ["ev_drummer1", 0, 0.5],
      ["ev_drummer2", 0, -0.5],
      ["ev_groom", -1.6, 0.45],
      ["ev_bride", -1.6, -0.45],
    ];
    cast.forEach(function (c) {
      const actor = env.actor(c[0], a.x, a.z, 0);
      actor.lag = c[1];
      actor.side = c[2];
      st.party.push(actor);
    });
    st.party.slice(0, 2).forEach((d) => d.group.add(env.mesh(drumMesh())));
    env.say("ev_drummer1", "Kompang! Kompang!", 0.6, 3);
    env.chip("A wedding procession with kompang drums!");
    env.sound("drum");
    return true;
  }

  /** Where along the two-leg path a walker `lag` metres behind the leader is, shifted `side` m sideways. */
  function pathPoint(st, dist, side) {
    const [a, m, b] = st.path;
    const l1 = U.dist(a.x, a.z, m.x, m.z);
    const l2 = U.dist(m.x, m.z, b.x, b.z);
    const d = Math.max(0, Math.min(l1 + l2, dist));
    const from = d <= l1 ? a : m;
    const to = d <= l1 ? m : b;
    const len = d <= l1 ? l1 : l2;
    const t = (d <= l1 ? d : d - l1) / (len || 1);
    const dx = (to.x - from.x) / (len || 1);
    const dz = (to.z - from.z) / (len || 1);
    return {
      x: from.x + (to.x - from.x) * t - dz * side,
      z: from.z + (to.z - from.z) * t + dx * side,
    };
  }

  /** The procession walks the path; drummers beat in time; staying close earns a wedding sticker. */
  function kompangUpdate(st, dt) {
    st.lead += 1.15 * dt;
    st.party.forEach(function (a) {
      const p = pathPoint(st, st.lead + a.lag, a.side);
      G.Actors.walkTo(a, p.x, p.z, 2);
    });
    st.beat -= dt;
    if (st.beat <= 0) {
      st.beat = 0.55;
      if (U.dist(st.party[0].x, st.party[0].z, st.env.hero().x, st.env.hero().z) < 30)
        st.env.sound("drum");
    }
    joinIn(st, dt);
    const total =
      U.dist(st.path[0].x, st.path[0].z, st.path[1].x, st.path[1].z) +
      U.dist(st.path[1].x, st.path[1].z, st.path[2].x, st.path[2].z);
    return st.lead > total + 4 || st.env.now() > secsOf("kompang") - 2 ? "done" : null;
  }

  /** Stay within a few metres for a few seconds and you are a wedding guest. */
  function joinIn(st, dt) {
    const hero = st.env.hero();
    const near = st.party.some((a) => U.dist(a.x, a.z, hero.x, hero.z) < JOIN_NEAR);
    st.near = near ? st.near + dt : 0;
    if (st.joined || st.near < JOIN_SECONDS) return;
    st.joined = true;
    st.env.say("ev_bride", "Terima kasih for coming!", 0, 3);
    st.env.reward({ coins: 2, sticker: "sticker_wedding", text: "You joined the wedding!" });
    G.Hi.noteTalk();
  }

  /** The kompang procession script. */
  function kompang(env) {
    const st = { env, path: null, party: [], lead: 0, beat: 0, near: 0, joined: false };
    return {
      start: () => kompangStart(st),
      update: (dt) => kompangUpdate(st, dt),
      anchor: () => (st.party[2] ? { x: st.party[2].x, z: st.party[2].z } : null),
      info: () => ({ joined: st.joined, lead: Number(st.lead.toFixed(1)) }),
    };
  }

  /* ------------------------------ rain shower ------------------------------ */

  const DROPS = 340;
  const BOX = 9;
  const FALL = 13;

  /** A rain umbrella held over a passer-by (a cone on a stick). */
  function umbrellaMesh(colour) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6 }),
    );
    top.position.y = 2.15;
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.8, 5),
      new THREE.MeshStandardMaterial({ color: 0x3a3a40 }),
    );
    stick.position.y = 1.8;
    g.add(top, stick);
    return g;
  }

  /** All the streaks in one LineSegments (one draw call), in a box that follows the hero. */
  function rainMesh(count) {
    const pos = new Float32Array(count * 6);
    for (let i = 0; i < count; i += 1) {
      const x = (Math.random() * 2 - 1) * BOX;
      const z = (Math.random() * 2 - 1) * BOX;
      const y = Math.random() * 10;
      pos.set([x, y, z, x - 0.05, y - 0.55, z + 0.02], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xc4d8ff,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      fog: false,
    });
    const rain = new THREE.LineSegments(geo, mat);
    rain.frustumCulled = false;
    return rain;
  }

  /** Two passers-by hurry across with umbrellas (running between the hero and the street). */
  function rainStart(st) {
    const env = st.env;
    const reduced = G.Settings.reduced();
    st.rain = env.mesh(rainMesh(reduced ? 90 : DROPS));
    const hero = env.hero();
    const yaw = G.Camera.state.yaw;
    [
      ["ev_umbrella1", 0xe8453c, -1],
      ["ev_umbrella2", 0x3f74e8, 1],
    ].forEach(function (c) {
      const x = hero.x + Math.sin(yaw + 1.1 * c[2]) * 9;
      const z = hero.z + Math.cos(yaw + 1.1 * c[2]) * 9;
      const spot = G.Collide.freeSpot(env.world().colliders, x, z, 0.4);
      const a = env.actor(c[0], spot.x, spot.z, 0);
      a.group.add(env.mesh(umbrellaMesh(c[1])));
      G.Actors.walkTo(
        a,
        hero.x - Math.sin(yaw + 1.1 * c[2]) * 12,
        hero.z - Math.cos(yaw + 1.1 * c[2]) * 12,
        2.3,
      );
      st.walkers.push(a);
    });
    env.say("ev_umbrella1", "Rain! Open your umbrella!", 0.8, 3);
    env.chip("A sudden shower!");
    env.sound("patter");
    return true;
  }

  /** The streaks fall and wrap; the box rides along with the hero. */
  function rainFall(st, dt) {
    const hero = st.env.hero();
    const pos = st.rain.geometry.attributes.position;
    const fade = Math.max(0, Math.min(1, (st.rainLeft - st.env.now()) / 3));
    for (let i = 0; i < pos.count; i += 2) {
      let y = pos.getY(i) - FALL * dt;
      if (y < 0) y += 10;
      pos.setY(i, y);
      pos.setY(i + 1, y - 0.55);
    }
    pos.needsUpdate = true;
    st.rain.position.set(hero.x, st.env.world().heightAt(hero.x, hero.z), hero.z);
    st.rain.material.opacity = 0.8 * Math.min(1, st.env.now() / 1.5) * fade;
  }

  /** A rainbow arc (a half ring with a colour per band) a long way ahead, fading in as the rain stops. */
  function rainbow(st) {
    const hero = st.env.hero();
    const yaw = G.Camera.state.yaw;
    const cols = [0xe8453c, 0xf08a24, 0xf6d53a, 0x4bb36a, 0x3f74e8, 0x5b3fa8];
    const geo = new THREE.RingGeometry(14, 16.4, 48, cols.length, 0, Math.PI);
    const colour = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < geo.attributes.position.count; i += 1) {
      const band = Math.min(
        cols.length - 1,
        Math.floor(
          ((Math.hypot(geo.attributes.position.getX(i), geo.attributes.position.getY(i)) - 14) /
            2.4) *
            cols.length,
        ),
      );
      new THREE.Color(cols[Math.max(0, band)]).toArray(colour, i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colour, 3));
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    st.bow = st.env.mesh(new THREE.Mesh(geo, mat));
    st.bow.position.set(hero.x + Math.sin(yaw) * 55, 0, hero.z + Math.cos(yaw) * 55);
    st.bow.rotation.y = yaw + Math.PI;
    st.env.say("ev_umbrella2", "Look! A rainbow!", 0, 3.4);
    st.env.chip("Look, a rainbow!");
  }

  /** One step: rain for most of the event, then it thins out and a rainbow shows. */
  function rainUpdate(st, dt) {
    const t = st.env.now();
    const total = secsOf("rain");
    st.rainLeft = total - 12;
    if (t < st.rainLeft) st.patter -= dt;
    if (st.patter <= 0) {
      st.patter = 4;
      st.env.sound("patter");
    }
    rainFall(st, dt);
    if (t > st.rainLeft && !st.bow) rainbow(st);
    if (st.bow) st.bow.material.opacity = Math.min(0.6, (t - st.rainLeft) * 0.12);
    return null;
  }

  /** The rain-shower script. */
  function rain(env) {
    const st = { env, rain: null, bow: null, walkers: [], patter: 0, rainLeft: 30 };
    return {
      start: () => rainStart(st),
      update: (dt) => rainUpdate(st, dt),
      anchor: () => env.hero(),
      info: () => ({
        bow: Boolean(st.bow),
        streaks: st.rain ? st.rain.geometry.attributes.position.count / 2 : 0,
      }),
    };
  }

  /* ------------------------------ lost balloon ------------------------------ */

  /** A red balloon with a thin string (one group; the string is a long thin cylinder). */
  function balloonMesh() {
    const g = new THREE.Group();
    const bal = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8453c, roughness: 0.35, metalness: 0.05 }),
    );
    bal.scale.set(1, 1.2, 1);
    bal.position.y = 0.5;
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.9, 4),
      new THREE.MeshBasicMaterial({ color: 0xfafafa }),
    );
    string.position.y = -0.05;
    g.add(bal, string);
    return g;
  }

  /** A kid and a balloon that has just slipped out of their hand. */
  function balloonStart(st) {
    const env = st.env;
    const at = env.spot(7, 12, 1.6, true);
    if (!at) return false;
    st.kid = env.actor("ev_kid_girl", at.x, at.z, Math.PI);
    st.bal = { x: at.x + 0.2, y: 1.6, z: at.z, dx: 0.35 * (st.env.now() % 2 ? 1 : -1), dz: 0.3 };
    st.mesh = env.mesh(balloonMesh());
    st.kid.waveT = 4;
    env.say(st.kid.id, "Oh no! My balloon!", 0.4, 3);
    env.chip("A balloon is floating away! Can you catch it?");
    return true;
  }

  /** Where the balloon is drawn: it rises, drifts and sways; once caught it follows the hero's hand. */
  function balloonMove(st, dt) {
    const b = st.bal;
    const t = st.env.now();
    if (st.state === "free") {
      b.y += (st.env.now() > 40 ? 0.5 : 0.07) * dt;
      b.x += (b.dx + Math.sin(t * 0.9) * 0.15) * dt;
      b.z += b.dz * dt;
    } else {
      const tgt = st.state === "caught" ? st.env.hero() : st.kid;
      b.x = U.damp(b.x, tgt.x, 3, dt);
      b.z = U.damp(b.z, tgt.z, 3, dt);
      b.y = U.damp(b.y, 1.5, 3, dt);
    }
    st.mesh.position.set(b.x, b.y - 0.5 + st.env.world().heightAt(b.x, b.z), b.z);
  }

  /** The kid runs to the hero when the balloon is caught; thanks, then goes home. */
  function balloonUpdate(st, dt) {
    balloonMove(st, dt);
    const hero = st.env.hero();
    if (st.state === "caught") {
      G.Actors.walkTo(st.kid, hero.x + 1, hero.z + 0.5, 2.2);
      if (U.dist(st.kid.x, st.kid.z, hero.x, hero.z) < 1.8) thanks(st);
    } else if (st.state === "free") {
      G.Actors.face(st.kid, st.bal.x, st.bal.z, dt);
      if (st.bal.y > 7 && !st.gone) bye(st);
    }
    return st.state === "done" && st.env.now() > st.doneAt + 4 ? "done" : null;
  }

  /** The kid has the balloon back: a thank-you, a little reward, a wave. */
  function thanks(st) {
    st.state = "returned";
    st.doneAt = st.env.now();
    st.env.say(st.kid.id, "Thank you! You're so kind!", 0, 3);
    st.kid.waveT = 3;
    st.env.reward({ coins: 2, text: "You caught the balloon!" });
    G.Hi.noteTalk();
    st.state = "done";
  }

  /** The balloon is gone: the kid is not sad for long (no scolding, nothing lost). */
  function bye(st) {
    st.gone = true;
    st.state = "done";
    st.doneAt = st.env.now();
    st.mesh.visible = false;
    st.env.say(st.kid.id, "Bye bye, balloon! It's okay!", 0, 3);
  }

  /** The lost-balloon script. */
  function balloon(env) {
    const st = { env, kid: null, bal: null, mesh: null, state: "free", doneAt: 0, gone: false };
    return {
      start: () => balloonStart(st),
      update: (dt) => balloonUpdate(st, dt),
      anchor: () => (st.bal ? { x: st.bal.x, z: st.bal.z } : null),
      info: () => ({ state: st.state, y: st.bal ? Number(st.bal.y.toFixed(2)) : null }),
      target(hero) {
        if (st.state !== "free") return null;
        const d = U.dist(hero.x, hero.z, st.bal.x, st.bal.z);
        if (d > 2.6 || st.bal.y > 3.6) return null;
        return {
          id: "balloon",
          label: "Catch",
          aria: "Catch the balloon",
          x: st.bal.x,
          z: st.bal.z,
          dist: d,
          h: st.bal.y,
        };
      },
      press() {
        if (st.state !== "free") return;
        st.state = "caught";
        st.env.sound("good");
        st.env.say(st.kid.id, "You got it!", 0, 2);
      },
    };
  }

  G.WorldEvents.SCRIPTS.kompang = kompang;
  G.WorldEvents.SCRIPTS.rain = rain;
  G.WorldEvents.SCRIPTS.balloon = balloon;
})((window.KQ = window.KQ || {}));
