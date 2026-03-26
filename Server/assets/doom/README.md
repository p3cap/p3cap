Place optional manual Doom textures in this folder.

Supported prefixes:
- `wall-front.*` or multiple variants like `wall-front-a.*`, `wall-front-2.*`
- `wall-side.*` or multiple variants like `wall-side-a.*`, `wall-side-2.*`
- `ceiling.*` or multiple variants like `ceiling-a.*`, `ceiling-2.*`
- `floor.*` or multiple variants like `floor-a.*`, `floor-2.*`
- `enemy-imp.*` or multiple variants like `enemy-imp-a.*`, `enemy-imp-2.*`
- `gun.*` or multiple variants like `gun-a.*`, `gun-2.*`
- `btn-forward.*`
- `btn-backward.*`
- `btn-turn-l.*`
- `btn-turn-r.*`
- `btn-strafe-l.*`
- `btn-strafe-r.*`
- `btn-shoot.*`
- `btn-wait.*`

Supported file types:
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.gif`
- `.svg`

The renderer randomly picks from matching variants per surface/button. There are no built-in Doom textures anymore, so missing prefixes render as simple flat fills or empty button frames.
