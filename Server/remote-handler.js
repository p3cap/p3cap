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

function getRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error("Missing Redis credentials. Add an Upstash Redis integration in Vercel or set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
  }

  return new Redis({ url, token });
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
        key: stateKey
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
