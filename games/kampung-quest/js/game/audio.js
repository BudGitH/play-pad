/* ============================================================================
 * FILE: audio.js
 * PURPOSE: All sound for Kampung Quest: soft synthesised UI / footstep / splash sounds
 *          (Web Audio), the licensed azan recording (an <audio> element, so it also works from
 *          file://) and a synth bell fallback when the recording cannot load.
 * BUSINESS CONTEXT: AC-7 (the azan plays once, only when the tab is visible and unmuted; captions
 *   otherwise), AC-16 (a hidden tab or the pause dialog silences everything), business rule 1
 *   (NO music during the azan; there is no music at all).
 * LIFECYCLE RULES (docs/LEARNINGS.md, 2026-11-21 audio rows): the gate lives where the sound is
 *   made (voice()), setMuted never restarts anything while paused or hidden, and debug() counts
 *   every trigger so a probe can assert the lifecycle, not just the trigger.
 * DEPENDENCIES: util.js. AudioContext is created on the first user gesture (unlock()).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const A = {
    ctx: null,
    master: null,
    muted: false,
    paused: false,
    hidden: false,
    played: 0,
    refused: 0,
  };
  const azan = { el: null, active: false, ended: false, failed: false, fallback: false };
  let noiseBuf = null;

  /** Can any sound play right now? Needs a context, and not muted, paused or in a hidden tab. */
  function canSound() {
    return Boolean(A.ctx) && !A.muted && !A.paused && !A.hidden && A.ctx.state !== "closed";
  }

  /** Create / resume the audio context. Call from a user gesture (Start). */
  function unlock() {
    if (!A.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      try {
        A.ctx = new Ctor();
      } catch (err) {
        return false;
      }
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.55;
      const comp = A.ctx.createDynamicsCompressor();
      A.master.connect(comp);
      comp.connect(A.ctx.destination);
    }
    if (A.ctx.state === "suspended" && !A.paused && !A.hidden) A.ctx.resume();
    return true;
  }

  /** The one gate every synthesised sound goes through. */
  function voice(make) {
    if (!canSound()) {
      A.refused += 1;
      return false;
    }
    try {
      make(A.ctx, A.ctx.currentTime);
      A.played += 1;
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Schedule one synth tone (an oscillator with a quick attack and exponential fade) at time t on
   * the master gain.
   */
  function tone(ctx, t, o) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.g, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    osc.connect(g);
    g.connect(A.master);
    osc.start(t);
    osc.stop(t + o.d + 0.05);
  }

  /**
   * Schedule a burst of filtered white noise (splashes, footsteps) at time t, reusing one shared
   * noise buffer.
   */
  function noise(ctx, t, o) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = o.type || "lowpass";
    filt.frequency.value = o.f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.g, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    src.connect(filt);
    filt.connect(g);
    g.connect(A.master);
    src.start(t);
    src.stop(t + o.d + 0.02);
  }

  const SOUNDS = {
    tap: (c, t) => tone(c, t, { f: 660, to: 520, d: 0.08, g: 0.1 }),
    good: (c, t) => {
      [523, 659, 784].forEach((f, i) => tone(c, t + i * 0.09, { f, d: 0.22, g: 0.12 }));
    },
    coin: (c, t) => {
      tone(c, t, { f: 988, d: 0.16, g: 0.09 });
      tone(c, t + 0.07, { f: 1319, d: 0.22, g: 0.09 });
    },
    splash: (c, t) => {
      noise(c, t, { type: "bandpass", f: 1400, d: 0.2, g: 0.13 });
      tone(c, t, { f: 520, to: 300, d: 0.18, g: 0.05 });
    },
    hint: (c, t) => tone(c, t, { f: 330, d: 0.18, g: 0.07 }),
    bell: (c, t) => {
      [784, 988, 1175].forEach(function (f, i) {
        tone(c, t + i * 0.55, { f, d: 1.6, g: 0.1 });
        tone(c, t + i * 0.55, { f: f * 2, d: 0.9, g: 0.03 });
      });
    },
    pose: (c, t) => noise(c, t, { type: "bandpass", f: 500, d: 0.18, g: 0.04 }),
    step: (c, t) => noise(c, t, { f: 420, d: 0.06, g: 0.05 }),
    run: (c, t) => noise(c, t, { f: 520, d: 0.07, g: 0.07 }),
    jump: (c, t) => tone(c, t, { f: 300, to: 620, d: 0.14, g: 0.06 }),
    land: (c, t) => noise(c, t, { f: 300, d: 0.09, g: 0.07 }),
  };

  /**
   * Play a named UI sound (tap, good, coin, ...); returns whether it actually sounded (false when
   * gated).
   */
  function play(name) {
    return voice(SOUNDS[name]);
  }

  /** Choose the azan file the browser can play: OGG Vorbis when supported, otherwise MP3. */
  function pickAzanSource() {
    const probe = document.createElement("audio");
    const ogg = probe.canPlayType && probe.canPlayType('audio/ogg; codecs="vorbis"');
    return KQ.ASSET_BASE + "audio/" + (ogg ? "azan.ogg" : "azan.mp3");
  }

  /**
   * Check the recording is there without opening a media connection (an idle <audio> request stays
   * pending and would keep the page from ever being "network idle"). On file:// there is no cheap
   * check, so it is assumed present; a failure at play time falls back to the chime.
   */
  async function probeAzan() {
    if (location.protocol === "file:" || !window.fetch) return true;
    try {
      const res = await fetch(pickAzanSource(), { method: "HEAD" });
      azan.failed = !res.ok;
    } catch (err) {
      azan.failed = true;
    }
    return !azan.failed;
  }

  /** Create the azan element and start fetching it (called when the game starts). Safe twice. */
  function loadAzan() {
    if (azan.el) return azan.el;
    const el = new Audio();
    el.preload = "auto";
    el.src = pickAzanSource();
    el.addEventListener("error", function () {
      azan.failed = true;
    });
    el.addEventListener("ended", function () {
      azan.ended = true;
      azan.active = false;
    });
    azan.el = el;
    primeAzan(el);
    return el;
  }

  /** iOS only lets an element play later if it was started inside a gesture: do a silent play + pause. */
  function primeAzan(el) {
    try {
      el.muted = true;
      const p = el.play();
      const done = () => {
        el.pause();
        el.currentTime = 0;
        el.muted = false;
      };
      if (p && p.then) p.then(done).catch(done);
      else done();
    } catch (err) {
      el.muted = false;
    }
  }

  /**
   * Make the azan element match the gates: play when allowed, pause when muted, paused or hidden.
   */
  function syncAzan() {
    const el = azan.el;
    if (!el || !azan.active || azan.ended) return;
    if (canSound() && el.paused) el.play().catch(() => (azan.failed = true));
    else if (!canSound() && !el.paused) el.pause();
  }

  /**
   * Start the azan. Returns "audio" (the recording plays), "chime" (fallback bell) or "silent"
   * (muted / hidden / paused: captions only).
   */
  function startAzan() {
    azan.ended = false;
    azan.active = canSound();
    if (!azan.active) return "silent";
    const el = loadAzan();
    if (azan.failed) return playChime();
    try {
      el.currentTime = 0;
    } catch (err) {
      azan.failed = true;
    }
    const p = el.play();
    if (p && p.catch) p.catch(() => (azan.failed = true));
    azan.fallback = false;
    return "audio";
  }

  /**
   * Fallback when the recording cannot load: ring the synth bell instead and report 'chime' or
   * 'silent'.
   */
  function playChime() {
    azan.fallback = true;
    azan.active = false;
    return voice(SOUNDS.bell) ? "chime" : "silent";
  }

  /** Stop the azan (audio paused, no longer active); captions are handled by the prayer flow. */
  function stopAzan() {
    azan.active = false;
    if (azan.el && !azan.el.paused) azan.el.pause();
  }

  /**
   * Set a lifecycle gate (paused, hidden, muted): suspend or resume the audio context and re-sync
   * the azan to it.
   */
  function setGate(key, value) {
    A[key] = value;
    if (value && A.ctx && A.ctx.state === "running") A.ctx.suspend();
    if (!A.paused && !A.hidden && A.ctx && A.ctx.state === "suspended") A.ctx.resume();
    syncAzan();
  }

  G.Audio = {
    unlock,
    play,
    footstep: (run) => play(run ? "run" : "step"),
    loadAzan,
    probeAzan,
    startAzan,
    stopAzan,
    azanTime: () => (azan.el && azan.active && !azan.el.paused ? azan.el.currentTime : null),
    azanPlaying: () => Boolean(azan.el && azan.active && !azan.el.paused),
    azanActive: () => azan.active,
    azanEnded: () => azan.ended,
    setMuted(v) {
      setGate("muted", Boolean(v));
    },
    setPaused(v) {
      setGate("paused", Boolean(v));
    },
    setHidden(v) {
      setGate("hidden", Boolean(v));
    },
    isMuted: () => A.muted,
    debug: () => ({
      played: A.played,
      refused: A.refused,
      ctx: A.ctx ? A.ctx.state : "none",
      azanActive: azan.active,
      azanPlaying: Boolean(azan.el && !azan.el.paused && azan.active),
      azanFailed: azan.failed,
      muted: A.muted,
      paused: A.paused,
      hidden: A.hidden,
    }),
  };
})((window.KQ = window.KQ || {}));
