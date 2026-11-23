// probe.mjs — headless acceptance probe for Brick Buddies (PLAY-009). Not part of CI.
//
// Run from the repo root:   node features/brick-buddies/probe.mjs
//   - starts `node tools/serve.mjs 5602` itself when nothing is listening on that port
//   - set PW_CHROMIUM_PATH to use a pre-installed Chromium
//   - screenshots go to a temp folder (or SHOTS_DIR); only `SHOTS=1 node features/brick-buddies/probe.mjs`
//     refreshes the committed features/brick-buddies/screens/ set
//   - prints one PASS / FAIL line per acceptance criterion check and exits 1 on any FAIL
//
// It drives the real input path (keyboard, mouse clicks at tile coordinates, the menus) and uses
// `window.__buddies.debug` only to build fixtures, read state and run the pure room-detection
// function on hand-made grids. See features/brick-buddies/test-plan.md for the AC -> test map.
/* eslint-disable max-lines-per-function -- a probe is a long linear script of checks; splitting it per line adds no clarity */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
// Committed screenshots are only rewritten on request (SHOTS=1); a normal run writes to a temp folder.
const SHOTS =
  process.env.SHOTS === "1"
    ? join(HERE, "screens")
    : process.env.SHOTS_DIR || join(tmpdir(), "brick-buddies-probe-shots");
const HELP_KEY = "playpad.brickBuddies.help.v1"; // "has seen the how-to" (separate from the save)
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
    freshHelp = false, // true = a first-time visitor: the how-to opens on Start (AC-22)
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
  // Every check except AC-22 plays as a returning visitor: the first-run how-to would otherwise sit
  // over the game and swallow the clicks and keys the checks send.
  if (!freshHelp)
    await ctx.addInitScript((k) => {
      try {
        if (!localStorage.getItem(k)) localStorage.setItem(k, "1");
      } catch {
        /* storage blocked: the check handles it itself */
      }
    }, HELP_KEY);
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

/**
 * Knock one roof plank out of the pre-built hut so the world plays like an older save (no first-run
 * hut): the coach falls back to its plain line, the simple first run ends (Items, coins and stars show)
 * and the request card keeps its old open-then-collapse behaviour. The pre-onboarding checks (AC-4,
 * AC-12, AC-17, AC-19) test exactly that state; the real first run is covered by AC-22.
 */
async function wreckHut(page) {
  await page.evaluate(() => {
    const d = window.__buddies.debug;
    const h = d.hut();
    d.place(h.xL + 3, h.g - 4, 0);
  });
}

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
    "touch: joystick walk + jump, tap-preview-then-place, Break mode removes",
    async () => {
      const { page, ctx } = await openPage(browser, {
        viewport: { width: 390, height: 844 },
        touch: true,
        dsf: 2,
      });
      await startGame(page);
      await settle(page, 700);
      const pl = () => page.evaluate(() => window.__buddies.player);
      // the joystick (AC-23.1): a touch pointer on #joy, pushed left / up from its centre
      const jb = await page.locator("#joy").boundingBox();
      const jx = jb.x + jb.width / 2;
      const jy = jb.y + jb.height / 2;
      const ptr = (type, x, y) =>
        page.dispatchEvent("#joy", type, {
          pointerId: 7,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          clientX: x,
          clientY: y,
        });
      const p0 = await pl();
      await ptr("pointerdown", jx, jy);
      await ptr("pointermove", jx - 40, jy);
      await sleep(450);
      await ptr("pointerup", jx - 40, jy);
      const p1 = await pl();
      assert(
        p0.x - p1.x > 1.2,
        "pushing the stick left should walk left, moved " + (p0.x - p1.x).toFixed(2),
      );
      await ptr("pointerdown", jx, jy);
      await ptr("pointermove", jx, jy - 42);
      await sleep(150);
      const pj = await pl();
      await ptr("pointerup", jx, jy - 42);
      assert(
        pj.y < p1.y - 0.3 || !pj.ground,
        "pushing the stick up should leave the ground " + JSON.stringify(pj),
      );
      await sleep(900);
      const p = await pl();
      const tx = Math.floor(p.x);
      const ty = Math.floor(p.y) - 3;
      const s = await page.evaluate(
        ([x, y]) => window.__buddies.debug.tileToScreen(x, y),
        [tx, ty],
      );
      await page.touchscreen.tap(s.x, s.y); // first tap: the preview (nothing built yet)
      await sleep(200);
      assert((await getTile(page, tx, ty)).fg === 0, "the first tap only previews");
      await page.touchscreen.tap(s.x, s.y); // second tap on the preview places
      await sleep(200);
      assert(
        (await getTile(page, tx, ty)).fg === IDS.PLANKS,
        "tapping the preview places the selected block",
      );
      await page.locator("#modeBtn").tap();
      assert(
        (await page.evaluate(() => window.__buddies.mode)) === "break",
        "Mode button switches to Break",
      );
      await page.touchscreen.tap(s.x, s.y);
      await sleep(200);
      assert((await getTile(page, tx, ty)).fg === IDS.PLANKS, "Break mode previews first too");
      await page.touchscreen.tap(s.x, s.y);
      await sleep(200);
      assert(
        (await getTile(page, tx, ty)).fg === 0,
        "tapping the preview in Break mode removes it",
      );
      await ctx.close();
      return "stick walk, stick jump, tap preview + tap place, Break-mode preview + tap";
    },
  );

  // ---- AC-4 place / break rules via the real input path ----
  await check(
    "AC-4",
    "place/break by click, reach, body overlap, floor rule, multi-tile, ghost",
    async () => {
      const { page } = await openPage(browser);
      await wreckHut(page);
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
      await page.keyboard.press("Digit5"); // bed
      assert(
        (await dbg(page, () => window.__buddies.selected)) === "bed",
        "hotbar key 5 selects the bed",
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
      await page.keyboard.press("Digit3"); // door
      await tileClick(page, bx, py - 1);
      assert(
        (await getTile(page, bx, py - 1)).fg === IDS.DOOR_B &&
          (await getTile(page, bx, py - 2)).fg === IDS.DOOR_T,
        "door should be 2 tiles tall",
      );
      await tileClick(page, bx, py - 2, "right");
      assert((await getTile(page, bx, py - 1)).fg === 0, "breaking the top removes the bottom too");
      // ghost validity equals canPlace
      await page.keyboard.press("Digit5");
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
        cl.some((i) => /bed/i.test(i.text) && i.ok === false) && cl[0].ok === true,
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

  // ---- AC-18 (NEW-5) an occupied room that would match names who lives there ----
  await check(
    "AC-18",
    "a matching but occupied room says who already lives there (request 2 = Kitchen)",
    async () => {
      assert(flowOk, "needs the AC-6 world");
      const { page } = flow;
      const where = await dbg(page, () => {
        const d = window.__buddies.debug;
        d.teleport(d.world.houseX + 24.5, d.world.houseY + 16); // the starter kitchen (Barnaby)
        return window.__buddies.request;
      });
      assert(where.type === "Kitchen", "the second request is a kitchen " + JSON.stringify(where));
      await sleep(900);
      const cl = await dbg(page, () => window.__buddies.debug.checklist());
      const note = cl.find((i) => i.info);
      assert(
        note && /^Barnaby already lives here/.test(note.text) && /new spot/.test(note.text),
        "the card names the resident: " + JSON.stringify(cl.map((i) => i.text)),
      );
      return note.text;
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
    const bannerB = await B.page.locator("#stale").textContent();
    assert(
      await B.page.locator("#stale").isVisible(),
      "tab B is told progress moved on: " + bannerB,
    );
    assert(/another tab/i.test(bannerB), "the banner says why: " + bannerB);
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

  await check("AC-12", "C-07 the stick and tray fit a 320px phone", async () => {
    const { page, ctx } = await openPage(browser, {
      viewport: { width: 320, height: 640 },
      touch: true,
      dsf: 2,
    });
    await startGame(page);
    await settle(page, 600);
    const r = await dbg(page, () => {
      const out = {};
      for (const id of ["joy", "modeBtn", "trayBtn"]) {
        const b = document.getElementById(id).getBoundingClientRect();
        out[id] = [Math.round(b.left), Math.round(b.right)];
      }
      return { out, w: innerWidth, sw: document.documentElement.scrollWidth };
    });
    const clipped = Object.entries(r.out).filter(([, [l, rt]]) => l < 0 || rt > r.w);
    assert(clipped.length === 0 && r.sw <= r.w, "controls clipped at 320px: " + JSON.stringify(r));
    await ctx.close();
    return "joystick / mode / tray buttons all inside 320px";
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
      const ringStyle = () =>
        dbg(page, () => getComputedStyle(document.getElementById("view")).outlineStyle);
      assert(
        (await ringStyle()) === "none",
        "playing with the keyboard (WASD) does not frame the canvas (NEW-4)",
      );
      await page.keyboard.press("Tab"); // leave the canvas, then come back by keyboard
      await page.keyboard.press("Shift+Tab");
      assert(
        (await dbg(page, () => document.activeElement.id)) === "view" &&
          (await ringStyle()) !== "none",
        "the canvas shows a focus ring after Tab navigation",
      );
      await page.keyboard.down("KeyA");
      await sleep(80);
      await page.keyboard.up("KeyA");
      assert((await ringStyle()) === "none", "the ring goes away again once play starts");
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
      await page.keyboard.press("Digit8");
      assert((await dbg(page, () => window.__buddies.selected)) === "chair", "8 selects the chair");
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
      return "names, Tab+Enter start, focus ring, A/Space, aim F/X, 8/E/Esc, Space-on-button, reduced-motion rain static";
    },
  );

  // ---- AC-12 responsive + screenshots ---------------------------------------------------
  const views = [
    { id: "phone-portrait", viewport: { width: 390, height: 844 }, touch: true, dsf: 2 },
    { id: "phone-landscape", viewport: { width: 844, height: 390 }, touch: true, dsf: 2 },
    { id: "phone-568x320", viewport: { width: 568, height: 320 }, touch: true, dsf: 2 },
    { id: "desktop", viewport: { width: 1280, height: 800 }, touch: false, dsf: 1 },
  ];
  for (const v of views) {
    await check("AC-12", `layout at ${v.viewport.width}x${v.viewport.height}`, async () => {
      const { page, ctx } = await openPage(browser, v);
      await wreckHut(page);
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
          .filter((e) => {
            // v2: hotbar slots 40px (owner asked for smaller), tray / view buttons and the goal chip 44px, the rest 48px;
            // the colour dot is an 18px picture with a 36px hit area (::after), the swatches are 36px
            const r = e.getBoundingClientRect();
            if (e.id === "swatchDot" || e.classList.contains("swatch")) return false;
            const need = e.classList.contains("slot")
              ? 39.5
              : e.closest(".dock-right") || e.id === "reqToggle"
                ? 43.5
                : 47.5;
            return Math.min(r.width, r.height) < need;
          })
          .map(
            (e) =>
              (e.id || e.className) +
              ":" +
              Math.round(e.getBoundingClientRect().width) +
              "x" +
              Math.round(e.getBoundingClientRect().height),
          );
        const boxes = [".hud-top", "#request", ".tray-bar", "#hotbar", "#joy"]
          .map((s) => [...document.querySelectorAll(s)])
          .flat()
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 0);
        const area = boxes.reduce((a, r) => a + r.width * r.height, 0);
        const tj = document.getElementById("joy").getBoundingClientRect();
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
        "HUD controls under their minimum (slots 40, tray 44, others 48): " + m.small.join(", "),
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
      // objective card: open for a new request (touch screens too), header-only once settled
      const cardOpen = () =>
        page.evaluate(() => !document.getElementById("request").classList.contains("collapsed"));
      if (v.touch) {
        assert(!(await cardOpen()), "on a touch screen the goal starts as a chip (folded)");
        await page.locator("#request .req-head").click();
        assert(await cardOpen(), "tapping the chip opens the goal");
        await page.locator("#request .req-head").click();
        assert(!(await cardOpen()), "tapping it again folds it (and the choice is remembered)");
        await page.evaluate(() => {
          const d = window.__buddies.debug;
          d.teleport(d.spawn.player.x, d.spawn.player.y);
        });
        await sleep(900);
        await page.screenshot({ path: join(SHOTS, `play-${v.id}.jpg`) }); // the settled, header-only look
      } else {
        assert(await cardOpen(), "request card is open at the start on a desktop");
        await sleep(10500);
        assert(
          !(await cardOpen()),
          "request card should collapse to its header after ~10s (request 1)",
        );
        await page.screenshot({ path: join(SHOTS, `play-${v.id}.jpg`) });
        await page.locator("#reqToggle").click();
        assert(await cardOpen(), "tapping the header expands the card");
      }
      await ctx.close();
      return `no h-scroll, controls >=48px, HUD ~${(m.cover * 100).toFixed(0)}%, canvas ${m.canvas.join("x")} @${m.dpr}x`;
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

  // =====================================================================================
  //  Phase-5 round: fidelity set-pieces, first-run UX, HUD layout, QA round 2
  // =====================================================================================
  // ---- AC-20 a lived-in starter house -----------------------------------------------------
  await check(
    "AC-20",
    "every starter room has >= 5 furnishings, >= 8 decor kinds, and every object is supported",
    async () => {
      const { page, ctx } = await openPage(browser);
      await startGame(page);
      const r = await dbg(page, () => {
        const d = window.__buddies.debug;
        const name = {};
        Object.entries(d.ids).forEach(([k, v]) => (name[v] = k));
        const kindOf = (t) => (name[t] || "").replace(/_[LRTB]$/, "");
        const FURN = new Set(
          (
            "BED TABLE CHAIR SHELF FURNACE BENCH CHEST PLANT PLANTER CUPBOARD LOCKER PAINT PAINT2 " +
            "BOARD SIGN TOOLS EMBLEM WINDOW JARS RUG POTS BARRELS CLOCK"
          ).split(" "),
        );
        const DECOR = new Set("TOOLS EMBLEM WINDOW JARS RUG POTS BARRELS CLOCK".split(" "));
        const rooms = d.rooms().filter((q) => q.valid);
        const perRoom = rooms.map((q) => {
          const kinds = new Set();
          for (let y = q.y0; y <= q.y1; y++)
            for (let x = q.x0; x <= q.x1; x++) {
              const k = kindOf(d.getTile(x, y).fg);
              if (FURN.has(k)) kinds.add(k);
            }
          return { at: [q.x0 - d.world.houseX, q.y0 - d.world.houseY], n: kinds.size };
        });
        const decor = new Set();
        const unsupported = [];
        for (let y = 0; y < d.world.h; y++)
          for (let x = 0; x < d.world.w; x++) {
            const t = d.getTile(x, y).fg;
            if (DECOR.has(kindOf(t))) decor.add(kindOf(t));
            if (t && !d.supported(x, y)) unsupported.push([x, y, name[t]]);
          }
        return { perRoom, decor: [...decor], unsupported };
      });
      assert(r.perRoom.length >= 8, "8 starter rooms detected, got " + r.perRoom.length);
      const thin = r.perRoom.filter((q) => q.n < 5);
      assert(thin.length === 0, "rooms with fewer than 5 furnishings: " + JSON.stringify(thin));
      assert(r.decor.length >= 8, "at least 8 decor kinds placed, got " + r.decor.join(","));
      assert(
        r.unsupported.length === 0,
        "starter objects failing supported(): " + JSON.stringify(r.unsupported.slice(0, 6)),
      );
      await ctx.close();
      return `${r.perRoom.length} rooms, fewest furnishings ${Math.min(...r.perRoom.map((q) => q.n))}, decor kinds ${r.decor.length}, 0 unsupported objects`;
    },
  );

  // ---- AC-18 (R3-5) the flat plot is reachable on foot from the spawn, no teleport -------------
  await check(
    "AC-18",
    "walking from the spawn (real keys) through the kitchen and porch doors reaches the flat plot",
    async () => {
      const { page, ctx } = await openPage(browser);
      await startGame(page);
      await settle(page, 600);
      const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
      const start = await dbg(page, () => window.__buddies.player);
      assert(start.x > hx + 14 && start.x < hx + 34, "the player starts inside the tower kitchen");
      await page.keyboard.down("KeyA");
      const t0 = Date.now();
      let p = start;
      while (Date.now() - t0 < 15000) {
        p = await dbg(page, () => window.__buddies.player);
        if (p.x < hx - 8) break;
        await sleep(150);
      }
      await page.keyboard.up("KeyA");
      await sleep(400);
      p = await dbg(page, () => window.__buddies.player);
      // measured on the plot beside the pre-built hut (the hut's own roof would answer for its columns)
      const g = await dbg(page, (x) => window.__buddies.debug.groundRow(x), hx - 16);
      assert(
        p.x < hx - 6 && p.x > hx - 16 && p.ground && Math.abs(p.y - g) < 0.05,
        "stood on the flat plot after walking: " + JSON.stringify({ x: p.x - hx, y: p.y, g }),
      );
      await ctx.close();
      return `walked ${(start.x - p.x).toFixed(1)} tiles left in ${((Date.now() - t0) / 1000).toFixed(1)} s and stands on the plot`;
    },
  );

  // ---- AC-18 / AC-22.4 first-run path: the pre-built hut needs three placements --------------------
  await check(
    "AC-22",
    "AC-22.4 the pre-built hut: a bed, a torch and a door (real placement rules) house the first buddy",
    async () => {
      const { page, ctx } = await openPage(browser);
      await startGame(page);
      await settle(page, 600);
      const tip = await page.locator("#reqHint").textContent();
      assert(
        /hut/.test(tip) &&
          /left of the house/.test(tip) &&
          /Bed/.test(tip) &&
          /Torch/.test(tip) &&
          /Door/.test(tip),
        "the tip names the hut and its three jobs: " + tip,
      );
      const hut = await dbg(page, () => window.__buddies.debug.hut());
      assert(hut.intact, "the hut shell is standing in a fresh world");
      const shell = await dbg(
        page,
        (h) => {
          const d = window.__buddies.debug;
          const pl = d.ids.PLANKS;
          const roof = [];
          for (let x = h.xL; x <= h.xR; x++) roof.push(d.getTile(x, h.g - 4).fg === pl);
          const back = [];
          for (let y = h.g - 3; y <= h.g - 1; y++)
            for (let x = h.xL + 1; x <= h.xR - 1; x++)
              back.push(d.getTile(x, y).bg === d.bgIds.PLANKS);
          return {
            roof: roof.every(Boolean),
            back: back.every(Boolean) && back.length === 18,
            left: [1, 2, 3].every((n) => d.getTile(h.xL, h.g - n).fg === pl),
            lintel: d.getTile(h.xR, h.g - 3).fg === pl,
            // open air (a grass tuft may stand in the gap; the door replaces it)
            doorway: [h.g - 1, h.g - 2].every((y) =>
              [0, d.ids.TUFT].includes(d.getTile(h.xR, y).fg),
            ),
          };
        },
        hut,
      );
      assert(
        shell.roof && shell.back && shell.left && shell.lintel && shell.doorway,
        "hut shell: " + JSON.stringify(shell),
      );
      const coins0 = await dbg(page, () => window.__buddies.coins);
      await page.waitForFunction(() => window.__buddies.request.state === "waiting", null, {
        timeout: 30000,
        polling: 100,
      });
      const failed = await dbg(
        page,
        (h) => {
          const d = window.__buddies.debug;
          d.teleport(h.xL + 3.5, h.g); // inside the hut: everything is within reach
          const bad = [];
          for (const [key, x, y] of [
            ["bed", h.xL + 2, h.g - 1],
            ["torch", h.xL + 5, h.g - 2],
            ["door", h.xR, h.g - 1],
          ]) {
            const r = d.tryPlace(key, x, y);
            if (!r.ok) bad.push([key, x, y, r.reason]);
          }
          return bad;
        },
        hut,
      );
      assert(failed.length === 0, "the three jobs were refused: " + JSON.stringify(failed));
      await dbg(page, () => {
        const d = window.__buddies.debug;
        d.teleport(d.spawn.player.x, d.spawn.player.y);
      });
      await page.waitForFunction(() => window.__buddies.housed === 1, null, {
        timeout: 45000,
        polling: 100,
      });
      const coins1 = await dbg(page, () => window.__buddies.coins);
      assert(coins1 === coins0 + 40, "the reward is paid: " + coins0 + " -> " + coins1);
      await ctx.close();
      return "3 placements through tryPlace, Pip housed, +40 coins (hut shell: roof, walls, 6x3 back wall, open doorway)";
    },
  );

  // ---- AC-18 the full hut recipe still works anywhere (older saves have no pre-built hut) ---------
  await check(
    "AC-18",
    "the full recipe (walls, roof, back wall, door, torch, bed) still houses a buddy on bare ground",
    async () => {
      const { page, ctx } = await openPage(browser);
      await startGame(page);
      await settle(page, 600);
      const hx = await dbg(page, () => window.__buddies.debug.world.houseX);
      const g = await flatten(page, hx - 34, hx - 24); // bare ground west of the pre-built hut
      const xL = hx - 33;
      const xR = hx - 26;
      const coins0 = await dbg(page, () => window.__buddies.coins);
      await page.waitForFunction(() => window.__buddies.request.state === "waiting", null, {
        timeout: 30000,
        polling: 100,
      });
      const plan = [];
      for (let x = xL; x <= xR; x++) plan.push(["planks", x, g - 4]); // roof
      for (let y = g - 3; y <= g - 1; y++) plan.push(["planks", xL, y]); // left wall
      plan.push(["planks", xR, g - 3]); // right wall above the door
      for (let y = g - 3; y <= g - 1; y++)
        for (let x = xL + 1; x <= xR - 1; x++) plan.push(["wallPlanks", x, y]); // 6 x 3 back wall
      plan.push(["door", xR, g - 1], ["torch", xL + 3, g - 2], ["bed", xL + 2, g - 1]);
      const failed = await dbg(
        page,
        ([steps, px, py]) => {
          const d = window.__buddies.debug;
          const bad = [];
          for (const [key, x, y] of steps) {
            d.teleport(px, py); // stand inside the hut: everything is within reach
            const r = d.tryPlace(key, x, y);
            if (!r.ok) bad.push([key, x, y, r.reason]);
          }
          return bad;
        },
        [plan, xL + 3.5, g],
      );
      assert(failed.length === 0, "recipe steps refused: " + JSON.stringify(failed.slice(0, 4)));
      await dbg(page, () => {
        const d = window.__buddies.debug;
        d.teleport(d.spawn.player.x, d.spawn.player.y);
      });
      await page.waitForFunction(() => window.__buddies.housed === 1, null, {
        timeout: 45000,
        polling: 100,
      });
      const coins1 = await dbg(page, () => window.__buddies.coins);
      assert(coins1 === coins0 + 40, "the reward is paid: " + coins0 + " -> " + coins1);
      await ctx.close();
      return `${plan.length} placements through tryPlace, Pip housed, +40 coins`;
    },
  );

  // ---- AC-18 occupied room note + room labels ------------------------------------------------
  await check(
    "AC-18",
    "labels name the resident or say 'full'; an occupied matching room is explained",
    async () => {
      const { page, ctx } = await openPage(browser);
      await startGame(page);
      await settle(page, 500);
      const labels = await dbg(page, () => window.__buddies.debug.roomLabels().map((l) => l.label));
      assert(
        labels.includes("Kitchen · Barnaby") && labels.includes("Workshop · Moss"),
        "named residents: " + labels.join(" | "),
      );
      assert(
        labels.some((l) => /· full$/.test(l)),
        "a claimed room without a named resident reads '· full': " + labels.join(" | "),
      );
      // request 1 is a Bedroom: the starter basement bedroom matches but is already claimed
      await dbg(page, () => {
        const d = window.__buddies.debug;
        d.teleport(d.world.houseX + 5.5, d.world.houseY + 22);
      });
      await sleep(800);
      const cl = await dbg(page, () => window.__buddies.debug.checklist());
      assert(
        cl[0].info && /already someone's home/.test(cl[0].text),
        "the card explains the occupied match: " + JSON.stringify(cl.map((i) => i.text)),
      );
      // the kitchen does not match a bedroom request: no note, just the plain rows
      await dbg(page, () => {
        const d = window.__buddies.debug;
        d.teleport(d.world.houseX + 24.5, d.world.houseY + 16);
      });
      await sleep(800);
      const cl2 = await dbg(page, () => window.__buddies.debug.checklist());
      assert(!cl2.some((i) => i.info), "no note in a room that would not match anyway");
      await ctx.close();
      return `${labels.length} labels (${labels.slice(0, 3).join(", ")}...), occupied-match note shown`;
    },
  );

  // ---- AC-17 reading load (Priya & kid) -------------------------------------------------------
  await check(
    "AC-17",
    "icons + short rows, named blockers, device-aware hints, unlock keeps the slot, two-tap leave",
    async () => {
      const { page, ctx } = await openPage(browser);
      const hint = await dbg(page, () => {
        const shown = (s) => document.querySelector(s).getBoundingClientRect().width > 0;
        return {
          kb: shown("#title .keys-kb"),
          touch: shown("#title .keys-touch"),
          text: document.querySelector("#title .keys-kb").textContent.replace(/\s+/g, " "),
        };
      });
      assert(
        hint.kb && !hint.touch,
        "desktop title shows the keyboard hint " + JSON.stringify(hint),
      );
      assert(
        /A D walk/.test(hint.text) &&
          /F or click to place/.test(hint.text) &&
          hint.text.trim().length <= 48,
        "the keyboard hint is one very short line (the how-to and the coach teach the rest): " +
          hint.text,
      );
      await wreckHut(page);
      await startGame(page);
      await settle(page, 600);
      const rows = await dbg(page, () =>
        [...document.querySelectorAll("#reqList li")].map((li) => {
          const c = li.querySelector("canvas.ric");
          let ink = 0;
          if (c) {
            const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
            for (let i = 3; i < px.length; i += 4) ink += px[i] > 0 ? 1 : 0;
          }
          return { text: li.lastElementChild.textContent, ink };
        }),
      );
      assert(rows.length >= 6, "request rows: " + rows.length);
      const bare = (t) => t.replace(/^(Done|Still to do): /, "");
      // v2 wording names the action and the block, so rows may run to 64 characters (was 36)
      const long = rows.filter((q) => bare(q.text).length > 64);
      assert(long.length === 0, "rows over 64 characters: " + JSON.stringify(long));
      const blank = rows.filter((q) => q.ink < 40);
      assert(blank.length === 0, "rows without an icon: " + JSON.stringify(blank));
      // refusal reasons name the blocker
      await page.waitForFunction(() => window.__buddies.request.state === "waiting", null, {
        timeout: 30000,
        polling: 100,
      });
      const why = await dbg(page, () => {
        const d = window.__buddies.debug;
        const hx = d.world.houseX;
        const hy = d.world.houseY;
        const out = {};
        d.teleport(hx + 16.5, hy + 16);
        out.door = d.canPlace("planks", hx + 14, hy + 15).reason;
        out.furniture = d.canPlace("planks", hx + 17, hy + 15).reason;
        out.block = d.canPlace("planks", hx + 14, hy + 12).reason;
        const p = window.__buddies.player;
        out.you = d.canPlace("planks", Math.floor(p.x), Math.floor(p.y - 0.5)).reason;
        const b = d.visitor(); // Pip waits on open grass: an empty tile, so only he is in the way
        d.teleport(b.x - 1.4, b.y);
        out.buddy = d.canPlace("planks", Math.floor(b.x), Math.floor(b.y - 0.5)).reason;
        return out;
      });
      assert(/door/i.test(why.door), "door: " + why.door);
      assert(/furniture/i.test(why.furniture), "furniture: " + why.furniture);
      assert(/block/i.test(why.block), "block: " + why.block);
      assert(/^You are standing there/.test(why.you), "you: " + why.you);
      assert(/^Pip is standing there/.test(why.buddy), "buddy: " + why.buddy);
      // unlocking never overwrites the selected slot: it takes the first empty one
      await dbg(page, () => window.__buddies.debug.giveCoins(500));
      const hb0 = await dbg(page, () => window.__buddies.hotbar);
      assert(
        JSON.stringify(hb0) ===
          JSON.stringify([
            "planks",
            "wallPlanks",
            "door",
            "torch",
            "bed",
            "ladder",
            "table",
            "chair",
            null,
            null,
          ]),
        "the bar starts in recipe order with the last two slots empty: " + JSON.stringify(hb0),
      );
      await page.keyboard.press("Digit1");
      await page.getByRole("button", { name: "Items, open build menu" }).click();
      await page.getByRole("button", { name: "Furniture" }).click();
      await page.getByRole("button", { name: /^Furnace, locked/ }).click();
      const hb1 = await dbg(page, () => window.__buddies.hotbar);
      assert(
        hb1[0] === "planks" && hb1[8] === "furnace" && hb1[3] === "torch" && hb1.length === 10,
        "unlocked Furnace went to the first empty slot: " + JSON.stringify(hb1),
      );
      await page.keyboard.press("Digit0"); // the last (empty) slot
      await page.getByRole("button", { name: "Structure" }).click();
      await page.getByRole("button", { name: "Cobble", exact: true }).click();
      const full = await dbg(page, () => window.__buddies.hotbar);
      assert(
        full.every((k) => k),
        "the bar is now full: " + JSON.stringify(full),
      );
      const coinsBefore = await dbg(page, () => window.__buddies.coins);
      await page.getByRole("button", { name: "Furniture" }).click();
      await page.getByRole("button", { name: /^Bookshelf, locked/ }).click();
      const after = await dbg(page, () => ({
        hb: window.__buddies.hotbar,
        sel: window.__buddies.selected,
        coins: window.__buddies.coins,
        toast: document.getElementById("toast").textContent,
      }));
      assert(
        JSON.stringify(after.hb) === JSON.stringify(full) && after.sel === "stone",
        "a full bar is left alone: " + JSON.stringify(after),
      );
      assert(after.coins === coinsBefore - 40, "the unlock was still paid");
      assert(/Select a slot/.test(after.toast), "the player is told what to do: " + after.toast);
      // desktop: one click on the back chip leaves
      await page.route("**/index.html", (route) =>
        route.request().url().includes("/games/")
          ? route.continue()
          : route.fulfill({ contentType: "text/html", body: "<title>hub</title>" }),
      );
      await page.keyboard.press("Escape");
      await page.locator(".hud-top .back-link-chip").click();
      await page.waitForURL((u) => u.pathname === "/index.html");
      await ctx.close();
      // touch: the title shows the touch hint; the back chip needs a second tap
      const t = await openPage(browser, {
        viewport: { width: 844, height: 390 },
        touch: true,
        dsf: 2,
      });
      // R3-4: a short landscape phone keeps ONE visible line of touch help, above the fold
      for (const [w, h] of [
        [844, 390],
        [568, 320],
      ]) {
        await t.page.setViewportSize({ width: w, height: h });
        await sleep(300);
        const line = await dbg(t.page, () => {
          const k = document.querySelector("#title .keys-touch").getBoundingClientRect();
          const kb = document.querySelector("#title .keys-kb").getBoundingClientRect();
          const start = document.getElementById("startBtn").getBoundingClientRect();
          return {
            top: k.top,
            bottom: k.bottom,
            h: k.height,
            w: k.width,
            kb: kb.width,
            vh: innerHeight,
            startBottom: start.bottom,
          };
        });
        assert(
          line.w > 0 && line.kb === 0 && line.h <= 24 && line.top >= 0 && line.bottom <= line.vh,
          `one visible touch hint line at ${w}x${h}: ` + JSON.stringify(line),
        );
        assert(line.startBottom <= line.vh, `Start stays visible at ${w}x${h}`);
      }
      const th = { kb: false };
      await t.ctx.close();
      const tall = await openPage(browser, {
        viewport: { width: 390, height: 844 },
        touch: true,
        dsf: 2,
      });
      const thT = await dbg(tall.page, () => ({
        kb: document.querySelector("#title .keys-kb").getBoundingClientRect().width > 0,
        touch: document.querySelector("#title .keys-touch").getBoundingClientRect().width > 0,
      }));
      assert(
        !thT.kb && thT.touch && !th.kb,
        "touch devices see the touch hint, not the keyboard one " + JSON.stringify([th, thT]),
      );
      await tall.page.route("**/index.html", (route) =>
        route.request().url().includes("/games/")
          ? route.continue()
          : route.fulfill({ contentType: "text/html", body: "<title>hub</title>" }),
      );
      await startGame(tall.page);
      await settle(tall.page, 500);
      const chip = tall.page.locator(".hud-top .back-link-chip");
      const box = await chip.boundingBox();
      await tall.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(250);
      const armed = await dbg(tall.page, () => ({
        cls: document.querySelector(".hud-top .back-link-chip").className,
        txt: document.querySelector(".hud-top .back-link-chip .txt").textContent,
        path: location.pathname,
        vis: document.querySelector(".hud-top .back-link-chip .txt").getBoundingClientRect().width,
      }));
      assert(
        /armed/.test(armed.cls) &&
          armed.txt === "Leave?" &&
          armed.vis > 0 &&
          /\/games\//.test(armed.path),
        "first tap arms the chip and stays in the game: " + JSON.stringify(armed),
      );
      await sleep(3300);
      assert(
        !(await dbg(tall.page, () =>
          document.querySelector(".hud-top .back-link-chip").classList.contains("armed"),
        )),
        "the armed state times out after ~3 s",
      );
      await tall.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(200);
      await tall.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await tall.page.waitForURL((u) => u.pathname === "/index.html");
      await tall.ctx.close();
      return `${rows.length} icon rows <= 64 chars, blockers named, unlock keeps slot (${hb1.join(",")}), two-tap leave on touch`;
    },
  );

  // ---- AC-19 floating UI never overlaps (P-3 / P-4 / R3-2 / R3-3 / R3-6) -------------------------
  const HUD_BOXES = `() => {
    const sel = [
      [".hud-top .chip, .hud-top .chip-btn", "chip"],
      ["#request", "card"],
      ["#joy", "pad"],
      ["#toast.show", "toast"],
      ["#hotbar", "hotbar"],
      [".mode-btn", "mode"],
      [".tbtn", "pad"],
      ["#build", "sheet"],
    ];
    const boxes = [];
    sel.forEach(([q, kind]) =>
      document.querySelectorAll(q).forEach((e) => {
        const r = e.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden")
          boxes.push({ kind, id: e.id || e.getAttribute("aria-label") || e.className, r });
      }),
    );
    // the open build sheet covers the dock by design; everything else must stay apart
    const covered = (a, b) =>
      (a.kind === "sheet" && ["hotbar", "mode", "pad"].includes(b.kind)) ||
      (b.kind === "sheet" && ["hotbar", "mode", "pad"].includes(a.kind));
    const hits = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r;
        const b = boxes[j].r;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1 && !covered(boxes[i], boxes[j])) hits.push(boxes[i].id + " x " + boxes[j].id);
      }
    // the goal card sits on the right: it must clear the right-hand controls (the stick is on the left)
    const dock = Math.min(
      ...boxes.filter((b) => ["hotbar", "mode"].includes(b.kind)).map((b) => b.r.top),
      innerHeight,
    );
    const card = document.getElementById("request");
    const cardBox = boxes.find((b) => b.kind === "card");
    const toast = boxes.find((b) => b.kind === "toast");
    return {
      hits,
      dock,
      cardBottom: cardBox && cardBox.r.bottom,
      cardOpen: !card.classList.contains("collapsed"),
      cardMore: card.classList.contains("more"),
      overflow: card.scrollHeight - card.clientHeight > 4,
      toast: toast && { l: toast.r.left, r: toast.r.right, b: toast.r.bottom },
      vw: innerWidth,
      n: boxes.length,
    };
  }`;
  for (const v of [
    { id: "390x844", viewport: { width: 390, height: 844 } },
    { id: "844x390", viewport: { width: 844, height: 390 } },
    { id: "568x320", viewport: { width: 568, height: 320 } },
  ]) {
    await check(
      "AC-19",
      `HUD pieces do not overlap at ${v.id} (card open, then build sheet open)`,
      async () => {
        const { page, ctx } = await openPage(browser, {
          viewport: v.viewport,
          touch: true,
          dsf: 2,
        });
        await wreckHut(page);
        await startGame(page);
        await settle(page, 900);
        await page.keyboard.press("Digit9"); // an empty slot: placing with it gives a real toast
        await page.keyboard.press("KeyF");
        await page.locator("#request .req-head").click(); // the goal starts as a chip: open it for the worst case
        await sleep(250);
        const m = await page.evaluate(`(${HUD_BOXES})()`);
        assert(m.cardOpen, "the objective card can be opened from its chip");
        assert(m.toast, "a toast is showing for the check");
        assert(m.hits.length === 0, "overlapping HUD pieces: " + m.hits.join("; "));
        assert(
          m.cardBottom <= m.dock + 0.5,
          `the card reaches the dock: card bottom ${m.cardBottom} > dock ${m.dock}`,
        );
        assert(
          m.toast.b <= m.dock + 0.5 && m.toast.l >= 0 && m.toast.r <= m.vw,
          "the toast sits above the dock and inside the screen " + JSON.stringify(m.toast),
        );
        await page.screenshot({ path: join(SHOTS, `hud-${v.id}.jpg`) });
        // R3-6: a card that scrolls shows a cue until it is scrolled to the end
        assert(
          m.cardMore === m.overflow,
          `the scroll cue matches the overflow (cue ${m.cardMore}, overflow ${m.overflow})`,
        );
        if (m.overflow) {
          await page.evaluate(() => {
            const c = document.getElementById("request");
            c.scrollTop = c.scrollHeight;
          });
          await sleep(150);
          assert(
            !(await page.evaluate(() =>
              document.getElementById("request").classList.contains("more"),
            )),
            "the cue goes away at the end of the card",
          );
        }
        // R3-3: with the build sheet open the card steps aside and nothing overlaps
        await page.getByRole("button", { name: /block tray/ }).click(); // Items lives in the tray
        await page.getByRole("button", { name: /Items, open build menu/ }).click();
        await sleep(500);
        await page.keyboard.press("KeyF"); // a fresh toast while the sheet is open
        await sleep(250);
        const sh = await page.evaluate(`(${HUD_BOXES})()`);
        assert(!sh.cardOpen, "the card is collapsed while the build sheet is open");
        assert(sh.hits.length === 0, "overlaps with the build sheet open: " + sh.hits.join("; "));
        assert(sh.toast && sh.toast.l >= 0 && sh.toast.r <= sh.vw, "the toast stays on screen");
        await ctx.close();
        return `${m.n} boxes, 0 overlaps (also with the sheet open), card ends ${Math.round(m.cardBottom)} / dock ${Math.round(m.dock)}, cue ${m.cardMore}`;
      },
    );
  }

  // ---- AC-22 onboarding: the how-to, the ? button, the coach, the simple first run -------------
  const hudVisible = (page, sel) =>
    page.evaluate((q) => {
      const e = document.querySelector(q);
      return !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0;
    }, sel);
  await check(
    "AC-22",
    "AC-22.1/2 first-run how-to: opens on Start, has the floor, closes three ways, is remembered",
    async () => {
      const { page, ctx } = await openPage(browser, { freshHelp: true });
      await page.getByRole("button", { name: /How to play/ }).click(); // from the title too
      assert(await page.evaluate(() => window.__buddies.debug.helpOpen()), "title button opens it");
      await page.getByRole("button", { name: "Close how to play" }).click();
      assert(!(await page.evaluate(() => window.__buddies.debug.helpOpen())), "X closes it");
      // that counted as seen: start a second, truly fresh page for the Start path
      const fresh = await openPage(browser, { freshHelp: true });
      const fp = fresh.page;
      await startGame(fp);
      const open = await dbg(fp, () => ({
        isOpen: window.__buddies.debug.helpOpen(),
        role: document.getElementById("how").getAttribute("role"),
        label: document.getElementById("how").getAttribute("aria-label"),
        modal: document.getElementById("how").getAttribute("aria-modal"),
        focus: document.activeElement && document.activeElement.id,
        phase: window.__buddies.phase,
        steps: [...document.querySelectorAll("#how .how-step")].map((li) => ({
          text: li.querySelector("p").innerText.replace(/\s+/g, " ").trim(),
          pics: li.querySelectorAll(".how-pic canvas, .how-pic .how-sym").length,
        })),
        topAtCentre: (() => {
          const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
          return !!(e && e.closest("#how"));
        })(),
      }));
      assert(
        open.isOpen && open.role === "dialog" && open.label === "How to play",
        "dialog " + JSON.stringify(open),
      );
      assert(
        open.modal === "true" && open.focus === "howGo",
        "modal, Let's go focused: " + open.focus,
      );
      assert(
        open.phase === "playing",
        "phase stays playing (smoke + hub wait for it): " + open.phase,
      );
      assert(open.steps.length >= 1 && open.steps.length <= 4, open.steps.length + " steps");
      assert(
        open.steps.every((st) => st.pics >= 2 && st.text.length <= 40),
        "each step is pictures + at most 40 characters: " + JSON.stringify(open.steps),
      );
      assert(open.topAtCentre, "the card covers the game (taps cannot reach the canvas)");
      // keys do not reach the game
      const before = await dbg(fp, () => ({
        x: window.__buddies.player.x,
        sel: window.__buddies.selected,
      }));
      await fp.keyboard.down("KeyD");
      await fp.keyboard.press("Digit2");
      await sleep(400);
      await fp.keyboard.up("KeyD");
      const after = await dbg(fp, () => ({
        x: window.__buddies.player.x,
        sel: window.__buddies.selected,
      }));
      assert(
        before.x === after.x && before.sel === after.sel,
        "keys moved or edited the game behind the how-to " + JSON.stringify([before, after]),
      );
      // Esc closes it (and does not open the pause menu)
      await fp.keyboard.press("Escape");
      const afterEsc = await dbg(fp, () => ({
        open: window.__buddies.debug.helpOpen(),
        phase: window.__buddies.phase,
      }));
      assert(
        !afterEsc.open && afterEsc.phase === "playing",
        "Esc closes only the how-to " + JSON.stringify(afterEsc),
      );
      assert(
        (await fp.evaluate((k) => localStorage.getItem(k), HELP_KEY)) === "1",
        "dismissing stores the seen flag in its own key",
      );
      const saveKey = await dbg(fp, () => window.__buddies.debug.saveKey);
      assert(saveKey === "playpad.brickBuddies.v1", "the save key is unchanged: " + saveKey);
      // Let's go closes it too (re-open with ?)
      await fp.getByRole("button", { name: "How to play", exact: true }).click();
      assert(await dbg(fp, () => window.__buddies.debug.helpOpen()), "? re-opens it");
      await fp.getByRole("button", { name: "Let’s go!" }).click();
      assert(!(await dbg(fp, () => window.__buddies.debug.helpOpen())), "Let's go closes it");
      // remembered across a reload and across New world
      await fp.reload();
      await fp.waitForFunction(() => !!window.__buddies);
      await startGame(fp);
      assert(
        !(await dbg(fp, () => window.__buddies.debug.helpOpen())),
        "not shown again after a reload",
      );
      await fp.locator("#menuBtn").click();
      await fp.getByRole("button", { name: /New world/ }).click();
      await fp.getByRole("button", { name: "Yes, start fresh" }).click();
      await sleep(300);
      assert(
        !(await dbg(fp, () => window.__buddies.debug.helpOpen())),
        "New world does not reset it",
      );
      await fresh.ctx.close();
      await ctx.close();
      return "title + X, Start opens it (4 steps, pictures, <= 40 chars), Esc / Let's go / X close, flag in its own key, survives reload + New world";
    },
  );

  await check(
    "AC-22",
    "AC-22.2 blocked storage: the how-to still shows once and raises no error",
    async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await context.addInitScript(() => {
        Storage.prototype.getItem = () => {
          throw new Error("blocked");
        };
        Storage.prototype.setItem = () => {
          throw new Error("blocked");
        };
      });
      const { page, ctx, problems } = await openPage(browser, { context, freshHelp: true });
      await startGame(page);
      assert(await dbg(page, () => window.__buddies.debug.helpOpen()), "it opens with no storage");
      await page.getByRole("button", { name: "Let’s go!" }).click();
      assert(!(await dbg(page, () => window.__buddies.debug.helpOpen())), "and closes");
      assert(problems.length === 0, "errors with storage blocked: " + problems.join(" | "));
      await ctx.close();
      return "opens, closes, no console / page errors with localStorage throwing";
    },
  );

  for (const v of [
    { id: "390x844", viewport: { width: 390, height: 844 }, touch: true },
    { id: "844x390", viewport: { width: 844, height: 390 }, touch: true },
    { id: "568x320", viewport: { width: 568, height: 320 }, touch: true },
    { id: "1280x800", viewport: { width: 1280, height: 800 }, touch: false },
  ]) {
    await check(
      "AC-22",
      `AC-22.3/9 at ${v.id}: ? is 48px+ and on screen; the first-run HUD (coach line, strip, card open or shut) never overlaps`,
      async () => {
        const { page, ctx } = await openPage(browser, {
          viewport: v.viewport,
          touch: v.touch,
          dsf: 2,
        });
        await startGame(page);
        await settle(page, 900);
        const q = await dbg(page, () => {
          const r = document.getElementById("helpBtn").getBoundingClientRect();
          return { w: r.width, h: r.height, right: r.right, left: r.left, vw: innerWidth };
        });
        assert(
          q.w >= 48 && q.h >= 48 && q.left >= 0 && q.right <= q.vw,
          "? button box " + JSON.stringify(q),
        );
        const coach = await dbg(page, () => {
          const c = document.getElementById("coach").getBoundingClientRect();
          const k = document.getElementById("request").getBoundingClientRect();
          return {
            shown: c.width > 0,
            inside: c.top >= k.top - 1 && c.bottom <= k.bottom + 1,
            collapsed: document.getElementById("request").classList.contains("collapsed"),
            ticks: document.querySelectorAll("#coachStrip .cs").length,
          };
        });
        assert(
          coach.shown && coach.inside && coach.ticks === 3,
          "coach line visible " + JSON.stringify(coach),
        );
        assert(coach.collapsed, "the card starts as a header + the coach (no checklist wall)");
        const shut = await page.evaluate(`(${HUD_BOXES})()`);
        assert(shut.hits.length === 0, "overlaps with the card shut: " + shut.hits.join("; "));
        assert(
          shut.cardBottom <= shut.dock + 0.5,
          `card ${shut.cardBottom} reaches the dock ${shut.dock}`,
        );
        await page.screenshot({ path: join(SHOTS, `onboarding-coach-${v.id}.jpg`) });
        await page.locator("#reqToggle").click(); // the worst case: the whole checklist + tip open under the coach (the chip is the toggle)
        await sleep(300);
        const wide = await page.evaluate(`(${HUD_BOXES})()`);
        assert(wide.cardOpen, "the toggle opens the checklist");
        assert(wide.hits.length === 0, "overlaps with the card open: " + wide.hits.join("; "));
        assert(
          wide.cardBottom <= wide.dock + 0.5,
          `open card ${wide.cardBottom} reaches the dock ${wide.dock}`,
        );
        await page.screenshot({ path: join(SHOTS, `onboarding-card-open-${v.id}.jpg`) });
        // the how-to itself fits the screen (nothing cut off, Let's go reachable)
        await page.locator("#helpBtn").click();
        const how = await dbg(page, () => {
          const c = document.querySelector("#how .card").getBoundingClientRect();
          const b = document.getElementById("howGo").getBoundingClientRect();
          return {
            top: c.top,
            bottom: c.bottom,
            h: innerHeight,
            goBottom: b.bottom,
            goH: b.height,
            sw: document.documentElement.scrollWidth,
            iw: innerWidth,
          };
        });
        assert(
          how.top >= 0 &&
            how.bottom <= how.h &&
            how.goBottom <= how.h &&
            how.goH >= 48 &&
            how.sw <= how.iw,
          "the how-to card fits the screen " + JSON.stringify(how),
        );
        await page.screenshot({ path: join(SHOTS, `onboarding-help-${v.id}.jpg`) });
        await ctx.close();
        return `? ${Math.round(q.w)}x${Math.round(q.h)}, coach inside the card, ${shut.n} boxes 0 overlaps (card shut + open), how-to fits`;
      },
    );
  }

  await check(
    "AC-22",
    "AC-22.5-8 the coach walks a child through the first room with real input, then the HUD opens up",
    async () => {
      const { page, ctx } = await openPage(browser);
      await startGame(page);
      await settle(page, 600);
      const coach = () => dbg(page, () => window.__buddies.debug.coach());
      const said = [];
      const expectCoach = async (kind, text, label, waitMs = 4000) => {
        let c = null;
        for (let i = 0; i < waitMs / 100; i++) {
          c = await coach();
          if (c && c.kind === kind && (!text || c.text === text)) break;
          await sleep(100);
        }
        assert(
          c && c.kind === kind && (!text || c.text === text),
          `${label}: wanted ${kind} "${text}", got ${JSON.stringify(c)}`,
        );
        assert(c.text.length <= 28, `coach text is short: "${c.text}"`);
        said.push(c.text);
        return c;
      };
      // simple first run: only what the first request needs
      for (const [sel, name] of [
        ["#buildBtn", "Items"],
        ["#tLook", "Look"],
        [".hud-top .adv", "coin / star chip"],
      ])
        assert(!(await hudVisible(page, sel)), name + " is hidden during the first request");
      assert(
        (await hudVisible(page, "#modeBtn")) && (await hudVisible(page, "#housedN")),
        "Build / Break and the housed count stay",
      );

      // 1. walk to the hut (a label on the edge, the hut's tiles known to the coach)
      const walk = await expectCoach("walk", "Walk to the hut (A D)", "start");
      assert(
        walk.hut && walk.tiles && walk.tiles.length >= 1,
        "the walk step knows the hut " + JSON.stringify(walk),
      );
      const hut = await dbg(page, () => window.__buddies.debug.hut());
      await dbg(page, (h) => window.__buddies.debug.teleport(h.xL + 4.5, h.g), hut);
      await settle(page, 900);

      // 2. Break mode is noticed and the Build button rung
      await page.keyboard.press("KeyB");
      const mode = await expectCoach("mode", "Switch to Build", "break mode");
      assert(/mode-btn|modeBtn/.test(mode.pulse), "the mode button is ringed: " + mode.pulse);
      await page.keyboard.press("KeyB");

      // 3. bed, torch, door: pick (slot ringed), then tap the glow (second tile of the footprint)
      const jobs = [
        ["bed", "Pick the bed (5)", 4, [hut.xL + 2, hut.g - 1], "BED_L", "Press F on the glow"],
        [
          "torch",
          "Pick the torch (4)",
          3,
          [hut.xL + 5, hut.g - 2],
          "TORCH",
          "Click the glowing spot",
        ],
        ["door", "Pick the door (3)", 2, [hut.xR, hut.g - 1], "DOOR_B", "Click the glowing spot"],
      ];
      for (const [key, pickText, slot, anchor, tileName, tapText] of jobs) {
        const pick = await expectCoach("pick", pickText, key + " pick");
        assert(/coach-pulse/.test(pick.pulse), key + " slot is ringed: " + pick.pulse);
        const ringed = await dbg(
          page,
          (i) => document.querySelectorAll("#hotbar .slot")[i].classList.contains("coach-pulse"),
          slot,
        );
        assert(ringed, `slot ${slot + 1} carries the pulse ring for the ${key}`);
        if (key === "door") {
          // standing in the doorway: step aside (arrow), not a refusal
          await dbg(page, (h) => window.__buddies.debug.teleport(h.xR + 0.5, h.g), hut);
        }
        await page.locator("#hotbar .slot").nth(slot).click();
        if (key === "door") {
          const step = await expectCoach("step", "Step aside", "door, standing in the way");
          assert(step.tiles.length === 2, "the doorway glows on both tiles");
          await dbg(page, (h) => window.__buddies.debug.teleport(h.xL + 4.5, h.g), hut);
        }
        const tap = await expectCoach("tap", tapText, key + " tap");
        assert(tap.tiles.length >= 1, "the glow has tiles");
        await settle(page, 900);
        // tap the LAST tile of the footprint: a bed's right half / a door's lower half still places it
        const t = tap.tiles[tap.tiles.length - 1];
        await tileClick(page, t[0], t[1]);
        await sleep(200);
        const placed = await dbg(
          page,
          ([x, y, name]) =>
            window.__buddies.debug.getTile(x, y).fg === window.__buddies.debug.ids[name],
          [anchor[0], anchor[1], tileName],
        );
        assert(placed, `the ${key} landed on its planned spot ${anchor}`);
      }
      // 4. the buddy walks in, then a new home
      await expectCoach("moving", null, "move-in");
      await dbg(page, () => {
        const d = window.__buddies.debug;
        d.teleport(d.spawn.player.x, d.spawn.player.y);
      });
      await expectCoach("next", "A new home!", "reward", 25000); // Pip walks over from the porch first
      assert(
        (await dbg(page, () => window.__buddies.housed)) === 1,
        "Pip is housed after bed + torch + door",
      );
      // 5. the HUD opens up once the first buddy is home
      await sleep(900);
      for (const [sel, name] of [
        ["#buildBtn", "Items"],
        [".hud-top .adv", "coin / star chip"],
      ])
        assert(await hudVisible(page, sel), name + " shows after the first move-in");
      // 6. the next request gets the plain coach (no hut): it names the first missing thing
      let plain = null;
      for (let i = 0; i < 80 && !(plain && plain.kind !== "next" && plain.kind !== "moving"); i++) {
        await sleep(150);
        plain = await coach();
      }
      assert(
        plain && !plain.hut && plain.text.length <= 28,
        "plain coach for request 2: " + JSON.stringify(plain),
      );
      await ctx.close();
      return `said: ${said.join(" | ")}; then ${JSON.stringify(plain && plain.text)}`;
    },
  );

  await check(
    "AC-22",
    "AC-22.5 keyboard only: no mouse, no aiming - Pick (digit) then F / Enter places on the glowing spot",
    async () => {
      const { page, ctx } = await openPage(browser);
      await startGame(page);
      const hut = await dbg(page, () => window.__buddies.debug.hut());
      await dbg(page, (h) => window.__buddies.debug.teleport(h.xL + 4.5, h.g), hut);
      await sleep(600);
      const coach = () => dbg(page, () => window.__buddies.debug.coach());
      const tile = (x, y) => getTile(page, x, y).then((t) => t.fg);
      await page.keyboard.press("Digit5");
      await sleep(400);
      const c = await coach();
      assert(
        c.kind === "tap" && c.text === "Press F on the glow",
        "no mouse used: " + JSON.stringify(c),
      );
      // the aim cursor is deliberately somewhere else (left of the player): F must still place on the glow
      await page.keyboard.press("KeyJ");
      await page.keyboard.press("KeyJ");
      await page.keyboard.press("KeyF");
      await sleep(300);
      assert((await tile(hut.xL + 2, hut.g - 1)) === IDS.BED_L, "F placed the bed on the glow");
      await page.keyboard.press("Digit4");
      await sleep(400);
      await page.keyboard.press("KeyF");
      await sleep(300);
      assert((await tile(hut.xL + 5, hut.g - 2)) === IDS.TORCH, "F placed the torch on the glow");
      await page.keyboard.press("Digit3");
      await sleep(400);
      await page.keyboard.press("Enter");
      await sleep(300);
      assert((await tile(hut.xR, hut.g - 1)) === IDS.DOOR_B, "Enter placed the door on the glow");
      await ctx.close();
      return "digit + F (aim elsewhere) placed bed and torch, digit + Enter placed the door";
    },
  );

  await check(
    "AC-22",
    "AC-22.5 a blocked spot: the coach says Break the plank (Break ringed); the wrong item nudges instead of placing",
    async () => {
      const { page, ctx } = await openPage(browser);
      await startGame(page);
      const hut = await dbg(page, () => window.__buddies.debug.hut());
      await dbg(
        page,
        (h) => {
          const d = window.__buddies.debug;
          d.fill(h.xL + 1, h.g - 3, h.xR - 1, h.g - 1, d.ids.PLANKS); // the kid filled the hut with planks
          d.teleport(h.xL + 4.5, h.g - 4); // standing on the roof, within reach of everything
        },
        hut,
      );
      await sleep(900);
      const coach = () => dbg(page, () => window.__buddies.debug.coach());
      let c = await coach();
      assert(
        c.kind === "clear" && /Break/.test(c.text) && c.pulse === "modeBtn",
        "blocked: " + JSON.stringify(c),
      );
      await page.keyboard.press("KeyB");
      await sleep(400);
      c = await coach();
      assert(
        c.kind === "break" && c.text === "Break the plank",
        "in Break mode: " + JSON.stringify(c),
      );
      assert(c.tiles.length >= 1, "the plank to break glows");
      // a bed is two tiles wide: break each plank the glow still covers
      for (let i = 0; i < 4 && c.kind === "break"; i++) {
        await tileClick(page, c.tiles[0][0], c.tiles[0][1]);
        await sleep(300);
        c = await coach();
      }
      assert(c.kind !== "break", "after breaking, the coach moves on: " + JSON.stringify(c));
      await page.keyboard.press("KeyB"); // back to Build
      await dbg(page, (h) => window.__buddies.debug.teleport(h.xL + 4.5, h.g - 4), hut);
      await sleep(500);
      // wrong item: planks in hand, tap the glow -> a nudge, and no plank lands on the spot
      await page.keyboard.press("Digit1");
      await sleep(400);
      c = await coach();
      assert(c.kind === "pick", "planks in hand while the bed is next: " + JSON.stringify(c));
      const t = c.tiles[0];
      const before = (await getTile(page, t[0], t[1])).fg;
      await tileClick(page, t[0], t[1]);
      await sleep(300);
      const toast = await page.locator("#toast").textContent();
      assert(/Pick the bed first/.test(toast), "nudged: " + toast);
      assert((await getTile(page, t[0], t[1])).fg === before, "nothing was placed on the glow");
      await ctx.close();
      return "Switch to Break -> Break the plank -> moves on; the wrong item says 'Pick the bed first'";
    },
  );

  await check(
    "AC-22",
    "AC-22.5 an older save (no hut) shows a coach line while the buddy arrives",
    async () => {
      const { page, ctx } = await openPage(browser);
      await wreckHut(page);
      await startGame(page);
      await sleep(500);
      const c = await dbg(page, () => window.__buddies.debug.coach());
      assert(
        c && c.kind === "wait" && /is coming!$/.test(c.text),
        "arriving: " + JSON.stringify(c),
      );
      await ctx.close();
      return c.text;
    },
  );

  await check(
    "AC-22",
    "AC-22.6 reduced motion: the pulse ring is steady (no animation)",
    async () => {
      const run = async (reducedMotion) => {
        const { page, ctx } = await openPage(browser, { reducedMotion });
        await startGame(page);
        await dbg(page, () => {
          const d = window.__buddies.debug;
          const h = d.hut();
          d.teleport(h.xL + 4.5, h.g);
        });
        await sleep(500);
        const r = await dbg(page, () => {
          const el = document.querySelector("#hotbar .slot.coach-pulse");
          if (!el) return null;
          const cs = getComputedStyle(el);
          return { anim: cs.animationName, shadow: cs.boxShadow };
        });
        await ctx.close();
        return r;
      };
      const normal = await run("no-preference");
      const reduced = await run("reduce");
      assert(normal && normal.anim === "bb-pulse", "pulses normally: " + JSON.stringify(normal));
      assert(
        reduced && reduced.anim === "none" && reduced.shadow !== "none",
        "reduced motion: no animation but a steady ring: " + JSON.stringify(reduced),
      );
      return "bb-pulse normally; none + a steady ring with prefers-reduced-motion";
    },
  );

  // ---- AC-21 a stale tab shows a persistent banner (NEW-1) -------------------------------------
  await check(
    "AC-21",
    "a stale tab shows a banner with Reload now and disables Start",
    async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const A = await openPage(browser, { context });
      const B = await openPage(browser, { context });
      await startGame(B.page);
      await dbg(B.page, () => {
        window.__buddies.debug.giveCoins(50);
        window.__buddies.debug.save();
      });
      await sleep(500); // tab A is still on its title screen
      const banner = A.page.locator("#stale");
      assert(await banner.isVisible(), "the banner is up on the stale tab");
      // N-7: a compact banner (about 70px), never a tall red slab, on desktop and on a landscape phone
      const tall = async (pg) => (await pg.locator("#stale").boundingBox()).height;
      const hDesktop = await tall(A.page);
      assert(hDesktop <= 120, "the banner is at most 120px tall at 1280x800, got " + hDesktop);
      const L = await browser.newContext({
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        isMobile: true,
      });
      const LA = await openPage(browser, { context: L });
      const LB = await openPage(browser, { context: L });
      await startGame(LB.page);
      await dbg(LB.page, () => {
        window.__buddies.debug.giveCoins(5);
        window.__buddies.debug.save();
      });
      await sleep(500);
      const hLand = await tall(LA.page);
      assert(hLand <= 120, "the banner is at most 120px tall at 844x390, got " + hLand);
      await L.close();
      assert(/updated in another tab/i.test(await banner.textContent()), "it says why");
      assert(
        await A.page.getByRole("button", { name: "Reload now" }).isVisible(),
        "it offers Reload now",
      );
      assert(
        await A.page.getByRole("button", { name: "Start building", exact: true }).isDisabled(),
        "a stale tab cannot start (and so cannot overwrite) the world",
      );
      await sleep(4200); // the old transient toast would be gone by now; the banner is not
      assert(await banner.isVisible(), "the banner persists");
      await A.page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
        document.getElementById("announcer").textContent = "";
        Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      const said = await A.page.locator("#announcer").textContent();
      assert(/another tab/i.test(said), "it is announced again when the tab is shown: " + said);
      await Promise.all([
        A.page.waitForNavigation(),
        A.page.getByRole("button", { name: "Reload now" }).click(),
      ]);
      await A.page.waitForFunction(() => !!window.__buddies);
      assert(!(await A.page.locator("#stale").isVisible()), "after the reload the banner is gone");
      assert(
        await A.page.getByRole("button", { name: "Start building", exact: true }).isEnabled(),
        "and Start works again",
      );
      await context.close();
      return "banner persists, announced again on visible, Start disabled, Reload now recovers";
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
