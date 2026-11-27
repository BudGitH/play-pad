// Kampung Quest — the hero's seat in the toy car. "drive": sitting upright, both hands on the wheel, a slow
// look-around. (Riding a bicycle reuses the crowd's "pedal" pose, crowd-poses.js.) Same joint conventions as
// poses.js; this file must load before animator.js, which builds its pose table once.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const PI = Math.PI;
  const TAU = PI * 2;

  /** Driving: thighs level on the seat, shins down, arms reaching forward to the wheel, eyes on the road. */
  function drive(p) {
    const s = Math.sin(p * TAU);
    return {
      legL: [-PI / 2, 0, 0],
      legR: [-PI / 2, 0, 0],
      kneeL: [PI / 2, 0, 0],
      kneeR: [PI / 2, 0, 0],
      armL: [-1.12, 0, 0.1],
      armR: [-1.12, 0, -0.1],
      foreL: [-0.55, -0.12, 0],
      foreR: [-0.55, 0.12, 0],
      torso: [-0.02, 0, 0],
      head: [0.02 * s, 0.07 * Math.sin(p * TAU + 1), 0],
    };
  }

  F.POSES.drive = drive;
})((window.KQ = window.KQ || {}));
