const fs = require("fs/promises");
const path = require("path");

function normalizeLeaderboardState(state) {
  const source = state && typeof state === "object" ? state : {};
  const rawGames = source.games && typeof source.games === "object" ? source.games : {};
  const games = {};

  for (const [gameSlug, gameData] of Object.entries(rawGames)) {
    const rawLobbies = gameData && typeof gameData === "object" && gameData.lobbies && typeof gameData.lobbies === "object"
      ? gameData.lobbies
      : {};
    const lobbies = {};

    for (const [lobbySlug, entry] of Object.entries(rawLobbies)) {
      const bestScore = Math.max(0, Math.floor(Number(entry && entry.bestScore)));
      if (!bestScore) {
        continue;
      }

      lobbies[lobbySlug] = {
        bestScore,
        updatedAt: entry && typeof entry.updatedAt === "string" && entry.updatedAt.trim()
          ? entry.updatedAt.trim()
          : new Date().toISOString()
      };
    }

    games[gameSlug] = { lobbies };
  }

  return {
    games,
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt.trim()
      ? source.updatedAt.trim()
      : new Date().toISOString()
  };
}

function getGameEntriesFromState(state, gameSlug) {
  const leaderboard = normalizeLeaderboardState(state);
  const lobbies = leaderboard.games[gameSlug] && leaderboard.games[gameSlug].lobbies
    ? leaderboard.games[gameSlug].lobbies
    : {};

  return Object.entries(lobbies)
    .map(([lobbySlug, entry]) => ({
      lobbySlug,
      bestScore: entry.bestScore,
      updatedAt: entry.updatedAt
    }))
    .sort((left, right) => right.bestScore - left.bestScore || left.lobbySlug.localeCompare(right.lobbySlug))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
}

function createFileLeaderboardStore({ filePath }) {
  let cachedState = null;
  let mutationQueue = Promise.resolve();

  async function ensureStateFile() {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const normalized = normalizeLeaderboardState(parsed);
      cachedState = normalized;
      return normalized;
    } catch (error) {
      const fresh = normalizeLeaderboardState({});
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
    const normalized = normalizeLeaderboardState({
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

  async function recordScore(gameSlug, lobbySlug, score) {
    const normalizedScore = Math.max(0, Math.floor(Number(score) || 0));
    if (!normalizedScore) {
      return getState();
    }

    return mutateState((current) => {
      const next = normalizeLeaderboardState(current);
      if (!next.games[gameSlug]) {
        next.games[gameSlug] = { lobbies: {} };
      }

      const existing = next.games[gameSlug].lobbies[lobbySlug];
      if (!existing || normalizedScore > existing.bestScore) {
        next.games[gameSlug].lobbies[lobbySlug] = {
          bestScore: normalizedScore,
          updatedAt: new Date().toISOString()
        };
      }

      return next;
    });
  }

  async function getGameEntries(gameSlug) {
    return getGameEntriesFromState(await getState(), gameSlug);
  }

  return {
    getState,
    recordScore,
    getGameEntries
  };
}

function createRedisLeaderboardStore({ redis, key }) {
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

  async function getState() {
    const raw = await redis.get(key);
    return normalizeLeaderboardState(parseStoredValue(raw) || {});
  }

  async function saveState(state) {
    const normalized = normalizeLeaderboardState({
      ...state,
      updatedAt: new Date().toISOString()
    });
    await redis.set(key, JSON.stringify(normalized));
    return normalized;
  }

  async function recordScore(gameSlug, lobbySlug, score) {
    const normalizedScore = Math.max(0, Math.floor(Number(score) || 0));
    if (!normalizedScore) {
      return getState();
    }

    const current = await getState();
    if (!current.games[gameSlug]) {
      current.games[gameSlug] = { lobbies: {} };
    }

    const existing = current.games[gameSlug].lobbies[lobbySlug];
    if (!existing || normalizedScore > existing.bestScore) {
      current.games[gameSlug].lobbies[lobbySlug] = {
        bestScore: normalizedScore,
        updatedAt: new Date().toISOString()
      };
      return saveState(current);
    }

    return current;
  }

  async function getGameEntries(gameSlug) {
    return getGameEntriesFromState(await getState(), gameSlug);
  }

  return {
    getState,
    recordScore,
    getGameEntries
  };
}

module.exports = {
  createFileLeaderboardStore,
  createRedisLeaderboardStore
};
