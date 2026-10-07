# Hidden visualizations

Open `index.html` to browse the visualizations, or open any one's `index.html`
directly. The main site intentionally does not link here. Each page uses local
files and runs without a build step, external dependencies, network requests, or
a backend.

| Visualization | What it shows |
| --- | --- |
| Darts for π | Random darts on a square with an inscribed circle; π ≈ 4 × (1 − outside ÷ darts); play, bursts up to one million, speed control, and a convergence chart with a 95% band |

## Development

Each visualization lives in its own directory. Pure math lives in a module that
exports to both a browser global and CommonJS for testing.

```sh
node --test viz/*/*.test.js
```

Add future visualizations to `viz/index.html`, preserving relative links and
local assets. Keep the primary homepage unlinked.
