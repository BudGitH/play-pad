// bake-bg.mjs — dev-only. Renders the soft-focus backdrop group of Sparkle Salon (the mirror arch, bulbs and
// table, drawn with a sigma-4 blur) ONCE to a small transparent WebP, printed as a data URI. The page embeds
// that image instead of running a live SVG blur filter over the whole screen (see perf.md).
//
//   PW_CHROMIUM_PATH=<chromium> node features/sparkle-salon-v2/bake-bg.mjs [source.svg] [scale] > /tmp/bg.txt
//
// No image library is needed: the page's own canvas does the encoding (canvas.toDataURL("image/webp")).
// The SOURCE group lives next to this script in bg-source.svg (the default input), so the bake can be re-run whenever
// the backdrop art changes; paste the printed data URI into the `<image>` in the page's `.bgSvg`.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, process.argv[2] || "bg-source.svg");
const SCALE = Number(process.argv[3] || 1);
const svg = readFileSync(SRC, "utf8");
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
});
const page = await browser.newPage();
const uri = await page.evaluate(
  async ([svgText, scale]) => {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
    await img.decode();
    const c = document.createElement("canvas");
    c.width = Math.round(390 * scale);
    c.height = Math.round(844 * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/webp", 0.82);
  },
  [svg, SCALE],
);
process.stdout.write(uri);
await browser.close();
