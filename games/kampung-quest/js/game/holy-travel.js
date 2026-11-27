/* ============================================================================
 * FILE: holy-travel.js
 * PURPOSE: Moving the hero around the Haramain region: KQ.Holy.goTo(siteKey) (a fade, then the
 *          hero stands at that site's stand-spot facing it), KQ.Holy.travel("makkah" | "madinah")
 *          (the bus ride between the cities, same fade), and the test summary KQ.Holy.debug().
 * BUSINESS CONTEXT: AC-H3 ("Go there" button of the ritual stepper moves the hero: walking is
 *   optional), AC-H4/H5 (Mina, Arafah, Quba, Uhud...), the bus between Makkah and Madinah.
 * DEPENDENCIES: player.js, camera.js, collide.js, loop.js, ui-core.js (toast), KQ.Holy (world).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const Holy = (KQ.Holy = KQ.Holy || {});
  /** How long the screen stays black while the hero is moved (ms). */
  const FADE_MS = 450;

  /** Run `fn` under a fade to black and back (at once when `instant`, or the player prefers less motion). */
  function fadeThen(fn, instant) {
    const root = document.getElementById("kq");
    if (instant || !root || (G.Settings && G.Settings.reduced())) {
      fn();
      return;
    }
    root.classList.add("kq-fading");
    setTimeout(function () {
      fn();
      setTimeout(() => root.classList.remove("kq-fading"), 150);
    }, FADE_MS);
  }

  /** Put the hero at a {x, z, yaw} spot (nudged off colliders), face the camera behind them, settle one step. */
  function moveHero(spot) {
    const s = G.S;
    const before = s.world.city ? s.world.city() : null;
    const free = G.Collide.freeSpot(s.world.colliders, spot.x, spot.z, G.Player.RADIUS);
    G.Player.place(s.player, free.x, free.z, spot.yaw, s.world.heightAt);
    G.Camera.snapBehind(spot.yaw);
    if (s.world.setCity) s.world.setCity(Holy.cityOf(free.x));
    if (before && before !== Holy.cityOf(free.x)) G.UI.dismissToast("holy-welcome");
    s.world.setShadowTarget(free);
    G.Loop.step(100);
  }

  /** Is the Haramain world running with a started game? */
  function ready() {
    return Boolean(G.S && G.S.started && G.S.world && G.S.world.region === "haramain");
  }

  /**
   * Take the hero to a site (a KQ.HOLY key such as "kaaba", "safa", "rawdah", or "blackStone",
   * "behindMaqam" style stand-spots in KQ.Holy.STAND). Fades, then places the hero facing the site.
   * @param {string} key site key
   * @param {{instant?:boolean, onDone?:function}} [opts]
   * @returns {boolean} false when the key is unknown or the region is not Haramain
   */
  function goTo(key, opts) {
    const spot = Holy.standFor(key);
    if (!ready() || !spot) return false;
    const o = opts || {};
    fadeThen(function () {
      const before = G.S.world.city();
      moveHero(spot);
      const after = G.S.world.city();
      if (after !== before) G.UI.toast(G.Region.welcome(after), "good", 6000, "holy-welcome");
      if (o.onDone) o.onDone(key);
    }, o.instant);
    return true;
  }

  /**
   * The bus between the cities: fade, arrive at the other city's stop with a short note.
   * @param {"makkah"|"madinah"} city
   * @param {{instant?:boolean, onDone?:function}} [opts]
   */
  function travel(city, opts) {
    const spot = Holy.ARRIVE[city];
    if (!ready() || !spot) return false;
    const o = opts || {};
    fadeThen(function () {
      moveHero(spot);
      const name = city === "madinah" ? "Madinah" : "Makkah";
      if (G.UI && G.UI.toast)
        G.UI.toast("The bus has arrived in " + name + ". Welcome!", "good", 5000);
      if (o.onDone) o.onDone(city);
    }, o.instant);
    return true;
  }

  /** What exists in the world and the crowd, for the browser tests (counts and names only). */
  function debug() {
    const s = G.S;
    if (!s || !s.world) return null;
    const names = [
      "holyPalmTrunk",
      "holyPalmCrown",
      "holyUmbrellaPole",
      "holyUmbrellaTop",
      "holyHills1",
      "holyHalos",
      "holyPigeons",
    ];
    const meshes = {};
    names.forEach((n) => (meshes[n] = Boolean(s.world.group.getObjectByName(n))));
    return {
      region: KQ.region,
      city: s.world.city ? s.world.city() : null,
      sites: s.world.sites || [],
      meshes,
      batches: s.world.group.children.filter((c) => c.name.indexOf("batch:") === 0).length,
      colliders: s.world.colliders.length,
      pigeons: s.world.pigeons || 0,
      pois: Object.keys(s.world.pois).length,
      crowd: s.crowd ? G.Crowd.debug(s.crowd) : null,
      vehicleSpots: Holy.vehicleSpots.length,
      noDrive: Holy.noDrive.length,
      prayerTimes: KQ.PRAYER_TIMES.date,
    };
  }

  Holy.goTo = goTo;
  Holy.travel = travel;
  Holy.debug = debug;
})((window.KQ = window.KQ || {}));
