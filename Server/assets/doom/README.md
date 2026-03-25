Place optional manual Doom textures in this folder.

Supported prefixes:
- `wall-front.*` or multiple variants like `wall-front-a.*`, `wall-front-2.*`
- `wall-side.*` or multiple variants like `wall-side-a.*`, `wall-side-2.*`
- `ceiling.*` or multiple variants like `ceiling-a.*`, `ceiling-2.*`
- `floor.*` or multiple variants like `floor-a.*`, `floor-2.*`
- `enemy-imp.*` or multiple variants like `enemy-imp-a.*`, `enemy-imp-2.*`
- `gun.*` or multiple variants like `gun-a.*`, `gun-2.*`

Supported file types:
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.gif`
- `.svg`

The renderer randomly picks from matching variants per floor/tile and falls back to built-in retro textures when a prefix is missing.
