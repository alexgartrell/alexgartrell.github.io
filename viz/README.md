# Hidden visualizations

Open `index.html` to browse the visualizations, or open any one's `index.html`
directly. The main site intentionally does not link here. Each page uses local
files and runs without a build step, external dependencies, network requests, or
a backend.

| Visualization | What it shows |
| --- | --- |
| Darts for π | Random darts on a square with an inscribed circle; π ≈ 4 × (1 − outside ÷ darts); play, bursts up to one million, speed control, and a convergence chart with a 95% band |
| Buffon’s needle | Needles on lines spaced t apart; π ≈ 2ℓ × needles ÷ (t × crossings); needle-length slider; bursts up to one million; convergence chart with a 95% band |
| Galton board | Balls hop peg to peg into bins; binomial and normal curves overlaid; observed mean and SD against np and √(np(1−p)); sliders for p, rows, and rate; presets |
| Birthday paradox | A room fills on a 365-day ring and shared birthdays connect; exact P(n) live; fill until a match; simulate 1,000 rooms against the exact curve |
| Monty Hall | Play by hand with animated doors, or simulate both strategies up to 1M games; 3–100 doors; win rates converge to 1/n and (n−1)/n on a log chart |
| Chaos game | Triangle, square, pentagon, hexagon, and Barnsley fern presets; jump ratio and rule controls; draggable corners; slow mode animates each jump |
| Double pendulum | 3–50 pendulums ε apart, integrated with RK4; drag a bob to set the start; gravity presets; energy drift readout; divergence time and Lyapunov estimate |
| Mandelbrot explorer | Click, wheel, or pinch to zoom and drag to pan; progressive rendering with smooth coloring and palettes; famous-location presets; live Julia preview |
| Game of Life | Draw or erase cells; play, step, speed, random fill, wrap-around edges; glider, LWSS, pulsar, glider gun, R-pentomino, and acorn presets; population sparkline |
| Sorting race | Bubble, insertion, selection, merge, quick, and heap sort race on the same input; compare and write counts; input shapes; optional sound |
| Pathfinding | Draw walls and mud, drag start and goal; BFS, Dijkstra, A*, and greedy best-first alone or in a 2×2 race; maze, random, and empty presets; scoreboard |
| Fourier epicycles | Draw a closed shape or pick a preset; DFT circles trace it back; circle-count slider and build-up sweep; energy captured and error readouts |

All pages follow the light or dark system theme, fit narrow screens, honor
reduced-motion preferences, and list their keyboard shortcuts under the controls.

## Development

Each visualization lives in its own directory and shares `shared/viz.css` for
layout, controls, and theme tokens. Pure math and algorithm modules export to both
a browser global and CommonJS for testing.

```sh
node --test viz/*/*.test.js
```

Add future visualizations to `viz/index.html`, preserving relative links and
local assets. Keep the primary homepage unlinked.
