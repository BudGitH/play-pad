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

test("one control per action: no Run button, no duplicate names, the minimap is not a second Map button", async ({
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
  // tapping the minimap does nothing (the Map is the dock's job)
  await page.locator("#kqNeeds").click({ force: true });
  expect((await state(page)).ui.modal).toBeNull();
  await page.locator("#kqDock-map").click();
  expect((await state(page)).ui.modal).toBe("Map");
  await page.keyboard.press("Escape");
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
