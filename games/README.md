# Games

Each game lives in its own directory with an `index.html` entry point. Add new
games to `games/index.html`. Use relative links and local assets so the pages
work on static hosting and when opened directly from disk.

## Solitaire

Open `solitaire/index.html` in a modern browser. No build step, dependencies,
API, or server is required. The game uses local storage for the current deal
and up to 100 undo states; if storage is unavailable, play continues in memory.
Storage behavior for `file:` URLs depends on the browser.

Run the game-rule tests with Node:

```sh
node --test games/solitaire/engine.test.js
```
