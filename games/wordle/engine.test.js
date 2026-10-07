const { test } = require('node:test');
const assert = require('node:assert/strict');
const g = require('./engine.js');
const words = require('./words.js');
const state = answer => ({ answer, guesses: [], draft: '' });

test('dictionary contains every answer and only five-letter words', () => {
  const allowed = new Set(words.allowed);
  assert.ok(words.answers.length > 900);
  assert.ok(allowed.size > 14000);
  assert.equal(new Set(words.answers).size, words.answers.length);
  assert.ok(words.answers.every(word => allowed.has(word)));
  assert.ok(words.allowed.every(word => /^[A-Z]{5}$/.test(word)));
});

test('new rounds never immediately repeat the previous answer', () => {
  const previous = g.fresh(undefined, () => 0);
  const next = g.fresh(previous.answer, () => 0);
  assert.notEqual(next.answer, previous.answer);
  assert.ok(g.valid(next));
});

test('exact matches reserve letters before misplaced duplicates', () => {
  assert.deepEqual(g.score('APPLE', 'ALLEY'), ['correct', 'present', 'absent', 'present', 'absent']);
  assert.deepEqual(g.score('LEVEL', 'EERIE'), ['present', 'correct', 'absent', 'absent', 'absent']);
  assert.deepEqual(g.score('SHEEP', 'SPEED'), ['correct', 'present', 'correct', 'correct', 'absent']);
  assert.deepEqual(g.score('LLAMA', 'LLAMA'), Array(5).fill('correct'));
});

test('letter matches never exceed the available copies', () => {
  for (const answer of ['APPLE', 'LEVEL', 'LLAMA', 'SHEEP', 'BANAL']) {
    for (const guess of ['ALLEY', 'EERIE', 'MAMMA', 'PEEPS', 'CANAL']) {
      const marks = g.score(answer, guess);
      for (const letter of new Set(guess)) {
        const matched = [...guess].filter((c, i) => c === letter && marks[i] !== 'absent').length;
        assert.equal(matched, Math.min([...answer].filter(c => c === letter).length, [...guess].filter(c => c === letter).length));
      }
    }
  }
});

test('invalid and repeated guesses do not consume attempts', () => {
  const s = state('PLANT');
  for (const draft of ['CAT', 'ZZZZZ', '12ABC']) {
    s.draft = draft;
    assert.ok(g.submit(s));
    assert.equal(s.guesses.length, 0);
  }
  s.draft = 'crane';
  assert.equal(g.submit(s), null);
  assert.deepEqual(s.guesses, ['CRANE']);
  assert.equal(s.draft, '');
  s.draft = 'CRANE';
  assert.ok(g.submit(s));
  assert.equal(s.guesses.length, 1);
});

test('six attempts end the round, including a win on the last attempt', () => {
  const s = state('PLANT');
  for (const draft of ['CRANE', 'SLATE', 'BRICK', 'SOUND', 'MIGHT']) {
    s.draft = draft; assert.equal(g.submit(s), null);
  }
  const loser = structuredClone(s);
  loser.draft = 'GHOST'; assert.equal(g.submit(loser), null);
  assert.ok(g.over(loser)); assert.equal(g.won(loser), false);
  assert.ok(g.submit(loser)); assert.equal(loser.guesses.length, 6);
  s.draft = 'PLANT'; assert.equal(g.submit(s), null);
  assert.ok(g.won(s)); assert.ok(g.over(s)); assert.ok(g.valid(s));
});

test('keyboard colors keep the strongest evidence for repeated letters', () => {
  const s = state('APPLE');
  s.guesses = ['ALLEY', 'LEMON'];
  const keys = g.keyboard(s);
  assert.equal(keys.L, 'present'); assert.equal(keys.E, 'present');
  assert.equal(keys.A, 'correct'); assert.equal(keys.Y, 'absent');
});

test('save validation rejects malformed and impossible round histories', () => {
  const s = state('PLANT'); s.draft = 'CRA';
  assert.ok(g.valid(JSON.parse(JSON.stringify(s))));
  for (const bad of [null, {}, { ...s, answer: 'ZZZZZ' }, { ...s, guesses: ['CRANE', 'CRANE'] },
    { ...s, guesses: ['PLANT', 'CRANE'], draft: '' }, { ...s, guesses: ['PLANT'] }]) {
    assert.equal(!!g.valid(bad), false);
  }
});
