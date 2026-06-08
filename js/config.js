// После деплоя сервера на Render URL будет таким (имя сервиса: bauka-game)
export const PRODUCTION_WS = "wss://bauka-game.onrender.com";

export function getWsUrl() {
  const host = location.hostname;
  const isLocal = host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host);

  if (isLocal) {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}`;
  }

  return PRODUCTION_WS;
}

export function getShareLink() {
  if (location.hostname.includes("github.io")) {
    return location.href.split("?")[0];
  }
  return "https://bauyrzhan01.github.io/Bauka-Game/";
}
