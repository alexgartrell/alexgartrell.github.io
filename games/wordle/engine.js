(function (root) {
  const words = typeof module !== 'undefined' ? require('./words.js') : root.WordleWords;
  const allowed = new Set(words.allowed);
  const answers = new Set(words.answers);

  function fresh(previous, random = Math.random) {
    const choices = words.answers.filter(word => word !== previous);
    return { answer: choices[Math.floor(random() * choices.length)], guesses: [], draft: '' };
  }

  // Exact matches consume letters first; yellows use only the remaining copies.
  function score(answer, guess) {
    const result = Array(5).fill('absent');
    const remaining = {};
    for (let i = 0; i < 5; i++) {
      if (guess[i] === answer[i]) result[i] = 'correct';
      else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
    for (let i = 0; i < 5; i++) {
      if (result[i] !== 'correct' && remaining[guess[i]] > 0) {
        result[i] = 'present';
        remaining[guess[i]]--;
      }
    }
    return result;
  }

  const won = state => state.guesses.at(-1) === state.answer;
  const over = state => won(state) || state.guesses.length === 6;

  function submit(state) {
    if (over(state)) return 'This round is finished.';
    const guess = state.draft.toUpperCase();
    if (!/^[A-Z]{5}$/.test(guess)) return 'Enter five letters.';
    if (!allowed.has(guess)) return 'Not in the word list.';
    if (state.guesses.includes(guess)) return 'You already tried that word.';
    state.guesses.push(guess);
    state.draft = '';
    return null;
  }

  function keyboard(state) {
    const result = {}, priority = { absent: 1, present: 2, correct: 3 };
    for (const guess of state.guesses) {
      score(state.answer, guess).forEach((mark, i) => {
        if ((priority[result[guess[i]]] || 0) < priority[mark]) result[guess[i]] = mark;
      });
    }
    return result;
  }

  function valid(state) {
    if (!state || !answers.has(state.answer) || !Array.isArray(state.guesses) ||
        state.guesses.length > 6 || !state.guesses.every(guess => allowed.has(guess)) ||
        new Set(state.guesses).size !== state.guesses.length ||
        typeof state.draft !== 'string' || !/^[A-Z]{0,5}$/.test(state.draft)) return false;
    const solvedAt = state.guesses.indexOf(state.answer);
    if (solvedAt !== -1 && solvedAt !== state.guesses.length - 1) return false;
    return !over(state) || state.draft === '';
  }

  const api = { fresh, score, submit, won, over, keyboard, valid };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Wordle = api;
})(globalThis);
