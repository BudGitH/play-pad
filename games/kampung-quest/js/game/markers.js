/* ============================================================================
 * FILE: markers.js
 * PURPOSE: World markers: a tall floating beacon over the mission target (pink) and over the
 *          mosque when a prayer is due (green), a dotted footprint trail along the walk path to the
 *          mosque, and the star above mission givers. Also lists minimap markers.
 * BUSINESS CONTEXT: AC-11 (a world marker for the active mission), AC-7/AC-8 (guidance arrow to
 *   the mosque while a prayer is due), AC-15 (reduced motion: no bob / pulse; footprints appear
 *   at once and stay still).
 * DEPENDENCIES: THREE, util.js, pathing.js. Materials are unlit (toneMapped false).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const TRAIL_MAX = 26;

  function beaconMaterial(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
  }

  function makeBeacon(color) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 9, 18, 1, true),
      beaconMaterial(color, 0.22),
    );
    beam.position.y = 4.5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 28), beaconMaterial(color, 0.6));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), beaconMaterial(color, 0.95));
    gem.position.y = 2.6;
    g.add(beam, ring, gem);
    g.userData = { gem, ring };
    g.visible = false;
    return g;
  }

  function starTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    ctx.translate(32, 33);
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 ? 11 : 26;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = "#f6c945";
    ctx.strokeStyle = "#7a4d00";
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function makeTrail(scene) {
    const geo = new THREE.CircleGeometry(0.2, 12).rotateX(-Math.PI / 2).scale(1, 1, 1.5);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x30d158,
      transparent: true,
      opacity: 0.85,
      toneMapped: false,
      depthWrite: false,
      fog: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, TRAIL_MAX);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    scene.add(mesh);
    return mesh;
  }

  function create(scene) {
    const M = {
      mission: makeBeacon(0xff6b85),
      mosque: makeBeacon(0x30d158),
      trail: makeTrail(scene),
      starTex: starTexture(),
      trailPts: [],
      time: 0,
      stars: {},
    };
    scene.add(M.mission, M.mosque);
    return M;
  }

  /** A gold star sprite above an NPC (cached per id). */
  function starFor(M, agent) {
    if (M.stars[agent.id]) return M.stars[agent.id];
    const mat = new THREE.SpriteMaterial({
      map: M.starTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(0.42, 0.42, 1);
    spr.position.y = 1.45;
    spr.visible = false;
    agent.group.add(spr);
    M.stars[agent.id] = spr;
    return spr;
  }

  function placeBeacon(beacon, pos, y, t, still) {
    if (!pos) {
      beacon.visible = false;
      return;
    }
    beacon.visible = true;
    beacon.position.set(pos.x, y, pos.z);
    const u = beacon.userData;
    u.gem.position.y = 2.6 + (still ? 0 : Math.sin(t * 2.4) * 0.15);
    u.gem.rotation.y = still ? 0 : t * 1.6;
    const s = still ? 1 : 1 + Math.sin(t * 3) * 0.08;
    u.ring.scale.set(s, s, 1);
  }

  const DUMMY = new THREE.Object3D();

  function setTrail(M, pts) {
    M.trailPts = pts || [];
    const out = [];
    for (let i = 1; i < M.trailPts.length; i += 1) {
      const a = M.trailPts[i - 1];
      const b = M.trailPts[i];
      const len = U.dist(a.x, a.z, b.x, b.z);
      for (let d = 0.8; d < len; d += 1.7)
        out.push({
          x: a.x + ((b.x - a.x) * d) / len,
          z: a.z + ((b.z - a.z) * d) / len,
          yaw: Math.atan2(b.x - a.x, b.z - a.z),
        });
    }
    return out;
  }

  /** Lay footprints along `pts` (hero-to-goal waypoints); pass null to clear. */
  function showTrail(M, pts, heightAt) {
    const dots = pts ? setTrail(M, pts).slice(0, TRAIL_MAX) : [];
    dots.forEach(function (d, i) {
      DUMMY.position.set(d.x, heightAt(d.x, d.z) + 0.05, d.z);
      DUMMY.rotation.set(0, d.yaw, 0);
      DUMMY.updateMatrix();
      M.trail.setMatrixAt(i, DUMMY.matrix);
    });
    M.trail.count = dots.length;
    M.trail.instanceMatrix.needsUpdate = true;
  }

  function update(M, dt, view) {
    M.time += dt;
    const still = view.reduced;
    placeBeacon(M.mission, view.mission, view.missionY || 0, M.time, still);
    placeBeacon(M.mosque, view.mosque, view.mosqueY || 0, M.time, still);
    M.trail.material.opacity = still ? 0.8 : 0.55 + Math.sin(M.time * 4) * 0.3;
    Object.keys(M.stars).forEach(function (id) {
      const spr = M.stars[id];
      spr.position.y = 1.45 + (still ? 0 : Math.sin(M.time * 2.2 + id.length) * 0.06);
    });
  }

  G.Markers = { create, update, showTrail, starFor };
})((window.KQ = window.KQ || {}));
