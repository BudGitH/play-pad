// Kampung Quest, hero choice (AC-P8..P10): the "Who are you?" picker on the title card (Boy / Girl, keyboard
// operable), the girl hero's own model and looks, the choice saved through a reload, the Boy / Girl switch
// and the girl's hair / hijab styles at the tailor, the girl's ihram (white modest clothes, no men's cloths)
// and her look coming back after, and her prayer place in the women's rows.
// Pure rules: tests/kampung-quest/hero-gender.test.mjs. Run: npx playwright test tests/kampung-quest-hero.spec.mjs
import { test, expect } from "@playwright/test";

const URL = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const kq = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => kq(page, () => window.__kq.state());
const wardrobe = (page) => kq(page, () => window.__kq.wardrobe());
const step = (page, ms) => kq(page, (t) => window.__kq.step(t), ms);
const card = (page, g) => page.locator(`#kqHeroPick .kq-hero-card[data-hero="${g}"]`);

/** Collect console errors and uncaught exceptions (GL driver chatter is a warning, not an error). */
function watch(page) {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  return errors;
}

async function load(page, url = URL) {
  await page.goto(url);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 120_000 }).toBe(true);
}

async function startGame(page) {
  await page.locator("#kqStart").click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 60_000 }).toBe(true);
  await step(page, 200);
}

/** The hero's rig as painted now: which body (girl / boy), dressed or not, the men's ihram cloths shown, the head piece. */
const look = (page) =>
  kq(page, () => {
    const P = window.KQ.Game.S.player;
    const rig = P.rig;
    return {
      gender: P.gender,
      dressed: Boolean(rig.dressId),
      cloths: Boolean(rig.ihram && rig.ihram.on),
      torso: window.__kq.wardrobe().torso,
      heads: rig.accessory.geometry.attributes.position.count,
    };
  });

test.describe.configure({ timeout: 240_000 });

test("first run: the picker is up, Boy is chosen, arrow keys pick Girl, Start makes a girl hero", async ({
  page,
}) => {
  const errors = watch(page);
  await load(page);
  await expect(page.locator("#kqHeroPick")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(card(page, "boy")).toHaveAttribute("aria-checked", "true");
  for (const g of ["boy", "girl"]) {
    const box = await card(page, g).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.width).toBeGreaterThanOrEqual(48);
  }
  await card(page, "boy").focus();
  await page.keyboard.press("ArrowRight");
  await expect(card(page, "girl")).toHaveAttribute("aria-checked", "true");
  await expect(card(page, "girl")).toBeFocused();
  await expect(card(page, "boy")).toHaveAttribute("aria-checked", "false");
  // the title card keeps Tab inside it
  for (let i = 0; i < 12; i += 1) await page.keyboard.press("Tab");
  expect(
    await kq(page, () => document.getElementById("kqTitle").contains(document.activeElement)),
  ).toBe(true);
  await startGame(page);
  const s = await state(page);
  expect(s.hero.gender).toBe("girl");
  expect(s.wardrobe).toEqual({ wear: "kurung", tone: "teal" });
  const l = await look(page);
  expect(l).toMatchObject({ gender: "girl", dressed: true, cloths: false });
  expect(l.torso).toBe("#2f9a8a");
  expect(errors).toEqual([]);
});

test("the choice survives a reload; New game puts the picker up again first", async ({ page }) => {
  const errors = watch(page);
  await load(page, URL + "&hero=girl");
  await expect(card(page, "girl")).toHaveAttribute("aria-checked", "true");
  await startGame(page);
  expect(await kq(page, () => window.KQ.Game.Loop.save())).toBeTruthy();
  await load(page);
  await expect(page.locator("#kqHeroPick")).toBeHidden(); // Continue keeps the saved hero
  await startGame(page);
  expect((await state(page)).hero.gender).toBe("girl");
  expect((await look(page)).gender).toBe("girl");
  await kq(page, () => window.KQ.Game.Loop.save());
  await load(page);
  await page.locator("#kqNew").click();
  await expect(page.locator("#kqHeroPick")).toBeVisible();
  await expect(card(page, "girl")).toHaveAttribute("aria-checked", "true");
  await expect(card(page, "girl")).toBeFocused();
  await card(page, "boy").click();
  await page.locator("#kqNew").click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 60_000 }).toBe(true);
  const s = await state(page);
  expect(s.hero.gender).toBe("boy");
  expect(s.wardrobe).toEqual({ wear: "classic", tone: "royal" });
  expect((await look(page)).dressed).toBe(false); // the boy's own look is never repainted
  expect(errors).toEqual([]);
});

test("the tailor switches Boy / Girl and offers the girl's hair and hijab styles", async ({
  page,
}) => {
  const errors = watch(page);
  await load(page);
  await startGame(page);
  const before = await look(page);
  await kq(page, () => window.__kq.openWardrobe());
  await expect.poll(async () => (await wardrobe(page)).open).toBe(true);
  await expect(page.locator(".kq-wd-tile")).toHaveCount(8);
  await expect(page.locator(".kq-wd-style").first()).toBeHidden();
  await page.locator('.kq-wd-gender[data-hero="girl"]').click();
  await expect(page.locator(".kq-wd-tile")).toHaveCount(6);
  await expect(page.locator(".kq-wd-style")).toHaveCount(7);
  await expect(page.locator(".kq-wd-scarf")).toHaveCount(8);
  expect((await look(page)).gender).toBe("girl"); // live preview
  await page.locator('.kq-wd-style[data-style="ponytail"]').click();
  await page.locator('.kq-wd-tile[data-outfit="tracksuit"]').click();
  const preview = await look(page);
  expect(preview.heads).not.toBe(before.heads); // a new head piece (hair, not the cap)
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => (await wardrobe(page)).open).toBe(false);
  const s = await state(page);
  expect(s.hero).toMatchObject({ gender: "girl", style: "ponytail" });
  expect(s.wardrobe.wear).toBe("tracksuit");
  // and back to the boy: his own default look returns
  await kq(page, () => window.__kq.openWardrobe());
  await expect.poll(async () => (await wardrobe(page)).open).toBe(true);
  await page.locator('.kq-wd-gender[data-hero="boy"]').click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => (await state(page)).hero.gender).toBe("boy");
  expect((await state(page)).wardrobe).toEqual({ wear: "classic", tone: "royal" });
  expect(await look(page)).toMatchObject({ gender: "boy", dressed: false });
  expect(errors).toEqual([]);
});

test("the girl's ihram is white modest clothes and a hijab (no men's cloths); her look comes back", async ({
  page,
}) => {
  const errors = watch(page);
  await load(page, URL + "&hero=girl");
  await startGame(page);
  const dressed = await look(page);
  await kq(page, () => window.KQ.Game.RitualLook.wear(true));
  const ihram = await look(page);
  expect(ihram).toMatchObject({ gender: "girl", dressed: true, cloths: false });
  expect(ihram.torso).toBe("#f7f6f1");
  // the tailor waits politely while ihram is on
  await kq(page, () => window.__kq.openWardrobe());
  await expect(page.getByText(/plain white clothes and white hijab/)).toBeVisible();
  await page.getByRole("button", { name: "OK" }).click();
  // a girl's tahallul is a snipped lock, never a boy's trim or shave
  await kq(page, () => window.__kq.openRite("umrah"));
  const sim = await kq(page, () => {
    const u = window.KQ.Game.S.sim.umrah;
    u.setCut("lock");
    return u.cut;
  });
  expect(sim).toBe("lock");
  await kq(page, () => window.KQ.Game.UI.closeSheet("cancel"));
  await kq(page, () => window.KQ.Game.RitualLook.wear(false));
  const after = await look(page);
  expect(after.torso).toBe(dressed.torso);
  expect(after.heads).toBe(dressed.heads);
  expect(errors).toEqual([]);
});

test("the girl prays in the women's rows of the kampung mosque", async ({ page }) => {
  const errors = watch(page);
  await load(page, URL + "&hero=girl");
  await startGame(page);
  const spot = await kq(page, () => {
    const G = window.KQ.Game;
    const w = G.NpcGoals.HERO_SPOT_WOMEN;
    const screenZ = window.KQ.WorldParts.LAYOUT.mosque.womenScreenZ;
    const slots = G.S.npcs && G.S.npcs.slots ? G.S.npcs.slots.women : [];
    const near = slots.filter((s) => Math.hypot(s.x - w.x, s.z - w.z) < 1.0).length;
    return {
      free: !G.Collide.blockedAt(G.S.world.colliders, w.x, w.z, 0.33),
      behindScreen: w.z > screenZ,
      near,
    };
  });
  expect(spot).toEqual({ free: true, behindScreen: true, near: 0 });
  // the women's prayer spot is the one the girl's Talk button offers
  await kq(page, () => window.__kq.place(-38, -21.6, Math.PI));
  await step(page, 300);
  expect((await state(page)).target?.id).toBe("prayer_spot_women");
  expect(errors).toEqual([]);
});
