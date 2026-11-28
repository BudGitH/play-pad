// Kampung Quest — the hero on an animal (AC-P5, AC-P6). "ride": astride a horse or pony, legs wide round
// the barrel, knees bent, hands forward on the reins, a little bounce in the saddle. "ride_camel": sitting up
// on the camel's saddle in front of the hump, legs forward over the shoulders, one hand on the saddle horn.
// Same joint conventions as poses.js; this file must load before animator.js, which builds its pose table once.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const TAU = Math.PI * 2;

  /** Astride: thighs out and a little forward, shins down the horse's sides, hands at the reins. */
  function ride(p) {
    const s = Math.sin(p * TAU);
    return {
      legL: [-0.2, 0, 1.0],
      legR: [-0.2, 0, -1.0],
      kneeL: [0.7, 0, -0.35],
      kneeR: [0.7, 0, 0.35],
      armL: [-0.75, 0, 0.18],
      armR: [-0.75, 0, -0.18],
      foreL: [-0.75, -0.2, 0],
      foreR: [-0.75, 0.2, 0],
      torso: [0.08 + 0.05 * s, 0, 0],
      head: [-0.06 - 0.03 * s, 0, 0],
    };
  }

  /** Up on a camel: thighs forward and apart, knees bent over the shoulders, a slow sway with the walk. */
  function rideCamel(p) {
    const s = Math.sin(p * TAU);
    return {
      legL: [-1.25, 0, 0.55],
      legR: [-1.25, 0, -0.55],
      kneeL: [1.15, 0, 0],
      kneeR: [1.15, 0, 0],
      armL: [-0.9, 0, 0.12],
      armR: [-0.6, 0, -0.25],
      foreL: [-0.6, -0.15, 0],
      foreR: [-0.9, 0.2, 0],
      torso: [0.04 * s, 0, 0.04 * Math.sin(p * TAU + 1)],
      head: [-0.02, 0.1 * Math.sin(p * Math.PI), 0],
    };
  }

  F.POSES.ride = ride;
  F.POSES.ride_camel = rideCamel;
})((window.KQ = window.KQ || {}));
