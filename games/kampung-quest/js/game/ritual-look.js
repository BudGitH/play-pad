/* ============================================================================
 * FILE: ritual-look.js
 * PURPOSE: The hero visibly takes part: the ihram clothes (two white cloths, sandals, no cap) and the
 *          tahallul haircut scene at the salon (the hero sits, a few snips with sound and flying
 *          clippings, the hair is visibly shorter).
 * BUSINESS CONTEXT: AC-H3. Ihram goes on at the miqat and comes off after tahallul; the normal outfit
 *   (hero colour family) is restored then. Men shave or trim; the sim also knows a girl's "snip a
 *   fingertip-length lock" (cut "lock"), offered once the game has a girl hero.
 * DEPENDENCIES: player.js (applyOutfit), KQ.Figures (setIhram, IHRAM_HEAD), KQ.Sim.Umrah, audio.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const S = () => G.S;
  /** Seconds between snips and after the last one before the hero stands up. */
  const SNIP_GAP = 0.6;
  const SPECKS = ["✂️", "•", "•", "•"];
  const scene = { token: 0, active: false };

  /** Show the hero as the tracker says: in ihram or in normal clothes, with the haircut so far. */
  function sync() {
    if (S() && S().player) G.Player.applyOutfit(S().player, S().sim.outfit);
  }

  /** Put ihram on or off (the cloth, the sandals and the cap / hair change at once). */
  function wear(on) {
    S().sim.umrah.setIhram(on);
    sync();
    if (on) puff(7, ["✨", "🤍"]);
  }

  /** What the ihram is, said the way the hero wears it (AC-P10: the girl's is modest everyday clothes). */
  function ihramLine() {
    return G.Hero.isGirl()
      ? "Ihram is on: plain white clothes and a white hijab. Your face and hands stay uncovered."
      : "Ihram is on: two white cloths. No cap, simple sandals.";
  }

  /** A few clippings flying down the middle of the screen (skipped when the player asked for less motion). */
  function puff(count, marks) {
    if (G.Settings.reduced() || !S().hudHost) return;
    const set = marks || SPECKS;
    for (let i = 0; i < count; i += 1) {
      const spark = G.U.el("span", {
        cls: "kq-snip",
        "aria-hidden": "true",
        text: set[i % set.length],
        style:
          "--dx:" + Math.round((i - count / 2) * 22) + "px;--dy:" + (28 + (i % 3) * 14) + "px;",
      });
      S().hudHost.appendChild(spark);
      setTimeout(() => spark.remove(), 1300);
    }
  }

  /** One snip: a sound and some clippings. */
  function snip() {
    G.Audio.play("tap");
    puff(5);
  }

  /** The head piece to show part-way: a trim while the clippers work (a shave goes through a trim too). */
  function stage(kind, step) {
    const looks = KQ.Figures.IHRAM_HEAD;
    if (step >= 3) return kind === "shave" ? looks.shave : looks.trim;
    return step === 2 ? looks.trim : looks.none;
  }

  /** Where the hero sits for the haircut: the salon in Makkah, else right where they are. */
  function salonSpot() {
    const P = S().player;
    const salon = KQ.region === "haramain" && KQ.HOLY && KQ.HOLY.makkah && KQ.HOLY.makkah.hairSalon;
    const x = salon ? salon.x : P.pos.x;
    const z = salon ? salon.z : P.pos.z;
    const y = S().world.heightAt(x, z) - KQ.Figures.seatDrop(P.rig);
    return { x, y, z, heading: Math.PI };
  }

  /**
   * The haircut scene. kind: "trim" | "shave" | "lock". The hero sits, three snips (sound, clippings),
   * the hair gets shorter, then the hero stands up. Calls `done()` at the end. Always finishes, even
   * if the card is closed meanwhile: the cut is recorded at once, only the picture is staged.
   */
  function haircut(asked, done) {
    const umrah = S().sim.umrah;
    const kind = KQ.Sim.Umrah.cutFor(asked, G.Hero.isGirl()); // a girl only ever snips a lock
    umrah.setCut(kind);
    const token = (scene.token += 1);
    scene.active = true;
    G.Player.lock(S().player, salonSpot(), "sit");
    const at = (n) => S().after(n * SNIP_GAP, () => token === scene.token && frame(kind, n, done));
    [1, 2, 3, 4].forEach(at);
  }

  /** One beat of the scene: snips 1-3 cut a little more, beat 4 stands the hero up in the new look. */
  function frame(kind, n, done) {
    if (n < 4) {
      snip();
      // the girl snips one small lock: her hijab / hair stays as it is (no boy's trim on her head)
      if (!G.Hero.isGirl()) KQ.Figures.setHeadPiece(S().player.rig, stage(kind, n + 1));
      return;
    }
    scene.active = false;
    G.Player.release(S().player);
    G.Audio.play("good");
    if (done) done();
  }

  /** Finish a running haircut scene at once (the step moved on): the hero stands up, the new look is applied. */
  function cancel() {
    if (!scene.active) return;
    scene.token += 1;
    scene.active = false;
    G.Player.release(S().player);
    sync();
  }

  G.RitualLook = { sync, wear, haircut, cancel, ihramLine, isCutting: () => scene.active };
})((window.KQ = window.KQ || {}));
