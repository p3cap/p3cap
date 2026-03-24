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

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
  const frames = {
    1: { x: 155, y: 90, w: 410, h: 230 },
    2: { x: 220, y: 128, w: 280, h: 154 },
    3: { x: 270, y: 158, w: 180, h: 94 },
    4: { x: 305, y: 178, w: 110, h: 54 }
  };
  const maxDepth = 4;
  const wallShapes = [];
  let enemyDepth = 0;
  let frontWallDepth = 0;

  for (let depth = maxDepth; depth >= 1; depth -= 1) {
    const frame = frames[depth];
    const nextFrame = frames[Math.min(maxDepth, depth + 1)] || { x: 344, y: 199, w: 32, h: 16 };
    const center = getTileInDirection(state, depth, 0);
    const left = getTileInDirection(state, depth, -1);
    const right = getTileInDirection(state, depth, 1);

    if (!enemyDepth && center.enemy && !center.wall) {
      enemyDepth = depth;
    }

    if (!center.wall) {
      if (left.wall) {
        wallShapes.push(`<polygon points="0,0 0,420 ${frame.x},${frame.y + frame.h} ${frame.x},${frame.y}" fill="${depth % 2 === 0 ? "#5f3b1f" : "#71421d"}" />`);
      }
      if (right.wall) {
        wallShapes.push(`<polygon points="720,0 720,420 ${frame.x + frame.w},${frame.y + frame.h} ${frame.x + frame.w},${frame.y}" fill="${depth % 2 === 0 ? "#5f3b1f" : "#71421d"}" />`);
      }
      continue;
    }

    frontWallDepth = depth;
    wallShapes.push(`
      <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="${depth % 2 === 0 ? "#7c3f1a" : "#944c1f"}" />
      <rect x="${frame.x + Math.floor(frame.w * 0.14)}" y="${frame.y + Math.floor(frame.h * 0.16)}" width="${Math.floor(frame.w * 0.24)}" height="${Math.floor(frame.h * 0.22)}" fill="#4a1d10" />
      <rect x="${frame.x + Math.floor(frame.w * 0.6)}" y="${frame.y + Math.floor(frame.h * 0.28)}" width="${Math.floor(frame.w * 0.18)}" height="${Math.floor(frame.h * 0.14)}" fill="#603119" />
      <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${Math.max(4, Math.floor(frame.h * 0.08))}" fill="#b8682a" opacity="0.25" />
    `);
    break;
  }

  if (!frontWallDepth) {
    const far = frames[4];
    wallShapes.push(`<rect x="${far.x}" y="${far.y}" width="${far.w}" height="${far.h}" fill="#130b08" />`);
  }

  const statusText = state.status === "dead" ? "YOU DIED" : `F${state.floor} T${state.turn}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420" role="img" aria-label="Doom-style game viewport">
  <rect width="720" height="210" fill="#2f1812" />
  <rect y="210" width="720" height="210" fill="#1f120d" />
  <g shape-rendering="crispEdges">
    <rect x="0" y="0" width="720" height="420" fill="none" stroke="#2b140f" stroke-width="14" />
    ${wallShapes.join("\n")}
    ${enemyDepth ? renderEnemySprite(enemyDepth) : ""}
    <rect x="352" y="192" width="16" height="36" fill="#d1d5db" opacity="0.55" />
    <rect x="330" y="392" width="60" height="18" fill="#111827" />
    <rect x="18" y="18" width="112" height="28" fill="#111827" />
    <text x="74" y="37" text-anchor="middle" fill="#fca5a5" font-size="18" font-family="'Courier New', monospace">${escapeXml(statusText)}</text>
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
