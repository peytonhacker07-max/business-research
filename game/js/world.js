/* Island generation: terrain, collision, POIs, harvestable props, loot spawns. */
(function () {
  'use strict';

  var HALF = 220;          // island extends -HALF..HALF on X and Z
  var WATER_Y = 1.2;
  var AMPLITUDE = 26;

  /* ---------------------------------------------------------------------
     Collider registry - axis-aligned boxes in a uniform spatial hash.
     Everything solid (terrain props, buildings, player-built pieces) lives
     here, so movement and bullets share one source of truth.
  --------------------------------------------------------------------- */
  var CELL = 10;
  var grid = new Map();

  function key(cx, cz) { return cx * 8192 + cz; }

  var Colliders = {
    add: function (rec) {
      var cx0 = Math.floor(rec.x0 / CELL), cx1 = Math.floor(rec.x1 / CELL);
      var cz0 = Math.floor(rec.z0 / CELL), cz1 = Math.floor(rec.z1 / CELL);
      rec._cells = [];
      for (var cx = cx0; cx <= cx1; cx++) {
        for (var cz = cz0; cz <= cz1; cz++) {
          var k = key(cx, cz);
          var arr = grid.get(k);
          if (!arr) { arr = []; grid.set(k, arr); }
          arr.push(rec);
          rec._cells.push(k);
        }
      }
      return rec;
    },

    remove: function (rec) {
      if (!rec._cells) return;
      for (var i = 0; i < rec._cells.length; i++) {
        var arr = grid.get(rec._cells[i]);
        if (!arr) continue;
        var idx = arr.indexOf(rec);
        if (idx >= 0) arr.splice(idx, 1);
      }
      rec._cells = null;
    },

    /* Boxes touching the XZ square around a point. */
    query: function (x, z, radius, out) {
      out.length = 0;
      var cx0 = Math.floor((x - radius) / CELL), cx1 = Math.floor((x + radius) / CELL);
      var cz0 = Math.floor((z - radius) / CELL), cz1 = Math.floor((z + radius) / CELL);
      for (var cx = cx0; cx <= cx1; cx++) {
        for (var cz = cz0; cz <= cz1; cz++) {
          var arr = grid.get(key(cx, cz));
          if (!arr) continue;
          for (var i = 0; i < arr.length; i++) if (out.indexOf(arr[i]) < 0) out.push(arr[i]);
        }
      }
      return out;
    },

    clear: function () { grid.clear(); }
  };

  function box(x0, y0, z0, x1, y1, z1, ref) {
    return { x0: x0, y0: y0, z0: z0, x1: x1, y1: y1, z1: z1, ref: ref || null };
  }

  /* ---------------------------------------------------------------------
     Axis-aligned box batcher - merges many boxes into one geometry with
     world-scaled UVs so textures tile at a consistent size.
  --------------------------------------------------------------------- */
  function BoxBatch(uvScale) {
    this.pos = []; this.nor = []; this.uv = [];
    this.uvScale = uvScale || 2.5;
  }

  var FACES = [
    /* normal, u axis, v axis, sign along normal */
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], a: 0 },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], a: 0 },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], a: 1 },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1], a: 1 },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], a: 2 },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], a: 2 }
  ];

  BoxBatch.prototype.add = function (cx, cy, cz, w, h, d, matrix) {
    var hw = w / 2, hh = h / 2, hd = d / 2;
    var s = this.uvScale;
    var nm = null;
    if (matrix) { nm = new THREE.Matrix3().getNormalMatrix(matrix); }
    var vtmp = new THREE.Vector3();

    for (var f = 0; f < 6; f++) {
      var F = FACES[f];
      var uLen = Math.abs(F.u[0]) * w + Math.abs(F.u[1]) * h + Math.abs(F.u[2]) * d;
      var vLen = Math.abs(F.v[0]) * w + Math.abs(F.v[1]) * h + Math.abs(F.v[2]) * d;
      var origin = [F.n[0] * hw, F.n[1] * hh, F.n[2] * hd];

      var corners = [
        [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5],
        [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]
      ];
      for (var c = 0; c < 6; c++) {
        var cu = corners[c][0], cv = corners[c][1];
        var px = origin[0] + F.u[0] * cu * uLen + F.v[0] * cv * vLen;
        var py = origin[1] + F.u[1] * cu * uLen + F.v[1] * cv * vLen;
        var pz = origin[2] + F.u[2] * cu * uLen + F.v[2] * cv * vLen;
        vtmp.set(px + cx, py + cy, pz + cz);
        if (matrix) vtmp.applyMatrix4(matrix);
        this.pos.push(vtmp.x, vtmp.y, vtmp.z);

        if (nm) {
          vtmp.set(F.n[0], F.n[1], F.n[2]).applyMatrix3(nm).normalize();
          this.nor.push(vtmp.x, vtmp.y, vtmp.z);
        } else {
          this.nor.push(F.n[0], F.n[1], F.n[2]);
        }
        this.uv.push((cu + 0.5) * uLen / s, (cv + 0.5) * vLen / s);
      }
    }
    return this;
  };

  BoxBatch.prototype.isEmpty = function () { return this.pos.length === 0; };

  BoxBatch.prototype.geometry = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  };

  /* ------------------------------------------------------------------ */

  var World = {
    HALF: HALF,
    WATER_Y: WATER_Y,
    Colliders: Colliders,
    box: box,
    BoxBatch: BoxBatch,
    pois: [],
    props: [],          // harvestable trees / rocks / cars
    chests: [],
    hittables: [],      // meshes bullets can hit
    group: null,
    seed: 1337
  };

  var poiFlat = [];

  function baseHeight(x, z) {
    var n = U.fbm(x * 0.0055, z * 0.0055, World.seed, 5, 2.1, 0.5);
    var ridge = Math.abs(U.fbm(x * 0.013, z * 0.013, World.seed + 77, 3) - 0.5) * 2;
    var h = (n - 0.42) * AMPLITUDE + (1 - ridge) * 5.5;

    /* Island falloff: land in the middle, beach then water at the rim. */
    var d = Math.max(Math.abs(x), Math.abs(z)) / HALF;
    var r = Math.sqrt(x * x + z * z) / HALF;
    var edge = Math.max(d, r * 0.92);
    var fall = 1 - U.smoothstep(U.clamp((edge - 0.72) / 0.28, 0, 1));
    return h * fall + (fall - 1) * 6 + 3.5;
  }

  World.heightAt = function (x, z) {
    var h = baseHeight(x, z);
    for (var i = 0; i < poiFlat.length; i++) {
      var p = poiFlat[i];
      var dx = x - p.x, dz = z - p.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var blend = 1 - U.clamp((dist - p.r) / p.falloff, 0, 1);
      if (blend > 0) h = U.lerp(h, p.y, U.smoothstep(blend));
    }
    return h;
  };

  /* Highest walkable surface under `y` at (x,z): terrain, floors, roofs. */
  var qbuf = [];
  World.supportAt = function (x, z, y, step) {
    var best = World.heightAt(x, z);
    var ref = null;
    /* You float chest-deep instead of walking the sea floor. */
    if (best < WATER_Y - 1.0) { best = WATER_Y - 1.0; ref = { water: true }; }
    Colliders.query(x, z, 1.2, qbuf);
    for (var i = 0; i < qbuf.length; i++) {
      var b = qbuf[i];
      if (x < b.x0 - 0.35 || x > b.x1 + 0.35 || z < b.z0 - 0.35 || z > b.z1 + 0.35) continue;
      if (b.y1 <= y + (step === undefined ? 0.65 : step) && b.y1 > best) { best = b.y1; ref = b.ref; }
    }
    return { y: best, ref: ref };
  };

  /* Push a vertical capsule out of any wall it overlaps. */
  World.resolveLateral = function (pos, radius, height, feetY) {
    Colliders.query(pos.x, pos.z, radius + 1.0, qbuf);
    var lowY = feetY + 0.45, highY = feetY + height - 0.15;
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < qbuf.length; i++) {
        var b = qbuf[i];
        if (b.y1 <= lowY || b.y0 >= highY) continue;
        var cx = U.clamp(pos.x, b.x0, b.x1);
        var cz = U.clamp(pos.z, b.z0, b.z1);
        var dx = pos.x - cx, dz = pos.z - cz;
        var d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;

        if (d2 > 1e-6) {
          var d = Math.sqrt(d2);
          pos.x += (dx / d) * (radius - d);
          pos.z += (dz / d) * (radius - d);
        } else {
          /* centre is inside the box - eject along the shallowest axis */
          var pxp = b.x1 - pos.x + radius, pxn = pos.x - b.x0 + radius;
          var pzp = b.z1 - pos.z + radius, pzn = pos.z - b.z0 + radius;
          var m = Math.min(pxp, pxn, pzp, pzn);
          if (m === pxp) pos.x = b.x1 + radius;
          else if (m === pxn) pos.x = b.x0 - radius;
          else if (m === pzp) pos.z = b.z1 + radius;
          else pos.z = b.z0 - radius;
        }
      }
    }
  };

  /* Fast line-of-sight against the AABB registry plus the terrain surface.
     Three.js raycasting has to walk ~1500 instanced props triangle by triangle;
     this walks a handful of hash cells instead, so bots can afford to call it. */
  var EPS = 1e-6;
  function slabHit(ox, oy, oz, idx, idy, idz, b, maxT) {
    var t1 = (b.x0 - ox) * idx, t2 = (b.x1 - ox) * idx;
    var tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
    t1 = (b.y0 - oy) * idy; t2 = (b.y1 - oy) * idy;
    tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    t1 = (b.z0 - oz) * idz; t2 = (b.z1 - oz) * idz;
    tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    return tmax >= Math.max(tmin, 0) && tmin <= maxT;
  }

  /* Nearest AABB entry distance along a ray, or maxDist if nothing is hit.
     Used by the camera, so it must stay cheap enough to run every frame. */
  var seenCells2 = [];
  World.rayDistance = function (ox, oy, oz, dx, dy, dz, maxDist) {
    var idx = 1 / (Math.abs(dx) < EPS ? (dx < 0 ? -EPS : EPS) : dx);
    var idy = 1 / (Math.abs(dy) < EPS ? (dy < 0 ? -EPS : EPS) : dy);
    var idz = 1 / (Math.abs(dz) < EPS ? (dz < 0 ? -EPS : EPS) : dz);
    var best = maxDist;

    seenCells2.length = 0;
    var steps = Math.min(24, Math.max(2, Math.ceil(maxDist / (CELL * 0.5))));
    for (var c = 0; c <= steps; c++) {
      var ct = (c / steps) * maxDist;
      var cx = Math.floor((ox + dx * ct) / CELL);
      var cz = Math.floor((oz + dz * ct) / CELL);
      for (var ax = -1; ax <= 1; ax++) {
        for (var az = -1; az <= 1; az++) {
          var k = key(cx + ax, cz + az);
          if (seenCells2.indexOf(k) >= 0) continue;
          seenCells2.push(k);
          var arr = grid.get(k);
          if (!arr) continue;
          for (var i = 0; i < arr.length; i++) {
            var b = arr[i];
            var t1 = (b.x0 - ox) * idx, t2 = (b.x1 - ox) * idx;
            var tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
            t1 = (b.y0 - oy) * idy; t2 = (b.y1 - oy) * idy;
            tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
            t1 = (b.z0 - oz) * idz; t2 = (b.z1 - oz) * idz;
            tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
            if (tmax >= Math.max(tmin, 0) && tmin < best) best = Math.max(0, tmin);
          }
        }
      }
    }
    return best;
  };

  var seenCells = [];
  World.rayBlocked = function (ox, oy, oz, tx, ty, tz) {
    var dx = tx - ox, dy = ty - oy, dz = tz - oz;
    var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.01) return false;
    dx /= dist; dy /= dist; dz /= dist;

    /* Terrain: if the ray dips under the surface anywhere, it's blocked. */
    var steps = Math.min(48, Math.max(4, Math.ceil(dist / 2.5)));
    for (var s = 1; s < steps; s++) {
      var t = (s / steps) * dist;
      var px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
      if (py < World.heightAt(px, pz)) return true;
    }

    var idx = 1 / (Math.abs(dx) < EPS ? (dx < 0 ? -EPS : EPS) : dx);
    var idy = 1 / (Math.abs(dy) < EPS ? (dy < 0 ? -EPS : EPS) : dy);
    var idz = 1 / (Math.abs(dz) < EPS ? (dz < 0 ? -EPS : EPS) : dz);

    seenCells.length = 0;
    var cellSteps = Math.min(96, Math.max(2, Math.ceil(dist / (CELL * 0.5))));
    for (var c = 0; c <= cellSteps; c++) {
      var ct = (c / cellSteps) * dist;
      var cx = Math.floor((ox + dx * ct) / CELL);
      var cz = Math.floor((oz + dz * ct) / CELL);
      /* Cover the 3x3 neighbourhood so boxes straddling a border aren't missed. */
      for (var ax = -1; ax <= 1; ax++) {
        for (var az = -1; az <= 1; az++) {
          var k = key(cx + ax, cz + az);
          if (seenCells.indexOf(k) >= 0) continue;
          seenCells.push(k);
          var arr = grid.get(k);
          if (!arr) continue;
          for (var i = 0; i < arr.length; i++) {
            if (slabHit(ox, oy, oz, idx, idy, idz, arr[i], dist)) return true;
          }
        }
      }
    }
    return false;
  };

  /* Ceiling check so you can't jump through a floor above you. */
  World.ceilingAt = function (x, z, y) {
    Colliders.query(x, z, 0.9, qbuf);
    var best = Infinity;
    for (var i = 0; i < qbuf.length; i++) {
      var b = qbuf[i];
      if (x < b.x0 - 0.3 || x > b.x1 + 0.3 || z < b.z0 - 0.3 || z > b.z1 + 0.3) continue;
      if (b.y0 >= y && b.y0 < best) best = b.y0;
    }
    return best;
  };

  /* ------------------------------------------------------------------ */

  var MATS = {};

  function stdMat(map, opts) {
    opts = opts || {};
    var m = new THREE.MeshStandardMaterial({
      map: map || null,
      color: opts.color === undefined ? 0xffffff : opts.color,
      roughness: opts.roughness === undefined ? 0.9 : opts.roughness,
      metalness: opts.metalness === undefined ? 0.0 : opts.metalness,
      flatShading: !!opts.flat
    });
    if (opts.side) m.side = opts.side;
    return m;
  }

  World.materials = MATS;

  /* ------------------------------------------------------------------ */

  var POI_NAMES = [
    'Copper Landing', 'Pine Hollow', 'Saltwind Docks', 'Ridgeback Mill',
    'Neon Junction', 'Quarry Gate', 'Fernwood Farm', 'Beacon Point'
  ];

  function makeTerrain(scene) {
    var SEG = 160;
    var geo = new THREE.PlaneGeometry(HALF * 2, HALF * 2, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = new Float32Array(pos.count * 3);

    var cGrass = new THREE.Color(0x6da344);
    var cGrassDark = new THREE.Color(0x4a7a33);
    var cRock = new THREE.Color(0x8b8f94);
    var cSand = new THREE.Color(0xd9c692);
    var tmp = new THREE.Color();

    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      var y = World.heightAt(x, z);
      pos.setY(i, y);

      /* Slope drives the rock blend; low ground turns to sand near water. */
      var e = 1.6;
      var hx = World.heightAt(x + e, z) - World.heightAt(x - e, z);
      var hz = World.heightAt(x, z + e) - World.heightAt(x, z - e);
      var slope = Math.sqrt(hx * hx + hz * hz) / (2 * e);

      var variation = U.fbm(x * 0.02, z * 0.02, World.seed + 501, 2);
      tmp.copy(cGrass).lerp(cGrassDark, variation);
      tmp.lerp(cRock, U.clamp((slope - 0.55) * 1.5, 0, 1));
      tmp.lerp(cSand, U.clamp((WATER_Y + 2.6 - y) / 3.2, 0, 1));

      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    var map = Tex.grass();
    map.repeat.set(120, 120);
    var mat = new THREE.MeshStandardMaterial({
      map: map, vertexColors: true, roughness: 0.96, metalness: 0.0
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    mesh.userData.terrain = true;
    scene.add(mesh);
    World.hittables.push(mesh);
    World.terrain = mesh;
  }

  function makeWater(scene) {
    var geo = new THREE.PlaneGeometry(HALF * 4, HALF * 4, 1, 1);
    geo.rotateX(-Math.PI / 2);
    var mat = new THREE.MeshStandardMaterial({
      color: 0x2f7fb8, transparent: true, opacity: 0.78,
      roughness: 0.18, metalness: 0.25
    });
    var m = new THREE.Mesh(geo, mat);
    m.position.y = WATER_Y;
    m.renderOrder = 1;
    scene.add(m);
    World.water = m;
  }

  function makeSky(scene) {
    var geo = new THREE.SphereGeometry(950, 32, 20);
    var mat = new THREE.MeshBasicMaterial({
      map: Tex.skyGradient(), side: THREE.BackSide, fog: false, depthWrite: false
    });
    var dome = new THREE.Mesh(geo, mat);
    dome.renderOrder = -1000;
    scene.add(dome);
    World.skyDome = dome;

    /* Sun disc + drifting cloud banks. */
    var sunMat = new THREE.SpriteMaterial({
      map: Tex.puff(), color: 0xfff3c4, transparent: true, opacity: 0.95,
      depthWrite: false, fog: false, blending: THREE.AdditiveBlending
    });
    var sun = new THREE.Sprite(sunMat);
    sun.scale.set(160, 160, 1);
    sun.position.set(-420, 460, -640);
    sun.renderOrder = -999;
    scene.add(sun);

    var clouds = new THREE.Group();
    var rand = U.rng(World.seed + 909);
    var cloudMat = new THREE.SpriteMaterial({
      map: Tex.puff(), color: 0xffffff, transparent: true, opacity: 0.5,
      depthWrite: false, fog: false
    });
    for (var i = 0; i < 46; i++) {
      var s = new THREE.Sprite(cloudMat);
      var a = rand() * Math.PI * 2, r = 220 + rand() * 620;
      s.position.set(Math.cos(a) * r, 150 + rand() * 150, Math.sin(a) * r);
      var sc = 90 + rand() * 190;
      s.scale.set(sc, sc * (0.4 + rand() * 0.25), 1);
      clouds.add(s);
    }
    clouds.renderOrder = -998;
    scene.add(clouds);
    World.clouds = clouds;
  }

  /* --------------------------- trees & rocks ------------------------- */

  function makeProps(scene, rand) {
    var TREES = 620, ROCKS = 240;
    var treeData = [], rockData = [];

    function ok(x, z) {
      var y = World.heightAt(x, z);
      if (y < WATER_Y + 1.6) return false;
      for (var i = 0; i < World.pois.length; i++) {
        var p = World.pois[i];
        var dx = x - p.x, dz = z - p.z;
        if (dx * dx + dz * dz < (p.radius + 4) * (p.radius + 4)) return false;
      }
      return true;
    }

    var guard = 0;
    while (treeData.length < TREES && guard++ < TREES * 12) {
      var x = (rand() * 2 - 1) * (HALF - 14), z = (rand() * 2 - 1) * (HALF - 14);
      /* clumps: bias toward forest bands */
      if (U.fbm(x * 0.012, z * 0.012, World.seed + 33, 3) < 0.44) continue;
      if (!ok(x, z)) continue;
      treeData.push({ x: x, z: z, y: World.heightAt(x, z), s: 0.8 + rand() * 0.75, r: rand() * Math.PI * 2 });
    }
    guard = 0;
    while (rockData.length < ROCKS && guard++ < ROCKS * 12) {
      var rx = (rand() * 2 - 1) * (HALF - 10), rz = (rand() * 2 - 1) * (HALF - 10);
      if (!ok(rx, rz)) continue;
      rockData.push({ x: rx, z: rz, y: World.heightAt(rx, rz), s: 0.7 + rand() * 1.1, r: rand() * Math.PI * 2 });
    }

    var dummy = new THREE.Object3D();

    /* Trunks */
    var trunkGeo = new THREE.CylinderGeometry(0.34, 0.52, 5.2, 7, 1);
    trunkGeo.translate(0, 2.6, 0);
    var trunkMat = stdMat(Tex.wood(), { color: 0x9c7146, roughness: 0.95, flat: true });
    trunkMat.map.repeat.set(1, 2);
    var trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeData.length);
    trunks.castShadow = true; trunks.receiveShadow = true;

    /* Canopy: three stacked cones read as a stylized pine at any distance. */
    var canopyGeo = mergeCones();
    var canopyMat = stdMat(null, { color: 0x4e9440, roughness: 0.92, flat: true });
    var canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeData.length);
    canopies.castShadow = true;

    /* instanceId -> prop record, so bullets and the pickaxe can find what they hit */
    var trunkProps = [];
    trunks.userData.props = trunkProps;
    trunks.userData.propKind = 'tree';
    canopies.userData.props = trunkProps;
    canopies.userData.propKind = 'tree';

    for (var i = 0; i < treeData.length; i++) {
      var t = treeData[i];
      dummy.position.set(t.x, t.y - 0.3, t.z);
      dummy.rotation.set(0, t.r, 0);
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      canopies.setMatrixAt(i, dummy.matrix);
      Colliders.add(box(t.x - 0.5 * t.s, t.y - 0.3, t.z - 0.5 * t.s,
        t.x + 0.5 * t.s, t.y + 4.6 * t.s, t.z + 0.5 * t.s, { prop: World.props.length }));
      var treeProp = {
        kind: 'tree', mat: 'wood', hp: 100, maxHp: 100, index: i,
        x: t.x, y: t.y, z: t.z, s: t.s, mesh: trunks, mesh2: canopies, alive: true
      };
      World.props.push(treeProp);
      trunkProps[i] = treeProp;
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    scene.add(trunks); scene.add(canopies);
    World.hittables.push(trunks, canopies);
    World.treeMeshes = [trunks, canopies];
    /* Instanced props are far too costly to probe every frame - the camera
       uses the cheaper list and tolerates the odd branch clipping the lens. */
    World.camHittables = World.hittables.filter(function (m) {
      return m !== trunks && m !== canopies;
    });

    /* Rocks */
    var rockGeo = new THREE.IcosahedronGeometry(1.35, 0);
    rockGeo.scale(1, 0.75, 1);
    rockGeo.translate(0, 0.62, 0);
    var rockMat = stdMat(Tex.rock(), { color: 0xa8adb4, roughness: 0.95, flat: true });
    var rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockData.length);
    rocks.castShadow = true; rocks.receiveShadow = true;
    var rockProps = [];
    rocks.userData.props = rockProps;
    rocks.userData.propKind = 'rock';
    for (var j = 0; j < rockData.length; j++) {
      var rk = rockData[j];
      dummy.position.set(rk.x, rk.y - 0.2, rk.z);
      dummy.rotation.set(0, rk.r, 0);
      dummy.scale.set(rk.s, rk.s * (0.7 + Math.random() * 0.5), rk.s);
      dummy.updateMatrix();
      rocks.setMatrixAt(j, dummy.matrix);
      Colliders.add(box(rk.x - 1.2 * rk.s, rk.y - 0.2, rk.z - 1.2 * rk.s,
        rk.x + 1.2 * rk.s, rk.y + 1.2 * rk.s, rk.z + 1.2 * rk.s, { prop: World.props.length }));
      var rockProp = {
        kind: 'rock', mat: 'brick', hp: 140, maxHp: 140, index: j,
        x: rk.x, y: rk.y, z: rk.z, s: rk.s, mesh: rocks, mesh2: null, alive: true
      };
      World.props.push(rockProp);
      rockProps[j] = rockProp;
    }
    rocks.instanceMatrix.needsUpdate = true;
    scene.add(rocks);
    World.hittables.push(rocks);
    World.rockMesh = rocks;
  }

  function mergeCones() {
    var b = new BoxBatch(2);
    /* Built from cones rather than boxes, so assemble manually. */
    var geos = [];
    var specs = [[3.1, 3.4, 4.6], [2.5, 3.0, 6.4], [1.7, 2.6, 8.0]];
    var pos = [], nor = [];
    for (var i = 0; i < specs.length; i++) {
      var g = new THREE.ConeGeometry(specs[i][0], specs[i][1], 8, 1);
      g.translate(0, specs[i][2], 0);
      var gp = g.attributes.position.array, gn = g.attributes.normal.array;
      var idx = g.index ? g.index.array : null;
      if (idx) {
        for (var k = 0; k < idx.length; k++) {
          pos.push(gp[idx[k] * 3], gp[idx[k] * 3 + 1], gp[idx[k] * 3 + 2]);
          nor.push(gn[idx[k] * 3], gn[idx[k] * 3 + 1], gn[idx[k] * 3 + 2]);
        }
      } else {
        for (var m = 0; m < gp.length; m++) { pos.push(gp[m]); }
        for (var n = 0; n < gn.length; n++) { nor.push(gn[n]); }
      }
      geos.push(g);
    }
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.computeBoundingSphere();
    return out;
  }

  /* Knock an instanced prop out of the world. */
  World.destroyProp = function (prop) {
    if (!prop.alive) return;
    prop.alive = false;
    if (prop.isSingle) {
      prop.mesh.visible = false;
    } else {
      var m = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
      m.setPosition(prop.x, -500, prop.z);
      prop.mesh.setMatrixAt(prop.index, m);
      prop.mesh.instanceMatrix.needsUpdate = true;
      if (prop.mesh2) {
        prop.mesh2.setMatrixAt(prop.index, m);
        prop.mesh2.instanceMatrix.needsUpdate = true;
      }
    }
    /* drop its collider */
    Colliders.query(prop.x, prop.z, 3, qbuf);
    for (var i = 0; i < qbuf.length; i++) {
      if (qbuf[i].ref && qbuf[i].ref.prop !== undefined && World.props[qbuf[i].ref.prop] === prop) {
        Colliders.remove(qbuf[i]);
        break;
      }
    }
  };

  /* ---------------------------- structures --------------------------- */

  function addWallRun(batch, ax, az, bx, bz, baseY, height, thick, opening) {
    var alongX = Math.abs(bx - ax) > Math.abs(bz - az);
    var len = alongX ? Math.abs(bx - ax) : Math.abs(bz - az);
    var mx = (ax + bx) / 2, mz = (az + bz) / 2;
    var out = [];

    function seg(offset, segLen, y0, y1) {
      if (segLen <= 0.05 || y1 - y0 <= 0.05) return;
      var cx = alongX ? Math.min(ax, bx) + offset + segLen / 2 : mx;
      var cz = alongX ? mz : Math.min(az, bz) + offset + segLen / 2;
      var w = alongX ? segLen : thick;
      var d = alongX ? thick : segLen;
      batch.add(cx, (y0 + y1) / 2, cz, w, y1 - y0, d);
      out.push(box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y1, cz + d / 2));
    }

    if (!opening) {
      seg(0, len, baseY, baseY + height);
    } else if (opening.type === 'door') {
      var dw = 1.5, dh = Math.min(2.3, height - 0.35);
      var dstart = U.clamp(len * opening.at - dw / 2, 0.4, len - dw - 0.4);
      seg(0, dstart, baseY, baseY + height);
      seg(dstart + dw, len - dstart - dw, baseY, baseY + height);
      seg(dstart, dw, baseY + dh, baseY + height);
    } else {
      var ww = 1.7, wy0 = baseY + 1.05, wy1 = Math.min(baseY + 2.2, baseY + height - 0.3);
      var wstart = U.clamp(len * opening.at - ww / 2, 0.4, len - ww - 0.4);
      seg(0, wstart, baseY, baseY + height);
      seg(wstart + ww, len - wstart - ww, baseY, baseY + height);
      seg(wstart, ww, baseY, wy0);
      seg(wstart, ww, wy1, baseY + height);
    }
    return out;
  }

  var FLOOR_H = 3.2;

  function makeBuilding(rand, cx, cz, groundY, theme, lootSpots) {
    var w = 8 + Math.floor(rand() * 4) * 2;
    var d = 8 + Math.floor(rand() * 4) * 2;
    var floors = 1 + (rand() < 0.55 ? 1 : 0) + (rand() < 0.2 ? 1 : 0);
    var wallB = new BoxBatch(2.6);
    var floorB = new BoxBatch(2.6);
    var roofB = new BoxBatch(2.6);
    var boxes = [];

    var x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    var yBase = groundY - 0.25;

    /* slab */
    floorB.add(cx, yBase + 0.15, cz, w + 0.6, 0.3, d + 0.6);
    boxes.push(box(x0 - 0.3, yBase, z0 - 0.3, x1 + 0.3, yBase + 0.3, z1 + 0.3));

    for (var f = 0; f < floors; f++) {
      var fy = yBase + 0.3 + f * FLOOR_H;
      var isGround = f === 0;

      var sides = [
        [x0, z0, x1, z0], [x0, z1, x1, z1],
        [x0, z0, x0, z1], [x1, z0, x1, z1]
      ];
      var doorSide = Math.floor(rand() * 4);
      for (var s = 0; s < 4; s++) {
        var opening = null;
        if (isGround && s === doorSide) opening = { type: 'door', at: 0.35 + rand() * 0.3 };
        else if (rand() < 0.72) opening = { type: 'window', at: 0.28 + rand() * 0.44 };
        var segs = addWallRun(wallB, sides[s][0], sides[s][1], sides[s][2], sides[s][3],
          fy, FLOOR_H, 0.32, opening);
        for (var q = 0; q < segs.length; q++) boxes.push(segs[q]);
      }

      /* ceiling of this floor = floor of the next, with a stair hole */
      var ceilY = fy + FLOOR_H;
      var holeW = 2.6, holeD = 2.6;
      var hx = x0 + 1.2 + rand() * Math.max(0.1, w - holeW - 2.4);
      var hz = z0 + 1.2 + rand() * Math.max(0.1, d - holeD - 2.4);
      var strips = [
        [x0, z0, x1, hz], [x0, hz + holeD, x1, z1],
        [x0, hz, hx, hz + holeD], [hx + holeW, hz, x1, hz + holeD]
      ];
      for (var t = 0; t < strips.length; t++) {
        var sx0 = strips[t][0], sz0 = strips[t][1], sx1 = strips[t][2], sz1 = strips[t][3];
        var sw = sx1 - sx0, sd = sz1 - sz0;
        if (sw <= 0.05 || sd <= 0.05) continue;
        var target = (f === floors - 1) ? roofB : floorB;
        target.add((sx0 + sx1) / 2, ceilY + 0.14, (sz0 + sz1) / 2, sw, 0.28, sd);
        boxes.push(box(sx0, ceilY, sz0, sx1, ceilY + 0.28, sz1));
      }

      /* ramp up through the hole so the interior is navigable */
      var steps = 8;
      for (var st = 0; st < steps; st++) {
        var sy = fy + 0.3 + (st + 1) * (FLOOR_H - 0.3) / steps;
        var sz = hz + holeD * (st / steps) - 0.1;
        floorB.add(hx + holeW / 2, sy - 0.12, sz + 0.2, holeW, 0.24, holeD / steps + 0.25);
        boxes.push(box(hx, sy - 0.24, sz, hx + holeW, sy, sz + holeD / steps + 0.4));
      }

      lootSpots.push({ x: cx + (rand() - 0.5) * (w - 3), y: fy + 0.3, z: cz + (rand() - 0.5) * (d - 3) });
    }

    /* parapet around the roof - cover for rooftop fights */
    var topY = yBase + 0.3 + floors * FLOOR_H + 0.28;
    var pSides = [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]];
    for (var p = 0; p < 4; p++) {
      var ps = addWallRun(roofB, pSides[p][0], pSides[p][1], pSides[p][2], pSides[p][3], topY, 1.0, 0.3, null);
      for (var pq = 0; pq < ps.length; pq++) boxes.push(ps[pq]);
    }
    lootSpots.push({ x: cx, y: topY, z: cz, roof: true });

    for (var b = 0; b < boxes.length; b++) Colliders.add(boxes[b]);

    return {
      meshes: [
        { batch: wallB, mat: theme.wall },
        { batch: floorB, mat: theme.floor },
        { batch: roofB, mat: theme.roof }
      ],
      bounds: { x0: x0, z0: z0, x1: x1, z1: z1, top: topY + 1 }
    };
  }

  function makePOIs(scene, rand) {
    var count = 6;
    var centers = [];
    for (var i = 0; i < count; i++) {
      var tries = 0, x, z;
      do {
        var a = (i / count) * Math.PI * 2 + rand() * 0.8;
        var r = 45 + rand() * (HALF - 95);
        x = Math.cos(a) * r; z = Math.sin(a) * r;
        tries++;
      } while (tries < 40 && centers.some(function (c) {
        return (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z) < 90 * 90;
      }));
      centers.push({ x: x, z: z });
    }

    /* Flatten the ground under each POI before anything is placed on it. */
    for (var c = 0; c < centers.length; c++) {
      var pc = centers[c];
      var radius = 26 + rand() * 12;
      var y = Math.max(WATER_Y + 3.2, baseHeight(pc.x, pc.z));
      poiFlat.push({ x: pc.x, z: pc.z, y: y, r: radius, falloff: 22 });
      World.pois.push({
        name: POI_NAMES[c % POI_NAMES.length], x: pc.x, z: pc.z, y: y, radius: radius
      });
    }

    var themes = [
      { wall: stdMat(Tex.wood(), { color: 0xd6b48a, roughness: 0.9 }), roof: stdMat(Tex.shingle(), { color: 0xffffff, roughness: 0.95 }), floor: stdMat(Tex.wood(), { color: 0xa9855e, roughness: 0.9 }) },
      { wall: stdMat(Tex.brick(), { color: 0xffffff, roughness: 0.95 }), roof: stdMat(Tex.asphalt(), { color: 0x9aa0a8, roughness: 0.95 }), floor: stdMat(Tex.asphalt(), { color: 0x8a9098, roughness: 0.9 }) },
      { wall: stdMat(Tex.metal(), { color: 0xc7d0dc, roughness: 0.55, metalness: 0.55 }), roof: stdMat(Tex.metal(), { color: 0x93a0b0, roughness: 0.5, metalness: 0.6 }), floor: stdMat(Tex.asphalt(), { color: 0x8f959c, roughness: 0.9 }) }
    ];

    var padMat = stdMat(Tex.asphalt(), { color: 0xffffff, roughness: 0.98 });
    padMat.map = Tex.asphalt();

    for (var p = 0; p < World.pois.length; p++) {
      var poi = World.pois[p];
      /* Clone + tint per POI so two concrete towns don't look identical. */
      var base = themes[Math.floor(rand() * themes.length)];
      var hue = rand(), sat = 0.10 + rand() * 0.16;
      var theme = { wall: base.wall.clone(), roof: base.roof.clone(), floor: base.floor.clone() };
      theme.wall.color.offsetHSL(0, 0, 0).lerp(new THREE.Color().setHSL(hue, sat, 0.62), 0.42);
      theme.roof.color.lerp(new THREE.Color().setHSL(hue, sat * 0.8, 0.38), 0.38);
      poi.tint = theme.wall.color.getHex();
      var lootSpots = [];
      var group = new THREE.Group();

      /* ground pad */
      var padGeo = new THREE.CircleGeometry(poi.radius * 0.95, 26);
      padGeo.rotateX(-Math.PI / 2);
      var pad = new THREE.Mesh(padGeo, padMat.clone());
      pad.material.map = Tex.asphalt();
      pad.position.set(poi.x, poi.y + 0.06, poi.z);
      pad.receiveShadow = true;
      group.add(pad);
      World.hittables.push(pad);

      var nBuildings = 3 + Math.floor(rand() * 3);
      var placed = [];
      var wallBatch = new BoxBatch(2.6), floorBatch = new BoxBatch(2.6), roofBatch = new BoxBatch(2.6);

      for (var b = 0; b < nBuildings; b++) {
        var attempt = 0, bx, bz, okSpot = false;
        while (attempt++ < 30 && !okSpot) {
          var ang = rand() * Math.PI * 2;
          var rr = rand() * (poi.radius - 12);
          bx = poi.x + Math.cos(ang) * rr;
          bz = poi.z + Math.sin(ang) * rr;
          okSpot = placed.every(function (o) {
            return Math.abs(o.x - bx) > 15 || Math.abs(o.z - bz) > 15;
          });
        }
        if (!okSpot) continue;
        placed.push({ x: bx, z: bz });
        var bld = makeBuilding(rand, bx, bz, poi.y, theme, lootSpots);
        /* merge this building's batches into the POI-level batches */
        mergeBatch(wallBatch, bld.meshes[0].batch);
        mergeBatch(floorBatch, bld.meshes[1].batch);
        mergeBatch(roofBatch, bld.meshes[2].batch);
      }

      addBatchMesh(group, wallBatch, theme.wall);
      addBatchMesh(group, floorBatch, theme.floor);
      addBatchMesh(group, roofBatch, theme.roof);

      /* a few harvestable metal props for variety */
      for (var v = 0; v < 3; v++) {
        var va = rand() * Math.PI * 2, vr = poi.radius * (0.5 + rand() * 0.45);
        addCar(group, poi.x + Math.cos(va) * vr, poi.y, poi.z + Math.sin(va) * vr, rand);
      }

      poi.lootSpots = lootSpots;
      scene.add(group);
    }
  }

  function mergeBatch(dst, src) {
    if (src.isEmpty()) return;
    Array.prototype.push.apply(dst.pos, src.pos);
    Array.prototype.push.apply(dst.nor, src.nor);
    Array.prototype.push.apply(dst.uv, src.uv);
  }

  function addBatchMesh(group, batch, mat) {
    if (batch.isEmpty()) return null;
    var mesh = new THREE.Mesh(batch.geometry(), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    World.hittables.push(mesh);
    return mesh;
  }

  function addCar(group, x, y, z, rand) {
    var b = new BoxBatch(2.2);
    b.add(0, 0.75, 0, 4.4, 0.95, 2.0);
    b.add(-0.2, 1.55, 0, 2.4, 0.8, 1.85);
    var mesh = new THREE.Mesh(b.geometry(), stdMat(Tex.metal(), {
      color: new THREE.Color().setHSL(rand(), 0.6, 0.5), roughness: 0.4, metalness: 0.6
    }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rand() * Math.PI * 2;
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    World.hittables.push(mesh);

    /* Rotated body, but an axis-aligned collider is close enough for a car. */
    Colliders.add(box(x - 2.2, y, z - 2.2, x + 2.2, y + 2.0, z + 2.2, { prop: World.props.length }));
    var carProp = {
      kind: 'car', mat: 'metal', hp: 200, maxHp: 200, index: -1,
      x: x, y: y, z: z, s: 1, mesh: mesh, mesh2: null, alive: true, isSingle: true
    };
    World.props.push(carProp);
    mesh.userData.prop = carProp;
  }

  /* ------------------------------------------------------------------ */

  World.build = function (scene, seed) {
    World.seed = seed || 1337;
    World.pois.length = 0;
    World.props.length = 0;
    World.chests.length = 0;
    World.hittables.length = 0;
    poiFlat.length = 0;
    Colliders.clear();

    var rand = U.rng(World.seed);
    makeSky(scene);
    makePOIs(scene, rand);   // POIs first: they flatten the terrain
    makeTerrain(scene);
    makeWater(scene);
    makeProps(scene, rand);

    return World;
  };

  /* Random spawn on solid ground, away from water. */
  World.randomLandPoint = function (rand) {
    for (var i = 0; i < 200; i++) {
      var x = (rand() * 2 - 1) * (HALF - 30);
      var z = (rand() * 2 - 1) * (HALF - 30);
      if (World.heightAt(x, z) > WATER_Y + 2) return { x: x, z: z };
    }
    return { x: 0, z: 0 };
  };

  window.World = World;
})();
