const fs = require("fs/promises");
const path = require("path");

function createFileJsonStateStore({ filePath, createFreshState, normalizeState }) {
  let cachedState = null;
  let mutationQueue = Promise.resolve();

  async function hasState() {
    if (cachedState) {
      return true;
    }

    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
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
    hasState,
    getState,
    mutateState
  };
}

function createRedisJsonStateStore({ redis, key, createFreshState, normalizeState }) {
  async function hasState() {
    const raw = await redis.get(key);
    return typeof raw === "string" && raw.trim().length > 0;
  }

  async function writeInitialState() {
    const fresh = normalizeState(createFreshState());
    await redis.set(key, JSON.stringify(fresh));
    return fresh;
  }

  async function getState() {
    const raw = await redis.get(key);
    if (typeof raw === "string" && raw.trim()) {
      try {
        return normalizeState(JSON.parse(raw));
      } catch (error) {
        return writeInitialState();
      }
    }

    return writeInitialState();
  }

  async function saveState(state) {
    const normalized = normalizeState({
      ...state,
      updatedAt: new Date().toISOString()
    });
    await redis.set(key, JSON.stringify(normalized));
    return normalized;
  }

  async function mutateState(mutator) {
    const current = await getState();
    const next = await Promise.resolve(mutator(JSON.parse(JSON.stringify(current))));
    return saveState(next);
  }

  return {
    hasState,
    getState,
    mutateState
  };
}

module.exports = {
  createFileJsonStateStore,
  createRedisJsonStateStore
};
