// probe.mjs — headless acceptance probe for Sparkle Salon (dev-only; not part of `npm run smoke`).
//
// Drives the real page like a player (mouse strokes, taps, keyboard, reloads) and prints one
// PASS/FAIL line per acceptance criterion in features/sparkle-salon/requirements.md.
// Exit code 1 if anything fails. Screenshots land in features/sparkle-salon/screens/.
//
//   node features/sparkle-salon/probe.mjs          # starts tools/serve.mjs on :5601 itself if needed
//   BASE_URL=http://localhost:5599 node features/sparkle-salon/probe.mjs
//   PW_CHROMIUM_PATH=/path/to/chrome node features/sparkle-salon/probe.mjs   # optional
//
// Nothing here uses a fixed sleep to decide an outcome: state is polled through window.__salon.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const SHOTS = resolve(HERE, "screens");
const PORT = Number(process.env.PORT || 5601);
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const URL = `${BASE}/games/sparkle-salon/`;
const SAVE_KEY = "playpad.sparkleSalon.v1";
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(id, name, ok, detail = "") {
  results.push({ id, name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${name}${detail ? "  — " + detail : ""}`);
}

/** Start the repo's static server unless one already answers on BASE. */
async function ensureServer() {
  try {
    await fetch(BASE + "/");
    return null;
  } catch {
    const child = spawn(process.execPath, ["tools/serve.mjs", String(PORT)], {
      cwd: ROOT,
      stdio: "ignore",
    });
    for (let i = 0; i < 50; i++) {
      try {
        await fetch(BASE + "/");
        return child;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error("static server did not start");
  }
}

async function open(
  browser,
  { viewport = { width: 390, height: 844 }, url = URL, touch = false, reduced = false, init } = {},
) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: touch,
    hasTouch: touch,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  const requests = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text());
  });
  page.on("requestfailed", (r) => {
    if (!/ERR_ABORTED/.test(r.failure()?.errorText || "")) errors.push("requestfailed: " + r.url());
  });
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(url);
  await page.waitForFunction(() => window.__salon && typeof window.__salon.phase === "string");
  return { ctx, page, errors, requests };
}

const S = (page, fn, arg) => page.evaluate(fn, arg);
const startBtn = (page) => page.getByRole("button", { name: "Start makeover", exact: true });
async function begin(page) {
  await startBtn(page).click();
  await page.waitForFunction(() => window.__salon.phase === "playing");
  await page.getByRole("button", { name: "Let's glam!" }).click();
  await page
    .locator("#reqModal.open")
    .waitFor({ state: "detached" })
    .catch(() => {});
  await page.waitForFunction(() => !document.querySelector("#reqModal.open"));
}
const shot = (page, name) =>
  page.screenshot({ path: resolve(SHOTS, name + ".jpg"), type: "jpeg", quality: 82 });
const progress = (page) => S(page, () => window.__salon.progress);

/** Rub the brush back and forth over the current step's region until it completes (or the passes run out). */
async function scrub(page, { passes = 8, points = 16, samples } = {}) {
  for (let k = 0; k < passes; k++) {
    await scrubPass(page, points, k === 0, samples);
    if (await S(page, () => window.__salon.done[window.__salon.step])) break;
  }
  await page.mouse.up();
}
async function scrubPass(page, points, first, samples) {
  for (let i = 0; i <= points; i++) {
    const p = await S(page, (f) => window.__salon.debug.regionPoint(f), i / points);
    if (first && i === 0) {
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
    }
    await page.mouse.move(p.x, p.y, { steps: 2 });
    if (samples && i % 4 === 0) samples.push(await progress(page));
  }
}
async function wipeSmudges(page) {
  // the smudge positions come from the page itself (data-x / data-y on each .smudge group)
  const spots = await S(page, () =>
    [...document.querySelectorAll(".smudge")].map((e) => [
      Number(e.dataset.x),
      Number(e.dataset.y),
    ]),
  );
  for (let k = 0; k < 4; k++) {
    for (const [i, [x, y]] of spots.entries()) {
      const c = await S(page, ([x, y]) => window.__salon.debug.unitsToClient(x, y), [x, y]);
      if (k === 0 && i === 0) {
        await page.mouse.move(c.x, c.y);
        await page.mouse.down();
      }
      await page.mouse.move(c.x + 8, c.y + 8, { steps: 3 });
    }
    if (await S(page, () => window.__salon.done[0])) break;
  }
  await page.mouse.up();
}
const nextBtn = (page) => page.locator("#nextBtn");
async function goNext(page) {
  const before = await S(page, () => window.__salon.step);
  await nextBtn(page).click();
  if (before < 7) await page.waitForFunction((b) => window.__salon.step === b + 1, before);
}
/** The tray button the client asked for (it carries the heart badge). */
const wantedTool = (page) => page.locator("#tools button.tool:has(.want)");

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  });
  try {
    // ------------------------------------------------------------------ AC-1 title screen
    {
      const { ctx, page, errors, requests } = await open(browser);
      const f0 = await S(page, () => window.__salon.frame);
      await page.waitForTimeout(250);
      const f1 = await S(page, () => window.__salon.frame);
      const box = await startBtn(page).boundingBox();
      const hook = await S(page, () =>
        ["phase", "step", "frame", "coins"].every(
          (k) => typeof Object.getOwnPropertyDescriptor(window.__salon, k).get === "function",
        ),
      );
      check(
        "AC-19",
        "window.__salon exists from load with live getters phase/step/frame/coins",
        hook,
      );
      check(
        "AC-1",
        "title: phase=title, Start makeover visible inside the viewport, frame idle",
        (await S(page, () => window.__salon.phase)) === "title" &&
          box &&
          box.y + box.height <= 844 &&
          f0 === f1,
        `frame ${f0}->${f1}`,
      );
      check(
        "AC-1b",
        "title has a sound toggle and a back link to the hub",
        (await page.locator("#soundBtn").getAttribute("aria-pressed")) === "true" &&
          (await page.locator('#title a[href="../../index.html"]').count()) === 1,
      );
      await shot(page, "390-title");
      await ctx.close();

      // ------------------------------------------------------------------ AC-17 clean page
      void errors;
      void requests;
    }

    // ------------------------------------------------------------------ main play-through (390x844)
    const { ctx, page, errors, requests } = await open(browser);
    await startBtn(page).click();
    await page.waitForFunction(() => window.__salon.phase === "playing");
    const want = await S(page, () => window.__salon.want);
    const cardNames = await page.locator("#reqWants li").allInnerTexts();
    check(
      "AC-2",
      "Start -> phase=playing; the client card lists 4 colour hints",
      cardNames.length === 4 && Object.keys(want).length === 4,
      cardNames.join(" | ").replace(/\n/g, " "),
    );
    await shot(page, "390-request");
    await page.getByRole("button", { name: "Let's glam!" }).click();
    await page.waitForFunction(() => !document.querySelector("#reqModal.open"));
    const fA = await S(page, () => window.__salon.frame);
    await page.waitForTimeout(400);
    const fB = await S(page, () => window.__salon.frame);
    check(
      "AC-2b",
      "RAF loop runs while playing (frame increments)",
      fB - fA >= 8,
      `+${fB - fA} frames in 400ms`,
    );

    const names = await page.locator("#dots li").count();
    const stepNames = [];
    check("AC-3a", "step indicator shows 8 steps", names === 8);

    // ---- step 0 cleanse (wipe)
    stepNames.push(await page.locator("#stepName").innerText());
    const p0 = await progress(page);
    await shot(page, "390-step1-cleanse-before");
    await wipeSmudges(page);
    const p0b = await S(page, () => ({
      done: window.__salon.done[0],
      coins: window.__salon.coins,
      audio: window.__salon.audio.played,
    }));
    check(
      "AC-4a",
      "cleanse: wiping the smudges completes the step (+10 coins, chime played)",
      p0 === 0 && p0b.done && p0b.coins === 10 && p0b.audio > 0,
      JSON.stringify(p0b),
    );
    await shot(page, "390-step1-cleanse-done");
    check(
      "AC-8a",
      "Next turns prominent (data-ready=true) once the step is done",
      (await nextBtn(page).getAttribute("data-ready")) === "true",
    );
    await goNext(page);

    // ---- step 1 eye shadow (rub) — monotonic progress, then auto-complete
    stepNames.push(await page.locator("#stepName").innerText());
    await wantedTool(page).click(); // use the colour the client asked for
    const samples = [];
    await scrub(page, { passes: 8, points: 16, samples });
    const mono = samples.every((v, i) => i === 0 || v >= samples[i - 1] - 1e-9);
    const first = samples.find((v) => v > 0);
    const sh = await S(page, () => ({ done: window.__salon.done[1], coins: window.__salon.coins }));
    check(
      "AC-4b",
      "eye shadow: rubbing raises coverage monotonically and auto-completes at ~80% (+10 coins)",
      mono && first !== undefined && first < 0.8 && sh.done && sh.coins === 20,
      `samples ${samples.length}, first ${first?.toFixed(2)}, ${JSON.stringify(sh)}`,
    );
    check(
      "AC-4c",
      "the progress ring reports the step as done",
      (await page.locator("#ringTxt").innerText()) === "✓",
    );
    await shot(page, "390-step2-shadow-done");
    await goNext(page);

    // ---- step 2 lenses: tap to choose, instant swap
    stepNames.push(await page.locator("#stepName").innerText());
    const irisBefore = await page.locator("#irisMid").getAttribute("stop-color");
    await wantedTool(page).click();
    const irisAfter = await page.locator("#irisMid").getAttribute("stop-color");
    check(
      "AC-6a",
      "lenses: tapping a colour swaps the iris instantly and completes the step",
      irisBefore !== irisAfter && (await S(page, () => window.__salon.done[2])),
      `${irisBefore} -> ${irisAfter}`,
    );
    await shot(page, "390-step3-lens-done");
    await goNext(page);

    // ---- step 3 mascara: lashes coat as the wand sweeps (skip-less: scrub)
    stepNames.push(await page.locator("#stepName").innerText());
    await scrub(page, { passes: 12, points: 40 });
    const lashOp = await page
      .locator("#lashFullL .lf")
      .first()
      .evaluate((e) => Number(e.style.opacity));
    check(
      "AC-4d",
      "mascara: sweeping the wand coats the lashes and completes the step",
      (await S(page, () => window.__salon.done[3])) && lashOp > 0.5,
      `lash opacity ${lashOp}`,
    );
    await goNext(page);

    // ---- step 4 blush: a TAP paints a dab; Redo clears it
    stepNames.push(await page.locator("#stepName").innerText());
    await wantedTool(page).click();
    const pt = await S(page, () => window.__salon.debug.regionPoint(0.5));
    await page.mouse.click(pt.x, pt.y);
    const pTap = await progress(page);
    check(
      "AC-5",
      "blush: a single tap paints a dab (progress rises, step not yet done)",
      pTap > 0 && pTap < 0.8,
      `progress ${pTap.toFixed(3)}`,
    );
    await page.locator("#clearBtn").click();
    check(
      "AC-7",
      "Redo clears the step (progress back to 0, paint removed)",
      (await progress(page)) === 0,
    );
    await scrub(page, { passes: 12, points: 40 });
    await goNext(page);

    // ---- step 5 lipstick: use the client's colour
    stepNames.push(await page.locator("#stepName").innerText());
    await wantedTool(page).click();
    await scrub(page, { passes: 12, points: 20 });
    await goNext(page);

    // ---- step 6 accessories
    stepNames.push(await page.locator("#stepName").innerText());
    await page.getByRole("button", { name: /Tiara: Heart tiara/ }).click();
    const tiaraShown = await page
      .locator('[data-acc="tiara:heart"]')
      .evaluate((e) => e.style.display !== "none");
    const pearlHidden = await page
      .locator('[data-acc="tiara:pearl"]')
      .evaluate((e) => e.style.display === "none");
    await page.getByRole("button", { name: "Necklace", exact: true }).click();
    await page.getByRole("button", { name: /Necklace: Star necklace/ }).click();
    const necklace = await page
      .locator('[data-acc="necklace:star"]')
      .evaluate((e) => e.style.display !== "none");
    check(
      "AC-6b",
      "accessories: tiara + necklace swap in instantly (old one hidden) and complete the step",
      tiaraShown && pearlHidden && necklace && (await S(page, () => window.__salon.done[6])),
    );
    await shot(page, "390-step7-accessories");
    await goNext(page);

    // ---- step 7 stickers (optional): tap places one
    stepNames.push(await page.locator("#stepName").innerText());
    const c = await S(page, () => window.__salon.debug.unitsToClient(150, 250));
    await page.mouse.click(c.x, c.y);
    check(
      "AC-6c",
      "stickers: tapping the face sticks a sticker and completes the step",
      (await S(page, () => window.__salon.stickers)) === 1 &&
        (await S(page, () => window.__salon.done[7])),
    );
    await shot(page, "390-step8-stickers");
    check(
      "AC-3b",
      "the 8 steps run in order: Cleanse, Eye shadow, Eye lenses, Mascara, Blush, Lipstick, Accessories, Stickers",
      stepNames.join(",") ===
        "Cleanse,Eye shadow,Eye lenses,Mascara,Blush,Lipstick,Accessories,Stickers",
      stepNames.join(","),
    );
    check(
      "AC-8b",
      "the last step's Next reads 'Photo!' when ready",
      (await page.locator("#nextTxt").innerText()) === "Photo!",
    );

    // ---- reveal
    const coinsBefore = await S(page, () => window.__salon.coins);
    await nextBtn(page).click();
    await page.waitForFunction(
      () => window.__salon.phase === "reveal" || window.__salon.phase === "results",
    );
    const flash = await page.locator("#flash").evaluate((e) => e.classList.contains("go"));
    await page.waitForFunction(() => window.__salon.phase === "results", null, { timeout: 10000 });
    const res = await S(page, () => ({
      r: window.__salon.result,
      coins: window.__salon.coins,
      saved: window.__salon.saved,
    }));
    check(
      "AC-11a",
      "reveal: camera flash, then the photo screen with a 1-3 star rating",
      flash && res.r.stars >= 1 && res.r.stars <= 3,
      `stars ${res.r.stars}`,
    );
    check(
      "AC-11b",
      "results: coins banked (steps + matches + stars) and persisted",
      res.coins > coinsBefore && res.saved.coins === res.coins,
      `${coinsBefore} -> ${res.coins}`,
    );
    check(
      "AC-11c",
      "results: bestOverall is a top-level number in the save",
      typeof res.saved.bestOverall === "number" &&
        res.saved.bestOverall === res.r.score &&
        res.saved.v === 1,
    );
    check(
      "AC-12a",
      "matching the client's 4 colours with all 8 steps done earns 3 stars",
      res.r.matches === 4 && res.r.stars === 3 && res.r.stepsDone === 8,
      JSON.stringify({ matches: res.r.matches, stars: res.r.stars, steps: res.r.stepsDone }),
    );
    const litStars = await page.locator("#stars .star.lit").count();
    check("AC-11d", "the earned stars light up one by one", litStars === res.r.stars);
    await shot(page, "390-results");

    // ---- play again / back link
    const hubHref = await page.locator('#results a[href="../../index.html"]').getAttribute("href");
    await page.locator("#againBtn").click();
    await page.waitForFunction(
      () => window.__salon.phase === "playing" && document.querySelector("#reqModal.open"),
    );
    check(
      "AC-13",
      "Play again starts a new makeover (new client card, phase=playing); ← PlayPad links to the hub",
      hubHref === "../../index.html" && (await S(page, () => window.__salon.step)) === 0,
    );
    await page.getByRole("button", { name: "Let's glam!" }).click();

    // ---- AC-10 persistence: reload keeps coins / unlocks
    const savedCoins = await S(page, () => window.__salon.coins);
    await page.reload();
    await page.waitForFunction(() => window.__salon);
    check(
      "AC-10a",
      "reload keeps coins and best score",
      (await S(page, () => window.__salon.coins)) === savedCoins &&
        (await S(page, () => window.__salon.saved.bestOverall)) > 0,
      `coins ${savedCoins}`,
    );

    // ---- AC-9 unlocks (locked item, not enough coins, then enough)
    await S(page, () =>
      localStorage.setItem(
        "playpad.sparkleSalon.v1",
        JSON.stringify({ v: 1, coins: 10, unlocked: [], sound: true, looks: [], bestOverall: 0 }),
      ),
    );
    await page.reload();
    await page.waitForFunction(() => window.__salon);
    await begin(page);
    await S(page, () => window.__salon.debug.completeStep());
    await goNext(page); // -> eye shadow
    const lockedBtn = page.getByRole("button", {
      name: /Eye shadow: Mint, locked, costs 50 coins/,
    });
    const hasLock = (await lockedBtn.locator(".badge").count()) === 1;
    await lockedBtn.click();
    const noYes = await page.locator("#unlockYes").isHidden();
    const coinsA = await S(page, () => window.__salon.coins);
    await page.locator("#unlockNo").click();
    check(
      "AC-9a",
      "a locked colour shows a lock badge; with too few coins the sheet offers no Unlock",
      hasLock && noYes && coinsA === 20,
      `coins ${coinsA}`,
    );
    await S(page, () => window.__salon.debug.addCoins(100));
    await lockedBtn.click();
    await page.locator("#unlockYes").click();
    const after = await S(page, () => ({
      coins: window.__salon.coins,
      saved: window.__salon.saved,
    }));
    check(
      "AC-9b",
      "unlocking spends the coins, is saved, and the colour is used straight away",
      after.coins === coinsA + 100 - 50 &&
        after.saved.unlocked.includes("shadow:mint") &&
        (await page
          .getByRole("button", { name: /Eye shadow: Mint$/ })
          .getAttribute("aria-pressed")) === "true",
      JSON.stringify(after.saved.unlocked),
    );
    await page.reload();
    await page.waitForFunction(() => window.__salon);
    check(
      "AC-9c",
      "the unlock survives a reload",
      (await S(page, () => window.__salon.saved.unlocked.includes("shadow:mint"))) === true,
    );

    // ---- AC-14 sound: toggle persists, music pauses when hidden
    await page.locator("#soundBtn").click();
    const off = await S(page, () => window.__salon.saved.sound);
    await page.locator("#soundBtn").click();
    const on = await S(page, () => window.__salon.saved.sound);
    const musicRan = await page
      .waitForFunction(
        () => window.__salon.audio.music >= 6 && window.__salon.audio.played > 0,
        null,
        {
          timeout: 8000,
        },
      )
      .then(
        () => true,
        () => false,
      );
    check(
      "AC-14b",
      "music: the loop scheduler runs after the first gesture and synthesised effects fire",
      musicRan,
      JSON.stringify(await S(page, () => window.__salon.audio)),
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page
      .waitForFunction(() => window.__salon.audio.state === "suspended", null, { timeout: 3000 })
      .catch(() => {});
    const hiddenState = await S(page, () => window.__salon.audio.state);
    check(
      "AC-14",
      "sound toggle persists (off then on) and the audio context suspends while the tab is hidden",
      off === false && on === true && hiddenState === "suspended",
      `ctx ${hiddenState}`,
    );

    // ---- AC-12b free styling is never punished: skip every step, still >= 1 star and coins
    {
      const q = await open(browser);
      await begin(q.page);
      for (let i = 0; i < 8; i++) await goNext(q.page);
      await q.page.waitForFunction(() => window.__salon.phase === "results", null, {
        timeout: 10000,
      });
      const r = await S(q.page, () => ({ r: window.__salon.result, coins: window.__salon.coins }));
      check(
        "AC-12b",
        "a run with every step skipped still earns 1 star and coins (never punished)",
        r.r.stars === 1 && r.r.matches === 0 && r.coins === 15 && r.r.stepsDone === 0,
        JSON.stringify({ stars: r.r.stars, coins: r.coins }),
      );
      await q.ctx.close();
    }

    // ---- AC-17 no errors / no foreign requests
    const foreign = requests.filter(
      (u) => !u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:"),
    );
    const allowed = requests
      .filter((u) => u.startsWith(BASE))
      .every(
        (u) =>
          /\/(games\/sparkle-salon\/(index\.html)?|scripts\/theme\.js|styles\/(tokens|base)\.css|icons\/favicon\.svg)$/.test(
            u.split("?")[0],
          ) || u === BASE + "/",
      );
    check(
      "AC-17",
      "no console errors / failed requests, and nothing fetched beyond the page + shared css/theme + favicon",
      errors.length === 0 && foreign.length === 0 && allowed,
      errors.concat(foreign).join(" | ") || `${requests.length} requests`,
    );
    await ctx.close();

    // ------------------------------------------------------------------ AC-10b hostile save
    {
      const hostile = JSON.stringify({
        v: 1,
        coins: "1e999",
        unlocked: ["__proto__", "shadow:gold", "nope", 5],
        sound: "yes",
        looks: [
          { stars: 99, score: -4, req: "zzz" },
          { stars: 2, score: 1e99, req: "ocean-ball" },
        ],
        bestOverall: Infinity,
      });
      const h = await open(browser, {
        init: `localStorage.setItem("${SAVE_KEY}", ${JSON.stringify(hostile)})`,
      });
      const s = await S(h.page, () => window.__salon.saved);
      check(
        "AC-10b",
        "a hand-edited save is sanitised (no Infinity, unknown ids dropped, caps applied)",
        s.coins === 0 &&
          s.unlocked.length === 1 &&
          s.unlocked[0] === "shadow:gold" &&
          s.looks.length === 1 &&
          s.looks[0].score === 99999 &&
          s.bestOverall === 0 &&
          s.sound === true,
        JSON.stringify(s),
      );
      await h.ctx.close();
      const broken = await open(browser, {
        init: `Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });`,
      });
      check(
        "AC-10c",
        "blocked / throwing storage never breaks the game",
        (await S(broken.page, () => window.__salon.phase)) === "title" &&
          broken.errors.filter((e) => !/blocked/.test(e)).length === 0,
      );
      await broken.ctx.close();
    }

    // ------------------------------------------------------------------ AC-15 keyboard + a11y
    {
      const k = await open(browser);
      await begin(k.page);
      const unnamed = await S(
        k.page,
        () =>
          [...document.querySelectorAll("button, a[href]")].filter(
            (e) =>
              e.offsetParent !== null &&
              !(e.getAttribute("aria-label") || e.textContent || "").trim(),
          ).length,
      );
      check(
        "AC-15a",
        "every visible button / link has an accessible name",
        unnamed === 0,
        `${unnamed} unnamed`,
      );
      const small = await S(k.page, () =>
        [...document.querySelectorAll("#play button, #play a[href]")]
          .filter((e) => e.offsetParent !== null && !e.closest("[hidden]"))
          .map((e) => ({ id: e.id || e.className, r: e.getBoundingClientRect() }))
          .filter((x) => x.r.width > 0 && (x.r.width < 44 || x.r.height < 44))
          .map((x) => `${x.id}:${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
      );
      check("AC-15b", "touch targets are at least 44x44px", small.length === 0, small.join(", "));
      // keyboard: focus a tray tool with Tab, press Enter -> it becomes selected
      await k.page.locator("#tools button.tool").nth(1).focus();
      await k.page.keyboard.press("Enter");
      const sel = await k.page.locator("#tools button.tool").nth(1).getAttribute("aria-pressed");
      const ring = await k.page
        .locator("#tools button.tool")
        .nth(1)
        .evaluate((e) => parseFloat(getComputedStyle(e).outlineWidth));
      check(
        "AC-15c",
        "tray tools are keyboard operable (Enter picks) with a visible focus ring",
        sel === "true" && ring >= 2,
        `outline ${ring}px`,
      );
      // keyboard painting: go to eye shadow, focus the stage, hold Space + arrows
      await S(k.page, () => window.__salon.debug.completeStep());
      await goNext(k.page);
      await k.page.locator("#stage").focus();
      const before = await progress(k.page);
      // walk the keyboard cursor (8 art units per press) onto the left eyelid, then hold Space and sweep
      const cells = await S(k.page, () => window.__salon.debug.regionCells());
      const target = cells[Math.floor(cells.length * 0.12)];
      const at = await S(k.page, () => window.__salon.kbd);
      const walk = async (dx, dy) => {
        const key = (n, neg, pos) => (n < 0 ? neg : pos);
        for (let i = 0; i < Math.round(Math.abs(dx) / 8); i++)
          await k.page.keyboard.press(key(dx, "ArrowLeft", "ArrowRight"));
        for (let i = 0; i < Math.round(Math.abs(dy) / 8); i++)
          await k.page.keyboard.press(key(dy, "ArrowUp", "ArrowDown"));
      };
      await walk(target[0] - at.x, target[1] - at.y);
      await k.page.keyboard.down("Space");
      for (let i = 0; i < 12; i++) await k.page.keyboard.press(i % 2 ? "ArrowLeft" : "ArrowRight");
      await k.page.keyboard.up("Space");
      const after = await progress(k.page);
      check(
        "AC-15d",
        "keyboard: arrow keys move the tool and Space paints (progress rises)",
        after > before + 0.02,
        `progress ${before.toFixed(2)} -> ${after.toFixed(2)}`,
      );
      await k.page.keyboard.press("Escape");
      const leave = await k.page.locator("#leaveModal.open").count();
      check("AC-15e", "Esc opens the leave sheet (Esc again closes it)", leave === 1);
      await k.page.keyboard.press("Escape");
      await k.ctx.close();
    }

    // ------------------------------------------------------------------ AC-15f reduced motion
    {
      const r = await open(browser, { reduced: true });
      await begin(r.page);
      await S(r.page, () => window.__salon.debug.skipToResults());
      await r.page.waitForFunction(() => window.__salon.phase === "results", null, {
        timeout: 10000,
      });
      const lit = await r.page.locator("#stars .star.lit").count();
      const vis = await r.page.locator("#againBtn").isVisible();
      check(
        "AC-15f",
        "prefers-reduced-motion: the whole flow still reaches the results with stars lit and buttons visible",
        lit >= 1 && vis && r.errors.length === 0,
        r.errors.join(" | "),
      );
      await r.ctx.close();
    }

    // ------------------------------------------------------------------ AC-15g touch: tool sits above the fingertip
    {
      const t = await open(browser, { touch: true });
      await begin(t.page);
      const p = await S(t.page, () => window.__salon.debug.unitsToClient(226, 232));
      await t.page.touchscreen.tap(p.x, p.y + 46);
      const prog = await progress(t.page);
      check(
        "AC-15g",
        "touch: a fingertip tap paints at the lifted tool tip (cleanse progress rises)",
        prog > 0,
        `progress ${prog.toFixed(3)}`,
      );
      await t.ctx.close();
    }

    // ------------------------------------------------------------------ AC-16 responsive + screenshots
    const viewports = [
      ["390x844", 390, 844],
      ["844x390", 844, 390],
      ["820x1180", 820, 1180],
      ["1280x800", 1280, 800],
      ["360x640", 360, 640],
    ];
    for (const [label, w, hgt] of viewports) {
      const v = await open(browser, { viewport: { width: w, height: hgt } });
      const sb = await startBtn(v.page).boundingBox();
      const noScroll = await S(
        v.page,
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.body.scrollWidth <= innerWidth,
      );
      await begin(v.page);
      await S(v.page, () => window.__salon.debug.completeStep());
      await goNext(v.page);
      const trayVisible = await v.page.locator("#tools button.tool").first().isVisible();
      const nextBox = await nextBtn(v.page).boundingBox();
      const nextInside =
        nextBox &&
        nextBox.x >= 0 &&
        nextBox.x + nextBox.width <= w &&
        nextBox.y + nextBox.height <= hgt;
      if (label === "1280x800" || label === "844x390") await shot(v.page, label + "-play");
      await S(v.page, () => window.__salon.debug.skipToResults());
      await v.page.waitForFunction(() => window.__salon.phase === "results", null, {
        timeout: 10000,
      });
      await v.page.locator("#againBtn").scrollIntoViewIfNeeded();
      const againBox = await v.page.locator("#againBtn").boundingBox();
      const againInside = againBox && againBox.y + againBox.height <= hgt + 1 && againBox.y >= 0;
      if (label === "1280x800" || label === "844x390") await shot(v.page, label + "-results");
      check(
        `AC-16 ${label}`,
        "no horizontal scroll; Start, tray, Next and Play again are all reachable on screen",
        sb &&
          sb.y + sb.height <= hgt &&
          noScroll &&
          trayVisible &&
          nextInside &&
          againInside &&
          v.errors.length === 0,
        `start ${sb ? Math.round(sb.y + sb.height) : "?"}/${hgt}, next ${nextInside}, again ${againInside}`,
      );
      await v.ctx.close();
    }
    {
      const v = await open(browser, { viewport: { width: 1280, height: 800 } });
      await shot(v.page, "1280-title");
      await v.ctx.close();
    }

    // ------------------------------------------------------------------ AC-18 file:// works
    {
      const f = await open(browser, {
        url: pathToFileURL(resolve(ROOT, "games/sparkle-salon/index.html")).href,
      });
      await startBtn(f.page).click();
      await f.page.waitForFunction(() => window.__salon.phase === "playing");
      check(
        "AC-18",
        "opens from file:// and Start works, with no errors",
        f.errors.length === 0,
        f.errors.join(" | "),
      );
      await f.ctx.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
