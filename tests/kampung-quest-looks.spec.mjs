// Kampung Quest looks (AC-P20, features/kampung-quest-playability/requirements.md): one pinned
// daylight view per region must stay bright and colourful (mean luminance and mean HSV
// saturation of the 3D canvas, HUD hidden) without clipped white, and 21:00 must stay clearly
// darker than 10:00. Baselines and the full before/after table: notes-looks.md and
// features/kampung-quest-playability/looks/measure.mjs (the same views and maths).
// Run: npx playwright test tests/kampung-quest-looks.spec.mjs --project=kampung-quest
import { test, expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const DAY = 600;
const NIGHT = 1260;

/**
 * Floors sit between the pre-AC-P20 numbers and today's (both measured here at q=low, 2026-11-28):
 * kampung street lum 136.4 -> 139.4, sat 0.186 -> 0.265; Makkah plaza lum 160.1 -> 168.3,
 * sat 0.122 -> 0.153. The old look fails each saturation floor.
 */
const VIEWS = {
  kampung: { eye: [22, 3.6, -7], look: [22, 1.2, 4], minLum: 130, minSat: 0.235 },
  haramain: { eye: [0, 3.2, -82], look: [0, 1.2, -70], minLum: 162, minSat: 0.14 },
};

/** Boot a region to a running game with the HUD hidden. */
async function boot(page, region) {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto(GAME + "&region=" + region);
  await expect
    .poll(() => page.evaluate(() => window.__kq?.loaded), { timeout: 120_000 })
    .toBe(true);
  await page.locator("#kqStart").click();
  await expect.poll(() => page.evaluate(() => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await page.addStyleTag({ content: "#kq > *:not(#kqStage){visibility:hidden!important}" });
}

/** Pin the camera on `v` at `minute`, render, and return the canvas stats. */
async function measure(page, v, minute) {
  await page.evaluate(
    ({ v, minute }) => {
      const k = window.__kq;
      const S = window.KQ.Game.S;
      k.setMinute(minute);
      k.place(v.look[0], v.look[2], 0);
      k.step(500);
      S.camera.position.set(v.eye[0], v.eye[1], v.eye[2]);
      S.camera.lookAt(v.look[0], v.look[1], v.look[2]);
      S.renderer.render(S.scene, S.camera);
    },
    { v, minute },
  );
  return stats(page, await page.locator("#kqStage").screenshot());
}

/** Mean luminance (Rec.709, display values), mean HSV saturation and clipped-white share of a PNG. */
function stats(page, png) {
  return page.evaluate(
    async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let lum = 0;
      let sat = 0;
      let clip = 0;
      for (let i = 0; i < d.length; i += 4) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        sat += mx ? (mx - Math.min(d[i], d[i + 1], d[i + 2])) / mx : 0;
        if (d[i] >= 250 && d[i + 1] >= 250 && d[i + 2] >= 250) clip += 1;
      }
      const n = d.length / 4;
      return { lum: lum / n, sat: sat / n, clip: clip / n };
    },
    "data:image/png;base64," + png.toString("base64"),
  );
}

for (const [region, v] of Object.entries(VIEWS)) {
  test(`looks: ${region} daylight is bright and colourful, 21:00 reads as night`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await boot(page, region);
    const day = await measure(page, v, DAY);
    const night = await measure(page, v, NIGHT);
    test.info().annotations.push({ type: "looks", description: JSON.stringify({ day, night }) });
    expect(day.lum).toBeGreaterThanOrEqual(v.minLum);
    expect(day.sat).toBeGreaterThanOrEqual(v.minSat);
    expect(day.clip).toBeLessThan(0.01);
    expect(night.lum).toBeLessThan(day.lum * 0.5);
  });
}
