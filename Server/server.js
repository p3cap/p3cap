const http = require("http");
const path = require("path");
const { createRequestHandler, DEFAULT_GAME_SLUG, normalizeGameSlug } = require("./app");
const { createFileStateStore } = require("./state-store");

const PORT = Number(process.env.PORT || 3000);
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, "data", "state.json");
const DEFAULT_GAME = normalizeGameSlug(process.env.DEFAULT_GAME_SLUG) || DEFAULT_GAME_SLUG;

function resolveStateFilePath(gameSlug) {
  const normalizedGameSlug = normalizeGameSlug(gameSlug) || DEFAULT_GAME;

  if (normalizedGameSlug === DEFAULT_GAME) {
    return STATE_FILE;
  }

  const parsed = path.parse(STATE_FILE);
  const extension = parsed.ext || ".json";
  return path.join(parsed.dir, `${parsed.name}-${normalizedGameSlug}${extension}`);
}

const stateStoreCache = new Map();

function getStateStore(gameSlug) {
  const normalizedGameSlug = normalizeGameSlug(gameSlug) || DEFAULT_GAME;

  if (!stateStoreCache.has(normalizedGameSlug)) {
    stateStoreCache.set(normalizedGameSlug, createFileStateStore({
      filePath: resolveStateFilePath(normalizedGameSlug)
    }));
  }

  return stateStoreCache.get(normalizedGameSlug);
}

const handleRequest = createRequestHandler({
  getStateStore,
  defaultRedirectUrl: process.env.README_REDIRECT_URL || "",
  defaultGameSlug: DEFAULT_GAME
});

async function main() {
  await getStateStore(DEFAULT_GAME).getState();

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
