/* ============================================================================
 * FILE: seats.js
 * PURPOSE: Finds the places a figure can really sit (hawker stools, park benches, the bus
 *          stop bench) from the world colliders, and hands them out to NPCs.
 * BUSINESS CONTEXT: AC-5 (NPCs sit and eat). Heights follow the world builders: table sets
 *   have four stools (top 0.60 m, 0.95 m from the centre), benches have a 0.50 m seat.
 * DEPENDENCIES: world.colliders (kind "table" | "bench" | "bus-bench"), world.heightAt,
 *   KQ.Figures.seatDrop (applied by the caller).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const STOOL_TOP = 0.6;
  const BENCH_TOP = 0.5;

  /** The middle point of a collider box. */
  function centre(c) {
    return { x: (c.minX + c.maxX) / 2, z: (c.minZ + c.maxZ) / 2 };
  }

  /** Four stool seats around a table, each facing the table. */
  function stools(c, base) {
    const m = centre(c);
    const out = [];
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const x = m.x + Math.cos(a) * 0.95;
      const z = m.z + Math.sin(a) * 0.95;
      out.push({ x, z, y: base(x, z) + STOOL_TOP, heading: Math.atan2(m.x - x, m.z - z) });
    }
    return out;
  }

  /** Two seats side by side on a bench, facing the given heading. */
  function benchSeats(c, base, heading, top) {
    const m = centre(c);
    return [-0.45, 0.45].map((dx) => ({
      x: m.x + dx,
      z: m.z,
      y: base(m.x + dx, m.z) + top,
      heading,
    }));
  }

  /** All seats in the world: [{ x, z, y, heading, taken }]. */
  function build(world) {
    const base = world.heightAt;
    const seats = [];
    world.colliders.forEach(function (c, i) {
      if (c.kind === "table") seats.push(...stools(c, base));
      else if (c.kind === "bench")
        seats.push(...benchSeats(c, base, i % 2 ? 0 : Math.PI, BENCH_TOP));
      else if (c.kind === "bus-bench") seats.push(...benchSeats(c, base, Math.PI, BENCH_TOP));
    });
    seats.forEach((s) => (s.taken = null));
    return seats;
  }

  /** Claim the free seat nearest to (x, z) within maxDist for `who`, or null. */
  function claim(seats, x, z, maxDist, who) {
    let best = null;
    seats.forEach(function (s) {
      if (s.taken && s.taken !== who) return;
      const d = U.dist(x, z, s.x, s.z);
      if (d <= maxDist && (!best || d < best.d)) best = { s, d };
    });
    if (!best) return null;
    best.s.taken = who;
    return best.s;
  }

  /** Free every seat held by someone. */
  function release(seats, who) {
    seats.forEach(function (s) {
      if (s.taken === who) s.taken = null;
    });
  }

  G.Seats = { build, claim, release };
})((window.KQ = window.KQ || {}));
