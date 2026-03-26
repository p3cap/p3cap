const fs = require("fs");
const path = require("path");
const { createFileJsonStateStore, createRedisJsonStateStore } = require("./json-state-store");

const slug = "flappy";
const CYCLE_MS = 2600;
const PERFECT_WINDOW_MS = 320;
const GOOD_WINDOW_MS = 620;
const MAX_WINDOW_MS = 940;
const LANE_Y = [32, 58, 84, 110, 136];
const BIRD_X = 150;
const BIRD_HEIGHT = 38;
const SKY_HEIGHT = 188;
const GROUND_Y = SKY_HEIGHT - BIRD_HEIGHT;
const FALL_DISTANCE = 28;
const JUMP_HEIGHT = 54;
const GAP_HEIGHT = 64;
const PIPE_WIDTH = 74;
const PIPE_HEAD_WIDTH = 90;
const PIPE_START_X = 520;
const PIPE_EXIT_X = -94;
const PIPE_SPACING_X = 240;
const BIRD_TEXTURE_DIR = path.join(__dirname, "assets", "flappy");
const birdTextureCache = new Map();

const routeMap = new Map([
  ["api/state", "state"],
  ["images/view.svg", "flappyViewImage"],
  ["images/button-flap.svg", "flappyButtonImage"],
  ["tap", "flappyTap"]
]);

const actionRoutes = new Set(["flappyTap"]);

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

function createRandomSeed() {
  return mixSeed(Date.now(), Math.random(), process.pid || 0);
}

function buildLobbyPath(gameSlug, lobbySlug, suffix = "") {
  return `/${gameSlug}/${lobbySlug}${suffix}`;
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

function getBirdTextureUri() {
  if (birdTextureCache.has("bird")) {
    return birdTextureCache.get("bird");
  }

  let textureUri = "";

  try {
    if (fs.existsSync(BIRD_TEXTURE_DIR)) {
      const candidates = fs.readdirSync(BIRD_TEXTURE_DIR)
        .filter((fileName) => /^bird(?:-[a-z0-9_-]+)?\.(png|jpg|jpeg|webp|gif|svg)$/i.test(fileName))
        .sort();

      for (const candidate of candidates) {
        const mimeType = getMimeTypeForTexture(candidate);
        if (!mimeType) {
          continue;
        }

        const filePath = path.join(BIRD_TEXTURE_DIR, candidate);
        textureUri = `data:${mimeType};base64,${fs.readFileSync(filePath).toString("base64")}`;
        break;
      }
    }
  } catch (error) {
    textureUri = "";
  }

  birdTextureCache.set("bird", textureUri);
  return textureUri;
}

function getGapLane(seed, obstacleIndex) {
  return hashString(`${seed}:${obstacleIndex}:lane`) % LANE_Y.length;
}

function getGapTop(seed, obstacleIndex) {
  const lane = getGapLane(seed, obstacleIndex);
  return {
    lane,
    top: clamp(LANE_Y[lane] - 6, 8, GROUND_Y - GAP_HEIGHT)
  };
}

function getIdleLane(birdLane) {
  return Math.min(LANE_Y.length - 1, birdLane + 1);
}

function getPipeAlignMs() {
  const travel = PIPE_EXIT_X - PIPE_START_X;
  const progress = (BIRD_X - PIPE_START_X) / travel;
  return Math.max(0, Math.min(CYCLE_MS, Math.round(progress * CYCLE_MS)));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getLaneY(lane) {
  return LANE_Y[clamp(lane, 0, LANE_Y.length - 1)];
}

function getLaneFromY(y) {
  let closest = 0;
  let closestDistance = Infinity;
  for (let index = 0; index < LANE_Y.length; index += 1) {
    const distance = Math.abs(LANE_Y[index] - y);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = index;
    }
  }
  return closest;
}

function getFallSpeed() {
  return FALL_DISTANCE / CYCLE_MS;
}

function getBirdYAtMs(startY, elapsedMs) {
  return clamp(startY + (getFallSpeed() * elapsedMs), 8, GROUND_Y);
}

function describePrediction(state) {
  const firstGap = getGapTop(state.seed, state.obstacleIndex);
  const startY = getLaneY(state.birdLane);
  const pipeAtMs = getPipeAlignMs();
  const idleYAtPipe = getBirdYAtMs(startY, pipeAtMs);
  const firstSurvives = idleYAtPipe >= firstGap.top && (idleYAtPipe + BIRD_HEIGHT) <= (firstGap.top + GAP_HEIGHT);
  const firstIdleLane = getLaneFromY(getBirdYAtMs(startY, CYCLE_MS));

  if (!firstSurvives) {
    return {
      firstGap,
      firstIdleLane,
      firstSurvives,
      secondGap: null,
      secondIdleLane: null,
      secondSurvives: false,
      idleYAtPipe,
      pipeAtMs
    };
  }

  const secondGap = getGapTop(state.seed, state.obstacleIndex + 1);
  const secondIdleLane = getIdleLane(firstIdleLane);

  return {
    firstGap,
    firstIdleLane,
    firstSurvives,
    secondGap,
    secondIdleLane,
    secondSurvives: secondIdleLane === secondGap.lane,
    idleYAtPipe,
    pipeAtMs
  };
}

function createFreshState(overrides = {}) {
  return {
    alive: true,
    score: 0,
    bestScore: 0,
    birdLane: 2,
    previousBirdLane: 2,
    obstacleIndex: 0,
    seed: createRandomSeed(),
    cycleStartedAt: new Date().toISOString(),
    animationMode: "idle",
    lastPassedGapLane: -1,
    lastTapErrorMs: 0,
    lastTapOffsetMs: 0,
    lastLog: "Tap as the pipe reaches the marker.",
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function normalizeState(state) {
  const source = state || {};

  return {
    alive: source.alive !== false,
    score: clampNumber(source.score, 0, 0, 999999),
    bestScore: clampNumber(source.bestScore, 0, 0, 999999),
    birdLane: clampNumber(source.birdLane, 2, 0, LANE_Y.length - 1),
    previousBirdLane: clampNumber(source.previousBirdLane, source.birdLane, 0, LANE_Y.length - 1),
    obstacleIndex: clampNumber(source.obstacleIndex, 0, 0, 999999),
    seed: clampNumber(source.seed, mixSeed("flappy", source.score || 0, source.obstacleIndex || 0), 1, 2147483646),
    cycleStartedAt: typeof source.cycleStartedAt === "string" && source.cycleStartedAt.trim()
      ? source.cycleStartedAt.trim()
      : new Date().toISOString(),
    animationMode: source.animationMode === "flap" ? "flap" : "idle",
    lastPassedGapLane: clampNumber(source.lastPassedGapLane, -1, -1, LANE_Y.length - 1),
    lastTapErrorMs: clampNumber(source.lastTapErrorMs, 0, -9999, 9999),
    lastTapOffsetMs: clampNumber(source.lastTapOffsetMs, 0, 0, CYCLE_MS),
    lastLog: typeof source.lastLog === "string" && source.lastLog.trim()
      ? source.lastLog.trim()
      : "Tap as the pipe reaches the marker.",
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt.trim()
      ? source.updatedAt.trim()
      : new Date().toISOString()
  };
}

function routeNeedsState() {
  return true;
}

function getRateLimitAction() {
  return "flappy-tap";
}

function renderHome(rawState, { defaultRedirectUrl = "", gameSlug, lobbySlug, actionCooldownMs = 0 }) {
  const state = normalizeState(rawState);
  const hint = defaultRedirectUrl
    ? `Fallback return URL: <code>${escapeXml(defaultRedirectUrl)}</code>`
    : "Set README_REDIRECT_URL to provide a fallback return URL if history.back() is unavailable.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>README Flappy</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, #67e8f9, #1d4ed8);
        color: #eff6ff;
        font: 16px/1.5 "Trebuchet MS", Arial, sans-serif;
      }
      main {
        width: min(760px, calc(100vw - 32px));
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 24px;
        padding: 28px;
      }
      code {
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>README Flappy</h1>
      <p>Animated-image timing game for <code>${escapeXml(gameSlug)}</code> / <code>${escapeXml(lobbySlug)}</code>.</p>
      <p><strong>Alive:</strong> ${escapeXml(state.alive ? "yes" : "no")} | <strong>Score:</strong> ${escapeXml(String(state.score))} | <strong>Best:</strong> ${escapeXml(String(state.bestScore))}</p>
      <p><strong>Bird lane:</strong> ${escapeXml(String(state.birdLane + 1))} | <strong>Animation:</strong> ${escapeXml(state.animationMode)} | <strong>Last timing noise:</strong> ${escapeXml(`${state.lastTapErrorMs}ms`)}</p>
      <p><strong>Last log:</strong> ${escapeXml(state.lastLog)}</p>
      <p>${hint}</p>
      <p><strong>Anti-spam:</strong> about one action every ${(actionCooldownMs / 1000).toFixed(actionCooldownMs < 1000 ? 1 : 0)}s per IP, per game.</p>
      <p>Core endpoints: <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/tap"))}</code> and <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/images/view.svg"))}</code>.</p>
    </main>
  </body>
</html>`;
}

function resolveTapTiming(nowMs, state) {
  const elapsedMs = Math.max(0, nowMs - Date.parse(state.cycleStartedAt || new Date().toISOString()));
  const noise = (hashString(`${state.seed}:${state.obstacleIndex}:${nowMs}`) % 301) - 150;
  const effectiveMs = elapsedMs + noise;
  const idealMs = getPipeAlignMs();
  const deltaMs = effectiveMs - idealMs;
  const absoluteDelta = Math.abs(deltaMs);

  let quality = "late";
  if (absoluteDelta <= PERFECT_WINDOW_MS) {
    quality = "perfect";
  } else if (absoluteDelta <= GOOD_WINDOW_MS) {
    quality = "good";
  }

  return {
    elapsedMs,
    noise,
    effectiveMs,
    deltaMs,
    absoluteDelta,
    quality,
    missedWindow: absoluteDelta > MAX_WINDOW_MS || elapsedMs > CYCLE_MS + 900
  };
}

function applyTap(rawState) {
  const state = normalizeState(rawState);
  const nowMs = Date.now();

  if (!state.alive) {
    return createFreshState({
      bestScore: Math.max(state.bestScore, state.score),
      lastLog: "New run. Tap on time to flap."
    });
  }

  const timing = resolveTapTiming(nowMs, state);
  const gap = getGapTop(state.seed, state.obstacleIndex);
  const pipeAtMs = getPipeAlignMs();
  const tapMs = clamp(timing.elapsedMs, 0, CYCLE_MS);
  const startY = getLaneY(state.birdLane);
  const idleYAtPipe = getBirdYAtMs(startY, pipeAtMs);

  if (timing.missedWindow) {
    return {
      ...state,
      alive: false,
      birdLane: getLaneFromY(idleYAtPipe),
      previousBirdLane: state.birdLane,
      bestScore: Math.max(state.bestScore, state.score),
      animationMode: "idle",
      lastTapErrorMs: timing.deltaMs,
      lastTapOffsetMs: tapMs,
      lastLog: "Missed the timing window. Tap again to restart."
    };
  }

  const jumpMultiplier = timing.quality === "perfect"
    ? 1.2
    : timing.quality === "good"
      ? 1
      : 0.85;
  const yAtTap = getBirdYAtMs(startY, tapMs);
  const yAfterJump = clamp(yAtTap - (JUMP_HEIGHT * jumpMultiplier), 8, GROUND_Y);
  const remainingMs = Math.max(0, pipeAtMs - tapMs);
  const yAtPipe = getBirdYAtMs(yAfterJump, remainingMs);
  const fitsGap = yAtPipe >= gap.top && (yAtPipe + BIRD_HEIGHT) <= (gap.top + GAP_HEIGHT);

  if (!fitsGap || tapMs > pipeAtMs + MAX_WINDOW_MS || tapMs < pipeAtMs - MAX_WINDOW_MS) {
    return {
      ...state,
      alive: false,
      birdLane: getLaneFromY(yAtPipe),
      previousBirdLane: state.birdLane,
      bestScore: Math.max(state.bestScore, state.score),
      animationMode: "idle",
      lastTapErrorMs: timing.deltaMs,
      lastTapOffsetMs: tapMs,
      lastLog: fitsGap
        ? "Too early/late. Tap again to restart."
        : "Pipe hit. Tap again to restart."
    };
  }

  const nextScore = state.score + 1;
  return {
    ...state,
    alive: true,
    score: nextScore,
    bestScore: Math.max(state.bestScore, nextScore),
    birdLane: getLaneFromY(yAtPipe),
    previousBirdLane: state.birdLane,
    obstacleIndex: state.obstacleIndex + 1,
    cycleStartedAt: new Date(nowMs).toISOString(),
    animationMode: "flap",
    lastPassedGapLane: gap.lane,
    lastTapErrorMs: timing.deltaMs,
    lastTapOffsetMs: tapMs,
    lastLog: timing.quality === "perfect"
      ? "Perfect jump."
      : timing.quality === "good"
        ? "Nice jump. You cleared it."
        : "Late jump, but it worked."
  };
}

function renderBird(state, { startY, peakY, endY, durationMs, peakAtMs = 260 }) {
  const birdTexture = getBirdTextureUri();

  if (!birdTexture) {
    return "";
  }

  const clampedPeak = Number.isFinite(peakY) ? peakY : startY;
  const peakTime = clamp(peakAtMs, 120, Math.max(160, durationMs - 200));
  const usePeak = clampedPeak < startY - 4;
  const keyTimes = usePeak
    ? `0;${(peakTime / durationMs).toFixed(3)};1`
    : "0;1";
  const values = usePeak
    ? `${BIRD_X} ${startY - 14};${BIRD_X} ${clampedPeak - 14};${BIRD_X} ${endY - 14}`
    : `${BIRD_X} ${startY - 14};${BIRD_X} ${endY - 14}`;

  return `
  <g transform="translate(${BIRD_X} ${startY - 14})">
    <animateTransform attributeName="transform" type="translate" values="${values}" keyTimes="${keyTimes}" dur="${durationMs}ms" fill="freeze" />
    <image href="${escapeXml(birdTexture)}" x="0" y="0" width="52" height="38" preserveAspectRatio="none" image-rendering="pixelated" />
  </g>`;
}

function renderPipe(gapTop, fromX, toX, durationMs, begin = "0s") {
  const bottomPipeY = gapTop + GAP_HEIGHT;
  const bottomPipeHeight = 188 - bottomPipeY;

  return `
  <g>
    <rect x="${fromX}" y="0" width="${PIPE_WIDTH}" height="${gapTop}" fill="#22c55e">
      <animate attributeName="x" from="${fromX}" to="${toX}" dur="${durationMs}ms" begin="${begin}" fill="freeze" />
    </rect>
    <rect x="${fromX - 8}" y="${gapTop - 14}" width="${PIPE_HEAD_WIDTH}" height="14" fill="#15803d">
      <animate attributeName="x" from="${fromX - 8}" to="${toX - 8}" dur="${durationMs}ms" begin="${begin}" fill="freeze" />
    </rect>
    <rect x="${fromX}" y="${bottomPipeY}" width="${PIPE_WIDTH}" height="${bottomPipeHeight}" fill="#22c55e">
      <animate attributeName="x" from="${fromX}" to="${toX}" dur="${durationMs}ms" begin="${begin}" fill="freeze" />
    </rect>
    <rect x="${fromX - 8}" y="${bottomPipeY}" width="${PIPE_HEAD_WIDTH}" height="14" fill="#15803d">
      <animate attributeName="x" from="${fromX - 8}" to="${toX - 8}" dur="${durationMs}ms" begin="${begin}" fill="freeze" />
    </rect>
  </g>`;
}

function renderDeathOverlay(showAtMs, reason = "") {
  const detail = reason ? `<text x="310" y="162" text-anchor="middle" fill="#fcd34d" font-size="14" font-family="'Trebuchet MS', Arial, sans-serif">${escapeXml(reason)}</text>` : "";
  return `
  <g visibility="hidden" opacity="0">
    <set attributeName="visibility" to="visible" begin="${showAtMs}ms" fill="freeze" />
    <animate attributeName="opacity" from="0" to="1" begin="${showAtMs}ms" dur="260ms" fill="freeze" />
    <rect x="0" y="0" width="620" height="260" fill="#020617" fill-opacity="0.78" />
    <text x="310" y="108" text-anchor="middle" fill="#f8fafc" font-size="34" font-family="'Trebuchet MS', Arial, sans-serif">You deid</text>
    <text x="310" y="138" text-anchor="middle" fill="#93c5fd" font-size="16" font-family="'Trebuchet MS', Arial, sans-serif">press flap to start a new game</text>
    ${detail}
  </g>`;
}

function renderViewSvg(rawState) {
  const state = normalizeState(rawState);
  if (!state.alive) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="620" height="260" viewBox="0 0 620 260" role="img" aria-label="README Flappy death screen">
  <rect width="620" height="260" fill="#020617" />
  <text x="310" y="108" text-anchor="middle" fill="#f8fafc" font-size="34" font-family="'Trebuchet MS', Arial, sans-serif" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="320ms" fill="freeze" />
    You deid
  </text>
  <text x="310" y="138" text-anchor="middle" fill="#93c5fd" font-size="16" font-family="'Trebuchet MS', Arial, sans-serif">press flap to start a new game</text>
  <text x="310" y="184" text-anchor="middle" fill="#fcd34d" font-size="20" font-family="'Trebuchet MS', Arial, sans-serif">Score ${escapeXml(String(state.score))} | Best ${escapeXml(String(state.bestScore))}</text>
</svg>`;
  }

  const prediction = describePrediction(state);
  const upcomingGap = prediction.firstGap;
  const startY = getLaneY(state.birdLane);
  const endY = getBirdYAtMs(startY, CYCLE_MS);
  const peakY = state.animationMode === "flap"
    ? clamp(startY - JUMP_HEIGHT, 8, GROUND_Y)
    : startY;
  const tapBandWidth = Math.max(64, Math.round(((PIPE_START_X - PIPE_EXIT_X) * MAX_WINDOW_MS) / CYCLE_MS));
  const tapBandX = BIRD_X - Math.round(tapBandWidth / 2);
  const pipeAtMs = prediction.pipeAtMs;
  const fallSpeed = getFallSpeed();
  const groundHitMs = fallSpeed > 0 ? (GROUND_Y - startY) / fallSpeed : Infinity;
  const groundCrash = Number.isFinite(groundHitMs) && groundHitMs >= 0 && groundHitMs < pipeAtMs;
  const predictedCrashAtMs = groundCrash
    ? Math.max(0, Math.min(CYCLE_MS, Math.round(groundHitMs)))
    : prediction.firstSurvives
      ? null
      : Math.max(0, Math.min(CYCLE_MS, Math.round(pipeAtMs)));
  const predictedCrash = Number.isFinite(predictedCrashAtMs);
  const crashReason = groundCrash ? "hit the ground" : "hit the pipe";
  const pipes = [0, 1, 2]
    .map((offset) => {
      const gap = getGapTop(state.seed, state.obstacleIndex + offset);
      const fromX = PIPE_START_X + (PIPE_SPACING_X * offset);
      const toX = PIPE_EXIT_X + (PIPE_SPACING_X * offset);
      return renderPipe(gap.top, fromX, toX, CYCLE_MS, "0s");
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="620" height="260" viewBox="0 0 620 260" role="img" aria-label="README Flappy animated game screen">
  <rect width="620" height="260" fill="#38bdf8" />
  <rect y="188" width="620" height="72" fill="#22c55e" />
  <rect y="204" width="620" height="56" fill="#15803d" />
  <rect x="${tapBandX}" y="28" width="${tapBandWidth}" height="160" fill="#f97316" fill-opacity="0.12" stroke="#fb923c" stroke-opacity="0.3" stroke-dasharray="6 4" />
  <line x1="${BIRD_X}" y1="28" x2="${BIRD_X}" y2="188" stroke="#ffffff" stroke-opacity="0.35" stroke-dasharray="6 6" />
  <text x="${BIRD_X}" y="22" text-anchor="middle" fill="#f8fafc" font-size="12" font-family="'Trebuchet MS', Arial, sans-serif">TAP LINE</text>
  ${pipes}
  ${renderBird(state, { startY, peakY, endY, durationMs: CYCLE_MS, peakAtMs: 260 })}
  <text x="18" y="26" fill="#082f49" font-size="20" font-family="'Trebuchet MS', Arial, sans-serif">README-FLAPPY</text>
  <text x="18" y="50" fill="#082f49" font-size="15" font-family="'Trebuchet MS', Arial, sans-serif">score ${escapeXml(String(state.score))} | best ${escapeXml(String(state.bestScore))}</text>
  <text x="18" y="72" fill="#082f49" font-size="13" font-family="'Trebuchet MS', Arial, sans-serif">${escapeXml(state.lastLog)}</text>
  <text x="18" y="92" fill="#082f49" font-size="12" font-family="'Trebuchet MS', Arial, sans-serif">timing ${escapeXml(`${state.lastTapErrorMs}ms`)} | gap ${escapeXml(String(upcomingGap.lane + 1))}${prediction.secondGap ? ` | next ${escapeXml(String(prediction.secondGap.lane + 1))}` : ""}</text>
  ${predictedCrash ? renderDeathOverlay(predictedCrashAtMs, crashReason) : ""}
</svg>`;
}

function renderButtonSvg(rawState) {
  const state = normalizeState(rawState);
  const label = state.alive ? "FLAP" : "NEW RUN";
  const sublabel = state.alive ? "TIME THE JUMP" : "TAP TO RESET";
  const accent = state.alive ? "#f97316" : "#38bdf8";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="68" viewBox="0 0 220 68" role="img" aria-label="${escapeXml(label)} button">
  <rect width="220" height="68" rx="22" fill="#082f49" />
  <rect x="5" y="5" width="210" height="58" rx="18" fill="#0f172a" stroke="${accent}" stroke-width="4" />
  <text x="110" y="30" text-anchor="middle" fill="#f8fafc" font-size="24" font-family="'Trebuchet MS', Arial, sans-serif">${escapeXml(label)}</text>
  <text x="110" y="49" text-anchor="middle" fill="${accent}" font-size="11" font-family="'Trebuchet MS', Arial, sans-serif">${escapeXml(sublabel)}</text>
</svg>`;
}

function renderImage(route, state) {
  if (route === "flappyViewImage") {
    return {
      type: "svg",
      body: renderViewSvg(state)
    };
  }

  return {
    type: "svg",
    body: renderButtonSvg(state)
  };
}

async function runAction(route, stateStore) {
  if (route !== "flappyTap") {
    return;
  }

  await stateStore.mutateState((current) => applyTap(current));
}

function createFileStateStore({ filePath }) {
  return createFileJsonStateStore({
    filePath,
    createFreshState,
    normalizeState
  });
}

function createRedisStateStore({ redis, key }) {
  return createRedisJsonStateStore({
    redis,
    key,
    createFreshState,
    normalizeState
  });
}

module.exports = {
  slug,
  routeMap,
  actionRoutes,
  createFreshState,
  normalizeState,
  routeNeedsState,
  getRateLimitAction,
  renderHome,
  renderImage,
  runAction,
  createFileStateStore,
  createRedisStateStore
};
