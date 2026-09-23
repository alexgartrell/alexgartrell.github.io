(() => {
  const game = window.CardGame;
  const variant = document.body.dataset.game;
  const key = `${variant}-v1`;
  const mode = document.getElementById('mode');
  let state = game.deal(), history = [], selected = null;
  let drag = null, suppressClick = false;
  const status = document.getElementById('status');
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && game.valid(saved.state)) {
      state = saved.state;
      if (mode) mode.value = state.mode;
      history = Array.isArray(saved.history) ? saved.history.filter(game.valid).slice(-100) : [];
    }
  } catch { status.textContent = 'Local saving is unavailable. You can still play this session.'; }
  const name = card => `${({ 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' })[card.rank] || card.rank} of ${['spades', 'hearts', 'clubs', 'diamonds'][card.suit]}`;
  function save() {
    try { localStorage.setItem(key, JSON.stringify({ state, history })); }
    catch { status.textContent = 'Local saving is unavailable. You can still play this session.'; }
  }
  function commit(action) {
    const before = structuredClone(state);
    if (!action()) return false;
    history.push(before);
    if (history.length > 100) history.shift();
    selected = null;
    save();
    render();
    status.textContent = game.won(state) ? 'You won! Start a new game to play again.' : 'Select a card, then its destination.';
    return true;
  }
  function choose(location) {
    if (selected && commit(() => game.move(state, selected, location))) return;
    const card = game.pile(state, location)?.[location.index];
    if (card?.up) {
      if (selected && selected.kind === location.kind && selected.pile === location.pile && selected.index === location.index) {
        selected = null;
        status.textContent = 'Selection cleared.';
      } else {
        const wasSelected = !!selected;
        selected = location;
        status.textContent = `${wasSelected ? 'That move is not allowed. ' : ''}${name(card)} selected. Choose a destination.`;
      }
      updateSelection();
    } else status.textContent = selected ? 'That move is not allowed. Choose another destination.' : 'Select a face-up card first.';
  }
  function button(label, action, className = '') {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.setAttribute('aria-label', label);
    el.addEventListener('click', action);
    return el;
  }
  function autoMove(location) {
    const positions = new Map();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const card of game.pile(state, location).slice(location.index)) {
        const el = document.querySelector(`[data-card-id="${card.id}"]`);
        if (el) positions.set(card.id, el.getBoundingClientRect());
      }
    }
    if (!commit(() => game.autoMove(state, location))) return false;
    // Animate the freshly rendered cards from their old positions to their new ones.
    // The move is already committed, so undo and further moves stay responsive.
    let layer = 100;
    for (const [id, before] of positions) {
      const el = document.querySelector(`[data-card-id="${id}"]`);
      if (!el || !el.animate) continue;
      const after = el.getBoundingClientRect();
      el.style.zIndex = String(layer++);
      const animation = el.animate([
        { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)` },
        { transform: 'translate(0, 0)' }
      ], { duration: 160, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
      const cleanup = () => { el.style.zIndex = ''; };
      animation.onfinish = cleanup;
      animation.oncancel = cleanup;
    }
    return true;
  }
  function cardButton(card, location) {
    const el = button(name(card), event => {
      if (event.detail <= 1) choose(location);
    }, `card ${game.red(card) ? 'red' : 'black'}`);
    el.addEventListener('dblclick', event => {
      event.preventDefault();
      if (!autoMove(location)) {
        status.textContent = `No legal destination for ${name(card)}.`;
      }
    });
    el.dataset.location = JSON.stringify(location);
    el.dataset.cardId = card.id;
    const rank = ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[card.rank] || card.rank;
    const corner = document.createElement('span');
    corner.className = 'corner';
    corner.textContent = `${rank}${game.suits[card.suit]}`;
    const suit = document.createElement('span');
    suit.className = 'suit';
    suit.textContent = game.suits[card.suit];
    el.append(corner, suit);
    const active = selected && selected.kind === location.kind && selected.pile === location.pile && location.index >= selected.index;
    el.classList.toggle('selected', !!active);
    el.setAttribute('aria-pressed', String(!!active));
    return el;
  }
  // Keep the card elements in place between clicks so native double-clicks work.
  function updateSelection() {
    document.querySelectorAll('[data-location]').forEach(el => {
      const location = JSON.parse(el.dataset.location);
      const active = selected && selected.kind === location.kind && selected.pile === location.pile && location.index >= selected.index;
      el.classList.toggle('selected', !!active);
      el.setAttribute('aria-pressed', String(!!active));
    });
  }
  function render() {
    cancelDrag();
    const focusKey = document.activeElement?.dataset.focus;
    const top = document.getElementById('top-row');
    const tableau = document.getElementById('tableau');
    top.replaceChildren();
    tableau.replaceChildren();
    if (state.cells) {
      state.cells.forEach((pile, i) => {
        const location = { kind: 'cells', pile: i, index: pile.length - 1 };
        const el = pile.length ? cardButton(pile[0], location) : button(`Free cell ${i + 1}`, () => choose(location), 'slot');
        if (!pile.length) el.textContent = 'Free';
        el.dataset.focus = `cell-${i}`;
        el.dataset.drop = JSON.stringify({ kind: 'cells', pile: i });
        top.append(el);
      });
    } else {
      const stock = button(`Deal a row, ${state.stock.length} cards remaining`, () => {
        if (!commit(() => game.draw(state))) status.textContent = 'Fill every empty column before dealing a new row.';
      }, 'slot stock back');
      stock.textContent = `Deal · ${state.stock.length / 10}`;
      stock.disabled = !state.stock.length;
      stock.dataset.focus = 'stock';
      top.append(stock, document.createElement('div'));
    }
    state.foundations.forEach((pile, i) => {
      const location = { kind: 'foundations', pile: i, index: pile.length - 1 };
      const el = variant === 'spider' ? button(`Completed sequence ${i + 1}`, () => {}, 'slot foundation') : pile.length ? cardButton(pile.at(-1), location) : button(`${['Spades', 'Hearts', 'Clubs', 'Diamonds'][i]} foundation, start with Ace`, () => choose(location), 'slot foundation');
      if (variant === 'spider') { el.textContent = pile.length ? 'K–A ✓' : 'K–A'; el.disabled = true; }
      else if (!pile.length) el.textContent = game.suits[i];
      el.dataset.focus = `foundation-${i}`;
      if (variant !== 'spider') el.dataset.drop = JSON.stringify({ kind: 'foundations', pile: i });
      top.append(el);
    });
    state.tableau.forEach((pile, i) => {
      const column = document.createElement('div');
      column.className = 'column';
      column.dataset.drop = JSON.stringify({ kind: 'tableau', pile: i });
      column.setAttribute('role', 'group');
      column.setAttribute('aria-label', `Column ${i + 1}`);
      column.style.setProperty('--spacing', Math.min(1, 12 / Math.max(1, pile.length - 1)));
      const empty = button(`Column ${i + 1}${pile.length ? ', place selected cards' : ', empty'}`, () => choose({ kind: 'tableau', pile: i, index: -1 }), 'slot column-slot');
      empty.textContent = pile.length ? '' : '◇';
      empty.dataset.focus = `column-${i}`;
      column.append(empty);
      pile.forEach((card, index) => {
        let el;
        if (card.up) el = cardButton(card, { kind: 'tableau', pile: i, index });
        else {
          el = document.createElement('div');
          el.className = 'card back';
          el.setAttribute('aria-label', 'Face-down card');
        }
        el.style.setProperty('--index', index);
        el.dataset.focus = `card-${card.id}`;
        column.append(el);
      });
      tableau.append(column);
    });
    status.dataset.won = String(game.won(state));
    document.getElementById('undo').disabled = !history.length;
    document.getElementById('stats').textContent = `${state.moves} moves · ${state.foundations.reduce((n, p) => n + p.length, 0)}/${variant === 'spider' ? 104 : 52} home`;
    if (focusKey) document.querySelector(`[data-focus="${focusKey}"]`)?.focus({ preventScroll: true });
  }
  function cancelDrag() {
    if (!drag) return;
    const current = drag;
    drag = null;
    if (current.active) suppressClick = true;
    current.layer?.remove();
    current.cards?.forEach(el => el.classList.remove('drag-source'));
    current.target?.classList.remove('drop-target');
    if (current.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId);
  }
  const board = document.querySelector('.board');
  // Fit both card rows and a full stack into the actual available viewport.
  // Stack length never affects the board's dimensions.
  new ResizeObserver(([entry]) => {
    cancelDrag();
    const { width, height } = entry.contentRect;
    const gap = Math.min(16, width * .015, height * .03);
    const cardWidth = Math.max(1, Math.min((width - (state.tableau.length - 1) * gap) / state.tableau.length, (height - gap) / 5.2));
    const cardHeight = cardWidth * 1.4;
    const step = Math.max(0, Math.min(cardWidth * .2, (height - gap - 2 * cardHeight) / 12));
    board.style.setProperty('--card-width', `${cardWidth}px`);
    board.style.setProperty('--card-height', `${cardHeight}px`);
    board.style.setProperty('--step', `${step}px`);
    board.style.setProperty('--row-gap', `${gap}px`);
    // The floating drag layer inherits these sizes from the body as well.
    document.body.style.setProperty('--rank-size', `${Math.max(9, Math.min(28, cardWidth * .2))}px`);
    document.body.style.setProperty('--suit-size', `${cardWidth * .4}px`);
    document.body.style.setProperty('--slot-size', `${Math.max(8, Math.min(16, cardWidth * .16))}px`);
  }).observe(board);
  // A drag must not also trigger click-to-move or double-click auto-move.
  for (const type of ['click', 'dblclick']) {
    board.addEventListener(type, event => {
      if (suppressClick && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }
  board.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    suppressClick = false;
    const source = event.target.closest('[data-location]');
    if (!source) return;
    drag = {
      source, from: JSON.parse(source.dataset.location), pointerId: event.pointerId,
      x: event.clientX, y: event.clientY, active: false
    };
    source.setPointerCapture(event.pointerId);
  });
  function dragTarget(event) {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop]');
    if (!target || !board.contains(target)) return null;
    const to = JSON.parse(target.dataset.drop);
    return game.move(structuredClone(state), drag.from, to) ? target : null;
  }
  document.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.active = true;
      selected = null;
      updateSelection();
      drag.layer = document.createElement('div');
      drag.layer.className = 'drag-layer';
      drag.layer.setAttribute('aria-hidden', 'true');
      drag.cards = game.pile(state, drag.from).slice(drag.from.index).map(card =>
        board.querySelector(`[data-card-id="${card.id}"]`));
      for (const el of drag.cards) {
        const rect = el.getBoundingClientRect();
        const copy = el.cloneNode(true);
        copy.removeAttribute('data-location');
        copy.removeAttribute('data-card-id');
        copy.removeAttribute('data-drop');
        copy.removeAttribute('data-focus');
        copy.tabIndex = -1;
        Object.assign(copy.style, {
          left: `${rect.left}px`, top: `${rect.top}px`,
          width: `${rect.width}px`, height: `${rect.height}px`, zIndex: ''
        });
        drag.layer.append(copy);
        el.classList.add('drag-source');
      }
      document.body.append(drag.layer);
    }
    event.preventDefault();
    drag.layer.style.transform = `translate(${dx}px, ${dy}px)`;
    drag.target?.classList.remove('drop-target');
    drag.target = dragTarget(event);
    drag.target?.classList.add('drop-target');
  }, { passive: false });
  document.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { from, active } = drag;
    const target = active ? dragTarget(event) : null;
    const to = target ? JSON.parse(target.dataset.drop) : null;
    cancelDrag();
    if (active && !(to && commit(() => game.move(state, from, to)))) {
      status.textContent = 'No legal move there. Cards returned to their original position.';
    }
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    document.addEventListener(type, event => {
      if (drag?.pointerId === event.pointerId) cancelDrag();
    });
  }
  window.addEventListener('blur', cancelDrag);
  window.addEventListener('resize', cancelDrag);
  document.getElementById('undo').addEventListener('click', () => {
    if (!history.length) return;
    state = history.pop();
    selected = null;
    save(); render(); status.textContent = 'Move undone.';
  });
  document.getElementById('new-game').addEventListener('click', () => {
    state = game.deal(mode ? Number(mode.value) : undefined); history = []; selected = null;
    save(); render(); status.textContent = 'New game dealt. Good luck!';
  });
  mode?.addEventListener('change', () => document.getElementById('new-game').click());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { cancelDrag(); selected = null; updateSelection(); status.textContent = 'Selection cleared.'; }
  });
  render();
  if (game.won(state)) status.textContent = 'You won! Start a new game to play again.';
  save();
})();
