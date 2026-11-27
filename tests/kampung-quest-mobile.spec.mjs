// Kampung Quest on emulated phones and a tablet: touch only (joystick, look, pinch, Run, Talk, wudu and
// prayer tiles), >= 48 px targets, no page scroll, and the low quality tier by default.
// Uses Playwright's device descriptors (isMobile + hasTouch, default device scale factor) and raw touch
// events over CDP, because page.touchscreen can only tap. Run: npm run smoke
// The HUD layout block (bottom of the file) checks, on every phone / tablet / desktop size, that no HUD
// box covers another, that toasts and the Talk button stay clear of the HUD, that the azan card / pill
// never covers the Talk button (a hit-test, A11Y2-01), that every sheet's Close button is on screen and
// a tap on the backdrop closes it (A11Y2-02), that toasts stay off an open sheet (A11Y2-05), that the
// pause dialog's controls fit (A11Y2-09) and that the wudu tiles are >= 48 px wide (A11Y2-03); plus the
// 48 px rule, contrast, announcements and focus.
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
  await page.touchscreen.tap(page.viewportSize().width * 0.5, page.viewportSize().height * 0.5);
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
  await page.getByRole("button", { name: "Next", exact: true }).tap();
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

/** R3-Q-02: on a phone the folded mission card peeks open for a new mission or step, not for every collected can. */
test.describe("mission card peek (R3-Q-02)", () => {
  test.use(device("iPhone 13 landscape"));
  test.describe.configure({ timeout: 120_000 });
  test("a new mission peeks; a collected can does not; the next step does", async ({ page }) => {
    await startGame(page);
    const mission = page.locator("#kqMission");
    await kq(page, () => {
      window.KQ.Game.S.sim.missions.accept("recycling_hero");
      window.__kq.step(300);
    });
    await expect(mission, "a new mission peeks").toHaveClass(/is-open/);
    await mission.click();
    await expect(mission).not.toHaveClass(/is-open/);
    await kq(page, () => {
      window.KQ.Game.MissionFlow.notify({ type: "collect", target: "park", item: "can" });
      window.__kq.step(300);
    });
    await expect(mission, "one more can: same step, no peek").not.toHaveClass(/is-open/);
    await kq(page, () => {
      const MF = window.KQ.Game.MissionFlow;
      MF.notify({ type: "collect", target: "park", item: "can" });
      MF.notify({ type: "collect", target: "park", item: "can" });
      window.__kq.step(300);
    });
    await expect(mission, "the next step peeks").toHaveClass(/is-open/);
  });
});

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

// ---------------------------------------------------------------------------------------------
// HUD layout, accessibility and credits, on every size the game must work on.
// ---------------------------------------------------------------------------------------------

/** [name, width, height, touch]. 568x280 is the shortest phone-landscape, 320x568 the narrowest portrait. */
const SIZES = [
  ["iphone13-portrait", 390, 844, true],
  ["iphone13-landscape", 844, 390, true],
  ["iphone13-landscape-notch", 750, 342, true],
  ["pixel7-portrait", 412, 915, true],
  ["pixel7-landscape", 915, 412, true],
  ["ipad-portrait", 820, 1180, true],
  ["ipad-landscape", 1180, 820, true],
  ["desktop", 1280, 720, false],
  ["narrow-phone", 360, 740, true],
  ["android-portrait-360", 360, 640, true],
  ["small-phone-portrait-320", 320, 568, true],
  ["small-phone-landscape", 568, 320, true],
  ["short-phone-landscape", 568, 280, true],
  ["short-phone-landscape-wide", 667, 280, true],
  ["iphone-se-landscape", 667, 375, true],
  ["short-phone-landscape-640x300", 640, 300, true],
];

/** Boxes of every visible HUD piece that must not cover another (the outermost ones). */
function hudBoxes(page) {
  return kq(page, () => {
    const sel = [
      "#kq .kq-hud button",
      "#kq .kq-hud [tabindex='0']",
      ".kq-mission",
      ".kq-coins",
      ".kq-needchip",
      ".kq-joy",
      ".kq-azan",
      ".kq-toast",
      ".kq-talk",
    ].join(",");
    const name = (e) => e.id || e.className.toString().split(" ").slice(0, 2).join(".");
    const list = Array.from(document.querySelectorAll(sel)).filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
    });
    return list
      .filter((e) => !list.some((o) => o !== e && o.contains(e)))
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { name: name(e), x: r.left, y: r.top, r: r.right, b: r.bottom };
      });
  });
}

/** Fails with the names of every pair of boxes that overlap by more than a pixel. */
function overlapsOf(boxes) {
  const out = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x);
      const oy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) out.push(`${a.name} x ${b.name} (${Math.round(ox)}x${Math.round(oy)})`);
    }
  }
  return out;
}

async function expectHudClear(page, label) {
  const boxes = await hudBoxes(page);
  const vw = page.viewportSize();
  const outside = boxes.filter(
    (b) => b.x < -0.5 || b.y < -0.5 || b.r > vw.width + 0.5 || b.b > vw.height + 0.5,
  );
  expect(
    outside.map((b) => b.name),
    `${label}: outside the viewport`,
  ).toEqual([]);
  expect(overlapsOf(boxes), `${label}: overlapping HUD boxes`).toEqual([]);
}

async function startAt(page, size) {
  await page.goto("/games/kampung-quest/index.html?still=1&autoq=0");
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 60_000 }).toBe(true);
  // A11Y-12: Start has keyboard focus as soon as it enables
  expect(await kq(page, () => document.activeElement?.id)).toBe("kqStart");
  await page.locator("#kqStart").click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 15_000 }).toBe(true);
  await kq(page, () => window.__kq.step(300));
  void size;
}

/** Stand next to Nenek (the Talk button shows), or 5 m away (the "Walk closer" bubble). */
function standByNenek(page, metres) {
  return kq(
    page,
    (m) => {
      const n = window.__kq.npc("nenek");
      window.__kq.place(n.x + m, n.z, -Math.PI / 2);
      window.__kq.step(500);
    },
    metres,
  );
}

const toast = (page, text) =>
  kq(page, (t) => (window.KQ.Game.UI.toast(t, "good", 60_000), window.__kq.step(100)), text);

/** The longest toast the game shows (the qada hint): the worst case for a narrow toast lane. */
const LONG_TOAST = "Zohor time has passed. You can make it up (qada) any time. No rush.";

/** A11Y3-03: every dock label fits inside its button. A11Y3-02: the status card's spoken label names each prayer's state. */
async function expectDockLabelsAndPrayerStates(page) {
  const wide = await kq(page, () =>
    Array.from(document.querySelectorAll(".kq-dock-btn")).flatMap((b) => {
      const label = b.querySelector("span");
      const w = label.getBoundingClientRect().width;
      return w > b.clientWidth + 0.5 ? [label.textContent + " " + w + ">" + b.clientWidth] : [];
    }),
  );
  expect(wide, "dock labels wider than their button").toEqual([]);
  const spoken = await kq(page, () =>
    document.querySelector("#kqStatus").getAttribute("aria-label"),
  );
  expect(spoken).toMatch(
    /Prayers: Subuh [\w ]+, Zohor [\w ]+, Asar [\w ]+, Maghrib [\w ]+, Isyak [\w ]+\./,
  );
}

/** A11Y-06: the five prayers (icons and labels) sit inside the status card. */
async function expectPrayerStripInCard(page) {
  const out = await kq(page, () => {
    const card = document.querySelector(".kq-status").getBoundingClientRect();
    const bad = [];
    document.querySelectorAll(".kq-prayer").forEach((p) => {
      [p, p.lastElementChild].forEach((e) => {
        const r = e.getBoundingClientRect();
        if (r.left < card.left - 0.5 || r.right > card.right + 0.5) bad.push(e.textContent);
      });
    });
    return bad;
  });
  expect(out, "prayer strip outside its card").toEqual([]);
}

/** A11Y-09: no text under 12 px anywhere in the HUD. */
async function expectNoTinyText(page) {
  const tiny = await kq(page, () => {
    const out = [];
    document.querySelectorAll("#kq *").forEach((e) => {
      const direct = Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
      const r = e.getBoundingClientRect();
      if (direct && r.width > 0 && parseFloat(getComputedStyle(e).fontSize) < 12)
        out.push(e.textContent);
    });
    return out;
  });
  expect(tiny, "text under 12 px").toEqual([]);
}

/** True when the phone ("lite") HUD is on: short landscape or narrow portrait (same query as styles.css). */
const isCompact = (page) =>
  kq(
    page,
    () =>
      window.matchMedia("(max-height: 520px), (orientation: portrait) and (max-width: 700px)")
        .matches,
  );

/** A11Y2-04: the status card and the mission chip fold; a tap opens each, and nothing then overlaps. */
async function checkFoldingCards(page) {
  if (!(await isCompact(page))) return;
  for (const [sel, label] of [
    ["#kqMission", "mission"],
    ["#kqStatus", "status"],
  ]) {
    await page.locator(sel).click();
    await expect(page.locator(sel), `${label} opens on a tap`).toHaveClass(/is-open/);
    await kq(page, () => window.__kq.step(100));
    await expectHudClear(page, `${label} card open`);
    await expectPrayerStripInCard(page);
    await page.locator(sel).click();
    await expect(page.locator(sel), `${label} folds on a second tap`).not.toHaveClass(/is-open/);
  }
}

/** The centre and four inset points of `sel` all land on `sel` itself: nothing covers it (a hit-test). */
async function expectNotCovered(page, sel, label) {
  const hits = await kq(
    page,
    (q) => {
      const el = document.querySelector(q);
      const r = el.getBoundingClientRect();
      return [
        [0.5, 0.5],
        [0.2, 0.2],
        [0.8, 0.2],
        [0.2, 0.8],
        [0.8, 0.8],
      ].map(([fx, fy]) => {
        const top = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
        return el.contains(top) ? "ok" : (top && (top.id || top.className.toString())) || "nothing";
      });
    },
    sel,
  );
  expect(hits, `${label}: ${sel} is covered`).toEqual(["ok", "ok", "ok", "ok", "ok"]);
}

/**
 * Show the azan with the hero at the wudu taps (so the primary "Take wudu" Talk button is up).
 * The setMinute hook can drop the card when the free-running loop has moved the clock a few seconds past
 * the target (QA ACC2-01, in hooks.js), so retry from a minute earlier instead of failing the layout test.
 */
async function showAzanAtWudu(page) {
  await kq(page, () => window.__kq.teleport("mosque_wudu"));
  for (let i = 0; i < 4; i += 1) {
    await kq(
      page,
      (n) => {
        window.__kq.setMinute(773 - n);
        window.__kq.setMinute(774);
        window.__kq.step(1500);
      },
      i,
    );
    if (await kq(page, () => window.__kq.state().ui.azanCard)) break;
  }
  await expect(page.locator("#kqAzan")).toBeVisible();
  await expect(page.locator("#kqTalk")).toBeVisible();
}

/** A11Y2-01 / 08: the azan card and then its pill never cover or touch the Talk button or any HUD box. */
async function checkAzan(page) {
  await showAzanAtWudu(page);
  await toast(page, "Nenek is waiting by your block. Walk to her and press Talk.");
  await expectHudClear(page, "azan card + toast + Talk");
  await expectNotCovered(page, "#kqTalk", "azan card");
  await kq(page, () => window.KQ.Game.PrayerFlow.collapse());
  await kq(page, () => window.__kq.step(300));
  await expect(page.locator("#kqAzan")).toHaveClass(/is-bar/);
  await expectHudClear(page, "azan pill + toast + Talk");
  await expectNotCovered(page, "#kqTalk", "azan pill");
}

/** Every button of the open sheet is on screen; Close is not clipped by the sheet and nothing covers it. */
async function expectSheetOnScreen(page, label) {
  const bad = await kq(page, () => {
    const box = document.querySelector(".kq-sheet-box");
    const bx = box.getBoundingClientRect();
    const out = [];
    box.querySelectorAll("button").forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width === 0) return;
      const off = r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5;
      const clipped = r.left < bx.left - 0.5 || r.right > bx.right + 0.5;
      if (off || clipped) out.push((b.getAttribute("aria-label") || b.textContent).slice(0, 20));
    });
    if (box.scrollWidth > box.clientWidth + 1) out.push("sheet scrolls sideways");
    return out;
  });
  expect(bad, `${label}: sheet controls off screen`).toEqual([]);
  const close = page.getByRole("dialog").getByRole("button", { name: "Close" });
  if (await close.count())
    await expectNotCovered(page, ".kq-sheet-box button[aria-label=Close]", label);
}

const modalName = (page) => kq(page, () => window.__kq.state().ui.modal);

/** A11Y2-02: each sheet's Close is reachable, and a tap on the dimmed backdrop closes it. */
async function checkSheetsClose(page) {
  const open = {
    "stall sheet": async () => {
      await kq(page, () => {
        window.__kq.teleport("stall_prata");
        window.__kq.step(300);
        window.__kq.interact();
      });
    },
    "missions sheet": () => page.locator("#kqDock-missions").click(),
    "bag sheet": () => page.locator("#kqDock-bag").click(),
    "map sheet": () => page.locator("#kqDock-map").click(),
  };
  for (const [label, run] of Object.entries(open)) {
    await run();
    expect(await modalName(page), `${label} opens`).not.toBeNull();
    await expectSheetOnScreen(page, label);
    await expectTouchTargets(page);
    await page.mouse.click(3, 3);
    expect(await modalName(page), `${label}: a tap on the backdrop closes it`).toBeNull();
  }
}

/** A11Y2-05: a toast raised while a sheet is open is held back, and shows after the sheet closes. */
async function checkToastHeldBack(page) {
  await page.locator("#kqDock-bag").click();
  await kq(page, () => window.KQ.Game.UI.toast("Held back while the bag is open", "good", 60_000));
  expect(
    await kq(page, () => getComputedStyle(document.querySelector("#kqToasts")).visibility),
  ).toBe("hidden");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".kq-toast")).toContainText("Held back while the bag is open");
  await kq(page, () => document.querySelectorAll(".kq-toast").forEach((t) => t.remove()));
  expect(
    await kq(page, () => getComputedStyle(document.querySelector("#kqToasts")).visibility),
  ).toBe("visible");
}

/** A11Y2-09: the pause dialog (four-option picture quality) fits; a backdrop tap does not resume. */
async function checkPauseFits(page) {
  await page.locator("#kqDock-pause").click();
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  await expectSheetOnScreen(page, "pause dialog");
  await expectTouchTargets(page);
  await page.mouse.click(3, 3);
  expect(await modalName(page), "pause stays open on a stray tap").toBe("Paused");
  await page.getByRole("button", { name: "Resume" }).click();
  expect(await modalName(page)).toBeNull();
}

/** A11Y2-03: Talk starts wudu; its step tiles are >= 48 px wide (every button is) and fully on screen. */
async function checkWuduTiles(page) {
  await page.locator("#kqTalk").click();
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  await expectTouchTargets(page);
  await expectSheetOnScreen(page, "wudu sheet");
  const widths = await kq(page, () =>
    Array.from(document.querySelectorAll(".kq-wtile")).map((t) => t.getBoundingClientRect().width),
  );
  expect(widths.length).toBeGreaterThanOrEqual(12);
  expect(Math.min(...widths), "narrowest wudu tile").toBeGreaterThanOrEqual(MIN_TARGET);
  await expectNoPageScroll(page);
}

for (const [name, width, height, touch] of SIZES) {
  test.describe(`HUD layout ${name} ${width}x${height}`, () => {
    test.use({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
      deviceScaleFactor: 1,
    });
    test.describe.configure({ timeout: 180_000 });

    test("no HUD box covers another; toast, Talk, azan stay clear; sheets and wudu fit", async ({
      page,
    }) => {
      await startAt(page, name);
      await expectNoPageScroll(page);
      await expectHudClear(page, "exploring");
      await expectPrayerStripInCard(page);
      await expectNoTinyText(page);
      await expectDockLabelsAndPrayerStates(page);
      await checkFoldingCards(page);
      // needs at 100: the two chips do not touch
      await kq(page, () => {
        window.KQ.Game.S.sim.needs.restore({ hunger: 100, energy: 100 });
        window.__kq.step(300);
      });
      await expectHudClear(page, "needs at 100");
      // a toast (the longest one) and the Talk button next to Nenek
      await standByNenek(page, 1.2);
      await toast(page, LONG_TOAST);
      await expect(page.locator("#kqTalk")).toBeVisible();
      await expectHudClear(page, "toast + Talk");
      // the disabled "Walk closer" bubble
      await standByNenek(page, 5);
      await expectHudClear(page, "toast + Walk closer");
      await kq(page, () => document.querySelectorAll(".kq-toast").forEach((t) => t.remove()));
      // sheets: Close on screen, backdrop tap, toasts held back, the pause dialog
      await checkSheetsClose(page);
      await checkToastHeldBack(page);
      await checkPauseFits(page);
      // the azan card, then its pill: the "Take wudu" Talk button is never covered; then wudu by that tap
      await checkAzan(page);
      await checkWuduTiles(page);
    });
  });
}

/** WCAG relative luminance contrast of two "rgb(...)" / "color(srgb ...)" strings. */
function contrast(fg, bg) {
  const parse = (c) => {
    const n = c.match(/[\d.]+/g).map(Number);
    return c.startsWith("color(") ? n.slice(-4, -1).map((v) => v * 255) : n.slice(0, 3);
  };
  const lum = (c) => {
    const [r, g, b] = parse(c).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const colours = (page, sel) =>
  kq(
    page,
    (q) => {
      const e = document.querySelector(q);
      return [
        getComputedStyle(e).color,
        getComputedStyle(e.closest("button") || e).backgroundColor,
      ];
    },
    sel,
  );

test.describe("accessibility: contrast (A11Y-05)", () => {
  test.use({ ...device("iPhone 13 landscape"), deviceScaleFactor: 1 });
  test.describe.configure({ timeout: 120_000 });

  test("action buttons have AA contrast (A11Y-05)", async ({ page }) => {
    await startAt(page, "iphone");
    await standByNenek(page, 1.2);
    const [fg, bg] = await colours(page, ".kq-talk-label");
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    await page.locator("#kqTalk").tap();
    for (const sel of [".kq-bubble-actions .kq-btn.primary"]) {
      const [f, b] = await colours(page, sel);
      expect(contrast(f, b), sel).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe("accessibility: pause dialog and credits (A11Y-08, COMP-002)", () => {
  test.use({ ...device("iPhone 13 landscape"), deviceScaleFactor: 1 });
  test.describe.configure({ timeout: 120_000 });

  test("pause dialog: every button >= 48 px; Credits shows the azan attribution (A11Y-08, COMP-002)", async ({
    page,
  }) => {
    await startAt(page, "iphone");
    await page.locator("#kqDock-pause").tap();
    const pauseDialog = page.getByRole("dialog", { name: "Paused" });
    await expect(pauseDialog).toBeVisible();
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Credits" }).tap();
    const credits = page.getByRole("dialog", { name: "Credits" });
    await expect(credits).toBeVisible();
    for (const text of [
      "Atcovi",
      "CC BY-SA 4.0",
      "The Adhan - Muslim Call to Prayer",
      "ambientCG",
      "MUIS",
    ]) {
      await expect(credits).toContainText(text);
    }
    await expect(credits.getByRole("link", { name: /commons\.wikimedia\.org/ })).toBeVisible();
    await expectTouchTargets(page);
    expect(await kq(page, () => window.__kq.state().paused)).toBe(true);
    await page.getByRole("button", { name: "Close" }).tap();
    await expect(pauseDialog).toBeVisible();
  });
});

test.describe("accessibility: announcements and focus (A11Y-07, A11Y-12)", () => {
  test.use({ ...device("iPhone 13 landscape"), deviceScaleFactor: 1 });
  test.describe.configure({ timeout: 120_000 });

  test("screen readers hear the azan card, captions and toasts; focus returns sensibly (A11Y-07, A11Y-12)", async ({
    page,
  }) => {
    await startAt(page, "iphone");
    // after Start, focus is on the 3D view, not lost on <body>
    expect(await kq(page, () => document.activeElement?.id)).toBe("kqStage");
    await toast(page, "Wudu done. Now walk into the prayer hall.");
    await expect(page.locator("#kqLive")).toHaveText(/Wudu done/);
    await kq(page, () => window.__kq.forcePrayer("zohor"));
    await kq(page, () => window.__kq.step(1200));
    await expect(page.locator("#kqLiveCaption")).toContainText(/Call to prayer/);
    // a later caption phrase is announced too (throttled, so give it time)
    await kq(page, () => window.__kq.step(20_000));
    await expect(page.locator("#kqLiveCaption")).not.toContainText(/Call to prayer/, {
      timeout: 8000,
    });
    // a sheet closed from its button returns focus to its opener
    await page.locator("#kqDock-bag").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "My bag" })).toBeVisible();
    await page.keyboard.press("Escape");
    expect(await kq(page, () => document.activeElement?.id)).toBe("kqDock-bag");
  });
});

test.describe("accessibility: wudu doa caption", () => {
  test.use({ ...device("iPhone 13 landscape"), deviceScaleFactor: 1 });
  test.describe.configure({ timeout: 120_000 });

  test("wudu doa shows its caption on the last step and is hidden before", async ({ page }) => {
    await startAt(page, "iphone");
    await kq(page, () => {
      window.__kq.forcePrayer("zohor");
      window.__kq.teleport("mosque_wudu");
    });
    await page.locator("#kqTalk").tap();
    const cue = page.locator(".kq-wudu-cue");
    await expect(cue).toBeHidden();
    for (let i = 0; i < 60; i += 1) {
      const id = await kq(page, () => window.__kq.state().prayer.flow?.phase);
      if (id !== "wudu") break;
      const doa = await cue.isVisible();
      if (doa) break;
      await page.locator(".kq-wudu-act").tap();
    }
    await expect(cue).toBeVisible();
    await expect(cue).toContainText("Ashhadu an la ilaha illallah");
    await expectNoPageScroll(page);
    await expectTouchTargets(page);
  });
});
