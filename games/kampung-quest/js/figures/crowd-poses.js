// Kampung Quest — everyday poses for the neighbourhood crowd (and any cast member who wants them):
// waiting (shifting weight, glancing at a watch), phone, chatting while standing or sitting, listening,
// ordering at a stall, tai chi, sweeping, jogging, a hop-and-cheer for kids, and walking with a bag.
// Same conventions as poses.js (see its header): each pose is (phase01, dims) -> joint targets.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const PI = Math.PI;
  const TAU = PI * 2;

  /** Smooth 0..1..0 bump centred on c (phase units) with half-width w, so a gesture eases in and out. */
  function bump(p, c, w) {
    const d = Math.abs(((p - c + 0.5) % 1) - 0.5 + (p - c + 0.5 < 0 ? 1 : 0));
    const x = Math.max(0, 1 - d / w);
    return x * x * (3 - 2 * x);
  }

  /** Linear blend of two joint triples (a, b) by k. */
  function mix3(a, b, k) {
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }

  /** The seated base (thighs level, shins down) shared by the seated variants. */
  function seatedBase() {
    return {
      legL: [-PI / 2, 0, 0],
      legR: [-PI / 2, 0, 0],
      kneeL: [PI / 2, 0, 0],
      kneeR: [PI / 2, 0, 0],
    };
  }

  /**
   * Waiting in line or for a lift or bus: a slow weight shift, a look around and now and then a
   * glance at a wristwatch.
   */
  function wait(p) {
    const s = Math.sin(p * TAU);
    const w = bump(p, 0.7, 0.14);
    return {
      hips: [0, 0, 0.025 * s],
      torso: [0.01, 0.04 * s, -0.02 * s],
      head: [0.03 + 0.2 * w, 0.28 * Math.sin(p * TAU * 2 + 1) * (1 - w), 0],
      armL: mix3([-0.14, 0, 0.18], [-0.62, 0, 0.12], w),
      foreL: mix3([-0.5, -0.1, 0], [-1.7, -0.45, 0], w),
      legL: [0.03 * s, 0, 0.02 * s],
      legR: [-0.03 * s, 0, -0.02 * s],
    };
  }

  /** Standing and looking down at a phone held in front of the chest. */
  function phone(p) {
    const s = Math.sin(p * TAU);
    const tap = 0.06 * Math.sin(p * TAU * 6);
    return {
      torso: [0.05 + 0.01 * s, 0, 0],
      head: [0.42, 0.04 * s, 0],
      armR: [-0.7, 0, -0.1],
      foreR: [-1.6 + tap, 0.35, 0],
      armL: [-0.16, 0, 0.18],
      hips: [0, 0, 0.02 * s],
    };
  }

  /** Seated and looking down at a phone. */
  function sitphone(p) {
    const P = seatedBase();
    const tap = 0.06 * Math.sin(p * TAU * 6);
    P.torso = [0.06, 0, 0];
    P.head = [0.4, 0.05 * Math.sin(p * TAU), 0];
    P.armR = [-0.75, 0, -0.1];
    P.foreR = [-1.55 + tap, 0.35, 0];
    P.armL = [-0.35, 0, 0.12];
    P.foreL = [-0.9, 0.2, 0];
    return P;
  }

  /** Listening in a chat: nodding, the head turning a little, hands relaxed at the front. */
  function listen(p) {
    const nod = Math.max(0, Math.sin(p * TAU * 3));
    return {
      torso: [0.02, 0.05 * Math.sin(p * TAU), 0],
      head: [0.03 + 0.14 * nod, 0.12 * Math.sin(p * TAU + 2), 0],
      armL: [-0.28, 0, 0.14],
      foreL: [-0.95, -0.35, 0],
      armR: [-0.3, 0, -0.14],
      foreR: [-0.9, 0.35, 0],
    };
  }

  /** Chatting while seated at a table: the right hand gestures, the head nods. */
  function sittalk(p) {
    const P = seatedBase();
    const s = Math.sin(p * TAU);
    const s2 = Math.sin(p * TAU * 2);
    P.armR = [-0.5 + 0.14 * s, 0, -0.22];
    P.foreR = [-1.05 + 0.3 * s2, 0.35, 0];
    P.handR = [0, 0, 0.3 * s2];
    P.armL = [-0.4, 0, 0.12];
    P.foreL = [-0.9, 0.2, 0];
    P.head = [0.05 * s2, 0.14 * s, 0];
    P.torso = [0.03, 0.05 * s, 0];
    return P;
  }

  /** Ordering at a counter: a pointing arm, a nod, then a hand held out for the plate. */
  function order(p) {
    const point = bump(p, 0.3, 0.25);
    const take = bump(p, 0.75, 0.2);
    return {
      torso: [0.06 + 0.04 * point, 0, 0],
      head: [0.1 * point, 0.08 * Math.sin(p * TAU), 0],
      armR: mix3(mix3([-0.2, 0, -0.2], [-1.35, 0, -0.12], point), [-1.0, 0, -0.15], take),
      foreR: mix3(mix3([-0.6, 0.1, 0], [-0.15, 0, 0], point), [-0.5, 0, 0], take),
      armL: [-0.16, 0, 0.2],
    };
  }

  /** Kneeling drop of the hips (figure units, negative) for thigh angle a and knee bend k. */
  function crouch(d, a, k) {
    return -(d.thigh * (1 - Math.cos(a)) + d.shin * (1 - Math.cos(k - a)));
  }

  /** Tai chi: knees soft, weight rolling side to side, both hands "waving like clouds". */
  function taiji(p, d) {
    const s = Math.sin(p * TAU);
    const c = Math.cos(p * TAU);
    const dims = d || { thigh: 0.13, shin: 0.175 };
    return {
      rootY: crouch(dims, 0.32, 0.64) + 0.006 * c,
      rootZ: 0.012 * s,
      hips: [0, 0.18 * s, 0.03 * s],
      legL: [-0.32, 0, 0.2 + 0.08 * s],
      legR: [-0.32, 0, -0.2 + 0.08 * s],
      kneeL: [0.64, 0, 0],
      kneeR: [0.64, 0, 0],
      torso: [0.03, 0.34 * s, 0],
      head: [0, -0.2 * s, 0],
      armL: [-0.95 + 0.3 * c, 0.2 * s, 0.34 - 0.12 * s],
      armR: [-0.95 - 0.3 * c, 0.2 * s, -0.34 - 0.12 * s],
      foreL: [-0.7 - 0.2 * s, 0, 0],
      foreR: [-0.7 + 0.2 * s, 0, 0],
    };
  }

  /** Sweeping with a broom held in both hands: lean in, swing across, step on the spot. */
  function sweep(p) {
    const s = Math.sin(p * TAU);
    const c = Math.cos(p * TAU);
    return {
      torso: [0.24, 0.3 * s, 0],
      head: [0.2, -0.15 * s, 0],
      armL: [-0.78 + 0.1 * c, 0.15, 0.1],
      armR: [-0.95 + 0.1 * c, -0.1, -0.12],
      foreL: [-0.6, -0.2, 0],
      foreR: [-0.5, 0.2, 0],
      legL: [-0.1 * c, 0, 0],
      legR: [0.1 * c, 0, 0],
    };
  }

  /** A light jog: shorter than the run, elbows bent, an easy bounce. */
  function jog(p) {
    const s = Math.sin(p * TAU);
    const c = Math.cos(p * TAU);
    return {
      rootY: 0.016 * Math.abs(c),
      legL: [0.65 * s, 0, 0],
      legR: [-0.65 * s, 0, 0],
      kneeL: [0.6 * Math.max(0, -c), 0, 0],
      kneeR: [0.6 * Math.max(0, c), 0, 0],
      armL: [-0.65 * s, 0, 0.1],
      armR: [0.65 * s, 0, -0.1],
      foreL: [-1.25, 0, 0],
      foreR: [-1.25, 0, 0],
      torso: [0.1, 0.1 * s, 0],
      head: [-0.05, -0.08 * s, 0],
    };
  }

  /** A kid's hop with both arms up (cheering at play). */
  function hop(p) {
    const up = Math.max(0, Math.sin(p * TAU));
    return {
      rootY: 0.07 * up,
      legL: [-0.25 * up, 0, 0.08],
      legR: [-0.25 * up, 0, -0.08],
      kneeL: [0.5 * up, 0, 0],
      kneeR: [0.5 * up, 0, 0],
      armL: [-0.3, 0, 2.3 - 0.4 * (1 - up)],
      armR: [-0.3, 0, -2.3 + 0.4 * (1 - up)],
      head: [-0.12, 0, 0],
      torso: [-0.05, 0, 0],
    };
  }

  /** A stride with the right arm hanging straight down to carry a shopping bag. */
  function walkbag(p) {
    const s = Math.sin(p * TAU);
    const c = Math.cos(p * TAU);
    return {
      rootY: 0.008 * Math.abs(c),
      legL: [0.45 * s, 0, 0],
      legR: [-0.45 * s, 0, 0],
      kneeL: [0.33 * Math.max(0, -c), 0, 0],
      kneeR: [0.33 * Math.max(0, c), 0, 0],
      armL: [-0.38 * s, 0, 0.08],
      armR: [-0.06 + 0.04 * s, 0, -0.14],
      foreR: [-0.12, 0, 0],
      torso: [0.03, 0.04 * s, -0.04],
      head: [0, -0.04 * s, 0],
    };
  }

  /** Strolling past the shop fronts: a slow look from side to side, hands behind or in front. */
  function browse(p) {
    const s = Math.sin(p * TAU);
    return {
      torso: [0.05, 0.1 * s, 0],
      head: [0.04, 0.55 * s, 0],
      armL: [-0.3, 0, 0.14],
      foreL: [-0.95, -0.35, 0],
      armR: [-0.3, 0, -0.14],
      foreR: [-0.95, 0.35, 0],
    };
  }

  /** Pedalling a small bicycle: leaning forward, both hands on the bars, legs turning the cranks. */
  function pedal(p) {
    const s = Math.sin(p * TAU);
    const c = Math.cos(p * TAU);
    return {
      torso: [0.36, 0, 0],
      head: [-0.22, 0, 0],
      legL: [-0.95 + 0.42 * s, 0, 0],
      legR: [-0.95 - 0.42 * s, 0, 0],
      kneeL: [1.1 - 0.5 * c, 0, 0],
      kneeR: [1.1 + 0.5 * c, 0, 0],
      armL: [-1.15, 0, 0.14],
      armR: [-1.15, 0, -0.14],
      foreL: [-0.2, -0.1, 0],
      foreR: [-0.2, 0.1, 0],
    };
  }

  /** The new poses by name, and the loop speed (cycles per second) each one reads best at. */
  F.CROWD_POSES = {
    wait: wait,
    phone: phone,
    sitphone: sitphone,
    listen: listen,
    sittalk: sittalk,
    order: order,
    taiji: taiji,
    sweep: sweep,
    jog: jog,
    hop: hop,
    walkbag: walkbag,
    browse: browse,
    pedal: pedal,
  };
  F.CROWD_RATES = {
    wait: 0.12,
    phone: 0.2,
    sitphone: 0.2,
    listen: 0.3,
    sittalk: 0.5,
    order: 0.18,
    taiji: 0.1,
    sweep: 0.7,
    jog: 2.2,
    hop: 1.3,
    walkbag: 1.5,
    browse: 0.16,
    pedal: 1.5,
  };
  Object.keys(F.CROWD_POSES).forEach(function (name) {
    F.POSES[name] = F.CROWD_POSES[name];
  });
})((window.KQ = window.KQ || {}));
