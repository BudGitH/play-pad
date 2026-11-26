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
    s.time = (s.time || 0) + dt;
    P.Clutter.animateSteam(s.ctx.steamSprites, s.time);
    const pole = s.areas.barber.pole.material.map;
    pole.offset.y = (pole.offset.y + dt * 0.35) % 1;
  }

  /**
   * Roaming lights: a fixed handful of real point lights that sit on the night lamps nearest
   * the shadow target (the player), so walls and figures near you are truly lit at night while
   * the rest of the town relies on emissive lamps + additive pools.
   */
  const ROAM = 4;
  function makeRoam(group, ctx) {
    const lights = [];
    for (let i = 0; i < ROAM; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      l.name = "roamLight" + i;
      group.add(l);
      lights.push(l);
    }
    const cands = ctx.lamps.map((p) => ({ x: p.x, y: p.y - 0.3, z: p.z, warm: true, r: 13 }));
    ctx.pools.forEach((p) =>
      cands.push({ x: p.x, y: (p.y || 3) - 0.15, z: p.z, warm: !!p.warm, r: 9 }),
    );
    return { lights, cands, at: new THREE.Vector3(1e9, 0, 0) };
  }
  function updateRoam(s) {
    const r = s.roam;
    const n = s.rig.night;
    const t = s.rig.target;
    if (n < 0.02) return r.lights.forEach((l) => (l.intensity = 0));
    if (r.at.distanceToSquared(t) > 0.5) {
      r.at.copy(t);
      r.cands.forEach((c) => (c.d = (c.x - t.x) ** 2 + (c.z - t.z) ** 2));
      r.pick = r.cands
        .slice()
        .sort((a, b) => a.d - b.d)
        .slice(0, ROAM);
    }
    const active = s.tier === "low" ? 2 : ROAM;
    r.lights.forEach((l, i) => {
      const c = r.pick[i];
      l.position.set(c.x, c.y, c.z);
      l.distance = c.r;
      l.color.setHex(c.warm ? 0xffd9a8 : 0xeef3ff);
      l.intensity = i < active ? 1.5 * n : 0;
    });
  }

  /** Apply sky + lights for a clock minute (also used by setMinute in the dev page). */
  function applyTime(s, minute) {
    P.Lighting.apply(s.rig, minute);
    P.Lighting.maybeBakeEnv(s.rig, minute, false);
    const n = s.rig.night;
    s.pools.material.opacity = 0.8 * n;
    s.pl.hawker.intensity = 1.6 * n;
    s.pl.hall.intensity = 0.9 + 0.9 * n;
    updateRoam(s);
  }

  function setQuality(s, tier) {
    s.tier = HINTS[tier] ? tier : "med";
    s.rig.tier = s.tier;
    P.Lighting.applyShadowTier(s.rig.sun, s.tier);
    P.Lighting.placeSun(s.rig);
    [s.inst.shrubs, s.inst.trees.leafCards].forEach((im) => {
      im.count = Math.round(im.userData.fullCount * HINTS[s.tier].propDensity);
      im.castShadow = s.tier !== "low";
    });
    P.Lighting.maybeBakeEnv(s.rig, s.minute, true);
    return HINTS[s.tier];
  }

  /** Build the public object from the internal state. */
  function runtime(st) {
    const s = Object.assign(st, { fanAngle: 0, minute: 420 });
    s.pools = s.group.getObjectByName("lampPools");
    s.roam = makeRoam(s.group, s.ctx);
    const pois = W.helpers.finishPois(st.nav.pois);
    const api = {
      group: s.group,
      pois,
      colliders: s.ctx.colliders,
      walkGraph: s.nav.graph,
      interactables: W.parts.interactables(s.areas),
      lights: {
        sun: s.rig.sun,
        hemi: s.rig.hemi,
        street: s.ctx.lamps.map((p) => ({ pos: p })),
        hall: s.pl.hall,
        hawker: s.pl.hawker,
        roaming: s.roam.lights,
      },
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
        updateRoam(s);
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
