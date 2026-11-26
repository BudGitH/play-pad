/* Kampung Quest — world surface realism patch (KQ.WorldParts.Surface). One onBeforeCompile
   patch shared by every opaque world material (same program per variant, per-material
   uniforms):
   - baked occlusion from the AOField: sky visibility under roofs + contact darkening at wall /
     pillar / table footprints + darker ceiling corners, applied to indirect light only (as
     three's aoMap does), plus a warm bounce / interior-lamp fill in roofed areas;
   - world-space grunge from the Grunge atlas: macro colour variation, rain streaks and water
     stains on walls, rising-damp dirt at wall bases, grime patches / worn paint on floors;
   - wet patches: darker, glossy, flattened-normal puddles on roads, paving and wudu tiles;
   - an optional detail map (carpet fibres) multiplied over the base map.
   Per-material strengths live in material.userData.kq = [macro, streaks, wet, dirt]. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});

  /** Uniform objects shared by every patched material (updated by the runtime). */
  const SHARED = {
    kqAo: { value: null },
    kqAoO: { value: new THREE.Vector3(-80, -80, 160) },
    kqGrunge: { value: null },
    kqFill: { value: new THREE.Color(0.35, 0.3, 0.24) },
  };

  const VERT_HEAD = `
    varying vec3 vKqW;
    varying vec3 vKqN;`;
  const VERT_BODY = `
    vec4 kqWP = vec4( transformed, 1.0 );
    vec3 kqON = objectNormal;
    #ifdef USE_INSTANCING
      kqWP = instanceMatrix * kqWP;
      kqON = mat3( instanceMatrix ) * kqON;
    #endif
    kqWP = modelMatrix * kqWP;
    vKqW = kqWP.xyz;
    vKqN = normalize( mat3( modelMatrix ) * kqON );`;

  const FRAG_HEAD = `
    varying vec3 vKqW;
    varying vec3 vKqN;
    uniform sampler2D kqAo;
    uniform vec3 kqAoO;
    uniform sampler2D kqGrunge;
    uniform vec3 kqFill;
    uniform vec4 kqP;
    #ifdef KQ_DETAIL
      uniform sampler2D kqDetail;
      uniform float kqDetailScale;
    #endif`;

  /* After color_fragment: grunge, streaks, damp, wet darkening, detail map. */
  const FRAG_COLOR = `
    vec3 kqN = normalize( vKqN );
    float kqVert = 1.0 - smoothstep( 0.45, 0.8, abs( kqN.y ) );
    float kqH = mix( vKqW.x, vKqW.z, step( abs( kqN.z ), abs( kqN.x ) ) );
    vec4 kqA = texture2D( kqAo, ( vKqW.xz + kqN.xz * 0.6 * kqVert - kqAoO.xy ) / kqAoO.z );
    float kqRoof = kqA.a * 20.0;
    float kqUnder = 1.0 - smoothstep( kqRoof - 0.25, kqRoof - 0.02, vKqW.y );
    float kqOpen = mix( 1.0, smoothstep( 0.5, 0.9, kqA.r ), kqUnder );
    float kqM = 0.5;
    float kqPud = 0.0;
    #ifndef KQ_LITE
    vec2 kqUV = mix( vKqW.xz, vec2( kqH, vKqW.y ), kqVert );
    kqM = texture2D( kqGrunge, kqUV / 11.0 ).r;
    float kqF = texture2D( kqGrunge, kqUV / 1.9 + 0.31 ).b;
    float kqS = texture2D( kqGrunge, vec2( kqH / 3.3, vKqW.y / 7.0 ) ).g;
    vec3 kqT = vec3( mix( 1.0, 0.8 + 0.4 * kqM, kqP.x ) );
    kqT *= mix( 1.0, 0.88 + 0.24 * kqF, kqP.x * 0.6 );
    kqT *= 1.0 - kqP.y * kqVert * kqS * 0.5 * kqOpen;
    float kqBand = 1.0 - smoothstep( 0.12, 0.45 + 0.5 * kqF, vKqW.y );
    kqT *= mix( vec3( 1.0 ), vec3( 0.62, 0.56, 0.48 ), kqP.w * kqVert * kqBand );
    kqT *= 1.0 - kqP.w * ( 1.0 - kqVert ) * 0.45 * smoothstep( 0.5, 0.8, kqF );
    float kqWetN = texture2D( kqGrunge, vKqW.xz / 17.0 + 0.5 ).a;
    float kqWet = step( 1.2, kqP.z );
    kqPud = min( kqP.z, 1.0 ) * ( 1.0 - kqVert ) * max( smoothstep( 0.6, 0.7, kqWetN ), 0.55 * kqWet ) * max( kqOpen, kqWet );
    kqT *= 1.0 - min( kqP.z, 1.0 ) * ( 1.0 - kqVert ) * 0.3 * smoothstep( 0.66, 0.85, texture2D( kqGrunge, vKqW.xz / 4.3 ).r );
    kqT *= 1.0 - 0.4 * kqPud;
    diffuseColor.rgb *= kqT;
    #endif
    #ifdef KQ_DETAIL
      diffuseColor.rgb *= texture2D( kqDetail, vUv * kqDetailScale ).rgb * 2.0;
    #endif`;

  const FRAG_ROUGH = `
    roughnessFactor = mix( roughnessFactor * ( 0.85 + 0.3 * kqM ), 0.05, kqPud );`;

  const FRAG_NORMAL = `
    normal = normalize( mix( normal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ), kqPud * 0.9 ) );`;

  /* Replaces aomap_fragment: occlusion on indirect light + warm interior fill. */
  const FRAG_AO = `
    float kqSky = mix( 1.0, kqA.r, kqUnder );
    float kqTouch = mix( kqA.g, 1.0, smoothstep( 0.05, 0.85, vKqW.y ) );
    float kqCeil = kqUnder * kqVert * ( 1.0 - smoothstep( 0.0, 0.9, kqRoof - vKqW.y ) );
    float kqOcc = kqSky * kqTouch * ( 1.0 - 0.35 * kqCeil );
    reflectedLight.indirectDiffuse *= kqOcc;
    #if defined( USE_ENVMAP ) && defined( STANDARD )
      float kqNV = saturate( dot( geometry.normal, geometry.viewDir ) );
      reflectedLight.indirectSpecular *= computeSpecularOcclusion( kqNV, kqOcc, material.roughness );
    #endif
    reflectedLight.indirectDiffuse += diffuseColor.rgb * kqFill * kqA.b * kqUnder * kqTouch * ( 1.0 - 0.3 * kqCeil );
    #include <aomap_fragment>`;

  /** The shared onBeforeCompile (`this` is the material). */
  function onBeforeCompile(shader) {
    const ud = this.userData;
    Object.assign(shader.uniforms, SHARED, { kqP: { value: ud.kqVec } });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>" + VERT_HEAD)
      .replace("#include <project_vertex>", "#include <project_vertex>" + VERT_BODY);
    let fs = shader.fragmentShader
      .replace("#include <common>", "#include <common>" + FRAG_HEAD)
      .replace("#include <color_fragment>", "#include <color_fragment>" + FRAG_COLOR)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>" + FRAG_ROUGH)
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>" + FRAG_NORMAL)
      .replace("#include <aomap_fragment>", FRAG_AO);
    if (FLAGS.lite) fs = "#define KQ_LITE\n" + fs;
    if (ud.kqDetail) {
      fs = "#define KQ_DETAIL\n" + fs;
      shader.uniforms.kqDetail = { value: ud.kqDetail.map };
      shader.uniforms.kqDetailScale = { value: ud.kqDetail.scale };
    }
    shader.fragmentShader = fs;
  }
  function cacheKey() {
    return "kqSurface" + (this.userData.kqDetail ? "D" : "") + (FLAGS.lite ? "L" : "");
  }
  const FLAGS = { lite: false, mats: [] };

  /** Low tier: drop the grunge / wet layers (keeps the baked occlusion). Recompiles once. */
  function setLite(lite) {
    if (FLAGS.lite === !!lite) return;
    FLAGS.lite = !!lite;
    FLAGS.mats.forEach((m) => (m.needsUpdate = true));
  }

  /** Patch one material in place (idempotent). `params` = [macro, streaks, wet, dirt]. */
  function patch(mat, params) {
    if (!mat || !mat.isMeshStandardMaterial || mat.userData.kqPatched) return mat;
    if (mat.transparent || mat.userData.kqSkip) return mat;
    const p = params || mat.userData.kq || [0.3, 0, 0, 0.1];
    mat.userData.kqVec = new THREE.Vector4(p[0], p[1], p[2], p[3]);
    mat.userData.kqPatched = true;
    mat.onBeforeCompile = onBeforeCompile;
    mat.customProgramCacheKey = cacheKey;
    mat.needsUpdate = true;
    FLAGS.mats.push(mat);
    return mat;
  }

  /** Patch every opaque standard material under `root` and bind the shared textures. */
  function apply(root, field) {
    SHARED.kqAo.value = field.texture;
    SHARED.kqAoO.value.copy(field.origin);
    SHARED.kqGrunge.value = P.Grunge.texture();
    const seen = new Set();
    root.traverse((o) => {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => {
        if (!m || seen.has(m)) return;
        seen.add(m);
        patch(m);
      });
    });
    return seen.size;
  }

  /** Warm bounce by day, lamp-white fill at night (called from the runtime each update). */
  const DAY_FILL = new THREE.Color(0.2, 0.165, 0.12);
  const NIGHT_FILL = new THREE.Color(0.17, 0.16, 0.14);
  function setTime(night, sunI) {
    const day = Math.min(1, (sunI || 0) / 3.3);
    SHARED.kqFill.value.copy(DAY_FILL).multiplyScalar(0.25 + 0.75 * day);
    SHARED.kqFill.value.lerp(NIGHT_FILL, night);
  }

  P.Surface = { patch, apply, setTime, setLite, SHARED };
})((window.KQ = window.KQ || {}));
