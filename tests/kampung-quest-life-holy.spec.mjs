// Kampung Quest, Makkah and Madinah: the same life as the kampung (playability round F). A guide
// at the hotel forecourt gives the missions (the camel mission waits for a camel yard and is not
// offered while there is none), a hello to a pilgrim is always the salaam, and the three events
// (pigeons take off, a volunteer's dates and zamzam, a family's photo) start, show people and end.
// Run: PW_PORT=5608 npx playwright test tests/kampung-quest-life-holy.spec.mjs --project=kampung-quest
import { test, expect } from "@playwright/test";
import * as D from "./life-drivers.mjs";

test("a guide gives the missions and a hello to a pilgrim is the salaam", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await D.boot(page, "?still=1&autoq=0&q=low&region=haramain");
  const r = await page.evaluate(D.guideScenario);
  expect(r.missions).toEqual(
    expect.arrayContaining([
      "h_new_friends",
      "h_zamzam_walk",
      "h_madinah_photos",
      "h_ride_to_quba",
    ]),
  );
  expect(r.missions.every((id) => id.startsWith("h_"))).toBe(true);
  expect(r.target).toMatchObject({ kind: "npc", id: "guide_makkah" });
  expect(r.stars, "both guides have a mission to give (gold star on the radar)").toBe(2);
  expect(r.modal, "talking to the guide opens his offer").toBe("Talking to Ustaz Bilal");
  if (r.said) {
    expect(r.said.hero, "every pilgrim is Muslim: the salaam").toBe("Assalamualaikum!");
    expect(r.said.reply).toMatch(/^Waalaikumsalam/);
  }
  const events = await page.evaluate(D.holyEventsScenario);
  for (const id of ["dates", "photo", "pigeons"]) {
    expect(events[id][0], id + " started").toBe(true);
    expect(events[id][1]).toBe(true);
  }
  expect(errors).toEqual([]);
});
