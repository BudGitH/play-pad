// Kampung Quest — assemble a toy figure from a cast spec into a pivoted rig.
// Hierarchy: group > root > hips > { legL > kneeL, legR > kneeR, torso > { head > accessory,
// armL > foreL > handL > holdL, armR > ... } }. Figure faces +z; its left is +x.
(function (KQ) {
  "use strict";
  var F = (KQ.Figures = KQ.Figures || {});
  var partCache = {};

  /** All merged part geometries for one spec (shared by every instance of that spec). */
  function partsFor(spec, d) {
    if (partCache[spec.id]) return partCache[spec.id];
    partCache[spec.id] = {
      hips: F.partHips(spec, d),
      thigh: F.partThigh(spec, d),
      shin: F.partShin(spec, d),
      torso: F.partTorso(spec, d),
      head: F.partHead(spec, d),
      upper: F.partUpperArm(spec, d),
      fore: F.partForearm(spec, d),
      hand: F.partHand(spec, d),
    };
    return partCache[spec.id];
  }

  function node(name, parent, x, y, z, geo, mat) {
    var o = geo ? new THREE.Mesh(geo, mat) : new THREE.Group();
    o.name = name;
    o.position.set(x || 0, y || 0, z || 0);
    if (geo) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
    parent.add(o);
    return o;
  }

  function buildLeg(rig, side, p, mat, d) {
    var s = side === "L" ? 1 : -1;
    var leg = node("leg" + side, rig.hips, s * d.legX, 0, 0, p.thigh, mat);
    rig["leg" + side] = leg;
    rig["knee" + side] = node("knee" + side, leg, 0, -d.thigh, 0, p.shin, mat);
  }

  function buildArm(rig, side, p, mat, d) {
    var s = side === "L" ? 1 : -1;
    var arm = node("arm" + side, rig.torso, s * d.shoulderX, d.shoulderY, 0, p.upper, mat);
    var fore = node("fore" + side, arm, 0, -d.upperArm, 0, p.fore, mat);
    fore.rotation.order = "YXZ";
    var hand = node("hand" + side, fore, 0, -d.forearm - 0.004, 0, p.hand, mat);
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
    var d = F.dims(spec);
    var mat = F.plasticMaterial(spec.id, F.makeAtlas(spec));
    var p = partsFor(spec, d);
    var group = new THREE.Group();
    group.name = "figure-" + spec.id;
    var rig = { spec: spec, dims: d, material: mat };
    rig.root = node("root", group);
    rig.root.scale.setScalar(d.scale);
    rig.hips = node("hips", rig.root, 0, d.hipH, 0, p.hips, mat);
    buildLeg(rig, "L", p, mat, d);
    buildLeg(rig, "R", p, mat, d);
    rig.torso = node("torso", rig.hips, 0, d.hipBlockH, 0, p.torso, mat);
    rig.head = node("head", rig.torso, 0, d.torsoH + d.neckH, 0, p.head, mat);
    rig.head.scale.setScalar(d.headScale);
    rig.accessory = node("headPiece", rig.head, 0, 0, 0, F.headPieceGeometry(spec.head), mat);
    buildArm(rig, "L", p, mat, d);
    buildArm(rig, "R", p, mat, d);
    group.userData.rig = rig;
    F.pose(rig, "idle", 0, 1);
    return group;
  };

  /** Swap the sculpted head piece (e.g. a new haircut from the barber). */
  F.setHeadPiece = function (rig, headSpec) {
    rig.accessory.geometry = F.headPieceGeometry(headSpec);
  };

  /** Draw calls and triangles of one built figure (for budgets / dev overlays). */
  F.stats = function (group) {
    var calls = 0;
    var tris = 0;
    group.traverse(function (o) {
      if (!o.isMesh) return;
      calls++;
      tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    });
    return { drawCalls: calls, triangles: tris };
  };
})((window.KQ = window.KQ || {}));
