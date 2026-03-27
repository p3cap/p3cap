const fs = require("fs");
const path = require("path");
const { escapeXml, hashString } = require("./doom-core");

const DOOM_TEXTURE_DIR = path.join(__dirname, "..", "..", "assets", "doom");
const DOOM_ASSET_DIRECTORIES = {
  map: path.join(DOOM_TEXTURE_DIR, "map"),
  characters: path.join(DOOM_TEXTURE_DIR, "characters"),
  ui: path.join(DOOM_TEXTURE_DIR, "ui")
};
const SUPPORTED_TEXTURE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const MANUAL_TEXTURE_CACHE = new Map();
const POINT_BOUNDS_CACHE = new Map();
const TEXTURE_VIRTUAL_SIZE = 64;

const SURFACE_TEXTURES = {
  wall: { directory: "map", prefixes: ["wall"] },
  ceiling: { directory: "map", prefixes: ["ceiling"] },
  floor: { directory: "map", prefixes: ["floor"] },
  enemy: { directory: "characters", prefixes: ["enemy"] },
  gun: { directory: "characters", prefixes: ["gun"] }
};

const UI_TEXTURES = {
  forward: { directory: "ui", prefixes: ["btn-forward", "btn_forward"] },
  backward: { directory: "ui", prefixes: ["btn-backward", "btn_backward"] },
  turnLeft: { directory: "ui", prefixes: ["btn-turn-l", "btn_turn_l"] },
  turnRight: { directory: "ui", prefixes: ["btn-turn-r", "btn_turn_r"] },
  strafeLeft: { directory: "ui", prefixes: ["btn-strafe-l", "btn_strafe_l"] },
  strafeRight: { directory: "ui", prefixes: ["btn-strafe-r", "btn_strafe_r"] },
  shoot: { directory: "ui", prefixes: ["btn-shoot", "btn_shoot"] },
  wait: { directory: "ui", prefixes: ["btn-wait", "btn_wait"] },
  gunShot: { directory: "characters", prefixes: ["anim-gun-shot", "anim_gun_shot"] },
  enemyDeath: { directory: "characters", prefixes: ["anim-enemy-death", "anim_enemy_death", "anim-imp-death", "anim_imp_death"] },
  playerDeath: { directory: "ui", prefixes: ["anim-player-death", "anim_player_death"] },
  damageFrame: { directory: "ui", prefixes: ["anim-damage-frame", "anim_damage_frame"] },
  deathScreen: { directory: "ui", prefixes: ["screen-death"] },
  floorClearPanel: { directory: "ui", prefixes: ["screen-floor-clear"] },
  screenFrame: { directory: "ui", prefixes: ["screen-frame"] }
};

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

function getManualTextureCandidates(directoryKey, prefixes) {
  const prefixList = Array.isArray(prefixes) ? prefixes.filter(Boolean) : [prefixes].filter(Boolean);
  const cacheKey = `${directoryKey}:${prefixList.join("|")}`;
  if (MANUAL_TEXTURE_CACHE.has(cacheKey)) {
    return MANUAL_TEXTURE_CACHE.get(cacheKey);
  }

  let candidates = [];
  const textureDirectory = DOOM_ASSET_DIRECTORIES[directoryKey] || DOOM_TEXTURE_DIR;

  try {
    if (prefixList.length > 0 && fs.existsSync(textureDirectory)) {
      const escapedPrefixes = prefixList
        .map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      const pattern = new RegExp(`^(?:${escapedPrefixes})(?:-[a-z0-9_-]+)?\\.(png|jpg|jpeg|webp|gif|svg)$`, "i");

      candidates = fs.readdirSync(textureDirectory)
        .filter((fileName) => pattern.test(fileName) && SUPPORTED_TEXTURE_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
        .sort()
        .map((fileName) => {
          const mimeType = getMimeTypeForTexture(fileName);
          if (!mimeType) {
            return "";
          }

          const filePath = path.join(textureDirectory, fileName);
          return `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
        })
        .filter(Boolean);
    }
  } catch (error) {
    candidates = [];
  }

  MANUAL_TEXTURE_CACHE.set(cacheKey, candidates);
  return candidates;
}

function getTextureUri(directoryKey, prefixes, variantKey) {
  const candidates = getManualTextureCandidates(directoryKey, prefixes);
  if (candidates.length === 0) {
    return "";
  }

  return candidates[hashString(String(variantKey || "0")) % candidates.length];
}

function getSurfaceTextureUri(state, surfaceType, variantKey) {
  const surface = SURFACE_TEXTURES[surfaceType];
  if (!surface) {
    return "";
  }

  return getTextureUri(
    surface.directory,
    surface.prefixes,
    `${state.mapSeed}:${surfaceType}:${variantKey}`
  );
}

function getEnemyTextureUri(state, enemy) {
  const isTough = enemy && enemy.hp >= 2;
  const variantKey = `${state.mapSeed}:${enemy ? enemy.id : "enemy"}`;

  if (isTough) {
    const toughCandidates = getManualTextureCandidates("characters", ["enemy-2", "enemy-2hit", "enemy-strong"]);
    if (toughCandidates.length > 0) {
      return toughCandidates[hashString(variantKey) % toughCandidates.length];
    }
  }

  return getTextureUri("characters", ["enemy"], variantKey);
}

function getButtonTextureUri(buttonType) {
  const asset = UI_TEXTURES[buttonType];
  if (!asset) {
    return "";
  }

  return getTextureUri(asset.directory, asset.prefixes, buttonType);
}

function getEffectTextureUri(effectType, variantKey = effectType) {
  const asset = UI_TEXTURES[effectType];
  if (!asset) {
    return "";
  }

  return getTextureUri(asset.directory, asset.prefixes, variantKey);
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

function renderTexturedPolygon(points, textureUri) {
  if (!textureUri) {
    return "";
  }

  const bounds = getPointBounds(points);
  const clipId = `clip-${hashString(`${points}:${textureUri}`)}`;

  return `
  <defs>
    <clipPath id="${clipId}">
      <polygon points="${points}" />
    </clipPath>
  </defs>
  <image href="${escapeXml(textureUri)}" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" preserveAspectRatio="none" clip-path="url(#${clipId})" image-rendering="pixelated" style="image-rendering: pixelated; image-rendering: crisp-edges;" />
  `;
}

function renderTexturedRect(x, y, width, height, textureUri) {
  if (!textureUri) {
    return "";
  }

  return `<image href="${escapeXml(textureUri)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" image-rendering="pixelated" style="image-rendering: pixelated; image-rendering: crisp-edges;" />`;
}

function renderCroppedTextureRect(
  x,
  y,
  width,
  height,
  textureUri,
  viewBoxX = 0,
  viewBoxY = 0,
  viewBoxWidth = TEXTURE_VIRTUAL_SIZE,
  viewBoxHeight = TEXTURE_VIRTUAL_SIZE,
  opacity = 1
) {
  if (!textureUri || width <= 0 || height <= 0 || viewBoxWidth <= 0 || viewBoxHeight <= 0) {
    return "";
  }

  const normalizedOpacity = Math.max(0, Math.min(1, Number(opacity) || 0));
  const opacityAttribute = normalizedOpacity >= 0.999
    ? ""
    : ` opacity="${normalizedOpacity.toFixed(3)}"`;

  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}" preserveAspectRatio="none" overflow="hidden"${opacityAttribute}><image href="${escapeXml(textureUri)}" x="0" y="0" width="${TEXTURE_VIRTUAL_SIZE}" height="${TEXTURE_VIRTUAL_SIZE}" preserveAspectRatio="none" image-rendering="pixelated" style="image-rendering: pixelated; image-rendering: crisp-edges;" /></svg>`;
}

module.exports = {
  getButtonTextureUri,
  getEffectTextureUri,
  getEnemyTextureUri,
  getSurfaceTextureUri,
  renderCroppedTextureRect,
  renderTexturedPolygon,
  renderTexturedRect,
  TEXTURE_VIRTUAL_SIZE
};
