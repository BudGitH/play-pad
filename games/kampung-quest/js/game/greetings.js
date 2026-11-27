/* ============================================================================
 * FILE: greetings.js
 * PURPOSE: Citizens say salaam as they pass: a small speech bubble ("Assalamualaikum!") over one
 *          walker and the reply ("Waalaikumsalam!") over the other, for cast neighbours and the
 *          crowd's strollers alike, and a neighbour who passes the hero greets the hero (the
 *          hero's reply shows over the hero). A standing cast neighbour also raises a hand.
 * BUSINESS CONTEXT: Owner request "citizens say salaam when their paths cross". Cost: bubbles are
 *   a handful of DOM nodes (at most six, pooled) placed from the camera projection, so the draw-call
 *   budget is untouched; extras get a bubble only (no pose: the crowd's poses are baked banks).
 *   The decisions (pairing, chance, cooldowns, caps, who may say salaam) are pure, in
 *   js/sim/greet.js. A bubble is a caption, not a talk: extras stay not talkable.
 * DEPENDENCIES: util.js, npc-manager.js (cast, wave), crowd.js (strollers), ui-core.js (modal
 *   state), settings.js, KQ.Sim.Greet. Text enters the DOM only through textContent.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  /** Seconds between looks at who is passing whom (a pass lasts a second or more). */
  const TICK = 0.2;
  /** Two bubbles per greeting, three greetings at once. */
  const MAX_BUBBLES = 6;
  /** Metres from the ground to the top of a head: the toy hero, a cast neighbour, a crowd adult / kid. */
  const HEAD = { hero: 1.0, cast: 1.7, adult: 1.65, kid: 1.25 };
  /** The gap the bubble floats above a head, and the least height on screen (clear of the HUD top). */
  const FLOAT = 0.35;
  const TOP_PX = 96;
  /** The hero is moving when faster than this (m/s). */
  const HERO_MOVING = 0.3;
  /** A standing neighbour raises a hand for this long after a greeting. */
  const WAVE_SECONDS = 1.8;
  const FADE = 0.4;
  const LAYER_CSS = "position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden;";
  const BUBBLE_CSS =
    "position:absolute;left:0;top:0;padding:6px 12px;border-radius:14px;color:#15151c;" +
    "font:700 14px/1.2 system-ui,sans-serif;white-space:nowrap;opacity:0;will-change:transform;" +
    "box-shadow:0 2px 8px rgba(0,0,0,0.28);";
  const TAIL_CSS =
    "position:absolute;left:50%;bottom:-5px;width:10px;height:10px;background:inherit;" +
    "border-radius:2px;transform:translateX(-50%) rotate(45deg);";
  const CITIZEN_BG = "#fffdf7";
  const HERO_BG = "#ffe9a8";
  const tmp = new THREE.Vector3();

  /** The greeting state (created on first use, once the game root exists). */
  function ensure(s) {
    if (s.greet) return s.greet;
    const layer = U.el("div", { cls: "kq-greet-layer", style: LAYER_CSS, "aria-hidden": "true" });
    s.root.insertBefore(layer, s.hudHost);
    s.greet = {
      greeter: KQ.Sim.Greet.create(U.rng(U.hash("kq-greetings"))),
      layer,
      now: 0,
      accT: 0,
      bubbles: [],
      pool: [],
    };
    return s.greet;
  }

  /** Is this cast agent standing or walking free (not seated, praying, cooking, talking or hidden)? */
  function castFree(A) {
    const g = A.goal;
    const held = Boolean(g && (g.kind === "sit" || g.kind === "pray")) || A.cook;
    return !A.hidden && A.group.visible && !A.talking && !held && A.show > 0.8;
  }

  /** The hero's friendly kind of person for a cast agent (greet.js reads these fields). */
  function castPerson(A) {
    return {
      id: A.id,
      x: A.x,
      z: A.z,
      heading: A.heading,
      state: A.path.length > 0 && A.speed > 0.1 ? "walk" : "stand",
      muslim: KQ.Sim.NPC_PROFILE[A.id].muslim,
      group: A.id,
      y: A.y,
    };
  }

  /** A walking (or lingering) crowd stroller as a person; friends walking as a pair share a group. */
  function strollerPerson(m) {
    return {
      id: m.id,
      x: m.x,
      z: m.z,
      heading: m.heading,
      state: m.linger > 0 || m.path.length === 0 ? "stand" : "walk",
      muslim: Boolean(m.outfit && m.outfit.group === "malay"),
      group: m.id.replace(/b$/, ""),
      y: m.y,
    };
  }

  /** Is the point (x, y + 1.5, z) inside the camera's view? */
  function onScreen(camera, p) {
    tmp.set(p.x, p.y + 1.5, p.z).project(camera);
    return tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
  }

  /** Everyone near the hero who could greet and is on screen: free cast neighbours and strollers. */
  function collect(s, hero) {
    const near = 26 * 26;
    const list = [];
    const take = (p) => {
      if (U.dist2(p.x, p.z, hero.x, hero.z) <= near && onScreen(s.camera, p)) list.push(p);
    };
    s.npcs.agents.filter(castFree).forEach((A) => take(castPerson(A)));
    s.crowd.members
      .filter((m) => m.walker && !m.leaving && m.show > 0.8)
      .forEach((m) => take(strollerPerson(m)));
    return list;
  }

  /** A bubble element from the pool (or a new one), or null at the cap. */
  function takeEl(st) {
    const free = st.pool.pop();
    if (free) return free;
    if (st.bubbles.length >= MAX_BUBBLES) return null;
    const text = U.el("span", { style: "position:relative;" });
    const tail = U.el("i", { style: TAIL_CSS });
    const el = U.el("div", { cls: "kq-greet", style: BUBBLE_CSS }, tail, text);
    el.hidden = true;
    st.layer.appendChild(el);
    return { el, text };
  }

  /** Queue one bubble: who it sits over, what it says, when it shows and for how long. */
  function queue(st, who, text, from, secs) {
    const node = takeEl(st);
    if (!node) return;
    node.text.textContent = text;
    node.el.style.background = who === KQ.Sim.Greet.HERO ? HERO_BG : CITIZEN_BG;
    st.bubbles.push({ node, who, text, from, until: from + secs, started: false });
  }

  /** Show a started greeting: the first bubble now, the reply a moment later. */
  function show(st, ev) {
    const secs = KQ.Sim.Greet.CONFIG.bubbleSeconds;
    queue(st, ev.from, ev.text, ev.at, secs);
    queue(st, ev.to, ev.replyText, ev.replyAt, secs);
  }

  /** Where a bubble's owner is, as {x, y, z, head} (y = the ground, head = height of the head), or null once they are gone. */
  function whereIs(s, who) {
    if (who === KQ.Sim.Greet.HERO) {
      const p = s.player.pos;
      return { x: p.x, y: p.y, z: p.z, head: HEAD.hero };
    }
    const A = s.npcs.byId[who];
    if (A) return A.hidden ? null : { x: A.x, y: A.y, z: A.z, head: HEAD.cast };
    const m = s.crowd.byId.get(who);
    if (!m || m.leaving) return null;
    return { x: m.x, y: m.y, z: m.z, head: m.kid ? HEAD.kid : HEAD.adult };
  }

  /** The first time a bubble shows over a standing cast neighbour, they raise a hand. */
  function startBubble(s, b) {
    b.started = true;
    const A = s.npcs.byId[b.who];
    if (A) G.Npcs.wave(A, WAVE_SECONDS);
  }

  /** Put one bubble over its owner (or hide it when it is not time, they are gone or off screen). */
  function place(s, st, b) {
    const el = b.node.el;
    const at = st.now >= b.from ? whereIs(s, b.who) : null;
    if (at && !b.started) startBubble(s, b);
    if (!at) {
      el.hidden = true;
      return;
    }
    tmp.set(at.x, at.y + at.head + FLOAT, at.z).project(s.camera);
    const out = tmp.z > 1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1;
    el.hidden = out;
    if (out) return;
    const px = (tmp.x * 0.5 + 0.5) * s.size.w;
    const py = Math.max(TOP_PX, (-tmp.y * 0.5 + 0.5) * s.size.h);
    el.style.transform =
      "translate(" + px.toFixed(1) + "px," + py.toFixed(1) + "px) translate(-50%,-100%)";
    el.style.opacity = String(U.clamp((b.until - st.now) / FADE, 0, 1));
  }

  /** Place every live bubble and retire the finished (or ownerless) ones. */
  function placeAll(s, st) {
    st.bubbles = st.bubbles.filter(function (b) {
      const done = st.now >= b.until || (b.started && !whereIs(s, b.who));
      if (done) {
        b.node.el.hidden = true;
        st.pool.push(b.node);
      } else place(s, st, b);
      return !done;
    });
  }

  /** Look at who is passing whom and start any new greeting. */
  function tick(s, st, P) {
    if (G.UI.modalOpen() || G.PrayerFlow.screenOpen()) return;
    const hero = { x: P.pos.x, z: P.pos.z, moving: P.speed > HERO_MOVING };
    st.greeter.update(st.now, collect(s, hero), hero).forEach((ev) => show(st, ev));
  }

  /**
   * Per-step update: every TICK seconds decide on new greetings, every step place the bubbles.
   * @param s the game state; dt seconds; P the hero (pos, speed).
   */
  function update(s, dt, P) {
    const st = ensure(s);
    st.now += dt;
    st.layer.hidden = G.UI.modalOpen();
    st.accT += dt;
    if (st.accT >= TICK) {
      st.accT = 0;
      tick(s, st, P);
    }
    placeAll(s, st);
  }

  /** Counts and the visible bubbles, for tests (greeting total, who says what right now). */
  function debug() {
    const st = G.S && G.S.greet;
    if (!st) return { total: 0, showing: [], visible: 0 };
    const showing = st.bubbles
      .filter((b) => st.now >= b.from && !b.node.el.hidden)
      .map((b) => ({ who: b.who, text: b.text }));
    return { total: st.greeter.count(), showing, visible: showing.length };
  }

  /**
   * Force the chance of every greeting roll (tests), or null for the normal chances. Returns false
   * (and changes nothing) before the game state exists or for a value that is not a finite number.
   */
  function setChance(p) {
    if (!G.S) return false;
    const reset = p === null || p === undefined;
    if (!reset && !Number.isFinite(Number(p))) return false;
    ensure(G.S).greeter.setChance(reset ? null : Number(p));
    return true;
  }

  G.Greetings = { update, debug, setChance, TICK };
})((window.KQ = window.KQ || {}));
