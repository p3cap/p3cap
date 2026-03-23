const fs = require("fs");
const path = require("path");

const formatter = new Intl.NumberFormat("en-US");
const COOKIE_IMAGE_PATH = path.join(__dirname, "assets", "cookie.gif");

function formatNumber(value) {
  return formatter.format(Math.max(0, Math.floor(value)));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function summarizeLastLog(message) {
  if (message.startsWith("Cookie clicked: +")) {
    return `Last hit ${message.replace("Cookie clicked: ", "")}`;
  }

  if (message.startsWith("Upgrade bought:")) {
    return "Upgrade purchased";
  }

  if (message.startsWith("Upgrade failed: need ")) {
    return message.replace("Upgrade failed: need ", "Need ");
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
  <text x="24" y="126" fill="#cbd5e1" font-size="18" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">Cost: ${escapeXml(formatNumber(state.upgradeCost))} cookies</text>
  <text x="24" y="154" fill="#cbd5e1" font-size="18" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">Current: +${escapeXml(String(state.clickPower))} per click</text>
  <text x="24" y="182" fill="#cbd5e1" font-size="18" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">Level: ${escapeXml(String(state.upgradeLevel))}</text>
  <text x="24" y="208" fill="#f59e0b" font-size="14" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">${escapeXml(summarizeLastLog(state.lastLog))}</text>
  <rect x="22" y="220" width="256" height="32" rx="16" fill="#f97316" />
  <text x="150" y="242" text-anchor="middle" fill="#fff7ed" font-size="20" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">BUY UPGRADE</text>
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

function resolveRedirect(url, defaultRedirectUrl) {
  const requested = url.searchParams.get("redirect");
  const candidate = requested || defaultRedirectUrl;

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

function getRequestUrl(request) {
  const requestUrl = request.originalUrl || request.url || "/";
  const host = request.headers.host || "localhost";
  const protocol = request.protocol || request.headers["x-forwarded-proto"] || "http";
  return new URL(requestUrl, `${protocol}://${host}`);
}

function renderHome(state, defaultRedirectUrl) {
  const hint = defaultRedirectUrl
    ? `Default redirect: <code>${escapeXml(defaultRedirectUrl)}</code>`
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
      <p>Endpoints: <code>/actions/click</code>, <code>/actions/upgrade</code>, <code>/images/counter.svg</code>, <code>/images/status.svg</code>, <code>/images/upgrade-button.svg</code>.</p>
    </main>
  </body>
</html>`;
}

function createRequestHandler({ stateStore, defaultRedirectUrl = "" }) {
  return async function handleRequest(request, response) {
    const url = getRequestUrl(request);

    if (request.method !== "GET") {
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method Not Allowed");
      return;
    }

    if (url.pathname === "/") {
      const state = await stateStore.getState();
      sendHtml(response, renderHome(state, defaultRedirectUrl));
      return;
    }

    if (url.pathname === "/api/state") {
      const state = await stateStore.getState();
      sendJson(response, state);
      return;
    }

    if (url.pathname === "/images/cookie.gif") {
      sendGif(response, fs.readFileSync(COOKIE_IMAGE_PATH));
      return;
    }

    if (url.pathname === "/images/counter.svg") {
      const state = await stateStore.getState();
      sendSvg(response, svgStatCard({
        width: 330,
        height: 110,
        accent: "#f59e0b",
        icon: "cookie",
        label: "Cookies",
        value: formatNumber(state.clicks)
      }));
      return;
    }

    if (url.pathname === "/images/status.svg") {
      const state = await stateStore.getState();
      sendSvg(response, svgStatCard({
        width: 330,
        height: 110,
        accent: "#22c55e",
        icon: "power",
        label: "Clicks / tap",
        value: `+${state.clickPower}`
      }));
      return;
    }

    if (url.pathname === "/images/upgrade-button.svg") {
      const state = await stateStore.getState();
      sendSvg(response, svgUpgradePanel(state));
      return;
    }

    if (url.pathname === "/actions/click") {
      if (typeof stateStore.click === "function") {
        await stateStore.click();
      } else {
        await stateStore.mutateState((current) => ({
          ...current,
          clicks: current.clicks + current.clickPower,
          lastLog: `Cookie clicked: +${current.clickPower}`
        }));
      }

      sendRedirect(response, resolveRedirect(url, defaultRedirectUrl));
      return;
    }

    if (url.pathname === "/actions/upgrade") {
      if (typeof stateStore.upgrade === "function") {
        await stateStore.upgrade();
      } else {
        await stateStore.mutateState((current) => {
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
            lastLog: `Upgrade bought: clicks now give +${current.clickPower + 1}`
          };
        });
      }

      sendRedirect(response, resolveRedirect(url, defaultRedirectUrl));
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  };
}

module.exports = {
  createRequestHandler
};
