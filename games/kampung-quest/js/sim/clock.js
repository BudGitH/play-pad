/* ============================================================================
 * FILE: clock.js
 * PURPOSE: Game clock (48-minute day) + day/night phase and sun factor.
 * BUSINESS CONTEXT: AC-6 (features/kampung-quest/requirements.md). 1 game minute
 *   = 2 real seconds by default, so one 24 h game day = 48 real minutes.
 *   Sunrise ~ Syuruk, sunset ~ Maghrib (taken from KQ.PRAYER_TIMES when given).
 * DEPENDENCIES: none. Deterministic: time is injected via tick(dtSec), never Date.now.
 * HOW TO TEST: npm run test:kq
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};

  const MINUTES_PER_DAY = 1440;
  /** Fallback sun times (minutes) used only when no prayer times are supplied. */
  const DEFAULT_SUNRISE_MIN = 7 * 60;
  const DEFAULT_SUNSET_MIN = 19 * 60;
  /** Half-width of the dawn / dusk ramps, in game minutes. */
  const RAMP_MIN = 30;

  /** "HH:MM" -> minutes since midnight, or NaN when malformed. */
  function parseHHMM(text) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(text));
    if (!match) return NaN;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return NaN;
    return hours * 60 + minutes;
  }

  /** Fold any minute value into 0..1439 so day rollover and negative offsets stay valid. */
  function wrapMinute(value) {
    return ((value % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  }

  /** Eased 0..1 ramp between two edges, so the sun fades in and out instead of switching. */
  function smoothstep(edge0, edge1, value) {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  /** Two-digit zero padding for the HH:MM text the HUD and tests show. */
  function pad2(value) {
    return value < 10 ? "0" + value : String(value);
  }

  /** Sun anchors (minutes) from a times object; falls back to defaults. */
  function sunAnchors(times) {
    const rise = times ? parseHHMM(times.syuruk) : NaN;
    const set = times ? parseHHMM(times.maghrib) : NaN;
    return {
      sunrise: Number.isNaN(rise) ? DEFAULT_SUNRISE_MIN : rise,
      sunset: Number.isNaN(set) ? DEFAULT_SUNSET_MIN : set,
    };
  }

  /** Name the part of the day (night, dawn, day, dusk) the sun anchors put a minute in. */
  function phaseAt(minute, anchors) {
    const dawnStart = anchors.sunrise - RAMP_MIN - 10;
    if (minute < dawnStart) return "night";
    if (minute < anchors.sunrise + RAMP_MIN) return "dawn";
    if (minute < anchors.sunset - RAMP_MIN) return "day";
    if (minute < anchors.sunset + RAMP_MIN) return "dusk";
    return "night";
  }

  /** How much daylight there is, 0 (night) to 1 (full day): the lower of the sunrise and sunset ramps. */
  function sunFactorAt(minute, anchors) {
    const up = smoothstep(anchors.sunrise - RAMP_MIN, anchors.sunrise + RAMP_MIN, minute);
    const down = 1 - smoothstep(anchors.sunset - RAMP_MIN, anchors.sunset + RAMP_MIN, minute);
    return Math.min(up, down);
  }

  /**
   * Create a clock.
   * @param {{startMin?:number, realSecPerGameMin?:number, times?:object}} [options]
   * @returns {{minute:number, day:number, tick:Function, set:Function, hhmm:Function,
   *   phase:Function, sunFactor:Function, setTimes:Function, absMinute:Function}}
   */
  function create(options) {
    const opts = options || {};
    const secPerMin = opts.realSecPerGameMin > 0 ? opts.realSecPerGameMin : 2;
    let anchors = sunAnchors(opts.times);
    const clock = {
      minute: wrapMinute(Number.isFinite(opts.startMin) ? opts.startMin : 420),
      day: Number.isInteger(opts.day) && opts.day >= 1 ? opts.day : 1,
      realSecPerGameMin: secPerMin,
    };
    /**
     * Advance the clock by real seconds (ignored unless positive and finite), rolling the day over at midnight.
     */
    clock.tick = function tick(dtSec) {
      if (!(dtSec > 0) || !Number.isFinite(dtSec)) return;
      clock.minute += dtSec / secPerMin;
      while (clock.minute >= MINUTES_PER_DAY) {
        clock.minute -= MINUTES_PER_DAY;
        clock.day += 1;
      }
    };
    /** Jump to a minute of the day (wrapped into 0..1439); non-numbers are ignored. */
    clock.set = function set(min) {
      if (Number.isFinite(min)) clock.minute = wrapMinute(min);
    };
    /** The time as zero-padded 'HH:MM' text for the HUD. */
    clock.hhmm = function hhmm() {
      const whole = Math.floor(clock.minute);
      return pad2(Math.floor(whole / 60)) + ":" + pad2(whole % 60);
    };
    /** Minutes since the start of day 1, so time comparisons work across midnight. */
    clock.absMinute = function absMinute() {
      return (clock.day - 1) * MINUTES_PER_DAY + clock.minute;
    };
    clock.phase = () => phaseAt(clock.minute, anchors);
    clock.sunFactor = () => sunFactorAt(clock.minute, anchors);
    /** Replace the sunrise / sunset anchors from a prayer-times object (Syuruk, Maghrib). */
    clock.setTimes = function setTimes(times) {
      anchors = sunAnchors(times);
    };
    return clock;
  }

  KQ.Sim.Clock = { create, parseHHMM, MINUTES_PER_DAY, pad2 };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
