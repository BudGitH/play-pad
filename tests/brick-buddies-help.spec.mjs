// Brick Buddies first-run help: the picture "How to play" shows on a first visit, can be dismissed
// (and stays dismissed), and re-opens from the "?" button; the coach then points at the next control.
// Feature record: features/brick-buddies-onboarding/. Run: npm run smoke
import { test, expect } from "@playwright/test";

const URL = "/games/brick-buddies/index.html";
const HELP_KEY = "playpad.brickBuddies.help.v1";
const VIEWPORTS = [
  { name: "phone 390x844", viewport: { width: 390, height: 844 }, touch: true },
  { name: "desktop 1280x800", viewport: { width: 1280, height: 800 }, touch: false },
];

/** Open the game and press Start (the first-run help appears over the live scene). */
async function start(page) {
  await page.goto(URL);
  await page.getByRole("button", { name: "Start building", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__buddies?.phase)).toBe("playing");
}

/** First run: the picture cards, and that they have the floor. */
function registerFirstRun() {
  test("shows on first run with at most 4 picture steps and has the floor", async ({ page }) => {
    await start(page);
    const help = page.getByRole("dialog", { name: "How to play" });
    await expect(help).toBeVisible();

    // picture steps with short words (a 6 to 10 year old who reads little)
    const steps = help.locator(".how-step");
    expect(await steps.count()).toBeLessThanOrEqual(4);
    for (const text of await steps.locator("p").allInnerTexts()) {
      expect(text.replace(/\s+/g, " ").trim().length, text).toBeLessThanOrEqual(40);
    }
    expect(await help.locator(".how-pic canvas, .how-pic .how-sym").count()).toBeGreaterThan(3);

    // the card has the floor: keys do not walk the builder behind it
    const x0 = await page.evaluate(() => window.__buddies.player.x);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(400);
    await page.keyboard.up("KeyD");
    expect(await page.evaluate(() => window.__buddies.player.x)).toBe(x0);
  });
}

/** Dismiss, remember across a reload, and reopen from the ? button. */
function registerDismiss(viewport) {
  test("can be dismissed, stays dismissed after a reload, and reopens from the ? button", async ({
    page,
  }) => {
    await start(page);
    const help = page.getByRole("dialog", { name: "How to play" });
    await page.getByRole("button", { name: "Let\u2019s go!" }).click();
    await expect(help).toBeHidden();
    expect(await page.evaluate((k) => localStorage.getItem(k), HELP_KEY)).toBe("1");

    // a reload (same storage) does not show it again
    await page.reload();
    await page.getByRole("button", { name: "Start building", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__buddies?.phase)).toBe("playing");
    await expect(help).toBeHidden();

    // the ? button is a big, always-visible control that brings it back; Esc closes it
    const ask = page.getByRole("button", { name: "How to play", exact: true });
    await expect(ask).toBeVisible();
    const box = await ask.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    await ask.click();
    await expect(help).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
  });
}

/** The title's own button and the close X. */
function registerTitleHelp() {
  test("the title screen has its own How to play button, and the close X works", async ({
    page,
  }) => {
    await page.goto(URL);
    await page.getByRole("button", { name: /How to play/ }).click();
    const help = page.getByRole("dialog", { name: "How to play" });
    await expect(help).toBeVisible();
    await page.getByRole("button", { name: "Close how to play" }).click();
    await expect(help).toBeHidden();
    // seen from the title: Start no longer opens it
    await page.getByRole("button", { name: "Start building", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__buddies?.phase)).toBe("playing");
    await expect(help).toBeHidden();
  });
}

/** localStorage throwing (private mode): the help still shows once and nothing errors. */
function registerBlockedStorage() {
  test("with storage blocked the help still works (shows once per visit, no errors)", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("blocked");
      };
      Storage.prototype.setItem = () => {
        throw new Error("blocked");
      };
    });
    await start(page);
    const help = page.getByRole("dialog", { name: "How to play" });
    await expect(help).toBeVisible();
    await page.getByRole("button", { name: "Let’s go!" }).click();
    await expect(help).toBeHidden();
    expect(errors).toEqual([]);
  });
}

for (const { name, viewport, touch } of VIEWPORTS) {
  test.describe(`brick-buddies help at ${name}`, () => {
    test.use({ viewport, hasTouch: touch, isMobile: touch });
    registerFirstRun();
    registerDismiss(viewport);
    registerTitleHelp();
    registerBlockedStorage();
  });
}

test.describe("brick-buddies coach (phone)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the coach says what to do next and rings the control, then a tap on the glow places the bed", async ({
    page,
  }) => {
    await start(page);
    await page.getByRole("button", { name: "Let’s go!" }).click();

    // far from the hut: walk, with the left pad ringed
    await expect(page.locator("#coachText")).toHaveText("Walk to the hut");
    await expect(page.locator("#tLeft")).toHaveClass(/coach-pulse/);
    // the simple first run: no coin / star counters, no Items menu yet
    await expect(page.locator("#buildBtn")).toBeHidden();
    await expect(page.locator(".hud-top .adv").first()).toBeHidden();

    // inside the hut: pick the bed (its hotbar slot is ringed)
    await page.evaluate(() => {
      const d = window.__buddies.debug;
      const h = d.hut();
      d.teleport(h.xL + 4.5, h.g); // inside the hut, within reach of the bed
    });
    await expect(page.locator("#coachText")).toHaveText("Pick the bed");
    await expect(page.locator("#hotbar .slot").nth(4)).toHaveClass(/coach-pulse/);
    await page.locator("#hotbar .slot").nth(4).tap();

    // the glowing spot: tapping either half of it places the bed
    await expect(page.locator("#coachText")).toHaveText("Tap the glowing spot");
    await page.waitForTimeout(900); // the camera settles, so tile -> screen is stable
    const second = await page.evaluate(() => {
      const c = window.__buddies.debug.coach();
      const t = c.tiles[1];
      return window.__buddies.debug.tileToScreen(t[0], t[1]);
    });
    await page.touchscreen.tap(second.x, second.y);
    await expect(page.locator("#coachText")).toHaveText("Pick the torch");
    expect(
      await page.evaluate(() => {
        const d = window.__buddies.debug;
        const h = d.hut();
        return d.getTile(h.xL + 2, h.g - 1).fg === d.ids.BED_L;
      }),
    ).toBe(true);
  });
});
