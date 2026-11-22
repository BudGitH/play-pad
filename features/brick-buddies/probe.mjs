// probe.mjs — headless acceptance probe for Brick Buddies (PLAY-009). Not part of CI.
//
// Run from the repo root:   node features/brick-buddies/probe.mjs
//   - starts `node tools/serve.mjs 5602` itself when nothing is listening on that port
//   - set PW_CHROMIUM_PATH to use a pre-installed Chromium
//   - writes screenshots to features/brick-buddies/screens/
//   - prints one PASS / FAIL line per acceptance criterion check and exits 1 on any FAIL
//
// It drives the real input path (keyboard, mouse clicks at tile coordinates, the menus) and uses
// `window.__buddies.debug` only to build fixtures, read state and run the pure room-detection
// function on hand-made grids. See features/brick-buddies/test-plan.md for the AC -> test map.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const SHOTS = join(HERE, "screens");
const PORT = 5602;
const BASE = `http://localhost:${PORT}/games/brick-buddies/index.html`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOTS, { recursive: true });

// ---------------------------------------------------------------------------
//  harness
// ---------------------------------------------------------------------------
const results = [];
const allProblems = [];
const allRequests = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null; // e.g. ONLY=AC-5,AC-9
async function check(id, name, fn) {
  if (ONLY && !ONLY.has(id)) return;
  const t0 = Date.now();
  try {
    const detail = (await fn()) || "";
    results.push({ id, name, pass: true, detail, ms: Date.now() - t0 });
  } catch (e) {
    results.push({
      id,
      name,
      pass: false,
      detail: String(e && e.message ? e.message : e),
      ms: Date.now() - t0,
    });
  }
}

async function ensureServer() {
  const up = async () => {
    try {
      await fetch(`http://localhost:${PORT}/`);
      return true;
    } catch {
      return false;
    }
  };
  if (await up()) return null;
  const child = spawn(process.execPath, [join(ROOT, "tools", "serve.mjs"), String(PORT)], {
    cwd: ROOT,
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    await sleep(100);
    if (await up()) return child;
  }
  child.kill();
  throw new Error("could not start tools/serve.mjs on port " + PORT);
}

async function openPage(browser, opts = {}) {
  const {
    viewport = { width: 1280, height: 800 },
    touch = false,
    dsf = 1,
    reducedMotion = "no-preference",
    context,
  } = opts;
  const ctx =
    context ||
    (await browser.newContext({
      viewport,
      deviceScaleFactor: dsf,
      hasTouch: touch,
      isMobile: touch,
      reducedMotion,
    }));
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push("console.error: " + m.text());
  });
  page.on("requestfailed", (r) => problems.push("requestfailed: " + r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push("HTTP " + r.status() + " " + r.url());
  });
  page.on("request", (r) => allRequests.push({ url: r.url(), type: r.resourceType() }));
  page.__problems = problems;
  allProblems.push(problems);
  await page.goto(BASE);
  await page.waitForFunction(() => !!window.__buddies);
  if (!IDS.PLANKS) Object.assign(IDS, await page.evaluate(() => window.__buddies.debug.ids));
  return { page, ctx, problems };
}
async function startGame(page) {
  await page.getByRole("button", { name: "Start building", exact: true }).click();
  await page.waitForFunction(() => window.__buddies.phase === "playing");
}
const dbg = (page, fn, arg) => page.evaluate(fn, arg);
/** Wait for the smooth camera to settle so tile -> screen coordinates stay valid for a click. */
const settle = (page, ms = 900) => sleep(ms);
async function tileClick(page, x, y, button = "left") {
  const p = await page.evaluate(([tx, ty]) => window.__buddies.debug.tileToScreen(tx, ty), [x, y]);
  await page.mouse.click(p.x, p.y, { button });
  await sleep(120);
}
const getTile = (page, x, y) =>
  page.evaluate(([tx, ty]) => window.__buddies.debug.getTile(tx, ty), [x, y]);
const IDS = {};

/** Make [x0..x1] a flat strip of ground and return the surface row. */
async function flatten(page, x0, x1) {
  return page.evaluate(
    ([a, b]) => {
      const d = window.__buddies.debug;
      let top = 999;
      for (let x = a; x <= b; x++) top = Math.min(top, d.groundRow(x));
      for (let x = a; x <= b; x++) {
        const g = d.groundRow(x);
        for (let y = top; y < g; y++) d.place(x, y, d.ids.DIRT);
        d.place(x, top, d.ids.GRASS);
      }
      // clear anything above the strip (tufts) and a 14-tile-high air column
      for (let x = a; x <= b; x++) for (let y = top - 14; y < top; y++) d.place(x, y, 0);
      return top;
    },
    [x0, x1],
  );
}

// ---------------------------------------------------------------------------
//  the checks
// ---------------------------------------------------------------------------
const server = await ensureServer();
const launchOpts = process.env.PW_CHROMIUM_PATH
  ? { executablePath: process.env.PW_CHROMIUM_PATH }
  : {};
const browser = await chromium.launch(launchOpts);

try {
  // ---- AC-1 contract ------------------------------------------------------
  await check("AC-1", "hook, title phase, Start building, live frame counter", async () => {
    const { page } = await openPage(browser);
    const pre = await dbg(page, () => ({
      phase: window.__buddies.phase,
      frame: window.__buddies.frame,
      coins: typeof window.__buddies.coins,
      housed: typeof window.__buddies.housed,
      debug: typeof window.__buddies.debug,
    }));
    assert(pre.phase === "title", "phase before start is " + pre.phase);
    assert(
      pre.frame === 0 &&
        pre.coins === "number" &&
        pre.housed === "number" &&
        pre.debug === "object",
      "hook shape " + JSON.stringify(pre),
    );
    const btn = page.getByRole("button", { name: "Start building", exact: true });
    assert((await btn.count()) === 1, "exactly one 'Start building' button");
    await btn.click();
    await page.waitForFunction(() => window.__buddies.phase === "playing");
    const ringAfterClick = await dbg(
      page,
      () => getComputedStyle(document.getElementById("view")).outlineStyle,
    );
    assert(
      ringAfterClick === "none",
      "no canvas focus ring after a mouse start, got " + ringAfterClick,
    );
    const f1 = await dbg(page, () => window.__buddies.frame);
    await sleep(600);
    const f2 = await dbg(page, () => window.__buddies.frame);
    assert(f2 - f1 >= 15, `frame counter advanced only ${f2 - f1} in 600ms`);
    Object.assign(IDS, await dbg(page, () => window.__buddies.debug.ids));
    await page.context().close();
    return `phase title -> playing, frames +${f2 - f1} in 600ms`;
  });

  // ---- AC-2 starter world -----------------------------------------------------
  await check("AC-2", "starter house: shafts, rooms, lights, ground", async () => {
    const { page } = await openPage(browser);
    await startGame(page);
    await settle(page, 500);
    const r = await dbg(page, () => {
      const d = window.__buddies.debug;
      const em = d.emitters();
      const kinds = new Set(em.map((e) => e.id));
      return {
        shafts: d.ladderShafts(),
        valid: d.rooms().filter((x) => x.valid).length,
        types: [
          ...new Set(
            d
              .rooms()
              .filter((x) => x.valid)
              .flatMap((x) => x.types),
          ),
        ],
        lights: em.length,
        kinds: kinds.size,
        coins: window.__buddies.coins,
        ground: window.__buddies.player.ground,
        buddies: d.buddies().length,
      };
    });
    assert(r.shafts >= 3, "ladder shafts " + r.shafts);
    assert(r.valid >= 5, "valid rooms " + r.valid);
    assert(r.lights >= 20 && r.kinds >= 4, `lights ${r.lights}, kinds ${r.kinds}`);
    assert(r.coins > 0 && r.ground, "coins/ground " + JSON.stringify(r));
    await page.context().close();
    return `shafts ${r.shafts}, valid rooms ${r.valid} (${r.types.join(", ")}), emitters ${r.lights} of ${r.kinds} kinds, buddies ${r.buddies}`;
  });

  // ---- AC-3 movement ------------------------------------------------------
  await check("AC-3", "walk, wall collision, jump, 1-tile auto-step, ladder", async () => {
    const { page } = await openPage(browser);
    await startGame(page);
    const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
    const x0 = hx - 24;
    const top = await flatten(page, x0, x0 + 20);
    const tpTo = (x, y) => page.evaluate(([a, b]) => window.__buddies.debug.teleport(a, b), [x, y]);
    const pl = () => page.evaluate(() => window.__buddies.player);
    await tpTo(x0 + 10.5, top);
    await sleep(500);
    let p = await pl();
    assert(p.ground, "player should stand on the flattened ground " + JSON.stringify(p));
    const startX = p.x;
    await page.keyboard.down("ArrowRight");
    await sleep(450);
    await page.keyboard.up("ArrowRight");
    p = await pl();
    assert(p.x - startX > 1.2, "moved right only " + (p.x - startX).toFixed(2));
    // wall: 4 tall column 3 tiles ahead
    const wallX = Math.floor(p.x) + 3;
    await dbg(
      page,
      ([wx, t]) =>
        window.__buddies.debug.fill(wx, t - 4, wx, t - 1, window.__buddies.debug.ids.PLANKS),
      [wallX, top],
    );
    await page.keyboard.down("ArrowRight");
    await sleep(1500);
    await page.keyboard.up("ArrowRight");
    p = await pl();
    assert(
      p.x < wallX - 0.25 && p.y === top,
      `walked into the wall: x=${p.x.toFixed(2)} wall=${wallX}`,
    );
    // jump
    await page.keyboard.down("Space");
    await sleep(60);
    await page.keyboard.up("Space");
    let minY = 1e9;
    for (let i = 0; i < 14; i++) {
      await sleep(50);
      minY = Math.min(minY, (await pl()).y);
    }
    assert(top - minY > 1.5 && top - minY < 3.2, "jump height " + (top - minY).toFixed(2));
    await sleep(500);
    p = await pl();
    assert(
      p.ground && Math.abs(p.y - top) < 0.02,
      "should land back on the ground " + JSON.stringify(p),
    );
    // 1-tile ledge auto-step: a plateau 1 tile high, 3 tiles to the left
    await tpTo(x0 + 10.5, top);
    await sleep(300);
    await dbg(
      page,
      ([a, t]) =>
        window.__buddies.debug.fill(a - 8, t - 1, a - 3, t - 1, window.__buddies.debug.ids.STONE),
      [x0 + 10, top],
    );
    await page.keyboard.down("ArrowLeft");
    await sleep(1300);
    await page.keyboard.up("ArrowLeft");
    p = await pl();
    assert(
      Math.abs(p.y - (top - 1)) < 0.02 && p.ground,
      "should have stepped up onto the ledge " + JSON.stringify(p),
    );
    // ladder
    const lx = x0 + 18;
    await dbg(
      page,
      ([a, t]) =>
        window.__buddies.debug.fill(a, t - 7, a, t - 1, window.__buddies.debug.ids.LADDER),
      [lx, top],
    );
    await tpTo(lx + 0.5, top);
    await sleep(300);
    await page.keyboard.down("ArrowUp");
    await sleep(700);
    p = await pl();
    assert(p.climbing && p.y < top - 1.5, "should be climbing " + JSON.stringify(p));
    await page.keyboard.up("ArrowUp");
    const y1 = (await pl()).y;
    await sleep(400);
    const y2 = (await pl()).y;
    assert(Math.abs(y1 - y2) < 0.05, "should hold position on the ladder");
    await page.keyboard.down("ArrowUp");
    await sleep(1200);
    await page.keyboard.up("ArrowUp");
    p = await pl();
    assert(
      p.y <= top - 6.5 && p.y >= top - 7.1,
      "should top out on the ladder top " + p.y.toFixed(2),
    );
    await page.context().close();
    return "walk, wall, jump, ledge step, ladder climb/top-out OK";
  });

  // ---- AC-3 / AC-12 touch controls (Maya: one-handed phone) ----
  await check(
    "AC-3",
    "touch: hold the D-pad, jump, tap to place, Break mode tap removes",
    async () => {
      const { page, ctx } = await openPage(browser, {
        viewport: { width: 390, height: 844 },
        touch: true,
        dsf: 2,
      });
      await startGame(page);
      await settle(page, 700);
      const pl = () => page.evaluate(() => window.__buddies.player);
      const down = (sel) =>
        page.dispatchEvent(sel, "pointerdown", {
          pointerId: 7,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: 1,
        });
      const up = (sel) =>
        page.dispatchEvent(sel, "pointerup", {
          pointerId: 7,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: 0,
        });
      const p0 = await pl();
      await down("#tLeft");
      await sleep(450);
      await up("#tLeft");
      const p1 = await pl();
      assert(
        p0.x - p1.x > 1.2,
        "holding the left button should walk left, moved " + (p0.x - p1.x).toFixed(2),
      );
      await down("#tJump");
      await sleep(150);
      const pj = await pl();
      await up("#tJump");
      assert(
        pj.y < p1.y - 0.3 || !pj.ground,
        "the jump button should leave the ground " + JSON.stringify(pj),
      );
      await sleep(900);
      const p = await pl();
      const tx = Math.floor(p.x);
      const ty = Math.floor(p.y) - 3;
      const s = await page.evaluate(
        ([x, y]) => window.__buddies.debug.tileToScreen(x, y),
        [tx, ty],
      );
      await page.touchscreen.tap(s.x, s.y);
      await sleep(200);
      assert((await getTile(page, tx, ty)).fg === IDS.PLANKS, "tapping places the selected block");
      await page.locator("#modeBtn").tap();
      assert(
        (await page.evaluate(() => window.__buddies.mode)) === "break",
        "Mode button switches to Break",
      );
      await page.touchscreen.tap(s.x, s.y);
      await sleep(200);
      assert((await getTile(page, tx, ty)).fg === 0, "tapping in Break mode removes it");
      await ctx.close();
      return "D-pad hold, jump button, tap place, Break-mode tap";
    },
  );

  // ---- AC-4 place / break rules via the real input path ----
  await check(
    "AC-4",
    "place/break by click, reach, body overlap, floor rule, multi-tile, ghost",
    async () => {
      const { page } = await openPage(browser);
      await startGame(page);
      await settle(page);
      const p = await dbg(page, () => window.__buddies.player);
      let px = Math.floor(p.x);
      let py = Math.floor(p.y);
      // place + break a block above the player
      await tileClick(page, px, py - 3);
      assert((await getTile(page, px, py - 3)).fg === IDS.PLANKS, "click should place planks");
      await tileClick(page, px, py - 3, "right");
      assert((await getTile(page, px, py - 3)).fg === 0, "right-click should break it");
      // too far (9 tiles)
      await tileClick(page, px + 9, py - 3);
      assert(
        (await getTile(page, px + 9, py - 3)).fg === 0,
        "out-of-reach placement must be refused",
      );
      // inside the player's body
      const bodyY = Math.floor(p.y - 0.5);
      await tileClick(page, px, bodyY);
      assert(
        (await getTile(page, px, bodyY)).fg === 0,
        "placing inside the player must be refused",
      );
      // furniture needs a floor
      await page.keyboard.press("Digit7"); // bed
      assert(
        (await dbg(page, () => window.__buddies.selected)) === "bed",
        "hotbar key 7 selects the bed",
      );
      await tileClick(page, px - 1, py - 3);
      assert((await getTile(page, px - 1, py - 3)).fg === 0, "a bed in mid-air must be refused");
      // The rest runs on open ground far left of the house, where no buddy ever walks (the visitor
      // starts east of here). In the kitchen the resident Barnaby wanders, and a solid door is rightly
      // refused when he stands in its tile - which made this step flaky.
      const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
      const top = await flatten(page, hx - 30, hx - 20);
      await dbg(page, ([x, t]) => window.__buddies.debug.teleport(x, t), [hx - 25 + 0.5, top]);
      await settle(page);
      const q = await dbg(page, () => window.__buddies.player);
      px = Math.floor(q.x);
      py = Math.floor(q.y);
      // bed on the ground: two tiles, breaking one half removes both
      const bx = px - 5;
      await tileClick(page, bx, py - 1);
      const l = await getTile(page, bx, py - 1);
      const r = await getTile(page, bx + 1, py - 1);
      assert(
        l.fg === IDS.BED_L && r.fg === IDS.BED_R,
        "bed should occupy two tiles " + JSON.stringify([l, r]),
      );
      await tileClick(page, bx + 1, py - 1, "right");
      assert(
        (await getTile(page, bx, py - 1)).fg === 0 &&
          (await getTile(page, bx + 1, py - 1)).fg === 0,
        "breaking one half removes both",
      );
      // door is two tiles tall
      await page.keyboard.press("Digit6");
      await tileClick(page, bx, py - 1);
      assert(
        (await getTile(page, bx, py - 1)).fg === IDS.DOOR_B &&
          (await getTile(page, bx, py - 2)).fg === IDS.DOOR_T,
        "door should be 2 tiles tall",
      );
      await tileClick(page, bx, py - 2, "right");
      assert((await getTile(page, bx, py - 1)).fg === 0, "breaking the top removes the bottom too");
      // ghost validity equals canPlace
      await page.keyboard.press("Digit7");
      const gp = await dbg(page, ([x, y]) => window.__buddies.debug.tileToScreen(x, y), [
        px - 4,
        py - 1,
      ]);
      await page.mouse.move(gp.x, gp.y);
      await sleep(200);
      const g1 = await dbg(
        page,
        ([x, y]) => ({
          aim: window.__buddies.debug.aim(),
          cp: window.__buddies.debug.canPlace("bed", x, y),
        }),
        [px - 4, py - 1],
      );
      assert(
        g1.aim.valid === g1.cp.ok && g1.aim.valid === true,
        "ghost should be valid (green) " + JSON.stringify(g1),
      );
      assert(g1.aim.mark === "", "a valid ghost has no cross");
      const gp2 = await dbg(page, ([x, y]) => window.__buddies.debug.tileToScreen(x, y), [
        px - 4,
        py - 5,
      ]);
      await page.mouse.move(gp2.x, gp2.y);
      await sleep(200);
      const g2 = await dbg(
        page,
        ([x, y]) => ({
          aim: window.__buddies.debug.aim(),
          cp: window.__buddies.debug.canPlace("bed", x, y),
        }),
        [px - 4, py - 5],
      );
      assert(
        g2.aim.valid === false && g2.cp.ok === false,
        "ghost should be invalid (red) in mid-air " + JSON.stringify(g2),
      );
      assert(g2.aim.mark === "x", "an invalid ghost is crossed out, not only red (C-02)");
      // supports: mining the floor under furniture drops the furniture (engine-level, reach-checked)
      const cascade = await dbg(
        page,
        ([x, y]) => {
          const d = window.__buddies.debug;
          d.teleport(x + 1.5, y);
          d.place(x + 1, y, d.ids.PLANKS);
          d.placeItem("chest", x + 1, y - 1);
          const r = d.tryBreak(x + 1, y);
          return { r, chest: d.getTile(x + 1, y - 1).fg };
        },
        [px - 12, py - 8],
      );
      assert(
        cascade.r.ok && cascade.chest === 0,
        "chest should fall off when its floor is mined " + JSON.stringify(cascade),
      );
      // unlock through the Build menu
      await dbg(page, () =>
        window.__buddies.debug.teleport(
          window.__buddies.debug.spawn.player.x,
          window.__buddies.debug.spawn.player.y,
        ),
      );
      await page.getByRole("button", { name: "Items, open build menu" }).click();
      const before = await dbg(page, () => window.__buddies.coins);
      await page.getByRole("button", { name: /^Red brick, locked/ }).click();
      const after = await dbg(page, () => ({
        c: window.__buddies.coins,
        sel: window.__buddies.selected,
      }));
      assert(
        after.c === before - 15 && after.sel === "brick",
        "unlocking red brick costs 15 and selects it " + JSON.stringify(after),
      );
      await page.context().close();
      return "click place/break, reach, body overlap, floor rule, bed 2x1, door 1x2, ghost green/red, support cascade, unlock";
    },
  );

  // ---- AC-5 pure room detection ---------------------------------------------
  await check("AC-5", "room detection on hand-made grids", async () => {
    const { page } = await openPage(browser);
    const det = (rows, opts) =>
      page.evaluate(([r, o]) => window.__buddies.debug.detectRooms(r, o), [rows, opts || {}]);
    // closed + backed + door: valid, 24 cells
    const closed = ["########", "#,,,,,,#", "#,,,,,,#", "d,,,,,,#", "D,,,,,,#", "########"];
    let rooms = await det(closed);
    assert(
      rooms.length === 1 && rooms[0].valid && rooms[0].size === 24 && rooms[0].doors === 1,
      "closed room " + JSON.stringify(rooms),
    );
    // open: a hole in the roof leaks into the sky (a big open region) -> not a room at all.
    // (The grid edge is a wall, so the "sky" must be big enough to count as open: 15 rows x 50.)
    const sky = Array(15).fill(".".repeat(50));
    const roof = "#".repeat(50).split("");
    roof[3] = ".";
    const withHole = [
      ...sky,
      roof.join(""),
      ...["#,,,,,,#", "#,,,,,,#", "d,,,,,,#", "D,,,,,,#", "########"].map(
        (r) => r + "#".repeat(42),
      ),
    ];
    rooms = await det(withHole);
    assert(
      rooms.length === 0,
      "a room open to the sky must not be detected: " + JSON.stringify(rooms),
    );
    // ...and a hole at the grid edge only leads out of the world, which is a wall: still a (leaky) room
    rooms = await det(["###.####", "#,,,,,,#", "#,,,,,,#", "d,,,,,,#", "D,,,,,,#", "########"]);
    assert(
      rooms.length === 1 && !rooms[0].valid && rooms[0].backed === false,
      "a hole that only reaches the world edge is not a sky leak: " + JSON.stringify(rooms),
    );
    // missing background wall
    rooms = await det(["########", "#,,,,,,#", "#,,.,,,#", "d,,,,,,#", "D,,,,,,#", "########"]);
    assert(
      rooms.length === 1 && !rooms[0].valid && rooms[0].backed === false,
      "missing backing must be invalid " + JSON.stringify(rooms[0]),
    );
    // no door and no hatch
    rooms = await det(["########", "#,,,,,,#", "#,,,,,,#", "#,,,,,,#", "#,,,,,,#", "########"]);
    assert(
      rooms.length === 1 && !rooms[0].valid && rooms[0].doors === 0,
      "a sealed room has no entry -> invalid",
    );
    // too big / too small (limits are options)
    rooms = await det(closed, { max: 20 });
    assert(rooms[0].tooBig && !rooms[0].valid, "too big must be invalid");
    rooms = await det(["####", "d,,#", "D,,#", "####"]);
    assert(
      rooms.length === 1 && rooms[0].size === 4 && rooms[0].tooSmall && !rooms[0].valid,
      "too small must be invalid " + JSON.stringify(rooms[0]),
    );
    // ladder hatch: a hole in the floor does not leak; two rooms, each reachable by the hatch
    rooms = await det([
      "#########",
      "#,,,,,,,#",
      "#,,,L,,,#",
      "####L####",
      "#,,,L,,,#",
      "#,,,,,,,#",
      "#########",
    ]);
    assert(
      rooms.length === 2 && rooms.every((r) => r.valid && r.hatches >= 1),
      "hatch should split into two valid rooms " +
        JSON.stringify(rooms.map((r) => [r.size, r.valid, r.hatches])),
    );
    // glass in the wall counts as boundary (does not leak)
    rooms = await det(["########", "#,,,,,,#", "G,,,,,,#", "d,,,,,,#", "D,,,,,,#", "########"]);
    assert(rooms.length === 1 && rooms[0].valid && rooms[0].glass === 1, "glass is a wall");
    // F-03: a ladder INSIDE a sealed room is furniture, not a hatch: no entry -> invalid
    rooms = await det(["########", "#,,L,,,#", "#,,L,,,#", "#,,L,,,#", "########"]);
    assert(
      rooms.length === 1 && !rooms[0].valid && rooms[0].hatches === 0 && rooms[0].doors === 0,
      "a ladder inside a sealed room must not count as an entry " + JSON.stringify(rooms[0]),
    );
    // F-10: the world edge is a wall, so a room may use it as one (no phantom leak)
    rooms = await det(["######", ",,,,,#", ",,,,,#", ",,,,,d", ",,,,,D", "######"]);
    assert(
      rooms.length === 1 && rooms[0].valid && rooms[0].size === 20 && rooms[0].doors === 1,
      "a room against the world edge is enclosed " + JSON.stringify(rooms),
    );
    // types
    const typed = async (rows) => (await det(rows))[0].types.join("/");
    const bedroom = await typed([
      "########",
      "#,,,,,,#",
      "#,,T,,,#",
      "d,Bb,,,#",
      "D,,,,,,#",
      "########",
    ]);
    const kitchen = await typed([
      "########",
      "#,,,,,,#",
      "#,,,,,,#",
      "d,F,Xx,#",
      "D,,,,,,#",
      "########",
    ]);
    const library = await typed([
      "########",
      "#,,,,,,#",
      "#,,,,,,#",
      "d,S,S,C#",
      "D,,,,,,#",
      "########",
    ]);
    const workshop = await typed([
      "########",
      "#,,,,,,#",
      "#,,,,,,#",
      "d,W,H,,#",
      "D,,,,,,#",
      "########",
    ]);
    const greenhouse = await typed([
      "########",
      "#,,,,,,#",
      "G,,,,,,#",
      "d,P,P,P#",
      "D,,,,,,#",
      "########",
    ]);
    assert(
      bedroom === "Bedroom" &&
        kitchen === "Kitchen" &&
        library === "Library" &&
        workshop === "Workshop" &&
        greenhouse === "Greenhouse",
      `types: ${[bedroom, kitchen, library, workshop, greenhouse]}`,
    );
    await page.context().close();
    return "open / closed / unbacked / sealed / too big / too small / hatch / glass / 5 types";
  });

  // ---- AC-6 request loop (also reused by AC-7, AC-8, AC-10) ----
  const flow = await openPage(browser);
  let flowOk = false;
  await check(
    "AC-6",
    "build a bedroom, detected live, buddy walks in, rewards, next request",
    async () => {
      const { page } = flow;
      await startGame(page);
      await settle(page, 600);
      const req0 = await dbg(page, () => window.__buddies.request);
      assert(
        req0 && req0.type === "Bedroom" && req0.index === 0,
        "first request is a bedroom " + JSON.stringify(req0),
      );
      const coins0 = await dbg(page, () => window.__buddies.coins);
      // build a 6x3 plank bedroom on flattened ground LEFT of the house, door on the visitor side
      const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
      const x0 = hx - 40;
      const x1 = x0 + 7;
      const top = await flatten(page, x0 - 1, x1 + 14);
      await dbg(
        page,
        ([a, b, t]) => {
          const d = window.__buddies.debug;
          const I = d.ids;
          d.fill(a, t - 4, b, t - 4, I.PLANKS); // roof
          d.fill(a, t, b, t, I.PLANKS); // floor
          d.fill(a, t - 3, a, t - 1, I.PLANKS); // left wall
          d.fill(b, t - 3, b, t - 3, I.PLANKS); // right wall above the door
          d.fill(a + 1, t - 3, b - 1, t - 1, d.bgIds.PLANKS, "bg"); // back wall
          d.placeItem("door", b, t - 1);
          d.placeItem("torch", a + 3, t - 2);
          // also a Library (2 shelves + a chair): its first type is "Library", the request is "Bedroom"
          d.placeItem("shelf", a + 4, t - 1);
          d.placeItem("shelf", a + 5, t - 1);
          d.placeItem("chair", a + 6, t - 1);
        },
        [x0, x1, top],
      );
      // not a bedroom yet: no bed
      await sleep(500);
      let rooms = await dbg(page, () =>
        window.__buddies.debug.rooms().filter((r) => r.valid && !r.occupied),
      );
      assert(
        rooms.length === 1 && !rooms[0].types.includes("Bedroom"),
        "room without a bed is not a bedroom " + JSON.stringify(rooms.map((r) => r.types)),
      );
      // the live checklist while standing inside shows the missing bed
      await dbg(page, ([x, t]) => window.__buddies.debug.teleport(x, t), [x0 + 2.5, top]);
      await sleep(600);
      const cl = await dbg(page, () => window.__buddies.debug.checklist());
      assert(
        cl.some((i) => /bed/.test(i.text) && i.ok === false) && cl[0].ok === true,
        "checklist should flag the missing bed " + JSON.stringify(cl),
      );
      await dbg(page, ([a, t]) => window.__buddies.debug.placeItem("bed", a + 1, t - 1), [x0, top]);
      await sleep(700);
      rooms = await dbg(page, () =>
        window.__buddies.debug.rooms().filter((r) => r.valid && !r.occupied),
      );
      assert(
        rooms.length === 1 && rooms[0].types.includes("Bedroom") && rooms[0].size === 18,
        "bedroom detected live " + JSON.stringify(rooms),
      );
      await dbg(page, () =>
        window.__buddies.debug.teleport(
          window.__buddies.debug.spawn.player.x,
          window.__buddies.debug.spawn.player.y,
        ),
      );
      // the visitor arrives, then walks in (edge case: break the torch mid-walk, buddy turns back)
      await page.waitForFunction(
        () => ["moving", "next"].includes(window.__buddies.request.state),
        null,
        { timeout: 40000, polling: 30 },
      );
      const midState = await dbg(page, () => window.__buddies.request.state);
      if (midState === "moving") {
        await dbg(page, ([a, t]) => window.__buddies.debug.place(a + 3, t - 2, 0), [x0, top]);
        await page.waitForFunction(() => window.__buddies.request.state === "waiting", null, {
          timeout: 20000,
          polling: 30,
        });
        assert(
          (await dbg(page, () => window.__buddies.housed)) === 0,
          "must not be housed while the room is broken",
        );
        await dbg(page, ([a, t]) => window.__buddies.debug.placeItem("torch", a + 3, t - 2), [
          x0,
          top,
        ]);
      }
      await page.waitForFunction(() => window.__buddies.housed === 1, null, {
        timeout: 40000,
        polling: 40,
      });
      const toastText = await page.locator("#toast").textContent();
      assert(
        /moved into the Bedroom/.test(toastText),
        "the move-in toast names the requested type (F-12), got: " + toastText,
      );
      await page.screenshot({ path: join(SHOTS, "room-complete.jpg") });
      const done = await dbg(page, () => ({
        coins: window.__buddies.coins,
        housed: window.__buddies.housed,
        best: window.__buddies.bestOverall,
        happy: window.__buddies.happiness,
        b: window.__buddies.debug.buddies().filter((b) => b.role === "resident" && b.home >= 0)
          .length,
      }));
      assert(
        done.coins === coins0 + 40 && done.best >= 1 && done.happy >= 1,
        "rewards " + JSON.stringify({ done, coins0 }),
      );
      await page.waitForFunction(
        () => window.__buddies.request && window.__buddies.request.index === 1,
        null,
        { timeout: 15000, polling: 100 },
      );
      const req1 = await dbg(page, () => window.__buddies.request);
      assert(req1.type === "Kitchen", "next request is a kitchen " + JSON.stringify(req1));
      flowOk = true;
      return `housed 1, +40 coins, stars ${done.happy}, next request ${req1.type} (${midState === "moving" ? "mid-walk break handled" : "poofed in"})`;
    },
  );

  // ---- AC-6b buddy pathfinding through doors and ladders ----
  await check(
    "AC-6",
    "buddy path from the visitor spot into the basement via ladder + door",
    async () => {
      const { page } = flow;
      const len = await dbg(page, () => {
        const d = window.__buddies.debug;
        const v = d.spawn.visitor;
        const hx = d.world.houseX;
        const hy = d.world.houseY;
        return d.findPath(Math.floor(v.x), Math.floor(v.y), hx + 16, hy + 21);
      });
      assert(len && len >= 8, "a path should exist (ladder down + door), got " + len);
      return "path length " + len;
    },
  );

  // ---- AC-7 persistence --------------------------------------------------------
  await check("AC-7", "save key, shape, size, reload restores, hostile saves ignored", async () => {
    assert(flowOk, "needs the AC-6 world");
    const { page } = flow;
    const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
    await dbg(
      page,
      ([x]) => {
        const d = window.__buddies.debug;
        d.place(x, 12, d.ids.BRICK);
        d.giveCoins(7);
      },
      [hx + 3],
    );
    const size = await dbg(page, () => window.__buddies.debug.save());
    const raw = await dbg(page, () => localStorage.getItem(window.__buddies.debug.saveKey));
    const parsed = JSON.parse(raw);
    assert(
      parsed.v === 1 && typeof parsed.bestOverall === "number" && parsed.bestOverall >= 1,
      "save shape " + raw.slice(0, 80),
    );
    assert(size > 0 && size < 100000, "save size " + size);
    const coins = await dbg(page, () => window.__buddies.coins);
    await page.reload();
    await page.waitForFunction(() => !!window.__buddies);
    await startGame(page);
    const back = await dbg(
      page,
      ([x]) => ({
        tile: window.__buddies.debug.getTile(x, 12).fg,
        coins: window.__buddies.coins,
        housed: window.__buddies.housed,
        best: window.__buddies.bestOverall,
        req: window.__buddies.request.index,
      }),
      [hx + 3],
    );
    assert(
      back.req === 1,
      "the request chain continues after a reload (F-01), got index " + back.req,
    );
    assert(
      back.tile === IDS.BRICK && back.coins === coins && back.housed === 1 && back.best >= 1,
      "restored " + JSON.stringify(back),
    );
    // hostile / corrupt saves: ignored without errors, fresh world, no prototype pollution
    const bad = [
      "1e999",
      '{"v":1,"bestOverall":1e999,"world":{"w":176,"h":84,"fg":"AAAA","bg":"AAAA","coins":1e999}}',
      '{"__proto__":{"polluted":1},"v":1,"world":{"__proto__":{"polluted":2}}}',
      '{"v":2,"bestOverall":9}',
      "not json{",
      '{"v":1,"world":{"w":176,"h":84,"fg":"!!!!","bg":"x"}}',
      JSON.stringify({
        v: 1,
        world: {
          w: 176,
          h: 84,
          fg: Buffer.from(
            Uint8Array.from([...Array(57).fill([200, 255]).flat(), 200, 249]),
          ).toString("base64"),
          bg: "AAAA",
        },
      }),
    ];
    const key = await dbg(page, () => window.__buddies.debug.saveKey);
    // (a reload would let the old page's pagehide save overwrite the payload, so each payload gets a
    // fresh context and is injected before any page script runs)
    for (const payload of bad) {
      const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await c.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, payload]);
      const hp = await openPage(browser, { context: c });
      const s = await dbg(hp.page, () => ({
        phase: window.__buddies.phase,
        coins: window.__buddies.coins,
        best: window.__buddies.bestOverall,
        poll: {}.polluted,
      }));
      assert(
        s.phase === "title" && s.coins === 80 && s.poll === undefined && s.best === 0,
        "hostile save accepted: " + payload.slice(0, 50) + " -> " + JSON.stringify(s),
      );
      await c.close();
    }
    // a minimal valid save keeps the record but gives a fresh world
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await c2.addInitScript(([k]) => localStorage.setItem(k, '{"v":1,"bestOverall":7}'), [key]);
    const rp = await openPage(browser, { context: c2 });
    const rec = await dbg(rp.page, () => ({
      best: window.__buddies.bestOverall,
      coins: window.__buddies.coins,
    }));
    assert(rec.best === 7 && rec.coins === 80, "record kept, world fresh " + JSON.stringify(rec));
    await c2.close();
    return `save ${size} bytes, restored tile/coins/housed, ${bad.length} hostile payloads ignored`;
  });

  // ---- AC-8 new world ------------------------------------------------------
  await check(
    "AC-8",
    "New world asks to confirm; keeps record and sound; cancel changes nothing",
    async () => {
      const { page } = flow;
      const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
      await dbg(
        page,
        ([x]) => {
          const d = window.__buddies.debug;
          d.place(x, 12, d.ids.BRICK);
          d.giveCoins(25);
        },
        [hx + 3],
      );
      const coinsBefore = await dbg(page, () => window.__buddies.coins);
      const best0 = await dbg(page, () => window.__buddies.bestOverall);
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.getByRole("button", { name: "Sound effects" }).click(); // turn sound off
      await page.getByRole("button", { name: /^New world/ }).click();
      assert(
        await page.locator("#confirm").evaluate((el) => el.classList.contains("open")),
        "confirm dialog should open",
      );
      await page.getByRole("button", { name: "Keep my world" }).click();
      const kept = await dbg(
        page,
        ([x]) => ({
          tile: window.__buddies.debug.getTile(x, 12).fg,
          coins: window.__buddies.coins,
        }),
        [hx + 3],
      );
      assert(
        kept.tile === IDS.BRICK && kept.coins === coinsBefore,
        "cancel must change nothing " + JSON.stringify(kept),
      );
      await page.getByRole("button", { name: /^New world/ }).click();
      await page.getByRole("button", { name: "Yes, start fresh" }).click();
      await page.waitForFunction(() => window.__buddies.phase === "playing");
      const fresh = await dbg(
        page,
        ([x]) => ({
          tile: window.__buddies.debug.getTile(x, 12).fg,
          coins: window.__buddies.coins,
          housed: window.__buddies.housed,
          best: window.__buddies.bestOverall,
          sound: window.__buddies.debug.audio().sound,
          req: window.__buddies.request.index,
        }),
        [hx + 3],
      );
      assert(fresh.req === 0, "a new world restarts the request chain, got " + fresh.req);
      assert(
        fresh.tile === 0 && fresh.coins === 80 && fresh.housed === 0,
        "world reset " + JSON.stringify(fresh),
      );
      assert(
        fresh.best === best0 && fresh.sound === false,
        "record and sound kept " + JSON.stringify({ fresh, best0 }),
      );
      const stored = JSON.parse(
        await dbg(page, () => localStorage.getItem(window.__buddies.debug.saveKey)),
      );
      assert(
        stored.bestOverall === best0 && stored.sound === false,
        "persisted record/sound " + JSON.stringify({ b: stored.bestOverall, s: stored.sound }),
      );
      await flow.ctx.close();
      return `record ${best0} kept, sound off kept, tiles + coins reset`;
    },
  );

  // ---- QA round 1: one regression check per fix (F-xx = findings, C-xx = compliance) ----
  const room = (page, pred) =>
    page.evaluate(
      (src) => window.__buddies.debug.rooms().find(new Function("r", "return " + src)),
      pred,
    );

  await check(
    "AC-6",
    "F-02 claims cover the whole room: editing a cell does not free a starter room",
    async () => {
      const { page, ctx } = await openPage(browser);
      await startGame(page);
      await settle(page, 400);
      const k = await room(page, "r.valid && r.occupied && r.types.includes('Kitchen')");
      assert(k, "the starter kitchen is a valid occupied room");
      // the room's FIRST cell (the old single-cell claim key): top row, leftmost cell of the region
      const first = await dbg(
        page,
        (kk) => {
          const d = window.__buddies.debug;
          for (let x = kk.x0; x <= kk.x1; x++) {
            const r = d.regionAt(x, kk.y0);
            if (r.room && r.room.size === kk.size) return x;
          }
          return -1;
        },
        k,
      );
      assert(first >= 0, "found the first cell");
      await dbg(
        page,
        ([x, y]) => window.__buddies.debug.place(x, y, window.__buddies.debug.ids.PLANKS),
        [first, k.y0],
      );
      await sleep(500);
      const after = await room(
        page,
        `r.valid && r.types.includes('Kitchen') && r.size === ${k.size - 1}`,
      );
      assert(
        after && after.occupied === true,
        "the edited kitchen is still occupied " + JSON.stringify(after),
      );
      // demolishing the room (filling it in) drops the claim; an emptied room is then new
      const c0 = await dbg(page, () => window.__buddies.debug.claimedCells());
      await dbg(
        page,
        (kk) =>
          window.__buddies.debug.fill(
            kk.x0,
            kk.y0,
            kk.x1,
            kk.y1,
            window.__buddies.debug.ids.PLANKS,
          ),
        k,
      );
      await sleep(500);
      const c1 = await dbg(page, () => window.__buddies.debug.claimedCells());
      assert(
        c1 <= c0 - k.size + 1,
        `stale claims are dropped when a room is built over (${c0} -> ${c1})`,
      );
      await dbg(page, (kk) => window.__buddies.debug.fill(kk.x0, kk.y0, kk.x1, kk.y1, 0), k);
      await sleep(500);
      const reborn = await room(
        page,
        `r.valid && r.x0 === ${k.x0} && r.y0 === ${k.y0} && r.x1 === ${k.x1}`,
      );
      assert(
        reborn && reborn.occupied === false,
        "a demolished and rebuilt room is a new, free room " + JSON.stringify(reborn),
      );
      await ctx.close();
      return `kitchen stays occupied after an edit (${k.size} cells); demolishing frees it`;
    },
  );

  await check(
    "AC-4",
    "F-04 a player saved standing in a doorway reloads in it, not on the roof",
    async () => {
      const { page, ctx } = await openPage(browser);
      await startGame(page);
      const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
      const x0 = hx - 24;
      const top = await flatten(page, x0, x0 + 12);
      await dbg(page, ([x, t]) => window.__buddies.debug.placeItem("door", x, t - 1), [
        x0 + 5,
        top,
      ]);
      await dbg(page, ([x, t]) => window.__buddies.debug.teleport(x + 0.5, t), [x0 + 5, top]);
      await sleep(600);
      const y0 = (await dbg(page, () => window.__buddies.player)).y;
      await dbg(page, () => window.__buddies.debug.save());
      await page.reload();
      await page.waitForFunction(() => !!window.__buddies);
      await startGame(page);
      const y1 = (await dbg(page, () => window.__buddies.player)).y;
      assert(
        Math.abs(y1 - y0) < 0.5,
        `the player stays in the doorway: y ${y0.toFixed(2)} -> ${y1.toFixed(2)}`,
      );
      await ctx.close();
      return `saved y ${y0.toFixed(2)}, reloaded y ${y1.toFixed(2)}`;
    },
  );

  await check("AC-3", "F-05 nobody can jump out of the top of the world", async () => {
    const { page, ctx } = await openPage(browser);
    await startGame(page);
    const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
    const x = hx - 30;
    await dbg(
      page,
      ([cx]) => {
        const d = window.__buddies.debug;
        d.fill(cx - 1, 3, cx + 1, 3, d.ids.PLANKS);
        d.teleport(cx + 0.5, 3);
      },
      [x],
    );
    await sleep(500);
    let minY = 99;
    for (let j = 0; j < 3; j++) {
      await page.keyboard.down("Space");
      await sleep(80);
      await page.keyboard.up("Space");
      for (let i = 0; i < 14; i++) {
        await sleep(40);
        minY = Math.min(minY, (await dbg(page, () => window.__buddies.player)).y);
      }
    }
    assert(
      minY >= 1.8,
      "the head stops at the world's ceiling (feet y >= 1.84), lowest feet y " + minY.toFixed(2),
    );
    await ctx.close();
    return `lowest feet y ${minY.toFixed(2)} (ceiling stops the head at row 0)`;
  });

  await check(
    "AC-4",
    "F-06/F-07 doors fall with their floor; nothing stands on a door",
    async () => {
      const { page, ctx } = await openPage(browser);
      await startGame(page);
      const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
      const x0 = hx - 24;
      const top = await flatten(page, x0, x0 + 12);
      const r = await dbg(
        page,
        ([x, t]) => {
          const d = window.__buddies.debug;
          d.fill(x - 1, t, x + 1, t, d.ids.PLANKS); // a floor
          d.placeItem("door", x, t - 1); // a door standing on it
          d.teleport(x + 2.5, t - 1);
          const onDoor = d.canPlace("chest", x, t - 3); // a chest whose "floor" would be the door's top
          const mined = d.tryBreak(x, t); // mine the floor under the door
          return { onDoor, mined, bottom: d.getTile(x, t - 1).fg, topTile: d.getTile(x, t - 2).fg };
        },
        [x0 + 5, top],
      );
      assert(
        r.onDoor.ok === false,
        "furniture must not stand on a door (F-07) " + JSON.stringify(r.onDoor),
      );
      assert(
        r.mined.ok && r.bottom === 0 && r.topTile === 0,
        "the door drops when its floor is mined (F-06) " + JSON.stringify(r),
      );
      await ctx.close();
      return "chest on a door refused; door removed with its floor";
    },
  );

  await check("AC-4", "F-08 a held mouse stroke stops editing when the game pauses", async () => {
    const { page, ctx } = await openPage(browser);
    await startGame(page);
    await settle(page);
    const p = await dbg(page, () => window.__buddies.player);
    const a = [Math.floor(p.x), Math.floor(p.y) - 3];
    const b = [a[0] - 2, a[1]]; // (two tiles right of the player the OPEN board hangs)
    const sa = await dbg(page, ([x, y]) => window.__buddies.debug.tileToScreen(x, y), a);
    const sb = await dbg(page, ([x, y]) => window.__buddies.debug.tileToScreen(x, y), b);
    await page.mouse.move(sa.x, sa.y);
    await page.mouse.down();
    await sleep(150);
    assert(
      (await getTile(page, a[0], a[1])).fg === IDS.PLANKS,
      "the stroke places where it starts",
    );
    await page.keyboard.press("Escape");
    await sleep(150);
    assert((await dbg(page, () => window.__buddies.phase)) === "paused", "Esc pauses");
    await page.mouse.move(sb.x, sb.y, { steps: 4 });
    await sleep(150);
    await page.mouse.up();
    assert(
      (await getTile(page, b[0], b[1])).fg === 0,
      "a held button must not edit the world while paused",
    );
    await ctx.close();
    return "no edit while paused with the button held";
  });

  await check("AC-13", "F-09 opening and closing a door does not recompute light", async () => {
    const { page, ctx } = await openPage(browser);
    await startGame(page);
    const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
    const x0 = hx - 24;
    const top = await flatten(page, x0, x0 + 12);
    await dbg(page, ([x, t]) => window.__buddies.debug.placeItem("door", x, t - 1), [x0 + 6, top]);
    await dbg(page, ([x, t]) => window.__buddies.debug.teleport(x, t), [x0 + 3.5, top]);
    await sleep(700);
    const before = await dbg(page, () => window.__buddies.debug.stats());
    let sawOpen = false;
    await page.keyboard.down("ArrowRight");
    for (let i = 0; i < 24; i++) {
      await sleep(60);
      sawOpen ||= (await getTile(page, x0 + 6, top - 1)).fg === IDS.DOORO_B;
    }
    await page.keyboard.up("ArrowRight");
    await sleep(1500); // the door closes behind the player
    const after = await dbg(page, () => window.__buddies.debug.stats());
    assert(sawOpen, "the door opened as the player walked through");
    assert(
      after.lightRecomputes === before.lightRecomputes,
      `door toggles need no light pass (${before.lightRecomputes} -> ${after.lightRecomputes})`,
    );
    assert(after.roomDetects === before.roomDetects, "door toggles need no room re-detection");
    await ctx.close();
    return "door opened and closed with 0 light passes and 0 room detections";
  });

  await check("AC-4", "F-11 a grass tuft drops when the block under it is mined", async () => {
    const { page, ctx } = await openPage(browser);
    await startGame(page);
    const spot = await dbg(page, () => {
      const d = window.__buddies.debug;
      const hx = d.world.houseX;
      const x = hx - 20;
      const g = d.groundRow(x);
      d.place(x, g - 1, d.ids.TUFT); // make sure there is one
      d.teleport(x + 0.5, g);
      return { x, g, there: d.getTile(x, g - 1).fg === d.ids.TUFT };
    });
    assert(spot.there, "a tuft sits on the grass");
    const mined = await dbg(page, ([x, g]) => window.__buddies.debug.tryBreak(x, g), [
      spot.x,
      spot.g,
    ]);
    assert(mined.ok, "the grass block can be mined");
    assert((await getTile(page, spot.x, spot.g - 1)).fg === 0, "the tuft is gone with its ground");
    await ctx.close();
    return "tuft removed with the block below";
  });

  await check("AC-7", "F-13 a stale second tab never overwrites newer progress", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const A = await openPage(browser, { context });
    const B = await openPage(browser, { context }); // both load the same (empty) save revision
    await startGame(A.page);
    await startGame(B.page);
    const hx = await dbg(A.page, () => window.__buddies.debug.world.houseX);
    await dbg(
      A.page,
      ([x]) => {
        const d = window.__buddies.debug;
        d.giveCoins(300);
        d.place(x, 12, d.ids.STONE);
        d.save();
      },
      [hx + 3],
    );
    await sleep(400); // the storage event reaches tab B
    const toastB = await B.page.locator("#toast").textContent();
    assert(/another tab/i.test(toastB), "tab B is told progress moved on: " + toastB);
    const wrote = await dbg(B.page, () => window.__buddies.debug.save());
    assert(wrote === -2, "tab B refuses to save over newer progress, save() returned " + wrote);
    const stored = JSON.parse(
      await dbg(A.page, () => localStorage.getItem(window.__buddies.debug.saveKey)),
    );
    assert(
      stored.world.coins >= 300 && typeof stored.rev === "number" && stored.rev >= 1,
      "tab A's progress is intact",
    );
    await context.close();
    return `tab B blocked (save -> ${wrote}), stored rev ${stored.rev}, coins ${stored.world.coins}`;
  });

  await check("AC-13", "F-14 glow sprites per frame are capped", async () => {
    const { page, ctx } = await openPage(browser);
    await startGame(page);
    const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
    await dbg(
      page,
      ([x]) => {
        const d = window.__buddies.debug;
        d.fill(x - 30, 24, x - 1, 39, d.ids.TORCH); // 480 emitters in view
        d.teleport(x - 15.5, d.groundRow(x - 15));
      },
      [hx],
    );
    await sleep(900);
    const st = await dbg(page, () => window.__buddies.debug.stats());
    assert(
      st.glowsDrawn <= 256 && st.glowsDrawn >= 200,
      "the glow pass is capped at 256 sprites, drew " + st.glowsDrawn,
    );
    await ctx.close();
    return `drew ${st.glowsDrawn} glows with 480 emitters in view`;
  });

  await check("AC-12", "C-07 the pad row fits a 320px phone", async () => {
    const { page, ctx } = await openPage(browser, {
      viewport: { width: 320, height: 640 },
      touch: true,
      dsf: 2,
    });
    await startGame(page);
    await settle(page, 600);
    const r = await dbg(page, () => {
      const out = {};
      for (const id of ["tLeft", "tRight", "tDown", "tJump", "modeBtn", "buildBtn"]) {
        const b = document.getElementById(id).getBoundingClientRect();
        out[id] = [Math.round(b.left), Math.round(b.right)];
      }
      return { out, w: innerWidth, sw: document.documentElement.scrollWidth };
    });
    const clipped = Object.entries(r.out).filter(([, [l, rt]]) => l < 0 || rt > r.w);
    assert(clipped.length === 0 && r.sw <= r.w, "controls clipped at 320px: " + JSON.stringify(r));
    await ctx.close();
    return "jump / pad / mode buttons all inside 320px";
  });

  // ---- AC-9 lighting ---------------------------------------------------------
  await check("AC-9", "torch lights, underground is dark, recompute on change only", async () => {
    const { page } = await openPage(browser);
    await startGame(page);
    const info = await dbg(page, () => {
      const d = window.__buddies.debug;
      const hx = d.world.houseX;
      const x = hx - 14;
      const y = 54; // deep inside the dirt / stone
      d.fill(x, y, x + 2, y + 2, 0);
      return { x, y };
    });
    await sleep(300);
    const lightAt = (x, y) => page.evaluate(([a, b]) => window.__buddies.debug.light(a, b), [x, y]);
    const base = await lightAt(info.x + 1, info.y + 1);
    const surface = await lightAt(info.x + 1, 30);
    assert(
      surface.sky > 0.9 && base.sky < 0.1,
      `surface sky ${surface.sky.toFixed(2)} vs underground ${base.sky.toFixed(2)}`,
    );
    assert(base.block < 0.02, "dark before the torch");
    const stats0 = await dbg(page, () => window.__buddies.debug.stats());
    await dbg(page, ([x, y]) => window.__buddies.debug.placeItem("torch", x + 1, y + 1), [
      info.x,
      info.y,
    ]);
    await sleep(250);
    const lit = await lightAt(info.x + 1, info.y + 1);
    const nearby = await lightAt(info.x + 2, info.y + 1);
    const far = await lightAt(info.x + 14, info.y + 1);
    const stats1 = await dbg(page, () => window.__buddies.debug.stats());
    assert(
      lit.block > 0.6 && nearby.block > 0.4 && far.block < 0.05,
      `torch pool ${lit.block.toFixed(2)}/${nearby.block.toFixed(2)}/${far.block.toFixed(2)}`,
    );
    assert(stats1.lightRecomputes > stats0.lightRecomputes, "world change recomputes light");
    await sleep(900);
    const stats2 = await dbg(page, () => window.__buddies.debug.stats());
    assert(
      stats2.lightRecomputes === stats1.lightRecomputes,
      `idle must not recompute light (${stats1.lightRecomputes} -> ${stats2.lightRecomputes})`,
    );
    await dbg(page, ([x, y]) => window.__buddies.debug.place(x + 1, y + 1, 0), [info.x, info.y]);
    await sleep(250);
    const off = await lightAt(info.x + 2, info.y + 1);
    assert(off.block < 0.02, "breaking the torch removes its light");
    // rain toggle
    await dbg(page, () => window.__buddies.debug.setRain(false));
    assert((await dbg(page, () => window.__buddies.raining)) === false, "rain can be switched off");
    await page.context().close();
    return `torch ${lit.block.toFixed(2)} at source, ${nearby.block.toFixed(2)} beside, ${far.block.toFixed(2)} far; surface sky ${surface.sky.toFixed(2)}, cave ${base.sky.toFixed(2)}; light recomputes only on change`;
  });

  // ---- AC-10 audio -----------------------------------------------------------
  await check(
    "AC-10",
    "audio after gesture only, SFX trigger, mute + music toggles persist",
    async () => {
      const { page, ctx } = await openPage(browser);
      const pre = await dbg(page, () => window.__buddies.debug.audio());
      assert(pre.exists === false, "no AudioContext before the first gesture");
      await page.getByRole("button", { name: "Sound", exact: false }).first().click(); // title sound toggle -> off
      assert(
        (await dbg(page, () => window.__buddies.debug.audio().sound)) === false,
        "title toggle mutes",
      );
      await page.reload();
      await page.waitForFunction(() => !!window.__buddies);
      assert(
        (await dbg(page, () => window.__buddies.debug.audio().sound)) === false,
        "mute persisted across reload",
      );
      await page.getByRole("button", { name: "Sound", exact: false }).first().click(); // back on
      await startGame(page);
      const post = await dbg(page, () => window.__buddies.debug.audio());
      assert(
        post.exists && ["running", "suspended"].includes(post.state),
        "AudioContext created after Start " + JSON.stringify(post),
      );
      await settle(page, 500);
      const p = await dbg(page, () => window.__buddies.player);
      const before = await dbg(page, () => window.__buddies.debug.audio().played);
      await tileClick(page, Math.floor(p.x), Math.floor(p.y) - 3);
      const after = await dbg(page, () => window.__buddies.debug.audio().played);
      assert(after > before, `placing a block should play a voice (${before} -> ${after})`);
      await page.keyboard.press("KeyN");
      assert(
        (await dbg(page, () => window.__buddies.debug.audio().music)) === false,
        "N toggles music",
      );
      await ctx.close();
      return `no context before gesture; created after Start (${post.state}); voices ${before} -> ${after}`;
    },
  );

  // ---- AC-11 accessibility ---------------------------------------------------------
  await check(
    "AC-11",
    "names, keyboard-only play, focus ring, Space on a button, reduced motion",
    async () => {
      const { page, ctx } = await openPage(browser);
      // every button / link has an accessible name
      const unnamed = await dbg(page, () =>
        [...document.querySelectorAll("button, a[href]")]
          .filter((e) => !(e.getAttribute("aria-label") || e.textContent.trim()))
          .map((e) => e.id || e.className),
      );
      assert(unnamed.length === 0, "unnamed controls: " + unnamed.join(","));
      // C-05: where a control shows text, its accessible name starts with that text
      const mismatched = await dbg(page, () =>
        [...document.querySelectorAll("button, a[href]")]
          .map((e) => {
            const copy = e.cloneNode(true);
            copy
              .querySelectorAll("[aria-hidden='true'], .visually-hidden")
              .forEach((n) => n.remove());
            const visible = copy.textContent.replace(/\s+/g, " ").trim().toLowerCase();
            const name = (e.getAttribute("aria-label") || "").toLowerCase();
            return { id: e.id || e.className, visible, name };
          })
          .filter((c) => c.visible && c.name && !c.name.startsWith(c.visible))
          .map((c) => c.id + ": '" + c.name + "' vs visible '" + c.visible + "'"),
      );
      assert(
        mismatched.length === 0,
        "accessible name must start with the visible text: " + mismatched.join("; "),
      );
      assert(
        (await dbg(
          page,
          () => document.querySelectorAll("[role='tab'], [role='tablist']").length,
        )) === 0,
        "category buttons are plain pressed-state buttons (C-06)",
      );
      // keyboard-only start: the Start button has focus on load and the canvas is not a Tab stop (C-01)
      assert(
        (await dbg(page, () => document.activeElement.id)) === "startBtn",
        "Start building is focused on load",
      );
      assert(
        (await dbg(page, () => document.getElementById("view").tabIndex)) === -1,
        "the canvas is not a Tab stop on the title screen",
      );
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        assert(
          (await dbg(page, () => document.activeElement.id)) !== "view",
          "Tab never lands on the canvas while on the title screen",
        );
      }
      await page.focus("#startBtn");
      assert(
        (await dbg(page, () => document.activeElement.id)) === "startBtn",
        "Start button reachable by Tab",
      );
      const ring = await dbg(page, () => {
        const cs = getComputedStyle(document.activeElement);
        return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
      });
      assert(
        ring.style !== "none" && ring.width >= 2,
        "visible focus ring " + JSON.stringify(ring),
      );
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.__buddies.phase === "playing");
      await settle(page, 500);
      const x0 = (await dbg(page, () => window.__buddies.player)).x;
      await page.keyboard.down("KeyA");
      await sleep(400);
      await page.keyboard.up("KeyA");
      assert((await dbg(page, () => window.__buddies.player)).x < x0 - 1, "A moves left");
      assert(
        (await dbg(page, () => getComputedStyle(document.getElementById("view")).outlineStyle)) !==
          "none",
        "the canvas shows a focus ring for keyboard players",
      );
      await page.keyboard.press("Space");
      await sleep(150);
      assert(
        (await dbg(page, () => window.__buddies.player)).vy < 0 ||
          !(await dbg(page, () => window.__buddies.player)).ground,
        "Space jumps",
      );
      await sleep(700);
      // aim cursor + place + break without a mouse (on open ground, away from the residents)
      const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
      const top = await flatten(page, hx - 30, hx - 20);
      await dbg(page, ([x, t]) => window.__buddies.debug.teleport(x, t), [hx - 25 + 0.5, top]);
      await sleep(500);
      await page.keyboard.press("KeyC");
      await sleep(120); // the aim tile is refreshed on the next simulation tick
      const aim = await dbg(page, () => window.__buddies.debug.aim());
      await page.keyboard.press("KeyF");
      assert(
        (await getTile(page, aim.tx, aim.ty)).fg === IDS.PLANKS,
        "F places at the aim cursor " + JSON.stringify(aim),
      );
      await page.keyboard.press("KeyX");
      assert((await getTile(page, aim.tx, aim.ty)).fg === 0, "X breaks at the aim cursor");
      // hotbar keys, build menu, pause menu
      await page.keyboard.press("Digit9");
      assert((await dbg(page, () => window.__buddies.selected)) === "chair", "9 selects the chair");
      await page.keyboard.press("KeyE");
      assert(await page.locator("#build").isVisible(), "E opens the build menu");
      await page.keyboard.press("Escape");
      assert(!(await page.locator("#build").isVisible()), "Esc closes the build menu");
      await page.keyboard.press("Escape");
      assert(
        (await dbg(page, () => window.__buddies.phase)) === "paused" &&
          (await page.locator("#menu").isVisible()),
        "Esc opens the pause menu",
      );
      await page.keyboard.press("Escape");
      assert((await dbg(page, () => window.__buddies.phase)) === "playing", "Esc resumes");
      // Space on a focused button activates it instead of jumping
      await page.focus("#modeBtn");
      const y0 = (await dbg(page, () => window.__buddies.player)).y;
      await page.keyboard.press("Space");
      await sleep(250);
      const st = await dbg(page, () => ({
        mode: window.__buddies.mode,
        p: window.__buddies.player,
      }));
      assert(
        st.mode === "break" && st.p.ground && Math.abs(st.p.y - y0) < 0.05,
        "Space on the mode button toggles it, no jump " + JSON.stringify(st),
      );
      await ctx.close();
      // reduced motion: the rain does not move and there is no flash
      const rm = await openPage(browser, { reducedMotion: "reduce" });
      await startGame(rm.page);
      assert(
        (await dbg(rm.page, () => window.__buddies.debug.reduced().reducedMotion)) === true,
        "prefers-reduced-motion detected",
      );
      const r1 = await dbg(rm.page, () => window.__buddies.debug.rainSample());
      await sleep(600);
      const r2 = await dbg(rm.page, () => window.__buddies.debug.rainSample());
      assert(
        JSON.stringify(r1) === JSON.stringify(r2),
        "rain must not animate under reduced motion",
      );
      await rm.ctx.close();
      const nm = await openPage(browser);
      await startGame(nm.page);
      const n1 = await dbg(nm.page, () => window.__buddies.debug.rainSample());
      await sleep(300);
      const n2 = await dbg(nm.page, () => window.__buddies.debug.rainSample());
      assert(JSON.stringify(n1) !== JSON.stringify(n2), "rain animates normally");
      await nm.ctx.close();
      return "names, Tab+Enter start, focus ring, A/Space, aim F/X, 9/E/Esc, Space-on-button, reduced-motion rain static";
    },
  );

  // ---- AC-12 responsive + screenshots ---------------------------------------------------
  const views = [
    { id: "phone-portrait", viewport: { width: 390, height: 844 }, touch: true, dsf: 2 },
    { id: "phone-landscape", viewport: { width: 844, height: 390 }, touch: true, dsf: 2 },
    { id: "desktop", viewport: { width: 1280, height: 800 }, touch: false, dsf: 1 },
  ];
  for (const v of views) {
    await check("AC-12", `layout at ${v.viewport.width}x${v.viewport.height}`, async () => {
      const { page, ctx } = await openPage(browser, v);
      await settle(page, 700);
      await page.screenshot({ path: join(SHOTS, `title-${v.id}.jpg`) });
      const backH = await dbg(page, () =>
        Math.round(document.querySelector("#title .back-link").getBoundingClientRect().height),
      );
      assert(backH >= 48, "the title back link is at least 48px tall, got " + backH);
      const titleFits = await dbg(page, () => {
        const r = document.getElementById("startBtn").getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, h: innerHeight };
      });
      assert(
        titleFits.bottom <= titleFits.h && titleFits.top >= 0,
        "Start building is visible without scrolling " + JSON.stringify(titleFits),
      );
      await startGame(page);
      await settle(page, 1200);
      await page.screenshot({ path: join(SHOTS, `play-${v.id}.jpg`) });
      const m = await dbg(page, () => {
        const vis = [...document.querySelectorAll("button, a[href]")].filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            e.offsetParent !== null &&
            !e.closest("[hidden]") &&
            !e.closest("#menu:not(.open)") &&
            !e.closest("#confirm:not(.open)") &&
            !e.closest("#title[hidden]")
          );
        });
        const small = vis
          .filter(
            (e) =>
              Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height) <
              (e.classList.contains("slot") ? 43.5 : 47.5),
          )
          .map(
            (e) =>
              (e.id || e.className) +
              ":" +
              Math.round(e.getBoundingClientRect().width) +
              "x" +
              Math.round(e.getBoundingClientRect().height),
          );
        const boxes = [".hud-top", "#request", ".hotrow", ".tc"]
          .map((s) => [...document.querySelectorAll(s)])
          .flat()
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 0);
        const area = boxes.reduce((a, r) => a + r.width * r.height, 0);
        const tj = document.getElementById("tJump").getBoundingClientRect();
        return {
          sw: document.documentElement.scrollWidth,
          iw: innerWidth,
          small,
          cover: area / (innerWidth * innerHeight),
          touchVisible: tj.width > 0,
          canvas: [document.getElementById("view").width, document.getElementById("view").height],
          dpr: devicePixelRatio,
        };
      });
      assert(m.sw <= m.iw, `horizontal scroll ${m.sw} > ${m.iw}`);
      assert(
        m.small.length === 0,
        "HUD controls under 48px (hotbar slots 44): " + m.small.join(", "),
      );
      assert(
        m.touchVisible === v.touch,
        `touch controls visible=${m.touchVisible}, expected ${v.touch}`,
      );
      assert(m.cover < 0.6, "HUD boxes cover " + (m.cover * 100).toFixed(0) + "% of the screen");
      assert(
        m.canvas[0] === v.viewport.width * v.dsf,
        "canvas is DPR aware " + JSON.stringify(m.canvas),
      );
      // zoom: a phone shows ~16-18 tiles across the short side so the house reads as a house
      const z = await dbg(page, () => window.__buddies.debug.stats());
      const across = z.canvas[v.viewport.width < v.viewport.height ? 0 : 1] / z.tilePx;
      if (v.touch)
        assert(
          across >= 15 && across <= 19,
          `phone default shows ${across.toFixed(1)} tiles across the short side`,
        );
      else
        assert(
          z.tileCss >= 32 && z.tileCss <= 40,
          "desktop blocks are 32-40 css px, got " + z.tileCss,
        );
      // hotbar: only whole slots are visible (none clipped at either edge)
      const clipped = await dbg(page, () => {
        const hb = document.getElementById("hotbar").getBoundingClientRect();
        return [...document.querySelectorAll("#hotbar .slot")]
          .map((e) => e.getBoundingClientRect())
          .filter((r) => {
            const w = Math.min(r.right, hb.right - 3) - Math.max(r.left, hb.left + 3);
            return w > 1 && w < r.width - 1;
          }).length;
      });
      assert(clipped === 0, clipped + " hotbar slot(s) partially clipped");
      // objective card: open at the start, header-only once settled (so it never hides the house)
      const openAtStart = await page.evaluate(
        () => !document.getElementById("request").classList.contains("collapsed"),
      );
      assert(
        openAtStart === !v.touch,
        "request card open at start: " + openAtStart + " (expected " + !v.touch + ")",
      );
      if (!v.touch) {
        await sleep(6500);
        assert(
          await page.evaluate(() =>
            document.getElementById("request").classList.contains("collapsed"),
          ),
          "request card should collapse to its header after ~6s",
        );
        await page.screenshot({ path: join(SHOTS, `play-${v.id}.jpg`) });
        await page.locator("#reqToggle").click();
        assert(
          await page.evaluate(
            () => !document.getElementById("request").classList.contains("collapsed"),
          ),
          "tapping the header expands the card",
        );
      }
      await ctx.close();
      return `no h-scroll, controls >=44px, HUD ~${(m.cover * 100).toFixed(0)}%, canvas ${m.canvas.join("x")} @${m.dpr}x`;
    });
  }
  await check("AC-12", "rotation mid-play keeps the player in view", async () => {
    const { page, ctx } = await openPage(browser, views[0]);
    await startGame(page);
    await settle(page, 600);
    await page.setViewportSize({ width: 844, height: 390 });
    await sleep(900);
    const r = await dbg(page, () => {
      const d = window.__buddies.debug;
      const p = d.tileToScreen(window.__buddies.player.x - 0.5, window.__buddies.player.y - 1);
      return { p, w: innerWidth, h: innerHeight, canvas: d.stats().canvas };
    });
    assert(
      r.p.x > 0 && r.p.x < r.w && r.p.y > 0 && r.p.y < r.h,
      "player left the view after rotation " + JSON.stringify(r),
    );
    await ctx.close();
    return "player centred after 390x844 -> 844x390";
  });

  // ---- AC-13 performance structure ---------------------------------------------------
  await check(
    "AC-13",
    "chunk cache, dirty-only rebuild, no per-frame lighting, DPR canvas",
    async () => {
      const { page, ctx } = await openPage(browser, { dsf: 2 });
      await startGame(page);
      await settle(page, 1200);
      const s0 = await dbg(page, () => window.__buddies.debug.stats());
      await sleep(1000);
      const s1 = await dbg(page, () => window.__buddies.debug.stats());
      assert(
        s1.chunkBuilds === s0.chunkBuilds &&
          s1.lightRecomputes === s0.lightRecomputes &&
          s1.roomDetects === s0.roomDetects,
        "a still scene must build nothing " + JSON.stringify([s0, s1]),
      );
      await dbg(page, () => {
        const d = window.__buddies.debug;
        const p = window.__buddies.player;
        d.place(Math.floor(p.x), Math.floor(p.y) - 4, d.ids.PLANKS);
      });
      await sleep(500);
      const s2 = await dbg(page, () => window.__buddies.debug.stats());
      const builds = s2.chunkBuilds - s1.chunkBuilds;
      assert(builds >= 1 && builds <= 4, "one edit rebuilds only its chunk(s): " + builds);
      assert(s2.canvas[0] === 2560 && s2.dpr === 2, "canvas is DPR aware " + JSON.stringify(s2));
      // average rendered frames per second over 2s (informational; software rendering is slow)
      const f0 = await dbg(page, () => window.__buddies.frame);
      await sleep(2000);
      const f1 = await dbg(page, () => window.__buddies.frame);
      await ctx.close();
      return `still scene builds 0 chunks / 0 light passes; one edit -> ${builds} chunk(s); canvas ${s2.canvas.join("x")}; ~${Math.round((f1 - f0) / 2)} fps headless @2x`;
    },
  );

  // ---- AC-15 pause on hidden ----------------------------------------------------------
  await check("AC-15", "visibility hidden pauses the simulation, visible resumes", async () => {
    const { page, ctx } = await openPage(browser);
    await startGame(page);
    await settle(page, 300);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await sleep(150);
    assert((await dbg(page, () => window.__buddies.phase)) === "paused", "hidden -> paused");
    const a = await dbg(page, () => ({
      f: window.__buddies.frame,
      t: window.__buddies.time,
      y: window.__buddies.player.y,
    }));
    await sleep(600);
    const b = await dbg(page, () => ({
      f: window.__buddies.frame,
      t: window.__buddies.time,
      y: window.__buddies.player.y,
    }));
    assert(
      a.f === b.f && a.t === b.t && a.y === b.y,
      "simulation must be frozen while hidden " + JSON.stringify([a, b]),
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await sleep(500);
    const c = await dbg(page, () => ({ phase: window.__buddies.phase, f: window.__buddies.frame }));
    assert(c.phase === "playing" && c.f > b.f + 10, "visible -> resumes " + JSON.stringify(c));
    await ctx.close();
    return "paused while hidden (frame/time/position frozen), resumed after";
  });

  // ---- AC-14 clean run -------------------------------------------------------------------------
  await check(
    "AC-14",
    "no console / page errors, no failed requests, nothing fetched",
    async () => {
      const problems = allProblems.flat();
      assert(problems.length === 0, "problems: " + problems.slice(0, 6).join(" | "));
      const bad = allRequests.filter((r) =>
        ["fetch", "xhr", "websocket", "eventsource", "media", "font"].includes(r.type),
      );
      assert(bad.length === 0, "unexpected requests: " + JSON.stringify(bad.slice(0, 5)));
      const hosts = new Set(allRequests.map((r) => new URL(r.url).origin));
      assert(hosts.size === 1, "cross-origin requests: " + [...hosts].join(","));
      const kinds = [...new Set(allRequests.map((r) => r.type))].join(",");
      return `0 problems over ${allRequests.length} same-origin requests (${kinds})`;
    },
  );
} finally {
  await browser.close();
  if (server) server.kill();
}

// ---------------------------------------------------------------------------
//  report
// ---------------------------------------------------------------------------
let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(
    `${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(6)} ${r.name} (${(r.ms / 1000).toFixed(1)}s)\n        ${r.detail}`,
  );
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
