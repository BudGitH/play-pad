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
  /** One sim step is at most this long (collision / pathing stay stable); longer frames are sub-stepped. */
  const MAX_STEP = 0.1;
  /** A frame that took longer than this is caught up by at most this much game time (AC-6 on slow devices). */
  const MAX_CATCHUP = 3;
  /** Real seconds under 40 fps before the quality drops a tier; a single frame longer than STALL is ignored. */
  const SLOW_SECONDS = 3;
  const STALL = 2.5;
  /** Low tier: only the hero and this many nearest neighbours cast a shadow (PERF-02). */
  const NEAR_SHADOWS = 3;

  /** Advance the game timer and run the callbacks (S.after) that have come due. */
  function scheduleTimers(dt) {
    const s = S();
    s.t += dt;
    const due = s.timers.filter((x) => s.t >= x.at);
    s.timers = s.timers.filter((x) => s.t < x.at);
    due.forEach((x) => x.fn());
  }

  /** One sim step: tick the clock (slowed during a prayer flow), the needs and the prayer tracker, and fire its events. */
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

  /** What the crowd needs to know about the moment: the clock minute, quality tier and how dark it is. */
  function crowdContext(s) {
    return { minute: s.sim.clock.minute, tier: s.quality, night: s.world.night() };
  }

  /** Move the hero from input (blocked while a menu is open), then the NPCs, Mimi the cat and the camera by dt. */
  function stepActors(dt) {
    const s = S();
    const P = s.player;
    G.RitualFlow.update(dt); // auto-walk and the walked-round counter move the hero before the usual step
    const free = !G.UI.modalOpen() && !s.paused;
    const move = free ? G.Input.move() : { x: 0, y: 0, mag: 0, run: false };
    const driving = G.Vehicles.update(dt, move, free);
    const riding = G.Mounts.update(dt, move, free && !driving); // camels, horses, ponies (AC-P5..P7)
    if (!driving && !riding) {
      G.Player.update(P, dt, move, {
        yaw: G.Camera.state.yaw,
        speedFactor: s.sim.needs.speedFactor(),
        colliders: s.world.colliders,
        heightAt: s.world.heightAt,
        audio: G.Audio,
      });
    }
    G.Npcs.update(s.npcs, dt, P.pos);
    G.Collide.settle(s.world.colliders, P.pos, G.Player.RADIUS);
    G.Player.sync(P);
    G.Collectibles.updateCat(s.collect, dt, P, s.t);
    G.Camera.update(dt, {
      pos: P.pos,
      heading: P.heading,
      move,
      groundY: P.pos.y,
      colliders: s.world.colliders,
    });
    G.Crowd.update(s.crowd, dt, { x: P.pos.x, z: P.pos.z }, crowdContext(s));
    G.Greetings.update(s, dt, P);
    G.Hi.update(dt, P.pos);
    G.WorldEvents.update(dt);
    G.MissionSteps.update(dt);
    G.Voice.update(dt);
    return move;
  }

  /** Refresh the interaction target, HUD and prayer guide on a slower cadence than the frame. */
  function stepUi(dt) {
    const s = S();
    s.uiT += dt;
    const target = G.Interact.find();
    s.target = target;
    G.Interact.place(target, s.camera, s.size.w, s.size.h);
    G.PrayerFlow.update(dt);
    G.Nudge.update(dt);
    if (s.uiT >= 0.12 || s.hudDirty) {
      s.uiT = 0;
      s.hudDirty = false;
      G.HudView.update(s.sim, G.Audio.isMuted());
      G.MapTarget.check(s);
      refreshMarkers();
      G.Collectibles.sync(s.collect, s.sim.missions.progress(), s.sim.missions.isPausedNow());
      G.MissionFlow.syncStars();
      G.MissionFlow.checkGoto();
      drawMinimap();
      G.BigMap.refresh();
    }
  }

  /** Place the world beacons (mission step, mosque guide) from the current targets. */
  function refreshMarkers() {
    const s = S();
    const pf = G.PrayerFlow.state;
    const mosque = pf.guide && pf.guideDest ? s.world.pois[pf.guideDest].pos : null;
    s.markerView = {
      mission: G.MissionFlow.targetPos(),
      mosque: mosque && { x: mosque.x, z: mosque.z },
      food: G.Nudge.markerPos(),
      goto: G.MapTarget.pos(s),
      reduced: G.Settings.reduced(),
    };
    if (s.markerView.goto)
      s.markerView.gotoY = s.world.heightAt(s.markerView.goto.x, s.markerView.goto.z);
  }

  /** What the radar / map draws for a span in metres: centred on the hero, with heading and blips (map-markers.js). `opts`: { rotate, labels }. */
  function mapView(span, opts) {
    const s = S();
    const P = s.player;
    return Object.assign(
      {
        cx: P.pos.x,
        cz: P.pos.z,
        span,
        hero: { x: P.pos.x, z: P.pos.z },
        heading: P.heading,
        markers: G.MapMarkers.build(s),
      },
      opts || {},
    );
  }

  /** Draw the radar onto the HUD canvas: round, turning with the hero. */
  function drawMinimap() {
    const R = G.Hud.refs;
    const view = mapView(G.Minimap.radarSpan(), { rotate: true });
    G.Minimap.draw(R.canvas.getContext("2d"), R.canvas.width, view, true);
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

  /** Scale the figures' studio reflection down at night (to 40 %) so the toy plastic does not glow in the dark. */
  function shineFor(s) {
    const k = 0.9 * (1 - 0.6 * s.world.night());
    s.figureMats.forEach((m) => (m.envMapIntensity = k));
  }

  /** Every mesh under a figure, remembered with its current castShadow state. */
  function shadowRigs(s) {
    if (!s.shadowRigs) {
      const rigOf = (group) => {
        const meshes = [];
        group.traverse((o) => o.isMesh && meshes.push(o));
        return { meshes, cast: true };
      };
      s.shadowRigs = {
        hero: rigOf(s.player.group),
        npcs: s.npcs.agents.map((a) => rigOf(a.group)),
      };
    }
    return s.shadowRigs;
  }

  /** Turn shadow casting on or off for a whole figure, only touching meshes when it changes. */
  function setCast(rig, on) {
    if (rig.cast === on) return;
    rig.cast = on;
    rig.meshes.forEach((m) => (m.castShadow = on));
  }

  /**
   * Low tier: the sun's shadow pass redraws every casting mesh, and a toy figure is 14 meshes, so
   * only the hero and the NEAR_SHADOWS closest visible neighbours cast one. Other tiers: all do.
   */
  function figureShadows(s) {
    const rigs = shadowRigs(s);
    const P = s.player.pos;
    const near = new Set();
    if (s.quality === "low") {
      s.npcs.agents
        .map((a, i) => ({ i, d: a.hidden ? Infinity : (a.x - P.x) ** 2 + (a.z - P.z) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, NEAR_SHADOWS)
        .forEach((e) => near.add(e.i));
    }
    setCast(rigs.hero, true);
    rigs.npcs.forEach((r, i) => setCast(r, s.quality !== "low" || near.has(i)));
  }

  /**
   * three resets `info` after the shadow pass, so by default `info.render.calls` misses it (PERF-02).
   * Resetting by hand just before render() makes `stats().calls` / `tris` the whole frame:
   * shadow pass + main pass.
   */
  function countDrawCalls(renderer) {
    renderer.info.autoReset = false;
    renderer.info.reset();
  }

  /** Draw one frame: refresh the shadow casters (every 10th frame), the sun's shadow target, world time and markers, then render. */
  function renderFrame(dt) {
    const s = S();
    const P = s.player;
    if (s.frames % 10 === 0) figureShadows(s);
    shineFor(s);
    s.world.setShadowTarget(P.pos);
    s.world.update(dt, { minute: s.sim.clock.minute });
    G.Markers.update(s.markers, dt, s.markerView || { reduced: false });
    countDrawCalls(s.renderer);
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
    G.Ambience.update(dt); // atmosphere (ambience.js); gated here with the rest of the frame
    if (!skipRender) renderFrame(dt);
  }

  /**
   * Advance by `real` seconds of wall time (one rAF). The simulation runs in steps of at most
   * MAX_STEP and the last step draws, so a slow device keeps real-time pace: a game day stays 48
   * real minutes (AC-6) instead of stretching when frames take longer than 0.1 s.
   */
  function advance(real) {
    const s = S();
    let left = Math.min(real, MAX_CATCHUP);
    while (left > MAX_STEP && s.started && !s.paused && !s.hidden) {
      stepSim(MAX_STEP);
      stepActors(MAX_STEP);
      s.saveT += MAX_STEP;
      left -= MAX_STEP;
    }
    frame(Math.min(left, MAX_STEP), false);
  }

  /* ------------------------------ time travel (rest, tests) ------------------------------ */

  /**
   * Skip forward up to n game minutes, one at a time so needs and prayer events still run (stops
   * early when a prayer falls due); returns the minutes advanced.
   */
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

  /** Jump the clock to a minute (test hook): the prayer tracker follows and NPCs snap to their new places. */
  function setMinute(minute) {
    const sim = S().sim;
    sim.clock.set(minute);
    const events = sim.prayer.update(sim.clock.minute, sim.clock.day);
    if (events.length) G.PrayerFlow.onEvents(events);
    G.Npcs.snapAll(S().npcs);
    S().hudDirty = true;
  }

  /* ------------------------------ resize / quality ------------------------------ */

  /**
   * Fit the renderer, camera and pixel ratio to the stage size (the ratio is capped by the quality
   * tier and on touch).
   */
  function resize() {
    const s = S();
    if (!s.renderer) return;
    const box = s.stage.parentElement;
    const w = Math.max(2, box.clientWidth);
    const h = Math.max(2, box.clientHeight);
    const hints = s.world ? s.world.qualityHints(s.quality) : { pixelRatio: 1 };
    const cap = G.Env.coarse ? Math.min(1.5, hints.pixelRatio) : hints.pixelRatio;
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    s.renderer.setSize(w, h, false);
    s.size = { w, h };
    G.Camera.resize(w, h, w / h);
  }

  /**
   * Switch tier. `auto` (the frame-rate monitor) does not overwrite the saved choice, so one
   * transient stall never pins the game to a lower tier for good; a manual pick is saved.
   */
  function setQuality(tier, auto) {
    const s = S();
    s.quality = TIERS.indexOf(tier) === -1 ? "med" : tier;
    if (s.world) s.world.setQuality(s.quality);
    if (!auto) s.sim.settings.quality = s.quality;
    s.graceT = 2;
    if (s.shadowRigs) figureShadows(s);
    resize();
  }

  /** Smoothed real frame time (always on: the `stats().fps` hook reads it). */
  function trackFps(real) {
    const s = S();
    if (!s.started || s.paused || s.hidden) return;
    s.avgDt = U.lerp(s.avgDt, Math.min(real, 2), 0.05);
  }

  /**
   * Drop one tier when the real frame rate stays under 40 fps for SLOW_SECONDS of wall time.
   * A lone stall (tab switch, a shader compile) and the 2 s after a tier change are ignored.
   */
  function monitor(real) {
    const s = S();
    if (!s.started || s.paused || s.hidden || s.frozen || !G.Settings.prefs.autoQuality || !s.autoQ)
      return;
    if (s.graceT > 0 || real > STALL) {
      s.graceT = Math.max(0, s.graceT - real);
      s.slowT = 0;
      return;
    }
    s.slowT = s.avgDt > 1 / 40 ? s.slowT + real : 0;
    if (s.slowT < SLOW_SECONDS) return;
    s.slowT = 0;
    const i = TIERS.indexOf(s.quality);
    if (i > 0) {
      setQuality(TIERS[i - 1], true);
      s.downgrades += 1;
    }
  }

  /* ------------------------------ save ------------------------------ */

  /**
   * Write the game to storage (position included) when running; warns once if the browser blocks
   * storage; returns success.
   */
  function save() {
    const s = S();
    if (!s.started || !s.storage) return false;
    const state = G.Sim.capture(s.sim, { x: s.player.pos.x, z: s.player.pos.z });
    const res = KQ.Sim.Save.save(s.storage, state);
    if (!res.ok && res.reason === "unavailable" && !s.saveWarned) {
      s.saveWarned = true;
      G.UI.toast("Playing without saving. This browser blocks storage.", "hint", 6000);
    }
    return res.ok;
  }

  /** Save every 10 s of game-loop time so a closed tab loses almost nothing. */
  function autosaveTick(dt) {
    const s = S();
    s.saveT += dt;
    if (s.saveT < 10) return;
    s.saveT = 0;
    save();
  }

  /* ------------------------------ lifecycle ------------------------------ */

  /** Pause or resume: silences audio, and on pause also stops speech and saves. */
  function setPaused(value) {
    const s = S();
    s.paused = Boolean(value);
    G.Audio.setPaused(s.paused);
    if (s.paused) {
      G.Speech.cancel();
      save();
    }
  }

  /** Mirror tab visibility into the game: a hidden tab stops sound and time and saves once. */
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

  /** The requestAnimationFrame callback: measure real time and run one frame (sub-stepped when slow). */
  function raf(ts) {
    const s = S();
    requestAnimationFrame(raf);
    const real = Math.max(0, (ts - s.last) / 1000);
    s.last = ts;
    if (s.frozen) return;
    trackFps(real);
    monitor(real);
    advance(real);
  }

  /** Resize / rotation: re-measure, re-frame an open prayer screen, keep the camera sane. */
  function onResize() {
    resize();
    if (S().started) G.PrayerFlow.refit();
  }

  /** Hook up resize, orientation, visibility and pagehide, then start the rAF loop. */
  function start() {
    const s = S();
    s.last = performance.now();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", () => setTimeout(onResize, 200));
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
    figureShadows,
    save,
    setPaused,
    onVisibility,
    mapView,
  };
})((window.KQ = window.KQ || {}));
