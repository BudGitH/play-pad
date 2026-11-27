/* ============================================================================
 * FILE: holy-world.js
 * PURPOSE: Builds the Haramain world (KQ.Holy.buildWorld): the same contract object as the
 *          kampung's KQ.World.build (pois, colliders, walkGraph, interactables, update,
 *          setQuality, setShadowTarget, heightAt, ...) for Makkah and Madinah together. The
 *          sky, sun, shadows and night glow are the kampung's own modules (sky.js, lighting.js),
 *          so the time of day behaves the same. KQ.World.build hands over to this when
 *          KQ.region === "haramain".
 * BUSINESS CONTEXT: AC-H1 (loads with no console errors; scenery), perf budget (merged batches,
 *   instancing, a handful of lights).
 * DEPENDENCIES: holy-*.js, world.js (makeKit, makeHeightAt), world-runtime.js (HINTS), lighting.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const Holy = (KQ.Holy = KQ.Holy || {});
  /** Heavy static batches are split into ground cells so culling works (see Batch.build). */
  const CHUNK = { cell: 72, minTris: 7000 };
  const HALL = { x0: 565, x1: 635, z0: -30, z1: 30 };

  /** Invisible edge walls just outside a city's play rectangle. */
  function edges(list, b) {
    list.push(
      { minX: b.x0 - 3, maxX: b.x1 + 3, minZ: b.z0 - 3, maxZ: b.z0, kind: "edge" },
      { minX: b.x0 - 3, maxX: b.x1 + 3, minZ: b.z1, maxZ: b.z1 + 3, kind: "edge" },
      { minX: b.x0 - 3, maxX: b.x0, minZ: b.z0, maxZ: b.z1, kind: "edge" },
      { minX: b.x1, maxX: b.x1 + 3, minZ: b.z0, maxZ: b.z1, kind: "edge" },
    );
  }

  /** Additive halos around every lamp head (one Points draw call, faded in at night). */
  function halos(ctx) {
    if (!P.Patterns3 || !ctx.lamps.length) return null;
    const pos = [];
    ctx.lamps.forEach((l) => pos.push(l.x, l.y + 0.15, l.z));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      map: P.Patterns3.halo(),
      size: 2.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, mat);
    pts.name = "holyHalos";
    pts.renderOrder = 3;
    return pts;
  }

  /** Make every static mesh matrix-frozen (they never move). */
  function freeze(group) {
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      if (o.isMesh && o !== group) o.matrixAutoUpdate = false;
    });
  }

  /** The scenery steps, in order; each is named so the debug hook can list what exists. */
  function steps(c, group, mats, out) {
    const list = [
      ["haram", () => P.HolyHaram.build(c)],
      ["makkah", () => Object.assign(out, P.HolyMakkah.build(c))],
      ["nabawi", () => P.HolyNabawi.build(c, group, mats)],
      ["nabawiInside", () => P.HolyNabawiInside.build(c)],
      ["madinah", () => (out.mad = P.HolyMadinah.build(c))],
    ];
    const done = [];
    list.forEach((s) => {
      s[1]();
      done.push(s[0]);
    });
    return done;
  }

  /** Palms and hills as instanced meshes (both cities). */
  function instanced(group, mats, out, colliders) {
    const palms = out.palms.concat(out.mad.palms);
    P.HolyKit.palms(group, mats, palms, colliders);
    P.HolyKit.hills(group, mats, out.hills.concat(out.mad.hills));
  }

  /** Interior point lights that follow the hero inside the Prophet's Mosque hall (cheap warm light). */
  function interiorLights(group) {
    const lights = [0, 1, 2].map((i) => {
      const l = new THREE.PointLight(0xffe2b8, 0, 24, 1.6);
      l.name = "holyHall" + i;
      group.add(l);
      return l;
    });
    return lights;
  }

  /** Is (x, z) under the Nabawi hall roof? */
  function inHall(x, z) {
    return x > HALL.x0 && x < HALL.x1 && z > HALL.z0 && z < HALL.z1;
  }

  /** Move the hall lights with the hero (full strength inside, off outside). */
  function followHall(s, v) {
    const inside = inHall(v.x, v.z);
    const k = inside ? 1.3 : 0;
    const offs = [
      [0, 0],
      [9, -7],
      [-9, 7],
    ];
    s.hall.forEach((l, i) => {
      l.position.set(v.x + offs[i][0], 6.4, v.z + offs[i][1]);
      l.intensity += (k - l.intensity) * 0.25;
    });
  }

  /** Switch the active city: POI table and interactables are swapped in place (identity kept). */
  function setCity(s, city) {
    if (s.city === city) return false;
    s.city = city;
    Object.keys(s.pois).forEach((k) => delete s.pois[k]);
    Object.assign(s.pois, s.nav.pois[city]);
    s.interactables.length = 0;
    s.nav.interactables[city].forEach((it) => s.interactables.push(it));
    const G = KQ.Game;
    if (G && G.S && G.S.crowd) G.S.crowd.dests = null;
    return true;
  }

  /** Per-frame update: time of day, halos and glow. */
  function applyTime(s, minute) {
    P.Lighting.apply(s.rig, minute);
    P.Lighting.maybeBakeEnv(s.rig, minute, false);
    const n = s.rig.night;
    if (s.halos) s.halos.material.opacity = 0.85 * n;
  }

  /** Apply a quality tier (shadow map size / span); the light count never changes. */
  function setQuality(s, tier) {
    const hints = KQ.World.HINTS;
    s.tier = hints[tier] ? tier : "med";
    s.rig.tier = s.tier;
    P.Lighting.applyShadowTier(s.rig.sun, s.tier);
    P.Lighting.placeSun(s.rig);
    P.Lighting.maybeBakeEnv(s.rig, s.minute, false);
    return hints[s.tier];
  }

  /** Sunrise and sunset overrides, as the kampung world offers. */
  function sunApi(s) {
    return {
      setSunTimes(rise, set) {
        const r = P.Sky.setSunTimes(rise, set);
        applyTime(s, s.minute);
        P.Lighting.maybeBakeEnv(s.rig, s.minute, true);
        return r;
      },
      sunTimes: () => ({ rise: P.Sky.sun.rise, set: P.Sky.sun.set }),
    };
  }

  /** The contract object the game uses (same shape as KQ.World.build's result). */
  function runtime(s) {
    const api = {
      region: "haramain",
      group: s.group,
      pois: s.pois,
      colliders: s.colliders,
      walkGraph: s.nav.graph,
      interactables: s.interactables,
      lights: {
        sun: s.rig.sun,
        hemi: s.rig.hemi,
        street: s.lamps.map((p) => ({ pos: p })),
        hall: s.hall[0],
        roaming: [],
      },
      heightAt: s.heightAt,
      qualityHints: (tier) => KQ.World.HINTS[tier || s.tier],
      update(dt, clock) {
        s.minute = clock && typeof clock.minute === "number" ? clock.minute : s.minute;
        applyTime(s, s.minute);
        s.pigeons.update(dt || 0, s.hero);
      },
      setQuality: (tier) => setQuality(s, tier),
      setShadowTarget(v) {
        s.rig.target.set(v.x, 0, v.z);
        P.Lighting.placeSun(s.rig);
        s.hero = { x: v.x, z: v.z };
        setCity(s, Holy.cityOf(v.x));
        followHall(s, v);
      },
      night: () => s.rig.night,
      city: () => s.city,
      setCity: (c) => setCity(s, c),
      sites: s.sites,
      pigeons: s.pigeons.count,
    };
    return Object.assign(api, sunApi(s));
  }

  /** The internal state object the runtime closes over. */
  function makeState(o) {
    return {
      scene: o.scene,
      group: o.group,
      rig: o.rig,
      nav: o.nav,
      sites: o.sites,
      halos: o.hl,
      pigeons: o.pigeons,
      hero: null,
      minute: 420,
      tier: o.opts.quality || "high",
      colliders: o.ctx.colliders,
      lamps: o.ctx.lamps,
      pois: {},
      interactables: [],
      heightAt: KQ.World.parts.makeHeightAt(o.B.floors),
      hall: interiorLights(o.group),
    };
  }

  /** The sky / sun / shadow rig with the night-glow materials (including the hotel windows and clock). */
  function makeRig(scene, opts, mats) {
    // The marble and plaster are bright white: a lower exposure keeps them from washing out in the sun.
    if (opts.renderer) opts.renderer.toneMappingExposure = 0.72;
    const rig = P.Lighting.create(scene, opts.renderer, opts.quality || "high");
    const table = P.HolyKit.glowTable();
    rig.glow = Object.keys(table)
      .filter((k) => mats[k])
      .map((k) => ({ mat: mats[k], base: table[k] }));
    return rig;
  }

  /**
   * Build the whole Haramain world once.
   * @param scene the THREE scene; opts { quality, renderer, assetBase } like KQ.World.build.
   * @returns the world object (update, heightAt, pois, colliders, walkGraph, ...).
   */
  function buildWorld(scene, opts) {
    opts = opts || {};
    const kit = KQ.World.parts.makeKit(opts);
    P.HolyKit.extendMats(kit.mats);
    const B = new P.Batch(Object.assign({}, P.Materials.UV_SCALES, P.HolyKit.UV), CHUNK);
    B.floors = [];
    const group = new THREE.Group();
    group.name = "holyWorld";
    const ctx = { B, colliders: [], lamps: [], mats: kit.mats };
    const out = {};
    const sites = steps(ctx, group, kit.mats, out);
    instanced(group, kit.mats, out, ctx.colliders);
    B.build(kit.mats, group);
    const pigeons = P.HolyPigeons.build(group, kit.mats);
    const hl = halos(ctx);
    if (hl) group.add(hl);
    [P.HolyMakkah.BOUNDS, P.HolyMadinah.BOUNDS].forEach((b) => edges(ctx.colliders, b));
    freeze(group);
    scene.add(group);
    P.Sky.fromPrayerTimes();
    const rig = makeRig(scene, opts, kit.mats);
    const nav = P.HolyNav.build();
    const s = makeState({ scene, group, rig, nav, sites, ctx, B, opts, hl, pigeons });
    setCity(s, "makkah");
    const api = runtime(s);
    applyTime(s, s.minute);
    setQuality(s, s.tier);
    Holy.world = api;
    return api;
  }

  /** The title-screen camera at orbit angle `a`: circling the Kaaba at mid-morning. */
  function titleCamera(a) {
    return {
      pos: [Math.sin(a) * 40, 11, Math.cos(a) * 40],
      look: [0, 5, 0],
      target: { x: 0, z: 0 },
      minute: 640,
    };
  }

  Holy.buildWorld = buildWorld;
  Holy.titleCamera = titleCamera;
})((window.KQ = window.KQ || {}));
