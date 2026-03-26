const cookieGame = require("./games/cookieclicker/cookie-game");
const doomGame = require("./games/doom/doom-game");
const flappyGame = require("./games/flappy/flappy-game");

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
