// shoot-ux.mjs — dev-only. Re-takes the UX-round screenshots in features/sparkle-salon-v2/screens/ (ux-*.jpg): title, client card,
// the pointing-hand demo, a worn tiara, the results and My Album, on a phone, an iPad portrait and an iPad landscape, plus the
// common iPad landscape sizes and a full (12 looks) album.
//
//   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/sparkle-salon-v2/shoot-ux.mjs [--port 5611] [--only phone,ipad-landscape-1080x810]
//
// tools/serve.mjs is started on the port when nothing answers there. Screens are written at 1x so the files stay small.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT = join(HERE, "screens");
const flag = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const PORT = Number(flag("port", 5611));
const ONLY = flag("only", "") ? flag("only", "").split(",") : null;
const BASE = `http://localhost:${PORT}`;
const SAVE_KEY = "playpad.sparkleSalon.v1";

const SCREENS = [
  // [file prefix, width, height, which shots]
  [
    "phone",
    390,
    844,
    ["1-title", "2-client", "3-demo", "4-tiara", "5-results", "6-album", "7-album-12"],
  ],
  [
    "ipad-portrait",
    1024,
    1366,
    ["1-title", "2-client", "3-demo", "4-tiara", "5-results", "6-album", "7-album-12"],
  ],
  [
    "ipad-landscape",
    1366,
    1024,
    ["1-title", "2-client", "3-demo", "4-tiara", "5-results", "6-album", "7-album-12"],
  ],
  ["ipad-landscape-1080x810", 1080, 810, ["1-title", "3-paint", "5-results"]],
  ["ipad-landscape-1024x768", 1024, 768, ["1-title", "3-paint", "5-results"]],
];

const RECIPES = [
  {
    shadow: "rose",
    lens: "violet",
    mascara: "black",
    blush: "rose",
    lips: "cherry",
    tiara: "heart",
    earring: "star",
    necklace: "heart",
    stickers: [["heart", 200, 250]],
  },
  {
    shadow: "sky",
    lens: "aqua",
    mascara: "black",
    blush: "peach",
    lips: "coral",
    tiara: "pearl",
    necklace: "butterfly",
    stickers: [],
  },
  {
    shadow: "rose",
    lens: "sapphire",
    mascara: "black",
    blush: "rose",
    lips: "cherry",
    tiara: "heart",
    stickers: [
      ["star", 150, 300],
      ["flower", 250, 320],
    ],
  },
  { shadow: "sky", lens: "violet", blush: "peach", lips: "coral", stickers: [] },
];
const REQS = ["pink-party", "ocean-ball", "lilac-dream"];
const look = (i, n) => ({
  stars: 1 + (i % 3),
  score: 300 + i * 40,
  req: REQS[i % 3],
  recipe: {
    ...RECIPES[i % 4],
    lens: ["violet", "aqua", "sapphire"][i % 3],
    stickers: (RECIPES[i % 4].stickers || [])
      .concat(i >= 4 ? [["heart", 120 + i * 10, 260]] : [])
      .slice(0, n),
  },
});
const saveWith = (n) => ({
  v: 1,
  rev: 3,
  coins: 215,
  unlocked: [],
  sound: true,
  looks: Array.from({ length: n }, (_, i) => look(i, 3)),
  bestOverall: 540,
});

async function ensureServer() {
  try {
    await fetch(BASE + "/");
    return null;
  } catch {
    const child = spawn(process.execPath, [join(ROOT, "tools/serve.mjs"), String(PORT)], {
      stdio: "ignore",
    });
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      try {
        await fetch(BASE + "/");
        return child;
      } catch {
        /* not up yet: poll again */
      }
    }
    child.kill();
    throw new Error("tools/serve.mjs did not start on port " + PORT);
  }
}

const server = await ensureServer();
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});

/** A fresh page on the game with `looks` saved looks. */
async function openGame(width, height, looks) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify(saveWith(looks))],
  );
  const page = await ctx.newPage();
  await page.goto(BASE + "/games/sparkle-salon/index.html");
  await page.waitForFunction(() => window.__salon && typeof window.__salon.phase === "string");
  await page.waitForTimeout(600);
  return { ctx, page };
}
const shot = (page, prefix, name) =>
  page.screenshot({ path: join(OUT, `ux-${prefix}-${name}.jpg`), type: "jpeg", quality: 82 });
const toStep = (page, id) =>
  page.evaluate((stepId) => {
    const s = window.__salon;
    for (let i = 0; i < 9 && s.stepId !== stepId; i++) {
      s.debug.completeStep();
      s.debug.nextStep();
    }
  }, id);
const glide = (page) =>
  page.waitForFunction(() => document.getElementById("stage").getAnimations().length === 0);
const albumDrawn = (page) =>
  page.waitForFunction(() =>
    [...document.querySelectorAll("#albumGrid canvas")].every(
      (c) => c.getContext("2d").getImageData(c.width / 2, c.height * 0.55, 1, 1).data[3] > 0,
    ),
  );

for (const [prefix, width, height, names] of SCREENS) {
  if (ONLY && !ONLY.includes(prefix)) continue;
  const { ctx, page } = await openGame(width, height, 4);
  if (names.includes("1-title")) await shot(page, prefix, "1-title");
  if (names.includes("6-album")) {
    await page.locator("#albumBtn").click();
    await albumDrawn(page);
    await shot(page, prefix, "6-album");
    await page.locator("#albumClose").click();
  }
  await page.getByRole("button", { name: "Start makeover", exact: true }).click();
  await page.waitForFunction(() => window.__salon.phase === "playing");
  await page.waitForTimeout(700);
  if (names.includes("2-client")) await shot(page, prefix, "2-client");
  await page.getByRole("button", { name: "Let's glam!" }).click();
  await page.waitForFunction(() => !document.querySelector("#reqModal.open"));
  if (names.includes("3-demo") || names.includes("3-paint")) {
    await toStep(page, "shadow");
    await page.waitForFunction(() => window.__salon.demo === true, null, { timeout: 8000 });
    await page.waitForTimeout(1100);
    await shot(page, prefix, names.includes("3-demo") ? "3-demo" : "3-paint");
    await page.mouse.click(2, 2); // a press ends the demo
  }
  if (names.includes("4-tiara")) {
    await toStep(page, "acc");
    await glide(page);
    await page.getByRole("button", { name: /Tiara: Pearl/ }).click();
    await glide(page);
    await page.waitForTimeout(500);
    await shot(page, prefix, "4-tiara");
  }
  if (names.includes("5-results")) {
    await page.evaluate(() => window.__salon.debug.skipToResults());
    await page.waitForFunction(() => window.__salon.phase === "results", null, { timeout: 10000 });
    await page.waitForTimeout(2600);
    await shot(page, prefix, "5-results");
  }
  await ctx.close();
  if (names.includes("7-album-12")) {
    const full = await openGame(width, height, 12);
    await full.page.locator("#albumBtn").click();
    await albumDrawn(full.page);
    await shot(full.page, prefix, "7-album-12");
    await full.ctx.close();
  }
  console.log("shot", prefix);
}
await browser.close();
if (server) server.kill();
