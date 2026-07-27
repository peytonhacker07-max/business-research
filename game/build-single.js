#!/usr/bin/env node
/* Bundles index.html + vendor/three.min.js + js/*.js into one standalone
   storm-royale.html that runs from a plain file:// double-click.

   Usage: node build-single.js
*/
'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const SOURCES = [
  'vendor/three.min.js',
  'js/util.js',
  'js/audio.js',
  'js/textures.js',
  'js/world.js',
  'js/build.js',
  'js/weapons.js',
  'js/character.js',
  'js/loot.js',
  'js/bots.js',
  'js/player.js',
  'js/game.js'
];

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* Drop the "you only downloaded index.html" guard - it can't apply here. */
const guardStart = html.indexOf('<!-- This page needs js/');
const guardEnd = html.indexOf('<script src="vendor/three.min.js">');
if (guardStart !== -1 && guardEnd > guardStart) {
  html = html.slice(0, guardStart) + html.slice(guardEnd);
}

const bundle = SOURCES.map(function (rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  /* A literal </script> inside a string would close the tag early. */
  return '/* ===== ' + rel + ' ===== */\n' + code.replace(/<\/script/gi, '<\\/script');
}).join('\n');

/* Replace the whole run of external <script src> tags with one inline block. */
const tagRe = /<script src="(?:vendor|js)\/[^"]+"><\/script>\s*/g;
let first = true;
html = html.replace(tagRe, function () {
  if (!first) return '';
  first = false;
  return '__BUNDLE__';
});

if (first) {
  console.error('No <script src> tags found in index.html - nothing bundled.');
  process.exit(1);
}

html = html.split('__BUNDLE__').join('<script>\n' + bundle + '\n</script>');

/* Single-file build gets its own title so it is obvious which one you opened. */
html = html.replace(
  '<title>STORM ROYALE - Battle Royale Mini Game</title>',
  '<title>STORM ROYALE - Battle Royale Mini Game (single file)</title>'
);

const out = path.join(root, 'storm-royale.html');
fs.writeFileSync(out, html);
console.log('Wrote ' + out + ' (' + (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB)');
