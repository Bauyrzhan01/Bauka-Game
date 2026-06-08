import { TILE, MAP, MAP_H, MAP_W, isWall } from "./map.js";

const WALL_COLORS = {
  "#": { top: "#c4a574", side: "#8b7355", dark: "#6b5a45" },
  ".": { top: "#3d4a3a", side: "#2a3328", dark: "#1e261c" },
  A: { top: "#d4a84b", side: "#a07830", dark: "#705020" },
  B: { top: "#d4a84b", side: "#a07830", dark: "#705020" },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = 960;
    this.height = 540;
    this.fov = Math.PI / 3;
    this.resize();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  castRay(px, py, angle) {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    let mapX = Math.floor(px);
    let mapY = Math.floor(py);

    const deltaDistX = Math.abs(1 / (cos || 1e-6));
    const deltaDistY = Math.abs(1 / (sin || 1e-6));

    let stepX;
    let stepY;
    let sideDistX;
    let sideDistY;

    if (cos < 0) {
      stepX = -1;
      sideDistX = (px - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1 - px) * deltaDistX;
    }

    if (sin < 0) {
      stepY = -1;
      sideDistY = (py - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1 - py) * deltaDistY;
    }

    let hit = false;
    let side = 0;
    let depth = 0;

    for (let i = 0; i < 64; i++) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }

      if (mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H) {
        depth = 32;
        hit = true;
        break;
      }

      const tile = MAP[mapY][mapX];
      if (tile === "#") {
        hit = true;
        if (side === 0) depth = (mapX - px + (1 - stepX) / 2) / (cos || 1e-6);
        else depth = (mapY - py + (1 - stepY) / 2) / (sin || 1e-6);
        break;
      }
    }

    return { depth: Math.max(depth, 0.01), side, mapX, mapY };
  }

  drawWorld(player, sprites) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const numRays = Math.floor(w / 2);
    const stripW = w / numRays;

    ctx.fillStyle = "#6a7a8a";
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = "#4a5a3a";
    ctx.fillRect(0, h / 2, w, h / 2);

    const zBuffer = new Array(numRays);

    for (let i = 0; i < numRays; i++) {
      const rayAngle = player.angle - this.fov / 2 + (i / numRays) * this.fov;
      const hit = this.castRay(player.x, player.y, rayAngle);
      const corrected = hit.depth * Math.cos(rayAngle - player.angle);
      zBuffer[i] = corrected;

      const wallH = Math.min((TILE / corrected) * (h * 0.9), h * 2);
      const y0 = (h - wallH) / 2;

      const row = Math.max(0, Math.min(MAP_H - 1, hit.mapY));
      const col = Math.max(0, Math.min(MAP_W - 1, hit.mapX));
      const tile = MAP[row]?.[col] ?? "#";
      const colors = WALL_COLORS[tile] || WALL_COLORS["#"];
      const shade = Math.max(0.35, 1 - corrected / 18);
      const base = hit.side === 0 ? colors.side : colors.top;
      ctx.fillStyle = this.shadeColor(base, shade);
      ctx.fillRect(i * stripW, y0, stripW + 1, wallH);
    }

    const sorted = [...sprites].sort((a, b) => b.dist - a.dist);
    for (const sprite of sorted) {
      this.drawSprite(sprite, player, zBuffer, numRays, stripW, w, h);
    }
  }

  drawSprite(sprite, player, zBuffer, numRays, stripW, w, h) {
    const dx = sprite.x - player.x;
    const dy = sprite.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.3) return;

    let angle = Math.atan2(dy, dx) - player.angle;
    while (angle < -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;

    if (Math.abs(angle) > this.fov / 2 + 0.2) return;

    const screenX = (0.5 + angle / this.fov) * w;
    const size = Math.min((TILE / dist) * h * 0.85, h * 1.5);
    const y0 = (h - size) / 2 + size * 0.1;

    const start = Math.floor((screenX - size / 2) / stripW);
    const end = Math.floor((screenX + size / 2) / stripW);

    for (let i = Math.max(0, start); i < Math.min(numRays, end); i++) {
      if (dist >= zBuffer[i]) continue;
      const stripX = i * stripW;
      const rel = (stripX + stripW / 2 - (screenX - size / 2)) / size;
      if (rel < 0 || rel > 1) continue;

      const shade = Math.max(0.4, 1 - dist / 16);
      this.ctx.fillStyle = this.shadeColor(sprite.color, shade);
      this.ctx.fillRect(stripX, y0, stripW + 1, size);

      if (sprite.hpBar) {
        this.ctx.fillStyle = "#111";
        this.ctx.fillRect(stripX, y0 - 8, stripW + 1, 4);
        this.ctx.fillStyle = "#0f0";
        this.ctx.fillRect(stripX, y0 - 8, (stripW + 1) * sprite.hpRatio, 4);
      }
    }
  }

  drawMinimap(player, enemies, bomb) {
    const size = 140;
    const scale = size / Math.max(MAP_W, MAP_H);
    const ox = 16;
    const oy = this.canvas.height - size - 16;

    this.ctx.fillStyle = "rgba(0,0,0,0.55)";
    this.ctx.fillRect(ox - 4, oy - 4, size + 8, size + 8);

    for (let row = 0; row < MAP_H; row++) {
      for (let col = 0; col < MAP_W; col++) {
        const tile = MAP[row][col];
        if (tile === "#") this.ctx.fillStyle = "#8b7355";
        else if (tile === "A" || tile === "B") this.ctx.fillStyle = "#d4a84b";
        else this.ctx.fillStyle = "#2a3328";
        this.ctx.fillRect(ox + col * scale, oy + row * scale, scale, scale);
      }
    }

    this.ctx.fillStyle = "#e8a020";
    this.ctx.beginPath();
    this.ctx.arc(ox + player.x * scale, oy + player.y * scale, 3, 0, Math.PI * 2);
    this.ctx.fill();

    const dirX = ox + (player.x + Math.cos(player.angle) * 0.8) * scale;
    const dirY = oy + (player.y + Math.sin(player.angle) * 0.8) * scale;
    this.ctx.strokeStyle = "#e8a020";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(ox + player.x * scale, oy + player.y * scale);
    this.ctx.lineTo(dirX, dirY);
    this.ctx.stroke();

    for (const e of enemies) {
      if (!e.alive) continue;
      this.ctx.fillStyle = "#4a7cba";
      this.ctx.beginPath();
      this.ctx.arc(ox + e.x * scale, oy + e.y * scale, 2.5, 0, Math.PI * 2);
      this.ctx.fill();
    }

    if (bomb.planted) {
      this.ctx.fillStyle = "#ff4444";
      this.ctx.beginPath();
      this.ctx.arc(ox + bomb.x * scale, oy + bomb.y * scale, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawCrosshair() {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const ctx = this.ctx;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx - 3, cy);
    ctx.moveTo(cx + 3, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy - 3);
    ctx.moveTo(cx, cy + 3);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();
  }

  drawMuzzleFlash(alpha) {
    if (alpha <= 0) return;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    this.ctx.fillStyle = `rgba(255,220,100,${alpha})`;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy + 40, 30, 0, Math.PI * 2);
    this.ctx.fill();
  }

  shadeColor(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.floor(((n >> 16) & 255) * factor);
    const g = Math.floor(((n >> 8) & 255) * factor);
    const b = Math.floor((n & 255) * factor);
    return `rgb(${r},${g},${b})`;
  }
}
