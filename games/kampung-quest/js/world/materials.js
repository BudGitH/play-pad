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
    concrete: 2.6,
    grass: 4,
    tiles: 1.3,
    marble: 1.8,
    roof: 1.6,
    rubber: 2.2,
    bark: 1.2,
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
      leafCard: std({
        map: P2.leafCard(),
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.75,
      }),
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
  const GLOW = { windowLit: 1.25, sign: 0.75, lamp: 3.2, beacon: 2.0, dome: 0.55, skyline: 0.55 };

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
    m.grass.userData.cast = false;
    m.asphalt.userData.cast = false;
    m.glowKeys = GLOW;
    return m;
  }

  P.Materials = { create, UV_SCALES, GLOW };
})((window.KQ = window.KQ || {}));
