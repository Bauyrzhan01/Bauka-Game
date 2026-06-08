export function isPhone() {
  return (
    /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) <= 1024)
  );
}

export class TouchControls {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.move = { x: 0, y: 0 };
    this.lookTouchId = null;
    this.lastLookX = 0;
    this.joyTouchId = null;
    this.joyCenter = { x: 0, y: 0 };
    this.joyStick = root.querySelector(".joy-stick");
    this.joyBase = root.querySelector(".joy-base");
    this.bind();
  }

  bind() {
    const joyZone = this.root.querySelector("#joystick-zone");
    const lookZone = this.root.querySelector("#look-zone");

    joyZone.addEventListener("touchstart", (e) => this.onJoyStart(e), { passive: false });
    joyZone.addEventListener("touchmove", (e) => this.onJoyMove(e), { passive: false });
    joyZone.addEventListener("touchend", (e) => this.onJoyEnd(e));
    joyZone.addEventListener("touchcancel", (e) => this.onJoyEnd(e));

    lookZone.addEventListener("touchstart", (e) => this.onLookStart(e), { passive: false });
    lookZone.addEventListener("touchmove", (e) => this.onLookMove(e), { passive: false });
    lookZone.addEventListener("touchend", (e) => this.onLookEnd(e));
    lookZone.addEventListener("touchcancel", (e) => this.onLookEnd(e));

    this.root.querySelector("#btn-fire").addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.game.onFirePress();
    });
    this.root.querySelector("#btn-fire").addEventListener("touchend", () => this.game.onFireRelease());

    this.root.querySelector("#btn-reload").addEventListener("click", () => this.game.reload());
    this.root.querySelector("#btn-shop").addEventListener("click", () => this.game.toggleShop());
    this.root.querySelector("#btn-bomb").addEventListener("click", () => this.game.toggleBomb());
    this.root.querySelector("#btn-menu").addEventListener("click", () => this.game.togglePause());
  }

  onJoyStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    this.joyTouchId = t.identifier;
    const rect = this.root.querySelector("#joystick-zone").getBoundingClientRect();
    this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.updateJoy(t.clientX, t.clientY);
  }

  onJoyMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyTouchId) this.updateJoy(t.clientX, t.clientY);
    }
  }

  onJoyEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyTouchId) {
        this.joyTouchId = null;
        this.move = { x: 0, y: 0 };
        this.joyStick.style.transform = "translate(-50%, -50%)";
      }
    }
  }

  updateJoy(x, y) {
    const max = 42;
    let dx = x - this.joyCenter.x;
    let dy = y - this.joyCenter.y;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.move.x = dx / max;
    this.move.y = dy / max;
  }

  onLookStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    this.lookTouchId = t.identifier;
    this.lastLookX = t.clientX;
  }

  onLookMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.lookTouchId) {
        const dx = t.clientX - this.lastLookX;
        this.lastLookX = t.clientX;
        if (this.game.state === "playing" && !this.game.isUiOpen()) {
          this.game.player.angle += dx * 0.004;
        }
      }
    }
  }

  onLookEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.lookTouchId) this.lookTouchId = null;
    }
  }

  getMovement() {
    return { fwd: -this.move.y, str: this.move.x };
  }
}
