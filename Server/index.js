const express = require("express");
const { remoteHandler } = require("./remote-handler");

const app = express();

app.disable("x-powered-by");

app.use((request, response) => {
  remoteHandler(request, response).catch((error) => {
    console.error(error);
    if (response.headersSent) {
      response.end();
      return;
    }

    response.status(500).type("text/plain; charset=utf-8").send("Internal Server Error");
  });
});

module.exports = app;
