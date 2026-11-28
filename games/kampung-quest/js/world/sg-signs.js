/* ============================================================================
 * FILE: sg-signs.js
 * PURPOSE: Singapore estate signage drawn into the shared sign atlas (no files, so it works on file://): hawker stall
 *          signboards with a stall number, drawn food pictures and a generic HALAL label, menu boards with prices,
 *          photo light boxes, the hanging pictogram signs (tray return, hand wash, gentle play), a hygiene grade
 *          card, the void-deck chess board, a drain grating and the big painted HDB block number. Every food picture
 *          is a simple drawing (no photos, no brand names); the grade card and the HALAL label are generic signs, not
 *          official marks (assets/CREDITS.md).
 * BUSINESS CONTEXT: the playability round's Singapore realism pass (features/kampung-quest-playability/requirements.md, AC-P20 and the cross-cutting Singapore dressing in test-plan.md; reference sheet
 *   features/kampung-quest-playability/sg-reference.md).
 * DEPENDENCIES: KQ.WorldParts.Canvas (the sign atlas and fitText).
 * HOW TO TEST: npx playwright test tests/kampung-quest-ac.spec.mjs (draw calls and no console errors); the look is checked by eye in shots/.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  const A = P.Canvas.Atlas.prototype;
  const fit = (...a) => P.Canvas.fitText(...a);

  /** Fill a circle. */
  function disc(g, x, y, r, c) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  /** The food drawings: each paints a dish onto a white plate of radius r centred at (x, y). */
  const FOOD = {
    prata(g, x, y, r) {
      disc(g, x, y, r * 0.78, "#e9b45a");
      disc(g, x - r * 0.12, y - r * 0.1, r * 0.5, "#f4cf7e");
      disc(g, x + r * 0.42, y + r * 0.38, r * 0.24, "#c9762b");
    },
    nasi(g, x, y, r) {
      disc(g, x - r * 0.15, y, r * 0.42, "#fbfaf4");
      disc(g, x + r * 0.42, y - r * 0.3, r * 0.22, "#c0392b");
      disc(g, x + r * 0.42, y + r * 0.3, r * 0.22, "#f1c40f");
      g.fillStyle = "#2e8b3d";
      g.fillRect(x - r * 0.7, y + r * 0.35, r * 0.5, r * 0.18);
      disc(g, x - r * 0.25, y - r * 0.5, r * 0.18, "#b5651d");
    },
    soto(g, x, y, r) {
      disc(g, x, y, r * 0.8, "#e6a23c");
      g.strokeStyle = "#f7dc8b";
      g.lineWidth = Math.max(2, r * 0.08);
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.arc(x + k * r * 0.14, y, r * 0.45, 0.2, 2.6);
        g.stroke();
      }
      disc(g, x + r * 0.35, y - r * 0.35, r * 0.16, "#3fa34d");
    },
    drink(g, x, y, r) {
      g.fillStyle = "#c98a4b";
      g.fillRect(x - r * 0.38, y - r * 0.6, r * 0.76, r * 1.2);
      g.fillStyle = "#f3e3c3";
      g.fillRect(x - r * 0.38, y - r * 0.6, r * 0.76, r * 0.28);
    },
    satay(g, x, y, r) {
      for (let k = -1; k <= 1; k++) {
        g.fillStyle = "#e8d3a0";
        g.fillRect(x - r * 0.8, y + k * r * 0.4 - 1, r * 1.6, 3);
        for (let j = 0; j < 3; j++)
          disc(g, x - r * 0.35 + j * r * 0.3, y + k * r * 0.4, r * 0.15, "#9c4a1a");
      }
    },
    kuih(g, x, y, r) {
      ["#3fbf6a", "#f27aa6", "#f4d35e"].forEach((c, k) => {
        g.fillStyle = c;
        g.fillRect(x - r * 0.65 + k * r * 0.45, y - r * 0.25, r * 0.38, r * 0.5);
      });
    },
  };

  /** One food picture: white plate (or a cup for drinks) with the dish drawn on it. */
  function foodIcon(g, kind, x, y, r) {
    if (kind !== "drink") disc(g, x, y, r, "#ffffff");
    (FOOD[kind] || FOOD.nasi)(g, x, y, r);
  }

  /** Stall signboard: number tag, name, sub line, a row of food pictures, HALAL label. */
  A.stallSign = function (o) {
    const s = this.alloc(600, 136);
    const g = this.ctx;
    const grad = g.createLinearGradient(0, s.y, 0, s.y + s.h);
    grad.addColorStop(0, o.bg);
    grad.addColorStop(1, o.bg2 || o.bg);
    g.fillStyle = grad;
    g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = "#fff8e6";
    g.fillRect(s.x + 8, s.y + 8, 96, 34);
    g.fillStyle = "#333";
    g.textAlign = "center";
    g.textBaseline = "middle";
    fit(g, o.no, s.x + 56, s.y + 26, 88, 26, 800);
    g.fillStyle = "#ffffff";
    fit(g, o.text, s.x + 260, s.y + 50, 300, 60, 900);
    fit(g, o.sub, s.x + 260, s.y + 96, 300, 22, 700);
    o.foods.forEach((f, i) => {
      foodIcon(g, f, s.x + 484 + (i % 2) * 60, s.y + 38 + Math.floor(i / 2) * 60, 25);
    });
    labelHalal(g, s.x + 14, s.y + 114);
    return s.uv;
  };
  /** The generic green "HALAL" text label (not a certification mark). */
  function labelHalal(g, x, y) {
    g.fillStyle = "#ffffff";
    g.fillRect(x - 3, y - 14, 90, 30);
    g.fillStyle = "#13803a";
    g.fillRect(x, y - 11, 84, 24);
    g.fillStyle = "#ffffff";
    fit(g, "HALAL", x + 42, y + 2, 76, 18, 900);
  }

  /** Menu board on the stall's back wall: dishes with drawn pictures and prices. */
  A.menuBoard = function (o) {
    const s = this.alloc(420, 170);
    const g = this.ctx;
    g.fillStyle = "#fbf6e6";
    g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = o.bg;
    g.fillRect(s.x, s.y, s.w, 30);
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    fit(g, "MENU", s.x + s.w / 2, s.y + 16, 200, 22, 900);
    o.items.forEach((it, i) =>
      menuItem(
        g,
        s.x + 10 + (i % 3) * 136,
        s.y + 38 + Math.floor(i / 3) * 66,
        it,
        o.foods[i % o.foods.length],
      ),
    );
    return s.uv;
  };
  /** One menu cell: picture, name, price. */
  function menuItem(g, x, y, it, food) {
    g.fillStyle = "#efe4c8";
    g.fillRect(x, y, 128, 60);
    foodIcon(g, food, x + 26, y + 30, 22);
    g.fillStyle = "#5a2a1a";
    g.textAlign = "left";
    fit(g, it[0], x + 52, y + 20, 74, 15, 800);
    g.fillStyle = "#c0392b";
    fit(g, it[1], x + 52, y + 44, 74, 18, 900);
    g.textAlign = "center";
  }

  /** Tall photo light box (the bright food-picture panels on stall fronts). */
  A.lightbox = function (o) {
    const s = this.alloc(90, 230);
    const g = this.ctx;
    g.fillStyle = "#fffdf6";
    g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = o.bg;
    g.fillRect(s.x, s.y, s.w, 8);
    g.fillRect(s.x, s.y + s.h - 8, s.w, 8);
    o.foods.slice(0, 3).forEach((f, i) => foodIcon(g, f, s.x + 45, s.y + 45 + i * 70, 30));
    return s.uv;
  };

  /** Pictogram signs: tray return, hand wash, gentle play. Friendly, no red crosses. */
  const PICTO = {
    tray(g, x, y) {
      g.fillStyle = "#2a63b0";
      for (let k = 0; k < 3; k++) g.fillRect(x - 34, y - 20 + k * 16, 40, 6);
      disc(g, x + 26, y - 26, 10, "#2a63b0");
      g.fillRect(x + 18, y - 14, 16, 30);
      g.fillRect(x - 2, y - 10, 24, 6);
    },
    wash(g, x, y) {
      g.fillStyle = "#2a63b0";
      g.fillRect(x - 30, y + 10, 60, 10);
      g.fillRect(x - 4, y - 30, 8, 20);
      g.fillRect(x - 4, y - 30, 26, 8);
      for (let k = 0; k < 3; k++) disc(g, x + 18, y - 12 + k * 8, 3, "#4fa3e0");
    },
    play(g, x, y) {
      disc(g, x - 14, y + 8, 16, "#f2994a");
      disc(g, x + 20, y - 14, 10, "#2f9e6a");
      g.fillStyle = "#2f9e6a";
      g.fillRect(x + 15, y - 4, 10, 30);
    },
  };
  A.picto = function (o) {
    const s = this.alloc(320, 110);
    const g = this.ctx;
    g.fillStyle = o.bg || "#eaf4ff";
    g.fillRect(s.x, s.y, s.w, s.h);
    g.strokeStyle = o.edge || "#f08a3c";
    g.lineWidth = 6;
    g.strokeRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6);
    PICTO[o.icon](g, s.x + 60, s.y + 56);
    g.fillStyle = "#1f3b63";
    g.textAlign = "center";
    g.textBaseline = "middle";
    fit(g, o.text, s.x + 208, s.y + 42, 200, 30, 900);
    if (o.sub) fit(g, o.sub, s.x + 208, s.y + 78, 200, 18, 700);
    return s.uv;
  };

  /** Hygiene grade card: a big "A" on a green-edged white card. */
  A.gradeCard = function () {
    const s = this.alloc(60, 72);
    const g = this.ctx;
    g.fillStyle = "#ffffff";
    g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = "#1e8e4e";
    g.fillRect(s.x, s.y, s.w, 14);
    g.textAlign = "center";
    g.textBaseline = "middle";
    fit(g, "A", s.x + 30, s.y + 46, 50, 50, 900);
    return s.uv;
  };

  /** Chinese-chess / checkers board inlaid in a stone table top (seen from above). */
  A.chessTop = function () {
    const s = this.alloc(96, 96);
    const g = this.ctx;
    g.fillStyle = "#9da3a6";
    g.fillRect(s.x, s.y, s.w, s.h);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        g.fillStyle = (i + j) % 2 ? "#e9e4d8" : "#5f676b";
        g.fillRect(s.x + 8 + i * 10, s.y + 8 + j * 10, 10, 10);
      }
    }
    return s.uv;
  };

  /** A square of light grey floor tiles (8 x 8) laid under a void-deck table set. */
  A.floorTiles = function () {
    const s = this.alloc(128, 128);
    const g = this.ctx;
    g.fillStyle = "#a9b0b6";
    g.fillRect(s.x, s.y, s.w, s.h);
    const r = P.rng(21);
    for (let i = 0; i < 64; i++) {
      const v = 208 + Math.floor(r() * 14);
      g.fillStyle = `rgb(${v},${v + 3},${v + 6})`;
      g.fillRect(s.x + (i % 8) * 16 + 1, s.y + Math.floor(i / 8) * 16 + 1, 14, 14);
    }
    return s.uv;
  };

  /** Drain grating strip: dark slots in a steel frame. */
  A.grating = function () {
    const s = this.alloc(128, 24);
    const g = this.ctx;
    g.fillStyle = "#8d949a";
    g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = "#2b3035";
    for (let x = 4; x < s.w - 4; x += 8) g.fillRect(s.x + x, s.y + 4, 4, s.h - 8);
    return s.uv;
  };

  /** The big painted block number on the stair core near the roof ("120" over a small "BLK"). */
  A.coreNumber = function (num, bg, fg) {
    const s = this.alloc(160, 240);
    const g = this.ctx;
    g.fillStyle = bg;
    g.fillRect(s.x, s.y, s.w, s.h);
    g.fillStyle = fg || "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    fit(g, "BLK", s.x + 80, s.y + 40, 120, 40, 900);
    fit(g, num, s.x + 80, s.y + 140, 150, 110, 900);
    return s.uv;
  };

  /** A centre's name board over its glass front (kindergarten, RC centre). */
  A.centreBoard = function (o) {
    const s = this.alloc(460, 90);
    const g = this.ctx;
    g.fillStyle = o.bg;
    g.fillRect(s.x, s.y, s.w, s.h);
    ["#f25c54", "#f7b32b", "#3fa34d", "#2a9df4"].forEach((c, k) =>
      disc(g, s.x + 26 + k * 20, s.y + 45, 9, c),
    );
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    fit(g, o.text, s.x + 270, s.y + 36, 330, 36, 900);
    fit(g, o.sub, s.x + 270, s.y + 70, 330, 18, 700);
    return s.uv;
  };

  P.SgSigns = { foodIcon, FOOD };
})((window.KQ = window.KQ || {}));
