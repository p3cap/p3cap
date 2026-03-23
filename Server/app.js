const formatter = new Intl.NumberFormat("en-US");

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

function formatTimestamp(value) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
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

function svgStatCard({ width, height, accent, icon, label, value }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="panel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111827" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accent}" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="22" fill="#020617" />
  <rect x="6" y="6" width="${width - 12}" height="${height - 12}" rx="16" fill="url(#panel)" stroke="#233044" stroke-width="2" />
  <rect x="18" y="18" width="${width - 36}" height="6" rx="3" fill="url(#accent)" />
  <text x="26" y="54" fill="#f8fafc" font-size="26" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI Emoji', 'Segoe UI', Arial, sans-serif">${escapeXml(icon)}</text>
  <text x="62" y="54" fill="#94a3b8" font-size="16" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif" letter-spacing="1.8">${escapeXml(label.toUpperCase())}</text>
  <text x="26" y="96" fill="#f8fafc" font-size="38" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">${escapeXml(value)}</text>
</svg>`;
}

function svgUpgradePanel(state) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="270" viewBox="0 0 300 270" role="img" aria-label="Upgrade sidebar">
  <defs>
    <linearGradient id="buttonBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f97316" />
      <stop offset="100%" stop-color="#7c2d12" />
    </linearGradient>
  </defs>
  <rect width="300" height="270" rx="28" fill="#020617" />
  <rect x="8" y="8" width="284" height="254" rx="22" fill="#111827" stroke="#263343" stroke-width="2" />
  <rect x="20" y="20" width="260" height="8" rx="4" fill="url(#buttonBg)" />
  <text x="28" y="54" fill="#fdba74" font-size="16" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif" letter-spacing="2">UPGRADES</text>
  <text x="28" y="92" fill="#f8fafc" font-size="30" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">+1 click power</text>
  <text x="28" y="132" fill="#cbd5e1" font-size="18" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">Cost: ${escapeXml(formatNumber(state.upgradeCost))} cookies</text>
  <text x="28" y="160" fill="#cbd5e1" font-size="18" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">Current: +${escapeXml(String(state.clickPower))} per click</text>
  <text x="28" y="188" fill="#cbd5e1" font-size="18" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">Level: ${escapeXml(String(state.upgradeLevel))}</text>
  <rect x="22" y="208" width="256" height="40" rx="20" fill="url(#buttonBg)" />
  <text x="150" y="234" text-anchor="middle" fill="#fff7ed" font-size="22" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">BUY UPGRADE</text>
  <text x="28" y="202" fill="#fef3c7" font-size="14" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">${escapeXml(summarizeLastLog(state.lastLog))}</text>
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

    if (url.pathname === "/images/counter.svg") {
      const state = await stateStore.getState();
      sendSvg(response, svgStatCard({
        width: 330,
        height: 110,
        accent: "#f59e0b",
        icon: "🍪",
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
        icon: "⚡",
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
