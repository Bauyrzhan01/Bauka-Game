# Bauka Game — Counter-Strike

Браузерная копия **Counter-Strike** на JavaScript (raycasting FPS).

## Геймплей

- Ты играешь за **Terrorist**
- 5 ботов **Counter-Terrorist** патрулируют карту
- Заложи бомбу на сайте **A** или **B**, или убей всех CT
- Экономика: деньги за убийства и победу в раунде

## Управление

| Клавиша | Действие |
|---------|----------|
| WASD | Движение |
| Мышь | Прицел |
| ЛКМ | Стрелять |
| R | Перезарядка |
| B | Магазин (в начале раунда) |
| E | Заложить бомбу на сайте |
| Shift | Медленная ходьба |

## Оружие

- **Glock-18** — бесплатно
- **AK-47** — $2700
- **AWP** — $4750

## Запуск

```bash
npx --yes serve .
```

Открой http://localhost:3000 → **ИГРАТЬ** → кликни по экрану (захват мыши).

## Структура

```
index.html
css/style.css
js/main.js      — запуск
js/game.js      — раунды, бомба, боты
js/render.js    — 3D raycasting
js/map.js       — карта
js/weapons.js   — оружие
```

## GitHub

https://github.com/Bauyrzhan01/Bauka-Game
