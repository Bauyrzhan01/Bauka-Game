const http = require("http");
const path = require("path");
const express = require("express");
const { WebSocketServer } = require("ws");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const MAP = [
  "########################",
  "#..........#...........#",
  "#..####....#....####...#",
  "#..#..#....#....#..#...#",
  "#..####....#....####.A.#",
  "#..........#...........#",
  "#....#######...........#",
  "#....#.....#....####...#",
  "#....#.....#....#..#...#",
  "#....#######....####...#",
  "#......................#",
  "#.........######.......#",
  "#.........#....#.......#",
  "#...B.....#....#.......#",
  "#.........######.......#",
  "#......................#",
  "########################",
];

const SPAWNS = {
  t: { x: 3.5, y: 15.5 },
  ct: { x: 20.5, y: 2.5 },
};

function isWall(x, y) {
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (row < 0 || row >= MAP.length || col < 0 || col >= MAP[0].length) return true;
  return MAP[row][col] === "#";
}

function lineOfSight(x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(dist * 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const rooms = new Map();

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function broadcast(room, data, exceptWs = null) {
  for (const player of room.players.values()) {
    if (player.ws !== exceptWs) send(player.ws, data);
  }
}

function lobbyPayload(room) {
  return {
    type: "lobby",
    roomId: room.id,
    hostId: room.hostId,
    playing: room.playing,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      kills: p.kills,
      alive: p.alive,
    })),
  };
}

function statePayload(room) {
  return {
    type: "state",
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      x: p.x,
      y: p.y,
      angle: p.angle,
      health: p.health,
      alive: p.alive,
      kills: p.kills,
      weapon: p.weapon,
    })),
  };
}

function assignTeam(room) {
  const teams = [...room.players.values()].map((p) => p.team);
  const tCount = teams.filter((t) => t === "t").length;
  const ctCount = teams.filter((t) => t === "ct").length;
  return tCount <= ctCount ? "t" : "ct";
}

function spawnPlayer(player) {
  const spawn = player.team === "t" ? SPAWNS.t : SPAWNS.ct;
  player.x = spawn.x;
  player.y = spawn.y;
  player.angle = player.team === "t" ? -Math.PI / 2 : Math.PI / 2;
  player.health = 100;
  player.alive = true;
}

function getRoomByPlayer(ws) {
  for (const room of rooms.values()) {
    for (const player of room.players.values()) {
      if (player.ws === ws) return { room, player };
    }
  }
  return null;
}

function removePlayer(ws) {
  const found = getRoomByPlayer(ws);
  if (!found) return;
  const { room, player } = found;
  room.players.delete(player.id);
  if (room.hostId === player.id) {
    const next = room.players.values().next().value;
    room.hostId = next ? next.id : null;
  }
  if (room.players.size === 0) {
    rooms.delete(room.id);
    return;
  }
  broadcast(room, lobbyPayload(room));
  if (room.playing) broadcast(room, statePayload(room));
}

function handleShoot(room, shooter, angle) {
  if (!room.playing || !shooter.alive) return;
  let best = null;
  let bestDist = 50;

  for (const target of room.players.values()) {
    if (target.id === shooter.id || !target.alive) continue;
    const dx = target.x - shooter.x;
    const dy = target.y - shooter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 50) continue;
    const aim = Math.atan2(dy, dx);
    let diff = aim - angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    if (Math.abs(diff) > 0.14) continue;
    if (!lineOfSight(shooter.x, shooter.y, target.x, target.y)) continue;
    if (dist < bestDist) {
      best = target;
      bestDist = dist;
    }
  }

  if (!best) return;

  const damage = 36;
  best.health -= damage;
  if (best.health <= 0) {
    best.alive = false;
    shooter.kills += 1;
    broadcast(room, {
      type: "kill",
      killerId: shooter.id,
      killerName: shooter.name,
      targetId: best.id,
      targetName: best.name,
    });
    setTimeout(() => {
      if (!rooms.has(room.id)) return;
      spawnPlayer(best);
      broadcast(room, statePayload(room));
    }, 3000);
  }
  broadcast(room, statePayload(room));
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "create") {
      const id = randomUUID();
      const code = makeRoomCode();
      const room = {
        id: code,
        hostId: id,
        playing: false,
        players: new Map(),
      };
      const player = {
        id,
        ws,
        name: (msg.name || "Игрок").slice(0, 16),
        team: "t",
        x: SPAWNS.t.x,
        y: SPAWNS.t.y,
        angle: -Math.PI / 2,
        health: 100,
        alive: true,
        kills: 0,
        weapon: "glock",
      };
      room.players.set(id, player);
      rooms.set(code, room);
      send(ws, { type: "created", roomId: code, playerId: id, team: player.team });
      send(ws, lobbyPayload(room));
      return;
    }

    if (msg.type === "join") {
      const room = rooms.get((msg.roomId || "").toUpperCase());
      if (!room) {
        send(ws, { type: "error", message: "Комната не найдена" });
        return;
      }
      if (room.playing) {
        send(ws, { type: "error", message: "Игра уже идёт" });
        return;
      }
      if (room.players.size >= 8) {
        send(ws, { type: "error", message: "Комната полна" });
        return;
      }
      const id = randomUUID();
      const team = assignTeam(room);
      const spawn = team === "t" ? SPAWNS.t : SPAWNS.ct;
      const player = {
        id,
        ws,
        name: (msg.name || "Игрок").slice(0, 16),
        team,
        x: spawn.x,
        y: spawn.y,
        angle: team === "t" ? -Math.PI / 2 : Math.PI / 2,
        health: 100,
        alive: true,
        kills: 0,
        weapon: "glock",
      };
      room.players.set(id, player);
      send(ws, { type: "joined", roomId: room.id, playerId: id, team: player.team });
      broadcast(room, lobbyPayload(room));
      return;
    }

    const found = getRoomByPlayer(ws);
    if (!found) return;
    const { room, player } = found;

    if (msg.type === "start") {
      if (room.hostId !== player.id) return;
      if (room.players.size < 2) {
        send(ws, { type: "error", message: "Нужно минимум 2 игрока" });
        return;
      }
      room.playing = true;
      for (const p of room.players.values()) spawnPlayer(p);
      broadcast(room, { type: "game_start" });
      broadcast(room, statePayload(room));
      return;
    }

    if (!room.playing) return;

    if (msg.type === "input") {
      if (!player.alive) return;
      player.x = msg.x;
      player.y = msg.y;
      player.angle = msg.angle;
      player.weapon = msg.weapon || player.weapon;
      return;
    }

    if (msg.type === "shoot") {
      handleShoot(room, player, msg.angle);
    }
  });

  ws.on("close", () => removePlayer(ws));
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.playing && room.players.size > 0) {
      broadcast(room, statePayload(room));
    }
  }
}, 50);

server.listen(PORT, () => {
  console.log(`Bauka Game: http://localhost:${PORT}`);
});
