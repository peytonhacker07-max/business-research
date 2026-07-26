/* Weapon definitions, rarity tiers, view models and combat FX. */
(function () {
  'use strict';

  var RARITY = {
    common: { name: 'Common', color: 0x9aa1ab, css: '#9aa1ab', mult: 1.00 },
    uncommon: { name: 'Uncommon', color: 0x4ac14a, css: '#4ac14a', mult: 1.06 },
    rare: { name: 'Rare', color: 0x3d8ff0, css: '#3d8ff0', mult: 1.12 },
    epic: { name: 'Epic', color: 0xa855f7, css: '#a855f7', mult: 1.20 },
    legendary: { name: 'Legendary', color: 0xf0a02a, css: '#f0a02a', mult: 1.30 }
  };
  var RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  var WEAPONS = {
    pickaxe: {
      id: 'pickaxe', name: 'Harvesting Tool', kind: 'melee',
      damage: 20, rate: 0.55, range: 4.0, ammo: null, harvest: 32
    },
    pistol: {
      id: 'pistol', name: 'Pistol', kind: 'pistol', damage: 26, rate: 0.20,
      mag: 16, reload: 1.5, spread: 0.014, adsSpread: 0.005, range: 110,
      ammo: 'light', pellets: 1, headMult: 2.0, falloff: 70, sound: 'pistol'
    },
    smg: {
      id: 'smg', name: 'Submachine Gun', kind: 'smg', damage: 17, rate: 0.075,
      mag: 30, reload: 2.2, spread: 0.036, adsSpread: 0.020, range: 70,
      ammo: 'light', pellets: 1, headMult: 1.6, falloff: 34, sound: 'smg'
    },
    ar: {
      id: 'ar', name: 'Assault Rifle', kind: 'ar', damage: 32, rate: 0.12,
      mag: 30, reload: 2.4, spread: 0.024, adsSpread: 0.006, range: 180,
      ammo: 'medium', pellets: 1, headMult: 2.0, falloff: 95, sound: 'ar'
    },
    shotgun: {
      id: 'shotgun', name: 'Pump Shotgun', kind: 'shotgun', damage: 11.5, rate: 0.85,
      mag: 5, reload: 3.4, spread: 0.085, adsSpread: 0.062, range: 40,
      ammo: 'shells', pellets: 9, headMult: 1.5, falloff: 14, sound: 'shotgun'
    },
    sniper: {
      id: 'sniper', name: 'Bolt-Action Sniper', kind: 'sniper', damage: 105, rate: 1.6,
      mag: 1, reload: 2.6, spread: 0.030, adsSpread: 0.0006, range: 400,
      ammo: 'heavy', pellets: 1, headMult: 2.5, falloff: 400, sound: 'sniper', scope: 3.2
    }
  };

  var AMMO_TYPES = { light: 'Light', medium: 'Medium', shells: 'Shells', heavy: 'Heavy' };

  /* Loot table weighted by rarity - legendaries stay rare. */
  var LOOT_WEIGHTS = [
    { w: 34, id: 'ar' }, { w: 26, id: 'shotgun' }, { w: 22, id: 'smg' },
    { w: 12, id: 'pistol' }, { w: 8, id: 'sniper' }
  ];
  var RARITY_WEIGHTS = [
    { w: 40, r: 'common' }, { w: 28, r: 'uncommon' }, { w: 18, r: 'rare' },
    { w: 10, r: 'epic' }, { w: 4, r: 'legendary' }
  ];

  function weighted(rand, table, key) {
    var total = 0, i;
    for (i = 0; i < table.length; i++) total += table[i].w;
    var roll = rand() * total;
    for (i = 0; i < table.length; i++) {
      roll -= table[i].w;
      if (roll <= 0) return table[i][key];
    }
    return table[table.length - 1][key];
  }

  function rollWeapon(rand, rarityBias) {
    var id = weighted(rand, LOOT_WEIGHTS, 'id');
    var r = weighted(rand, RARITY_WEIGHTS, 'r');
    if (rarityBias) {
      var idx = Math.min(RARITY_ORDER.length - 1, RARITY_ORDER.indexOf(r) + rarityBias);
      r = RARITY_ORDER[idx];
    }
    return makeItem(id, r);
  }

  function makeItem(id, rarity) {
    var def = WEAPONS[id];
    return {
      def: def, id: id, rarity: rarity || 'common',
      ammoInMag: def.mag || 0,
      damage: def.damage * RARITY[rarity || 'common'].mult
    };
  }

  /* ------------------------- view models ------------------------- */

  var gunMats = null;
  function ensureGunMats() {
    if (gunMats) return gunMats;
    gunMats = {
      body: new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.5, metalness: 0.65 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.6, metalness: 0.4 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8, metalness: 0.05 }),
      accent: new THREE.MeshStandardMaterial({ color: 0xd0d6de, roughness: 0.3, metalness: 0.85 })
    };
    return gunMats;
  }

  function bx(group, m, w, h, d, x, y, z) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }

  /* Guns point down -Z; the muzzle marker is where tracers originate. */
  function makeWeaponMesh(id, rarity) {
    var M = ensureGunMats();
    var g = new THREE.Group();
    var accent = new THREE.MeshStandardMaterial({
      color: RARITY[rarity || 'common'].color, roughness: 0.35, metalness: 0.7
    });

    if (id === 'pickaxe') {
      bx(g, M.wood, 0.07, 0.07, 0.95, 0, 0, -0.32);
      bx(g, M.accent, 0.10, 0.34, 0.10, 0, 0.10, -0.76);
      var blade = bx(g, M.accent, 0.09, 0.14, 0.34, 0, 0.16, -0.62);
      blade.rotation.x = 0.5;
    } else if (id === 'pistol') {
      bx(g, M.body, 0.09, 0.13, 0.42, 0, 0.02, -0.16);
      bx(g, M.dark, 0.08, 0.20, 0.11, 0, -0.14, 0.02);
      bx(g, accent, 0.05, 0.05, 0.10, 0, 0.05, -0.36);
    } else if (id === 'smg') {
      bx(g, M.body, 0.10, 0.15, 0.52, 0, 0.02, -0.20);
      bx(g, M.dark, 0.08, 0.22, 0.12, 0, -0.15, 0.0);
      bx(g, M.dark, 0.07, 0.26, 0.10, 0, -0.16, -0.16);
      bx(g, accent, 0.05, 0.05, 0.22, 0, 0.03, -0.52);
      bx(g, M.dark, 0.07, 0.09, 0.22, 0, 0.02, 0.18);
    } else if (id === 'ar') {
      bx(g, M.body, 0.10, 0.16, 0.78, 0, 0.02, -0.30);
      bx(g, M.dark, 0.08, 0.22, 0.12, 0, -0.15, -0.02);
      bx(g, M.dark, 0.08, 0.28, 0.11, 0, -0.18, -0.20);
      bx(g, accent, 0.05, 0.05, 0.34, 0, 0.03, -0.80);
      bx(g, M.dark, 0.08, 0.11, 0.30, 0, 0.0, 0.22);
      bx(g, M.accent, 0.03, 0.05, 0.16, 0, 0.13, -0.28);
    } else if (id === 'shotgun') {
      bx(g, M.body, 0.11, 0.14, 0.96, 0, 0.02, -0.38);
      bx(g, M.wood, 0.09, 0.13, 0.34, 0, -0.02, 0.24);
      bx(g, M.wood, 0.10, 0.11, 0.26, 0, -0.10, -0.44);
      bx(g, accent, 0.07, 0.07, 0.16, 0, 0.04, -0.90);
    } else if (id === 'sniper') {
      bx(g, M.body, 0.09, 0.13, 1.20, 0, 0.0, -0.46);
      bx(g, M.wood, 0.09, 0.15, 0.42, 0, -0.04, 0.30);
      bx(g, M.dark, 0.07, 0.20, 0.11, 0, -0.15, -0.04);
      bx(g, M.dark, 0.07, 0.09, 0.34, 0, 0.14, -0.22);
      bx(g, accent, 0.045, 0.045, 0.40, 0, 0.0, -1.10);
    }

    var muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.03, id === 'sniper' ? -1.32 : (id === 'shotgun' ? -1.0 : -0.72));
    muzzle.name = 'muzzle';
    g.add(muzzle);
    g.userData.muzzle = muzzle;
    return g;
  }

  /* ---------------------------- FX ---------------------------- */

  var FX = {
    scene: null,
    tracers: [], impacts: [], numbers: [],
    muzzleLight: null, muzzleSprite: null, muzzleT: 0
  };

  var tracerGeo = null, tracerMat = null;
  var puffMat = null, sparkMat = null;
  var numberCache = {};

  FX.init = function (scene) {
    FX.scene = scene;

    tracerGeo = new THREE.CylinderGeometry(0.035, 0.012, 1, 5, 1, true);
    tracerGeo.rotateX(Math.PI / 2);
    tracerGeo.translate(0, 0, -0.5);
    tracerMat = new THREE.MeshBasicMaterial({
      color: 0xfff0b0, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });

    puffMat = new THREE.SpriteMaterial({
      map: Tex.puff(), color: 0xd8cfc0, transparent: true, opacity: 0.8, depthWrite: false
    });
    sparkMat = new THREE.SpriteMaterial({
      map: Tex.puff(), color: 0xffd070, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false
    });

    for (var i = 0; i < 48; i++) {
      var t = new THREE.Mesh(tracerGeo, tracerMat.clone());
      t.visible = false; t.frustumCulled = false;
      scene.add(t);
      FX.tracers.push({ mesh: t, life: 0 });
    }
    for (var j = 0; j < 40; j++) {
      var s = new THREE.Sprite(puffMat.clone());
      s.visible = false;
      scene.add(s);
      FX.impacts.push({ sprite: s, life: 0, vy: 0 });
    }
    for (var k = 0; k < 20; k++) {
      var n = new THREE.Sprite(new THREE.SpriteMaterial({
        transparent: true, depthTest: false, depthWrite: false, fog: false
      }));
      n.visible = false; n.renderOrder = 900;
      scene.add(n);
      FX.numbers.push({ sprite: n, life: 0 });
    }

    FX.muzzleLight = new THREE.PointLight(0xffcc70, 0, 16, 2);
    scene.add(FX.muzzleLight);
    FX.muzzleSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: Tex.puff(), color: 0xffd88a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    FX.muzzleSprite.scale.set(0.9, 0.9, 1);
    scene.add(FX.muzzleSprite);
  };

  FX.tracer = function (from, to, color) {
    var slot = null;
    for (var i = 0; i < FX.tracers.length; i++) if (FX.tracers[i].life <= 0) { slot = FX.tracers[i]; break; }
    if (!slot) slot = FX.tracers[0];
    var m = slot.mesh;
    m.visible = true;
    m.position.copy(from);
    m.lookAt(to);
    var dist = from.distanceTo(to);
    m.scale.set(1, 1, dist);
    m.material.opacity = 0.9;
    m.material.color.setHex(color === undefined ? 0xfff0b0 : color);
    slot.life = 0.075;
  };

  FX.muzzle = function (pos) {
    FX.muzzleLight.position.copy(pos);
    FX.muzzleLight.intensity = 6;
    FX.muzzleSprite.position.copy(pos);
    FX.muzzleSprite.material.opacity = 0.95;
    FX.muzzleSprite.scale.setScalar(0.8 + Math.random() * 0.5);
    FX.muzzleT = 0.055;
  };

  FX.impact = function (pos, normal, kind) {
    var count = kind === 'flesh' ? 4 : 5;
    for (var c = 0; c < count; c++) {
      var slot = null;
      for (var i = 0; i < FX.impacts.length; i++) if (FX.impacts[i].life <= 0) { slot = FX.impacts[i]; break; }
      if (!slot) return;
      var s = slot.sprite;
      s.visible = true;
      s.position.copy(pos);
      if (normal) s.position.addScaledVector(normal, 0.05);
      s.position.x += (Math.random() - 0.5) * 0.28;
      s.position.y += (Math.random() - 0.5) * 0.28;
      s.position.z += (Math.random() - 0.5) * 0.28;
      var colors = {
        flesh: 0xd23c3c, wood: 0xb08050, brick: 0xbdb5aa,
        metal: 0xffd070, dirt: 0x9d8358, stone: 0xb0b4ba
      };
      s.material.color.setHex(colors[kind] || 0xb8b0a4);
      s.material.opacity = 0.85;
      s.material.blending = (kind === 'metal') ? THREE.AdditiveBlending : THREE.NormalBlending;
      var sc = 0.22 + Math.random() * 0.3;
      s.scale.set(sc, sc, 1);
      slot.life = 0.34 + Math.random() * 0.2;
      slot.vy = 0.6 + Math.random() * 1.2;
      slot.grow = 1.8 + Math.random();
    }
  };

  function numberTexture(text, color) {
    var k = text + '|' + color;
    if (numberCache[k]) return numberCache[k];
    var c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    var g = c.getContext('2d');
    g.font = 'bold 46px Inter, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.strokeText(text, 64, 34);
    g.fillStyle = color;
    g.fillText(text, 64, 34);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    numberCache[k] = t;
    return t;
  }

  FX.damageNumber = function (pos, amount, headshot, shieldHit) {
    var slot = null;
    for (var i = 0; i < FX.numbers.length; i++) if (FX.numbers[i].life <= 0) { slot = FX.numbers[i]; break; }
    if (!slot) return;
    var color = headshot ? '#ffd23f' : (shieldHit ? '#4fc3f7' : '#ffffff');
    slot.sprite.material.map = numberTexture(String(Math.round(amount)), color);
    slot.sprite.material.needsUpdate = true;
    slot.sprite.material.opacity = 1;
    slot.sprite.visible = true;
    slot.sprite.position.copy(pos);
    slot.sprite.position.x += (Math.random() - 0.5) * 0.5;
    slot.sprite.position.z += (Math.random() - 0.5) * 0.5;
    slot.scale = headshot ? 1.5 : 1.1;
    slot.sprite.scale.set(slot.scale, slot.scale * 0.5, 1);
    slot.life = 0.95;
  };

  FX.update = function (dt) {
    var i, s;
    for (i = 0; i < FX.tracers.length; i++) {
      s = FX.tracers[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.material.opacity = Math.max(0, s.life / 0.075) * 0.9;
      if (s.life <= 0) s.mesh.visible = false;
    }
    for (i = 0; i < FX.impacts.length; i++) {
      s = FX.impacts[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      s.sprite.position.y += s.vy * dt;
      s.vy -= 3.4 * dt;
      var sc = s.sprite.scale.x + s.grow * dt * 0.4;
      s.sprite.scale.set(sc, sc, 1);
      s.sprite.material.opacity = Math.max(0, s.life) * 2.0;
      if (s.life <= 0) s.sprite.visible = false;
    }
    for (i = 0; i < FX.numbers.length; i++) {
      s = FX.numbers[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      s.sprite.position.y += 1.5 * dt;
      s.sprite.material.opacity = Math.min(1, s.life * 2.2);
      if (s.life <= 0) s.sprite.visible = false;
    }
    if (FX.muzzleT > 0) {
      FX.muzzleT -= dt;
      var k = Math.max(0, FX.muzzleT / 0.055);
      FX.muzzleLight.intensity = 7 * k;
      FX.muzzleSprite.material.opacity = k;
      if (FX.muzzleT <= 0) { FX.muzzleLight.intensity = 0; FX.muzzleSprite.material.opacity = 0; }
    }
  };

  window.Weapons = {
    RARITY: RARITY, RARITY_ORDER: RARITY_ORDER, WEAPONS: WEAPONS, AMMO_TYPES: AMMO_TYPES,
    rollWeapon: rollWeapon, makeItem: makeItem, makeWeaponMesh: makeWeaponMesh, FX: FX
  };
})();
