const fs = require("fs");
const path = require("path");
const {
  DOOM_ROUTE_MAP,
  applyDoomAction,
  createFreshDoomState,
  doomRouteNeedsState,
  normalizeDoomState,
  renderDoomHome,
  renderDoomImage
} = require("./doom-game");

const formatter = new Intl.NumberFormat("en-US");
const COOKIE_IMAGE_PATH = path.join(__dirname, "assets", "cookie.gif");
const DEFAULT_GAME_SLUG = "cookieclicker";
const DEFAULT_LOBBY_SLUG = "global";
const DEFAULT_ACTION_COOLDOWN_MS = 800;

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

const COOKIECLICKER_ROUTE_MAP = new Map([
  ["api/state", "state"],
  ["images/cookie.gif", "cookieImage"],
  ["images/counter.svg", "counterImage"],
  ["images/status.svg", "statusImage"],
  ["images/upgrade-button.svg", "upgradeImage"],
  ["click", "click"],
  ["upgrade", "upgrade"],
  ["actions/click", "click"],
  ["actions/upgrade", "upgrade"]
]);

const DOOM_ACTION_ROUTES = new Set([
  "doomForward",
  "doomBackward",
  "doomTurnLeft",
  "doomTurnRight",
  "doomStrafeLeft",
  "doomStrafeRight",
  "doomShoot",
  "doomWait"
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

function formatSlugLabel(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatExactNumber(value) {
  return formatter.format(Math.max(0, Math.floor(value)));
}

function formatCompactNumber(value) {
  const number = Math.max(0, Number(value) || 0);

  if (number < 1000) {
    return formatExactNumber(number);
  }

  const units = [
    { value: 1e12, suffix: "T" },
    { value: 1e9, suffix: "B" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "K" }
  ];

  for (const unit of units) {
    if (number >= unit.value) {
      const short = (number / unit.value).toFixed(number >= unit.value * 100 ? 0 : 1);
      return `${short.replace(/\.0$/, "")}${unit.suffix}`;
    }
  }

  return formatExactNumber(number);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildGamePath(gameSlug, suffix = "") {
  return `/${gameSlug}${suffix}`;
}

function buildLobbyPath(gameSlug, lobbySlug, suffix = "") {
  return `/${gameSlug}/${lobbySlug}${suffix}`;
}

function getRouteMapForGame(gameSlug) {
  if (gameSlug === "doom") {
    return DOOM_ROUTE_MAP;
  }

  if (gameSlug === "cookieclicker") {
    return COOKIECLICKER_ROUTE_MAP;
  }

  return null;
}

function routeNeedsState(gameSlug, route) {
  if (gameSlug === "doom") {
    return doomRouteNeedsState(route);
  }

  return route !== "cookieImage";
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
  const routeMap = getRouteMapForGame(gameSlug);
  if (!gameSlug || !routeMap) {
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

  const defaultLobbyRoute = routeMap.get(segments.slice(1).join("/"));
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

  const lobbyRoute = routeMap.get(segments.slice(2).join("/"));
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

function summarizeLastLog(message) {
  if (message.startsWith("Cookie clicked: +")) {
    const amount = Number(message.replace("Cookie clicked: +", ""));
    return `Last hit +${formatCompactNumber(amount)}`;
  }

  if (message.startsWith("Upgrade bought:")) {
    return "Upgrade purchased";
  }

  if (message.startsWith("Upgrade failed: need ")) {
    const amount = Number(message.replace("Upgrade failed: need ", "").replace(" more", ""));
    return `Need ${formatCompactNumber(amount)} more`;
  }

  return message;
}

function svgIcon(icon, accent) {
  if (icon === "cookie") {
    return `
  <circle cx="42" cy="48" r="22" fill="${accent}" />
  <circle cx="30" cy="38" r="3" fill="#7c2d12" />
  <circle cx="46" cy="34" r="3" fill="#7c2d12" />
  <circle cx="54" cy="49" r="3" fill="#7c2d12" />
  <circle cx="35" cy="57" r="3" fill="#7c2d12" />
  <circle cx="48" cy="61" r="3" fill="#7c2d12" />`;
  }

  return `
  <path d="M42 24 L26 53 H39 L33 74 L58 41 H46 L52 24 Z" fill="${accent}" />`;
}

function svgStatCard({ width, height, accent, icon, label, value }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">
  <rect width="${width}" height="${height}" rx="20" fill="#0f172a" />
  <rect x="4" y="4" width="${width - 8}" height="${height - 8}" rx="16" fill="#111827" stroke="#243041" stroke-width="2" />
  <rect x="18" y="18" width="48" height="60" rx="16" fill="#1f2937" />
  ${svgIcon(icon, accent)}
  <text x="82" y="42" fill="#94a3b8" font-size="15" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif" letter-spacing="1.6">${escapeXml(label.toUpperCase())}</text>
  <text x="82" y="81" fill="#f8fafc" font-size="34" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">${escapeXml(value)}</text>
</svg>`;
}

function svgUpgradePanel(state) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="270" viewBox="0 0 300 270" role="img" aria-label="Upgrade sidebar">
  <rect width="300" height="270" rx="28" fill="#020617" />
  <rect x="8" y="8" width="284" height="254" rx="22" fill="#111827" stroke="#263343" stroke-width="2" />
  <text x="24" y="44" fill="#f8fafc" font-size="16" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif" letter-spacing="2">UPGRADES</text>
  <text x="24" y="84" fill="#f8fafc" font-size="28" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">+1 click power</text>
  <text x="24" y="126" fill="#cbd5e1" font-size="18" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">Cost: ${escapeXml(formatCompactNumber(state.upgradeCost))} cookies</text>
  <text x="24" y="154" fill="#cbd5e1" font-size="18" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">Current: +${escapeXml(formatCompactNumber(state.clickPower))} per click</text>
  <text x="24" y="182" fill="#cbd5e1" font-size="18" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">Level: ${escapeXml(String(state.upgradeLevel))}</text>
  <text x="24" y="208" fill="#f59e0b" font-size="14" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">${escapeXml(summarizeLastLog(state.lastLog))}</text>
  <rect x="22" y="220" width="256" height="32" rx="16" fill="#f97316" />
  <text x="150" y="242" text-anchor="middle" fill="#fff7ed" font-size="20" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">BUY UPGRADE</text>
</svg>`;
}

function sendSvg(response, svg) {
  response.writeHead(200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "Surrogate-Control": "no-store",
    Pragma: "no-cache",
    Expires: "0"
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

function getSafeAbsoluteUrl(candidate) {
  if (!candidate) {
    return "";
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch (error) {
    return "";
  }

  return "";
}

function resolveFallbackLocation(request, url, defaultRedirectUrl) {
  const requested = getSafeAbsoluteUrl(url.searchParams.get("redirect"));
  const referrer = getSafeAbsoluteUrl(request.headers.referer || request.headers.referrer || "");
  const configured = getSafeAbsoluteUrl(defaultRedirectUrl);

  return requested || referrer || configured || "/";
}

function createFreshFallbackLocation(fallbackLocation) {
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

function renderBackBouncePage(fallbackLocation) {
  const safeFallback = escapeXml(fallbackLocation);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Returning...</title>
    <meta http-equiv="refresh" content="2;url=${safeFallback}" />
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #020617;
        color: #f8fafc;
        font: 16px/1.5 "Segoe UI", Arial, sans-serif;
      }
      main {
        padding: 24px;
        text-align: center;
      }
      a {
        color: #fbbf24;
      }
    </style>
  </head>
  <body>
    <main>
      <p>Returning to the previous page...</p>
      <p><a href="${safeFallback}">Continue manually</a></p>
    </main>
    <script>
      const fallback = ${JSON.stringify(fallbackLocation)};
      window.location.replace(fallback);
    </script>
  </body>
</html>`;
}

function renderRateLimitBouncePage(fallbackLocation, retryAfterMs) {
  const safeFallback = escapeXml(fallbackLocation);
  const retrySeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Slow Down</title>
    <meta http-equiv="refresh" content="${retrySeconds};url=${safeFallback}" />
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #020617;
        color: #f8fafc;
        font: 16px/1.5 "Segoe UI", Arial, sans-serif;
      }
      main {
        width: min(520px, calc(100vw - 32px));
        padding: 24px;
        text-align: center;
      }
      a {
        color: #fbbf24;
      }
      strong {
        color: #fbbf24;
      }
    </style>
  </head>
  <body>
    <main>
      <p><strong>Slow down a little.</strong></p>
      <p>This lobby is temporarily throttled for repeated actions from the same IP. Try again in about ${retrySeconds}s.</p>
      <p><a href="${safeFallback}">Return now</a></p>
    </main>
    <script>
      const fallback = ${JSON.stringify(fallbackLocation)};
      const retryAfterMs = ${JSON.stringify(retrySeconds * 1000)};
      window.setTimeout(() => window.location.replace(fallback), retryAfterMs);
    </script>
  </body>
</html>`;
}

function sendBackBounce(response, fallbackLocation) {
  sendHtml(response, renderBackBouncePage(createFreshFallbackLocation(fallbackLocation)));
}

function sendRateLimitedBounce(response, fallbackLocation, retryAfterMs) {
  const retrySeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  sendHtml(response, renderRateLimitBouncePage(createFreshFallbackLocation(fallbackLocation), retryAfterMs), 429, {
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

function getActionRateLimitKey(gameSlug, route) {
  if (gameSlug === "doom" && DOOM_ACTION_ROUTES.has(route)) {
    return "doom-step";
  }

  return route;
}

function renderCookieHome(state, defaultRedirectUrl, gameSlug, lobbySlug, options = {}) {
  const gameLabel = formatSlugLabel(gameSlug);
  const canonicalLobbyPath = buildLobbyPath(gameSlug, lobbySlug);
  const hint = defaultRedirectUrl
    ? `Default redirect: <code>${escapeXml(defaultRedirectUrl)}</code>`
    : "Set README_REDIRECT_URL to make action routes bounce back to GitHub automatically.";
  const aliasHint = options.isLegacyAlias || options.isDefaultLobbyAlias
    ? `<p><strong>Canonical lobby path:</strong> <code>${escapeXml(canonicalLobbyPath)}</code></p>`
    : "";
  const spamHint = options.actionCooldownMs
    ? `<p><strong>Anonymous anti-spam:</strong> about one action every ${escapeXml((options.actionCooldownMs / 1000).toFixed(options.actionCooldownMs < 1000 ? 1 : 0))}s per IP, per game.</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(gameLabel)} Lobby</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #1f2937, #020617 70%);
        color: #f8fafc;
        font: 16px/1.5 "Segoe UI", Arial, sans-serif;
      }
      main {
        width: min(760px, calc(100vw - 32px));
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid #334155;
        border-radius: 24px;
        padding: 28px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      }
      code {
        background: rgba(30, 41, 59, 0.8);
        padding: 2px 6px;
        border-radius: 6px;
      }
      a {
        color: #fbbf24;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeXml(gameLabel)} Lobby</h1>
      <p>This server powers interactive GitHub README games by storing per-lobby state, serving dynamic SVGs, and redirecting back to GitHub after every action.</p>
      <p><strong>Game slug:</strong> <code>${escapeXml(gameSlug)}</code></p>
      <p><strong>Lobby ID:</strong> <code>${escapeXml(lobbySlug)}</code></p>
      <p><strong>Clicks:</strong> ${escapeXml(formatExactNumber(state.clicks))} (${escapeXml(formatCompactNumber(state.clicks))})</p>
      <p><strong>Power:</strong> +${escapeXml(formatExactNumber(state.clickPower))} per click (${escapeXml(formatCompactNumber(state.clickPower))})</p>
      <p><strong>Next upgrade:</strong> ${escapeXml(formatExactNumber(state.upgradeCost))} (${escapeXml(formatCompactNumber(state.upgradeCost))})</p>
      <p><strong>Last log:</strong> ${escapeXml(state.lastLog)}</p>
      <p>${hint}</p>
      ${aliasHint}
      ${spamHint}
      <p>Endpoints: <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/click"))}</code>, <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/upgrade"))}</code>, <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/images/counter.svg"))}</code>, <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/images/status.svg"))}</code>, <code>${escapeXml(buildLobbyPath(gameSlug, lobbySlug, "/images/upgrade-button.svg"))}</code>.</p>
      <p>Create another lobby any time by changing the middle URL segment, for example <code>${escapeXml(buildLobbyPath(gameSlug, "friends", "/click"))}</code>.</p>
    </main>
  </body>
</html>`;
}

async function runCookieAction(route, stateStore) {
  if (route === "click") {
    if (typeof stateStore.click === "function") {
      await stateStore.click();
      return;
    }

    await stateStore.mutateState((current) => ({
      ...current,
      clicks: current.clicks + current.clickPower,
      lastLog: `Cookie clicked: +${current.clickPower}`
    }));
    return;
  }

  if (typeof stateStore.upgrade === "function") {
    await stateStore.upgrade();
    return;
  }

  await stateStore.mutateState((current) => {
    if (current.clicks < current.upgradeCost) {
      return {
        ...current,
        lastLog: `Upgrade failed: need ${current.upgradeCost - current.clicks} more`
      };
    }

    const upgradeLevel = current.upgradeLevel + 1;
    return {
      ...current,
      clicks: current.clicks - current.upgradeCost,
      clickPower: current.clickPower + 1,
      upgradeLevel,
      lastLog: `Upgrade bought: clicks now give +${current.clickPower + 1}`
    };
  });
}

function createRequestHandler({
  stateStore,
  getStateStore,
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
    const url = getRequestUrl(request);
    const resolvedRoute = resolveRoute(url.pathname, normalizedDefaultGameSlug, normalizedDefaultLobbySlug);

    if (request.method !== "GET") {
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method Not Allowed");
      return;
    }

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

    if (!routeNeedsState(gameSlug, route)) {
      if (gameSlug === "cookieclicker" && route === "cookieImage") {
        sendGif(response, fs.readFileSync(COOKIE_IMAGE_PATH));
        return;
      }

      if (gameSlug === "doom") {
        sendSvg(response, renderDoomImage(route, createFreshDoomState()));
        return;
      }
    }

    const activeStateStore = await resolveStateStore(gameSlug, lobbySlug);
    if (!activeStateStore || typeof activeStateStore.getState !== "function") {
      throw new Error(`Missing state store for ${gameSlug}/${lobbySlug}`);
    }

    if (
      routeNeedsState(gameSlug, route) &&
      lobbySlug !== normalizedDefaultLobbySlug &&
      rateLimiter &&
      typeof rateLimiter.consume === "function" &&
      typeof activeStateStore.hasState === "function" &&
      !(await activeStateStore.hasState())
    ) {
      const lobbyCreationResult = await rateLimiter.consume({
        action: "lobby-create",
        gameSlug,
        lobbySlug,
        clientId: getClientId(request)
      });

      if (!lobbyCreationResult.allowed) {
        sendRateLimitedBounce(
          response,
          buildGamePath(gameSlug),
          lobbyCreationResult.retryAfterMs || actionCooldownMs
        );
        return;
      }
    }

    const state = await activeStateStore.getState();

    if (gameSlug === "doom") {
      if (route === "home") {
        sendHtml(response, renderDoomHome(state, {
          defaultRedirectUrl,
          gameSlug,
          lobbySlug,
          actionCooldownMs
        }));
        return;
      }

      if (route === "state") {
        sendJson(response, normalizeDoomState(state));
        return;
      }

      if (route.endsWith("Image")) {
        sendSvg(response, renderDoomImage(route, normalizeDoomState(state)));
        return;
      }

      if (DOOM_ACTION_ROUTES.has(route)) {
        const fallbackLocation = resolveFallbackLocation(request, url, defaultRedirectUrl);

        if (rateLimiter && typeof rateLimiter.consume === "function") {
          const rateLimitResult = await rateLimiter.consume({
            action: getActionRateLimitKey(gameSlug, route),
            gameSlug,
            lobbySlug,
            clientId: getClientId(request)
          });

          if (!rateLimitResult.allowed) {
            sendRateLimitedBounce(response, fallbackLocation, rateLimitResult.retryAfterMs || actionCooldownMs);
            return;
          }
        }

        await activeStateStore.mutateState((current) => applyDoomAction(current, route));
        sendBackBounce(response, fallbackLocation);
        return;
      }
    }

    if (route === "home") {
      sendHtml(response, renderCookieHome(state, defaultRedirectUrl, gameSlug, lobbySlug, {
        isLegacyAlias,
        isDefaultLobbyAlias,
        actionCooldownMs
      }));
      return;
    }

    if (route === "state") {
      sendJson(response, state);
      return;
    }

    if (route === "counterImage") {
      sendSvg(response, svgStatCard({
        width: 330,
        height: 110,
        accent: "#f59e0b",
        icon: "cookie",
        label: "Cookies",
        value: formatCompactNumber(state.clicks)
      }));
      return;
    }

    if (route === "statusImage") {
      sendSvg(response, svgStatCard({
        width: 330,
        height: 110,
        accent: "#22c55e",
        icon: "power",
        label: "Clicks / tap",
        value: `+${formatCompactNumber(state.clickPower)}`
      }));
      return;
    }

    if (route === "upgradeImage") {
      sendSvg(response, svgUpgradePanel(state));
      return;
    }

    if (route === "click" || route === "upgrade") {
      const fallbackLocation = resolveFallbackLocation(request, url, defaultRedirectUrl);

      if (rateLimiter && typeof rateLimiter.consume === "function") {
        const rateLimitResult = await rateLimiter.consume({
          action: getActionRateLimitKey(gameSlug, route),
          gameSlug,
          lobbySlug,
          clientId: getClientId(request)
        });

        if (!rateLimitResult.allowed) {
          sendRateLimitedBounce(response, fallbackLocation, rateLimitResult.retryAfterMs || actionCooldownMs);
          return;
        }
      }

      await runCookieAction(route, activeStateStore);
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
