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

function svgHudCard({ width, height, accent, label, value, subvalue, badge }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="panel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111827" />
      <stop offset="100%" stop-color="#030712" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accent}" />
      <stop offset="100%" stop-color="#fde68a" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="28" fill="#020617" />
  <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="22" fill="url(#panel)" stroke="#243041" stroke-width="2" />
  <rect x="24" y="24" width="${width - 48}" height="7" rx="4" fill="url(#accent)" />
  <text x="34" y="58" fill="#94a3b8" font-size="17" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif" letter-spacing="2.5">${escapeXml(label.toUpperCase())}</text>
  <text x="34" y="116" fill="#f8fafc" font-size="48" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">${escapeXml(value)}</text>
  <text x="34" y="${height - 24}" fill="#cbd5e1" font-size="16" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">${escapeXml(subvalue)}</text>
  <rect x="${width - 228}" y="${height - 48}" width="194" height="28" rx="14" fill="#0f172a" stroke="${accent}" stroke-opacity="0.5" />
  <text x="${width - 212}" y="${height - 29}" fill="#f8fafc" font-size="15" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">${escapeXml(badge)}</text>
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
  <rect width="${width}" height="${height}" rx="26" fill="#1f2937" />
  <rect x="6" y="6" width="${width - 12}" height="${height - 12}" rx="20" fill="url(#buttonBg)" />
  <rect x="12" y="12" width="${width - 24}" height="${height - 24}" rx="16" fill="none" stroke="#fff7ed" stroke-opacity="0.35" />
  <text x="50%" y="37" text-anchor="middle" fill="#fff7ed" font-size="15" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif" letter-spacing="2">UPGRADE SHOP</text>
  <text x="50%" y="69" text-anchor="middle" fill="#fff7ed" font-size="28" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">${escapeXml(title)}</text>
  <text x="50%" y="95" text-anchor="middle" fill="#ffedd5" font-size="18" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">${escapeXml(value)}</text>
</svg>`;
}

function svgClickHint(clickPower) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="92" viewBox="0 0 420 92" role="img" aria-label="Tap the cookie">
  <defs>
    <linearGradient id="hintBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
  </defs>
  <rect width="420" height="92" rx="24" fill="#020617" />
  <rect x="5" y="5" width="410" height="82" rx="19" fill="url(#hintBg)" stroke="#7dd3fc" stroke-opacity="0.4" />
  <text x="28" y="34" fill="#bfdbfe" font-size="15" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif" letter-spacing="2">MAIN ACTION</text>
  <text x="28" y="64" fill="#f8fafc" font-size="30" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">TAP THE COOKIE</text>
  <rect x="280" y="26" width="110" height="36" rx="18" fill="#0f172a" stroke="#fde68a" stroke-opacity="0.55" />
  <text x="335" y="49" text-anchor="middle" fill="#fef3c7" font-size="17" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">+${escapeXml(String(clickPower))} / tap</text>
</svg>`;
}

function svgActionChip(message) {
  const safeMessage = escapeXml(message.length > 44 ? `${message.slice(0, 41)}...` : message);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="680" height="70" viewBox="0 0 680 70" role="img" aria-label="Last action">
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
  <rect width="680" height="70" rx="22" fill="#020617" />
  <rect x="5" y="5" width="670" height="60" rx="17" fill="url(#bg)" stroke="#1f2937" />
  <rect x="18" y="18" width="124" height="34" rx="17" fill="#0f172a" stroke="url(#accent)" />
  <text x="80" y="39" text-anchor="middle" fill="#e0f2fe" font-size="16" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif" letter-spacing="1.5">LAST ACTION</text>
  <text x="160" y="43" fill="#f8fafc" font-size="19" font-weight="700" font-family="'Trebuchet MS', 'Segoe UI', Arial, sans-serif">${safeMessage}</text>
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
      <p>Endpoints: <code>/actions/click</code>, <code>/actions/upgrade</code>, <code>/images/click-hint.svg</code>, <code>/images/counter.svg</code>, <code>/images/status.svg</code>, <code>/images/upgrade-button.svg</code>, <code>/images/log.svg</code>.</p>
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
      sendSvg(response, svgHudCard({
        width: 680,
        height: 150,
        accent: "#f59e0b",
        label: "Cookie Jar",
        value: formatNumber(state.clicks),
        subvalue: `refresh after redirect to pull the newest image`,
        badge: `Updated ${formatTimestamp(state.updatedAt)}`
      }));
      return;
    }

    if (url.pathname === "/images/status.svg") {
      const state = await stateStore.getState();
      sendSvg(response, svgHudCard({
        width: 680,
        height: 150,
        accent: "#22c55e",
        label: "Upgrade HUD",
        value: `+${state.clickPower} tap  |  ${formatNumber(state.upgradeCost)} cost`,
        subvalue: `upgrade level ${state.upgradeLevel}`,
        badge: summarizeLastLog(state.lastLog)
      }));
      return;
    }

    if (url.pathname === "/images/upgrade-button.svg") {
      const state = await stateStore.getState();
      sendSvg(response, svgButton({
        width: 360,
        height: 110,
        accent: "#ea580c",
        title: "+1 click power",
        value: `${formatNumber(state.upgradeCost)} cookies`
      }));
      return;
    }

    if (url.pathname === "/images/click-hint.svg") {
      const state = await stateStore.getState();
      sendSvg(response, svgClickHint(state.clickPower));
      return;
    }

    if (url.pathname === "/images/log.svg") {
      const state = await stateStore.getState();
      sendSvg(response, svgActionChip(state.lastLog));
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
