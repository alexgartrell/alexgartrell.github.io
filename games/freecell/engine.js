(function (root) {
  const suits = ['♠', '♥', '♣', '♦'];
  const red = c => c.suit % 2 === 1;
  function deal() {
    const cards = Array.from({ length: 52 }, (_, id) => ({ id, suit: Math.floor(id / 13), rank: id % 13 + 1, up: true }));
    for (let i = 51; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    const tableau = Array.from({ length: 8 }, () => []);
    cards.forEach((c, i) => tableau[i % 8].push(c));
    return { tableau, cells: [[], [], [], []], foundations: [[], [], [], []], moves: 0 };
  }
  const pile = (s, l) => s[l.kind]?.[l.pile];
  function move(s, from, to) {
    if (!['tableau', 'cells', 'foundations'].includes(from.kind) || !['tableau', 'cells', 'foundations'].includes(to.kind)) return false;
    const a = pile(s, from), b = pile(s, to);
    if (!a || !b || a === b || !Number.isInteger(from.index) || from.index < 0) return false;
    const cards = a.slice(from.index), first = cards[0], top = b.at(-1);
    if (!first || (from.kind !== 'tableau' && cards.length !== 1)) return false;
    if (cards.some((c, i) => i && (cards[i - 1].rank !== c.rank + 1 || red(cards[i - 1]) === red(c)))) return false;
    if (to.kind === 'foundations') {
      if (cards.length !== 1 || first.suit !== to.pile || first.rank !== (top?.rank || 0) + 1) return false;
    } else if (to.kind === 'cells') {
      if (b.length || cards.length !== 1) return false;
    } else {
      if (top && (top.rank !== first.rank + 1 || red(top) === red(first))) return false;
      const free = s.cells.filter(p => !p.length).length;
      const empty = s.tableau.filter((p, i) => !p.length && i !== to.pile).length;
      if (cards.length > (free + 1) * 2 ** empty) return false;
    }
    b.push(...a.splice(from.index)); s.moves++; return true;
  }
  function autoMove(s, from) {
    for (const kind of ['foundations', 'tableau', 'cells']) {
      for (let i = 0; i < s[kind].length; i++) if (move(s, from, { kind, pile: i })) return true;
    }
    return false;
  }
  const won = s => s.foundations.every(p => p.length === 13);
  function valid(s) {
    if (!s || !Number.isInteger(s.moves) || s.moves < 0) return false;
    if (![ ['tableau', 8], ['cells', 4], ['foundations', 4] ].every(([k, n]) => Array.isArray(s[k]) && s[k].length === n && s[k].every(Array.isArray))) return false;
    const cards = [...s.tableau, ...s.cells, ...s.foundations].flat();
    return cards.length === 52 && new Set(cards.map(c => c?.id)).size === 52 && cards.every(c => c && Number.isInteger(c.id) && c.id >= 0 && c.id < 52 && c.rank === c.id % 13 + 1 && c.suit === Math.floor(c.id / 13) && c.up === true) && s.cells.every(p => p.length <= 1);
  }
  const api = { suits, red, deal, pile, move, autoMove, won, valid };
  if (typeof module !== 'undefined') module.exports = api; else root.CardGame = api;
})(globalThis);
