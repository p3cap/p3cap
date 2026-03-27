const { createFileJsonStateStore, createRedisJsonStateStore } = require("../../json-state-store");
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
  getButtonTextureUri,
  getEnemyTextureUri,
  getEffectTextureUri,
  getSurfaceTextureUri,
  renderTexturedPolygon,
  renderTexturedRect
} = require("./doom-textures");
const {
  createRaycastFrame,
  projectBillboardBounds
} = require("./doom-raycaster");

const ENEMY_SPRITE_BY_DEPTH = {
  1: { cx: 360, baseY: 308, w: 126, h: 168 },
  2: { cx: 360, baseY: 288, w: 86, h: 116 },
  3: { cx: 360, baseY: 270, w: 56, h: 76 },
  4: { cx: 360, baseY: 256, w: 38, h: 52 }
};
const VIEWPORT_BOX = { x: 10, y: 10, w: 700, h: 342 };
const HUD_BOX = { x: 10, y: 360, w: 700, h: 40 };
const RADAR_AREA = { w: 122, h: 88, inset: 10 };
const GUN_SPRITE_BOX = { x: 334, y: 214, w: 152, h: 118 };
const VIEWPORT_CENTER = { x: 360, y: 180 };

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
  const sprite = ENEMY_SPRITE_BY_DEPTH[depth];
  if (!sprite || !enemy) {
    return "";
  }

  const textureUri = getEnemyTextureUri(state, enemy);
  if (!textureUri) {
    return "";
  }
  const { x, y, w, h, cx, baseY } = getEnemySpriteBounds(depth);

  return `
  <g>
    <ellipse cx="${cx}" cy="${baseY - 4}" rx="${Math.floor(w * 0.33)}" ry="${Math.max(4, Math.floor(h * 0.08))}" fill="#000000" opacity="0.35" />
    <image href="${escapeXml(textureUri)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMax meet" image-rendering="pixelated" />
  </g>`;
}

function getEnemySpriteBounds(depth) {
  const sprite = ENEMY_SPRITE_BY_DEPTH[depth];
  if (!sprite) {
    return null;
  }

  return {
    ...sprite,
    x: sprite.cx - Math.floor(sprite.w / 2),
    y: sprite.baseY - sprite.h
  };
}

function renderGunSprite(state) {
  const isFiring = state.viewEvent && (state.viewEvent.type === "shoot" || state.viewEvent.type === "enemy-death");
  const firingTextureUri = isFiring
    ? getEffectTextureUri("gunShot", `${state.floor}:${state.turn}:${state.ammo}`)
    : "";
  const textureUri = firingTextureUri || getSurfaceTextureUri(state, "gun", `${state.floor}:${state.ammo}:${state.turn}`);
  if (!textureUri) {
    return "";
  }

  return `
    <g>
      <ellipse cx="410" cy="332" rx="58" ry="11" fill="#000000" opacity="0.24" />
      ${renderTexturedRect(GUN_SPRITE_BOX.x, GUN_SPRITE_BOX.y, GUN_SPRITE_BOX.w, GUN_SPRITE_BOX.h, textureUri)}
    </g>`;
}

function renderViewportFrame() {
  const frameUri = getEffectTextureUri("screenFrame");
  if (!frameUri) {
    return "";
  }

  return `<image href="${escapeXml(frameUri)}" x="0" y="0" width="720" height="420" preserveAspectRatio="none" image-rendering="pixelated" />`;
}

function renderBottomStats(state, hpColor) {
  const slots = [
    { label: "HP", value: String(state.health), color: hpColor },
    { label: "AMMO", value: String(state.ammo), color: "#bfdbfe" },
    { label: "FLOOR", value: String(state.floor), color: "#fde68a" },
    { label: "SCORE", value: String(state.score), color: "#86efac" }
  ];
  const slotWidth = HUD_BOX.w / slots.length;

  return slots.map((slot, index) => {
    const centerX = HUD_BOX.x + (slotWidth * index) + (slotWidth / 2);
    return `<text x="${centerX}" y="386" text-anchor="middle" fill="${slot.color}" font-size="18" font-family="'Courier New', monospace">${escapeXml(slot.label)} ${escapeXml(slot.value)}</text>`;
  }).join("\n");
}

function renderDeathViewSvg(state) {
  const deathScreenUri = getEffectTextureUri("deathScreen");
  const bloodUri = getEffectTextureUri("playerDeath", `${state.floor}:${state.turn}`);
  const hpColor = "#fca5a5";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420" role="img" aria-label="Doom death screen">
  ${deathScreenUri
    ? `<image href="${escapeXml(deathScreenUri)}" x="0" y="0" width="720" height="420" preserveAspectRatio="none" image-rendering="pixelated" />`
    : ""}
  ${bloodUri
    ? `<image href="${escapeXml(bloodUri)}" x="210" y="224" width="300" height="118" preserveAspectRatio="none" image-rendering="pixelated" />`
    : ""}
  <text x="360" y="160" text-anchor="middle" fill="#ffe4e6" font-size="40" font-family="'Courier New', monospace" opacity="0">You deid
    <animate attributeName="opacity" values="0;0;1" dur="760ms" fill="freeze" />
  </text>
  <text x="360" y="200" text-anchor="middle" fill="#fecdd3" font-size="17" font-family="'Courier New', monospace" opacity="0">press any button to start a new game
    <animate attributeName="opacity" values="0;0;1" dur="860ms" fill="freeze" />
  </text>
  ${renderBottomStats({ ...state, health: 0, ammo: 0 }, hpColor)}
</svg>`;
}

function renderFloorClearSvg(state) {
  const panelUri = getEffectTextureUri("floorClearPanel");
  const nextFloor = state.pendingFloor && state.pendingFloor.floor
    ? state.pendingFloor.floor
    : state.floor + 1;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420" role="img" aria-label="Floor clear screen">
  ${panelUri
    ? `<image href="${escapeXml(panelUri)}" x="0" y="0" width="720" height="420" preserveAspectRatio="none" image-rendering="pixelated" />`
    : ""}
  <text x="360" y="138" text-anchor="middle" fill="#fca5a5" font-size="24" font-family="'Courier New', monospace">FLOOR CLEARED</text>
  <text x="360" y="186" text-anchor="middle" fill="#f8fafc" font-size="30" font-family="'Courier New', monospace">Congrats, you&apos;ve beaten floor ${escapeXml(String(state.floor))}</text>
  <text x="360" y="226" text-anchor="middle" fill="#fde68a" font-size="18" font-family="'Courier New', monospace">score +250   health +15   ammo +4</text>
  <text x="360" y="268" text-anchor="middle" fill="#e5e7eb" font-size="17" font-family="'Courier New', monospace">Press any button to continue to floor ${escapeXml(String(nextFloor))}</text>
  <text x="360" y="290" text-anchor="middle" fill="#9ca3af" font-size="14" font-family="'Courier New', monospace">One more descent into the maze.</text>
  ${renderBottomStats(state, "#86efac")}
</svg>`;
}

function renderViewEvent(state, frame) {
  const enemyDeathUri = state.viewEvent.type === "enemy-death"
    ? getEffectTextureUri("enemyDeath", `${state.turn}:${state.viewEvent.depth}`)
    : "";

  if (state.viewEvent.type === "enemy-death" && enemyDeathUri && frame) {
    const bounds = projectBillboardBounds(frame, state.viewEvent.x, state.viewEvent.y, {
      widthScale: 1.18,
      heightScale: 1.18
    });
    if (bounds) {
      return `
      <image href="${escapeXml(enemyDeathUri)}" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" preserveAspectRatio="xMidYMid meet" image-rendering="pixelated" />`;
    }
  }

  return "";
}

function withPlayer(state, playerOverride) {
  return {
    ...state,
    player: {
      ...state.player,
      ...playerOverride
    }
  };
}

function getDarknessOpacity(depth) {
  return Math.min(0.55, 0.12 + (depth * 0.08));
}

function renderSideEnemySprite(state, enemy, depth, direction, clipId, clipPoints) {
  const sprite = getEnemySpriteBounds(depth);
  if (!sprite || !enemy) {
    return "";
  }

  const textureUri = getEnemyTextureUri(state, enemy);
  if (!textureUri) {
    return "";
  }

  const scale = 0.82;
  const offset = Math.round(sprite.w * 0.75) * (direction < 0 ? -1 : 1);
  const w = Math.max(18, Math.round(sprite.w * scale));
  const h = Math.max(24, Math.round(sprite.h * scale));
  const cx = sprite.cx + offset;
  const x = cx - Math.floor(w / 2);
  const y = sprite.baseY - h;

  return `
  <g opacity="0.9">
    <ellipse cx="${cx}" cy="${sprite.baseY - 4}" rx="${Math.floor(w * 0.33)}" ry="${Math.max(3, Math.floor(h * 0.08))}" fill="#000000" opacity="0.35" />
    <defs>
      <clipPath id="${clipId}">
        <polygon points="${clipPoints}" />
      </clipPath>
    </defs>
    <image href="${escapeXml(textureUri)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMax meet" image-rendering="pixelated" clip-path="url(#${clipId})" />
  </g>`;
}

function buildViewportScene(state) {
  const frames = [
    { x: 26, y: 22, w: 668, h: 308 },
    { x: 92, y: 50, w: 536, h: 252 },
    { x: 156, y: 80, w: 408, h: 196 },
    { x: 218, y: 108, w: 284, h: 150 },
    { x: 278, y: 136, w: 164, h: 106 },
    { x: 324, y: 160, w: 72, h: 70 }
  ];
  const corridorLayers = [];
  let frontWall = "";
  let enemyInSight = null;
  let enemyDepth = 0;
  const sideEnemies = [];

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

      corridorLayers.push(renderTexturedPolygon(ceilingPoints, getSurfaceTextureUri(state, "ceiling", `${center.x}:${center.y}:ceiling:${depth}`)));
      corridorLayers.push(`<polygon points="${ceilingPoints}" fill="none" stroke="#100908" stroke-width="1" opacity="0.45" />`);
      corridorLayers.push(renderTexturedPolygon(floorPoints, getSurfaceTextureUri(state, "floor", `${center.x}:${center.y}:floor:${depth}`)));

      if (left.wall) {
        corridorLayers.push(renderTexturedPolygon(leftPoints, getSurfaceTextureUri(state, "wall", `${left.x}:${left.y}`)));
        corridorLayers.push(`<polygon points="${leftPoints}" fill="none" stroke="#23120b" stroke-width="2" />`);
      } else {
        corridorLayers.push(renderTexturedPolygon(leftPoints, getSurfaceTextureUri(state, "wall", `${left.x}:${left.y}:open`)));
        corridorLayers.push(`<polygon points="${leftPoints}" fill="#000000" opacity="${getDarknessOpacity(depth)}" />`);
        if (left.enemy) {
          const clipId = `clip-left-${depth}-${left.enemy.id}`;
          sideEnemies.push(renderSideEnemySprite(state, left.enemy, depth, -1, clipId, leftPoints));
        }
      }

      if (right.wall) {
        corridorLayers.push(renderTexturedPolygon(rightPoints, getSurfaceTextureUri(state, "wall", `${right.x}:${right.y}`)));
        corridorLayers.push(`<polygon points="${rightPoints}" fill="none" stroke="#23120b" stroke-width="2" />`);
      } else {
        corridorLayers.push(renderTexturedPolygon(rightPoints, getSurfaceTextureUri(state, "wall", `${right.x}:${right.y}:open`)));
        corridorLayers.push(`<polygon points="${rightPoints}" fill="#000000" opacity="${getDarknessOpacity(depth)}" />`);
        if (right.enemy) {
          const clipId = `clip-right-${depth}-${right.enemy.id}`;
          sideEnemies.push(renderSideEnemySprite(state, right.enemy, depth, 1, clipId, rightPoints));
        }
      }

    if (!enemyDepth && center.enemy && !center.wall) {
      enemyDepth = depth;
      enemyInSight = center.enemy;
    }

    if (center.wall) {
      frontWall = `
        ${renderTexturedRect(inner.x, inner.y, inner.w, inner.h, getSurfaceTextureUri(state, "wall", `${center.x}:${center.y}`))}
        <rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="none" stroke="#23120b" stroke-width="3" />
      `;
      break;
    }
  }

  return {
    corridorLayers,
    frontWall,
    enemyDepth,
    enemyInSight,
    sideEnemies
  };
}

function renderOverlayEvent(state) {
  const damageFrameUri = state.overlayEvent && state.overlayEvent.type === "player-hurt"
    ? getEffectTextureUri("damageFrame", `${state.turn}:${state.overlayEvent.damage}`)
    : "";

  if (!damageFrameUri) {
    return "";
  }

  return `<image href="${escapeXml(damageFrameUri)}" x="0" y="0" width="720" height="420" preserveAspectRatio="none" image-rendering="pixelated" />`;
}

function renderViewSvg(rawState) {
  const state = normalizeDoomState(rawState);
  if (state.status === "dead" || state.health <= 0) {
    return renderDeathViewSvg(state);
  }
  if (state.status === "floor-clear") {
    return renderFloorClearSvg(state);
  }

  const shouldAnimate = Boolean(state.lastPlayer && state.lastAction);
  const animationMs = state.lastAction && state.lastAction.startsWith("doomTurn") ? 180 : 220;
  const previousState = shouldAnimate ? withPlayer(state, state.lastPlayer) : null;
  const currentFrame = createRaycastFrame(state);
  const previousFrame = shouldAnimate ? createRaycastFrame(previousState) : null;
  const moveDirection = state.lastAction || "";
  const moveShiftX = moveDirection === "doomStrafeLeft" ? -10
    : moveDirection === "doomStrafeRight" ? 10
      : 0;
  const moveShiftY = moveDirection === "doomForward" ? 12
    : moveDirection === "doomBackward" ? -10
      : 0;
  const isTurn = moveDirection === "doomTurnLeft" || moveDirection === "doomTurnRight";
  const turnAngle = moveDirection === "doomTurnLeft" ? -6 : moveDirection === "doomTurnRight" ? 6 : 0;

  const hpColor = state.health > 50 ? "#86efac" : state.health > 20 ? "#fde68a" : "#fca5a5";
  const mapWidth = state.mapRows[0].length;
  const mapHeight = state.mapRows.length;
  const radarCell = Math.max(4, Math.min(8, Math.floor((RADAR_AREA.w - 2) / mapWidth), Math.floor((RADAR_AREA.h - 2) / mapHeight)));
  const radarPixelWidth = mapWidth * radarCell;
  const radarPixelHeight = mapHeight * radarCell;
  const radarMapX = VIEWPORT_BOX.x + VIEWPORT_BOX.w - radarPixelWidth - RADAR_AREA.inset;
  const radarMapY = VIEWPORT_BOX.y + RADAR_AREA.inset;
  const radarCenterX = radarMapX + (state.player.x * radarCell) + Math.floor(radarCell / 2);
  const radarCenterY = radarMapY + (state.player.y * radarCell) + Math.floor(radarCell / 2);
  const radarForward = getForwardDelta(state.player.facing);
  const radarLeft = getLeftDelta(state.player.facing);
  const radarPlayerTriangle = [
    `${radarCenterX + (radarForward.x * Math.max(3, Math.floor(radarCell * 0.38)))},${radarCenterY + (radarForward.y * Math.max(3, Math.floor(radarCell * 0.38)))}`,
    `${radarCenterX + (radarLeft.x * Math.max(2, Math.floor(radarCell * 0.28)))},${radarCenterY + (radarLeft.y * Math.max(2, Math.floor(radarCell * 0.28)))}`,
    `${radarCenterX - (radarLeft.x * Math.max(2, Math.floor(radarCell * 0.28)))},${radarCenterY - (radarLeft.y * Math.max(2, Math.floor(radarCell * 0.28)))}`
  ].join(" ");
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
    <rect x="${VIEWPORT_BOX.x}" y="${VIEWPORT_BOX.y}" width="${VIEWPORT_BOX.w}" height="${VIEWPORT_BOX.h}" fill="#120909" />
      ${shouldAnimate && previousFrame ? `
      <g opacity="1">
        <animate attributeName="opacity" from="1" to="0" dur="${animationMs}ms" fill="freeze" />
        ${isTurn
          ? `<animateTransform attributeName="transform" type="rotate" from="${turnAngle} ${VIEWPORT_CENTER.x} ${VIEWPORT_CENTER.y}" to="0 ${VIEWPORT_CENTER.x} ${VIEWPORT_CENTER.y}" dur="${animationMs}ms" fill="freeze" />`
          : `<animateTransform attributeName="transform" type="translate" from="${moveShiftX} ${moveShiftY}" to="0 0" dur="${animationMs}ms" fill="freeze" />`}
        ${previousFrame.markup}
      </g>
      ` : ""}
      <g opacity="${shouldAnimate ? "0" : "1"}">
        ${shouldAnimate
          ? `<animate attributeName="opacity" from="0" to="1" dur="${animationMs}ms" fill="freeze" />`
          : ""}
        ${isTurn
          ? `<animateTransform attributeName="transform" type="rotate" from="${turnAngle} ${VIEWPORT_CENTER.x} ${VIEWPORT_CENTER.y}" to="0 ${VIEWPORT_CENTER.x} ${VIEWPORT_CENTER.y}" dur="${animationMs}ms" fill="freeze" />`
          : (moveShiftX || moveShiftY)
            ? `<animateTransform attributeName="transform" type="translate" from="${-moveShiftX} ${-moveShiftY}" to="0 0" dur="${animationMs}ms" fill="freeze" />`
            : ""}
        ${currentFrame.markup}
      </g>
      ${renderViewEvent(state, currentFrame)}
      ${renderGunSprite(state)}
      ${renderOverlayEvent(state)}
      ${renderViewportFrame()}
    ${renderBottomStats(state, hpColor)}
    ${radarTiles}
    ${radarEnemies}
    <polygon points="${radarPlayerTriangle}" fill="#fde68a" />
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

function renderButtonSvg(buttonType, label) {
  const textureUri = getButtonTextureUri(buttonType);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="58" viewBox="0 0 150 58" role="img" aria-label="${escapeXml(label)} button">
  <rect width="150" height="58" fill="#000000" />
  ${textureUri
    ? `<image href="${escapeXml(textureUri)}" x="0" y="0" width="150" height="58" preserveAspectRatio="none" image-rendering="pixelated" />`
    : ""}
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
    doomButtonForwardImage: { buttonType: "forward", label: "FORWARD" },
    doomButtonBackwardImage: { buttonType: "backward", label: "BACK" },
    doomButtonTurnLeftImage: { buttonType: "turnLeft", label: "TURN L" },
    doomButtonTurnRightImage: { buttonType: "turnRight", label: "TURN R" },
    doomButtonStrafeLeftImage: { buttonType: "strafeLeft", label: "STEP L" },
    doomButtonStrafeRightImage: { buttonType: "strafeRight", label: "STEP R" },
    doomButtonShootImage: { buttonType: "shoot", label: "SHOOT" },
    doomButtonWaitImage: { buttonType: "wait", label: "WAIT" }
  };
  const button = buttonMap[route] || { buttonType: "", label: "ACTION" };

  return {
    type: "svg",
    body: renderButtonSvg(button.buttonType, button.label)
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
