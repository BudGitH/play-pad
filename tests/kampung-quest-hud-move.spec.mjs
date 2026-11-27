// Kampung Quest: one control per action (the de-duplicated HUD) and move + run + jump at the same time.
// Feature record: features/kampung-quest-improvements/hud-movement.md. Touch (two fingers: stick + Jump,
// push to the rim to run) is in kampung-quest-mobile.spec.mjs; this file covers the keyboard and the HUD.
// Run: npx playwright test tests/kampung-quest-hud-move.spec.mjs
import { test, expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const kq = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => kq(page, () => window.__kq.state());
const step = (page, ms) => kq(page, (t) => window.__kq.step(t), ms);

async function open(page) {
  await page.goto(GAME);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await step(page, 300);
}

/** Visible HUD buttons with their spoken names. */
function hudButtons(page) {
  return kq(page, () =>
    Array.from(document.querySelectorAll("#kqHud button"))
      .filter((b) => b.getBoundingClientRect().width > 0 && getComputedStyle(b).display !== "none")
      .map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().split(",")[0]),
  );
}

test.use({ viewport: { width: 1280, height: 800 } });
test.describe.configure({ timeout: 150_000 });

test("one control per action: no Run button, no duplicate names, Map = the radar, Pray = the prayer card, Pause = the corner", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("#kqRun")).toHaveCount(0);
  const names = await hudButtons(page);
  expect(names.length).toBeGreaterThan(4);
  expect(new Set(names).size, "every visible HUD button has its own name: " + names).toBe(
    names.length,
  );
  // the keyboard hint does not repeat the Pause button
  const hint = await page.locator(".kq-keys").textContent();
  expect(hint).not.toMatch(/Esc/);
  expect(hint).toMatch(/Shift/);
  expect(hint).toMatch(/Space/);
  // the dock holds only Missions and Bag: Map is the radar, Pray the prayer-time card, Pause the corner button
  await expect(page.locator(".kq-dock-btn")).toHaveCount(2);
  expect(names).toEqual(expect.arrayContaining(["Missions", "Bag", "Map", "Pause", "Sound"]));
  expect(names).not.toContain("Pray");
  // tapping the radar opens the full map; so does M
  await page.locator("#kqMap").click();
  expect((await state(page)).ui.modal).toBe("Map");
  await page.keyboard.press("Escape");
  await page.keyboard.press("m");
  expect((await state(page)).ui.modal).toBe("Map");
  await page.keyboard.press("Escape");
  // the prayer-time card is a keyboard-reachable button that opens today's prayers; so does P
  await page.locator("#kqStatus").focus();
  await page.keyboard.press("Enter");
  expect((await state(page)).ui.modal).toBe("Prayer");
  await page.keyboard.press("Escape");
  await page.locator("#kqStatus").click();
  expect((await state(page)).ui.modal).toBe("Prayer");
  await page.keyboard.press("Escape");
  await page.keyboard.press("p");
  expect((await state(page)).ui.modal).toBe("Prayer");
  await page.keyboard.press("Escape");
  // Pause is the corner button (and Esc)
  await page.locator("#kqDock-pause").click();
  expect((await state(page)).ui.modal).toBe("Paused");
  await page.getByRole("button", { name: "Resume" }).click();
});

test("radar: blips for the objective, mosque, food and mission givers; the radar turns with the hero", async ({
  page,
}) => {
  await open(page);
  const kinds = () =>
    kq(page, () => window.KQ.Game.Loop.mapView(80, { rotate: true }).markers.map((m) => m.kind));
  expect(await kinds(), "mosque, food, home and the neighbours with a star").toEqual(
    expect.arrayContaining(["mosque", "food", "home", "giver"]),
  );
  await kq(page, () => {
    window.KQ.Game.S.sim.missions.accept("recycling_hero");
    window.__kq.step(300);
  });
  const markers = await kq(page, () => window.KQ.Game.Loop.mapView(80, { rotate: true }).markers);
  const goal = markers.find((m) => m.kind === "objective");
  expect(goal, "the objective blip").toMatchObject({ big: true, arrow: true });
  expect(
    markers.some((m) => m.kind === "giver"),
    "no giver stars while a mission is on",
  ).toBe(false);
  // the radar canvas is drawn (not blank) and a heading change repaints it
  const hash = () =>
    kq(page, () => {
      const c = document.querySelector("#kqHud canvas.kq-minimap");
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0;
      return h;
    });
  const a = await hash();
  await kq(page, () => window.__kq.place(-5, 4, Math.PI / 2));
  await step(page, 400);
  expect(await hash(), "the radar repaints when the hero turns").not.toBe(a);
});

test("food and energy bars: icon, bar, word; 'Hungry' and 'Tired' when low; Missions badge counts", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator(".kq-need.kq-food .kq-need-word")).toHaveText("Food");
  await expect(page.locator(".kq-need.kq-energy .kq-need-word")).toHaveText("Energy");
  await kq(page, () => {
    window.KQ.Game.S.sim.needs.restore({ hunger: 15, energy: 10 });
    window.__kq.step(300);
  });
  await expect(page.locator(".kq-need.kq-food .kq-need-word")).toHaveText("Hungry");
  await expect(page.locator(".kq-need.kq-energy .kq-need-word")).toHaveText("Tired");
  const fill = await kq(
    page,
    () => document.querySelector(".kq-need.kq-food .kq-need-fill").style.transform,
  );
  expect(fill).toBe("scaleX(0.15)");
  // Missions: a pink count of the stars to find, then a green 1 once one is under way
  const badge = page.locator("#kqDock-missions .kq-badge");
  await expect(badge).toBeVisible();
  await expect(badge).not.toHaveClass(/is-active/);
  await kq(page, () => {
    window.KQ.Game.S.sim.missions.accept("recycling_hero");
    window.__kq.step(300);
  });
  await expect(badge).toHaveText("1");
  await expect(badge).toHaveClass(/is-active/);
  await expect(page.locator("#kqDock-missions")).toHaveAttribute("aria-label", /1 in progress/);
});

test("Shift + W + Space together: the hero runs, hops and keeps going without stopping", async ({
  page,
}) => {
  await open(page);
  await kq(page, () => window.__kq.place(-40, 0, Math.PI / 2));
  await step(page, 300);
  await page.keyboard.down("KeyW");
  await step(page, 700);
  const walk = await state(page);
  expect(walk.running).toBe(false);
  await page.keyboard.down("Shift");
  await step(page, 500);
  const run = await state(page);
  expect(run.running).toBe(true);
  expect(run.speed).toBeGreaterThan(walk.speed + 1);
  await page.keyboard.press("Space"); // W and Shift stay held
  await step(page, 250);
  const air = await state(page);
  expect(air.airborne).toBe(true);
  expect(air.jumpHeight).toBeGreaterThan(0.3);
  expect(air.speed, "no stall in the air").toBeGreaterThan(run.speed * 0.85);
  await step(page, 700);
  const land = await state(page);
  expect(land.airborne).toBe(false);
  expect(land.speed, "still running after landing").toBeGreaterThan(run.speed * 0.85);
  expect(Math.hypot(land.pos.x - run.pos.x, land.pos.z - run.pos.z)).toBeGreaterThan(3);
  await page.keyboard.up("Shift");
  await page.keyboard.up("KeyW");
});

test("letting go of W in the air carries the hero a little (a running jump keeps its momentum)", async ({
  page,
}) => {
  await open(page);
  await kq(page, () => window.__kq.place(-40, 0, Math.PI / 2));
  await step(page, 300);
  await kq(page, () => {
    window.__kq.input("up", true);
    window.__kq.input("run", true);
  });
  await step(page, 600);
  await kq(page, () => {
    window.__kq.action("jump");
    window.__kq.input("up", false);
    window.__kq.input("run", false);
  });
  await step(page, 200);
  const air = await state(page);
  expect(air.airborne).toBe(true);
  expect(air.speed, "momentum carried in the air").toBeGreaterThan(1.5);
  await step(page, 1500);
  expect((await state(page)).speed, "stops on the ground").toBeLessThan(0.3);
});
