/* ============================================================================
 * FILE: world-events-kampung.js
 * PURPOSE: Three kampung moments for world-events.js: the kids' football kick-about (a ball the
 *          hero can kick by walking into it), the ice-cream / kacang putih cart that arrives with
 *          a bell (buy one), and Mimi the cat chasing a butterfly (pet her).
 * BUSINESS CONTEXT: AC-P18. Each script is { start, update, end, anchor, target, press, info };
 *   start() returns false when the town has no room. Nobody can be hurt or scolded: the ball
 *   only rolls, the cart only sells halal ice cream for 2 coins (never forced), the cat purrs.
 * DEPENDENCIES: world-events.js (SCRIPTS, env helpers), event-actors.js, collide.js, collectibles.js
 *   (the cat mesh), KQ.Sim.Events (event lengths).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const secsOf = (id) => KQ.Sim.Events.byId(id).secs;

  /* ------------------------------ football ------------------------------ */

  const FIELD_R = 3.8;
  const BALL_R = 0.14;
  const KICK_COOL = 0.45;

  /** A white ball with a dark patch ring (two meshes in one group). */
  function ballMesh() {
    const g = new THREE.Group();
    const white = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6 }),
    );
    const patch = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R * 1.015, 8, 5),
      new THREE.MeshStandardMaterial({ color: 0x20232b, roughness: 0.7, wireframe: true }),
    );
    white.castShadow = true;
    g.add(white, patch);
    return g;
  }

  /** The three kids stand round the centre of the pitch, and the ball sits in the middle. */
  function footballStart(st) {
    const env = st.env;
    const at = env.spot(6, 11, 3.2) || env.spot(6, 14, 2.2, true);
    if (!at) return false;
    st.c = at;
    st.ball = { x: at.x, z: at.z, vx: 0, vz: 0, mesh: env.mesh(ballMesh()), cool: 0 };
    ["ev_kid_red", "ev_kid_blue", "ev_kid_green"].forEach(function (key, i) {
      const a = env.actor(key, at.x + Math.cos(i * 2.1) * 2.5, at.z + Math.sin(i * 2.1) * 2.5, i);
      a.kick = 0;
      st.kids.push(a);
    });
    env.say("ev_kid_red", "Wanna play football?", 0.6, 3);
    env.chip("Football! Walk into the ball to kick it.");
    env.sound("good");
    return true;
  }

  /** Is a ball of BALL_R blocked at (x, z) by a wall or prop? */
  function ballBlocked(st, x, z) {
    return G.Collide.blockedAt(st.env.world().colliders, x, z, BALL_R);
  }

  /** Roll the ball: friction, bounce off walls and the edge of the pitch, show it on the ground. */
  function rollBall(st, dt) {
    const b = st.ball;
    const nx = b.x + b.vx * dt;
    const nz = b.z + b.vz * dt;
    if (ballBlocked(st, nx, nz) || U.dist(nx, nz, st.c.x, st.c.z) > FIELD_R) {
      b.vx *= -0.5;
      b.vz *= -0.5;
    } else {
      b.x = nx;
      b.z = nz;
    }
    const f = Math.exp(-1.5 * dt);
    b.vx *= f;
    b.vz *= f;
    const speed = Math.hypot(b.vx, b.vz);
    const y = st.env.world().heightAt(b.x, b.z) + BALL_R;
    b.mesh.position.set(b.x, y, b.z);
    if (speed > 0.05) {
      b.mesh.rotation.x += (b.vz / BALL_R) * dt;
      b.mesh.rotation.z -= (b.vx / BALL_R) * dt;
    }
    b.cool -= dt;
  }

  /** The hero walks into the ball: it rolls away from them (a little with their own speed). */
  function heroKick(st) {
    const b = st.ball;
    const P = st.env.hero();
    const d = U.dist(b.x, b.z, P.x, P.z);
    if (d > 0.65 || b.cool > 0) return;
    const dx = (b.x - P.x) / (d || 1);
    const dz = (b.z - P.z) / (d || 1);
    const power = 3.2 + 0.8 * (G.S.player.speed || 0);
    b.vx = dx * power;
    b.vz = dz * power;
    b.cool = KICK_COOL;
    st.kicks += 1;
    st.env.sound("tap");
    if (st.kicks === 3) {
      st.env.say(st.kids[0].id, "Nice kick! You're in!", 0, 2.6);
      st.env.reward({ coins: 2, text: "You joined the game!" });
      G.Hi.noteTalk();
    }
  }

  /** A kid who reaches the ball passes it to a friend (or, now and then, to the hero). */
  function kidKick(st, a) {
    const b = st.ball;
    a.kick -= 1 / 30;
    if (a.kick > 0 || U.dist(a.x, a.z, b.x, b.z) > 0.6) return;
    const hero = st.env.hero();
    const near = U.dist(hero.x, hero.z, st.c.x, st.c.z) < 9;
    const mate = near && st.rng() < 0.35 ? hero : st.kids[Math.floor(st.rng() * st.kids.length)];
    const dx = mate.x - b.x;
    const dz = mate.z - b.z;
    const d = Math.hypot(dx, dz) || 1;
    b.vx = (dx / d) * 3.4;
    b.vz = (dz / d) * 3.4;
    a.kick = 1.6;
    st.env.sound("tap");
  }

  /** The kid nearest the ball runs at it; the others drift to their own spots on the pitch. */
  function kidsMove(st) {
    const b = st.ball;
    const order = st.kids
      .slice()
      .sort((p, q) => U.dist(p.x, p.z, b.x, b.z) - U.dist(q.x, q.z, b.x, b.z));
    order.forEach(function (a, rank) {
      if (rank === 0) G.Actors.walkTo(a, b.x, b.z, 2.5);
      else {
        const k = st.kids.indexOf(a);
        const ang = k * 2.1 + st.env.now() * 0.15;
        G.Actors.walkTo(a, st.c.x + Math.cos(ang) * 3, st.c.z + Math.sin(ang) * 3, 1.6);
      }
      kidKick(st, a);
    });
  }

  /** One step of the match; near the end the kids call goodbye. */
  function footballUpdate(st, dt) {
    rollBall(st, dt);
    heroKick(st);
    st.kids.forEach((a) => (a.restPose = "idle"));
    kidsMove(st);
    const left = secsOf("football") - st.env.now();
    if (left < 6 && !st.bye) {
      st.bye = true;
      st.env.say(st.kids[1].id, "Bye! See you!", 0, 3);
      st.kids.forEach((a) => (a.waveT = 3));
      st.env.chip("The kids wave goodbye.");
    }
    return null;
  }

  /** The football script. */
  function football(env) {
    const st = {
      env,
      c: null,
      ball: null,
      kids: [],
      kicks: 0,
      bye: false,
      rng: U.rng(U.hash("fb")),
    };
    return {
      start: () => footballStart(st),
      update: (dt) => footballUpdate(st, dt),
      anchor: () => st.c,
      info: () => ({ kicks: st.kicks, ball: st.ball && { x: st.ball.x, z: st.ball.z } }),
      /** Test hook: roll the ball from where it is (as if kicked). */
      nudge: (vx, vz) => {
        st.ball.vx = vx;
        st.ball.vz = vz;
      },
    };
  }

  /* ------------------------------ ice-cream cart ------------------------------ */

  const PRICE = 2;

  /** The cart: a white box on two wheels with a striped umbrella and a little tray. */
  function cartMesh() {
    const g = new THREE.Group();
    const std = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.65 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.75), std(0xfdfaf0));
    box.position.y = 0.75;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.14, 0.77), std(0xe8453c));
    stripe.position.y = 0.95;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), std(0x8a8f99));
    pole.position.y = 1.9;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.38, 8), std(0xf6c945));
    roof.position.y = 2.55;
    g.add(box, stripe, pole, roof);
    [-0.45, 0.45].forEach(function (x) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14), std(0x2b2b30));
      w.rotation.z = Math.PI / 2;
      w.position.set(x * 1.4, 0.28, 0);
      g.add(w);
    });
    g.traverse((o) => (o.castShadow = o.isMesh));
    return g;
  }

  /** Find a start point 12-18 m beyond `to` (seen from the hero) with a clear way to it. */
  function cartFrom(st, to) {
    const world = st.env.world();
    const hero = st.env.hero();
    const base = Math.atan2(to.x - hero.x, to.z - hero.z);
    const offs = [0, 0.6, -0.6, 1.2, -1.2, 2];
    for (let i = 0; i < offs.length; i += 1) {
      const x = to.x + Math.sin(base + offs[i]) * 15;
      const z = to.z + Math.cos(base + offs[i]) * 15;
      if (G.CrowdZones.segmentClear(world, x, z, to.x, to.z, 0.7)) return { x, z };
    }
    return null;
  }

  /** The cart and its seller appear down the lane, ringing the bell, and roll up to the hero. */
  function icecreamStart(st) {
    const env = st.env;
    const to = env.spot(5, 9, 1.4, true);
    if (!to) return false;
    st.to = to;
    st.from = cartFrom(st, to) || to;
    st.cart = env.mesh(cartMesh());
    st.pos = { x: st.from.x, z: st.from.z };
    st.cart.position.set(st.pos.x, env.world().heightAt(st.pos.x, st.pos.z), st.pos.z);
    st.seller = env.actor("ev_seller", st.pos.x + 1.3, st.pos.z, 0);
    st.phase = "arrive";
    env.chip("Ice-cream cart! Listen for the bell.");
    env.sound("ring");
    return true;
  }

  /** Roll the cart toward a point at `speed`; true on arrival. The seller walks beside it. */
  function rollCart(st, tx, tz, speed, dt) {
    const dx = tx - st.pos.x;
    const dz = tz - st.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.15) {
      const step = Math.min(d, speed * dt);
      st.pos.x += (dx / d) * step;
      st.pos.z += (dz / d) * step;
      st.cart.rotation.y = U.dampAngle(st.cart.rotation.y, Math.atan2(dx, dz) + Math.PI / 2, 6, dt);
    }
    st.cart.position.set(st.pos.x, st.env.world().heightAt(st.pos.x, st.pos.z), st.pos.z);
    G.Actors.walkTo(st.seller, st.pos.x + 1.3, st.pos.z + 0.3, 3);
    return d <= 0.15;
  }

  /** One step: arrive ringing, serve, then roll away near the end. */
  function icecreamUpdate(st, dt) {
    const env = st.env;
    st.bell -= dt;
    const leaving = secsOf("icecream") - env.now() < 10;
    if (leaving && st.phase !== "leave") {
      st.phase = "leave";
      env.say(st.seller.id, "Bye bye! Aiskrim!", 0, 2.6);
    }
    if (st.phase === "arrive" && rollCart(st, st.to.x, st.to.z, 2.1, dt)) st.phase = "serve";
    else if (st.phase === "leave") rollCart(st, st.from.x, st.from.z, 2.1, dt);
    if (st.phase !== "serve") G.Actors.stand(st.seller, "idle");
    if (st.phase === "serve") serveBubble(st, dt);
    if (st.bell <= 0 && st.phase !== "serve") {
      env.sound("ring");
      st.bell = 2.4;
    }
    return null;
  }

  /** While serving the seller faces the hero and calls out now and then. */
  function serveBubble(st, dt) {
    const hero = st.env.hero();
    G.Actors.face(st.seller, hero.x, hero.z, dt);
    G.Actors.stand(st.seller, "wave");
    st.call -= dt;
    if (st.call > 0) return;
    st.call = 9;
    st.env.say(st.seller.id, st.sold ? "Enjoy! Sedap!" : "Ice cream! Kacang putih!", 0, 2.8);
    st.env.sound("ring");
  }

  /** Buy an ice cream: 2 coins, a little food, a happy pose. Never forced; no coins gives a kind hint. */
  function icecreamPress(st) {
    const sim = G.S.sim;
    if (!sim.economy.spend(PRICE)) {
      G.UI.toast(
        "You need " + (PRICE - sim.economy.coins) + " more coins. Try helping a neighbour!",
        "hint",
      );
      return;
    }
    if (sim.needs.canEat()) sim.needs.eat({ hunger: 12, energy: 2 });
    st.sold += 1;
    G.Audio.play("coin");
    G.UI.toast("Sedap! Ice cream. -" + PRICE + " coins", "good", 3000);
    st.env.say(st.seller.id, "Terima kasih! Enjoy!", 0, 2.6);
    G.Player.lockFor(G.S.player, 1.8, "eat"); // held for the lick, unless a prayer or rite holds the hero
    G.S.hudDirty = true;
  }

  /** The ice-cream script. */
  function icecream(env) {
    const st = { env, bell: 0, call: 1.5, sold: 0, phase: "arrive" };
    return {
      start: () => icecreamStart(st),
      update: (dt) => icecreamUpdate(st, dt),
      anchor: () => st.pos || null,
      info: () => ({
        phase: st.phase,
        sold: st.sold,
        cart: st.pos && { x: st.pos.x, z: st.pos.z },
      }),
      target(hero) {
        if (st.phase !== "serve") return null;
        const d = U.dist(hero.x, hero.z, st.pos.x, st.pos.z);
        if (d > 2.8) return null;
        const aria = "Buy an ice cream for " + PRICE + " coins";
        return {
          id: "icecream",
          label: "Ice cream",
          aria,
          x: st.pos.x,
          z: st.pos.z,
          dist: d,
          h: 2.2,
        };
      },
      press: () => icecreamPress(st),
    };
  }

  /* ------------------------------ Mimi chases a butterfly ------------------------------ */

  /** A butterfly: two yellow wings that flap (scaled in y), on a tiny body. */
  function butterflyMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd43b, side: THREE.DoubleSide });
    const wing = new THREE.PlaneGeometry(0.16, 0.12);
    const left = new THREE.Mesh(wing, mat);
    const right = new THREE.Mesh(wing, mat);
    left.position.x = -0.08;
    right.position.x = 0.08;
    g.add(left, right);
    g.userData.wings = [left, right];
    return g;
  }

  /** Mimi, a butterfly, and a clear patch of ground near the hero. */
  function catStart(st) {
    const env = st.env;
    const at = env.spot(6, 12, 3.2) || env.spot(5, 14, 2, true);
    if (!at) return false;
    st.c = at;
    st.cat = env.mesh(G.Collectibles.catMesh());
    st.cat.position.set(at.x, env.world().heightAt(at.x, at.z), at.z);
    st.cx = at.x;
    st.cz = at.z;
    st.fly = env.mesh(butterflyMesh());
    G.Greetings.setActor("ev_cat", () => ({ x: st.cx, y: st.cat.position.y, z: st.cz, head: 0.6 }));
    env.say("ev_cat", "Meow!", 0.5, 2.4);
    env.chip("Mimi is chasing a butterfly!");
    return true;
  }

  /** The butterfly loops over the patch; Mimi runs after its shadow, hopping. */
  function catUpdate(st, dt) {
    const t = st.env.now();
    const w = st.env.world();
    const bx = st.c.x + Math.cos(t * 0.8) * 3.2;
    const bz = st.c.z + Math.sin(t * 1.1) * 2.6;
    st.fly.position.set(bx, w.heightAt(bx, bz) + 1.1 + Math.sin(t * 2.3) * 0.35, bz);
    const flap = 0.4 + Math.abs(Math.sin(t * 22)) * 0.9;
    st.fly.userData.wings.forEach((m) => m.scale.set(1, flap, 1));
    st.fly.rotation.y = t * 0.8;
    chaseButterfly(st, bx, bz, dt);
    st.cat.userData.tail.rotation.z = Math.sin(t * 6) * 0.45;
    return null;
  }

  /** Mimi trots toward (x, z), slows to sit when she catches up, and hops while running. */
  function chaseButterfly(st, x, z, dt) {
    const hold = st.pet > 0;
    st.pet -= dt;
    const dx = x - st.cx;
    const dz = z - st.cz;
    const d = Math.hypot(dx, dz);
    if (d > 0.5 && !hold) {
      const step = Math.min(d, 2.6 * dt);
      const nx = st.cx + (dx / d) * step;
      const nz = st.cz + (dz / d) * step;
      if (!G.Collide.blockedAt(st.env.world().colliders, nx, nz, 0.2)) {
        st.cx = nx;
        st.cz = nz;
      }
      st.cat.rotation.y = U.dampAngle(st.cat.rotation.y, Math.atan2(dx, dz), 10, dt);
    }
    const hop = d > 0.5 && !hold ? Math.abs(Math.sin(st.env.now() * 9)) * 0.12 : 0;
    st.cat.position.set(st.cx, st.env.world().heightAt(st.cx, st.cz) + hop, st.cz);
  }

  /** Pet Mimi: she purrs, stays still a moment, and the first pat is worth a coin. */
  function catPress(st) {
    st.pet = 2.5;
    st.env.say("ev_cat", "Purr purr!", 0, 2.4);
    st.env.sound("good");
    G.Hi.noteTalk();
    if (!st.petted) {
      st.petted = true;
      st.env.reward({ coins: 1, text: "Mimi likes you!" });
    }
  }

  /** The cat-chase script. */
  function catchase(env) {
    const st = { env, c: null, pet: 0, petted: false, cx: 0, cz: 0 };
    return {
      start: () => catStart(st),
      update: (dt) => catUpdate(st, dt),
      end: () => G.Greetings.setActor("ev_cat", null),
      anchor: () => ({ x: st.cx, z: st.cz }),
      info: () => ({ petted: st.petted }),
      target(hero) {
        const d = U.dist(hero.x, hero.z, st.cx, st.cz);
        if (d > 2.2) return null;
        return {
          id: "mimi",
          label: "Pet",
          aria: "Pet Mimi the cat",
          x: st.cx,
          z: st.cz,
          dist: d,
          h: 0.8,
        };
      },
      press: () => catPress(st),
    };
  }

  G.WorldEvents.SCRIPTS.football = football;
  G.WorldEvents.SCRIPTS.icecream = icecream;
  G.WorldEvents.SCRIPTS.catchase = catchase;
})((window.KQ = window.KQ || {}));
