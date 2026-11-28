// measure.mjs — iPad-class boot and first-play measurement for Kampung Quest (dev-only, AC-P22 / AC-P23).
//
// Loads the game in headless Chromium with iPad emulation (iPad Pro 11 landscape, iPad gen 7 portrait),
// an iPadOS "desktop" user agent (Macintosh + MacIntel + touch points, as real iPadOS Safari reports),
// and a CPU throttle via CDP. Records per run:
//   loadedMs   time from navigation start to `__kq.loaded` (Start enabled)
//   readyMs    time from the Start tap to `__kq.ready`
//   stages     when each loading step / status text first appeared (from the title screen DOM)
//   longLoad   long tasks (PerformanceObserver "longtask") before Start: count, total, max
//   longPlay   long tasks in the first PLAY_MS of real play after Start: count, max, count > 200 ms
//   heapPeakMB peak JS heap sampled every 250 ms (performance.memory, --enable-precise-memory-info)
//   heapCdpMB  CDP Performance.getMetrics JSHeapUsedSize at the end
//   tex        unique textures in the scene + estimated GPU bytes (w x h x 4, x 4/3 when mipmapped)
//   programs, calls, fps, quality, dpr, touchUi
// Prints a JSON row per run and a median table per (device, region).
//
// Usage: node tools/serve.mjs 5605 &   then
//   PW_PORT=5605 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
//     node features/kampung-quest-playability/ipad/measure.mjs [--runs 3] [--cpu 4] [--play 10000]
//     [--only kampung|haramain] [--device pro11|gen7] [--out file.json]
// Software GL (SwiftShader) is far slower than an iPad GPU: compare before/after back to back on one
// box, never against a real device. Absolute numbers are only meaningful relative to each other.
import { chromium, devices } from "@playwright/test";
import { writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? def : argv[i + 1];
};
const PORT = Number(process.env.PW_PORT) || 5605;
const RUNS = Number(arg("runs", 3));
const CPU = Number(arg("cpu", 4));
const PLAY_MS = Number(arg("play", 10000));
const ONLY = arg("only", null);
const DEVICE = arg("device", null);
const OUT = arg("out", null);
const BASE = `http://localhost:${PORT}/games/kampung-quest/index.html`;

/** iPadOS 13+ Safari asks for desktop sites: a Macintosh UA, platform MacIntel, but touch points. */
const IPADOS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

function ipad(name) {
  const d = { ...devices[name] };
  delete d.defaultBrowserType;
  return { ...d, userAgent: IPADOS_UA };
}
const PROFILES = {
  pro11: { label: "iPad Pro 11 landscape", ctx: ipad("iPad Pro 11 landscape") },
  gen7: { label: "iPad (gen 7)", ctx: ipad("iPad (gen 7)") },
};
const REGIONS = ["kampung", "haramain"];

/** Runs in the page before any script: iPadOS navigator facts + the probes this script reads. */
function initProbe() {
  Object.defineProperty(navigator, "platform", { get: () => "MacIntel", configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5, configurable: true });
  const M = (window.__measure = { long: [], stages: [], heapPeak: 0, loadedAt: 0, readyAt: 0 });
  try {
    new PerformanceObserver((list) => {
      list
        .getEntries()
        .forEach((e) => M.long.push([Math.round(e.startTime), Math.round(e.duration)]));
    }).observe({ type: "longtask", buffered: true });
  } catch (err) {
    M.noLongtask = String(err);
  }
  const seen = new Set();
  function sample() {
    const mem = performance.memory;
    if (mem) M.heapPeak = Math.max(M.heapPeak, mem.usedJSHeapSize);
    const st = document.getElementById("kqLoadStatus");
    const text = st ? st.textContent.replace(/\s*\d+%$/, "").trim() : "";
    if (text && !seen.has(text)) {
      seen.add(text);
      M.stages.push([text, Math.round(performance.now())]);
    }
    document.querySelectorAll("#kqLoadSteps li").forEach((li, i) => {
      const key = i + ":" + li.className;
      if (!seen.has(key)) {
        seen.add(key);
        M.stages.push([key, Math.round(performance.now())]);
      }
    });
    const kq = window.__kq;
    if (kq && kq.loaded && !M.loadedAt) M.loadedAt = performance.now();
    if (kq && kq.ready && !M.readyAt) M.readyAt = performance.now();
  }
  setInterval(sample, 50);
}

/** In the page: unique textures in the scene and their estimated GPU bytes. */
function textureReport() {
  const s = window.KQ && window.KQ.Game && window.KQ.Game.S;
  if (!s || !s.scene) return null;
  const seen = new Set();
  let bytes = 0;
  let biggest = 0;
  const visit = (t) => {
    if (!t || !t.isTexture || seen.has(t)) return;
    seen.add(t);
    const img = t.image;
    const w = (img && (img.width || img.videoWidth)) || 0;
    const h = (img && (img.height || img.videoHeight)) || 0;
    const mip = t.generateMipmaps && t.minFilter !== 1006 && t.minFilter !== 1003 ? 4 / 3 : 1;
    bytes += w * h * 4 * mip;
    biggest = Math.max(biggest, w, h);
  };
  s.scene.traverse((o) => {
    const mats = o.material ? [].concat(o.material) : [];
    mats.forEach((m) => Object.values(m).forEach(visit));
  });
  if (s.scene.background) visit(s.scene.background);
  const info = s.renderer.info;
  return {
    count: seen.size,
    mb: +(bytes / 1048576).toFixed(1),
    biggest,
    gpuTextures: info.memory.textures,
    geometries: info.memory.geometries,
  };
}

const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
};

/**
 * Long-task summary for a window. In software GL every played frame is itself a long task, so
 * `spikes` counts the one-off stalls: tasks over 400 ms AND over twice the window's median task.
 */
function summarise(longs, from, to) {
  const xs = longs.filter(([t]) => t >= from && t < to).map(([, d]) => d);
  const med = median(xs);
  return {
    n: xs.length,
    total: xs.reduce((a, b) => a + b, 0),
    max: xs.length ? Math.max(...xs) : 0,
    median: med,
    over200: xs.filter((d) => d > 200).length,
    over400: xs.filter((d) => d > 400).length,
    spikes: xs.filter((d) => d > 400 && d > 2 * med).length,
  };
}

/** A fresh iPad context + page with the probe, error capture and the CPU throttle. */
async function openPage(browser, profile) {
  const context = await browser.newContext(profile.ctx);
  await context.addInitScript(initProbe);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  return { context, page, cdp, errors };
}

/** What the page looks like when Start is enabled. */
function loadFacts() {
  const S = window.KQ.Game.S;
  return {
    loadedAt: window.__measure.loadedAt,
    q: S.quality,
    dpr: S.renderer.getPixelRatio(),
    programs: S.renderer.info.programs.length,
    touchUi:
      getComputedStyle(document.querySelector(".kq-touch") || document.body).display !== "none",
    env: Object.assign({}, window.KQ.Game.Env),
  };
}

/** Tap Start, wait for the game, then play PLAY_MS of real time. Returns the timing anchors. */
async function startAndPlay(page) {
  const tStart = await page.evaluate(() => performance.now());
  await page.locator("#kqStart").tap();
  await page.waitForFunction(() => window.__measure.readyAt > 0, null, { timeout: 300_000 });
  const readyAt = await page.evaluate(() => window.__measure.readyAt);
  const frames0 = await page.evaluate(() => window.__kq.stats().frames);
  await page.waitForTimeout(PLAY_MS);
  return { tStart, readyAt, frames0 };
}

/** Everything read at the end of the play window. */
function endFacts(src) {
  const report = new Function("return (" + src + ")()");
  const G = window.KQ.Game;
  return {
    now: performance.now(),
    M: window.__measure,
    stats: window.__kq.stats(),
    tex: report(),
    timings: G.BootPerf ? G.BootPerf.timings : null,
    defer: G.Defer ? G.Defer.stats() : null,
  };
}

function makeRow(o) {
  const { profile, region, atLoad, play, end, heap, errors } = o;
  const long = end.M.long;
  return {
    device: profile.label,
    region,
    loadedMs: Math.round(atLoad.loadedAt),
    readyMs: Math.round(play.readyAt - play.tStart),
    stages: end.M.stages,
    timings: end.timings,
    defer: end.defer,
    longLoad: summarise(long, 0, play.tStart),
    longPlay: summarise(long, play.readyAt, end.now),
    longLoadList: long.filter(([t]) => t < play.tStart),
    longPlayList: long
      .filter(([t]) => t >= play.readyAt)
      .map(([t, d]) => [Math.round(t - play.readyAt), d]),
    heapPeakMB: +(end.M.heapPeak / 1048576).toFixed(1),
    heapCdpMB: +(heap / 1048576).toFixed(1),
    tex: end.tex,
    programsAtLoad: atLoad.programs,
    programs: end.stats.programs,
    calls: end.stats.calls,
    fps: end.stats.fps,
    playFrames: end.stats.frames - play.frames0,
    quality: atLoad.q,
    dpr: atLoad.dpr,
    touchUi: atLoad.touchUi,
    env: atLoad.env,
    errors,
  };
}

async function oneRun(browser, profile, region) {
  const { context, page, cdp, errors } = await openPage(browser, profile);
  const url = BASE + (region === "haramain" ? "?region=haramain" : "?region=kampung");
  await page.goto(url, { waitUntil: "commit" });
  await page.waitForFunction(() => window.__measure && window.__measure.loadedAt > 0, null, {
    timeout: 600_000,
    polling: 200,
  });
  const atLoad = await page.evaluate(loadFacts);
  const play = await startAndPlay(page);
  const end = await page.evaluate(endFacts, textureReport.toString());
  const metrics = await cdp.send("Performance.getMetrics");
  const heap = (metrics.metrics.find((m) => m.name === "JSHeapUsedSize") || {}).value || 0;
  await context.close();
  return makeRow({ profile, region, atLoad, play, end, heap, errors });
}

function table(rows) {
  const groups = {};
  rows.forEach((r) => (groups[r.device + " / " + r.region] ||= []).push(r));
  const out = [];
  for (const [key, rs] of Object.entries(groups)) {
    const m = (f) => median(rs.map(f));
    out.push({
      key,
      runs: rs.length,
      loadedMs: m((r) => r.loadedMs),
      readyMs: m((r) => r.readyMs),
      longLoadMax: m((r) => r.longLoad.max),
      longLoadTotal: m((r) => r.longLoad.total),
      playMax: m((r) => r.longPlay.max),
      playOver200: m((r) => r.longPlay.over200),
      playMedian: m((r) => r.longPlay.median),
      playSpikes: m((r) => r.longPlay.spikes),
      heapPeakMB: m((r) => r.heapPeakMB),
      texMB: m((r) => (r.tex ? r.tex.mb : 0)),
      texCount: m((r) => (r.tex ? r.tex.count : 0)),
      programsAtLoad: m((r) => r.programsAtLoad),
      calls: m((r) => r.calls),
      fps: m((r) => r.fps),
      quality: rs[0].quality,
      dpr: rs[0].dpr,
      touchUi: rs[0].touchUi,
    });
  }
  return out;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ["--use-gl=angle", "--enable-unsafe-swiftshader", "--enable-precise-memory-info"],
  });
  const rows = [];
  const profiles = Object.entries(PROFILES).filter(([k]) => !DEVICE || k === DEVICE);
  const regions = REGIONS.filter((r) => !ONLY || r === ONLY);
  for (let run = 0; run < RUNS; run += 1) {
    for (const [, profile] of profiles) {
      for (const region of regions) {
        const row = await oneRun(browser, profile, region);
        rows.push(row);
        const brief = { ...row, stages: undefined, longPlayList: undefined, env: undefined };
        console.log(JSON.stringify({ ...brief, longLoadList: undefined, timings: undefined }));
      }
    }
  }
  await browser.close();
  const t = table(rows);
  console.table(t);
  if (OUT)
    writeFileSync(OUT, JSON.stringify({ cpu: CPU, playMs: PLAY_MS, rows, table: t }, null, 1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
