/* Match flow, storm, combat resolution, HUD and the render loop. */
(function () {
  'use strict';

  var TOTAL_PLAYERS = 50;
  var PHYSICAL_BOTS = 14;

  var Game = {
    scene: null, camera: null, renderer: null,
    player: null, bots: [], chests: [], pickups: [],
    storm: null, rayTargets: [],
    state: 'menu',   // menu | bus | playing | dead | won
    aliveCount: TOTAL_PLAYERS,
    virtualRemaining: 0,
    time: 0, seed: 0,
    quality: 'high'
  };
  window.Game = Game;

  var clock = null;
  var sun = null, hemi = null, ambient = null;
  var stormMesh = null, stormInner = null;
  var bus = null, busT = 0, busFrom = null, busTo = null;
  var rosterNames = [];
  var rand = Math.random;
  var els = {};
  var lastHud = {};
  var minimapBase = null;
  var minimapT = 0;
  var pointerLocked = false;

  /* ------------------------------ input ------------------------------ */

  var input = {
    forward: false, back: false, left: false, right: false,
    jump: false, sprint: false, crouch: false,
    fire: false, aim: false,
    mouseX: 0, mouseY: 0,
    sensitivity: 0.0022
  };
  var keys = {};

  function bindInput() {
    var canvas = Game.renderer.domElement;

    canvas.addEventListener('click', function () {
      if (Game.state === 'playing' || Game.state === 'bus') {
        if (!pointerLocked) canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', function () {
      pointerLocked = document.pointerLockElement === canvas;
      if (!pointerLocked && (Game.state === 'playing' || Game.state === 'bus')) showPause(true);
      else showPause(false);
    });

    document.addEventListener('mousemove', function (e) {
      if (!pointerLocked) return;
      var scale = input.sensitivity * (Game.player && Game.player.aiming ? 0.55 : 1);
      input.mouseX += e.movementX * scale;
      input.mouseY += e.movementY * scale;
    });

    document.addEventListener('mousedown', function (e) {
      if (!pointerLocked) return;
      if (e.button === 0) input.fire = true;
      if (e.button === 2) input.aim = true;
    });
    document.addEventListener('mouseup', function (e) {
      if (e.button === 0) input.fire = false;
      if (e.button === 2) input.aim = false;
    });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    document.addEventListener('wheel', function (e) {
      if (!pointerLocked || Game.state !== 'playing') return;
      Game.player.cycleSlot(e.deltaY > 0 ? 1 : -1);
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('keydown', function (e) {
      if (keys[e.code]) return;
      keys[e.code] = true;
      onKeyDown(e);
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    window.addEventListener('blur', function () { keys = {}; });
  }

  function onKeyDown(e) {
    var p = Game.player;
    if (e.code === 'Escape') return;

    if (Game.state === 'bus' && (e.code === 'Space' || e.code === 'Enter')) {
      leaveBus();
      e.preventDefault();
      return;
    }
    if (Game.state !== 'playing') return;

    switch (e.code) {
      case 'Digit1': p.selectSlot(0); break;
      case 'Digit2': p.selectSlot(1); break;
      case 'Digit3': p.selectSlot(2); break;
      case 'Digit4': p.selectSlot(3); break;
      case 'Digit5': p.selectSlot(4); break;
      case 'KeyR': p.startReload(); break;
      case 'KeyE': tryInteract(); break;
      case 'KeyZ': p.setBuild('wall'); break;
      case 'KeyX': p.setBuild('floor'); break;
      case 'KeyC': p.setBuild('ramp'); break;
      case 'KeyV': p.setBuild('cone'); break;
      case 'KeyF': p.cycleMat(); break;
      case 'KeyQ': if (p.buildMode) { p.buildMode = false; p.refreshWeaponMesh(); } break;
      case 'KeyM': toggleBigMap(); break;
      case 'Space': e.preventDefault(); break;
    }
  }

  function readKeys() {
    input.forward = !!(keys.KeyW || keys.ArrowUp);
    input.back = !!(keys.KeyS || keys.ArrowDown);
    input.left = !!(keys.KeyA || keys.ArrowLeft);
    input.right = !!(keys.KeyD || keys.ArrowRight);
    input.jump = !!keys.Space;
    input.sprint = !!(keys.ShiftLeft || keys.ShiftRight);
    input.crouch = !!(keys.ControlLeft || keys.ControlRight);
  }

  /* --------------------------- touch controls --------------------------- */

  var touch = { moveId: null, lookId: null, moveX: 0, moveY: 0, ox: 0, oy: 0, lx: 0, ly: 0 };

  function bindTouch() {
    if (!('ontouchstart' in window)) return;
    document.body.classList.add('touch');
    var stick = els.stick, knob = els.knob;

    function pos(t) { return { x: t.clientX, y: t.clientY }; }

    document.addEventListener('touchstart', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.target.closest && t.target.closest('.tbtn')) continue;
        if (t.clientX < window.innerWidth * 0.45 && touch.moveId === null) {
          touch.moveId = t.identifier;
          touch.ox = t.clientX; touch.oy = t.clientY;
          stick.style.display = 'block';
          stick.style.left = (t.clientX - 60) + 'px';
          stick.style.top = (t.clientY - 60) + 'px';
        } else if (touch.lookId === null) {
          touch.lookId = t.identifier;
          touch.lx = t.clientX; touch.ly = t.clientY;
        }
      }
    }, { passive: false });

    document.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === touch.moveId) {
          var dx = U.clamp((t.clientX - touch.ox) / 55, -1, 1);
          var dy = U.clamp((t.clientY - touch.oy) / 55, -1, 1);
          touch.moveX = dx; touch.moveY = dy;
          knob.style.transform = 'translate(' + dx * 38 + 'px,' + dy * 38 + 'px)';
        } else if (t.identifier === touch.lookId) {
          input.mouseX += (t.clientX - touch.lx) * 0.005;
          input.mouseY += (t.clientY - touch.ly) * 0.005;
          touch.lx = t.clientX; touch.ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });

    function end(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === touch.moveId) {
          touch.moveId = null; touch.moveX = touch.moveY = 0;
          stick.style.display = 'none';
          knob.style.transform = 'translate(0,0)';
        }
        if (t.identifier === touch.lookId) touch.lookId = null;
      }
    }
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);

    function btn(id, down, up) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); down(); });
      el.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); if (up) up(); });
    }
    btn('t-fire', function () { input.fire = true; }, function () { input.fire = false; });
    btn('t-aim', function () { input.aim = !input.aim; });
    btn('t-jump', function () { keys.Space = true; if (Game.state === 'bus') leaveBus(); },
      function () { keys.Space = false; });
    btn('t-build', function () { Game.player.setBuild('wall'); });
    btn('t-ramp', function () { Game.player.setBuild('ramp'); });
    btn('t-mat', function () { Game.player.cycleMat(); });
    btn('t-swap', function () { Game.player.cycleSlot(1); });
    btn('t-use', function () { tryInteract(); });
    btn('t-reload', function () { Game.player.startReload(); });
  }

  function applyTouchMove() {
    if (touch.moveId === null) return;
    if (Math.abs(touch.moveY) > 0.25) {
      input.forward = touch.moveY < 0;
      input.back = touch.moveY > 0;
    }
    if (Math.abs(touch.moveX) > 0.25) {
      input.right = touch.moveX > 0;
      input.left = touch.moveX < 0;
    }
    input.sprint = Math.hypot(touch.moveX, touch.moveY) > 0.85;
  }

  /* ------------------------------ setup ------------------------------ */

  function init() {
    var canvas = document.getElementById('game');
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    Game.renderer = renderer;

    Game.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.15, 1400);

    window.addEventListener('resize', function () {
      Game.camera.aspect = window.innerWidth / window.innerHeight;
      Game.camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    ['crosshair', 'hp-fill', 'sh-fill', 'hp-num', 'sh-num', 'alive', 'kills',
      'storm-label', 'storm-time', 'minimap', 'killfeed', 'compass', 'prompt',
      'flash', 'hitmarker', 'scope', 'toast', 'slots', 'mats', 'ammo-mag',
      'ammo-res', 'weapon-name', 'menu', 'result', 'pause', 'bigmap',
      'stick', 'knob', 'buildbar', 'storm-vignette', 'bus-hint', 'loading'
    ].forEach(function (id) { els[id.replace(/-/g, '')] = document.getElementById(id); });

    els.stick = document.getElementById('stick');
    els.knob = document.getElementById('knob');

    bindInput();
    bindTouch();

    document.getElementById('btn-play').addEventListener('click', function () {
      Audio2.resume(); Audio2.uiClick();
      startMatch();
    });
    document.getElementById('btn-again').addEventListener('click', function () {
      Audio2.uiClick();
      startMatch();
    });
    document.getElementById('btn-resume').addEventListener('click', function () {
      Audio2.uiClick();
      Game.renderer.domElement.requestPointerLock();
    });
    var soundBtn = document.getElementById('btn-sound');
    soundBtn.addEventListener('click', function () {
      Audio2.setEnabled(!Audio2.isEnabled());
      soundBtn.textContent = Audio2.isEnabled() ? 'SOUND: ON' : 'SOUND: OFF';
    });

    clock = new THREE.Clock();
    requestAnimationFrame(loop);
  }

  function buildScene(seed) {
    var scene = new THREE.Scene();
    Game.scene = scene;
    scene.fog = new THREE.Fog(0xb8d6ea, 140, 620);

    /* Bright sky fill keeps shadowed walls readable instead of near-black. */
    hemi = new THREE.HemisphereLight(0xa8d6ff, 0x5c7a44, 0.85);
    scene.add(hemi);
    ambient = new THREE.AmbientLight(0xffffff, 0.30);
    scene.add(ambient);

    sun = new THREE.DirectionalLight(0xfff0cf, 1.55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 340;
    sun.shadow.camera.left = -78;
    sun.shadow.camera.right = 78;
    sun.shadow.camera.top = 78;
    sun.shadow.camera.bottom = -78;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    scene.add(sun.target);

    World.build(scene, seed);
    Build.init(scene);
    Weapons.FX.init(scene);

    /* storm wall */
    var stormGeo = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true);
    var stormTex = Tex.storm();
    stormTex.repeat.set(18, 3);
    stormMesh = new THREE.Mesh(stormGeo, new THREE.MeshBasicMaterial({
      map: stormTex, color: 0xb87cff, transparent: true, opacity: 0.42,
      side: THREE.DoubleSide, depthWrite: false, fog: false
    }));
    stormMesh.renderOrder = 5;
    scene.add(stormMesh);

    var innerTex = Tex.storm().clone();
    innerTex.needsUpdate = true;
    innerTex.wrapS = innerTex.wrapT = THREE.RepeatWrapping;
    innerTex.repeat.set(9, 2);
    stormInner = new THREE.Mesh(stormGeo, new THREE.MeshBasicMaterial({
      map: innerTex, color: 0x7a3fd0, transparent: true, opacity: 0.20,
      side: THREE.DoubleSide, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending
    }));
    stormInner.renderOrder = 6;
    scene.add(stormInner);

    /* battle bus */
    bus = new THREE.Group();
    var busBody = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 3.4, 11),
      new THREE.MeshStandardMaterial({ color: 0x2f7fd0, roughness: 0.5, metalness: 0.3 })
    );
    busBody.castShadow = true;
    bus.add(busBody);
    var balloon = new THREE.Mesh(
      new THREE.SphereGeometry(4.2, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0xe04f4f, roughness: 0.6 })
    );
    balloon.position.y = 8.5;
    balloon.scale.set(1, 1.15, 1);
    bus.add(balloon);
    var lineMat = new THREE.LineBasicMaterial({ color: 0x1a1d22 });
    var pts = [];
    [[-1.6, -4], [1.6, -4], [-1.6, 4], [1.6, 4]].forEach(function (p) {
      pts.push(new THREE.Vector3(p[0], 1.7, p[1]), new THREE.Vector3(0, 5.4, 0));
    });
    bus.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    scene.add(bus);

    minimapBase = renderMinimapBase();
  }

  /* ------------------------------ match ------------------------------ */

  function startMatch() {
    els.menu.style.display = 'none';
    els.result.style.display = 'none';
    els.loading.style.display = 'flex';

    /* Let the browser paint the loading card before the heavy build. */
    setTimeout(function () {
      Game.seed = (Math.random() * 1e9) | 0;
      rand = U.rng(Game.seed);

      if (Game.scene) disposeScene();
      buildScene(Game.seed);

      Game.player = new Player(Game.scene);
      Game.bots = [];
      Game.chests = [];
      Game.pickups = [];
      Game.aliveCount = TOTAL_PLAYERS;
      Game.virtualRemaining = TOTAL_PLAYERS - 1 - PHYSICAL_BOTS;
      Game.kills = 0;
      Game.time = 0;

      spawnChests();
      initStorm();
      buildRoster();

      /* bus path across the island */
      var a = rand() * Math.PI * 2;
      var r = World.HALF * 1.25;
      busFrom = new THREE.Vector3(Math.cos(a) * r, 265, Math.sin(a) * r);
      busTo = new THREE.Vector3(-Math.cos(a) * r + (rand() - 0.5) * 120, 265, -Math.sin(a) * r + (rand() - 0.5) * 120);
      busT = 0;

      Game.player.reset(busFrom.x, busFrom.y, busFrom.z);
      Game.player.char.root.visible = false;
      Game.state = 'bus';

      virtualTimer = 12;
      els.loading.style.display = 'none';
      els.bushint.style.display = 'block';
      killfeedClear();
      toast('MATCH STARTING', 'Press SPACE to jump from the bus');
      Game.renderer.domElement.requestPointerLock();
    }, 60);
  }

  function disposeScene() {
    Build.reset();
    Game.scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
        else o.material.dispose();
      }
    });
    Game.scene = null;
  }

  function buildRoster() {
    rosterNames = [];
    var used = [];
    for (var i = 0; i < TOTAL_PLAYERS; i++) {
      var n = Character.randomName(rand, used);
      used.push(n);
      rosterNames.push(n);
    }
  }

  function spawnBots() {
    for (var i = 0; i < PHYSICAL_BOTS; i++) {
      var p = pickBotSpawn();
      var bot = new Bot(Game.scene, {
        rand: rand, id: i, name: rosterNames[i + 1],
        x: p.x, y: World.heightAt(p.x, p.z), z: p.z
      });
      bot.mats.wood = 150 + Math.floor(rand() * 200);
      bot.mats.brick = Math.floor(rand() * 150);
      bot.mats.metal = Math.floor(rand() * 100);
      Game.bots.push(bot);
    }
  }

  function pickBotSpawn() {
    /* Spread bots over POIs first, then anywhere on land. */
    for (var i = 0; i < 30; i++) {
      var usePoi = rand() < 0.7 && World.pois.length;
      var x, z;
      if (usePoi) {
        var poi = World.pois[Math.floor(rand() * World.pois.length)];
        x = poi.x + (rand() - 0.5) * poi.radius * 1.6;
        z = poi.z + (rand() - 0.5) * poi.radius * 1.6;
      } else {
        var pt = World.randomLandPoint(rand);
        x = pt.x; z = pt.z;
      }
      if (World.heightAt(x, z) < World.WATER_Y + 1.5) continue;
      var far = !Game.player || Math.hypot(x - Game.player.pos.x, z - Game.player.pos.z) > 55;
      if (far) return { x: x, z: z };
    }
    return World.randomLandPoint(rand);
  }

  function spawnChests() {
    var count = 0;
    for (var i = 0; i < World.pois.length; i++) {
      var poi = World.pois[i];
      var spots = poi.lootSpots || [];
      for (var s = 0; s < spots.length; s++) {
        if (rand() < 0.62) {
          var sp = spots[s];
          var y = World.supportAt(sp.x, sp.z, sp.y + 1.5, 2.0).y;
          Game.chests.push(new Loot.Chest(Game.scene, sp.x, y, sp.z, rand));
          count++;
        }
      }
    }
    /* a few in the wild so open ground isn't dead space */
    for (var w = 0; w < 16; w++) {
      var pt = World.randomLandPoint(rand);
      Game.chests.push(new Loot.Chest(Game.scene, pt.x, World.heightAt(pt.x, pt.z), pt.z, rand));
    }
  }

  function leaveBus() {
    if (Game.state !== 'bus') return;
    var p = Game.player;
    p.pos.copy(bus.position);
    p.pos.y -= 3;
    var dir = new THREE.Vector3().subVectors(busTo, busFrom).normalize();
    p.vel.set(dir.x * 12, -4, dir.z * 12);
    p.mode = 'skydive';
    p.char.root.visible = true;
    p.yaw = Math.atan2(dir.x, dir.z);
    p.pitch = -0.55;
    Game.state = 'playing';
    els.bushint.style.display = 'none';
    spawnBots();
    toast('DROP!', 'Steer with WASD - glider deploys automatically');
  }

  Game.onLanded = function () {
    toast('LANDED', 'Find loot, build cover, survive');
  };

  /* ------------------------------ storm ------------------------------ */

  var PHASES = [
    { wait: 42, shrink: 60, r: 0.62, dps: 1 },
    { wait: 34, shrink: 48, r: 0.42, dps: 2 },
    { wait: 28, shrink: 40, r: 0.27, dps: 4 },
    { wait: 24, shrink: 34, r: 0.16, dps: 7 },
    { wait: 20, shrink: 28, r: 0.07, dps: 10 },
    { wait: 16, shrink: 24, r: 0.015, dps: 12 }
  ];

  function initStorm() {
    var R = World.HALF * 1.12;
    Game.storm = {
      x: 0, z: 0, radius: R, baseRadius: R,
      fromX: 0, fromZ: 0, fromRadius: R,
      nextX: 0, nextZ: 0, nextRadius: R,
      phase: -1, state: 'wait', timer: 20, dps: 0, closing: false
    };
    advanceStorm();
  }

  function advanceStorm() {
    var s = Game.storm;
    s.phase++;
    if (s.phase >= PHASES.length) {
      s.state = 'final';
      s.timer = 9999;
      s.dps = 14;
      return;
    }
    var ph = PHASES[s.phase];
    s.nextRadius = s.baseRadius * ph.r;
    var maxOffset = Math.max(0, s.radius - s.nextRadius) * 0.8;
    var a = rand() * Math.PI * 2;
    var d = rand() * maxOffset;
    s.nextX = s.x + Math.cos(a) * d;
    s.nextZ = s.z + Math.sin(a) * d;
    s.fromX = s.x; s.fromZ = s.z; s.fromRadius = s.radius;
    s.state = 'wait';
    s.timer = ph.wait;
    s.dps = ph.dps;
    s.closing = false;
  }

  function updateStorm(dt) {
    var s = Game.storm;
    if (s.state === 'final') return;
    s.timer -= dt;

    if (s.state === 'wait') {
      if (s.timer <= 0) {
        s.state = 'shrink';
        s.closing = true;
        s.timer = PHASES[s.phase].shrink;
        s.shrinkTotal = s.timer;
        Audio2.stormWarn();
        toast('THE STORM IS CLOSING', 'Get inside the circle');
      } else if (s.timer < 10.02 && s.timer > 9.98) {
        Audio2.stormWarn();
      }
    } else {
      var t = 1 - U.clamp(s.timer / s.shrinkTotal, 0, 1);
      var e = U.smoothstep(t);
      s.x = U.lerp(s.fromX, s.nextX, e);
      s.z = U.lerp(s.fromZ, s.nextZ, e);
      s.radius = U.lerp(s.fromRadius, s.nextRadius, e);
      if (s.timer <= 0) advanceStorm();
    }

    stormMesh.position.set(s.x, 200, s.z);
    stormMesh.scale.set(s.radius, 500, s.radius);
    stormInner.position.set(s.x, 200, s.z);
    stormInner.scale.set(s.radius * 0.985, 500, s.radius * 0.985);
    stormMesh.material.map.offset.x -= dt * 0.03;
    stormInner.material.map.offset.x += dt * 0.05;
    stormMesh.material.map.offset.y -= dt * 0.012;
  }

  function stormDamage(dt) {
    var s = Game.storm;
    var p = Game.player;
    if (p.alive) {
      var d = Math.hypot(p.pos.x - s.x, p.pos.z - s.z);
      var outside = d > s.radius;
      if (outside) {
        if (p.damage(s.dps * dt, null)) onPlayerDeath('the storm');
      }
      var proximity = U.clamp((d - s.radius + 45) / 45, 0, 1);
      Audio2.storm(outside ? 1 : proximity * 0.55);
      els.stormvignette.style.opacity = outside ? '1' : (proximity * 0.35).toFixed(2);
      Game.scene.fog.color.setHex(outside ? 0x6b3fb0 : 0xb8d6ea);
      hemi.color.setHex(outside ? 0x9a7ad0 : 0xa8d6ff);
    }
    for (var i = 0; i < Game.bots.length; i++) {
      var b = Game.bots[i];
      if (!b.alive) continue;
      if (Math.hypot(b.pos.x - s.x, b.pos.z - s.z) > s.radius) {
        if (b.damage(s.dps * dt, null, null)) killBot(b, 'the storm');
      }
    }
  }

  /* ---------------------------- combat ---------------------------- */

  var _o = new THREE.Vector3(), _d = new THREE.Vector3(), _tmp = new THREE.Vector3();
  var _rc = new THREE.Raycaster();

  function raySphere(origin, dir, center, radius) {
    _tmp.subVectors(center, origin);
    var tca = _tmp.dot(dir);
    if (tca < 0) return -1;
    var d2 = _tmp.lengthSq() - tca * tca;
    var r2 = radius * radius;
    if (d2 > r2) return -1;
    var thc = Math.sqrt(r2 - d2);
    var t0 = tca - thc;
    return t0 >= 0 ? t0 : (tca + thc);
  }

  function entityHit(entity, origin, dir, maxDist) {
    if (!entity || !entity.alive) return null;
    var p = entity.pos;
    var head = _tmp.set(0, 0, 0);
    var tBody = raySphere(origin, dir, new THREE.Vector3(p.x, p.y + 0.95, p.z), 0.52);
    var tHead = raySphere(origin, dir, new THREE.Vector3(p.x, p.y + 1.72, p.z), 0.30);
    var t = -1, isHead = false;
    if (tHead >= 0 && (tBody < 0 || tHead < tBody)) { t = tHead; isHead = true; }
    else if (tBody >= 0) { t = tBody; }
    if (t < 0 || t > maxDist) return null;
    return { entity: entity, dist: t, head: isHead };
  }

  function surfaceKind(obj) {
    if (!obj) return 'dirt';
    if (obj.userData.piece) {
      var m = obj.userData.piece.mat;
      return m === 'wood' ? 'wood' : (m === 'brick' ? 'brick' : 'metal');
    }
    if (obj.userData.props) return obj.userData.propKind === 'rock' ? 'stone' : 'wood';
    if (obj.userData.prop) return 'metal';
    if (obj.userData.terrain) return 'dirt';
    return 'brick';
  }

  Game.hitscan = function (origin, dir, range, shooter, damage, def) {
    _o.copy(origin); _d.copy(dir).normalize();

    _rc.set(_o, _d);
    _rc.far = range;
    var hits = _rc.intersectObjects(Game.rayTargets, false);
    var staticHit = hits.length ? hits[0] : null;
    var maxDist = staticHit ? staticHit.distance : range;

    /* entities */
    var best = null;
    var candidates = Game.bots;
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] === shooter) continue;
      var h = entityHit(candidates[i], _o, _d, maxDist);
      if (h && (!best || h.dist < best.dist)) best = h;
    }
    if (shooter !== Game.player) {
      var hp = entityHit(Game.player, _o, _d, maxDist);
      if (hp && (!best || hp.dist < best.dist)) best = hp;
    }

    var endPoint;
    if (best) {
      endPoint = _o.clone().addScaledVector(_d, best.dist);
      var dist = best.dist;
      var falloff = def.falloff || range;
      var mul = dist <= falloff ? 1 :
        U.lerp(1, 0.42, U.clamp((dist - falloff) / Math.max(1, range - falloff), 0, 1));
      var dmg = damage * mul * (best.head ? def.headMult : 1);

      applyDamage(best.entity, dmg, shooter, best.head, _o);
      Weapons.FX.impact(endPoint, null, 'flesh');
    } else if (staticHit) {
      endPoint = staticHit.point.clone();
      var obj = staticHit.object;
      Weapons.FX.impact(endPoint, staticHit.face ? staticHit.face.normal : null, surfaceKind(obj));

      if (obj.userData.piece) {
        var broke = Build.damage(obj.userData.piece, damage * 0.85);
        if (broke) Audio2.buildBreak(Game.player.pos.distanceTo(endPoint));
      } else if (obj.userData.props && staticHit.instanceId !== undefined) {
        var prop = obj.userData.props[staticHit.instanceId];
        if (prop && prop.alive) damageProp(prop, damage * 0.5, null);
      } else if (obj.userData.prop) {
        damageProp(obj.userData.prop, damage * 0.5, null);
      }
    } else {
      endPoint = _o.clone().addScaledVector(_d, range);
    }

    /* Tracer starts at the muzzle so it reads correctly in third person. */
    var start = shooter === Game.player ? Game.player.muzzleWorld() :
      (shooter.eye ? shooter.eye(new THREE.Vector3()) : _o.clone());
    if (shooter === Game.player) {
      start.lerp(endPoint, 0.02);
    }
    Weapons.FX.tracer(start, endPoint, shooter === Game.player ? 0xfff0b0 : 0xffb0b0);
  };

  function applyDamage(entity, dmg, shooter, head, fromPos) {
    dmg = Math.round(dmg);
    var died;
    if (entity === Game.player) {
      died = Game.player.damage(dmg, fromPos);
      if (shooter === Game.player) return;
      if (died) onPlayerDeath(shooter && shooter.name ? shooter.name : 'an opponent');
    } else {
      died = entity.damage(dmg, fromPos, shooter);
      if (shooter === Game.player) {
        Game.player.hitMarkerT = head ? 0.22 : 0.16;
        els.hitmarker.classList.toggle('head', !!head);
        head ? Audio2.headshot() : Audio2.hit();
        Weapons.FX.damageNumber(
          new THREE.Vector3(entity.pos.x, entity.pos.y + 1.9, entity.pos.z), dmg, head, false);
      }
      if (died) killBot(entity, shooter === Game.player ? Game.player.name : (shooter ? shooter.name : 'the storm'));
    }
  }

  function damageProp(prop, amount, harvester) {
    prop.hp -= amount;
    if (harvester) {
      var give = Math.round(prop.mat === 'wood' ? 30 : prop.mat === 'brick' ? 24 : 20);
      harvester.giveMats(prop.mat, give);
      Weapons.FX.damageNumber(
        new THREE.Vector3(prop.x, prop.y + 1.6, prop.z), give, false, false);
    }
    if (prop.hp <= 0 && prop.alive) {
      if (harvester) harvester.giveMats(prop.mat, prop.mat === 'wood' ? 34 : 28);
      World.destroyProp(prop);
      Audio2.buildBreak(Game.player.pos.distanceTo(new THREE.Vector3(prop.x, prop.y, prop.z)));
    }
  }

  Game.melee = function (origin, dir, range, shooter, def) {
    _o.copy(origin); _d.copy(dir).normalize();
    _rc.set(_o, _d);
    _rc.far = range;

    var best = null;
    for (var i = 0; i < Game.bots.length; i++) {
      var h = entityHit(Game.bots[i], _o, _d, range);
      if (h && (!best || h.dist < best.dist)) best = h;
    }

    var hits = _rc.intersectObjects(Game.rayTargets, false);
    var staticHit = hits.length ? hits[0] : null;

    if (best && (!staticHit || best.dist < staticHit.distance)) {
      applyDamage(best.entity, def.damage * (best.head ? 1.5 : 1), shooter, best.head, _o);
      Audio2.hit();
      return;
    }
    if (!staticHit) return;

    var obj = staticHit.object;
    Weapons.FX.impact(staticHit.point, staticHit.face ? staticHit.face.normal : null, surfaceKind(obj));

    if (obj.userData.props && staticHit.instanceId !== undefined) {
      var prop = obj.userData.props[staticHit.instanceId];
      if (prop && prop.alive) { damageProp(prop, def.damage * 2.6, shooter); Audio2.pickaxe(prop.mat, 0); }
    } else if (obj.userData.prop) {
      damageProp(obj.userData.prop, def.damage * 2.6, shooter);
      Audio2.pickaxe(obj.userData.prop.mat, 0);
    } else if (obj.userData.piece) {
      Build.damage(obj.userData.piece, def.damage * 3);
      Audio2.pickaxe(obj.userData.piece.mat, 0);
    } else {
      /* terrain and buildings still give a trickle, like hitting scenery */
      shooter.giveMats('brick', 6);
      Audio2.pickaxe('brick', 0);
    }
  };

  /* ---------------------------- eliminations ---------------------------- */

  function killBot(bot, killerName) {
    if (!bot.alive) return;
    dropLoot(bot);
    bot.kill(Game.scene);
    Game.aliveCount--;
    addKillFeed(killerName, bot.name);
    if (killerName === Game.player.name) {
      Game.player.kills++;
      Audio2.kill();
      toast('ELIMINATED ' + bot.name.toUpperCase(), Game.aliveCount + ' players remain');
    }
    checkVictory();
  }

  function dropLoot(bot) {
    if (bot.item) {
      var y = World.supportAt(bot.pos.x, bot.pos.z, bot.pos.y + 1, 1.5).y;
      Game.pickups.push(new Loot.Pickup(Game.scene, bot.pos.x, y, bot.pos.z,
        { type: 'weapon', item: bot.item }));
      var ox = bot.pos.x + (rand() - 0.5) * 1.6, oz = bot.pos.z + (rand() - 0.5) * 1.6;
      Game.pickups.push(new Loot.Pickup(Game.scene, ox,
        World.supportAt(ox, oz, bot.pos.y + 1, 1.5).y, oz, Loot.makeConsumable('ammo', rand)));
      if (rand() < 0.4) {
        var sx = bot.pos.x + (rand() - 0.5) * 2.2, sz = bot.pos.z + (rand() - 0.5) * 2.2;
        Game.pickups.push(new Loot.Pickup(Game.scene, sx,
          World.supportAt(sx, sz, bot.pos.y + 1, 1.5).y, sz, Loot.makeConsumable('shield', rand)));
      }
    }
  }

  var virtualTimer = 12;
  function updateVirtualPlayers(dt) {
    if (Game.virtualRemaining <= 0) return;
    virtualTimer -= dt;
    if (virtualTimer > 0) return;
    /* Eliminations come faster as the circle tightens. */
    var pressure = 1 - Game.storm.radius / Game.storm.baseRadius;
    virtualTimer = U.lerp(9, 2.2, pressure) * (0.6 + rand() * 0.8);

    Game.virtualRemaining--;
    Game.aliveCount--;
    /* Names 1..PHYSICAL_BOTS belong to real bots; virtuals use the tail. */
    var victim = rosterNames[1 + PHYSICAL_BOTS + Game.virtualRemaining];
    var killer = rand() < 0.18 ? 'The Storm'
      : rosterNames[1 + Math.floor(rand() * (rosterNames.length - 1))];
    if (victim && killer !== victim) addKillFeed(killer, victim);
    checkVictory();
  }

  function checkVictory() {
    if (Game.state !== 'playing') return;
    if (Game.aliveCount <= 1 && Game.player.alive) {
      Game.state = 'won';
      Audio2.victory();
      document.exitPointerLock();
      showResult(true);
    }
  }

  function onPlayerDeath(cause) {
    if (Game.state !== 'playing') return;
    Game.player.alive = false;
    Game.state = 'dead';
    Game.aliveCount--;
    Audio2.defeat();
    Audio2.storm(0);
    addKillFeed(cause, Game.player.name);
    document.exitPointerLock();
    showResult(false, cause);
  }
  Game.onPlayerDeath = onPlayerDeath;

  /* ------------------------------ pickups ------------------------------ */

  var nearestPickup = null, nearestChest = null;

  function updateInteractables(dt) {
    var p = Game.player;
    nearestPickup = null; nearestChest = null;
    var bestD = 3.2, bestC = 3.4;
    var pickD = Infinity, chestD = Infinity;

    for (var i = Game.pickups.length - 1; i >= 0; i--) {
      var pk = Game.pickups[i];
      pk.update(dt);
      var d = Math.hypot(pk.x - p.pos.x, pk.z - p.pos.z);
      var dy = Math.abs(pk.y - p.pos.y);
      if (d > 60) continue;
      if (d < 1.9 && dy < 2.4 && pk.type !== 'weapon') {
        consume(pk);
        pk.remove(Game.scene);
        Game.pickups.splice(i, 1);
        continue;
      }
      if (pk.type === 'weapon' && d < bestD && dy < 2.6) { bestD = d; pickD = d; nearestPickup = pk; }
    }

    for (var c = 0; c < Game.chests.length; c++) {
      var ch = Game.chests[c];
      ch.update(dt);
      if (ch.opened) continue;
      var cd = Math.hypot(ch.x - p.pos.x, ch.z - p.pos.z);
      if (cd < bestC && Math.abs(ch.y - p.pos.y) < 2.6) { bestC = cd; chestD = cd; nearestChest = ch; }
    }

    /* Whichever is closer wins, so a chest never blocks the loot beside it. */
    if (nearestChest && nearestPickup) {
      if (pickD < chestD) nearestChest = null; else nearestPickup = null;
    }

    if (nearestChest) {
      showPrompt('E', 'Open Chest');
    } else if (nearestPickup) {
      showPrompt('E', 'Pick up ' + nearestPickup.label());
    } else {
      hidePrompt();
    }
  }

  function consume(pk) {
    var p = Game.player;
    if (pk.type === 'ammo') {
      p.giveAmmo(pk.data.ammo, pk.data.amount);
      Audio2.pickup();
      toast('+' + pk.data.amount + ' ' + Weapons.AMMO_TYPES[pk.data.ammo].toUpperCase() + ' AMMO', '');
    } else if (pk.type === 'shield') {
      if (p.shield >= 100) return;
      p.addShield(pk.data.amount);
      Audio2.shield();
    } else if (pk.type === 'heal') {
      if (p.health >= 75) return;
      p.heal(pk.data.amount, 75);
      Audio2.pickup();
    }
  }

  function tryInteract() {
    var p = Game.player;
    if (nearestChest) {
      var drops = nearestChest.open(Game.scene, rand);
      for (var i = 0; i < drops.length; i++) Game.pickups.push(drops[i]);
      nearestChest = null;
      return;
    }
    if (nearestPickup) {
      var item = nearestPickup.data.item;
      var res = p.giveWeapon(item);
      Audio2.pickup();
      nearestPickup.remove(Game.scene);
      var idx = Game.pickups.indexOf(nearestPickup);
      if (idx >= 0) Game.pickups.splice(idx, 1);
      if (res.replaced && res.old) {
        Game.pickups.push(new Loot.Pickup(Game.scene, p.pos.x, p.pos.y, p.pos.z,
          { type: 'weapon', item: res.old }));
      }
      /* free ammo with a fresh gun so it's usable immediately */
      if (item.def.ammo && p.ammo[item.def.ammo] === 0) p.giveAmmo(item.def.ammo, item.def.mag * 2);
      nearestPickup = null;
    }
  }

  /* -------------------------------- HUD -------------------------------- */

  function setText(el, v) {
    if (!el) return;
    if (el.id) {
      if (lastHud[el.id] === v) return;
      lastHud[el.id] = v;
    } else if (el.textContent === v) return;
    el.textContent = v;
  }

  function toast(title, sub) {
    els.toast.innerHTML = '<div class="t-title">' + title + '</div>' +
      (sub ? '<div class="t-sub">' + sub + '</div>' : '');
    els.toast.classList.remove('show');
    void els.toast.offsetWidth;
    els.toast.classList.add('show');
  }

  function addKillFeed(killer, victim) {
    var row = document.createElement('div');
    row.className = 'kf-row';
    var isMe = killer === Game.player.name || victim === Game.player.name;
    if (isMe) row.classList.add('me');
    row.innerHTML = '<span class="kf-k">' + killer + '</span>' +
      '<span class="kf-i">&#9658;</span>' +
      '<span class="kf-v">' + victim + '</span>';
    els.killfeed.appendChild(row);
    while (els.killfeed.children.length > 5) els.killfeed.removeChild(els.killfeed.firstChild);
    setTimeout(function () { if (row.parentNode) row.parentNode.removeChild(row); }, 6500);
  }

  function killfeedClear() { els.killfeed.innerHTML = ''; }

  function showPrompt(key, label) {
    els.prompt.innerHTML = '<span class="key">' + key + '</span> ' + label;
    els.prompt.style.display = 'block';
  }
  function hidePrompt() { els.prompt.style.display = 'none'; }

  function showPause(on) {
    if (Game.state !== 'playing' && Game.state !== 'bus') { els.pause.style.display = 'none'; return; }
    els.pause.style.display = on ? 'flex' : 'none';
  }

  function showResult(won, cause) {
    var p = Game.player;
    els.result.style.display = 'flex';
    els.result.className = won ? 'overlay win' : 'overlay lose';
    document.getElementById('result-title').textContent = won ? '#1 VICTORY ROYALE' : 'ELIMINATED';
    document.getElementById('result-sub').textContent = won
      ? 'Last one standing on the island.'
      : 'You placed #' + Math.max(1, Game.aliveCount + 1) + (cause ? ' - eliminated by ' + cause : '');
    document.getElementById('result-kills').textContent = p.kills;
    document.getElementById('result-place').textContent = won ? '1' : Math.max(1, Game.aliveCount + 1);
    document.getElementById('result-time').textContent = formatTime(Game.time);
  }

  function formatTime(t) {
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  var SLOT_KEYS = ['1', '2', '3', '4', '5'];

  function updateHud() {
    var p = Game.player;

    var hp = Math.ceil(p.health), sh = Math.ceil(p.shield);
    els.hpfill.style.width = (p.health / p.maxHealth * 100) + '%';
    els.shfill.style.width = (p.shield / 100 * 100) + '%';
    setText(els.hpnum, String(hp));
    setText(els.shnum, String(sh));

    setText(els.alive, String(Math.max(1, Game.aliveCount)));
    setText(els.kills, String(p.kills));

    setText(els.mats.querySelector('#mat-wood'), String(p.mats.wood));
    setText(els.mats.querySelector('#mat-brick'), String(p.mats.brick));
    setText(els.mats.querySelector('#mat-metal'), String(p.mats.metal));

    var active = document.querySelector('#mats .mat.active');
    var want = document.querySelector('#mats .mat[data-mat="' + p.matName() + '"]');
    if (active !== want) {
      if (active) active.classList.remove('active');
      if (want) want.classList.add('active');
    }

    /* weapon + ammo */
    var it = p.item();
    if (p.buildMode) {
      setText(els.weaponname, Build.MATERIALS[p.matName()].name + ' ' +
        p.buildType.charAt(0).toUpperCase() + p.buildType.slice(1));
      setText(els.ammomag, '');
      setText(els.ammores, '');
    } else if (it) {
      setText(els.weaponname, (it.id === 'pickaxe' ? '' :
        Weapons.RARITY[it.rarity].name + ' ') + it.def.name);
      els.weaponname.style.color = it.id === 'pickaxe' ? '#dfe6ef' : Weapons.RARITY[it.rarity].css;
      if (it.def.kind === 'melee') { setText(els.ammomag, ''); setText(els.ammores, ''); }
      else {
        setText(els.ammomag, p.reloadT > 0 ? 'R' : String(it.ammoInMag));
        setText(els.ammores, '/ ' + p.ammo[it.def.ammo]);
      }
    }

    /* slots */
    for (var i = 0; i < 5; i++) {
      var el = document.getElementById('slot' + i);
      var item = p.slots[i];
      var cls = 'slot' + (i === p.slot && !p.buildMode ? ' active' : '');
      if (el.className !== cls) el.className = cls;
      var label = item ? (item.id === 'pickaxe' ? 'PICKAXE' : item.def.name.toUpperCase()) : '';
      var body = el.querySelector('.slot-name');
      setText(body, label);
      var bar = el.querySelector('.slot-rarity');
      var col = item && item.id !== 'pickaxe' ? Weapons.RARITY[item.rarity].css : 'transparent';
      if (bar.style.background !== col) bar.style.background = col;
    }

    /* build bar */
    var bb = els.buildbar;
    if (p.buildMode !== (bb.style.display === 'flex')) bb.style.display = p.buildMode ? 'flex' : 'none';
    if (p.buildMode) {
      var kids = bb.querySelectorAll('.bslot');
      for (var k = 0; k < kids.length; k++) {
        kids[k].classList.toggle('active', kids[k].getAttribute('data-type') === p.buildType);
      }
    }

    /* storm timer */
    var s = Game.storm;
    if (s.state === 'final') {
      setText(els.stormlabel, 'FINAL CIRCLE');
      setText(els.stormtime, '--:--');
    } else {
      setText(els.stormlabel, s.state === 'wait' ? 'STORM CLOSES IN' : 'STORM CLOSING');
      setText(els.stormtime, formatTime(Math.max(0, s.timer)));
    }
    els.stormtime.classList.toggle('urgent', s.state === 'shrink' || s.timer < 12);

    /* crosshair spread */
    var spread = p.currentSpread();
    var px = U.clamp(10 + spread * 900, 8, 60);
    els.crosshair.style.setProperty('--gap', px.toFixed(1) + 'px');
    els.crosshair.style.display = (p.aiming && it && it.def.scope && p.adsAmount > 0.7) ? 'none' : 'block';
    els.scope.style.display = (p.aiming && it && it.def.scope && p.adsAmount > 0.7) ? 'block' : 'none';

    els.hitmarker.style.opacity = p.hitMarkerT > 0 ? '1' : '0';
    els.flash.style.opacity = (p.damageFlashT / 0.45 * 0.55).toFixed(2);

    /* compass */
    var deg = ((-p.yaw * 180 / Math.PI) % 360 + 360) % 360;
    els.compass.style.backgroundPosition = (-deg * 4) + 'px 0';
  }

  /* ----------------------------- minimap ----------------------------- */

  function renderMinimapBase() {
    var S = 160;
    var c = document.createElement('canvas');
    c.width = c.height = S;
    var g = c.getContext('2d');
    var img = g.createImageData(S, S);
    var d = img.data;
    for (var iy = 0; iy < S; iy++) {
      for (var ix = 0; ix < S; ix++) {
        var wx = (ix / S * 2 - 1) * World.HALF;
        var wz = (iy / S * 2 - 1) * World.HALF;
        var h = World.heightAt(wx, wz);
        var i4 = (iy * S + ix) * 4;
        var r, gg, b;
        if (h < World.WATER_Y) { r = 40; gg = 92; b = 140; }
        else if (h < World.WATER_Y + 2.4) { r = 200; gg = 184; b = 132; }
        else {
          var t = U.clamp((h - 4) / 22, 0, 1);
          r = 78 + t * 70; gg = 128 + t * 30; b = 58 + t * 62;
        }
        d[i4] = r; d[i4 + 1] = gg; d[i4 + 2] = b; d[i4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function drawMinimap(full) {
    var canvas = full ? document.getElementById('bigmap-canvas') : els.minimap;
    if (!canvas) return;
    var g = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var p = Game.player, s = Game.storm;
    g.clearRect(0, 0, W, H);

    var span = full ? World.HALF * 2 : 200;   // metres visible
    var scale = W / span;
    var cx = full ? 0 : p.pos.x;
    var cz = full ? 0 : p.pos.z;

    function toX(wx) { return W / 2 + (wx - cx) * scale; }
    function toY(wz) { return H / 2 + (wz - cz) * scale; }

    g.save();
    g.beginPath();
    if (full) g.rect(0, 0, W, H); else { g.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2); }
    g.clip();

    g.fillStyle = '#1b2a38';
    g.fillRect(0, 0, W, H);
    var mapPx = World.HALF * 2 * scale;
    g.imageSmoothingEnabled = true;
    g.drawImage(minimapBase, toX(-World.HALF), toY(-World.HALF), mapPx, mapPx);

    /* storm: darken everything outside the circle */
    g.save();
    g.beginPath();
    g.rect(0, 0, W, H);
    g.arc(toX(s.x), toY(s.z), Math.max(0, s.radius * scale), 0, Math.PI * 2, true);
    g.fillStyle = 'rgba(120,45,210,0.45)';
    g.fill('evenodd');
    g.restore();

    g.strokeStyle = '#c07dff';
    g.lineWidth = 2;
    g.beginPath(); g.arc(toX(s.x), toY(s.z), Math.max(0, s.radius * scale), 0, Math.PI * 2); g.stroke();

    if (s.state === 'wait' && s.nextRadius < s.radius) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5;
      g.setLineDash([4, 4]);
      g.beginPath(); g.arc(toX(s.nextX), toY(s.nextZ), Math.max(0, s.nextRadius * scale), 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
    }

    /* POIs */
    g.font = full ? 'bold 12px Inter, Arial' : 'bold 9px Inter, Arial';
    g.textAlign = 'center';
    for (var i = 0; i < World.pois.length; i++) {
      var poi = World.pois[i];
      var x = toX(poi.x), y = toY(poi.z);
      if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillText(poi.name, x + 1, y + 1);
      g.fillStyle = '#f2e6c8';
      g.fillText(poi.name, x, y);
    }

    /* player arrow */
    var px = toX(p.pos.x), py = toY(p.pos.z);
    g.save();
    g.translate(px, py);
    g.rotate(-p.yaw);
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6);
    g.closePath();
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#12181f';
    g.lineWidth = 1.6;
    g.fill(); g.stroke();
    g.restore();

    g.restore();
  }

  var bigMapOpen = false;
  function toggleBigMap() {
    bigMapOpen = !bigMapOpen;
    els.bigmap.style.display = bigMapOpen ? 'flex' : 'none';
    if (bigMapOpen) drawMinimap(true);
  }

  /* ------------------------------- loop ------------------------------- */

  function updateBus(dt) {
    busT += dt / 17;
    var t = U.clamp(busT, 0, 1);
    bus.position.lerpVectors(busFrom, busTo, t);
    bus.lookAt(busTo.x, busTo.y, busTo.z);
    bus.rotation.z = Math.sin(Game.time * 0.7) * 0.05;

    Game.player.pos.copy(bus.position);
    Game.player.pos.y -= 4;

    /* Orbit the camera around the bus while you pick a landing spot. */
    var ang = Game.time * 0.25 + Math.PI;
    Game.camera.position.set(
      bus.position.x + Math.cos(ang) * 26,
      bus.position.y + 9,
      bus.position.z + Math.sin(ang) * 26
    );
    Game.camera.lookAt(bus.position.x, bus.position.y - 4, bus.position.z);
    Game.camera.fov = U.damp(Game.camera.fov, 74, 8, dt);
    Game.camera.updateProjectionMatrix();

    if (busT >= 1) leaveBus();
  }

  function updateSunShadow() {
    var p = Game.player.pos;
    var dir = new THREE.Vector3(-0.55, 0.72, -0.42).normalize();
    sun.target.position.set(p.x, p.y, p.z);
    sun.position.copy(sun.target.position).addScaledVector(dir, 150);
    sun.target.updateMatrixWorld();
  }

  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(clock.getDelta(), 0.05);

    if (Game.state === 'menu' || !Game.scene) {
      if (Game.renderer && Game.scene) Game.renderer.render(Game.scene, Game.camera);
      return;
    }

    readKeys();
    applyTouchMove();

    var playing = Game.state === 'playing';
    if (playing || Game.state === 'bus') Game.time += dt;

    /* one shared raycast target list per frame */
    Game.rayTargets = World.hittables.concat(Build.meshes);

    if (Game.state === 'bus') {
      updateBus(dt);
      input.mouseX = input.mouseY = 0;
    } else {
      var p = Game.player;

      if (playing) {
        p.aiming = input.aim && !p.buildMode && p.mode === 'ground' &&
          p.item() && p.item().def.kind !== 'melee';
      }

      p.update(dt, input, Game.camera);
      input.mouseX = 0; input.mouseY = 0;

      if (playing && p.mode === 'ground') {
        p.updateBuildTarget(Game.camera);
        if (input.fire) {
          if (p.buildMode) { p.placeBuild(); input.fire = false; }
          else p.fire(Game.camera);
        }
      } else {
        Build.hideGhost();
      }

      p.updateCamera(Game.camera, dt);

      for (var i = 0; i < Game.bots.length; i++) {
        if (Game.bots[i].alive) Game.bots[i].update(dt, Game.scene);
      }

      if (playing) {
        updateStorm(dt);
        stormDamage(dt);
        updateVirtualPlayers(dt);
        updateInteractables(dt);
        checkVictory();
      }
    }

    Build.update(dt);
    Weapons.FX.update(dt);
    updateSunShadow();

    if (World.clouds) World.clouds.rotation.y += dt * 0.004;
    if (World.skyDome) World.skyDome.position.copy(Game.camera.position);

    if (Game.state !== 'bus') {
      updateHud();
      minimapT -= dt;
      if (minimapT <= 0) { minimapT = 0.07; drawMinimap(false); if (bigMapOpen) drawMinimap(true); }
    }

    Game.renderer.render(Game.scene, Game.camera);
  }

  /* Kick off once everything else has loaded. */
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
})();
