/* AI opponents: roam, loot, fight, build under pressure, rotate with the storm. */
(function () {
  'use strict';

  var _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  var _ray = new THREE.Raycaster();

  function Bot(scene, opts) {
    var rand = opts.rand;
    this.rand = rand;
    this.id = opts.id;
    this.name = opts.name;
    this.skill = 0.35 + rand() * 0.55;          // drives accuracy and aggression
    this.health = 100;
    this.shield = rand() < 0.5 ? Math.floor(rand() * 3) * 25 : 0;
    this.maxHealth = 100;
    this.alive = true;
    this.kills = 0;

    this.pos = new THREE.Vector3(opts.x, opts.y, opts.z);
    this.vel = new THREE.Vector3();
    this.yaw = rand() * Math.PI * 2;
    this.pitch = 0;
    this.radius = 0.42;
    this.height = 1.82;
    this.grounded = false;

    this.char = new Character({ rand: rand });
    this.char.setNameTag(this.name, '#ffd9d9');
    this.char.root.position.copy(this.pos);
    scene.add(this.char.root);

    this.item = Weapons.rollWeapon(rand, rand() < 0.25 ? 1 : 0);
    this.char.setWeapon(Weapons.makeWeaponMesh(this.item.id, this.item.rarity));

    this.state = 'roam';
    this.think = rand() * 0.3;
    this.dest = null;
    this.target = null;
    this.targetLost = 0;
    this.fireCd = 0;
    this.reloadT = 0;
    this.reactT = 0;
    this.buildCd = rand() * 4;
    this.strafeDir = rand() < 0.5 ? 1 : -1;
    this.strafeT = 0;
    this.stuckT = 0;
    this.lastPos = this.pos.clone();
    this.jumpCd = 0;
    this.recoil = 0;
    this.mats = { wood: 200, brick: 120, metal: 80 };
    this.landed = opts.landed !== false;
    this.visible = true;
  }

  Bot.prototype.eye = function (out) {
    return out.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
  };

  Bot.prototype.canSee = function (targetPos, maxDist) {
    this.eye(_v1);
    _v2.copy(targetPos); _v2.y += 1.2;
    _v3.subVectors(_v2, _v1);
    var dist = _v3.length();
    if (dist > maxDist) return false;
    _v3.divideScalar(dist);
    _ray.set(_v1, _v3);
    _ray.far = dist - 0.6;
    var hits = _ray.intersectObjects(Game.rayTargets, false);
    return hits.length === 0;
  };

  Bot.prototype.damage = function (amount, fromPos, attacker) {
    if (!this.alive) return false;
    var toShield = Math.min(this.shield, amount);
    this.shield -= toShield;
    var toHealth = amount - toShield;
    this.health -= toHealth;
    this.char.drawTag(this.health / this.maxHealth, this.shield / 100);

    if (fromPos) {
      this.threatPos = this.threatPos || new THREE.Vector3();
      this.threatPos.copy(fromPos);
      this.threatT = 4;
      if (!this.target && attacker) { this.target = attacker; this.state = 'engage'; }
    }
    if (this.health <= 0) { this.health = 0; return true; }
    return false;
  };

  Bot.prototype.kill = function (scene) {
    this.alive = false;
    scene.remove(this.char.root);
    this.char.dispose();
  };

  /* --------------------------- movement --------------------------- */

  Bot.prototype.move = function (dt, desiredX, desiredZ, speed) {
    var len = Math.hypot(desiredX, desiredZ);
    if (len > 0.001) { desiredX /= len; desiredZ /= len; } else { desiredX = desiredZ = 0; }

    var accel = 42;
    this.vel.x = U.damp(this.vel.x, desiredX * speed, accel * dt > 1 ? 14 : 14, dt);
    this.vel.z = U.damp(this.vel.z, desiredZ * speed, 14, dt);

    this.vel.y -= 26 * dt;
    if (this.vel.y < -55) this.vel.y = -55;

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    World.resolveLateral(this.pos, this.radius, this.height, this.pos.y);

    this.pos.y += this.vel.y * dt;
    var sup = World.supportAt(this.pos.x, this.pos.z, this.pos.y, 0.7);
    if (this.pos.y <= sup.y) {
      this.pos.y = sup.y;
      this.vel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    /* clamp to island */
    var H = World.HALF - 4;
    this.pos.x = U.clamp(this.pos.x, -H, H);
    this.pos.z = U.clamp(this.pos.z, -H, H);
  };

  Bot.prototype.jump = function () {
    if (this.grounded && this.jumpCd <= 0) {
      this.vel.y = 9.2;
      this.grounded = false;
      this.jumpCd = 0.6;
    }
  };

  /* ---------------------------- combat ---------------------------- */

  Bot.prototype.shoot = function (targetPos) {
    var def = this.item.def;
    this.eye(_v1);
    _v2.copy(targetPos); _v2.y += 1.05 + (this.rand() - 0.5) * 0.5;
    _v3.subVectors(_v2, _v1).normalize();

    /* Accuracy: skill, distance and a base cone keep bots beatable. */
    var dist = _v1.distanceTo(_v2);
    var cone = def.spread * (1.9 - this.skill) + U.clamp(dist / 260, 0, 0.05) * (1.4 - this.skill);
    for (var p = 0; p < def.pellets; p++) {
      var d = _v3.clone();
      d.x += (this.rand() - 0.5) * cone * 2;
      d.y += (this.rand() - 0.5) * cone * 2;
      d.z += (this.rand() - 0.5) * cone * 2;
      d.normalize();
      Game.hitscan(_v1, d, def.range, this, this.item.damage, def);
    }

    Weapons.FX.muzzle(_v1.clone().addScaledVector(_v3, 0.9));
    Audio2.shot(def.sound, this.pos.distanceTo(Game.player.pos));
    this.item.ammoInMag--;
    this.fireCd = def.rate;
    this.recoil = 1;
    if (this.item.ammoInMag <= 0) this.reloadT = def.reload;
  };

  Bot.prototype.tryBuild = function () {
    if (this.buildCd > 0) return;
    var mat = this.mats.metal >= 10 ? 'metal' : (this.mats.brick >= 10 ? 'brick' : 'wood');
    if (this.mats[mat] < 10) return;
    var src = this.threatPos || (this.target && this.target.pos);
    if (!src) return;
    var dx = src.x - this.pos.x, dz = src.z - this.pos.z;
    var len = Math.hypot(dx, dz) || 1;
    var t = Build.resolveTarget('wall', this.pos.x, this.pos.y, this.pos.z, dx / len, dz / len, 0);
    if (Build.place(t, mat, this.id)) {
      this.mats[mat] -= 10;
      Audio2.build(mat);
      this.buildCd = 2.2 + this.rand() * 2.4;
    } else {
      this.buildCd = 0.8;
    }
  };

  /* ----------------------------- think ---------------------------- */

  Bot.prototype.pickDestination = function () {
    var zone = Game.storm;
    var rand = this.rand;
    /* Head for cover inside the next circle, with some wandering. */
    var a = rand() * Math.PI * 2;
    var r = rand() * zone.nextRadius * 0.75;
    var tx = zone.nextX + Math.cos(a) * r;
    var tz = zone.nextZ + Math.sin(a) * r;

    /* Prefer a POI when one is inside the circle - that's where the loot is. */
    if (rand() < 0.55 && World.pois.length) {
      var best = null, bestD = Infinity;
      for (var i = 0; i < World.pois.length; i++) {
        var p = World.pois[i];
        var d = Math.hypot(p.x - zone.nextX, p.z - zone.nextZ);
        if (d < zone.nextRadius * 0.9) {
          var dd = Math.hypot(p.x - this.pos.x, p.z - this.pos.z) + rand() * 90;
          if (dd < bestD) { bestD = dd; best = p; }
        }
      }
      if (best) {
        tx = best.x + (rand() - 0.5) * best.radius;
        tz = best.z + (rand() - 0.5) * best.radius;
      }
    }
    /* Never route into the sea - nudge the target back toward high ground. */
    if (World.heightAt(tx, tz) < World.WATER_Y + 1.2) {
      var toC = Math.hypot(tx, tz) || 1;
      tx *= Math.max(0, (toC - 40)) / toC;
      tz *= Math.max(0, (toC - 40)) / toC;
    }
    this.dest = new THREE.Vector3(tx, 0, tz);
  };

  Bot.prototype.update = function (dt, scene) {
    if (!this.alive) return;

    this.fireCd -= dt;
    this.jumpCd -= dt;
    this.buildCd -= dt;
    this.strafeT -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 7);
    if (this.threatT > 0) this.threatT -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.item.ammoInMag = this.item.def.mag;
    }

    this.think -= dt;
    if (this.think <= 0) {
      this.think = 0.18 + this.rand() * 0.14;
      this.retarget();
    }

    var speed = 6.4;
    var dx = 0, dz = 0;

    if (this.state === 'engage' && this.target && this.target.alive !== false) {
      var tp = this.target.pos;
      var d = Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z);
      var ideal = this.item.def.kind === 'shotgun' ? 8 : (this.item.def.kind === 'sniper' ? 55 : 22);

      /* Close or back off toward the weapon's comfortable range. */
      var toward = (d > ideal + 4) ? 1 : (d < ideal - 4 ? -1 : 0);
      var fx = (tp.x - this.pos.x) / (d || 1), fz = (tp.z - this.pos.z) / (d || 1);
      dx = fx * toward; dz = fz * toward;

      if (this.strafeT <= 0) { this.strafeDir = this.rand() < 0.5 ? 1 : -1; this.strafeT = 0.6 + this.rand() * 0.9; }
      dx += -fz * this.strafeDir * 0.85;
      dz += fx * this.strafeDir * 0.85;

      this.yaw = Math.atan2(fx, fz);
      this.pitch = U.clamp((tp.y + 1.1 - (this.pos.y + 1.55)) / Math.max(2, d), -1, 1);

      if (this.reactT > 0) this.reactT -= dt;
      else if (this.fireCd <= 0 && this.reloadT <= 0 && this.item.ammoInMag > 0 && d < this.item.def.range) {
        if (this.canSee(tp, this.item.def.range)) this.shoot(tp);
      }
      if (this.health < 65 && this.rand() < 0.55) this.tryBuild();
      if (this.rand() < 0.012) this.jump();
      speed = 7.2;
    } else {
      if (!this.dest) this.pickDestination();
      var ddx = this.dest.x - this.pos.x, ddz = this.dest.z - this.pos.z;
      var dd = Math.hypot(ddx, ddz);
      if (dd < 4) { this.pickDestination(); }
      else { dx = ddx / dd; dz = ddz / dd; this.yaw = Math.atan2(dx, dz); }
      this.pitch = U.damp(this.pitch, 0, 6, dt);
      speed = 7.0;
    }

    /* Outside the storm? Sprint straight for the circle, nothing else matters. */
    var zone = Game.storm;
    var distToCenter = Math.hypot(this.pos.x - zone.x, this.pos.z - zone.z);
    if (distToCenter > zone.radius - 6) {
      var cx = (zone.x - this.pos.x), cz = (zone.z - this.pos.z);
      var cl = Math.hypot(cx, cz) || 1;
      dx = cx / cl; dz = cz / cl;
      speed = 8.4;
      if (this.state !== 'engage') this.yaw = Math.atan2(dx, dz);
    }

    this.move(dt, dx, dz, speed);

    /* Unstick: if we've barely moved while trying to, jump or reroute. */
    var moved = this.pos.distanceTo(this.lastPos);
    this.lastPos.copy(this.pos);
    if ((dx || dz) && moved < 0.035) {
      this.stuckT += dt;
      if (this.stuckT > 0.35) { this.jump(); }
      if (this.stuckT > 1.4) { this.dest = null; this.stuckT = 0; }
    } else this.stuckT = 0;

    /* mesh */
    this.char.root.position.copy(this.pos);
    this.char.root.rotation.y = U.damp(this.char.root.rotation.y, this.yaw, 12, dt);
    /* keep the damped yaw from unwinding the long way around */
    var diff = this.yaw - this.char.root.rotation.y;
    while (diff > Math.PI) { this.char.root.rotation.y += Math.PI * 2; diff -= Math.PI * 2; }
    while (diff < -Math.PI) { this.char.root.rotation.y -= Math.PI * 2; diff += Math.PI * 2; }

    var hspeed = Math.hypot(this.vel.x, this.vel.z);
    this.char.update(dt, {
      speed: hspeed, grounded: this.grounded, aiming: this.state === 'engage',
      pitch: this.pitch, hasWeapon: true, recoil: this.recoil
    });
  };

  Bot.prototype.retarget = function () {
    var best = null, bestScore = Infinity;
    var candidates = Game.bots.concat([Game.player]);
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c === this || !c.alive) continue;
      var d = this.pos.distanceTo(c.pos);
      var maxD = 70 + this.skill * 60;
      if (d > maxD) continue;
      /* Bias toward whoever last shot us. */
      var score = d - (this.threatT > 0 && this.threatPos && c.pos.distanceTo(this.threatPos) < 6 ? 40 : 0);
      if (score < bestScore && this.canSee(c.pos, maxD)) { bestScore = score; best = c; }
    }

    if (best) {
      if (this.target !== best) this.reactT = (1 - this.skill) * 0.55 + 0.08;
      this.target = best;
      this.state = 'engage';
      this.targetLost = 0;
    } else if (this.state === 'engage') {
      this.targetLost += 0.2;
      if (this.targetLost > 2.2) { this.state = 'roam'; this.target = null; this.dest = null; }
    }
  };

  window.Bot = Bot;
})();
