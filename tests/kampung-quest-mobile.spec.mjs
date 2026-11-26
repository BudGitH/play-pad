// Kampung Quest on emulated phones and a tablet: touch only (joystick, look, pinch, Run, Talk, wudu and
// prayer tiles), >= 48 px targets, no page scroll, and the low quality tier by default.
// Uses Playwright's device descriptors (isMobile + hasTouch, default device scale factor) and raw touch
// events over CDP, because page.touchscreen can only tap. Run: npm run smoke
import { test, expect, devices } from "@playwright/test";

/** A device descriptor without `defaultBrowserType` (only Chromium is installed; the engine is the same). */
function device(name) {
  const rest = { ...devices[name] };
  delete rest.defaultBrowserType;
  return rest;
}

const MIN_TARGET = 47.5;

/** Send one raw touch event. points: [{x, y}] (ids follow the order). */
async function touch(cdp, type, points) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i })),
  });
}

const kq = (page, fn, arg) => page.evaluate(fn, arg);

/** Open the game with the loop frozen (deterministic), tap Start and wait until it runs. */
async function startGame(page) {
  await page.goto("/games/kampung-quest/index.html?still=1&autoq=0");
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 60_000 }).toBe(true);
  await page.getByRole("button", { name: "Start", exact: true }).tap();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 15_000 }).toBe(true);
  await kq(page, () => window.__kq.step(300));
}

async function expectNoPageScroll(page) {
  const m = await kq(page, () => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
    sh: document.documentElement.scrollHeight,
    ih: window.innerHeight,
  }));
  expect(m.sw).toBeLessThanOrEqual(m.iw);
  expect(m.sh).toBeLessThanOrEqual(m.ih);
}

/** Every visible HUD button is at least 48 CSS px in both directions. */
async function expectTouchTargets(page) {
  const small = await kq(
    page,
    (min) => {
      const out = [];
      document.querySelectorAll("#kq button").forEach((b) => {
        const r = b.getBoundingClientRect();
        const shown = r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== "hidden";
        if (shown && (r.width < min || r.height < min)) {
          out.push((b.id || b.className) + " " + Math.round(r.width) + "x" + Math.round(r.height));
        }
      });
      return out;
    },
    MIN_TARGET,
  );
  expect(small, "buttons under 48 px").toEqual([]);
}

async function joystickPush(page, cdp, dx, dy, ms) {
  const box = await page.locator("#kqJoy").boundingBox();
  const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await touch(cdp, "touchStart", [c]);
  await touch(cdp, "touchMove", [{ x: c.x + dx, y: c.y + dy }]);
  await kq(page, (t) => window.__kq.step(t), ms);
  await touch(cdp, "touchEnd", []);
}

/** Left thumb: the joystick walks the hero; Run toggles. */
async function checkMoveAndRun(page, cdp) {
  const before = await kq(page, () => window.__kq.state().pos);
  await joystickPush(page, cdp, 0, -40, 900);
  const after = await kq(page, () => window.__kq.state().pos);
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.8);
  // a raw CDP drag leaves Chrome's tap detector one tap behind: settle it with a harmless tap on the scene
  await page.touchscreen.tap(page.viewportSize().width * 0.9, page.viewportSize().height * 0.5);
  await page.locator("#kqRun").tap();
  await expect(page.locator("#kqRun")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#kqRun").tap();
}

/** Right thumb drag turns the camera; a two-finger pinch zooms it. */
async function checkLookAndPinch(page, cdp) {
  const vw = page.viewportSize();
  const yaw0 = await kq(page, () => window.__kq.state().cam.yaw);
  const a = { x: vw.width * 0.75, y: vw.height * 0.45 };
  await touch(cdp, "touchStart", [a]);
  await touch(cdp, "touchMove", [{ x: a.x + 90, y: a.y }]);
  await touch(cdp, "touchEnd", []);
  await kq(page, () => window.__kq.step(100));
  expect(await kq(page, () => window.__kq.state().cam.yaw)).not.toBe(yaw0);
  const d0 = await kq(page, () => window.__kq.state().cam.dist);
  const mid = { x: vw.width * 0.6, y: vw.height * 0.4 };
  const pair = (gap) => [
    { x: mid.x - gap, y: mid.y },
    { x: mid.x + gap, y: mid.y },
  ];
  await touch(cdp, "touchStart", pair(25));
  await touch(cdp, "touchMove", pair(90));
  await touch(cdp, "touchEnd", []);
  await kq(page, () => window.__kq.step(100));
  expect(await kq(page, () => window.__kq.state().cam.dist)).toBeLessThan(d0);
}

/** The floating Talk button next to Nenek opens the dialogue and accepts her mission. */
async function checkTalkAndDock(page) {
  await kq(page, () => {
    const n = window.__kq.npc("nenek");
    window.__kq.place(n.x + 1.2, n.z, -Math.PI / 2);
    window.__kq.step(500);
  });
  await expect(page.locator("#kqTalk")).toBeVisible();
  await page.locator("#kqTalk").tap();
  await expect(page.getByRole("dialog", { name: /Talking to Nenek/ })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).tap();
  await page.getByRole("button", { name: /Waalaikumsalam/ }).tap();
  expect(await kq(page, () => window.__kq.state().mission?.id)).toBe("prata_for_nenek");
  await page.locator("#kqDock-missions").tap();
  await expect(page.getByRole("dialog", { name: "My missions" })).toBeVisible();
  await expectTouchTargets(page);
  await page.getByRole("button", { name: "Close" }).tap();
}

/** Azan -> wudu tiles -> one prayer step, all by touch. */
async function checkPrayer(page) {
  await kq(page, () => {
    window.__kq.forcePrayer("zohor");
    window.__kq.teleport("mosque_wudu");
  });
  await page.locator("#kqTalk").tap();
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  await expectTouchTargets(page);
  await expectNoPageScroll(page);
  for (let i = 0; i < 40; i += 1) {
    const phase = await kq(page, () => window.__kq.state().prayer.flow?.phase);
    if (phase !== "wudu") break;
    await page.locator(".kq-wudu-act").tap();
  }
  expect(await kq(page, () => window.__kq.state().prayer.flow?.phase)).toBe("pray");
  await kq(page, () => {
    window.__kq.place(-43.5, -33, -Math.PI / 2);
    window.__kq.step(500);
  });
  await page.locator("#kqTalk").tap();
  await expect(page.getByRole("dialog", { name: "Prayer steps" })).toBeVisible();
  await expectTouchTargets(page);
  const next = await kq(page, () => window.KQ.Game.S.sim.prayer.nextPrayStep().type);
  await page.locator(`.kq-ptile[data-type="${next}"]`).tap();
  expect(await kq(page, () => window.__kq.state().prayer.flow.prayIndex)).toBe(1);
}

for (const name of ["iPhone 13 landscape", "Pixel 7"]) {
  test.describe(`touch play on ${name}`, () => {
    test.use(device(name));
    test.describe.configure({ timeout: 120_000 });

    test("joystick, look, pinch, run, talk, wudu and a prayer step by touch", async ({ page }) => {
      const problems = [];
      page.on("pageerror", (e) => problems.push(e.message));
      page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
      await startGame(page);
      const cdp = await page.context().newCDPSession(page);
      // phones start on the low tier and the layout fits
      expect(await kq(page, () => window.__kq.state().quality)).toBe("low");
      await expectNoPageScroll(page);
      await expectTouchTargets(page);
      await checkMoveAndRun(page, cdp);
      await checkLookAndPinch(page, cdp);
      await checkTalkAndDock(page);
      await checkPrayer(page);
      expect(problems).toEqual([]);
    });
  });
}

for (const name of ["iPad Mini", "iPad Mini landscape", "iPhone 13", "Pixel 7 landscape"]) {
  test.describe(`layout on ${name}`, () => {
    test.use(device(name));
    test.describe.configure({ timeout: 90_000 });

    test("fits the screen with touch-sized controls", async ({ page }) => {
      await startGame(page);
      await expectNoPageScroll(page);
      await expectTouchTargets(page);
      // the touch controls are on screen, inside the visible area
      for (const id of ["#kqJoy", "#kqRun", "#kqDock-pause"]) {
        const box = await page.locator(id).boundingBox();
        const vw = page.viewportSize();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vw.width);
        expect(box.y + box.height).toBeLessThanOrEqual(vw.height);
      }
    });
  });
}
