/* ============================================================================
 * FILE: vehicle-sound.js
 * PURPOSE: The sounds of vehicles, all synthesised (no audio files) and all quiet: the hum of the car the hero
 *          drives (a petrol or diesel rumble, an electric car's soft whine), a scooter's putter, a bicycle's
 *          freewheel ticks and chain whirr, the horn and bell, door clunks, the engine starting, the bus's
 *          kneel and door hiss, another car's polite horn, and one faint "other traffic" hum that follows the
 *          nearest car or bus and fades with distance.
 * BUSINESS CONTEXT: AC-P27 (features/kampung-quest-playability/requirements.md). AC-H6 (vehicles) with business rule 1 and AC-16: nothing sounds under the azan or a prayer
 *   flow, and nothing while muted, paused or in a hidden tab. Levels follow ambience.js (the loudest vehicle sound
 *   is well under the footsteps) and there is never any music. The numbers are pure (KQ.Sim.VehicleMix).
 * LIFECYCLE (docs/LEARNINGS.md 2026-11-21): one-off sounds go through Audio.vehicle (the shared gate, counted
 *   apart); the humming voices go out on the Audio bus, which is only `ok` when unmuted / unpaused / visible,
 *   and are faded to zero and their oscillators stopped as soon as the gate or the azan says so. debug() counts
 *   every cue played and every refusal so a probe can assert the lifecycle.
 * DEPENDENCIES: audio.js (bus, vehicle gate, synth), prayer-flow.js (azan / prayer state), util.js,
 *   KQ.Sim.VehicleMix.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const MIX = () => KQ.Sim.VehicleMix;
  /** How quickly a voice follows (1/s) and fades out when silenced. */
  const FOLLOW = 5;
  const FADE_OUT = 12;
  /** How much of a scooter's loudness the putter chops (0..1). */
  const PUTTER_DEPTH = 0.6;
  /** The "other traffic" voice is a little quieter than the one at the wheel. */
  const OTHER_SHARE = 0.8;
  const E = {
    hero: { nodes: null, level: 0 },
    other: { nodes: null, level: 0 },
    honks: 0,
    refused: 0,
    quietBy: "",
    played: {},
    refusedBy: {},
    tickAcc: 0,
    ticks: 0,
  };

  /** Why every vehicle sound must be silent right now ("" = it may sound). */
  function quietReason() {
    const pf = G.PrayerFlow;
    if (G.Audio.azanActive() || (pf && pf.state && pf.state.azanLive)) return "azan";
    if (pf && (pf.screenOpen() || (G.S && G.S.sim && G.S.sim.prayer.state().flow))) return "prayer";
    return "";
  }

  /* ------------------------------ humming voices ------------------------------ */

  /** Build one voice: two oscillators an octave apart through a low-pass, a putter LFO on its gain. */
  function build(bus) {
    const ctx = bus.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    const a = ctx.createOscillator();
    a.type = "triangle";
    const b = ctx.createOscillator();
    b.type = "sawtooth";
    const bGain = ctx.createGain();
    bGain.gain.value = 0.35;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 8;
    const depth = ctx.createGain();
    depth.gain.value = 0;
    lfo.connect(depth);
    depth.connect(out.gain);
    a.connect(lp);
    b.connect(bGain);
    bGain.connect(lp);
    lp.connect(out);
    out.connect(bus.master);
    [a, b, lfo].forEach((o) => o.start());
    return { ctx, out, a, b, bGain, lp, lfo, depth, osc: [a, b, lfo] };
  }

  /** Stop and drop a voice's nodes. */
  function teardown(V) {
    const N = V.nodes;
    V.nodes = null;
    V.level = 0;
    if (!N) return;
    try {
      N.osc.forEach((o) => o.stop());
      N.out.disconnect();
    } catch (err) {
      V.nodes = null;
    }
  }

  /** Make sure a voice exists while it may sound; false when there is no audio context yet. */
  function ensure(V) {
    if (V.nodes) return true;
    const bus = G.Audio.bus();
    if (!bus || !bus.ok) return false;
    V.nodes = build(bus);
    return true;
  }

  /** Aim a voice at the numbers of a mix ({gain, hz, upper, tone, putter}). */
  function steer(V, p, share, dt) {
    V.level = U.damp(V.level, p.gain * share, FOLLOW, dt);
    const N = V.nodes;
    const now = N.ctx.currentTime;
    const chop = p.putter > 0 ? PUTTER_DEPTH : 0;
    const wave = p.hz < 120 || p.putter > 0 ? "triangle" : "sine";
    if (N.a.type !== wave) N.a.type = wave;
    N.out.gain.setTargetAtTime(V.level * (1 - chop), now, 0.05);
    N.depth.gain.setTargetAtTime(V.level * chop, now, 0.05);
    N.lfo.frequency.setTargetAtTime(Math.max(0.2, p.putter), now, 0.1);
    N.a.frequency.setTargetAtTime(p.hz, now, 0.08);
    N.b.frequency.setTargetAtTime(p.hz * 2, now, 0.08);
    N.bGain.gain.setTargetAtTime(p.upper, now, 0.08);
    N.lp.frequency.setTargetAtTime(p.tone, now, 0.1);
  }

  /** Fade a voice out, then drop it. */
  function fade(V, dt) {
    V.level = U.damp(V.level, 0, FADE_OUT, dt);
    if (V.nodes) V.nodes.out.gain.setTargetAtTime(V.level, V.nodes.ctx.currentTime, 0.03);
    if (V.level < 0.0008) teardown(V);
  }

  /** One step of a voice: follow `p` (null = silent) unless something silences it. */
  function stepVoice(V, p, share, dt, quiet) {
    if (!p || quiet) {
      if (V.nodes) fade(V, dt);
      return;
    }
    if (ensure(V)) steer(V, p, share, dt);
  }

  /** The mix numbers for a bicycle: the chain whirr as the hum (no engine), ticks scheduled apart. */
  function bikeVoice(speed, pedalling) {
    const b = MIX().bicycle(speed, pedalling);
    return { gain: b.whirGain, hz: b.whirHz, upper: 0, tone: 1500, putter: 0, tickHz: b.tickHz };
  }

  /**
   * One step of the sound at the wheel.
   * @param {number} dt seconds
   * @param {string} kind "car", "lorry", "moto" or "bike"
   * @param {number} speed m/s (absolute), @param {number} top the vehicle's top speed
   * @param {{fuel?:string, pedalling?:boolean}} [extra] the fuel ("petrol" | "diesel" | "electric") and whether
   *   the bicycle is being pedalled
   */
  function update(dt, kind, speed, top, extra) {
    E.quietBy = quietReason();
    const bus = G.Audio.bus();
    const quiet = Boolean(E.quietBy) || !bus || !bus.ok;
    const o = extra || {};
    const p =
      kind === "bike"
        ? bikeVoice(speed, o.pedalling)
        : MIX().engine(kind, o.fuel || "petrol", speed, top);
    stepVoice(E.hero, p, 1, dt, quiet);
    if (kind === "bike" && !quiet) freewheel(dt, p.tickHz);
  }

  /** The bicycle's freewheel ticks, one short click each, at a rate that follows the speed. */
  function freewheel(dt, hz) {
    E.tickAcc += hz * dt;
    if (E.tickAcc < 1) return;
    E.tickAcc = 0;
    if (cue("tick")) E.ticks += 1;
  }

  /**
   * The faint hum of the nearest other vehicle (a traffic car, the bus), heard from a distance.
   * @param {{d:number, speed:number, top:number, kind:string, fuel:string}[]} list sources
   */
  function others(list, dt) {
    E.quietBy = quietReason();
    const bus = G.Audio.bus();
    const quiet = Boolean(E.quietBy) || !bus || !bus.ok;
    stepVoice(E.other, quiet ? null : MIX().nearest(list), OTHER_SHARE, dt, quiet);
  }

  /* ------------------------------ one-off sounds ------------------------------ */

  /** Play the layers of a recipe at a loudness scale k. */
  function playRecipe(rec, k) {
    const syn = G.Audio.synth;
    return function (ctx, t) {
      rec.tones.forEach((o) =>
        syn.tone(ctx, t + (o.at || 0), { f: o.f, to: o.to, d: o.d, g: o.g * k, type: o.type }),
      );
      if (rec.noise)
        syn.noise(ctx, t, { type: "bandpass", f: rec.noise.f, d: rec.noise.d, g: rec.noise.g * k });
    };
  }

  /** Count a cue as played or refused (with the reason). */
  function count(name, ok, why) {
    if (ok) E.played[name] = (E.played[name] || 0) + 1;
    else {
      E.refused += 1;
      E.refusedBy[why] = (E.refusedBy[why] || 0) + 1;
    }
    return ok;
  }

  /** How loud a cue at a world place is for the hero (1 when it has no place). */
  function reach(at) {
    const P = G.S && G.S.player;
    if (!at || !P) return 1;
    return MIX().distanceGain(U.dist(at.x, at.z, P.pos.x, P.pos.z));
  }

  /**
   * A one-off vehicle sound by name (doorOpen, doorClose, start, hiss, kneel, honk, tick), quieter with the
   * distance of `at` ({x, z}, optional) from the hero. Returns whether it sounded (false under the azan, a
   * prayer, mute, pause, or when too far to hear).
   */
  function cue(name, at) {
    const rec = MIX().ONE_SHOTS[name];
    const k = reach(at);
    if (!rec || k < 0.02) return false;
    const why = quietReason();
    if (why) return count(name, false, why);
    return count(name, G.Audio.vehicle(playRecipe(rec, k)), "gate");
  }

  /** A door's clunk: "open" or "close". */
  const door = (which, at) => cue(which === "open" ? "doorOpen" : "doorClose", at);

  /** Another car's polite horn. */
  function honkAt(at) {
    const ok = cue("honk", at);
    if (ok) E.honks += 1;
    return ok;
  }

  /** The hero's horn / bell. Returns whether it sounded (false under the azan, a prayer, mute, pause). */
  function horn(kind) {
    if (quietReason()) {
      E.refused += 1;
      return false;
    }
    const ok = G.Audio.play(kind === "bike" ? "ring" : "honk");
    if (ok) E.honks += 1;
    else E.refused += 1;
    return ok;
  }

  /** Silence the hum at the wheel at once (the hero got out). */
  function stop() {
    teardown(E.hero);
    E.tickAcc = 0;
  }

  G.VehicleSound = {
    update,
    others,
    cue,
    door,
    honkAt,
    horn,
    stop,
    quietReason,
    debug: () => ({
      engine: Boolean(E.hero.nodes),
      level: Number(E.hero.level.toFixed(4)),
      honks: E.honks,
      refused: E.refused,
      quietBy: E.quietBy,
      played: Object.assign({}, E.played),
      refusedBy: Object.assign({}, E.refusedBy),
      ticks: E.ticks,
      other: { engine: Boolean(E.other.nodes), level: Number(E.other.level.toFixed(4)) },
    }),
  };
})((window.KQ = window.KQ || {}));
