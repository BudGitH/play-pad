/* ============================================================================
 * FILE: ritual-trek.js
 * PURPOSE: Walking the rites for real: counting tawaf rounds (anticlockwise around the Kaaba from
 *          the Black Stone line) and sa'i legs (Safa -> Marwa) from where the hero is, and the
 *          "Walk for me" auto-walk that carries the hero round the mataf or along the mas'a lane,
 *          briskly between the green lights.
 * BUSINESS CONTEXT: AC-H3 (walking is optional: Next, Go there and Walk for me all work, and a hero
 *   who walks by hand is counted too). One counter for all of them: the tracker only looks at the
 *   hero's position, so a manual walk and the auto-walk are counted by the same rules. No fail
 *   state: walking the wrong way just does not count.
 * DEPENDENCIES: KQ.HOLY (anchors), KQ.Sim.RitualWalk (pure geometry), player.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const S = () => G.S;
  const RW = () => KQ.Sim.RitualWalk;
  /** Tawaf auto-walk radius (metres from the Kaaba centre) and pace. */
  const TAWAF_RADIUS = 14;
  const TAWAF_SPEED = 7;
  /** Where a tawaf round is counted: between these distances from the Kaaba. */
  const RING = { rMin: 8, rMax: 30 };
  /** How close to a hill (m) counts as being on it. */
  const HILL = 6;
  const T = {
    mode: null,
    kind: null,
    base: 0,
    target: 0,
    tracker: null,
    auto: null,
    onCount: null,
  };

  /** The Makkah anchors, with safe fallbacks so a missing data file never throws. */
  function holy() {
    return (KQ.HOLY && KQ.HOLY.makkah) || null;
  }

  /** The geometry of a rite ("tawaf" or "sai") from the anchors, or null when they are missing. */
  function geometry(kind) {
    const m = holy();
    if (!m) return null;
    if (kind === "tawaf") {
      const k = m.kaaba;
      return { cx: k.x, cz: k.z, startAngle: RW().blackStoneAngle(k) };
    }
    return { a: m.safa, b: m.marwa, lights: m.greenLights };
  }

  /** A fresh counter for the rite, from the hero's position (null when the anchors are missing). */
  function makeTracker(kind, target) {
    const g = geometry(kind);
    if (!g) return null;
    if (kind === "tawaf") return RW().createTawaf(Object.assign({ rounds: target }, g, RING));
    return RW().createSai({ a: g.a, b: g.b, r: HILL, legs: target });
  }

  /**
   * Start watching the hero for a rite ("tawaf" | "sai"). `base` is the count already on the card
   * and `target` its goal; `onCount(n)` is told the new total whenever a round / leg is walked.
   */
  function track(kind, base, target, onCount) {
    stopAuto();
    Object.assign(T, {
      mode: "manual",
      kind,
      base,
      target,
      onCount,
      tracker: makeTracker(kind, target - base),
    });
  }

  /** Stop watching (the step changed or the rite closed). */
  function stop() {
    stopAuto();
    Object.assign(T, { mode: null, kind: null, tracker: null, onCount: null });
  }

  /** Put the hero on the ground at a route point, facing along it. */
  function put(p) {
    const P = S().player;
    P.pos.set(p.x, S().world.heightAt(p.x, p.z), p.z);
    P.base = P.pos.y;
    P.heading = p.heading;
    G.Player.sync(P);
  }

  /** The auto-walk route for a rite, with its length in metres and where it starts and ends. */
  function routeFor(kind, base, target) {
    const g = geometry(kind);
    if (!g) return null;
    if (kind === "tawaf") {
      const route = RW().tawafRoute({
        cx: g.cx,
        cz: g.cz,
        startAngle: g.startAngle,
        radius: TAWAF_RADIUS,
      });
      return {
        kind,
        route,
        pos: 0,
        end: target - base,
        unit: route.circumference,
        speed: () => TAWAF_SPEED,
        brisk: () => false,
        at: (u) => route.at(u),
      };
    }
    const route = RW().saiRoute(g);
    const d0 = base * route.length;
    return {
      kind,
      route,
      pos: d0,
      end: target * route.length,
      unit: route.length,
      speed: route.speed,
      brisk: route.brisk,
      at: route.at,
      d0,
    };
  }

  /**
   * "Walk for me": carry the hero along the route from the start (round 0 / the current leg), at a
   * walking pace and briskly between the green lights, until the target is reached. `onEnd` runs then.
   */
  function auto(kind, base, target, onCount, onEnd) {
    const r = routeFor(kind, base, target);
    if (!r) return false;
    Object.assign(T, {
      mode: "auto",
      kind,
      base,
      target,
      onCount,
      tracker: null,
      auto: Object.assign(r, { onEnd }),
    });
    G.Player.lock(S().player, null, "walk");
    put(r.at(r.pos));
    return true;
  }

  /** Stop the auto-walk and give the hero back (the manual counter keeps watching). */
  function stopAuto() {
    if (!T.auto) return;
    T.auto = null;
    if (T.mode === "auto") T.mode = "manual";
    G.Player.release(S().player);
    if (T.kind && T.tracker === null) T.tracker = makeTracker(T.kind, T.target - T.base);
  }

  /** Advance the auto-walk by dt seconds and tell the counter how far it got. */
  function stepAuto(dt) {
    const r = T.auto;
    const speed = r.speed(r.pos);
    r.pos = Math.min(r.end, r.pos + (speed * dt) / (r.kind === "tawaf" ? r.unit : 1));
    put(r.at(r.pos));
    S().player.forcedPose = r.brisk(r.pos) ? "run" : "walk";
    const walked = r.kind === "tawaf" ? r.pos : r.pos / r.unit;
    const total =
      T.kind === "tawaf" ? T.base + Math.floor(walked + 0.02) : Math.floor(walked + 0.02);
    if (T.onCount) T.onCount(Math.min(T.target, total));
    if (r.pos >= r.end) {
      const done = r.onEnd;
      stopAuto();
      if (done) done();
    }
  }

  /** Per frame: move the auto-walker, or feed the hero's position to the manual counter. */
  function update(dt) {
    if (!T.mode || !S().player) return;
    if (T.mode === "auto" && T.auto) return stepAuto(dt);
    if (!T.tracker) return;
    const p = S().player.pos;
    const n = T.tracker.feed(p.x, p.z);
    if (n > 0 && T.onCount) T.onCount(T.base + (T.kind === "tawaf" ? n : n + 0));
  }

  G.RitualTrek = {
    track,
    stop,
    auto,
    stopAuto,
    update,
    isAuto: () => Boolean(T.auto),
    mode: () => T.mode,
    TAWAF_RADIUS,
  };
})((window.KQ = window.KQ || {}));
