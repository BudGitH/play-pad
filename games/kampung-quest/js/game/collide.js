/* ============================================================================
 * FILE: collide.js
 * PURPOSE: 2D (XZ) circle-vs-AABB collision against the world colliders: slide the hero and
 *          NPCs along walls, find free spots for pick-ups, and test the camera's spring arm.
 * BUSINESS CONTEXT: AC-2 (stopped by building/prop colliders, camera never clips buildings).
 * DEPENDENCIES: KQ.World colliders: [{minX,maxX,minZ,maxZ,kind}].
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

  /** Push the circle (pos.x, pos.z, r) out of one box. Returns true when it moved. */
  function pushOut(pos, r, c) {
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

  /** Does a circle of radius r at x,z overlap the collider box c? */
  function hits(c, x, z, r) {
    return x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r;
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

  G.Collide = { resolve, pushOut, blockedAt, camBlocked, freeSpot, TALL };
})((window.KQ = window.KQ || {}));
