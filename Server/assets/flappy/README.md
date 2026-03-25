Place optional Flappy assets in this folder.

Supported prefixes:
- `bird.*`
- `bird-a.*`, `bird-b.*`, and similar variants also work, but the first matching supported bird asset is used right now.

Supported file types:
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.gif`
- `.svg`

- `bird.aseprite` is fine as a source file, but the renderer itself needs an exported image such as `bird.svg` or `bird.png`.
- There is no code-drawn bird fallback anymore. If no supported bird asset exists, the bird will not render.
