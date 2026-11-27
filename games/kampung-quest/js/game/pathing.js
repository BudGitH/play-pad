/* ============================================================================
 * FILE: pathing.js
 * PURPOSE: Shortest paths over the world's pedestrian walk graph (sidewalks, zebra crossings
 *          and spurs to every POI) for NPC routines and the prayer guidance trail.
 * BUSINESS CONTEXT: AC-5 (NPCs walk sidewalks and crossings to their places and to the mosque).
 * DEPENDENCIES: world.walkGraph { nodes:[{id,x,z}], edges:[[a,b]] }, world.pois[id].node.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;

  /**
   * Build the walking graph's adjacency lists (with edge lengths) from the world's nodes and edges.
   */
  function build(world) {
    const g = world.walkGraph;
    const adj = g.nodes.map(() => []);
    g.edges.forEach(function (e) {
      const a = g.nodes[e[0]];
      const b = g.nodes[e[1]];
      const len = U.dist(a.x, a.z, b.x, b.z);
      adj[e[0]].push({ to: e[1], len });
      adj[e[1]].push({ to: e[0], len });
    });
    return { nodes: g.nodes, edges: g.edges, adj, pois: world.pois };
  }

  /** The closest point on the graph to (x, z): { px, pz, a, b } (a, b = the edge's end nodes). */
  function snap(P, x, z) {
    let best = null;
    P.edges.forEach(function (e) {
      const a = P.nodes[e[0]];
      const b = P.nodes[e[1]];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz || 1;
      const t = U.clamp(((x - a.x) * dx + (z - a.z) * dz) / len2, 0, 1);
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      const d2 = U.dist2(x, z, px, pz);
      if (!best || d2 < best.d2) best = { px, pz, a: e[0], b: e[1], d2 };
    });
    return best;
  }

  /**
   * Remove and return the open node with the smallest distance (a simple priority queue for the
   * small graph).
   */
  function popMin(open, dist) {
    let bi = -1;
    open.forEach(function (n, i) {
      if (bi < 0 || dist[n] < dist[open[bi]]) bi = i;
    });
    return open.splice(bi, 1)[0];
  }

  /** Dijkstra from the snapped start to `goal` (a node id). Returns node ids or null. */
  function route(P, start, goal) {
    const dist = P.nodes.map(() => Infinity);
    const prev = P.nodes.map(() => -1);
    const open = [];
    [start.a, start.b].forEach(function (n) {
      const d = U.dist(start.px, start.pz, P.nodes[n].x, P.nodes[n].z);
      if (d < dist[n]) {
        dist[n] = d;
        open.push(n);
      }
    });
    while (open.length) {
      const n = popMin(open, dist);
      if (n === goal) break;
      P.adj[n].forEach(function (e) {
        if (dist[n] + e.len >= dist[e.to]) return;
        if (dist[e.to] === Infinity) open.push(e.to);
        dist[e.to] = dist[n] + e.len;
        prev[e.to] = n;
      });
    }
    if (dist[goal] === Infinity) return null;
    const out = [];
    for (let n = goal; n !== -1; n = prev[n]) out.unshift(n);
    return out;
  }

  /**
   * Waypoints from (x, z) to the node of a POI: [{x, z}, ...] (first = the spot on the graph).
   * Returns null when no route exists.
   */
  function toPoi(P, x, z, poiId) {
    const poi = P.pois[poiId];
    if (!poi) return null;
    const start = snap(P, x, z);
    const ids = route(P, start, poi.node);
    if (!ids) return null;
    const pts = [{ x: start.px, z: start.pz }];
    ids.forEach((n) => pts.push({ x: P.nodes[n].x, z: P.nodes[n].z }));
    return pts;
  }

  /** Waypoints to an arbitrary graph node id. */
  function toNode(P, x, z, node) {
    const start = snap(P, x, z);
    const ids = route(P, start, node);
    if (!ids) return null;
    return [{ x: start.px, z: start.pz }].concat(
      ids.map((n) => ({ x: P.nodes[n].x, z: P.nodes[n].z })),
    );
  }

  /** Graph nodes within `radius` of (x, z) - the places a strolling NPC may head for. */
  function nodesNear(P, x, z, radius) {
    return P.nodes.filter((n) => U.dist2(n.x, n.z, x, z) <= radius * radius);
  }

  G.Path = { build, snap, toPoi, toNode, nodesNear };
})((window.KQ = window.KQ || {}));
