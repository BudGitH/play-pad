// album.mjs — times My Album with 12 saved looks (dev-only; the "My Album" rows in perf.md).
//
// For each CPU throttle it opens the album three times on a phone profile (390x844 @3x) and reports: the album button's click
// handler (how long the tap blocks), the time until every picture is painted, the longest animation frame while they are
// painted, and the "All looks" click handler (coming back from the big picture).
//
//   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/sparkle-salon-v2/perf/album.mjs [--port 5611] [--page index.old.html]
//
// `--page` measures another file in games/sparkle-salon/ (an older copy), which is how the "before" numbers are made.
// tools/serve.mjs is started on the port when nothing answers there.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const flag = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const PORT = Number(flag("port", 5611));
const PAGE = flag("page", "index.html");
const BASE = `http://localhost:${PORT}`;
const SAVE_KEY = "playpad.sparkleSalon.v1";

/** Twelve different looks, each with up to three stickers (the most an album keeps). */
const STICKERS = [
  ["heart", 200, 250],
  ["star", 150, 300],
  ["flower", 250, 320],
];
const looks = Array.from({ length: 12 }, (_, i) => ({
  stars: 1 + (i % 3),
  score: 100 + i,
  req: ["pink-party", "ocean-ball", "lilac-dream"][i % 3],
  recipe: {
    shadow: "rose",
    lens: ["violet", "aqua", "sapphire"][i % 3],
    mascara: "black",
    blush: "rose",
    lips: ["cherry", "coral", "rose"][i % 3],
    tiara: "heart",
    earring: "star",
    necklace: "heart",
    stickers: STICKERS.slice(0, i % 4),
  },
}));
const save = { v: 1, rev: 3, coins: 77, unlocked: [], sound: true, looks, bestOverall: 0 };

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

/** In the page: open the album, wait for every picture, open one big, come back, close. Returns the timings. */
const ROUND = async () => {
  const painted = () =>
    [...document.querySelectorAll("#albumGrid canvas")].every(
      (c) => c.getContext("2d").getImageData(c.width / 2, c.height * 0.55, 1, 1).data[3] > 0,
    );
  const t0 = performance.now();
  document.getElementById("albumBtn").click();
  const handlerMs = performance.now() - t0;
  let longest = 0;
  let last = performance.now();
  await new Promise((resolveFrames) => {
    const tick = () => {
      const now = performance.now();
      longest = Math.max(longest, now - last);
      last = now;
      if (painted() || now - t0 > 20000) resolveFrames();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const allPaintedMs = performance.now() - t0;
  document.querySelector("#albumGrid .polaroid").click();
  await new Promise((r) => setTimeout(r, 400));
  const t1 = performance.now();
  document.getElementById("albumBack").click();
  const backMs = performance.now() - t1;
  await new Promise((r) => setTimeout(r, 1500));
  document.getElementById("albumClose").click();
  return {
    "open click ms": +handlerMs.toFixed(1),
    "all painted ms": Math.round(allPaintedMs),
    "longest frame ms": Math.round(longest),
    "All looks click ms": +backMs.toFixed(1),
  };
};

const server = await ensureServer();
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
console.log("page:", PAGE);
for (const cpu of [1, 4]) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(save)]);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${BASE}/games/sparkle-salon/${PAGE}`);
  await page.waitForFunction(() => window.__salon && typeof window.__salon.phase === "string");
  await page.waitForTimeout(800);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const rows = {};
  for (let round = 1; round <= 3; round++) {
    rows[`CPU x${cpu}, open #${round}`] = await page.evaluate(ROUND);
    await page.waitForTimeout(300);
  }
  console.table(rows);
  await ctx.close();
}
await browser.close();
if (server) server.kill();
