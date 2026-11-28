// Dev-only (browser side of the figures audit, after audit-page.js): pose checks in figure space (parts
// below the floor, a head piece sunk into the torso or the upper arms) for full rigs and for crowd
// people (the baked crowd pose bank), and the contact-sheet renderer (neutral backdrop, close-up
// turnarounds + pose tiles).
(function () {
  "use strict";
  const A = window.KQAudit;
  const F = () => window.KQ.Figures;
  const FLOOR = -0.003; // 3 mm below the floor counts as through it

  // ---------- pose checks ----------

  /** Count samples of a geometry (under matrix m) below the floor; A.lastDepth = the deepest y (m). */
  function belowFloor(geo, m) {
    const s = A.samples(geo, m);
    let n = 0;
    A.lastDepth = 0;
    A.eachSample(s, (i) => {
      if (s[i + 1] >= FLOOR) return;
      n += 1;
      A.lastDepth = Math.min(A.lastDepth, s[i + 1]);
    });
    return n;
  }

  /** Is a torso-local point inside the trapezoid torso (inset 3 mm), facing out? */
  function inTorso(d, p, n) {
    const t = p.y / d.torsoH;
    if (t < 0.02 || t > 0.98) return false;
    const hw = (d.torsoWB + (d.torsoWT - d.torsoWB) * t) / 2 - 0.003;
    const hd = (d.torsoD / 2) * (1 - 0.04 * t) - 0.003;
    if (Math.abs(p.x) > hw || Math.abs(p.z) > hd) return false;
    return n.x * p.x + n.z * p.z > 0;
  }

  /** Is an arm-local point inside the upper-arm block (inset 3 mm), facing out? */
  function inUpperArm(d, p, n) {
    const h = d.upperArm + 0.046;
    const cy = 0.036 - h / 2;
    if (Math.abs(p.x) > 0.034 || Math.abs(p.z) > 0.036 || Math.abs(p.y - cy) > h / 2 - 0.02)
      return false;
    return n.x * p.x + n.z * p.z > 0;
  }

  /** Samples of `s` (figure space) that fall inside a part whose figure matrix is `m`. */
  function insidePart(s, m, test) {
    const inv = new THREE.Matrix4().copy(m).invert();
    const rot = new THREE.Matrix3().setFromMatrix4(inv);
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    let count = 0;
    A.eachSample(s, (i) => {
      p.set(s[i], s[i + 1], s[i + 2]).applyMatrix4(inv);
      n.set(s[i + 3], s[i + 4], s[i + 5]).applyMatrix3(rot);
      if (test(p, n)) count += 1;
    });
    return count;
  }

  /** Floor and body checks for a built rig in a pose. */
  A.checkRigPose = function (group, pose, phase) {
    const rig = group.userData.rig;
    F().pose(rig, pose, phase || 0.25, 1);
    group.updateMatrixWorld(true);
    const out = { floor: 0, floorParts: [], body: 0 };
    group.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const k = belowFloor(o.geometry, o.matrixWorld);
      if (k) out.floorParts.push(o.name + ":" + k + "@" + Math.round(A.lastDepth * 1000) + "mm");
      out.floor += k;
    });
    let acc = A.samples(rig.accessory.geometry, rig.accessory.matrixWorld);
    if (rig.drape && rig.drape.parent)
      // a hood's drape rides on the torso (build.js)
      acc = acc.concat(A.samples(rig.drape.geometry, rig.drape.matrixWorld));
    const d = rig.dims;
    out.body += insidePart(acc, rig.torso.matrixWorld, (p, n) => inTorso(d, p, n));
    out.body += insidePart(acc, rig.armL.matrixWorld, (p, n) => inUpperArm(d, p, n));
    out.body += insidePart(acc, rig.armR.matrixWorld, (p, n) => inUpperArm(d, p, n));
    return out;
  };

  /** [slot, crowd geometry] of the parts checked against the floor (kids' legs are squashed by the bank). */
  const CROWD_PARTS = [
    [3, "shin"],
    [4, "shin"],
    [3, "skShinL"],
    [4, "skShinR"],
    [6, "head"],
    [7, "hat"],
    [12, "hand"],
    [13, "hand"],
  ];

  /** Floor and body checks for a crowd hat (by type) in a baked crowd pose. */
  A.checkCrowdPose = function (hat, pose, kid, skirt) {
    const geo = F().crowdGeometries();
    const m = F().CrowdKit.evalPose(pose, 0.25, kid, hat + (skirt ? "|skirt" : ""));
    const mat = (slot) => new THREE.Matrix4().fromArray(m, slot * 16);
    const d = kid ? F().CROWD_KID_DIMS : F().CROWD_DIMS;
    const out = { floor: 0, floorParts: [], body: 0 };
    const g = geo["hat_" + hat];
    const wanted = (part) =>
      part[1] === "hat"
        ? Boolean(g)
        : !/shin/i.test(part[1]) || /^sk/.test(part[1]) === Boolean(skirt);
    CROWD_PARTS.filter(wanted).forEach((part) => {
      const k = belowFloor(part[1] === "hat" ? g : geo[part[1]], mat(part[0]));
      if (k)
        out.floorParts.push(
          part[1] + part[0] + ":" + k + "@" + Math.round(A.lastDepth * 1000) + "mm",
        );
      out.floor += k;
    });
    if (!g) return out;
    const acc = A.samples(g, mat(7));
    out.body += insidePart(acc, mat(5), (p, n) => inTorso(d, p, n));
    out.body += insidePart(acc, mat(8), (p, n) => inUpperArm(d, p, n));
    out.body += insidePart(acc, mat(9), (p, n) => inUpperArm(d, p, n));
    return out;
  };

  // ---------- rendering ----------

  let R = null;
  /** The shared renderer, scene (neutral backdrop, floor disc, soft key + fill light) and camera. */
  function stage(size) {
    if (R && R.size === size) return R;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(size, size);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#d5d9df");
    scene.environment = F().makeEnv(renderer);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 4, 3);
    scene.add(key);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3, 48),
      new THREE.MeshStandardMaterial({ color: "#b9bec6", roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 30);
    R = { size, renderer, scene, camera };
    return R;
  }

  /** Point the camera at `t` from yaw / pitch / distance and render one tile into the sheet. */
  function tile(sheet, k, cols, t, view) {
    const r = R;
    const c = Math.cos(view.pitch);
    r.camera.position.set(
      t.x + Math.sin(view.yaw) * c * view.dist,
      t.y + Math.sin(view.pitch) * view.dist,
      t.z + Math.cos(view.yaw) * c * view.dist,
    );
    r.camera.lookAt(t);
    r.renderer.render(r.scene, r.camera);
    const x = (k % cols) * r.size;
    const y = Math.floor(k / cols) * r.size;
    sheet.ctx.drawImage(r.renderer.domElement, x, y);
    sheet.ctx.fillStyle = "rgba(20,20,24,0.75)";
    sheet.ctx.font = "13px sans-serif";
    sheet.ctx.fillText(view.label, x + 6, y + 16);
  }

  const TURN = [
    ["front", 0, 0.05],
    ["3/4", 0.75, 0.1],
    ["side", Math.PI / 2, 0.05],
    ["back", Math.PI, 0.1],
    ["top", 0.4, 1.15],
  ];
  A.TURN = TURN;

  /** A blank sheet canvas of cols x rows tiles. */
  function sheetOf(cols, rows, size) {
    const c = document.createElement("canvas");
    c.width = cols * size;
    c.height = rows * size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#d5d9df";
    ctx.fillRect(0, 0, c.width, c.height);
    return { canvas: c, ctx };
  }

  /**
   * Render a contact sheet: row 1 = close-up turnaround of the head, row 2 = full-body pose tiles.
   * @param {object} subj { add(scene), remove(scene), pose(name), head() -> Vector3, body() -> Vector3 }
   * @param {Array} poses [[label, pose name, yaw]]
   */
  A.sheet = function (subj, poses, size) {
    stage(size || 220);
    const cols = Math.max(TURN.length, poses.length);
    const sh = sheetOf(cols, 2, R.size);
    subj.add(R.scene);
    subj.pose("idle");
    TURN.forEach((v, k) =>
      tile(sh, k, cols, subj.head(), { label: v[0], yaw: v[1], pitch: v[2], dist: 0.95 }),
    );
    poses.forEach((p, k) => {
      subj.pose(p[1]);
      tile(sh, cols + k, cols, subj.body(), { label: p[0], yaw: p[2], pitch: 0.18, dist: 2.3 });
    });
    subj.remove(R.scene);
    return sh.canvas.toDataURL("image/jpeg", 0.86);
  };

  /** A subject wrapper for a built rig (the hero, a cast neighbour, an event actor, a guide). */
  A.rigSubject = function (group) {
    const rig = group.userData.rig;
    const v = new THREE.Vector3();
    return {
      add: (s) => s.add(group),
      remove: (s) => s.remove(group),
      pose: (name) => {
        F().pose(rig, name, 0.25, 1);
        group.updateMatrixWorld(true);
      },
      head: () => rig.head.localToWorld(v.set(0, 0.12, 0)).clone(),
      body: () => new THREE.Vector3(0, 0.45, 0),
    };
  };

  let kit = null;
  const holder = new THREE.Group();
  /** A subject wrapper for one crowd person (the real instanced kit, one person drawn). */
  A.crowdSubject = function (outfit, kid) {
    const CK = F().CrowdKit;
    let pose = "idle";
    return {
      add: (s) => {
        if (!kit) kit = CK.create(holder, 2, s.environment);
        s.add(holder);
      },
      remove: (s) => s.remove(holder),
      pose: (name) => {
        pose = name;
        CK.begin(kit);
        CK.add(kit, {
          x: 0,
          y: 0,
          z: 0,
          heading: 0,
          scale: 1,
          pose: name,
          phase: 0.25,
          kid,
          outfit,
        });
        CK.end(kit);
      },
      head: () => {
        const m = new THREE.Matrix4().fromArray(CK.evalPose(pose, 0.25, kid), 6 * 16);
        return new THREE.Vector3(0, 0.1, 0).applyMatrix4(m);
      },
      body: () => new THREE.Vector3(0, kid ? 0.35 : 0.45, 0),
    };
  };
})();
