const fs = require("fs");
const path = require("path");
const { createFileStateStore, createRedisStateStore } = require("../../state-store");

const slug = "cookieclicker";
const formatter = new Intl.NumberFormat("en-US");
const COOKIE_IMAGE_PATH = path.join(__dirname, "..", "..", "assets", "cookie.gif");

const routeMap = new Map([
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

const actionRoutes = new Set(["click", "upgrade"]);

const initialState = {
  clicks: 0,
  clickPower: 1,
  upgradeLevel: 0,
  upgradeCost: 10,
  lastLog: "Cookie shop ready.",
  updatedAt: new Date().toISOString()
};

let cookieImageCache = null;

function buildLobbyPath(gameSlug, lobbySlug, suffix = "") {
  return `/${gameSlug}/${lobbySlug}${suffix}`;
}

function formatSlugLabel(gameSlug) {
  return String(gameSlug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatExactNumber(value) {
  return formatter.format(Math.max(0, Math.floor(Number(value) || 0)));
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

function calculateUpgradeCost(upgradeLevel) {
  return 10 * Math.pow(2, upgradeLevel);
}

function createFreshState() {
  return {
    ...initialState,
    updatedAt: new Date().toISOString()
  };
}

function normalizeState(state) {
  const source = state || {};
  const upgradeLevel = Number.isFinite(Number(source.upgradeLevel))
    ? Math.max(0, Math.floor(Number(source.upgradeLevel)))
    : 0;
  const clickPower = Number.isFinite(Number(source.clickPower))
    ? Math.max(1, Math.floor(Number(source.clickPower)))
    : upgradeLevel + 1;
  const clicks = Number.isFinite(Number(source.clicks))
    ? Math.max(0, Math.floor(Number(source.clicks)))
    : 0;

  return {
    clicks,
    clickPower,
    upgradeLevel,
    upgradeCost: calculateUpgradeCost(upgradeLevel),
    lastLog: typeof source.lastLog === "string" && source.lastLog.trim()
      ? source.lastLog.trim()
      : initialState.lastLog,
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt.trim()
      ? source.updatedAt.trim()
      : new Date().toISOString()
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

function getCookieImage() {
  if (!cookieImageCache) {
    cookieImageCache = fs.readFileSync(COOKIE_IMAGE_PATH);
  }

  return cookieImageCache;
}

function routeNeedsState(route) {
  return route !== "cookieImage";
}

function getRateLimitAction(route) {
  return route;
}

function renderHome(state, { defaultRedirectUrl = "", gameSlug, lobbySlug, actionCooldownMs = 0, isLegacyAlias = false, isDefaultLobbyAlias = false }) {
  const gameLabel = formatSlugLabel(gameSlug);
  const canonicalLobbyPath = buildLobbyPath(gameSlug, lobbySlug);
  const hint = defaultRedirectUrl
    ? `Default redirect target: <code>${escapeXml(defaultRedirectUrl)}</code>`
    : "Set README_REDIRECT_URL to send action routes straight back to GitHub.";
  const aliasHint = isLegacyAlias || isDefaultLobbyAlias
    ? `<p><strong>Canonical lobby path:</strong> <code>${escapeXml(canonicalLobbyPath)}</code></p>`
    : "";
  const spamHint = actionCooldownMs
    ? `<p><strong>Anonymous anti-spam:</strong> about one action every ${escapeXml((actionCooldownMs / 1000).toFixed(actionCooldownMs < 1000 ? 1 : 0))}s per IP, per game.</p>`
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
      <p>This server powers interactive GitHub README games by storing per-lobby state, serving dynamic SVGs, and immediately redirecting back after every action.</p>
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

function renderImage(route, state) {
  if (route === "cookieImage") {
    return {
      type: "gif",
      body: getCookieImage()
    };
  }

  if (route === "counterImage") {
    return {
      type: "svg",
      body: svgStatCard({
        width: 330,
        height: 110,
        accent: "#f59e0b",
        icon: "cookie",
        label: "Cookies",
        value: formatCompactNumber(state.clicks)
      })
    };
  }

  if (route === "statusImage") {
    return {
      type: "svg",
      body: svgStatCard({
        width: 330,
        height: 110,
        accent: "#22c55e",
        icon: "power",
        label: "Clicks / tap",
        value: `+${formatCompactNumber(state.clickPower)}`
      })
    };
  }

  return {
    type: "svg",
    body: svgUpgradePanel(state)
  };
}

async function runAction(route, stateStore) {
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

function createFileBackedStateStore({ filePath }) {
  return createFileStateStore({ filePath });
}

function createRedisBackedStateStore({ redis, key }) {
  return createRedisStateStore({ redis, key });
}

module.exports = {
  slug,
  routeMap,
  actionRoutes,
  createFreshState,
  normalizeState,
  routeNeedsState,
  getRateLimitAction,
  renderHome,
  renderImage,
  runAction,
  createFileStateStore: createFileBackedStateStore,
  createRedisStateStore: createRedisBackedStateStore
};
