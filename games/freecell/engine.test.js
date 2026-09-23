const { test } = require('node:test');
const a = require('node:assert/strict');
const g = require('./engine');
const c = (rank, suit = 0) => ({ rank, suit, up: true, id: suit * 13 + rank - 1 });
const blank = () => ({ tableau: Array.from({ length: 8 }, () => [c(9)]), cells: [[c(2)], [c(3)], [c(4)], [c(5)]], foundations: [[], [], [], []], moves: 0 });
const t = (pile, index = 0) => ({ kind: 'tableau', pile, index });
test('deals 52 unique face-up cards over eight columns', () => { const s = g.deal(); a.ok(g.valid(s)); a.deepEqual(s.tableau.map(p => p.length), [7,7,7,7,6,6,6,6]); });
test('sequence capacity counts free cells and excludes an empty destination', () => {
 const s = blank(); s.tableau[0] = [c(7), c(6,1)]; s.tableau[1] = [];
 a.equal(g.move(s,t(0),t(1)),false); s.cells[0] = [];
 a.ok(g.move(s,t(0),t(1))); a.equal(s.tableau[1].length,2);
});
test('empty auxiliary columns double capacity', () => {
 const s = blank(); s.tableau[0] = [c(7),c(6,1)]; s.tableau[1] = [c(8,1)]; s.tableau[2] = [];
 a.ok(g.move(s,t(0),t(1)));
});
test('cells hold one card and foundations build by suit', () => {
 const s = blank(); s.tableau[0] = [c(1)];
 a.equal(g.move(s,t(0),{kind:'cells',pile:0}),false);
 a.ok(g.autoMove(s,t(0))); a.equal(s.foundations[0].length,1);
});
