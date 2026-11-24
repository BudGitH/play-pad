// measure.mjs — Sparkle Salon performance harness (dev-only; reads the page, writes nothing into the repo).
//
// Reproduces the tables in features/sparkle-salon-v2/perf.md: frame rate, main-thread time and long tasks per scenario at a
// CPU throttle, on an iPad portrait, an iPad landscape and a phone profile, plus the compositor layers and canvas megapixels.
// Chromium is not Safari: the numbers are relative (before / after on the same machine in the same session), not absolute.
//
//   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/sparkle-salon-v2/perf/measure.mjs --cpu 4 [options]
//
// Options (all optional):
//   --port 5611            port of tools/serve.mjs (started here when nothing answers on it)
//   --base http://host:p   use an already running server instead (overrides --port)
//   --page index.old.html  measure another file in games/sparkle-salon/ (an older copy, for a back-to-back before / after)
//   --profiles ipad,ipadL,phone     ipad = 1024x1366 @2x, ipadL = 1366x1024 @2x, phone = 390x844 @3x
//   --scenarios title,play,shadow,blush,step,sponge
//   --cpu 4                CPU throttle (1 = none)
//   --rate 120             synthetic pointermove rate in Hz ('raf' = one per animation frame)
//   --trace                also aggregate a Chromium trace per scenario
//   --out results.json     where the raw JSON goes (default: the OS temp folder, so a run never dirties the repo)
//
/* eslint-disable max-lines-per-function -- a harness is one linear script of scenarios; splitting it per step adds no clarity */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const arg = (k, d) => {
  const i = process.argv.indexOf("--" + k);
  if (i < 0) return d;
  const v = process.argv[i + 1];
  return !v || v.startsWith("--") ? true : v;
};
const PORT = Number(arg("port", 5611));
const BASE = String(arg("base", `http://localhost:${PORT}`));
const PAGE = String(arg("page", "")); // a file in games/sparkle-salon/ (default: the game); put an older copy there to compare
const URL = BASE + "/games/sparkle-salon/" + PAGE;
const CPU = Number(arg("cpu", 4));
const RATE = arg("rate", 120) === "raf" ? "raf" : Number(arg("rate", 120)); // synthetic pointermove rate (Hz)
const TRACE = !!arg("trace", false);
const OUT = String(arg("out", join(tmpdir(), "sparkle-salon-perf.json")));

/** Start tools/serve.mjs on PORT unless something already answers there (or --base points elsewhere). */
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
const PROFILES = {
  ipad: { viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2 },
  ipadL: { viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
};
const wantProfiles = String(arg("profiles", "ipad,ipadL,phone")).split(",");
const wantScen = String(arg("scenarios", "title,play,shadow,blush,step,sponge")).split(",");

const INIT = `
  window.__cvs = [];
  const _ce = document.createElement.bind(document);
  document.createElement = (t, o) => { const e = _ce(t, o); if (String(t).toLowerCase() === 'canvas') window.__cvs.push(e); return e; };
  window.__frames = [];
  window.__rec = false;
  (function tick(t){ if (window.__rec) window.__frames.push(t); requestAnimationFrame(tick); })(0);
  window.__long = [];
  try { new PerformanceObserver(l => { if (window.__rec) for (const e of l.getEntries()) window.__long.push(e.duration); }).observe({entryTypes:['longtask']}); } catch(e){}
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const METRICS = [
  "TaskDuration",
  "ScriptDuration",
  "LayoutDuration",
  "RecalcStyleDuration",
  "LayoutCount",
  "RecalcStyleCount",
  "JSHeapUsedSize",
  "Nodes",
];

async function metrics(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  const o = {};
  for (const m of metrics) o[m.name] = m.value;
  return o;
}

/** Record `run()` and return deltas + frame stats (+ trace aggregates). */
async function record(ctx, page, cdp, name, run) {
  await page.evaluate(() => {
    window.__frames.length = 0;
    window.__long.length = 0;
    window.__rec = true;
  });
  if (TRACE)
    await ctx.browser().startTracing(page, {
      categories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "cc",
        "viz",
        "gpu",
        "benchmark",
      ],
    });
  const t0 = Date.now();
  const m0 = await metrics(cdp);
  await run();
  const m1 = await metrics(cdp);
  const wall = (Date.now() - t0) / 1000;
  const traceBuf = TRACE ? await ctx.browser().stopTracing() : null;
  const fr = await page.evaluate(() => {
    window.__rec = false;
    return { f: window.__frames.slice(), l: window.__long.slice() };
  });
  const d = {};
  for (const k of METRICS) d[k] = +(m1[k] - m0[k]).toFixed(4);
  const dts = [];
  for (let i = 1; i < fr.f.length; i++) dts.push(fr.f[i] - fr.f[i - 1]);
  dts.sort((a, b) => a - b);
  const q = (p) => (dts.length ? dts[Math.min(dts.length - 1, Math.floor(p * dts.length))] : 0);
  const res = {
    scenario: name,
    wallS: +wall.toFixed(2),
    mainBusyPct: +((d.TaskDuration / wall) * 100).toFixed(1),
    scriptMs: +(d.ScriptDuration * 1000).toFixed(0),
    layoutMs: +(d.LayoutDuration * 1000).toFixed(0),
    styleMs: +(d.RecalcStyleDuration * 1000).toFixed(0),
    layouts: d.LayoutCount,
    restyles: d.RecalcStyleCount,
    rafFps: +(dts.length / wall).toFixed(1),
    dtP50: +q(0.5).toFixed(1),
    dtP95: +q(0.95).toFixed(1),
    dtMax: +(dts[dts.length - 1] || 0).toFixed(1),
    over33: dts.filter((x) => x > 33.4).length,
    longTasks: fr.l.length,
    heapMB: +(m1.JSHeapUsedSize / 1048576).toFixed(1),
  };
  if (traceBuf) res.trace = aggregateTrace(JSON.parse(traceBuf.toString()), wall);
  return res;
}

/** Sum durations by event name, painted area by Paint events, and compositor frames per second. */
function aggregateTrace(tr, wall) {
  const ev = tr.traceEvents || tr;
  const dur = {};
  const cnt = {};
  let paintArea = 0;
  let paints = 0;
  const paintBy = {};
  let draws = 0;
  for (const e of ev) {
    if (e.ph === "X" && e.dur) {
      dur[e.name] = (dur[e.name] || 0) + e.dur / 1000;
      cnt[e.name] = (cnt[e.name] || 0) + 1;
    }
    if (e.name === "Paint" && e.ph === "X" && e.args?.data?.clip) {
      const c = e.args.data.clip;
      const w = Math.abs(c[2] - c[0]);
      const h = Math.abs(c[5] - c[3]);
      paintArea += w * h;
      paints++;
      const key = (e.args.data.nodeName || "?") + "#" + (e.args.data.nodeId || "");
      paintBy[key] = (paintBy[key] || 0) + w * h;
    }
    if (e.name === "DrawFrame" || e.name === "Display::DrawAndSwap") draws++;
  }
  const keep = [
    "RasterTask",
    "Paint",
    "UpdateLayoutTree",
    "Layout",
    "Layerize",
    "Commit",
    "PrePaint",
    "ImageDecodeTask",
    "GPUTask",
    "FunctionCall",
    "UpdateLayer",
    "CompositeLayers",
    "HitTest",
    "EventDispatch",
  ];
  const top = {};
  for (const k of keep) if (dur[k]) top[k] = { ms: +dur[k].toFixed(0), n: cnt[k] };
  return {
    ms: top,
    paintMPixPerSec: +(paintArea / 1e6 / wall).toFixed(2),
    paintsPerSec: +(paints / wall).toFixed(1),
    compositorFramesPerSec: +(draws / wall).toFixed(1),
    paintTop: Object.entries(paintBy)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, v]) => k + ":" + (v / 1e6 / wall).toFixed(2) + "MPix/s"),
  };
}

/** Synthetic touch/mouse stroke: zig-zag over the current step's region at `RATE` Hz for `ms`. */
async function stroke(page, ms, { touch = true } = {}) {
  await page.evaluate(
    ([ms, rate, touch]) =>
      new Promise((resolve) => {
        const dbg = window.__salon.debug;
        const stage = document.getElementById("stage");
        const lift = touch ? dbg.touchLift() : 0;
        const pt = (f) => {
          const p = dbg.regionPoint(f);
          return { x: p.x, y: p.y + lift };
        };
        const mk = (type, p) =>
          new PointerEvent(type, {
            pointerId: 7,
            pointerType: touch ? "touch" : "mouse",
            isPrimary: true,
            clientX: p.x,
            clientY: p.y,
            bubbles: true,
            cancelable: true,
            button: type === "pointerdown" ? 0 : -1,
            buttons: type === "pointerup" ? 0 : 1,
          });
        let f = 0;
        let dir = 1;
        const speed = 1.4; // region-widths / s
        let last = performance.now();
        const start = last;
        stage.dispatchEvent(mk("pointerdown", pt(0)));
        const step = (now) => {
          const dt = (now - last) / 1000;
          last = now;
          f += dir * speed * dt;
          if (f > 1) (f = 1), (dir = -1);
          if (f < 0) (f = 0), (dir = 1);
          stage.dispatchEvent(mk("pointermove", pt(f)));
        };
        if (rate === "raf") {
          const loop = (now) => {
            step(now);
            if (now - start < ms) requestAnimationFrame(loop);
            else fin();
          };
          requestAnimationFrame(loop);
        } else {
          const iv = setInterval(() => {
            step(performance.now());
            if (performance.now() - start >= ms) {
              clearInterval(iv);
              fin();
            }
          }, 1000 / rate);
        }
        function fin() {
          stage.dispatchEvent(mk("pointerup", pt(f)));
          resolve();
        }
      }),
    [ms, RATE === "raf" ? "raf" : RATE, touch],
  );
}

async function begin(page) {
  await page.getByRole("button", { name: "Start makeover", exact: true }).click();
  await page.waitForFunction(() => window.__salon.phase === "playing");
  await page.getByRole("button", { name: "Let's glam!" }).click();
  await page.waitForFunction(() => !document.querySelector("#reqModal.open"));
  await sleep(900);
}
const goStep = (page, id) =>
  page.evaluate((id) => {
    const s = window.__salon;
    for (let i = 0; i < 9 && s.stepId !== id; i++) {
      s.debug.completeStep();
      s.debug.nextStep();
    }
  }, id);

/** Static facts about the page at this viewport: layers, canvases, SVG sizes. */
async function inventory(page) {
  return page.evaluate(() => {
    const dpr = devicePixelRatio;
    const out = { dpr, vw: innerWidth, vh: innerHeight, canvases: [], svgs: [] };
    const px = (c) => c.width * c.height;
    for (const c of document.querySelectorAll("canvas")) {
      const r = c.getBoundingClientRect();
      out.canvases.push({
        id: c.id || "(anon)",
        backing: c.width + "x" + c.height,
        mpix: +(px(c) / 1e6).toFixed(3),
        css: Math.round(r.width) + "x" + Math.round(r.height),
      });
    }
    for (const c of window.__cvs || []) {
      if (!c.isConnected)
        out.canvases.push({
          id: "(detached)",
          backing: c.width + "x" + c.height,
          mpix: +(px(c) / 1e6).toFixed(3),
          css: "-",
        });
    }
    for (const s of document.querySelectorAll("svg.art, svg.bgSvg")) {
      const r = s.getBoundingClientRect();
      out.svgs.push({
        id: s.id || s.getAttribute("class"),
        css: Math.round(r.width) + "x" + Math.round(r.height),
        deviceMpix: +((r.width * r.height * dpr * dpr) / 1e6).toFixed(2),
        nodes: s.querySelectorAll("*").length,
        filters: s.querySelectorAll("[filter]").length,
        clips: s.querySelectorAll("[clip-path]").length,
      });
    }
    const st = document.getElementById("stage").getBoundingClientRect();
    out.stage = Math.round(st.width) + "x" + Math.round(st.height);
    out.totalCanvasMpix = +out.canvases.reduce((a, c) => a + c.mpix, 0).toFixed(2);
    return out;
  });
}

const results = [];
const server = await ensureServer();
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--enable-precise-memory-info"],
});
for (const pname of wantProfiles) {
  const P = PROFILES[pname];
  const ctx = await browser.newContext({ ...P, isMobile: true, hasTouch: true });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__salon && typeof window.__salon.phase === "string");
  await sleep(1200);
  const row = { profile: pname, cpu: CPU, rate: RATE, scenarios: [], inventory: null };
  const sc = {
    title: async () => {
      row.scenarios.push(await record(ctx, page, cdp, "title idle 5s", () => sleep(5000)));
    },
    play: async () => {
      await begin(page);
      row.inventory = await inventory(page);
      row.scenarios.push(
        await record(ctx, page, cdp, "play idle 5s (cleanse, tool resting)", () => sleep(5000)),
      );
    },
    sponge: async () => {
      await goStep(page, "cleanse");
      await sleep(600);
      // wipe stroke: smudge positions come from the page
      const r = await record(ctx, page, cdp, "cleanse sponge stroke 3s", async () => {
        await page.evaluate(
          (ms) =>
            new Promise((resolve) => {
              const dbg = window.__salon.debug;
              const stage = document.getElementById("stage");
              const sm = [...document.querySelectorAll(".smudge")].map((e) =>
                dbg.unitsToClient(+e.dataset.x, +e.dataset.y),
              );
              const mk = (type, p) =>
                new PointerEvent(type, {
                  pointerId: 7,
                  pointerType: "touch",
                  isPrimary: true,
                  clientX: p.x,
                  clientY: p.y + dbg.touchLift(),
                  bubbles: true,
                  cancelable: true,
                  buttons: type === "pointerup" ? 0 : 1,
                });
              const start = performance.now();
              stage.dispatchEvent(mk("pointerdown", sm[0]));
              const iv = setInterval(() => {
                const t = (performance.now() - start) / 1000;
                const a = sm[Math.floor(t * 1.2) % sm.length];
                const b = sm[(Math.floor(t * 1.2) + 1) % sm.length];
                const f = (t * 1.2) % 1;
                stage.dispatchEvent(
                  mk("pointermove", { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }),
                );
                if (performance.now() - start > ms) {
                  clearInterval(iv);
                  stage.dispatchEvent(mk("pointerup", b));
                  resolve();
                }
              }, 1000 / 120);
            }),
          3000,
        );
      });
      r.scenario = "cleanse sponge stroke 3s";
      row.scenarios.push(r);
    },
    shadow: async () => {
      await goStep(page, "shadow");
      await sleep(1200); // camera transition
      row.scenarios.push(
        await record(ctx, page, cdp, "shadow idle 3s (zoomed, nudge)", () => sleep(3000)),
      );
      await page.evaluate(() => {}); // keep step
      row.scenarios.push(
        await record(ctx, page, cdp, "shadow stroke 3s", () => stroke(page, 3000)),
      );
    },
    blush: async () => {
      await goStep(page, "blush");
      await sleep(1200);
      row.scenarios.push(await record(ctx, page, cdp, "blush stroke 3s", () => stroke(page, 3000)));
    },
    step: async () => {
      await goStep(page, "mascara");
      await sleep(1500);
      row.scenarios.push(
        await record(ctx, page, cdp, "step transition (camera zoom) 2x", async () => {
          for (let i = 0; i < 2; i++) {
            await page.evaluate(() => {
              window.__salon.debug.completeStep();
              window.__salon.debug.nextStep();
            });
            await sleep(1200);
          }
        }),
      );
    },
  };
  for (const s of ["title", "play", "sponge", "shadow", "blush", "step"]) {
    if (!wantScen.includes(s)) continue;
    try {
      await sc[s]();
    } catch (e) {
      row.scenarios.push({ scenario: s, error: String(e).slice(0, 200) });
    }
  }
  if (errors.length) row.errors = errors.slice(0, 3);
  // layer tree snapshot (Chromium compositor)
  try {
    const layers = [];
    cdp.on(
      "LayerTree.layerTreeDidChange",
      (e) => e.layers && layers.splice(0, layers.length, ...e.layers),
    );
    await cdp.send("LayerTree.enable");
    await sleep(400);
    await page.evaluate(
      () => (document.getElementById("stage").style.outline = "1px solid transparent"),
    );
    await sleep(400);
    const drawing = layers.filter((l) => l.drawsContent);
    row.layers = {
      total: layers.length,
      drawing: drawing.length,
      drawingDevMpix: +(drawing.reduce((a, l) => a + l.width * l.height, 0) / 1e6).toFixed(2),
      biggest: drawing
        .sort((a, b) => b.width * b.height - a.width * a.height)
        .slice(0, 8)
        .map((l) => `${Math.round(l.width)}x${Math.round(l.height)}`),
    };
  } catch (e) {
    row.layers = { error: String(e).slice(0, 100) };
  }
  results.push(row);
  await ctx.close();
}
await browser.close();
if (server) server.kill();
writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log("raw results:", OUT);
for (const r of results) {
  console.log(`\n=== ${r.profile}  cpu x${r.cpu}  moveRate ${r.rate}Hz`);
  if (r.inventory)
    console.log(
      "stage",
      r.inventory.stage,
      "canvas Mpix",
      r.inventory.totalCanvasMpix,
      JSON.stringify(r.layers),
    );
  console.table(
    r.scenarios.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => key !== "trace")),
    ),
  );
  for (const s of r.scenarios) if (s.trace) console.log(s.scenario, JSON.stringify(s.trace));
}
