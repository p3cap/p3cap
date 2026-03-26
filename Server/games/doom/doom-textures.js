const fs = require("fs");
const path = require("path");
const { escapeXml, hashString } = require("./doom-core");

const DOOM_TEXTURE_DIR = path.join(__dirname, "..", "..", "assets", "doom");
const SUPPORTED_TEXTURE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const MANUAL_TEXTURE_CACHE = new Map();
const POINT_BOUNDS_CACHE = new Map();

const SURFACE_PREFIXES = {
  wallFront: ["wall-front"],
  wallSide: ["wall-side"],
  ceiling: ["ceiling"],
  floor: ["floor"],
  enemy: ["enemy-imp"],
  gun: ["gun"]
};

const BUTTON_PREFIXES = {
  forward: ["btn-forward", "btn_forward"],
  backward: ["btn-backward", "btn_backward"],
  turnLeft: ["btn-turn-l", "btn_turn_l"],
  turnRight: ["btn-turn-r", "btn_turn_r"],
  strafeLeft: ["btn-strafe-l", "btn_strafe_l"],
  strafeRight: ["btn-strafe-r", "btn_strafe_r"],
  shoot: ["btn-shoot", "btn_shoot"],
  wait: ["btn-wait", "btn_wait"]
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

function getManualTextureCandidates(prefixes) {
  const prefixList = Array.isArray(prefixes) ? prefixes.filter(Boolean) : [prefixes].filter(Boolean);
  const cacheKey = prefixList.join("|");
  if (MANUAL_TEXTURE_CACHE.has(cacheKey)) {
    return MANUAL_TEXTURE_CACHE.get(cacheKey);
  }

  let candidates = [];

  try {
    if (prefixList.length > 0 && fs.existsSync(DOOM_TEXTURE_DIR)) {
      const escapedPrefixes = prefixList
        .map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
      const pattern = new RegExp(`^(?:${escapedPrefixes})(?:-[a-z0-9_-]+)?\\.(png|jpg|jpeg|webp|gif|svg)$`, "i");

      candidates = fs.readdirSync(DOOM_TEXTURE_DIR)
        .filter((fileName) => pattern.test(fileName) && SUPPORTED_TEXTURE_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
        .sort()
        .map((fileName) => {
          const mimeType = getMimeTypeForTexture(fileName);
          if (!mimeType) {
            return "";
          }

          const filePath = path.join(DOOM_TEXTURE_DIR, fileName);
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

function getTextureUri(prefixes, variantKey) {
  const candidates = getManualTextureCandidates(prefixes);
  if (candidates.length === 0) {
    return "";
  }

  return candidates[hashString(String(variantKey || "0")) % candidates.length];
}

function getSurfaceTextureUri(state, surfaceType, variantKey) {
  return getTextureUri(
    SURFACE_PREFIXES[surfaceType] || [],
    `${state.mapSeed}:${surfaceType}:${variantKey}`
  );
}

function getButtonTextureUri(buttonType) {
  return getTextureUri(BUTTON_PREFIXES[buttonType] || [], buttonType);
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

function renderTexturedPolygon(points, textureUri, fallbackFill = "transparent") {
  if (!textureUri) {
    return fallbackFill ? `<polygon points="${points}" fill="${fallbackFill}" />` : "";
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

function renderTexturedRect(x, y, width, height, textureUri, fallbackFill = "transparent") {
  if (!textureUri) {
    return fallbackFill ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fallbackFill}" />` : "";
  }

  return `<image href="${escapeXml(textureUri)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" image-rendering="pixelated" />`;
}

module.exports = {
  getButtonTextureUri,
  getSurfaceTextureUri,
  renderTexturedPolygon,
  renderTexturedRect
};
