/* ============================================================================
 * FILE: holy-kit.js
 * PURPOSE: Shared builders for the Haramain scenery (KQ.WorldParts.HolyKit): the extra
 *          materials (kiswah black, carpets with prayer rows, hotel glass, chandelier glow,
 *          fronds), arch slabs, domes, minarets and small collider helpers (palms: holy-palms.js, hills: holy-rocks.js).
 * BUSINESS CONTEXT: AC-H1 (Makkah + Madinah scenery). Geometry is procedural; ground / rock / stone use the CC0 photo sets (with canvas stand-ins on file://).
 * DEPENDENCIES: the world modules (geo.js Batch, materials.js catalogue, canvas.js, textures).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const C = () => P.Canvas;
  const TAU = Math.PI * 2;

  /** Metres per texture repeat for the new material keys. */
  const UV = {
    redCarpet: 3.2,
    greenCarpet: 3.2,
    hotel: 28.8,
    stoneHotel: 28.8,
    apartment: 28.8,
    rockFace: 6,
    sand: 5,
    dirt: 3.4,
    limestone: 4,
    sandstone: 2.2,
  };

  /** Draw one prayer-carpet tile: base colour, four rows (a row = one worshipper's width) with small arches. */
  function carpetCanvas(base, line, accent) {
    const c = C().canvas(256, 256);
    const g = c.getContext("2d");
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 4; r += 1) {
      const y = r * 64;
      g.fillStyle = line;
      g.fillRect(0, y, 256, 3);
      g.fillStyle = accent;
      for (let x = 12; x < 256; x += 32) {
        g.beginPath();
        g.moveTo(x, y + 58);
        g.lineTo(x, y + 26);
        g.arc(x + 10, y + 26, 10, Math.PI, 0);
        g.lineTo(x + 20, y + 58);
        g.closePath();
        g.globalAlpha = 0.35;
        g.fill();
        g.globalAlpha = 1;
      }
    }
    return C().tex(c, true, true);
  }

  /** A round clock face (white dial, black ticks, hands at 10:10) for the tower's four faces. */
  function clockFace() {
    const c = C().canvas(256, 256);
    const g = c.getContext("2d");
    g.fillStyle = "#16603f";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#f6f3ea";
    g.beginPath();
    g.arc(128, 128, 112, 0, TAU);
    g.fill();
    g.strokeStyle = "#1b1b1b";
    g.lineWidth = 5;
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * TAU;
      g.beginPath();
      g.moveTo(128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92);
      g.lineTo(128 + Math.sin(a) * 106, 128 - Math.cos(a) * 106);
      g.stroke();
    }
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(128, 128);
    g.lineTo(128 - 50, 128 - 38);
    g.moveTo(128, 128);
    g.lineTo(128 + 30, 128 - 72);
    g.stroke();
    return C().tex(c, true);
  }

  /** A photo-backed, vertex-tinted material from the shared texture sets (sand, dirt, rock, ...). */
  function photoMat(name, rough, normal, extra) {
    const t = P.Tex.set(name);
    const o = { vertexColors: true, map: t.map, normalMap: t.normalMap, roughness: rough };
    if (t.normalMap) o.normalScale = new THREE.Vector2(normal, normal);
    return new THREE.MeshStandardMaterial(Object.assign(o, extra || {}));
  }

  /** Ground and stone materials of the Haramain world: desert sand, dusty dirt, rock, limestone, sandstone. */
  function terrainMats() {
    const out = {
      sand: photoMat("sand", 1, 0.9, { envMapIntensity: 0.3 }),
      dirt: photoMat("dirt", 1, 0.8, {
        envMapIntensity: 0.3,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
      rock: photoMat("rock", 1, 1.1, { envMapIntensity: 0.35 }),
      limestone: photoMat("limestone", 0.55, 0.5),
      sandstone: photoMat("sandstone", 0.9, 0.9),
    };
    out.dust = photoMat("dirt", 1, 0.5, {
      envMapIntensity: 0.3,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    out.dust.userData.cast = false;
    out.sand.userData.cast = false;
    out.dirt.userData.cast = false;
    out.rock.userData.kqSkip = true;
    return out;
  }

  /** The materials only the Haramain world needs, added to the shared catalogue `mats`. */
  function extendMats(mats) {
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o));
    mats.redCarpet = std({ map: carpetCanvas("#8c1f24", "#d9c9a0", "#e9dfc3"), roughness: 0.95 });
    mats.greenCarpet = std({ map: carpetCanvas("#1f7a4d", "#efe7cf", "#e9f3e8"), roughness: 0.95 });
    mats.redCarpet.userData.cast = false;
    mats.greenCarpet.userData.cast = false;
    mats.kiswah = std({
      color: 0x2a2a30,
      roughness: 0.78,
      metalness: 0.05,
      envMapIntensity: 0.4,
      emissive: 0x2a2a34,
      emissiveIntensity: 0,
    });
    Object.assign(mats, P.HolyFacade.materials(), terrainMats());
    mats.clock = std({ map: clockFace(), emissive: 0xffffff, emissiveIntensity: 0.15 });
    mats.clock.emissiveMap = mats.clock.map;
    mats.chandelier = std({ color: 0xfff1d0, emissive: 0xffd58a, emissiveIntensity: 1.6 });
    mats.chandelier.userData.cast = false;
    mats.greenLight = std({ color: 0x9dffc0, emissive: 0x2cff7a, emissiveIntensity: 1.6 });
    mats.greenLight.userData.cast = false;
    mats.frond = std({ side: THREE.DoubleSide, roughness: 0.8 });
    mats.glowKeys = Object.assign({}, mats.glowKeys, glowTable());
    return mats;
  }

  /** The glow table for the Haramain world: the shared one plus the hotel windows and clock. */
  function glowTable() {
    return Object.assign({}, P.Materials.GLOW, {
      hotel: 1.1,
      stoneHotel: 1.0,
      apartment: 0.9,
      clock: 0.9,
      kiswah: 1,
    });
  }

  /**
   * Wall slab (centred on x, base y=0, thickness t) with one pointed-arch opening: width `w`,
   * height `h`, opening half-width `hw`, arch starting at `spring`.
   */
  function archSlab(w, h, hw, spring, t) {
    return P.cached(`holyArch:${w}:${h}:${hw}:${spring}:${t}`, () => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(-hw, 0);
      s.lineTo(-hw, spring);
      s.bezierCurveTo(-hw, spring + hw * 0.9, -hw * 0.35, spring + hw * 1.45, 0, spring + hw * 1.6);
      s.bezierCurveTo(hw * 0.35, spring + hw * 1.45, hw, spring + hw * 0.9, hw, spring);
      s.lineTo(hw, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(w / 2, h);
      s.lineTo(-w / 2, h);
      s.lineTo(-w / 2, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 6 });
      g.translate(0, 0, -t / 2);
      return g;
    });
  }

  /** Axis-aligned collider helper. */
  function solid(list, x0, z0, x1, z1, kind) {
    list.push({
      minX: Math.min(x0, x1),
      maxX: Math.max(x0, x1),
      minZ: Math.min(z0, z1),
      maxZ: Math.max(z0, z1),
      kind: kind || "holy",
    });
  }

  /** A lathe (revolved) dome profile: radius r, height scale k, `bulge` > 1 makes an onion. */
  function domeGeo(r, k, bulge) {
    return P.cached(`holyDome:${r}:${k}:${bulge}`, () => {
      const pts = [];
      for (let i = 0; i <= 14; i += 1) {
        const t = i / 14;
        const x =
          r * (Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) * (1 + (bulge - 1) * (1 - t)));
        pts.push(new THREE.Vector2(Math.max(0.02, x * (1 - Math.pow(t, 3) * 0.98)), t * r * k));
      }
      return new THREE.LatheGeometry(pts, 28);
    });
  }

  /** A dome on a drum with a gold finial; `key` picks the material (paint / metal / dome). */
  function dome(B, o) {
    const g = domeGeo(o.r, o.k || 1, o.bulge || 1);
    B.cyl(
      o.drumKey || "whitePlaster",
      o.x,
      o.y + o.r * 0.12,
      o.z,
      o.r * 1.02,
      o.r * 0.24,
      24,
      0xf4efe4,
    );
    B.geo(o.key, g, P.compose(o.x, o.y + o.r * 0.24, o.z, 0, 1, 1, 1), o.color);
    if (o.finial === false) return;
    P.Mosque.finial(B, o.x, o.y + o.r * 0.24 + o.r * (o.k || 1), o.z, o.r * 0.7);
  }

  /** One merged minaret: square base, tapering shaft, two balconies, a cap and a crescent. */
  function minaretParts(B, x, z, h, ctx) {
    const w = 2.6;
    B.aabb("whitePlaster", x - w, 0, z - w, x + w, h * 0.34, z + w, 0xf2ece0);
    B.box("whitePlaster", x, h * 0.36, z, w * 1.2, 0.5, w * 1.2, 0xe7dfce);
    const shaft = new THREE.CylinderGeometry(w * 0.62, w * 0.78, h * 0.5, 14);
    B.geo("whitePlaster", shaft, P.compose(x, h * 0.62, z, 0, 1, 1, 1), 0xf4efe4);
    [0.5, 0.8].forEach((k) => {
      B.cyl("gold", x, h * k, z, w * 0.98, 0.5, 16, 0xcfa64a);
      B.cyl("whitePlaster", x, h * k + 0.5, z, w * 0.78, 0.5, 16, 0xf3eddf);
    });
    B.geo(
      "metal",
      new THREE.ConeGeometry(w * 0.7, h * 0.14, 14),
      P.compose(x, h * 0.9, z, 0, 1, 1, 1),
      0x2f8f5a,
    );
    P.Mosque.finial(B, x, h * 0.97, z, 2.4);
    solid(ctx.colliders, x - w, z - w, x + w, z + w, "minaret");
  }

  /** The minaret list as instancing would be heavy for 14 tall towers; merge each into the batch. */
  function minarets(B, list, ctx) {
    list.forEach((m) => minaretParts(B, m.x, m.z, m.h, ctx));
  }

  /** Paint a whole geometry one colour (vertex colours), so instanced materials with vertexColors work. */
  function tint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) a.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(a, 3));
    return geo;
  }

  /** A straight wall run along one axis with a collider; `y0`..`y1` span, thickness t. */
  function wall(B, ctx, o) {
    const x0 = Math.min(o.x0, o.x1) - (o.z0 === o.z1 ? 0 : o.t / 2);
    const x1 = Math.max(o.x0, o.x1) + (o.z0 === o.z1 ? 0 : o.t / 2);
    const z0 = Math.min(o.z0, o.z1) - (o.x0 === o.x1 ? 0 : o.t / 2);
    const z1 = Math.max(o.z0, o.z1) + (o.x0 === o.x1 ? 0 : o.t / 2);
    B.aabb(
      o.key || "whitePlaster",
      x0,
      o.y0 || 0,
      z0,
      x1,
      o.y1,
      z1,
      o.color === undefined ? 0xf4efe4 : o.color,
    );
    if (!o.free) solid(ctx.colliders, x0, z0, x1, z1, o.kind || "mosque-wall");
  }

  /** A street lamp (instanced via ctx.lamps list for halos; geometry in the batch). */
  function lamp(B, ctx, x, z, h) {
    B.cyl("metal", x, h / 2, z, 0.09, h, 6, 0xaab0b6);
    B.cyl("lamp", x, h + 0.1, z, 0.28, 0.2, 8, 0xfff4dc);
    ctx.lamps.push({ x, y: h, z });
  }

  P.HolyKit = {
    UV,
    extendMats,
    glowTable,
    archSlab,
    solid,
    domeGeo,
    dome,
    minarets,
    wall,
    lamp,
    tint,
    carpetCanvas,
  };
})((window.KQ = window.KQ || {}));
