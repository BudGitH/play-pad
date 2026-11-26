/* Kampung Quest — shared PBR material catalogue for the world (KQ.WorldParts.Materials).
   Keys double as Batch bucket keys; UV_SCALES says which keys get world-space UVs and how many
   metres one texture repeat covers. Night-glow materials are listed in `glow` so the sky module
   can fade them up after sunset. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});

  /** Metres per texture repeat for world-UV materials. */
  const UV_SCALES = {
    asphalt: 6,
    paving: 2.4,
    plaster: 3.2,
    whitePlaster: 3.2,
    concrete: 2.6,
    grass: 4,
    tiles: 1.3,
    wetTiles: 1.3,
    marble: 1.8,
    roof: 1.6,
    rubber: 2.2,
    bark: 1.2,
    terrazzo: 1.2,
    hedge: 0.9,
    tilework: 0.7,
    wallTile: 0.9,
    books: 1.0,
    railing: 0.9,
    leaf: 2.2,
  };

  function std(o, flags) {
    const m = new THREE.MeshStandardMaterial(
      Object.assign({ vertexColors: true, envMapIntensity: 0.65 }, o),
    );
    Object.assign(m.userData, flags || {});
    return m;
  }

  /** Photo-backed material with roughness/normal defaults. */
  function photo(name, rough, normalScale, extra) {
    const s = P.Tex.set(name);
    const o = {
      map: s.map,
      normalMap: s.normalMap,
      roughnessMap: s.roughnessMap,
      roughness: rough,
    };
    if (s.normalMap) o.normalScale = new THREE.Vector2(normalScale, normalScale);
    return std(Object.assign(o, extra || {}));
  }

  function surfaces() {
    return {
      asphalt: photo("asphalt", 1.0, 0.8, { envMapIntensity: 0.35 }),
      paving: photo("paving", 0.85, 0.7),
      plaster: photo("plaster", 0.88, 0.5),
      concrete: photo("concrete", 0.9, 0.6),
      grass: photo("grass", 1, 0.9, {}),
      tiles: photo("tiles", 0.38, 0.5),
      marble: photo("marble", 0.22, 0.4),
      roof: photo("roof", 0.72, 0.9),
      rubber: photo("rubber", 0.95, 0.6),
      bark: photo("bark", 0.95, 1.0),
      terrazzo: photo("terrazzo", 0.4, 0.35, { envMapIntensity: 0.9 }),
      hedge: photo("hedge", 0.85, 0.6),
    };
  }

  function painted(pat) {
    const railing = pat.railing;
    return {
      paint: std({ roughness: 0.55, metalness: 0.0 }),
      plastic: std({ roughness: 0.32, metalness: 0.0 }),
      wood: std({ roughness: 0.6, metalness: 0.0 }),
      metal: std({ roughness: 0.32, metalness: 0.85 }),
      chrome: std({ roughness: 0.12, metalness: 1.0, envMapIntensity: 1.2 }),
      gold: std({ roughness: 0.28, metalness: 1.0, envMapIntensity: 1.1 }),
      dome: std({
        roughness: 0.25,
        metalness: 1.0,
        envMapIntensity: 1.1,
        emissive: 0x8a6a2a,
        emissiveIntensity: 0,
      }),
      wallTile: std({ map: pat.wallTiles, roughness: 0.18 }),
      railing: std({
        map: railing,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.45,
        metalness: 0.5,
      }),
      marking: std(
        { roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
        { cast: false },
      ),
      leaf: std({ map: pat.leaves, roughness: 0.8 }),
      tilework: std({ map: pat.tilework, roughness: 0.3 }),
      books: std({ map: pat.books, roughness: 0.8 }),
      dark: std({ roughness: 0.9 }),
    };
  }

  /** Window / sign materials that glow at night. */
  function glowing(pat, atlas) {
    const win = pat.windows;
    const glass = new THREE.MeshStandardMaterial({
      color: 0x9fb8c8,
      roughness: 0.05,
      metalness: 0.2,
    });
    Object.assign(glass, {
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    glass.userData.cast = false;
    const winBase = { map: win.col, roughnessMap: win.rough, roughness: 1, metalness: 0.15 };
    const glow = { emissive: 0xffffff, emissiveIntensity: 0 };
    const offset = { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 };
    const noCast = { cast: false };
    return {
      window: std(winBase),
      windowLit: std(Object.assign({ emissiveMap: win.glow }, winBase, glow)),
      sign: std(
        Object.assign({ map: atlas.texture, emissiveMap: atlas.texture, roughness: 0.45 }, glow),
      ),
      decal: std(Object.assign({ map: atlas.texture, roughness: 0.7 }, offset)),
      lamp: std(
        { color: 0xfff4dc, emissive: 0xffe2a8, emissiveIntensity: 0, roughness: 0.3 },
        noCast,
      ),
      beacon: std(
        { color: 0xffa21a, emissive: 0xff8a00, emissiveIntensity: 0, roughness: 0.25 },
        noCast,
      ),
      glass,
    };
  }

  /** Alpha leaf-cluster cards: the CC0 photo atlas over http(s), the canvas card on file://. */
  function leafCard(P2) {
    const t = P.Tex.set("leaves");
    const photo = !!t.alphaMap;
    const m = std({
      map: photo ? t.map : P2.leafCard(),
      alphaMap: t.alphaMap,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.7,
      envMapIntensity: 0.4,
    });
    m.userData.atlas = photo; // two cells side by side (rain-tree | broadleaf)
    m.userData.kqSkip = true;
    return m;
  }
  /** Grass tuft cards (alpha), or null without the photo (file://). */
  function tuftMat() {
    const t = P.Tex.set("tuft");
    if (!t.alphaMap) return null;
    const m = std({
      map: t.map,
      alphaMap: t.alphaMap,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.85,
    });
    m.userData.kqSkip = true;
    return m;
  }

  /** Mosque ornament materials (lattice screens, frieze band, warm-glowing hall glass). */
  function ornaments(pat) {
    const out = {};
    if (pat.lattice) {
      const o = { map: pat.lattice, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5 };
      out.lattice = std(o);
    }
    if (pat.frieze) out.frieze = std({ map: pat.frieze, roughness: 0.45, metalness: 0.25 });
    const glass = std(
      { color: 0xcfe3dc, roughness: 0.08, metalness: 0.1, emissive: 0xffc98a },
      { cast: false },
    );
    Object.assign(glass, { transparent: true, opacity: 0.55, depthWrite: false });
    glass.side = THREE.DoubleSide;
    glass.emissiveIntensity = 0;
    out.hallGlass = glass;
    return out;
  }

  /** Detail-layer materials: grime/streak decals, leaf cards, distant skyline. */
  function details() {
    const P2 = P.Patterns2;
    const decal = (map) =>
      std(
        {
          map,
          transparent: true,
          depthWrite: false,
          roughness: 1,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        },
        { cast: false },
      );
    const sky = P2.skyline();
    sky.col.repeat.set(2, 3);
    return {
      grime: decal(P2.grime()),
      streak: decal(P2.streaks()),
      leafCard: leafCard(P2),
      skyline: std(
        {
          map: sky.col,
          emissiveMap: sky.glow,
          emissive: 0xffffff,
          emissiveIntensity: 0,
          roughness: 0.9,
          fog: false,
        },
        { cast: false },
      ),
    };
  }

  /** Night-glow levels per material key (multiplied by the night factor). */
  const GLOW = {
    windowLit: 1.25,
    sign: 0.75,
    lamp: 3.2,
    beacon: 2.0,
    dome: 0.55,
    skyline: 0.55,
    hallGlass: 0.9,
  };

  /** Surface-patch strengths per key: [macro variation, rain streaks, wet patches, dirt]. */
  const GRIME = {
    asphalt: [0.55, 0, 1.0, 0.5],
    paving: [0.6, 0, 0.45, 0.45],
    plaster: [0.6, 0.6, 0, 0.75],
    concrete: [0.4, 0.5, 0.2, 0.6],
    grass: [0.8, 0, 0, 0],
    tiles: [0.45, 0.15, 0.35, 0.45],
    terrazzo: [0.45, 0, 0.12, 0.55],
    marble: [0.25, 0.2, 0.25, 0.25],
    roof: [0.7, 0.4, 0, 0.3],
    rubber: [0.5, 0, 0.2, 0.2],
    bark: [0.4, 0, 0, 0.2],
    paint: [0.35, 0.35, 0, 0.45],
    wood: [0.35, 0, 0, 0.3],
    metal: [0.35, 0.15, 0, 0.2],
    wallTile: [0.3, 0.3, 0, 0.55],
    marking: [0.7, 0, 0.6, 1.0],
    window: [0.2, 0.3, 0, 0],
    windowLit: [0.2, 0.3, 0, 0],
    gold: [0.15, 0, 0, 0],
    dome: [0.12, 0.08, 0, 0],
    frieze: [0.2, 0.2, 0, 0],
    plastic: [0.2, 0, 0, 0.2],
    carpet: [0.3, 0, 0, 0.15],
    dark: [0.3, 0, 0, 0.2],
  };

  /** Build the whole catalogue once. */
  function create(pat, atlas) {
    const m = Object.assign(surfaces(), painted(pat), glowing(pat, atlas));
    Object.assign(m, details());
    const carpetN = P.Tex.set("carpet").normalMap;
    m.carpet = new THREE.MeshStandardMaterial({
      map: pat.carpet,
      normalMap: carpetN,
      roughness: 0.95,
    });
    m.carpet.userData.cast = false;
    const fibre = P.Tex.set("carpet_d").map;
    if (fibre) m.carpet.userData.kqDetail = { map: fibre, scale: 5 };
    m.tuft = tuftMat();
    m.whitePlaster = m.plaster.clone(); // mosque walls: kept clean and bright
    m.whitePlaster.userData = { kq: [0.22, 0.25, 0, 0.3] };
    m.streak.opacity = 0.55; // softer rain streaks under ledges
    m.wetTiles = m.tiles.clone(); // wudu floor: always wet, even under the shelter roof
    m.wetTiles.userData = { kq: [0.45, 0.1, 1.5, 0.4] };
    Object.assign(m, ornaments(pat));
    if (pat.far) {
      Object.assign(m.skyline, { map: pat.far.col, emissiveMap: pat.far.glow });
      m.skyline.userData.far = true;
    }
    m.grass.userData.cast = false;
    m.asphalt.userData.cast = false;
    m.glowKeys = GLOW;
    Object.keys(GRIME).forEach((k) => m[k] && (m[k].userData.kq = GRIME[k]));
    return m;
  }

  P.Materials = { create, UV_SCALES, GLOW, GRIME };
})((window.KQ = window.KQ || {}));
