// Kampung Quest — poses for the Haramain pilgrims, built on the prayer poses: sitting on the floor reading
// the Quran (julus, head bowed, both hands holding a book at the chest) and standing in dua (palms open in
// front of the chest). They register in F.POSES like every crowd pose, so the instanced kit bakes them.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});

  /** Sitting on the heels, the book held open at the chest with both hands, head bowed over it. */
  function quran(p, d) {
    const P = F.POSES.julus(p, d);
    const sway = 0.02 * Math.sin(p * Math.PI * 2);
    P.armL = [-0.7, 0, 0.12];
    P.armR = [-0.7, 0, -0.12];
    P.foreL = [-1.55, -0.55, 0];
    P.foreR = [-1.55, 0.55, 0];
    P.handL = [-0.3, 0, 0.4];
    P.handR = [-0.3, 0, -0.4];
    P.head = [0.5 + sway, 0, 0];
    P.torso = [0.1 + sway, 0, 0];
    return P;
  }

  /** Standing in dua: both palms open and turned up in front of the chest, gaze lowered. */
  function duaStand(p) {
    const s = Math.sin(p * Math.PI * 2);
    return {
      torso: [0.02 * s, 0, 0],
      head: [0.22, 0, 0],
      armL: [-0.55, 0, 0.12],
      armR: [-0.55, 0, -0.12],
      foreL: [-1.05 + 0.04 * s, -0.32, 0],
      foreR: [-1.05 + 0.04 * s, 0.32, 0],
      handL: [-1.1, 0, 0.35],
      handR: [-1.1, 0, -0.35],
    };
  }

  F.POSES.quran = quran;
  F.POSES.dua_stand = duaStand;
  F.CROWD_RATES = F.CROWD_RATES || {};
  F.CROWD_RATES.quran = 0.12;
  F.CROWD_RATES.dua_stand = 0.1;
})((window.KQ = window.KQ || {}));
