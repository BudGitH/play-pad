/* ============================================================================
 * FILE: ritual-trek.js
 * PURPOSE: Walking the rites for real: counting tawaf rounds (anticlockwise around the Kaaba from
 *          the Black Stone line) and sa'i legs (Safa -> Marwa) from where the hero is, and the
 *          "Walk for me" auto-walk that carries the hero round the mataf or along the mas'a lane,
 *          calmly (a stroll, a touch quicker between the green lights). While a step is active it also
 *          shows the dotted ground guide (ritual-guide.js) and offers one gentle hint line.
 * BUSINESS CONTEXT: AC-H3 (walking is optional: Next, Go there and Walk for me all work, and a hero
 *   who walks by hand is counted too). One counter for all of them: the tracker only looks at the
 *   hero's position, so a manual walk and the auto-walk are counted by the same rules. No fail
 *   state: walking the wrong way just does not count.
 * DEPENDENCIES: KQ.HOLY (anchors), KQ.Sim.RitualWalk (pure geometry), player.js, ritual-guide.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const S = () => G.S;
  const RW = () => KQ.Sim.RitualWalk;
  /** Tawaf auto-walk radius (metres from the Kaaba centre) and pace: calm, about 31 s a round. */
  const TAWAF_RADIUS = KQ.Sim.RitualWalk.TAWAF_RADIUS;
  const TAWAF_SPEED = KQ.Sim.RitualWalk.TAWAF_SPEED;
  /** Where a tawaf round is counted: between these distances from the Kaaba (a wide, forgiving band). */
  const RING = { rMin: 7, rMax: 32 };
  /** How close to a hill (m) counts as being on it. */
  const HILL = 7;
  const T = {
    mode: null,
    kind: null,
    base: 0,
    target: 0,
    tracker: null,
    auto: null,
    onCount: null,
    hint: "",
    shown: 0,
  };
  /** Scratch objects reused every frame (no per-frame allocation): the counting view and what the hint last saw. */
  const VIEW = {
    x: 0,
    z: 0,
    armed: true,
    want: "b",
    onRing: true,
    back: false,
    progress: 0,
    count: 0,
    toGoal: 99,
  };
  const SIG = {
    stale: true,
    mode: null,
    count: -1,
    armed: null,
    onRing: null,
    back: null,
    pb: -1,
    want: "",
    near: false,
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
    const same = T.mode && T.kind === kind && T.base === base && T.target === target && T.tracker;
    stopAuto();
    Object.assign(T, { mode: "manual", kind, base, target, onCount, shown: base });
    SIG.stale = true;
    if (!same) T.tracker = makeTracker(kind, target - base); // reopening the card keeps the progress
    showGuide(kind);
    T.hint = hintFor(view()); // the card is drawn before the next frame: it needs the sentence now
  }

  /** Stop watching (the step changed or the rite closed): the ground guide goes too. */
  function stop() {
    stopAuto();
    G.RitualGuide.hide();
    Object.assign(T, { mode: null, kind: null, tracker: null, onCount: null, hint: "", shown: 0 });
    SIG.stale = true;
  }

  /**
   * The count the card shows now (it can be ahead of the walked count when Next is tapped): the
   * hint and the "Round n" line follow the card, not the count the walk started from.
   */
  function sync(count) {
    if (count === T.shown) return;
    T.shown = count;
    SIG.stale = true;
    if (!T.mode || !S().player) return;
    const v = view();
    T.hint = hintFor(v); // the card being redrawn asks for the hint right after
    hintStale(v);
  }

  /** The dotted guide on the ground for the rite (nothing when the anchors are missing). */
  function showGuide(kind) {
    const g = geometry(kind);
    if (!g) return;
    if (kind === "tawaf") G.RitualGuide.show(kind, Object.assign({ radius: TAWAF_RADIUS }, g));
    else G.RitualGuide.show(kind, { a: g.a, b: g.b, w: holy().masaLane.w });
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
   * calm walking pace (a touch quicker between the green lights), until the target is reached.
   * `onEnd` runs then.
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
    G.Camera.clearShot();
    T.auto = null;
    if (T.mode === "auto") T.mode = "manual";
    G.Player.release(S().player);
    if (T.kind && T.tracker === null) T.tracker = makeTracker(T.kind, T.target - T.base);
  }

  /** A scripted shot that follows the walking hero from the outer side and a little behind, so the rite is easy to watch. */
  function followShot() {
    const P = S().player;
    G.Camera.shot({
      target: { x: P.pos.x, y: P.pos.y, z: P.pos.z },
      yaw: P.heading + 0.9,
      pitch: 0.2,
      dist: 3.6,
      lift: 0.65,
      rate: 4,
    });
  }

  /** Advance the auto-walk by dt seconds and tell the counter how far it got. */
  function stepAuto(dt) {
    const r = T.auto;
    const speed = r.speed(r.pos);
    r.pos = Math.min(r.end, r.pos + (speed * dt) / (r.kind === "tawaf" ? r.unit : 1));
    put(r.at(r.pos));
    followShot();
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

  /** Metres from the hero to the hill being walked to (sa'i), or a big number when the anchors are missing. */
  function toGoal(v) {
    const m = holy();
    const goal = m && (v.want === "b" ? m.marwa : m.safa);
    return goal ? Math.hypot(v.x - goal.x, v.z - goal.z) : 99;
  }

  /**
   * The counting state of the rite as the guide and the hints see it: { x, z, armed, want, count, ... }.
   * One shared scratch object, rewritten each call: read it at once, never keep it.
   */
  function view() {
    const p = S().player.pos;
    const t = T.tracker;
    const out = VIEW;
    Object.assign(out, { x: p.x, z: p.z, armed: true, want: "b", onRing: true, back: false });
    Object.assign(out, { progress: 0, count: T.shown, toGoal: 99 });
    if (T.mode === "auto" && T.auto) {
      out.want = Math.floor(T.auto.pos / T.auto.unit) % 2 === 0 ? "b" : "a"; // sa'i legs alternate
      return out;
    }
    if (!t) return out;
    const n = t.rounds === undefined ? t.legs : t.rounds;
    out.armed = t.armed;
    out.count = Math.max(T.shown, T.base + n);
    if (T.kind === "tawaf")
      Object.assign(out, { onRing: t.onRing, back: t.back, progress: t.progress });
    else {
      out.want = t.want;
      out.toGoal = toGoal(out);
    }
    return out;
  }

  /** Did anything the hint sentence depends on change since it was last written? (Updates the memo.) */
  function hintStale(v) {
    const pb = Math.floor(v.progress * 10); // the hint only cares about 0.1 and 0.8
    const near = v.toGoal < 12;
    const same =
      !SIG.stale &&
      SIG.mode === T.mode &&
      SIG.count === v.count &&
      SIG.armed === v.armed &&
      SIG.onRing === v.onRing &&
      SIG.back === v.back &&
      SIG.pb === pb &&
      SIG.want === v.want &&
      SIG.near === near;
    Object.assign(SIG, { stale: false, mode: T.mode, count: v.count, armed: v.armed });
    Object.assign(SIG, { onRing: v.onRing, back: v.back, pb, want: v.want, near });
    return !same;
  }

  /** The one gentle sentence for what to do now (the card's note and the chip show it), or "". */
  function hintFor(v) {
    if (T.mode === "auto") return "Walking for you. Tap Stop walking any time to take over.";
    if (T.kind === "tawaf")
      return RW().tawafHint(Object.assign({ target: T.target, rounds: v.count }, v));
    return RW().saiHint({
      legs: v.count,
      target: T.target,
      armed: v.armed,
      want: v.want,
      toGoal: v.toGoal,
    });
  }

  /** Per frame: move the auto-walker (or feed the hero's position to the counter), then the guide and hint. */
  function update(dt) {
    if (!T.mode || !S().player) return;
    if (T.mode === "auto" && T.auto) stepAuto(dt);
    else if (T.tracker) {
      const p = S().player.pos;
      const n = T.tracker.feed(p.x, p.z);
      if (n > 0 && T.onCount) T.onCount(T.base + n);
    }
    if (!T.mode) return; // the count above may have ended the step
    const v = view();
    G.RitualGuide.update(dt, v);
    if (hintStale(v)) T.hint = hintFor(v); // the sentence is rebuilt only when its inputs change
  }

  G.RitualTrek = {
    track,
    stop,
    sync,
    auto,
    stopAuto,
    update,
    isAuto: () => Boolean(T.auto),
    mode: () => T.mode,
    hint: () => T.hint,
    TAWAF_RADIUS,
    TAWAF_SPEED,
  };
})((window.KQ = window.KQ || {}));
