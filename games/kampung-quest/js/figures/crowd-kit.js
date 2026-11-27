// Kampung Quest — the instanced crowd renderer. Every extra is 14 rigid parts (hips, thighs, shins, torso,
// head, hat, upper arms, forearms, hands) plus a prop, but each part TYPE is one InstancedMesh shared by
// the whole crowd, so a hundred people cost about twenty draw calls whatever the headcount.
// Poses come from the same pose functions as the cast (KQ.Figures.POSES); their joint angles are turned
// into part matrices once per (pose, phase bucket, kid) and cached in a bank, so a frame only has to
// multiply each cached part matrix by the figure's own placement.
// Usage: kit = F.CrowdKit.create(capacity); each frame kit.begin(); kit.add(person)...; kit.end().
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const PARTS = 14;
  const KID_THIGH = 0.08 / 0.13;
  const KID_SHIN = 0.125 / 0.175;
  /** Poses that cycle fast enough to need more phase buckets for a smooth stride. */
  const FAST = { walk: 1, run: 1, jog: 1, walkbag: 1, pedal: 1, hop: 1 };
  const bank = new Map();
  const tmp = {
    e: new THREE.Euler(),
    r: new THREE.Matrix4(),
    s: new THREE.Matrix4(),
    m: [],
  };
  for (let i = 0; i < 16; i += 1) tmp.m.push(new THREE.Matrix4());

  /** Matrix = translate(tx, ty, tz) x rotate(euler triple, order). */
  function local(out, t, rot, order) {
    tmp.e.set(rot[0], rot[1], rot[2], order || "XYZ");
    out.makeRotationFromEuler(tmp.e);
    return out.setPosition(t[0], t[1], t[2]);
  }

  /** Joint triple for a pose, falling back to the neutral stance and then zero. */
  function joint(P, name) {
    const parts = F.POSE_PARTS;
    return P[name] || parts.NEUTRAL[name] || parts.ZERO;
  }

  /** World matrix of one child joint: parent x local(translation, rotation). */
  function child(parent, t, rot, order) {
    return new THREE.Matrix4().multiplyMatrices(parent, local(tmp.r, t, rot, order));
  }

  /** The joint chain of one arm (shoulder, elbow, wrist) hanging off the torso. */
  function armChain(torso, d, P, side) {
    const s = side === "L" ? 1 : -1;
    const up = child(torso, [s * d.shoulderX, d.shoulderY, 0], joint(P, "arm" + side));
    const fo = child(up, [0, -d.upperArm, 0], joint(P, "fore" + side), "YXZ");
    const ha = child(fo, [0, -d.forearm - 0.004, 0], joint(P, "hand" + side));
    return [up, fo, ha];
  }

  /** The joint chain of one leg (hip, knee) hanging off the hips. */
  function legChain(hips, d, P, side) {
    const s = side === "L" ? 1 : -1;
    const lg = child(hips, [s * d.legX, 0, 0], joint(P, "leg" + side));
    return [lg, child(lg, [0, -d.thigh, 0], joint(P, "knee" + side))];
  }

  /** A y-stretch matrix (kids' shorter leg parts use the adult leg geometry squashed). */
  function squash(m, k) {
    return new THREE.Matrix4().multiplyMatrices(m, tmp.s.makeScale(1, k, 1));
  }

  /** The 14 part matrices (figure space) of a pose at a phase, flattened into a Float32Array. */
  function evalPose(name, phase, kid) {
    const d = kid ? F.CROWD_KID_DIMS : F.CROWD_DIMS;
    const fn = F.POSES[name] || F.POSES.idle;
    const P = fn(phase, d);
    const root = new THREE.Matrix4().makeScale(d.scale, d.scale, d.scale);
    root.setPosition(0, (P.rootY || 0) * d.scale, (P.rootZ || 0) * d.scale);
    const hips = child(root, [0, d.hipH, 0], joint(P, "hips"));
    const [lgL, knL] = legChain(hips, d, P, "L");
    const [lgR, knR] = legChain(hips, d, P, "R");
    const torso = child(hips, [0, d.hipBlockH, 0], joint(P, "torso"));
    const head = child(torso, [0, d.torsoH + d.neckH, 0], joint(P, "head"));
    head.multiply(tmp.s.makeScale(d.headScale, d.headScale, d.headScale));
    const [upL, foL, haL] = armChain(torso, d, P, "L");
    const [upR, foR, haR] = armChain(torso, d, P, "R");
    const k1 = kid ? KID_THIGH : 1;
    const k2 = kid ? KID_SHIN : 1;
    const list = [
      hips,
      squash(lgL, k1),
      squash(lgR, k1),
      squash(knL, k2),
      squash(knR, k2),
      torso,
      head,
      head,
      upL,
      upR,
      foL,
      foR,
      haL,
      haR,
    ];
    const out = new Float32Array(PARTS * 16);
    list.forEach((m, i) => out.set(m.elements, i * 16));
    return out;
  }

  /** How many phase buckets a pose gets (more for fast strides). */
  function bucketsFor(name) {
    return FAST[name] ? 24 : 20;
  }

  const poseIds = new Map();

  /** A small integer for a pose name (so the bank key is a number, not a string built per frame). */
  function poseId(name) {
    let id = poseIds.get(name);
    if (id === undefined) {
      id = poseIds.size;
      poseIds.set(name, id);
    }
    return id;
  }

  /** The cached part matrices for (pose, phase 0..1, kid). */
  function bankFor(name, phase, kid) {
    const n = bucketsFor(name);
    const b = Math.floor((phase - Math.floor(phase)) * n) % n;
    const key = (poseId(name) * 32 + b) * 2 + (kid ? 1 : 0);
    let m = bank.get(key);
    if (!m) {
      m = evalPose(name, (b + 0.5) / n, kid);
      bank.set(key, m);
    }
    return m;
  }

  /** dst[do..do+15] = G x src[so..so+15] for G = a placement (column-major 4x4, last row 0 0 0 1). */
  function mulInto(dst, di, g, src, si) {
    for (let j = 0; j < 4; j += 1) {
      const o = si + j * 4;
      const a = src[o];
      const b = src[o + 1];
      const c = src[o + 2];
      const w = j === 3 ? 1 : 0;
      const q = di + j * 4;
      dst[q] = g[0] * a + g[4] * b + g[8] * c + g[12] * w;
      dst[q + 1] = g[1] * a + g[5] * b + g[9] * c + g[13] * w;
      dst[q + 2] = g[2] * a + g[6] * b + g[10] * c + g[14] * w;
      dst[q + 3] = w;
    }
  }

  /** Fill g with the placement of a figure: scale s, yaw h, position (x, y, z). */
  function placement(g, x, y, z, h, s) {
    const c = Math.cos(h) * s;
    const n = Math.sin(h) * s;
    g[0] = c;
    g[1] = 0;
    g[2] = -n;
    g[4] = 0;
    g[5] = s;
    g[6] = 0;
    g[8] = n;
    g[9] = 0;
    g[10] = c;
    g[12] = x;
    g[13] = y;
    g[14] = z;
  }

  /** Linear [r, g, b] of a hex colour (instance colours multiply the white parts; sRGB like the cast). */
  function lin(hex) {
    const c = F.lin(hex);
    return [c.r, c.g, c.b];
  }

  /** Cache an outfit's instance colours on it (once). */
  function colours(o) {
    if (o._lin) return o._lin;
    const skin = lin(o.skin);
    const top = lin(o.top);
    const legs = lin(o.legs);
    o._lin = {
      skin,
      top,
      legs,
      sleeve: o.long ? top : skin,
      shin: o.shorts ? skin : legs,
      head: lin(o.headColour || "#141012"),
      bag: lin(o.bag),
      bike: lin(o.bike),
    };
    return o._lin;
  }

  /** Which mesh and colour each of the 14 part slots uses for an outfit (cached on the outfit). */
  function partTable(kit, o) {
    if (o._tbl && o._tblKit === kit) return o._tbl;
    o._tbl = partNames(o).map((n) => [n[0] ? kit.meshes[n[0]] : null, n[1]]);
    o._tblKit = kit;
    return o._tbl;
  }

  /** The mesh names and colours of the 14 part slots for an outfit. */
  function partNames(o) {
    const c = colours(o);
    const sk = o.skirt;
    const hat = o.head && o.head !== "none" ? "hat_" + o.head : null;
    return [
      ["hips", c.legs],
      [sk ? "skThighL" : "thigh", c.legs],
      [sk ? "skThighR" : "thigh", c.legs],
      [sk ? "skShinL" : "shin", sk ? c.legs : c.shin],
      [sk ? "skShinR" : "shin", sk ? c.legs : c.shin],
      ["torso", c.top],
      ["head", c.skin],
      [hat, c.head],
      ["upper", c.sleeve],
      ["upper", c.sleeve],
      ["fore", c.sleeve],
      ["fore", c.sleeve],
      ["hand", c.skin],
      ["hand", c.skin],
    ];
  }

  /** Build the soft round shadow texture (a radial dark-to-clear gradient). */
  function blobTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.6, "rgba(0,0,0,0.28)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  /** One InstancedMesh with room for `cap` instances, drawing nothing until filled. */
  function makeMesh(name, geo, mat, cap) {
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.name = "crowd-" + name;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    return mesh;
  }

  /** The ground blob shadow mesh: flat quads lying on the floor. */
  function makeBlobs(cap) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({
      map: blobTexture(),
      transparent: true,
      depthWrite: false,
    });
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    const mesh = makeMesh("blobs", g, m, cap);
    mesh.receiveShadow = false;
    mesh.renderOrder = 2;
    return mesh;
  }

  /** Append one instance (matrix from `g x src`, colour) to a mesh. */
  function push(mesh, g, src, si, col) {
    const i = mesh.count;
    mulInto(mesh.instanceMatrix.array, i * 16, g, src, si);
    const a = mesh.instanceColor.array;
    a[i * 3] = col[0];
    a[i * 3 + 1] = col[1];
    a[i * 3 + 2] = col[2];
    mesh.count = i + 1;
  }

  const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const SPOT = new Float32Array(16);
  const ID = [1, 1, 1];
  const BIKE_LIFT = 0.02;

  /** A translation-only matrix in the scratch array SPOT. */
  function spot(y, z) {
    SPOT.set(IDENT);
    SPOT[13] = y;
    SPOT[14] = z;
    return SPOT;
  }

  /** The bicycle under a rider: frame plus two wheels. */
  function addBike(kit, g, tint) {
    push(kit.meshes.bikeFrame, g, spot(BIKE_LIFT, 0), 0, tint.bike);
    [-0.31, 0.31].forEach((z) => push(kit.meshes.bikeWheel, g, spot(0.17, z), 0, ID));
  }

  /** Place the prop an extra carries: a bag in the right hand, a broom in front, a bike underneath. */
  function addProp(kit, p, g, m, tint) {
    if (p.prop === "bag") {
      const t = new THREE.Matrix4().makeTranslation(0, -0.052, 0.004);
      const h = new THREE.Matrix4().fromArray(m, 13 * 16).multiply(t);
      push(kit.meshes.bag, g, h.elements, 0, tint.bag);
    } else if (p.prop === "broom") {
      const sway = 0.2 * Math.sin(p.phase * 6.2832);
      const t = new THREE.Matrix4().makeRotationX(-0.55).setPosition(0.07 + sway, 0, 0.5);
      push(kit.meshes.broom, g, t.elements, 0, ID);
    } else if (p.prop === "quran") {
      const t = new THREE.Matrix4().makeTranslation(0, -0.03, 0.07);
      const h = new THREE.Matrix4().fromArray(m, 13 * 16).multiply(t);
      push(kit.meshes.book, g, h.elements, 0, tint.bag);
    } else if (p.prop === "bike") {
      addBike(kit, g, tint);
    }
  }

  /** The soft ground shadow under a figure. */
  function addBlob(kit, p) {
    const r = 0.34 * p.scale * (p.kid ? 0.85 : 1);
    placement(kit.g, p.x, p.y + 0.03, p.z, 0, 2 * r);
    push(kit.meshes.blobs, kit.g, IDENT, 0, ID);
  }

  /** The crowd renderer. */
  const CrowdKit = {
    /**
     * Build the instanced meshes for up to `people` figures and add them to `parent`.
     * @param {THREE.Object3D} parent the scene or a group
     * @param {number} people the most figures drawn in one frame
     * @param {THREE.Texture} [envMap] the studio reflection
     */
    create(parent, people, envMap) {
      const geo = F.crowdGeometries();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.42,
        metalness: 0,
      });
      if (envMap) {
        mat.envMap = envMap;
        mat.envMapIntensity = 0.7;
      }
      const group = new THREE.Group();
      group.name = "crowd";
      const meshes = {};
      Object.keys(geo).forEach((k) => {
        const cap = Math.max(people * 2, 4);
        meshes[k] = makeMesh(k, geo[k], mat, cap);
        group.add(meshes[k]);
      });
      meshes.blobs = makeBlobs(people);
      group.add(meshes.blobs);
      parent.add(group);
      return { group, meshes, material: mat, people, drawn: 0, g: new Float32Array(16) };
    },

    /** Start a frame: empty every mesh. */
    begin(kit) {
      Object.keys(kit.meshes).forEach((k) => (kit.meshes[k].count = 0));
      kit.drawn = 0;
      kit.g[3] = kit.g[7] = kit.g[11] = 0;
      kit.g[15] = 1;
    },

    /**
     * Add one figure to this frame.
     * @param {object} p { x, y, z, heading, scale, pose, phase, kid, outfit, prop }
     */
    add(kit, p) {
      if (kit.drawn >= kit.people) return false;
      const g = kit.g;
      placement(g, p.x, p.y, p.z, p.heading, p.scale);
      const m = bankFor(p.pose, p.phase, p.kid);
      const table = partTable(kit, p.outfit);
      for (let i = 0; i < PARTS; i += 1) {
        if (table[i][0]) push(table[i][0], g, m, i * 16, table[i][1]);
      }
      addProp(kit, p, g, m, colours(p.outfit));
      addBlob(kit, p);
      kit.drawn += 1;
      return true;
    },

    /** Finish a frame: upload what changed and hide the meshes nobody uses. */
    end(kit) {
      Object.keys(kit.meshes).forEach(function (k) {
        const mesh = kit.meshes[k];
        const used = mesh.count > 0;
        mesh.visible = used;
        mesh.instanceMatrix.needsUpdate = used;
        mesh.instanceColor.needsUpdate = used;
        mesh.instanceMatrix.updateRange.count = mesh.count * 16;
        mesh.instanceColor.updateRange.count = mesh.count * 3;
      });
    },

    /**
     * Show every mesh (even empty ones) so a shader compile covers them, or put the empty ones
     * back to hidden. An empty mesh that stays visible still costs a draw-state setup per frame.
     */
    showAll(kit, on) {
      Object.keys(kit.meshes).forEach(function (k) {
        const mesh = kit.meshes[k];
        mesh.visible = on || mesh.count > 0;
      });
    },

    /** Drop the bank (tests) */
    clearBank() {
      bank.clear();
    },
    bankSize: () => bank.size,
    evalPose,
  };
  F.CrowdKit = CrowdKit;
})((window.KQ = window.KQ || {}));
