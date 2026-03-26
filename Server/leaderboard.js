function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatGameLabel(gameSlug) {
  return String(gameSlug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeTopCount(value) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.max(1, Math.min(20, parsed));
}

function renderPanel(entry, y, highlighted = false) {
  const fill = highlighted ? "#2a180f" : "#17100d";
  const stroke = highlighted ? "#f59e0b" : "#4a2317";
  const badgeFill = highlighted ? "#f59e0b" : "#472116";
  const scoreColor = highlighted ? "#fde68a" : "#f8fafc";

  return `
  <g transform="translate(24 ${y})">
    <rect width="672" height="72" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="4" />
    <rect x="18" y="16" width="68" height="40" rx="14" fill="${badgeFill}" />
    <text x="52" y="42" text-anchor="middle" fill="#fff7ed" font-size="22" font-family="'Courier New', monospace">#${escapeXml(String(entry.rank))}</text>
    <text x="108" y="34" fill="#fca5a5" font-size="14" font-family="'Courier New', monospace">LOBBY</text>
    <text x="108" y="55" fill="#f8fafc" font-size="24" font-family="'Courier New', monospace">${escapeXml(entry.lobbySlug)}</text>
    <text x="640" y="34" text-anchor="end" fill="#9ca3af" font-size="13" font-family="'Courier New', monospace">BEST SCORE</text>
    <text x="640" y="58" text-anchor="end" fill="${scoreColor}" font-size="26" font-family="'Courier New', monospace">${escapeXml(String(entry.bestScore))}</text>
  </g>`;
}

function renderLeaderboardSvg({ gameSlug, entries, topCount, highlightLobby = "" }) {
  const visibleEntries = entries.slice(0, topCount);
  const highlightedEntry = highlightLobby
    ? entries.find((entry) => entry.lobbySlug === highlightLobby) || null
    : null;
  const visibleLobbySet = new Set(visibleEntries.map((entry) => entry.lobbySlug));
  const extraHighlightedEntry = highlightedEntry && !visibleLobbySet.has(highlightedEntry.lobbySlug)
    ? highlightedEntry
    : null;
  const panelCount = visibleEntries.length + (extraHighlightedEntry ? 1 : 0);
  const height = Math.max(200, 116 + (panelCount * 86));
  const listMarkup = visibleEntries
    .map((entry, index) => renderPanel(entry, 92 + (index * 86), entry.lobbySlug === highlightLobby))
    .join("");
  const extraPanelMarkup = extraHighlightedEntry
    ? `
  <text x="36" y="${110 + (visibleEntries.length * 86)}" fill="#9ca3af" font-size="14" font-family="'Courier New', monospace">YOUR LOBBY</text>
  ${renderPanel(extraHighlightedEntry, 122 + (visibleEntries.length * 86), true)}`
    : "";
  const emptyMarkup = panelCount === 0
    ? `
  <rect x="24" y="92" width="672" height="72" rx="18" fill="#17100d" stroke="#4a2317" stroke-width="4" />
  <text x="360" y="136" text-anchor="middle" fill="#f8fafc" font-size="22" font-family="'Courier New', monospace">No scores yet for ${escapeXml(formatGameLabel(gameSlug))}</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="${height}" viewBox="0 0 720 ${height}" role="img" aria-label="${escapeXml(formatGameLabel(gameSlug))} leaderboard">
  <rect width="720" height="${height}" fill="#090607" />
  <rect x="10" y="10" width="700" height="${height - 20}" fill="#140807" stroke="#4a2317" stroke-width="8" />
  <text x="36" y="48" fill="#fca5a5" font-size="24" font-family="'Courier New', monospace">${escapeXml(formatGameLabel(gameSlug))} LEADERBOARD</text>
  <text x="684" y="48" text-anchor="end" fill="#fde68a" font-size="16" font-family="'Courier New', monospace">TOP ${escapeXml(String(topCount))}</text>
  <text x="36" y="74" fill="#9ca3af" font-size="14" font-family="'Courier New', monospace">Best score by lobby. Query params: top, lobby</text>
  ${emptyMarkup}
  ${listMarkup}
  ${extraPanelMarkup}
</svg>`;
}

module.exports = {
  normalizeTopCount,
  renderLeaderboardSvg
};
