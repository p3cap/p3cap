const { Redis } = require("@upstash/redis");
const { createRequestHandler } = require("./app");
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

  const stateStore = createRedisStateStore({
    redis: getRedisClient(),
    key: process.env.STATE_KEY || "readmeCookie:state"
  });

  cachedHandler = createRequestHandler({
    stateStore,
    defaultRedirectUrl: process.env.README_REDIRECT_URL || ""
  });

  return cachedHandler;
}

async function remoteHandler(request, response) {
  return getHandler()(request, response);
}

module.exports = {
  remoteHandler
};
