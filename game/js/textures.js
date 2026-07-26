/* Procedural canvas textures. Style: saturated, stylized-realistic, chunky
   hand-painted detail with soft AO in the crevices - readable at distance. */
(function () {
  'use strict';

  var cache = {};

  function makeCanvas(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }

  function grain(g, size, amount, alpha) {
    var img = g.getImageData(0, 0, size, size);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * amount;
      d[i] = U.clamp(d[i] + n, 0, 255);
      d[i + 1] = U.clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = U.clamp(d[i + 2] + n, 0, 255);
      if (alpha) d[i + 3] = U.clamp(d[i + 3] + n, 0, 255);
    }
    g.putImageData(img, 0, 0);
  }

  /* Soft blobs that wrap across the tile edge so the texture stays seamless. */
  function blobs(g, size, count, radius, colorFn, alpha) {
    for (var i = 0; i < count; i++) {
      var x = Math.random() * size, y = Math.random() * size;
      var r = radius * (0.5 + Math.random());
      for (var ox = -1; ox <= 1; ox++) {
        for (var oy = -1; oy <= 1; oy++) {
          var px = x + ox * size, py = y + oy * size;
          if (px < -r || px > size + r || py < -r || py > size + r) continue;
          var grd = g.createRadialGradient(px, py, 0, px, py, r);
          var col = colorFn(i);
          grd.addColorStop(0, col.replace('ALPHA', alpha));
          grd.addColorStop(1, col.replace('ALPHA', 0));
          g.fillStyle = grd;
          g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
        }
      }
    }
  }

  function tex(canvas, repeat) {
    var t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  var T = {
    grass: function () {
      return cache.grass || (cache.grass = (function () {
        var s = 256, c = makeCanvas(s), g = c.getContext('2d');
        g.fillStyle = '#4f8f3a'; g.fillRect(0, 0, s, s);
        blobs(g, s, 40, 34, function () { return 'rgba(88,160,62,ALPHA)'; }, 0.55);
        blobs(g, s, 30, 26, function () { return 'rgba(58,106,42,ALPHA)'; }, 0.5);
        blobs(g, s, 14, 18, function () { return 'rgba(126,178,74,ALPHA)'; }, 0.4);
        /* short blades for close-up bite */
        for (var i = 0; i < 900; i++) {
          var x = Math.random() * s, y = Math.random() * s;
          g.strokeStyle = 'rgba(' + (70 + Math.random() * 70 | 0) + ',' + (130 + Math.random() * 60 | 0) + ',50,0.5)';
          g.lineWidth = 1;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 4); g.stroke();
        }
        grain(g, s, 18);
        return tex(c, 1);
      })());
    },

    dirt: function () {
      return cache.dirt || (cache.dirt = (function () {
        var s = 256, c = makeCanvas(s), g = c.getContext('2d');
        g.fillStyle = '#7d6142'; g.fillRect(0, 0, s, s);
        blobs(g, s, 34, 30, function () { return 'rgba(150,120,80,ALPHA)'; }, 0.5);
        blobs(g, s, 26, 22, function () { return 'rgba(90,68,44,ALPHA)'; }, 0.55);
        for (var i = 0; i < 220; i++) {
          g.fillStyle = 'rgba(' + (140 + Math.random() * 60 | 0) + ',' + (120 + Math.random() * 40 | 0) + ',95,0.5)';
          var r = 1 + Math.random() * 2.2;
          g.beginPath(); g.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2); g.fill();
        }
        grain(g, s, 22);
        return tex(c, 1);
      })());
    },

    rock: function () {
      return cache.rock || (cache.rock = (function () {
        var s = 256, c = makeCanvas(s), g = c.getContext('2d');
        g.fillStyle = '#8a8f96'; g.fillRect(0, 0, s, s);
        blobs(g, s, 30, 40, function () { return 'rgba(112,118,126,ALPHA)'; }, 0.5);
        blobs(g, s, 26, 28, function () { return 'rgba(66,70,78,ALPHA)'; }, 0.45);
        /* fracture lines */
        g.lineCap = 'round';
        for (var i = 0; i < 26; i++) {
          g.strokeStyle = 'rgba(48,52,58,' + (0.18 + Math.random() * 0.3) + ')';
          g.lineWidth = 0.8 + Math.random() * 2;
          var x = Math.random() * s, y = Math.random() * s;
          g.beginPath(); g.moveTo(x, y);
          for (var k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); }
          g.stroke();
        }
        grain(g, s, 26);
        return tex(c, 1);
      })());
    },

    sand: function () {
      return cache.sand || (cache.sand = (function () {
        var s = 128, c = makeCanvas(s), g = c.getContext('2d');
        g.fillStyle = '#d8c48c'; g.fillRect(0, 0, s, s);
        blobs(g, s, 20, 24, function () { return 'rgba(228,212,164,ALPHA)'; }, 0.5);
        blobs(g, s, 16, 18, function () { return 'rgba(186,164,116,ALPHA)'; }, 0.4);
        grain(g, s, 20);
        return tex(c, 1);
      })());
    },

    wood: function () {
      return cache.wood || (cache.wood = (function () {
        var s = 256, c = makeCanvas(s), g = c.getContext('2d');
        var planks = 4, ph = s / planks;
        for (var p = 0; p < planks; p++) {
          var base = 150 + (Math.random() * 26 | 0);
          g.fillStyle = 'rgb(' + base + ',' + (base - 44) + ',' + (base - 92) + ')';
          g.fillRect(0, p * ph, s, ph);
          /* grain lines */
          for (var i = 0; i < 26; i++) {
            var y = p * ph + Math.random() * ph;
            g.strokeStyle = 'rgba(' + (base - 46) + ',' + (base - 82) + ',' + (base - 118) + ',' + (0.18 + Math.random() * 0.35) + ')';
            g.lineWidth = 0.7 + Math.random() * 1.6;
            g.beginPath(); g.moveTo(0, y);
            for (var x = 0; x <= s; x += 24) g.lineTo(x, y + Math.sin((x + p * 40) * 0.06) * 2.2);
            g.stroke();
          }
          /* knot */
          if (Math.random() < 0.55) {
            var kx = Math.random() * s, ky = p * ph + ph * 0.5;
            for (var r = 8; r > 0; r -= 2) {
              g.strokeStyle = 'rgba(90,58,30,' + (0.1 + r * 0.03) + ')';
              g.lineWidth = 1.4;
              g.beginPath(); g.ellipse(kx, ky, r, r * 0.6, 0, 0, Math.PI * 2); g.stroke();
            }
          }
          /* seam shadow between planks */
          var grd = g.createLinearGradient(0, p * ph, 0, p * ph + 6);
          grd.addColorStop(0, 'rgba(40,24,12,0.55)'); grd.addColorStop(1, 'rgba(40,24,12,0)');
          g.fillStyle = grd; g.fillRect(0, p * ph, s, 6);
        }
        grain(g, s, 14);
        return tex(c, 1);
      })());
    },

    brick: function () {
      return cache.brick || (cache.brick = (function () {
        var s = 256, c = makeCanvas(s), g = c.getContext('2d');
        g.fillStyle = '#6e6a66'; g.fillRect(0, 0, s, s);
        var rows = 8, bh = s / rows, bw = s / 4;
        for (var r = 0; r < rows; r++) {
          var offset = (r % 2) * bw * 0.5;
          for (var i = -1; i < 5; i++) {
            var x = i * bw + offset + 2, y = r * bh + 2, w = bw - 4, h = bh - 4;
            var tone = 92 + (Math.random() * 34 | 0);
            g.fillStyle = 'rgb(' + (tone + 58) + ',' + (tone - 6) + ',' + (tone - 22) + ')';
            g.fillRect(x, y, w, h);
            /* top highlight / bottom AO */
            g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, y, w, 2);
            g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(x, y + h - 3, w, 3);
          }
        }
        grain(g, s, 22);
        return tex(c, 1);
      })());
    },

    metal: function () {
      return cache.metal || (cache.metal = (function () {
        var s = 256, c = makeCanvas(s), g = c.getContext('2d');
        g.fillStyle = '#7f8896'; g.fillRect(0, 0, s, s);
        /* brushed streaks */
        for (var i = 0; i < 500; i++) {
          var y = Math.random() * s;
          g.strokeStyle = 'rgba(' + (150 + Math.random() * 80 | 0) + ',' + (160 + Math.random() * 70 | 0) + ',180,0.12)';
          g.lineWidth = 0.6 + Math.random();
          g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + (Math.random() - 0.5) * 2); g.stroke();
        }
        /* rivet grid + panel seams */
        g.strokeStyle = 'rgba(40,46,56,0.5)'; g.lineWidth = 2;
        g.strokeRect(0, 0, s, s);
        g.beginPath(); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.stroke();
        for (var rx = 0; rx < 4; rx++) {
          for (var ry = 0; ry < 4; ry++) {
            var px = 20 + rx * (s / 4), py = 20 + ry * (s / 4);
            g.fillStyle = 'rgba(198,208,220,0.75)';
            g.beginPath(); g.arc(px, py, 3.2, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(30,36,44,0.6)';
            g.beginPath(); g.arc(px + 1, py + 1.4, 3.2, 0.6, 2.4); g.fill();
          }
        }
        blobs(g, s, 10, 30, function () { return 'rgba(120,92,60,ALPHA)'; }, 0.18);
        grain(g, s, 16);
        return tex(c, 1);
      })());
    },

    shingle: function () {
      return cache.shingle || (cache.shingle = (function () {
        var s = 256, c = makeCanvas(s), g = c.getContext('2d');
        g.fillStyle = '#5a3b34'; g.fillRect(0, 0, s, s);
        var rows = 10, rh = s / rows;
        for (var r = 0; r < rows; r++) {
          var off = (r % 2) * 16;
          for (var i = -1; i < 9; i++) {
            var x = i * 32 + off, y = r * rh;
            var t = 96 + (Math.random() * 40 | 0);
            g.fillStyle = 'rgb(' + t + ',' + (t - 38) + ',' + (t - 44) + ')';
            g.beginPath();
            g.moveTo(x, y); g.lineTo(x + 30, y); g.lineTo(x + 30, y + rh - 2); g.lineTo(x, y + rh - 2); g.closePath();
            g.fill();
            g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + rh - 4, 30, 4);
          }
        }
        grain(g, s, 18);
        return tex(c, 1);
      })());
    },

    asphalt: function () {
      return cache.asphalt || (cache.asphalt = (function () {
        var s = 256, c = makeCanvas(s), g = c.getContext('2d');
        g.fillStyle = '#3c3d42'; g.fillRect(0, 0, s, s);
        blobs(g, s, 30, 26, function () { return 'rgba(74,76,82,ALPHA)'; }, 0.4);
        for (var i = 0; i < 500; i++) {
          g.fillStyle = 'rgba(' + (110 + Math.random() * 70 | 0) + ',' + (110 + Math.random() * 70 | 0) + ',120,0.35)';
          g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 0.6 + Math.random() * 1.6, 0, Math.PI * 2); g.fill();
        }
        grain(g, s, 20);
        return tex(c, 1);
      })());
    },

    /* Vertical sky gradient used on the inside of the sky dome. */
    skyGradient: function () {
      return cache.sky || (cache.sky = (function () {
        var c = makeCanvas(2);
        c.width = 4; c.height = 256;
        var g = c.getContext('2d');
        var grd = g.createLinearGradient(0, 0, 0, 256);
        grd.addColorStop(0.00, '#1e4fa8');
        grd.addColorStop(0.35, '#4f9bdd');
        grd.addColorStop(0.62, '#a9d8f2');
        grd.addColorStop(0.82, '#e6ebd8');
        grd.addColorStop(1.00, '#f3d9a8');
        g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
        var t = new THREE.CanvasTexture(c);
        t.encoding = THREE.sRGBEncoding;
        return t;
      })());
    },

    /* Soft round particle used for muzzle smoke, impacts and clouds. */
    puff: function () {
      return cache.puff || (cache.puff = (function () {
        var s = 128, c = makeCanvas(s), g = c.getContext('2d');
        var grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.4, 'rgba(255,255,255,0.55)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.fillRect(0, 0, s, s);
        var t = new THREE.CanvasTexture(c);
        t.encoding = THREE.sRGBEncoding;
        return t;
      })());
    },

    /* Rolling purple energy used on the storm wall. */
    storm: function () {
      return cache.storm || (cache.storm = (function () {
        var s = 256, c = makeCanvas(s), g = c.getContext('2d');
        g.fillStyle = 'rgba(96,44,190,0.0)'; g.fillRect(0, 0, s, s);
        blobs(g, s, 26, 46, function () { return 'rgba(150,90,255,ALPHA)'; }, 0.5);
        blobs(g, s, 18, 30, function () { return 'rgba(220,180,255,ALPHA)'; }, 0.42);
        blobs(g, s, 12, 60, function () { return 'rgba(70,20,150,ALPHA)'; }, 0.35);
        for (var i = 0; i < 60; i++) {
          g.strokeStyle = 'rgba(214,190,255,' + (0.05 + Math.random() * 0.16) + ')';
          g.lineWidth = 0.6 + Math.random() * 2.4;
          var x = Math.random() * s;
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 40, s); g.stroke();
        }
        var t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.encoding = THREE.sRGBEncoding;
        return t;
      })());
    }
  };

  window.Tex = T;
})();
