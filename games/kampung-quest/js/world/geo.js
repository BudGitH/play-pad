/* Kampung Quest — world geometry helpers (KQ.WorldParts.Batch).
   Static scenery is merged per material into a few big meshes so the whole town draws in a
   handful of calls. Geometry pushed into a Batch is transformed to world space, flattened
   (non-indexed) and, for "world UV" materials, re-projected so texel density is the same on
   every wall/floor (box projection by face normal). Classic script: attaches to window.KQ. */
(function (KQ) {
  "use strict";
  const P = (KQ.WorldParts = KQ.WorldParts || {});
  // Linear colour pipeline (docs/LEARNINGS.md 2026-11-21): hex colours are sRGB and get linearised.
  THREE.ColorManagement.legacyMode = false;
  if (KQ.CAN_FETCH === undefined) KQ.CAN_FETCH = location.protocol !== "file:";
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpE = new THREE.Euler();
  const tmpV = new THREE.Vector3();
  const tmpC = new THREE.Color();

  /** Box-project a world position to UVs, by the dominant axis of the face normal. */
  function worldUV(px, py, pz, nx, ny, nz, scale, out) {
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);
    if (ay >= ax && ay >= az) {
      out[0] = px / scale;
      out[1] = -pz / scale;
    } else if (ax >= az) {
      out[0] = (nx > 0 ? -pz : pz) / scale;
      out[1] = py / scale;
    } else {
      out[0] = (nz > 0 ? px : -px) / scale;
      out[1] = py / scale;
    }
    return out;
  }

  /** Compose a matrix from position, Y-rotation (or full Euler array) and scale. */
  function compose(x, y, z, rot, sx, sy, sz) {
    if (Array.isArray(rot)) tmpE.set(rot[0], rot[1], rot[2]);
    else tmpE.set(0, rot || 0, 0);
    tmpQ.setFromEuler(tmpE);
    return tmpM.compose(tmpV.set(x, y, z), tmpQ, new THREE.Vector3(sx, sy, sz));
  }

  /** Per-material vertex buckets (`prims` remembers each primitive's slice and XZ footprint). */
  function Bucket() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.prims = [];
  }

  /** Record where a primitive's vertices start and its XZ centre / longest side (for chunking). */
  function noteFootprint(bucket, p, first) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      x0 = Math.min(x0, p[i]);
      x1 = Math.max(x1, p[i]);
      z0 = Math.min(z0, p[i + 2]);
      z1 = Math.max(z1, p[i + 2]);
    }
    bucket.prims.push({
      first,
      count: p.length / 3,
      cx: (x0 + x1) / 2,
      cz: (z0 + z1) / 2,
      ext: Math.max(x1 - x0, z1 - z0),
    });
  }

  /** Append a transformed geometry's triangles into a bucket. */
  function appendGeo(bucket, geo, matrix, color, uvScale) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const uv = g.attributes.uv ? g.attributes.uv.array : null;
    const c = tmpC.set(color === undefined ? 0xffffff : color);
    const out = [0, 0];
    const first = bucket.pos.length / 3;
    noteFootprint(bucket, p, first);
    for (let i = 0, v = 0; i < p.length; i += 3, v += 2) {
      bucket.pos.push(p[i], p[i + 1], p[i + 2]);
      bucket.nor.push(n[i], n[i + 1], n[i + 2]);
      if (uvScale) worldUV(p[i], p[i + 1], p[i + 2], n[i], n[i + 1], n[i + 2], uvScale, out);
      else if (uv) (out[0] = uv[v]), (out[1] = uv[v + 1]);
      bucket.uv.push(out[0], out[1]);
      bucket.col.push(c.r, c.g, c.b);
    }
    g.dispose();
  }

  /** Geometry cache so repeated primitives are only built once. */
  const geoCache = new Map();
  function cached(key, make) {
    if (!geoCache.has(key)) geoCache.set(key, make());
    return geoCache.get(key);
  }
  const unitBox = () => cached("box", () => new THREE.BoxGeometry(1, 1, 1));
  const unitPlane = () => cached("plane", () => new THREE.PlaneGeometry(1, 1));
  const cyl = (seg) => cached("cyl" + seg, () => new THREE.CylinderGeometry(0.5, 0.5, 1, seg));

  /** Walkable surface materials: low wide boxes of these keys are recorded as floors. */
  const FLOOR_KEYS = new Set([
    "paving",
    "tiles",
    "terrazzo",
    "wetTiles",
    "marble",
    "asphalt",
    "grass",
    "rubber",
    "concrete",
  ]);

  /**
   * A merge builder. `uvScales[key]` (metres per texture repeat) switches a material to world
   * UVs; keys without a scale keep the primitive's own UVs (signs, windows).
   */
  function Batch(uvScales, chunk) {
    this.buckets = new Map();
    this.uvScales = uvScales || {};
    this.chunk = chunk || null;
  }
  Batch.prototype.bucket = function (key) {
    if (!this.buckets.has(key)) this.buckets.set(key, new Bucket());
    return this.buckets.get(key);
  };
  /** Add any geometry with a ready matrix. */
  Batch.prototype.geo = function (key, geo, matrix, color) {
    appendGeo(this.bucket(key), geo, matrix, color, this.uvScales[key]);
  };
  /** Axis-aligned (or Y-rotated) box by centre and size. */
  Batch.prototype.box = function (key, x, y, z, sx, sy, sz, color, rot) {
    this.geo(key, unitBox(), compose(x, y, z, rot, sx, sy, sz), color);
  };
  /** Box by min/max corners (axis-aligned). */
  Batch.prototype.aabb = function (key, x0, y0, z0, x1, y1, z1, color) {
    this.box(key, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color);
    if (this.floors && FLOOR_KEYS.has(key) && y1 <= 0.31 && (x1 - x0) * (z1 - z0) > 0.5) {
      this.floors.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, y: y1 });
    }
  };
  /** Vertical cylinder. */
  Batch.prototype.cyl = function (key, x, y, z, r, h, seg, color) {
    this.geo(key, cyl(seg || 12), compose(x, y, z, 0, r * 2, h, r * 2), color);
  };
  /** A plane facing +Z after `rot`; uv rect [u0,v0,u1,v1] remaps the plane's UVs. */
  Batch.prototype.plane = function (key, x, y, z, w, h, rot, uvRect, color) {
    const g = uvRect ? rectPlane(uvRect) : unitPlane();
    this.geo(key, g, compose(x, y, z, rot, w, h, 1), color);
    if (uvRect) g.dispose();
  };

  /** A flat ground decal (w along X before `yaw`, d along Z) lying at height y. */
  Batch.prototype.decal = function (key, x, y, z, w, d, yaw, color) {
    this.plane(
      key,
      x,
      y,
      z,
      w,
      d,
      [-Math.PI / 2, 0, yaw || 0],
      null,
      color === undefined ? 0xffffff : color,
    );
  };

  /** A unit plane whose UVs cover only `r` = [u0, v0, u1, v1] of an atlas. */
  function rectPlane(r) {
    const g = new THREE.PlaneGeometry(1, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1]));
    }
    return g;
  }

  /** Group a heavy bucket's primitives into square ground cells (big slabs share one "L" cell). */
  function chunkPrims(bucket, chunk) {
    const cells = new Map();
    bucket.prims.forEach((pr) => {
      const key =
        pr.ext > chunk.cell * 0.9
          ? "L"
          : Math.floor(pr.cx / chunk.cell) + "," + Math.floor(pr.cz / chunk.cell);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(pr);
    });
    return cells;
  }

  /** The bucket's vertex arrays restricted to the given primitives. */
  function slice(bucket, prims) {
    const out = new Bucket();
    prims.forEach((pr) => {
      const a = pr.first;
      const b = pr.first + pr.count;
      ["pos", "nor", "col"].forEach((k) => (out[k] = out[k].concat(bucket[k].slice(a * 3, b * 3))));
      out.uv = out.uv.concat(bucket.uv.slice(a * 2, b * 2));
    });
    return out;
  }

  /** One Mesh from a bucket's arrays. */
  function meshFrom(b, mat, name) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = name;
    mesh.castShadow = mat.userData.cast !== false;
    mesh.receiveShadow = mat.userData.receive !== false;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  /**
   * Turn every bucket into a Mesh using `materials[key]`; returns the meshes. With a `chunk`
   * ({ cell, minTris }) a bucket heavier than `minTris` triangles is split into cell-sized
   * meshes so frustum and shadow culling can reject the parts that are off screen; light buckets
   * stay one draw call.
   */
  Batch.prototype.build = function (materials, group) {
    const meshes = [];
    this.buckets.forEach((b, key) => {
      const mat = materials[key];
      if (!mat || !b.pos.length) return;
      const heavy = this.chunk && b.pos.length / 9 > this.chunk.minTris;
      const parts = heavy
        ? Array.from(chunkPrims(b, this.chunk), ([cell, prims]) => [cell, slice(b, prims)])
        : [[null, b]];
      parts.forEach(([cell, part]) => {
        meshes.push(meshFrom(part, mat, "batch:" + key + (cell === null ? "" : "@" + cell)));
      });
    });
    if (group) meshes.forEach((m) => group.add(m));
    this.buckets.clear();
    return meshes;
  };

  /** Seeded PRNG (mulberry32) so the town is identical on every load. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** An InstancedMesh from a list of {x,y,z,ry,sx,sy,sz,color}. */
  function instanced(geo, mat, list, opts) {
    if (mat.vertexColors && !geo.attributes.color) {
      const n = geo.attributes.position.count;
      geo.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3),
      );
    }
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach((t, i) => {
      im.setMatrixAt(
        i,
        compose(
          t.x,
          t.y,
          t.z,
          t.rot !== undefined ? t.rot : t.ry || 0,
          t.sx || 1,
          t.sy || 1,
          t.sz || 1,
        ),
      );
      if (t.color !== undefined) im.setColorAt(i, tmpC.set(t.color));
    });
    im.count = list.length;
    im.userData.fullCount = list.length;
    im.castShadow = !opts || opts.cast !== false;
    im.receiveShadow = !opts || opts.receive !== false;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    return im;
  }

  /** Push an XZ collider box. */
  P.collide = (list, minX, maxX, minZ, maxZ, kind) => list.push({ minX, maxX, minZ, maxZ, kind });

  P.worldUV = worldUV;
  P.compose = compose;
  P.Batch = Batch;
  P.rng = rng;
  P.instanced = instanced;
  P.rectPlane = rectPlane;
  P.cached = cached;
})((window.KQ = window.KQ || {}));
