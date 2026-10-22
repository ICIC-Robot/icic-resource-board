// Public configuration only. Never place passwords, tokens, or SSH keys here.
window.ICIC_BOARD_CONFIG = {
  apiUrl: "https://api.github.com/repos/ICIC-Robot/icic-resource-board/contents/status.json?ref=data",
  refreshMs: 60000,  // conditional requests: unchanged snapshots (304) cost no rate limit
  staleAfterMs: 15 * 60 * 1000,
  timeZone: "America/New_York"
};
