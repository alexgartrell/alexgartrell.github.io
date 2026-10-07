# Wordle

A local, unlimited-round five-letter word game. Each round allows six valid
word guesses. Exact matches are green, misplaced letters are gold, and unmatched
letters are gray. Exact matches consume duplicate letters before misplaced
matches. The keyboard always retains the strongest evidence for each letter.

Type with a physical keyboard, or use the on-screen keys. Enter submits and
Backspace/Delete erases. New game immediately selects a different answer.
The answer, submitted guesses, and unfinished guess persist locally. No account,
network requests, daily schedule, or server is needed.

`words.js` contains 925 curated answers and 14,855 accepted guesses. The broader
guess dictionary is bundled from [Tab Atkins's wordle-list](https://github.com/tabatkins/wordle-list)
(retrieved September 23, 2026), with the answer bank added. Its MIT license is
preserved in [WORD-LIST-LICENSE.txt](WORD-LIST-LICENSE.txt). The game does not
fetch the dictionary at runtime.

```sh
node --test games/wordle/engine.test.js
```
