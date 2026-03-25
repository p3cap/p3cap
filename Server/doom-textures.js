const fs = require("fs");
const path = require("path");
const { escapeXml, hashString, normalizeThemeName } = require("./doom-core");

const DOOM_TEXTURE_DIR = path.join(__dirname, "assets", "doom");
const SUPPORTED_TEXTURE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

const TEXTURE_THEMES = {
  rust: {
    wallFront: ["wall-front-rust-a", "wall-front-rust-b", "wall-front-rust-c"],
    wallSide: ["wall-side-rust-a", "wall-side-rust-b", "wall-side-rust-c"],
    ceiling: ["ceiling-rust-a", "ceiling-rust-b", "ceiling-rust-c"],
    floor: ["floor-rust-a", "floor-rust-b", "floor-rust-c"],
    enemy: ["enemy-imp-rust-a", "enemy-imp-rust-b"],
    gun: ["gun-rust-a", "gun-rust-b"]
  },
  tech: {
    wallFront: ["wall-front-tech-a", "wall-front-tech-b", "wall-front-tech-c"],
    wallSide: ["wall-side-tech-a", "wall-side-tech-b", "wall-side-tech-c"],
    ceiling: ["ceiling-tech-a", "ceiling-tech-b", "ceiling-tech-c"],
    floor: ["floor-tech-a", "floor-tech-b", "floor-tech-c"],
    enemy: ["enemy-imp-tech-a", "enemy-imp-tech-b"],
    gun: ["gun-tech-a", "gun-tech-b"]
  },
  crypt: {
    wallFront: ["wall-front-crypt-a", "wall-front-crypt-b", "wall-front-crypt-c"],
    wallSide: ["wall-side-crypt-a", "wall-side-crypt-b", "wall-side-crypt-c"],
    ceiling: ["ceiling-crypt-a", "ceiling-crypt-b", "ceiling-crypt-c"],
    floor: ["floor-crypt-a", "floor-crypt-b", "floor-crypt-c"],
    enemy: ["enemy-imp-crypt-a", "enemy-imp-crypt-b"],
    gun: ["gun-crypt-a", "gun-crypt-b"]
  }
};

const BUILTIN_TEXTURE_DATA_URIS = new Map();
const MANUAL_TEXTURE_CACHE = new Map();
const POINT_BOUNDS_CACHE = new Map();

function svgDataUri(svgMarkup) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
}

function createPatternTextureSvg({ base, accents, grid = 16, width = 128, height = 128 }) {
  const cells = [];

  for (let y = 0; y < height; y += grid) {
    for (let x = 0; x < width; x += grid) {
      const fill = accents[(Math.floor(x / grid) + Math.floor(y / grid)) % accents.length];
      cells.push(`<rect x="${x}" y="${y}" width="${grid}" height="${grid}" fill="${fill}" />`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">
  <rect width="${width}" height="${height}" fill="${base}" />
  ${cells.join("")}
</svg>`;
}

function createWallFrontTextureSvg(palette) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" shape-rendering="crispEdges">
  <rect width="128" height="128" fill="${palette.base}" />
  <rect x="0" y="28" width="128" height="12" fill="${palette.band}" />
  <rect x="0" y="76" width="128" height="10" fill="${palette.band}" />
  <rect x="12" y="12" width="44" height="42" fill="${palette.panel}" />
  <rect x="70" y="12" width="46" height="42" fill="${palette.panel}" />
  <rect x="18" y="20" width="12" height="12" fill="${palette.highlight}" />
  <rect x="86" y="20" width="12" height="12" fill="${palette.highlight}" />
  <rect x="20" y="92" width="88" height="22" fill="${palette.shadow}" />
  <rect x="30" y="98" width="18" height="10" fill="${palette.highlight}" />
  <rect x="80" y="98" width="18" height="10" fill="${palette.highlight}" />
</svg>`;
}

function createWallSideTextureSvg(palette) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="128" viewBox="0 0 96 128" shape-rendering="crispEdges">
  <rect width="96" height="128" fill="${palette.base}" />
  <rect x="10" y="0" width="8" height="128" fill="${palette.rib}" />
  <rect x="42" y="0" width="8" height="128" fill="${palette.rib}" />
  <rect x="74" y="0" width="8" height="128" fill="${palette.rib}" />
  <rect x="0" y="20" width="96" height="6" fill="${palette.band}" />
  <rect x="0" y="60" width="96" height="6" fill="${palette.band}" />
  <rect x="0" y="100" width="96" height="6" fill="${palette.band}" />
  <rect x="20" y="26" width="10" height="8" fill="${palette.highlight}" />
  <rect x="52" y="66" width="10" height="8" fill="${palette.highlight}" />
</svg>`;
}

function createFloorTextureSvg(palette) {
  return createPatternTextureSvg({
    base: palette.base,
    accents: [palette.panel, palette.shadow, palette.panel, palette.highlight],
    grid: 16
  });
}

function createCeilingTextureSvg(palette) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" shape-rendering="crispEdges">
  <rect width="128" height="128" fill="${palette.base}" />
  <rect x="0" y="30" width="128" height="6" fill="${palette.grid}" />
  <rect x="0" y="64" width="128" height="6" fill="${palette.grid}" />
  <rect x="0" y="98" width="128" height="6" fill="${palette.grid}" />
  <rect x="30" y="0" width="6" height="128" fill="${palette.grid}" />
  <rect x="64" y="0" width="6" height="128" fill="${palette.grid}" />
  <rect x="98" y="0" width="6" height="128" fill="${palette.grid}" />
  <rect x="16" y="16" width="14" height="14" fill="${palette.light}" />
  <rect x="82" y="50" width="14" height="14" fill="${palette.light}" />
</svg>`;
}

function createEnemyTextureSvg(palette) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges">
  <rect width="64" height="64" fill="transparent" />
  <rect x="20" y="4" width="8" height="10" fill="${palette.horn}" />
  <rect x="36" y="4" width="8" height="10" fill="${palette.horn}" />
  <rect x="16" y="12" width="32" height="22" fill="${palette.body}" />
  <rect x="12" y="24" width="40" height="20" fill="${palette.chest}" />
  <rect x="8" y="28" width="8" height="18" fill="${palette.limb}" />
  <rect x="48" y="28" width="8" height="18" fill="${palette.limb}" />
  <rect x="20" y="44" width="8" height="16" fill="${palette.limb}" />
  <rect x="36" y="44" width="8" height="16" fill="${palette.limb}" />
  <rect x="22" y="20" width="6" height="6" fill="${palette.eye}" />
  <rect x="36" y="20" width="6" height="6" fill="${palette.eye}" />
  <rect x="28" y="30" width="8" height="4" fill="${palette.mouth}" />
</svg>`;
}

function createGunTextureSvg(palette) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" shape-rendering="crispEdges">
  <rect width="128" height="128" fill="transparent" />
  <rect x="42" y="10" width="44" height="30" fill="${palette.barrel}" />
  <rect x="48" y="0" width="32" height="22" fill="${palette.highlight}" />
  <rect x="34" y="34" width="60" height="44" fill="${palette.body}" />
  <rect x="26" y="76" width="76" height="18" fill="${palette.shadow}" />
  <rect x="18" y="92" width="26" height="30" fill="${palette.grip}" />
  <rect x="84" y="92" width="26" height="30" fill="${palette.grip}" />
  <rect x="48" y="82" width="32" height="18" fill="${palette.accent}" />
</svg>`;
}

const BUILTIN_TEXTURES = {
  "wall-front-rust-a": () => createWallFrontTextureSvg({ base: "#5a2a18", band: "#7a3b1f", panel: "#8d4a25", highlight: "#c06c2a", shadow: "#38170f" }),
  "wall-front-rust-b": () => createWallFrontTextureSvg({ base: "#61321c", band: "#7e4725", panel: "#99552d", highlight: "#d58c3f", shadow: "#31140c" }),
  "wall-front-rust-c": () => createWallFrontTextureSvg({ base: "#4f2617", band: "#6d351c", panel: "#854321", highlight: "#c47b30", shadow: "#2a130c" }),
  "wall-side-rust-a": () => createWallSideTextureSvg({ base: "#4a2316", rib: "#734126", band: "#8c5832", highlight: "#c98a42" }),
  "wall-side-rust-b": () => createWallSideTextureSvg({ base: "#522918", rib: "#7b4828", band: "#9b6033", highlight: "#d89a4a" }),
  "wall-side-rust-c": () => createWallSideTextureSvg({ base: "#442114", rib: "#693a21", band: "#87532e", highlight: "#b97c3b" }),
  "ceiling-rust-a": () => createCeilingTextureSvg({ base: "#29140f", grid: "#3f2118", light: "#7e5d3c" }),
  "ceiling-rust-b": () => createCeilingTextureSvg({ base: "#24120d", grid: "#412318", light: "#8a6743" }),
  "ceiling-rust-c": () => createCeilingTextureSvg({ base: "#20100b", grid: "#3a2017", light: "#72563a" }),
  "floor-rust-a": () => createFloorTextureSvg({ base: "#21150f", panel: "#3a2920", shadow: "#17100c", highlight: "#5b4432" }),
  "floor-rust-b": () => createFloorTextureSvg({ base: "#241812", panel: "#3d2d23", shadow: "#16100c", highlight: "#634a35" }),
  "floor-rust-c": () => createFloorTextureSvg({ base: "#1e140f", panel: "#36271f", shadow: "#140e0b", highlight: "#564230" }),
  "enemy-imp-rust-a": () => createEnemyTextureSvg({ horn: "#f7d794", body: "#8b1f1f", chest: "#c0392b", limb: "#691515", eye: "#ffe66d", mouth: "#2b0f0f" }),
  "enemy-imp-rust-b": () => createEnemyTextureSvg({ horn: "#f8c291", body: "#7f0000", chest: "#b33939", limb: "#521010", eye: "#f6e58d", mouth: "#200909" }),
  "gun-rust-a": () => createGunTextureSvg({ barrel: "#9aa7b5", highlight: "#d9e4ec", body: "#6d7682", shadow: "#343b46", grip: "#8c6747", accent: "#1f2937" }),
  "gun-rust-b": () => createGunTextureSvg({ barrel: "#a0a6ad", highlight: "#e6edf5", body: "#707b86", shadow: "#2b3138", grip: "#6b4b32", accent: "#111827" }),
  "wall-front-tech-a": () => createWallFrontTextureSvg({ base: "#22303c", band: "#405668", panel: "#4f6b80", highlight: "#9be7ff", shadow: "#162028" }),
  "wall-front-tech-b": () => createWallFrontTextureSvg({ base: "#1f2a35", band: "#385062", panel: "#517089", highlight: "#6ee7f9", shadow: "#121a22" }),
  "wall-front-tech-c": () => createWallFrontTextureSvg({ base: "#26323d", band: "#40596f", panel: "#587893", highlight: "#8feaff", shadow: "#161d26" }),
  "wall-side-tech-a": () => createWallSideTextureSvg({ base: "#1a242d", rib: "#2f4555", band: "#4f7088", highlight: "#90e0ef" }),
  "wall-side-tech-b": () => createWallSideTextureSvg({ base: "#19232a", rib: "#314653", band: "#5b7d94", highlight: "#6ee7f9" }),
  "wall-side-tech-c": () => createWallSideTextureSvg({ base: "#202b33", rib: "#375062", band: "#64879b", highlight: "#9be7ff" }),
  "ceiling-tech-a": () => createCeilingTextureSvg({ base: "#11181d", grid: "#293843", light: "#66d9ef" }),
  "ceiling-tech-b": () => createCeilingTextureSvg({ base: "#141b20", grid: "#2f3f4c", light: "#8be9fd" }),
  "ceiling-tech-c": () => createCeilingTextureSvg({ base: "#0f151a", grid: "#263540", light: "#6ee7f9" }),
  "floor-tech-a": () => createFloorTextureSvg({ base: "#12181e", panel: "#24323d", shadow: "#0c1014", highlight: "#4f6b80" }),
  "floor-tech-b": () => createFloorTextureSvg({ base: "#141a21", panel: "#293844", shadow: "#0e1216", highlight: "#517089" }),
  "floor-tech-c": () => createFloorTextureSvg({ base: "#10171c", panel: "#25333e", shadow: "#0b1013", highlight: "#4a667a" }),
  "enemy-imp-tech-a": () => createEnemyTextureSvg({ horn: "#b2bec3", body: "#8e44ad", chest: "#9b59b6", limb: "#5b2c6f", eye: "#81ecec", mouth: "#22062b" }),
  "enemy-imp-tech-b": () => createEnemyTextureSvg({ horn: "#ced6e0", body: "#6c5ce7", chest: "#7d5fff", limb: "#4834d4", eye: "#74b9ff", mouth: "#190f33" }),
  "gun-tech-a": () => createGunTextureSvg({ barrel: "#b2bec3", highlight: "#f1f2f6", body: "#6c7a89", shadow: "#2f3640", grip: "#2d3436", accent: "#00cec9" }),
  "gun-tech-b": () => createGunTextureSvg({ barrel: "#95afc0", highlight: "#dff9fb", body: "#535c68", shadow: "#1e272e", grip: "#2f3640", accent: "#22a6b3" }),
  "wall-front-crypt-a": () => createWallFrontTextureSvg({ base: "#3d342e", band: "#564a41", panel: "#6f6055", highlight: "#cbb89d", shadow: "#211b18" }),
  "wall-front-crypt-b": () => createWallFrontTextureSvg({ base: "#2f2824", band: "#4a403a", panel: "#64574f", highlight: "#d1c1a5", shadow: "#191513" }),
  "wall-front-crypt-c": () => createWallFrontTextureSvg({ base: "#443932", band: "#5b4e45", panel: "#75665c", highlight: "#e0cfb1", shadow: "#241d19" }),
  "wall-side-crypt-a": () => createWallSideTextureSvg({ base: "#342c27", rib: "#544941", band: "#72645a", highlight: "#bfa98c" }),
  "wall-side-crypt-b": () => createWallSideTextureSvg({ base: "#2e2823", rib: "#4e443d", band: "#6b5c54", highlight: "#c9b798" }),
  "wall-side-crypt-c": () => createWallSideTextureSvg({ base: "#3a312b", rib: "#5a4f47", band: "#7a6b60", highlight: "#d6c3a4" }),
  "ceiling-crypt-a": () => createCeilingTextureSvg({ base: "#171411", grid: "#2e2924", light: "#8b7d6b" }),
  "ceiling-crypt-b": () => createCeilingTextureSvg({ base: "#14110f", grid: "#2a2521", light: "#9a8c77" }),
  "ceiling-crypt-c": () => createCeilingTextureSvg({ base: "#1a1713", grid: "#312b26", light: "#857765" }),
  "floor-crypt-a": () => createFloorTextureSvg({ base: "#1a1612", panel: "#2f2822", shadow: "#100d0b", highlight: "#5d5246" }),
  "floor-crypt-b": () => createFloorTextureSvg({ base: "#1d1915", panel: "#342d27", shadow: "#110e0b", highlight: "#66594b" }),
  "floor-crypt-c": () => createFloorTextureSvg({ base: "#181410", panel: "#2c2621", shadow: "#0e0b09", highlight: "#5a4d41" }),
  "enemy-imp-crypt-a": () => createEnemyTextureSvg({ horn: "#dfe6e9", body: "#6d214f", chest: "#b33771", limb: "#3b1530", eye: "#f6e58d", mouth: "#1f0c16" }),
  "enemy-imp-crypt-b": () => createEnemyTextureSvg({ horn: "#f7f1e3", body: "#5f27cd", chest: "#8c7ae6", limb: "#341f97", eye: "#fbc531", mouth: "#1b1464" }),
  "gun-crypt-a": () => createGunTextureSvg({ barrel: "#8c7a6b", highlight: "#f3e9dd", body: "#6c5a4a", shadow: "#2b211b", grip: "#4f3728", accent: "#201a16" }),
  "gun-crypt-b": () => createGunTextureSvg({ barrel: "#998675", highlight: "#efe3d2", body: "#745f4e", shadow: "#291f19", grip: "#593c2b", accent: "#171210" })
};

function getBuiltInTextureDataUri(textureName) {
  if (BUILTIN_TEXTURE_DATA_URIS.has(textureName)) {
    return BUILTIN_TEXTURE_DATA_URIS.get(textureName);
  }

  const factory = BUILTIN_TEXTURES[textureName];
  if (!factory) {
    BUILTIN_TEXTURE_DATA_URIS.set(textureName, "");
    return "";
  }

  const dataUri = svgDataUri(factory());
  BUILTIN_TEXTURE_DATA_URIS.set(textureName, dataUri);
  return dataUri;
}

function getMimeTypeForTexture(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".gif") {
    return "image/gif";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".svg") {
    return "image/svg+xml";
  }

  return "";
}

function getManualTextureCandidates(prefix) {
  if (MANUAL_TEXTURE_CACHE.has(prefix)) {
    return MANUAL_TEXTURE_CACHE.get(prefix);
  }

  let candidates = [];

  try {
    if (fs.existsSync(DOOM_TEXTURE_DIR)) {
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`^${escapedPrefix}(?:-[a-z0-9_-]+)?\\.(png|jpg|jpeg|webp|gif|svg)$`, "i");

      candidates = fs.readdirSync(DOOM_TEXTURE_DIR)
        .filter((fileName) => pattern.test(fileName) && SUPPORTED_TEXTURE_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
        .sort()
        .map((fileName) => {
          const filePath = path.join(DOOM_TEXTURE_DIR, fileName);
          const mimeType = getMimeTypeForTexture(fileName);
          if (!mimeType) {
            return "";
          }

          return `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
        })
        .filter(Boolean);
    }
  } catch (error) {
    candidates = [];
  }

  MANUAL_TEXTURE_CACHE.set(prefix, candidates);
  return candidates;
}

function getTextureNamesForSurface(themeName, surfaceType) {
  const theme = TEXTURE_THEMES[normalizeThemeName(themeName)];
  return theme[surfaceType] || TEXTURE_THEMES.rust[surfaceType] || [];
}

function getSurfaceTextureUri(state, surfaceType, variantKey) {
  const manualPrefixBySurface = {
    wallFront: "wall-front",
    wallSide: "wall-side",
    ceiling: "ceiling",
    floor: "floor",
    enemy: "enemy-imp",
    gun: "gun"
  };
  const manualCandidates = getManualTextureCandidates(manualPrefixBySurface[surfaceType]);

  if (manualCandidates.length > 0) {
    return manualCandidates[hashString(`${state.mapSeed}:${surfaceType}:${variantKey}`) % manualCandidates.length];
  }

  const textureNames = getTextureNamesForSurface(state.textureTheme, surfaceType);
  if (textureNames.length === 0) {
    return "";
  }

  return getBuiltInTextureDataUri(
    textureNames[hashString(`${state.textureTheme}:${surfaceType}:${variantKey}`) % textureNames.length]
  );
}

function getPointBounds(points) {
  if (POINT_BOUNDS_CACHE.has(points)) {
    return POINT_BOUNDS_CACHE.get(points);
  }

  const pairs = String(points)
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number))
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  const xValues = pairs.map(([x]) => x);
  const yValues = pairs.map(([, y]) => y);
  const bounds = {
    x: Math.min(...xValues),
    y: Math.min(...yValues),
    width: Math.max(1, Math.max(...xValues) - Math.min(...xValues)),
    height: Math.max(1, Math.max(...yValues) - Math.min(...yValues))
  };

  POINT_BOUNDS_CACHE.set(points, bounds);
  return bounds;
}

function renderTexturedPolygon(points, textureUri, fallbackFill) {
  if (!textureUri) {
    return `<polygon points="${points}" fill="${fallbackFill}" />`;
  }

  const bounds = getPointBounds(points);
  const clipId = `clip-${hashString(`${points}:${textureUri}`)}`;

  return `
  <defs>
    <clipPath id="${clipId}">
      <polygon points="${points}" />
    </clipPath>
  </defs>
  <image href="${escapeXml(textureUri)}" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" preserveAspectRatio="none" clip-path="url(#${clipId})" image-rendering="pixelated" />
  `;
}

function renderTexturedRect(x, y, width, height, textureUri, fallbackFill) {
  if (!textureUri) {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fallbackFill}" />`;
  }

  return `<image href="${escapeXml(textureUri)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" image-rendering="pixelated" />`;
}

module.exports = {
  getSurfaceTextureUri,
  renderTexturedPolygon,
  renderTexturedRect
};
