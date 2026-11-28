// Dev-only: screenshots and triangle counts of every vehicle model from vehicle-lab.html (no game boot).
// Run: node tools/serve.mjs 5615 &  then  PW_PORT=5615 node features/kampung-quest-playability/vehicles-lab-shots.mjs [out-dir] [low]
import { chromium } from "@playwright/test";

const PORT = process.env.PW_PORT || 5615;
const out = process.argv[2] || "features/kampung-quest-playability/shots";
const low = process.argv.includes("low");
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://localhost:${PORT}/features/kampung-quest-playability/vehicle-lab.html`);
await page.waitForFunction(() => window.lab, null, { timeout: 30000 });

const CARS = [
  ["sedan", 0xc8ccd0],
  ["hatch", 0x7a1f26],
  ["suv", 0x2a2d33],
  ["mpv", 0xe9e9e6],
  ["taxi", 0xf4f4f0],
];
const shots = [];
for (const [style, hex] of CARS) {
  shots.push({
    name: "car-" + style,
    list: [["car", hex, { style, low }, 0, 0, 0]],
    view: [0, 0, 0.75, 0.2, 6.8, 0.75],
  });
}
shots.push({
  name: "car-sedan-rear",
  list: [["car", 0x23395b, { style: "sedan", low }, 0, 0, 0]],
  view: [0, 0, 2.5, 0.22, 6.8, 0.75],
});
shots.push({
  name: "bus",
  list: [["bus", 0xf2f4f0, { low }, 0, 0, 0]],
  view: [0, 0, 1.0, 0.18, 15, 1.4],
});
shots.push({
  name: "lorry",
  list: [["lorry", 0x2f5fa8, { low }, 0, 0, 0]],
  view: [0, 0, 0.8, 0.2, 9, 1.0],
});
shots.push({
  name: "bike",
  list: [["bike", 0x2f6fb0, { low }, 0, 0, 0]],
  view: [0, 0, 1.25, 0.22, 2.6, 0.45],
});
shots.push({
  name: "bike-basket",
  list: [["bike", 0xd94f4f, { low }, 0, 0, 0]],
  view: [0, 0, 0.9, 0.25, 2.6, 0.45],
});
shots.push({
  name: "moto",
  list: [["moto", 0xd94f4f, { low }, 0, 0, 0]],
  view: [0, 0, 1.0, 0.2, 3.2, 0.55],
});
const rows = [];
for (const s of shots) {
  if (only && !only.includes(s.name)) continue;
  const r = await page.evaluate(
    ([list, view]) => {
      window.lab.build(list);
      window.lab.view(...view);
      const v = window.lab.vehicles[0];
      return Object.assign(window.lab.count(v), window.lab.render());
    },
    [s.list, s.view],
  );
  rows.push({ name: s.name, ...r });
  await page.screenshot({ path: `${out}/lab-${s.name}${low ? "-low" : ""}.png` });
}
console.table(rows);
if (errors.length) console.log("errors", errors.slice(0, 5));
await browser.close();
