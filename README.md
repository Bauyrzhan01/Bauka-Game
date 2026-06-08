# Bauka Game

Веб-игра на **Godot 4** с экспортом в браузер.

## Что уже есть

- Стартовая 2D-сцена с игроком (синий квадрат)
- Управление: **WASD** или **стрелки**
- Пресет экспорта **Web** → `export/web/index.html`

## 1. Установить Godot

1. Скачайте **Godot 4.3+** (Standard): https://godotengine.org/download
2. Распакуйте и запустите Godot
3. **Import** → выберите папку `C:\Projects\Bauka Game` → **Import & Edit**

## 2. Установить шаблоны для Web

В Godot:

1. **Editor → Manage Export Templates…**
2. **Download and Install** (версия должна совпадать с вашим Godot)
3. **Project → Export…** → пресет **Web** уже настроен
4. Нажмите **Export Project** → сохраните в `export/web/index.html`

## 3. Запустить игру локально

- В редакторе: кнопка **Play (F5)**
- Веб-версия: откройте `export/web/index.html` в браузере  
  (лучше через локальный сервер, если браузер блокирует файлы)

## 4. Выложить в интернет (GitHub Pages)

После экспорта в `export/web/` можно опубликовать игру бесплатно на GitHub Pages.

## Структура проекта

```
scenes/     — сцены игры
scripts/    — код GDScript
export/web/ — готовая веб-версия (не в git)
```

## GitHub

Репозиторий: https://github.com/Bauyrzhan01/Bauka-Game
