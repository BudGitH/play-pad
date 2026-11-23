// Brick Buddies v2 (phone-first controls, goal clarity, two play modes, colour, life).
// Feature record: features/brick-buddies-v2/ (AC-23.x). Run: npm run smoke
/* eslint-disable max-lines-per-function -- each test is one linear user scenario (same stance as the deep probes, DECISIONS 2026-11-22) */
import { test, expect } from "@playwright/test";

const URL = "/games/brick-buddies/index.html";
const HELP_KEY = "playpad.brickBuddies.help.v1";
const SAVE_KEY = "playpad.brickBuddies.v1";
const UI_KEY = "playpad.brickBuddies.ui.v1";
const PHONE = { width: 915, height: 412 }; // the owner's phone in landscape

/** Open the game as a returning visitor (no how-to over the scene) and press Start. */
async function start(page, { mode } = {}) {
  await page.addInitScript((k) => {
    try {
      if (!localStorage.getItem(k)) localStorage.setItem(k, "1");
    } catch {
      /* storage blocked */
    }
  }, HELP_KEY);
  await page.goto(URL);
  if (mode === "open") await page.locator('.modes:not(.in-menu) [data-play="open"]').click();
  await page.getByRole("button", { name: "Start building", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__buddies?.phase)).toBe("playing");
}

const dbg = (page, fn, arg) => page.evaluate(fn, arg);
const view = (page) => dbg(page, () => window.__buddies.debug.view());

/** Real multi-touch through the DevTools protocol: each point is a finger (stable ids). */
async function touchSession(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: pts.map(([x, y, id]) => ({ x, y, id })),
    });
  return { send };
}

/** A free, reachable tile near the builder for the held block (or null). */
function freeTileNear(page, key) {
  return dbg(
    page,
    (k) => {
      const d = window.__buddies.debug;
      const p = window.__buddies.player;
      for (let dx = -4; dx <= 4; dx++)
        for (let dy = -3; dy <= 0; dy++) {
          const x = Math.floor(p.x) + dx;
          const y = Math.floor(p.y - 0.5) + dy;
          if (dx && d.canPlace(k, x, y).ok) return [x, y];
        }
      return null;
    },
    key,
  );
}
const tileAt = (page, t) => dbg(page, (c) => window.__buddies.debug.getTile(c[0], c[1]), t);
const screenOf = (page, t) => dbg(page, (c) => window.__buddies.debug.tileToScreen(c[0], c[1]), t);
const countPlanks = (page) =>
  dbg(page, () => window.__buddies.debug.countTiles(window.__buddies.debug.ids.PLANKS));

test.describe("brick-buddies v2 (phone landscape 915x412)", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("AC-23.1 a single joystick replaces the four arrow buttons and drives movement", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page);
    for (const id of ["tLeft", "tRight", "tDown", "tJump"])
      await expect(page.locator("#" + id)).toHaveCount(0);
    const joy = page.getByRole("group", { name: /^Move/ });
    await expect(joy).toBeVisible();
    const box = await joy.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(88);
    expect(box.height).toBeGreaterThanOrEqual(88);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height);

    const { send } = await touchSession(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const x0 = await dbg(page, () => window.__buddies.player.x);
    await send("touchStart", [[cx, cy, 1]]);
    await send("touchMove", [[cx + 40, cy, 1]]);
    await expect.poll(async () => (await view(page)).joy.r).toBe(1);
    await page.waitForTimeout(400);
    expect(await dbg(page, () => window.__buddies.player.x)).toBeGreaterThan(x0 + 0.5);
    await send("touchMove", [[cx - 40, cy, 1]]);
    await expect.poll(async () => (await view(page)).joy.l).toBe(1);
    await send("touchMove", [[cx, cy - 42, 1]]);
    await expect.poll(async () => (await view(page)).joy.u).toBe(1);
    await send("touchMove", [[cx, cy + 42, 1]]);
    await expect.poll(async () => (await view(page)).joy.d).toBe(1);
    await send("touchEnd", []);
    await expect.poll(async () => Object.values((await view(page)).joy).join("")).toBe("0000");

    // pushing up is a jump: the builder leaves the ground
    await send("touchStart", [[cx, cy, 1]]);
    await send("touchMove", [[cx, cy - 42, 1]]);
    await expect.poll(() => dbg(page, () => window.__buddies.player.ground)).toBe(false);
    await send("touchEnd", []);

    // the keyboard still works
    const x1 = await dbg(page, () => window.__buddies.player.x);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(300);
    await page.keyboard.up("KeyD");
    expect(await dbg(page, () => window.__buddies.player.x)).toBeGreaterThan(x1);
    expect(errors).toEqual([]);
  });

  test("AC-23.2 two-finger pinch zooms within limits, two-finger drag pans, recenter resets", async ({
    page,
  }) => {
    await start(page);
    const v0 = await view(page);
    expect(v0.recenterShown).toBe(false);
    expect(v0.minZoom).toBeLessThanOrEqual(v0.autoZoom);
    expect(v0.maxZoom).toBeGreaterThan(v0.autoZoom);
    const { send } = await touchSession(page);

    // pinch out: closer
    await send("touchStart", [
      [400, 200, 1],
      [500, 200, 2],
    ]);
    for (let i = 1; i <= 8; i++)
      await send("touchMove", [
        [400 - i * 10, 200, 1],
        [500 + i * 10, 200, 2],
      ]);
    await send("touchEnd", []);
    const closer = await view(page);
    expect(closer.zoomCss).toBeGreaterThan(v0.zoomCss * 1.4);
    expect(closer.zoomCss).toBeLessThanOrEqual(closer.maxZoom);
    expect(closer.recenterShown).toBe(true);

    // a huge pinch is clamped to the maximum
    await send("touchStart", [
      [300, 200, 1],
      [330, 200, 2],
    ]);
    for (let i = 1; i <= 12; i++)
      await send("touchMove", [
        [300 - i * 12, 200, 1],
        [330 + i * 40, 200, 2],
      ]);
    await send("touchEnd", []);
    expect((await view(page)).zoomCss).toBeLessThanOrEqual(closer.maxZoom + 1e-6);

    // pinch in all the way: clamped to the whole-world overview, never smaller
    await send("touchStart", [
      [100, 200, 1],
      [800, 200, 2],
    ]);
    for (let i = 1; i <= 14; i++)
      await send("touchMove", [
        [100 + i * 24, 200, 1],
        [800 - i * 24, 200, 2],
      ]);
    await send("touchEnd", []);
    const far = await view(page);
    expect(far.zoomCss).toBeGreaterThanOrEqual(far.minZoom - 1e-6);
    expect(far.zoomCss).toBeLessThan(far.autoZoom);

    // recenter: back to the automatic zoom and no pan
    await page.getByRole("button", { name: /^Recenter/ }).click();
    await expect.poll(async () => (await view(page)).recenterShown).toBe(false);
    const back = await view(page);
    expect(back.zoomCss).toBe(back.autoZoom);
    expect(Math.hypot(back.pan.x, back.pan.y)).toBeLessThan(0.01);

    // two fingers dragging together pan the camera
    const cam0 = await dbg(page, () => window.__buddies.debug.camera());
    await send("touchStart", [
      [500, 150, 1],
      [560, 150, 2],
    ]);
    for (let i = 1; i <= 8; i++)
      await send("touchMove", [
        [500 - i * 20, 150, 1],
        [560 - i * 20, 150, 2],
      ]);
    await send("touchEnd", []);
    await page.waitForTimeout(500);
    const cam1 = await dbg(page, () => window.__buddies.debug.camera());
    expect(Math.abs(cam1.x - cam0.x)).toBeGreaterThan(2);
    expect((await view(page)).recenterShown).toBe(true);
  });

  test("AC-23.3 the goal is a small chip, folded by default here, and the choice is remembered", async ({
    page,
  }) => {
    await start(page);
    const head = page.locator("#request .req-head");
    await expect(page.locator("#request")).toHaveClass(/collapsed/);
    const box = await head.boundingBox();
    expect(box.width).toBeLessThanOrEqual(190);
    expect(box.height).toBeLessThanOrEqual(56);
    await expect(page.locator("#reqGoal")).toHaveText(/^Goal 1\/5$/);
    await expect(page.locator("#coach")).toBeVisible(); // the coach line stays beside the chip

    await head.click();
    await expect(page.locator("#request")).not.toHaveClass(/collapsed/);
    await expect(page.locator("#reqList li").first()).toBeVisible();
    expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).goal, UI_KEY)).toBe(1);

    await page.reload();
    await page.getByRole("button", { name: "Start building", exact: true }).click();
    await expect(page.locator("#request")).not.toHaveClass(/collapsed/); // remembered
    await head.click();
    await expect(page.locator("#request")).toHaveClass(/collapsed/);
    await page.reload();
    await page.getByRole("button", { name: "Start building", exact: true }).click();
    await expect(page.locator("#request")).toHaveClass(/collapsed/);
  });

  test("AC-23.4 the bottom chrome is small; the tray folds away and keeps every function reachable", async ({
    page,
  }) => {
    await start(page);
    // an old save with an explicit "tray open" would hide this: start fresh
    await page.evaluate((k) => localStorage.removeItem(k), UI_KEY);
    await page.reload();
    await page.getByRole("button", { name: "Start building", exact: true }).click();
    await page.evaluate(() => {
      const d = window.__buddies.debug;
      d.teleport(d.world.houseX + 24.5, d.world.houseY + 16); // away from the hut: no coach ring needs the tray
      const h = d.hut();
      d.place(h.xL, h.g - 2, 0); // a wrecked hut ends the simple first run, so Items is shown
    });
    await page.waitForTimeout(500);
    const area = await page.evaluate(() => {
      const sel = [
        "#joy",
        ".tray-bar",
        ".hud-top .chip, .hud-top .chip-btn",
        "#request .req-head",
        "#coach",
      ];
      let sum = 0;
      for (const s of sel)
        for (const e of document.querySelectorAll(s)) {
          const r = e.getBoundingClientRect();
          sum += r.width * r.height;
        }
      return sum / (innerWidth * innerHeight);
    });
    expect(area).toBeLessThan(0.3);
    expect((await view(page)).trayOpen).toBe(false);
    await expect(page.locator("#hotbar")).toBeHidden();

    await page.getByRole("button", { name: /block tray/ }).click();
    await expect(page.locator("#hotbar")).toBeVisible();
    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll("#hotbar .slot")].map((s) => s.getBoundingClientRect().width),
    );
    expect(sizes.length).toBe(10);
    for (const w of sizes) expect(w).toBeGreaterThanOrEqual(40);
    await expect(page.getByRole("button", { name: /^Items/ })).toBeVisible();
    await expect(page.locator("#modeBtn")).toBeVisible();
    // Items still opens the build menu
    await page.getByRole("button", { name: /^Items/ }).click();
    await expect(page.getByRole("dialog", { name: "Build menu" })).toBeVisible();
    await page.getByRole("button", { name: /Done/ }).click();
    // the choice is remembered
    expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).tray, UI_KEY)).toBe(1);
  });

  test("AC-23.5 a tap previews, a second tap on the preview places; pinches never build", async ({
    page,
  }) => {
    await start(page);
    await dbg(page, () => window.__buddies.debug.select("planks"));
    await page.waitForTimeout(800);
    const tgt = await freeTileNear(page, "planks");
    expect(tgt).not.toBeNull();
    const at = await screenOf(page, tgt);
    const before = await countPlanks(page);

    await page.touchscreen.tap(at.x, at.y);
    await expect.poll(() => dbg(page, () => window.__buddies.debug.aim().pending)).toBe(true);
    expect((await tileAt(page, tgt)).fg).toBe(0); // nothing built yet
    expect(await countPlanks(page)).toBe(before);

    // a tap elsewhere moves the preview
    const other = [tgt[0] - 1, tgt[1]];
    if (await dbg(page, (c) => window.__buddies.debug.canPlace("planks", c[0], c[1]).ok, other)) {
      const o = await screenOf(page, other);
      await page.touchscreen.tap(o.x, o.y);
      expect(await dbg(page, () => window.__buddies.debug.aim().tx)).toBe(other[0]);
      await page.touchscreen.tap(at.x, at.y); // back to the first
    }
    // a pinch over empty tiles (and the lift of its first finger) builds nothing
    const { send } = await touchSession(page);
    await send("touchStart", [
      [at.x + 60, at.y - 40, 1],
      [at.x + 120, at.y - 40, 2],
    ]);
    for (let i = 1; i <= 4; i++)
      await send("touchMove", [
        [at.x + 60 - i * 2, at.y - 40, 1],
        [at.x + 120 + i * 2, at.y - 40, 2],
      ]);
    await send("touchEnd", [[at.x + 128, at.y - 40, 2]]); // finger 1 lifts first
    await page.waitForTimeout(80);
    await send("touchEnd", []);
    await page.waitForTimeout(300);
    expect(await countPlanks(page)).toBe(before);

    // the pinch moved the camera: find the preview again, then tap it (it is still waiting there)
    const again = await screenOf(page, tgt);
    expect((await dbg(page, () => window.__buddies.debug.aim())).pending).toBe(true);
    await page.touchscreen.tap(again.x, again.y);
    await expect.poll(async () => (await tileAt(page, tgt)).fg).toBe(1);
    expect(await countPlanks(page)).toBe(before + 1);
    expect(await dbg(page, () => window.__buddies.debug.particleCount())).toBeGreaterThan(0);

    // Break mode previews first too
    await page.keyboard.press("KeyB");
    const bt = await screenOf(page, tgt);
    await page.touchscreen.tap(bt.x, bt.y);
    expect((await tileAt(page, tgt)).fg).toBe(1);
    await page.touchscreen.tap(bt.x, bt.y);
    await expect.poll(async () => (await tileAt(page, tgt)).fg).toBe(0);
  });

  test("AC-23.5 an invalid tile previews red and places nothing", async ({ page }) => {
    await start(page);
    await dbg(page, () => window.__buddies.debug.select("planks"));
    await page.waitForTimeout(800);
    // the tile the builder stands in is never placeable
    const p = await dbg(page, () => window.__buddies.player);
    const t = [Math.floor(p.x), Math.floor(p.y - 0.5)];
    const at = await screenOf(page, t);
    const before = await countPlanks(page);
    await page.touchscreen.tap(at.x, at.y);
    await page.touchscreen.tap(at.x, at.y);
    await page.waitForTimeout(200);
    const aim = await dbg(page, () => window.__buddies.debug.aim());
    expect(aim.valid).toBe(false);
    expect(await countPlanks(page)).toBe(before);
  });

  test("AC-23.6 goals say what to do with which block, and the open gap glows red", async ({
    page,
  }) => {
    await start(page);
    // let the buddy arrive, then stand in the hut (its doorway is the gap in the walls)
    await dbg(page, () => {
      const d = window.__buddies.debug;
      d.step(60 * 25);
      const h = d.hut();
      d.teleport(h.xL + 3.5, h.g);
      d.step(30);
    });
    await expect.poll(() => dbg(page, () => window.__buddies.request.state)).toBe("waiting");
    const rows = await dbg(page, () => window.__buddies.debug.checklist().map((r) => r.text));
    const text = rows.join(" | ");
    expect(text).not.toMatch(/Close the gap|Missing:/);
    expect(text).toMatch(/Fill the red spots in your walls with Plank blocks/);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    const cells = await dbg(page, () => window.__buddies.debug.goalCells());
    expect(cells.kind).toBe("gap");
    expect(cells.cells.length).toBeGreaterThanOrEqual(1);
    expect(cells.cells.length).toBeLessThanOrEqual(30);
    // the coach line stays short
    const coach = await dbg(page, () => window.__buddies.debug.coach()?.text ?? "");
    expect(coach.length).toBeLessThanOrEqual(28);
  });

  test("AC-23.7 the mode choice: Open play hides goals, unlocks everything, and switches both ways", async ({
    page,
  }) => {
    await page.addInitScript((k) => localStorage.setItem(k, "1"), HELP_KEY);
    await page.goto(URL);
    const group = page.getByRole("radiogroup", { name: "How do you want to play?" });
    await expect(group.getByRole("radio")).toHaveCount(2);
    await expect(group.getByRole("radio", { name: /Goals/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await group.getByRole("radio", { name: /Open play/ }).click();
    await page.getByRole("button", { name: "Start building", exact: true }).click();
    await expect.poll(() => dbg(page, () => window.__buddies?.phase)).toBe("playing");

    await expect(page.locator("#request")).toBeHidden();
    await expect(page.locator(".hud-top .stats")).toBeHidden();
    expect((await view(page)).mode).toBe("open");
    expect(await dbg(page, () => window.__buddies.debug.visitor())).toBeNull();
    // the Furnace costs coins in Goals; in Open play it is simply there to use (and the coins are untouched)
    const coins = await dbg(page, () => window.__buddies.coins);
    const placed = await dbg(page, () => {
      const d = window.__buddies.debug;
      const x = d.world.houseX - 4; // the flat plot beside the hut
      d.teleport(x + 0.5, d.groundRow(x));
      d.select("furnace");
      return d.tryPlace("furnace", x, d.groundRow(x) - 1).ok;
    });
    expect(placed).toBe(true);
    expect(await dbg(page, () => window.__buddies.coins)).toBe(coins);

    // the saved mode survives a reload
    await dbg(page, () => window.__buddies.debug.save());
    await page.reload();
    await expect(
      page
        .getByRole("radiogroup", { name: "How do you want to play?" })
        .getByRole("radio", { name: /Open play/ }),
    ).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Start building", exact: true }).click();
    await expect.poll(() => dbg(page, () => window.__buddies?.phase)).toBe("playing");

    // switch to Goals from the menu: the world is kept and a goal appears
    const furnaces = await dbg(page, () =>
      window.__buddies.debug.countTiles(window.__buddies.debug.ids.FURNACE),
    );
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const menuMode = page.locator("#menu").getByRole("radiogroup", { name: "Play mode" });
    await menuMode.getByRole("radio", { name: /Goals/ }).click();
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.locator("#request")).toBeVisible();
    expect((await view(page)).mode).toBe("goals");
    expect(await dbg(page, () => window.__buddies.request)).not.toBeNull();
    expect(
      await dbg(page, () => window.__buddies.debug.countTiles(window.__buddies.debug.ids.FURNACE)),
    ).toBe(furnaces);
  });

  test("AC-23.7 an old save without a mode loads as Goals", async ({ page }) => {
    await start(page);
    await dbg(page, () => window.__buddies.debug.save());
    await page.evaluate((k) => {
      const d = JSON.parse(localStorage.getItem(k));
      delete d.mode;
      delete d.zoomPx;
      delete d.world.tf;
      delete d.world.tb;
      delete d.world.tints;
      localStorage.setItem(k, JSON.stringify(d));
    }, SAVE_KEY);
    await page.reload();
    await expect(
      page
        .getByRole("radiogroup", { name: "How do you want to play?" })
        .getByRole("radio", { name: /Goals/ }),
    ).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Start building", exact: true }).click();
    await expect.poll(() => dbg(page, () => window.__buddies?.phase)).toBe("playing");
    expect((await view(page)).mode).toBe("goals");
    await expect(page.locator("#request")).toBeVisible();
  });

  test("AC-23.11 colour: the dot opens a swatch picker; tinted blocks render, save, and still count", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await start(page);
    await dbg(page, () => window.__buddies.debug.select("planks"));
    const dot = page.getByRole("button", { name: /^Colour of the Planks/ });
    await expect(dot).toBeVisible();
    await expect(page.locator("#swatches")).toBeHidden(); // collapsed by default
    await dot.click();
    const picker = page.getByRole("group", { name: "Block colour" });
    await expect(picker).toBeVisible();
    const swatches = picker.getByRole("button");
    expect(await swatches.count()).toBeGreaterThanOrEqual(7); // 6-8 colours + original
    await picker.getByRole("button", { name: "Red", exact: true }).click();
    await expect(picker).toBeHidden();
    expect(await dbg(page, () => window.__buddies.debug.tintOf("planks"))).toBe(1);

    // a placed block keeps the tint
    const tgt = await freeTileNear(page, "planks");
    const at = await screenOf(page, tgt);
    await page.touchscreen.tap(at.x, at.y);
    await page.touchscreen.tap(at.x, at.y);
    await expect.poll(async () => (await tileAt(page, tgt)).fg).toBe(1);
    expect(await dbg(page, (c) => window.__buddies.debug.tintAt(c[0], c[1]).fg, tgt)).toBe(1);

    // a closed ring of tinted planks is still a room of planks (goal checks read the base type)
    const room = await dbg(page, () => {
      const d = window.__buddies.debug;
      const x0 = d.world.houseX - 7; // flat plot between the hut and the house
      const y1 = d.groundRow(x0 + 2) - 1;
      d.setTint("planks", 4);
      for (let x = x0; x <= x0 + 5; x++) d.placeItem("planks", x, y1 - 4); // roof
      for (let y = y1 - 3; y <= y1; y++) {
        d.placeItem("planks", x0, y);
        d.placeItem("planks", x0 + 5, y);
      }
      return { fgTint: d.tintAt(x0, y1).fg, probe: d.regionAt(x0 + 2, y1) };
    });
    expect(room.fgTint).toBe(4);
    expect(room.probe.room).not.toBeNull();
    expect(room.probe.room.size).toBeGreaterThanOrEqual(16);

    // the tint is saved, and a save without tints (an older one) still loads
    await dbg(page, () => window.__buddies.debug.save());
    await page.reload();
    await page.getByRole("button", { name: "Start building", exact: true }).click();
    await expect.poll(() => dbg(page, () => window.__buddies?.phase)).toBe("playing");
    expect(await dbg(page, (c) => window.__buddies.debug.tintAt(c[0], c[1]).fg, tgt)).toBe(1);
    expect(await dbg(page, () => window.__buddies.debug.tintOf("planks"))).toBe(4);
    expect(errors).toEqual([]);
  });

  test("AC-23.9 the rain is softer: lower gain, darker filter, no hiss layer", async ({ page }) => {
    await start(page);
    const r = await dbg(page, () => window.__buddies.debug.rainTuning());
    expect(r.running).toBe(true);
    expect(r.hiss).toBe(false);
    expect(r.peak).toBeLessThanOrEqual(r.oldPeak * 0.5);
    expect(r.lpOut).toBeLessThanOrEqual(3500);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Rain/ })).toBeVisible(); // the toggle stays
  });

  test("AC-23.10 buddies stroll, turn and idle inside their range; ambient critters are capped", async ({
    page,
  }) => {
    await start(page);
    await dbg(page, () => window.__buddies.debug.step(60 * 20)); // the visitor arrives and waits
    await expect.poll(() => dbg(page, () => window.__buddies.request.state)).toBe("waiting");
    const seen = {};
    for (let i = 0; i < 120; i++) {
      const life = await dbg(page, () => {
        window.__buddies.debug.step(60);
        return window.__buddies.debug.life();
      });
      for (const b of life.buddies) {
        const s = (seen[b.name] ??= {
          last: b.face,
          flips: 0,
          idle: 0,
          dev: 0,
          role: b.role,
          range: b.range,
          n: 0,
        });
        if (b.face !== s.last) s.flips++;
        s.last = b.face;
        if (b.state === "idle") s.idle++;
        s.dev = Math.max(s.dev, Math.abs(b.x - b.anchor), b.maxDev);
        s.n++;
      }
    }
    const visitor = Object.values(seen).find((s) => s.role === "visitor");
    const resident = Object.values(seen).find((s) => s.role === "resident");
    for (const s of [visitor, resident]) {
      expect(s.flips, JSON.stringify(s)).toBeGreaterThanOrEqual(1);
      expect(s.idle, JSON.stringify(s)).toBeGreaterThanOrEqual(1);
      expect(s.dev, JSON.stringify(s)).toBeLessThanOrEqual(s.range + 0.75);
    }
    // ambient life: a frog / firefly / bird or two, never more than the cap
    await dbg(page, () => {
      const d = window.__buddies.debug;
      d.setRain(false);
      d.setTime(0.5);
      d.step(60 * 30);
    });
    const life = await dbg(page, () => window.__buddies.debug.life());
    expect(life.critters).toBeGreaterThanOrEqual(1);
    expect(life.critters).toBeLessThanOrEqual(12);
  });

  test("AC-23.8 reduced motion: no pop, no ambient critters", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: PHONE,
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await start(page);
    await dbg(page, () => window.__buddies.debug.select("planks"));
    await page.waitForTimeout(600);
    const tgt = await freeTileNear(page, "planks");
    const at = await screenOf(page, tgt);
    await page.touchscreen.tap(at.x, at.y);
    await page.touchscreen.tap(at.x, at.y);
    await expect.poll(async () => (await tileAt(page, tgt)).fg).toBe(1);
    expect(await dbg(page, () => window.__buddies.debug.popCount())).toBe(0);
    await dbg(page, () => {
      const d = window.__buddies.debug;
      d.setRain(false);
      d.setTime(0.5);
      d.step(60 * 30);
    });
    expect((await dbg(page, () => window.__buddies.debug.life())).critters).toBe(0);
    await ctx.close();
  });
});

test.describe("brick-buddies v2 (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("AC-23.2 the mouse wheel zooms about the cursor and + / - still work", async ({ page }) => {
    await start(page);
    const z0 = (await view(page)).zoomCss;
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, -300);
    await expect.poll(async () => (await view(page)).zoomCss).toBeGreaterThan(z0);
    const z1 = (await view(page)).zoomCss;
    await page.mouse.wheel(0, 900);
    await expect.poll(async () => (await view(page)).zoomCss).toBeLessThan(z1);
    await page.keyboard.press("Equal");
    const z2 = (await view(page)).zoomCss;
    await page.keyboard.press("Minus");
    expect((await view(page)).zoomCss).toBeLessThan(z2);
    await page.getByRole("button", { name: /^Recenter/ }).click();
    expect((await view(page)).zoomCss).toBe((await view(page)).autoZoom);
  });

  test("AC-23.4 on a desktop the tray starts open; the held block is shown", async ({ page }) => {
    await start(page);
    await page.evaluate((k) => localStorage.removeItem(k), UI_KEY);
    await page.reload();
    await page.getByRole("button", { name: "Start building", exact: true }).click();
    expect((await view(page)).trayOpen).toBe(true);
    await expect(page.locator("#hotbar")).toBeVisible();
    await expect(page.locator("#trayBtn")).toBeVisible();
    await expect(page.locator("#joy")).toBeHidden(); // the stick is touch-only
  });
});
