window.GameUI = {
  load(key, valid) {
    try { const value = JSON.parse(localStorage.getItem(key)); return valid(value) ? value : null; } catch { return null; }
  },
  save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ } },
  button(label, text, action, className = 'cell') {
    const el = document.createElement('button'); el.type = 'button'; el.className = className;
    el.setAttribute('aria-label', label); el.textContent = text; el.addEventListener('click', action); return el;
  },
  status(text) { document.getElementById('status').textContent = text; },
  // Arrow keys move focus within a grid; Enter/Space keep native button behavior.
  gridKeys(grid, columns) {
    grid.addEventListener('keydown', event => {
      const cells = [...grid.querySelectorAll('button[data-cell]')];
      const index = cells.indexOf(document.activeElement);
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns(), ArrowDown: columns() };
      if (index < 0 || !(event.key in offsets)) return;
      event.preventDefault(); const next = index + offsets[event.key];
      if (next >= 0 && next < cells.length) cells[next].focus();
    });
  }
};
