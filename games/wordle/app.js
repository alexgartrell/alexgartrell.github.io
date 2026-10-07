(() => {
  const g = Wordle, ui = GameUI, key = 'wordle-v1';
  const grid = document.getElementById('grid');
  const keyboard = document.getElementById('keyboard');
  let state = ui.load(key, g.valid) || g.fresh();
  const labels = { correct: 'correct position', present: 'wrong position', absent: 'not matched' };
  const keys = new Map();

  function save() { ui.save(key, state); }

  function render(message = '') {
    grid.replaceChildren();
    for (let row = 0; row < 6; row++) {
      const submitted = state.guesses[row];
      const word = submitted || (row === state.guesses.length ? state.draft : '');
      const marks = submitted ? g.score(state.answer, submitted) : [];
      for (let column = 0; column < 5; column++) {
        const letter = word[column] || '';
        const tile = document.createElement('div');
        tile.className = `cell letter ${marks[column] || (letter ? 'typed' : '')}`;
        tile.textContent = letter;
        tile.setAttribute('aria-label', `Guess ${row + 1}, letter ${column + 1}: ${letter || 'empty'}${marks[column] ? `, ${labels[marks[column]]}` : ''}`);
        grid.append(tile);
      }
    }
    const marks = g.keyboard(state);
    for (const [letter, button] of keys) {
      button.className = `key ${marks[letter] || ''}`;
      button.setAttribute('aria-label', `${letter === 'Enter' ? 'Submit guess' : letter === 'Backspace' ? 'Delete letter' : letter}${marks[letter] ? `, ${labels[marks[letter]]}` : ''}`);
      button.disabled = g.over(state);
    }
    document.getElementById('stats').textContent = `${state.guesses.length}/6`;
    ui.status(g.won(state) ? `${state.answer} — solved in ${state.guesses.length}!` : g.over(state) ? `The word was ${state.answer}.` : message);
  }

  function input(letter) {
    if (g.over(state)) return;
    if (document.activeElement?.closest('.toolbar')) grid.focus({ preventScroll: true });
    let message = '';
    if (letter === 'Enter') {
      const error = g.submit(state);
      if (error) { render(error); return; }
      const marks = g.score(state.answer, state.guesses.at(-1));
      message = `${marks.filter(mark => mark === 'correct').length} correct, ${marks.filter(mark => mark === 'present').length} misplaced.`;
    } else if (letter === 'Backspace') {
      state.draft = state.draft.slice(0, -1);
    } else if (/^[A-Z]$/.test(letter) && state.draft.length < 5) {
      state.draft += letter;
    } else return;
    save(); render(message);
  }

  for (const letters of ['QWERTYUIOP'.split(''), 'ASDFGHJKL'.split(''), ['Enter', ...'ZXCVBNM', 'Backspace']]) {
    const row = document.createElement('div'); row.className = 'keyboard-row';
    for (const letter of letters) {
      const button = ui.button(letter, letter === 'Backspace' ? '⌫' : letter === 'Enter' ? 'Enter' : letter, () => input(letter), 'key');
      if (letter.length > 1) button.dataset.wide = 'true';
      // Touch/mouse typing should leave physical keyboard input on the game.
      button.addEventListener('pointerdown', event => event.preventDefault());
      keys.set(letter, button); row.append(button);
    }
    keyboard.append(row);
  }
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.target.matches('input, textarea, select')) return;
    const letter = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    if (letter === 'Enter' && event.target.closest('.toolbar')) return;
    if (/^[A-Z]$/.test(letter) || ['Enter', 'Backspace', 'Delete'].includes(letter)) {
      event.preventDefault(); input(letter === 'Delete' ? 'Backspace' : letter);
    }
  });
  document.getElementById('new-game').addEventListener('click', () => {
    state = g.fresh(state.answer); save(); render();
  });
  save(); render();
})();
