/* Kampung Quest — mosque ornament (KQ.WorldParts.Ornament): moulded arch surrounds with a
   keystone on every arched opening (both faces), geometric lattice screens in the hall
   windows, an abstract geometric frieze band (no lettering) inside and outside the hall,
   gold ribs on the main dome, brass hanging lanterns in the verandah and wall sconces between
   the windows. `arch` is called from Mosque.wallRun; `build` runs after the mosque. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const MOULD = 0xf3ecdc;
  const TEAL = 0x1f7a74;

  /** Opening shape per panel type: half-width, springing height, sill height. */
  function opening(type, w) {
    if (type === "win") return { hw: 0.8, spring: 3.6, sill: 1.1 };
    if (type === "door") return { hw: 1.15, spring: 2.5, sill: 0 };
    if (type === "arcade") return { hw: w / 2 - 0.35, spring: 2.6, sill: 0 };
    return null;
  }

  const torus = (r) =>
    P.cached("archT" + r.toFixed(2), () => new THREE.TorusGeometry(r, 0.075, 6, 20, Math.PI));

  /** Moulded surround on both faces of one arched opening (+ lattice in windows). */
  function arch(B, o) {
    const op = opening(o.type, o.w);
    if (!op) return;
    const T = P.Mosque.T / 2 + 0.03;
    const nx = Math.sin(o.rot);
    const nz = Math.cos(o.rot);
    const ax = Math.cos(o.rot);
    const az = -Math.sin(o.rot);
    const r = op.hw + 0.07;
    const jamb = op.spring - op.sill;
    [-1, 1].forEach((side) => {
      const cx = o.x + nx * T * side;
      const cz = o.z + nz * T * side;
      B.geo("whitePlaster", torus(r), P.compose(cx, o.y + op.spring, cz, o.rot, 1, 1, 1), MOULD);
      B.box("paint", cx, o.y + op.spring + r + 0.02, cz, 0.22, 0.26, 0.1, TEAL, o.rot);
      [-1, 1].forEach((k) =>
        B.box(
          "whitePlaster",
          cx + ax * r * k,
          o.y + op.sill + jamb / 2,
          cz + az * r * k,
          0.15,
          jamb,
          0.1,
          MOULD,
          o.rot,
        ),
      );
    });
    if (o.type === "win") B.plane("lattice", o.x, o.y + 2.75, o.z, 1.6, 3.3, o.rot, null, 0xf4efe2);
  }

  /** Frieze planes around the hall, outside and inside, at a 0.45 m module. */
  function friezes(B, m) {
    const h = m.hall;
    const y = 6.3 + 0.225;
    const runs = [
      [h.x0, h.z0, h.x1, h.z0, Math.PI],
      [h.x1, h.z1, h.x0, h.z1, 0],
      [h.x1, h.z0, h.x1, h.z1, Math.PI / 2],
      [h.x0, h.z1, h.x0, h.z0, -Math.PI / 2],
    ];
    runs.forEach(([x0, z0, x1, z1, rot]) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const uv = [0, 0, len / 0.45, 1];
      const nx = Math.sin(rot);
      const nz = Math.cos(rot);
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      B.plane("frieze", cx + nx * 0.22, y, cz + nz * 0.22, len, 0.45, rot, uv);
      B.plane("frieze", cx - nx * 0.2, y, cz - nz * 0.2, len - 0.4, 0.45, rot + Math.PI, uv);
    });
  }

  /** Gold meridian ribs on the main dome (one tube per rib, merged into the gold batch). */
  function domeRibs(B, cx, cz, y, r) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const bulge = Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62) * 1.08;
      pts.push([Math.max(0.02, r * bulge * (1 - Math.pow(t, 2.2))) + 0.03, t * r * 1.35]);
    }
    pts[0][0] = r * 0.98 + 0.03;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3(
        pts.map(
          ([rr, yy]) => new THREE.Vector3(cx + Math.cos(a) * rr, y + yy, cz + Math.sin(a) * rr),
        ),
      );
      const g = new THREE.TubeGeometry(curve, 24, 0.045, 4, false);
      B.geo("gold", g, new THREE.Matrix4(), 0xe2bd62);
      g.dispose();
    }
  }

  /** Brass lantern: chain, cap, glowing body, finial. Registers a warm light pool. */
  function lantern(B, x, y, z, ctx) {
    B.cyl("metal", x, y + 0.35, z, 0.012, 0.7, 4, 0xb08a3e);
    B.geo(
      "gold",
      P.cached("lanCap", () => new THREE.ConeGeometry(0.2, 0.18, 8)),
      P.compose(x, y - 0.05, z, 0, 1, 1, 1),
      0xc89b48,
    );
    B.cyl("lamp", x, y - 0.32, z, 0.13, 0.36, 8, 0xffe6b8);
    B.cyl("gold", x, y - 0.52, z, 0.15, 0.04, 8, 0xc89b48);
    ctx.pools.push({ x, z, s: 0.55, y: y - 0.4, warm: true });
  }

  /** Verandah lanterns + exterior sconces between the hall windows. */
  function lamps(B, m, ctx) {
    const h = m.hall;
    const v = m.verandah;
    const pl = P.MosqueShell.PLINTH;
    const xm = (v.x0 + v.x1) / 2;
    for (let z = h.z0 + 3; z < h.z1; z += 5) lantern(B, xm, pl + 4.2, z + 2.5, ctx);
    for (let x = h.x0 + 4; x < h.x1; x += 4) {
      [h.z0 - 0.22, h.z1 + 0.22].forEach((z) => {
        B.box("gold", x, pl + 3.0, z, 0.08, 0.3, 0.12, 0xc89b48);
        B.box("lamp", x, pl + 3.25, z + Math.sign(z - h.z0 - 1) * 0.08, 0.16, 0.24, 0.16, 0xffe6b8);
      });
    }
  }

  /** Everything except the per-arch work (which wallRun drives). */
  function build(B, m, ctx) {
    const h = m.hall;
    const top = P.MosqueShell.PLINTH + h.h;
    friezes(B, m);
    domeRibs(B, (h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2, top + 0.35 + 5 * 0.34, 5);
    lamps(B, m, ctx);
  }

  P.Ornament = { arch, build, opening };
})((window.KQ = window.KQ || {}));
