// Kampung Quest — wudu and solat postures for the toy figures (Shafi'i practice, as usual in Singapore).
// qiyam: right hand over left, below the chest · takbir: hands raised beside the ears, palms forward ·
// ruku: back level (torso ~90 deg at the hips), hands on the knees · i'tidal: upright, arms at the sides ·
// sujud: kneeling, forehead + palms on the floor · julus: sitting on folded legs, hands on the thighs ·
// salam: julus with the head turned right / left · doa: palms up. Wudu: rubbing hands, hands to face,
// one foot lifted forward.
(function (KQ) {
  "use strict";
  var F = (KQ.Figures = KQ.Figures || {});
  var S = F.PoseSolve;
  var PI = Math.PI;
  var TAU = PI * 2;

  function breathe(p) {
    return 0.008 * Math.sin(p * TAU);
  }

  function qiyam(p) {
    return {
      torso: [breathe(p), 0, 0],
      head: [0.16, 0, 0], // gaze at the place of sujud
      armL: [-0.22, 0, 0.03],
      armR: [-0.32, 0, -0.03],
      foreL: [-1.42, -1.12, 0],
      foreR: [-1.52, 1.08, 0],
      handL: [0, 0, 0.5],
      handR: [0, 0, -0.5],
    };
  }

  function takbir(p) {
    var lift = 1.45;
    var fold = PI + 0.34 - lift;
    return {
      torso: [breathe(p), 0, 0],
      head: [0.1, 0, 0],
      armL: [-0.2, 0, lift],
      armR: [-0.2, 0, -lift],
      foreL: [0, 0, fold],
      foreR: [0, 0, -fold],
      handL: [-0.25, 0, 0],
      handR: [-0.25, 0, 0],
    };
  }

  function itidal(p) {
    return {
      torso: [breathe(p), 0, 0],
      head: [0.1, 0, 0],
      armL: [0, 0, 0.05],
      armR: [0, 0, -0.05],
      foreL: [-0.12, 0, 0],
      foreR: [-0.12, 0, 0],
    };
  }

  /** Ruku: level back at 90 deg, legs straight, hands on the knees (solved from the real part sizes). */
  function ruku(p, d) {
    var t = PI / 2;
    var hz = -0.035;
    var sh = S.shoulderAt(d, d.hipH, hz, t);
    var knee = [d.hipH - d.thigh + 0.012, hz + d.legD / 2 + 0.03];
    var a = S.reach(d, sh, knee, t);
    return {
      rootZ: hz,
      torso: [t + breathe(p), 0, 0],
      head: [-0.08, 0, 0],
      armL: [a[0], 0, 0.04],
      armR: [a[0], 0, -0.04],
      foreL: [a[1], 0, 0],
      foreR: [a[1], 0, 0],
      handL: [0.3, 0, 0],
      handR: [0.3, 0, 0],
    };
  }

  /** Legs kneeling: thighs tilted forward by a, shins flat on the floor behind the knees. */
  function kneelingLegs(P, a) {
    P.legL = [-a, 0, 0];
    P.legR = [-a, 0, 0];
    P.kneeL = [PI / 2 + a, 0, 0];
    P.kneeR = [PI / 2 + a, 0, 0];
    return P;
  }

  /** Sujud: kneeling, torso folded down until the forehead touches the floor, palms flat by the head. */
  function sujud(p, d) {
    var a = 0.5;
    var hy = S.kneelHipY(d, a);
    var hz = -d.thigh * Math.sin(a) - 0.02;
    var headX = -0.3;
    var t = S.sujudBend(d, hy, headX);
    var sh = S.shoulderAt(d, hy, hz, t);
    var neck = S.rot(d.torsoH + d.neckH, 0, t);
    var palm = [0.05, hz + neck[1] - 0.02];
    var r = S.reach(d, sh, palm, t);
    return kneelingLegs(
      {
        rootY: hy - d.hipH + breathe(p) * 0.3,
        rootZ: hz,
        torso: [t, 0, 0],
        head: [headX, 0, 0],
        armL: [r[0], 0, 0.3],
        armR: [r[0], 0, -0.3],
        foreL: [r[1], 0.25, 0],
        foreR: [r[1], -0.25, 0],
        handL: [0.9, 0, 0],
        handR: [0.9, 0, 0],
      },
      a,
    );
  }

  /** Julus: sitting back on folded legs (thighs forward, shins folded under), hands resting on the thighs. */
  function julus(p, d) {
    var a = PI / 2 - 0.1;
    var hy = S.kneelHipY(d, a) + 0.004;
    var sh = S.shoulderAt(d, hy, 0, 0);
    var r = S.reach(d, sh, [d.legD + 0.045, d.thigh * 0.78], 0);
    return kneelingLegs(
      {
        rootY: hy - d.hipH,
        torso: [breathe(p), 0, 0],
        head: [0.12, 0, 0],
        armL: [r[0], 0, 0.04],
        armR: [r[0], 0, -0.04],
        foreL: [r[1], -0.12, 0],
        foreR: [r[1], 0.12, 0],
        handL: [0.4, 0, 0],
        handR: [0.4, 0, 0],
      },
      a,
    );
  }

  function salam(dir) {
    return function (p, d) {
      var P = julus(p, d);
      P.head = [0.06, dir * 1.12, 0];
      return P;
    };
  }

  /** Doa: seated, both palms open and turned up in front of the chest. */
  function doa(p, d) {
    var P = julus(p, d);
    P.armL = [-0.5, 0, 0.1];
    P.armR = [-0.5, 0, -0.1];
    P.foreL = [-1.05 + breathe(p) * 3, -0.32, 0];
    P.foreR = [-1.05 + breathe(p) * 3, 0.32, 0];
    P.handL = [-1.1, 0, 0.35];
    P.handR = [-1.1, 0, -0.35];
    P.head = [0.22, 0, 0];
    return P;
  }

  // ---------- wudu ----------
  function wuduHands(p) {
    var s = Math.sin(p * TAU * 2);
    return {
      torso: [0.18, 0, 0],
      head: [0.32, 0, 0],
      armL: [-0.32, 0, 0.05],
      armR: [-0.32, 0, -0.05],
      foreL: [-1.05 + 0.08 * s, -0.95 + 0.14 * s, 0],
      foreR: [-1.05 - 0.08 * s, 0.95 + 0.14 * s, 0],
      handL: [0, 0, 0.6],
      handR: [0, 0, -0.6],
    };
  }

  function wuduFace(p) {
    var s = Math.sin(p * TAU * 1.5);
    return {
      torso: [0.12, 0, 0],
      head: [0.14 + 0.05 * s, 0, 0],
      armL: [-1.35, 0, 0.16],
      armR: [-1.35, 0, -0.16],
      foreL: [-1.6 + 0.16 * s, -0.5, 0],
      foreR: [-1.6 + 0.16 * s, 0.5, 0],
      handL: [-0.4, 0, 0.5],
      handR: [-0.4, 0, -0.5],
    };
  }

  function wuduFeet(p) {
    var s = Math.sin(p * TAU * 2);
    return {
      rootZ: -0.02,
      legR: [-0.78, 0, 0],
      kneeR: [0.62, 0, 0],
      legL: [0.05, 0, 0],
      torso: [0.42, 0, 0],
      head: [0.3, 0, 0],
      armR: [-0.62 + 0.06 * s, 0, -0.06],
      foreR: [-0.25, 0.2, 0],
      armL: [-0.1, 0, 0.42],
      foreL: [-0.4, 0, 0],
    };
  }

  var P = F.POSES;
  P.qiyam = qiyam;
  P.takbir = takbir;
  P.ruku = ruku;
  P.itidal = itidal;
  P.sujud = sujud;
  P.julus = julus;
  P.salam_r = salam(-1);
  P.salam_l = salam(1);
  P.doa = doa;
  P.wudu_hands = wuduHands;
  P.wudu_face = wuduFace;
  P.wudu_feet = wuduFeet;
})((window.KQ = window.KQ || {}));
