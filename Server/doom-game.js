const fs = require("fs");
const path = require("path");

const DOOM_ROUTE_MAP = new Map([
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

const MAP_ROWS = [
  "##########",
  "#........#",
  "#.##.###.#",
  "#.#....#.#",
  "#.#.##.#.#",
  "#....#...#",
  "###.##.#.#",
  "#........#",
  "##########"
];

const START_POSITION = {
  x: 1,
  y: 7,
  facing: "N"
};

const ENEMY_SPAWN_POINTS = [
  { x: 7, y: 1 },
  { x: 4, y: 3 },
  { x: 7, y: 5 },
  { x: 2, y: 1 },
  { x: 5, y: 7 },
  { x: 1, y: 4 }
];

const DIRECTION_ORDER = ["N", "E", "S", "W"];
const DIRECTION_DELTAS = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 }
};

const ACTION_LOGS = {
  doomForward: "You step forward.",
  doomBackward: "You step back.",
  doomStrafeLeft: "You strafe left.",
  doomStrafeRight: "You strafe right.",
  doomTurnLeft: "You turn left.",
  doomTurnRight: "You turn right.",
  doomWait: "You wait one beat."
};

const DOOM_TEXTURE_DIR = path.join(__dirname, "assets", "doom");
const textureCache = new Map();

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeAttribute(value) {
  return escapeXml(value);
}

function getMimeTypeForTexture(filePath) {
  const extension = path.extname(filePath).toLowerCase();
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

function findTextureFile(baseName) {
  const extensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];

  for (const extension of extensions) {
    const candidate = path.join(DOOM_TEXTURE_DIR, `${baseName}${extension}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "";
}

function getTextureDataUri(baseName) {
  if (textureCache.has(baseName)) {
    return textureCache.get(baseName);
  }

  const texturePath = findTextureFile(baseName);
  if (!texturePath) {
    textureCache.set(baseName, "");
    return "";
  }

  const mimeType = getMimeTypeForTexture(texturePath);
  if (!mimeType) {
    textureCache.set(baseName, "");
    return "";
  }

  const dataUri = `data:${mimeType};base64,${fs.readFileSync(texturePath).toString("base64")}`;
  textureCache.set(baseName, dataUri);
  return dataUri;
}

function renderTexturedPolygon(points, textureName, fallbackFill, width, height) {
  const texture = getTextureDataUri(textureName);
  const id = `${textureName}-${Math.abs(points.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0))}`;

  if (!texture) {
    return `<polygon points="${points}" fill="${fallbackFill}" />`;
  }

  return `
  <defs>
    <clipPath id="${id}">
      <polygon points="${points}" />
    </clipPath>
  </defs>
  <image href="${texture}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" clip-path="url(#${id})" />
  `;
}

function renderTexturedRect(x, y, width, height, textureName, fallbackFill) {
  const texture = getTextureDataUri(textureName);
  if (!texture) {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fallbackFill}" />`;
  }

  return `<image href="${texture}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" />`;
}

function clampNumber(value, fallback, minimum = Number.NEGATIVE_INFINITY, maximum = Number.POSITIVE_INFINITY) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.floor(numeric)));
}

function isFacing(value) {
  return DIRECTION_ORDER.includes(value);
}

function rotateFacing(facing, direction) {
  const currentIndex = DIRECTION_ORDER.indexOf(facing);
  const delta = direction === "left" ? -1 : 1;
  return DIRECTION_ORDER[(currentIndex + delta + DIRECTION_ORDER.length) % DIRECTION_ORDER.length];
}

function getForwardDelta(facing) {
  return DIRECTION_DELTAS[facing] || DIRECTION_DELTAS.N;
}

function getLeftDelta(facing) {
  const forward = getForwardDelta(facing);
  return {
    x: forward.y,
    y: -forward.x
  };
}

function getRightDelta(facing) {
  const left = getLeftDelta(facing);
  return {
    x: -left.x,
    y: -left.y
  };
}

function isWall(x, y) {
  if (y < 0 || y >= MAP_ROWS.length) {
    return true;
  }

  const row = MAP_ROWS[y];
  return x < 0 || x >= row.length || row[x] === "#";
}

function pointKey(x, y) {
  return `${x},${y}`;
}

function createEnemy({ id, x, y, hp = 1 }) {
  return {
    id,
    type: "imp",
    x,
    y,
    hp
  };
}

function createEnemiesForFloor(floor) {
  const count = Math.min(ENEMY_SPAWN_POINTS.length, 2 + Math.floor((floor - 1) / 1));
  const offset = (floor - 1) % ENEMY_SPAWN_POINTS.length;
  const hp = floor >= 4 ? 2 : 1;
  const enemies = [];

  for (let index = 0; index < count; index += 1) {
    const spawn = ENEMY_SPAWN_POINTS[(offset + index) % ENEMY_SPAWN_POINTS.length];
    enemies.push(createEnemy({
      id: `imp-${floor}-${index + 1}`,
      x: spawn.x,
      y: spawn.y,
      hp
    }));
  }

  return enemies;
}

function createDoomFloorState({
  floor = 1,
  score = 0,
  health = 100,
  ammo = 6,
  keys = 0,
  turn = 0,
  lastLog = ""
} = {}) {
  return {
    floor,
    score,
    health,
    ammo,
    keys,
    turn,
    status: "playing",
    player: {
      x: START_POSITION.x,
      y: START_POSITION.y,
      facing: START_POSITION.facing
    },
    enemies: createEnemiesForFloor(floor),
    lastLog: lastLog || `Entered floor ${floor}.`,
    updatedAt: new Date().toISOString()
  };
}

function createFreshDoomState() {
  return createDoomFloorState({
    floor: 1,
    score: 0,
    health: 100,
    ammo: 6,
    keys: 0,
    turn: 0,
    lastLog: "A silent hallway waits."
  });
}

function parseEnemies(source, fallbackFloor) {
  const raw = Array.isArray(source)
    ? source
    : typeof source === "string"
      ? (() => {
        try {
          return JSON.parse(source);
        } catch (error) {
          return [];
        }
      })()
      : [];

  const enemies = raw
    .map((enemy, index) => ({
      id: typeof enemy.id === "string" && enemy.id.trim() ? enemy.id.trim() : `imp-${fallbackFloor}-${index + 1}`,
      type: "imp",
      x: clampNumber(enemy.x, 1, 1, MAP_ROWS[0].length - 2),
      y: clampNumber(enemy.y, 1, 1, MAP_ROWS.length - 2),
      hp: clampNumber(enemy.hp, 1, 1, 9)
    }))
    .filter((enemy) => !isWall(enemy.x, enemy.y));

  return enemies;
}

function normalizeDoomState(state) {
  const source = state || {};
  const fallback = createFreshDoomState();
  const floor = clampNumber(source.floor, fallback.floor, 1, 99);
  const player = source.player && typeof source.player === "object" ? source.player : {};
  const enemies = parseEnemies(source.enemies, floor);

  return {
    floor,
    score: clampNumber(source.score, fallback.score, 0, 999999),
    health: clampNumber(source.health, fallback.health, 0, 100),
    ammo: clampNumber(source.ammo, fallback.ammo, 0, 99),
    keys: clampNumber(source.keys, fallback.keys, 0, 9),
    turn: clampNumber(source.turn, fallback.turn, 0, 999999),
    status: source.status === "dead" ? "dead" : "playing",
    player: {
      x: isWall(clampNumber(player.x, START_POSITION.x, 1, MAP_ROWS[0].length - 2), clampNumber(player.y, START_POSITION.y, 1, MAP_ROWS.length - 2))
        ? START_POSITION.x
        : clampNumber(player.x, START_POSITION.x, 1, MAP_ROWS[0].length - 2),
      y: isWall(clampNumber(player.x, START_POSITION.x, 1, MAP_ROWS[0].length - 2), clampNumber(player.y, START_POSITION.y, 1, MAP_ROWS.length - 2))
        ? START_POSITION.y
        : clampNumber(player.y, START_POSITION.y, 1, MAP_ROWS.length - 2),
      facing: isFacing(player.facing) ? player.facing : START_POSITION.facing
    },
    enemies,
    lastLog: typeof source.lastLog === "string" && source.lastLog.trim()
      ? source.lastLog.trim()
      : fallback.lastLog,
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt.trim()
      ? source.updatedAt.trim()
      : new Date().toISOString()
  };
}

function cloneDoomState(state) {
  return JSON.parse(JSON.stringify(state));
}

function getEnemyAt(state, x, y) {
  return state.enemies.find((enemy) => enemy.hp > 0 && enemy.x === x && enemy.y === y) || null;
}

function canPlayerMoveTo(state, x, y) {
  return !isWall(x, y) && !getEnemyAt(state, x, y);
}

function movePlayer(state, delta, fallbackLog) {
  const targetX = state.player.x + delta.x;
  const targetY = state.player.y + delta.y;

  if (!canPlayerMoveTo(state, targetX, targetY)) {
    state.lastLog = `${fallbackLog} A wall or monster blocks the way.`;
    return;
  }

  state.player.x = targetX;
  state.player.y = targetY;
  state.lastLog = fallbackLog;
}

function traceShot(state) {
  const delta = getForwardDelta(state.player.facing);
  let x = state.player.x + delta.x;
  let y = state.player.y + delta.y;

  while (!isWall(x, y)) {
    const enemy = getEnemyAt(state, x, y);
    if (enemy) {
      return enemy;
    }

    x += delta.x;
    y += delta.y;
  }

  return null;
}

function chooseEnemyMove(enemy, state, occupied) {
  const diffX = state.player.x - enemy.x;
  const diffY = state.player.y - enemy.y;
  const candidateDeltas = [];

  if (Math.abs(diffX) >= Math.abs(diffY)) {
    if (diffX !== 0) {
      candidateDeltas.push({ x: Math.sign(diffX), y: 0 });
    }
    if (diffY !== 0) {
      candidateDeltas.push({ x: 0, y: Math.sign(diffY) });
    }
  } else {
    if (diffY !== 0) {
      candidateDeltas.push({ x: 0, y: Math.sign(diffY) });
    }
    if (diffX !== 0) {
      candidateDeltas.push({ x: Math.sign(diffX), y: 0 });
    }
  }

  for (const delta of candidateDeltas) {
    const targetX = enemy.x + delta.x;
    const targetY = enemy.y + delta.y;
    const targetKey = pointKey(targetX, targetY);

    if (isWall(targetX, targetY)) {
      continue;
    }

    if (targetX === state.player.x && targetY === state.player.y) {
      continue;
    }

    if (occupied.has(targetKey)) {
      continue;
    }

    return { x: targetX, y: targetY };
  }

  return null;
}

function advanceEnemies(state) {
  let damage = 0;
  let movers = 0;
  const occupied = new Set(
    state.enemies
      .filter((enemy) => enemy.hp > 0)
      .map((enemy) => pointKey(enemy.x, enemy.y))
  );

  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      continue;
    }

    const distance = Math.abs(enemy.x - state.player.x) + Math.abs(enemy.y - state.player.y);
    if (distance === 1) {
      damage += 12;
      continue;
    }

    occupied.delete(pointKey(enemy.x, enemy.y));
    const nextPosition = chooseEnemyMove(enemy, state, occupied);
    if (nextPosition) {
      enemy.x = nextPosition.x;
      enemy.y = nextPosition.y;
      movers += 1;
    }
    occupied.add(pointKey(enemy.x, enemy.y));
  }

  if (damage > 0) {
    state.health = Math.max(0, state.health - damage);
  }

  return {
    damage,
    movers
  };
}

function advanceFloor(state) {
  const nextFloor = state.floor + 1;
  return createDoomFloorState({
    floor: nextFloor,
    score: state.score + 250,
    health: Math.min(100, state.health + 15),
    ammo: Math.min(99, state.ammo + 4),
    keys: state.keys,
    turn: state.turn,
    lastLog: `Floor clear. Descending to floor ${nextFloor}.`
  });
}

function applyDoomAction(currentState, route) {
  const state = normalizeDoomState(cloneDoomState(currentState));

  if (state.status === "dead" || state.health <= 0) {
    return createDoomFloorState({
      floor: 1,
      score: 0,
      health: 100,
      ammo: 6,
      keys: 0,
      turn: 0,
      lastLog: "Marine redeployed."
    });
  }

  if (route === "doomTurnLeft") {
    state.player.facing = rotateFacing(state.player.facing, "left");
    state.lastLog = ACTION_LOGS[route];
  } else if (route === "doomTurnRight") {
    state.player.facing = rotateFacing(state.player.facing, "right");
    state.lastLog = ACTION_LOGS[route];
  } else if (route === "doomForward") {
    movePlayer(state, getForwardDelta(state.player.facing), ACTION_LOGS[route]);
  } else if (route === "doomBackward") {
    const forward = getForwardDelta(state.player.facing);
    movePlayer(state, { x: -forward.x, y: -forward.y }, ACTION_LOGS[route]);
  } else if (route === "doomStrafeLeft") {
    movePlayer(state, getLeftDelta(state.player.facing), ACTION_LOGS[route]);
  } else if (route === "doomStrafeRight") {
    movePlayer(state, getRightDelta(state.player.facing), ACTION_LOGS[route]);
  } else if (route === "doomShoot") {
    if (state.ammo <= 0) {
      state.lastLog = "Click. Out of ammo.";
    } else {
      state.ammo -= 1;
      const enemy = traceShot(state);
      if (enemy) {
        enemy.hp = 0;
        state.score += 100;
        state.lastLog = "You blast an imp.";
      } else {
        state.lastLog = "Shot echoes into the dark.";
      }
    }
  } else {
    state.lastLog = ACTION_LOGS[route] || "You hold position.";
  }

  state.turn += 1;
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  if (state.enemies.length === 0) {
    return advanceFloor(state);
  }

  const enemyTurn = advanceEnemies(state);
  if (state.health <= 0) {
    state.status = "dead";
    state.lastLog = enemyTurn.damage > 0
      ? `Imps tear you apart for ${enemyTurn.damage}. Press any button to restart.`
      : "You collapse in the dark. Press any button to restart.";
    return state;
  }

  if (state.enemies.length === 0) {
    return advanceFloor(state);
  }

  if (enemyTurn.damage > 0) {
    state.lastLog = `${state.lastLog} Imps hit for ${enemyTurn.damage}.`;
  } else if (enemyTurn.movers > 0) {
    state.lastLog = `${state.lastLog} The hallway shifts as enemies advance.`;
  }

  return state;
}

function buildLobbyPath(gameSlug, lobbySlug, suffix = "") {
  return `/${gameSlug}/${lobbySlug}${suffix}`;
}

function renderDoomHome(state, { defaultRedirectUrl = "", gameSlug, lobbySlug, actionCooldownMs = 0 }) {
  const hint = defaultRedirectUrl
    ? `Default redirect: <code>${escapeXml(defaultRedirectUrl)}</code>`
    : "Set README_REDIRECT_URL to bounce action links back to GitHub automatically.";

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
      <p><strong>Facing:</strong> ${escapeXml(state.player.facing)} | <strong>Position:</strong> (${escapeXml(String(state.player.x))}, ${escapeXml(String(state.player.y))})</p>
      <p><strong>Last log:</strong> ${escapeXml(state.lastLog)}</p>
      <p>${hint}</p>
      <p><strong>Anti-spam:</strong> about one action every ${(actionCooldownMs / 1000).toFixed(actionCooldownMs < 1000 ? 1 : 0)}s per IP, per game.</p>
      <p>Core actions: <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/forward"))}</code>, <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/turn-left"))}</code>, <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/shoot"))}</code>.</p>
    </main>
  </body>
</html>`;
}

function getTileInDirection(state, depth, offset = 0) {
  const forward = getForwardDelta(state.player.facing);
  const right = getRightDelta(state.player.facing);
  const x = state.player.x + (forward.x * depth) + (right.x * offset);
  const y = state.player.y + (forward.y * depth) + (right.y * offset);

  return {
    x,
    y,
    wall: isWall(x, y),
    enemy: getEnemyAt(state, x, y)
  };
}

function renderEnemySprite(depth) {
  const spriteByDepth = {
    1: { x: 300, y: 155, w: 120, h: 160 },
    2: { x: 325, y: 185, w: 70, h: 105 },
    3: { x: 340, y: 205, w: 40, h: 68 },
    4: { x: 347, y: 215, w: 26, h: 42 }
  };
  const sprite = spriteByDepth[depth];
  if (!sprite) {
    return "";
  }

  return `
  <g shape-rendering="crispEdges">
    <rect x="${sprite.x + Math.floor(sprite.w * 0.2)}" y="${sprite.y}" width="${Math.floor(sprite.w * 0.6)}" height="${Math.floor(sprite.h * 0.26)}" fill="#7f1d1d" />
    <rect x="${sprite.x + Math.floor(sprite.w * 0.1)}" y="${sprite.y + Math.floor(sprite.h * 0.22)}" width="${Math.floor(sprite.w * 0.8)}" height="${Math.floor(sprite.h * 0.38)}" fill="#b91c1c" />
    <rect x="${sprite.x + Math.floor(sprite.w * 0.18)}" y="${sprite.y + Math.floor(sprite.h * 0.66)}" width="${Math.floor(sprite.w * 0.25)}" height="${Math.floor(sprite.h * 0.28)}" fill="#7f1d1d" />
    <rect x="${sprite.x + Math.floor(sprite.w * 0.57)}" y="${sprite.y + Math.floor(sprite.h * 0.66)}" width="${Math.floor(sprite.w * 0.25)}" height="${Math.floor(sprite.h * 0.28)}" fill="#7f1d1d" />
    <rect x="${sprite.x + Math.floor(sprite.w * 0.3)}" y="${sprite.y + Math.floor(sprite.h * 0.09)}" width="${Math.max(2, Math.floor(sprite.w * 0.12))}" height="${Math.max(2, Math.floor(sprite.h * 0.06))}" fill="#fef08a" />
    <rect x="${sprite.x + Math.floor(sprite.w * 0.58)}" y="${sprite.y + Math.floor(sprite.h * 0.09)}" width="${Math.max(2, Math.floor(sprite.w * 0.12))}" height="${Math.max(2, Math.floor(sprite.h * 0.06))}" fill="#fef08a" />
  </g>`;
}

function renderDoomViewSvg(state) {
  const frames = [
    { x: 66, y: 56, w: 588, h: 252 },
    { x: 126, y: 84, w: 468, h: 212 },
    { x: 184, y: 112, w: 352, h: 172 },
    { x: 236, y: 138, w: 248, h: 136 },
    { x: 282, y: 160, w: 156, h: 102 },
    { x: 322, y: 180, w: 76, h: 66 }
  ];
  const corridorLayers = [];
  let frontWall = `<rect x="${frames[5].x}" y="${frames[5].y}" width="${frames[5].w}" height="${frames[5].h}" fill="#080506" />`;
  let enemyDepth = 0;

  for (let depth = 1; depth <= 5; depth += 1) {
    const outer = frames[depth - 1];
    const inner = frames[depth];
    const center = getTileInDirection(state, depth, 0);
    const left = getTileInDirection(state, depth, -1);
    const right = getTileInDirection(state, depth, 1);
    const wallTone = depth <= 2 ? "#7c3d1d" : depth === 3 ? "#683116" : "#522611";
    const edgeTone = depth <= 2 ? "#31140b" : "#24100a";
    const openingTone = "#0c0707";
    const ceilingTone = depth <= 2 ? "#22110d" : "#180d0b";
    const floorTone = depth <= 2 ? "#19120d" : "#120c09";
    const leftPoints = `${outer.x},${outer.y} ${inner.x},${inner.y} ${inner.x},${inner.y + inner.h} ${outer.x},${outer.y + outer.h}`;
    const rightPoints = `${outer.x + outer.w},${outer.y} ${inner.x + inner.w},${inner.y} ${inner.x + inner.w},${inner.y + inner.h} ${outer.x + outer.w},${outer.y + outer.h}`;
    const ceilingPoints = `${outer.x},${outer.y} ${outer.x + outer.w},${outer.y} ${inner.x + inner.w},${inner.y} ${inner.x},${inner.y}`;
    const floorPoints = `${outer.x},${outer.y + outer.h} ${outer.x + outer.w},${outer.y + outer.h} ${inner.x + inner.w},${inner.y + inner.h} ${inner.x},${inner.y + inner.h}`;

    if (!enemyDepth && center.enemy && !center.wall) {
      enemyDepth = depth;
    }

    if (left.wall) {
      corridorLayers.push(renderTexturedPolygon(leftPoints, "wall-side", wallTone, 720, 420));
      corridorLayers.push(`<polygon points="${leftPoints}" fill="none" stroke="${edgeTone}" stroke-width="2" />`);
    } else {
      corridorLayers.push(`<polygon points="${leftPoints}" fill="${openingTone}" />`);
    }

    if (right.wall) {
      corridorLayers.push(renderTexturedPolygon(rightPoints, "wall-side", wallTone, 720, 420));
      corridorLayers.push(`<polygon points="${rightPoints}" fill="none" stroke="${edgeTone}" stroke-width="2" />`);
    } else {
      corridorLayers.push(`<polygon points="${rightPoints}" fill="${openingTone}" />`);
    }

    corridorLayers.push(renderTexturedPolygon(ceilingPoints, "ceiling", ceilingTone, 720, 420));
    corridorLayers.push(`<polygon points="${ceilingPoints}" fill="none" stroke="#130b09" stroke-width="2" />`);
    corridorLayers.push(renderTexturedPolygon(floorPoints, "floor", floorTone, 720, 420));
    corridorLayers.push(`<polygon points="${floorPoints}" fill="none" stroke="#0f0b09" stroke-width="2" />`);

    if (center.wall) {
      frontWall = `
        ${renderTexturedRect(inner.x, inner.y, inner.w, inner.h, "wall-front", wallTone)}
        <rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="none" stroke="${edgeTone}" stroke-width="3" />
      `;
      break;
    }
  }

  const hpColor = state.health > 50 ? "#86efac" : state.health > 20 ? "#fde68a" : "#fca5a5";
  const gunColor = state.ammo > 0 ? "#cbd5e1" : "#7f1d1d";
  const radarBox = {
    x: 544,
    y: 22,
    w: 144,
    h: 118
  };
  const radarMap = {
    x: 554,
    y: 42,
    cell: 10
  };
  const radarEnemies = state.enemies
    .filter((enemy) => enemy.hp > 0)
    .map((enemy) => {
      const x = radarMap.x + (enemy.x * radarMap.cell) + 2;
      const y = radarMap.y + (enemy.y * radarMap.cell) + 2;
      return `<rect x="${x}" y="${y}" width="6" height="6" fill="#ef4444" />`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420" role="img" aria-label="Doom-style game viewport">
  <rect width="720" height="420" fill="#090607" />
  <g shape-rendering="crispEdges">
    <rect x="10" y="10" width="700" height="400" fill="#160b09" stroke="#4a2317" stroke-width="8" />
    <rect x="24" y="24" width="672" height="312" fill="#120909" stroke="#2c1511" stroke-width="4" />
    ${corridorLayers.join("\n")}
    ${frontWall}
    ${enemyDepth ? renderEnemySprite(enemyDepth) : ""}
    <rect x="357" y="180" width="6" height="42" fill="#f8fafc" opacity="0.9" />
    <rect x="339" y="198" width="42" height="6" fill="#f8fafc" opacity="0.9" />
    <g>
      <polygon points="304,392 316,338 336,338 332,392" fill="#7b5a45" />
      <polygon points="416,392 404,338 384,338 388,392" fill="#7b5a45" />
      <rect x="322" y="338" width="76" height="24" fill="#2f3640" />
      <rect x="330" y="300" width="60" height="48" fill="${gunColor}" />
      <rect x="338" y="278" width="44" height="30" fill="#8a97a8" />
      <rect x="346" y="242" width="28" height="62" fill="#566273" />
      <rect x="352" y="216" width="16" height="32" fill="#cfd8e3" />
      <rect x="344" y="290" width="32" height="10" fill="#1f2937" />
      <rect x="336" y="350" width="48" height="18" fill="#111827" />
      <rect x="318" y="360" width="14" height="18" fill="#4b5563" />
      <rect x="388" y="360" width="14" height="18" fill="#4b5563" />
    </g>
    <rect x="24" y="336" width="672" height="60" fill="#120906" stroke="#472116" stroke-width="4" />
    <text x="44" y="360" fill="#fca5a5" font-size="18" font-family="'Courier New', monospace">DOOM-PAD 94</text>
    <text x="44" y="384" fill="${hpColor}" font-size="16" font-family="'Courier New', monospace">HP ${escapeXml(String(state.health))}</text>
    <text x="154" y="384" fill="#bfdbfe" font-size="16" font-family="'Courier New', monospace">AMMO ${escapeXml(String(state.ammo))}</text>
    <text x="294" y="384" fill="#fde68a" font-size="16" font-family="'Courier New', monospace">FLOOR ${escapeXml(String(state.floor))}</text>
    <text x="416" y="384" fill="#86efac" font-size="16" font-family="'Courier New', monospace">SCORE ${escapeXml(String(state.score))}</text>
    <text x="44" y="404" fill="#f8e7ce" font-size="13" font-family="'Courier New', monospace">${escapeXml(state.lastLog)}</text>
    <rect x="${radarBox.x}" y="${radarBox.y}" width="${radarBox.w}" height="${radarBox.h}" fill="#120906" stroke="#4a2317" stroke-width="3" />
    <text x="${radarBox.x + Math.floor(radarBox.w / 2)}" y="36" text-anchor="middle" fill="#f8e7ce" font-size="12" font-family="'Courier New', monospace">RADAR</text>
    <rect x="${radarMap.x}" y="${radarMap.y}" width="100" height="90" fill="#0b0908" />
    ${MAP_ROWS.map((row, y) => row.split("").map((tile, x) => `<rect x="${radarMap.x + (x * radarMap.cell)}" y="${radarMap.y + (y * radarMap.cell)}" width="9" height="9" fill="${tile === "#" ? "#4a1d10" : "#16100e"}" />`).join("")).join("")}
    ${radarEnemies}
    <rect x="${radarMap.x + (state.player.x * radarMap.cell) + 2}" y="${radarMap.y + (state.player.y * radarMap.cell) + 2}" width="6" height="6" fill="#fde68a" />
  </g>
</svg>`;
}

function renderDoomHudSvg(state) {
  const enemiesLeft = state.enemies.filter((enemy) => enemy.hp > 0).length;

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
    <text x="462" y="38" fill="#fcd34d" font-size="18">FLOOR</text>
    <text x="462" y="82" fill="#fef3c7" font-size="32">${escapeXml(String(state.floor))}</text>
    <text x="566" y="38" fill="#e5e7eb" font-size="18">ENEMIES</text>
    <text x="566" y="82" fill="#f8fafc" font-size="32">${escapeXml(String(enemiesLeft))}</text>
    <text x="28" y="104" fill="#f8e7ce" font-size="14">${escapeXml(state.lastLog)}</text>
  </g>
</svg>`;
}

function renderDoomMinimapSvg(state) {
  const tileSize = 28;
  const width = MAP_ROWS[0].length * tileSize;
  const height = MAP_ROWS.length * tileSize;
  const left = getLeftDelta(state.player.facing);
  const playerTriangle = [
    `${state.player.x * tileSize + 14 + (getForwardDelta(state.player.facing).x * 8)},${state.player.y * tileSize + 14 + (getForwardDelta(state.player.facing).y * 8)}`,
    `${state.player.x * tileSize + 14 + (left.x * 7)},${state.player.y * tileSize + 14 + (left.y * 7)}`,
    `${state.player.x * tileSize + 14 - (left.x * 7)},${state.player.y * tileSize + 14 - (left.y * 7)}`
  ].join(" ");

  const tiles = MAP_ROWS.map((row, y) => row.split("").map((tile, x) => {
    const fill = tile === "#" ? "#4a1d10" : "#1a120f";
    return `<rect x="${x * tileSize}" y="${y * tileSize}" width="${tileSize - 1}" height="${tileSize - 1}" fill="${fill}" />`;
  }).join("")).join("");

  const enemies = state.enemies
    .filter((enemy) => enemy.hp > 0)
    .map((enemy) => `<rect x="${enemy.x * tileSize + 6}" y="${enemy.y * tileSize + 6}" width="${tileSize - 12}" height="${tileSize - 12}" fill="#ef4444" />`)
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

function renderDoomButtonSvg({ label, accent, sublabel = "" }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="150" height="58" viewBox="0 0 150 58" role="img" aria-label="${escapeXml(label)} button">
  <rect width="150" height="58" fill="#180b07" />
  <rect x="4" y="4" width="142" height="50" fill="#2d160f" stroke="${accent}" stroke-width="4" />
  <text x="75" y="28" text-anchor="middle" fill="#f8e7ce" font-size="16" font-family="'Courier New', monospace">${escapeXml(label)}</text>
  <text x="75" y="45" text-anchor="middle" fill="${accent}" font-size="10" font-family="'Courier New', monospace">${escapeXml(sublabel)}</text>
</svg>`;
}

function renderDoomImage(route, state) {
  if (route === "doomViewImage") {
    return renderDoomViewSvg(state);
  }

  if (route === "doomHudImage") {
    return renderDoomHudSvg(state);
  }

  if (route === "doomMinimapImage") {
    return renderDoomMinimapSvg(state);
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

  return renderDoomButtonSvg(buttonMap[route] || { label: "ACTION", accent: "#f8e7ce" });
}

function doomRouteNeedsState(route) {
  return !route.startsWith("doomButton");
}

module.exports = {
  DOOM_ROUTE_MAP,
  applyDoomAction,
  createFreshDoomState,
  doomRouteNeedsState,
  normalizeDoomState,
  renderDoomHome,
  renderDoomImage
};
