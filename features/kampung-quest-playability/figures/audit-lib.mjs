// Dev-only helpers shared by the figures audit (audit.mjs) and tests/kampung-quest-figures.spec.mjs:
// the game's figure scripts in load order, and the headless Chromium launch options.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, "../../../games/kampung-quest");
const KEEP = /^(three\.min\.js|js\/(data|sim|figures)\/)/;

/** <script> tags (absolute URLs on `base`) for three.js and the data, sim and figures layers, in index.html order. */
export function figureScripts(base) {
  const html = readFileSync(resolve(GAME, "index.html"), "utf8");
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((s) => KEEP.test(s));
  return srcs.map((s) => `<script src="${base}/games/kampung-quest/${s}"></script>`);
}

/** The browser-side audit files (read as text so a page can inject them with addScriptTag). */
export function auditSources() {
  return ["audit-page.js", "audit-fit.js", "audit-render.js", "audit-subjects.js"].map((f) =>
    readFileSync(resolve(HERE, f), "utf8"),
  );
}

/** Headless Chromium with software WebGL (PW_CHROMIUM_PATH picks a pre-installed browser). */
export function launchArgs() {
  return {
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: [
      "--use-gl=angle",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--no-sandbox",
    ],
  };
}
