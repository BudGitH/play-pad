/* Kampung Quest — runtime lighting rig (KQ.WorldParts.Lighting): sky dome, sun/moon with a
   tight PCF-soft shadow frustum that follows a target, hemisphere light, fog, PMREM
   environment re-baked as the light changes, and night glow for emissive materials. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const S = () => P.Sky;

  /** Shadow/env settings per quality tier. */
  const TIERS = {
    low: { map: 1024, span: 28, envEvery: 120, pixelRatio: 1 },
    med: { map: 2048, span: 36, envEvery: 45, pixelRatio: 1.5 },
    high: { map: 2048, span: 44, envEvery: 20, pixelRatio: 2 },
  };

  function makeSkyMesh(uniforms) {
    const mat = new THREE.ShaderMaterial({
      uniforms, vertexShader: S().VERT, fragmentShader: S().FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), mat);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    mesh.name = "sky";
    mesh.onBeforeRender = (r, s, cam) => {
      mesh.position.copy(cam.position);
      mesh.updateMatrixWorld();
    };
    return mesh;
  }

  function makeSun(tier) {
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.castShadow = true;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 260;
    applyShadowTier(sun, tier);
    return sun;
  }

  function applyShadowTier(sun, tier) {
    const t = TIERS[tier] || TIERS.med;
    const cam = sun.shadow.camera;
    cam.left = cam.bottom = -t.span;
    cam.right = cam.top = t.span;
    cam.updateProjectionMatrix();
    sun.shadow.mapSize.set(t.map, t.map);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
  }

  /** Create the rig and add it to `scene`. */
  function create(scene, renderer, tier) {
    const uniforms = {
      uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uNight: { value: 0 },
      uLinear: { value: 0 }, uSunVis: { value: 1 },
    };
    const rig = {
      tier, uniforms, renderer, scene,
      sky: makeSkyMesh(uniforms), sun: makeSun(tier),
      hemi: new THREE.HemisphereLight(0xffffff, 0x444444, 0.8),
      target: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 1, 0),
      night: 0, envMinute: -999, envRT: null, glow: [],
    };
    scene.add(rig.sky, rig.sun, rig.sun.target, rig.hemi);
    scene.fog = new THREE.Fog(0xcfe0ee, 70, 340);
    rig.pmrem = renderer ? new THREE.PMREMGenerator(renderer) : null;
    return rig;
  }

  /** Point the sun at the current target (snapped to shadow texels to reduce shimmer). */
  function placeSun(rig) {
    const t = TIERS[rig.tier] || TIERS.med;
    const texel = (t.span * 2) / t.map;
    const tx = Math.round(rig.target.x / texel) * texel;
    const tz = Math.round(rig.target.z / texel) * texel;
    rig.sun.target.position.set(tx, 0, tz);
    rig.sun.position.set(tx + rig.dir.x * 120, rig.dir.y * 120, tz + rig.dir.z * 120);
    rig.sun.target.updateMatrixWorld();
  }

  /** Apply sky colours, sun direction/colour, hemi, fog and glow for `minute`. */
  function apply(rig, minute) {
    const k = S().lerpKeys(minute);
    const sd = S().sunDirection(minute, rig.dir);
    const u = rig.uniforms;
    u.uZenith.value.copy(k.zenith);
    u.uHorizon.value.copy(k.horizon);
    u.uSunCol.value.copy(k.sun);
    u.uSunDir.value.copy(rig.dir);
    rig.night = S().nightFactor(minute);
    u.uNight.value = rig.night;
    u.uSunVis.value = sd.isMoon ? 0 : 1;
    rig.sun.color.copy(k.sun).convertSRGBToLinear();
    rig.sun.intensity = k.sunI;
    rig.hemi.color.copy(k.hemiSky).convertSRGBToLinear();
    rig.hemi.groundColor.copy(k.hemiGround).convertSRGBToLinear();
    rig.hemi.intensity = k.hemiI;
    rig.scene.fog.color.copy(k.horizon).lerp(k.zenith, 0.15);
    rig.scene.fog.far = 340 - rig.night * 80;
    rig.glow.forEach((g) => (g.mat.emissiveIntensity = g.base * rig.night));
    placeSun(rig);
  }

  /** Re-bake the PMREM environment from the sky when the light has moved enough. */
  function maybeBakeEnv(rig, minute, force) {
    if (!rig.pmrem) return;
    const every = (TIERS[rig.tier] || TIERS.med).envEvery;
    const due = force || rig.envMinute < -100 || (every > 0 && Math.abs(minute - rig.envMinute) >= every);
    if (!due) return;
    const envScene = new THREE.Scene();
    const sky = makeSkyMesh(rig.uniforms);
    sky.onBeforeRender = () => {};
    envScene.add(sky);
    rig.uniforms.uLinear.value = 1;
    const rt = rig.pmrem.fromScene(envScene, 0, 0.1, 100);
    rig.uniforms.uLinear.value = 0;
    sky.geometry.dispose();
    if (rig.envRT) rig.envRT.dispose();
    rig.envRT = rt;
    rig.scene.environment = rt.texture;
    rig.envMinute = minute;
  }

  P.Lighting = { create, apply, maybeBakeEnv, placeSun, applyShadowTier, TIERS };
})((window.KQ = window.KQ || {}));
