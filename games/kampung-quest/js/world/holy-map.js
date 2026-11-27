/* ============================================================================
 * FILE: holy-map.js
 * PURPOSE: The map picture of the Haramain world for the minimap and the full map screen
 *          (KQ.Holy.map): a flat 2D painter in world metres (x east, z south) so the map always
 *          matches the scenery. Used by KQ.Game.Minimap when KQ.region === "haramain".
 * BUSINESS CONTEXT: AC-H1 (minimap works). Plain canvas 2D, drawn once into a cached canvas.
 * DEPENDENCIES: holy-makkah.js / holy-madinah.js (roads, bounds), KQ.HOLY.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const Holy = (KQ.Holy = KQ.Holy || {});
  const COLORS = { sand: "#cdb98f", road: "#55575d", walk: "#d9ceb4", marble: "#f1ede2", hotel: "#b9a98d", green: "#2f8f5a", kaaba: "#1c1c22", gold: "#d9b04a", tent: "#f4f1e8", hill: "#8f6f58" };
  const BOUNDS = { x0: -310, z0: -225, x1: 725, z1: 160 };

  /** Fill a world rectangle. */
  function box(ctx, color, x0, z0, x1, z1) {
    ctx.fillStyle = color;
    ctx.fillRect(x0, z0, x1 - x0, z1 - z0);
  }

  /** Fill a world circle. */
  function disc(ctx, color, x, z, r) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, z, r, 0, 7);
    ctx.fill();
  }

  /** One street with its footways. */
  function road(ctx, r) {
    const h = r.w / 2;
    const rect = (c, a, b) =>
      r.axis === "x" ? box(ctx, c, r.from, r.at + a, r.to, r.at + b) : box(ctx, c, r.at + a, r.from, r.at + b, r.to);
    rect(COLORS.walk, -h - 3.5, h + 3.5);
    rect(COLORS.road, -h, h);
  }

  /** Makkah: the Haram, the mataf with the Kaaba, the mas'a, hotels and the Hajj places. */
  function makkah(ctx) {
    P.HolyMakkah.ROADS.forEach((r) => road(ctx, r));
    box(ctx, COLORS.marble, -34, -96.5, 34, -58);
    box(ctx, COLORS.hotel, -17, -147, 17, -113);
    box(ctx, COLORS.marble, -60, -58, 60, 58);
    disc(ctx, "#ffffff", 0, 0, 26);
    box(ctx, COLORS.kaaba, -5, -6, 5, 6);
    box(ctx, COLORS.gold, 37.5, -44, 47.5, 44);
    const H = KQ.HOLY.hajj;
    box(ctx, COLORS.tent, H.mina.x - 21, H.mina.z - 21, H.mina.x + 21, H.mina.z + 21);
    disc(ctx, COLORS.hill, H.arafah.x, H.arafah.z, 12);
    [-12, 0, 12].forEach((dx) => box(ctx, "#b9ad94", H.jamarat.x + dx - 4, H.jamarat.z - 6, H.jamarat.x + dx + 4, H.jamarat.z + 6));
  }

  /** Madinah: the Prophet's Mosque with its green dome, the courtyard, Quba, Baqi' and Uhud. */
  function madinah(ctx) {
    P.HolyMadinah.ROADS.forEach((r) => road(ctx, r));
    box(ctx, COLORS.marble, 548, -95, 652, -30);
    box(ctx, "#e6dcc4", 565, -30, 635, 30);
    disc(ctx, COLORS.green, 613, 21, 6);
    const q = KQ.HOLY.madinah.quba;
    box(ctx, COLORS.marble, q.x - 24, q.z - 22, q.x + 24, q.z + 22);
    box(ctx, "#f6f1e6", q.x - 12, q.z - 8, q.x + 12, q.z + 8);
    const b = KQ.HOLY.madinah.baqi;
    box(ctx, "#c9b48f", b.x - 15, b.z - 15, b.x + 15, b.z + 15);
    disc(ctx, COLORS.hill, 600, -215, 24);
  }

  /** Paint the whole world map once. */
  function paint(ctx) {
    box(ctx, COLORS.sand, BOUNDS.x0, BOUNDS.z0, BOUNDS.x1, BOUNDS.z1);
    makkah(ctx);
    madinah(ctx);
  }

  Holy.map = { bounds: BOUNDS, paint };
})((window.KQ = window.KQ || {}));
