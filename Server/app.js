const { getGameDefinition } = require("./game-registry");
const { STATE_BUSY_ERROR_CODE } = require("./json-state-store");
const { normalizeTopCount, renderLeaderboardSvg } = require("./leaderboard");

const DEFAULT_GAME_SLUG = "cookieclicker";
const DEFAULT_LOBBY_SLUG = "global";
const DEFAULT_ACTION_COOLDOWN_MS = 800;
const STATIC_IMAGE_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";
const REDIRECT_ALLOWED_HOSTS = ["github.com"];

const LEGACY_ROUTE_MAP = new Map([
  ["/", "home"],
  ["/api/state", "state"],
  ["/images/cookie.gif", "cookieImage"],
  ["/images/counter.svg", "counterImage"],
  ["/images/status.svg", "statusImage"],
  ["/images/upgrade-button.svg", "upgradeImage"],
  ["/actions/click", "click"],
  ["/actions/upgrade", "upgrade"]
]);

function normalizeSlug(candidate) {
  const value = String(candidate || "").trim().toLowerCase();

  if (!value || value.length > 48) {
    return "";
  }

  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return "";
  }

  return value;
}

function normalizeGameSlug(candidate) {
  return normalizeSlug(candidate);
}

function normalizeLobbySlug(candidate) {
  return normalizeSlug(candidate);
}

function resolveLeaderboardRoute(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "leaderboard") {
    return null;
  }

  const gameSlug = normalizeGameSlug(segments[1].replace(/\.svg$/i, ""));
  if (!gameSlug || !getGameDefinition(gameSlug)) {
    return null;
  }

  return {
    gameSlug
  };
}

function getLeaderboardScore(game, state) {
  if (game && typeof game.getLeaderboardScore === "function") {
    return Math.max(0, Math.floor(Number(game.getLeaderboardScore(state)) || 0));
  }

  if (Number.isFinite(Number(state && state.score))) {
    return Math.max(0, Math.floor(Number(state.score)));
  }

  if (Number.isFinite(Number(state && state.clicks))) {
    return Math.max(0, Math.floor(Number(state.clicks)));
  }

  return 0;
}

function sendSvg(response, svg, { cacheable = false } = {}) {
  const cacheHeaders = cacheable
    ? { "Cache-Control": STATIC_IMAGE_CACHE_CONTROL }
    : {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      "Surrogate-Control": "no-store",
      Pragma: "no-cache",
      Expires: "0"
    };

  response.writeHead(200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    ...cacheHeaders
  });
  response.end(svg);
}

function sendGif(response, image) {
  response.writeHead(200, {
    "Content-Type": "image/gif",
    "Cache-Control": "public, max-age=31536000, immutable"
  });
  response.end(image);
}

function sendJson(response, data) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "Surrogate-Control": "no-store"
  });
  response.end(JSON.stringify(data, null, 2));
}

function sendHtml(response, html, statusCode = 200, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "Surrogate-Control": "no-store",
    ...extraHeaders
  });
  response.end(html);
}

function sendRedirect(response, location, statusCode = 303, extraHeaders = {}) {
  response.writeHead(statusCode, {
    Location: location,
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "Surrogate-Control": "no-store",
    Pragma: "no-cache",
    Expires: "0",
    ...extraHeaders
  });
  response.end();
}

function getHostname(candidate) {
  try {
    return new URL(String(candidate || "").trim()).hostname.toLowerCase();
  } catch (error) {
    return "";
  }
}

function getAllowedRedirectUrl(candidate, allowedHosts) {
  if (!candidate) {
    return "";
  }

  try {
    const parsed = new URL(String(candidate).trim());
    const hostname = parsed.hostname.toLowerCase();
    const isAllowedHost = allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && isAllowedHost) {
      return parsed.toString();
    }
  } catch (error) {
    return "";
  }

  return "";
}

function resolveFallbackLocation(request, url, defaultRedirectUrl) {
  // Only bounce back to GitHub, the configured README page or this server, so action links can't be used as an open redirect.
  const allowedHosts = [...REDIRECT_ALLOWED_HOSTS, getHostname(defaultRedirectUrl), url.hostname].filter(Boolean);

  const requested = getAllowedRedirectUrl(url.searchParams.get("redirect"), allowedHosts);
  if (requested) {
    return requested;
  }

  const referrer = getAllowedRedirectUrl(request.headers.referer || request.headers.referrer || "", allowedHosts);
  if (referrer) {
    return referrer;
  }

  const configured = getAllowedRedirectUrl(defaultRedirectUrl, allowedHosts);
  if (configured) {
    return configured;
  }

  return "/";
}

function createFreshFallbackLocation(fallbackLocation) {
  if (!fallbackLocation.includes("github.com")) {
    return fallbackLocation;
  }

  try {
    const parsed = new URL(fallbackLocation);
    if (parsed.hostname === "github.com" || parsed.hostname === "www.github.com") {
      parsed.searchParams.set("p3cap_refresh", Date.now().toString(36));
      return parsed.toString();
    }
  } catch (error) {
    return fallbackLocation;
  }

  return fallbackLocation;
}

function sendBackBounce(response, fallbackLocation) {
  sendRedirect(response, createFreshFallbackLocation(fallbackLocation));
}

function sendRateLimitedBounce(response, fallbackLocation, retryAfterMs) {
  const retrySeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  sendRedirect(response, createFreshFallbackLocation(fallbackLocation), 303, {
    "Retry-After": String(retrySeconds)
  });
}

function getRequestUrl(request) {
  const requestUrl = request.originalUrl || request.url || "/";
  const host = request.headers.host || "localhost";
  const protocol = request.protocol || request.headers["x-forwarded-proto"] || "http";
  return new URL(requestUrl, `${protocol}://${host}`);
}

function getClientId(request) {
  const forwardedFor = String(request.headers["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);
  const realIp = String(request.headers["x-real-ip"] || "").trim();
  const requestIp = String(request.ip || "").trim();
  const socketIp = request.socket && request.socket.remoteAddress
    ? String(request.socket.remoteAddress).trim()
    : "";

  return (forwardedFor || realIp || requestIp || socketIp || "anonymous").toLowerCase();
}

function resolveRoute(pathname, defaultGameSlug, defaultLobbySlug) {
  if (LEGACY_ROUTE_MAP.has(pathname)) {
    return {
      gameSlug: defaultGameSlug,
      lobbySlug: defaultLobbySlug,
      route: LEGACY_ROUTE_MAP.get(pathname),
      isLegacyAlias: pathname !== "/",
      isDefaultLobbyAlias: true
    };
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return {
      gameSlug: defaultGameSlug,
      lobbySlug: defaultLobbySlug,
      route: "home",
      isLegacyAlias: false,
      isDefaultLobbyAlias: true
    };
  }

  const gameSlug = normalizeGameSlug(segments[0]);
  const game = getGameDefinition(gameSlug);
  if (!gameSlug || !game) {
    return null;
  }

  if (segments.length === 1) {
    return {
      gameSlug,
      lobbySlug: defaultLobbySlug,
      route: "home",
      isLegacyAlias: false,
      isDefaultLobbyAlias: true
    };
  }

  const defaultLobbyRoute = game.routeMap.get(segments.slice(1).join("/"));
  if (defaultLobbyRoute) {
    return {
      gameSlug,
      lobbySlug: defaultLobbySlug,
      route: defaultLobbyRoute,
      isLegacyAlias: false,
      isDefaultLobbyAlias: true
    };
  }

  const lobbySlug = normalizeLobbySlug(segments[1]);
  if (!lobbySlug) {
    return null;
  }

  if (segments.length === 2) {
    return {
      gameSlug,
      lobbySlug,
      route: "home",
      isLegacyAlias: false,
      isDefaultLobbyAlias: lobbySlug === defaultLobbySlug
    };
  }

  const lobbyRoute = game.routeMap.get(segments.slice(2).join("/"));
  if (!lobbyRoute) {
    return null;
  }

  return {
    gameSlug,
    lobbySlug,
    route: lobbyRoute,
    isLegacyAlias: false,
    isDefaultLobbyAlias: false
  };
}

function sendImageResponse(response, asset, options) {
  if (!asset || !asset.type) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }

  if (asset.type === "gif") {
    sendGif(response, asset.body);
    return;
  }

  sendSvg(response, asset.body, options);
}

function createInitialLobbyState(game, lobbySlug) {
  return typeof game.createLobbyState === "function"
    ? game.createLobbyState(lobbySlug)
    : game.createFreshState();
}

function createRequestHandler({
  stateStore,
  getStateStore,
  leaderboardStore,
  rateLimiter,
  defaultRedirectUrl = "",
  defaultGameSlug = DEFAULT_GAME_SLUG,
  defaultLobbySlug = DEFAULT_LOBBY_SLUG,
  actionCooldownMs = DEFAULT_ACTION_COOLDOWN_MS
}) {
  const normalizedDefaultGameSlug = normalizeGameSlug(defaultGameSlug) || DEFAULT_GAME_SLUG;
  const normalizedDefaultLobbySlug = normalizeLobbySlug(defaultLobbySlug) || DEFAULT_LOBBY_SLUG;
  const resolveStateStore = typeof getStateStore === "function"
    ? (gameSlug, lobbySlug) => Promise.resolve(getStateStore(gameSlug, lobbySlug))
    : () => Promise.resolve(stateStore);

  return async function handleRequest(request, response) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD" });
      response.end("Method Not Allowed");
      return;
    }

    const url = getRequestUrl(request);
    const leaderboardRoute = resolveLeaderboardRoute(url.pathname);

    if (leaderboardRoute) {
      const highlightLobby = normalizeLobbySlug(url.searchParams.get("lobby"));
      const topCount = normalizeTopCount(url.searchParams.get("top"));
      const entries = leaderboardStore && typeof leaderboardStore.getGameEntries === "function"
        ? await leaderboardStore.getGameEntries(leaderboardRoute.gameSlug, {
          limit: topCount,
          lobbySlug: highlightLobby
        })
        : [];

      sendSvg(response, renderLeaderboardSvg({
        gameSlug: leaderboardRoute.gameSlug,
        entries,
        topCount,
        highlightLobby
      }));
      return;
    }

    const resolvedRoute = resolveRoute(url.pathname, normalizedDefaultGameSlug, normalizedDefaultLobbySlug);
    if (!resolvedRoute) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }

    const {
      gameSlug,
      lobbySlug,
      route,
      isLegacyAlias,
      isDefaultLobbyAlias
    } = resolvedRoute;
    const game = getGameDefinition(gameSlug);

    if (!game) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }

    if (!game.routeNeedsState(route)) {
      sendImageResponse(response, game.renderImage(route, game.createFreshState()), { cacheable: true });
      return;
    }

    const activeStateStore = await resolveStateStore(gameSlug, lobbySlug);
    if (!activeStateStore || typeof activeStateStore.readState !== "function") {
      throw new Error(`Missing state store for ${gameSlug}/${lobbySlug}`);
    }

    // Reads never create a lobby. Until its first action, a missing lobby is shown from its unsaved
    // starting state, so image requests (which all arrive through GitHub's image proxy) never write.
    const storedState = await activeStateStore.readState();
    const state = game.normalizeState(storedState || createInitialLobbyState(game, lobbySlug));

    if (route === "home") {
      sendHtml(response, game.renderHome(state, {
        defaultRedirectUrl,
        gameSlug,
        lobbySlug,
        actionCooldownMs,
        isLegacyAlias,
        isDefaultLobbyAlias
      }));
      return;
    }

    if (route === "state") {
      sendJson(response, state);
      return;
    }

    if (route.endsWith("Image")) {
      sendImageResponse(response, game.renderImage(route, state));
      return;
    }

    if (game.actionRoutes.has(route)) {
      const fallbackLocation = resolveFallbackLocation(request, url, defaultRedirectUrl);

      if (request.method === "HEAD") {
        sendBackBounce(response, fallbackLocation);
        return;
      }

      if (rateLimiter && typeof rateLimiter.consume === "function") {
        const clientId = getClientId(request);
        const rateLimitResult = await rateLimiter.consume({
          action: game.getRateLimitAction(route),
          gameSlug,
          lobbySlug,
          clientId
        });

        if (!rateLimitResult.allowed) {
          sendRateLimitedBounce(response, fallbackLocation, rateLimitResult.retryAfterMs || actionCooldownMs);
          return;
        }

        if (!storedState && lobbySlug !== normalizedDefaultLobbySlug) {
          const lobbyCreationResult = await rateLimiter.consume({
            action: "lobby-create",
            gameSlug,
            lobbySlug,
            clientId
          });

          if (!lobbyCreationResult.allowed) {
            sendRateLimitedBounce(response, fallbackLocation, lobbyCreationResult.retryAfterMs || actionCooldownMs);
            return;
          }
        }
      }

      let latestState;
      try {
        latestState = await game.runAction(route, activeStateStore);
      } catch (error) {
        if (error && error.code === STATE_BUSY_ERROR_CODE) {
          sendRateLimitedBounce(response, fallbackLocation, actionCooldownMs);
          return;
        }

        throw error;
      }

      if (leaderboardStore && typeof leaderboardStore.recordScore === "function") {
        const score = getLeaderboardScore(game, game.normalizeState(latestState || await activeStateStore.readState()));
        if (score > 0) {
          await leaderboardStore.recordScore(gameSlug, lobbySlug, score);
        }
      }
      sendBackBounce(response, fallbackLocation);
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  };
}

module.exports = {
  createRequestHandler,
  DEFAULT_ACTION_COOLDOWN_MS,
  DEFAULT_GAME_SLUG,
  DEFAULT_LOBBY_SLUG,
  normalizeGameSlug,
  normalizeLobbySlug
};
