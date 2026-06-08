const GITHUB_PAGE = "https://bauyrzhan01.github.io/Bauka-Game/";

export function parseServerParam(value) {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) return trimmed;
  if (trimmed.startsWith("http://")) return `ws://${trimmed.slice(7)}`;
  if (trimmed.startsWith("https://")) return `wss://${trimmed.slice(8)}`;
  const isIp = /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(trimmed) || trimmed.startsWith("localhost");
  return `${isIp ? "ws" : "wss"}://${trimmed}`;
}

export function getWsUrl() {
  const params = new URLSearchParams(location.search);
  const fromUrl = parseServerParam(params.get("server"));
  if (fromUrl) {
    localStorage.setItem("game-server", fromUrl);
    return fromUrl;
  }

  const host = location.hostname;
  const onLaptopServer =
    host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.endsWith(".loca.lt");

  if (onLaptopServer) {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}`;
  }

  const saved = localStorage.getItem("game-server");
  if (saved) return saved;

  return null;
}

export function getShareLink(serverHost) {
  if (serverHost) return `http://${serverHost}`;
  const host = location.hostname;
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return `${location.protocol}//${location.host}`;
  }
  return GITHUB_PAGE;
}

export function getGithubLinkWithServer(serverHost) {
  const base = GITHUB_PAGE.split("?")[0];
  if (!serverHost) return base;
  return `${base}?server=${encodeURIComponent(serverHost)}`;
}
