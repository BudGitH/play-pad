// Kampung Quest, playability round area A: the radar's establishment icons, the full zoomable map and the
// "go here" target (AC-P1 .. AC-P4). Feature record: features/kampung-quest-playability/notes-map.md.
// Pure maths (zoom, pan, clamp, layout) is in tests/kampung-quest/map.test.mjs (npm run test:kq).
// Run: npx playwright test tests/kampung-quest-map.spec.mjs --project=kampung-quest
import { test, expect, devices } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const HOLY = GAME + "&region=haramain";
const kq = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => kq(page, () => window.__kq.state());
const map = (page) => kq(page, () => window.__kq.map());
const step = (page, ms) => kq(page, (t) => window.__kq.step(t), ms);
const button = (page, name) => page.getByRole("button", { name, exact: true });
const canvasBox = (page) => page.locator(".kq-bm-canvas").boundingBox();
const focusOn = (page, id) => kq(page, (i) => window.KQ.Game.BigMap.focus(i), id);
const target = (page) => kq(page, () => window.KQ.Game.MapTarget.active());
const radar = (page, span) =>
  kq(page, (n) => window.KQ.Game.Loop.mapView(n, { rotate: true }).markers, span);

/** Collect console errors and uncaught exceptions. */
function watch(page) {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  return errors;
}

/** Load a region, press Start, daylight. */
async function boot(page, url) {
  await page.goto(url);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kqStart").click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await kq(page, () => window.__kq.setMinute(600));
  await step(page, 300);
}

/** One page per region, kept for the whole file (booting is the slow part). */
const shared = {};
async function region(browser, key) {
  if (shared[key]) return shared[key];
  test.setTimeout(150_000);
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  shared[key] = { page, errors: watch(page) };
  await boot(page, key === "holy" ? HOLY : GAME);
  return shared[key];
}

test.afterAll(async () => {
  for (const r of Object.values(shared)) await r.page.close();
});
test.describe.configure({ mode: "serial", timeout: 180_000 });

/** Open the full map with the radar and wait for it. */
async function openMap(page) {
  await page.locator("#kqMap").click();
  await expect.poll(async () => (await state(page)).ui.modal).toBe("Map");
  await expect.poll(async () => (await map(page)).open).toBe(true);
}

/** The world bounds and the edges of the view in metres. */
function edges(page) {
  return kq(page, () => {
    const m = window.__kq.map();
    const b = window.KQ.Game.MapPlaces.bounds(m.city);
    const hw = m.size.w / 2 / m.scale;
    const hh = m.size.h / 2 / m.scale;
    return { b, left: m.cx - hw, right: m.cx + hw, top: m.cz - hh, bottom: m.cz + hh };
  });
}

/** Every registry source whose POI exists in this world is in the map's list. */
async function expectRegistryPresent(page, city) {
  const miss = await kq(
    page,
    (c) => {
      const s = window.KQ.Game.S;
      const pois = s.world.poisOf ? s.world.poisOf(c) : s.world.pois;
      const have = new Set(window.KQ.Game.MapPlaces.list(s, c).map((p) => p.id.split("#")[0]));
      return window.KQ.PLACES.SOURCES[c]
        .filter((src) => src.poi && pois[src.poi] && !have.has(src.id))
        .map((src) => src.id);
    },
    city,
  );
  expect(miss, "every registry source whose POI exists is on the map").toEqual([]);
}

/** Zoom to each place in turn and expect its icon on screen. Returns the ids checked. */
async function expectEveryPlaceVisible(page) {
  const ids = (await map(page)).places.map((p) => p.id);
  for (const id of ids) {
    await focusOn(page, id);
    const m = await map(page);
    expect(m.places.find((p) => p.id === id).visible, `${id} is on the map when zoomed to`).toBe(
      true,
    );
  }
  return ids;
}

/** Where a place's icon is on the page (for a real tap). */
function iconPoint(page, id) {
  return kq(
    page,
    (i) => {
      const c = document.querySelector(".kq-bm-canvas").getBoundingClientRect();
      const m = window.__kq.map();
      const p = m.places.find((q) => q.id === i);
      return {
        x: c.x + c.width / 2 + (p.x - m.cx) * m.scale,
        y: c.y + c.height / 2 + (p.z - m.cz) * m.scale,
      };
    },
    id,
  );
}

/** Drag the mouse from the middle of the map by (dx, dy). */
async function drag(page, dx, dy) {
  const box = await canvasBox(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

// ---------------------------------------------------------------------------------------- kampung

test("AC-P1: the radar shows establishment icons in range (tailor, shops, food), not the small stuff", async ({
  browser,
}) => {
  const { page } = await region(browser, "kampung");
  await kq(page, () => window.__kq.place(52, 6, 0));
  await step(page, 300);
  const kinds = (await radar(page, 80)).map((m) => m.kind);
  expect(kinds).toEqual(
    expect.arrayContaining(["tailor", "shop", "clinic", "barber", "mosque", "food"]),
  );
  expect(kinds, "stalls, bins and car parks are on the full map only").not.toContain("stall");
  const ink = await kq(page, () => {
    const c = document.querySelector("#kqHud canvas.kq-minimap");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4)
      if (d[i] === 16 && d[i + 1] === 16 && d[i + 2] === 20) n += 1;
    return n;
  });
  expect(ink, "icon rims (ink) are drawn on the radar").toBeGreaterThan(50);
});

test("AC-P2: tap the radar or press M opens the full map; M, Escape, Close and the backdrop close it", async ({
  browser,
}) => {
  const { page } = await region(browser, "kampung");
  await openMap(page);
  expect(await map(page)).toMatchObject({ open: true, city: "kampung", level: 1 });
  await page.keyboard.press("Escape");
  expect((await state(page)).ui.modal).toBeNull();
  await page.keyboard.press("m");
  expect((await state(page)).ui.modal).toBe("Map");
  await page.keyboard.press("m"); // M again closes it
  expect((await state(page)).ui.modal).toBeNull();
  await openMap(page);
  await button(page, "Close").click();
  expect((await state(page)).ui.modal).toBeNull();
  await openMap(page);
  await page.mouse.click(2, 410); // the thin backdrop ring beside the sheet
  expect((await state(page)).ui.modal).toBeNull();
});

test("AC-P1 / P2: every registry place the kampung has is on the full map, with its name", async ({
  browser,
}) => {
  const { page, errors } = await region(browser, "kampung");
  await expectRegistryPresent(page, "kampung");
  await openMap(page);
  const m = await map(page);
  const kinds = new Set(m.places.map((p) => p.kind));
  const want = ["mosque", "food", "shop", "tailor", "home", "library", "playground", "park", "bus"];
  for (const k of [...want, "clinic", "barber"]) {
    expect(kinds.has(k), `${k} is on the map`).toBe(true);
  }
  const labels = m.places.map((p) => p.label);
  expect(labels).toEqual(expect.arrayContaining(["Butik tailor", "Mosque", "Hawker centre"]));
  const ids = await expectEveryPlaceVisible(page);
  expect(ids.length).toBeGreaterThanOrEqual(18);
  await expect(page.locator(".kq-bm-item"), "the Places list has a row for each").toHaveCount(
    ids.length,
  );
  expect(errors, errors.join("\n")).toEqual([]);
  await page.keyboard.press("Escape");
});

/** The + / - buttons zoom in steps, are limited at both ends and 0 shows everything. */
async function zoomButtons(page) {
  const l0 = (await map(page)).level;
  await button(page, "Zoom in").click();
  const l1 = (await map(page)).level;
  expect(l1).toBeGreaterThan(l0 * 1.4);
  await button(page, "Zoom out").click();
  expect((await map(page)).level).toBeLessThan(l1);
  for (let i = 0; i < 12; i += 1) await button(page, "Zoom out").click();
  expect((await map(page)).level, "cannot zoom out past the whole region").toBe(1);
  for (let i = 0; i < 12; i += 1) await button(page, "Zoom in").click();
  expect((await map(page)).level, "zoom is limited").toBeGreaterThan(7);
  expect((await map(page)).level).toBeLessThanOrEqual(8.001);
  await page.keyboard.press("0");
  expect((await map(page)).level).toBe(1);
}

/** The wheel zooms about the pointer, both ways. */
async function wheelZoom(page) {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await map(page)).level).toBeGreaterThan(1.5);
  await page.mouse.wheel(0, 2000);
  await expect.poll(async () => (await map(page)).level).toBe(1);
}

/** + and - keys zoom, the arrow keys pan. */
async function keyboardZoomPan(page) {
  await page.locator(".kq-bm-canvas").focus();
  await page.keyboard.press("+");
  await page.keyboard.press("+");
  const z = await map(page);
  expect(z.level).toBeGreaterThan(2);
  await page.keyboard.press("ArrowRight");
  const r = await map(page);
  expect(r.cx, "the arrow moves the view east").toBeGreaterThan(z.cx);
  await page.keyboard.press("ArrowUp");
  expect((await map(page)).cz, "up moves the view north").toBeLessThan(r.cz);
}

test("AC-P3: + / - buttons, the wheel and the keys zoom; the arrow keys pan; zoom is limited", async ({
  browser,
}) => {
  const { page } = await region(browser, "kampung");
  await openMap(page);
  await zoomButtons(page);
  await wheelZoom(page);
  await keyboardZoomPan(page);
  await page.keyboard.press("Escape");
});

/** Drag far in both directions: the view's edges stay inside the world. */
async function expectDragClamped(page) {
  for (const [dx, dy] of [
    [-1500, -1500],
    [1500, 1500],
  ]) {
    await drag(page, dx, dy);
    const e = await edges(page);
    expect(e.left).toBeGreaterThanOrEqual(e.b.x0 - 0.01);
    expect(e.right).toBeLessThanOrEqual(e.b.x1 + 0.01);
    expect(e.top).toBeGreaterThanOrEqual(e.b.z0 - 0.01);
    expect(e.bottom).toBeLessThanOrEqual(e.b.z1 + 0.01);
  }
}

test("AC-P3: dragging pans the map and it never leaves the world; centre on me brings the hero back", async ({
  browser,
}) => {
  const { page } = await region(browser, "kampung");
  await kq(page, () => window.__kq.place(26, -20, 0));
  await step(page, 200);
  await openMap(page);
  for (let i = 0; i < 3; i += 1) await button(page, "Zoom in").click();
  const before = await map(page);
  await drag(page, 120, 60);
  const after = await map(page);
  expect(after.cx, "dragging right moves the view west").toBeLessThan(before.cx);
  expect(after.cz, "dragging down moves the view north").toBeLessThan(before.cz);
  expect(after.selected, "a drag is not a tap").toBeNull();
  await expectDragClamped(page);
  await button(page, "Centre on me").click();
  const me = await map(page);
  const hero = (await state(page)).pos;
  expect(me.cx).toBeCloseTo(hero.x, 0);
  expect(me.cz).toBeCloseTo(hero.z, 0);
  await page.keyboard.press("Escape");
});

test("a11y: Tab stays inside the map, Escape returns focus to the radar", async ({ browser }) => {
  const { page } = await region(browser, "kampung");
  await openMap(page);
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press("Tab");
    const inside = await kq(page, () => Boolean(document.activeElement.closest(".kq-sheet-box")));
    expect(inside, "focus never leaves the open map").toBe(true);
  }
  await page.keyboard.press("Escape");
  expect(await kq(page, () => document.activeElement.id)).toBe("kqMap");
});

/** A real tap on a place's icon selects it and shows its card. */
async function tapAPlace(page) {
  await focusOn(page, "park");
  const hit = await iconPoint(page, "park");
  await page.mouse.click(hit.x, hit.y);
  expect((await map(page)).selected).toBe("park");
  await expect(page.locator(".kq-bm-card")).toContainText("Park");
  await focusOn(page, "tailor");
  await expect(page.locator(".kq-bm-card")).toContainText("Butik tailor");
  await expect(page.locator(".kq-bm-card")).toContainText(/m away/);
}

/** After Go here: the radar arrow, the ground beacon, and the objective is untouched. */
async function expectGotoShows(page) {
  const goto = (await radar(page, 80)).find((m) => m.kind === "goto");
  expect(goto, "a go-here radar marker").toMatchObject({
    big: true,
    arrow: true,
    color: "#38bdf8",
  });
  const view = await kq(page, () => window.KQ.Game.S.markerView.goto);
  const tailor = await kq(page, () => window.KQ.Game.S.world.pois.tailor.pos);
  expect(view).toMatchObject({ x: tailor.x, z: tailor.z });
  expect(await kq(page, () => window.KQ.Game.S.markers.goto.visible)).toBe(true);
  await kq(page, () => {
    window.KQ.Game.S.sim.missions.accept("recycling_hero");
    window.__kq.step(300);
  });
  const both = (await radar(page, 80)).map((m) => [m.kind, m.color]);
  expect(both).toEqual(
    expect.arrayContaining([
      ["objective", "#ff6b85"],
      ["goto", "#38bdf8"],
    ]),
  );
  expect(await kq(page, () => window.KQ.Game.S.markerView.mission)).not.toBeNull();
}

test("AC-P4: tap a place: name card + Go here; the radar arrow and the ground beacon show; Stop clears", async ({
  browser,
}) => {
  const { page } = await region(browser, "kampung");
  await kq(page, () => window.__kq.place(26, -20, 0));
  await step(page, 200);
  await openMap(page);
  await tapAPlace(page);
  await button(page, "Go here").click();
  expect((await map(page)).target).toBe("tailor");
  await expect(button(page, "Stop going here")).toBeVisible();
  await page.keyboard.press("Escape");
  await step(page, 300);
  await expectGotoShows(page);
  await openMap(page);
  await focusOn(page, "tailor");
  await button(page, "Stop going here").click();
  expect((await map(page)).target).toBeNull();
  await page.keyboard.press("Escape");
  await step(page, 300);
  expect(await kq(page, () => window.KQ.Game.S.markerView.goto)).toBeNull();
  expect(await kq(page, () => window.KQ.Game.S.markers.goto.visible)).toBe(false);
});

test("AC-P4: the target clears itself when the hero arrives (within 4 m)", async ({ browser }) => {
  const { page, errors } = await region(browser, "kampung");
  await kq(page, () => window.__kq.place(26, -20, 0));
  await step(page, 200);
  await kq(page, () => {
    const G = window.KQ.Game;
    G.MapTarget.set(G.MapPlaces.find(G.S, "kampung", "library"));
  });
  await step(page, 300);
  expect((await target(page)).id).toBe("library");
  const lib = await kq(page, () => window.KQ.Game.S.world.pois.library.pos);
  await kq(page, (p) => window.__kq.place(p.x, p.z + 6, 0), lib); // 6 m short: still going
  await step(page, 300);
  expect(await target(page)).not.toBeNull();
  await kq(page, (p) => window.__kq.place(p.x, p.z + 2, 0), lib);
  await step(page, 300);
  expect(await target(page)).toBeNull();
  await expect(page.locator(".kq-toast", { hasText: /You are here: Library/ })).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

// ------------------------------------------------------------------------------ Makkah and Madinah

test("AC-P1: the radar shows the camel yard when the hero is near it", async ({ browser }) => {
  const { page } = await region(browser, "holy");
  await kq(page, () => window.__kq.place(-225, -112, 0));
  await step(page, 400);
  expect((await radar(page, 90)).map((m) => m.kind)).toContain("camel");
});

test("AC-P1 / P2: Makkah's full map shows the Kaaba, tailor, camels, oasis, Safa and Marwa, Zamzam, hotel", async ({
  browser,
}) => {
  const { page } = await region(browser, "holy");
  await kq(page, () => window.__kq.place(0, -95, 0));
  await step(page, 300);
  await expectRegistryPresent(page, "makkah");
  await openMap(page);
  const m = await map(page);
  expect(m).toMatchObject({ city: "makkah", heroCity: "makkah" });
  const byId = Object.fromEntries(m.places.map((p) => [p.id, p]));
  const want = ["kaaba", "tailor", "camel_yard", "caravan", "oasis", "safa", "marwa", "zamzam"];
  for (const id of [...want, "hotel", "mosque"]) {
    expect(byId[id], `${id} is on Makkah's map`).toBeTruthy();
  }
  expect(byId.camel_yard.kind).toBe("camel");
  expect(byId.kaaba).toMatchObject({ x: 0, z: 0 });
  expect((await expectEveryPlaceVisible(page)).length).toBeGreaterThanOrEqual(15);
  await button(page, "Centre on me").click();
});

test("Makkah / Madinah switch: Madinah shows the Prophet's Mosque, tailor, bus stop; no Go here across cities", async ({
  browser,
}) => {
  const { page } = await region(browser, "holy");
  await button(page, "Madinah").click();
  const m = await map(page);
  expect(m).toMatchObject({ city: "madinah", heroCity: "makkah", level: 1 });
  const ids = m.places.map((p) => p.id);
  expect(ids).toEqual(expect.arrayContaining(["nabawi", "tailor", "quba", "bus", "rawdah"]));
  await expectEveryPlaceVisible(page);
  await focusOn(page, "tailor");
  await expect(page.locator(".kq-bm-card")).toContainText("Take the bus");
  await expect(button(page, "Go here")).toHaveCount(0);
  await button(page, "Makkah").click();
  expect((await map(page)).city).toBe("makkah");
  await button(page, "Centre on me").click();
  await page.keyboard.press("Escape");
});

test("AC-P4: go here to the camel yard: the beacon shows; arriving near the big yard clears it", async ({
  browser,
}) => {
  const { page, errors } = await region(browser, "holy");
  await openMap(page);
  await focusOn(page, "camel_yard");
  await button(page, "Go here").click();
  expect((await map(page)).target).toBe("camel_yard");
  await page.keyboard.press("Escape");
  await step(page, 300);
  // The target is the camel_yard place (the rides-lot gate once the animals are in, else the herd yard).
  const goto = await kq(page, () => window.KQ.Game.S.markerView.goto);
  const want = await kq(page, () => {
    const poi = window.KQ.Game.S.world.pois.camel_yard;
    const y = window.KQ.WorldParts.HolyCamels.YARD;
    return poi ? { x: poi.pos.x, z: poi.pos.z } : { x: (y.x0 + y.x1) / 2, z: (y.z0 + y.z1) / 2 };
  });
  expect(goto.x).toBeCloseTo(want.x, 0);
  expect(goto.z).toBeCloseTo(want.z, 0);
  await kq(page, (w) => window.__kq.place(w.x + 2, w.z + 2, 0), want);
  await step(page, 300);
  expect(await target(page)).toBeNull();
  expect(errors, errors.join("\n")).toEqual([]);
});

// ------------------------------------------------------------------------------------------ phone

// a Pixel 7 context without `defaultBrowserType` (only Chromium is installed; the engine is the same)
const pixel = { ...devices["Pixel 7"] };
delete pixel.defaultBrowserType;

/** Every map control is at least 48 px and fully inside the screen. */
async function expectControlsReachable(page) {
  const vp = page.viewportSize();
  const names = ["Zoom in", "Zoom out", "Centre on me", "Close", "Places"];
  for (const n of names) {
    const r = await button(page, n).boundingBox();
    expect(Math.min(r.width, r.height), `${n} is at least 48 px`).toBeGreaterThanOrEqual(47.5);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(vp.width);
    expect(r.y + r.height).toBeLessThanOrEqual(vp.height);
  }
}

/** Two touches moving apart (raw touch events, like the mobile spec) zoom the map in. */
async function pinchOut(page) {
  const cdp = await page.context().newCDPSession(page);
  const c = await canvasBox(page);
  const mx = c.x + c.width / 2;
  const my = c.y + c.height / 3;
  const pts = (g) => [
    { x: mx - g, y: my, id: 1 },
    { x: mx + g, y: my, id: 2 },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts(20) });
  for (const g of [40, 70, 100]) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pts(g) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** The Places panel floats over the map on a phone: rows are big, a tap selects, Go here is reachable. */
async function expectPlacesPanelUsable(page) {
  const vp = page.viewportSize();
  await button(page, "Places").tap();
  const rows = await page
    .locator(".kq-bm-item")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(Math.min(...rows)).toBeGreaterThanOrEqual(47.5);
  await page.locator('.kq-bm-item[data-place="tailor"]').tap();
  await expect(page.locator(".kq-bm-card")).toContainText("Butik tailor");
  const go = await button(page, "Go here").boundingBox();
  expect(go.height).toBeGreaterThanOrEqual(47.5);
  expect(go.y + go.height).toBeLessThanOrEqual(vp.height);
  await button(page, "Places").tap(); // fold the panel
}

test.describe("phone portrait (Pixel 7)", () => {
  test.use(pixel);

  test("the map's controls are >= 48 px and in view; the Places list selects; two fingers pinch-zoom", async ({
    page,
  }) => {
    const errors = watch(page);
    await boot(page, GAME);
    await page.locator("#kqMap").tap();
    await expect.poll(async () => (await state(page)).ui.modal).toBe("Map");
    await expectControlsReachable(page);
    const vp = page.viewportSize();
    const box = await canvasBox(page);
    expect(box.width).toBeGreaterThan(vp.width * 0.8);
    expect(box.height).toBeGreaterThan(vp.height * 0.5);
    await expectPlacesPanelUsable(page);
    await button(page, "Zoom out").tap();
    const before = (await map(page)).scale;
    await pinchOut(page);
    await expect.poll(async () => (await map(page)).scale).toBeGreaterThan(before * 1.5);
    await page.keyboard.press("Escape");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
