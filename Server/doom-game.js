const { createFileJsonStateStore, createRedisJsonStateStore } = require("./json-state-store");
const {
  buildLobbyPath,
  createFreshDoomState,
  escapeXml,
  getEnemyAt,
  getFloorDimensions,
  getForwardDelta,
  getLeftDelta,
  getRightDelta,
  getTileInDirection,
  normalizeDoomState,
  applyDoomAction
} = require("./doom-core");
const {
  getSurfaceTextureUri,
  renderTexturedPolygon,
  renderTexturedRect
} = require("./doom-textures");

const slug = "doom";

const routeMap = new Map([
  ["api/state", "state"],
  ["images/view.svg", "doomViewImage"],
  ["images/hud.svg", "doomHudImage"],
  ["images/minimap.svg", "doomMinimapImage"],
  ["images/button-forward.svg", "doomButtonForwardImage"],
  ["images/button-backward.svg", "doomButtonBackwardImage"],
  ["images/button-turn-left.svg", "doomButtonTurnLeftImage"],
  ["images/button-turn-right.svg", "doomButtonTurnRightImage"],
  ["images/button-strafe-left.svg", "doomButtonStrafeLeftImage"],
  ["images/button-strafe-right.svg", "doomButtonStrafeRightImage"],
  ["images/button-shoot.svg", "doomButtonShootImage"],
  ["images/button-wait.svg", "doomButtonWaitImage"],
  ["forward", "doomForward"],
  ["backward", "doomBackward"],
  ["turn-left", "doomTurnLeft"],
  ["turn-right", "doomTurnRight"],
  ["strafe-left", "doomStrafeLeft"],
  ["strafe-right", "doomStrafeRight"],
  ["shoot", "doomShoot"],
  ["wait", "doomWait"]
]);

const actionRoutes = new Set([
  "doomForward",
  "doomBackward",
  "doomTurnLeft",
  "doomTurnRight",
  "doomStrafeLeft",
  "doomStrafeRight",
  "doomShoot",
  "doomWait"
]);

function routeNeedsState(route) {
  return !route.startsWith("doomButton");
}

function getRateLimitAction(route) {
  return actionRoutes.has(route) ? "doom-step" : route;
}

function renderHome(rawState, { defaultRedirectUrl = "", gameSlug, lobbySlug, actionCooldownMs = 0 }) {
  const state = normalizeDoomState(rawState);
  const dimensions = `${state.mapRows[0].length}x${state.mapRows.length}`;
  const hint = defaultRedirectUrl
    ? `Default redirect target: <code>${escapeXml(defaultRedirectUrl)}</code>`
    : "Set README_REDIRECT_URL to send action links straight back to GitHub.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Doom Lobby</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #100807;
        color: #f8e7ce;
        font: 16px/1.5 "Courier New", monospace;
      }
      main {
        width: min(780px, calc(100vw - 32px));
        background: rgba(36, 16, 11, 0.95);
        border: 4px solid #6b2f1b;
        padding: 28px;
        box-shadow: 0 0 0 4px #1f0c08;
      }
      code {
        background: rgba(0, 0, 0, 0.35);
        padding: 2px 6px;
      }
      a {
        color: #ffb454;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>DOOM README LOBBY</h1>
      <p>Retro turn-step shooter state for <code>${escapeXml(gameSlug)}</code> / <code>${escapeXml(lobbySlug)}</code>.</p>
      <p><strong>Floor:</strong> ${escapeXml(String(state.floor))} | <strong>Health:</strong> ${escapeXml(String(state.health))} | <strong>Ammo:</strong> ${escapeXml(String(state.ammo))} | <strong>Score:</strong> ${escapeXml(String(state.score))}</p>
      <p><strong>Facing:</strong> ${escapeXml(state.player.facing)} | <strong>Position:</strong> (${escapeXml(String(state.player.x))}, ${escapeXml(String(state.player.y))}) | <strong>Map:</strong> ${escapeXml(dimensions)}</p>
      <p><strong>Theme:</strong> ${escapeXml(state.textureTheme)} | <strong>Enemies:</strong> ${escapeXml(String(state.enemies.length))}</p>
      <p><strong>Last log:</strong> ${escapeXml(state.lastLog)}</p>
      <p>${hint}</p>
      <p><strong>Anti-spam:</strong> about one action every ${(actionCooldownMs / 1000).toFixed(actionCooldownMs < 1000 ? 1 : 0)}s per IP, per game.</p>
      <p>Core actions: <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/forward"))}</code>, <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/turn-left"))}</code>, <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/shoot"))}</code>.</p>
    </main>
  </body>
</html>`;
}

function renderEnemySprite(state, enemy, depth) {
  const spriteByDepth = {
    1: { x: 296, y: 144, w: 128, h: 168 },
    2: { x: 322, y: 178, w: 76, h: 112 },
    3: { x: 338, y: 200, w: 48, h: 74 },
    4: { x: 346, y: 212, w: 30, h: 48 }
  };
  const sprite = spriteByDepth[depth];
  if (!sprite || !enemy) {
    return "";
  }

  return `
  <g>
    <ellipse cx="${sprite.x + Math.floor(sprite.w / 2)}" cy="${sprite.y + sprite.h - 4}" rx="${Math.floor(sprite.w * 0.33)}" ry="${Math.max(4, Math.floor(sprite.h * 0.08))}" fill="#000000" opacity="0.35" />
    ${renderTexturedRect(sprite.x, sprite.y, sprite.w, sprite.h, getSurfaceTextureUri(state, "enemy", `${enemy.id}:${enemy.x}:${enemy.y}`), "#b91c1c")}
  </g>`;
}

function renderGunSprite(state) {
  const fallback = state.ammo > 0 ? "#cbd5e1" : "#7f1d1d";

  return `
    <g>
      <polygon points="304,392 316,338 336,338 332,392" fill="#7b5a45" />
      <polygon points="416,392 404,338 384,338 388,392" fill="#7b5a45" />
      ${renderTexturedRect(322, 218, 76, 152, getSurfaceTextureUri(state, "gun", `${state.floor}:${state.ammo}:${state.turn}`), fallback)}
      <rect x="320" y="356" width="80" height="16" fill="#121920" opacity="0.5" />
    </g>`;
}

function renderViewSvg(rawState) {
  const state = normalizeDoomState(rawState);
  if (state.status === "dead" || state.health <= 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420" role="img" aria-label="Doom death screen">
  <rect width="720" height="420" fill="#000000" />
  <rect x="10" y="10" width="700" height="400" fill="#050505" stroke="#1a1a1a" stroke-width="8" />
  <rect x="24" y="24" width="672" height="312" fill="#000000" stroke="#111111" stroke-width="4" />
  <text x="360" y="170" text-anchor="middle" fill="#f8fafc" font-size="40" font-family="'Courier New', monospace">You deid</text>
  <text x="360" y="210" text-anchor="middle" fill="#9ca3af" font-size="17" font-family="'Courier New', monospace">press any button to start a new game</text>
  <rect x="24" y="336" width="672" height="60" fill="#050505" stroke="#111111" stroke-width="4" />
  <text x="44" y="360" fill="#fca5a5" font-size="18" font-family="'Courier New', monospace">README-DOOM</text>
  <text x="44" y="384" fill="#f8fafc" font-size="16" font-family="'Courier New', monospace">HP 0</text>
  <text x="154" y="384" fill="#f8fafc" font-size="16" font-family="'Courier New', monospace">AMMO 0</text>
  <text x="294" y="384" fill="#f8fafc" font-size="16" font-family="'Courier New', monospace">FLOOR ${escapeXml(String(state.floor))}</text>
  <text x="416" y="384" fill="#f8fafc" font-size="16" font-family="'Courier New', monospace">SCORE ${escapeXml(String(state.score))}</text>
  <text x="44" y="404" fill="#9ca3af" font-size="13" font-family="'Courier New', monospace">${escapeXml(state.lastLog)}</text>
</svg>`;
  }

  const frames = [
    { x: 66, y: 56, w: 588, h: 252 },
    { x: 126, y: 84, w: 468, h: 212 },
    { x: 184, y: 112, w: 352, h: 172 },
    { x: 236, y: 138, w: 248, h: 136 },
    { x: 282, y: 160, w: 156, h: 102 },
    { x: 322, y: 180, w: 76, h: 66 }
  ];
  const corridorLayers = [];
  let frontWall = `<rect x="${frames[5].x}" y="${frames[5].y}" width="${frames[5].w}" height="${frames[5].h}" fill="#070506" />`;
  let enemyInSight = null;
  let enemyDepth = 0;

  for (let depth = 1; depth <= 5; depth += 1) {
    const outer = frames[depth - 1];
    const inner = frames[depth];
    const center = getTileInDirection(state, depth, 0);
    const left = getTileInDirection(state, depth, -1);
    const right = getTileInDirection(state, depth, 1);
    const leftPoints = `${outer.x},${outer.y} ${inner.x},${inner.y} ${inner.x},${inner.y + inner.h} ${outer.x},${outer.y + outer.h}`;
    const rightPoints = `${outer.x + outer.w},${outer.y} ${inner.x + inner.w},${inner.y} ${inner.x + inner.w},${inner.y + inner.h} ${outer.x + outer.w},${outer.y + outer.h}`;
    const ceilingPoints = `${outer.x},${outer.y} ${outer.x + outer.w},${outer.y} ${inner.x + inner.w},${inner.y} ${inner.x},${inner.y}`;
    const floorPoints = `${outer.x},${outer.y + outer.h} ${outer.x + outer.w},${outer.y + outer.h} ${inner.x + inner.w},${inner.y + inner.h} ${inner.x},${inner.y + inner.h}`;

    corridorLayers.push(renderTexturedPolygon(ceilingPoints, getSurfaceTextureUri(state, "ceiling", `${center.x}:${center.y}:ceiling:${depth}`), "#21100c"));
    corridorLayers.push(`<polygon points="${ceilingPoints}" fill="none" stroke="#100908" stroke-width="2" />`);
    corridorLayers.push(renderTexturedPolygon(floorPoints, getSurfaceTextureUri(state, "floor", `${center.x}:${center.y}:floor:${depth}`), "#17110d"));
    corridorLayers.push(`<polygon points="${floorPoints}" fill="none" stroke="#0e0908" stroke-width="2" />`);

    if (left.wall) {
      corridorLayers.push(renderTexturedPolygon(leftPoints, getSurfaceTextureUri(state, "wallSide", `${left.x}:${left.y}:left`), "#6f371d"));
      corridorLayers.push(`<polygon points="${leftPoints}" fill="none" stroke="#23120b" stroke-width="2" />`);
    } else {
      corridorLayers.push(`<polygon points="${leftPoints}" fill="#0c0707" />`);
    }

    if (right.wall) {
      corridorLayers.push(renderTexturedPolygon(rightPoints, getSurfaceTextureUri(state, "wallSide", `${right.x}:${right.y}:right`), "#6f371d"));
      corridorLayers.push(`<polygon points="${rightPoints}" fill="none" stroke="#23120b" stroke-width="2" />`);
    } else {
      corridorLayers.push(`<polygon points="${rightPoints}" fill="#0c0707" />`);
    }

    if (!enemyDepth && center.enemy && !center.wall) {
      enemyDepth = depth;
      enemyInSight = center.enemy;
    }

    if (center.wall) {
      frontWall = `
        ${renderTexturedRect(inner.x, inner.y, inner.w, inner.h, getSurfaceTextureUri(state, "wallFront", `${center.x}:${center.y}:front`), "#7a3f21")}
        <rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="none" stroke="#23120b" stroke-width="3" />
      `;
      break;
    }
  }

  const hpColor = state.health > 50 ? "#86efac" : state.health > 20 ? "#fde68a" : "#fca5a5";
  const mapWidth = state.mapRows[0].length;
  const mapHeight = state.mapRows.length;
  const radarBox = { x: 540, y: 22, w: 148, h: 118 };
  const radarCell = Math.max(4, Math.min(9, Math.floor(104 / mapWidth), Math.floor(84 / mapHeight)));
  const radarPixelWidth = mapWidth * radarCell;
  const radarPixelHeight = mapHeight * radarCell;
  const radarMapX = radarBox.x + Math.floor((radarBox.w - radarPixelWidth) / 2);
  const radarMapY = radarBox.y + 18 + Math.floor((radarBox.h - 30 - radarPixelHeight) / 2);
  const radarTiles = state.mapRows
    .map((row, y) => row.split("").map((tile, x) => `<rect x="${radarMapX + (x * radarCell)}" y="${radarMapY + (y * radarCell)}" width="${radarCell - 1}" height="${radarCell - 1}" fill="${tile === "#" ? "#4a1d10" : "#16100e"}" />`).join(""))
    .join("");
  const radarEnemies = state.enemies
    .map((enemy) => `<rect x="${radarMapX + (enemy.x * radarCell) + 1}" y="${radarMapY + (enemy.y * radarCell) + 1}" width="${Math.max(3, radarCell - 2)}" height="${Math.max(3, radarCell - 2)}" fill="#ef4444" />`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420" role="img" aria-label="Doom-style game viewport">
  <rect width="720" height="420" fill="#090607" />
  <g shape-rendering="crispEdges">
    <rect x="10" y="10" width="700" height="400" fill="#160b09" stroke="#4a2317" stroke-width="8" />
    <rect x="24" y="24" width="672" height="312" fill="#120909" stroke="#2c1511" stroke-width="4" />
    ${corridorLayers.join("\n")}
    ${frontWall}
    ${enemyDepth ? renderEnemySprite(state, enemyInSight, enemyDepth) : ""}
    <rect x="357" y="180" width="6" height="42" fill="#f8fafc" opacity="0.92" />
    <rect x="339" y="198" width="42" height="6" fill="#f8fafc" opacity="0.92" />
    ${renderGunSprite(state)}
    <rect x="24" y="336" width="672" height="60" fill="#120906" stroke="#472116" stroke-width="4" />
    <text x="44" y="360" fill="#fca5a5" font-size="18" font-family="'Courier New', monospace">README-DOOM</text>
    <text x="44" y="384" fill="${hpColor}" font-size="16" font-family="'Courier New', monospace">HP ${escapeXml(String(state.health))}</text>
    <text x="154" y="384" fill="#bfdbfe" font-size="16" font-family="'Courier New', monospace">AMMO ${escapeXml(String(state.ammo))}</text>
    <text x="294" y="384" fill="#fde68a" font-size="16" font-family="'Courier New', monospace">FLOOR ${escapeXml(String(state.floor))}</text>
    <text x="416" y="384" fill="#86efac" font-size="16" font-family="'Courier New', monospace">SCORE ${escapeXml(String(state.score))}</text>
    <text x="44" y="404" fill="#f8e7ce" font-size="13" font-family="'Courier New', monospace">${escapeXml(state.lastLog)}</text>
    <rect x="${radarBox.x}" y="${radarBox.y}" width="${radarBox.w}" height="${radarBox.h}" fill="#120906" stroke="#4a2317" stroke-width="3" />
    <text x="${radarBox.x + Math.floor(radarBox.w / 2)}" y="36" text-anchor="middle" fill="#f8e7ce" font-size="12" font-family="'Courier New', monospace">RADAR</text>
    <rect x="${radarMapX - 4}" y="${radarMapY - 4}" width="${radarPixelWidth + 8}" height="${radarPixelHeight + 8}" fill="#0b0908" />
    ${radarTiles}
    ${radarEnemies}
    <rect x="${radarMapX + (state.player.x * radarCell) + 1}" y="${radarMapY + (state.player.y * radarCell) + 1}" width="${Math.max(3, radarCell - 2)}" height="${Math.max(3, radarCell - 2)}" fill="#fde68a" />
  </g>
</svg>`;
}

function renderHudSvg(rawState) {
  const state = normalizeDoomState(rawState);
  const mapSize = `${state.mapRows[0].length}x${state.mapRows.length}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="120" viewBox="0 0 720 120" role="img" aria-label="Doom-style HUD">
  <rect width="720" height="120" fill="#120906" />
  <rect x="8" y="8" width="704" height="104" fill="#2a140d" stroke="#6b2f1b" stroke-width="4" />
  <g font-family="'Courier New', monospace">
    <text x="28" y="38" fill="#fca5a5" font-size="18">HEALTH</text>
    <text x="28" y="82" fill="#fde68a" font-size="32">${escapeXml(String(state.health))}</text>
    <text x="168" y="38" fill="#93c5fd" font-size="18">AMMO</text>
    <text x="168" y="82" fill="#bfdbfe" font-size="32">${escapeXml(String(state.ammo))}</text>
    <text x="288" y="38" fill="#86efac" font-size="18">SCORE</text>
    <text x="288" y="82" fill="#dcfce7" font-size="32">${escapeXml(String(state.score))}</text>
    <text x="438" y="38" fill="#fcd34d" font-size="18">FLOOR</text>
    <text x="438" y="82" fill="#fef3c7" font-size="32">${escapeXml(String(state.floor))}</text>
    <text x="534" y="38" fill="#e5e7eb" font-size="18">ENEMIES</text>
    <text x="534" y="82" fill="#f8fafc" font-size="32">${escapeXml(String(state.enemies.length))}</text>
    <text x="638" y="38" fill="#d8b4fe" font-size="18">MAP</text>
    <text x="638" y="82" fill="#f3e8ff" font-size="26">${escapeXml(mapSize)}</text>
    <text x="28" y="104" fill="#f8e7ce" font-size="14">${escapeXml(state.lastLog)}</text>
  </g>
</svg>`;
}

function renderMinimapSvg(rawState) {
  const state = normalizeDoomState(rawState);
  const dimensions = getFloorDimensions(state.floor);
  const tileSize = Math.max(16, Math.min(26, Math.floor(360 / Math.max(dimensions.width, dimensions.height))));
  const width = state.mapRows[0].length * tileSize;
  const height = state.mapRows.length * tileSize;
  const left = getLeftDelta(state.player.facing);
  const forward = getForwardDelta(state.player.facing);
  const playerTriangle = [
    `${state.player.x * tileSize + Math.floor(tileSize / 2) + (forward.x * Math.floor(tileSize * 0.3))},${state.player.y * tileSize + Math.floor(tileSize / 2) + (forward.y * Math.floor(tileSize * 0.3))}`,
    `${state.player.x * tileSize + Math.floor(tileSize / 2) + (left.x * Math.floor(tileSize * 0.25))},${state.player.y * tileSize + Math.floor(tileSize / 2) + (left.y * Math.floor(tileSize * 0.25))}`,
    `${state.player.x * tileSize + Math.floor(tileSize / 2) - (left.x * Math.floor(tileSize * 0.25))},${state.player.y * tileSize + Math.floor(tileSize / 2) - (left.y * Math.floor(tileSize * 0.25))}`
  ].join(" ");
  const tiles = state.mapRows
    .map((row, y) => row.split("").map((tile, x) => `<rect x="${x * tileSize}" y="${y * tileSize}" width="${tileSize - 1}" height="${tileSize - 1}" fill="${tile === "#" ? "#4a1d10" : "#1a120f"}" />`).join(""))
    .join("");
  const enemies = state.enemies
    .map((enemy) => `<rect x="${enemy.x * tileSize + 4}" y="${enemy.y * tileSize + 4}" width="${Math.max(6, tileSize - 8)}" height="${Math.max(6, tileSize - 8)}" fill="#ef4444" />`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Dungeon minimap">
  <rect width="${width}" height="${height}" fill="#0b0908" />
  <g shape-rendering="crispEdges">
    ${tiles}
    ${enemies}
    <polygon points="${playerTriangle}" fill="#fde68a" />
  </g>
</svg>`;
}

function renderButtonSvg({ label, accent, sublabel = "" }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="58" viewBox="0 0 150 58" role="img" aria-label="${escapeXml(label)} button">
  <rect width="150" height="58" fill="#180b07" />
  <rect x="4" y="4" width="142" height="50" fill="#2d160f" stroke="${accent}" stroke-width="4" />
  <text x="75" y="28" text-anchor="middle" fill="#f8e7ce" font-size="16" font-family="'Courier New', monospace">${escapeXml(label)}</text>
  <text x="75" y="45" text-anchor="middle" fill="${accent}" font-size="10" font-family="'Courier New', monospace">${escapeXml(sublabel)}</text>
</svg>`;
}

function renderImage(route, state) {
  if (route === "doomViewImage") {
    return { type: "svg", body: renderViewSvg(state) };
  }
  if (route === "doomHudImage") {
    return { type: "svg", body: renderHudSvg(state) };
  }
  if (route === "doomMinimapImage") {
    return { type: "svg", body: renderMinimapSvg(state) };
  }

  const buttonMap = {
    doomButtonForwardImage: { label: "FORWARD", accent: "#f59e0b", sublabel: "MOVE 1 TILE" },
    doomButtonBackwardImage: { label: "BACK", accent: "#f59e0b", sublabel: "MOVE 1 TILE" },
    doomButtonTurnLeftImage: { label: "TURN L", accent: "#38bdf8", sublabel: "FACE LEFT" },
    doomButtonTurnRightImage: { label: "TURN R", accent: "#38bdf8", sublabel: "FACE RIGHT" },
    doomButtonStrafeLeftImage: { label: "STEP L", accent: "#22c55e", sublabel: "SIDE MOVE" },
    doomButtonStrafeRightImage: { label: "STEP R", accent: "#22c55e", sublabel: "SIDE MOVE" },
    doomButtonShootImage: { label: "SHOOT", accent: "#ef4444", sublabel: "1 AMMO" },
    doomButtonWaitImage: { label: "WAIT", accent: "#a78bfa", sublabel: "ADVANCE TURN" }
  };

  return {
    type: "svg",
    body: renderButtonSvg(buttonMap[route] || { label: "ACTION", accent: "#f8e7ce" })
  };
}

async function runAction(route, stateStore) {
  await stateStore.mutateState((current) => applyDoomAction(current, route));
}

function createFileStateStore({ filePath }) {
  return createFileJsonStateStore({
    filePath,
    createFreshState: createFreshDoomState,
    normalizeState: normalizeDoomState
  });
}

function createRedisStateStore({ redis, key }) {
  return createRedisJsonStateStore({
    redis,
    key,
    createFreshState: createFreshDoomState,
    normalizeState: normalizeDoomState
  });
}

module.exports = {
  slug,
  routeMap,
  actionRoutes,
  createFreshState: createFreshDoomState,
  normalizeState: normalizeDoomState,
  routeNeedsState,
  getRateLimitAction,
  renderHome,
  renderImage,
  runAction,
  createFileStateStore,
  createRedisStateStore
};
