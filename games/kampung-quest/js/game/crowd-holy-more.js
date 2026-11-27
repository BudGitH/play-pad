/* ============================================================================
 * FILE: crowd-holy-more.js
 * PURPOSE: More people and more kinds of people for the Haramain crowd: pilgrims strolling along
 *          the walk graph between the hotels, the gate plaza, the courtyard and the mosques (one
 *          analytic ping-pong walk per person, so thousands cost nothing), groups waiting at the
 *          hotel doors with their luggage, queues at the bus stops, tour groups being briefed by a
 *          guide with a flag, and a ring of people in dua at the edge of the mataf.
 * BUSINESS CONTEXT: owner feedback "add a lot more individuals and characters across both
 *   regions" (dense pilgrims around the mataf and plazas, people walking between hotels, families).
 *   Same instanced crowd as everything else: nothing here adds a mesh or a draw call.
 * DEPENDENCIES: crowd-zones.js (clear, segmentClear), crowd-holy-units.js (the unit looks),
 *   KQ.Sim.Crowd (+ .Pilgrim), KQ.HOLY, util.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const SC = () => KQ.Sim.Crowd;
  const PL = () => KQ.Sim.Crowd.Pilgrim;
  const H = (a, b) => SC().hash01(a + ":" + b);
  /** The shortest walkway worth strolling, the metres of walkway per person, and the most per walkway. */
  const MIN_EDGE = 12;
  const PER_M = 11;
  const MAX_PER_EDGE = 4;

  /** A slot with the fields every holy spot needs. */
  function slot(id, kind, x, z, heading, look, extra) {
    return Object.assign({ id, kind, holy: "hold", x, z, heading, look }, extra || {});
  }

  // ---------- strollers on the walk graph ----------

  /** The unit kinds a stroller may be (no tour groups: they have their own briefings). */
  function strollKind(id) {
    const k = G.CrowdHolyUnits.unitKind(id, false);
    return k === "tour" ? "single" : k;
  }

  /** The slots of one stroll unit (a person, a parent and child, a wheelchair...) walking along an edge. */
  function strollUnit(edge, id, v0, phase, len) {
    const kind = strollKind(id);
    return G.CrowdHolyUnits.members(kind, id).map(function (m, k) {
      const line = {
        x0: edge.a.x,
        z0: edge.a.z,
        x1: edge.b.x,
        z1: edge.b.z,
        v: v0 * (m.look.slow || 1),
        phase: (((phase - m.along / (2 * len)) % 1) + 1) % 1,
        lane: 0.4 + m.across,
      };
      const p = PL().patrolAt(line, 0);
      return slot(id + ":" + k, "stroll", p.x, p.z, p.heading, m.look, { holy: "patrol", line });
    });
  }

  /** Is (x, z) on the floor where the congregation prays in rows (Haram courtyard arcs, Nabawi hall, Quba)? */
  function inPrayerRows(x, z) {
    const r = Math.hypot(x, z);
    const haram = x < 300 && r > 31 && r < 44 && x > -46 && x < 37 && Math.abs(z) < 43;
    const nabawi = x > 568 && x < 633 && z > -27 && z < 28 && !(x > 599 && x < 602);
    const quba = x > 548 && x < 572 && z > 112 && z < 128;
    return haram || nabawi || quba;
  }

  /** Is the walkway from a to b free of prayer rows (sampled every 3 m)? */
  function offPrayerRows(a, b, len) {
    const n = Math.ceil(len / 3);
    for (let i = 0; i <= n; i += 1) {
      if (inPrayerRows(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
    }
    return true;
  }

  /** Long walkways of the graph (both cities): each gets a few ping-pong strollers, out of phase. */
  function strollSlots(world, pathP) {
    const out = [];
    if (!pathP || !pathP.edges) return out;
    pathP.edges.forEach(function (e, i) {
      const a = pathP.nodes[e[0]];
      const b = pathP.nodes[e[1]];
      const len = U.dist(a.x, a.z, b.x, b.z);
      if (len < MIN_EDGE || !offPrayerRows(a, b, len)) return;
      if (!G.CrowdZones.segmentClear(world, a.x, a.z, b.x, b.z, 0.55)) return;
      const n = Math.min(MAX_PER_EDGE, Math.floor(len / PER_M));
      const city = a.x > 300 ? "nabawi" : "makkah";
      for (let k = 0; k < n; k += 1) {
        const id = "stroll:" + city + ":" + i + ":" + k;
        const v = 0.95 + 0.5 * H(id, "v");
        const phase = (k + 0.7 * H(id, "p")) / n;
        out.push(...strollUnit({ a, b }, id, v, phase, len));
      }
    });
    return out;
  }

  // ---------- hotel doorways ----------

  /** Who stands at a hotel door: [along the face (m), out from it (m), pose, prop, role, faces the street?]. */
  const DOOR_FOLK = [
    [-3.2, 1.6, "wait", "bag", "adult", true],
    [-2.3, 2.2, "phone", null, "adult", true],
    [-0.9, 1.5, "order", "cart", "adult", true],
    [0.6, 1.9, "wait", "bag", "any", true],
    [1.3, 2.5, "wait", null, "kid", true],
    [2.4, 1.7, "listen", null, "adult", false],
    [3.1, 2.1, "talk", null, "adult", false],
  ];

  /** The face of a tower collider that looks toward the mosque, with its outward normal and a point on it. */
  function doorFace(c) {
    const cx = (c.minX + c.maxX) / 2;
    const cz = (c.minZ + c.maxZ) / 2;
    const tx = cx > 300 ? 600 : 0;
    const tz = cx > 300 ? -30 : 0;
    const alongZ = Math.abs(tz - cz) * (c.maxX - c.minX) > Math.abs(tx - cx) * (c.maxZ - c.minZ);
    if (alongZ) {
      const s = tz > cz ? 1 : -1;
      return { x: cx, z: s > 0 ? c.maxZ : c.minZ, nx: 0, nz: s, tx: 1, tz: 0 };
    }
    const s = tx > cx ? 1 : -1;
    return { x: s > 0 ? c.maxX : c.minX, z: cz, nx: s, nz: 0, tx: 0, tz: 1 };
  }

  /** The people waiting outside one hotel's door. */
  function doorGroup(world, c, j) {
    const f = doorFace(c);
    const out = [];
    DOOR_FOLK.forEach(function (d, i) {
      const x = f.x + f.tx * d[0] + f.nx * d[1];
      const z = f.z + f.tz * d[0] + f.nz * d[1];
      if (!G.CrowdZones.clear(world, x, z, 0.4)) return;
      const out_h = Math.atan2(f.nx, f.nz);
      const heading = d[5] ? out_h : out_h + Math.PI * (i % 2 ? 0.5 : -0.5);
      const look = {
        pose: d[2],
        prop: d[3],
        role: d[4],
        bag: H("hotelbag", j + ":" + i) < 0.5 ? "#2a63b0" : "#c43c3c",
      };
      out.push(slot("hotel:" + j + ":" + i, "hotel", x, z, heading, look));
    });
    return out;
  }

  /** Every hotel and tower of the world gets a door group. */
  function hotelSlots(world) {
    const out = [];
    world.colliders
      .filter((c) => c.kind === "tower")
      .forEach((c, j) => out.push(...doorGroup(world, c, j)));
    return out;
  }

  // ---------- bus stops ----------

  /** Bus-stop places [x, z, name]: the miqat stop, the Madinah stop and the Makkah hotel forecourt. */
  function stopPlaces() {
    const H0 = KQ.HOLY;
    return [
      [H0.makkah.miqat.x, H0.makkah.miqat.z, "miqat"],
      [H0.madinah.busStop.x, H0.madinah.busStop.z, "madinah"],
      [H0.spawn.x, H0.spawn.z - 6, "forecourt"],
    ];
  }

  /** People waiting for the bus: two loose rows facing the stop, most with a bag. */
  function stopSlots(world) {
    const out = [];
    stopPlaces().forEach(function (s) {
      for (let i = 0; i < 10; i += 1) {
        const x = s[0] + ((i % 5) - 2) * 1.05;
        const z = s[1] + 2.4 + Math.floor(i / 5) * 1.1;
        if (!G.CrowdZones.clear(world, x, z, 0.4)) continue;
        const bag = H("stopbag", s[2] + i) < 0.6;
        const pose = H("stoppose", s[2] + i) < 0.3 ? "phone" : "wait";
        const look = { pose, prop: bag ? "bag" : null, role: "any" };
        out.push(slot("stop:" + s[2] + ":" + i, "stop", x, z, Math.PI, look));
      }
    });
    return out;
  }

  // ---------- tour briefings ----------

  /** Where a guide briefs a group: [x, z, people] on the plazas and courtyards. */
  const BRIEF_SPOTS = [
    [-18, -84, 7],
    [18, -84, 6],
    [0, -104, 8],
    [-40, -70, 6],
    [40, -66, 6],
    [-6, 44, 6],
    [590, -70, 7],
    [612, -84, 6],
    [575, -52, 5],
    [563, 100, 6],
    [600, -186, 6],
    [585, -100, 6],
  ];

  /** One briefing: the guide with a flag or umbrella in the middle, the group listening in an arc. */
  function briefing(world, b, j) {
    const [cx, cz, n] = b;
    if (!G.CrowdZones.clear(world, cx, cz, 2.6)) return [];
    const prop = H("briefprop", j) < 0.6 ? "flag" : "umbrella";
    const out = [
      slot("brief:tour" + (100 + j) + ":0", "brief", cx, cz, Math.PI * H("bh", j), {
        pose: "talk",
        prop,
        role: "adult",
      }),
    ];
    const face = Math.PI * H("bh", j) + Math.PI;
    for (let k = 1; k < n; k += 1) {
      const a = face + ((k - (n - 1) / 2) / n) * 2.6;
      const x = cx + Math.sin(a) * 2.1;
      const z = cz + Math.cos(a) * 2.1;
      if (!G.CrowdZones.clear(world, x, z, 0.4)) continue;
      const pose = H("briefpose" + j, k) < 0.15 ? "phone" : "listen";
      out.push(
        slot("brief:tour" + (100 + j) + ":" + k, "brief", x, z, SC().headingTo(x, z, cx, cz), {
          pose,
          role: "any",
        }),
      );
    }
    out[0].heading = SC().headingTo(cx, cz, cx + Math.sin(face) * 2.1, cz + Math.cos(face) * 2.1);
    return out;
  }

  /** Every tour briefing that fits. */
  function briefSlots(world) {
    const out = [];
    BRIEF_SPOTS.forEach((b, j) => out.push(...briefing(world, b, j)));
    return out;
  }

  /** Every extra holy-city spot. */
  function build(world, pathP) {
    return [].concat(
      strollSlots(world, pathP),
      hotelSlots(world),
      stopSlots(world),
      briefSlots(world),
    );
  }

  G.CrowdHolyMore = { build };
})((window.KQ = window.KQ || {}));
