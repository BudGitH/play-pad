/* ============================================================================
 * FILE: hooks.js
 * PURPOSE: window.__kq - the test / probe hook (like __stride, __claw): ready, state(), step(ms),
 *          setMinute, teleport, interact, input, forcePrayer, freeze, stats, npc.
 * BUSINESS CONTEXT: Phase 2 tests and the smoke driver need a deterministic way to advance the
 *   game while headless rAF is throttled. Nothing here is used by the game itself.
 * DEPENDENCIES: everything in js/game.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const S = () => G.S;
  /** Minutes behind the clock that count as "going back" for forcePrayer (above the tracker's 1-min slack). */
  const REWIND_MARGIN = 1.1;

  /** Has the player pressed Start? Every hook that needs a live game checks this first. */
  function started() {
    return Boolean(S() && S().started);
  }

  /** A plain description of the current Talk / action target for tests. */
  function targetInfo(t) {
    return t
      ? {
          id: t.id,
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          dist: Number(t.dist.toFixed(2)),
        }
      : null;
  }

  /** Which modal, wudu / prayer screen and azan card state is showing, for tests. */
  function uiInfo() {
    const h = G.UI.current();
    const pf = G.PrayerFlow.state;
    return {
      modal: h ? h.opts.label : null,
      ritual: G.RitualFlow.debug().open,
      eating: G.EatFlow.open(),
      wudu: Boolean(pf.wui),
      pray: Boolean(pf.pui),
      azanCard: Boolean(pf.card && !pf.card.el.hidden),
      azanExpanded: Boolean(
        pf.card && !pf.card.el.hidden && !pf.card.el.classList.contains("is-bar"),
      ),
      azanLive: pf.azanLive,
      guide: pf.guide,
      guideDest: pf.guideDest || null,
      view: pf.viewName || null,
    };
  }

  /** The hero's position, heading, speed, pose and camera, rounded for stable assertions. */
  function heroInfo(s) {
    return {
      pos: {
        x: Number(s.player.pos.x.toFixed(2)),
        y: Number(s.player.pos.y.toFixed(2)),
        z: Number(s.player.pos.z.toFixed(2)),
      },
      heading: Number(s.player.heading.toFixed(2)),
      speed: Number(s.player.speed.toFixed(2)),
      airborne: !s.player.jump.grounded,
      jumpHeight: Number(s.player.jump.h.toFixed(2)),
      running: G.Input.move().run,
      locked: s.player.locked,
      pose: s.player.anim.current(),
      cam: {
        yaw: Number(G.Camera.state.yaw.toFixed(2)),
        dist: Number(G.Camera.state.dist.toFixed(2)),
      },
    };
  }

  /** Snapshot of the whole game for tests (clock, coins, missions, prayer, UI, audio). */
  function state() {
    if (!started()) return { started: false };
    const s = S();
    const sim = s.sim;
    return Object.assign(heroInfo(s), {
      started: true,
      paused: s.paused,
      hidden: s.hidden,
      day: sim.clock.day,
      minute: Number(sim.clock.minute.toFixed(2)),
      hhmm: sim.clock.hhmm(),
      phase: sim.clock.phase(),
      coins: sim.economy.coins,
      hunger: Math.round(sim.needs.hunger),
      energy: Math.round(sim.needs.energy),
      mission: sim.missions.progress(),
      completed: sim.missions.completed(),
      stickers: sim.missions.stickers(),
      prayer: sim.prayer.state(),
      hints: Object.assign(sim.hints.snapshot(), { foodMarker: Boolean(G.Nudge.markerPos()) }),
      outfit: sim.outfit,
      wardrobe: sim.wardrobe,
      muted: G.Audio.isMuted(),
      quality: s.quality,
      target: targetInfo(s.target),
      ui: uiInfo(),
      audio: G.Audio.debug(),
      reduced: G.Settings.reduced(),
    });
  }

  /** Render counters for the performance probes: fps, frames, draw calls (shadow pass included), triangles, shader programs. */
  function stats() {
    const s = S();
    const info = s && s.renderer ? s.renderer.info : null;
    return {
      fps: s ? Math.round(1 / Math.max(0.001, s.avgDt)) : 0,
      frames: s ? s.frames : 0,
      calls: info ? info.render.calls : 0,
      programs: info ? info.programs.length : 0,
      tris: info ? info.render.triangles : 0,
      quality: s ? s.quality : null,
      downgrades: s ? s.downgrades : 0,
    };
  }

  /** A plain description of one NPC (position, pose, goal) for tests, or null for an unknown id. */
  function npc(id) {
    const A = S() && S().npcs && S().npcs.byId[id];
    if (!A) return null;
    return {
      id: A.id,
      name: A.name,
      x: Number(A.x.toFixed(2)),
      z: Number(A.z.toFixed(2)),
      hidden: A.hidden,
      pose: A.pose,
      routine: A.routineKey,
      goal: A.goal ? A.goal.kind : null,
      walking: A.path.length > 0,
      talking: A.talking,
    };
  }

  /** Put the hero 1.2 m in front of a place of interest, clear of walls, and let one step settle. */
  function teleport(poiId) {
    const poi = S().world.pois[poiId];
    if (!poi) return false;
    const x = poi.pos.x - Math.sin(poi.facing) * 1.2;
    const z = poi.pos.z - Math.cos(poi.facing) * 1.2;
    const free = G.Collide.freeSpot(S().world.colliders, x, z, G.Player.RADIUS);
    G.Player.place(S().player, free.x, free.z, poi.facing, S().world.heightAt);
    G.Camera.snapBehind(poi.facing);
    G.Loop.step(100);
    return true;
  }

  /**
   * Jump the clock to `minute` of the current day. Going far backwards makes the prayer tracker
   * rebuild as a fresh game at that minute (Prayer.update does it), so the HUD and the missions
   * never show a prayer from "the future"; the azan card state is reset to match. The reset
   * follows the tracker's own rebuild counter, not a clock comparison: the free-running loop may
   * already have moved the clock a few seconds past the target, and a jump within the tracker's
   * one-minute slack is not a rebuild, so the azan card must survive it (ACC2-01).
   */
  function setMinute(minute) {
    const prayer = S().sim.prayer;
    const rebuilds = prayer.rebuilds();
    G.Loop.setMinute(minute);
    if (prayer.rebuilds() !== rebuilds) G.PrayerFlow.reset();
    G.Loop.step(100);
  }

  /**
   * Make the named prayer due now (azan card, captions, blocking). When the clock is already past
   * it, the tracker restarts as a new game and would count it as prayed at home, so go to just
   * before its start first and step across it (ACC2-02). Going back drops any prayer flow and
   * qada list, like any rewind.
   */
  function forcePrayer(name) {
    const mins = KQ.Sim.Clock.parseHHMM(KQ.PRAYER_TIMES[name]);
    if (Number.isNaN(mins)) return false;
    if (mins < S().sim.clock.minute - REWIND_MARGIN) setMinute(mins - 0.5);
    setMinute(mins + 0.05);
    return true;
  }

  window.__kq = {
    get ready() {
      return started();
    },
    get loaded() {
      return G.Boot.ready;
    },
    state,
    stats,
    npc,
    crowd: () => (S() && S().crowd ? G.Crowd.debug(S().crowd) : null),
    holy: () => (KQ.Holy && KQ.Holy.debug ? KQ.Holy.debug() : null),
    greetings: () => G.Greetings.debug(),
    vehicles: () => G.Vehicles.debug(),
    voice: () => G.Voice.debug(),
    greetChance: (p) => G.Greetings.setChance(p),
    crowdPeople: () => (S() && S().crowd ? G.Crowd.positions(S().crowd) : []),
    step: (ms) => (started() ? G.Loop.step(ms) : 0),
    setMinute: (m) => (started() ? setMinute(m) : undefined),
    teleport,
    place(x, z, heading) {
      G.Player.place(S().player, x, z, heading || 0, S().world.heightAt);
      G.Camera.snapBehind(heading || 0);
      G.Loop.step(100);
    },
    interact: () => G.Actions.handle("interact"),
    action: (name) => G.Actions.handle(name),
    input: (action, on) => G.Input.virtual(action, on),
    forcePrayer,
    ritual: () => G.RitualFlow.debug(),
    card: () => G.RitualUI.debug(),
    openRite: (rite) => G.RitualFlow.open(rite),
    wardrobe: () => G.Wardrobe.debug(),
    openWardrobe: () => G.Wardrobe.open(),
    freeze(on) {
      S().frozen = Boolean(on);
    },
    start(fresh) {
      const b = G.BootUI.refs;
      (fresh ? b.newGame : b.start).click();
    },
  };
})((window.KQ = window.KQ || {}));
