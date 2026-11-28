/* ============================================================================
 * FILE: vehicle-mix.js
 * PURPOSE: The pure maths behind the vehicle sounds: how loud and how high the engine hum is for a car (petrol,
 *          diesel, electric whine), a scooter's putter, a bicycle's freewheel ticks and chain whirr, how a
 *          passing car or the bus is heard from a distance, and the short one-off sounds (doors, hiss,
 *          engine start). No Web Audio, no DOM: js/game/vehicle-sound.js turns these numbers into sound.
 * BUSINESS CONTEXT: owner request "some sounds of the vehicle, subtle, never overpowering". Levels sit
 *   below the ambience's beds and the footsteps; nothing here decides when sound is allowed (mute, pause,
 *   hidden tab, azan, prayer screen: that is wiring in vehicle-sound.js).
 * DEPENDENCIES: none. HOW TO TEST: npm run test:kq (tests/kampung-quest/vehicle-mix.test.mjs).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /**
   * Engine voices by fuel: base pitch (Hz at idle), extra Hz per m/s, loudness at idle and at full speed (master
   * units; the old car hum peaked at 0.034), how much of the second (octave up) voice, and a low-passed "rattle".
   */
  const VOICES = {
    petrol: { hz: 46, perMs: 9, idle: 0.011, full: 0.03, upper: 0.35, tone: 420 },
    diesel: { hz: 38, perMs: 7, idle: 0.015, full: 0.034, upper: 0.55, tone: 340 },
    electric: { hz: 210, perMs: 28, idle: 0.0, full: 0.012, upper: 0.0, tone: 1800 },
  };
  /** A scooter's putter: pitch multiplier, loudness, and the putter's own rate in Hz (it rises with speed). */
  const MOTO = { pitch: 2.2, idle: 0.01, full: 0.024, putter: 9, putterPerMs: 1.6 };
  /** The largest loudness any engine voice may reach: the "never overpowering" ceiling. */
  const CEILING = 0.04;

  /**
   * The engine hum of a four-wheeler or scooter.
   * @param {string} kind "car" | "lorry" | "moto" | "bus"
   * @param {string} fuel "petrol" | "diesel" | "electric"
   * @param {number} speed m/s (absolute), @param {number} top the vehicle's top speed
   * @returns {{gain:number, hz:number, upper:number, tone:number, putter:number}}
   */
  function engine(kind, fuel, speed, top) {
    const share = clamp(speed / (top || 1), 0, 1);
    if (kind === "moto") return motoVoice(speed, share);
    const v = VOICES[fuel] || VOICES.petrol;
    const heavy = kind === "lorry" || kind === "bus" ? 0.8 : 1;
    return {
      gain: Math.min(CEILING, v.idle + (v.full - v.idle) * share),
      hz: (v.hz + speed * v.perMs) * heavy,
      upper: v.upper,
      tone: v.tone,
      putter: 0,
    };
  }

  /** The scooter: a high little hum chopped by a putter that speeds up. */
  function motoVoice(speed, share) {
    return {
      gain: Math.min(CEILING, MOTO.idle + (MOTO.full - MOTO.idle) * share),
      hz: (VOICES.petrol.hz + speed * VOICES.petrol.perMs) * MOTO.pitch,
      upper: 0.3,
      tone: 600,
      putter: MOTO.putter + speed * MOTO.putterPerMs,
    };
  }

  /**
   * The bicycle: freewheel ticks (the ratchet clicking while the pedals rest) and a chain whirr while pedalling,
   * both following the speed.
   * @returns {{tickHz:number, tickGain:number, whirGain:number, whirHz:number}}
   */
  function bicycle(speed, pedalling) {
    const m = Math.abs(speed);
    const moving = m > 0.8;
    return {
      tickHz: moving && !pedalling ? 2.5 + m * 2.2 : 0,
      tickGain: moving && !pedalling ? 0.012 : 0,
      whirGain: moving && pedalling ? clamp(0.004 + m * 0.0016, 0, 0.016) : 0,
      whirHz: 900 + m * 150,
    };
  }

  /** Where each distance in metres stops being heard, and where it is at full strength. */
  const NEAR = 4;
  const FAR = 42;

  /**
   * How much of a vehicle's sound reaches the hero from `d` metres: full inside NEAR, a smooth fall to nothing at
   * FAR (a car across the street is a faint hum, one down the road is gone).
   */
  function distanceGain(d) {
    if (!(d >= 0)) return 0;
    const t = clamp((d - NEAR) / (FAR - NEAR), 0, 1);
    const fall = 1 - t * t * (3 - 2 * t);
    return fall * fall;
  }

  /**
   * The nearest sounding vehicle for the "other traffic" voice: the loudest after distance among
   * [{d, speed, top, kind, fuel}]; returns {gain, hz, ...engine} or null when nothing is audible.
   */
  function nearest(list) {
    let best = null;
    list.forEach(function (o) {
      const e = engine(o.kind, o.fuel, o.speed, o.top);
      const g = e.gain * distanceGain(o.d) * 0.9;
      if (!best || g > best.gain) best = Object.assign({}, e, { gain: g, d: o.d });
    });
    return best && best.gain > 0.0004 ? best : null;
  }

  /**
   * One-off sounds: tone / noise layers as plain data (frequency in Hz, gain, seconds); the game layer plays them.
   * `to` is an end frequency of a glide, `noise` a band-pass noise burst {f, g, d}.
   */
  const ONE_SHOTS = {
    doorOpen: {
      tones: [{ f: 150, to: 95, g: 0.05, d: 0.11 }],
      noise: { f: 1800, g: 0.03, d: 0.05 },
    },
    doorClose: {
      tones: [{ f: 120, to: 60, g: 0.07, d: 0.14 }],
      noise: { f: 1200, g: 0.045, d: 0.07 },
    },
    start: {
      tones: [{ f: 38, to: 74, g: 0.035, d: 0.5, type: "sawtooth" }],
      noise: { f: 300, g: 0.02, d: 0.3 },
    },
    hiss: { tones: [], noise: { f: 4200, g: 0.035, d: 0.7 } },
    // another car's polite "pip-pip" (the hero's own horn is Audio's "honk")
    honk: {
      tones: [
        { f: 392, g: 0.045, d: 0.12, type: "triangle" },
        { f: 440, g: 0.045, d: 0.16, type: "triangle", at: 0.16 },
      ],
    },
    // the bicycle's freewheel tick and the cast of its bell are one short click each
    tick: { tones: [], noise: { f: 2800, g: 0.012, d: 0.018 } },
    kneel: {
      tones: [
        { f: 220, to: 150, g: 0.02, d: 0.5 },
        { f: 330, to: 220, g: 0.012, d: 0.5 },
      ],
      noise: { f: 3000, g: 0.015, d: 0.4 },
    },
  };

  KQ.Sim.VehicleMix = {
    VOICES,
    MOTO,
    CEILING,
    NEAR,
    FAR,
    ONE_SHOTS,
    engine,
    bicycle,
    distanceGain,
    nearest,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
