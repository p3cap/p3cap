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

// Top `limit` entries, plus the `lobbySlug` entry at the end when it ranks below them.
function selectVisibleEntries(entries, { limit = entries.length, lobbySlug = "" } = {}) {
  const visibleEntries = entries.slice(0, limit);
  const highlightedEntry = lobbySlug && !visibleEntries.some((entry) => entry.lobbySlug === lobbySlug)
    ? entries.find((entry) => entry.lobbySlug === lobbySlug)
    : null;

  return highlightedEntry ? [...visibleEntries, highlightedEntry] : visibleEntries;
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

  async function getGameEntries(gameSlug, options) {
    return selectVisibleEntries(getGameEntriesFromState(await getState(), gameSlug), options);
  }

  return {
    getState,
    recordScore,
    getGameEntries
  };
}

function createRedisLeaderboardStore({ redis, key }) {
  // Each game is a sorted set at `<key>:<game-slug>` (lobby slug -> best score), so score updates are
  // atomic and reads only fetch the rows being shown. `key` itself held the older single-JSON
  // leaderboard; it is imported into the sorted sets once, then moved aside.
  let legacyImport = null;

  function getGameKey(gameSlug) {
    return `${key}:${gameSlug}`;
  }

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

  function importLegacyLeaderboard() {
    if (!legacyImport) {
      legacyImport = (async () => {
        const legacyState = parseStoredValue(await redis.get(key));
        if (!legacyState) {
          return;
        }

        const { games } = normalizeLeaderboardState(legacyState);
        for (const [gameSlug, gameData] of Object.entries(games)) {
          const scoreMembers = Object.entries(gameData.lobbies)
            .map(([lobbySlug, entry]) => ({ score: entry.bestScore, member: lobbySlug }));
          if (scoreMembers.length > 0) {
            await redis.zadd(getGameKey(gameSlug), { gt: true }, ...scoreMembers);
          }
        }

        // Fails harmlessly when another instance already moved it.
        await redis.rename(key, `${key}:legacy-backup`).catch(() => undefined);
      })().catch((error) => {
        legacyImport = null;
        throw error;
      });
    }

    return legacyImport;
  }

  async function recordScore(gameSlug, lobbySlug, score) {
    const normalizedScore = Math.max(0, Math.floor(Number(score) || 0));
    if (!normalizedScore) {
      return;
    }

    await importLegacyLeaderboard();
    await redis.zadd(getGameKey(gameSlug), { gt: true }, { score: normalizedScore, member: lobbySlug });
  }

  async function getGameEntries(gameSlug, { limit = 20, lobbySlug = "" } = {}) {
    await importLegacyLeaderboard();
    const gameKey = getGameKey(gameSlug);
    const flatEntries = await redis.zrange(gameKey, 0, limit - 1, { rev: true, withScores: true });
    const entries = [];

    for (let index = 0; index < flatEntries.length; index += 2) {
      entries.push({
        // The client JSON-parses replies, so a slug like "123" comes back as a number.
        lobbySlug: String(flatEntries[index]),
        bestScore: Number(flatEntries[index + 1]),
        rank: entries.length + 1
      });
    }

    if (lobbySlug && !entries.some((entry) => entry.lobbySlug === lobbySlug)) {
      const [rank, bestScore] = await Promise.all([
        redis.zrevrank(gameKey, lobbySlug),
        redis.zscore(gameKey, lobbySlug)
      ]);

      if (rank !== null && bestScore !== null) {
        entries.push({
          lobbySlug,
          bestScore: Number(bestScore),
          rank: Number(rank) + 1
        });
      }
    }

    return entries;
  }

  return {
    recordScore,
    getGameEntries
  };
}

module.exports = {
  createFileLeaderboardStore,
  createRedisLeaderboardStore
};
