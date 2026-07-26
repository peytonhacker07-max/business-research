/* Procedural audio - every sound is synthesised at runtime, no audio files. */
(function () {
  'use strict';

  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var enabled = true;
  var noiseBuffer = null;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 1.0; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);

    var len = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function noise(dur, gain, filterType, freq, q) {
    var c = ensure(); if (!c || !enabled) return null;
    var src = c.createBufferSource(); src.buffer = noiseBuffer; src.loop = true;
    var flt = c.createBiquadFilter();
    flt.type = filterType || 'lowpass';
    flt.frequency.value = freq || 1200;
    flt.Q.value = q || 1;
    var g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(flt); flt.connect(g); g.connect(sfxGain);
    src.start(); src.stop(c.currentTime + dur + 0.02);
    return { src: src, flt: flt, gain: g };
  }

  function tone(freq, dur, gain, type, sweepTo) {
    var c = ensure(); if (!c || !enabled) return null;
    var o = c.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), c.currentTime + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(); o.stop(c.currentTime + dur + 0.02);
    return { osc: o, gain: g };
  }

  /* Distance attenuation for anything that isn't the local player. */
  function atten(dist) {
    if (dist == null) return 1;
    return U.clamp(1 - dist / 140, 0.04, 1);
  }

  var A = {
    resume: function () {
      var c = ensure();
      if (c && c.state === 'suspended') c.resume();
    },
    setEnabled: function (v) {
      enabled = v;
      if (master) master.gain.value = v ? 0.7 : 0;
    },
    isEnabled: function () { return enabled; },

    shot: function (weapon, dist) {
      var a = atten(dist);
      if (a < 0.05) return;
      var k = weapon || 'ar';
      if (k === 'shotgun') {
        noise(0.30, 0.85 * a, 'lowpass', 1400, 1);
        tone(150, 0.22, 0.55 * a, 'square', 40);
      } else if (k === 'sniper') {
        noise(0.55, 0.75 * a, 'lowpass', 2600, 0.7);
        tone(220, 0.35, 0.45 * a, 'sawtooth', 45);
      } else if (k === 'smg') {
        noise(0.09, 0.42 * a, 'highpass', 900, 1.2);
        tone(340, 0.06, 0.24 * a, 'square', 120);
      } else if (k === 'pistol') {
        noise(0.12, 0.5 * a, 'bandpass', 1600, 1.1);
        tone(300, 0.08, 0.3 * a, 'square', 90);
      } else {
        noise(0.13, 0.55 * a, 'lowpass', 2200, 0.9);
        tone(260, 0.09, 0.32 * a, 'square', 80);
      }
    },

    reload: function () {
      tone(420, 0.05, 0.18, 'square', 300);
      setTimeout(function () { tone(300, 0.06, 0.16, 'square', 480); }, 190);
      setTimeout(function () { noise(0.07, 0.22, 'bandpass', 2400, 2); }, 380);
    },

    empty: function () { tone(900, 0.045, 0.14, 'square', 600); },

    hit: function () { tone(1500, 0.06, 0.22, 'sine', 900); },
    headshot: function () {
      tone(2100, 0.05, 0.26, 'sine', 1300);
      setTimeout(function () { tone(2600, 0.05, 0.2, 'sine', 1700); }, 45);
    },

    hurt: function () {
      noise(0.18, 0.35, 'lowpass', 700, 1);
      tone(140, 0.16, 0.3, 'sawtooth', 70);
    },

    pickaxe: function (mat, dist) {
      var a = atten(dist);
      if (mat === 'brick') { noise(0.14, 0.4 * a, 'bandpass', 2000, 2.5); tone(520, 0.07, 0.2 * a, 'square', 260); }
      else if (mat === 'metal') { tone(1400, 0.22, 0.28 * a, 'triangle', 500); noise(0.1, 0.25 * a, 'highpass', 3000, 2); }
      else { noise(0.13, 0.34 * a, 'lowpass', 900, 1.4); tone(190, 0.1, 0.22 * a, 'triangle', 110); }
    },

    build: function (mat) {
      var base = mat === 'metal' ? 700 : (mat === 'brick' ? 420 : 300);
      tone(base, 0.09, 0.2, 'triangle', base * 1.7);
      noise(0.1, 0.16, 'lowpass', 1500, 1);
    },
    buildBreak: function (dist) {
      var a = atten(dist);
      noise(0.28, 0.4 * a, 'lowpass', 1100, 1);
      tone(110, 0.24, 0.26 * a, 'square', 45);
    },

    chest: function () {
      [660, 880, 1100, 1320].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.28, 0.16, 'triangle'); }, i * 85);
      });
    },
    pickup: function () { tone(880, 0.09, 0.18, 'triangle', 1250); },
    shield: function () {
      tone(500, 0.4, 0.16, 'sine', 1000);
      setTimeout(function () { tone(760, 0.4, 0.14, 'sine', 1300); }, 140);
    },

    kill: function () {
      [880, 1175, 1480].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.16, 0.2, 'square'); }, i * 70);
      });
    },

    jump: function () { noise(0.07, 0.14, 'lowpass', 600, 1); },
    land: function (hard) { noise(hard ? 0.2 : 0.11, hard ? 0.36 : 0.18, 'lowpass', hard ? 500 : 800, 1); },

    stormWarn: function () {
      tone(180, 1.1, 0.2, 'sawtooth', 130);
      setTimeout(function () { tone(150, 1.2, 0.18, 'sawtooth', 100); }, 300);
    },

    victory: function () {
      [523, 659, 784, 1047, 1319].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.5, 0.2, 'triangle'); }, i * 130);
      });
    },
    defeat: function () {
      [392, 330, 262, 196].forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.55, 0.18, 'sine'); }, i * 190);
      });
    },

    uiClick: function () { tone(660, 0.05, 0.14, 'square', 880); },

    /* Low rumble that tracks how close the storm wall is. */
    storm: (function () {
      var src = null, g = null, flt = null;
      return function (intensity) {
        var c = ensure(); if (!c || !enabled) return;
        if (!src) {
          src = c.createBufferSource(); src.buffer = noiseBuffer; src.loop = true;
          flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 240; flt.Q.value = 0.8;
          g = c.createGain(); g.gain.value = 0;
          src.connect(flt); flt.connect(g); g.connect(master);
          src.start();
        }
        g.gain.setTargetAtTime(U.clamp(intensity, 0, 1) * 0.5, c.currentTime, 0.4);
        flt.frequency.setTargetAtTime(200 + intensity * 500, c.currentTime, 0.4);
      };
    })()
  };

  window.Audio2 = A;
})();
