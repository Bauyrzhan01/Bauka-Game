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
  }

  connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    this.ws = new WebSocket(`${proto}://${location.host}`);
    this.ws.onopen = () => {
      this.connected = true;
      this.game.onNetworkStatus("Подключено");
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.game.onNetworkStatus("Отключено");
    };
    this.ws.onerror = () => this.game.onNetworkStatus("Ошибка сети");
    this.ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
  }

  send(data) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(data));
  }

  createRoom(name) {
    this.send({ type: "create", name });
  }

  joinRoom(code, name) {
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
    this.ws?.close();
    this.ws = null;
    this.roomId = null;
    this.remotePlayers.clear();
  }
}
