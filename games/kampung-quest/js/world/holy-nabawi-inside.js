/* ============================================================================
 * FILE: holy-nabawi-inside.js
 * PURPOSE: The inside of Masjid Nabawi (KQ.WorldParts.HolyNabawiInside), as true to the real
 *          hall as a toy world can be: a grid of white columns with pointed arches under a
 *          cream ceiling, red carpet with prayer-row lines, chandeliers, Quran shelves, the
 *          qibla wall with blind arches and the mihrab, the white marble minbar, the Rawdah
 *          (green carpet and four white-and-gold columns) and the Prophet's chamber, which is
 *          ONLY a closed green-and-brass screen (nothing inside is shown, nobody is depicted).
 * BUSINESS CONTEXT: AC-H1, AC-H5 (the ziarah places: Rawdah, the salam spot in front of the
 *   screen). Qibla is +z (south).
 * DEPENDENCIES: holy-kit.js, holy-nabawi.js (bounds), geo.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const K = () => P.HolyKit;
  const GRID = { x0: 568, z0: -27, step: 6, nx: 12, nz: 10 };
  const COL_H = 4.4;
  const CHAMBER = { x0: 611, z0: 16.5, x1: 618, z1: 24.5 };
  /** Columns left out of the grid: before the mihrab / minbar and inside the chamber. */
  const SKIP = ["604,27", "598,27", "616,21"];
  /** The four ornate white-and-gold columns around the Rawdah. */
  const RAWDAH_COLS = ["604,15", "610,15", "604,21", "610,21"];
  const sphere = () => P.cached("holySph", () => new THREE.SphereGeometry(1, 12, 8));

  /** Grid point (i, k) as a world position, or null when that column is left out. */
  function colAt(i, k) {
    const x = GRID.x0 + i * GRID.step;
    const z = GRID.z0 + k * GRID.step;
    return SKIP.indexOf(x + "," + z) === -1 ? { x, z, ornate: RAWDAH_COLS.indexOf(x + "," + z) !== -1 } : null;
  }

  /** One plain column with base and gilt capital (a low collider). */
  function column(c, p) {
    const r = p.ornate ? 0.72 : 0.5;
    const B = c.B;
    B.box("marble", p.x, 0.3, p.z, r * 2.3, 0.4, r * 2.3, 0xf4efe4);
    B.cyl("whitePlaster", p.x, COL_H / 2, p.z, r, COL_H, 14, 0xf8f4ea);
    B.box("gold", p.x, COL_H - 0.2, p.z, r * 2.6, 0.45, r * 2.6, p.ornate ? 0xe2bd62 : 0xd9c48a);
    if (p.ornate) {
      [1.2, 2.6].forEach((y) => B.cyl("gold", p.x, y, p.z, r * 1.06, 0.12, 14, 0xe2bd62));
    }
    K().solid(c.colliders, p.x - r, p.z - r, p.x + r, p.z + r, "holy-col");
  }

  /** The column grid and the pointed arches that join neighbours (instanced geometry, batched). */
  function colonnade(c) {
    const g = K().archSlab(GRID.step, COL_H, 2.5, 0.2, 0.7);
    for (let k = 0; k < GRID.nz; k += 1) {
      for (let i = 0; i < GRID.nx; i += 1) {
        const a = colAt(i, k);
        if (!a) continue;
        column(c, a);
        const e = colAt(i + 1, k);
        const s = colAt(i, k + 1);
        if (e && i + 1 < GRID.nx) c.B.geo("whitePlaster", g, P.compose(a.x + GRID.step / 2, COL_H, a.z, 0, 1, 1, 1), 0xf6f1e6);
        if (s && k + 1 < GRID.nz) c.B.geo("whitePlaster", g, P.compose(a.x, COL_H, a.z + GRID.step / 2, Math.PI / 2, 1, 1, 1), 0xf6f1e6);
      }
    }
  }

  /** Marble floor, red carpet with prayer rows over the hall, green carpet over the Rawdah. */
  function floors(c) {
    const B = c.B;
    B.aabb("marble", 565, 0, -30, 635, 0.1, 30, 0xf2eee4);
    B.aabb("redCarpet", 567, 0.1, -29, 633, 0.14, 29, 0xffffff);
    B.aabb("greenCarpet", 599, 0.14, 13, 613, 0.18, 23, 0xffffff);
    B.aabb("gold", 598.8, 0.14, 12.8, 613.2, 0.19, 13, 0xe2bd62);
    B.aabb("gold", 598.8, 0.14, 23, 613.2, 0.19, 23.2, 0xe2bd62);
    B.aabb("tiles", 599.5, 0.1, -29, 601.5, 0.145, 12.8, 0xf2eee4);
  }

  /** Hanging chandeliers on every other bay (chain, ring and a glowing lamp body). */
  function chandeliers(c) {
    for (let k = 0; k < GRID.nz - 1; k += 1) {
      for (let i = 0; i < GRID.nx - 1; i += 1) {
        if ((i + k) % 2) continue;
        const x = GRID.x0 + (i + 0.5) * GRID.step;
        const z = GRID.z0 + (k + 0.5) * GRID.step;
        c.B.cyl("gold", x, 8.1, z, 0.03, 1.8, 4, 0xe2bd62);
        c.B.cyl("gold", x, 7.1, z, 0.75, 0.08, 16, 0xe2bd62);
        c.B.geo("chandelier", sphere(), P.compose(x, 7.0, z, 0, 0.5, 0.45, 0.5), 0xfff1d0);
      }
    }
  }

  /** The qibla wall: green backing with white blind arches, and the mihrab in the 6th bay. */
  function qiblaWall(c) {
    const B = c.B;
    B.aabb("paint", 565.6, 0, 29.2, 634.4, 9, 29.4, 0x2f6e5a);
    const g = K().archSlab(7, 9, 2.6, 3.2, 0.4);
    for (let k = 0; k < 10; k += 1) {
      if (k === 5) continue;
      B.geo("whitePlaster", g, P.compose(568.5 + k * 7, 0, 29.0, 0, 1, 1, 1), 0xf4efe4);
    }
    B.geo("marble", K().archSlab(7, 9.2, 2.1, 3.4, 0.8), P.compose(603.5, 0, 28.9, 0, 1, 1, 1), 0xffffff);
    B.box("dark", 603.5, 3.2, 29.35, 4.3, 6.2, 0.3, 0x141a17);
    B.cyl("gold", 603.5, 6.9, 28.9, 0.04, 2.2, 4, 0xe2bd62);
    B.geo("chandelier", sphere(), P.compose(603.5, 5.6, 28.8, 0, 0.3, 0.35, 0.3), 0xfff1d0);
    B.aabb("gold", 600.3, 0.1, 28.6, 600.5, 9.2, 29.4, 0xe2bd62);
    B.aabb("gold", 606.5, 0.1, 28.6, 606.7, 9.2, 29.4, 0xe2bd62);
    K().solid(c.colliders, 565, 28.6, 635, 30, "mihrab");
  }

  /** The minbar: white marble steps up to a small canopy on four posts (it faces north). */
  function minbar(c) {
    const B = c.B;
    for (let i = 0; i < 7; i += 1) {
      B.aabb("marble", 596.9, 0.1, 23.4 + 0.6 * i, 599.1, 0.7 + 0.5 * i, 24.2 + 0.6 * i, 0xffffff);
    }
    B.aabb("marble", 596.9, 0.1, 27.4, 599.1, 3.7, 28.4, 0xf4efe4);
    [596.9, 599.0].forEach((x) =>
      [27.5, 28.3].forEach((z) => B.cyl("gold", x + 0.05, 5.4, z, 0.07, 3.4, 6, 0xe2bd62)),
    );
    K().dome(B, { key: "gold", x: 598, y: 7.1, z: 27.9, r: 1.0, k: 1, color: 0xe2bd62 });
    K().solid(c.colliders, 596.8, 23.2, 599.2, 28.5, "minbar");
  }

  /** Quran shelves: tall wooden cases of colourful spines along the long walls. */
  function shelves(c) {
    [-18, -6, 6, 18].forEach((z) => {
      [[566.5, 0.6], [633.5, 0.6]].forEach((s) => {
        c.B.box("books", s[0], 1.15, z, s[1], 2.3, 4, 0xffffff);
        c.B.box("wood", s[0], 2.35, z, s[1] + 0.1, 0.1, 4.1, 0x7a5636);
        K().solid(c.colliders, s[0] - 0.4, z - 2, s[0] + 0.4, z + 2, "counter");
      });
    });
  }

  /** The Prophet's chamber as a closed green-and-brass screen: lattice sides, a closed door, a dark core. */
  function chamber(c) {
    const B = c.B;
    const m = CHAMBER;
    const cx = (m.x0 + m.x1) / 2;
    const cz = (m.z0 + m.z1) / 2;
    B.aabb("dark", m.x0 + 0.2, 0.1, m.z0 + 0.2, m.x1 - 0.2, 5.8, m.z1 - 0.2, 0x10201a);
    B.aabb("paint", m.x0, 0.1, m.z0, m.x1, 1.3, m.z1, 0x1f7a4d);
    B.aabb("gold", m.x0 - 0.05, 1.3, m.z0 - 0.05, m.x1 + 0.05, 1.42, m.z1 + 0.05, 0xd9b04a);
    const w = m.x1 - m.x0;
    const d = m.z1 - m.z0;
    B.plane("lattice", cx, 3.6, m.z1 + 0.04, w, 4.4, 0, null, 0xd9b04a);
    B.plane("lattice", cx, 3.6, m.z0 - 0.04, w, 4.4, Math.PI, null, 0xd9b04a);
    B.plane("lattice", m.x1 + 0.04, 3.6, cz, d, 4.4, Math.PI / 2, null, 0xd9b04a);
    B.plane("lattice", m.x0 - 0.04, 3.6, cz, d, 4.4, -Math.PI / 2, null, 0xd9b04a);
    B.aabb("paint", m.x0 - 0.1, 5.8, m.z0 - 0.1, m.x1 + 0.1, 6.4, m.z1 + 0.1, 0x1f7a4d);
    B.aabb("gold", m.x0 - 0.15, 6.4, m.z0 - 0.15, m.x1 + 0.15, 6.6, m.z1 + 0.15, 0xd9b04a);
    B.box("gold", cx, 2.0, m.z1 + 0.14, 2.2, 3.4, 0.12, 0xb98f35);
    K().solid(c.colliders, m.x0 - 0.1, m.z0 - 0.1, m.x1 + 0.1, m.z1 + 0.1, "screen");
  }

  /** Madinah ablution taps on a marble trough in the courtyard, just north of the portico. */
  function wudu(c) {
    const B = c.B;
    B.aabb("wetTiles", 570, 0.1, -36.6, 586, 0.9, -35.2, 0xffffff);
    [572.5, 576, 579.5, 583].forEach((x) => B.cyl("chrome", x, 1.1, -35.4, 0.07, 0.4, 8, 0xdfe3e8));
    K().solid(c.colliders, 570, -36.6, 586, -35.2, "counter");
  }

  /** Build the whole interior (and the courtyard wudu trough). */
  function build(c) {
    floors(c);
    colonnade(c);
    chandeliers(c);
    qiblaWall(c);
    minbar(c);
    shelves(c);
    chamber(c);
    wudu(c);
  }

  P.HolyNabawiInside = { build, CHAMBER, GRID };
})((window.KQ = window.KQ || {}));
