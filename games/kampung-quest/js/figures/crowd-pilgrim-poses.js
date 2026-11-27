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

  /** The walk with some joints replaced (the legs and the swing of everything else stay). */
  function walking(over) {
    return function (p, d) {
      return Object.assign(F.POSES.walk(p, d), over(p, d));
    };
  }

  /** An elder's walk: bent forward, head down, the right hand on a stick (arm steady). */
  const walkStoop = walking((p) => ({
    torso: [0.3, 0, 0],
    head: [0.22, 0, 0],
    armR: [-0.18, 0, -0.12],
    foreR: [-0.4, 0, 0],
    armL: [0.1 * Math.sin(p * Math.PI * 2), 0, 0.16],
  }));

  /** Pushing a wheelchair or a cart: both hands forward on the handles, leaning in a little. */
  const push = walking(() => ({
    torso: [0.1, 0, 0],
    armL: [-0.95, 0, 0.14],
    armR: [-0.95, 0, -0.14],
    foreL: [-0.45, 0, 0],
    foreR: [-0.45, 0, 0],
  }));

  /** A parent walking with a child: the right arm out and down, hand open for the child. */
  const walkHold = walking(() => ({ armR: [-0.1, 0, -0.55], foreR: [-0.2, 0, 0] }));

  /** A small child holding a parent's hand: the left arm raised out to the side. */
  const walkHoldKid = walking(() => ({ armL: [-0.1, 0, 1.0], foreL: [-0.1, 0, 0] }));

  /** Carrying a baby: both forearms folded across the chest. */
  const carry = walking(() => ({
    armL: [-0.8, 0, 0.22],
    armR: [-0.8, 0, -0.22],
    foreL: [-1.55, -0.6, 0],
    foreR: [-1.55, 0.6, 0],
  }));

  /** A tour guide leading: the right arm forward holding the pole, the left arm swinging. */
  const guide = walking((p) => ({
    armR: [-1.0, 0, -0.25],
    foreR: [-0.6, 0, 0],
    armL: [0.4 * Math.sin(p * Math.PI * 2), 0, 0.14],
  }));

  /** Drinking from a cup: the right hand at the mouth, head tipped back a little. */
  function drink(p) {
    const s = Math.sin(p * Math.PI * 2);
    return {
      head: [-0.18, 0, 0],
      armR: [-1.25 + 0.04 * s, 0, -0.1],
      foreR: [-2.1, 0.25, 0],
      handR: [0, 0, -0.3],
      armL: [-0.16, 0, 0.2],
    };
  }

  /** Taking a photo: both hands up holding a phone in front of the face. */
  function photo(p) {
    return {
      torso: [-0.04, 0, 0],
      head: [0.02, 0, 0],
      armL: [-1.35, 0, 0.16],
      armR: [-1.35, 0, -0.16],
      foreL: [-1.35, -0.5, 0],
      foreR: [-1.35, 0.5, 0],
      handL: [-0.2, 0, 0.4],
      handR: [-0.2, 0, -0.4],
      hips: [0, 0.02 * Math.sin(p * Math.PI * 2), 0],
    };
  }

  /** Sitting on the floor with the legs stretched out, hands resting on the thighs, a quiet break. */
  function sitLegs(p, d) {
    const s = Math.sin(p * Math.PI * 2);
    return {
      rootY: 0.07 - d.hipH,
      torso: [-0.08 + 0.01 * s, 0, 0],
      head: [0.1, 0, 0],
      legL: [-Math.PI / 2, 0, 0.08],
      legR: [-Math.PI / 2, 0, -0.08],
      kneeL: [0.05, 0, 0],
      kneeR: [0.05, 0, 0],
      armL: [-0.5, 0, 0.14],
      armR: [-0.5, 0, -0.14],
      foreL: [-0.55, 0, 0],
      foreR: [-0.55, 0, 0],
    };
  }

  F.POSES.quran = quran;
  F.POSES.walk_stoop = walkStoop;
  F.POSES.push = push;
  F.POSES.walk_hold = walkHold;
  F.POSES.walk_hold_kid = walkHoldKid;
  F.POSES.carry = carry;
  F.POSES.guide = guide;
  F.POSES.drink = drink;
  F.POSES.photo = photo;
  F.POSES.sit_legs = sitLegs;
  F.POSES.dua_stand = duaStand;
  F.CROWD_RATES = F.CROWD_RATES || {};
  F.CROWD_RATES.quran = 0.12;
  ["walk_stoop", "push", "walk_hold", "walk_hold_kid", "carry", "guide"].forEach(
    (k) => (F.CROWD_RATES[k] = 1.2),
  );
  F.CROWD_RATES.drink = 0.2;
  F.CROWD_RATES.photo = 0.15;
  F.CROWD_RATES.sit_legs = 0.1;
  F.CROWD_RATES.dua_stand = 0.1;
})((window.KQ = window.KQ || {}));
