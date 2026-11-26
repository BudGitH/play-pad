// Kampung Quest dev showcase — lines up the whole cast on the glossy table, with a hero turntable,
// side / close-up views and a pose cycle. Test hooks: window.__figs = { ready, setPose, setView,
// setTurn, freeze, stats, poseNames }. URL: ?view=lineup|hero|side|turntable&pose=<name>&clean=1
(function (KQ) {
  "use strict";
  var F = KQ.Figures;
  var Dev = KQ.Dev;
  var BACK = ["imam_hakim", "makcik_siti", "pakcik_rahman", "uncle_lim", "aunty_mei", "hawker_ali"];
  var BACK2 = ["hawker_aminah", "barber_raju", "dr_nurul", "librarian_farah", "postman_dan"];
  var FRONT = ["nenek", "kid_aisyah", "hero", "kid_irfan", "kid_wei", "atuk"];

  var MAT_TOP = 0.004; // the placemat sits 4 mm above the lacquer; feet stand on it
  var state = {
    solo: "hero",
    view: "lineup",
    pose: "idle",
    phase: 0.25,
    frozen: false,
    cycle: false,
    turn: 0,
    cycleT: 0,
  };
  var app = {};

  function makeRenderer() {
    var r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(r.domElement);
    return r;
  }

  function makeLights(scene) {
    var sun = new THREE.DirectionalLight(0xfff0dc, 2.3);
    sun.position.set(3.4, 5.8, 2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.01;
    var cam = sun.shadow.camera;
    cam.left = cam.bottom = -4;
    cam.right = cam.top = 4;
    cam.near = 1;
    cam.far = 14;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xfff1de, 0x3a2418, 0.45));
    var rim = new THREE.DirectionalLight(0xdfe8ff, 0.8);
    rim.position.set(-4, 3, -3);
    scene.add(rim);
  }

  function makeSet(scene) {
    var table = Dev.table(14, 8);
    scene.add(table);
    var mat = Dev.placemat(6.2, 1.9);
    mat.position.set(0, 0.004, -0.5);
    scene.add(mat);
    var back = Dev.backdrop();
    back.position.set(0, 4, 0);
    scene.add(back);
  }

  /** A real figure + a mirrored twin under the table (reads as a reflection in the lacquer). */
  function addFigure(id, x, z, list) {
    var fig = F.build(id);
    fig.position.set(x, 0, z);
    app.lineup.add(fig);
    var twin = F.build(id);
    twin.position.set(x, 0, z);
    twin.traverse(function (o) {
      o.castShadow = false;
    });
    app.mirror.add(twin);
    var entry = {
      id: id,
      fig: fig,
      twinFig: twin,
      home: x,
      homeZ: z,
      rig: fig.userData.rig,
      twin: twin.userData.rig,
    };
    entry.anim = F.Animator(fig.userData.rig);
    addStool(entry);
    addContactShadow(entry);
    list.push(entry);
  }

  /** Soft contact shadow under the feet so every figure reads as standing on the mat. */
  function addContactShadow(entry) {
    if (!app.blobTex) {
      var c = document.createElement("canvas");
      c.width = c.height = 64;
      var x = c.getContext("2d");
      var g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
      g.addColorStop(0, "rgba(0,0,0,0.55)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      app.blobTex = new THREE.CanvasTexture(c);
    }
    var m = new THREE.MeshBasicMaterial({ map: app.blobTex, transparent: true, depthWrite: false });
    var blob = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), m);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.002;
    blob.renderOrder = 1;
    entry.fig.add(blob);
  }

  /** A little wooden stool for the sit / eat poses: feet on the table, thighs on the seat. */
  function addStool(entry) {
    var d = entry.rig.dims;
    var h = (d.shin - d.legD / 2) * d.scale;
    var drop = F.seatDrop(entry.rig);
    if (!app.stoolMat)
      app.stoolMat = new THREE.MeshPhysicalMaterial({
        color: 0x8a5a36,
        roughness: 0.45,
        clearcoat: 0.8,
      });
    var stool = new THREE.Mesh(new THREE.BoxGeometry(0.26, h, 0.2), app.stoolMat);
    stool.position.set(0, drop - h / 2, -0.02);
    stool.castShadow = stool.receiveShadow = true;
    stool.visible = false;
    entry.fig.add(stool);
    entry.stool = stool;
    entry.seatY = h - drop;
  }

  function makeCast(scene) {
    app.lineup = new THREE.Group();
    app.mirror = new THREE.Group();
    app.mirror.scale.y = -1;
    scene.add(app.lineup, app.mirror);
    app.figs = [];
    BACK.forEach(function (id, i) {
      addFigure(id, (i - (BACK.length - 1) / 2) * 0.52 - 0.26, -1.05, app.figs);
    });
    BACK2.forEach(function (id, i) {
      addFigure(id, (i - (BACK2.length - 1) / 2) * 0.52 + 0.26, -0.45, app.figs);
    });
    FRONT.forEach(function (id, i) {
      addFigure(id, (i - (FRONT.length - 1) / 2) * 0.5, 0.3, app.figs);
    });
    app.hero = app.figs.filter(function (f) {
      return f.id === "hero";
    })[0];
  }

  function syncTwin(src, dst) {
    F.POSE_PARTS.JOINTS.forEach(function (k) {
      dst[k].rotation.copy(src[k].rotation);
    });
    dst.root.position.copy(src.root.position);
  }

  var VIEWS = {
    lineup: { pos: [0, 2.3, 4.5], at: [0, 0.34, -0.45], fov: 36 },
    hero: { pos: [0.8, 0.9, 2.25], at: [0, 0.5, 0.3], fov: 30 },
    side: { pos: [-2.5, 0.72, 0.45], at: [0, 0.4, 0.3], fov: 30 },
    turntable: { pos: [0, 0.75, 2.3], at: [0, 0.47, 0.3], fov: 30 },
    macro: { pos: [0.4, 0.42, 2.75], at: [0, 0.52, 0.3], fov: 27 },
  };

  function applyView() {
    var v = VIEWS[state.view] || VIEWS.lineup;
    app.camera.fov = v.fov;
    app.camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
    app.camera.lookAt(v.at[0], v.at[1], v.at[2]);
    app.camera.updateProjectionMatrix();
    var solo = state.view !== "lineup";
    app.figs.forEach(function (f) {
      var show = !solo || f.id === state.solo;
      f.fig.visible = f.twinFig.visible = show;
      f.fig.position.x = f.twinFig.position.x = solo ? 0 : f.home;
      f.fig.position.z = f.twinFig.position.z = solo ? 0.3 : f.homeZ;
    });
    if (!solo || state.view === "turntable") return;
    app.figs.forEach(function (f) {
      f.fig.rotation.y = 0;
    });
  }

  function tick(dt) {
    if (state.cycle && !state.frozen) {
      state.cycleT += dt;
      if (state.cycleT > 2.4) {
        state.cycleT = 0;
        var names = F.POSE_NAMES;
        setPose(names[(names.indexOf(state.pose) + 1) % names.length], 0.45);
      }
    }
    var solo = soloFig();
    if (state.view === "turntable")
      solo.fig.rotation.y = state.frozen
        ? state.turn
        : (solo.fig.rotation.y + dt * 0.6) % (Math.PI * 2);
    var seated = state.pose === "sit" || state.pose === "eat";
    app.figs.forEach(function (f) {
      f.stool.visible = seated;
      f.fig.position.y = f.twinFig.position.y = MAT_TOP + (seated ? f.seatY : 0);
      if (state.frozen) F.pose(f.rig, state.pose, state.phase, 1);
      else f.anim.update(dt);
      syncTwin(f.rig, f.twin);
      f.twinFig.rotation.y = f.fig.rotation.y;
    });
  }

  function soloFig() {
    return (
      app.figs.filter(function (f) {
        return f.id === state.solo;
      })[0] || app.hero
    );
  }

  function setPose(name, fade) {
    state.pose = name;
    app.figs.forEach(function (f) {
      f.anim.play(name, fade === undefined ? 0.3 : fade);
    });
    var sel = document.getElementById("pose");
    if (sel) sel.value = name;
  }

  function loop() {
    var dt = Math.min(0.05, app.clock.getDelta());
    tick(dt);
    app.renderer.render(app.scene, app.camera);
    app.frames++;
    requestAnimationFrame(loop);
  }

  function statsText() {
    var s = F.stats(app.hero.fig);
    var all = app.figs.map(function (f) {
      return F.stats(f.fig);
    });
    var maxTris = Math.max.apply(
      null,
      all.map(function (a) {
        return a.triangles;
      }),
    );
    var maxCalls = Math.max.apply(
      null,
      all.map(function (a) {
        return a.drawCalls;
      }),
    );
    return { hero: s, maxTriangles: maxTris, maxDrawCalls: maxCalls, perFigure: all };
  }

  function wireHud() {
    var sel = document.getElementById("pose");
    F.POSE_NAMES.forEach(function (n) {
      var o = document.createElement("option");
      o.value = o.textContent = n;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      setPose(sel.value);
    });
    var view = document.getElementById("view");
    view.addEventListener("change", function () {
      state.view = view.value;
      applyView();
    });
    document.getElementById("cycle").addEventListener("click", function () {
      state.cycle = !state.cycle;
    });
  }

  function readParams() {
    var q = new URLSearchParams(location.search);
    if (q.get("view")) state.view = q.get("view");
    if (q.get("solo")) state.solo = q.get("solo");
    if (q.get("clean")) document.body.classList.add("clean");
    if (q.get("cycle")) state.cycle = true;
    return q.get("pose") || "idle";
  }

  function hooks() {
    window.__figs = {
      ready: true,
      poseNames: F.POSE_NAMES.slice(),
      setPose: function (n, phase) {
        state.phase = phase === undefined ? 0.25 : phase;
        setPose(n, 0);
      },
      setView: function (v) {
        state.view = v;
        applyView();
      },
      setSolo: function (id) {
        state.solo = id;
        applyView();
      },
      setTurn: function (r) {
        state.turn = r;
      },
      freeze: function (on) {
        state.frozen = on !== false;
      },
      frames: function () {
        return app.frames;
      },
      stats: statsText,
    };
  }

  function init() {
    var first = readParams();
    app.renderer = makeRenderer();
    app.scene = new THREE.Scene();
    app.scene.background = new THREE.Color(0x2a1d15);
    app.scene.environment = F.makeEnv(app.renderer);
    app.camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.05, 60);
    app.clock = new THREE.Clock();
    app.frames = 0;
    makeLights(app.scene);
    makeSet(app.scene);
    makeCast(app.scene);
    wireHud();
    applyView();
    setPose(first, 0);
    document.getElementById("stats").textContent = JSON.stringify(statsText().hero);
    window.addEventListener("resize", function () {
      app.camera.aspect = window.innerWidth / window.innerHeight;
      app.camera.updateProjectionMatrix();
      app.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    hooks();
    loop();
  }

  init();
})((window.KQ = window.KQ || {}));
