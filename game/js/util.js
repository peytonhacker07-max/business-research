/* Shared math, noise and small helpers. */
(function () {
  'use strict';

  var U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.smoothstep = function (t) { return t * t * (3 - 2 * t); };
  U.damp = function (a, b, lambda, dt) { return U.lerp(a, b, 1 - Math.exp(-lambda * dt)); };
  U.deg = Math.PI / 180;

  /* Deterministic PRNG (mulberry32) so a seed always rebuilds the same island. */
  U.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.pick = function (rand, arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; };
  U.range = function (rand, a, b) { return a + rand() * (b - a); };

  /* Seeded 2D value noise with fbm on top. Cheap and good enough for terrain. */
  function hash2(ix, iy, seed) {
    var h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  U.noise2 = function (x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = U.smoothstep(x - ix), fy = U.smoothstep(y - iy);
    var a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
    var c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return U.lerp(U.lerp(a, b, fx), U.lerp(c, d, fx), fy);
  };

  U.fbm = function (x, y, seed, octaves, lacunarity, gain) {
    octaves = octaves || 4; lacunarity = lacunarity || 2.0; gain = gain || 0.5;
    var amp = 1, freq = 1, sum = 0, norm = 0;
    for (var i = 0; i < octaves; i++) {
      sum += amp * U.noise2(x * freq, y * freq, seed + i * 1013);
      norm += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  };

  /* Formats 71 -> "71", 7 -> "7". Kept for HUD counters that may go fractional. */
  U.int = function (v) { return Math.max(0, Math.round(v)); };

  U.now = function () { return performance.now() / 1000; };

  window.U = U;
})();
