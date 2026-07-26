/* Instant-build system: grid-snapped walls, floors, ramps and cones. */
(function () {
  'use strict';

  var GRID = 4.0;      // cell footprint in metres
  var LEVEL = 3.2;     // storey height (matches world building floors)

  var MATERIALS = {
    wood: { name: 'Wood', hp: 150, color: 0xc9a06a, cost: 10, icon: '#c08d4e' },
    brick: { name: 'Brick', hp: 300, color: 0xb8b0a6, cost: 10, icon: '#9b8f80' },
    metal: { name: 'Metal', hp: 460, color: 0xb9c4d2, cost: 10, icon: '#8fa2b8' }
  };
  var MAT_ORDER = ['wood', 'brick', 'metal'];

  var geoCache = {};
  function geo(name, make) { return geoCache[name] || (geoCache[name] = make()); }

  var matCache = {};
  function pieceMaterial(mat) {
    if (matCache[mat]) return matCache[mat];
    var tex = mat === 'wood' ? Tex.wood() : (mat === 'brick' ? Tex.brick() : Tex.metal());
    var m = new THREE.MeshStandardMaterial({
      map: tex,
      color: MATERIALS[mat].color,
      roughness: mat === 'metal' ? 0.45 : 0.88,
      metalness: mat === 'metal' ? 0.65 : 0.0
    });
    matCache[mat] = m;
    return m;
  }

  var Build = {
    GRID: GRID,
    LEVEL: LEVEL,
    MATERIALS: MATERIALS,
    MAT_ORDER: MAT_ORDER,
    pieces: {},        // key -> piece
    list: [],
    meshes: [],        // raycast targets
    scene: null
  };

  Build.init = function (scene) {
    Build.scene = scene;
    Build.reset();
  };

  Build.reset = function () {
    for (var i = 0; i < Build.list.length; i++) {
      var p = Build.list[i];
      if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
      for (var c = 0; c < p.colliders.length; c++) World.Colliders.remove(p.colliders[c]);
    }
    Build.pieces = {};
    Build.list.length = 0;
    Build.meshes.length = 0;
  };

  /* ---------------- target resolution ---------------- */

  function dominantDir(dirX, dirZ) {
    if (Math.abs(dirX) >= Math.abs(dirZ)) return dirX >= 0 ? 0 : 1;  // +X : -X
    return dirZ >= 0 ? 2 : 3;                                        // +Z : -Z
  }

  /* Where the piece would land given the player's position and aim. */
  Build.resolveTarget = function (type, px, py, pz, dirX, dirZ, pitch) {
    var cx = Math.floor(px / GRID), cz = Math.floor(pz / GRID);
    var level = Math.floor((py + 0.4) / LEVEL);
    if (pitch > 0.45) level += 1;
    else if (pitch < -0.6 && type === 'floor') level -= 1;

    var side = dominantDir(dirX, dirZ);
    var t = { type: type, level: level, side: side, mat: null };

    if (type === 'wall') {
      if (side === 0) { t.axis = 'x'; t.gx = cx + 1; t.gz = cz; }
      else if (side === 1) { t.axis = 'x'; t.gx = cx; t.gz = cz; }
      else if (side === 2) { t.axis = 'z'; t.gx = cx; t.gz = cz + 1; }
      else { t.axis = 'z'; t.gx = cx; t.gz = cz; }
      t.key = 'w' + t.axis + ':' + t.gx + ':' + t.gz + ':' + level;
    } else if (type === 'floor') {
      var fx = cx + (side === 0 ? 1 : side === 1 ? -1 : 0);
      var fz = cz + (side === 2 ? 1 : side === 3 ? -1 : 0);
      t.cx = fx; t.cz = fz;
      t.key = 'f:' + fx + ':' + fz + ':' + level;
    } else if (type === 'ramp') {
      t.cx = cx; t.cz = cz;
      t.key = 'r:' + cx + ':' + cz + ':' + level;
    } else {
      t.cx = cx; t.cz = cz;
      t.key = 'c:' + cx + ':' + cz + ':' + level;
    }
    return t;
  };

  /* ---------------- geometry ---------------- */

  function wallGeo() { return geo('wall', function () { return new THREE.BoxGeometry(GRID, LEVEL, 0.28); }); }
  function floorGeo() { return geo('floor', function () { return new THREE.BoxGeometry(GRID, 0.3, GRID); }); }
  function rampGeo() {
    return geo('ramp', function () {
      var len = Math.sqrt(GRID * GRID + LEVEL * LEVEL);
      return new THREE.BoxGeometry(GRID, 0.3, len);
    });
  }
  function coneGeo() {
    return geo('cone', function () {
      var g = new THREE.ConeGeometry(GRID * 0.72, LEVEL * 0.75, 4, 1);
      g.rotateY(Math.PI / 4);
      return g;
    });
  }

  function buildMesh(t, mat) {
    var mesh, colliders = [];
    var m = pieceMaterial(mat);
    var yBase = t.level * LEVEL;

    if (t.type === 'wall') {
      mesh = new THREE.Mesh(wallGeo(), m);
      if (t.axis === 'x') {
        mesh.position.set(t.gx * GRID, yBase + LEVEL / 2, t.gz * GRID + GRID / 2);
        mesh.rotation.y = Math.PI / 2;
        colliders.push(World.box(t.gx * GRID - 0.16, yBase, t.gz * GRID,
          t.gx * GRID + 0.16, yBase + LEVEL, t.gz * GRID + GRID));
      } else {
        mesh.position.set(t.gx * GRID + GRID / 2, yBase + LEVEL / 2, t.gz * GRID);
        colliders.push(World.box(t.gx * GRID, yBase, t.gz * GRID - 0.16,
          t.gx * GRID + GRID, yBase + LEVEL, t.gz * GRID + 0.16));
      }
    } else if (t.type === 'floor') {
      mesh = new THREE.Mesh(floorGeo(), m);
      mesh.position.set(t.cx * GRID + GRID / 2, yBase + 0.15, t.cz * GRID + GRID / 2);
      colliders.push(World.box(t.cx * GRID, yBase, t.cz * GRID,
        t.cx * GRID + GRID, yBase + 0.3, t.cz * GRID + GRID));
    } else if (t.type === 'ramp') {
      mesh = new THREE.Mesh(rampGeo(), m);
      var angle = Math.atan2(LEVEL, GRID);
      mesh.position.set(t.cx * GRID + GRID / 2, yBase + LEVEL / 2, t.cz * GRID + GRID / 2);
      /* orient the slope along the facing axis */
      var yaw = t.side === 0 ? -Math.PI / 2 : t.side === 1 ? Math.PI / 2 : t.side === 2 ? 0 : Math.PI;
      mesh.rotation.set(0, yaw, 0);
      mesh.rotateX(-angle);

      /* stair-step colliders so the slope is actually walkable */
      var steps = 6;
      for (var s = 0; s < steps; s++) {
        var frac = s / steps, next = (s + 1) / steps;
        var y0 = yBase + LEVEL * frac, y1 = yBase + LEVEL * next;
        var a0, a1, b0, b1;
        if (t.side === 0) { a0 = t.cx * GRID + GRID * frac; a1 = t.cx * GRID + GRID * next; b0 = t.cz * GRID; b1 = b0 + GRID; }
        else if (t.side === 1) { a1 = t.cx * GRID + GRID * (1 - frac); a0 = t.cx * GRID + GRID * (1 - next); b0 = t.cz * GRID; b1 = b0 + GRID; }
        else if (t.side === 2) { b0 = t.cz * GRID + GRID * frac; b1 = t.cz * GRID + GRID * next; a0 = t.cx * GRID; a1 = a0 + GRID; }
        else { b1 = t.cz * GRID + GRID * (1 - frac); b0 = t.cz * GRID + GRID * (1 - next); a0 = t.cx * GRID; a1 = a0 + GRID; }
        colliders.push(World.box(a0, y1 - 0.34, b0, a1, y1, b1));
      }
    } else {
      mesh = new THREE.Mesh(coneGeo(), m);
      mesh.position.set(t.cx * GRID + GRID / 2, yBase + LEVEL * 0.62, t.cz * GRID + GRID / 2);
      colliders.push(World.box(t.cx * GRID, yBase + LEVEL * 0.55, t.cz * GRID,
        t.cx * GRID + GRID, yBase + LEVEL, t.cz * GRID + GRID));
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return { mesh: mesh, colliders: colliders };
  }

  /* ---------------- placement ---------------- */

  Build.canPlace = function (t) {
    var existing = Build.pieces[t.key];
    if (existing) return false;
    var yBase = t.level * LEVEL;
    /* Don't let players build below the terrain surface. */
    var cx = (t.type === 'wall') ? t.gx * GRID : t.cx * GRID + GRID / 2;
    var cz = (t.type === 'wall') ? t.gz * GRID : t.cz * GRID + GRID / 2;
    if (yBase + LEVEL < World.heightAt(cx, cz) - 0.5) return false;
    return true;
  };

  Build.place = function (t, mat, ownerId) {
    if (!Build.canPlace(t)) return null;
    var built = buildMesh(t, mat);
    var piece = {
      key: t.key, type: t.type, mat: mat,
      hp: MATERIALS[mat].hp, maxHp: MATERIALS[mat].hp,
      mesh: built.mesh, colliders: built.colliders,
      owner: ownerId === undefined ? -1 : ownerId,
      x: built.mesh.position.x, y: built.mesh.position.y, z: built.mesh.position.z
    };
    built.mesh.userData.piece = piece;
    Build.scene.add(built.mesh);
    for (var i = 0; i < built.colliders.length; i++) {
      built.colliders[i].ref = { piece: piece };
      World.Colliders.add(built.colliders[i]);
    }
    Build.pieces[t.key] = piece;
    Build.list.push(piece);
    Build.meshes.push(built.mesh);

    /* Spawn-in pop so placement reads instantly. */
    piece.spawnT = 0;
    built.mesh.scale.setScalar(0.82);
    return piece;
  };

  Build.damage = function (piece, amount) {
    if (!piece || piece.dead) return false;
    piece.hp -= amount;
    piece.flash = 0.12;
    if (piece.hp <= 0) { Build.destroy(piece); return true; }
    return false;
  };

  Build.destroy = function (piece) {
    if (piece.dead) return;
    piece.dead = true;
    if (piece.mesh.parent) piece.mesh.parent.remove(piece.mesh);
    for (var i = 0; i < piece.colliders.length; i++) World.Colliders.remove(piece.colliders[i]);
    delete Build.pieces[piece.key];
    var li = Build.list.indexOf(piece); if (li >= 0) Build.list.splice(li, 1);
    var mi = Build.meshes.indexOf(piece.mesh); if (mi >= 0) Build.meshes.splice(mi, 1);
  };

  Build.update = function (dt) {
    for (var i = 0; i < Build.list.length; i++) {
      var p = Build.list[i];
      if (p.spawnT !== undefined && p.spawnT < 1) {
        p.spawnT = Math.min(1, p.spawnT + dt * 7);
        var s = 0.82 + 0.18 * (1 - Math.pow(1 - p.spawnT, 3));
        p.mesh.scale.setScalar(s);
      }
      if (p.flash > 0) {
        /* small recoil punch on the piece so hits read without a material swap */
        p.flash -= dt;
        var k = Math.max(0, p.flash) / 0.12;
        p.mesh.scale.setScalar(1 - 0.05 * k);
        if (p.flash <= 0) p.mesh.scale.setScalar(1);
      }
    }
  };

  /* ---------------- ghost preview ---------------- */

  var ghost = null, ghostGroup = null;

  Build.ghost = function (scene) {
    if (ghostGroup) return ghostGroup;
    ghostGroup = new THREE.Group();
    scene.add(ghostGroup);
    return ghostGroup;
  };

  Build.updateGhost = function (scene, t, mat, valid) {
    var g = Build.ghost(scene);
    if (!t) { g.visible = false; return; }
    g.visible = true;
    var built = null;

    if (!ghost || ghost.type !== t.type) {
      while (g.children.length) g.remove(g.children[0]);
      var gm = new THREE.MeshBasicMaterial({
        color: 0x66ff88, transparent: true, opacity: 0.34,
        depthWrite: false, side: THREE.DoubleSide
      });
      var proto;
      if (t.type === 'wall') proto = new THREE.Mesh(wallGeo(), gm);
      else if (t.type === 'floor') proto = new THREE.Mesh(floorGeo(), gm);
      else if (t.type === 'ramp') proto = new THREE.Mesh(rampGeo(), gm);
      else proto = new THREE.Mesh(coneGeo(), gm);

      var edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(proto.geometry),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthTest: false })
      );
      proto.add(edges);
      g.add(proto);
      ghost = { type: t.type, mesh: proto, mat: gm };
    }

    var mesh = ghost.mesh;
    var yBase = t.level * LEVEL;
    mesh.rotation.set(0, 0, 0);
    if (t.type === 'wall') {
      if (t.axis === 'x') {
        mesh.position.set(t.gx * GRID, yBase + LEVEL / 2, t.gz * GRID + GRID / 2);
        mesh.rotation.y = Math.PI / 2;
      } else {
        mesh.position.set(t.gx * GRID + GRID / 2, yBase + LEVEL / 2, t.gz * GRID);
      }
    } else if (t.type === 'floor') {
      mesh.position.set(t.cx * GRID + GRID / 2, yBase + 0.15, t.cz * GRID + GRID / 2);
    } else if (t.type === 'ramp') {
      mesh.position.set(t.cx * GRID + GRID / 2, yBase + LEVEL / 2, t.cz * GRID + GRID / 2);
      var yaw = t.side === 0 ? -Math.PI / 2 : t.side === 1 ? Math.PI / 2 : t.side === 2 ? 0 : Math.PI;
      mesh.rotation.set(0, yaw, 0);
      mesh.rotateX(-Math.atan2(LEVEL, GRID));
    } else {
      mesh.position.set(t.cx * GRID + GRID / 2, yBase + LEVEL * 0.62, t.cz * GRID + GRID / 2);
    }
    ghost.mat.color.setHex(valid ? 0x66ff88 : 0xff5555);
  };

  Build.hideGhost = function () { if (ghostGroup) ghostGroup.visible = false; };

  window.Build = Build;
})();
