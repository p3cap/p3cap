const http = require("http");
const path = require("path");
const { createRequestHandler } = require("./app");
const { createFileStateStore } = require("./state-store");

const PORT = Number(process.env.PORT || 3000);
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, "data", "state.json");

const stateStore = createFileStateStore({ filePath: STATE_FILE });
const handleRequest = createRequestHandler({
  stateStore,
  defaultRedirectUrl: process.env.README_REDIRECT_URL || ""
});

async function main() {
  await stateStore.getState();

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal Server Error");
      console.error(error);
    });
  });

  server.listen(PORT, () => {
    console.log(`Cookie backend listening on http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
