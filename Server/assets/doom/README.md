Place manual Doom assets in this folder, grouped by purpose:

- `map/` for walls, ceilings, and floors
- `characters/` for enemies, guns, and combat effects
- `ui/` for buttons, screens, and overlays

Supported prefixes:
- `map/wall.*` or multiple variants like `map/wall-a.*`, `map/wall-2.*`
- `map/ceiling.*` or multiple variants like `map/ceiling-a.*`, `map/ceiling-2.*`
- `map/floor.*` or multiple variants like `map/floor-a.*`, `map/floor-2.*`
- `characters/enemy-imp.*` or multiple variants like `characters/enemy-imp-a.*`, `characters/enemy-imp-2.*`
- `characters/gun.*` or multiple variants like `characters/gun-a.*`, `characters/gun-2.*`
- `characters/anim-gun-shot.*` or `characters/anim_gun_shot.*`
- `characters/anim-imp-death.*` or `characters/anim_imp_death.*`
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
