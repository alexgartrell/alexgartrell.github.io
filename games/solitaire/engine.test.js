const { test } = require('node:test');
const assert = require('node:assert/strict');
const game = require('./engine.js');
const card = (rank, suit = 0, up = true) => ({ id: suit * 13 + rank - 1, rank, suit, up });
const empty = () => ({ stock: [], waste: [], foundations: [[], [], [], []], tableau: Array.from({ length: 7 }, () => []), moves: 0 });
const from = (pile, index = 0) => ({ kind: 'tableau', pile, index });
test('deal contains 52 unique cards and the correct exposed tableau', () => {
  for (let i = 0; i < 100; i++) {
    const state = game.deal();
    assert.ok(game.valid(state));
    assert.equal(state.stock.length, 24);
    state.tableau.forEach((pile, n) => {
      assert.equal(pile.length, n + 1);
      assert.deepEqual(pile.map(c => c.up), [...Array(n).fill(false), true]);
    });
  }
});
test('draw and unlimited recycle preserve order and card count', () => {
  const state = game.deal();
  const order = state.stock.map(c => c.id);
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 24; i++) assert.ok(game.draw(state));
    assert.deepEqual(state.waste.map(c => c.id), [...order].reverse());
    assert.ok(game.draw(state));
    assert.deepEqual(state.stock.map(c => c.id), order);
    assert.ok(state.stock.every(c => !c.up));
    assert.ok(game.valid(state));
  }
  assert.equal(game.draw(empty()), false);
});
test('stack moves alternate colors, descend, and reveal covered cards', () => {
  const state = empty();
  state.tableau[0] = [card(3, 0, false), card(7, 1), card(6, 0)];
  state.tableau[1] = [card(8, 2)];
  assert.ok(game.move(state, from(0, 1), from(1)));
  assert.equal(state.tableau[0][0].up, true);
  assert.deepEqual(state.tableau[1].map(c => c.rank), [8, 7, 6]);
  assert.equal(state.moves, 1);
});
test('illegal moves do not mutate the game', () => {
  const state = empty();
  state.tableau[0] = [card(7)];
  state.tableau[1] = [card(8, 2)];
  state.tableau[2] = [card(9, 1)];
  state.tableau[3] = [card(8, 1, false)];
  const before = structuredClone(state);
  for (const destination of [0, 1, 2, 3, 4]) assert.equal(game.move(state, from(0), from(destination)), false);
  assert.equal(game.move(state, from(3), from(4)), false);
  assert.deepEqual(state, before);
});
test('empty columns accept King-led sequences only', () => {
  const state = empty();
  state.tableau[0] = [card(13), card(12, 1)];
  assert.equal(game.move(state, from(0, 1), from(1)), false);
  assert.ok(game.move(state, from(0), from(1)));
});
test('foundations require an Ace then ascending cards of the same suit', () => {
  const state = empty();
  const target = { kind: 'foundations', pile: 0 };
  state.waste = [card(2), card(1)];
  assert.equal(game.move(state, { kind: 'waste', index: 0 }, target), false);
  assert.ok(game.move(state, { kind: 'waste', index: 1 }, target));
  assert.ok(game.move(state, { kind: 'waste', index: 0 }, target));
  state.waste = [card(3, 1)];
  assert.equal(game.move(state, { kind: 'waste', index: 0 }, target), false);
  state.tableau[0] = [card(3, 1)];
  assert.ok(game.move(state, { ...target, index: 1 }, from(0)));
});
test('win detection and save validation', () => {
  const state = game.deal();
  assert.equal(game.won(state), false);
  assert.ok(game.valid(JSON.parse(JSON.stringify(state))));
  state.stock[0] = state.stock[1];
  assert.equal(game.valid(state), false);
  for (const bad of [null, {}, { tableau: null }, { ...game.deal(), moves: -1 }]) assert.equal(game.valid(bad), false);
  const victory = empty();
  victory.foundations = Array.from({ length: 4 }, (_, suit) => Array.from({ length: 13 }, (_, i) => card(i + 1, suit)));
  assert.ok(game.valid(victory));
  assert.ok(game.won(victory));
});
test('automatic moves prefer foundations over matching columns', () => {
  const state = empty();
  state.waste = [card(1)];
  state.tableau[0] = [card(2, 1)];
  assert.ok(game.autoMove(state, { kind: 'waste', index: 0 }));
  assert.equal(state.foundations[0][0].rank, 1);
  assert.equal(state.tableau[0].length, 1);
  assert.equal(state.moves, 1);
});
test('automatic moves use the first legal column and carry the sequence', () => {
  const state = empty();
  state.tableau[0] = [card(7), card(6, 1)];
  state.tableau[1] = [card(8, 2)];
  state.tableau[2] = [card(8, 1)];
  state.tableau[3] = [card(8, 3)];
  assert.ok(game.autoMove(state, from(0)));
  assert.deepEqual(state.tableau[2].map(c => c.rank), [8, 7, 6]);
  assert.equal(state.tableau[3].length, 1);
  assert.equal(state.moves, 1);
});
test('automatic moves leave a blocked card and history count unchanged', () => {
  const state = empty();
  state.waste = [card(5)];
  const before = structuredClone(state);
  assert.equal(game.autoMove(state, { kind: 'waste', index: 0 }), false);
  assert.deepEqual(state, before);
});
