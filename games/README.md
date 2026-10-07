# Hidden browser games

Open `index.html` to browse the games, or open any game's `index.html` directly.
The main site intentionally does not link here. Every game uses local files and
runs without a build step, external dependencies, network requests, or a backend.

| Game | Controls and features |
| --- | --- |
| Solitaire | Draw-one Klondike; click, double-click, or drag cards; undo |
| FreeCell | Four free cells; legal sequence limits; click, double-click, or drag; undo |
| Minesweeper | 9×9 or 16×16; safe first reveal; right-click or Flag to mark mines; click a revealed number to chord |
| 2048 | Arrow keys, WASD, swipe, or direction buttons; undo; best score |
| Sudoku | Two clue levels; uniquely solvable generated puzzles; numbers 1–9; Pencil or P; Delete to erase; undo |
| Spider | One, two, or four suits; same-suit sequence moves; stock deals full rows; undo |
| Nonograms | Six uniquely solvable 5×5 and 10×10 pictures; click to fill; right-click or Mark for empty cells; undo |
| Snake | Arrow keys, WASD, swipe, or direction buttons; three speeds; pause; best score |
| Reversi | Computer plays white at two strengths, or play locally with two people; legal-move hints; undo |
| Wordle | Six guesses; physical or on-screen keyboard; repeated-letter scoring; unlimited rounds |

The interfaces fit the available viewport. Grid games support keyboard focus;
card games retain click-to-select and keyboard button controls alongside dragging.
Reversi automatically handles passes and ends when neither player can move.

Progress and scores stay in browser local storage where available. Storage
behavior for `file:` URLs depends on the browser. Storage errors do not prevent
play. Snake resumes paused and automatically pauses when the tab loses focus.
New game immediately starts a fresh game; Nonograms advances to the next picture.

## Development

Each game lives in its own directory. Newer card games share `shared/cards.js`
and `shared/cards.css`; grid games share `shared/ui.js` and `shared/grid.css`.
Pure game engines export to both a browser global and CommonJS for testing.

Run all rule tests with Node:

```sh
node --test games/*/engine.test.js
```

Add future games to `games/index.html`, preserving relative links and local
assets. Keep the primary homepage unlinked.
