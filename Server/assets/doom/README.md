Place manual Doom assets in this folder, grouped by purpose:

- `map/` for walls, ceilings, and floors
- `characters/` for enemies, guns, and combat effects
- `ui/` for buttons, screens, and overlays

Supported prefixes:
- `map/wall-front.*` or multiple variants like `map/wall-front-a.*`, `map/wall-front-2.*`
- `map/wall-side.*` or multiple variants like `map/wall-side-a.*`, `map/wall-side-2.*`
- `map/ceiling.*` or multiple variants like `map/ceiling-a.*`, `map/ceiling-2.*`
- `map/floor.*` or multiple variants like `map/floor-a.*`, `map/floor-2.*`
- `characters/enemy-imp.*` or multiple variants like `characters/enemy-imp-a.*`, `characters/enemy-imp-2.*`
- `characters/gun.*` or multiple variants like `characters/gun-a.*`, `characters/gun-2.*`
- `characters/anim-muzzle-flash.*`
- `characters/anim-imp-death.*`
- `ui/btn-forward.*`
- `ui/btn-backward.*`
- `ui/btn-turn-l.*`
- `ui/btn-turn-r.*`
- `ui/btn-strafe-l.*`
- `ui/btn-strafe-r.*`
- `ui/btn-shoot.*`
- `ui/btn-wait.*`
- `ui/anim-player-death.*`
- `ui/screen-floor-clear.*`

Supported file types:
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.gif`
- `.svg`

The renderer randomly picks from matching variants per surface/button/effect. There are no built-in Doom textures anymore, so missing prefixes render as simple flat fills or empty frames.
