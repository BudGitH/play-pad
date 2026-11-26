/* Kampung Quest — the mosque, part 1 (KQ.WorldParts.Mosque): arched wall panels, the prayer
   hall shell with an onion dome, corner kiosks and crenellated parapet, the east verandah
   arcade, compound wall with gates, and the minaret. Interior + wudu are in mosque-inside.js.
   The qibla wall is the west wall (−X). */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const T = 0.36; // wall thickness

  /** Arch outline for a hole or notch: from (−hw, y0) up, over the arch, down to (hw, y0). */
  function archPath(path, hw, y0, spring) {
    path.moveTo(-hw, y0);
    path.lineTo(-hw, spring);
    path.absarc(0, spring, hw, Math.PI, 0, true);
    path.lineTo(hw, y0);
  }

  /** Extruded wall panel (centred on x, base at y=0, thickness T) with an arched opening. */
  function panel(type, w, h) {
    return P.cached(`arch:${type}:${w.toFixed(2)}:${h}`, () => {
      const s = new THREE.Shape();
      if (type === "door" || type === "arcade") {
        const hw = type === "door" ? 1.15 : w / 2 - 0.35;
        const spring = type === "door" ? 2.5 : 2.6;
        s.moveTo(-w / 2, 0);
        s.lineTo(-hw, 0);
        s.lineTo(-hw, spring);
        s.absarc(0, spring, hw, Math.PI, 0, true);
        s.lineTo(hw, 0);
        s.lineTo(w / 2, 0);
        s.lineTo(w / 2, h);
        s.lineTo(-w / 2, h);
        s.lineTo(-w / 2, 0);
      } else {
        s.moveTo(-w / 2, 0)
          .lineTo(w / 2, 0)
          .lineTo(w / 2, h)
          .lineTo(-w / 2, h)
          .lineTo(-w / 2, 0);
        if (type === "win") {
          const hole = new THREE.Path();
          archPath(hole, 0.8, 1.1, 3.6);
          hole.lineTo(-0.8, 1.1);
          s.holes.push(hole);
        }
      }
      const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 10 });
      g.translate(0, 0, -T / 2);
      return g;
    });
  }

  /**
   * A straight wall from (x0,z0) to (x1,z1) made of equal bays; `types[i]` picks each bay
   * ('win' | 'door' | 'solid' | 'arcade'). Non-door bays become colliders.
   */
  function wallRun(B, ctx, o) {
    const len = Math.hypot(o.x1 - o.x0, o.z1 - o.z0);
    const n = o.types.length;
    const w = len / n;
    const rot = Math.atan2(o.z0 - o.z1, o.x1 - o.x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = o.x0 + (o.x1 - o.x0) * t;
      const z = o.z0 + (o.z1 - o.z0) * t;
      B.geo(
        o.key || "plaster",
        panel(o.types[i], w, o.h),
        P.compose(x, o.y || 0, z, rot, 1, 1, 1),
        o.color,
      );
      if (o.types[i] === "win") B.plane("glass", x, (o.y || 0) + 2.4, z, 1.6, 2.6, rot);
      if (o.types[i] === "door" || o.types[i] === "arcade")
        jambs(ctx, x, z, rot, w, o.types[i] === "door" ? 1.15 : w / 2 - 0.35);
      else pushWall(ctx, x, z, rot, w / 2);
    }
  }
  function pushWall(ctx, x, z, rot, half) {
    const hx = Math.abs(Math.cos(rot)) * half + 0.25;
    const hz = Math.abs(Math.sin(rot)) * half + 0.25;
    P.collide(ctx.colliders, x - hx, x + hx, z - hz, z + hz, "mosque-wall");
  }
  /** Colliders for the solid pieces either side of an opening of half-width hw. */
  function jambs(ctx, x, z, rot, w, hw) {
    const half = (w / 2 - hw) / 2;
    if (half < 0.05) return;
    [-1, 1].forEach((s) => {
      const d = s * (hw + half);
      pushWall(ctx, x + Math.cos(rot) * d, z - Math.sin(rot) * d, rot, half);
    });
  }

  /** Onion dome by lathe, on an octagonal drum, with a gold finial and crescent. */
  function dome(B, cx, cz, y, r) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const bulge = Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62) * 1.08;
      pts.push(new THREE.Vector2(Math.max(0.02, r * bulge * (1 - Math.pow(t, 2.2))), t * r * 1.35));
    }
    pts[0].x = r * 0.98;
    const g = P.cached(`dome${r}`, () => new THREE.LatheGeometry(pts, 40));
    B.cyl("plaster", cx, y + r * 0.16, cz, r * 1.02, r * 0.32, 8, 0xf6f2e8);
    B.cyl("paint", cx, y + r * 0.33, cz, r * 1.06, r * 0.04, 32, 0x1f7a74);
    B.geo("dome", g, P.compose(cx, y + r * 0.34, cz, 0, 1, 1, 1), 0xd9b25c);
    finial(B, cx, y + r * 0.34 + r * 1.35, cz, r);
  }
  function finial(B, x, y, z, r) {
    const s = Math.max(0.35, r * 0.1);
    B.cyl("gold", x, y + s * 0.8, z, s * 0.12, s * 1.6, 8, 0xe2bd62);
    B.geo(
      "gold",
      P.cached("fsph", () => new THREE.SphereGeometry(1, 14, 10)),
      P.compose(x, y + s * 0.6, z, 0, s * 0.3, s * 0.3, s * 0.3),
      0xe2bd62,
    );
    const cres = P.cached("cres", () => new THREE.TorusGeometry(1, 0.16, 8, 20, Math.PI * 1.4));
    B.geo(
      "gold",
      cres,
      P.compose(x, y + s * 1.9, z, [0, Math.PI / 2, Math.PI * 0.8], s * 0.45, s * 0.45, s * 0.45),
      0xe2bd62,
    );
  }

  P.Mosque = { panel, wallRun, dome, finial, T };
})((window.KQ = window.KQ || {}));
