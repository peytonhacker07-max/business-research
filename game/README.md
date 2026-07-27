# Storm Royale

A browser battle-royale mini game in the Fortnite mold: drop from a flying bus onto a
procedurally generated island, loot chests, harvest materials, throw up walls and ramps
mid-fight, and outlast 49 opponents as the storm closes in.

Built with Three.js. No build step, no external requests — open `index.html` and play.

## Play

**Easiest — one file.** Download `storm-royale.html` and double-click it. Everything
(Three.js, all game code, CSS) is inlined into that single 0.8 MB file, so it runs from
`file://` with no server, no install and no network.

**From the repo.** Open `game/index.html`. This version needs the `js/` and `vendor/`
folders sitting beside it — saving `index.html` on its own gives you the menu and a dead
`DROP IN` button (the page will tell you so). To serve it over HTTP instead:

```bash
npx http-server . -p 8080     # then visit http://localhost:8080/game/  (from the repo root)
```

### Rebuilding the single-file version

`storm-royale.html` is generated. After editing anything under `js/`, `vendor/` or
`index.html`, regenerate it:

```bash
node game/build-single.js
```

## Controls

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Sprint / Crouch | `Shift` / `Ctrl` |
| Jump (and leave the bus) | `Space` |
| Fire / Aim down sights | `LMB` / `RMB` |
| Reload | `R` |
| Interact — open chest, pick up weapon | `E` |
| Weapon slots | `1`–`5`, or mouse wheel |
| Build wall / floor / ramp / cone | `Z` `X` `C` `V` |
| Cycle build material | `F` |
| Leave build mode | `Q` |
| Full map | `M` |

Slot `1` is the harvesting tool — swing it at trees, rocks and cars for wood, brick and
metal. Touch controls (virtual stick plus action buttons) appear automatically on
touch devices.

## What's in it

**Match flow.** A battle bus crosses the island on a random route; jump when you like or
ride to the end. Freefall steers with `WASD`, the glider deploys automatically at ~48m.
50 players start, 1 walks away.

**The storm.** Six phases, each with a hold timer and a shrink timer, closing on a
randomised centre. Damage per second ramps from 1 to 12 as the circle tightens. The
minimap shows the current circle and the next one.

**Building.** Grid-snapped 4m×3.2m pieces in wood (150hp), brick (300hp) and metal
(460hp), 10 materials each. Placement resolves from where you stand and where you look,
including one storey up or down based on aim pitch. Ramps get stair-stepped colliders so
they're genuinely walkable, and every piece is destructible — yours and theirs.

**Weapons.** Pistol, SMG, assault rifle, pump shotgun and bolt-action sniper across five
rarity tiers, each tier scaling damage. Hitscan with per-weapon spread, damage falloff,
separate head and body hitboxes, and a scoped overlay for the sniper. Shotguns fire
9 pellets. Ammo is pooled by type: light, medium, shells, heavy.

**Opponents.** 14 fully simulated bots roam, loot, take line-of-sight into account,
strafe at a range that suits their weapon, throw up a wall when they drop below 65 health,
and sprint for the circle when caught outside. The remaining 35 are simulated off-screen
and drop out of the kill feed on a schedule that accelerates as the circle closes.

**Island.** Seeded value-noise terrain with an island falloff, slope-driven rock and sand
blending, 6 named POIs whose ground is flattened before the buildings are placed. Each
building is generated with walls, door and window openings, multiple storeys, internal
stair ramps, and a parapeted roof — all merged into a handful of draw calls. ~860
harvestable trees and rocks are instanced.

Every texture is drawn procedurally to a canvas at load time; every sound is synthesised
with the Web Audio API. Nothing is fetched at runtime.

## Layout

```
storm-royale.html   generated single-file build - the one to hand to people
build-single.js     regenerates the above
index.html          HUD markup and styling
vendor/three.min.js Three.js r149 (vendored)
js/util.js          math, seeded RNG, value noise
js/audio.js         Web Audio synthesis
js/textures.js      procedural canvas textures
js/world.js         terrain, collision registry, POIs, props
js/build.js         grid building system
js/weapons.js       weapon defs, view models, combat FX
js/character.js     procedural humanoid + animation
js/loot.js          chests and pickups
js/bots.js          opponent AI
js/player.js        player controller and camera
js/game.js          match flow, storm, HUD, render loop
```

Art and audio are original. This is an homage to the genre, not a reproduction of
Fortnite's assets, characters or branding.
