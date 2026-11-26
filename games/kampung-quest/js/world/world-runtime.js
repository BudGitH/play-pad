/* Kampung Quest — the live world object returned by KQ.World.build (KQ.World.runtime):
   per-frame time-of-day update, quality tiers, shadow target, small animations. */
(function (KQ) {
  "use strict";
  const P = KQ.WorldParts;
  const W = (KQ.World = KQ.World || {});

  /** Renderer hints per tier (the game owns the renderer; the world only suggests). */
  const HINTS = {
    low: { pixelRatio: 1, shadowMapSize: 1024, antialias: false, propDensity: 0.4 },
    med: { pixelRatio: 1.5, shadowMapSize: 2048, antialias: true, propDensity: 0.75 },
    high: { pixelRatio: 2, shadowMapSize: 2048, antialias: true, propDensity: 1 },
  };

  /** Spin the hawker fans (instance matrices) and scroll the barber pole. */
  function animate(s, dt) {
    s.fanAngle = (s.fanAngle + dt * 5.5) % (Math.PI * 2);
    const fans = s.areas.hawker.fans;
    fans.list.forEach((f, i) => {
      fans.mesh.setMatrixAt(i, P.compose(f.x, f.y, f.z, f.ry + s.fanAngle, 1, 1, 1));
    });
    fans.mesh.instanceMatrix.needsUpdate = true;
    const pole = s.areas.barber.pole.material.map;
    pole.offset.y = (pole.offset.y + dt * 0.35) % 1;
  }

  /** Apply sky + lights for a clock minute (also used by setMinute in the dev page). */
  function applyTime(s, minute) {
    P.Lighting.apply(s.rig, minute);
    P.Lighting.maybeBakeEnv(s.rig, minute, false);
    const n = s.rig.night;
    s.pools.material.opacity = 0.55 * n;
    s.pl.hawker.intensity = 1.6 * n;
    s.pl.hall.intensity = 0.9 + 0.9 * n;
  }

  function setQuality(s, tier) {
    s.tier = HINTS[tier] ? tier : "med";
    s.rig.tier = s.tier;
    P.Lighting.applyShadowTier(s.rig.sun, s.tier);
    P.Lighting.placeSun(s.rig);
    const shrubs = s.inst.shrubs;
    shrubs.count = Math.round(shrubs.userData.fullCount * HINTS[s.tier].propDensity);
    P.Lighting.maybeBakeEnv(s.rig, s.minute, true);
    return HINTS[s.tier];
  }

  /** Build the public object from the internal state. */
  function runtime(st) {
    const s = Object.assign(st, { fanAngle: 0, minute: 420 });
    s.pools = s.group.getObjectByName("lampPools");
    const pois = W.helpers.finishPois(st.nav.pois);
    const api = {
      group: s.group,
      pois,
      colliders: s.ctx.colliders,
      walkGraph: s.nav.graph,
      interactables: W.parts.interactables(s.areas),
      lights: { sun: s.rig.sun, hemi: s.rig.hemi, street: s.ctx.lamps.map((p) => ({ pos: p })), hall: s.pl.hall, hawker: s.pl.hawker },
      heightAt: W.parts.makeHeightAt(s.B.floors),
      qualityHints: (tier) => HINTS[tier || s.tier],
      update(dt, clock) {
        s.minute = clock && typeof clock.minute === "number" ? clock.minute : s.minute;
        applyTime(s, s.minute);
        animate(s, dt || 0);
      },
      setQuality: (tier) => setQuality(s, tier),
      setShadowTarget(v) {
        s.rig.target.set(v.x, 0, v.z);
        P.Lighting.placeSun(s.rig);
      },
      night: () => s.rig.night,
    };
    applyTime(s, s.minute);
    setQuality(s, s.tier);
    return api;
  }

  W.runtime = runtime;
  W.HINTS = HINTS;
})((window.KQ = window.KQ || {}));
