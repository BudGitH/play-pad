// Dev-only (browser side of the figures audit, after audit-page.js and audit-render.js): every humanoid
// the game can show, by category: the hero (boy: every head style of Player.HEAD_STYLES, the tailor's
// heads, ihram and the two tahallul cuts; girl: every hair / hijab style and her ihram), the cast
// neighbours, the two Haramain guides, the event actors, and the crowd / pilgrims (one person per
// hat type the crowd kit can draw, adult and kid).
(function () {
  "use strict";
  const A = window.KQAudit;
  const KQ = window.KQ;
  const F = KQ.Figures;
  // a copy of KQ.Game.Player.HEAD_STYLES (the game layer is not loaded here)
  const BOY_HEADS = {
    songkok: { type: "songkok", colour: "#1c1c22", hair: "#3a2416" },
    cap_yellow: {
      type: "cap",
      colour: "#f2b134",
      peak: "#d99a1f",
      badge: "#1d4fc6",
      hair: "#3a2416",
    },
    crew: { type: "hair_short", colour: "#2a1c14" },
    curly: { type: "hair_quiff", colour: "#3a2416" },
    side_part: { type: "hair_short", colour: "#6b4423" },
    kopiah: { type: "kopiah", colour: "#fbfaf5", accent: "#2f8f5a" },
  };
  const RIG_POSES = ["idle", "walk", "sit", "wave", "ruku", "sujud", "julus", "drive"];
  const CROWD_POSES = ["idle", "walk", "sittalk", "pedal", "qiyam", "ruku", "sujud", "julus"];
  const RIG_TILES = [
    ["walk", "walk", 0.9],
    ["sit", "sit", 0.9],
    ["ruku", "ruku", 1.35],
    ["sujud", "sujud", 1.35],
    ["julus", "julus", 1.2],
    ["drive", "drive", 0.9],
  ];
  const CROWD_TILES = [
    ["walk", "walk", 0.9],
    ["sit", "sittalk", 0.9],
    ["ruku", "ruku", 1.35],
    ["sujud", "sujud", 1.35],
    ["julus", "julus", 1.2],
    ["pedal", "pedal", 0.9],
  ];
  const groups = {};

  /** A built rig (cached per spec id). */
  function rig(spec) {
    if (!groups[spec.id]) groups[spec.id] = F.build(spec);
    return groups[spec.id];
  }

  /** The boy hero with a head piece, optionally in ihram. */
  function boy(head, ihram) {
    return () => {
      const g = rig(F.CAST.hero);
      F.setIhram(g.userData.rig, Boolean(ihram));
      F.setHeadPiece(g.userData.rig, head);
      g.userData.rig.headType = head.type;
      return g;
    };
  }

  /** The girl hero in a style (or in her ihram). */
  function girl(style, ihram) {
    const H = KQ.Sim.Hero;
    return () => {
      const base = Object.assign({}, F.HERO_GIRL, { id: "aud_girl" + (ihram ? "_ihram" : "") });
      const g = rig(ihram ? Object.assign(base, H.ihramSpec()) : base);
      const head = ihram ? H.ihramHead() : H.headFor({ gender: "girl", style, scarf: "rose" });
      F.setHeadPiece(g.userData.rig, head);
      g.userData.rig.headType = head.type;
      return g;
    };
  }

  /** The hero's subjects (boy and girl). */
  function heroSubjects() {
    const list = [{ name: "hero-boy-cap", cat: "hero", make: boy(F.CAST.hero.head) }];
    Object.keys(BOY_HEADS).forEach((k) =>
      list.push({ name: "hero-boy-" + k, cat: "hero", make: boy(BOY_HEADS[k]) }),
    );
    list.push({ name: "hero-boy-ihram", cat: "hero", make: boy(F.IHRAM_HEAD.none, true) });
    list.push({ name: "hero-boy-trim", cat: "hero", make: boy(F.IHRAM_HEAD.trim, true) });
    list.push({ name: "hero-boy-shave", cat: "hero", make: boy(F.IHRAM_HEAD.shave, true) });
    KQ.Sim.Hero.STYLES.forEach((s) =>
      list.push({ name: "hero-girl-" + s.id, cat: "hero", make: girl(s.id) }),
    );
    list.push({ name: "hero-girl-ihram", cat: "hero", make: girl("hijab", true) });
    return list;
  }

  /** Category of a cast id: guide, event actor or neighbour. */
  function castCat(id) {
    if (/^guide_/.test(id)) return "guides";
    return /^ev_/.test(id) ? "event" : "cast";
  }

  /** Every cast rig except the hero. */
  function castSubjects() {
    return Object.keys(F.CAST)
      .filter((id) => id !== "hero")
      .map((id) => ({
        name: castCat(id) + "-" + id,
        cat: castCat(id),
        make: () => rig(F.CAST[id]),
      }));
  }

  const SKIN = "#c98e62";
  /** A representative crowd outfit with a hat (the hat is what the check is about). */
  function outfit(head, female, ihram) {
    const o = {
      skin: SKIN,
      top: "#3f74e8",
      legs: "#3b3f4a",
      long: true,
      skirt: female,
      shorts: false,
    };
    if (ihram) Object.assign(o, { top: "#f6f4ee", legs: "#f6f4ee", long: false, skirt: true });
    return Object.assign(o, { head, headColour: female ? "#7b56a8" : "#2a1c14" });
  }

  const CROWD = [
    ["crowd", "hair", false],
    ["crowd", "bun", true],
    ["crowd", "tudung", true],
    ["crowd", "cap", false],
    ["crowd", "songkok", false],
    ["crowd", "kopiah", false],
    ["crowd", "none", false],
    ["pilgrims", "ghutra", false],
    ["pilgrims", "wrap", true],
    ["pilgrims", "turban", false],
    ["pilgrims", "doppi", false],
  ];
  /** One crowd person per hat type (adults), the kids' hats, and the ihram man. */
  function crowdSubjects() {
    const list = CROWD.map((c) => ({
      name: c[0] + "-" + c[1],
      cat: c[0],
      hat: c[1],
      kid: false,
      o: outfit(c[1], c[2]),
    }));
    list.push({
      name: "crowd-kid-tudung_kid",
      cat: "crowd",
      hat: "tudung_kid",
      kid: true,
      o: outfit("tudung_kid", true),
    });
    list.push({
      name: "crowd-kid-hair",
      cat: "crowd",
      hat: "hair",
      kid: true,
      o: outfit("hair", false),
    });
    list.push({
      name: "pilgrims-ihram-hair",
      cat: "pilgrims",
      hat: "hair",
      kid: false,
      o: outfit("hair", false, true),
    });
    list.push({
      name: "pilgrims-ihram-cap",
      cat: "pilgrims",
      hat: "cap",
      kid: false,
      o: outfit("cap", false, true),
    });
    return list;
  }

  let all = null;
  /** Every subject, built lazily. */
  function subjects() {
    if (!all) all = heroSubjects().concat(castSubjects(), crowdSubjects());
    return all;
  }

  /** Head-space and pose checks for one rig subject. */
  function rigChecks(s, res) {
    const g = s.make();
    const r = g.userData.rig;
    const piece = A.checkPiece(r.accessory.geometry, "cast", headType(r, s));
    res.pieces.push(Object.assign({ cat: s.cat, who: s.name, type: headType(r, s) }, piece));
    RIG_POSES.forEach((p) =>
      res.poses.push(Object.assign({ cat: s.cat, who: s.name, pose: p }, A.checkRigPose(g, p))),
    );
  }

  /** The head piece type a rig subject wears now. */
  function headType(r, s) {
    return r.headType || (s && r.spec.head.type);
  }

  /** Head-space and pose checks for one crowd subject. */
  function crowdChecks(s, res) {
    const geo = F.crowdGeometries()["hat_" + s.hat];
    if (geo) {
      const piece = A.checkPiece(geo, "crowd", s.hat);
      res.pieces.push(Object.assign({ cat: s.cat, who: s.name, type: s.hat }, piece));
    }
    CROWD_POSES.forEach((p) =>
      res.poses.push(
        Object.assign(
          { cat: s.cat, who: s.name, pose: p },
          A.checkCrowdPose(s.hat, p, s.kid, s.o.skirt),
        ),
      ),
    );
  }

  window.KQAuditSubjects = {
    names: () => subjects().map((s) => s.name),
    /** All geometry checks: { faceBand, pieces: [...], poses: [...] }. */
    checks() {
      const res = { faceBand: A.checkFaceBand(), pieces: [], poses: [] };
      subjects().forEach((s) => (s.make ? rigChecks(s, res) : crowdChecks(s, res)));
      return res;
    },
    /** The contact sheet (JPEG data URL) of one subject. */
    sheet(name) {
      const s = subjects().find((x) => x.name === name);
      if (s.make) return A.sheet(A.rigSubject(s.make()), RIG_TILES);
      return A.sheet(A.crowdSubject(s.o, s.kid), CROWD_TILES);
    },
  };
})();
