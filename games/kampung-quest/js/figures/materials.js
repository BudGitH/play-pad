// Kampung Quest — figure materials: glossy injection-moulded ABS plastic + a procedural studio env map.
// One MeshPhysicalMaterial per figure atlas (shared by every instance of the same cast spec). Base colours
// come from vertex colours; the atlas only carries the printed face / torso. A tiny shader patch adds a
// triplanar micro-texture (orange-peel normal jitter + roughness variation) and a warm skin glow.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});

  const MICRO_SIZE = 128;
  let microTexture = null;
  const materialCache = {};
  const envCache = typeof WeakMap === "function" ? new WeakMap() : null;

  /** A hex colour converted to linear space (vertex colours must match sRGB-decoded textures). */
  F.lin = function (hex) {
    return new THREE.Color(hex).convertSRGBToLinear();
  };

  /** Fill an ImageData buffer with smooth-ish value noise: rgb = normal jitter, b also drives roughness. */
  function fillMicroNoise(data, size) {
    let seed = 1337;
    function rnd() {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    }
    for (let i = 0; i < size * size; i++) {
      const sink = rnd() > 0.985 ? 40 : 0; // rare sink marks, like real moulded parts
      data[i * 4] = 110 + rnd() * 36;
      data[i * 4 + 1] = 110 + rnd() * 36;
      data[i * 4 + 2] = Math.max(0, 128 + (rnd() - 0.5) * 70 - sink);
      data[i * 4 + 3] = 255;
    }
  }

  /** The shared micro-surface texture (generated once, tiled triplanar in the shader). */
  function getMicroTexture() {
    if (microTexture) return microTexture;
    const c = document.createElement("canvas");
    c.width = c.height = MICRO_SIZE;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(MICRO_SIZE, MICRO_SIZE);
    fillMicroNoise(img.data, MICRO_SIZE);
    ctx.putImageData(img, 0, 0);
    // soften so the jitter reads as orange-peel, not sand
    ctx.filter = "blur(1.2px)";
    ctx.drawImage(c, 0, 0);
    microTexture = new THREE.CanvasTexture(c);
    microTexture.wrapS = microTexture.wrapT = THREE.RepeatWrapping;
    return microTexture;
  }

  const VERT_HEAD =
    "#include <common>\nattribute float aSkin;\nvarying float vSkin;\nvarying vec3 vKqPos;\nvarying vec3 vKqNrm;";
  const VERT_BODY = "#include <begin_vertex>\nvSkin = aSkin;\nvKqPos = position;\nvKqNrm = normal;";
  const FRAG_HEAD = [
    "#include <common>",
    "uniform sampler2D kqMicro;",
    "uniform float kqMicroAmt;",
    "uniform vec3 kqSkinGlow;",
    "varying float vSkin;",
    "varying vec3 vKqPos;",
    "varying vec3 vKqNrm;",
    "vec3 kqTri(vec3 p, vec3 n) {",
    "  vec3 w = abs(n); w /= (w.x + w.y + w.z + 1e-4);",
    "  return texture2D(kqMicro, p.yz * 21.0).rgb * w.x + texture2D(kqMicro, p.xz * 21.0).rgb * w.y",
    "    + texture2D(kqMicro, p.xy * 21.0).rgb * w.z;",
    "}",
  ].join("\n");
  // Mould details: a faint parting line where the two mould halves meet (the part's z = 0 plane, so it
  // runs round the sides of torsos, legs, arms and over the top of head pieces) and a little edge wear
  // (lighter, slightly rougher plastic on high-curvature bevels such as shoulders and hat rims).
  const FRAG_COLOR = [
    "#include <color_fragment>",
    "float kqSeam = (1.0 - smoothstep(0.0006, 0.0016, abs(vKqPos.z))) * step(0.5, length(vKqNrm.xy));",
    "float kqCurv = clamp(length(fwidth(vKqNrm)) / max(length(fwidth(vKqPos)) * 90.0, 1e-5), 0.0, 1.0);",
    "kqCurv = smoothstep(0.35, 1.0, kqCurv);",
    "diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.12 + 0.025, kqCurv * 0.45);",
    "diffuseColor.rgb *= 1.0 - kqSeam * 0.22;",
  ].join("\n");
  const FRAG_ROUGH =
    "#include <roughnessmap_fragment>\nvec3 kqM = kqTri(vKqPos, vKqNrm);\n" +
    "roughnessFactor = clamp(roughnessFactor * (0.78 + 0.44 * kqM.b) + kqCurv * 0.12 + kqSeam * 0.25, 0.04, 1.0);";
  const FRAG_NORMAL =
    "#include <normal_fragment_maps>\nnormal = normalize(normal + (kqM - 0.5) * kqMicroAmt);";
  const FRAG_EMIT =
    "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vSkin * kqSkinGlow * diffuseColor.rgb;";

  /** Inject the micro-texture + skin warmth into a MeshPhysicalMaterial (same program for every figure). */
  function patchPlastic(mat) {
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.kqMicro = { value: getMicroTexture() };
      shader.uniforms.kqMicroAmt = { value: 0.11 };
      shader.uniforms.kqSkinGlow = { value: new THREE.Color(0.2, 0.07, 0.035) };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", VERT_HEAD)
        .replace("#include <begin_vertex>", VERT_BODY);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", FRAG_HEAD)
        .replace("#include <color_fragment>", FRAG_COLOR)
        .replace("#include <roughnessmap_fragment>", FRAG_ROUGH)
        .replace("#include <normal_fragment_maps>", FRAG_NORMAL)
        .replace("#include <emissivemap_fragment>", FRAG_EMIT);
    };
    mat.customProgramCacheKey = function () {
      return "kq-plastic-v2";
    };
  }

  /**
   * The glossy ABS material for one figure atlas. Cached per key so every instance of a spec shares it.
   * @param {string} key cache key (the cast spec id)
   * @param {THREE.Texture} atlas printed face/torso atlas (sRGB)
   */
  F.plasticMaterial = function (key, atlas) {
    if (materialCache[key]) return materialCache[key];
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: atlas,
      vertexColors: true,
      roughness: 0.27,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      ior: 1.54,
      specularIntensity: 1,
      envMapIntensity: 1,
    });
    mat.name = "kq-plastic-" + key;
    patchPlastic(mat);
    materialCache[key] = mat;
    return mat;
  };

  /** A big inverted sphere with a warm-ceiling / neutral-wall / dark-floor gradient in vertex colours. */
  function envDome() {
    const g = new THREE.SphereGeometry(10, 32, 16);
    const pos = g.attributes.position;
    const cols = [];
    const top = new THREE.Color(0.6, 0.56, 0.5);
    const mid = new THREE.Color(0.26, 0.22, 0.19);
    const low = new THREE.Color(0.05, 0.035, 0.025);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / 10;
      if (t > 0) c.copy(mid).lerp(top, Math.pow(t, 0.7));
      else c.copy(mid).lerp(low, Math.min(1, -t * 2.2));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    return new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }),
    );
  }

  /** An emissive rectangle used as a softbox / window / ceiling strip in the env scene. */
  function envPanel(w, h, intensity, tint, pos, lookAt) {
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(tint).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.lookAt(lookAt[0], lookAt[1], lookAt[2]);
    return mesh;
  }

  /** Build the tiny procedural "room" that PMREM turns into the reflection environment. */
  function envScene() {
    const s = new THREE.Scene();
    s.add(envDome());
    s.add(envPanel(6, 4, 9, 0xdfe9ff, [-9, 2.5, 2], [0, 1, 0])); // big cool window, left
    s.add(envPanel(1.1, 9, 12, 0xfff1dc, [0, 9.4, -1], [0, 0, -1])); // warm ceiling strip
    s.add(envPanel(1.4, 9, 6, 0xfff1dc, [3.5, 9.4, 2], [3.5, 0, 2]));
    s.add(envPanel(2.4, 2.4, 10, 0xffffff, [6, 3.5, 7], [0, 1, 0])); // front-right softbox (catch-light)
    s.add(envPanel(5, 1.2, 1.2, 0xffd7a8, [3, 0.8, -9], [0, 1, 0])); // warm low bounce, behind
    return s;
  }

  /**
   * A small PMREM studio environment for glossy plastic (cached per renderer). Use as scene.environment.
   * @param {THREE.WebGLRenderer} renderer
   * @returns {THREE.Texture}
   */
  F.makeEnv = function (renderer) {
    if (envCache && envCache.has(renderer)) return envCache.get(renderer);
    const gen = new THREE.PMREMGenerator(renderer);
    const scene = envScene();
    const tex = gen.fromScene(scene, 0.01).texture;
    gen.dispose();
    scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    if (envCache) envCache.set(renderer, tex);
    return tex;
  };
})((window.KQ = window.KQ || {}));
