// Kampung Quest — assemble a toy figure from a cast spec into a pivoted rig.
// Hierarchy: group > root > hips > { legL > kneeL, legR > kneeR, torso > { head > accessory,
// armL > foreL > handL > holdL, armR > ... } }. Figure faces +z; its left is +x.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const partCache = {};

  /** All merged part geometries for one spec (shared by every instance of that spec). */
  function partsFor(spec, d) {
    if (partCache[spec.id]) return partCache[spec.id];
    partCache[spec.id] = {
      hips: F.partHips(spec, d),
      thighL: F.partThigh(spec, d, 1),
      thighR: F.partThigh(spec, d, -1),
      shinL: F.partShin(spec, d, 1),
      shinR: F.partShin(spec, d, -1),
      torso: F.partTorso(spec, d),
      head: F.partHead(spec, d),
      upper: F.partUpperArm(spec, d),
      fore: F.partForearm(spec, d),
      hand: F.partHand(spec, d),
    };
    return partCache[spec.id];
  }

  /** Free the cached parts of a spec (a repainted hero builds its parts anew each time). */
  F.releaseParts = function (id) {
    const parts = partCache[id];
    if (!parts) return;
    Object.keys(parts).forEach((k) => parts[k].dispose());
    delete partCache[id];
  };
  F.partsFor = partsFor;

  /**
   * Create a named mesh (or an empty group when there is no geometry) at a position under a parent;
   * meshes cast and receive shadows.
   */
  function node(name, parent, x, y, z, geo, mat) {
    const o = geo ? new THREE.Mesh(geo, mat) : new THREE.Group();
    o.name = name;
    o.position.set(x || 0, y || 0, z || 0);
    if (geo) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
    parent.add(o);
    return o;
  }

  /**
   * Build a leg (thigh under the hips, shin at the knee) for the L or R side and register both
   * joints on the rig.
   */
  function buildLeg(rig, side, p, mat, d) {
    const s = side === "L" ? 1 : -1;
    const leg = node("leg" + side, rig.hips, s * d.legX, 0, 0, p["thigh" + side], mat);
    rig["leg" + side] = leg;
    rig["knee" + side] = node("knee" + side, leg, 0, -d.thigh, 0, p["shin" + side], mat);
  }

  /**
   * Build an arm (upper, forearm, hand and a hold point for props) for the L or R side and register
   * the joints on the rig.
   */
  function buildArm(rig, side, p, mat, d) {
    const s = side === "L" ? 1 : -1;
    const arm = node("arm" + side, rig.torso, s * d.shoulderX, d.shoulderY, 0, p.upper, mat);
    const fore = node("fore" + side, arm, 0, -d.upperArm, 0, p.fore, mat);
    fore.rotation.order = "YXZ";
    const hand = node("hand" + side, fore, 0, -d.forearm - 0.004, 0, p.hand, mat);
    rig["arm" + side] = arm;
    rig["fore" + side] = fore;
    rig["hand" + side] = hand;
    rig["hold" + side] = node("hold" + side, hand, 0, -0.052, 0.004);
  }

  /**
   * Build one figure.
   * @param {object|string} spec a cast spec (or a KQ.Figures.CAST id)
   * @returns {THREE.Group} with userData.rig = { root, hips, torso, head, armL, armR, handL, handR,
   *   legL, legR, accessory, foreL, foreR, kneeL, kneeR, holdL, holdR, dims, spec }
   */
  F.build = function (spec) {
    if (typeof spec === "string") spec = F.CAST[spec];
    const d = F.dims(spec);
    const mat = F.plasticMaterial(spec.id, F.makeAtlas(spec));
    const p = partsFor(spec, d);
    F.fitLegs(d, spec);
    const group = new THREE.Group();
    group.name = "figure-" + spec.id;
    const rig = { spec: spec, dims: d, material: mat };
    rig.root = node("root", group);
    rig.root.scale.setScalar(d.scale);
    rig.hips = node("hips", rig.root, 0, d.hipH, 0, p.hips, mat);
    buildLeg(rig, "L", p, mat, d);
    buildLeg(rig, "R", p, mat, d);
    rig.torso = node("torso", rig.hips, 0, d.hipBlockH, 0, p.torso, mat);
    rig.head = node("head", rig.torso, 0, d.torsoH + d.neckH, 0, p.head, mat);
    rig.head.scale.setScalar(d.headScale);
    rig.accessory = node("headPiece", rig.head, 0, 0, 0, F.headPieceGeometry(spec.head), mat);
    fitHead(rig, spec.head);
    buildArm(rig, "L", p, mat, d);
    buildArm(rig, "R", p, mat, d);
    group.userData.rig = rig;
    F.pose(rig, "idle", 0, 1);
    return group;
  };

  /** Half the depth of the lower leg for the kneeling poses: a long skirt's hem is deeper than a leg. */
  F.SKIRT_KNEEL_HALF = 0.092;
  /** Record what the kneeling poses need to know about the legs of a spec (dims are per rig). */
  F.fitLegs = function (d, spec) {
    d.kneelHalf = spec.skirt && spec.skirt.lower ? F.SKIRT_KNEEL_HALF : 0;
  };

  /** Swap the sculpted head piece (e.g. a new haircut from the barber). */
  F.setHeadPiece = function (rig, headSpec) {
    rig.accessory.geometry = F.headPieceGeometry(headSpec);
    fitHead(rig, headSpec);
  };

  const contourCache = new WeakMap();
  /**
   * The head piece's outline in the head's side plane: for directions from straight ahead (+z) over
   * the crown to straight behind, the furthest point [y, z] of the piece (z mirrored when the piece is
   * worn back to front). The sujud solver (F.PoseSolve.sujudBend) uses it so a hood, a songkok or
   * a turned cap rests on the floor instead of sinking into it.
   */
  F.headContour = function (geo, mirror) {
    const key = contourCache.get(geo);
    if (key && key[mirror ? 1 : 0]) return key[mirror ? 1 : 0];
    const pos = geo.attributes.position;
    const out = [];
    for (let k = 0; k <= 16; k += 1) {
      const a = -0.35 + (k / 16) * (Math.PI + 0.35);
      const dy = Math.sin(a);
      const dz = Math.cos(a) * (mirror ? -1 : 1);
      let best = -Infinity;
      let pt = null;
      for (let i = 0; i < pos.count; i += 1) {
        const v = pos.getY(i) * dy + pos.getZ(i) * dz;
        if (v > best) (best = v), (pt = [pos.getY(i), pos.getZ(i) * (mirror ? -1 : 1)]);
      }
      out.push(pt);
    }
    const entry = key || [null, null];
    entry[mirror ? 1 : 0] = out;
    contourCache.set(geo, entry);
    return out;
  };

  /**
   * A hood's shoulder drape rides on the torso, not the head (one extra mesh, only while a tudung or
   * hijab is worn; removed from the rig otherwise so it costs nothing).
   */
  function fitDrape(rig, headSpec) {
    const geo = F.headDrapeGeometry(headSpec);
    if (!geo) {
      if (rig.drape && rig.drape.parent) rig.drape.parent.remove(rig.drape);
      return;
    }
    const d = rig.dims;
    if (!rig.drape) {
      rig.drape = node(
        "headDrape",
        rig.torso,
        0,
        d.torsoH + d.neckH,
        0,
        geo,
        rig.accessory.material,
      );
      rig.drape.scale.setScalar(d.headScale);
    }
    rig.drape.geometry = geo;
    rig.drape.material = rig.accessory.material;
    if (!rig.drape.parent) rig.torso.add(rig.drape);
  }

  /** Record what the poses need to know about the head piece (a peaked cap, its outline for sujud). */
  function fitHead(rig, headSpec) {
    fitDrape(rig, headSpec);
    rig.headSpec = headSpec;
    rig.capPeak = Boolean(headSpec && headSpec.type === "cap");
    rig.capTurned = false;
    const prayerHead = rig.capPeak ? Object.assign({}, headSpec, { reversed: true }) : null;
    const geo = prayerHead ? F.headPieceGeometry(prayerHead) : rig.accessory.geometry;
    rig.dims.headContour = F.headContour(geo, false);
  }

  /** Draw calls and triangles of one built figure (for budgets / dev overlays). */
  F.stats = function (group) {
    let calls = 0;
    let tris = 0;
    group.traverse(function (o) {
      if (!o.isMesh) return;
      calls++;
      tris +=
        (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    });
    return { drawCalls: calls, triangles: tris };
  };
})((window.KQ = window.KQ || {}));
