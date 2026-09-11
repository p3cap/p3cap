const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const STATE_BUSY_ERROR_CODE = "STATE_BUSY";
const LOCK_TTL_MS = 5000;
const LOCK_WAIT_MS = 5500;
const LOCK_RETRY_MS = 50;

// Only releases the lock while it is still the one this instance took.
const releaseLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end

return 0
`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createStateBusyError(key) {
  const error = new Error(`Timed out waiting for the state lock on ${key}`);
  error.code = STATE_BUSY_ERROR_CODE;
  return error;
}

function createFileJsonStateStore({ filePath, createFreshState, normalizeState }) {
  let cachedState = null;
  let mutationQueue = Promise.resolve();

  async function readState() {
    if (cachedState) {
      return cachedState;
    }

    try {
      const normalized = normalizeState(JSON.parse(await fs.readFile(filePath, "utf8")));
      cachedState = normalized;
      return normalized;
    } catch (error) {
      return null;
    }
  }

  async function ensureStateFile() {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const normalized = normalizeState(parsed);
      cachedState = normalized;
      return normalized;
    } catch (error) {
      const fresh = normalizeState(createFreshState());
      await fs.writeFile(filePath, JSON.stringify(fresh, null, 2));
      cachedState = fresh;
      return fresh;
    }
  }

  async function getState() {
    if (cachedState) {
      return cachedState;
    }

    return ensureStateFile();
  }

  async function saveState(state) {
    const normalized = normalizeState({
      ...state,
      updatedAt: new Date().toISOString()
    });
    cachedState = normalized;
    await fs.writeFile(filePath, JSON.stringify(normalized, null, 2));
    return normalized;
  }

  function mutateState(mutator) {
    const task = mutationQueue.catch(() => undefined).then(async () => {
      const current = await getState();
      const next = await Promise.resolve(mutator(JSON.parse(JSON.stringify(current))));
      return saveState(next);
    });

    mutationQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  return {
    readState,
    getState,
    mutateState
  };
}

function createRedisJsonStateStore({ redis, key, createFreshState, normalizeState }) {
  const lockKey = `${key}:lock`;

  function parseStoredValue(raw) {
    if (raw === null || raw === undefined) {
      return null;
    }

    if (typeof raw === "string") {
      if (!raw.trim()) {
        return null;
      }

      try {
        return JSON.parse(raw);
      } catch (error) {
        return null;
      }
    }

    if (typeof raw === "object") {
      return raw;
    }

    return null;
  }

  async function readState() {
    const parsed = parseStoredValue(await redis.get(key));
    return parsed ? normalizeState(parsed) : null;
  }

  async function writeInitialState() {
    const fresh = normalizeState(createFreshState());
    // NX, so a save that landed first keeps its state instead of being reset.
    const created = await redis.set(key, JSON.stringify(fresh), { nx: true });
    if (created) {
      return fresh;
    }

    return (await readState()) || fresh;
  }

  async function getState() {
    return (await readState()) || writeInitialState();
  }

  async function saveState(state) {
    const normalized = normalizeState({
      ...state,
      updatedAt: new Date().toISOString()
    });
    await redis.set(key, JSON.stringify(normalized));
    return normalized;
  }

  // The REST API has no WATCH, so read-modify-write runs under a short-lived lock key. Without it,
  // two players acting in the same moment would both read the old state and one move would be lost.
  async function acquireLock() {
    const token = crypto.randomUUID();
    const deadline = Date.now() + LOCK_WAIT_MS;

    for (;;) {
      const acquired = await redis.set(lockKey, token, { nx: true, px: LOCK_TTL_MS });
      if (acquired) {
        return token;
      }

      if (Date.now() >= deadline) {
        throw createStateBusyError(key);
      }

      await wait(LOCK_RETRY_MS + Math.floor(Math.random() * LOCK_RETRY_MS));
    }
  }

  async function mutateState(mutator) {
    const token = await acquireLock();

    try {
      const current = await getState();
      const next = await Promise.resolve(mutator(JSON.parse(JSON.stringify(current))));
      return await saveState(next);
    } finally {
      // A failed release just leaves the lock to expire on its own.
      await redis.eval(releaseLockScript, [lockKey], [token]).catch(() => undefined);
    }
  }

  return {
    readState,
    getState,
    mutateState
  };
}

module.exports = {
  createFileJsonStateStore,
  createRedisJsonStateStore,
  STATE_BUSY_ERROR_CODE
};
