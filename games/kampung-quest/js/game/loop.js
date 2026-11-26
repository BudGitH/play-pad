/* ============================================================================
 * FILE: loop.js
 * PURPOSE: The main loop: one frame = sim step (clock, needs, prayer events, hero, NPCs, camera,
 *          markers, HUD), render, plus resize, quality tiers with auto-downgrade, autosave and
 *          the pause / hidden-tab lifecycle.
 * BUSINESS CONTEXT: AC-6 (48-minute day; the sun follows Syuruk / Maghrib), AC-13 (autosave every
 *   10 s and when the tab hides), AC-14 (quality tiers, auto-downgrade under 40 fps), AC-16 (a
 *   hidden tab or the pause dialog stops the sim and all sound).
 * LEARNING (docs/LEARNINGS.md 2026-11-21): the pause / hidden gate sits where time and sound are
 *   produced (frame() and Audio.voice()), not in the callers.
 * DEPENDENCIES: everything else in js/game. State lives in KQ.Game.S.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  const FLOW_RATE = 0.25;
  const TIERS = ["low", "med", "high"];
  const SKY = { rise: 425, set: 1145 };

  /** Map the game clock onto the sky's 07:05 / 19:05 anchors so the sun follows Syuruk / Maghrib. */
  function skyMinute(m) {
    const parse = KQ.Sim.Clock.parseHHMM;
    const rise = parse(KQ.PRAYER_TIMES.syuruk);
    const set = parse(KQ.PRAYER_TIMES.maghrib);
    if (m < rise) return (m * SKY.rise) / rise;
    if (m < set) return SKY.rise + ((m - rise) * (SKY.set - SKY.rise)) / (set - rise);
    return SKY.set + ((m - set) * (1440 - SKY.set)) / (1440 - set);
  }

  function scheduleTimers(dt) {
    const s = S();
    s.t += dt;
    const due = s.timers.filter((x) => s.t >= x.at);
    s.timers = s.timers.filter((x) => s.t < x.at);
    due.forEach((x) => x.fn());
  }

  function stepSim(dt) {
    const s = S();
    const sim = s.sim;
    const slow = G.PrayerFlow.screenOpen() || sim.prayer.state().flow ? FLOW_RATE : 1;
    sim.clock.tick(dt * slow);
    sim.needs.tick((dt * slow) / sim.clock.realSecPerGameMin);
    const events = sim.prayer.update(sim.clock.minute, sim.clock.day);
    if (events.length) {
      G.PrayerFlow.onEvents(events);
      G.Npcs.invalidate(s.npcs);
      s.hudDirty = true;
    }
    scheduleTimers(dt);
  }

  function stepActors(dt) {
    const s = S();
    const P = s.player;
    const free = !G.UI.modalOpen() && !s.paused;
    const move = free ? G.Input.move() : { x: 0, y: 0, mag: 0, run: false };
    G.Player.update(P, dt, move, {
      yaw: G.Camera.state.yaw,
      speedFactor: s.sim.needs.speedFactor(),
      colliders: s.world.colliders,
      heightAt: s.world.heightAt,
      audio: G.Audio,
    });
    G.Npcs.update(s.npcs, dt, { x: P.pos.x, z: P.pos.z });
    G.Collectibles.updateCat(s.collect, dt, P, s.t);
    G.Camera.update(dt, {
      pos: P.pos,
      heading: P.heading,
      move,
      groundY: P.pos.y,
      colliders: s.world.colliders,
    });
    return move;
  }

  function stepUi(dt) {
    const s = S();
    s.uiT += dt;
    const target = G.Interact.find();
    s.target = target;
    G.Interact.place(target, s.camera, s.size.w, s.size.h);
    G.PrayerFlow.update(dt);
    if (s.uiT >= 0.12 || s.hudDirty) {
      s.uiT = 0;
      s.hudDirty = false;
      G.HudView.update(s.sim, G.Audio.isMuted());
      refreshMarkers();
      G.Collectibles.sync(s.collect, s.sim.missions.progress(), s.sim.missions.isPausedNow());
      G.MissionFlow.syncStars();
      G.MissionFlow.checkGoto();
      drawMinimap();
    }
  }

  function refreshMarkers() {
    const s = S();
    const pf = G.PrayerFlow.state;
    const mosque = pf.guide && pf.guideDest ? s.world.pois[pf.guideDest].pos : null;
    s.markerView = {
      mission: G.MissionFlow.targetPos(),
      mosque: mosque && { x: mosque.x, z: mosque.z },
      reduced: G.Settings.reduced(),
    };
  }

  function mapMarkers() {
    const s = S();
    const out = [];
    const t = G.MissionFlow.targetPos();
    if (t) out.push({ x: t.x, z: t.z, color: "#ff6b85", big: true });
    const ps = s.sim.prayer.state();
    if (ps.due || ps.flow || ps.qada.length) {
      const m = s.world.pois.mosque_gate.pos;
      out.push({ x: m.x, z: m.z, color: "#30d158", big: Boolean(ps.due || ps.flow) });
    }
    const hk = s.world.pois.hawker.pos;
    const home = s.world.pois.home.pos;
    out.push({ x: hk.x, z: hk.z, color: "#ff9f0a" }, { x: home.x, z: home.z, color: "#f4a8b8" });
    return out;
  }

  function mapView(span) {
    const s = S();
    const P = s.player;
    return {
      cx: P.pos.x,
      cz: P.pos.z,
      span,
      hero: { x: P.pos.x, z: P.pos.z },
      heading: P.heading,
      markers: mapMarkers(),
    };
  }

  function drawMinimap() {
    const R = G.Hud.refs;
    G.Minimap.draw(R.canvas.getContext("2d"), R.canvas.width, mapView(70), true);
  }

  /** Give every figure the small studio reflection from the showcase (glossy toy plastic). */
  function studioShine(s) {
    const env = KQ.Figures.makeEnv(s.renderer);
    s.figureMats = [s.player.rig.material].concat(s.npcs.agents.map((a) => a.rig.material));
    s.figureMats.forEach(function (m) {
      m.envMap = env;
      m.needsUpdate = true;
    });
  }

  function shineFor(s) {
    const k = 0.9 * (1 - 0.6 * s.world.night());
    s.figureMats.forEach((m) => (m.envMapIntensity = k));
  }

  function renderFrame(dt) {
    const s = S();
    const P = s.player;
    shineFor(s);
    s.world.setShadowTarget(P.pos);
    s.world.update(dt, { minute: skyMinute(s.sim.clock.minute) });
    G.Markers.update(s.markers, dt, s.markerView || { reduced: false });
    s.renderer.render(s.scene, s.camera);
    s.frames += 1;
  }

  /** One full frame of the running game. `dt` in seconds. */
  function frame(dt, skipRender) {
    const s = S();
    if (!s.started) return;
    if (s.paused || s.hidden) {
      if (!skipRender) renderFrame(0);
      return;
    }
    stepSim(dt);
    stepActors(dt);
    stepUi(dt);
    autosaveTick(dt);
    if (!skipRender) renderFrame(dt);
  }

  /* ------------------------------ time travel (rest, tests) ------------------------------ */

  function advanceMinutes(n, resting) {
    const sim = S().sim;
    let done = 0;
    for (let i = 0; i < n; i += 1) {
      sim.clock.tick(sim.clock.realSecPerGameMin);
      sim.needs.tick(1);
      if (resting) sim.needs.rest(1);
      done += 1;
      const events = sim.prayer.update(sim.clock.minute, sim.clock.day);
      if (events.length) G.PrayerFlow.onEvents(events);
      if (events.some((e) => e.type === "due")) break;
    }
    G.Npcs.snapAll(S().npcs);
    S().hudDirty = true;
    return done;
  }

  function setMinute(minute) {
    const sim = S().sim;
    sim.clock.set(minute);
    const events = sim.prayer.update(sim.clock.minute, sim.clock.day);
    if (events.length) G.PrayerFlow.onEvents(events);
    G.Npcs.snapAll(S().npcs);
    S().hudDirty = true;
  }

  /* ------------------------------ resize / quality ------------------------------ */

  function resize() {
    const s = S();
    if (!s.renderer) return;
    const box = s.stage.parentElement;
    const w = Math.max(2, box.clientWidth);
    const h = Math.max(2, box.clientHeight);
    const hints = s.world ? s.world.qualityHints(s.quality) : { pixelRatio: 1 };
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hints.pixelRatio));
    s.renderer.setSize(w, h, false);
    s.size = { w, h };
    G.Camera.resize(w, h, w / h);
  }

  function setQuality(tier) {
    const s = S();
    s.quality = TIERS.indexOf(tier) === -1 ? "med" : tier;
    if (s.world) s.world.setQuality(s.quality);
    s.sim.settings.quality = s.quality;
    resize();
  }

  /** Track real frame time; drop one tier when the frame rate stays under 40 fps. */
  function monitor(realDt) {
    const s = S();
    if (!s.started || s.paused || s.hidden || s.frozen || !G.Settings.prefs.autoQuality || !s.autoQ)
      return;
    s.avgDt = U.lerp(s.avgDt, Math.min(realDt, 0.25), 0.05);
    s.slowT = s.avgDt > 1 / 40 ? s.slowT + realDt : 0;
    if (s.slowT < 3) return;
    s.slowT = 0;
    const i = TIERS.indexOf(s.quality);
    if (i > 0) {
      setQuality(TIERS[i - 1]);
      s.downgrades += 1;
    }
  }

  /* ------------------------------ save ------------------------------ */

  function save() {
    const s = S();
    if (!s.started || !s.storage) return false;
    const state = G.Sim.capture(s.sim, { x: s.player.pos.x, z: s.player.pos.z });
    const res = KQ.Sim.Save.save(s.storage, state);
    if (!res.ok && !s.saveWarned) {
      s.saveWarned = true;
      G.UI.toast("Playing without saving. This browser blocks storage.", "hint", 6000);
    }
    return res.ok;
  }

  function autosaveTick(dt) {
    const s = S();
    s.saveT += dt;
    if (s.saveT < 10) return;
    s.saveT = 0;
    save();
  }

  /* ------------------------------ lifecycle ------------------------------ */

  function setPaused(value) {
    const s = S();
    s.paused = Boolean(value);
    G.Audio.setPaused(s.paused);
    if (s.paused) {
      G.Speech.cancel();
      save();
    }
  }

  function onVisibility() {
    const s = S();
    s.hidden = document.hidden;
    G.Audio.setHidden(s.hidden);
    if (s.hidden) {
      G.Speech.cancel();
      save();
    }
    s.last = performance.now();
  }

  function raf(ts) {
    const s = S();
    requestAnimationFrame(raf);
    const real = Math.min(0.1, Math.max(0, (ts - s.last) / 1000));
    s.last = ts;
    if (s.frozen) return;
    monitor(real);
    frame(real);
  }

  function start() {
    const s = S();
    s.last = performance.now();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);
    requestAnimationFrame(raf);
  }

  /** Deterministic advance for tests / probes: `ms` of game-loop time in 1/30 s steps. */
  function step(ms) {
    const n = Math.max(1, Math.round(ms / 33.3));
    for (let i = 0; i < n; i += 1) frame(1 / 30, i < n - 1);
    return n;
  }

  G.Loop = {
    studioShine,
    start,
    frame,
    step,
    advanceMinutes,
    setMinute,
    resize,
    setQuality,
    save,
    setPaused,
    onVisibility,
    skyMinute,
    mapView,
  };
})((window.KQ = window.KQ || {}));
