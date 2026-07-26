/* Procedural stylized humanoid: built from primitives, animated by code. */
(function () {
  'use strict';

  var SKIN = [0xf2c9a0, 0xdda87c, 0xb87c50, 0x8a5a36, 0x5f3a22, 0xf7d9b8];
  var SHIRT = [0x2f6fd0, 0xd0402f, 0x2fa35c, 0x8a3fd0, 0xe08a1e, 0x1f2a38, 0xd0417f, 0x14a3a3];
  var PANTS = [0x2b3442, 0x4a3a2c, 0x1f2733, 0x3d3d45, 0x27402f];
  var BOT_NAMES = [
    'Vex', 'Rook', 'Nova', 'Slate', 'Piper', 'Kilo', 'Onyx', 'Mako', 'Wren', 'Dash',
    'Corvo', 'Juno', 'Blitz', 'Sable', 'Rhys', 'Tundra', 'Halo', 'Fennec', 'Cyclo', 'Marlow',
    'Quill', 'Ridge', 'Sol', 'Vector', 'Ash', 'Brim', 'Cinder', 'Drift', 'Ember', 'Flint'
  ];

  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({
      color: color, roughness: rough === undefined ? 0.75 : rough,
      metalness: metal === undefined ? 0.05 : metal
    });
  }

  function part(parent, geo, material, x, y, z) {
    var m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function pivot(parent, x, y, z) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  var GEO = null;
  function ensureGeo() {
    if (GEO) return GEO;
    GEO = {
      torso: new THREE.BoxGeometry(0.62, 0.66, 0.34),
      hips: new THREE.BoxGeometry(0.54, 0.26, 0.32),
      head: new THREE.BoxGeometry(0.36, 0.38, 0.36),
      hair: new THREE.BoxGeometry(0.38, 0.12, 0.38),
      upperArm: new THREE.BoxGeometry(0.17, 0.36, 0.19),
      foreArm: new THREE.BoxGeometry(0.15, 0.34, 0.17),
      hand: new THREE.BoxGeometry(0.14, 0.14, 0.15),
      thigh: new THREE.BoxGeometry(0.22, 0.42, 0.24),
      shin: new THREE.BoxGeometry(0.20, 0.42, 0.21),
      foot: new THREE.BoxGeometry(0.22, 0.12, 0.34),
      pack: new THREE.BoxGeometry(0.42, 0.44, 0.20),
      eye: new THREE.BoxGeometry(0.07, 0.08, 0.03)
    };
    /* Shift each limb geometry so its pivot sits at the joint, not the centre. */
    GEO.upperArm.translate(0, -0.18, 0);
    GEO.foreArm.translate(0, -0.17, 0);
    GEO.thigh.translate(0, -0.21, 0);
    GEO.shin.translate(0, -0.21, 0);
    return GEO;
  }

  function Character(opts) {
    opts = opts || {};
    ensureGeo();
    var rand = opts.rand || Math.random;

    this.skin = opts.skin !== undefined ? opts.skin : SKIN[Math.floor(rand() * SKIN.length)];
    this.shirt = opts.shirt !== undefined ? opts.shirt : SHIRT[Math.floor(rand() * SHIRT.length)];
    this.pants = opts.pants !== undefined ? opts.pants : PANTS[Math.floor(rand() * PANTS.length)];

    var mSkin = mat(this.skin, 0.85);
    var mShirt = mat(this.shirt, 0.8);
    var mPants = mat(this.pants, 0.85);
    var mBoot = mat(0x23282f, 0.7);
    var mDark = mat(0x1a1d22, 0.6);

    this.materials = [mSkin, mShirt, mPants, mBoot, mDark];

    var root = new THREE.Group();
    this.root = root;

    var hips = pivot(root, 0, 0.92, 0);
    this.hips = hips;
    part(hips, GEO.hips, mPants, 0, 0, 0);

    var chest = pivot(hips, 0, 0.16, 0);
    this.chest = chest;
    part(chest, GEO.torso, mShirt, 0, 0.31, 0);
    part(chest, GEO.pack, mDark, 0, 0.34, -0.26);

    var neck = pivot(chest, 0, 0.68, 0);
    this.neck = neck;
    var head = part(neck, GEO.head, mSkin, 0, 0.19, 0);
    part(neck, GEO.hair, mDark, 0, 0.40, 0);
    part(neck, GEO.eye, mDark, -0.09, 0.22, 0.185);
    part(neck, GEO.eye, mDark, 0.09, 0.22, 0.185);
    this.head = head;

    /* arms */
    this.armR = pivot(chest, -0.38, 0.55, 0);
    part(this.armR, GEO.upperArm, mShirt, 0, 0, 0);
    this.foreR = pivot(this.armR, 0, -0.35, 0);
    part(this.foreR, GEO.foreArm, mSkin, 0, 0, 0);
    this.handR = pivot(this.foreR, 0, -0.34, 0);
    part(this.handR, GEO.hand, mSkin, 0, 0, 0);

    this.armL = pivot(chest, 0.38, 0.55, 0);
    part(this.armL, GEO.upperArm, mShirt, 0, 0, 0);
    this.foreL = pivot(this.armL, 0, -0.35, 0);
    part(this.foreL, GEO.foreArm, mSkin, 0, 0, 0);
    this.handL = pivot(this.foreL, 0, -0.34, 0);
    part(this.handL, GEO.hand, mSkin, 0, 0, 0);

    /* legs */
    this.legR = pivot(hips, -0.15, -0.14, 0);
    part(this.legR, GEO.thigh, mPants, 0, 0, 0);
    this.shinR = pivot(this.legR, 0, -0.42, 0);
    part(this.shinR, GEO.shin, mPants, 0, 0, 0);
    part(this.shinR, GEO.foot, mBoot, 0, -0.44, 0.05);

    this.legL = pivot(hips, 0.15, -0.14, 0);
    part(this.legL, GEO.thigh, mPants, 0, 0, 0);
    this.shinL = pivot(this.legL, 0, -0.42, 0);
    part(this.shinL, GEO.shin, mPants, 0, 0, 0);
    part(this.shinL, GEO.foot, mBoot, 0, -0.44, 0.05);

    /* right hand holds the weapon */
    this.weaponAnchor = pivot(this.handR, 0, -0.08, 0.06);
    this.weaponAnchor.rotation.set(Math.PI / 2, 0, 0);

    this.phase = 0;
    this.weaponMesh = null;
    this.glider = null;
    this.height = 1.82;
  }

  Character.prototype.setWeapon = function (mesh) {
    if (this.weaponMesh) this.weaponAnchor.remove(this.weaponMesh);
    this.weaponMesh = mesh || null;
    if (mesh) this.weaponAnchor.add(mesh);
  };

  Character.prototype.setNameTag = function (text, color) {
    if (!this.tag) {
      var c = document.createElement('canvas');
      c.width = 256; c.height = 80;
      this.tagCanvas = c;
      var spriteMat = new THREE.SpriteMaterial({
        transparent: true, depthTest: false, depthWrite: false, fog: false
      });
      this.tag = new THREE.Sprite(spriteMat);
      this.tag.scale.set(2.0, 0.62, 1);
      this.tag.position.y = 2.35;
      this.tag.renderOrder = 950;
      this.root.add(this.tag);
    }
    this.tagText = text;
    this.tagColor = color || '#ffffff';
    this.drawTag(1);
  };

  Character.prototype.drawTag = function (healthFrac, shieldFrac) {
    if (!this.tag) return;
    var c = this.tagCanvas, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.font = 'bold 30px Inter, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.strokeText(this.tagText, 128, 22);
    g.fillStyle = this.tagColor;
    g.fillText(this.tagText, 128, 22);

    var bw = 170, bh = 9, bx = (256 - bw) / 2, by = 48;
    g.fillStyle = 'rgba(0,0,0,0.62)';
    g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    g.fillStyle = '#3ddc6b';
    g.fillRect(bx, by, bw * U.clamp(healthFrac, 0, 1), bh);
    if (shieldFrac > 0) {
      g.fillStyle = 'rgba(0,0,0,0.62)';
      g.fillRect(bx - 2, by + bh + 1, bw + 4, 7);
      g.fillStyle = '#4fc3f7';
      g.fillRect(bx, by + bh + 2, bw * U.clamp(shieldFrac, 0, 1), 5);
    }
    if (this.tag.material.map) this.tag.material.map.dispose();
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    this.tag.material.map = t;
    this.tag.material.needsUpdate = true;
  };

  Character.prototype.setGlider = function (on) {
    if (on && !this.glider) {
      var g = new THREE.Group();
      var canopy = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: this.shirt, roughness: 0.7, side: THREE.DoubleSide, metalness: 0.1
        })
      );
      canopy.scale.set(1.5, 0.55, 1.0);
      canopy.castShadow = true;
      g.add(canopy);
      var lineMat = new THREE.LineBasicMaterial({ color: 0x2a2f36 });
      var pts = [];
      [[-1.6, 0], [1.6, 0], [0, -0.8], [0, 0.8]].forEach(function (p) {
        pts.push(new THREE.Vector3(p[0], 0, p[1]), new THREE.Vector3(0, -1.5, 0));
      });
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      g.position.set(0, 3.2, 0);
      this.root.add(g);
      this.glider = g;
    } else if (!on && this.glider) {
      this.root.remove(this.glider);
      this.glider = null;
    }
  };

  var EASE = 12;

  /* state: { speed, grounded, aiming, pitch, crouch, sprint, airborne, glide, firing } */
  Character.prototype.update = function (dt, state) {
    var s = state || {};
    var speed = s.speed || 0;
    var moving = speed > 0.4 && s.grounded;

    if (moving) this.phase += dt * U.clamp(speed * 1.15, 3.5, 13);
    else this.phase += dt * 2.2;

    var swing = moving ? U.clamp(speed / 7, 0.25, 1.0) : 0;
    var sw = Math.sin(this.phase);
    var cw = Math.cos(this.phase);

    /* legs */
    if (s.glide || (!s.grounded && !s.airborneLand)) {
      this.legR.rotation.x = U.damp(this.legR.rotation.x, s.glide ? -0.15 : 0.35, EASE, dt);
      this.legL.rotation.x = U.damp(this.legL.rotation.x, s.glide ? 0.15 : -0.2, EASE, dt);
      this.shinR.rotation.x = U.damp(this.shinR.rotation.x, s.glide ? 0.25 : -0.75, EASE, dt);
      this.shinL.rotation.x = U.damp(this.shinL.rotation.x, 0.25, EASE, dt);
    } else {
      var legAmp = 0.85 * swing;
      this.legR.rotation.x = U.damp(this.legR.rotation.x, sw * legAmp, EASE, dt);
      this.legL.rotation.x = U.damp(this.legL.rotation.x, -sw * legAmp, EASE, dt);
      this.shinR.rotation.x = U.damp(this.shinR.rotation.x, Math.max(0, -sw) * 1.1 * swing, EASE, dt);
      this.shinL.rotation.x = U.damp(this.shinL.rotation.x, Math.max(0, sw) * 1.1 * swing, EASE, dt);
    }

    /* torso: bob, lean into the run, crouch compression */
    var crouchDrop = s.crouch ? -0.32 : 0;
    var bob = moving ? Math.sin(this.phase * 2) * 0.045 * swing : Math.sin(this.phase * 0.8) * 0.012;
    this.hips.position.y = U.damp(this.hips.position.y, 0.92 + crouchDrop + bob, 14, dt);
    this.hips.rotation.y = U.damp(this.hips.rotation.y, moving ? cw * 0.09 * swing : 0, EASE, dt);

    var lean = s.glide ? 0.35 : (moving ? U.clamp(speed / 26, 0, 0.22) : 0) + (s.crouch ? 0.22 : 0);
    this.chest.rotation.x = U.damp(this.chest.rotation.x, lean, EASE, dt);
    this.chest.rotation.y = U.damp(this.chest.rotation.y, moving ? -cw * 0.07 * swing : 0, EASE, dt);

    /* head tracks aim pitch */
    var pitch = U.clamp(s.pitch || 0, -1.0, 1.0);
    this.neck.rotation.x = U.damp(this.neck.rotation.x, pitch * 0.55 - lean, EASE, dt);

    /* arms */
    var targetArmR, targetArmL, targetForeR, targetForeL, armRz, armLz;
    if (s.glide) {
      targetArmR = -2.5; targetArmL = -2.5;
      targetForeR = -0.2; targetForeL = -0.2;
      armRz = -0.5; armLz = 0.5;
    } else if (s.hasWeapon) {
      /* Both hands to the gun; the right arm carries the aim pitch. */
      var ready = s.aiming ? -1.62 : -1.32;
      targetArmR = ready - pitch * 0.85;
      targetArmL = ready - pitch * 0.85;
      targetForeR = s.aiming ? -0.12 : -0.32;
      targetForeL = -0.72;
      armRz = 0.16; armLz = -0.52;
    } else {
      targetArmR = sw * -0.75 * swing;
      targetArmL = -sw * -0.75 * swing;
      targetForeR = -0.32 - Math.max(0, sw) * 0.4 * swing;
      targetForeL = -0.32 - Math.max(0, -sw) * 0.4 * swing;
      armRz = 0.12; armLz = -0.12;
    }

    if (s.swing !== undefined && s.swing > 0) {
      /* pickaxe arc */
      var k = s.swing;
      targetArmR = -2.6 + (1 - k) * 3.4;
      targetForeR = -0.5 * k;
      armRz = 0.35;
    }

    this.armR.rotation.x = U.damp(this.armR.rotation.x, targetArmR, EASE, dt);
    this.armL.rotation.x = U.damp(this.armL.rotation.x, targetArmL, EASE, dt);
    this.armR.rotation.z = U.damp(this.armR.rotation.z, armRz, EASE, dt);
    this.armL.rotation.z = U.damp(this.armL.rotation.z, armLz, EASE, dt);
    this.foreR.rotation.x = U.damp(this.foreR.rotation.x, targetForeR, EASE, dt);
    this.foreL.rotation.x = U.damp(this.foreL.rotation.x, targetForeL, EASE, dt);

    /* recoil kick */
    if (s.recoil > 0) {
      this.armR.rotation.x -= s.recoil * 0.35;
      this.armL.rotation.x -= s.recoil * 0.28;
      this.chest.rotation.x -= s.recoil * 0.1;
    }
  };

  Character.prototype.dispose = function () {
    if (this.tag && this.tag.material.map) this.tag.material.map.dispose();
  };

  Character.randomName = function (rand, used) {
    var pool = BOT_NAMES;
    for (var i = 0; i < 60; i++) {
      var base = pool[Math.floor(rand() * pool.length)];
      var n = base + (rand() < 0.5 ? '' : String(Math.floor(rand() * 90) + 10));
      if (!used || used.indexOf(n) < 0) return n;
    }
    return 'Player' + Math.floor(rand() * 9999);
  };

  window.Character = Character;
})();
