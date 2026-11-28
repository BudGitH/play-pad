/* ============================================================================
 * FILE: mount-sound.js
 * PURPOSE: The animals' sounds, all synthesised (no files): a camel's soft low grunt, a horse's
 *          gentle whinny with a snort, a pony's higher one, and quiet hoof clops while riding.
 * BUSINESS CONTEXT: AC-P5 ("Say hi" gives a little reaction + sound). Business rule 1 and AC-16:
 *   nothing sounds under the azan or a prayer flow, and nothing while muted, paused or in a
 *   hidden tab (the Audio bus is only `ok` when unmuted / unpaused / visible). Quiet by design.
 * DEPENDENCIES: audio.js (bus), prayer-flow.js (azan / prayer state).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const E = { calls: 0, clops: 0, refused: 0, last: "" };
  let noiseBuf = null;

  /** Why the animals must be silent right now ("" = they may sound). */
  function quietReason() {
    const pf = G.PrayerFlow;
    if (G.Audio.azanActive() || (pf && pf.state && pf.state.azanLive)) return "azan";
    if (pf && (pf.screenOpen() || (G.S && G.S.sim && G.S.sim.prayer.state().flow))) return "prayer";
    const bus = G.Audio.bus();
    return bus && bus.ok ? "" : "gate";
  }

  /** One oscillator with a pitch path [[t, hz], ...] and a soft envelope peaking at g. */
  function voice(bus, t0, o) {
    const ctx = bus.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = o.lp || 1200;
    osc.type = o.type || "triangle";
    o.path.forEach(([t, hz], i) =>
      i === 0
        ? osc.frequency.setValueAtTime(hz, t0 + t)
        : osc.frequency.linearRampToValueAtTime(hz, t0 + t),
    );
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.g, t0 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(bus.master);
    osc.start(t0);
    osc.stop(t0 + o.d + 0.05);
  }

  /** A short burst of filtered noise (a snort, a hoof on sand). */
  function puff(bus, t0, f, d, g) {
    const ctx = bus.ctx;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(g, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(bus.master);
    src.start(t0);
    src.stop(t0 + d + 0.02);
  }

  /** The call per kind: a camel grumbles low, a horse whinnies, a pony whinnies higher. */
  const CALLS = {
    camel(bus, t) {
      voice(bus, t, {
        type: "sawtooth",
        lp: 380,
        g: 0.06,
        d: 0.75,
        path: [
          [0, 96],
          [0.25, 120],
          [0.7, 74],
        ],
      });
      puff(bus, t + 0.05, 320, 0.5, 0.025);
    },
    horse(bus, t) {
      const path = [
        [0, 520],
        [0.12, 880],
        [0.25, 760],
        [0.38, 860],
        [0.5, 700],
        [0.8, 420],
      ];
      voice(bus, t, { type: "triangle", lp: 1800, g: 0.04, d: 0.85, path });
      puff(bus, t + 0.9, 900, 0.25, 0.03);
    },
    pony(bus, t) {
      const path = [
        [0, 700],
        [0.1, 1150],
        [0.22, 980],
        [0.34, 1120],
        [0.6, 620],
      ];
      voice(bus, t, { type: "triangle", lp: 2200, g: 0.035, d: 0.65, path });
      puff(bus, t + 0.7, 1100, 0.2, 0.025);
    },
  };

  /** Play the animal's greeting call; returns whether it sounded (false when gated). */
  function call(kind) {
    const why = quietReason();
    if (why) {
      E.refused += 1;
      E.last = why;
      return false;
    }
    const bus = G.Audio.bus();
    try {
      (CALLS[kind] || CALLS.horse)(bus, bus.ctx.currentTime);
    } catch (err) {
      E.refused += 1;
      return false;
    }
    E.calls += 1;
    E.last = kind;
    return true;
  }

  /** One soft hoof fall while riding (camels pad, so theirs is duller). */
  function clop(kind) {
    if (quietReason()) return false;
    const bus = G.Audio.bus();
    try {
      puff(
        bus,
        bus.ctx.currentTime,
        kind === "camel" ? 260 : 1300,
        0.07,
        kind === "camel" ? 0.02 : 0.022,
      );
    } catch (err) {
      return false;
    }
    E.clops += 1;
    return true;
  }

  G.MountSound = { call, clop, quietReason, debug: () => Object.assign({}, E) };
})((window.KQ = window.KQ || {}));
