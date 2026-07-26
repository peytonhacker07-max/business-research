/* Chests and ground pickups. */
(function () {
  'use strict';

  var chestGeo = null, lidGeo = null, bandGeo = null;
  var chestMat = null, chestMetal = null, glowMat = null;
  var beamGeo = null;

  function ensure() {
    if (chestGeo) return;
    chestGeo = new THREE.BoxGeometry(1.05, 0.62, 0.72);
    lidGeo = new THREE.BoxGeometry(1.07, 0.26, 0.74);
    bandGeo = new THREE.BoxGeometry(1.12, 0.1, 0.78);
    chestMat = new THREE.MeshStandardMaterial({
      map: Tex.wood(), color: 0xc79a52, roughness: 0.7, metalness: 0.15
    });
    chestMetal = new THREE.MeshStandardMaterial({ color: 0xe8b93c, roughness: 0.32, metalness: 0.85 });
    glowMat = new THREE.SpriteMaterial({
      map: Tex.puff(), color: 0xffd35c, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    beamGeo = new THREE.CylinderGeometry(0.34, 0.34, 3.0, 10, 1, true);
    beamGeo.translate(0, 1.5, 0);
  }

  /* ------------------------------ chest ------------------------------ */

  function Chest(scene, x, y, z, rand) {
    ensure();
    this.rand = rand;
    this.opened = false;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.group.rotation.y = rand() * Math.PI * 2;

    var body = new THREE.Mesh(chestGeo, chestMat);
    body.position.y = 0.31;
    body.castShadow = true; body.receiveShadow = true;
    this.group.add(body);

    this.lid = new THREE.Group();
    this.lid.position.set(0, 0.62, -0.36);
    var lid = new THREE.Mesh(lidGeo, chestMat);
    lid.position.set(0, 0.09, 0.36);
    lid.castShadow = true;
    this.lid.add(lid);
    var band = new THREE.Mesh(bandGeo, chestMetal);
    band.position.set(0, 0.14, 0.36);
    this.lid.add(band);
    this.group.add(this.lid);

    var lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.1), chestMetal);
    lock.position.set(0, 0.56, 0.38);
    this.group.add(lock);

    this.glow = new THREE.Sprite(glowMat.clone());
    this.glow.scale.set(2.6, 2.6, 1);
    this.glow.position.y = 0.5;
    this.group.add(this.glow);

    scene.add(this.group);
    this.x = x; this.y = y; this.z = z;
    this.t = rand() * 6;
  }

  Chest.prototype.update = function (dt) {
    this.t += dt;
    if (!this.opened) {
      this.glow.material.opacity = 0.4 + Math.sin(this.t * 2.4) * 0.18;
      this.glow.scale.setScalar(2.4 + Math.sin(this.t * 2.4) * 0.25);
    } else if (this.lid.rotation.x > -1.9) {
      this.lid.rotation.x = Math.max(-1.95, this.lid.rotation.x - dt * 5);
      this.glow.material.opacity = Math.max(0, this.glow.material.opacity - dt * 1.5);
    }
  };

  Chest.prototype.open = function (scene, rand) {
    if (this.opened) return [];
    this.opened = true;
    Audio2.chest();
    var out = [];
    var n = 2 + Math.floor(rand() * 2);
    var angle = rand() * Math.PI * 2;
    var self = this;

    function spawn(pickup) {
      out.push(pickup);
      return pickup;
    }

    for (var i = 0; i < n; i++) {
      var a = angle + (i / n) * Math.PI * 2;
      var px = self.x + Math.cos(a) * 1.15;
      var pz = self.z + Math.sin(a) * 1.15;
      var py = World.supportAt(px, pz, self.y + 1, 1.2).y;
      if (i === 0) {
        spawn(new Pickup(scene, px, py, pz, { type: 'weapon', item: Weapons.rollWeapon(rand, 1) }));
      } else if (i === 1) {
        var kinds = ['ammo', 'shield', 'heal'];
        var k = kinds[Math.floor(rand() * kinds.length)];
        spawn(new Pickup(scene, px, py, pz, makeConsumable(k, rand)));
      } else {
        spawn(new Pickup(scene, px, py, pz, makeConsumable('ammo', rand)));
      }
    }
    return out;
  };

  function makeConsumable(kind, rand) {
    if (kind === 'shield') return { type: 'shield', amount: rand() < 0.35 ? 50 : 25 };
    if (kind === 'heal') return { type: 'heal', amount: 15 };
    var types = ['light', 'medium', 'shells', 'heavy'];
    var t = types[Math.floor(rand() * types.length)];
    var counts = { light: 36, medium: 30, shells: 10, heavy: 8 };
    return { type: 'ammo', ammo: t, amount: counts[t] };
  }

  /* ----------------------------- pickup ----------------------------- */

  var PICKUP_STYLE = {
    shield: { color: 0x4fc3f7, label: 'Shield' },
    heal: { color: 0xff6b6b, label: 'Bandage' },
    ammo: { color: 0xf0c674, label: 'Ammo' },
    mats: { color: 0xc09050, label: 'Materials' }
  };

  function Pickup(scene, x, y, z, data) {
    ensure();
    this.data = data;
    this.type = data.type;
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.x = x; this.y = y; this.z = z;
    this.t = Math.random() * 6;
    this.taken = false;

    var color;
    if (data.type === 'weapon') {
      color = Weapons.RARITY[data.item.rarity].color;
      var mesh = Weapons.makeWeaponMesh(data.item.id, data.item.rarity);
      mesh.scale.setScalar(0.85);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.y = 0.62;
      this.icon = mesh;
      this.group.add(mesh);
    } else {
      var style = PICKUP_STYLE[data.type];
      color = style.color;
      var geo;
      if (data.type === 'shield') geo = new THREE.CylinderGeometry(0.16, 0.2, 0.46, 8);
      else if (data.type === 'heal') geo = new THREE.BoxGeometry(0.34, 0.24, 0.24);
      else geo = new THREE.BoxGeometry(0.4, 0.26, 0.3);
      var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: color, roughness: 0.4, metalness: 0.25,
        emissive: new THREE.Color(color).multiplyScalar(0.25)
      }));
      m.position.y = 0.55;
      m.castShadow = true;
      this.icon = m;
      this.group.add(m);
    }

    var beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: 0.16, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    this.group.add(beam);
    this.beam = beam;
    this.color = color;

    scene.add(this.group);
  }

  Pickup.prototype.update = function (dt) {
    this.t += dt;
    this.icon.rotation.y += dt * 1.6;
    this.icon.position.y = 0.55 + Math.sin(this.t * 2) * 0.08;
    this.beam.material.opacity = 0.12 + Math.sin(this.t * 3) * 0.05;
  };

  Pickup.prototype.remove = function (scene) {
    this.taken = true;
    scene.remove(this.group);
  };

  Pickup.prototype.label = function () {
    if (this.type === 'weapon') {
      return Weapons.RARITY[this.data.item.rarity].name + ' ' + this.data.item.def.name;
    }
    if (this.type === 'ammo') return this.data.amount + ' ' + Weapons.AMMO_TYPES[this.data.ammo] + ' Ammo';
    if (this.type === 'shield') return 'Shield Potion (+' + this.data.amount + ')';
    if (this.type === 'heal') return 'Bandage (+' + this.data.amount + ')';
    return PICKUP_STYLE[this.type].label;
  };

  window.Loot = { Chest: Chest, Pickup: Pickup, makeConsumable: makeConsumable };
})();
