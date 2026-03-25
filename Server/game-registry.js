const cookieGame = require("./cookie-game");
const doomGame = require("./doom-game");
const flappyGame = require("./flappy-game");

const GAME_DEFINITIONS = new Map([
  [cookieGame.slug, cookieGame],
  [doomGame.slug, doomGame],
  [flappyGame.slug, flappyGame]
]);

function getGameDefinition(gameSlug) {
  return GAME_DEFINITIONS.get(gameSlug) || null;
}

module.exports = {
  GAME_DEFINITIONS,
  getGameDefinition
};
