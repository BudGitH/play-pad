/* ============================================================================
 * FILE: pictures.js
 * PURPOSE: Every picture the HUD shows, with no image files: UI icons, dish art, the twelve
 *          wudu step pictures (small inline SVGs, as in the chosen mockup) and the posture
 *          pictures, which are real renders of the toy-figure poses (KQ.Figures).
 * BUSINESS CONTEXT: Design decision D ("Kid dock and needs ring", owner, 2026-11-26): pictures
 *   first, every tile also has a text label so a missing picture never blocks play. Works on
 *   file:// (nothing is fetched).
 * DEPENDENCIES: THREE, KQ.Figures, util.js. Posture renders need a WebGLRenderer (boot).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;

  const ICONS = {
    clock:
      "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.2a7.8 7.8 0 1 1 0 15.6 7.8 7.8 0 0 1 0-15.6zM11 6h2v5.6l3.6 2.1-1 1.7L11 12.8z",
    coin: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm-1 3v8h2V8z",
    mosque:
      "M2 21V10h2v11zM3 6.5 4.6 9H1.4zM6 21v-6a6 5.5 0 0 1 12 0v6h-4v-3a2 2 0 0 0-4 0v3zm6-12.6a1.6 1.6 0 1 1 0-3.2 2 2 0 1 0 0 3.2zM20 21V10h2v11zm1-14.5L22.6 9h-3.2z",
    bowl: "M2 11h20a10 8 0 0 1-20 0zM7 3c1 1.2 1 2.4 0 3.6s-1 2.2 0 3.4h1.6c-1-1.2-1-2.2 0-3.4s1-2.4 0-3.6zM12 2c1 1.2 1 2.4 0 3.6s-1 2.2 0 3.4h1.6c-1-1.2-1-2.2 0-3.4s1-2.4 0-3.6zM17 3c1 1.2 1 2.4 0 3.6h1.6c1-1.2 1-2.4 0-3.6z",
    bolt: "M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.6z",
    star: "M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z",
    pause: "M6 4h4v16H6zm8 0h4v16h-4z",
    sound:
      "M3 9h4l5-4v14l-5-4H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z",
    mute: "M3 9h4l5-4v14l-5-4H3zm12.6 1.4L17 9l2 2 2-2 1.4 1.4-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2z",
    map: "M9 3 3 5.3v15.5l6-2.3 6 2.3 6-2.3V3l-6 2.3zm1 2.4 4 1.5v12l-4-1.5z",
    bag: "M5 7h14l1 14H4zm4 0a3 3 0 0 1 6 0h-2a1 1 0 0 0-2 0z",
    run: "M4 6l6 6-6 6V6zm8 0l6 6-6 6V6z",
    talk: "M3 4h18v12H9l-5 4v-4H3z",
    check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
    arrow: "M12 2 20 21l-8-4-8 4z",
    home: "M12 3 2 12h3v9h5v-6h4v6h5v-9h3z",
    close:
      "M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z",
    speaker: "M3 9h4l5-4v14l-5-4H3zm13 3a4 4 0 0 0-2-3.5v7a4 4 0 0 0 2-3.5z",
    book: "M4 3h7a2 2 0 0 1 2 2v16a2 2 0 0 0-2-2H4zm16 0h-5a2 2 0 0 0-2 2v16a2 2 0 0 1 2-2h5z",
    cat: "M4 3l4 4h8l4-4v9a8 8 0 0 1-16 0zm5 8a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 9 11zm6 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z",
    sticker: "M4 4h16v10l-6 6H4zm10 16v-6h6",
    recycle: "M12 3l4 5h-3v4h-2V8H8zm-7 9 2-2 3 5H8l-1 3-4-5zm14 0-2-2-3 5h2l1 3 4-5z",
    pin: "M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z",
    scissors:
      "M6 3a3 3 0 1 0 1.2 5.7L9.5 12l-2.3 3.3A3 3 0 1 0 9 17.3L12 13l8 8h2L12.2 11 22 3h-2l-8 6.4-2.2-3A3 3 0 0 0 6 3zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm0 12a1 1 0 1 1 0 2 1 1 0 0 1 0-2z",
    heart: "M12 21 3.5 12.5a5.5 5.5 0 0 1 8.5-7 5.5 5.5 0 0 1 8.5 7z",
    play: "M8 5v14l11-7z",
    drop: "M12 2c-4 5.5-6 8.6-6 11a6 6 0 0 0 12 0c0-2.4-2-5.5-6-11z",
    hand: "M8 11V4.5a1.5 1.5 0 0 1 3 0V10h1V3.5a1.5 1.5 0 0 1 3 0V10h1V5.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L2.6 14a1.6 1.6 0 0 1 2.5-2z",
    refresh:
      "M12 4a8 8 0 1 0 7.7 10h-2.1A6 6 0 1 1 12 6c1.7 0 3.2.7 4.2 1.8L13 11h7V4l-2.7 2.7A8 8 0 0 0 12 4z",
  };

  function icon(name, cls) {
    return U.svgFrom('<path d="' + (ICONS[name] || ICONS.star) + '"/>', cls);
  }

  function svg(viewBox, inner, size, cls) {
    const el = U.svgFrom(inner, cls);
    el.setAttribute("class", cls || "");
    el.setAttribute("viewBox", viewBox);
    el.setAttribute("width", size);
    el.setAttribute("height", size);
    return el;
  }

  const FOOD = {
    prata:
      '<ellipse cx="20" cy="20" rx="12" ry="9" fill="#e0a85a"/><path d="M11 18q9 6 18 0" stroke="#b8792f" stroke-width="2" fill="none"/>',
    murtabak:
      '<rect x="9" y="12" width="22" height="16" rx="3" fill="#d79b4c"/><path d="M9 20h22M20 12v16" stroke="#a96c25" stroke-width="2"/>',
    mee: '<path d="M10 22q4-8 8 0t8 0 6-2" stroke="#e3b23c" stroke-width="3" fill="none"/><path d="M11 17q4-6 8 0t8 0" stroke="#d98c2b" stroke-width="3" fill="none"/>',
    rice: '<ellipse cx="18" cy="21" rx="10" ry="7" fill="#f2c94c"/><circle cx="26" cy="17" r="5" fill="#a0522d"/>',
    drink:
      '<rect x="13" y="8" width="14" height="22" rx="3" fill="#c98f5a"/><rect x="13" y="8" width="14" height="6" fill="#f3e3c8"/>',
    malt: '<rect x="13" y="8" width="14" height="22" rx="3" fill="#6b4226"/><rect x="13" y="8" width="14" height="6" fill="#cfe9f7"/>',
    rose: '<rect x="13" y="8" width="14" height="22" rx="3" fill="#f28fb1"/><rect x="13" y="8" width="14" height="5" fill="#fde2ea"/>',
    satay:
      '<path d="M8 28 32 12M8 20 32 20M8 12 32 28" stroke="#c9a06a" stroke-width="2"/><rect x="14" y="10" width="7" height="6" rx="2" fill="#a8582a"/><rect x="14" y="17" width="7" height="6" rx="2" fill="#a8582a"/><rect x="14" y="24" width="7" height="6" rx="2" fill="#a8582a"/>',
    kuih: '<rect x="10" y="12" width="20" height="16" rx="3" fill="#f6dfe6"/><path d="M10 17h20M10 22h20" stroke="#e86a92" stroke-width="3"/><path d="M10 27h20" stroke="#7bbf7b" stroke-width="3"/>',
    water:
      '<rect x="15" y="6" width="10" height="24" rx="3" fill="#9fd8f6"/><rect x="17" y="3" width="6" height="4" fill="#2a63b0"/>',
    biscuit:
      '<rect x="9" y="11" width="22" height="18" rx="3" fill="#d6a15c"/><circle cx="16" cy="18" r="2" fill="#a06a2c"/><circle cx="24" cy="18" r="2" fill="#a06a2c"/><circle cx="20" cy="24" r="2" fill="#a06a2c"/>',
    grocery:
      '<path d="M9 14h22l-2 16H11z" fill="#c68a4b"/><path d="M14 14a6 6 0 0 1 12 0" stroke="#8a5a2b" stroke-width="2.5" fill="none"/><circle cx="17" cy="19" r="3" fill="#e5483a"/><circle cx="24" cy="20" r="3" fill="#6cc04a"/>',
    card: '<rect x="9" y="11" width="22" height="18" rx="2" fill="#fde2ea"/><path d="M20 24 14 19a3 3 0 0 1 6-3 3 3 0 0 1 6 3z" fill="#ff6b85"/>',
    notebook:
      '<rect x="11" y="8" width="18" height="24" rx="2" fill="#3f74e8"/><path d="M15 14h10M15 19h10" stroke="#fff" stroke-width="2"/>',
    fish: '<path d="M8 20q8-9 18 0-10 9-18 0z" fill="#f2a64a"/><path d="M26 20l7-6v12z" fill="#f2a64a"/><circle cx="14" cy="19" r="1.5" fill="#2a1a10"/>',
  };
  const DISH_KIND = {
    roti_prata: "prata",
    murtabak: "murtabak",
    nasi_lemak: "rice",
    nasi_goreng: "rice",
    mee_soto: "mee",
    mee_rebus: "mee",
    satay_ayam: "satay",
    teh_tarik: "drink",
    choc_malt_ais: "malt",
    kuih_lapis: "kuih",
    bottled_water: "water",
    biscuits: "biscuit",
    groceries: "grocery",
    get_well_card: "card",
    notebook: "notebook",
    cat_treats: "fish",
  };

  function dish(itemId, size) {
    const body = FOOD[DISH_KIND[itemId]] || FOOD.prata;
    return svg(
      "0 0 40 40",
      '<circle cx="20" cy="20" r="18" fill="#fbf7ee"/><circle cx="20" cy="20" r="14" fill="none" stroke="#e5dccb"/>' +
        body,
      size || 48,
      "kq-pic",
    );
  }

  const WU_FACE =
    '<circle cx="24" cy="22" r="14" fill="#d9a066"/><circle cx="19" cy="20" r="2" fill="#2a1a10"/><circle cx="29" cy="20" r="2" fill="#2a1a10"/>';
  const drop = (x, y) => '<path d="M' + x + " " + y + 'c-3 4-3 7 0 7s3-3 0-7z" fill="#64d2ff"/>';
  const side = (t) =>
    '<text x="40" y="44" font-size="12" font-weight="800" fill="#4a2a10" text-anchor="middle">' +
    t +
    "</text>";
  const WUDU_ART = {
    niat: '<path d="M24 40 8 24a8 8 0 0 1 16-10 8 8 0 0 1 16 10z" fill="#ff6b85"/>',
    hands:
      '<ellipse cx="16" cy="26" rx="7" ry="11" fill="#d9a066"/><ellipse cx="32" cy="26" rx="7" ry="11" fill="#d9a066"/>' +
      drop(24, 6),
    mouth:
      WU_FACE +
      '<path d="M18 28q6 5 12 0" stroke="#7d1530" stroke-width="3" fill="none"/>' +
      drop(38, 26),
    nose:
      WU_FACE +
      '<path d="M24 21v7h-3" stroke="#7d4a20" stroke-width="2.5" fill="none"/>' +
      drop(38, 18),
    face: WU_FACE + drop(8, 10) + drop(38, 10) + drop(23, 2),
    arm_r:
      '<rect x="6" y="18" width="34" height="12" rx="6" fill="#d9a066"/><circle cx="8" cy="24" r="7" fill="#fff"/>' +
      drop(30, 4) +
      side("R"),
    arm_l:
      '<rect x="8" y="18" width="34" height="12" rx="6" fill="#d9a066"/><circle cx="40" cy="24" r="7" fill="#fff"/>' +
      drop(16, 4) +
      side("L"),
    head: WU_FACE + '<path d="M10 14q14-14 28 0" stroke="#fff" stroke-width="5" fill="none"/>',
    ears:
      WU_FACE +
      '<circle cx="9" cy="22" r="4" fill="#f4c26b"/><circle cx="39" cy="22" r="4" fill="#f4c26b"/>',
    foot_r:
      '<path d="M14 8h10v22h14a5 5 0 0 1 0 10H14z" fill="#d9a066"/>' + drop(32, 18) + side("R"),
    foot_l:
      '<path d="M34 8H24v22H10a5 5 0 0 0 0 10h24z" fill="#d9a066"/>' + drop(16, 18) + side("L"),
    doa: '<path d="M8 30q0-14 16-14t16 14q-8 10-16 10T8 30z" fill="#d9a066"/><path d="M24 16v-8M17 18l-4-7M31 18l4-7" stroke="#f4c26b" stroke-width="3" stroke-linecap="round"/>',
  };

  function wudu(stepId, size) {
    return svg("0 0 48 48", WUDU_ART[stepId] || WUDU_ART.niat, size || 56, "kq-pic");
  }

  /** Posture pictures: data-URL renders of the toy-figure poses, filled in by renderPostures. */
  const postureImages = {};
  const POSTURE_POSE = {
    takbir: "takbir",
    qiyam: "qiyam",
    ruku: "ruku",
    itidal: "itidal",
    sujud: "sujud",
    julus: "julus",
    tasyahud: "julus",
    salam_r: "salam_r",
    salam_l: "salam_l",
    qunut: "doa",
  };

  /** Camera azimuth per posture picture: 0 = pure side view, larger = more from the front. */
  const POSTURE_AZ = { standing: 0.9, ruku: 0.3, sujud: 0.3 };

  function posture(type, size) {
    const img = document.createElement("img");
    img.className = "kq-posture";
    img.alt = "";
    img.width = img.height = size || 72;
    if (postureImages[type]) img.src = postureImages[type];
    else img.className += " kq-posture-missing";
    return img;
  }

  function readPixels(renderer, rt, size) {
    const buf = new Uint8Array(size * size * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    const tmp = document.createElement("canvas");
    tmp.width = tmp.height = size;
    tmp.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(buf), size, size), 0, 0);
    const out = document.createElement("canvas");
    out.width = out.height = 160;
    const ctx = out.getContext("2d");
    ctx.translate(0, 160);
    ctx.scale(1, -1);
    ctx.drawImage(tmp, 0, 0, 160, 160);
    return out.toDataURL("image/png");
  }

  function aim(cam, az) {
    cam.position.set(-3 * Math.cos(az), 0, 3 * Math.sin(az));
    cam.lookAt(0, 0, 0);
  }

  function postureStage(renderer) {
    const scene = new THREE.Scene();
    scene.environment = KQ.Figures.makeEnv(renderer);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-2, 3, 2);
    scene.add(sun);
    const fig = KQ.Figures.build("hero");
    scene.add(fig);
    const cam = new THREE.OrthographicCamera(-0.66, 0.66, 1.16, -0.16, 0.1, 10);
    return { scene, fig, cam };
  }

  /** Render each posture once into a small PNG data URL (called once at boot, needs WebGL). */
  function renderPostures(renderer, az) {
    const size = 256;
    const rt = new THREE.WebGLRenderTarget(size, size);
    rt.texture.encoding = THREE.sRGBEncoding;
    const stage = postureStage(renderer);
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0xe6eef8, 1);
    renderer.setRenderTarget(rt);
    Object.keys(POSTURE_POSE).forEach(function (type) {
      aim(stage.cam, az === undefined ? POSTURE_AZ[type] || POSTURE_AZ.standing : az);
      KQ.Figures.pose(stage.fig.userData.rig, POSTURE_POSE[type], 0, 1);
      stage.fig.updateMatrixWorld(true);
      renderer.clear();
      renderer.render(stage.scene, stage.cam);
      postureImages[type] = readPixels(renderer, rt, size);
    });
    renderer.setRenderTarget(null);
    renderer.setClearColor(prevClear, prevAlpha);
    rt.dispose();
    stage.scene.remove(stage.fig);
  }

  const MISSION_ICON = {
    prata_for_nenek: "bowl",
    salam_to_imam: "mosque",
    lost_cat: "cat",
    recycling_hero: "recycle",
    groceries_for_atuk: "bag",
    kuih_delivery: "bag",
    clean_playground: "star",
    return_the_book: "book",
    get_well_card: "sticker",
    parcel_run: "bag",
    teh_tarik_for_uncle: "bowl",
    fun_day_flyers: "sticker",
  };
  const STEP_ICON = { talk: "talk", buy: "bag", deliver: "home", goto: "pin", collect: "recycle" };

  G.Pictures = {
    icon,
    dish,
    wudu,
    posture,
    renderPostures,
    missionIcon: (id) => icon(MISSION_ICON[id] || "star"),
    stepIcon: (type) => icon(STEP_ICON[type] || "star"),
    postureCount: () => Object.keys(postureImages).length,
    postureImages: () => postureImages,
    POSTURE_POSE,
    ICONS,
  };
})((window.KQ = window.KQ || {}));
