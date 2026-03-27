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

const DEFAULT_THEME_NAME = "rust";
const THEME_NAMES = ["rust", "tech", "crypt"];
const VIEW_EVENT_TYPES = new Set(["none", "shoot", "enemy-death", "player-death"]);
const OVERLAY_EVENT_TYPES = new Set(["none", "player-hurt"]);

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clampNumber(value, fallback, minimum = Number.NEGATIVE_INFINITY, maximum = Number.POSITIVE_INFINITY) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.floor(numeric)));
}

function pointKey(x, y) {
  return `${x},${y}`;
}

function hashString(input) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mixSeed(...parts) {
  return hashString(parts.map((part) => String(part)).join("|")) || 1;
}

function createSeededRng(seed) {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }

  return function nextRandom() {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function shuffleInPlace(items, rng) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}

function createRandomSeed() {
  return mixSeed(Date.now(), Math.random(), process.pid || 0);
}

function normalizeThemeName(candidate) {
  return THEME_NAMES.includes(candidate) ? candidate : DEFAULT_THEME_NAME;
}

function createViewEvent(type = "none", values = {}) {
  return {
    type: VIEW_EVENT_TYPES.has(type) ? type : "none",
    depth: clampNumber(values.depth, 0, 0, 5),
    x: clampNumber(values.x, -1, -1, 999),
    y: clampNumber(values.y, -1, -1, 999),
    damage: clampNumber(values.damage, 0, 0, 999)
  };
}

function normalizeViewEvent(source) {
  if (!source || typeof source !== "object") {
    return createViewEvent();
  }

  return createViewEvent(source.type, source);
}

function createOverlayEvent(type = "none", values = {}) {
  return {
    type: OVERLAY_EVENT_TYPES.has(type) ? type : "none",
    damage: clampNumber(values.damage, 0, 0, 999)
  };
}

function normalizeOverlayEvent(source) {
  if (!source || typeof source !== "object") {
    return createOverlayEvent();
  }

  return createOverlayEvent(source.type, source);
}

function normalizePendingFloor(source, currentFloor, currentSeed) {
  if (!source || typeof source !== "object") {
    return null;
  }

  return {
    floor: clampNumber(source.floor, currentFloor + 1, currentFloor + 1, 100),
    mapSeed: clampNumber(source.mapSeed, mixSeed("pending-floor", currentSeed, currentFloor), 1, 2147483646)
  };
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

function buildLobbyPath(gameSlug, lobbySlug, suffix = "") {
  return `/${gameSlug}/${lobbySlug}${suffix}`;
}

function getFloorDimensions(floor) {
  const growth = floor <= 3
    ? 0
    : Math.min(5, Math.floor((floor - 4) / 4) + 1);
  return {
    width: 11 + (growth * 2),
    height: 9 + (growth * 2)
  };
}

function createWallGrid(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => "#"));
}

function pickRandomMazeStart(grid, rng) {
  const width = grid[0].length;
  const height = grid.length;
  const x = 1 + (Math.floor(rng() * Math.max(1, Math.floor((width - 2) / 2))) * 2);
  const y = 1 + (Math.floor(rng() * Math.max(1, Math.floor((height - 2) / 2))) * 2);
  return { x, y };
}

function getOpenNeighborCount(grid, x, y) {
  let count = 0;
  for (const delta of Object.values(DIRECTION_DELTAS)) {
    const nx = x + delta.x;
    const ny = y + delta.y;
    if (ny < 0 || ny >= grid.length || nx < 0 || nx >= grid[0].length) {
      continue;
    }
    if (grid[ny][nx] === ".") {
      count += 1;
    }
  }
  return count;
}

function pickSafeSpawn(grid, rng, fallback) {
  const candidates = [];

  for (let y = 1; y < grid.length - 1; y += 1) {
    for (let x = 1; x < grid[0].length - 1; x += 1) {
      if (grid[y][x] !== ".") {
        continue;
      }
      if (getOpenNeighborCount(grid, x, y) < 2) {
        continue;
      }
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    return fallback;
  }

  return candidates[Math.floor(rng() * candidates.length)];
}

function carveMaze(grid, x, y, rng) {
  grid[y][x] = ".";
  const directions = shuffleInPlace([
    { x: 0, y: -2 },
    { x: 2, y: 0 },
    { x: 0, y: 2 },
    { x: -2, y: 0 }
  ], rng);

  for (const direction of directions) {
    const targetX = x + direction.x;
    const targetY = y + direction.y;

    if (
      targetY <= 0 ||
      targetY >= grid.length - 1 ||
      targetX <= 0 ||
      targetX >= grid[0].length - 1 ||
      grid[targetY][targetX] !== "#"
    ) {
      continue;
    }

    grid[y + Math.floor(direction.y / 2)][x + Math.floor(direction.x / 2)] = ".";
    carveMaze(grid, targetX, targetY, rng);
  }
}

function addLoops(grid, rng, count) {
  const candidates = [];

  for (let y = 1; y < grid.length - 1; y += 1) {
    for (let x = 1; x < grid[0].length - 1; x += 1) {
      if (grid[y][x] !== "#") {
        continue;
      }

      const openHorizontal = grid[y][x - 1] === "." && grid[y][x + 1] === ".";
      const openVertical = grid[y - 1][x] === "." && grid[y + 1][x] === ".";

      if (openHorizontal || openVertical) {
        candidates.push({ x, y });
      }
    }
  }

  shuffleInPlace(candidates, rng);

  for (const candidate of candidates.slice(0, count)) {
    grid[candidate.y][candidate.x] = ".";
  }
}

function carveLine(grid, startX, startY, endX, endY) {
  let x = startX;
  let y = startY;

  grid[y][x] = ".";

  while (x !== endX || y !== endY) {
    if (x < endX) {
      x += 1;
    } else if (x > endX) {
      x -= 1;
    } else if (y < endY) {
      y += 1;
    } else if (y > endY) {
      y -= 1;
    }

    grid[y][x] = ".";
  }
}

function addMainRoutes(grid, playerStart) {
  const midX = Math.floor(grid[0].length / 2);
  const midY = Math.floor(grid.length / 2);

  carveLine(grid, playerStart.x, playerStart.y, midX, playerStart.y);
  carveLine(grid, midX, playerStart.y, midX, midY);
  if (midX > 1) {
    grid[midY][midX - 1] = ".";
  }
  if (midX < grid[0].length - 2) {
    grid[midY][midX + 1] = ".";
  }
}

function addOpenPockets(grid, rng, roomCount) {
  const openAnchors = [];
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];

  for (let y = 2; y < grid.length - 2; y += 1) {
    for (let x = 2; x < grid[0].length - 2; x += 1) {
      if (grid[y][x] === ".") {
        openAnchors.push({ x, y });
      }
    }
  }

  shuffleInPlace(openAnchors, rng);

  for (const anchor of openAnchors.slice(0, roomCount)) {
    const direction = directions[Math.floor(rng() * directions.length)];
    const length = rng() < 0.2 ? 2 : 1;

    for (let step = 1; step <= length; step += 1) {
      const x = anchor.x + (direction.x * step);
      const y = anchor.y + (direction.y * step);
      if (x <= 0 || x >= grid[0].length - 1 || y <= 0 || y >= grid.length - 1) {
        break;
      }

      grid[y][x] = ".";
    }

    if (rng() < 0.18) {
      const sideDirection = directions[Math.floor(rng() * directions.length)];
      const branchX = anchor.x + direction.x + sideDirection.x;
      const branchY = anchor.y + direction.y + sideDirection.y;
      if (branchX > 0 && branchX < grid[0].length - 1 && branchY > 0 && branchY < grid.length - 1) {
        grid[branchY][branchX] = ".";
      }
    }
  }
}

function mapRowsFromGrid(grid) {
  return grid.map((row) => row.join(""));
}

function isWallAt(mapRows, x, y) {
  if (y < 0 || y >= mapRows.length) {
    return true;
  }

  const row = mapRows[y];
  return x < 0 || x >= row.length || row[x] === "#";
}

function isOpenAt(mapRows, x, y) {
  return !isWallAt(mapRows, x, y);
}

function createDistanceMap(mapRows, start) {
  const queue = [{ x: start.x, y: start.y }];
  const distances = new Map([[pointKey(start.x, start.y), 0]]);

  while (queue.length > 0) {
    const current = queue.shift();
    const baseDistance = distances.get(pointKey(current.x, current.y)) || 0;

    for (const delta of Object.values(DIRECTION_DELTAS)) {
      const nextX = current.x + delta.x;
      const nextY = current.y + delta.y;
      const key = pointKey(nextX, nextY);

      if (isWallAt(mapRows, nextX, nextY) || distances.has(key)) {
        continue;
      }

      distances.set(key, baseDistance + 1);
      queue.push({ x: nextX, y: nextY });
    }
  }

  return distances;
}

function createEnemy({ id, x, y, hp = 1 }) {
  return {
    id,
    type: "enemy",
    x,
    y,
    hp
  };
}

function pickTextureTheme(mapSeed, floor) {
  return THEME_NAMES[mixSeed("theme", mapSeed, floor) % THEME_NAMES.length] || DEFAULT_THEME_NAME;
}

function createEnemiesForFloor(mapRows, start, floor, mapSeed) {
  const rng = createSeededRng(mixSeed("enemies", mapSeed, floor));
  const distanceMap = createDistanceMap(mapRows, start);
  const minimumDistance = Math.max(3, Math.floor((mapRows.length + mapRows[0].length) / 6));
  const maximumDistance = minimumDistance + Math.max(5, Math.floor((floor + mapRows.length) / 3));
  const allCandidateCells = Array.from(distanceMap.entries())
    .map(([key, distance]) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y, distance };
    });
  const candidateCells = allCandidateCells.filter(
    (cell) => cell.distance >= minimumDistance && cell.distance <= maximumDistance
  );
  const fallbackCells = candidateCells.length > 0
    ? candidateCells
    : allCandidateCells.filter((cell) => cell.distance >= minimumDistance);

  shuffleInPlace(fallbackCells, rng);

  const enemies = [];
  const count = Math.min(12, 2 + Math.floor(floor * 0.9));
  const hp = floor >= 7 ? 3 : floor >= 4 ? 2 : 1;

  for (const cell of fallbackCells) {
    const tooClose = enemies.some((enemy) => Math.abs(enemy.x - cell.x) + Math.abs(enemy.y - cell.y) < 2);
    if (tooClose) {
      continue;
    }

    enemies.push(createEnemy({
      id: `enemy-${floor}-${enemies.length + 1}`,
      x: cell.x,
      y: cell.y,
      hp
    }));

    if (enemies.length >= count) {
      break;
    }
  }

  return enemies;
}

function getEnemyHpTotal(enemies) {
  return enemies.reduce((sum, enemy) => sum + Math.max(0, enemy.hp || 0), 0);
}

function generateFloorLayout(floor, mapSeed) {
  const dimensions = getFloorDimensions(floor);
  const rng = createSeededRng(mixSeed("layout", floor, mapSeed, dimensions.width, dimensions.height));
  const grid = createWallGrid(dimensions.width, dimensions.height);
  const carveStart = pickRandomMazeStart(grid, rng);

  carveMaze(grid, carveStart.x, carveStart.y, rng);
  grid[carveStart.y][carveStart.x] = ".";
  grid[Math.max(1, carveStart.y - 1)][carveStart.x] = ".";
  grid[carveStart.y][Math.min(dimensions.width - 2, carveStart.x + 1)] = ".";
  addOpenPockets(grid, rng, Math.min(3, 1 + Math.floor(floor / 6)));
  addLoops(grid, rng, Math.min(6, 2 + Math.floor(floor / 3)));

  const safeSpawn = pickSafeSpawn(grid, rng, carveStart);
  const playerStart = {
    x: safeSpawn.x,
    y: safeSpawn.y,
    facing: DIRECTION_ORDER[Math.floor(rng() * DIRECTION_ORDER.length)]
  };
  addMainRoutes(grid, playerStart);

  const mapRows = mapRowsFromGrid(grid);

  return {
    mapRows,
    playerStart,
    enemies: createEnemiesForFloor(mapRows, playerStart, floor, mapSeed),
    textureTheme: pickTextureTheme(mapSeed, floor)
  };
}

function parseMapRows(source, fallbackRows) {
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

  if (!Array.isArray(raw) || raw.length < 5) {
    return fallbackRows;
  }

  const rows = raw.map((row) => String(row));
  const width = rows[0] ? rows[0].length : 0;

  if (width < 5 || rows.some((row) => row.length !== width || /[^#.]/.test(row))) {
    return fallbackRows;
  }

  if (
    rows[0].includes(".") ||
    rows[rows.length - 1].includes(".") ||
    rows.some((row) => row[0] !== "#" || row[row.length - 1] !== "#")
  ) {
    return fallbackRows;
  }

  return rows;
}

function parseEnemies(source, mapRows, floor, fallbackEnemies) {
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
      id: typeof enemy.id === "string" && enemy.id.trim() ? enemy.id.trim() : `enemy-${floor}-${index + 1}`,
      type: "enemy",
      x: clampNumber(enemy.x, 1, 1, mapRows[0].length - 2),
      y: clampNumber(enemy.y, 1, 1, mapRows.length - 2),
      hp: clampNumber(enemy.hp, 1, 1, 9)
    }))
    .filter((enemy) => !isWallAt(mapRows, enemy.x, enemy.y));

  return enemies.length > 0 ? enemies : fallbackEnemies;
}

function createDoomFloorState({
  floor = 1,
  score = 0,
  health = 100,
  ammo = 6,
  keys = 0,
  turn = 0,
  mapSeed = createRandomSeed(),
  lastLog = ""
} = {}) {
  const layout = generateFloorLayout(floor, mapSeed);
  const minimumAmmo = getEnemyHpTotal(layout.enemies);
  const startingAmmo = Math.max(ammo, minimumAmmo);

  return {
    floor,
    score,
    health,
    ammo: startingAmmo,
    keys,
    turn,
    status: "playing",
    mapSeed,
    textureTheme: layout.textureTheme,
    mapRows: layout.mapRows,
    player: {
      x: layout.playerStart.x,
      y: layout.playerStart.y,
      facing: layout.playerStart.facing
    },
    lastPlayer: null,
    lastEnemies: null,
    lastAction: null,
    enemies: layout.enemies,
    pendingFloor: null,
    viewEvent: createViewEvent(),
    overlayEvent: createOverlayEvent(),
    lastLog: lastLog || `Entered floor ${floor}.`,
    updatedAt: new Date().toISOString()
  };
}

function createFreshDoomState(overrides = {}) {
  return createDoomFloorState({
    floor: 1,
    score: 0,
    health: 100,
    ammo: 6,
    keys: 0,
    turn: 0,
    mapSeed: createRandomSeed(),
    lastLog: "A silent hallway waits.",
    ...overrides
  });
}

function normalizeDoomState(state) {
  const source = state || {};
  const floor = clampNumber(source.floor, 1, 1, 99);
  const fallbackSeed = clampNumber(source.mapSeed, mixSeed("legacy", floor, source.score || 0, source.turn || 0), 1, 2147483646);
  const generated = generateFloorLayout(floor, fallbackSeed);
  const mapRows = parseMapRows(source.mapRows, generated.mapRows);
  const fallbackPlayer = generated.playerStart;
  const player = source.player && typeof source.player === "object" ? source.player : {};
  const normalizedPlayerX = clampNumber(player.x, fallbackPlayer.x, 1, mapRows[0].length - 2);
  const normalizedPlayerY = clampNumber(player.y, fallbackPlayer.y, 1, mapRows.length - 2);
  const enemies = parseEnemies(source.enemies, mapRows, floor, generated.enemies)
    .filter((enemy) => enemy.hp > 0)
    .filter((enemy) => enemy.x !== normalizedPlayerX || enemy.y !== normalizedPlayerY);
  const status = source.status === "dead"
    ? "dead"
    : source.status === "floor-clear"
      ? "floor-clear"
      : "playing";
  const lastEnemies = Array.isArray(source.lastEnemies)
    ? parseEnemies(source.lastEnemies, mapRows, floor, [])
    : null;

  return {
    floor,
    score: clampNumber(source.score, 0, 0, 999999),
    health: clampNumber(source.health, 100, 0, 100),
    ammo: clampNumber(source.ammo, 6, 0, 99),
    keys: clampNumber(source.keys, 0, 0, 9),
    turn: clampNumber(source.turn, 0, 0, 999999),
    status,
    mapSeed: fallbackSeed,
    textureTheme: normalizeThemeName(source.textureTheme || generated.textureTheme),
    mapRows,
    player: {
      x: isOpenAt(mapRows, normalizedPlayerX, normalizedPlayerY) ? normalizedPlayerX : fallbackPlayer.x,
      y: isOpenAt(mapRows, normalizedPlayerX, normalizedPlayerY) ? normalizedPlayerY : fallbackPlayer.y,
      facing: isFacing(player.facing) ? player.facing : fallbackPlayer.facing
    },
    lastPlayer: source.lastPlayer && typeof source.lastPlayer === "object"
      ? {
        x: clampNumber(source.lastPlayer.x, normalizedPlayerX, 1, mapRows[0].length - 2),
        y: clampNumber(source.lastPlayer.y, normalizedPlayerY, 1, mapRows.length - 2),
        facing: isFacing(source.lastPlayer.facing) ? source.lastPlayer.facing : (isFacing(player.facing) ? player.facing : fallbackPlayer.facing)
      }
      : null,
    lastEnemies: lastEnemies && lastEnemies.length > 0 ? lastEnemies : null,
    lastAction: typeof source.lastAction === "string" ? source.lastAction : null,
    enemies,
    pendingFloor: status === "floor-clear"
      ? normalizePendingFloor(source.pendingFloor, floor, fallbackSeed)
      : null,
    viewEvent: normalizeViewEvent(source.viewEvent),
    overlayEvent: normalizeOverlayEvent(source.overlayEvent),
    lastLog: typeof source.lastLog === "string" && source.lastLog.trim()
      ? source.lastLog.trim()
      : "A silent hallway waits.",
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt.trim()
      ? source.updatedAt.trim()
      : new Date().toISOString()
  };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function getEnemyAt(state, x, y) {
  return state.enemies.find((enemy) => enemy.hp > 0 && enemy.x === x && enemy.y === y) || null;
}

function canPlayerMoveTo(state, x, y) {
  return isOpenAt(state.mapRows, x, y) && !getEnemyAt(state, x, y);
}

function movePlayer(state, delta, fallbackLog) {
  const targetX = state.player.x + delta.x;
  const targetY = state.player.y + delta.y;

  if (!canPlayerMoveTo(state, targetX, targetY)) {
    state.lastLog = `${fallbackLog} A wall or enemy blocks the way.`;
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
  let depth = 1;

  while (!isWallAt(state.mapRows, x, y)) {
    const enemy = getEnemyAt(state, x, y);
    if (enemy) {
      return {
        enemy,
        depth
      };
    }

    x += delta.x;
    y += delta.y;
    depth += 1;
  }

  return null;
}

function canPlayerSeeEnemy(state, enemy, maxDepth = 5) {
  if (!enemy) {
    return false;
  }

  const delta = getForwardDelta(state.player.facing);
  let x = state.player.x + delta.x;
  let y = state.player.y + delta.y;

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    if (isWallAt(state.mapRows, x, y)) {
      return false;
    }
    if (x === enemy.x && y === enemy.y) {
      return true;
    }
    x += delta.x;
    y += delta.y;
  }

  return false;
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

    if (isWallAt(state.mapRows, targetX, targetY) || occupied.has(targetKey)) {
      continue;
    }

    if (targetX === state.player.x && targetY === state.player.y) {
      continue;
    }

    return { x: targetX, y: targetY };
  }

  return null;
}

function chooseEnemyWanderMove(enemy, state, occupied, rng) {
  const deltas = shuffleInPlace([
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ], rng);

  for (let attempt = 0; attempt < deltas.length; attempt += 1) {
    const delta = deltas[attempt];
    const targetX = enemy.x + delta.x;
    const targetY = enemy.y + delta.y;
    const targetKey = pointKey(targetX, targetY);

    if (isWallAt(state.mapRows, targetX, targetY) || occupied.has(targetKey)) {
      continue;
    }
    if (targetX === state.player.x && targetY === state.player.y) {
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
      damage += 7 + (enemy.hp * 2);
      continue;
    }

    occupied.delete(pointKey(enemy.x, enemy.y));
    const rng = createSeededRng(mixSeed("enemy-wander", state.mapSeed, state.turn, enemy.id));
    const canSee = canPlayerSeeEnemy(state, enemy);
    const shouldWander = !canSee && rng() < 0.75;

    if (canSee) {
      const nextPosition = chooseEnemyMove(enemy, state, occupied);
      if (nextPosition) {
        enemy.x = nextPosition.x;
        enemy.y = nextPosition.y;
        movers += 1;
      }
    } else if (shouldWander) {
      const wanderSteps = 1 + Math.floor(rng() * 2);
      for (let step = 0; step < wanderSteps; step += 1) {
        const nextPosition = chooseEnemyWanderMove(enemy, state, occupied, rng);
        if (!nextPosition) {
          break;
        }
        enemy.x = nextPosition.x;
        enemy.y = nextPosition.y;
        movers += 1;
      }
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
  const nextFloor = clampNumber(state.pendingFloor && state.pendingFloor.floor, state.floor + 1, state.floor + 1, 100);
  const nextSeed = clampNumber(
    state.pendingFloor && state.pendingFloor.mapSeed,
    mixSeed(state.mapSeed, nextFloor, state.turn, state.score, state.health, state.ammo),
    1,
    2147483646
  );

  return createDoomFloorState({
    floor: nextFloor,
    score: state.score + 250,
    health: Math.min(100, state.health + 12),
    ammo: Math.min(99, state.ammo + 6),
    keys: state.keys,
    turn: state.turn,
    mapSeed: nextSeed,
    lastLog: `Floor clear. Descending to floor ${nextFloor}.`
  });
}

function queueFloorClear(state) {
  const nextFloor = state.floor + 1;
  const nextSeed = mixSeed(state.mapSeed, nextFloor, state.turn, state.score, state.health, state.ammo);

  state.status = "floor-clear";
  state.pendingFloor = {
    floor: nextFloor,
    mapSeed: nextSeed
  };
  state.viewEvent = createViewEvent();
  state.overlayEvent = createOverlayEvent();
  state.lastLog = `Floor ${state.floor} cleared. Press any button to descend to floor ${nextFloor}.`;
  return state;
}

function applyDoomAction(currentState, route) {
  const state = normalizeDoomState(cloneState(currentState));

  if (state.status === "floor-clear" && state.pendingFloor) {
    return advanceFloor(state);
  }

  if (state.status === "dead" || state.health <= 0) {
    return createFreshDoomState({
      lastLog: "Marine redeployed."
    });
  }

  state.pendingFloor = null;
  state.viewEvent = createViewEvent();
  state.overlayEvent = createOverlayEvent();
  state.lastPlayer = { ...state.player };
  state.lastEnemies = state.enemies.map((enemy) => ({ ...enemy }));
  state.lastAction = typeof route === "string" ? route : null;

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
      const shot = traceShot(state);
      if (shot && shot.enemy) {
        shot.enemy.hp = Math.max(0, shot.enemy.hp - 1);
        if (shot.enemy.hp <= 0) {
          state.score += 100;
          state.viewEvent = createViewEvent("enemy-death", {
            depth: shot.depth,
            x: shot.enemy.x,
            y: shot.enemy.y
          });
          state.lastLog = "You blast an enemy.";
        } else {
          state.score += 35;
          state.viewEvent = createViewEvent("shoot", {
            depth: shot.depth,
            x: shot.enemy.x,
            y: shot.enemy.y
          });
          state.lastLog = "The enemy staggers.";
        }
      } else {
        state.viewEvent = createViewEvent("shoot");
        state.lastLog = "Shot echoes into the dark.";
      }
    }
  } else {
    state.lastLog = ACTION_LOGS[route] || "You hold position.";
  }

  state.turn += 1;
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  if (state.enemies.length === 0) {
    return queueFloorClear(state);
  }

  const enemyTurn = advanceEnemies(state);
  if (state.health <= 0) {
    state.status = "dead";
    state.viewEvent = createViewEvent("player-death", {
      damage: enemyTurn.damage
    });
    state.lastLog = enemyTurn.damage > 0
      ? `Enemies tear you apart for ${enemyTurn.damage}. Press any button to restart.`
      : "You collapse in the dark. Press any button to restart.";
    return state;
  }

  if (state.enemies.length === 0) {
    return queueFloorClear(state);
  }

  if (enemyTurn.damage > 0) {
    state.overlayEvent = createOverlayEvent("player-hurt", {
      damage: enemyTurn.damage
    });
    state.lastLog = `${state.lastLog} Enemies hit for ${enemyTurn.damage}.`;
  } else if (enemyTurn.movers > 0) {
    state.lastLog = `${state.lastLog} Shapes rush through the maze.`;
  }

  return state;
}

function getTileInDirection(state, depth, offset = 0) {
  const forward = getForwardDelta(state.player.facing);
  const right = getRightDelta(state.player.facing);
  const x = state.player.x + (forward.x * depth) + (right.x * offset);
  const y = state.player.y + (forward.y * depth) + (right.y * offset);

  return {
    x,
    y,
    wall: isWallAt(state.mapRows, x, y),
    enemy: getEnemyAt(state, x, y)
  };
}

module.exports = {
  ACTION_LOGS,
  DEFAULT_THEME_NAME,
  DIRECTION_ORDER,
  buildLobbyPath,
  clampNumber,
  createFreshDoomState,
  escapeXml,
  getEnemyAt,
  getFloorDimensions,
  getForwardDelta,
  getLeftDelta,
  getRightDelta,
  getTileInDirection,
  hashString,
  isFacing,
  isWallAt,
  mixSeed,
  normalizeDoomState,
  normalizeThemeName,
  pointKey,
  applyDoomAction
};
