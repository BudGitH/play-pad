/* ============================================================================
 * FILE: exhaust.js
 * PURPOSE: Little puffs of exhaust from petrol and diesel vehicles (never electric ones): small soft grey
 *          sprites from the pipe that grow, rise and fade. Diesel is a little greyer and puffs more at pull-away.
 * BUSINESS CONTEXT: AC-P27 (features/kampung-quest-playability/requirements.md). Owner request "even exhaust being released if it is a diesel or petrol vehicle".
 * COST: ONE pooled THREE.Points (a custom shader gives each puff its own size and fade) = one draw call for every
 *   vehicle, and none when no puff is alive. The pool is capped per tier, vehicles farther than RANGE from the
 *   camera emit nothing, and puffs are plain data (no per-puff objects).
 * RIG API used: rig.exhaust {pos (local), fuel} (vehicle-rig.js falls back to the model's size and a default fuel).
 * DEPENDENCIES: vehicle-rig.js, KQ.Sim.VehicleLife (rates, looks, ageing), the THREE scene (G.S.scene).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const VL = () => KQ.Sim.VehicleLife;
  /** Puffs alive at most, by tier; vehicles farther than RANGE (m) from the hero emit nothing. */
  const POOL = { low: 56, med: 90, high: 128 };
  const RANGE = 38;
  /** A new puff drifts back at this speed (m/s) with a little scatter. */
  const BACK = 0.55;
  const SCATTER = 0.25;
  /** Largest point on screen (px). */
  const MAX_PX = 56;
  const X = {
    pts: null,
    geo: null,
    cap: 0,
    list: [],
    rng: Math.random,
    spawned: 0,
    byFuel: { petrol: 0, diesel: 0, electric: 0 },
    rejected: 0,
    silent: 0,
    alive: 0,
  };

  const VERT = `
    attribute float aSize; attribute float aAlpha; attribute float aPale;
    uniform float uScale; varying float vAlpha; varying float vPale;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = min(${MAX_PX.toFixed(1)}, aSize * uScale / max(0.2, -mv.z));
      vAlpha = aAlpha; vPale = aPale;
    }`;
  const FRAG = `
    precision mediump float;
    uniform float uNight; varying float vAlpha; varying float vPale;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = vAlpha * (1.0 - smoothstep(0.12, 0.5, d));
      if (a < 0.01) discard;
      vec3 c = vec3(vPale) * (1.0 - 0.55 * uNight);
      gl_FragColor = vec4(c, a);
    }`;

  /** Build the pool: one Points object, `cap` vertices, drawn only while a puff is alive. */
  function build(cap) {
    const geo = new THREE.BufferGeometry();
    const attr = (name, n) => {
      const a = new THREE.BufferAttribute(new Float32Array(cap * n), n);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
    };
    attr("position", 3);
    attr("aSize", 1);
    attr("aAlpha", 1);
    attr("aPale", 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 }, uNight: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.name = "exhaust";
    pts.frustumCulled = false;
    pts.visible = false;
    pts.renderOrder = 3;
    return { pts, geo };
  }

  /** Create the pool on first use. */
  function ensure() {
    const s = G.S;
    if (X.pts || !s || !s.scene) return Boolean(X.pts);
    X.cap = POOL[s.quality] || POOL.med;
    const b = build(X.cap);
    X.pts = b.pts;
    X.geo = b.geo;
    s.scene.add(b.pts);
    return true;
  }

  /** Start a puff at a world point going back from heading `h`. */
  function spawn(at, h, look, fuel) {
    if (X.list.length >= X.cap) {
      X.rejected += 1;
      return;
    }
    const sc = (X.rng() - 0.5) * 2 * SCATTER;
    X.list.push({
      x: at.x,
      y: at.y,
      z: at.z,
      vx: -Math.sin(h) * BACK + sc,
      vz: -Math.cos(h) * BACK + (X.rng() - 0.5) * SCATTER,
      age: 0,
      size: look.size * (0.85 + X.rng() * 0.3),
      pale: look.pale,
    });
    X.spawned += 1;
    X.byFuel[fuel] = (X.byFuel[fuel] || 0) + 1;
  }

  /**
   * One vehicle's emission for dt: counts the puffs owed (the rate follows speed and acceleration) and spawns them.
   * @param {object} v the vehicle record ({sim, mesh, y, life}), @param {number} accel signed m/s^2
   * @param {boolean} engine
   */
  function emit(v, dt, accel, engine) {
    const ex = G.Rig.exhaustOf(v);
    if (!ex) return 0;
    const rate = VL().puffRate(ex.fuel, v.sim.speed, accel, engine);
    const look = VL().puffLook(ex.fuel);
    if (!look) {
      if (engine) {
        X.silent += 1; // an electric vehicle with its engine on: seen, never puffs
        v.silent = (v.silent || 0) + 1;
      }
      return 0;
    }
    v.puffAcc = (v.puffAcc || 0) + rate * dt;
    let n = 0;
    while (v.puffAcc >= 1) {
      v.puffAcc -= 1;
      spawn(G.Rig.toWorld(v, ex.x, ex.y, ex.z), v.sim.heading, look, ex.fuel);
      n += 1;
    }
    v.puffs = (v.puffs || 0) + n; // per vehicle, for tests
    return n;
  }

  /** Age every puff and write the attribute arrays. */
  function age(dt) {
    const g = X.geo;
    const pos = g.attributes.position.array;
    const size = g.attributes.aSize.array;
    const alpha = g.attributes.aAlpha.array;
    const pale = g.attributes.aPale.array;
    const next = [];
    X.list.forEach(function (p) {
      p.age += dt;
      const a = VL().puffAt(p.age, p.size);
      if (!a.alive) return;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.vx *= 1 - Math.min(1, 1.6 * dt);
      p.vz *= 1 - Math.min(1, 1.6 * dt);
      const i = next.length;
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y + a.rise;
      pos[i * 3 + 2] = p.z;
      size[i] = a.size;
      alpha[i] = a.alpha;
      pale[i] = p.pale;
      next.push(p);
    });
    X.list = next;
    X.alive = next.length;
    g.setDrawRange(0, next.length);
    ["position", "aSize", "aAlpha", "aPale"].forEach((k) => (g.attributes[k].needsUpdate = true));
  }

  /** The pixels-per-metre scale the shader needs (so the size follows the camera and the pixel ratio). */
  function rescale() {
    const s = G.S;
    const h = s.renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    const fov = (s.camera.fov * Math.PI) / 180;
    const u = X.pts.material.uniforms;
    u.uScale.value = h / (2 * Math.tan(fov / 2));
    u.uNight.value = s.world && s.world.night ? s.world.night() : 0;
  }

  /**
   * Step the exhaust: emit for the given vehicles (those near the hero) and age the pool.
   * @param {number} dt seconds
   * @param {{v:object, accel:number, engine:boolean}[]} emitters
   * @param {{x:number,z:number}} hero
   */
  function update(dt, emitters, hero) {
    if (!ensure()) return;
    emitters.forEach(function (e) {
      const d = Math.hypot(e.v.sim.x - hero.x, e.v.sim.z - hero.z);
      if (d <= RANGE) emit(e.v, dt, e.accel, e.engine);
    });
    age(dt);
    X.pts.visible = X.alive > 0;
    if (X.pts.visible) rescale();
  }

  /** Test hook: live puffs, totals by fuel, whether the points are drawn. */
  function debug() {
    return {
      ready: Boolean(X.pts),
      alive: X.alive,
      cap: X.cap,
      spawned: X.spawned,
      byFuel: Object.assign({}, X.byFuel),
      rejected: X.rejected,
      silent: X.silent,
      drawn: Boolean(X.pts && X.pts.visible),
      drawCalls: X.pts && X.pts.visible ? 1 : 0,
    };
  }

  /** Test hook: seed the random source (a function 0..1) or reset the counters. */
  function seed(rng) {
    if (rng) X.rng = rng;
  }

  G.Exhaust = { update, emit, debug, seed, RANGE };
})((window.KQ = window.KQ || {}));
