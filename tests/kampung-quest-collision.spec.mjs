// Kampung Quest: characters stay out of walls and off each other, the camera stays out of walls,
// and the hero can jump (Space, and the touch Jump button) without leaving the ground plane.
// Regression for the lift-lobby report: at the foot of BLK 120 an NPC stood half inside the lift
// wall facing it, NPCs stacked on one spot, and the camera sat inside the wall.
// The pure maths are unit-tested in tests/kampung-quest/collide.test.mjs and jump.test.mjs; this
// file checks the real game. The page runs with `?still=1` (time moves only through __kq.step).
// Run: npx playwright test tests/kampung-quest-collision.spec.mjs
import { test, expect, devices } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const kq = (page, fn, arg) => page.evaluate(fn, arg);

async function boot(page) {
  await page.goto(GAME);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await kq(page, () => window.__kq.step(300));
}

/**
 * In-page audit (installed once as window.__npcProblems): every problem among the NPCs near the
 * hero right now: inside a wall or prop, stacked on another, or standing nose to a wall. Seated,
 * praying and cooking agents are placed by design. Source text, so it can be split into small
 * functions and still be sent to the page.
 */
const AUDIT_SRC = `(() => {
  const S = () => window.KQ.Game.S;
  const held = (A) => A.cook || (A.goal && (A.goal.kind === "sit" || A.goal.kind === "pray"));
  const near = () => {
    const hero = S().player.pos;
    return S().npcs.agents.filter(
      (A) => !A.hidden && A.group.visible && Math.hypot(A.x - hero.x, A.z - hero.z) < 60,
    );
  };
  const gapTo = (A, c) => {
    const cx = Math.max(c.minX, Math.min(A.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(A.z, c.maxZ));
    return Math.hypot(A.x - cx, A.z - cz);
  };
  const inWall = (A) => {
    const c = S().world.colliders.find((k) => gapTo(A, k) < 0.2);
    return c ? A.id + " inside " + c.kind + " (" + gapTo(A, c).toFixed(2) + " m)" : null;
  };
  const stacked = (A, list) =>
    list
      .filter((B) => B !== A && !held(B) && Math.hypot(A.x - B.x, A.z - B.z) < 0.3)
      .map((B) => A.id + " stacked on " + B.id);
  const facesWall = (A) => {
    if (A.path.length || A.talking) return null;
    const x = A.x + Math.sin(A.heading) * 0.5;
    const z = A.z + Math.cos(A.heading) * 0.5;
    return window.KQ.Game.Collide.blockedAt(S().world.colliders, x, z, 0.05)
      ? A.id + " faces a wall"
      : null;
  };
  window.__npcProblems = () => {
    const live = near();
    const out = [];
    live.filter((A) => !held(A)).forEach((A) => {
      out.push(inWall(A), facesWall(A), ...stacked(A, live));
    });
    return Array.from(new Set(out.filter(Boolean)));
  };
})()`;

const problems = (page) => kq(page, () => window.__npcProblems());

const HUBS = [
  [40, 25],
  [-40, 40],
  [50, -10],
  [-30, -30],
  [26, -15],
];
const DAY = [420, 540, 720, 900, 1080, 1200];

/** The test hero at the lift wall of BLK 120 (z = 49.5), then the gap from the wall for a point. */
const nearLift = (page, z, heading, run) =>
  kq(
    page,
    ([zz, h, go]) => {
      window.__kq.setMinute(600);
      window.__kq.place(-40, zz, h);
      if (go) window.__kq.input("up", true);
      window.__kq.step(go ? 3000 : 1500);
      window.__kq.input("up", false);
      window.__kq.step(1500);
    },
    [z, heading, run],
  );

/** How far the hero and the camera are from the nearest lift-core wall, and the hero radius. */
const liftGaps = (page) =>
  kq(page, () => {
    const S = window.KQ.Game.S;
    const gap = (x, z) =>
      Math.min(
        ...S.world.colliders
          .filter((c) => c.kind === "core")
          .map((c) => {
            const cx = Math.max(c.minX, Math.min(x, c.maxX));
            const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
            return Math.hypot(x - cx, z - cz);
          }),
      );
    const cam = S.camera.position;
    const hero = S.player.pos;
    return {
      hero: gap(hero.x, hero.z),
      cam: gap(cam.x, cam.z),
      radius: window.KQ.Game.Player.RADIUS,
      camInWall: window.KQ.Game.Collide.camBlocked(S.world.colliders, cam.x, cam.z, 0.05),
    };
  });

/** Walk through a day at five hubs; collect every NPC problem seen. */
async function walkTheDay(page) {
  const found = [];
  for (const [i, minute] of DAY.entries()) {
    const hub = HUBS[i % HUBS.length];
    await kq(page, ([m, h]) => (window.__kq.setMinute(m), window.__kq.place(h[0], h[1], 0)), [
      minute,
      hub,
    ]);
    for (let t = 0; t < 8; t += 1) {
      await kq(page, () => window.__kq.step(2000));
      found.push(...(await problems(page)).map((p) => `${minute} ${p}`));
    }
  }
  return found;
}

let shared;
const sharedPage = async ({ browser }) => {
  shared = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  await boot(shared);
  await shared.evaluate(AUDIT_SRC);
};

test.describe("NPCs and walls", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(sharedPage);
  test.afterAll(async () => shared.close());

  test("the BLK 120 lift lobby: NPCs step out clear of the wall, not stacked, facing open space", async () => {
    await kq(shared, () => {
      window.__kq.setMinute(420);
      window.__kq.place(-40, 45.5, Math.PI);
      window.__kq.step(2000);
    });
    const waiting = await kq(
      shared,
      () =>
        window.KQ.Game.S.npcs.agents.filter(
          (A) => !A.hidden && A.goal && A.goal.kind === "hide" && A.goal.home === "block_b",
        ).length,
    );
    expect(waiting, "NPCs waiting at BLK 120").toBeGreaterThan(0);
    expect(await problems(shared)).toEqual([]);
  });

  test("a day of walking: no NPC inside a wall, stacked or facing one, at five hubs", async () => {
    expect(await walkTheDay(shared)).toEqual([]);
  });
});

test.describe("hero, camera and the lift wall", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(sharedPage);
  test.afterAll(async () => shared.close());

  test("the hero cannot walk into the lift wall and the camera stays out of it", async () => {
    await nearLift(shared, 46, 0, true); // facing +z, running at the wall
    const r = await liftGaps(shared);
    expect(r.hero).toBeGreaterThanOrEqual(r.radius - 0.02);
    expect(r.cam, "camera distance from the wall").toBeGreaterThan(0.1);
  });

  test("with the wall behind the hero the camera pulls in instead of sitting in the wall", async () => {
    await nearLift(shared, 49.0, Math.PI, false); // back to the wall: the camera is behind, into it
    expect((await liftGaps(shared)).camInWall).toBe(false);
  });
});

/** The hero's height now, and the highest it gets over the next n 1/30 s steps. */
const heroY = async (page) => (await kq(page, () => window.__kq.state())).pos.y;
const highest = (page, n) =>
  kq(
    page,
    (frames) => {
      let top = window.__kq.state().pos.y;
      for (let i = 0; i < frames; i += 1) {
        window.__kq.step(33);
        top = Math.max(top, window.__kq.state().pos.y);
      }
      return top;
    },
    n,
  );

test.describe("jump", () => {
  test.describe.configure({ timeout: 120_000 });

  test("Space raises the hero in the jump pose and lands back on the ground", async ({ page }) => {
    await boot(page);
    await kq(page, () => window.__kq.place(-30, 40, 0));
    const y0 = await heroY(page);
    await page.keyboard.press("Space");
    await kq(page, () => window.__kq.step(250));
    const up = await kq(page, () => window.__kq.state());
    expect(up.pos.y, "raised").toBeGreaterThan(y0 + 0.3);
    expect(up.pose, "jump pose").toBe("jump");
    await kq(page, () => window.__kq.step(1000));
    const down = await kq(page, () => window.__kq.state());
    expect(Math.abs(down.pos.y - y0), "back on the ground").toBeLessThan(0.03);
    expect(down.pose).not.toBe("jump");
    await page.keyboard.press("Space"); // and it can hop again after landing
    await kq(page, () => window.__kq.step(250));
    expect(await heroY(page)).toBeGreaterThan(y0 + 0.3);
  });

  test("a second Space in the air does not jump again (no double jump)", async ({ page }) => {
    await boot(page);
    await kq(page, () => window.__kq.place(-30, 40, 0));
    const y0 = await heroY(page);
    await page.keyboard.press("Space");
    await kq(page, () => window.__kq.step(200));
    await page.keyboard.press("Space");
    expect((await highest(page, 20)) - y0, "no higher than one jump").toBeLessThan(0.95);
  });
});

test.describe("jump limits", () => {
  test.describe.configure({ timeout: 120_000 });

  test("jumping into the lift wall does not carry the hero into or onto it", async ({ page }) => {
    await boot(page);
    await kq(page, () => {
      window.__kq.place(-40, 47, 0);
      window.__kq.input("up", true);
    });
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Space");
      await kq(page, () => window.__kq.step(800));
    }
    await kq(page, () => (window.__kq.input("up", false), window.__kq.step(1000)));
    const s = await kq(page, () => window.__kq.state());
    expect(s.pos.z, "still on the open side of the wall (z 49.5)").toBeLessThan(49.5 - 0.3);
    expect(s.pos.y, "on the ground").toBeLessThan(0.3);
  });

  test("Space does not jump while a menu is open", async ({ page }) => {
    await boot(page);
    await kq(page, () => window.__kq.action("map"));
    const y0 = await heroY(page);
    await page.keyboard.press("Space");
    await kq(page, () => window.__kq.step(250));
    expect(await heroY(page)).toBeCloseTo(y0, 1);
  });
});

test.describe("jump on a phone", () => {
  const phone = { ...devices["iPhone 13"] };
  delete phone.defaultBrowserType;
  test.use(phone);
  test.describe.configure({ timeout: 120_000 });

  test("the Jump button is a 48 px target and a tap makes the hero hop", async ({ page }) => {
    await page.goto(GAME);
    await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
    await page.getByRole("button", { name: "Start", exact: true }).tap();
    await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
    await kq(page, () => window.__kq.step(300));
    const box = await page.locator("#kqJump").boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(47.5);
    expect(box.height).toBeGreaterThanOrEqual(47.5);
    const y0 = (await kq(page, () => window.__kq.state())).pos.y;
    await page.locator("#kqJump").tap();
    await kq(page, () => window.__kq.step(250));
    expect((await kq(page, () => window.__kq.state())).pos.y).toBeGreaterThan(y0 + 0.3);
    await kq(page, () => window.__kq.step(1000));
    expect(Math.abs((await kq(page, () => window.__kq.state())).pos.y - y0)).toBeLessThan(0.03);
  });
});
