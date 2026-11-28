// Kampung Quest on iPad (AC-P21..P23, features/kampung-quest-playability/notes-ipad.md).
// iPadOS 13+ Safari asks for desktop sites: it reports a "Macintosh" user agent and platform
// "MacIntel", and only its touch points give it away; with a Magic Keyboard / trackpad it may even
// report `pointer: fine`. These tests emulate that (Chromium device emulation + an init script for
// navigator.platform / maxTouchPoints), so they prove the detection and the boot pipeline, not real
// iPad GPU or memory behaviour.
//   - an iPad (touch, Mac UA) gets touch controls, the low tier and a pixel ratio of at most 1
//   - an iPad with a keyboard (fine pointer, no emulated touch, Mac UA + touch points) still gets touch controls
//   - a real Mac (no touch points) does not
//   - the loading bar moves through real stages; no console errors
//   - the first frames after Start have no one-off stall (frame times relative to their median,
//     so software GL in CI does not flake), the deferred queue drains, posture pictures exist
//   - WebGL context loss shows the friendly card, restore hides it
// @slow: the 4x CPU-throttled load (time to Start enabled; the deferred queue drains).
import { test, expect, devices } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html";
const IPADOS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const kq = (page, fn, arg) => page.evaluate(fn, arg);

function ipad(name) {
  const d = { ...devices[name] };
  delete d.defaultBrowserType;
  return { ...d, userAgent: IPADOS_UA };
}

/** iPadOS navigator facts, plus a recorder of the loading bar's values. */
function fakeIpadOs(touchPoints) {
  Object.defineProperty(navigator, "platform", { get: () => "MacIntel", configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", {
    get: () => touchPoints,
    configurable: true,
  });
  window.__bar = [];
  const timer = setInterval(() => {
    const bar = document.querySelector("#kqTitle .kq-progress");
    if (!bar) return;
    const v = bar.getAttribute("aria-valuenow");
    if (window.__bar[window.__bar.length - 1] !== v) window.__bar.push(v);
    if (v === "100") clearInterval(timer);
  }, 20);
}

function watchProblems(page) {
  const problems = [];
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && problems.push("console: " + m.text()));
  return problems;
}

async function load(page, query = "?still=1&autoq=0") {
  await page.goto(GAME + query);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
}

async function start(page) {
  await page.locator("#kqStart").click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
}

/** Detected as an iPad tablet; the bar went through several real stages in order; boot marks exist. */
async function expectTabletAndProgress(page) {
  const env = await kq(page, () => ({ ...window.KQ.Game.Env }));
  expect(env.ipad).toBe(true);
  expect(env.tablet).toBe(true);
  expect(env.coarse).toBe(true);
  const bar = (await kq(page, () => window.__bar)).map(Number);
  expect(bar.length).toBeGreaterThanOrEqual(4);
  expect(bar).toEqual([...bar].sort((a, b) => a - b));
  const marks = await kq(page, () => window.KQ.Game.BootPerf.timings.map((t) => t[0]));
  for (const m of ["world", "actors", "textures-uploaded", "shaders", "ready"])
    expect(marks).toContain(m);
}

/** Posture pictures still queued wait while the game is played, and finish behind the pause menu. */
async function expectDeferredBehindPause(page) {
  await kq(page, () => window.KQ.Game.Loop.setPaused(true));
  await expect
    .poll(() => kq(page, () => window.KQ.Game.Defer.stats().pending), { timeout: 60_000 })
    .toBe(0);
  expect(await kq(page, () => window.KQ.Game.Pictures.posturesReady())).toBe(true);
  await kq(page, () => window.KQ.Game.Loop.setPaused(false));
}

const touchShown = (page) =>
  kq(page, () => getComputedStyle(document.querySelector(".kq-touch")).display !== "none");

test.describe("iPad (touch, iPadOS desktop UA)", () => {
  test.use(ipad("iPad Pro 11 landscape"));
  test.describe.configure({ timeout: 150_000 });

  test("AC-P21/P22/P23: detected as a touch tablet, low tier, real progress, no stall after Start", async ({
    page,
  }) => {
    await page.addInitScript(fakeIpadOs, 5);
    const problems = watchProblems(page);
    await load(page);
    await expectTabletAndProgress(page);
    await start(page);
    expect(await kq(page, () => window.__kq.state().quality)).toBe("low");
    expect(await kq(page, () => window.KQ.Game.S.renderer.getPixelRatio())).toBeLessThanOrEqual(1);
    expect(await touchShown(page)).toBe(true);
    await expect(page.locator("#kqJoy")).toBeVisible();
    await expectNoStall(page);
    await expectDeferredBehindPause(page);
    expect(problems).toEqual([]);
  });

  test("AC-P23: a lost WebGL context shows the friendly card; restoring it closes the card", async ({
    page,
  }) => {
    await page.addInitScript(fakeIpadOs, 5);
    await load(page);
    await start(page);
    await kq(page, () => {
      window.__lose = window.KQ.Game.S.renderer.getContext().getExtension("WEBGL_lose_context");
      window.__lose.loseContext();
    });
    await expect(page.locator("#kqLost")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    expect(await kq(page, () => window.KQ.Game.S.paused)).toBe(true);
    await kq(page, () => window.__lose.restoreContext());
    await expect(page.locator("#kqLost")).toBeHidden();
    expect(await kq(page, () => window.KQ.Game.S.paused)).toBe(false);
  });
});

/**
 * Time the first 24 frames after Start one by one. Software GL makes every frame slow, so the
 * check is relative: no single frame may take more than 3x the median frame plus 150 ms (a
 * one-off stall: a texture upload, a shader compile, a first crowd layout, posture renders).
 */
async function expectNoStall(page) {
  const times = [];
  for (let i = 0; i < 24; i += 1) {
    times.push(
      await kq(page, () => {
        const t0 = performance.now();
        window.KQ.Game.Loop.frame(1 / 30, false);
        return performance.now() - t0;
      }),
    );
  }
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const worst = sorted[sorted.length - 1];
  test.info().annotations.push({
    type: "first frames after Start (ms)",
    description: `median ${median.toFixed(0)}, worst ${worst.toFixed(0)}`,
  });
  expect(worst, `frames: ${times.map((t) => t.toFixed(0)).join(",")}`).toBeLessThanOrEqual(
    3 * median + 150,
  );
}

test.describe("iPad with a Magic Keyboard (fine pointer, touch points)", () => {
  test.use({ viewport: { width: 1180, height: 820 }, userAgent: IPADOS_UA });
  test.describe.configure({ timeout: 120_000 });

  test("AC-P21: still gets the touch controls and the low tier", async ({ page }) => {
    await page.addInitScript(fakeIpadOs, 5);
    const problems = watchProblems(page);
    await load(page);
    await start(page);
    expect(await kq(page, () => matchMedia("(pointer: fine)").matches)).toBe(true);
    expect(await kq(page, () => window.KQ.Game.Env.ipad)).toBe(true);
    expect(await touchShown(page)).toBe(true);
    expect(await kq(page, () => window.__kq.state().quality)).toBe("low");
    expect(await kq(page, () => getComputedStyle(document.querySelector(".kq-keys")).display)).toBe(
      "none",
    );
    expect(problems).toEqual([]);
  });
});

test.describe("a Mac (Mac UA, no touch points)", () => {
  test.use({ viewport: { width: 1280, height: 800 }, userAgent: IPADOS_UA });

  test("is not taken for an iPad: keyboard hints, no touch controls", async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(fakeIpadOs, 0);
    await load(page);
    await start(page);
    expect(await kq(page, () => window.KQ.Game.Env.ipad)).toBe(false);
    expect(await touchShown(page)).toBe(false);
  });
});

test.describe("iPad at a 4x CPU throttle", () => {
  test.use(ipad("iPad (gen 7)"));

  test("AC-P22 @slow boot to Start enabled, then the deferred work finishes behind the pause menu", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await page.addInitScript(fakeIpadOs, 5);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(GAME);
    await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 540_000 }).toBe(true);
    const t = await kq(page, () => window.KQ.Game.BootPerf.timings);
    const ready = t.find((x) => x[0] === "ready")[1];
    await start(page);
    await kq(page, () => window.KQ.Game.Loop.setPaused(true)); // posture pictures run behind the pause
    await expect
      .poll(() => kq(page, () => window.KQ.Game.Defer.stats().pending), { timeout: 120_000 })
      .toBe(0);
    const defer = await kq(page, () => window.KQ.Game.Defer.stats());
    console.log("[AC-P22] iPad gen 7 @4x: Start enabled at", ready, "ms; defer", defer);
    test.info().annotations.push({ type: "start enabled @4x (ms)", description: String(ready) });
    // Before this round the same profile took ~33 s (notes-ipad.md); leave room for a busy CI box.
    expect(ready).toBeLessThan(30_000);
  });
});
