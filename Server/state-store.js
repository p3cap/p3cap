const fs = require("fs/promises");
const path = require("path");

const initialState = {
  clicks: 0,
  clickPower: 1,
  upgradeLevel: 0,
  upgradeCost: 10,
  lastLog: "Cookie shop ready.",
  updatedAt: new Date().toISOString()
};

function calculateUpgradeCost(upgradeLevel) {
  return 10 * Math.pow(2, upgradeLevel);
}

function normalizeState(state) {
  const source = state || {};
  const upgradeLevel = Number.isFinite(Number(source.upgradeLevel))
    ? Math.max(0, Math.floor(Number(source.upgradeLevel)))
    : 0;
  const clickPower = Number.isFinite(Number(source.clickPower))
    ? Math.max(1, Math.floor(Number(source.clickPower)))
    : upgradeLevel + 1;
  const clicks = Number.isFinite(Number(source.clicks))
    ? Math.max(0, Math.floor(Number(source.clicks)))
    : 0;

  return {
    clicks,
    clickPower,
    upgradeLevel,
    upgradeCost: calculateUpgradeCost(upgradeLevel),
    lastLog: typeof source.lastLog === "string" && source.lastLog.trim()
      ? source.lastLog.trim()
      : initialState.lastLog,
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt.trim()
      ? source.updatedAt.trim()
      : new Date().toISOString()
  };
}

function cloneState(state) {
  return {
    ...state
  };
}

function createFileStateStore({ filePath }) {
  let cachedState = null;
  let mutationQueue = Promise.resolve();

  async function ensureStateFile() {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const state = normalizeState(parsed);
      cachedState = state;
      return state;
    } catch (error) {
      const state = normalizeState(initialState);
      await fs.writeFile(filePath, JSON.stringify(state, null, 2));
      cachedState = state;
      return state;
    }
  }

  async function getState() {
    if (cachedState) {
      return cachedState;
    }

    return ensureStateFile();
  }

  async function saveState(state) {
    const normalized = normalizeState(state);
    cachedState = normalized;
    await fs.writeFile(filePath, JSON.stringify(normalized, null, 2));
    return normalized;
  }

  function mutateState(mutator) {
    const task = mutationQueue.catch(() => undefined).then(async () => {
      const current = await getState();
      const next = await Promise.resolve(mutator(cloneState(current)));
      return saveState({
        ...next,
        updatedAt: new Date().toISOString()
      });
    });

    mutationQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  return {
    getState,
    mutateState
  };
}

function createRedisStateStore({ redis, key = "readmeCookie:state" }) {
  const clickScript = `
local stateKey = KEYS[1]
local updatedAt = ARGV[1]

local clickPower = tonumber(redis.call("HGET", stateKey, "clickPower"))
if not clickPower then
  clickPower = 1
end

if redis.call("EXISTS", stateKey) == 0 then
  redis.call("HSET", stateKey,
    "clicks", 0,
    "clickPower", clickPower,
    "upgradeLevel", 0,
    "upgradeCost", 10
  )
end

local clicks = redis.call("HINCRBY", stateKey, "clicks", clickPower)
redis.call("HSET", stateKey,
  "clickPower", clickPower,
  "upgradeLevel", tonumber(redis.call("HGET", stateKey, "upgradeLevel")) or 0,
  "upgradeCost", tonumber(redis.call("HGET", stateKey, "upgradeCost")) or 10,
  "lastLog", "Cookie clicked: +" .. clickPower,
  "updatedAt", updatedAt
)

return redis.call("HGETALL", stateKey)
`;

  const upgradeScript = `
local stateKey = KEYS[1]
local updatedAt = ARGV[1]

if redis.call("EXISTS", stateKey) == 0 then
  redis.call("HSET", stateKey,
    "clicks", 0,
    "clickPower", 1,
    "upgradeLevel", 0,
    "upgradeCost", 10
  )
end

local clicks = tonumber(redis.call("HGET", stateKey, "clicks")) or 0
local clickPower = tonumber(redis.call("HGET", stateKey, "clickPower")) or 1
local upgradeLevel = tonumber(redis.call("HGET", stateKey, "upgradeLevel")) or 0
local upgradeCost = tonumber(redis.call("HGET", stateKey, "upgradeCost")) or 10

if clicks < upgradeCost then
  local needed = upgradeCost - clicks
  redis.call("HSET", stateKey,
    "clicks", clicks,
    "clickPower", clickPower,
    "upgradeLevel", upgradeLevel,
    "upgradeCost", upgradeCost,
    "lastLog", "Upgrade failed: need " .. needed .. " more",
    "updatedAt", updatedAt
  )
  return redis.call("HGETALL", stateKey)
end

local nextUpgradeLevel = upgradeLevel + 1
local nextClickPower = clickPower + 1
local nextClicks = clicks - upgradeCost
local nextUpgradeCost = 10 * (2 ^ nextUpgradeLevel)

redis.call("HSET", stateKey,
  "clicks", nextClicks,
  "clickPower", nextClickPower,
  "upgradeLevel", nextUpgradeLevel,
  "upgradeCost", nextUpgradeCost,
  "lastLog", "Upgrade bought: clicks now give +" .. nextClickPower,
  "updatedAt", updatedAt
)

return redis.call("HGETALL", stateKey)
`;

  function parseHashState(hash) {
    if (!hash || Object.keys(hash).length === 0) {
      return null;
    }

    return normalizeState(hash);
  }

  function parseEvalHash(reply) {
    if (!Array.isArray(reply) || reply.length === 0) {
      return null;
    }

    const hash = {};
    for (let index = 0; index < reply.length; index += 2) {
      hash[reply[index]] = reply[index + 1];
    }

    return parseHashState(hash);
  }

  async function writeInitialState() {
    const state = normalizeState(initialState);
    await redis.hset(key, state);
    return state;
  }

  async function getState() {
    const hash = await redis.hgetall(key);
    const state = parseHashState(hash);

    if (state) {
      return state;
    }

    return writeInitialState();
  }

  async function mutateState(mutator) {
    const current = await getState();
    const next = await Promise.resolve(mutator(cloneState(current)));
    const normalized = normalizeState({
      ...next,
      updatedAt: new Date().toISOString()
    });
    await redis.hset(key, normalized);
    return normalized;
  }

  async function click() {
    const result = await redis.eval(clickScript, [key], [new Date().toISOString()]);
    return parseEvalHash(result) || getState();
  }

  async function upgrade() {
    const result = await redis.eval(upgradeScript, [key], [new Date().toISOString()]);
    return parseEvalHash(result) || getState();
  }

  return {
    getState,
    mutateState,
    click,
    upgrade
  };
}

module.exports = {
  createFileStateStore,
  createRedisStateStore
};
