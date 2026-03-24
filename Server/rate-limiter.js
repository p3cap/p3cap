const { DEFAULT_ACTION_COOLDOWN_MS } = require("./app");

function encodeKeyPart(value) {
  return encodeURIComponent(String(value || "").trim().toLowerCase());
}

function normalizeCooldownMs(candidate) {
  const numeric = Number(candidate);

  if (!Number.isFinite(numeric)) {
    return DEFAULT_ACTION_COOLDOWN_MS;
  }

  return Math.max(250, Math.floor(numeric));
}

function createMemoryRateLimiter({ cooldownMs = DEFAULT_ACTION_COOLDOWN_MS } = {}) {
  const normalizedCooldownMs = normalizeCooldownMs(cooldownMs);
  const expirations = new Map();

  function consume({ action, gameSlug, clientId }) {
    const now = Date.now();
    const key = [
      encodeKeyPart(clientId),
      encodeKeyPart(gameSlug),
      encodeKeyPart(action)
    ].join(":");
    const expiresAt = expirations.get(key) || 0;

    if (expiresAt > now) {
      return {
        allowed: false,
        retryAfterMs: expiresAt - now
      };
    }

    expirations.set(key, now + normalizedCooldownMs);

    if (expirations.size > 5000) {
      for (const [entryKey, entryExpiresAt] of expirations) {
        if (entryExpiresAt <= now) {
          expirations.delete(entryKey);
        }
      }
    }

    return {
      allowed: true,
      retryAfterMs: 0
    };
  }

  return {
    consume
  };
}

function createRedisRateLimiter({
  redis,
  keyPrefix = "readmeCookie:ratelimit",
  cooldownMs = DEFAULT_ACTION_COOLDOWN_MS
}) {
  const normalizedCooldownMs = normalizeCooldownMs(cooldownMs);
  const consumeScript = `
local rateKey = KEYS[1]
local nowValue = ARGV[1]
local cooldownMs = tonumber(ARGV[2])

if redis.call("SET", rateKey, nowValue, "PX", cooldownMs, "NX") then
  return {1, 0}
end

local retryAfterMs = redis.call("PTTL", rateKey)
if retryAfterMs < 0 then
  retryAfterMs = cooldownMs
end

return {0, retryAfterMs}
`;

  async function consume({ action, gameSlug, clientId }) {
    const key = [
      keyPrefix,
      encodeKeyPart(gameSlug),
      encodeKeyPart(action),
      encodeKeyPart(clientId)
    ].join(":");
    const result = await redis.eval(
      consumeScript,
      [key],
      [String(Date.now()), String(normalizedCooldownMs)]
    );
    const allowed = Array.isArray(result) && Number(result[0]) === 1;
    const retryAfterMs = Array.isArray(result) && Number.isFinite(Number(result[1]))
      ? Math.max(0, Number(result[1]))
      : normalizedCooldownMs;

    return {
      allowed,
      retryAfterMs
    };
  }

  return {
    consume
  };
}

module.exports = {
  createMemoryRateLimiter,
  createRedisRateLimiter,
  normalizeCooldownMs
};
