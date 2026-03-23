const { onRequest } = require("firebase-functions/v2/https");
const { remoteHandler } = require("./remote-handler");

exports.readmeBackend = onRequest(
  {
    region: process.env.FUNCTION_REGION || "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB"
  },
  remoteHandler
);
