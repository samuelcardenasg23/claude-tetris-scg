# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tetris in vanilla JavaScript + HTML5 Canvas. No dependencies, no build step, no package.json, no tests, no linter. The README is in Spanish, as is the in-game UI text (keep that language for user-facing strings).

## Running

Open `index.html` directly, or serve statically (e.g. `python3 -m http.server 8000` and visit `http://localhost:8000`).

## Architecture

Three files, all loaded by `index.html` (`game.js` via a plain `<script>`, not a module):

- `index.html` — fixed DOM: `#board` canvas (300×600 = 10×20 cells at 30px), `#next-canvas` (120×120), HUD spans (`#score`, `#lines`, `#level`), and the `#overlay` used for both pause and game over.
- `style.css` — layout/theme; the overlay is toggled via the `hidden` class.
- `game.js` — all logic, in one file using top-level globals (`board`, `current`, `next`, `score`, ...), reset in `init()`.

### game.js key points

- **Piece encoding**: piece type is 1–12 and the same number is stored in the shape matrices, in `board` cells, and as the index into `COLORS`. `0` means empty. 1–7 are the standard tetrominoes (I,O,T,S,Z,J,L); 8–10 and 12 are special pieces (`+`, U, Y pentominoes and a hollow 3×3 ring) that `randomPiece()` picks with `SPECIAL_CHANCE`; 11 is the 1×1 reward piece, only spawned after a 4-line clear (`clearLines()` replaces `next` with it). Adding a piece requires updating `PIECES`, `COLORS`, and the matching `STANDARD_TYPES`/`SPECIAL_TYPES` list. Previews (`drawPreview`) centre and scale any shape, so shapes are not limited to 4×4.
- **Game loop**: `requestAnimationFrame` `loop(ts)` accumulates time into `dropAccum` and gravity-drops when it exceeds `dropInterval`. Input is handled separately in a `keydown` listener (no DOM events drive gravity). Pause/game-over stop the loop via `cancelAnimationFrame(animId)`; unpausing resets `lastTime` and restarts `loop`.
- **Flow**: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next`, game over if the new piece collides immediately).
- **Rotation**: `rotateCW` + `tryRotate` with simple horizontal wall kicks `[0,-1,1,-2,2]` (no SRS tables).
- **Scoring**: `LINE_SCORES` × level; soft drop +1/cell, hard drop +2/cell. Level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Rendering**: `draw()` repaints the whole board each frame (grid, locked cells, ghost at alpha 0.2 via `ghostY()`, current piece). `drawBlock` is shared by the main and next-piece canvases.
