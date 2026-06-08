import { getWsUrl, parseServerParam } from "./config.js";

export class Network {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.roomId = null;
    this.playerId = null;
    this.team = "t";
    this.remotePlayers = new Map();
    this.connected = false;
    this.isHost = false;
    this.lastSend = 0;
    this.wsUrl = getWsUrl();
    this.reconnectTimer = null;
    if (this.wsUrl) this.connect();
  }

  setServer(value) {
    const url = parseServerParam(value);
    if (!url) return false;
    localStorage.setItem("game-server", url);
    this.wsUrl = url;
    this.disconnect();
    this.connect();
    return true;
  }

  connect() {
    if (!this.wsUrl) {
      this.game.onNetworkStatus("Укажи IP ноутбука хоста");
      this.game.showServerSetup(true);
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.game.onNetworkStatus("Подключение к серверу...");
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.connected = true;
      this.game.showServerSetup(false);
      this.game.onNetworkStatus("Сервер подключён");
      if (this.roomId) this.game.onNetworkStatus(`Комната ${this.roomId}`);
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.game.onNetworkStatus("Сервер недоступен — переподключение...");
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this.game.onNetworkStatus("Не удалось подключиться. Проверь IP и npm start");
    };

    this.ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
  }

  send(data) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(data));
  }

  createRoom(name) {
    if (!this.connected) {
      this.game.onNetworkError("Сначала подключись к серверу");
      return;
    }
    this.send({ type: "create", name });
  }

  joinRoom(code, name) {
    if (!this.connected) {
      this.game.onNetworkError("Сначала подключись к серверу");
      return;
    }
    this.send({ type: "join", roomId: code.toUpperCase(), name });
  }

  startGame() {
    this.send({ type: "start" });
  }

  sendInput(player) {
    const now = performance.now();
    if (now - this.lastSend < 50) return;
    this.lastSend = now;
    this.send({
      type: "input",
      x: player.x,
      y: player.y,
      angle: player.angle,
      weapon: player.weapon.id,
    });
  }

  sendShoot(angle) {
    this.send({ type: "shoot", angle });
  }

  onMessage(msg) {
    switch (msg.type) {
      case "created":
        this.roomId = msg.roomId;
        this.playerId = msg.playerId;
        this.team = msg.team;
        this.isHost = true;
        this.game.onRoomJoined(msg);
        break;
      case "joined":
        this.roomId = msg.roomId;
        this.playerId = msg.playerId;
        this.team = msg.team;
        this.isHost = false;
        this.game.onRoomJoined(msg);
        break;
      case "lobby":
        this.game.onLobbyUpdate(msg);
        break;
      case "game_start":
        this.game.startOnlineMatch();
        break;
      case "state":
        this.remotePlayers.clear();
        for (const p of msg.players) {
          if (p.id === this.playerId) {
            this.game.applyServerPlayerState(p);
            continue;
          }
          this.remotePlayers.set(p.id, p);
        }
        break;
      case "kill":
        this.game.onKillFeed(msg);
        break;
      case "error":
        this.game.onNetworkError(msg.message);
        break;
    }
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.roomId = null;
    this.playerId = null;
    this.remotePlayers.clear();
  }
}
