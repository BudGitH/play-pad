/* ============================================================================
 * FILE: vehicle-lights.js
 * PURPOSE: Decides which lights a vehicle shows right now and tells its rig: brake lights when it slows or stands
 *          with the engine on, the white reverse light when it rolls backwards, the headlights from dusk, and the
 *          blinking indicators before a turn or a pull-in (traffic and the bus).
 * BUSINESS CONTEXT: owner request "the lights on the vehicles light up when they are stopping and going".
 *   The rules are pure (KQ.Sim.VehicleLife.lightsFor); this file only measures the vehicle's acceleration,
 *   remembers what is lit and calls rig.lights.* when something changes (indicators every frame while they blink).
 * RIG API used: rig.lights.setBrake / setHead / setReverse / setIndicator("L"|"R"|null, t) (a no-op when absent).
 * DEPENDENCIES: vehicle-rig.js, KQ.Sim.VehicleLife, util.js, the world's night() (0..1).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const VL = () => KQ.Sim.VehicleLife;
  /** How quickly the measured acceleration settles (1/s): quick enough to light the brake at once, calm enough not to flicker. */
  const ACC_FOLLOW = 10;

  /** The lights record kept on a vehicle (created on first use). */
  function recordOf(v) {
    if (!v.life) {
      v.life = {
        prev: v.sim.speed,
        acc: 0,
        brake: false,
        reverse: false,
        head: false,
        indicator: null,
        engine: false,
      };
    }
    return v.life;
  }

  /** The darkness of the day now, 0..1 (0 when the world cannot say). */
  function night() {
    const w = G.S && G.S.world;
    return w && typeof w.night === "function" ? w.night() : 0;
  }

  /** Smoothly measure the vehicle's acceleration (signed change of its speed, m/s^2). */
  function measure(L, v, dt) {
    if (dt <= 0) return;
    const raw = (v.sim.speed - L.prev) / dt;
    L.acc = U.damp(L.acc, raw, ACC_FOLLOW, dt);
    L.prev = v.sim.speed;
  }

  /** Tell the rig about the lamps that changed. */
  function apply(v, L, now) {
    const lights = G.Rig.lightsOf(v.mesh);
    if (now.brake !== L.brake) lights.setBrake(now.brake);
    if (now.reverse !== L.reverse) lights.setReverse(now.reverse);
    if (now.head !== L.head) lights.setHead(now.head);
    Object.assign(L, { brake: now.brake, reverse: now.reverse, head: now.head });
  }

  /** Blink the indicator: lit state follows the game time; the rig is told the side and the time every frame. */
  function indicate(v, L, side, t) {
    const lights = G.Rig.lightsOf(v.mesh);
    L.indicator = side;
    L.blink = side ? VL().blinkOn(t) : false;
    if (side || L.indicatorWas) lights.setIndicator(side, t);
    L.indicatorWas = Boolean(side);
  }

  /**
   * One step of a vehicle's lights.
   * @param {object} v a vehicle record ({sim, mesh, ...})
   * @param {number} dt seconds
   * @param {{engine:boolean, braking?:boolean, indicator?:string|null, t:number}} o engine on, held back by
   *   someone, the indicator side wanted, and the game time (for the blink)
   */
  function update(v, dt, o) {
    const L = recordOf(v);
    measure(L, v, dt);
    L.engine = Boolean(o.engine);
    const now = VL().lightsFor({
      speed: v.sim.speed,
      accel: L.acc,
      engine: L.engine,
      braking: o.braking,
      night: night(),
      headWas: L.head,
    });
    apply(v, L, now);
    indicate(v, L, o.indicator || null, o.t);
    return L;
  }

  /** Switch every lamp of a vehicle off (the engine stopped, the vehicle is parked and empty). */
  function allOff(v) {
    const L = recordOf(v);
    update(v, 0, { engine: false, indicator: null, t: 0 });
    L.prev = v.sim.speed;
    return L;
  }

  /** The lit state of a vehicle for tests: {brake, reverse, head, indicator, engine, rig}. */
  function state(v) {
    const L = recordOf(v);
    return {
      brake: L.brake,
      reverse: L.reverse,
      head: L.head,
      indicator: L.indicator,
      blink: Boolean(L.blink),
      engine: L.engine,
      rig: G.Rig.hasLights(v.mesh),
    };
  }

  G.VehicleLights = { update, allOff, state };
})((window.KQ = window.KQ || {}));
