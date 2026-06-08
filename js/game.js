const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const SPEED = 280;
const PLAYER_SIZE = 64;
const BG = "#1f242e";
const PLAYER_COLOR = "#3380ff";
const GRID_COLOR = "rgba(255, 255, 255, 0.04)";
const GRID_STEP = 64;

const keys = new Set();

const player = { x: 0, y: 0 };
const camera = { x: 0, y: 0 };

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function handleKey(event, pressed) {
  const code = event.code;
  if (
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD" ||
    code === "ArrowUp" ||
    code === "ArrowLeft" ||
    code === "ArrowDown" ||
    code === "ArrowRight"
  ) {
    if (pressed) keys.add(code);
    else keys.delete(code);
    event.preventDefault();
  }
}

window.addEventListener("keydown", (e) => handleKey(e, true));
window.addEventListener("keyup", (e) => handleKey(e, false));
window.addEventListener("resize", resize);
resize();

let lastTime = performance.now();

function getDirection() {
  let dx = 0;
  let dy = 0;

  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;

  if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };

  const len = Math.hypot(dx, dy);
  return { dx: dx / len, dy: dy / len };
}

function drawGrid() {
  const startX = Math.floor((camera.x - canvas.width / 2) / GRID_STEP) * GRID_STEP;
  const startY = Math.floor((camera.y - canvas.height / 2) / GRID_STEP) * GRID_STEP;
  const endX = camera.x + canvas.width / 2 + GRID_STEP;
  const endY = camera.y + canvas.height / 2 + GRID_STEP;

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;

  for (let x = startX; x <= endX; x += GRID_STEP) {
    const screenX = x - camera.x + canvas.width / 2;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, canvas.height);
    ctx.stroke();
  }

  for (let y = startY; y <= endY; y += GRID_STEP) {
    const screenY = y - camera.y + canvas.height / 2;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(canvas.width, screenY);
    ctx.stroke();
  }
}

function drawPlayer() {
  const screenX = player.x - camera.x + canvas.width / 2 - PLAYER_SIZE / 2;
  const screenY = player.y - camera.y + canvas.height / 2 - PLAYER_SIZE / 2;

  ctx.fillStyle = PLAYER_COLOR;
  ctx.fillRect(screenX, screenY, PLAYER_SIZE, PLAYER_SIZE);
}

function update(delta) {
  const { dx, dy } = getDirection();
  player.x += dx * SPEED * delta;
  player.y += dy * SPEED * delta;

  camera.x += (player.x - camera.x) * 0.15;
  camera.y += (player.y - camera.y) * 0.15;
}

function render() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawPlayer();
}

function loop(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(delta);
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
