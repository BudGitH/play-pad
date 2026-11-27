// Kampung Quest, the tailor's wardrobe: a stall in the kampung and one each in Makkah and Madinah open a
// sheet of outfits and colours with a live preview on the hero; Save keeps the choice in the game (and
// in every region), Cancel undoes it, and the ihram still overrides the clothes during Umrah / Hajj.
// Pure rules: tests/kampung-quest/wardrobe.test.mjs. Run: npx playwright test tests/kampung-quest-wardrobe.spec.mjs
import { test, expect } from "@playwright/test";

const BASE = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const KAMPUNG = BASE;
const HOLY = BASE + "&region=haramain";
const kq = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => kq(page, () => window.__kq.state());
const wardrobe = (page) => kq(page, () => window.__kq.wardrobe());
const step = (page, ms) => kq(page, (t) => window.__kq.step(t), ms);
const DEFAULT = { wear: "classic", tone: "royal" };
const OUTFITS = ["classic", "baju_melayu", "tee", "kurta", "thobe", "jubah", "raincoat", "sporty"];

/** Collect console errors and uncaught exceptions (GL driver chatter is a warning, not an error). */
function watch(page) {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  return errors;
}

async function load(page, url) {
  await page.goto(url);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 120_000 }).toBe(true);
}

async function begin(page, url) {
  await load(page, url);
  await page.locator("#kqStart").click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 60_000 }).toBe(true);
  await step(page, 200);
}

/** Stand at the tailor's counter (the poi's own stand spot) and press the "Change clothes" prompt. */
async function openAtStall(page, spot) {
  if (spot) await kq(page, (s) => window.__kq.place(s[0], s[1], s[2]), spot);
  else await kq(page, () => window.__kq.teleport("tailor"));
  await step(page, 300);
  expect((await state(page)).target?.id).toBe("wardrobe_stall");
  await kq(page, () => window.__kq.interact());
  await expect.poll(async () => (await wardrobe(page)).open).toBe(true);
  await step(page, 300);
}

const sheet = (page) => page.getByRole("dialog", { name: "Tailor's wardrobe" });
const tile = (page, id) => page.locator(`.kq-wd-tile[data-outfit="${id}"]`);
const swatch = (page, id) => page.locator(`.kq-wd-swatch[data-tone="${id}"]`);

/** Every outfit has 6-8 colours; every button in the sheet is at least 48 px. */
async function expectCatalogue(page) {
  await expect(sheet(page)).toBeVisible();
  await expect(page.locator(".kq-wd-tile")).toHaveCount(8);
  for (const id of OUTFITS) {
    await tile(page, id).click();
    const n = await page.locator(".kq-wd-swatch").count();
    expect(n, id + " colours").toBeGreaterThanOrEqual(6);
    expect(n, id + " colours").toBeLessThanOrEqual(8);
  }
  expect(await smallButtons(page), "buttons under 48 px").toBe(0);
}

/** How many buttons of the open sheet are smaller than 48 x 48 px. */
function smallButtons(page) {
  return kq(
    page,
    () =>
      Array.from(document.querySelectorAll(".kq-sheet-box button"))
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.width < 47.5 || r.height < 47.5).length,
  );
}

/** Try the thobe on in navy, check the hero wears it, Cancel, and check the hero is back in royal blue. */
async function tryOnThenCancel(page) {
  await tile(page, "thobe").click();
  await swatch(page, "navy").click();
  let w = await wardrobe(page);
  expect(w.draft).toEqual({ wear: "thobe", tone: "navy" });
  expect(w.dressed).toBe(true);
  expect(w.torso).toBe("#2c3e6b");
  await expect(page.locator(".kq-wd .kq-note")).toHaveText("Wearing: Navy Thobe");
  await page.getByRole("button", { name: "Cancel" }).click();
  w = await wardrobe(page);
  expect(w.open).toBe(false);
  expect(w.dressed).toBe(false);
  expect(w.torso).toBe("#1d4fc6");
  expect((await state(page)).wardrobe).toEqual(DEFAULT);
  expect((await state(page)).locked).toBe(false);
}

/** Open the wardrobe, pick an outfit and a colour, press Save. */
async function saveLook(page, spot, wear, tone) {
  await openAtStall(page, spot);
  await tile(page, wear).click();
  await swatch(page, tone).click();
  await page.getByRole("button", { name: "Save" }).click();
  expect((await wardrobe(page)).open).toBe(false);
}

/** Reload a region and press Start / Continue. */
async function reload(page, url) {
  await load(page, url);
  await page.locator("#kqStart").click();
  await expect.poll(() => kq(page, () => window.__kq.ready)).toBe(true);
}

/** In ihram the white cloths replace the clothes and the tailor waits; afterwards the clothes come back. */
async function ihramRound(page, saved, torsoAfter) {
  await kq(page, () => window.KQ.Game.RitualLook.wear(true));
  const w = await wardrobe(page);
  expect(w.dressed).toBe(false);
  expect(w.torso).toBe("#1d4fc6");
  expect((await state(page)).wardrobe).toEqual(saved); // kept, just not worn
  await step(page, 300);
  await kq(page, () => window.__kq.interact());
  await expect(page.getByRole("dialog", { name: "Tailor" })).toContainText("ihram");
  expect((await wardrobe(page)).open).toBe(false);
  await page.getByRole("button", { name: "OK" }).click();
  await kq(page, () => window.KQ.Game.RitualLook.wear(false));
  expect((await wardrobe(page)).dressed).toBe(true);
  expect((await wardrobe(page)).torso).toBe(torsoAfter);
}

test.use({ viewport: { width: 1280, height: 800 } });
test.describe.configure({ timeout: 240_000 });

test("kampung: the Butik opens the wardrobe; try on, Cancel undoes, Save persists through a reload", async ({
  page,
}) => {
  const errors = watch(page);
  await begin(page, KAMPUNG);
  expect((await state(page)).wardrobe).toEqual(DEFAULT);
  expect((await wardrobe(page)).torso).toBe("#1d4fc6"); // the hero's own royal blue
  await openAtStall(page);
  await expectCatalogue(page);
  await tryOnThenCancel(page);

  await saveLook(page, null, "baju_melayu", "teal");
  expect((await state(page)).wardrobe).toEqual({ wear: "baju_melayu", tone: "teal" });
  expect((await wardrobe(page)).torso).toBe("#2f7466");
  const saved = await kq(page, () => JSON.parse(localStorage.getItem("kampung-quest:v1")).wardrobe);
  expect(saved).toEqual({ wear: "baju_melayu", tone: "teal" });

  // a reload keeps the clothes (and the bag names them)
  await reload(page, KAMPUNG);
  expect((await state(page)).wardrobe).toEqual({ wear: "baju_melayu", tone: "teal" });
  expect(await wardrobe(page)).toMatchObject({ dressed: true, torso: "#2f7466" });
  await kq(page, () => window.__kq.action("bag"));
  await expect(page.locator(".kq-sheet-box")).toContainText("Teal Baju Melayu");
  expect(errors).toEqual([]);
});

test("the wardrobe is keyboard friendly: focus stays inside, Escape closes and undoes the try-on", async ({
  page,
}) => {
  await begin(page, KAMPUNG);
  await openAtStall(page);
  await tile(page, "sporty").click();
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press("Tab");
    const inside = await kq(page, () => document.activeElement.closest(".kq-sheet-box") !== null);
    expect(inside, "Tab " + i).toBe(true);
  }
  await page.keyboard.press("Escape");
  expect((await wardrobe(page)).open).toBe(false);
  expect((await wardrobe(page)).dressed).toBe(false);
  expect((await state(page)).wardrobe).toEqual(DEFAULT);
});

test("Makkah and Madinah each have a tailor; the look is shared, saved, and the ihram overrides it", async ({
  page,
}) => {
  const errors = watch(page);
  await begin(page, HOLY);
  // Makkah: the stall is outside the Haram's no-drive zones
  const makkah = await kq(page, () => window.KQ.HOLY.makkah.tailor);
  const zones = await kq(page, () => window.KQ.Holy.noDrive);
  for (const z of zones.filter((n) => n.kind === "rect")) {
    const inside =
      makkah.x > z.x0 - 3 && makkah.x < z.x1 + 3 && makkah.z > z.z0 - 3 && makkah.z < z.z1 + 3;
    expect(inside, "tailor inside no-drive zone " + z.name).toBe(false);
  }
  await saveLook(page, null, "thobe", "sand");
  expect((await state(page)).wardrobe).toEqual({ wear: "thobe", tone: "sand" });
  expect((await wardrobe(page)).torso).toBe("#cdb892");

  // Madinah has its own stall, and the hero arrives already in the same clothes
  await openAtStall(page, [610, -98.4, Math.PI]);
  expect((await wardrobe(page)).draft).toEqual({ wear: "thobe", tone: "sand" });
  await page.getByRole("button", { name: "Cancel" }).click();
  await saveLook(page, [610, -98.4, Math.PI], "jubah", "forest");
  const forest = { wear: "jubah", tone: "forest" };
  expect((await state(page)).wardrobe).toEqual(forest);

  await ihramRound(page, forest, "#2f6a4a");

  // the other region (a different save slot) starts in the same clothes
  await kq(page, () => window.KQ.Game.Loop.save());
  await reload(page, KAMPUNG);
  expect((await state(page)).wardrobe).toEqual(forest);
  expect((await wardrobe(page)).dressed).toBe(true);
  expect(errors).toEqual([]);
});

test("phone portrait: the wardrobe is a bottom sheet with 48 px targets and Save in view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page, KAMPUNG);
  await openAtStall(page);
  const box = await sheet(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
  const save = await page.getByRole("button", { name: "Save" }).boundingBox();
  expect(save.y + save.height).toBeLessThanOrEqual(844);
  expect(save.height).toBeGreaterThanOrEqual(48);
  const small = await kq(
    page,
    () =>
      Array.from(document.querySelectorAll(".kq-sheet-box button"))
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.width < 47.5 || r.height < 47.5).length,
  );
  expect(small).toBe(0);
  await tile(page, "raincoat").click();
  await swatch(page, "pink").click();
  expect((await wardrobe(page)).torso).toBe("#ee6fa0");
});
