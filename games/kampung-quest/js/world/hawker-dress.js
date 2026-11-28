/* ============================================================================
 * FILE: hawker-dress.js
 * PURPOSE: Hawker centre dressing (KQ.WorldParts.HawkerDress): each stall's lit signboard (stall number, name, drawn food
 *          pictures, generic HALAL label), a food-picture light box, the roller-shutter box and rails, a menu board
 *          with prices on the back wall, a hygiene grade card, swing-out stool frames under every table, hand-wash
 *          basins, hanging pictogram signs, pendant lamps, column fans and litter bins. Everything is batched with
 *          existing materials (no extra draw calls).
 * BUSINESS CONTEXT: the playability round's Singapore realism pass (features/kampung-quest-playability/requirements.md, AC-P20 and the cross-cutting Singapore dressing in test-plan.md; reference photos
 *   in features/kampung-quest-playability/sg-reference.md). Every food is halal; the HALAL label and the grade card are generic drawn signs.
 * DEPENDENCIES: KQ.WorldParts (sg-signs.js atlas drawing, the shared batch and materials).
 * HOW TO TEST: npx playwright test tests/kampung-quest-ac.spec.mjs (hawker view draw calls and no console errors).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});

  /** Darken a #rrggbb colour by k (0..1) for the sign's lower gradient stop. */
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const c = [16, 8, 0].map((s) => Math.round(((n >> s) & 255) * (1 - k)));
    return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  /** Everything on one stall's front and back wall (z0 = back wall, z1 = counter line). */
  function stallFront(B, x0, x1, z0, z1, st, idx, ctx) {
    const A = ctx.atlas;
    const xc = (x0 + x1) / 2;
    const no = "#01-0" + (idx + 1);
    const sign = A.stallSign({
      no,
      text: st.text,
      sub: st.sub,
      bg: st.bg,
      bg2: shade(st.bg, 0.25),
      foods: st.foods,
    });
    B.plane("sign", xc, 3.45, z1 + 0.02, x1 - x0 - 0.3, 1.0, 0, sign);
    const big = st.id === "stall_drinks";
    const menu = A.menuBoard({ bg: st.bg, items: st.menu, foods: st.foods });
    const mw = big ? 3.4 : 2.3;
    B.plane("decal", xc + 0.2, big ? 2.05 : 2.2, z0 + 0.21, mw, mw / 2.47, 0, menu);
    lightbox(B, x0 + 0.32, z1, A.lightbox({ bg: st.bg, foods: st.foods }));
    shutter(B, x0, x1, z1);
    const grade = (ctx.gradeUV = ctx.gradeUV || A.gradeCard());
    B.plane("decal", x1 - 0.45, 2.45, z1 + 0.01, 0.2, 0.24, 0, grade);
  }
  /** A tall lit food-picture panel on the left partition's front edge. */
  function lightbox(B, x, z1, uv) {
    B.box("paint", x, 1.95, z1 - 0.07, 0.5, 1.25, 0.1, 0xffffff);
    B.plane("sign", x, 1.95, z1 - 0.015, 0.44, 1.12, 0, uv);
  }
  /** The roller-shutter box under the signboard and its two side rails. */
  function shutter(B, x0, x1, z1) {
    B.aabb("metal", x0 + 0.15, 2.76, z1 - 0.24, x1 - 0.15, 2.97, z1 - 0.02, 0xc3c8cc);
    [x0 + 0.2, x1 - 0.2].forEach((x) =>
      B.box("metal", x, 1.85, z1 - 0.06, 0.06, 1.8, 0.06, 0xaeb4b9),
    );
  }

  /** The steel frame of a hawker table set: a stem under each seat and an arm to the table leg. */
  function stoolFrame(B, t) {
    B.cyl("metal", t.x, 0.17, t.z, 0.32, 0.06, 12, 0x9aa0a6);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const sx = t.x + Math.cos(a) * 0.95;
      const sz = t.z + Math.sin(a) * 0.95;
      B.cyl("metal", sx, 0.36, sz, 0.03, 0.44, 8, 0xb4babf);
      B.box(
        "metal",
        t.x + Math.cos(a) * 0.52,
        0.16,
        t.z + Math.sin(a) * 0.52,
        0.86,
        0.05,
        0.05,
        0xb4babf,
        -a,
      );
    }
  }

  /** Hand-wash basins against a tiled splash wall on the west side, with a pictogram sign. */
  function handWash(B, ctx) {
    const x = 14.15;
    B.aabb("wallTile", x - 0.2, 0.14, -21.5, x, 2.1, -18.5, 0xffffff);
    B.aabb("wallTile", x, 0.14, -21.4, x + 0.7, 0.85, -18.6, 0xffffff);
    [-20.6, -20.0, -19.4].forEach((z) => {
      B.box("plastic", x + 0.38, 0.88, z, 0.46, 0.06, 0.44, 0xf7f7f4);
      B.box("dark", x + 0.4, 0.915, z, 0.3, 0.01, 0.28, 0x7d8a96);
      B.cyl("chrome", x + 0.1, 1.0, z, 0.025, 0.25, 8, 0xffffff);
    });
    P.collide(ctx.colliders, x - 0.25, x + 0.8, -21.5, -18.5, "basins");
    const uv = ctx.atlas.picto({
      icon: "wash",
      text: "Wash hands",
      sub: "Basuh tangan",
      bg: "#eaf4ff",
      edge: "#2a63b0",
    });
    B.plane("decal", x + 0.01, 1.65, -20.0, 1.3, 0.45, Math.PI / 2, uv);
  }

  /** A double-sided pictogram sign hanging from the roof on two rods. */
  function hangingSign(B, x, z, yaw, uv, h) {
    const y = 3.5;
    B.plane("sign", x, y, z, 1.6, 0.55, yaw, uv);
    B.plane("sign", x, y, z, 1.6, 0.55, yaw + Math.PI, uv);
    const dx = Math.cos(yaw) * 0.6;
    const dz = -Math.sin(yaw) * 0.6;
    [-1, 1].forEach((s) =>
      B.box(
        "metal",
        x + s * dx,
        (y + h) / 2 + 0.14,
        z + s * dz,
        0.02,
        h - y - 0.27,
        0.02,
        0x8a9096,
      ),
    );
  }

  /** Pendant lamps over the tables (green shades, warm bulbs that pool light at night). */
  function pendants(B, H, ctx) {
    const cone = P.cached("pendant", () => new THREE.ConeGeometry(0.26, 0.24, 14));
    [20, 26, 32].forEach((x) =>
      [-19.5, -14].forEach((z) => {
        B.cyl("metal", x, (H.h + 3.3) / 2, z, 0.012, H.h - 3.3, 6, 0x6f757a);
        B.geo("paint", cone, P.compose(x, 3.18, z, 0, 1, 1, 1), 0x2f6b4a);
        B.box("lamp", x, 3.08, z, 0.12, 0.06, 0.12, 0xffffff);
        ctx.pools.push({ x, z, s: 0.6, y: 3.0, warm: true });
      }),
    );
  }

  /** Oscillating wall fans on the inner columns, one each side, facing the tables. */
  function columnFans(B) {
    const g = P.cached("fanDisc", () => new THREE.CylinderGeometry(0.28, 0.28, 0.12, 16));
    const axisZ = [Math.PI / 2, 0, 0];
    [20, 32].forEach((x) =>
      [-1, 1].forEach((d) => {
        const z = -22 + d * 0.3;
        B.box("paint", x, 2.85, z, 0.14, 0.14, 0.12, 0x6f7880);
        B.geo("metal", g, P.compose(x, 2.75, z + d * 0.18, axisZ, 1, 1, 1), 0xd9dde0);
        B.geo("paint", g, P.compose(x, 2.75, z + d * 0.25, axisZ, 0.25, 0.4, 0.25), 0x3f4850);
      }),
    );
  }

  /** Green litter bins on the forecourt. */
  function bins(B, ctx) {
    [22, 30].forEach((x) => {
      const z = -11.3;
      B.box("plastic", x, 0.55, z, 0.5, 0.85, 0.5, 0x2e8b57);
      B.box("plastic", x, 1.0, z, 0.56, 0.08, 0.56, 0x1f5f3c);
      P.collide(ctx.colliders, x - 0.3, x + 0.3, z - 0.3, z + 0.3, "bin");
    });
  }

  /** The hall-wide fittings (called once after the stalls and tables). */
  function hall(B, H, ctx) {
    handWash(B, ctx);
    const tray = ctx.atlas.picto({
      icon: "tray",
      text: "Tray return",
      sub: "Pulangkan dulang",
      bg: "#eaf4ff",
      edge: "#f08a3c",
    });
    hangingSign(B, H.x1 - 0.75, H.z1 - 4.75, Math.PI / 2, tray, H.h);
    pendants(B, H, ctx);
    columnFans(B);
    bins(B, ctx);
  }

  P.HawkerDress = { stallFront, stoolFrame, hall };
})((window.KQ = window.KQ || {}));
