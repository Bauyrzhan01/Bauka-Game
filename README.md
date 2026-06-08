# Bauka Game — Counter-Strike (Mobile)

Мобильная браузерная копия Counter-Strike с онлайн-режимом.

## Почему нельзя просто «ссылка GitHub»?

| Что | GitHub Pages | Онлайн-сервер |
|-----|--------------|---------------|
| HTML, CSS, JS | ✅ Да | — |
| WebSocket (игра с друзьями) | ❌ Нет | ✅ Нужен Node.js |

**GitHub Pages** — только статические файлы. **Онлайн** требует сервер, который соединяет игроков.

**Решение:** игра на GitHub Pages + сервер на Render (бесплатно). Друзьям отправляешь **одну ссылку** на GitHub.

---

## Ссылка для друзей (после настройки)

```
https://bauyrzhan01.github.io/Bauka-Game/
```

Открывают на **телефоне** → **Онлайн** → код комнаты → играют вместе.

---

## Настройка один раз (2 шага)

### Шаг 1 — GitHub Pages

1. Запушь код в репозиторий `Bauka-Game`
2. GitHub → **Settings** → **Pages**
3. Source: **GitHub Actions** (workflow уже в `.github/workflows/pages.yml`)
4. После push в `main` сайт появится на `bauyrzhan01.github.io/Bauka-Game`

### Шаг 2 — Сервер на Render (бесплатно)

1. Зайди на [render.com](https://render.com) → **New** → **Blueprint**
2. Подключи репозиторий `Bauka-Game` (файл `render.yaml` уже есть)
3. Deploy — получишь URL: `https://bauka-game.onrender.com`
4. В `js/config.js` уже указано: `wss://bauka-game.onrender.com`  
   Если имя сервиса другое — поменяй `PRODUCTION_WS`

> Первый заход на Render может занять ~30 сек (холодный старт).

---

## Локальная разработка

```bash
npm install
npm start
```

С телефона в Wi‑Fi: `http://IP-ПК:3000`

`npx serve` **не поддерживает** онлайн — только `npm start`.

---

## Как играть с друзьями

1. Отправь ссылку: `https://bauyrzhan01.github.io/Bauka-Game/`
2. Ты: **Онлайн** → **Создать комнату** → код `ABCD`
3. Друзья: та же ссылка → **Онлайн** → код `ABCD` → **Войти**
4. Ты (хост): **Начать игру**

---

## Управление (телефон, горизонтально)

- Джойстик слева — движение
- Правая часть экрана — прицел
- **ОГОНЬ** — стрелять
- **☰** — пауза

## GitHub

https://github.com/Bauyrzhan01/Bauka-Game
