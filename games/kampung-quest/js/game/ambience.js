/* ============================================================================
 * FILE: ambience.js
 * PURPOSE: The atmosphere of the neighbourhood, synthesised with Web Audio (no audio files): a soft
 *          traffic / town hum, gentle wind and leaf rustle, sparse daytime birdsong, night crickets
 *          after Maghrib until Subuh, the murmur and clink of the hawker centre, and a muffled
 *          mosque hall. It follows the game clock and where the hero stands.
 * BUSINESS CONTEXT: owner request "atmospheric sounds to make it better to play". Business rule 1
 *   still holds: NO MUSIC, and absolutely nothing under the azan or during a prayer flow: the whole
 *   bed ducks to silence while either is live and returns a few seconds after (AC-7).
 * LIFECYCLE (docs/LEARNINGS.md 2026-11-21): the pause / hidden gate sits where time and sound are
 *   made. Loop.frame never calls update() while paused or hidden, the audio context is suspended by
 *   Audio.setGate, and every one-off event goes through Audio.ambient() (the same gate as voice()).
 * CPU: about 40 nodes in all, one shared noise buffer, parameters touched every 80 ms, a bed that
 *   is silent is disconnected, and events are scheduled sparsely from game time.
 * DEPENDENCIES: audio.js (bus, ambient, setSurface), util.js. Optional: KQ.PRAYER_TIMES,
 *   KQ.WorldParts.LAYOUT (a built-in copy of the few rectangles used is the fallback).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const HOUR = 60;
  /** Real seconds of game time between parameter updates. */
  const TICK = 0.08;
  /** After the azan or a prayer flow ends, wait this long (game seconds) before fading back in. */
  const RESUME_DELAY = 3;
  /** Never schedule two events closer than this in audio time (a fast-forwarded test must not flood). */
  const MIN_EVENT_GAP = 0.25;
  /** Peak gain of each continuous bed at full level (these sit under the UI sounds). */
  const BED_GAIN = { traffic: 0.34, wind: 0.5, leaves: 0.11, murmur: 1.1, crickets: 0.035 };
  /** Fade rates (1/s): beds cross-fade slowly, the whole bus comes back slowly and ducks fast. */
  const RATE = { bed: 0.35, up: 0.4, down: 1.5, duck: 6 };

  const R = {
    nodes: null,
    level: 0,
    target: 0,
    hold: 0,
    acc: 0,
    quiet: "",
    events: 0,
    birds: 0,
    clinks: 0,
    birdT: 2,
    clinkT: 3,
    nightT: 5,
    lastEvent: -1,
    mix: null,
    muffle: 0,
  };

  /* ------------------------------ the mix (pure) ------------------------------ */

  const FALLBACK_TIMES = { subuh: "05:29", syuruk: "06:51", maghrib: "18:54" };
  const FALLBACK_RECTS = {
    hawker: { x0: 14, x1: 38, z0: -32, z1: -12 },
    park: { x0: 34, x1: 70, z0: 10, z1: 38 },
    mosque: { x0: -58, x1: -12, z0: -58, z1: -10, hall: { x0: -52, x1: -32, z0: -46, z1: -20 } },
  };

  /** "HH:MM" to minutes. */
  function toMin(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm));
    return m ? Number(m[1]) * HOUR + Number(m[2]) : 0;
  }

  /** The prayer times the day is built on (Subuh, Syuruk = sunrise, Maghrib = sunset), in minutes. */
  function dayTimes() {
    const t = KQ.PRAYER_TIMES || FALLBACK_TIMES;
    return { subuh: toMin(t.subuh), syuruk: toMin(t.syuruk), maghrib: toMin(t.maghrib) };
  }

  function rects() {
    const L = KQ.WorldParts && KQ.WorldParts.LAYOUT;
    return L && L.hawker && L.park && L.mosque && L.mosque.hall ? L : FALLBACK_RECTS;
  }

  /** 0 below a, 1 above b, smooth between. */
  function ramp(v, a, b) {
    const t = U.clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /** Distance from a point to a rectangle (0 inside). */
  function rectDist(r, x, z) {
    return Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
  }

  /** 1 at distance `near` or less, 0 at `far` or more. */
  function prox(d, near, far) {
    return 1 - ramp(d, near, far);
  }

  /** A bump of height 1 centred on a minute, `half` minutes wide each side. */
  function bump(m, centre, half) {
    return 1 - ramp(Math.abs(m - centre), 0, half);
  }

  /** What the clock says: how loud birds, insects, traffic and the hawker centre are. */
  function mixTime(minute) {
    const m = ((minute % 1440) + 1440) % 1440;
    const t = dayTimes();
    const birds = ramp(m, t.subuh, t.syuruk + 30) * (1 - ramp(m, t.maghrib - 50, t.maghrib + 10));
    const insects = Math.max(
      ramp(m, t.maghrib - 5, t.maghrib + 25),
      1 - ramp(m, t.subuh - 15, t.subuh + 15),
    );
    const deep = Math.max(ramp(m, 22 * HOUR, 23 * HOUR), 1 - ramp(m, 5 * HOUR, 6 * HOUR));
    const rush = bump(m, 8 * HOUR, 70) + bump(m, 18 * HOUR, 80);
    const open = ramp(m, 6 * HOUR, 7 * HOUR) * (1 - ramp(m, 21.5 * HOUR, 22.5 * HOUR));
    return {
      birds,
      insects,
      traffic: U.lerp(1, 0.4, deep) * (1 + 0.2 * rush),
      open: 0.12 + 0.88 * open,
    };
  }

  /** Where the hero stands: near the hawker centre, in the park, in the mosque, near a road. */
  function mixPlace(x, z) {
    const L = rects();
    const hall = L.mosque.hall;
    const indoor = 1 - ramp(rectDist(hall, x, z), 0, 3);
    const compound = prox(rectDist(L.mosque, x, z), 0, 6);
    const green = prox(rectDist(L.park, x, z), 0, 22);
    const road = prox(Math.min(Math.abs(x), Math.abs(z)), 6, 40);
    const hawker = prox(rectDist(L.hawker, x, z), 0, 26) * (1 - indoor);
    const surface = indoor > 0.5 ? "carpet" : rectDist(L.park, x, z) === 0 ? "grass" : "paving";
    return { indoor, compound, green, road, hawker, surface };
  }

  /**
   * The full target mix for a clock minute and a hero position: per-bed levels 0..1, how muffled
   * the bus is (0 open air .. 1 inside the mosque hall) and the overall level.
   */
  function mixFor(minute, x, z) {
    const t = mixTime(minute);
    const p = mixPlace(x, z);
    const calm = 1 - 0.4 * p.compound;
    return {
      traffic: t.traffic * U.lerp(0.45, 1, p.road) * calm,
      wind: 0.6 * (0.8 + 0.2 * p.green),
      leaves: 0.5 + 0.5 * p.green,
      murmur: t.open * p.hawker,
      crickets: t.insects * (0.7 + 0.3 * p.green),
      birds: t.birds * (0.75 + 0.25 * p.green),
      clink: t.open * p.hawker,
      indoor: p.indoor,
      master: 1 - 0.45 * p.indoor,
      surface: p.surface,
    };
  }

  /* ------------------------------ the graph ------------------------------ */

  /** Three seconds of pink-ish noise with a cross-faded seam, shared by every bed. */
  function pinkBuffer(ctx) {
    const n = Math.floor(ctx.sampleRate * 3);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      d[i] = (b0 + b1 + w * 0.1848) * 0.12;
    }
    const fade = Math.floor(ctx.sampleRate * 0.15);
    for (let i = 0; i < fade; i += 1) {
      const k = i / fade;
      d[i] = d[i] * k + d[n - fade + i] * (1 - k) * 0.999;
    }
    return buf;
  }

  /** A looping noise source starting part-way in, at a given speed (so beds do not share a phase). */
  function noiseSrc(ctx, buf, rate, offset) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = rate;
    src.start(0, offset);
    return src;
  }

  /** A filter node of a type at a frequency. */
  function filter(ctx, type, f, q) {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = f;
    node.Q.value = q || 0.7;
    return node;
  }

  /** A low-frequency oscillator that moves `param` by +/- depth around its base value. */
  function lfo(ctx, freq, depth, param) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.frequency.value = freq;
    amp.gain.value = depth;
    osc.connect(amp);
    amp.connect(param);
    osc.start();
    return osc;
  }

  /** A gain node with a base value. */
  function gainNode(ctx, v) {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  }

  /** Distant traffic: a low rumble that swells slowly, with a faint tyre hiss on top. */
  function trafficBed(ctx, buf, out) {
    const src = noiseSrc(ctx, buf, 0.9, 0.4);
    const swell = gainNode(ctx, 0.75);
    const hiss = gainNode(ctx, 0.22);
    src.connect(filter(ctx, "lowpass", 260, 0.4)).connect(swell);
    src.connect(filter(ctx, "bandpass", 800, 0.6)).connect(hiss);
    hiss.connect(swell);
    lfo(ctx, 0.07, 0.25, swell.gain);
    swell.connect(out);
  }

  /** Wind in the trees: a breathy band that gusts, and a quiet high rustle that gusts with it. */
  function windBeds(ctx, buf, wind, leaves) {
    const src = noiseSrc(ctx, buf, 0.7, 1.1);
    const w = gainNode(ctx, 0.55);
    const l = gainNode(ctx, 0.1);
    src.connect(filter(ctx, "bandpass", 450, 0.6)).connect(w);
    src.connect(filter(ctx, "highpass", 3200, 0.5)).connect(l);
    lfo(ctx, 0.13, 0.45, w.gain);
    lfo(ctx, 0.13, 0.1, l.gain);
    w.connect(wind);
    l.connect(leaves);
  }

  /** Hawker-centre chatter: noise shaped to a vowel-ish band and flickering like many voices. */
  function murmurBed(ctx, buf, out) {
    const src = noiseSrc(ctx, buf, 1, 0.7);
    const g = gainNode(ctx, 0.6);
    src
      .connect(filter(ctx, "bandpass", 380, 1))
      .connect(filter(ctx, "bandpass", 1150, 1.2))
      .connect(g);
    lfo(ctx, 3.7, 0.25, g.gain);
    lfo(ctx, 1.3, 0.15, g.gain);
    g.connect(out);
  }

  /** One cricket-like voice: a high sine, pulsed fast and gated in slow groups ("chrr chrr"). */
  function cricket(ctx, o, out) {
    const osc = ctx.createOscillator();
    const pulse = gainNode(ctx, 0.5);
    const group = gainNode(ctx, 0.5);
    osc.frequency.value = o.f;
    osc.connect(pulse).connect(group).connect(out);
    osc.start();
    lfo(ctx, o.rate, 0.5, pulse.gain);
    return lfo(ctx, o.group, 0.5, group.gain);
  }

  /** A bed: its output gain, and whether it is currently wired into the bus. */
  function makeBed(ctx, name) {
    return { name, gain: gainNode(ctx, 0), level: 0, wired: false };
  }

  /** Build the whole bus once: bed gains -> ambience gain -> muffle filter -> Audio.master. */
  function build(bus) {
    const ctx = bus.ctx;
    const out = gainNode(ctx, 0);
    const muffle = filter(ctx, "lowpass", 18000, 0.5);
    out.connect(muffle);
    muffle.connect(bus.master);
    const buf = pinkBuffer(ctx);
    const beds = {};
    Object.keys(BED_GAIN).forEach((n) => (beds[n] = makeBed(ctx, n)));
    trafficBed(ctx, buf, beds.traffic.gain);
    windBeds(ctx, buf, beds.wind.gain, beds.leaves.gain);
    murmurBed(ctx, buf, beds.murmur.gain);
    const groups = [
      cricket(ctx, { f: 4300, rate: 29, group: 1.3 }, beds.crickets.gain),
      cricket(ctx, { f: 5300, rate: 36, group: 0.8 }, beds.crickets.gain),
      cricket(ctx, { f: 3100, rate: 14, group: 0.35 }, beds.crickets.gain),
    ];
    return { ctx, out, muffle, beds, groups, pan: Boolean(ctx.createStereoPanner) };
  }

  /* ------------------------------ one-off events ------------------------------ */

  const rnd = (a, b) => a + Math.random() * (b - a);

  /** A few quick bright notes (bulbul / sparrow-like). */
  function chirpNotes() {
    const f0 = rnd(2800, 4200);
    const n = 2 + Math.floor(Math.random() * 3);
    return Array.from({ length: n }, (_, i) => {
      const f = f0 * rnd(0.9, 1.15);
      return { at: i * rnd(0.11, 0.15), f, to: f * (Math.random() < 0.5 ? 1.25 : 0.8), d: 0.09 };
    });
  }

  /** A lower, chattering run (mynah-like). */
  function mynahNotes() {
    const f0 = rnd(1300, 2100);
    const n = 4 + Math.floor(Math.random() * 4);
    return Array.from({ length: n }, (_, i) => {
      const f = f0 * rnd(0.8, 1.35);
      return { at: i * 0.1, f, to: f * rnd(0.85, 1.2), d: 0.07 };
    });
  }

  /** Short dry "tuk" blips (tailorbird-like). */
  function tukNotes() {
    const n = 3 + Math.floor(Math.random() * 4);
    return Array.from({ length: n }, (_, i) => ({ at: i * 0.19, f: 2700, to: 2300, d: 0.035 }));
  }

  /** A far-off rising whistle repeated (koel-like); rare. */
  function koelNotes() {
    const n = 4 + Math.floor(Math.random() * 3);
    return Array.from({ length: n }, (_, i) => ({
      at: i * 0.36,
      f: 620 * Math.pow(1.1, i),
      to: 700 * Math.pow(1.1, i),
      d: 0.3,
    }));
  }

  const PHRASES = [
    { make: chirpNotes, w: 5, g: 1 },
    { make: mynahNotes, w: 3, g: 0.9 },
    { make: tukNotes, w: 2, g: 0.8 },
    { make: koelNotes, w: 0.5, g: 0.7 },
  ];

  /** Pick a phrase kind at random by weight. */
  function pickPhrase() {
    const total = PHRASES.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    return PHRASES.find((p) => (r -= p.w) < 0) || PHRASES[0];
  }

  /** Schedule one bird phrase: one oscillator whose pitch and loudness follow the note list. */
  function birdVoice(N, phrase, level) {
    return (ctx, t) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const peak = 0.05 * level * phrase.g * rnd(0.6, 1);
      let end = t;
      g.gain.setValueAtTime(0.0001, t);
      phrase.make().forEach((n) => {
        const a = t + n.at;
        osc.frequency.setValueAtTime(n.f, a);
        osc.frequency.exponentialRampToValueAtTime(n.to, a + n.d);
        g.gain.setValueAtTime(0.0001, a);
        g.gain.exponentialRampToValueAtTime(peak, a + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, a + n.d);
        end = a + n.d;
      });
      osc.connect(g);
      routeOut(N, g, ctx);
      osc.start(t);
      osc.stop(end + 0.05);
    };
  }

  /** Send a one-off voice to the bus, placed a little left or right when a panner exists. */
  function routeOut(N, node, ctx) {
    if (!N.pan) return node.connect(N.out);
    const p = ctx.createStereoPanner();
    p.pan.value = rnd(-0.8, 0.8);
    node.connect(p);
    p.connect(N.out);
  }

  /** One crockery clink (two bright partials) or, now and then, a short wok sizzle. */
  function clinkVoice(N) {
    return (ctx, t) => {
      const sizzle = Math.random() < 0.2;
      const parts = sizzle ? [] : [rnd(2800, 3600), rnd(4300, 5200)];
      parts.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.02 / (i + 1), t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1 + i * 0.04);
        osc.connect(g);
        routeOut(N, g, ctx);
        osc.start(t);
        osc.stop(t + 0.25);
      });
      if (sizzle) sizzleNoise(N, ctx, t);
    };
  }

  /** A soft burst of high filtered noise, like oil in a hot wok. */
  function sizzleNoise(N, ctx, t) {
    const src = ctx.createBufferSource();
    src.buffer = N.sizzle;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.012, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    src.connect(filter(ctx, "highpass", 4500, 0.6)).connect(g);
    routeOut(N, g, ctx);
    src.start(t, rnd(0, 2));
    src.stop(t + 0.85);
  }

  /* ------------------------------ the driver ------------------------------ */

  /** Is the whole bed to be silent right now, and why? "" means it may sound. */
  function quietReason(s) {
    const pf = G.PrayerFlow;
    if (!G.Settings.prefs.ambience) return "off";
    if (G.Audio.azanActive() || (pf && pf.state && pf.state.azanLive)) return "azan";
    if (pf && (pf.screenOpen() || s.sim.prayer.state().flow)) return "prayer";
    return "";
  }

  /** Wire a bed into the bus while it can be heard; unwire it (so it costs nothing) when silent. */
  function wireBed(N, bed, on) {
    if (on === bed.wired) return;
    if (on) bed.gain.connect(N.out);
    else bed.gain.disconnect();
    bed.wired = on;
  }

  /** Move every bed toward its target level and set its gain. */
  function steerBeds(N, mix, dt) {
    const now = N.ctx.currentTime;
    Object.keys(N.beds).forEach((name) => {
      const bed = N.beds[name];
      bed.level = U.damp(bed.level, mix[name], RATE.bed, dt);
      wireBed(N, bed, bed.level > 0.002 || mix[name] > 0.002);
      bed.gain.gain.setTargetAtTime(bed.level * BED_GAIN[name], now, 0.1);
    });
  }

  /** Fade the whole bus: fast down (duck), slow up, and hold a little after a duck ends. */
  function steerBus(N, mix, dt, quiet) {
    R.hold = quiet ? RESUME_DELAY : Math.max(0, R.hold - dt);
    R.target = quiet || R.hold > 0 ? 0 : mix.master;
    const k = quiet ? RATE.duck : R.target < R.level ? RATE.down : RATE.up;
    R.level = U.damp(R.level, R.target, k, dt);
    if (R.target === 0 && R.level < 0.0008) R.level = 0;
    N.out.gain.setTargetAtTime(R.level, N.ctx.currentTime, 0.05);
    R.muffle = U.damp(R.muffle, mix.indoor, 3, dt);
    N.muffle.frequency.setTargetAtTime(18000 * Math.pow(0.05, R.muffle), N.ctx.currentTime, 0.2);
  }

  /** Schedule one event if audio time allows (a fast-forward never floods the context). */
  function fire(N, make) {
    if (N.ctx.currentTime - R.lastEvent < MIN_EVENT_GAP) return false;
    if (!G.Audio.ambient(make)) return false;
    R.lastEvent = N.ctx.currentTime;
    R.events += 1;
    return true;
  }

  /** Sparse events: birds by day, clinks near the hawker centre, a gentle shuffle of the crickets. */
  function events(N, mix, dt) {
    R.birdT -= dt;
    R.clinkT -= dt;
    R.nightT -= dt;
    if (R.birdT <= 0 && mix.birds > 0.05) {
      R.birdT = rnd(2.5, 8) / Math.max(0.3, mix.birds);
      if (fire(N, birdVoice(N, pickPhrase(), mix.birds))) R.birds += 1;
    }
    if (R.clinkT <= 0 && mix.clink > 0.2) {
      R.clinkT = rnd(1.2, 4.5) / mix.clink;
      if (fire(N, clinkVoice(N))) R.clinks += 1;
    }
    if (R.nightT <= 0) {
      R.nightT = rnd(6, 12);
      N.groups.forEach((o) => o.frequency.setTargetAtTime(rnd(0.5, 1.9), N.ctx.currentTime, 2));
    }
  }

  /** Create the graph on first use (needs an unlocked context). */
  function ensure(bus) {
    if (!R.nodes) {
      R.nodes = build(bus);
      R.nodes.sizzle = pinkBuffer(bus.ctx);
    }
    return R.nodes;
  }

  /** Where the hero is and what the clock says, from the game state. */
  function readGame() {
    const s = G.S;
    if (!s || !s.player || !s.sim) return null;
    return { s, minute: s.sim.clock.minute, x: s.player.pos.x, z: s.player.pos.z };
  }

  /**
   * Per-frame tick (Loop.frame, running game only). `dt` is game seconds. Works in 80 ms steps;
   * does nothing while the audio gate is closed (muted / paused / hidden) or before Start unlocks audio.
   */
  function update(dt) {
    const bus = G.Audio.bus();
    const g = readGame();
    if (!bus || !g) return;
    R.acc += dt;
    if (R.acc < TICK && R.nodes) return;
    const step = Math.max(R.acc, TICK);
    R.acc = 0;
    if (!bus.ok) return;
    const N = ensure(bus);
    const mix = mixFor(g.minute, g.x, g.z);
    R.mix = mix;
    R.quiet = quietReason(g.s);
    G.Audio.setSurface(mix.surface);
    steerBus(N, mix, step, R.quiet !== "");
    steerBeds(N, mix, step);
    if (R.quiet === "" && R.level > 0.02) events(N, mix, step);
  }

  /** Hard-duck now (the azan is about to sound): level to zero within about 80 ms. */
  function silence() {
    R.level = 0;
    R.hold = RESUME_DELAY;
    const N = R.nodes;
    if (!N) return;
    const now = N.ctx.currentTime;
    N.out.gain.cancelScheduledValues(now);
    N.out.gain.setTargetAtTime(0, now, 0.025);
  }

  /** What a probe can read: the target mix, the bus level (model and real gain) and event counts. */
  function debug() {
    const N = R.nodes;
    const mix = R.mix;
    return {
      on: Boolean(N),
      quiet: R.quiet,
      level: Number(R.level.toFixed(4)),
      target: Number(R.target.toFixed(3)),
      gain: N ? Number(N.out.gain.value.toFixed(4)) : 0,
      events: R.events,
      birds: R.birds,
      clinks: R.clinks,
      beds: N ? Object.keys(N.beds).filter((n) => N.beds[n].wired) : [],
      mix: mix && {
        birds: Number(mix.birds.toFixed(2)),
        crickets: Number(mix.crickets.toFixed(2)),
        traffic: Number(mix.traffic.toFixed(2)),
        murmur: Number(mix.murmur.toFixed(2)),
        indoor: Number(mix.indoor.toFixed(2)),
      },
    };
  }

  G.Ambience = { update, silence, debug, mix: mixFor, BED_GAIN };
})((window.KQ = window.KQ || {}));
