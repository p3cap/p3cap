const { createFileJsonStateStore, createRedisJsonStateStore } = require("./json-state-store");

const slug = "flappy";
const CYCLE_MS = 2200;
const IDEAL_TAP_MS = 1150;
const PERFECT_WINDOW_MS = 120;
const GOOD_WINDOW_MS = 260;
const MAX_WINDOW_MS = 460;
const LANE_Y = [66, 112, 158];
const GAP_TOP_BY_LANE = [34, 80, 126];
const GAP_HEIGHT = 54;

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

function getGapLane(state) {
  return hashString(`${state.seed}:${state.obstacleIndex}`) % 3;
}

function createFreshState(overrides = {}) {
  return {
    alive: true,
    score: 0,
    bestScore: 0,
    birdLane: 1,
    obstacleIndex: 0,
    seed: createRandomSeed(),
    cycleStartedAt: new Date().toISOString(),
    lastTapErrorMs: 0,
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
    birdLane: clampNumber(source.birdLane, 1, 0, 2),
    obstacleIndex: clampNumber(source.obstacleIndex, 0, 0, 999999),
    seed: clampNumber(source.seed, mixSeed("flappy", source.score || 0, source.obstacleIndex || 0), 1, 2147483646),
    cycleStartedAt: typeof source.cycleStartedAt === "string" && source.cycleStartedAt.trim()
      ? source.cycleStartedAt.trim()
      : new Date().toISOString(),
    lastTapErrorMs: clampNumber(source.lastTapErrorMs, 0, -9999, 9999),
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
    ? `Default redirect target: <code>${escapeXml(defaultRedirectUrl)}</code>`
    : "Set README_REDIRECT_URL to send action links straight back to GitHub.";

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
      <p><strong>Bird lane:</strong> ${escapeXml(String(state.birdLane + 1))} | <strong>Last timing noise:</strong> ${escapeXml(`${state.lastTapErrorMs}ms`)}</p>
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
  const noise = (hashString(`${state.seed}:${state.obstacleIndex}:${nowMs}`) % 181) - 90;
  const effectiveMs = elapsedMs + noise;
  const deltaMs = effectiveMs - IDEAL_TAP_MS;
  const absoluteDelta = Math.abs(deltaMs);
  let flapStrength = 0;

  if (absoluteDelta <= PERFECT_WINDOW_MS) {
    flapStrength = 2;
  } else if (absoluteDelta <= GOOD_WINDOW_MS) {
    flapStrength = 1;
  }

  return {
    elapsedMs,
    noise,
    effectiveMs,
    deltaMs,
    flapStrength,
    missedWindow: absoluteDelta > MAX_WINDOW_MS || elapsedMs > CYCLE_MS + 500
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
  const gapLane = getGapLane(state);
  const nextBirdLane = Math.max(0, Math.min(2, state.birdLane + 1 - timing.flapStrength));

  if (timing.missedWindow || nextBirdLane !== gapLane) {
    return {
      ...state,
      alive: false,
      birdLane: nextBirdLane,
      bestScore: Math.max(state.bestScore, state.score),
      lastTapErrorMs: timing.noise,
      lastLog: timing.missedWindow
        ? "Missed the timing window. Tap again to restart."
        : `Pipe hit. Needed lane ${gapLane + 1}. Tap again to restart.`
    };
  }

  const nextScore = state.score + 1;
  return {
    ...state,
    alive: true,
    score: nextScore,
    bestScore: Math.max(state.bestScore, nextScore),
    birdLane: nextBirdLane,
    obstacleIndex: state.obstacleIndex + 1,
    cycleStartedAt: new Date(nowMs).toISOString(),
    lastTapErrorMs: timing.noise,
    lastLog: timing.flapStrength === 2
      ? "Perfect flap."
      : "Close flap. You squeeze through."
  };
}

function renderBird(state) {
  const birdY = LANE_Y[state.birdLane];
  return `
  <g transform="translate(138 ${birdY - 14})">
    <ellipse cx="20" cy="16" rx="20" ry="14" fill="#facc15" />
    <ellipse cx="14" cy="13" rx="4" ry="4" fill="#111827" />
    <polygon points="34,16 48,12 48,20" fill="#fb923c" />
    <ellipse cx="20" cy="18" rx="10" ry="6" fill="#f59e0b">
      <animate attributeName="ry" values="6;2;6" dur="0.22s" repeatCount="indefinite" />
    </ellipse>
  </g>`;
}

function renderViewSvg(rawState) {
  const state = normalizeState(rawState);
  if (!state.alive) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="620" height="260" viewBox="0 0 620 260" role="img" aria-label="README Flappy death screen">
  <rect width="620" height="260" fill="#020617" />
  <text x="310" y="108" text-anchor="middle" fill="#f8fafc" font-size="34" font-family="'Trebuchet MS', Arial, sans-serif">You deid</text>
  <text x="310" y="138" text-anchor="middle" fill="#93c5fd" font-size="16" font-family="'Trebuchet MS', Arial, sans-serif">press flap to start a new game</text>
  <text x="310" y="184" text-anchor="middle" fill="#fcd34d" font-size="20" font-family="'Trebuchet MS', Arial, sans-serif">Score ${escapeXml(String(state.score))} | Best ${escapeXml(String(state.bestScore))}</text>
</svg>`;
  }

  const gapLane = getGapLane(state);
  const gapTop = GAP_TOP_BY_LANE[gapLane];
  const bottomPipeY = gapTop + GAP_HEIGHT;
  const bottomPipeHeight = 188 - bottomPipeY;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="620" height="260" viewBox="0 0 620 260" role="img" aria-label="README Flappy animated game screen">
  <rect width="620" height="260" fill="#38bdf8" />
  <rect y="188" width="620" height="72" fill="#22c55e" />
  <rect y="204" width="620" height="56" fill="#15803d" />
  <line x1="180" y1="28" x2="180" y2="188" stroke="#ffffff" stroke-opacity="0.35" stroke-dasharray="6 6" />
  <text x="180" y="22" text-anchor="middle" fill="#f8fafc" font-size="12" font-family="'Trebuchet MS', Arial, sans-serif">TAP LINE</text>
  ${renderBird(state)}
  <g>
    <rect x="520" y="0" width="74" height="${gapTop}" fill="#22c55e">
      <animate attributeName="x" from="520" to="-94" dur="${CYCLE_MS}ms" repeatCount="indefinite" />
    </rect>
    <rect x="512" y="${gapTop - 14}" width="90" height="14" fill="#15803d">
      <animate attributeName="x" from="512" to="-102" dur="${CYCLE_MS}ms" repeatCount="indefinite" />
    </rect>
    <rect x="520" y="${bottomPipeY}" width="74" height="${bottomPipeHeight}" fill="#22c55e">
      <animate attributeName="x" from="520" to="-94" dur="${CYCLE_MS}ms" repeatCount="indefinite" />
    </rect>
    <rect x="512" y="${bottomPipeY}" width="90" height="14" fill="#15803d">
      <animate attributeName="x" from="512" to="-102" dur="${CYCLE_MS}ms" repeatCount="indefinite" />
    </rect>
  </g>
  <text x="18" y="26" fill="#082f49" font-size="20" font-family="'Trebuchet MS', Arial, sans-serif">README-FLAPPY</text>
  <text x="18" y="50" fill="#082f49" font-size="15" font-family="'Trebuchet MS', Arial, sans-serif">score ${escapeXml(String(state.score))} | best ${escapeXml(String(state.bestScore))}</text>
  <text x="18" y="72" fill="#082f49" font-size="13" font-family="'Trebuchet MS', Arial, sans-serif">${escapeXml(state.lastLog)}</text>
  <text x="18" y="92" fill="#082f49" font-size="12" font-family="'Trebuchet MS', Arial, sans-serif">timed flap + noise ${escapeXml(`${state.lastTapErrorMs}ms`)}</text>
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
