/* ============================================================================
 * FILE: voice.js
 * PURPOSE: Spoken NPC voices: every dialogue line and every speech bubble a neighbour says is also
 *          read aloud through the browser's speechSynthesis, each character in their own pitch,
 *          rate and (when the device has several English voices) their own voice.
 * BUSINESS CONTEXT: AC-H7 (every NPC speech bubble / dialogue line is also spoken, per-character
 *   pitch / rate, the mute setting respected, a silent fallback when speech is unavailable, never
 *   during the azan). Arabic greetings ("Assalamualaikum!") are simply read by the English voice.
 * RULES: nothing speaks while muted, paused, in a hidden tab, under the azan (the recording or its
 *   captions) or while a prayer screen / flow is open, or when "Character voices" is off. A dialogue
 *   line always wins and replaces whatever was being said; a bubble speaks only when it is within
 *   earshot, never over a dialogue, and when several bubbles overlap only the nearest / most recent
 *   one speaks (one waits its turn, the rest are dropped). Closing a dialogue stops its voice. With no
 *   speechSynthesis (headless, old browsers) every call is a silent no-op that only counts.
 * DEPENDENCIES: settings.js (prefs.voices), audio.js (mute / pause / hidden gates), prayer-flow.js,
 *   util.js, KQ.Figures.CAST / KQ.Sim.NPC_PROFILE (who is who). Never throws.
 * HOW TO TEST: Voice.debug() / __kq.voice() count what was spoken and what was refused, and why
 *   (tests/kampung-quest-voice.spec.mjs stubs window.speechSynthesis).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  /** A bubble further than this from the hero (m) is out of earshot. */
  const EARSHOT = 14;
  /** A nearer bubble may cut off a speaking one when it is this much closer (m). */
  const NEARER = 2.5;
  /** A waiting bubble older than this (game seconds) is dropped. */
  const STALE = 2.5;
  /** Longest line read aloud (characters) and the guess of speaking time: base + per character, at rate 1. */
  const MAX_CHARS = 400;
  const SPEECH_BASE = 0.4;
  const SPEECH_PER_CHAR = 0.07;
  /** After this many failed utterances and no success the device is treated as having no voice. */
  const MAX_ERRORS = 3;
  /**
   * How each cast member sounds: pitch (0..2), rate (about 0.5..1.5), "f" / "m" (picks a matching
   * device voice when one exists). Children are high, elders slow, and everyone differs.
   */
  /** The girl hero's voice (AC-P9): a girl's pitch, a female device voice when there is one. */
  const GIRL_HERO = { pitch: 1.45, rate: 1.0, sex: "f" };
  const PROFILES = {
    guide: { pitch: 1.2, rate: 0.92, sex: "f" }, // the gentle voice of a spoken hint (G.Say)
    hero: { pitch: 1.32, rate: 1.0, sex: "m" },
    nenek: { pitch: 1.05, rate: 0.8, sex: "f" },
    atuk: { pitch: 0.7, rate: 0.78, sex: "m" },
    imam_hakim: { pitch: 0.82, rate: 0.86, sex: "m" },
    makcik_siti: { pitch: 1.2, rate: 0.95, sex: "f" },
    pakcik_rahman: { pitch: 0.78, rate: 0.92, sex: "m" },
    uncle_lim: { pitch: 0.92, rate: 1.0, sex: "m" },
    aunty_mei: { pitch: 1.28, rate: 1.02, sex: "f" },
    hawker_ali: { pitch: 0.98, rate: 1.08, sex: "m" },
    hawker_aminah: { pitch: 1.18, rate: 1.04, sex: "f" },
    barber_raju: { pitch: 0.86, rate: 1.0, sex: "m" },
    dr_nurul: { pitch: 1.12, rate: 0.94, sex: "f" },
    librarian_farah: { pitch: 1.22, rate: 0.9, sex: "f" },
    kid_irfan: { pitch: 1.7, rate: 1.06, sex: "m" },
    kid_aisyah: { pitch: 1.85, rate: 1.0, sex: "f" },
    kid_wei: { pitch: 1.6, rate: 1.08, sex: "m" },
    postman_dan: { pitch: 0.94, rate: 1.1, sex: "m" },
  };
  const FEMALE_NAME =
    /female|woman|samantha|karen|moira|tessa|fiona|victoria|zira|susan|hazel|libby|sonia|aria|jenny|serena|kate/i;
  const MALE_NAME =
    /\bmale\b|daniel|alex|fred|george|david|mark|ryan|guy|thomas|oliver|james|ravi/i;

  const V = {
    voices: [],
    now: 0,
    busyUntil: 0,
    cur: null,
    pending: null,
    spoken: 0,
    errors: 0,
    refused: {},
    last: null,
    log: [],
  };

  /** The browser's speech synthesiser, or null when it is not supported. */
  function synth() {
    return window.speechSynthesis && "SpeechSynthesisUtterance" in window
      ? window.speechSynthesis
      : null;
  }

  /** Re-read the device's English voices (they load late on some browsers), on-device ones first. */
  function readVoices() {
    const s = synth();
    const list = s && s.getVoices ? s.getVoices() : [];
    V.voices = list
      .filter((v) => /^en([-_]|$)/i.test(String(v.lang || "")))
      .sort((a, b) => Number(Boolean(b.localService)) - Number(Boolean(a.localService)));
  }

  /** Start listening for the device's voices (call once; safe without speech support). */
  function init() {
    const s = synth();
    if (!s) return;
    readVoices();
    if (s.addEventListener) s.addEventListener("voiceschanged", readVoices);
  }

  /** Count a refusal and return its reason. */
  function refuse(reason) {
    V.refused[reason] = (V.refused[reason] || 0) + 1;
    return reason;
  }

  /** Is anything stopping speech right now? "" = free to speak, else the reason. */
  function closedBy() {
    const a = G.Audio.debug();
    if (a.muted) return "muted";
    if (a.paused || (G.S && G.S.paused)) return "paused";
    if (a.hidden) return "hidden";
    const pf = G.PrayerFlow;
    if (a.azanActive || (pf && pf.state && pf.state.azanLive)) return "azan";
    if (pf && (pf.screenOpen() || (G.S && G.S.sim && G.S.sim.prayer.state().flow))) return "prayer";
    return "";
  }

  let started = false;

  /** The reason a line may not be spoken at all, or "". */
  function blocked(text) {
    if (!started) {
      started = true;
      init();
    }
    if (!text) return refuse("empty");
    if (!synth()) return refuse("unsupported");
    if (!G.Settings.prefs.voices) return refuse("off");
    if (V.errors >= MAX_ERRORS && V.spoken === 0) return refuse("failed");
    const shut = closedBy();
    return shut ? refuse(shut) : "";
  }

  /* ------------------------------ who sounds like what ------------------------------ */

  /** A cast id for an id or a display name ("Nenek"), or null. */
  function castId(key) {
    if (PROFILES[key]) return key;
    const ids = KQ.Sim.NPC_IDS || [];
    return (
      ids.find((id) => KQ.Sim.NPC_PROFILE[id].name === key) ||
      (key === "Adam" || key === "Hana" ? "hero" : null)
    );
  }

  /** The profile of a crowd extra by id: a child's high voice, otherwise a pitch from the id. */
  function crowdProfile(id) {
    const m = G.S && G.S.crowd && G.S.crowd.byId ? G.S.crowd.byId.get(id) : null;
    const h = U.hash(String(id));
    const kid = Boolean(m && m.kid);
    const pitch = kid ? 1.55 + (h % 30) / 100 : 0.8 + (h % 55) / 100;
    return { pitch, rate: 0.92 + ((h >> 4) % 18) / 100, sex: h % 2 ? "f" : "m" };
  }

  /** How `who` (a cast id, a name, or a crowd id) sounds. */
  function profileOf(who) {
    const id = castId(who);
    if (id === "hero" && G.Hero && G.Hero.isGirl()) return GIRL_HERO;
    return id ? PROFILES[id] : crowdProfile(String(who));
  }

  /** The device voice for a speaker: one of the English voices of the right sex when it can tell, else any, stable per speaker. */
  function voiceFor(who, sex) {
    if (!V.voices.length) return null;
    const want = sex === "f" ? FEMALE_NAME : MALE_NAME;
    const other = sex === "f" ? MALE_NAME : FEMALE_NAME;
    const fit = V.voices.filter((v) => want.test(v.name));
    const rest = V.voices.filter((v) => !other.test(v.name));
    const pool = fit.length ? fit : rest.length ? rest : V.voices;
    return pool[U.hash(String(who)) % pool.length];
  }

  /* ------------------------------ speaking ------------------------------ */

  /** Make the utterance for a line spoken by `who`. */
  function utterance(who, text) {
    const p = profileOf(who);
    const u = new window.SpeechSynthesisUtterance(String(text).slice(0, MAX_CHARS));
    const voice = voiceFor(who, p.sex);
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : "en-GB";
    u.pitch = U.clamp(p.pitch, 0, 2);
    u.rate = U.clamp(p.rate, 0.5, 1.6);
    u.volume = 0.9;
    u.onerror = () => (V.errors += 1);
    return { u, p, voice };
  }

  /** Stop whatever is being said (synth only; the voice state is cleared by the caller). */
  function stopSynth() {
    const s = synth();
    if (!s) return;
    try {
      s.cancel();
    } catch (err) {
      V.errors += 1;
    }
  }

  /** Speak one line now; returns whether it was handed to the synthesiser. */
  function speakNow(req) {
    const s = synth();
    try {
      const made = utterance(req.who, req.text);
      s.speak(made.u);
      V.spoken += 1;
      V.cur = req;
      V.busyUntil = V.now + SPEECH_BASE + (String(req.text).length * SPEECH_PER_CHAR) / made.p.rate;
      V.last = {
        who: req.who,
        text: req.text,
        kind: req.kind,
        pitch: made.u.pitch,
        rate: made.u.rate,
        voice: made.voice ? made.voice.name : null,
      };
      V.log.push(V.last);
      if (V.log.length > 12) V.log.shift();
      return true;
    } catch (err) {
      V.errors += 1;
      refuse("error");
      return false;
    }
  }

  /** Is a line being said at the moment (by our own clock)? */
  function busy() {
    return Boolean(V.cur) && V.now < V.busyUntil;
  }

  /**
   * A dialogue line: always spoken (replacing what was being said), by the speaker's own voice.
   * @param {{id?:string, name?:string, text:string}} o
   * @returns {boolean} whether it was spoken
   */
  function line(o) {
    const text = o && o.text;
    if (blocked(text)) return false;
    stopSynth();
    V.pending = null;
    return speakNow({ who: o.id || o.name || "hero", text, kind: "dialogue", dist: 0 });
  }

  /**
   * A short spoken hint for a child who cannot read yet (G.Say): the same gates as every other line
   * (mute, pause, hidden, azan, a prayer screen, the "Character voices" switch), but it never cuts
   * off a line that is being said. Returns whether it was handed to the synthesiser.
   */
  function hint(text) {
    if (blocked(text)) return false;
    if (busy()) {
      refuse("busy");
      return false;
    }
    stopSynth();
    return speakNow({ who: "guide", text, kind: "hint", dist: 0 });
  }

  /** The bubble currently being said, as a more distant one than `d` allows to be cut off. */
  function cutsOff(d) {
    return V.cur && V.cur.kind === "bubble" && V.cur.dist - d > NEARER;
  }

  /**
   * A speech bubble over `who` that appeared at `dist` metres from the hero. Speaks when it is in
   * earshot and nothing is being said; a much nearer one cuts a far one off; otherwise the latest
   * waits for its turn (one slot) and older ones are dropped.
   * @param {{who:string, text:string, dist:number}} o
   * @returns {boolean} whether it spoke right away
   */
  function bubble(o) {
    if (blocked(o && o.text)) return false;
    if (o.dist > EARSHOT) {
      refuse("range");
      return false;
    }
    const req = { who: o.who, text: o.text, kind: "bubble", dist: o.dist, at: V.now };
    if (busy() && V.cur.kind === "dialogue") {
      refuse("dialogue");
      return false;
    }
    if (busy() && V.cur.kind !== "hint" && !cutsOff(o.dist)) return wait(req); // a spoken hint gives way
    stopSynth();
    return speakNow(req);
  }

  /** Keep a bubble as the one waiting request (the latest wins; the replaced one counts as dropped). */
  function wait(req) {
    if (V.pending) refuse("dropped");
    V.pending = req;
    return false;
  }

  /** Stop speaking and forget any waiting bubble (a dialogue closed, a pause, a mute, the azan...). */
  function cancel(reason) {
    if (V.cur || V.pending) stopSynth();
    V.cur = null;
    V.pending = null;
    V.busyUntil = 0;
    if (reason) V.lastCancel = reason;
  }

  /**
   * Per sim step: keep the clock, stop speech the moment a gate closes (mute, azan, a prayer
   * screen), and let the waiting bubble speak once the current line is done.
   */
  function update(dt) {
    V.now += dt;
    if ((V.cur || V.pending) && closedBy()) return cancel(closedBy());
    if (V.cur && !busy()) V.cur = null;
    const p = V.pending;
    if (!p || busy()) return;
    V.pending = null;
    if (V.now - p.at > STALE) refuse("stale");
    else if (!blocked(p.text)) speakNow(p);
  }

  /** Is speech possible and switched on (the Pause menu toggle shows it)? */
  function available() {
    return Boolean(synth()) && G.Settings.prefs.voices;
  }

  G.Voice = {
    init,
    line,
    bubble,
    hint,
    cancel,
    update,
    available,
    PROFILES,
    debug: () => ({
      supported: Boolean(synth()),
      enabled: G.Settings.prefs.voices,
      voices: V.voices.length,
      spoken: V.spoken,
      errors: V.errors,
      refused: Object.assign({}, V.refused),
      speaking: busy(),
      waiting: Boolean(V.pending),
      last: V.last,
      log: V.log.slice(),
    }),
  };
})((window.KQ = window.KQ || {}));
