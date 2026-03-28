Place manual Doom assets in this folder, grouped by purpose:

- `map/` for walls, ceilings, and floors
- `characters/` for enemies, guns, and combat effects
- `ui/` for buttons, screens, and overlays

Map themes:
- put map textures in numbered subfolders like `map/1_dungeon/`, `map/2_wolf/`, `map/3_infested/`
- each theme lasts 5 floors: `1_*` covers floors `1-5`, `2_*` covers floors `6-10`, `3_*` covers floors `11-15`, and so on
- if a theme is missing a wall, floor, or ceiling texture, Doom falls back to the closest earlier theme that has that surface

Supported prefixes:
- `map/<theme>/wall.*` or multiple variants like `map/1_dungeon/wall-1.*`, `map/1_dungeon/wall-2.*`
- `map/<theme>/ceiling.*` or multiple variants like `map/1_dungeon/ceiling-1.*`, `map/1_dungeon/ceiling-2.*`
- `map/<theme>/floor.*` or multiple variants like `map/1_dungeon/floor-1.*`, `map/1_dungeon/floor-2.*`
- `characters/imp-1.*`, `characters/enemy-1.*`, or `characters/enemy-*-1.*` for 1 HP enemies
- numbered enemy variants like `characters/imp-2.*`, `characters/enemy-2.*`, or `characters/enemy-imp-2.*` for 2 HP enemies
- higher numbered enemy variants like `characters/imp-3.*`, `characters/enemy-3.*`, or `characters/enemy-imp-3.*` for tougher enemies
- `characters/gun.*` or multiple variants like `characters/gun-a.*`, `characters/gun-2.*`
- `characters/anim-gun-shot.*` or `characters/anim_gun_shot.*`
- `characters/anim-enemy-death.*` or `characters/anim_enemy_death.*`
- `ui/btn-forward.*`
- `ui/btn-backward.*`
- `ui/btn-turn-l.*`
- `ui/btn-turn-r.*`
- `ui/btn-strafe-l.*`
- `ui/btn-strafe-r.*`
- `ui/btn-shoot.*`
- `ui/btn-wait.*`
- `ui/anim-damage-frame.*` or `ui/anim_damage_frame.*`
- `ui/anim-player-death.*` or `ui/anim_player_death.*`
- `ui/screen-death.*`
- `ui/screen-floor-clear.*`
- `ui/screen-frame.*`

Supported file types:
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.gif`
- `.svg`

The renderer randomly picks from matching variants per surface/button/effect. There are no built-in Doom textures anymore, and missing Doom texture assets now render as empty space instead of code-made stand-ins.

For the raycast view, textures are sampled on a virtual `64x64` grid. Square textures work best for walls, floors, ceilings, enemies, and gun art.

Enemy art is picked from the enemy's max HP tier, not current HP, so damaged tougher enemies keep their tougher sprite.
Enemy HP is capped by both floor difficulty and the highest numbered enemy asset tier you provide.
Floor balance:
- floors `1-2` only spawn `1 HP` enemies
- floors `3-4` still stay all `1 HP`
- from floor `5`, tougher enemies can use up to about `20%` of the roster, so roughly `80%` still stay `1 HP`
- `2 HP` enemies start appearing from floor `5`
- `3 HP` enemies can appear from floor `10`, but stay rare and only take a small part of that tougher-enemy share
