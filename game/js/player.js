/* Local player: movement, third-person camera, combat, harvesting, building. */
(function () {
  'use strict';

  var GRAVITY = 26;
  var WALK = 6.2, SPRINT = 9.4, CROUCH = 3.0, AIR_CONTROL = 0.34;
  var JUMP_V = 9.6;
  var MAT_CAP = 500;

  var _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  var _ray = new THREE.Raycaster();

  function Player(scene) {
    this.scene = scene;
    this.pos = new THREE.Vector3(0, 100, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.42;
    this.height = 1.82;
    this.alive = true;
    this.name = 'YOU';
    this.id = -1;

    this.health = 100;
    this.maxHealth = 100;
    this.shield = 0;
    this.kills = 0;
    this.grounded = false;
    this.crouching = false;
    this.sprinting = false;

    this.mode = 'ground';   // 'skydive' | 'glide' | 'ground'
    this.mats = { wood: 0, brick: 0, metal: 0 };
    this.matIndex = 0;
    this.ammo = { light: 0, medium: 0, shells: 0, heavy: 0 };

    this.slots = [Weapons.makeItem('pickaxe', 'common'), null, null, null, null];
    this.slot = 0;

    this.buildMode = false;
    this.buildType = 'wall';
    this.buildTarget = null;
    this.buildValid = false;

    this.fireCd = 0;
    this.reloadT = 0;
    this.recoil = 0;
    this.recoilPitch = 0;
    this.swingT = 0;
    this.aiming = false;
    this.adsAmount = 0;
    this.camDist = 4.4;
    this.bobT = 0;
    this.hitMarkerT = 0;
    this.damageFlashT = 0;
    this.lastDamageDir = 0;
    this.landingImpact = 0;

    this.char = new Character({ shirt: 0x2f6fd0, pants: 0x2b3442 });
    this.char.root.position.copy(this.pos);
    scene.add(this.char.root);
    this.refreshWeaponMesh();

    this.camPivot = new THREE.Object3D();
    scene.add(this.camPivot);
  }

  Player.prototype.item = function () { return this.slots[this.slot]; };

  Player.prototype.refreshWeaponMesh = function () {
    var it = this.item();
    if (this.buildMode || !it) { this.char.setWeapon(null); return; }
    this.char.setWeapon(Weapons.makeWeaponMesh(it.id, it.rarity));
  };

  Player.prototype.eye = function (out) {
    return out.set(this.pos.x, this.pos.y + (this.crouching ? 1.25 : 1.58), this.pos.z);
  };

  /* ------------------------- inventory ------------------------- */

  Player.prototype.selectSlot = function (i) {
    if (i < 0 || i >= this.slots.length) return;
    if (!this.slots[i]) return;
    if (this.buildMode) this.buildMode = false;
    if (this.slot !== i) { this.slot = i; this.reloadT = 0; this.fireCd = 0.12; }
    this.refreshWeaponMesh();
  };

  Player.prototype.cycleSlot = function (dir) {
    for (var n = 1; n <= this.slots.length; n++) {
      var i = (this.slot + dir * n + this.slots.length * 4) % this.slots.length;
      if (this.slots[i]) { this.selectSlot(i); return; }
    }
  };

  Player.prototype.giveWeapon = function (item) {
    for (var i = 1; i < this.slots.length; i++) {
      if (!this.slots[i]) {
        this.slots[i] = item;
        this.selectSlot(i);
        return { slot: i, replaced: false };
      }
    }
    var target = this.slot === 0 ? 1 : this.slot;
    var old = this.slots[target];
    this.slots[target] = item;
    this.selectSlot(target);
    return { slot: target, replaced: true, old: old };
  };

  Player.prototype.giveAmmo = function (type, amount) {
    this.ammo[type] = Math.min(999, this.ammo[type] + amount);
  };

  Player.prototype.giveMats = function (type, amount) {
    this.mats[type] = Math.min(MAT_CAP, this.mats[type] + amount);
  };

  Player.prototype.heal = function (amount, cap) {
    var before = this.health;
    this.health = Math.min(cap === undefined ? this.maxHealth : cap, this.health + amount);
    return this.health - before;
  };

  Player.prototype.addShield = function (amount) {
    var before = this.shield;
    this.shield = Math.min(100, this.shield + amount);
    return this.shield - before;
  };

  Player.prototype.damage = function (amount, fromPos) {
    if (!this.alive) return false;
    var toShield = Math.min(this.shield, amount);
    this.shield -= toShield;
    this.health -= (amount - toShield);
    this.damageFlashT = 0.45;
    if (fromPos) {
      var dx = fromPos.x - this.pos.x, dz = fromPos.z - this.pos.z;
      this.lastDamageDir = Math.atan2(dx, dz) - this.yaw;
    }
    Audio2.hurt();
    if (this.health <= 0) { this.health = 0; return true; }
    return false;
  };

  /* --------------------------- combat -------------------------- */

  Player.prototype.aimRay = function (camera, outOrigin, outDir) {
    camera.getWorldPosition(outOrigin);
    camera.getWorldDirection(outDir);
    return outDir;
  };

  Player.prototype.currentSpread = function () {
    var it = this.item();
    if (!it || it.def.kind === 'melee') return 0.02;
    var base = this.aiming ? it.def.adsSpread : it.def.spread;
    var speed = Math.hypot(this.vel.x, this.vel.z);
    var moveMul = 1 + U.clamp(speed / 9, 0, 1) * 0.9 + (this.grounded ? 0 : 0.8);
    if (this.crouching) moveMul *= 0.7;
    return base * moveMul;
  };

  Player.prototype.fire = function (camera) {
    var it = this.item();
    if (!it) return;

    if (it.def.kind === 'melee') {
      if (this.swingT > 0) return;
      this.swingT = it.def.rate;
      this.doMelee(camera);
      return;
    }
    if (this.fireCd > 0 || this.reloadT > 0) return;
    if (it.ammoInMag <= 0) {
      if (this.ammo[it.def.ammo] > 0) this.startReload();
      else Audio2.empty();
      return;
    }

    var origin = _v, dir = _v2;
    this.aimRay(camera, origin, dir);
    var spread = this.currentSpread();

    for (var p = 0; p < it.def.pellets; p++) {
      var d = dir.clone();
      d.x += (Math.random() - 0.5) * spread * 2;
      d.y += (Math.random() - 0.5) * spread * 2;
      d.z += (Math.random() - 0.5) * spread * 2;
      d.normalize();
      Game.hitscan(origin, d, it.def.range, this, it.damage, it.def);
    }

    it.ammoInMag--;
    this.fireCd = it.def.rate;
    this.recoil = 1;
    var kick = it.def.kind === 'sniper' ? 0.075 : (it.def.kind === 'shotgun' ? 0.055 : 0.022);
    this.recoilPitch += kick * (this.aiming ? 0.6 : 1);
    Audio2.shot(it.def.sound, 0);

    var muzzlePos = this.muzzleWorld();
    Weapons.FX.muzzle(muzzlePos);
    if (it.ammoInMag <= 0 && this.ammo[it.def.ammo] > 0) this.startReload();
  };

  Player.prototype.muzzleWorld = function () {
    var wm = this.char.weaponMesh;
    if (wm && wm.userData.muzzle) {
      wm.userData.muzzle.getWorldPosition(_v3);
      return _v3.clone();
    }
    this.eye(_v3);
    return _v3.clone();
  };

  Player.prototype.startReload = function () {
    var it = this.item();
    if (!it || it.def.kind === 'melee') return;
    if (this.reloadT > 0 || it.ammoInMag >= it.def.mag) return;
    if (this.ammo[it.def.ammo] <= 0) return;
    this.reloadT = it.def.reload;
    Audio2.reload();
  };

  Player.prototype.finishReload = function () {
    var it = this.item();
    if (!it || it.def.kind === 'melee') return;
    var need = it.def.mag - it.ammoInMag;
    var take = Math.min(need, this.ammo[it.def.ammo]);
    it.ammoInMag += take;
    this.ammo[it.def.ammo] -= take;
  };

  Player.prototype.doMelee = function (camera) {
    var origin = _v, dir = _v2;
    this.aimRay(camera, origin, dir);
    var it = this.item();
    Game.melee(origin, dir, it.def.range + this.camDist, this, it.def);
  };

  /* ------------------------- building -------------------------- */

  Player.prototype.matName = function () { return Build.MAT_ORDER[this.matIndex]; };

  Player.prototype.cycleMat = function () {
    this.matIndex = (this.matIndex + 1) % Build.MAT_ORDER.length;
  };

  Player.prototype.setBuild = function (type) {
    if (this.buildMode && this.buildType === type) {
      this.buildMode = false;
    } else {
      this.buildMode = true;
      this.buildType = type;
    }
    this.aiming = false;
    this.refreshWeaponMesh();
  };

  Player.prototype.updateBuildTarget = function (camera) {
    if (!this.buildMode) { this.buildTarget = null; Build.hideGhost(); return; }
    var dir = _v2;
    camera.getWorldDirection(dir);
    var t = Build.resolveTarget(this.buildType, this.pos.x, this.pos.y, this.pos.z,
      dir.x, dir.z, -dir.y > 0 ? 0 : 0);
    /* re-derive the level using aim pitch so you can build up and down */
    t = Build.resolveTarget(this.buildType, this.pos.x, this.pos.y, this.pos.z, dir.x, dir.z, dir.y);
    this.buildTarget = t;
    var mat = this.matName();
    this.buildValid = Build.canPlace(t) && this.mats[mat] >= Build.MATERIALS[mat].cost;
    Build.updateGhost(this.scene, t, mat, this.buildValid);
  };

  Player.prototype.placeBuild = function () {
    if (!this.buildMode || !this.buildTarget) return;
    var mat = this.matName();
    if (this.mats[mat] < Build.MATERIALS[mat].cost) return;
    var piece = Build.place(this.buildTarget, mat, this.id);
    if (piece) {
      this.mats[mat] -= Build.MATERIALS[mat].cost;
      Audio2.build(mat);
    }
  };

  /* -------------------------- movement ------------------------- */

  Player.prototype.update = function (dt, input, camera) {
    this.fireCd -= dt;
    this.swingT = Math.max(0, this.swingT - dt);
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.hitMarkerT = Math.max(0, this.hitMarkerT - dt);
    this.damageFlashT = Math.max(0, this.damageFlashT - dt);
    this.landingImpact = Math.max(0, this.landingImpact - dt * 3);

    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }

    /* look */
    this.yaw -= input.mouseX;
    this.pitch = U.clamp(this.pitch - input.mouseY, -1.45, 1.45);
    this.recoilPitch = U.damp(this.recoilPitch, 0, 7, dt);

    if (this.mode === 'skydive' || this.mode === 'glide') {
      this.updateSkydive(dt, input);
    } else {
      this.updateGround(dt, input);
    }

    /* animation state */
    var hspeed = Math.hypot(this.vel.x, this.vel.z);
    this.char.root.position.copy(this.pos);
    var targetYaw = this.yaw;
    var diff = ((targetYaw - this.char.root.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
    this.char.root.rotation.y += diff * Math.min(1, dt * 16);

    var it = this.item();
    this.char.update(dt, {
      speed: hspeed,
      grounded: this.grounded,
      aiming: this.aiming,
      pitch: this.pitch,
      crouch: this.crouching,
      hasWeapon: !this.buildMode && it && it.def.kind !== 'melee',
      glide: this.mode === 'glide',
      recoil: this.recoil,
      swing: this.swingT > 0 && it && it.def.kind === 'melee'
        ? this.swingT / it.def.rate : undefined
    });
    this.char.setGlider(this.mode === 'glide');
  };

  Player.prototype.updateSkydive = function (dt, input) {
    var forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    var right = new THREE.Vector3(forward.z, 0, -forward.x);
    var wish = new THREE.Vector3();
    if (input.forward) wish.add(forward);
    if (input.back) wish.sub(forward);
    if (input.right) wish.add(right);
    if (input.left) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    var gliding = this.mode === 'glide';
    var hSpeed = gliding ? 22 : 30;
    var termV = gliding ? -13 : -46;

    /* Diving straight down trades glide for speed, like the real drop. */
    var diveBoost = (!gliding && input.forward) ? 1.35 : 1;

    this.vel.x = U.damp(this.vel.x, wish.x * hSpeed, gliding ? 2.6 : 1.6, dt);
    this.vel.z = U.damp(this.vel.z, wish.z * hSpeed, gliding ? 2.6 : 1.6, dt);
    this.vel.y = U.damp(this.vel.y, termV * diveBoost, gliding ? 3.4 : 1.2, dt);

    this.pos.addScaledVector(this.vel, dt);
    var H = World.HALF - 6;
    this.pos.x = U.clamp(this.pos.x, -H, H);
    this.pos.z = U.clamp(this.pos.z, -H, H);

    var ground = World.supportAt(this.pos.x, this.pos.z, this.pos.y, 0.4).y;
    var agl = this.pos.y - ground;

    if (this.mode === 'skydive' && agl < 48) {
      this.mode = 'glide';
      Audio2.jump();
    }
    if (agl <= 0.05) {
      this.pos.y = ground;
      this.mode = 'ground';
      this.vel.set(0, 0, 0);
      this.grounded = true;
      this.landingImpact = 1;
      Audio2.land(true);
      Game.onLanded();
    }
  };

  Player.prototype.updateGround = function (dt, input) {
    this.crouching = !!input.crouch && this.grounded;
    var it = this.item();
    var canSprint = !this.aiming && !this.crouching && !this.buildMode;
    this.sprinting = !!input.sprint && canSprint && (input.forward || input.left || input.right);

    var speed = this.crouching ? CROUCH : (this.sprinting ? SPRINT : WALK);
    if (this.aiming) speed *= 0.62;

    var forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    var right = new THREE.Vector3(forward.z, 0, -forward.x);
    var wish = new THREE.Vector3();
    if (input.forward) wish.add(forward);
    if (input.back) wish.sub(forward);
    if (input.right) wish.add(right);
    if (input.left) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    var accel = this.grounded ? 18 : 18 * AIR_CONTROL;
    this.vel.x = U.damp(this.vel.x, wish.x * speed, accel, dt);
    this.vel.z = U.damp(this.vel.z, wish.z * speed, accel, dt);

    if (input.jump && this.grounded) {
      this.vel.y = JUMP_V;
      this.grounded = false;
      Audio2.jump();
    }

    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -60) this.vel.y = -60;

    var prevY = this.pos.y;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    World.resolveLateral(this.pos, this.radius, this.crouching ? 1.25 : this.height, this.pos.y);

    this.pos.y += this.vel.y * dt;

    /* head bump */
    if (this.vel.y > 0) {
      var ceil = World.ceilingAt(this.pos.x, this.pos.z, prevY + this.height * 0.55);
      if (ceil < this.pos.y + this.height) {
        this.pos.y = Math.min(this.pos.y, ceil - this.height - 0.02);
        this.vel.y = Math.min(this.vel.y, 0);
      }
    }

    var sup = World.supportAt(this.pos.x, this.pos.z, this.pos.y, this.vel.y > 0.1 ? 0.05 : 0.62);
    var inWater = !!(sup.ref && sup.ref.water);
    if (this.pos.y <= sup.y) {
      if (!this.grounded) {
        var impact = -this.vel.y;
        if (impact > 12) {
          this.landingImpact = U.clamp(impact / 30, 0, 1);
          Audio2.land(impact > 24);
          /* Fall damage above roughly two storeys - water breaks the fall. */
          if (impact > 24 && !inWater) {
            var dmg = (impact - 24) * 3.2;
            if (this.damage(dmg, null)) Game.onPlayerDeath('the fall');
          }
        } else if (impact > 4) Audio2.land(false);
      }
      this.pos.y = sup.y;
      this.vel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    var H = World.HALF - 4;
    this.pos.x = U.clamp(this.pos.x, -H, H);
    this.pos.z = U.clamp(this.pos.z, -H, H);

    /* Wading: slower, and no sprinting out of the sea. */
    this.inWater = inWater;
    if (inWater) {
      this.vel.x *= 0.72; this.vel.z *= 0.72;
      this.sprinting = false;
    }
  };

  /* --------------------------- camera -------------------------- */

  Player.prototype.updateCamera = function (camera, dt) {
    var it = this.item();
    var sniperScope = this.aiming && it && it.def.scope;
    var targetAds = this.aiming ? 1 : 0;
    this.adsAmount = U.damp(this.adsAmount, targetAds, 14, dt);

    var pivotY = this.pos.y + (this.crouching ? 1.22 : 1.56) - this.landingImpact * 0.28;
    this.camPivot.position.set(this.pos.x, pivotY, this.pos.z);

    var pitch = this.pitch - this.recoilPitch;
    var dist = U.lerp(4.4, sniperScope ? 0.0 : 2.15, this.adsAmount);
    if (this.mode === 'skydive' || this.mode === 'glide') dist = 6.5;

    var shoulder = U.lerp(0.62, sniperScope ? 0.0 : 0.5, this.adsAmount);
    var heightOff = U.lerp(0.12, 0.06, this.adsAmount);

    var dirX = Math.sin(this.yaw) * Math.cos(pitch);
    var dirY = Math.sin(pitch);
    var dirZ = Math.cos(this.yaw) * Math.cos(pitch);

    var rightX = Math.cos(this.yaw), rightZ = -Math.sin(this.yaw);

    var desired = _v.set(
      this.camPivot.position.x - dirX * dist + rightX * shoulder,
      this.camPivot.position.y - dirY * dist + heightOff,
      this.camPivot.position.z - dirZ * dist + rightZ * shoulder
    );

    /* Pull the camera in if geometry is between it and the player. */
    if (dist > 0.2) {
      _v2.subVectors(desired, this.camPivot.position);
      var len = _v2.length();
      _v2.divideScalar(len);
      _ray.set(this.camPivot.position, _v2);
      _ray.far = len + 0.35;
      var hits = _ray.intersectObjects(Game.rayTargets, false);
      if (hits.length) {
        var d = Math.max(0.55, hits[0].distance - 0.35);
        desired.copy(this.camPivot.position).addScaledVector(_v2, d);
      }
    }

    camera.position.lerp(desired, 1 - Math.exp(-26 * dt));
    /* Look slightly ahead of the pivot so the crosshair matches the shot. */
    _v3.set(
      this.camPivot.position.x + dirX * 60,
      this.camPivot.position.y + dirY * 60 + heightOff,
      this.camPivot.position.z + dirZ * 60
    );
    camera.lookAt(_v3);

    var baseFov = 74;
    if (this.sprinting) baseFov += 6;
    var targetFov = this.aiming ? (it && it.def.scope ? 74 / it.def.scope : 56) : baseFov;
    camera.fov = U.damp(camera.fov, targetFov, 12, dt);
    camera.updateProjectionMatrix();

    /* hide our own head when scoped in */
    this.char.head.visible = !(sniperScope && this.adsAmount > 0.7);
  };

  Player.prototype.reset = function (x, y, z) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.health = 100; this.shield = 0; this.kills = 0;
    this.alive = true;
    this.mats = { wood: 0, brick: 0, metal: 0 };
    this.ammo = { light: 0, medium: 0, shells: 0, heavy: 0 };
    this.slots = [Weapons.makeItem('pickaxe', 'common'), null, null, null, null];
    this.slot = 0;
    this.buildMode = false;
    this.mode = 'skydive';
    this.pitch = -0.35;
    this.recoilPitch = 0;
    this.adsAmount = 0;
    this.aiming = false;
    this.char.root.visible = true;
    this.refreshWeaponMesh();
  };

  window.Player = Player;
})();
