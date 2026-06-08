import {
  BOMB_SITES,
  SPAWNS,
  isWalkable,
  lineOfSight,
} from "./map.js";
import { WEAPONS, createWeaponState } from "./weapons.js";
import { Renderer } from "./render.js";
import { Network } from "./network.js";
import { TouchControls, isPhone } from "./touch.js";
function isOnLaptopServer() {
  const h = location.hostname;
  return h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.endsWith(".loca.lt");
}

const ROUND_TIME = 115;
const BUY_TIME = 20;
const BOMB_TIMER = 40;
const PLANT_TIME = 3.5;
const DEFUSE_TIME = 5;

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.network = new Network(this);
    this.isMobile = isPhone();
    this.mode = "solo";
    this.state = "menu";
    this.resetRound(true);
    this.muzzleFlash = 0;
    this.message = "";
    this.messageTimer = 0;
    this.pointerLocked = false;
    this.keys = new Set();
    this.mouseDown = false;
    this.showBuyMenu = false;
    this.showPauseMenu = false;
    this.bombKeyHeld = false;
    this.killFeed = "";
    this.killFeedTimer = 0;

    if (this.isMobile) {
      this.touch = new TouchControls(this, document.getElementById("touch-controls"));
      document.getElementById("touch-controls").classList.remove("hidden");
    }

    this.network.connect();
    this.bindInput();
    this.updateCursor();
  }

  isUiOpen() {
    return (
      this.showBuyMenu ||
      this.showPauseMenu ||
      !this.ui.startScreen.classList.contains("hidden") ||
      !this.ui.onlineScreen.classList.contains("hidden") ||
      !this.ui.endScreen.classList.contains("hidden")
    );
  }

  resetRound(first = false) {
    this.round = first ? 1 : this.round + 1;
    this.timeLeft = ROUND_TIME;
    this.buyTimeLeft = BUY_TIME;
    this.phase = this.mode === "online" ? "live" : "buy";

    const ctSpawn = Array.isArray(SPAWNS.ct) ? SPAWNS.ct[0] : SPAWNS.ct;
    const spawn = this.network.team === "ct" ? ctSpawn : SPAWNS.t;
    const angle = this.network.team === "ct" ? Math.PI / 2 : -Math.PI / 2;

    this.player = {
      x: spawn.x,
      y: spawn.y,
      angle,
      health: 100,
      armor: 0,
      money: first ? 800 : Math.min(this.player?.money + 1400 || 800, 16000),
      alive: true,
      kills: 0,
      weapon: createWeaponState("glock"),
      recoil: 0,
    };

    this.enemies =
      this.mode === "solo"
        ? SPAWNS.ct.map((s, i) => ({
            id: i,
            x: s.x,
            y: s.y,
            angle: Math.PI / 2,
            health: 100,
            alive: true,
            fireCooldown: 0,
            thinkCooldown: 0,
            targetX: s.x,
            targetY: s.y,
          }))
        : [];

    this.bomb = {
      planted: false,
      planting: false,
      defusing: false,
      plantProgress: 0,
      defuseProgress: 0,
      timer: 0,
      x: 0,
      y: 0,
      site: null,
    };

    this.showBuyMenu = false;
    if (this.mode === "solo") {
      this.setMessage(first ? "Раунд 1 — магазин [B]" : `Раунд ${this.round} — закупка`);
    } else {
      this.setMessage("Онлайн — уничтожай врагов!");
    }
  }

  bindInput() {
    const onKey = (e, down) => {
      if (down && e.code === "Escape") {
        e.preventDefault();
        this.togglePause();
        return;
      }
      this.keys[down ? "add" : "delete"](e.code);
      if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyR", "KeyB", "KeyE"].includes(e.code)) {
        e.preventDefault();
      }
      if (down && e.code === "KeyB" && this.phase === "buy" && this.mode === "solo") {
        this.toggleShop();
        return;
      }
      if (down && e.code === "KeyR") this.reload();
      if (e.code === "KeyE") this.bombKeyHeld = down;
    };

    window.addEventListener("keydown", (e) => onKey(e, true));
    window.addEventListener("keyup", (e) => onKey(e, false));

    window.addEventListener("mousedown", () => {
      if (this.isUiOpen()) return;
      this.mouseDown = true;
      if (this.state === "playing") this.tryShoot();
    });
    window.addEventListener("mouseup", () => {
      this.mouseDown = false;
    });
    window.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked || this.state !== "playing" || this.isUiOpen() || this.isMobile) return;
      this.player.angle += e.movementX * 0.0022;
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    window.addEventListener("resize", () => this.renderer.resize());

    this.ui.buyMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-weapon]");
      if (!btn) return;
      this.buyWeapon(btn.dataset.weapon);
    });

    this.ui.soloBtn.addEventListener("click", () => this.openSolo());
    this.ui.onlineBtn.addEventListener("click", () => this.openOnlineLobby());
    this.ui.createRoomBtn.addEventListener("click", () => this.createRoom());
    this.ui.joinRoomBtn.addEventListener("click", () => this.joinRoom());
    this.ui.startOnlineBtn.addEventListener("click", () => this.network.startGame());
    this.ui.lobbyBackBtn.addEventListener("click", () => this.leaveToMenu());
    this.ui.resumeBtn.addEventListener("click", () => this.togglePause(false));
    this.ui.pauseMenuBtn.addEventListener("click", () => this.leaveToMenu());
    this.ui.restartBtn.addEventListener("click", () => this.leaveToMenu());
    this.ui.serverConnectBtn.addEventListener("click", () => this.connectToServer());
    this.ui.serverHost.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.connectToServer();
    });
  }

  showServerSetup(visible) {
    this.ui.serverSetup.classList.toggle("hidden", !visible);
  }

  connectToServer() {
    const value = this.ui.serverHost.value.trim();
    if (!value) {
      this.onNetworkError("Введи IP:порт, например 192.168.1.5:3000");
      return;
    }
    if (this.network.setServer(value)) {
      this.onNetworkError("");
    }
  }

  async loadHostInfo() {
    if (!isOnLaptopServer()) {
      this.ui.hostInfo.classList.add("hidden");
      return;
    }
    try {
      const res = await fetch("/api/info");
      const data = await res.json();
      if (!data.links?.length) return;
      this.ui.hostInfo.classList.remove("hidden");
      this.ui.hostLinks.innerHTML = data.links
        .map((link) => `<a href="${link}">${link.replace(/^https?:\/\//, "")}</a>`)
        .join("");
      this.showServerSetup(false);
    } catch {
      this.ui.hostInfo.classList.add("hidden");
    }
  }

  updateCursor() {
    const show = this.isUiOpen();
    document.body.classList.toggle("menu-open", show);
    if (show) {
      this.mouseDown = false;
      document.exitPointerLock();
    } else if (this.state === "playing" && !this.isMobile) {
      this.canvas.requestPointerLock();
    }
  }

  togglePause(force) {
    if (this.state !== "playing" && this.state !== "paused") return;
    const next = typeof force === "boolean" ? force : !this.showPauseMenu;
    this.showPauseMenu = next;
    this.state = next ? "paused" : "playing";
    this.ui.pauseMenu.classList.toggle("hidden", !next);
    this.updateCursor();
  }

  toggleShop() {
    if (this.phase !== "buy" || this.mode !== "solo") return;
    this.showBuyMenu = !this.showBuyMenu;
    this.updateBuyMenu();
  }

  toggleBomb() {
    this.bombKeyHeld = !this.bombKeyHeld;
  }

  onFirePress() {
    this.mouseDown = true;
    if (this.state === "playing") this.tryShoot();
  }

  onFireRelease() {
    this.mouseDown = false;
  }

  openSolo() {
    this.mode = "solo";
    this.ui.startScreen.classList.add("hidden");
    this.ui.onlineScreen.classList.add("hidden");
    this.resetRound(true);
    this.start();
  }

  openOnlineLobby() {
    this.mode = "online";
    this.ui.startScreen.classList.add("hidden");
    this.ui.onlineScreen.classList.remove("hidden");
    this.loadHostInfo();
    if (!isOnLaptopServer() && !this.network.wsUrl) {
      this.showServerSetup(true);
    }
    this.updateCursor();
  }

  createRoom() {
    const name = this.ui.playerName.value.trim() || "Игрок";
    this.network.createRoom(name);
  }

  joinRoom() {
    const name = this.ui.playerName.value.trim() || "Игрок";
    const code = this.ui.roomCode.value.trim();
    if (code.length < 4) {
      this.onNetworkError("Введи код комнаты");
      return;
    }
    this.network.joinRoom(code, name);
  }

  onNetworkStatus(text) {
    this.ui.networkStatus.textContent = text;
  }

  onNetworkError(text) {
    this.ui.lobbyError.textContent = text;
  }

  onRoomJoined() {
    this.ui.onlineScreen.classList.remove("hidden");
    this.ui.lobbyError.textContent = "";
  }

  onLobbyUpdate(msg) {
    this.ui.roomCodeDisplay.textContent = msg.roomId;
    this.ui.lobbyPlayers.innerHTML = msg.players
      .map(
        (p) =>
          `<li class="${p.team}">${p.name} <span>${p.team.toUpperCase()}</span>${p.id === msg.hostId ? " 👑" : ""}</li>`
      )
      .join("");
    this.ui.startOnlineBtn.classList.toggle("hidden", this.network.playerId !== msg.hostId);
    this.ui.lobbyHint.textContent = msg.playing
      ? "Игра идёт..."
      : "Поделись кодом с друзьями. Хост нажимает «Начать» (мин. 2 игрока).";
  }

  startOnlineMatch() {
    this.mode = "online";
    this.ui.onlineScreen.classList.add("hidden");
    this.ui.endScreen.classList.add("hidden");
    this.state = "playing";
    this.resetRound(true);
    this.player.team = this.network.team;
    this.updateCursor();
    this.setMessage(`Ты за ${this.network.team.toUpperCase()} — стреляй по врагам!`, 4);
  }

  applyServerPlayerState(p) {
    this.player.health = p.health;
    this.player.alive = p.alive;
    this.player.kills = p.kills;
    if (!p.alive) this.setMessage("Ты убит — респавн 3с", 2);
  }

  onKillFeed(msg) {
    this.killFeed = `${msg.killerName} ⚔ ${msg.targetName}`;
    this.killFeedTimer = 3;
  }

  start() {
    this.state = "playing";
    this.ui.endScreen.classList.add("hidden");
    this.showPauseMenu = false;
    this.ui.pauseMenu.classList.add("hidden");
    this.updateCursor();
    this.updateBuyMenu();
  }

  leaveToMenu() {
    this.network.disconnect();
    this.network.connect();
    this.state = "menu";
    this.mode = "solo";
    this.showPauseMenu = false;
    this.showBuyMenu = false;
    this.ui.pauseMenu.classList.add("hidden");
    this.ui.endScreen.classList.add("hidden");
    this.ui.onlineScreen.classList.add("hidden");
    this.ui.startScreen.classList.remove("hidden");
    this.ui.buyMenu.classList.add("hidden");
    this.resetRound(true);
    this.updateCursor();
  }

  setMessage(text, duration = 3) {
    this.message = text;
    this.messageTimer = duration;
  }

  buyWeapon(id) {
    const weapon = WEAPONS[id];
    if (!weapon || this.phase !== "buy") return;
    if (this.player.money < weapon.price) {
      this.setMessage("Недостаточно денег");
      return;
    }
    this.player.money -= weapon.price;
    this.player.weapon = createWeaponState(id);
    this.showBuyMenu = false;
    this.setMessage(`Куплено: ${weapon.name}`);
    this.updateBuyMenu();
  }

  updateBuyMenu() {
    const open = this.showBuyMenu && this.phase === "buy";
    if (open) {
      this.ui.buyMenu.classList.remove("hidden");
      this.ui.buyList.innerHTML = Object.entries(WEAPONS)
        .map(([id, w]) => {
          const owned = this.player.weapon.id === id;
          return `<button class="buy-item" data-weapon="${id}" ${this.player.money < w.price ? "disabled" : ""}>
            <span>${w.name}</span>
            <span>$${w.price}${owned ? " ✓" : ""}</span>
          </button>`;
        })
        .join("");
    } else {
      this.ui.buyMenu.classList.add("hidden");
    }
    this.updateCursor();
  }

  reload() {
    const w = this.player.weapon;
    const def = WEAPONS[w.id];
    if (w.reloading || w.mag === def.magSize || w.reserve <= 0) return;
    w.reloading = true;
    w.reloadTimer = def.reloadTime;
    this.setMessage("Перезарядка...");
  }

  tryShoot() {
    if (this.state !== "playing" || !this.player.alive) return;
    const fired = this.fire(this.player, this.getShootTargets(), true);
    if (fired && this.mode === "online") {
      this.network.sendShoot(this.player.angle);
    }
  }

  getShootTargets() {
    if (this.mode === "solo") return this.enemies;
    const myTeam = this.network.team;
    return [...this.network.remotePlayers.values()].filter(
      (p) => p.alive && p.team !== myTeam
    );
  }

  fire(shooter, targets, isPlayer) {
    const w = shooter.weapon;
    const def = WEAPONS[w.id];
    if (w.reloading || w.fireCooldown > 0 || (isPlayer && w.mag <= 0)) {
      if (isPlayer && w.mag <= 0 && w.reserve > 0) this.reload();
      return false;
    }

    if (isPlayer) w.mag--;
    w.fireCooldown = def.fireRate;
    if (isPlayer) {
      this.muzzleFlash = 1;
      this.playGunshot();
    }

    const spread = def.spread + (isPlayer ? this.player.recoil * 0.5 : 0.02);
    const angle = shooter.angle + (Math.random() - 0.5) * spread * 2;

    let best = null;
    let bestDist = def.range;

    const list = isPlayer
      ? targets.filter((t) => t.alive)
      : this.player.alive
        ? [this.player]
        : [];

    for (const target of list) {
      const dx = target.x - shooter.x;
      const dy = target.y - shooter.y;
      const dist = Math.hypot(dx, dy);
      if (dist > def.range) continue;
      const aim = Math.atan2(dy, dx);
      let diff = aim - angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      if (Math.abs(diff) > 0.12) continue;
      if (!lineOfSight(shooter.x, shooter.y, target.x, target.y)) continue;
      if (dist < bestDist) {
        best = target;
        bestDist = dist;
      }
    }

    if (best && this.mode === "solo") {
      const dmg = def.damage * (bestDist > def.range * 0.6 ? 0.75 : 1);
      best.health -= dmg;
      if (best.health <= 0) {
        best.alive = false;
        if (isPlayer) {
          this.player.money = Math.min(this.player.money + 300, 16000);
          this.setMessage("Враг убит +$300");
        }
      }
    }

    if (isPlayer) this.player.recoil = Math.min(this.player.recoil + 0.04, 0.2);
    return true;
  }

  playGunshot() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 120;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      /* optional */
    }
  }

  moveEntity(entity, speed, dirX, dirY) {
    const nx = entity.x + dirX * speed;
    const ny = entity.y + dirY * speed;
    if (isWalkable(nx, entity.y)) entity.x = nx;
    if (isWalkable(entity.x, ny)) entity.y = ny;
  }

  getMovement() {
    if (this.isMobile && this.touch) {
      return this.touch.getMovement();
    }
    let fwd = 0;
    let str = 0;
    if (this.keys.has("KeyW")) fwd += 1;
    if (this.keys.has("KeyS")) fwd -= 1;
    if (this.keys.has("KeyA")) str -= 1;
    if (this.keys.has("KeyD")) str += 1;
    return { fwd, str };
  }

  updatePlayer(delta) {
    const p = this.player;
    const w = p.weapon;
    const def = WEAPONS[w.id];

    if (w.reloading) {
      w.reloadTimer -= delta;
      if (w.reloadTimer <= 0) {
        const need = def.magSize - w.mag;
        const load = Math.min(need, w.reserve);
        w.mag += load;
        w.reserve -= load;
        w.reloading = false;
      }
    }

    if (w.fireCooldown > 0) w.fireCooldown -= delta;
    p.recoil = Math.max(0, p.recoil - delta * 0.5);

    const walkSpeed = 4.2;
    const { fwd, str } = this.getMovement();
    const sin = Math.sin(p.angle);
    const cos = Math.cos(p.angle);
    this.moveEntity(p, walkSpeed * delta, cos * fwd - sin * str, sin * fwd + cos * str);

    if (this.mouseDown && def.auto) {
      const fired = this.fire(p, this.getShootTargets(), true);
      if (fired && this.mode === "online") this.network.sendShoot(p.angle);
    }

    if (this.mode === "solo") this.updateBomb(delta);
    if (this.mode === "online" && p.alive) this.network.sendInput(p);
  }

  getBombSite() {
    for (const site of Object.values(BOMB_SITES)) {
      if (Math.hypot(this.player.x - site.x, this.player.y - site.y) < 1.6) return site;
    }
    return null;
  }

  updateBomb(delta) {
    const site = this.getBombSite();
    const planting = this.bombKeyHeld && site && !this.bomb.planted && this.phase === "live";

    if (planting) {
      this.bomb.planting = true;
      this.bomb.plantProgress += delta;
      if (this.bomb.plantProgress >= PLANT_TIME) {
        this.bomb.planted = true;
        this.bomb.planting = false;
        this.bomb.timer = BOMB_TIMER;
        this.bomb.x = this.player.x;
        this.bomb.y = this.player.y;
        this.bomb.site = site.label;
        this.setMessage(`Бомба заложена на ${site.label}!`, 5);
      }
    } else {
      this.bomb.planting = false;
      if (!this.bomb.planted) this.bomb.plantProgress = Math.max(0, this.bomb.plantProgress - delta * 2);
    }

    if (this.bomb.planted) {
      this.bomb.timer -= delta;
      const defuser = this.enemies.find(
        (e) => e.alive && Math.hypot(e.x - this.bomb.x, e.y - this.bomb.y) < 1.5
      );
      if (defuser && lineOfSight(defuser.x, defuser.y, this.bomb.x, this.bomb.y)) {
        this.bomb.defusing = true;
        this.bomb.defuseProgress += delta;
        if (this.bomb.defuseProgress >= DEFUSE_TIME) this.endRound("ct", "CT обезвредили бомбу");
      } else {
        this.bomb.defusing = false;
        this.bomb.defuseProgress = Math.max(0, this.bomb.defuseProgress - delta);
      }
      if (this.bomb.timer <= 0) this.endRound("t", "Бомба взорвалась!");
    }
  }

  updateEnemies(delta) {
    if (this.mode !== "solo") return;
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.fireCooldown = Math.max(0, e.fireCooldown - delta);
      e.thinkCooldown -= delta;
      const seesPlayer = p.alive && lineOfSight(e.x, e.y, p.x, p.y);
      const dist = Math.hypot(p.x - e.x, p.y - e.y);

      if (this.bomb.planted) {
        const toBomb = Math.hypot(this.bomb.x - e.x, this.bomb.y - e.y);
        if (toBomb > 1.2) {
          const angle = Math.atan2(this.bomb.y - e.y, this.bomb.x - e.x);
          e.angle = angle;
          this.moveEntity(e, 3.2 * delta, Math.cos(angle), Math.sin(angle));
        }
      } else if (seesPlayer) {
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        if (dist > 6) this.moveEntity(e, 3.0 * delta, Math.cos(e.angle), Math.sin(e.angle));
        else if (dist < 3) this.moveEntity(e, -2.5 * delta, Math.cos(e.angle), Math.sin(e.angle));
        if (dist < 18 && e.fireCooldown <= 0) {
          e.weapon = e.weapon || createWeaponState("ak47");
          this.fire(e, [p], false);
          e.fireCooldown = 0.35 + Math.random() * 0.3;
        }
      } else if (e.thinkCooldown <= 0) {
        e.thinkCooldown = 1.5 + Math.random();
        e.targetX = 4 + Math.random() * 16;
        e.targetY = 2 + Math.random() * 12;
        if (!isWalkable(e.targetX, e.targetY)) continue;
        e.angle = Math.atan2(e.targetY - e.y, e.targetX - e.x);
      } else {
        const dx = e.targetX - e.x;
        const dy = e.targetY - e.y;
        if (Math.hypot(dx, dy) > 0.5) {
          e.angle = Math.atan2(dy, dx);
          this.moveEntity(e, 2.2 * delta, Math.cos(e.angle), Math.sin(e.angle));
        }
      }
    }
  }

  updateRound(delta) {
    if (this.mode === "online") return;
    if (this.phase === "buy") {
      this.buyTimeLeft -= delta;
      if (this.buyTimeLeft <= 0) {
        this.phase = "live";
        this.showBuyMenu = false;
        this.updateBuyMenu();
        this.setMessage("Заложи бомбу на A или B [E]");
      }
      return;
    }

    this.timeLeft -= delta;
    if (!this.player.alive) {
      this.endRound("ct", "Тебя убили");
      return;
    }
    const aliveCt = this.enemies.filter((e) => e.alive).length;
    if (aliveCt === 0 && !this.bomb.planted) this.endRound("t", "Все CT уничтожены");
    if (this.timeLeft <= 0 && !this.bomb.planted) this.endRound("ct", "Время вышло");
  }

  endRound(winner, reason) {
    if (this.mode === "online") return;
    this.state = "ended";
    document.exitPointerLock();
    const win = winner === "t";
    if (win) this.player.money = Math.min(this.player.money + 3250, 16000);
    else this.player.money = Math.max(0, this.player.money - 800);
    this.ui.endTitle.textContent = win ? "ПОБЕДА T" : "ПОБЕДА CT";
    this.ui.endReason.textContent = reason;
    this.ui.endMoney.textContent = `$${this.player.money}`;
    this.ui.endScreen.classList.remove("hidden");
    this.updateCursor();
    setTimeout(() => {
      if (this.state === "ended") {
        this.ui.endScreen.classList.add("hidden");
        this.state = "playing";
        this.resetRound();
        this.updateCursor();
      }
    }, 4000);
  }

  updateHud() {
    const p = this.player;
    const w = WEAPONS[p.weapon.id];
    this.ui.health.textContent = Math.max(0, Math.ceil(p.health));
    this.ui.ammo.textContent = `${p.weapon.mag} / ${p.weapon.reserve}`;
    this.ui.weapon.textContent = w.name;
    this.ui.money.textContent = this.mode === "online" ? `K:${p.kills || 0}` : `$${p.money}`;

    if (this.mode === "online") {
      const count = this.network.remotePlayers.size + 1;
      this.ui.timer.textContent = `ONLINE ${count}`;
      this.ui.teamLabel.textContent = this.network.team === "t" ? "TERRORIST" : "CT";
      this.ui.teamLabel.className = `hud-team ${this.network.team === "t" ? "t-side" : "ct-side"}`;
    } else {
      this.ui.timer.textContent =
        this.phase === "buy" ? `Закупка ${Math.ceil(this.buyTimeLeft)}` : `${Math.max(0, Math.ceil(this.timeLeft))}`;
      this.ui.teamLabel.textContent = "TERRORIST";
      this.ui.teamLabel.className = "hud-team t-side";
    }

    if (this.mode === "solo" && this.bomb.planted) {
      this.ui.bombStatus.classList.remove("hidden");
      this.ui.bombStatus.textContent = `БОМБА: ${Math.ceil(this.bomb.timer)}с`;
    } else if (this.mode === "solo" && this.bomb.planting) {
      this.ui.bombStatus.classList.remove("hidden");
      this.ui.bombStatus.textContent = `Закладка ${Math.ceil(PLANT_TIME - this.bomb.plantProgress)}с`;
    } else {
      this.ui.bombStatus.classList.add("hidden");
    }

    this.ui.hint.textContent = this.isMobile
      ? "Джойстик — ходьба | правая зона — прицел | ОГОНЬ"
      : this.mode === "online"
        ? "Стреляй по врагам другой команды | ESC — меню"
        : "ЛКМ — стрелять | R — перезарядка | ESC — меню";
  }

  update(delta) {
    if (this.killFeedTimer > 0) {
      this.killFeedTimer -= delta;
      if (this.killFeedTimer <= 0) this.killFeed = "";
    }
    if (this.messageTimer > 0) {
      this.messageTimer -= delta;
      if (this.messageTimer <= 0) this.message = "";
    }
    this.muzzleFlash = Math.max(0, this.muzzleFlash - delta * 6);
    if (this.state !== "playing") return;

    if (this.player.alive) {
      this.updatePlayer(delta);
      if (this.player.health <= 0) this.player.alive = false;
    }
    this.updateEnemies(delta);
    this.updateRound(delta);
    this.updateHud();
  }

  getSprites() {
    const sprites = [];

    if (this.mode === "solo") {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        sprites.push({
          x: e.x,
          y: e.y,
          color: "#4a7cba",
          hpBar: true,
          hpRatio: Math.max(0, e.health / 100),
          dist: Math.hypot(e.x - this.player.x, e.y - this.player.y),
        });
      }
      if (this.bomb.planted) {
        sprites.push({
          x: this.bomb.x,
          y: this.bomb.y,
          color: "#cc2222",
          hpBar: false,
          dist: Math.hypot(this.bomb.x - this.player.x, this.bomb.y - this.player.y),
        });
      }
    } else {
      for (const p of this.network.remotePlayers.values()) {
        if (!p.alive) continue;
        sprites.push({
          x: p.x,
          y: p.y,
          color: p.team === "t" ? "#e8a020" : "#4a7cba",
          hpBar: true,
          hpRatio: Math.max(0, p.health / 100),
          dist: Math.hypot(p.x - this.player.x, p.y - this.player.y),
          name: p.name,
        });
      }
    }
    return sprites;
  }

  render() {
    const ctx = this.renderer.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (this.state === "menu") {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, w, h);
      return;
    }

    this.renderer.drawWorld(this.player, this.getSprites());
    this.renderer.drawMinimap(this.player, this.mode === "solo" ? this.enemies : [...this.network.remotePlayers.values()], this.bomb);
    this.renderer.drawCrosshair();
    this.renderer.drawMuzzleFlash(this.muzzleFlash);

    const text = this.killFeed || this.message;
    if (text) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(w / 2 - 220, 60, 440, 36);
      ctx.fillStyle = "#ffd080";
      ctx.font = "18px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillText(text, w / 2, 84);
    }
  }

  loop(now) {
    const delta = Math.min((now - (this.lastTime || now)) / 1000, 0.05);
    this.lastTime = now;
    this.update(delta);
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  run() {
    requestAnimationFrame((t) => this.loop(t));
  }
}

export function initApp(ui) {
  if (!isPhone()) {
    document.getElementById("desktop-block").classList.remove("hidden");
    return null;
  }
  const canvas = document.getElementById("game");
  return new Game(canvas, ui);
}
