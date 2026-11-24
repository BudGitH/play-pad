// sound.mjs — renders the brush / swish voice OFFLINE and prints its spectrum (dev-only; the "Calm brush sound" table in perf.md).
//
// Real strokes go through the page's real handlers into a virtual-time OfflineAudioContext (44.1 kHz, 3 s per tool, music and
// unrelated tones muted); an FFT of 4096 over the steady part of each stroke gives the RMS, the share of energy above 4 kHz,
// the centroid, the onset step and the attack / release times.
//
//   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/sparkle-salon-v2/perf/sound.mjs [page.html] [--port 5611]
//
// `page.html` is a file in games/sparkle-salon/ (default index.html): put an older copy of the page next to it to compare.
// tools/serve.mjs is started on the port when nothing answers there.
/* eslint-disable max-lines-per-function -- a harness is one linear script; splitting it per step adds no clarity */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const portAt = process.argv.indexOf("--port");
const PORT = portAt > 0 ? Number(process.argv[portAt + 1]) : 5611;
const file =
  process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--port") ||
  "index.html";
const BASE = `http://localhost:${PORT}`;

/** Start tools/serve.mjs on PORT unless something already answers there. */
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
const INIT = `
(() => {
  const OAC = window.OfflineAudioContext;
  const si = window.setInterval.bind(window);
  window.setInterval = (f, d, ...a) => (d === 110 ? 0 : si(f, d, ...a)); // no music
  let t0 = 0;
  class VC extends OAC {
    constructor() { super(1, 44100 * 70, 44100); t0 = performance.now(); window.__vc = this; }
    get currentTime() { return (performance.now() - t0) / 1000; }
    resume() { return Promise.resolve(); }
    createOscillator() { const o = super.createOscillator(); const st = o.start.bind(o); o.start = (t) => { if (window.__oscOn) st(t); }; return o; }
  }
  window.__oscOn = false;
  window.AudioContext = VC; window.webkitAudioContext = VC;
  window.__seg = [];
  window.__vt = () => (performance.now() - t0) / 1000;
})();`;
const server = await ensureServer();
const b = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(BASE + "/games/sparkle-salon/" + file);
await page.waitForFunction(() => window.__salon && typeof window.__salon.phase === "string");
await page.getByRole("button", { name: "Start makeover", exact: true }).click();
await page.waitForFunction(() => window.__salon.phase === "playing");
await page.getByRole("button", { name: "Let's glam!" }).click();
await page.waitForFunction(() => !document.querySelector("#reqModal.open"));
const go = (id) =>
  page.evaluate((id) => {
    const s = window.__salon;
    for (let i = 0; i < 9 && s.stepId !== id; i++) {
      s.debug.completeStep();
      s.debug.nextStep();
    }
  }, id);
async function doStroke(kind, ms) {
  await page.evaluate(
    ([kind, ms]) =>
      new Promise((resolve) => {
        const dbg = window.__salon.debug;
        const stage = document.getElementById("stage");
        const lift = dbg.touchLift();
        let pt;
        if (kind === "sponge") {
          const sm = [...document.querySelectorAll(".smudge")].map((e) =>
            dbg.unitsToClient(+e.dataset.x, +e.dataset.y),
          );
          pt = (t) => {
            const a = sm[Math.floor(t * 1.2) % sm.length],
              b = sm[(Math.floor(t * 1.2) + 1) % sm.length],
              f = (t * 1.2) % 1;
            return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f + lift };
          };
        } else
          pt = (t) => {
            const ph = (t * 1.4) % 2;
            const f = ph > 1 ? 2 - ph : ph;
            const p = dbg.regionPoint(f);
            return { x: p.x, y: p.y + lift };
          };
        const mk = (type, p) =>
          new PointerEvent(type, {
            pointerId: 7,
            pointerType: "touch",
            isPrimary: true,
            clientX: p.x,
            clientY: p.y,
            bubbles: true,
            cancelable: true,
            buttons: type === "pointerup" ? 0 : 1,
          });
        window.__oscOn = kind === "sponge";
        const start = performance.now();
        const s0 = window.__vt();
        stage.dispatchEvent(mk("pointerdown", pt(0)));
        const iv = setInterval(() => {
          const t = (performance.now() - start) / 1000;
          stage.dispatchEvent(mk("pointermove", pt(t)));
          if (t * 1000 >= ms) {
            clearInterval(iv);
            stage.dispatchEvent(mk("pointerup", pt(t)));
            window.__seg.push({ kind, start: s0, end: window.__vt() });
            window.__oscOn = false;
            resolve();
          }
        }, 8);
      }),
    [kind, ms],
  );
  await page.waitForTimeout(900);
}
await go("cleanse");
await page.waitForTimeout(800);
await doStroke("sponge", 3000);
await go("shadow");
await page.waitForTimeout(1100);
await doStroke("brush", 3000);
await go("mascara");
await page.waitForTimeout(1100);
await doStroke("wand", 3000);
await go("lips");
await page.waitForTimeout(1100);
await doStroke("lipstick", 3000);
const res = await page.evaluate(async () => {
  const vc = window.__vc;
  const buf = await vc.startRendering();
  const d = buf.getChannelData(0);
  const sr = buf.sampleRate;
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len,
        wr = Math.cos(ang),
        wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1,
          ci = 0;
        for (let j = 0; j < len / 2; j++) {
          const ur = re[i + j],
            ui = im[i + j],
            vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci,
            vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
          re[i + j] = ur + vr;
          im[i + j] = ui + vi;
          re[i + j + len / 2] = ur - vr;
          im[i + j + len / 2] = ui - vi;
          const t = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = t;
        }
      }
    }
  }
  const N = 4096;
  const out = [];
  for (const sg of window.__seg) {
    const a = Math.floor((sg.start + 0.3) * sr),
      z = Math.floor((sg.end - 0.1) * sr);
    const P = new Float64Array(N / 2);
    let ss = 0,
      n = 0;
    for (let s = a; s + N < z; s += N / 2) {
      const re = new Float64Array(N),
        im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = d[s + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
      fft(re, im);
      for (let k = 0; k < N / 2; k++) P[k] += re[k] * re[k] + im[k] * im[k];
    }
    for (let i = a; i < z; i++) {
      ss += d[i] * d[i];
      n++;
    }
    const hz = (k) => (k * sr) / N;
    let tot = 0,
      hi = 0,
      cen = 0,
      peak = 0,
      pk = 0;
    for (let k = 1; k < N / 2; k++) {
      tot += P[k];
      cen += P[k] * hz(k);
      if (hz(k) >= 4000) hi += P[k];
      if (P[k] > peak) {
        peak = P[k];
        pk = hz(k);
      }
    }
    // 1 ms envelope: attack (to 90% of steady level) and release (to -20 dB) times
    const win = Math.floor(sr * 0.001);
    const env = (from, to) => {
      const e = [];
      for (let s = from; s + win < to; s += win) {
        let q = 0;
        for (let i = 0; i < win; i++) q += d[s + i] * d[s + i];
        e.push(Math.sqrt(q / win));
      }
      return e;
    };
    const rms = Math.sqrt(ss / n);
    const eOn = env(Math.floor(sg.start * sr), Math.floor((sg.start + 0.6) * sr));
    let att = eOn.findIndex((v) => v >= 0.9 * rms);
    const eOff = env(Math.floor(sg.end * sr), Math.floor((sg.end + 0.8) * sr));
    const rel = eOff.findIndex((v) => v <= rms * 0.1);
    let maxStep = 0;
    for (let i = Math.floor(sg.start * sr) + 1; i < Math.floor((sg.start + 0.3) * sr); i++)
      maxStep = Math.max(maxStep, Math.abs(d[i] - d[i - 1]));
    out.push({
      kind: sg.kind,
      rmsDb: +(20 * Math.log10(rms)).toFixed(1),
      above4kPct: +((100 * hi) / tot).toFixed(3),
      above4kDbRel: +(10 * Math.log10(hi / tot + 1e-12)).toFixed(1),
      centroidHz: Math.round(cen / tot),
      peakHz: Math.round(pk),
      attack90ms: att,
      release20dBms: rel,
      onsetMaxStep: +maxStep.toFixed(4),
      peakAbs: +Math.max(...d.slice(a, z)).toFixed(3),
    });
  }
  return out;
});
console.log(file);
console.table(res);
await b.close();
if (server) server.kill();
