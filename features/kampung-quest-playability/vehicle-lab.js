// Dev-only vehicle lab (see vehicle-lab.html): a sunny lot, a sky reflection, every vehicle model in a row.
// window.lab = { build(list, q), view(x, z, yaw, pitch, dist, h), dusk(on), vehicles }.
(function () {
  "use strict";
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 400);
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.7);
  sun.position.set(18, 30, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 120 });
  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x6b6256, 0.55);
  scene.add(sun, hemi);

  /** A gradient sky (for the background and the PMREM reflections). */
  function skyTexture(top, mid, bottom) {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 256;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(0.48, mid);
    g.addColorStop(0.52, "#8d8a82");
    g.addColorStop(1, bottom);
    x.fillStyle = g;
    x.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  const day = skyTexture("#4f8fd6", "#dceaf5", "#5a554d");
  const dusk = skyTexture("#1b2340", "#d9825a", "#2a2622");
  scene.background = new THREE.Color(0xb9d4ea);
  scene.environment = day;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x5c5f63, roughness: 0.9 }),
  );
  ground.receiveShadow = true;
  scene.add(ground);
  for (let i = -6; i <= 6; i += 1) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe8e8e0 }),
    );
    line.position.set(i * 3.2 + 1.6, 0.005, 0);
    scene.add(line);
  }

  const lab = { vehicles: [], scene, camera, renderer };

  /** Build vehicles: list of [kind, hex, opts, x, z, heading]. */
  lab.build = function (list) {
    lab.vehicles.forEach((v) => scene.remove(v.group));
    lab.vehicles = list.map(function (it) {
      const v = window.KQ.Figures.Vehicles.build(it[0], it[1], it[2] || {});
      v.group.position.set(it[3] || 0, 0, it[4] || 0);
      v.group.rotation.y = it[5] || 0;
      scene.add(v.group);
      return v;
    });
    return lab.vehicles.length;
  };

  /** Point the camera at (x, h, z) from yaw / pitch / dist. */
  lab.view = function (x, z, yaw, pitch, dist, h) {
    const y = h === undefined ? 0.7 : h;
    camera.position.set(
      x + Math.sin(yaw) * Math.cos(pitch) * dist,
      y + Math.sin(pitch) * dist,
      z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(x, y, z);
    lab.render();
  };

  /** Dusk: dim sun, warm low light, dark sky reflections. */
  lab.dusk = function (on) {
    sun.intensity = on ? 0.2 : 1.7;
    hemi.intensity = on ? 0.2 : 0.55;
    scene.environment = on ? dusk : day;
    scene.background = new THREE.Color(on ? 0x2a2c3e : 0xb9d4ea);
    lab.render();
  };

  /** Stats of the last frame. */
  lab.render = function () {
    renderer.render(scene, camera);
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };

  /** Triangles and meshes of a vehicle. */
  lab.count = function (v) {
    let tris = 0;
    let meshes = 0;
    v.group.traverse(function (m) {
      if (!m.isMesh || !m.visible) return;
      meshes += 1;
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    return { tris: Math.round(tris), meshes };
  };
  window.lab = lab;
})();
