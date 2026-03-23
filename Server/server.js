const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_REDIRECT_URL = process.env.README_REDIRECT_URL || "";
const STATE_FILE = process.env.STATE_FILE || path.join(__dirname, "data", "state.json");

const formatter = new Intl.NumberFormat("en-US");
const initialState = {
  clicks: 0,
  clickPower: 1,
  upgradeLevel: 0,
  upgradeCost: 10,
  lastLog: "Cookie shop ready.",
  updatedAt: new Date().toISOString()
};

let cachedState = null;
let mutationQueue = Promise.resolve();

function formatNumber(value) {
  return formatter.format(Math.max(0, Math.floor(value)));
}

function calculateUpgradeCost(upgradeLevel) {
  return 10 * Math.pow(2, upgradeLevel);
}

function normalizeState(state) {
  const upgradeLevel = Number.isFinite(Number(state.upgradeLevel))
    ? Math.max(0, Math.floor(Number(state.upgradeLevel)))
    : 0;
  const clickPower = Number.isFinite(Number(state.clickPower))
    ? Math.max(1, Math.floor(Number(state.clickPower)))
    : upgradeLevel + 1;
  const clicks = Number.isFinite(Number(state.clicks))
    ? Math.max(0, Math.floor(Number(state.clicks)))
    : 0;

  return {
    clicks,
    clickPower,
    upgradeLevel,
    upgradeCost: calculateUpgradeCost(upgradeLevel),
    lastLog: typeof state.lastLog === "string" && state.lastLog.trim()
      ? state.lastLog.trim()
      : initialState.lastLog,
    updatedAt: typeof state.updatedAt === "string" && state.updatedAt.trim()
      ? state.updatedAt.trim()
      : new Date().toISOString()
  };
}

async function ensureStateFile() {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });

  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const state = normalizeState(parsed);
    cachedState = state;
    return state;
  } catch (error) {
    const state = normalizeState(initialState);
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
    cachedState = state;
    return state;
  }
}

async function getState() {
  if (cachedState) {
    return cachedState;
  }

  return ensureStateFile();
}

async function saveState(state) {
  const normalized = normalizeState(state);
  cachedState = normalized;
  await fs.writeFile(STATE_FILE, JSON.stringify(normalized, null, 2));
  return normalized;
}

function mutateState(mutator) {
  const task = mutationQueue.catch(() => undefined).then(async () => {
    const current = await getState();
    const next = await mutator({ ...current });
    return saveState({
      ...next,
      updatedAt: new Date().toISOString()
    });
  });

  mutationQueue = task.then(() => undefined, () => undefined);
  return task;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function svgCard({ width, height, accent, title, value, subtitle }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#111827" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accent}" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="24" fill="url(#bg)" />
  <rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="18" fill="#111827" stroke="#1f2937" />
  <rect x="16" y="16" width="${width - 32}" height="8" rx="4" fill="url(#accent)" />
  <text x="32" y="56" fill="#94a3b8" font-size="20" font-family="'Segoe UI', Arial, sans-serif" letter-spacing="2">${escapeXml(title.toUpperCase())}</text>
  <text x="32" y="112" fill="#f8fafc" font-size="44" font-weight="700" font-family="'Segoe UI', Arial, sans-serif">${escapeXml(value)}</text>
  <text x="32" y="${height - 28}" fill="#cbd5e1" font-size="20" font-family="'Segoe UI', Arial, sans-serif">${escapeXml(subtitle)}</text>
</svg>`;
}

function svgButton({ width, height, accent, title, value }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="buttonBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accent}" />
      <stop offset="100%" stop-color="#7c2d12" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="24" fill="url(#buttonBg)" />
  <rect x="5" y="5" width="${width - 10}" height="${height - 10}" rx="19" fill="none" stroke="#fff7ed" stroke-opacity="0.35" />
  <text x="50%" y="40" text-anchor="middle" fill="#fff7ed" font-size="28" font-weight="700" font-family="'Segoe UI', Arial, sans-serif">${escapeXml(title)}</text>
  <text x="50%" y="76" text-anchor="middle" fill="#ffedd5" font-size="22" font-family="'Segoe UI', Arial, sans-serif">${escapeXml(value)}</text>
</svg>`;
}

function svgLogCard(message) {
  const safeMessage = escapeXml(message.length > 64 ? `${message.slice(0, 61)}...` : message);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="160" viewBox="0 0 680 160" role="img" aria-label="Last log">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#111827" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#e0f2fe" />
    </linearGradient>
  </defs>
  <rect width="680" height="160" rx="24" fill="url(#bg)" />
  <rect x="16" y="16" width="648" height="128" rx="18" fill="#111827" stroke="#1f2937" />
  <rect x="16" y="16" width="648" height="8" rx="4" fill="url(#accent)" />
  <text x="32" y="56" fill="#94a3b8" font-size="20" font-family="'Segoe UI', Arial, sans-serif" letter-spacing="2">LAST LOG</text>
  <text x="32" y="98" fill="#f8fafc" font-size="28" font-weight="700" font-family="'Segoe UI', Arial, sans-serif">${safeMessage}</text>
  <text x="32" y="132" fill="#cbd5e1" font-size="20" font-family="'Segoe UI', Arial, sans-serif">Refresh GitHub after the redirect to request the newest cards.</text>
</svg>`;
}

function sendSvg(response, svg) {
  response.writeHead(200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0"
  });
  response.end(svg);
}

function sendJson(response, data) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
  });
  response.end(JSON.stringify(data, null, 2));
}

function sendHtml(response, html) {
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
  });
  response.end(html);
}

function sendRedirect(response, location) {
  response.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
  });
  response.end();
}

function resolveRedirect(url) {
  const requested = url.searchParams.get("redirect");
  const candidate = requested || DEFAULT_REDIRECT_URL;

  if (!candidate) {
    return "/";
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch (error) {
    return "/";
  }

  return "/";
}

function renderHome(state) {
  const hint = DEFAULT_REDIRECT_URL
    ? `Default redirect: <code>${escapeXml(DEFAULT_REDIRECT_URL)}</code>`
    : "Set README_REDIRECT_URL to make action routes bounce back to GitHub automatically.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>README Cookie Backend</title>
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
        width: min(720px, calc(100vw - 32px));
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
      <h1>README Cookie Backend</h1>
      <p>This server powers an interactive GitHub README by storing clicks, serving dynamic SVGs, and redirecting back to GitHub after every action.</p>
      <p><strong>Clicks:</strong> ${escapeXml(formatNumber(state.clicks))}</p>
      <p><strong>Power:</strong> +${escapeXml(String(state.clickPower))} per click</p>
      <p><strong>Next upgrade:</strong> ${escapeXml(formatNumber(state.upgradeCost))}</p>
      <p><strong>Last log:</strong> ${escapeXml(state.lastLog)}</p>
      <p>${hint}</p>
      <p>Endpoints: <code>/actions/click</code>, <code>/actions/upgrade</code>, <code>/images/counter.svg</code>, <code>/images/status.svg</code>, <code>/images/upgrade-button.svg</code>, <code>/images/log.svg</code>.</p>
    </main>
  </body>
</html>`;
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const state = await getState();

  if (request.method !== "GET") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method Not Allowed");
    return;
  }

  if (url.pathname === "/") {
    sendHtml(response, renderHome(state));
    return;
  }

  if (url.pathname === "/api/state") {
    sendJson(response, state);
    return;
  }

  if (url.pathname === "/images/counter.svg") {
    sendSvg(response, svgCard({
      width: 680,
      height: 160,
      accent: "#f59e0b",
      title: "Cookies",
      value: formatNumber(state.clicks),
      subtitle: `Updated ${new Date(state.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
    }));
    return;
  }

  if (url.pathname === "/images/status.svg") {
    sendSvg(response, svgCard({
      width: 680,
      height: 160,
      accent: "#22c55e",
      title: "Upgrade Stats",
      value: `+${state.clickPower} per tap | ${formatNumber(state.upgradeCost)} cost`,
      subtitle: `Upgrade level ${state.upgradeLevel}`
    }));
    return;
  }

  if (url.pathname === "/images/upgrade-button.svg") {
    sendSvg(response, svgButton({
      width: 360,
      height: 96,
      accent: "#ea580c",
      title: "Upgrade +1",
      value: `${formatNumber(state.upgradeCost)} cookies`
    }));
    return;
  }

  if (url.pathname === "/images/log.svg") {
    sendSvg(response, svgLogCard(state.lastLog));
    return;
  }

  if (url.pathname === "/actions/click") {
    await mutateState((current) => ({
      ...current,
      clicks: current.clicks + current.clickPower,
      lastLog: `Cookie clicked: +${current.clickPower}`
    }));
    sendRedirect(response, resolveRedirect(url));
    return;
  }

  if (url.pathname === "/actions/upgrade") {
    await mutateState((current) => {
      if (current.clicks < current.upgradeCost) {
        return {
          ...current,
          lastLog: `Upgrade failed: need ${formatNumber(current.upgradeCost - current.clicks)} more`
        };
      }

      const upgradeLevel = current.upgradeLevel + 1;
      return {
        ...current,
        clicks: current.clicks - current.upgradeCost,
        clickPower: current.clickPower + 1,
        upgradeLevel,
        upgradeCost: calculateUpgradeCost(upgradeLevel),
        lastLog: `Upgrade bought: clicks now give +${current.clickPower + 1}`
      };
    });

    sendRedirect(response, resolveRedirect(url));
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found");
}

async function main() {
  await ensureStateFile();

  const server = http.createServer((request, response) => {
    route(request, response).catch((error) => {
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
