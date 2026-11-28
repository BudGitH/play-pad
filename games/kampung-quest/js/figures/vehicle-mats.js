/* ============================================================================
 * FILE: vehicle-mats.js
 * PURPOSE: Kampung Quest — the vehicles' materials (F.VehicleMats).
 *          - trim(): ONE material for all of a vehicle's dark trim, chrome, rubber, interior and lamps. Each vertex
 *            carries a class in its aSkin attribute (F.VehicleParts.tag) and the shader picks roughness, metalness
 *            and glow from it, so a car's trim, lamps and interior are one draw call. The lamp classes light up by
 *            group from two per-vehicle uniforms (head, DRL, tail, brake | indicator L, indicator R, reverse,
 *            sign): turning a brake light on is a uniform write, no new light, no recompile (all vehicles share
 *            one shader program; each has its own material instance for its own lamp state).
 *          - paint(hex, tier): clearcoat paint (MeshPhysicalMaterial) on med / high, plain standard paint on low;
 *            silvers, greys and deep colours get a metallic flake. Shared per colour and tier.
 *          - roof(hex, tier): the same paint, one instance per vehicle (its roof fades while the hero drives).
 *          - glass(): tinted, slightly see-through glass with sky reflections (people inside show).
 * BUSINESS CONTEXT: owner's realism pass (lights that come on, clearcoat paint, see-through glass),
 *   features/kampung-quest-playability/notes-vehicles.md, "Realism pass".
 * DEPENDENCIES: THREE (r147). Reads scene.environment through the renderer (the sky's PMREM, world/lighting.js).
 * HOW TO TEST: npx playwright test tests/kampung-quest-vehicle-rig.spec.mjs (lamp levels change on setBrake ...)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});

  /** Material classes (the aSkin value of a vertex). Lamps are 10+, in the order of the two uniform vectors. */
  const CLS = {
    matte: 0,
    satin: 1,
    gloss: 2,
    chrome: 3,
    rubber: 4,
    lens: 5,
    head: 10,
    drl: 11,
    tail: 12,
    brake: 13,
    indL: 14,
    indR: 15,
    reverse: 16,
    sign: 17,
    screen: 18,
  };
  const cache = { paint: {} };

  const VERT_HEAD = "attribute float aSkin;\nvarying float vCls;\n";
  const FRAG_HEAD = [
    "varying float vCls;",
    "uniform vec4 uLampA;",
    "uniform vec4 uLampB;",
    "float kqLamp(float c) {",
    "  if (c < 9.5) return 0.0;",
    "  if (c < 10.5) return uLampA.x;",
    "  if (c < 11.5) return uLampA.y;",
    "  if (c < 12.5) return uLampA.z;",
    "  if (c < 13.5) return uLampA.w;",
    "  if (c < 14.5) return uLampB.x;",
    "  if (c < 15.5) return uLampB.y;",
    "  if (c < 16.5) return uLampB.z;",
    "  if (c < 17.5) return uLampB.w;",
    "  return 0.3;",
    "}",
    "",
  ].join("\n");
  const ROUGH = [
    "float kqC = floor(vCls + 0.5);",
    "roughnessFactor = kqC < 0.5 ? 0.62 : kqC < 1.5 ? 0.4 : kqC < 2.5 ? 0.1 : kqC < 3.5 ? 0.22 :",
    "  kqC < 4.5 ? 0.86 : 0.07;",
  ].join("\n");
  const METAL = "metalnessFactor = (kqC > 2.5 && kqC < 3.5) ? 0.92 : 0.0;";
  const GLOW = "totalEmissiveRadiance += diffuseColor.rgb * kqLamp(kqC) * 2.4;";

  /** Patch the standard shader: per-vertex class -> roughness, metalness and lamp glow. */
  function patch(shader, mat) {
    shader.uniforms.uLampA = mat.userData.uLampA;
    shader.uniforms.uLampB = mat.userData.uLampB;
    const v = shader.vertexShader;
    shader.vertexShader =
      VERT_HEAD + v.replace("#include <begin_vertex>", "#include <begin_vertex>\nvCls = aSkin;");
    shader.fragmentShader =
      FRAG_HEAD +
      shader.fragmentShader
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + ROUGH)
        .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n" + METAL)
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + GLOW);
  }

  /** A vehicle's own trim material (its lamp state lives in its uniforms). */
  function trim() {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
    m.userData.uLampA = { value: new THREE.Vector4(0, 0, 0, 0) };
    m.userData.uLampB = { value: new THREE.Vector4(0, 0, 0, 0) };
    m.onBeforeCompile = (shader) => patch(shader, m);
    m.customProgramCacheKey = () => "kq-vehicle-trim";
    m.name = "vehicle-trim";
    return m;
  }

  /** A trim material shared by the parts that never light up (wheels, a parked steering wheel). */
  function sharedTrim() {
    return cache.trim || (cache.trim = trim());
  }

  /** How metallic a paint colour is: silvers, greys and deep saturated colours have flake; white / black solid. */
  function flake(hex) {
    const hsl = new THREE.Color(hex).getHSL({});
    if (hsl.l > 0.86 || hsl.l < 0.1) return 0.08;
    return hsl.s < 0.15 ? 0.6 : 0.45;
  }

  /** A new paint material: clearcoat on med / high, plain on low. */
  function makePaint(hex, tier) {
    const metal = flake(hex);
    const o = {
      color: hex,
      vertexColors: true,
      roughness: metal > 0.3 ? 0.36 : 0.26,
      metalness: metal,
    };
    if (tier === "low") return new THREE.MeshStandardMaterial(o);
    return new THREE.MeshPhysicalMaterial(
      Object.assign(o, { clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.1 }),
    );
  }

  /** The shared paint of a colour on a tier. */
  function paint(hex, tier) {
    const key = hex + ":" + (tier === "low" ? "low" : "hi");
    return cache.paint[key] || (cache.paint[key] = makePaint(hex, tier));
  }

  /** The tinted glass (shared): dark, glossy, about 60 % see-through. */
  function glass() {
    if (cache.glass) return cache.glass;
    cache.glass = new THREE.MeshStandardMaterial({
      color: 0x16222b,
      roughness: 0.05,
      metalness: 0.25,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      envMapIntensity: 1.0,
    });
    return cache.glass;
  }

  F.VehicleMats = { CLS, trim, sharedTrim, paint, roof: makePaint, glass, flake };
})((window.KQ = window.KQ || {}));
