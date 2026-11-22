// Viewport-fit test: every game's bottom controls (Start, Submit) stay on screen when the area the
// player can actually see is SHORTER than the layout viewport.
//
// Why: on Android (Chrome edge-to-edge, installed PWA, toolbars) the box a `position: fixed;
// inset: 0` shell fills can be taller than the visible screen, so a Start bar pinned to its bottom
// is cut off or hidden. scripts/viewport.js sizes the shell to the visible height instead. This
// test fakes that condition by making window.visualViewport report a shorter height than the
// window, which is exactly the signal the real browser gives. Run: npm run smoke
import { test, expect } from "@playwright/test";

/** How much shorter than the layout viewport the visible area is faked to be (CSS px). */
const HIDDEN_PX = 80;

const PHONE = { width: 390, height: 844 };

/** Games and the button pinned to the bottom of their setup screen. */
const SETUP_CONTROLS = [
  { path: "games/colour-rush/", button: "Start" },
  { path: "games/snap/", button: "Start" },
  { path: "games/claw-catch/", button: "Start" },
  { path: "games/super-decoder/", button: "Start" },
  { path: "games/sunset-stride/", button: "Start running" },
];

/** Make visualViewport.height report the window height minus `hidden` (before any page script). */
async function fakeShorterVisibleArea(page, hidden) {
  await page.addInitScript((px) => {
    window.__ppHidden = px;
    const proto = Object.getPrototypeOf(window.visualViewport);
    Object.defineProperty(proto, "height", {
      configurable: true,
      get: () => window.innerHeight - window.__ppHidden,
    });
  }, hidden);
}

/** The bottom edge of a button in CSS px from the top of the window. */
async function bottomOf(locator) {
  const box = await locator.boundingBox();
  expect(box, "button is rendered").not.toBeNull();
  return box.y + box.height;
}

test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

for (const { path, button } of SETUP_CONTROLS) {
  test(`${path}: "${button}" stays inside the visible area`, async ({ page }) => {
    await fakeShorterVisibleArea(page, HIDDEN_PX);
    await page.goto(`/${path}`);
    await page.waitForLoadState("networkidle");
    const start = page.getByRole("button", { name: button, exact: true });
    await expect(start).toBeVisible();
    expect(await bottomOf(start)).toBeLessThanOrEqual(PHONE.height - HIDDEN_PX);
  });
}

test("super-decoder: Submit and Clear stay inside the visible area during a round", async ({
  page,
}) => {
  await fakeShorterVisibleArea(page, HIDDEN_PX);
  await page.goto("/games/super-decoder/");
  await page.getByRole("button", { name: "Start", exact: true }).tap();
  await expect.poll(() => page.evaluate(() => window.__decoder?.phase)).toBe("PLACING");
  for (const name of ["Submit guess", "Clear current row"]) {
    const btn = page.getByRole("button", { name, exact: true });
    expect(await bottomOf(btn), name).toBeLessThanOrEqual(PHONE.height - HIDDEN_PX);
  }
});

test("the shell follows the visible area when it changes (toolbar / chin moves)", async ({
  page,
}) => {
  await fakeShorterVisibleArea(page, 0);
  await page.goto("/games/snap/");
  const start = page.getByRole("button", { name: "Start", exact: true });
  expect(await bottomOf(start)).toBeLessThanOrEqual(PHONE.height);

  await page.evaluate((px) => {
    window.__ppHidden = px;
    window.visualViewport.dispatchEvent(new Event("resize"));
  }, HIDDEN_PX);
  await expect.poll(() => bottomOf(start)).toBeLessThanOrEqual(PHONE.height - HIDDEN_PX);
});
