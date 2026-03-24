const http = require("http");
const path = require("path");
const {
  createRequestHandler,
  DEFAULT_ACTION_COOLDOWN_MS,
  DEFAULT_GAME_SLUG,
  DEFAULT_LOBBY_SLUG,
  normalizeGameSlug,
  normalizeLobbySlug
} = require("./app");
const { createMemoryRateLimiter, normalizeCooldownMs } = require("./rate-limiter");
const { createFileStateStore } = require("./state-store");

const PORT = Number(process.env.PORT || 3000);
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, "data", "state.json");
const DEFAULT_GAME = normalizeGameSlug(process.env.DEFAULT_GAME_SLUG) || DEFAULT_GAME_SLUG;
const DEFAULT_LOBBY = normalizeLobbySlug(process.env.DEFAULT_LOBBY_SLUG) || DEFAULT_LOBBY_SLUG;
const ACTION_COOLDOWN_MS = normalizeCooldownMs(process.env.ACTION_COOLDOWN_MS || DEFAULT_ACTION_COOLDOWN_MS);
const rateLimiter = createMemoryRateLimiter({ cooldownMs: ACTION_COOLDOWN_MS });

function resolveStateFilePath(gameSlug, lobbySlug) {
  const normalizedGameSlug = normalizeGameSlug(gameSlug) || DEFAULT_GAME;
  const normalizedLobbySlug = normalizeLobbySlug(lobbySlug) || DEFAULT_LOBBY;

  if (normalizedGameSlug === DEFAULT_GAME && normalizedLobbySlug === DEFAULT_LOBBY) {
    return STATE_FILE;
  }

  const parsed = path.parse(STATE_FILE);
  const extension = parsed.ext || ".json";
  return path.join(parsed.dir, `${parsed.name}-${normalizedGameSlug}-${normalizedLobbySlug}${extension}`);
}

const stateStoreCache = new Map();

function getStateStore(gameSlug, lobbySlug) {
  const normalizedGameSlug = normalizeGameSlug(gameSlug) || DEFAULT_GAME;
  const normalizedLobbySlug = normalizeLobbySlug(lobbySlug) || DEFAULT_LOBBY;
  const cacheKey = `${normalizedGameSlug}:${normalizedLobbySlug}`;

  if (!stateStoreCache.has(cacheKey)) {
    stateStoreCache.set(cacheKey, createFileStateStore({
      filePath: resolveStateFilePath(normalizedGameSlug, normalizedLobbySlug)
    }));
  }

  return stateStoreCache.get(cacheKey);
}

const handleRequest = createRequestHandler({
  getStateStore,
  rateLimiter,
  defaultRedirectUrl: process.env.README_REDIRECT_URL || "",
  defaultGameSlug: DEFAULT_GAME,
  defaultLobbySlug: DEFAULT_LOBBY,
  actionCooldownMs: ACTION_COOLDOWN_MS
});

async function main() {
  await getStateStore(DEFAULT_GAME, DEFAULT_LOBBY).getState();

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal Server Error");
      console.error(error);
    });
  });

  server.listen(PORT, () => {
    console.log(`Game backend listening on http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
