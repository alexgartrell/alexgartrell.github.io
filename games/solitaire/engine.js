/* Pure game rules, shared by the browser and Node's built-in tests. */
(function (root) {
  const suits = ['♠', '♥', '♣', '♦'];
  const red = card => card.suit % 2 === 1;
  function deal(random = Math.random) {
    const stock = Array.from({ length: 52 }, (_, id) => ({
      id, suit: Math.floor(id / 13), rank: id % 13 + 1, up: false
    }));
    for (let i = stock.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [stock[i], stock[j]] = [stock[j], stock[i]];
    }
    const tableau = Array.from({ length: 7 }, (_, i) => {
      const pile = stock.splice(stock.length - i - 1);
      pile[pile.length - 1].up = true;
      return pile;
    });
    return { stock, waste: [], foundations: [[], [], [], []], tableau, moves: 0 };
  }
  function pile(state, location) {
    return location.kind === 'waste' ? state.waste : state[location.kind]?.[location.pile];
  }
  function move(state, from, to) {
    if (!['waste', 'tableau', 'foundations'].includes(from.kind) ||
        !['tableau', 'foundations'].includes(to.kind)) return false;
    const source = pile(state, from), target = pile(state, to);
    if (!source || !target || source === target || !Number.isInteger(from.index) || from.index < 0) return false;
    const cards = source.slice(from.index), first = cards[0], top = target.at(-1);
    if (!first || cards.some(card => !card.up)) return false;
    if (from.kind !== 'tableau' && cards.length !== 1) return false;
    if (cards.some((card, i) => i && (cards[i - 1].rank !== card.rank + 1 || red(cards[i - 1]) === red(card)))) return false;
    if (to.kind === 'foundations') {
      if (cards.length !== 1 || first.suit !== to.pile || first.rank !== (top ? top.rank + 1 : 1)) return false;
    } else if (top ? !top.up || first.rank !== top.rank - 1 || red(first) === red(top) : first.rank !== 13) return false;
    target.push(...source.splice(from.index));
    if (source.length) source.at(-1).up = true;
    state.moves++;
    return true;
  }
  function autoMove(state, from) {
    for (const kind of ['foundations', 'tableau']) {
      for (let index = 0; index < state[kind].length; index++) {
        if (move(state, from, { kind, pile: index })) return true;
      }
    }
    return false;
  }
  function draw(state) {
    if (state.stock.length) {
      const card = state.stock.pop();
      card.up = true;
      state.waste.push(card);
    } else if (state.waste.length) {
      state.stock = state.waste.reverse();
      state.waste = [];
      state.stock.forEach(card => { card.up = false; });
    } else return false;
    state.moves++;
    return true;
  }
  const won = state => state.foundations.every(p => p.length === 13);
  function valid(state) {
    if (!state || !Array.isArray(state.stock) || !Array.isArray(state.waste) ||
        !Array.isArray(state.tableau) || state.tableau.length !== 7 ||
        !Array.isArray(state.foundations) || state.foundations.length !== 4 ||
        !Number.isInteger(state.moves) || state.moves < 0) return false;
    const piles = [state.stock, state.waste, ...state.tableau, ...state.foundations];
    if (!piles.every(Array.isArray)) return false;
    const cards = piles.flat();
    return cards.length === 52 && new Set(cards.map(c => c?.id)).size === 52 &&
      cards.every(c => c && Number.isInteger(c.id) && c.id >= 0 && c.id < 52 &&
        c.suit === Math.floor(c.id / 13) && c.rank === c.id % 13 + 1 && typeof c.up === 'boolean');
  }
  const api = { suits, red, deal, pile, move, autoMove, draw, won, valid };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Solitaire = api;
})(globalThis);
