/* Kampung Quest — sky, sun/moon, hemisphere light, fog and PMREM reflections driven by the
   game clock (KQ.WorldParts.Sky). Singapore, 26 Nov: sunrise ≈ 07:05, sunset ≈ 19:05; the sun
   rises in the east (+X), crosses the southern sky (+Z) at ≈ 68° and sets in the west (−X).
   The sky shader writes display (sRGB) colours, matching fog (docs/LEARNINGS.md 2026-11-21);
   for the PMREM bake it linearises instead. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const SUNRISE = 425;
  const SUNSET = 1145;

  /* minute → [zenith, horizon, sun colour, sun intensity, hemi sky, hemi ground, hemi intensity] */
  const KEYS = [
    [0, "#0b1330", "#1d2a4a", "#9fb4ff", 0.22, "#3a4f86", "#1a1c22", 0.32],
    [330, "#0b1330", "#1d2a4a", "#9fb4ff", 0.22, "#3a4f86", "#1a1c22", 0.32],
    [395, "#2a3d72", "#d79a7a", "#ffb27a", 0.25, "#6b7fb0", "#3a3430", 0.45],
    [440, "#4f7fc4", "#f2c49a", "#ffc58a", 1.6, "#9fb7dc", "#6b5a48", 0.7],
    [540, "#3f7fd0", "#bcd8ee", "#fff1dc", 2.9, "#b9d3f0", "#7d6e58", 0.85],
    [720, "#3576cf", "#c4dcf0", "#fffaf0", 3.3, "#c2daf4", "#857660", 0.9],
    [1020, "#3e7ccc", "#cfe0ee", "#fff0d6", 3.0, "#bcd3ec", "#7f6e58", 0.85],
    [1110, "#5a78b4", "#f3c38f", "#ffb46a", 1.9, "#b2b9d0", "#7a5e48", 0.7],
    [1150, "#3c4c86", "#f08a5a", "#ff8a4a", 0.55, "#8a86a8", "#4a3a34", 0.5],
    [1185, "#1b2552", "#6a4f74", "#a7b6ff", 0.2, "#4a5588", "#24222a", 0.38],
    [1250, "#0b1330", "#1d2a4a", "#9fb4ff", 0.22, "#3a4f86", "#1a1c22", 0.32],
    [1440, "#0b1330", "#1d2a4a", "#9fb4ff", 0.22, "#3a4f86", "#1a1c22", 0.32],
  ];

  const VERT = `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww;
    }`;
  const FRAG = `
    uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSunCol;
    uniform vec3 uSunDir; uniform float uNight; uniform float uLinear; uniform float uSunVis;
    varying vec3 vDir;
    float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
      float a = hash(vec3(i, 1.0)); float b = hash(vec3(i + vec2(1.0, 0.0), 1.0));
      float c = hash(vec3(i + vec2(0.0, 1.0), 1.0)); float d = hash(vec3(i + vec2(1.0), 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    float fbm(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
      col = mix(col, uGround, smoothstep(0.0, -0.12, h));
      float sd = max(dot(d, normalize(uSunDir)), 0.0);
      col += uSunCol * (pow(sd, 6.0) * 0.28 + pow(sd, 64.0) * 0.5) * uSunVis;
      col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.9993, 0.9997, sd) * uSunVis);
      if (h > 0.02) {
        vec2 uv = d.xz / (h + 0.18) * 2.2;
        float cl = smoothstep(0.52, 0.78, fbm(uv + vec2(3.1, 1.7)));
        vec3 cloudCol = mix(uHorizon * 1.08, vec3(1.0), 0.55 * (1.0 - uNight)) + uSunCol * pow(sd, 3.0) * 0.25;
        col = mix(col, cloudCol * mix(1.0, 0.35, uNight), cl * 0.85 * smoothstep(0.02, 0.25, h));
        float st = step(0.9985, hash(floor(d * 420.0))) * uNight * smoothstep(0.05, 0.3, h) * (1.0 - cl);
        col += vec3(st);
      }
      col = uLinear > 0.5 ? pow(col, vec3(2.2)) : col;
      gl_FragColor = vec4(col, 1.0);
    }`;

  function lerpKeys(minute) {
    const m = ((minute % 1440) + 1440) % 1440;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] <= m) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = (m - a[0]) / Math.max(1, b[0] - a[0]);
    const ca = new THREE.Color();
    const cb = new THREE.Color();
    const col = (k) => ca.setStyle(a[k], "srgb-linear").clone().lerp(cb.setStyle(b[k], "srgb-linear"), t);
    return {
      zenith: col(1), horizon: col(2), sun: col(3), sunI: a[4] + (b[4] - a[4]) * t,
      hemiSky: col(5), hemiGround: col(6), hemiI: a[7] + (b[7] - a[7]) * t,
    };
  }

  /** Unit vector towards the sun (or the moon at night, with `isMoon`). */
  function sunDirection(minute, out) {
    const day = minute >= SUNRISE - 20 && minute <= SUNSET + 20;
    if (!day) return { dir: out.set(-0.35, 0.85, 0.4).normalize(), isMoon: true, elev: -1 };
    const th = (Math.PI * (minute - SUNRISE)) / (SUNSET - SUNRISE);
    out.set(Math.cos(th), Math.sin(th) * 0.93, 0.08 + Math.sin(th) * 0.37);
    if (out.y < 0.06) out.y = 0.06; // keep the shadow camera sensible in twilight
    return { dir: out.normalize(), isMoon: false, elev: Math.sin(th) };
  }

  /** Night factor 0 (day) .. 1 (full night) from minute. */
  function nightFactor(minute) {
    const m = ((minute % 1440) + 1440) % 1440;
    const dawn = THREE.MathUtils.smoothstep(m, SUNRISE - 40, SUNRISE + 25);
    const dusk = 1 - THREE.MathUtils.smoothstep(m, SUNSET - 20, SUNSET + 35);
    return 1 - Math.min(dawn, dusk);
  }

  P.Sky = { KEYS, VERT, FRAG, lerpKeys, sunDirection, nightFactor, SUNRISE, SUNSET };
})((window.KQ = window.KQ || {}));
