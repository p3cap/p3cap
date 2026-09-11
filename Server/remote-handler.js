const { Redis } = require("@upstash/redis");
const {
  createRequestHandler,
  DEFAULT_ACTION_COOLDOWN_MS,
  DEFAULT_GAME_SLUG,
  DEFAULT_LOBBY_SLUG,
  normalizeGameSlug,
  normalizeLobbySlug
} = require("./app");
const { getGameDefinition } = require("./game-registry");
const { createRedisLeaderboardStore } = require("./leaderboard-store");
const { createRedisRateLimiter, normalizeCooldownMs } = require("./rate-limiter");

let cachedHandler = null;

// Vercel names these after the store that was connected, so the prefix depends on how it was added.
const REDIS_CREDENTIAL_ENV_PAIRS = [
  ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
  ["STORAGE_KV_REST_API_URL", "STORAGE_KV_REST_API_TOKEN"]
];

function findRedisCredentials() {
  for (const [urlKey, tokenKey] of REDIS_CREDENTIAL_ENV_PAIRS) {
    if (process.env[urlKey] && process.env[tokenKey]) {
      return { url: process.env[urlKey], token: process.env[tokenKey] };
    }
  }

  // Any other prefix for the same pair, such as MYSTORE_KV_REST_API_URL and MYSTORE_KV_REST_API_TOKEN.
  const urlKey = Object.keys(process.env).find((key) => key.endsWith("KV_REST_API_URL") && process.env[key]);
  const tokenKey = urlKey ? `${urlKey.slice(0, -"URL".length)}TOKEN` : "";
  if (urlKey && process.env[tokenKey]) {
    return { url: process.env[urlKey], token: process.env[tokenKey] };
  }

  return null;
}

function getRedisClient() {
  const credentials = findRedisCredentials();

  if (!credentials) {
    throw new Error("Missing Redis credentials. Connect an Upstash Redis store in Vercel, or set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. KV_REST_API_* and <PREFIX>_KV_REST_API_* pairs are accepted too.");
  }

  return new Redis(credentials);
}

function getHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }

  const redis = getRedisClient();
  const defaultGameSlug = normalizeGameSlug(process.env.DEFAULT_GAME_SLUG) || DEFAULT_GAME_SLUG;
  const defaultLobbySlug = normalizeLobbySlug(process.env.DEFAULT_LOBBY_SLUG) || DEFAULT_LOBBY_SLUG;
  const baseStateKey = process.env.STATE_KEY || "readmeCookie:state";
  const actionCooldownMs = normalizeCooldownMs(process.env.ACTION_COOLDOWN_MS || DEFAULT_ACTION_COOLDOWN_MS);
  const stateStoreCache = new Map();
  const leaderboardStore = createRedisLeaderboardStore({
    redis,
    key: process.env.LEADERBOARD_KEY || `${baseStateKey}:leaderboard`
  });
  const rateLimiter = createRedisRateLimiter({
    redis,
    keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX || "readmeCookie:ratelimit",
    cooldownMs: actionCooldownMs
  });

  function getStateStore(gameSlug, lobbySlug) {
    const normalizedGameSlug = normalizeGameSlug(gameSlug) || defaultGameSlug;
    const normalizedLobbySlug = normalizeLobbySlug(lobbySlug) || defaultLobbySlug;
    const cacheKey = `${normalizedGameSlug}:${normalizedLobbySlug}`;

    if (!stateStoreCache.has(cacheKey)) {
      const stateKey = normalizedGameSlug === defaultGameSlug && normalizedLobbySlug === defaultLobbySlug
        ? baseStateKey
        : `${baseStateKey}:${normalizedGameSlug}:${normalizedLobbySlug}`;
      const game = getGameDefinition(normalizedGameSlug);
      if (!game || typeof game.createRedisStateStore !== "function") {
        throw new Error(`Unsupported game slug: ${normalizedGameSlug}`);
      }

      const stateStore = game.createRedisStateStore({
        redis,
        key: stateKey,
        lobbySlug: normalizedLobbySlug
      });

      stateStoreCache.set(cacheKey, stateStore);
    }

    return stateStoreCache.get(cacheKey);
  }

  cachedHandler = createRequestHandler({
    getStateStore,
    leaderboardStore,
    rateLimiter,
    defaultRedirectUrl: process.env.README_REDIRECT_URL || "",
    defaultGameSlug,
    defaultLobbySlug,
    actionCooldownMs
  });

  return cachedHandler;
}

async function remoteHandler(request, response) {
  return getHandler()(request, response);
}

module.exports = {
  remoteHandler
};
