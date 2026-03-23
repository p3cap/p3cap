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

function createFirestoreStateStore({ db, collectionName = "readmeCookie", documentId = "state" }) {
  const docRef = db.collection(collectionName).doc(documentId);

  async function getState() {
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      const state = normalizeState(initialState);
      await docRef.set(state);
      return state;
    }

    return normalizeState(snapshot.data());
  }

  async function mutateState(mutator) {
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      const current = normalizeState(snapshot.exists ? snapshot.data() : initialState);
      const next = await Promise.resolve(mutator(cloneState(current)));
      const normalized = normalizeState({
        ...next,
        updatedAt: new Date().toISOString()
      });
      transaction.set(docRef, normalized);
      return normalized;
    });
  }

  return {
    getState,
    mutateState
  };
}

module.exports = {
  createFileStateStore,
  createFirestoreStateStore
};
