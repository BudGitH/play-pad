/* ============================================================================
 * FILE: holy-pigeons.js
 * PURPOSE: Pigeons in the courtyards (KQ.WorldParts.HolyPigeons): flocks that wander and peck on the
 *          marble of the Prophet's Mosque courtyard, the Makkah plaza and the Haram courtyard, and
 *          flutter up and away when the hero walks close. One instanced mesh, one draw call.
 * BUSINESS CONTEXT: the owner's "more activity" follow-up (Madinah: pigeons in the courtyard).
 * DEPENDENCIES: geo.js (P.compose, P.instanced), holy-kit.js (tint).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  /** Flock centres [x, z, count]. */
  const FLOCKS = [
    [600, -62, 16],
    [566, -60, 12],
    [636, -64, 12],
    [600, -90, 10],
    [585, -36, 8],
    [-20, -76, 12],
    [22, -78, 10],
    [30, 30, 8],
    [-36, 8, 8],
  ];
  const SCARE = 2.4;
  const FLY_S = 2.2;

  /** Concatenate coloured, non-indexed geometries into one. */
  function merge(list) {
    const pos = [];
    const col = [];
    list.forEach(function (g) {
      const n = g.index ? g.toNonIndexed() : g;
      pos.push(...n.attributes.position.array);
      col.push(...n.attributes.color.array);
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    out.computeVertexNormals();
    return out;
  }

  /** A grey pigeon about 0.3 m long: body, head, beak, tail and folded wings. */
  function pigeonGeo() {
    const T = P.HolyKit.tint;
    const sph = (s, p, hex) =>
      T(new THREE.SphereGeometry(1, 8, 6).scale(s[0], s[1], s[2]).translate(p[0], p[1], p[2]), hex);
    const box = (s, p, hex) =>
      T(new THREE.BoxGeometry(s[0], s[1], s[2]).translate(p[0], p[1], p[2]), hex);
    return merge([
      sph([0.065, 0.06, 0.11], [0, 0.1, 0], 0x8f949c),
      sph([0.04, 0.04, 0.045], [0, 0.17, 0.1], 0x6f7580),
      box([0.012, 0.012, 0.03], [0, 0.165, 0.15], 0xd9a03a),
      box([0.07, 0.012, 0.09], [0, 0.1, -0.14], 0x6f7580),
      box([0.03, 0.025, 0.12], [-0.065, 0.11, -0.01], 0x767c86),
      box([0.03, 0.025, 0.12], [0.065, 0.11, -0.01], 0x767c86),
    ]);
  }

  /** The matrix of one pigeon at time t: wander, peck, or fly away from the hero. */
  function place(b, t, hero) {
    const w = b.ph;
    let x = b.hx + Math.sin(t * 0.31 + w) * 0.7;
    let z = b.hz + Math.cos(t * 0.27 + w * 1.3) * 0.7;
    let y = 0.1;
    let pitch = 0.55 * Math.pow(Math.max(0, Math.sin(t * 2.1 + w * 4)), 4);
    if (b.fly > 0) {
      const u = 1 - b.fly / FLY_S;
      x = b.fx + (b.tx - b.fx) * u;
      z = b.fz + (b.tz - b.fz) * u;
      y = 0.1 + Math.sin(Math.PI * u) * 1.1;
      pitch = -0.35;
    } else if (hero && Math.hypot(hero.x - x, hero.z - z) < SCARE) {
      const d = Math.hypot(x - hero.x, z - hero.z) || 1;
      Object.assign(b, {
        fly: FLY_S,
        fx: x,
        fz: z,
        tx: x + ((x - hero.x) / d) * 4.5,
        tz: z + ((z - hero.z) / d) * 4.5,
      });
    }
    const ry = b.fly > 0 ? Math.atan2(b.tx - b.fx, b.tz - b.fz) : (t * 0.05 + w * 6) % 6.283;
    return { x, y, z, ry, pitch };
  }

  /** One bird record per pigeon, spread in a loose disc round each flock centre. */
  function makeBirds() {
    const birds = [];
    FLOCKS.forEach(function (f, j) {
      for (let i = 0; i < f[2]; i += 1) {
        const a = (i * 2.399 + j) % 6.283;
        const r = 0.6 + 2.4 * Math.sqrt((i + 0.5) / f[2]) * 1.4;
        birds.push({
          hx: f[0] + Math.cos(a) * r,
          hz: f[1] + Math.sin(a) * r,
          ph: (i * 0.37 + j * 1.7) % 6.283,
          fly: 0,
        });
      }
    });
    return birds;
  }

  /** Every pigeon within `r` m of (x, z) takes off and flutters away (a world event); how many did. */
  function burstBirds(birds, x, z, r) {
    let n = 0;
    birds.forEach(function (b, i) {
      if (b.fly > 0 || Math.hypot(b.hx - x, b.hz - z) > r) return;
      const a = (i * 2.399) % 6.283;
      const away = {
        fly: FLY_S,
        fx: b.hx,
        fz: b.hz,
        tx: b.hx + Math.cos(a) * 6,
        tz: b.hz + Math.sin(a) * 6,
      };
      Object.assign(b, away);
      n += 1;
    });
    return n;
  }

  /** Build the flocks: returns { mesh, update(dt, hero) }. */
  function build(group, mats) {
    const birds = makeBirds();
    const mesh = P.instanced(
      pigeonGeo(),
      mats.frond.clone(),
      birds.map((b) => ({ x: b.hx, y: 0.1, z: b.hz })),
      { cast: false },
    );
    mesh.material.side = THREE.FrontSide;
    mesh.name = "holyPigeons";
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
    let t = 0;
    return {
      mesh,
      count: birds.length,
      burst: (x, z, r) => burstBirds(birds, x, z, r),
      update(dt, hero) {
        t += dt;
        birds.forEach(function (b, i) {
          if (b.fly > 0) {
            b.fly -= dt;
            if (b.fly <= 0) Object.assign(b, { hx: b.tx, hz: b.tz, fly: 0 });
          }
          const p = place(b, t, hero);
          mesh.setMatrixAt(i, P.compose(p.x, p.y, p.z, [p.pitch, p.ry, 0], 1, 1, 1));
        });
        mesh.instanceMatrix.needsUpdate = true;
      },
    };
  }

  P.HolyPigeons = { build, FLOCKS };
})((window.KQ = window.KQ || {}));
