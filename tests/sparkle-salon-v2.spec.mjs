// Sparkle Salon v2 UX round (S1..S8 = AC-22.5 .. AC-22.12): iPad layout, tablet sizing, pointing-hand demo, heart meter,
// picture client card, results, accessories + sticker drag, My Album. Feature record: features/sparkle-salon-v2/.
// Run: npm run smoke   (the deep v1 checks stay in features/sparkle-salon/probe.mjs)
import { test, expect } from "@playwright/test";

const URL = "/games/sparkle-salon/index.html";
const SAVE_KEY = "playpad.sparkleSalon.v1";
const PHONE = { width: 390, height: 844 };
const IPAD_P = { width: 1024, height: 1366 };
const IPAD_L = { width: 1366, height: 1024 };
const DEVICES = [
  ["phone 390x844", PHONE],
  ["iPad portrait 1024x1366", IPAD_P],
  ["iPad landscape 1366x1024", IPAD_L],
];

const hub = (page) => page.locator('#results a[href="../../index.html"]');
const salon = (page, fn, arg) => page.evaluate(fn, arg);

/** Open the game (optionally with a seeded save) and wait for the debug hook. */
async function open(page, { save } = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  if (save)
    await page.addInitScript(
      ([k, v]) => {
        try {
          if (!localStorage.getItem(k)) localStorage.setItem(k, v);
        } catch {
          /* storage blocked */
        }
      },
      [SAVE_KEY, typeof save === "string" ? save : JSON.stringify(save)],
    );
  await page.goto(URL);
  await page.waitForFunction(() => window.__salon && typeof window.__salon.phase === "string");
  return errors;
}
/** Press Start; with `glam` also close the client card so the step is live. */
async function begin(page, { glam = true } = {}) {
  await page.getByRole("button", { name: "Start makeover", exact: true }).click();
  await page.waitForFunction(() => window.__salon.phase === "playing");
  if (!glam) return;
  await page.getByRole("button", { name: "Let's glam!" }).click();
  await page.waitForFunction(() => !document.querySelector("#reqModal.open"));
}
/** Complete + skip forward until the step with this id is current (no strokes: fast). */
async function playTo(page, id) {
  for (let i = 0; i < 8; i++) {
    if ((await salon(page, () => window.__salon.stepId)) === id) return;
    await salon(page, () => {
      window.__salon.debug.completeStep();
      window.__salon.debug.nextStep();
    });
  }
  expect(await salon(page, () => window.__salon.stepId)).toBe(id);
}
const inside = (box, w, h) =>
  !!box &&
  box.x >= -0.5 &&
  box.y >= -0.5 &&
  box.x + box.width <= w + 0.5 &&
  box.y + box.height <= h + 0.5;
const noHScroll = (page) =>
  salon(
    page,
    () =>
      document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth,
  );
/** Rub the current step's region until `until(progress)` or it completes (real mouse strokes). */
async function rub(page, until = () => false) {
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i <= 16; i++) {
      const p = await salon(page, (f) => window.__salon.debug.regionPoint(f), i / 16);
      if (pass === 0 && i === 0) {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
      }
      await page.mouse.move(p.x, p.y, { steps: 2 });
      const progress = await salon(page, () => window.__salon.progress);
      if (until(progress) || (await salon(page, () => window.__salon.done[window.__salon.step]))) {
        await page.mouse.up();
        return;
      }
    }
  }
  await page.mouse.up();
}
const stageScale = (page) =>
  salon(page, () =>
    Number(/scale\(([\d.]+)\)/.exec(document.getElementById("stage").style.transform)[1]),
  );
const save = (looks) => ({
  v: 1,
  rev: 3,
  coins: 77,
  unlocked: [],
  sound: true,
  looks,
  bestOverall: 0,
});

/* eslint-disable max-lines-per-function -- each test is one linear user scenario (same stance as the deep probes, DECISIONS 2026-11-22) */

// ----------------------------------------------------------------------------------------------------------------------
// AC-22.5 (S1) iPad layout · AC-22.6 (S2) tablet sizing
// ----------------------------------------------------------------------------------------------------------------------
for (const [name, viewport] of DEVICES) {
  test.describe(`layout: ${name}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test("everything is on screen, nothing scrolls sideways (AC-22.5)", async ({ page }) => {
      const errors = await open(page);
      const start = await page
        .getByRole("button", { name: "Start makeover", exact: true })
        .boundingBox();
      expect(inside(start, viewport.width, viewport.height), "Start on screen").toBe(true);
      expect(
        inside(await page.locator("#albumBtn").boundingBox(), viewport.width, viewport.height),
      ).toBe(true);
      expect(await noHScroll(page)).toBe(true);
      await begin(page);
      await playTo(page, "shadow");
      const tool = await page.locator("#tools .tool").first().boundingBox();
      const next = await page.locator("#nextBtn").boundingBox();
      expect(inside(tool, viewport.width, viewport.height), "a tray tool on screen").toBe(true);
      expect(inside(next, viewport.width, viewport.height), "Next on screen").toBe(true);
      expect(await noHScroll(page)).toBe(true);
      await salon(page, () => window.__salon.debug.skipToResults());
      await page.waitForFunction(() => window.__salon.phase === "results", null, {
        timeout: 10_000,
      });
      await expect(page.locator("#againBtn")).toBeVisible();
      expect(
        inside(await page.locator("#againBtn").boundingBox(), viewport.width, viewport.height),
      ).toBe(true);
      expect(await noHScroll(page)).toBe(true);
      expect(errors).toEqual([]);
    });

    if (viewport.width >= 900) {
      test("a wider column, a bigger tablet zoom and finger-sized controls (AC-22.5, AC-22.6)", async ({
        page,
      }) => {
        await open(page);
        const app = await page.locator("#app").boundingBox();
        // portrait already filled the width; landscape is where the old 0.78 x height column left the gutters
        if (viewport.width > viewport.height)
          expect(app.width, "wider than the old 0.78 x height").toBeGreaterThan(
            viewport.height * 0.78 + 100,
          );
        else expect(app.width).toBe(viewport.width);
        expect(app.width).toBeLessThanOrEqual(viewport.width);
        await begin(page);
        await playTo(page, "shadow");
        await page.waitForTimeout(900); // the camera glide
        // a tablet gets the extra 1.25x: a phone's shadow zoom is 1.3 x fit (fit <= 1.12), a tablet's at least 1.3 x 1.25
        expect(await stageScale(page)).toBeGreaterThanOrEqual(1.3 * 1.25 * 0.99);
        const sizes = await salon(page, () => {
          const px = (sel, prop) => parseFloat(getComputedStyle(document.querySelector(sel))[prop]);
          const box = (sel) => document.querySelector(sel).getBoundingClientRect();
          return {
            tool: document.querySelector("#tools .tool").offsetWidth, // layout size (the picked one is drawn 1.14x)
            round: px("#soundBtn2", "width"),
            req: px("#reqBtn", "width"),
            next: box("#nextBtn").height,
            redo: box("#clearBtn").height,
            ring: box("#ring").width,
            bubble: px("#bubble", "fontSize"),
            step: px("#stepName", "fontSize"),
          };
        });
        expect(sizes.tool).toBeGreaterThanOrEqual(88); // "about 92"
        expect(sizes.tool).toBeLessThanOrEqual(96);
        expect(sizes.round).toBe(64);
        expect(sizes.req).toBe(64);
        expect(sizes.next).toBeGreaterThanOrEqual(64);
        expect(sizes.redo).toBeGreaterThanOrEqual(64);
        expect(sizes.ring).toBeGreaterThanOrEqual(72);
        expect(sizes.bubble).toBeGreaterThanOrEqual(20);
        expect(sizes.step).toBeGreaterThanOrEqual(20);
      });
    }

    if (viewport.width >= 1100 && viewport.width > viewport.height) {
      test("landscape tablet: the tools, Redo, the heart and Next sit in a right-hand bar (AC-22.5)", async ({
        page,
      }) => {
        await open(page);
        await begin(page);
        await playTo(page, "shadow");
        const host = await page.locator("#playHost").boundingBox();
        const tray = await page.locator("#tray").boundingBox();
        const redo = await page.locator("#clearBtn").boundingBox();
        const ring = await page.locator("#ring").boundingBox();
        const next = await page.locator("#nextBtn").boundingBox();
        const tool = await page.locator("#tools .tool").first().boundingBox();
        expect(tray.x).toBeGreaterThanOrEqual(host.x + host.width - 2);
        for (const b of [redo, ring, next, tool])
          expect(b.x).toBeGreaterThanOrEqual(host.x + host.width - 2);
        expect(redo.y).toBeLessThan(tool.y);
        expect(next.y).toBeGreaterThan(tool.y);
        // the face gets the rest: the host is at least 60 % of the column and about as tall as the screen
        expect(host.height).toBeGreaterThan(viewport.height - 2);
      });
    }

    if (viewport.width < 700) {
      test("a phone keeps the 62 px tray and 48 px buttons (AC-22.6 only grows tablets)", async ({
        page,
      }) => {
        await open(page);
        await begin(page);
        await playTo(page, "shadow");
        expect(await salon(page, () => document.querySelector("#tools .tool").offsetWidth)).toBe(
          62,
        );
        expect((await page.locator("#soundBtn2").boundingBox()).width).toBe(48);
      });
    }
  });
}

// ----------------------------------------------------------------------------------------------------------------------
// AC-22.7 (S3) pointing-hand demo
// ----------------------------------------------------------------------------------------------------------------------
test.describe("pointing-hand demo (AC-22.7)", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("shows on the first paint step, never paints, and any press cancels it at once", async ({
    page,
  }) => {
    const errors = await open(page);
    await begin(page);
    await page.waitForFunction(() => window.__salon.demo === true, null, { timeout: 5000 });
    await expect(page.locator("#demoHand")).toBeVisible();
    // the hand animates the real tool sprite too
    expect(
      await salon(page, () => document.getElementById("tool").getAnimations().length),
    ).toBeGreaterThan(0);
    // the idle nudge stays quiet while the hand plays
    await expect(page.locator("#nudge.on")).toHaveCount(0);
    const before = await salon(page, () => window.__salon.progress);
    // a press cancels at once (synchronously within the same task as the pointerdown)
    const p = await salon(page, () => window.__salon.debug.unitsToClient(200, 250));
    const cancelled = await salon(
      page,
      ([x, y]) => {
        const stage = document.getElementById("stage");
        stage.dispatchEvent(
          new PointerEvent("pointerdown", {
            pointerType: "touch",
            clientX: x,
            clientY: y,
            pointerId: 9,
            bubbles: true,
            button: 0,
          }),
        );
        return {
          demo: window.__salon.demo,
          shown: document.getElementById("demoHand").classList.contains("on"),
          anims: document.getElementById("demoHand").getAnimations().length,
        };
      },
      [p.x, p.y],
    );
    expect(cancelled).toEqual({ demo: false, shown: false, anims: 0 });
    // the demo itself did not change any coverage
    expect(before).toBe(0);
    expect(errors).toEqual([]);
  });

  test("plays out on its own without painting, then never repeats on that step", async ({
    page,
  }) => {
    await open(page);
    await begin(page);
    await page.waitForFunction(() => window.__salon.demo === true, null, { timeout: 5000 });
    const seen = [];
    while (await salon(page, () => window.__salon.demo)) {
      seen.push(await salon(page, () => window.__salon.progress));
      await page.waitForTimeout(150);
    }
    expect(Math.max(...seen)).toBe(0); // never painted
    expect(await salon(page, () => window.__salon.done[0])).toBe(false);
    expect(await salon(page, () => window.__salon.progress)).toBe(0);
    // the idle nudge counts from the end of the demo, not from before it
    await expect(page.locator("#nudge.on")).toHaveCount(0);
    // a second makeover in the same session: no demo on a step already shown
    await salon(page, () => window.__salon.debug.skipToResults());
    await page.waitForFunction(() => window.__salon.phase === "results", null, { timeout: 10_000 });
    await page.locator("#againBtn").click();
    await page.getByRole("button", { name: "Let's glam!" }).click();
    await page.waitForTimeout(1500);
    expect(await salon(page, () => window.__salon.demo)).toBe(false);
  });

  test("pick steps: the hand taps a tray circle (with a ripple)", async ({ page }) => {
    await open(page);
    await begin(page);
    await playTo(page, "lens");
    await page.waitForFunction(() => window.__salon.demo === true, null, { timeout: 5000 });
    await expect(page.locator("#demoRipple.on")).toHaveCount(1);
    expect(
      await salon(page, () => document.getElementById("demoRipple").getAnimations().length),
    ).toBeGreaterThan(0);
  });

  test("a press that starts the step stops the demo from ever showing there", async ({ page }) => {
    await open(page);
    await begin(page);
    await page.locator("#tools .tool").first().click(); // the player acts before the hand would start
    await page.waitForTimeout(1500);
    expect(await salon(page, () => window.__salon.demo)).toBe(false);
  });
});

test.describe("pointing-hand demo, reduced motion (AC-22.7)", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true, reducedMotion: "reduce" });

  test("a still hand with an arrow, for about two seconds, nothing animating", async ({ page }) => {
    await open(page);
    await begin(page);
    await page.waitForFunction(() => window.__salon.demo === true, null, { timeout: 5000 });
    await expect(page.locator("#demoHand.still")).toBeVisible();
    expect(
      await salon(page, () => document.getElementById("demoHand").getAnimations().length),
    ).toBe(0);
    expect(
      await salon(
        page,
        () => getComputedStyle(document.querySelector("#demoHand .demo-arrow")).display,
      ),
    ).toBe("block");
    await page.waitForFunction(() => window.__salon.demo === false, null, { timeout: 4000 });
    await expect(page.locator("#demoHand")).toBeHidden();
  });
});

// ----------------------------------------------------------------------------------------------------------------------
// AC-22.8 (S4) picture progress
// ----------------------------------------------------------------------------------------------------------------------
test.describe("heart progress meter (AC-22.8)", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("a heart fills with the rub; the percentage is only in its accessible name; done = full + tick; Next hops", async ({
    page,
  }) => {
    const errors = await open(page);
    await begin(page);
    await playTo(page, "shadow");
    const ring = page.locator("#ring");
    await expect(ring).toHaveAttribute("aria-label", "Step progress 0 percent");
    expect(await ring.innerText()).toBe(""); // no number on screen
    const y0 = Number(await page.locator("#heartFill").getAttribute("y"));
    await page.locator(".tool.wish").first().click();
    await rub(page, (progress) => progress >= 0.22); // 25 % of the way (the step completes at 80 %)
    const label = await ring.getAttribute("aria-label");
    const pct = Number(/(\d+) percent/.exec(label)[1]);
    expect(pct).toBeGreaterThanOrEqual(25);
    expect(Number(await page.locator("#heartFill").getAttribute("y"))).toBeLessThan(y0);
    expect(await ring.innerText()).toBe("");
    // the milestone is spoken (and sparkles + a note play)
    await expect(page.locator("#sr")).toHaveText(/A quarter done|Halfway there|Nearly done/);
    // finish: the heart is full with a tick, Next glows and hops, its word is "Next"
    await rub(page);
    await expect(page.locator("#ringTxt")).toHaveText("✓");
    await expect(ring).toHaveClass(/full/);
    await expect(ring).toHaveAttribute("aria-label", "Step progress 100 percent");
    await expect(page.locator("#nextBtn")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("#nextBtn")).toHaveClass(/pop/);
    await expect(page.locator("#nextTxt")).toHaveText("Next");
    expect(
      await salon(page, () =>
        document
          .getElementById("nextBtn")
          .getAnimations()
          .map((a) => a.animationName)
          .sort(),
      ),
    ).toEqual(["glow", "nextHop"]);
    expect(errors).toEqual([]);
  });

  test("Skip, Next and Photo! keep their words; the floating tool ring is off on touch", async ({
    page,
  }) => {
    await open(page);
    await begin(page);
    await expect(page.locator("#nextTxt")).toHaveText("Skip");
    await expect(page.getByRole("button", { name: "Skip this step" })).toBeVisible();
    const ringOnTouch = await salon(page, () => {
      const p = window.__salon.debug.unitsToClient(200, 250);
      const stage = document.getElementById("stage");
      stage.dispatchEvent(
        new PointerEvent("pointerdown", {
          pointerType: "touch",
          clientX: p.x,
          clientY: p.y,
          pointerId: 5,
          bubbles: true,
          button: 0,
        }),
      );
      const on = document.getElementById("toolRing").classList.contains("on");
      stage.dispatchEvent(
        new PointerEvent("pointerup", {
          pointerType: "touch",
          clientX: p.x,
          clientY: p.y,
          pointerId: 5,
          bubbles: true,
        }),
      );
      return on;
    });
    expect(ringOnTouch).toBe(false);
    await playTo(page, "stickers");
    await salon(page, () => window.__salon.debug.completeStep());
    await expect(page.locator("#nextTxt")).toHaveText("Photo!");
    await expect(page.getByRole("button", { name: "Take the photo" })).toBeVisible();
  });

  test("accessories fill the heart by thirds (a first piece still completes the step)", async ({
    page,
  }) => {
    await open(page);
    await begin(page);
    await playTo(page, "acc");
    await expect(page.locator("#ring")).toHaveAttribute("aria-label", "Accessories worn: 0 of 3");
    await page.getByRole("button", { name: /Tiara: Pearl/ }).click();
    await expect(page.locator("#ring")).toHaveAttribute("aria-label", "Accessories worn: 1 of 3");
    await expect(page.locator("#ringTxt")).toHaveText("✓");
    await expect(page.locator("#nextBtn")).toHaveAttribute("data-ready", "true");
    await page.getByRole("button", { name: "Earrings", exact: true }).click();
    await page.getByRole("button", { name: /Earrings: Pearl/ }).click();
    await expect(page.locator("#ring")).toHaveAttribute("aria-label", "Accessories worn: 2 of 3");
  });
});

// ----------------------------------------------------------------------------------------------------------------------
// AC-22.9 (S5) picture client card
// ----------------------------------------------------------------------------------------------------------------------
for (const [name, viewport] of DEVICES) {
  test.describe(`client card: ${name}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test("each wish is the tray's own picture, with a short label; the wished circle glows (AC-22.9)", async ({
      page,
    }) => {
      await open(page);
      await begin(page, { glam: false });
      const card = page.locator("#reqModal .sheet");
      await expect(card).toBeVisible();
      expect(inside(await card.boundingBox(), viewport.width, viewport.height)).toBe(true);
      const items = page.locator("#reqWants li");
      await expect(items).toHaveCount(4);
      for (let i = 0; i < 4; i++) {
        const li = items.nth(i);
        expect(await li.locator(".wish-ico svg").count()).toBe(1);
        expect(await li.locator(".wish-ico").evaluate((e) => e.offsetWidth)).toBeGreaterThanOrEqual(
          viewport.width > 700 ? 88 : 60,
        );
        expect((await li.locator("small").innerText()).length).toBeGreaterThan(2);
      }
      expect(await page.locator("#reqIntro").innerText()).toMatch(/^\w+ wants:$/); // short: "Rosie wants:"
      expect(await page.locator("#reqPortrait").getAttribute("src")).toMatch(
        /^data:image\/svg\+xml/,
      );
      expect(await noHScroll(page)).toBe(true);
      // the picture matches the tray: the lens wish equals the heart-badged lens circle
      const wanted = await salon(page, () =>
        document
          .querySelectorAll("#reqWants li .wish-ico svg")[1]
          .innerHTML.replace(/ig\d+/g, "ig"),
      );
      await page.getByRole("button", { name: "Let's glam!" }).click();
      await playTo(page, "lens");
      const tray = await salon(page, () =>
        document.querySelector("#tools .tool.wish .face svg").innerHTML.replace(/ig\d+/g, "ig"),
      );
      expect(tray).toBe(wanted);
      await expect(page.locator("#tools .tool.wish")).toHaveCount(1);
      expect(
        await salon(
          page,
          () =>
            getComputedStyle(document.querySelector("#tools .tool.wish"), "::after").animationName,
        ),
      ).toBe("wishRing");
      expect(
        await salon(
          page,
          () =>
            getComputedStyle(document.querySelector("#tools .tool:not(.wish)"), "::after").content,
        ),
      ).toBe("none");
    });
  });
}

test.describe("client card, reduced motion (AC-22.9)", () => {
  test.use({ viewport: PHONE, reducedMotion: "reduce" });

  test("no glow ring on the wished circle", async ({ page }) => {
    await open(page);
    await begin(page);
    await playTo(page, "lens");
    expect(
      await salon(
        page,
        () => getComputedStyle(document.querySelector("#tools .tool.wish"), "::after").display,
      ),
    ).toBe("none");
  });
});

// ----------------------------------------------------------------------------------------------------------------------
// AC-22.10 (S6) results
// ----------------------------------------------------------------------------------------------------------------------
for (const [name, viewport] of DEVICES) {
  test.describe(`results: ${name}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test("the photo is the hero, Play again the one big button, the hub an icon (AC-22.10)", async ({
      page,
    }) => {
      const errors = await open(page);
      await begin(page);
      const coins0 = await salon(page, () => window.__salon.coins);
      // watch the coin total count up
      await salon(page, () => {
        window.__earn = [];
        new MutationObserver(() =>
          window.__earn.push(document.getElementById("resEarn").textContent),
        ).observe(document.getElementById("resEarn"), {
          childList: true,
          characterData: true,
          subtree: true,
        });
      });
      await salon(page, () => window.__salon.debug.skipToResults());
      await page.waitForFunction(() => window.__salon.phase === "results", null, {
        timeout: 10_000,
      });
      const photo = await page.locator(".photo").boundingBox();
      const again = await page.locator("#againBtn").boundingBox();
      const link = hub(page);
      const home = await link.boundingBox();
      // the photo is about 70 % of a phone's width, half of a tablet's, and never smaller than the old 240 px
      const want = viewport.width < 700 ? 0.66 : viewport.width > viewport.height ? 0.3 : 0.48;
      expect(photo.width / viewport.width).toBeGreaterThanOrEqual(want);
      expect(photo.width).toBeGreaterThan(240);
      // Play again is big and in view; the hub link is a small round icon with a name
      expect(again.width).toBeGreaterThan(200);
      expect(again.height).toBeGreaterThanOrEqual(52);
      expect(inside(again, viewport.width, viewport.height)).toBe(true);
      expect(await link.getAttribute("href")).toBe("../../index.html");
      await expect(link).toHaveAttribute("aria-label", "Back to PlayPad");
      expect(inside(home, viewport.width, viewport.height)).toBe(true);
      expect(home.width).toBeLessThanOrEqual(64);
      expect(home.width).toBeLessThan(again.width / 3);
      expect((await link.innerText()).trim()).toBe(""); // an icon, no words
      expect(await page.locator("#results .big-btn").count()).toBe(1); // exactly one big button
      // the wishes are pictures with a tick (matched) or faded (not)
      await expect(page.locator("#resWants li")).toHaveCount(4);
      const matches = await salon(page, () => window.__salon.result.matches);
      await expect(page.locator("#resWants .tick")).toHaveCount(matches);
      expect(await page.locator("#resLook").innerText()).toMatch(/of 4 matched/); // the sentence lives for screen readers
      // the coin total counts up and lands on the banked amount
      await page.waitForFunction(() => !document.getElementById("resCard").hidden);
      const banked = (await salon(page, () => window.__salon.coins)) - coins0;
      await page.waitForFunction((n) => window.__earn.at(-1) === "+" + n, banked, {
        timeout: 4000,
      });
      const seen = await salon(page, () => window.__earn);
      const nums = seen.map((t) => Number(t.slice(1)));
      expect(nums.length).toBeGreaterThan(5);
      expect(nums).toEqual([...nums].sort((a, b) => a - b)); // only ever counts up
      expect(nums.at(-1)).toBeGreaterThan(0);
      expect(await noHScroll(page)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

// ----------------------------------------------------------------------------------------------------------------------
// AC-22.11 (S7) accessories and stickers
// ----------------------------------------------------------------------------------------------------------------------
for (const [name, viewport] of DEVICES) {
  test.describe(`accessories: ${name}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test("each piece is fully in view when it is chosen, and it pops on (AC-22.11)", async ({
      page,
    }) => {
      await open(page);
      await begin(page);
      await playTo(page, "acc");
      await page.waitForTimeout(900); // the camera glide
      const inHost = (sel) =>
        salon(
          page,
          (s) => {
            const host = document.getElementById("playHost").getBoundingClientRect();
            const steps = document.querySelector("#play .steps").getBoundingClientRect();
            const r = document.querySelector(s).getBoundingClientRect();
            return (
              r.left >= host.left &&
              r.right <= host.right &&
              r.top >= steps.bottom &&
              r.bottom <= host.bottom
            );
          },
          sel,
        );
      await page.getByRole("button", { name: /Tiara: Pearl/ }).click();
      expect(
        await salon(
          page,
          () => document.querySelector('[data-acc="tiara:pearl"]').getAnimations().length,
        ),
      ).toBeGreaterThan(0); // pops on
      await page.waitForTimeout(500);
      expect(await inHost('[data-acc="tiara:pearl"]'), "the tiara is fully visible").toBe(true);
      await page.getByRole("button", { name: "Earrings", exact: true }).click();
      await page.getByRole("button", { name: /Earrings: Star/ }).click();
      await page.waitForTimeout(1000);
      expect(await inHost('[data-acc="earring:star"]'), "the earrings are in view").toBe(true);
      await page.getByRole("button", { name: "Necklace", exact: true }).click();
      await page.getByRole("button", { name: /Necklace: Butterfly/ }).click();
      await page.waitForTimeout(1000);
      expect(await inHost('[data-acc="necklace:butterfly"]'), "the necklace is in view").toBe(true);
    });
  });
}

test.describe("stickers: drag and drop (AC-22.11)", () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test("a sticker dragged from the tray lands on the face; off the face it cancels; tap still adds one", async ({
    page,
  }) => {
    const errors = await open(page);
    await begin(page);
    await playTo(page, "stickers");
    await page.waitForTimeout(900);
    const tool = await page.locator("#tools .tool").nth(1).boundingBox();
    const face = await salon(page, () => window.__salon.debug.unitsToClient(200, 300));
    // drag onto the face
    await page.mouse.move(tool.x + tool.width / 2, tool.y + tool.height / 2);
    await page.mouse.down();
    await page.mouse.move(face.x, face.y, { steps: 10 });
    await expect(page.locator("#dragGhost.on")).toHaveCount(1);
    await page.mouse.up();
    await expect(page.locator("#dragGhost.on")).toHaveCount(0);
    expect(await salon(page, () => window.__salon.stickers)).toBe(1);
    expect(await salon(page, () => window.__salon.done[window.__salon.step])).toBe(true);
    expect(await salon(page, () => window.__salon.saved && 1)).toBe(1);
    // the dropped sticker became the selected one
    await expect(page.locator("#tools .tool").nth(1)).toHaveAttribute("aria-pressed", "true");
    // dropping back on the tray cancels (no new sticker)
    const tool2 = await page.locator("#tools .tool").nth(2).boundingBox();
    await page.mouse.move(tool2.x + tool2.width / 2, tool2.y + tool2.height / 2);
    await page.mouse.down();
    await page.mouse.move(tool2.x + tool2.width / 2 + 40, tool2.y - 4, { steps: 6 });
    await page.mouse.up();
    expect(await salon(page, () => window.__salon.stickers)).toBe(1);
    // a tap on the face still adds one (anywhere free)
    const free = await salon(page, () => window.__salon.debug.unitsToClient(130, 330));
    await page.mouse.click(free.x, free.y);
    expect(await salon(page, () => window.__salon.stickers)).toBe(2);
    expect(errors).toEqual([]);
  });

  test("a placed sticker can be dragged to move it; a tap on it still adds another", async ({
    page,
  }) => {
    await open(page);
    await begin(page);
    await playTo(page, "stickers");
    await page.waitForTimeout(900);
    const at = await salon(page, () => window.__salon.debug.unitsToClient(200, 300));
    await page.mouse.click(at.x, at.y);
    expect(await salon(page, () => window.__salon.stickers)).toBe(1);
    const transform = () =>
      salon(page, () => document.querySelector("#stickersGrp > g").getAttribute("transform"));
    const first = await transform();
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 50, at.y + 20, { steps: 6 });
    await page.mouse.up();
    expect(await transform()).not.toBe(first);
    expect(await salon(page, () => window.__salon.stickers)).toBe(1); // moved, not added
    const moved = await salon(page, () => window.__salon.debug.unitsToClient(200, 300));
    await page.mouse.click(moved.x + 50, moved.y + 20); // a tap on it: one more
    expect(await salon(page, () => window.__salon.stickers)).toBe(2);
  });

  test("holding a placed sticker for 600 ms shrinks it away", async ({ page }) => {
    await open(page);
    await begin(page);
    await playTo(page, "stickers");
    await page.waitForTimeout(900);
    const at = await salon(page, () => window.__salon.debug.unitsToClient(200, 300));
    await page.mouse.click(at.x, at.y);
    expect(await salon(page, () => window.__salon.stickers)).toBe(1);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    await page.waitForFunction(() => window.__salon.stickers === 0);
  });
});

// ----------------------------------------------------------------------------------------------------------------------
// AC-22.12 (S8) My Album
// ----------------------------------------------------------------------------------------------------------------------
const GOOD_RECIPE = {
  shadow: "rose",
  lens: "violet",
  mascara: "black",
  blush: "rose",
  lips: "cherry",
  tiara: "heart",
  earring: "star",
  necklace: "heart",
  stickers: [["heart", 200, 250]],
};
const LOOK = (extra = {}) => ({
  stars: 3,
  score: 500,
  req: "pink-party",
  recipe: GOOD_RECIPE,
  ...extra,
});

test.describe("My Album: saving and sanitising (AC-22.12)", () => {
  test.use({ viewport: PHONE });

  test("a finished makeover saves a recipe of option ids; it survives a reload and shows in the album", async ({
    page,
  }) => {
    const errors = await open(page);
    await begin(page);
    await playTo(page, "acc");
    await page.getByRole("button", { name: /Tiara: Heart/ }).click();
    await playTo(page, "stickers");
    await page.waitForTimeout(900);
    const face = await salon(page, () => window.__salon.debug.unitsToClient(200, 260));
    await page.mouse.click(face.x, face.y);
    await salon(page, () => window.__salon.debug.skipToResults());
    await page.waitForFunction(() => window.__salon.phase === "results", null, { timeout: 10_000 });
    const saved = await salon(page, () => window.__salon.saved.looks[0]);
    expect(saved.recipe.tiara).toBe("heart");
    expect(saved.recipe.stickers).toEqual([["heart", expect.any(Number), expect.any(Number)]]);
    expect(
      Object.keys(saved.recipe).every((k) =>
        [
          "stickers",
          "shadow",
          "lens",
          "mascara",
          "blush",
          "lips",
          "tiara",
          "earring",
          "necklace",
        ].includes(k),
      ),
    ).toBe(true);
    expect(JSON.stringify(saved).length).toBeLessThan(400); // option ids only, no pictures
    await page.reload();
    await page.waitForFunction(() => window.__salon && window.__salon.phase);
    expect(await salon(page, () => window.__salon.album)).toBe(1);
    await expect(page.locator("#albumBtn")).toHaveAttribute("aria-label", "My Album, 1 look");
    expect(errors).toEqual([]);
  });

  test("hostile or unknown recipe data is dropped; old looks without a recipe load unchanged", async ({
    page,
  }) => {
    const many = Array.from({ length: 20 }, (_, i) => ["star", i * 10, i * 20]);
    const errors = await open(page, {
      save: save([
        LOOK({
          recipe: {
            shadow: "rose",
            lens: "__proto__",
            lips: 7,
            tiara: "nope",
            evil: "<img src=x onerror=alert(1)>",
            stickers: [
              ["heart", 1e9, -5],
              ["bogus", 1, 1],
              ["star", "1", 2],
              "x",
              null,
              ["flower", 10.4, 20.6],
              ...many,
            ],
          },
        }),
        { stars: 2, score: 300, req: "ocean-ball" }, // an old save: no recipe at all
        { stars: 3, score: 1, req: "not-a-request", recipe: GOOD_RECIPE }, // unknown request: dropped
        LOOK({ recipe: "string" }),
        LOOK({ recipe: ["array"] }),
        LOOK({ recipe: { stickers: many } }), // 20 good stickers: kept up to the cap
      ]),
    });
    const looks = await salon(page, () => window.__salon.saved.looks);
    expect(looks).toHaveLength(5); // the unknown request is gone
    expect(looks[0].recipe).toMatchObject({ shadow: "rose" });
    expect(Object.keys(looks[0].recipe).sort()).toEqual(["shadow", "stickers"]); // lens/lips/tiara/evil dropped
    expect(looks[0].recipe.stickers).toHaveLength(10); // only the first 14 entries are even looked at; the bad ones are dropped
    expect(looks[0].recipe.stickers[0]).toEqual(["heart", 400, 0]); // clamped onto the art
    expect(looks[0].recipe.stickers[1]).toEqual(["flower", 10, 21]);
    expect(looks[1]).toEqual({ stars: 2, score: 300, req: "ocean-ball" }); // loaded unchanged, still no recipe
    expect(looks[2].recipe).toBeUndefined();
    expect(looks[3].recipe).toBeUndefined();
    expect(looks[4].recipe.stickers).toHaveLength(14); // capped
    expect(await salon(page, () => window.__salon.album)).toBe(2);
    expect(errors).toEqual([]);
  });

  test("at most 12 looks are kept", async ({ page }) => {
    await open(page, { save: save(Array.from({ length: 15 }, () => LOOK())) });
    expect(await salon(page, () => window.__salon.saved.looks.length)).toBe(12);
    await begin(page);
    await salon(page, () => window.__salon.debug.skipToResults());
    await page.waitForFunction(() => window.__salon.phase === "results", null, { timeout: 10_000 });
    expect(await salon(page, () => window.__salon.saved.looks.length)).toBe(12);
    expect(await salon(page, () => window.__salon.saved.looks[0].recipe !== undefined)).toBe(true);
  });

  test("an old save loads unchanged: coins, unlocks, sound and best are kept", async ({ page }) => {
    const errors = await open(page, {
      save: {
        v: 1,
        rev: 4,
        coins: 135,
        unlocked: ["shadow:mint"],
        sound: false,
        looks: [{ stars: 2, score: 300, req: "pink-party" }],
        bestOverall: 300,
      },
    });
    const saved = await salon(page, () => window.__salon.saved);
    expect(saved).toMatchObject({
      coins: 135,
      unlocked: ["shadow:mint"],
      sound: false,
      bestOverall: 300,
    });
    expect(saved.looks).toEqual([{ stars: 2, score: 300, req: "pink-party" }]);
    await expect(page.locator("#albumBtn")).toHaveAttribute("aria-label", "My Album");
    await expect(page.locator("#albumCount")).toBeHidden();
    await page.locator("#albumBtn").click();
    await expect(page.locator("#albumEmpty")).toBeVisible();
    await page.locator("#albumClose").click();
    await begin(page);
    expect(errors).toEqual([]);
  });
});

for (const [name, viewport] of DEVICES) {
  test.describe(`My Album sheet: ${name}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test("opens from the title, draws the saved looks locally, and is keyboard operable (AC-22.12)", async ({
      page,
    }) => {
      const requests = [];
      page.on("request", (r) => requests.push(r.url()));
      const looks = [
        LOOK(),
        LOOK({
          stars: 2,
          req: "ocean-ball",
          recipe: { ...GOOD_RECIPE, lens: "aqua", lips: "coral", stickers: [] },
        }),
        LOOK({ stars: 1, req: "lilac-dream", recipe: { stickers: [] } }),
      ];
      const errors = await open(page, { save: save(looks) });
      await expect(page.locator("#albumCount")).toHaveText("3");
      const btn = page.locator("#albumBtn");
      expect(inside(await btn.boundingBox(), viewport.width, viewport.height)).toBe(true);
      expect((await btn.boundingBox()).width).toBeGreaterThanOrEqual(64);
      // keyboard: focus the button, Enter opens, focus lands in the sheet
      await btn.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#albumModal")).toHaveClass(/open/);
      await expect(page.locator("#albumGrid .polaroid")).toHaveCount(3);
      await expect(page.locator("#albumClose")).toBeFocused();
      // every polaroid has a name and is at least 48 px; the pictures are really painted, one per look
      const tiles = page.locator("#albumGrid .polaroid");
      for (let i = 0; i < 3; i++) {
        await expect(tiles.nth(i)).toHaveAttribute("aria-label", /for Princess .*, \d of 3 stars/);
        const box = await tiles.nth(i).boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(48);
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("#albumGrid canvas")].every((c) => {
            const d = c.getContext("2d").getImageData(c.width / 2, c.height * 0.55, 1, 1).data; // her face
            return d[3] > 0;
          }),
        null,
        { timeout: 8000 },
      );
      // different looks are different pictures
      const urls = await salon(page, () =>
        [...document.querySelectorAll("#albumGrid canvas")].map((c) => c.toDataURL().length),
      );
      expect(new Set(urls).size).toBeGreaterThan(1);
      // Tab stays inside the sheet; Enter on a polaroid opens it big; Escape goes back, then closes
      await tiles.first().focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#albumView")).toBeVisible();
      await expect(page.locator("#albumBack")).toBeFocused();
      await page.waitForFunction(
        () =>
          document.getElementById("albumBigCv").getContext("2d").getImageData(240, 400, 1, 1)
            .data[3] > 0,
        null,
        { timeout: 8000 },
      );
      await page.keyboard.press("Escape");
      await expect(page.locator("#albumView")).toBeHidden();
      await expect(page.locator("#albumGrid .polaroid")).toHaveCount(3);
      await page.keyboard.press("Escape");
      await expect(page.locator("#albumModal")).not.toHaveClass(/open/);
      await expect(btn).toBeFocused();
      // closing frees the pictures; the princess on the title is back to her own look
      expect(await page.locator("#albumGrid canvas").count()).toBe(0);
      expect(await salon(page, () => window.__salon.phase)).toBe("title");
      // nothing was fetched: only this page (data: pictures are not requests)
      expect(requests.filter((u) => !u.startsWith("http://localhost:5599/"))).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

/* eslint-enable max-lines-per-function */
