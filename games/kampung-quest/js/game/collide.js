/* ============================================================================
 * FILE: collide.js
 * PURPOSE: 2D (XZ) circle-vs-AABB collision against the world colliders: slide the hero and
 *          NPCs along walls, find free spots for pick-ups, keep characters off each other
 *          (separate), turn a pose away from a wall (openHeading) and measure how far the
 *          camera's spring arm may reach. Pure maths on plain {x, z} objects (unit-tested in
 *          tests/kampung-quest/collide.test.mjs).
 * BUSINESS CONTEXT: AC-2 (stopped by building/prop colliders, camera never clips buildings).
 * DEPENDENCIES: KQ.World colliders: [{minX,maxX,minZ,maxZ,kind}]. A collider may also carry `obb`
 *   {x, z, hx, hz, c, s} (an oriented box: centre, half sizes across / along, cos / sin of its heading;
 *   vehicles.js uses it for parked cars and bicycles, AC-P12); its minX..maxZ is then the box's bounds,
 *   so the broad-phase filters (nearColliders, armLength) keep working unchanged.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});

  /** Colliders tall enough to hide behind or poke the camera through (the rest are low props). */
  const TALL = new Set([
    "mosque-wall",
    "shop-wall",
    "shop-back",
    "pillar",
    "core",
    "tower",
    "lib",
    "lib-glass",
    "minaret",
    "wudu-wall",
    "wudu-women",
    "column",
    "arcade-col",
    "stalls",
    "screen",
    "clinic-glass",
    "fence",
    "edge",
    "mihrab",
  ]);

  /** Share of the overlap two characters give up per step (soft, so crowds ease apart). */
  const SEPARATE_RATE = 0.35;
  /** Metres between the points tested along the camera arm. */
  const ARM_STEP = 0.1;

  /** A point in an oriented box's own frame: x across (its left), z along its heading. */
  function toBox(o, x, z) {
    const dx = x - o.x;
    const dz = z - o.z;
    return { x: dx * o.c - dz * o.s, z: dx * o.s + dz * o.c };
  }

  /** Push the circle out of an oriented box: do it in the box's frame against an AABB, then turn back. */
  function pushOutObb(pos, r, o) {
    const p = toBox(o, pos.x, pos.z);
    if (!pushOutAabb(p, r, { minX: -o.hx, maxX: o.hx, minZ: -o.hz, maxZ: o.hz })) return false;
    pos.x = o.x + p.x * o.c + p.z * o.s;
    pos.z = o.z - p.x * o.s + p.z * o.c;
    return true;
  }

  /** Push the circle (pos.x, pos.z, r) out of one box. Returns true when it moved. */
  function pushOut(pos, r, c) {
    if (c.obb) return hits(c, pos.x, pos.z, r) && pushOutObb(pos, r, c.obb);
    return pushOutAabb(pos, r, c);
  }

  /** Push the circle out of an axis-aligned box {minX, maxX, minZ, maxZ}. Returns true when it moved. */
  function pushOutAabb(pos, r, c) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * r;
      pos.z = cz + (dz / d) * r;
      return true;
    }
    const left = pos.x - c.minX;
    const right = c.maxX - pos.x;
    const up = pos.z - c.minZ;
    const down = c.maxZ - pos.z;
    const m = Math.min(left, right, up, down);
    if (m === left) pos.x = c.minX - r;
    else if (m === right) pos.x = c.maxX + r;
    else if (m === up) pos.z = c.minZ - r;
    else pos.z = c.maxZ + r;
    return true;
  }

  /** Slide `pos` out of every collider (a few passes settle corners). Returns true if pushed. */
  function resolve(colliders, pos, r) {
    let moved = false;
    for (let pass = 0; pass < 3; pass += 1) {
      let again = false;
      for (let i = 0; i < colliders.length; i += 1) {
        if (pushOut(pos, r, colliders[i])) again = moved = true;
      }
      if (!again) break;
    }
    return moved;
  }

  /** Does a circle of radius r at x,z overlap the collider box c (its true shape when it is oriented)? */
  function hits(c, x, z, r) {
    if (!(x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r)) return false;
    if (!c.obb) return true;
    const p = toBox(c.obb, x, z);
    const dx = Math.max(0, Math.abs(p.x) - c.obb.hx);
    const dz = Math.max(0, Math.abs(p.z) - c.obb.hz);
    return dx * dx + dz * dz < r * r;
  }

  /** A collider for an oriented box {x, z, hx, hz, c, s}: its bounds plus the box itself. */
  function orientedBox(o, kind) {
    const ex = Math.abs(o.hx * o.c) + Math.abs(o.hz * o.s);
    const ez = Math.abs(o.hx * o.s) + Math.abs(o.hz * o.c);
    return { minX: o.x - ex, maxX: o.x + ex, minZ: o.z - ez, maxZ: o.z + ez, kind, obb: o };
  }

  /** First collider overlapping the point (with radius r), or null. */
  function blockedAt(colliders, x, z, r) {
    for (let i = 0; i < colliders.length; i += 1) {
      if (hits(colliders[i], x, z, r)) return colliders[i];
    }
    return null;
  }

  /** True if the camera point is inside something tall (a wall, pillar, building). */
  function camBlocked(colliders, x, z, r) {
    for (let i = 0; i < colliders.length; i += 1) {
      const c = colliders[i];
      if (TALL.has(c.kind) && hits(c, x, z, r)) return true;
    }
    return false;
  }

  /** The nearest clear spot to (x, z): spiral outward until `r` fits. Returns {x, z}. */
  function freeSpot(colliders, x, z, r) {
    if (!blockedAt(colliders, x, z, r)) return { x, z };
    for (let ring = 1; ring <= 12; ring += 1) {
      for (let k = 0; k < 12; k += 1) {
        const a = (k / 12) * Math.PI * 2;
        const px = x + Math.cos(a) * ring * 0.5;
        const pz = z + Math.sin(a) * ring * 0.5;
        if (!blockedAt(colliders, px, pz, r)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  /**
   * Like resolve, but if the circle is still inside something afterwards (a pinched corner, a
   * thin wall it was shoved into) move it to the nearest free spot. Returns true if it moved.
   */
  function settle(colliders, pos, r) {
    const moved = resolve(colliders, pos, r);
    if (!blockedAt(colliders, pos.x, pos.z, r - 0.03)) return moved;
    const free = freeSpot(colliders, pos.x, pos.z, r);
    pos.x = free.x;
    pos.z = free.z;
    return true;
  }

  /**
   * Keep two characters `space` apart. `shareA` / `shareB` (0..1) say how much of the correction
   * each one takes (0 = it does not move). Exactly stacked characters are split along `angle`.
   * Returns true when they were moved.
   */
  function separate(a, b, space, shareA, shareB, angle) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= space * space) return false;
    const d = Math.sqrt(d2);
    const ux = d > 1e-4 ? dx / d : Math.sin(angle || 0);
    const uz = d > 1e-4 ? dz / d : Math.cos(angle || 0);
    const amt = (space - d) * SEPARATE_RATE;
    a.x += ux * amt * shareA;
    a.z += uz * amt * shareA;
    b.x -= ux * amt * shareB;
    b.z -= uz * amt * shareB;
    return true;
  }

  /** Heading offsets tried, in order, when the wanted heading points at a wall. */
  const TURNS = [Math.PI, 2.4, -2.4, 1.6, -1.6, 0.8, -0.8];

  /**
   * The wanted heading, unless something is within `reach` metres straight ahead (a character
   * standing nose to a wall); then a heading that looks at open space, preferring to turn right
   * around, then the next biggest turns.
   */
  function openHeading(colliders, x, z, heading, reach) {
    const clear = (h) =>
      !blockedAt(colliders, x + Math.sin(h) * reach, z + Math.cos(h) * reach, 0.12);
    if (clear(heading)) return heading;
    for (let i = 0; i < TURNS.length; i += 1) {
      if (clear(heading + TURNS[i])) return heading + TURNS[i];
    }
    return heading;
  }

  /**
   * How far the camera may sit from (px, pz) along the unit direction (dx, dz): up to `len`, but
   * stopping `r` short of the first tall collider, never less than `minLen`. Only the colliders
   * near the segment are walked, so a long arm stays cheap.
   */
  function armLength(colliders, px, pz, dx, dz, len, r, minLen) {
    const ex = px + dx * len;
    const ez = pz + dz * len;
    const lo = { x: Math.min(px, ex) - r, z: Math.min(pz, ez) - r };
    const hi = { x: Math.max(px, ex) + r, z: Math.max(pz, ez) + r };
    const near = colliders.filter(
      (c) => TALL.has(c.kind) && c.maxX > lo.x && c.minX < hi.x && c.maxZ > lo.z && c.minZ < hi.z,
    );
    if (!near.length) return len;
    const steps = Math.ceil(len / ARM_STEP);
    for (let i = 1; i <= steps; i += 1) {
      const t = (i / steps) * len;
      if (blockedAt(near, px + dx * t, pz + dz * t, r)) {
        return Math.max(minLen, ((i - 1) / steps) * len);
      }
    }
    return len;
  }

  G.Collide = {
    resolve,
    settle,
    pushOut,
    hits,
    orientedBox,
    blockedAt,
    camBlocked,
    freeSpot,
    separate,
    openHeading,
    armLength,
    TALL,
  };
})((window.KQ = window.KQ || {}));
