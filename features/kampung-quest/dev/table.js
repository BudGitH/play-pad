// Kampung Quest dev showcase — the set: a glossy dark-wood table, a black-and-gold glitter placemat
// (like the reference photos) and a soft, out-of-focus room backdrop. All textures are generated.
(function (KQ) {
  "use strict";
  var Dev = (KQ.Dev = KQ.Dev || {});

  function canvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  function rng(seed) {
    return function () {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
  }

  /** Dark reddish wood with long grain, for a lacquered table top. */
  function woodTexture() {
    var c = canvas(1024, 512);
    var x = c.getContext("2d");
    var g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#3b1d12");
    g.addColorStop(0.5, "#4a2617");
    g.addColorStop(1, "#331910");
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 512);
    var r = rng(7);
    for (var i = 0; i < 260; i++) {
      var y = r() * 512;
      x.strokeStyle = r() > 0.5 ? "rgba(20,8,4,0.35)" : "rgba(120,60,34,0.22)";
      x.lineWidth = 0.6 + r() * 2.2;
      x.beginPath();
      x.moveTo(0, y);
      for (var px = 0; px <= 1024; px += 64) x.lineTo(px, y + Math.sin(px / 140 + i) * 4 * r());
      x.stroke();
    }
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  }

  /** Paint one 1024 tile of 45-degree stripes (period 128 px so it tiles) into colour / rough / metal / normal. */
  function paintStripes(ctx, kind, r) {
    var img = ctx.createImageData(1024, 1024);
    var d = img.data;
    for (var y = 0; y < 1024; y++) {
      for (var x = 0; x < 1024; x++) {
        var band = (x + y) % 128;
        var gold = band > 58;
        var spark = gold && r() > 0.8;
        var v = stripeTexel(kind, gold, spark, band, r);
        var i = (y * 1024 + x) * 4;
        d[i] = v[0];
        d[i + 1] = v[1];
        d[i + 2] = v[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function stripeTexel(kind, gold, spark, band, r) {
    var edge = gold && (band < 64 || band > 122);
    if (kind === "color") {
      if (!gold) return [8, 8, 9];
      var k = spark ? 1.15 + r() * 0.45 : 0.6 + r() * 0.4;
      return [Math.min(255, 222 * k), Math.min(255, 184 * k), Math.min(255, 96 * k)];
    }
    if (kind === "rough") return gold ? [0, spark ? 30 : 120, 0] : [0, 24, 0];
    if (kind === "metal") return gold ? [0, 0, 255] : [0, 0, 0];
    if (!gold) return [128, 128, 255];
    if (edge) return band < 64 ? [128 - 70, 128, 220] : [128 + 70, 128, 220]; // raised ridge edges (along x+y)
    return spark ? [40 + r() * 175, 40 + r() * 175, 200] : [118 + r() * 20, 118 + r() * 20, 250];
  }

  function stripeMap(kind, seed) {
    var c = canvas(1024, 1024);
    paintStripes(c.getContext("2d"), kind, rng(seed));
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (kind === "color") t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /** The black-and-gold glitter placemat (metallic glitter bands with sparkly flake normals). */
  Dev.placemat = function (w, h) {
    var maps = {
      map: stripeMap("color", 11),
      roughnessMap: stripeMap("rough", 11),
      metalnessMap: stripeMap("metal", 11),
    };
    maps.normalMap = stripeMap("normal", 11);
    var rep = [w / 1.4, h / 1.4];
    Object.keys(maps).forEach(function (k) {
      maps[k].repeat.set(rep[0], rep[1]);
    });
    var mat = new THREE.MeshPhysicalMaterial({
      map: maps.map,
      roughnessMap: maps.roughnessMap,
      metalnessMap: maps.metalnessMap,
      normalMap: maps.normalMap,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 1,
      metalness: 1,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
  };

  /** Lacquered wood table top; slightly transparent so the mirrored figures read as reflections. */
  Dev.table = function (w, h) {
    var mat = new THREE.MeshPhysicalMaterial({
      map: woodTexture(),
      roughness: 0.4,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 0.55,
      transparent: true,
      opacity: 0.86,
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    return mesh;
  };

  function bokeh(x, r) {
    for (var i = 0; i < 26; i++) {
      var cx = r() * 1024;
      var cy = 120 + r() * 260;
      var g = x.createRadialGradient(cx, cy, 0, cx, cy, 10 + r() * 26);
      g.addColorStop(0, "rgba(255,236,200,0.5)");
      g.addColorStop(1, "rgba(255,236,200,0)");
      x.fillStyle = g;
      x.fillRect(cx - 40, cy - 40, 80, 80);
    }
  }

  /** Out-of-focus room behind the table: wood-panelled wall, a bright frosted door, shelf lights. */
  Dev.backdrop = function () {
    var c = canvas(1024, 512);
    var x = c.getContext("2d");
    x.filter = "blur(14px)";
    x.fillStyle = "#6a4a36";
    x.fillRect(-40, -40, 1104, 600);
    for (var i = 0; i < 520; i += 26) {
      x.fillStyle = i % 52 ? "#7d5842" : "#5c3e2c";
      x.fillRect(i, -40, 14, 600);
    }
    x.fillStyle = "#e9ece9";
    x.fillRect(560, -40, 230, 600);
    x.fillStyle = "#cfd6d4";
    x.fillRect(820, -40, 260, 600);
    x.fillStyle = "#fff6e6";
    x.fillRect(840, 140, 220, 26);
    x.filter = "blur(6px)";
    bokeh(x, rng(3));
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    var geo = new THREE.CylinderGeometry(11, 11, 12, 48, 1, true);
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide }));
  };
})((window.KQ = window.KQ || {}));
