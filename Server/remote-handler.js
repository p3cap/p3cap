const { Redis } = require("@upstash/redis");
const { createRequestHandler, DEFAULT_GAME_SLUG, normalizeGameSlug } = require("./app");
const { createRedisStateStore } = require("./state-store");

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
  const baseStateKey = process.env.STATE_KEY || "readmeCookie:state";
  const stateStoreCache = new Map();

  function getStateStore(gameSlug) {
    const normalizedGameSlug = normalizeGameSlug(gameSlug) || defaultGameSlug;

    if (!stateStoreCache.has(normalizedGameSlug)) {
      const stateKey = normalizedGameSlug === defaultGameSlug
        ? baseStateKey
        : `${baseStateKey}:${normalizedGameSlug}`;

      stateStoreCache.set(normalizedGameSlug, createRedisStateStore({
        redis,
        key: stateKey
      }));
    }

    return stateStoreCache.get(normalizedGameSlug);
  }

  cachedHandler = createRequestHandler({
    getStateStore,
    defaultRedirectUrl: process.env.README_REDIRECT_URL || "",
    defaultGameSlug
  });

  return cachedHandler;
}

async function remoteHandler(request, response) {
  return getHandler()(request, response);
}

module.exports = {
  remoteHandler
};
