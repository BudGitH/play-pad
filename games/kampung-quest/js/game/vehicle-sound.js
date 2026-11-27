/* ============================================================================
 * FILE: vehicle-sound.js
 * PURPOSE: The sounds of the toy car, scooter and bicycle: a soft synthesised engine hum that follows
 *          the speed (car and scooter), the "pip-pip" horn and the bicycle's bell. No audio files.
 * BUSINESS CONTEXT: AC-H6 (vehicles) with business rule 1 and AC-16: nothing sounds under the azan
 *   or a prayer flow, and nothing while muted, paused or in a hidden tab. Quiet by design (the
 *   hum peaks well under the footsteps' loudness) and there is never any music.
 * LIFECYCLE (docs/LEARNINGS.md 2026-11-21): one-off sounds go through Audio.play (the shared gate);
 *   the hum goes out on the Audio bus, which is only `ok` when unmuted / unpaused / visible, and is
 *   faded to zero and its oscillators stopped as soon as the gate or the azan says so.
 * DEPENDENCIES: audio.js (bus, play), prayer-flow.js (azan / prayer state), util.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  /** Hum pitch (Hz) when idling and the extra per m/s, and its loudness at idle and at full speed. */
  const IDLE_HZ = 46;
  const HZ_PER_MS = 9;
  /** A scooter's engine hums higher than a car's. */
  const MOTO_PITCH = 2.2;
  const GAIN_IDLE = 0.012;
  const GAIN_FULL = 0.034;
  /** How quickly the hum follows (1/s) and fades out when silenced. */
  const FOLLOW = 5;
  const FADE_OUT = 12;
  const E = { nodes: null, level: 0, honks: 0, refused: 0, quietBy: "", running: false };

  /** Why every vehicle sound must be silent right now ("" = it may sound). */
  function quietReason() {
    const pf = G.PrayerFlow;
    if (G.Audio.azanActive() || (pf && pf.state && pf.state.azanLive)) return "azan";
    if (pf && (pf.screenOpen() || (G.S && G.S.sim && G.S.sim.prayer.state().flow))) return "prayer";
    return "";
  }

  /** Build the hum: a triangle and a low-passed saw an octave apart, behind one gain. */
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
    a.connect(lp);
    b.connect(bGain);
    bGain.connect(lp);
    lp.connect(out);
    out.connect(bus.master);
    a.start();
    b.start();
    return { ctx, out, a, b, lp };
  }

  /** Stop and drop the hum's nodes. */
  function teardown() {
    const N = E.nodes;
    if (!N) return;
    try {
      N.a.stop();
      N.b.stop();
      N.out.disconnect();
    } catch (err) {
      E.nodes = null;
    }
    E.nodes = null;
    E.level = 0;
    E.running = false;
  }

  /** Make sure the hum exists while it may sound; false when there is no audio context yet. */
  function ensureHum() {
    if (E.nodes) return true;
    const bus = G.Audio.bus();
    if (!bus || !bus.ok) return false;
    E.nodes = build(bus);
    E.running = true;
    return true;
  }

  /** The loudness the hum aims for at a speed (0..1 of the top speed). */
  function targetGain(share) {
    return GAIN_IDLE + (GAIN_FULL - GAIN_IDLE) * U.clamp(share, 0, 1);
  }

  /**
   * One step of the engine hum.
   * @param {number} dt seconds
   * @param {string} kind "car", "moto" or "bike" (a bicycle has no engine)
   * @param {number} speed m/s (absolute)
   * @param {number} top the vehicle's top speed
   */
  function update(dt, kind, speed, top) {
    E.quietBy = quietReason();
    const bus = G.Audio.bus();
    const quiet = Boolean(E.quietBy) || !bus || !bus.ok || kind === "bike";
    if (quiet && !E.nodes) return;
    if (quiet) return fade(dt);
    if (!ensureHum()) return;
    const share = speed / top;
    E.level = U.damp(E.level, targetGain(share), FOLLOW, dt);
    const N = E.nodes;
    const now = N.ctx.currentTime;
    N.out.gain.setTargetAtTime(E.level, now, 0.05);
    const hz = (IDLE_HZ + speed * HZ_PER_MS) * (kind === "moto" ? MOTO_PITCH : 1);
    N.a.frequency.setTargetAtTime(hz, now, 0.08);
    N.b.frequency.setTargetAtTime(hz * 2, now, 0.08);
  }

  /** Fade the hum out when something silences it, then drop it. */
  function fade(dt) {
    E.level = U.damp(E.level, 0, FADE_OUT, dt);
    if (E.nodes) E.nodes.out.gain.setTargetAtTime(E.level, E.nodes.ctx.currentTime, 0.03);
    if (E.level < 0.0008) teardown();
  }

  /** The horn / bell. Returns whether it sounded (false under the azan, a prayer, mute, pause). */
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

  /** Silence the hum at once (the hero got out). */
  function stop() {
    teardown();
  }

  G.VehicleSound = {
    update,
    horn,
    stop,
    debug: () => ({
      engine: Boolean(E.nodes),
      level: Number(E.level.toFixed(4)),
      honks: E.honks,
      refused: E.refused,
      quietBy: E.quietBy,
    }),
  };
})((window.KQ = window.KQ || {}));
