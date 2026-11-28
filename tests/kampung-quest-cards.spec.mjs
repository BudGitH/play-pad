// Kampung Quest playability, section E (AC-P15, AC-P16): the instruction cards can be minimised.
//   AC-P15: every stepper card (wudu, prayer, tawaf ...) has a Hide button (>= 48 px, aria-label, keys H and -)
//           that turns it into a chip (step picture, short name + counter, a cue of <= 6 words) which never
//           covers the hero, the joystick, Jump or Talk; tapping / Enter / H brings the card back. The count
//           goes on while the card is minimised, and the state survives a rotation (PrayerFlow.refit).
//   AC-P16: while the game moves the hero by itself (Walk for me, the haircut scene) the card tucks itself away
//           and comes back at the next step that needs a tap (a card the child hid by hand stays hidden and the
//           chip pulses instead).
// Run: PW_PORT=5607 npx playwright test tests/kampung-quest-cards.spec.mjs --project=kampung-quest --workers=1
import { test, expect, devices } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low&region=haramain";
test.describe.configure({ mode: "serial", timeout: 240_000 });

/** A device descriptor without `defaultBrowserType` (only Chromium is installed; the engine is the same). */
function device(name) {
  const rest = { ...devices[name] };
  delete rest.defaultBrowserType;
  return rest;
}

const IPAD = { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true };
const SIZES = {
  "iPad landscape 1180x820": IPAD,
  "iPhone 13 landscape 844x390": device("iPhone 13 landscape"),
  "Pixel 7 portrait 412x915": device("Pixel 7"),
};

const problems = [];

/** Open the game in a fresh context with the loop frozen and tap Start. */
async function boot(browser, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && problems.push("console: " + m.text()));
  await page.goto(GAME);
  await expect
    .poll(() => page.evaluate(() => window.__kq?.loaded), { timeout: 150_000 })
    .toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => page.evaluate(() => window.__kq.ready), { timeout: 60_000 }).toBe(true);
  await page.evaluate(() => window.__kq.step(500));
  return page;
}

const ev = (page, fn, arg) => page.evaluate(fn, arg);
const step = (page, ms) => ev(page, (t) => window.__kq.step(t), ms);
const card = (page) => ev(page, () => window.__kq.card());
const ritual = (page) => ev(page, () => window.__kq.ritual());
const chipText = (page) => page.locator(".kq-min-chip").innerText();

/** Close everything and forget all rite and prayer progress, so each test starts clean. */
async function reset(page) {
  await ev(page, () => {
    const G = window.KQ.Game;
    if (G.RitualUI.active) G.RitualUI.active.close("test");
    G.UI.closeSheet("test");
    G.RitualTrek.stop();
    G.RitualLook.cancel();
    G.S.sim.umrah.restore(window.KQ.Sim.Umrah.create().snapshot());
    G.S.sim.prayer.cancelFlow();
    G.Player.release(G.S.player);
    window.__kq.setMinute(420);
    window.__kq.place(0, -95, 0);
  });
  await step(page, 200);
}

/** Open a rite from the dock and press Next until the wanted step is up. */
async function openRiteAt(page, rite, stepId) {
  await ev(page, (r) => window.__kq.openRite(r), rite);
  for (let i = 0; i < 80 && (await ritual(page)).step !== stepId; i += 1) {
    await page.locator(".kq-step-next").click();
  }
  expect((await ritual(page)).step).toBe(stepId);
}

const hideButton = (page) => page.getByRole("button", { name: /hide the steps/i });
const dialogs = (page) => page.locator(".kq-sheet-box[role=dialog]");

/** Both boxes as {left, top, right, bottom}; true when they overlap by even one pixel. */
const overlap = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** The hero's rough screen box (feet to head), from the camera's own projection. */
function heroBox(page) {
  return ev(page, () => {
    const G = window.KQ.Game;
    const s = G.S;
    const THREE = window.THREE;
    const pts = [0, 1.5].map((h) => {
      const v = new THREE.Vector3(s.player.pos.x, s.player.pos.y + h, s.player.pos.z);
      v.project(s.camera);
      return { x: ((v.x + 1) / 2) * s.size.w, y: ((1 - v.y) / 2) * s.size.h };
    });
    const top = Math.min(pts[0].y, pts[1].y);
    const bottom = Math.max(pts[0].y, pts[1].y);
    return { left: pts[0].x - 28, right: pts[0].x + 28, top, bottom };
  });
}

/** The screen box of the first element matching a selector, or null when it is not shown. */
function boxOf(page, selector) {
  return ev(
    page,
    (sel) => {
      const e = document.querySelector(sel);
      if (!e || e.hidden) return null;
      const r = e.getBoundingClientRect();
      const hidden = getComputedStyle(e).visibility === "hidden";
      return r.width && r.height && !hidden
        ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
        : null;
    },
    selector,
  );
}

/** Put the hero on the tawaf circle `turns` laps from the Black Stone line (anticlockwise). */
const onCircle = (p, turns) =>
  ev(
    p,
    (t) => {
      const RW = window.KQ.Sim.RitualWalk;
      const k = window.KQ.HOLY.makkah.kaaba;
      const startAngle = RW.blackStoneAngle(k);
      const at = RW.tawafRoute({ cx: k.x, cz: k.z, startAngle, radius: 14 }).at(t);
      window.__kq.place(at.x, at.z, at.heading);
    },
    turns,
  );

/** Walk with the joystick key for a moment; returns how far the hero moved (m). */
async function walkAWhile(p) {
  await ev(p, () => window.__kq.input("up", true));
  const p0 = await ev(p, () => ({ ...window.KQ.Game.S.player.pos }));
  await step(p, 600);
  await ev(p, () => window.__kq.input("up", false));
  const p1 = await ev(p, () => ({ ...window.KQ.Game.S.player.pos }));
  return Math.hypot(p1.x - p0.x, p1.z - p0.z);
}

/* ---------- iPad: the behaviour of the Hide button, per card type ---------- */

let page;

test.beforeAll(async ({ browser }) => {
  page = await boot(browser, IPAD);
});

test.afterAll(async () => {
  expect(problems, "no page errors or console errors").toEqual([]);
  await page.context().close();
});

/** Start wudu from the Pray card at the mosque: one tap, no second prompt (any prayer time will do). */
async function startWuduHere() {
  await ev(page, () => window.__kq.forcePrayer("zohor"));
  await ev(page, () => window.__kq.teleport("mosque_wudu"));
  await step(page, 300);
  await page.locator("#kqStatus").click();
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
}

/** Press the Next of the (hidden) card, as a tap on it would, and let a frame pass. */
async function tapHiddenNext() {
  await ev(page, () => window.KQ.Game.RitualUI.active.nextBtn.click());
  await step(page, 100);
}

test("wudu: Hide gives a chip with the step and counter, the card is gone, the count goes on, tap restores", async () => {
  await reset(page);
  await startWuduHere();
  const hide = hideButton(page);
  const box = await hide.boundingBox();
  expect(box.width, "Hide is >= 48 px").toBeGreaterThanOrEqual(47.5);
  expect(box.height).toBeGreaterThanOrEqual(47.5);
  await hide.click();
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toHaveCount(0);
  const chip = page.locator(".kq-min-chip");
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("Wudu");
  expect((await card(page)).minimised).toBe(true);
  const camera = await ev(page, () => window.KQ.Game.Camera.state);
  expect(camera.shiftXTarget, "the hero is centred again").toBe(0);
  const before = await chipText(page);
  await tapHiddenNext();
  await tapHiddenNext();
  expect(await chipText(page), "the chip follows the wudu").not.toBe(before);
  expect((await card(page)).minimised).toBe(true);
  await chip.click();
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  expect((await card(page)).minimised).toBe(false);
  const side = (await ev(page, () => window.KQ.Game.Camera.state)).shiftXTarget;
  expect(side, "the hero steps aside for the panel again").toBeGreaterThan(0);
});

test("Hide key while Pause is open does nothing: Pause stays, the game stays paused, the wudu progress is kept", async () => {
  await reset(page);
  await startWuduHere();
  await hideButton(page).click();
  await tapHiddenNext();
  const before = await chipText(page);
  await ev(page, () => window.__kq.action("escape")); // Pause opens over the chip
  await expect(page.getByRole("dialog", { name: /Pause|Paused/i })).toBeVisible();
  expect(await ev(page, () => window.__kq.state().paused)).toBe(true);
  await ev(page, () => window.__kq.action("hide")); // H or -
  await page.keyboard.press("h");
  await step(page, 100);
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: /Pause|Paused/i })).toBeVisible();
  expect(await ev(page, () => window.__kq.state().paused), "still paused").toBe(true);
  await ev(page, () => window.__kq.action("escape")); // close Pause
  expect((await card(page)).minimised, "the wudu card is still there, tucked away").toBe(true);
  expect(await chipText(page), "with its progress").toBe(before);
  await page.locator(".kq-min-chip").click();
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
});

test("prayer: Hide gives a 'Rakaat n/m' chip that follows the postures; tap restores", async () => {
  await reset(page);
  await startWuduHere();
  for (let i = 0; i < 60 && (await card(page)).kicker.indexOf("Wudu") === 0; i += 1) {
    await page.locator(".kq-wudu-act").click();
  }
  await expect(page.getByRole("dialog", { name: "Prayer steps" })).toBeVisible();
  await hideButton(page).click();
  const chip = page.locator(".kq-min-chip");
  await expect(chip).toContainText("Rakaat 1/");
  const before = await chipText(page);
  await tapHiddenNext();
  expect(await chipText(page), "the chip names the next posture").not.toBe(before);
  await chip.click();
  await expect(page.getByRole("dialog", { name: "Prayer steps" })).toBeVisible();
});

test("every chip cue is six words or fewer and the chip has a name for screen readers", async () => {
  await reset(page);
  await startWuduHere();
  await hideButton(page).click();
  const cue = await page.locator(".kq-min-cue").innerText();
  expect(cue.split(/\s+/).length).toBeLessThanOrEqual(6);
  expect(await page.locator(".kq-min-chip").getAttribute("aria-label")).toContain("Open the steps");
});

test("keyboard: H and - hide and show the card, Enter on the chip brings it back", async () => {
  await reset(page);
  await startWuduHere();
  await page.keyboard.press("h");
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toHaveCount(0);
  await expect(page.locator(".kq-min-chip")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  await page.keyboard.press("-");
  await expect(page.locator(".kq-min-chip")).toBeVisible();
  await page.keyboard.press("h");
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  expect((await card(page)).minimised).toBe(false);
});

test("rotating the screen keeps the card (and a minimised card stays minimised)", async () => {
  await reset(page);
  await startWuduHere();
  await page.locator(".kq-wudu-act").click(); // some progress to keep
  const kicker = (await card(page)).kicker;
  await page.setViewportSize({ width: 600, height: 900 });
  await step(page, 100);
  await expect(page.locator(".kq-sheet-bottom .kq-stepper")).toBeVisible();
  expect((await card(page)).kicker, "same card, not a rebuilt one").toBe(kicker);
  await hideButton(page).click();
  await page.setViewportSize({ width: 1180, height: 820 });
  await step(page, 100);
  expect((await card(page)).minimised, "still minimised after the rotation").toBe(true);
  await expect(page.locator(".kq-min-chip")).toBeVisible();
  await page.locator(".kq-min-chip").click();
  await expect(page.locator(".kq-sheet-side .kq-stepper")).toBeVisible();
  expect((await card(page)).kicker).toBe(kicker);
});

test("tawaf: Hide, then walk the round by hand: the chip counts, the card stays hidden until the step needs a tap", async () => {
  await reset(page);
  await openRiteAt(page, "umrah", "tawaf");
  await hideButton(page).click();
  await expect(dialogs(page)).toHaveCount(0);
  const chip = page.locator(".kq-min-chip");
  await expect(chip).toContainText("Tawaf");
  await expect(chip).toContainText("0/7");
  expect((await ritual(page)).minimised).toBe(true);
  expect((await ritual(page)).guide.visible, "the dotted guide stays up").toBe(true);
  // the hero is free to walk now: the joystick is shown and the world takes input
  expect(await boxOf(page, ".kq-joy")).not.toBeNull();
  expect(await walkAWhile(page), "the hero walks while the card is a chip").toBeGreaterThan(0.5);
  // a round walked by hand is counted
  for (const t of [0, 0.25, 0.5, 0.75, 1.0, 1.02]) {
    await onCircle(page, t);
    await step(page, 300);
  }
  expect((await ritual(page)).count, "round one is counted while minimised").toBe(1);
  await expect(chip).toContainText("1/7");
  expect((await ritual(page)).minimised).toBe(true);
  await chip.click();
  await expect(page.getByRole("dialog", { name: "Umrah steps" })).toBeVisible();
});

test("Walk for me tucks the card away by itself, then brings it back at the next tap", async () => {
  await reset(page);
  await openRiteAt(page, "umrah", "tawaf");
  await page.getByRole("button", { name: "Walk for me" }).click();
  await step(page, 400);
  await expect(dialogs(page)).toHaveCount(0);
  expect(await card(page)).toMatchObject({ minimised: true, by: "game", busy: true });
  await expect(page.locator(".kq-min-chip")).toContainText("Walking for you");
  const p0 = await ev(page, () => ({ ...window.KQ.Game.S.player.pos }));
  await step(page, 4000);
  const p1 = await ev(page, () => ({ ...window.KQ.Game.S.player.pos }));
  expect(Math.hypot(p1.x - p0.x, p1.z - p0.z), "the hero strolls on").toBeGreaterThan(3);
  expect((await ritual(page)).auto).toBe(true);
  // the child can still take over: the chip opens the card, whose Stop button ends the walk
  await page.locator(".kq-min-chip").click();
  await expect(page.getByRole("button", { name: "Stop walking" })).toBeVisible();
  expect((await card(page)).minimised).toBe(false);
  await page.getByRole("button", { name: "Stop walking" }).click();
  await step(page, 200);
  expect(await ritual(page)).toMatchObject({ auto: false, minimised: false });
  // and the walk that ends by itself brings the card back: finish all 7 rounds the quick way
  await page.getByRole("button", { name: "Walk for me" }).click();
  await step(page, 400);
  expect((await card(page)).minimised).toBe(true);
  await ev(page, () => window.KQ.Game.RitualTrek.stopAuto());
  await step(page, 200);
  expect((await card(page)).minimised, "the card is back when the walking stops").toBe(false);
  await expect(page.getByRole("dialog", { name: "Umrah steps" })).toBeVisible();
});

test("a card the child hid by hand stays hidden when the walk ends, and the chip pulses", async () => {
  await reset(page);
  await openRiteAt(page, "umrah", "tawaf");
  await page.getByRole("button", { name: "Walk for me" }).click();
  await step(page, 400);
  expect((await card(page)).by).toBe("game");
  // make it the child's choice: restore, then hide by hand, then let the walk stop
  await page.locator(".kq-min-chip").click();
  await hideButton(page).click();
  expect((await card(page)).by).toBe("child");
  // The pulse lasts 2.6 s of REAL time: read the card in the same task as the frames that raise it, as a
  // drawn step() on a slow runner can outlast it before the next call reaches the page.
  const after = await ev(page, () => {
    window.KQ.Game.RitualTrek.stopAuto();
    for (let i = 0; i < 6; i += 1) window.KQ.Game.Loop.frame(1 / 30, true);
    return window.__kq.card();
  });
  expect(after.minimised, "stays minimised").toBe(true);
  expect(after.pulsing, "the chip pulses to say it is your turn").toBe(true);
  await page.locator(".kq-min-chip").click();
});

test("the haircut scene (a do-it-for-me moment) tucks the card away and returns it afterwards", async () => {
  await reset(page);
  await openRiteAt(page, "umrah", "tahallul");
  await page.getByRole("button", { name: "Trim" }).click();
  await step(page, 300);
  expect(await card(page)).toMatchObject({ minimised: true, by: "game" });
  await step(page, 4000);
  expect((await ritual(page)).cutting).toBe(false);
  expect((await card(page)).minimised, "back for the next tap").toBe(false);
  await expect(page.getByRole("dialog", { name: "Umrah steps" })).toBeVisible();
});

test("I'll walk myself tucks the card into the chip and it returns when the legs are counted", async () => {
  await reset(page);
  await openRiteAt(page, "umrah", "sai");
  await page.getByRole("button", { name: "I'll walk myself" }).click();
  await expect(dialogs(page)).toHaveCount(0);
  await expect(page.locator(".kq-min-chip")).toContainText("Sa'i");
  await ev(page, () => window.__kq.place(42, -39, 0));
  for (let i = 0; i < 7; i += 1) {
    await step(page, 200);
    await ev(page, (z) => window.__kq.place(42, z, 0), i % 2 === 0 ? 39 : -39);
  }
  await step(page, 200);
  expect(await ritual(page)).toMatchObject({ count: 7, open: true, minimised: false });
  await expect(page.getByRole("dialog", { name: "Umrah steps" })).toBeVisible();
});

test("Not now on a rite closes the card but keeps the same chip, which brings it back", async () => {
  await reset(page);
  await openRiteAt(page, "umrah", "tawaf");
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(dialogs(page)).toHaveCount(0);
  await expect(page.locator(".kq-min-chip")).toContainText("Tawaf 0/7");
  expect(await ritual(page)).toMatchObject({ open: false, chip: true });
  await page.locator(".kq-min-chip").click();
  await expect(page.getByRole("dialog", { name: "Umrah steps" })).toBeVisible();
  await expect(page.locator(".kq-min-chip")).toHaveCount(0);
});

test("the dock's Pray button brings a hidden card back instead of starting a second one", async () => {
  await reset(page);
  await startWuduHere();
  await hideButton(page).click();
  await page.locator("#kqStatus").click();
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Prayer" })).toHaveCount(0);
});

/* ---------- the three screens: the chip never covers the hero or a control ---------- */

const HUD_BOXES = [
  ".kq-joy",
  ".kq-jumpbtn",
  ".kq-dock",
  ".kq-status",
  ".kq-mission",
  ".kq-topright",
];

/** The chip is on screen, a 48 px target, and clear of the hero and every HUD control. */
async function expectChipClear(p, chip) {
  const vp = await ev(p, () => ({ w: innerWidth, h: innerHeight }));
  expect(chip.left).toBeGreaterThanOrEqual(0);
  expect(chip.right).toBeLessThanOrEqual(vp.w);
  expect(chip.top).toBeGreaterThanOrEqual(0);
  expect(chip.bottom).toBeLessThanOrEqual(vp.h);
  expect(chip.bottom - chip.top, "a 48 px target").toBeGreaterThanOrEqual(47.5);
  const hero = await heroBox(p);
  expect(overlap(chip, hero), "not on the hero " + JSON.stringify({ chip, hero })).toBe(false);
  for (const sel of HUD_BOXES) {
    const b = await boxOf(p, sel);
    if (b) expect(overlap(chip, b), `chip vs ${sel} ${JSON.stringify({ chip, b })}`).toBe(false);
  }
}

/** Show the Action control (it has one fixed place, above Jump) and return where it sits. */
function actionBox(p) {
  return ev(p, () => {
    const t = window.KQ.Game.Hud.refs.talk;
    t.hidden = false;
    const r = t.getBoundingClientRect();
    t.hidden = true;
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
}

for (const [name, opts] of Object.entries(SIZES)) {
  test(`${name}: a minimised tawaf chip overlaps neither the hero, the joystick, Jump, Talk, the dock nor the HUD`, async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const p = await boot(browser, opts);
    await ev(p, () => window.__kq.place(0, -95, 0));
    await openRiteAt(p, "umrah", "tawaf");
    await p.getByRole("button", { name: /hide the steps/i }).click();
    await step(p, 400);
    const chip = await boxOf(p, ".kq-min-chip");
    expect(chip, "the chip is shown").not.toBeNull();
    await expectChipClear(p, chip);
    expect(overlap(chip, await actionBox(p)), "the Action control keeps clear of the chip").toBe(
      false,
    );
    await ev(p, () => window.KQ.Game.UI.toast("A toast for the lane", "good", 6000));
    await step(p, 200);
    const toast = await boxOf(p, ".kq-toast");
    if (toast) expect(overlap(chip, toast), "toast clear of the chip").toBe(false);
    await p.context().close();
  });
}
