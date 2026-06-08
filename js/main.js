import { Game } from "./game.js";

const canvas = document.getElementById("game");
const ui = {
  startScreen: document.getElementById("start-screen"),
  startBtn: document.getElementById("start-btn"),
  endScreen: document.getElementById("end-screen"),
  endTitle: document.getElementById("end-title"),
  endReason: document.getElementById("end-reason"),
  endMoney: document.getElementById("end-money"),
  restartBtn: document.getElementById("restart-btn"),
  buyMenu: document.getElementById("buy-menu"),
  buyList: document.getElementById("buy-list"),
  health: document.getElementById("health"),
  ammo: document.getElementById("ammo"),
  weapon: document.getElementById("weapon"),
  money: document.getElementById("money"),
  timer: document.getElementById("timer"),
  bombStatus: document.getElementById("bomb-status"),
  hint: document.getElementById("hint"),
};

const game = new Game(canvas, ui);
game.run();
