Place manual Doom assets in this folder, grouped by purpose:

- `map/` for walls, ceilings, and floors
- `characters/` for enemies, guns, and combat effects
- `ui/` for buttons, screens, and overlays

Supported prefixes:
- `map/wall.*` or multiple variants like `map/wall-a.*`, `map/wall-2.*`
- `map/ceiling.*` or multiple variants like `map/ceiling-a.*`, `map/ceiling-2.*`
- `map/floor.*` or multiple variants like `map/floor-a.*`, `map/floor-2.*`
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
- `2 HP` enemies start appearing from floor `5`
- `3 HP` enemies can appear from floor `10`, but stay rare
